"""Google/Microsoft OAuth connection flows and calendar aggregation
(/api/integrations/*, /auth/google/callback, /auth/microsoft/callback)."""

from __future__ import annotations

import logging
import os
import secrets
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Optional
from urllib.parse import urlencode

import httpx
import jwt
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse

from app.core.clients import supabase
from app.core.config import ALLOWED_ORIGINS, CHATTY_BACKEND_URL, CHATTY_FRONTEND_URL, FUNCTION_SECRET
from app.core.crypto import decrypt_secret, encrypt_secret
from app.core.db import run_db
from app.core.deps import require_user
from plugins import google_integrations as g
from plugins import microsoft_integrations as ms

from app.services.chatty_quota_service import plan_for

logger = logging.getLogger("chatty")

router = APIRouter()

# ---------------------------------------------------------------------------
# WhatsApp Business OAuth / one-click onboarding
# ---------------------------------------------------------------------------


def _whatsapp_redirect_uri() -> str:
    return os.environ.get("FACEBOOK_REDIRECT_URI") or f"{CHATTY_BACKEND_URL}/auth/whatsapp/callback"


def _whatsapp_redirect(frontend: str, path: str, status: str) -> RedirectResponse:
    separator = "&" if "?" in path else "?"
    return RedirectResponse(f"{frontend}{path}{separator}whatsapp={status}")


@router.post("/api/integrations/whatsapp/start")
async def whatsapp_start(
    request: Request,
    bot_id: str,
    redirect_path: Optional[str] = None,
    user: dict[str, Any] = Depends(require_user),
):
    """Return Meta's OAuth URL for Embedded Signup-style onboarding.

    The dashboard opens this URL in the user's browser; the callback exchanges
    the code, discovers the first WABA phone number, subscribes the app, and
    writes encrypted credentials to the selected bot.
    """
    if not os.environ.get("FACEBOOK_APP_ID") or not os.environ.get("FACEBOOK_APP_SECRET"):
        raise HTTPException(status_code=503, detail="Meta WhatsApp connection is not configured")
    bot = await run_db(lambda: supabase.table("chatty_bots").select("id").eq("id", bot_id).eq("user_id", user["auth_user_id"]).limit(1).execute())
    if not bot.data:
        raise HTTPException(status_code=404, detail="Bot not found")
    origin = request.headers.get("origin", "").rstrip("/")
    if origin not in ALLOWED_ORIGINS:
        origin = ""
    path = redirect_path or "/dashboard?tab=integrations"
    state = _mint_state(user["auth_user_id"], origin_url=origin, redirect_path=path, mode="whatsapp", extra_claims={"bot_id": bot_id})
    params = {
        "client_id": os.environ["FACEBOOK_APP_ID"],
        "redirect_uri": _whatsapp_redirect_uri(),
        "state": state,
        "response_type": "code",
        "scope": "business_management,whatsapp_business_management,whatsapp_business_messaging",
    }
    return {"url": "https://www.facebook.com/v23.0/dialog/oauth?" + urlencode(params)}


