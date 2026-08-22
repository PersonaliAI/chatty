"""Google/Microsoft OAuth connection flows and calendar aggregation
(/api/integrations/*, /auth/google/callback, /auth/microsoft/callback)."""

from __future__ import annotations

import logging
import os
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import httpx
import jwt
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse

from app.core.clients import supabase
from app.core.config import ALLOWED_ORIGINS, FRONTEND_URL, FUNCTION_SECRET
from app.core.db import run_db
from app.core.deps import require_user
from plugins import google_integrations as g
from plugins import microsoft_integrations as ms

# Bridged helper still living in main.py (shared quota/plan logic).
from main import plan_for

logger = logging.getLogger("chatty")

router = APIRouter()

# ---------------------------------------------------------------------------
# Google OAuth — Calendar + Gmail read-only
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
    """Reads one extra (non-standard) claim out of an OAuth state JWT — used
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
        frontend = origin or FRONTEND_URL
        redirect_path = claims.get("path", "/dashboard/integrations")
        return claims["sub"], frontend, redirect_path, claims.get("mode", "primary")
    except jwt.PyJWTError:
        return None, FRONTEND_URL, "/dashboard/integrations", "primary"


# Pro/Executive can connect this many EXTRA Google accounts on top of their
# primary one (real version of the old "up to 3 connected accounts" claim —
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
    # refresh token here — needed so "add another account" doesn't end up
    # depending on a token minted for a different connection.
    # Chatty only uses Calendar/Meet/Drive — asking for Kin's full bundle
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
            "google_access_token": access,
            "google_refresh_token": refresh,
            "google_token_expiry": (
                datetime.now(tz=timezone.utc) + timedelta(seconds=expires_in)
            ).isoformat(),
            "google_scopes": scope,
            "google_email": profile.get("email"),
        }).execute())
        return RedirectResponse(f"{frontend}{redirect_path}?google=added")

    update: dict[str, Any] = {
        "google_access_token": access,
        "google_token_expiry": (
            datetime.now(tz=timezone.utc) + timedelta(seconds=expires_in)
        ).isoformat(),
        "google_scopes": scope,
        "google_email": profile.get("email"),
    }
    if refresh:
        update["google_refresh_token"] = refresh

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
    return {"accounts": accounts, "max": cap, "used": len(accounts)}


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
# Microsoft 365 — OAuth flow + integration endpoints
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
        "microsoft_access_token": access,
        "microsoft_token_expiry": (
            datetime.now(tz=timezone.utc) + timedelta(seconds=expires_in)
        ).isoformat(),
        "microsoft_scopes": scope,
        "microsoft_email": profile.get("mail") or profile.get("userPrincipalName"),
    }
    if refresh:
        update["microsoft_refresh_token"] = refresh
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