@router.get("/auth/whatsapp/callback")
async def whatsapp_callback(code: Optional[str] = None, state: Optional[str] = None, error: Optional[str] = None):
    if not state:
        return _whatsapp_redirect(CHATTY_FRONTEND_URL, "/dashboard?tab=integrations", "error")
    try:
        claims = jwt.decode(state, FUNCTION_SECRET, algorithms=["HS256"])
        auth_user_id = claims["sub"]
        bot_id = claims["bot_id"]
        origin = (claims.get("origin") or "").rstrip("/")
        frontend = origin if origin in ALLOWED_ORIGINS else CHATTY_FRONTEND_URL
        path = claims.get("path") or "/dashboard?tab=integrations"
    except (jwt.PyJWTError, KeyError):
        return _whatsapp_redirect(CHATTY_FRONTEND_URL, "/dashboard?tab=integrations", "error")
    if error or not code:
        return _whatsapp_redirect(frontend, path, "error")

    graph = "https://graph.facebook.com/v23.0"
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            token_res = await client.get(f"{graph}/oauth/access_token", params={
                "client_id": os.environ["FACEBOOK_APP_ID"],
                "client_secret": os.environ["FACEBOOK_APP_SECRET"],
                "redirect_uri": _whatsapp_redirect_uri(),
                "code": code,
            })
            token_res.raise_for_status()
            access_token = token_res.json().get("access_token")
            if not access_token:
                raise ValueError("Meta did not return an access token")
            headers = {"Authorization": f"Bearer {access_token}"}
            businesses = (await client.get(f"{graph}/me/businesses", params={"fields": "id,name", "limit": 50}, headers=headers)).json().get("data", [])
            selected_waba: Optional[dict[str, Any]] = None
            selected_phone: Optional[dict[str, Any]] = None
            for business in businesses:
                wabas = (await client.get(f"{graph}/{business['id']}/owned_whatsapp_business_accounts", params={"fields": "id,name", "limit": 50}, headers=headers)).json().get("data", [])
                for waba in wabas:
                    phones = (await client.get(f"{graph}/{waba['id']}/phone_numbers", params={"fields": "id,display_phone_number,verified_name", "limit": 50}, headers=headers)).json().get("data", [])
                    if phones:
                        selected_waba, selected_phone = waba, phones[0]
                        break
                if selected_phone:
                    break
            if not selected_waba or not selected_phone:
                return _whatsapp_redirect(frontend, path, "no_phone")
            subscribe = await client.post(f"{graph}/{selected_waba['id']}/subscribed_apps", headers=headers)
            subscribe.raise_for_status()
    except (httpx.HTTPError, ValueError, KeyError):
        logger.exception("WhatsApp Meta OAuth callback failed")
        return _whatsapp_redirect(frontend, path, "error")

    bot = await run_db(lambda: supabase.table("chatty_bots").select("id").eq("id", bot_id).eq("user_id", auth_user_id).limit(1).execute())
    if not bot.data:
        return _whatsapp_redirect(frontend, path, "error")
    update = {
        "whatsapp_enabled": True,
        "whatsapp_phone_number_id": selected_phone["id"],
        "whatsapp_waba_id": selected_waba["id"],
        "whatsapp_access_token": encrypt_secret(access_token),
        "whatsapp_verify_token": "wa_" + secrets.token_urlsafe(24),
    }
    await run_db(lambda: supabase.table("chatty_bots").update(update).eq("id", bot_id).execute())
    return _whatsapp_redirect(frontend, path, "connected")


@router.post("/api/integrations/whatsapp/disconnect")
async def whatsapp_disconnect(bot_id: str, user: dict[str, Any] = Depends(require_user)):
    """Disable WhatsApp and remove the bot's stored Meta credentials."""
    bot_res = await run_db(lambda: supabase.table("chatty_bots")
        .select("id")
        .eq("id", bot_id)
        .eq("user_id", user["auth_user_id"])
        .limit(1)
        .execute())
    if not bot_res.data:
        raise HTTPException(status_code=404, detail="Bot not found")

    await run_db(lambda: supabase.table("chatty_bots").update({
        "whatsapp_enabled": False,
        "whatsapp_phone_number_id": None,
        "whatsapp_waba_id": None,
        "whatsapp_access_token": None,
        "whatsapp_verify_token": None,
        "whatsapp_app_secret": None,
        "whatsapp_quick_replies": [],
    }).eq("id", bot_id).eq("user_id", user["auth_user_id"]).execute())
    return {"ok": True, "message": "WhatsApp disconnected"}


@router.post("/api/integrations/whatsapp/deauthorize")
async def whatsapp_deauthorize(bot_id: str, user: dict[str, Any] = Depends(require_user)):
    """Revoke this app's Meta OAuth grant, then remove local WhatsApp credentials."""
    bot_res = await run_db(lambda: supabase.table("chatty_bots")
        .select("id,whatsapp_access_token")
        .eq("id", bot_id)
        .eq("user_id", user["auth_user_id"])
        .limit(1)
        .execute())
    if not bot_res.data:
        raise HTTPException(status_code=404, detail="Bot not found")

    encrypted_token = bot_res.data[0].get("whatsapp_access_token")
    if encrypted_token:
        try:
            access_token = decrypt_secret(encrypted_token)
            async with httpx.AsyncClient(timeout=20.0) as client:
                revoke = await client.delete(
                    "https://graph.facebook.com/v23.0/me/permissions",
                    headers={"Authorization": f"Bearer {access_token}"},
                )
            if revoke.status_code >= 400:
                body = revoke.json() if revoke.headers.get("content-type", "").startswith("application/json") else {}
                error_code = (body.get("error") or {}).get("code")
                if error_code != 190:
                    raise HTTPException(status_code=502, detail="Meta could not revoke the WhatsApp authorization")
        except HTTPException:
            raise
        except (httpx.HTTPError, ValueError, TypeError):
            logger.exception("WhatsApp Meta deauthorization failed for bot %s", bot_id)
            raise HTTPException(status_code=502, detail="Could not reach Meta to revoke the WhatsApp authorization")

    await run_db(lambda: supabase.table("chatty_bots").update({
        "whatsapp_enabled": False,
        "whatsapp_phone_number_id": None,
        "whatsapp_waba_id": None,
        "whatsapp_access_token": None,
        "whatsapp_verify_token": None,
        "whatsapp_app_secret": None,
        "whatsapp_quick_replies": [],
    }).eq("id", bot_id).eq("user_id", user["auth_user_id"]).execute())
    return {"ok": True, "message": "Meta authorization revoked and WhatsApp disconnected"}

# ---------------------------------------------------------------------------
# Google OAuth - Calendar + Gmail read-only
# ---------------------------------------------------------------------------


def _mint_state(
    auth_user_id: str, origin_url: str = "", redirect_path: str = "/dashboard/integrations",
    mode: str = "primary", extra_claims: Optional[dict[str, Any]] = None,
) -> str:
    payload = {
        "sub": auth_user_id,
        "exp": int(time.time()) + 600,
        "path": redirect_path,
        "mode": mode,
    }
    if origin_url:
        payload["origin"] = origin_url
    if extra_claims:
        payload.update(extra_claims)
    return jwt.encode(payload, FUNCTION_SECRET, algorithm="HS256")


def _decode_state_claim(state: str, key: str) -> Optional[str]:
    """Reads one extra (non-standard) claim out of an OAuth state JWT - used
    for PKCE's code_verifier, which has to survive the redirect round-trip
    statelessly."""
    try:
        return jwt.decode(state, FUNCTION_SECRET, algorithms=["HS256"]).get(key)
    except jwt.PyJWTError:
        return None


def _decode_state(state: str) -> tuple[Optional[str], str, str, str]:
    """Decode OAuth state JWT. Returns (auth_user_id, frontend_url, redirect_path, mode)."""
    try:
        claims = jwt.decode(state, FUNCTION_SECRET, algorithms=["HS256"])
        origin = claims.get("origin", "").rstrip("/")
        # Validate origin is an allowed frontend to prevent open-redirect
        if origin and origin not in ALLOWED_ORIGINS:
            origin = ""
        frontend = origin or CHATTY_FRONTEND_URL
        redirect_path = claims.get("path", "/dashboard/integrations")
        return claims["sub"], frontend, redirect_path, claims.get("mode", "primary")
    except jwt.PyJWTError:
        return None, CHATTY_FRONTEND_URL, "/dashboard/integrations", "primary"


# Pro/Executive can connect this many EXTRA Google accounts on top of their
# primary one (real version of the old "up to 3 connected accounts" claim -
# see kin_connected_accounts migration).
MAX_EXTRA_GOOGLE_ACCOUNTS: dict[str, int] = {"pro": 2, "executive": 2}


@router.post("/api/integrations/google/start")
async def google_start(
    request: Request,
    redirect_path: Optional[str] = None,
    mode: str = "primary",
    user: dict[str, Any] = Depends(require_user)
):
    if not os.environ.get("GOOGLE_CLIENT_ID"):
        raise HTTPException(status_code=500, detail="GOOGLE_CLIENT_ID not configured")
    if mode == "add":
        cap = MAX_EXTRA_GOOGLE_ACCOUNTS.get(plan_for(user), 0)
        if cap <= 0:
            raise HTTPException(
                status_code=403,
                detail="Connecting extra Google accounts is a Pro+ feature. Upgrade at /dashboard/billing.",
            )
        existing = await run_db(lambda: (
            supabase.table("kin_connected_accounts")
            .select("id", count="exact", head=True)
            .eq("user_id", user["id"])
            .execute()
        ))
        if (existing.count or 0) >= cap:
            raise HTTPException(
                status_code=400,
                detail=f"You've reached the limit of {cap} extra connected account(s) on your plan.",
            )
    origin = request.headers.get("origin", "")
    is_chatty = "chatty" in origin or "localhost:3001" in origin
    if not redirect_path:
        redirect_path = "/dashboard" if is_chatty else "/dashboard/integrations"
    state = _mint_state(user["auth_user_id"], origin_url=origin, redirect_path=redirect_path, mode=mode)
    # g.auth_url already sets prompt=consent, so Google always reissues a
    # refresh token here - needed so "add another account" doesn't end up
    # depending on a token minted for a different connection.
    # Chatty only uses Calendar/Meet/Drive - asking for Kin's full bundle
    # (Gmail, Tasks, Contacts, Docs, Sheets, Slides) put unrelated
    # permissions on Chatty customers' consent screens for no reason.
    scopes = g.CHATTY_SCOPES if is_chatty else None
    return {"url": g.auth_url(state, scopes=scopes)}


@router.get("/auth/google/callback")
async def google_callback(code: str, state: str):
    auth_user_id, frontend, redirect_path, mode = _decode_state(state)
    if not auth_user_id:
        return RedirectResponse(f"{frontend}{redirect_path}?google=error")

    try:
        tokens = await g.exchange_code(code)
    except httpx.HTTPError as exc:
        logger.exception("google token exchange failed")
        return RedirectResponse(f"{frontend}{redirect_path}?google=error")

    access = tokens["access_token"]
    refresh = tokens.get("refresh_token")
    expires_in = int(tokens.get("expires_in", 3600))
    scope = tokens.get("scope", "")

    profile: dict[str, Any] = {}
    try:
        profile = await g.userinfo(access)
    except httpx.HTTPError:
        pass

    if mode == "add":
        if not refresh:
            # Google only issues a refresh token on first consent; the
            # prompt=consent param above should prevent this, but bail
            # cleanly rather than store an unrefreshable extra account.
            return RedirectResponse(f"{frontend}{redirect_path}?google=error")
        user_res = await run_db(lambda: supabase.table("users").select("id, plan").eq("auth_user_id", auth_user_id).execute())
        if not user_res.data:
            return RedirectResponse(f"{frontend}{redirect_path}?google=error")
        owner = user_res.data[0]
        cap = MAX_EXTRA_GOOGLE_ACCOUNTS.get(plan_for(owner), 0)
        existing = await run_db(lambda: (
            supabase.table("kin_connected_accounts")
            .select("id", count="exact", head=True)
            .eq("user_id", owner["id"])
            .execute()
        ))
        if cap <= 0 or (existing.count or 0) >= cap:
            return RedirectResponse(f"{frontend}{redirect_path}?google=error")
        await run_db(lambda: supabase.table("kin_connected_accounts").insert({
            "user_id": owner["id"],
            "google_access_token": encrypt_secret(access),
            "google_refresh_token": encrypt_secret(refresh),
            "google_token_expiry": (
                datetime.now(tz=timezone.utc) + timedelta(seconds=expires_in)
            ).isoformat(),
            "google_scopes": scope,
            "google_email": profile.get("email"),
        }).execute())
        return RedirectResponse(f"{frontend}{redirect_path}?google=added")

    update: dict[str, Any] = {
        "google_access_token": encrypt_secret(access),
        "google_token_expiry": (
            datetime.now(tz=timezone.utc) + timedelta(seconds=expires_in)
        ).isoformat(),
        "google_scopes": scope,
        "google_email": profile.get("email"),
    }
    if refresh:
        update["google_refresh_token"] = encrypt_secret(refresh)

    await run_db(lambda: supabase.table("users").update(update).eq("auth_user_id", auth_user_id).execute())
    return RedirectResponse(f"{frontend}{redirect_path}?google=ok")


@router.post("/api/integrations/google/disconnect")
async def google_disconnect(user: dict[str, Any] = Depends(require_user)):
    await run_db(lambda: supabase.table("users").update(
        {
            "google_access_token": None,
            "google_refresh_token": None,
            "google_token_expiry": None,
            "google_email": None,
            "google_scopes": None,
        }
    ).eq("id", user["id"]).execute())
    return {"status": "disconnected"}


@router.get("/api/integrations/google/accounts")
async def list_extra_google_accounts(user: dict[str, Any] = Depends(require_user)):
    cap = MAX_EXTRA_GOOGLE_ACCOUNTS.get(plan_for(user), 0)
    res = await run_db(lambda: (
        supabase.table("kin_connected_accounts")
        .select("id, label, google_email, created_at")
        .eq("user_id", user["id"])
        .order("created_at")
        .execute()
    ))
    accounts = res.data or []
    primary = {
        "id": None,
        "email": user.get("google_email"),
        "connected": bool(user.get("google_access_token")),
        "is_primary": True,
        "label": f"Primary / Workspace Default ({user.get('google_email') or 'Not connected'})"
    }
    return {
        "accounts": accounts,
        "primary_account": primary,
        "max": cap,
        "used": len(accounts),
    }


@router.get("/api/integrations/google/calendars")
async def get_google_calendars(
    bot_id: Optional[str] = None,
    account_id: Optional[str] = None,
    user: dict[str, Any] = Depends(require_user)
):
    target_account_id = account_id
    if bot_id and not target_account_id:
        b_res = await run_db(lambda: supabase.table("chatty_bots").select("id, user_id, google_connected_account_id").eq("id", bot_id).execute())
        if b_res.data:
            bot = b_res.data[0]
            if bot.get("user_id") != user["id"]:
                raise HTTPException(status_code=403, detail="Forbidden: Bot not owned by user")
            target_account_id = bot.get("google_connected_account_id")

    try:
        calendars = await g.list_calendars(supabase, user, account_id=target_account_id)
        return {"calendars": calendars}
    except g.GoogleNotConnected:
        return {"calendars": [], "connected": False}
    except Exception as exc:
        logger.warning(f"Failed to list Google calendars: {exc}")
        return {"calendars": [], "error": str(exc)}


@router.get("/api/integrations/google/drive-folders")
async def get_google_drive_folders(
    bot_id: Optional[str] = None,
    parent_id: Optional[str] = None,
    account_id: Optional[str] = None,
    user: dict[str, Any] = Depends(require_user)
):
    target_account_id = account_id
    if bot_id and not target_account_id:
        b_res = await run_db(lambda: supabase.table("chatty_bots").select("id, user_id, google_connected_account_id").eq("id", bot_id).execute())
        if b_res.data:
            bot = b_res.data[0]
            if bot.get("user_id") != user["id"]:
                raise HTTPException(status_code=403, detail="Forbidden: Bot not owned by user")
            target_account_id = bot.get("google_connected_account_id")

    try:
        folders = await g.list_drive_folders(supabase, user, parent_id=parent_id, account_id=target_account_id)
        return {"folders": folders}
    except g.GoogleNotConnected:
        return {"folders": [], "connected": False}
    except Exception as exc:
        logger.warning(f"Failed to list Google Drive folders: {exc}")
        return {"folders": [], "error": str(exc)}


@router.delete("/api/integrations/google/accounts/{account_id}")
async def disconnect_extra_google_account(account_id: str, user: dict[str, Any] = Depends(require_user)):
    await run_db(lambda: supabase.table("kin_connected_accounts").delete().eq("id", account_id).eq(
        "user_id", user["id"]
    ).execute())
    return {"status": "disconnected"}



@router.get("/api/integrations/calendar/events")
async def calendar_events(user: dict[str, Any] = Depends(require_user)):
    now = datetime.now(tz=timezone.utc)
    end = now + timedelta(days=7)

    events = []
    google_connected = bool(user.get("google_access_token"))
    ms_connected = bool(user.get("microsoft_access_token"))

    if google_connected:
        try:
            g_events = await g.list_calendar_events(supabase, user, now - timedelta(hours=2), end)
            for e in g_events:
                e["source"] = "google"
            events.extend(g_events)
        except Exception:
            logger.exception("google calendar list failed")

    if ms_connected:
        try:
            ms_events = await ms.list_outlook_events(
                supabase, user, time_min=now - timedelta(hours=2), time_max=end
            )
            for e in ms_events:
                e["source"] = "microsoft"
            events.extend(ms_events)
        except Exception:
            logger.exception("microsoft calendar list failed")

    # Sort by start time ascending
    events.sort(key=lambda x: x.get("start") or "")
    return {
        "events": events,
        "connected": {
            "google": google_connected,
            "microsoft": ms_connected,
        },
    }


# ---------------------------------------------------------------------------
# Microsoft 365 - OAuth flow + integration endpoints
# ---------------------------------------------------------------------------


@router.post("/api/integrations/microsoft/start")
async def microsoft_start(
    request: Request,
    redirect_path: Optional[str] = None,
    user: dict[str, Any] = Depends(require_user)
):
    if not os.environ.get("MICROSOFT_CLIENT_ID"):
        raise HTTPException(status_code=500, detail="MICROSOFT_CLIENT_ID not configured")
    origin = request.headers.get("origin", "")
    if not redirect_path:
        redirect_path = "/dashboard" if "chatty" in origin or "localhost:3001" in origin else "/dashboard/integrations"
    state = _mint_state(user["auth_user_id"], origin_url=origin, redirect_path=redirect_path)
    return {"url": ms.auth_url(state)}


@router.get("/auth/microsoft/callback")
async def microsoft_callback(code: str, state: str):
    auth_user_id, frontend, redirect_path, _mode = _decode_state(state)
    if not auth_user_id:
        return RedirectResponse(f"{frontend}{redirect_path}?microsoft=error")
    try:
        tokens = await ms.exchange_code(code)
    except httpx.HTTPError:
        logger.exception("microsoft token exchange failed")
        return RedirectResponse(f"{frontend}{redirect_path}?microsoft=error")

    access = tokens["access_token"]
    refresh = tokens.get("refresh_token")
    expires_in = int(tokens.get("expires_in", 3600))
    scope = tokens.get("scope", "")

    profile: dict[str, Any] = {}
    try:
        profile = await ms.me(access)
    except httpx.HTTPError:
        pass

    update: dict[str, Any] = {
        "microsoft_access_token": encrypt_secret(access),
        "microsoft_token_expiry": (
            datetime.now(tz=timezone.utc) + timedelta(seconds=expires_in)
        ).isoformat(),
        "microsoft_scopes": scope,
        "microsoft_email": profile.get("mail") or profile.get("userPrincipalName"),
    }
    if refresh:
        update["microsoft_refresh_token"] = encrypt_secret(refresh)
    await run_db(lambda: supabase.table("users").update(update).eq("auth_user_id", auth_user_id).execute())
    return RedirectResponse(f"{frontend}{redirect_path}?microsoft=ok")


@router.post("/api/integrations/microsoft/disconnect")
async def microsoft_disconnect(user: dict[str, Any] = Depends(require_user)):
    await run_db(lambda: supabase.table("users").update(
        {
            "microsoft_access_token": None,
            "microsoft_refresh_token": None,
            "microsoft_token_expiry": None,
            "microsoft_email": None,
            "microsoft_scopes": None,
        }
    ).eq("id", user["id"]).execute())
    return {"status": "disconnected"}
