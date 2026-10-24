"""Google/Microsoft OAuth connection flows and calendar aggregation
(/api/integrations/*, /auth/google/callback, /auth/microsoft/callback)."""

from __future__ import annotations

import logging
import os
import secrets
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Optional
import re
from urllib.parse import quote, urlencode

import httpx
import jwt
from fastapi import APIRouter, Body, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from pydantic import BaseModel


class DisconnectIntegrationRequest(BaseModel):
    bot_id: Optional[str] = None
    scope: Optional[str] = "account"


from app.core.clients import supabase
from app.core.config import ALLOWED_ORIGINS, CHATTY_BACKEND_URL, CHATTY_FRONTEND_URL, FUNCTION_SECRET
from app.core.crypto import decrypt_secret, encrypt_secret
from app.core.db import run_db
from app.core.deps import require_user
from plugins import google_integrations as g
from plugins import microsoft_integrations as ms

from app.services.chatty_quota_service import plan_for
from app.services.omnichannel.config_store import (
    unpack_omnichannel_bot_row,
    update_bot_omnichannel_safe,
)

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
    # Facebook Login for Business configurations pin the exact WhatsApp
    # assets/permissions used by the onboarding dialog. Keep this optional so
    # existing manual OAuth setups continue to work during migration.
    if os.environ.get("FACEBOOK_CONFIG_ID"):
        params["config_id"] = os.environ["FACEBOOK_CONFIG_ID"]
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
            waba_candidates: dict[str, dict[str, Any]] = {}
            for business in businesses:
                for edge in ("owned_whatsapp_business_accounts", "client_whatsapp_business_accounts"):
                    wabas = (await client.get(f"{graph}/{business['id']}/{edge}", params={"fields": "id,name", "limit": 50}, headers=headers)).json().get("data", [])
                    for waba in wabas:
                        waba_candidates[waba["id"]] = waba
            # Embedded Signup may expose selected WABAs directly rather than
            # through the business-owned edge, so include that collection too.
            direct_wabas = (await client.get(f"{graph}/me/whatsapp_business_accounts", params={"fields": "id,name", "limit": 50}, headers=headers)).json().get("data", [])
            for waba in direct_wabas:
                waba_candidates[waba["id"]] = waba
            for waba in waba_candidates.values():
                phones = (await client.get(f"{graph}/{waba['id']}/phone_numbers", params={"fields": "id,display_phone_number,verified_name", "limit": 50}, headers=headers)).json().get("data", [])
                if phones:
                    selected_waba, selected_phone = waba, phones[0]
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
    await update_bot_omnichannel_safe(supabase, bot_id, update)
    return _whatsapp_redirect(frontend, path, "connected")


@router.post("/api/integrations/whatsapp/test")
async def whatsapp_test(
    bot_id: str,
    phone_number_id: Optional[str] = None,
    access_token: Optional[str] = None,
    user: dict[str, Any] = Depends(require_user),
):
    """Validate a bot's WhatsApp phone/token against Meta without sending a message."""
    bot_res = await run_db(lambda: supabase.table("chatty_bots")
        .select("*")
        .eq("id", bot_id)
        .eq("user_id", user["auth_user_id"])
        .limit(1)
        .execute())
    if not bot_res.data:
        raise HTTPException(status_code=404, detail="Bot not found")
    bot = unpack_omnichannel_bot_row(bot_res.data[0])
    phone_id = (phone_number_id or bot.get("whatsapp_phone_number_id") or "").strip()
    token = (access_token or "").strip() or decrypt_secret((bot.get("whatsapp_access_token") or "").strip())
    if not phone_id or not token:
        raise HTTPException(status_code=400, detail="Provide or save a WhatsApp Phone Number ID and Access Token first")
    version = os.environ.get("WHATSAPP_API_VERSION", "v25.0")
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(
                f"https://graph.facebook.com/{version}/{quote(phone_id, safe='')}",
                params={"fields": "id,display_phone_number,verified_name"},
                headers={"Authorization": f"Bearer {token}"},
            )
        if response.status_code >= 400:
            try:
                detail = response.json().get("error", {}).get("message") or "Meta rejected the saved credentials"
            except ValueError:
                detail = "Meta rejected the saved credentials"
            raise HTTPException(status_code=502, detail=detail[:240])
        data = response.json()
        return {
            "ok": True,
            "phone_number_id": data.get("id", phone_id),
            "display_phone_number": data.get("display_phone_number"),
            "verified_name": data.get("verified_name"),
            "message": "WhatsApp connection is valid",
        }
    except HTTPException:
        raise
    except (httpx.HTTPError, ValueError):
        logger.exception("WhatsApp connection test failed")
        raise HTTPException(status_code=502, detail="Could not reach Meta to test the WhatsApp connection")


# ---------------------------------------------------------------------------
# Facebook Messenger & Instagram DM OAuth + Test + Disconnect
# ---------------------------------------------------------------------------


def _messenger_redirect_uri() -> str:
    return os.environ.get("FACEBOOK_MESSENGER_REDIRECT_URI") or f"{CHATTY_BACKEND_URL}/auth/messenger/callback"


def _instagram_redirect_uri() -> str:
    return os.environ.get("FACEBOOK_INSTAGRAM_REDIRECT_URI") or f"{CHATTY_BACKEND_URL}/auth/instagram/callback"


def _channel_redirect(frontend: str, path: str, param: str, status: str) -> RedirectResponse:
    separator = "&" if "?" in path else "?"
    return RedirectResponse(f"{frontend}{path}{separator}{param}={status}")


@router.post("/api/integrations/messenger/start")
async def messenger_start(
    request: Request,
    bot_id: str,
    redirect_path: Optional[str] = None,
    user: dict[str, Any] = Depends(require_user),
):
    """Return Meta OAuth URL for 1-click Facebook Messenger Page onboarding."""
    if not os.environ.get("FACEBOOK_APP_ID") or not os.environ.get("FACEBOOK_APP_SECRET"):
        raise HTTPException(status_code=503, detail="Meta App credentials are not configured on the server")
    bot = await run_db(lambda: supabase.table("chatty_bots").select("id").eq("id", bot_id).eq("user_id", user["auth_user_id"]).limit(1).execute())
    if not bot.data:
        raise HTTPException(status_code=404, detail="Bot not found")
    origin = request.headers.get("origin", "").rstrip("/")
    if origin not in ALLOWED_ORIGINS:
        origin = ""
    path = redirect_path or "/dashboard?tab=integrations"
    state = _mint_state(user["auth_user_id"], origin_url=origin, redirect_path=path, mode="messenger", extra_claims={"bot_id": bot_id})
    params = {
        "client_id": os.environ["FACEBOOK_APP_ID"],
        "redirect_uri": _messenger_redirect_uri(),
        "state": state,
        "response_type": "code",
        "scope": "pages_messaging,pages_manage_metadata,pages_show_list,public_profile",
    }
    return {"url": "https://www.facebook.com/v23.0/dialog/oauth?" + urlencode(params)}


@router.get("/auth/messenger/callback")
async def messenger_callback(code: Optional[str] = None, state: Optional[str] = None, error: Optional[str] = None):
    if not state:
        return _channel_redirect(CHATTY_FRONTEND_URL, "/dashboard?tab=integrations", "messenger", "error")
    try:
        claims = jwt.decode(state, FUNCTION_SECRET, algorithms=["HS256"])
        auth_user_id = claims["sub"]
        bot_id = claims["bot_id"]
        origin = (claims.get("origin") or "").rstrip("/")
        frontend = origin if origin in ALLOWED_ORIGINS else CHATTY_FRONTEND_URL
        path = claims.get("path") or "/dashboard?tab=integrations"
    except (jwt.PyJWTError, KeyError):
        return _channel_redirect(CHATTY_FRONTEND_URL, "/dashboard?tab=integrations", "messenger", "error")
    if error or not code:
        return _channel_redirect(frontend, path, "messenger", "error")

    graph = "https://graph.facebook.com/v23.0"
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            token_res = await client.get(f"{graph}/oauth/access_token", params={
                "client_id": os.environ["FACEBOOK_APP_ID"],
                "client_secret": os.environ["FACEBOOK_APP_SECRET"],
                "redirect_uri": _messenger_redirect_uri(),
                "code": code,
            })
            token_res.raise_for_status()
            user_token = token_res.json().get("access_token")
            if not user_token:
                raise ValueError("Meta did not return an access token")

            pages_res = await client.get(
                f"{graph}/me/accounts",
                params={"fields": "id,name,access_token,category", "limit": 50},
                headers={"Authorization": f"Bearer {user_token}"},
            )
            pages_res.raise_for_status()
            pages = pages_res.json().get("data", [])
            if not pages:
                return _channel_redirect(frontend, path, "messenger", "no_page")

            selected_page = pages[0]
            page_id = str(selected_page["id"])
            page_name = str(selected_page.get("name") or page_id)
            page_token = str(selected_page.get("access_token") or user_token)

            try:
                await client.post(
                    f"{graph}/{page_id}/subscribed_apps",
                    params={"subscribed_fields": "messages,messaging_postbacks"},
                    headers={"Authorization": f"Bearer {page_token}"},
                )
            except Exception:
                logger.warning("Non-fatal: could not auto-subscribe Messenger page %s", page_id)
    except (httpx.HTTPError, ValueError, KeyError):
        logger.exception("Messenger Meta OAuth callback failed")
        return _channel_redirect(frontend, path, "messenger", "error")

    bot = await run_db(lambda: supabase.table("chatty_bots").select("id").eq("id", bot_id).eq("user_id", auth_user_id).limit(1).execute())
    if not bot.data:
        return _channel_redirect(frontend, path, "messenger", "error")

    await update_bot_omnichannel_safe(supabase, bot_id, {
        "messenger_enabled": True,
        "messenger_page_id": page_id,
        "messenger_page_name": page_name,
        "messenger_access_token": encrypt_secret(page_token),
        "messenger_verify_token": "fb_" + secrets.token_urlsafe(24),
    })
    return _channel_redirect(frontend, path, "messenger", "connected")


@router.post("/api/integrations/messenger/test")
async def messenger_test(
    bot_id: str,
    page_id: Optional[str] = None,
    access_token: Optional[str] = None,
    user: dict[str, Any] = Depends(require_user),
):
    """Validate Facebook Messenger Page ID & Page Access Token against Meta Graph API."""
    bot_res = await run_db(lambda: supabase.table("chatty_bots")
        .select("*")
        .eq("id", bot_id)
        .eq("user_id", user["auth_user_id"])
        .limit(1)
        .execute())
    if not bot_res.data:
        raise HTTPException(status_code=404, detail="Bot not found")
    b = unpack_omnichannel_bot_row(bot_res.data[0])
    pid = (page_id or b.get("messenger_page_id") or b.get("instagram_page_id") or "").strip()
    token = (access_token or "").strip() or decrypt_secret((b.get("messenger_access_token") or b.get("instagram_access_token") or "").strip())

    if not pid or not token:
        raise HTTPException(status_code=400, detail="Provide or save Facebook Page ID and Page Access Token first")
    if not re.match(r"^[0-9a-zA-Z_]{1,64}$", pid):
        raise HTTPException(status_code=400, detail="Facebook Page ID must be alphanumeric (up to 64 characters)")

    try:
        safe_pid = quote(pid, safe="")
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"https://graph.facebook.com/v21.0/{safe_pid}",
                params={"fields": "id,name,category"},
                headers={"Authorization": f"Bearer {token}"},
            )
        data = resp.json() if resp.status_code == 200 else {}
        if resp.status_code >= 400 or "error" in data:
            err_msg = (data.get("error") or {}).get("message", "Meta Graph API rejected credentials")
            raise HTTPException(status_code=400, detail=f"Meta error: {err_msg[:200]}")
        return {
            "ok": True,
            "page_id": data.get("id", pid),
            "name": data.get("name", "Facebook Page"),
            "category": data.get("category"),
            "message": f"Facebook Messenger Page '{data.get('name', pid)}' verified and connected",
        }
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Messenger test failed: %s", exc)
        raise HTTPException(status_code=502, detail="Could not reach Meta Graph API")


@router.post("/api/integrations/messenger/disconnect")
async def messenger_disconnect(bot_id: str, user: dict[str, Any] = Depends(require_user)):
    """Disable Facebook Messenger and clear stored Page credentials."""
    updated = await update_bot_omnichannel_safe(
        supabase,
        bot_id,
        {
            "messenger_enabled": False,
            "messenger_page_id": None,
            "messenger_page_name": None,
            "messenger_access_token": None,
            "messenger_verify_token": None,
            "messenger_app_secret": None,
            "messenger_quick_replies": [],
        },
        user_id=user["auth_user_id"],
        allow_clear_secrets=True,
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Bot not found")
    return {"ok": True, "message": "Facebook Messenger disconnected"}


@router.post("/api/integrations/instagram/start")
async def instagram_start(
    request: Request,
    bot_id: str,
    redirect_path: Optional[str] = None,
    user: dict[str, Any] = Depends(require_user),
):
    """Return Meta OAuth URL for 1-click Instagram Direct (Business) onboarding."""
    if not os.environ.get("FACEBOOK_APP_ID") or not os.environ.get("FACEBOOK_APP_SECRET"):
        raise HTTPException(status_code=503, detail="Meta App credentials are not configured on the server")
    bot = await run_db(lambda: supabase.table("chatty_bots").select("id").eq("id", bot_id).eq("user_id", user["auth_user_id"]).limit(1).execute())
    if not bot.data:
        raise HTTPException(status_code=404, detail="Bot not found")
    origin = request.headers.get("origin", "").rstrip("/")
    if origin not in ALLOWED_ORIGINS:
        origin = ""
    path = redirect_path or "/dashboard?tab=integrations"
    state = _mint_state(user["auth_user_id"], origin_url=origin, redirect_path=path, mode="instagram", extra_claims={"bot_id": bot_id})
    params = {
        "client_id": os.environ["FACEBOOK_APP_ID"],
        "redirect_uri": _instagram_redirect_uri(),
        "state": state,
        "response_type": "code",
        "scope": "instagram_basic,instagram_manage_messages,pages_manage_metadata,pages_show_list,public_profile",
    }
    return {"url": "https://www.facebook.com/v23.0/dialog/oauth?" + urlencode(params)}


@router.get("/auth/instagram/callback")
async def instagram_callback(code: Optional[str] = None, state: Optional[str] = None, error: Optional[str] = None):
    if not state:
        return _channel_redirect(CHATTY_FRONTEND_URL, "/dashboard?tab=integrations", "instagram", "error")
    try:
        claims = jwt.decode(state, FUNCTION_SECRET, algorithms=["HS256"])
        auth_user_id = claims["sub"]
        bot_id = claims["bot_id"]
        origin = (claims.get("origin") or "").rstrip("/")
        frontend = origin if origin in ALLOWED_ORIGINS else CHATTY_FRONTEND_URL
        path = claims.get("path") or "/dashboard?tab=integrations"
    except (jwt.PyJWTError, KeyError):
        return _channel_redirect(CHATTY_FRONTEND_URL, "/dashboard?tab=integrations", "instagram", "error")
    if error or not code:
        return _channel_redirect(frontend, path, "instagram", "error")

    graph = "https://graph.facebook.com/v23.0"
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            token_res = await client.get(f"{graph}/oauth/access_token", params={
                "client_id": os.environ["FACEBOOK_APP_ID"],
                "client_secret": os.environ["FACEBOOK_APP_SECRET"],
                "redirect_uri": _instagram_redirect_uri(),
                "code": code,
            })
            token_res.raise_for_status()
            user_token = token_res.json().get("access_token")
            if not user_token:
                raise ValueError("Meta did not return an access token")

            pages_res = await client.get(
                f"{graph}/me/accounts",
                params={"fields": "id,name,access_token,instagram_business_account{id,username,name}", "limit": 50},
                headers={"Authorization": f"Bearer {user_token}"},
            )
            pages_res.raise_for_status()
            pages = pages_res.json().get("data", [])
            if not pages:
                return _channel_redirect(frontend, path, "instagram", "no_account")

            selected_page = pages[0]
            ig_acct = None
            for p in pages:
                if isinstance(p.get("instagram_business_account"), dict):
                    selected_page = p
                    ig_acct = p["instagram_business_account"]
                    break

            target_id = str((ig_acct or {}).get("id") or selected_page["id"])
            ig_username = str((ig_acct or {}).get("username") or selected_page.get("name") or target_id)
            page_token = str(selected_page.get("access_token") or user_token)
    except (httpx.HTTPError, ValueError, KeyError):
        logger.exception("Instagram Meta OAuth callback failed")
        return _channel_redirect(frontend, path, "instagram", "error")

    bot = await run_db(lambda: supabase.table("chatty_bots").select("id").eq("id", bot_id).eq("user_id", auth_user_id).limit(1).execute())
    if not bot.data:
        return _channel_redirect(frontend, path, "instagram", "error")

    await update_bot_omnichannel_safe(supabase, bot_id, {
        "instagram_enabled": True,
        "instagram_page_id": target_id,
        "instagram_username": ig_username,
        "instagram_access_token": encrypt_secret(page_token),
        "instagram_verify_token": "ig_" + secrets.token_urlsafe(24),
    })
    return _channel_redirect(frontend, path, "instagram", "connected")


@router.post("/api/integrations/instagram/disconnect")
async def instagram_disconnect(bot_id: str, user: dict[str, Any] = Depends(require_user)):
    """Disable Instagram Direct and clear stored credentials."""
    updated = await update_bot_omnichannel_safe(
        supabase,
        bot_id,
        {
            "instagram_enabled": False,
            "instagram_page_id": None,
            "instagram_username": None,
            "instagram_access_token": None,
            "instagram_verify_token": None,
            "instagram_app_secret": None,
            "instagram_quick_replies": [],
        },
        user_id=user["auth_user_id"],
        allow_clear_secrets=True,
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Bot not found")
    return {"ok": True, "message": "Instagram Direct disconnected"}


# ---------------------------------------------------------------------------
# TikTok Business Messaging OAuth + Test + Disconnect
# ---------------------------------------------------------------------------


def _tiktok_redirect_uri() -> str:
    return os.environ.get("TIKTOK_REDIRECT_URI") or f"{CHATTY_BACKEND_URL}/auth/tiktok/callback"


@router.post("/api/integrations/tiktok/start")
async def tiktok_start(
    request: Request,
    bot_id: str,
    client_key: Optional[str] = None,
    redirect_path: Optional[str] = None,
    user: dict[str, Any] = Depends(require_user),
):
    """Return TikTok OAuth v2 authorization URL for 1-click Business Messaging onboarding."""
    bot_res = await run_db(lambda: supabase.table("chatty_bots").select("*").eq("id", bot_id).eq("user_id", user["auth_user_id"]).limit(1).execute())
    if not bot_res.data:
        raise HTTPException(status_code=404, detail="Bot not found")
    bot = unpack_omnichannel_bot_row(bot_res.data[0])
    resolved_client_key = (client_key or bot.get("tiktok_client_key") or os.environ.get("TIKTOK_CLIENT_KEY") or "").strip()
    if not resolved_client_key:
        raise HTTPException(
            status_code=400,
            detail="Enter your TikTok App Client Key in the configuration form below (or set TIKTOK_CLIENT_KEY) to launch 1-Click TikTok OAuth.",
        )
    origin = request.headers.get("origin", "").rstrip("/")
    if origin not in ALLOWED_ORIGINS:
        origin = ""
    path = redirect_path or "/dashboard?tab=integrations"
    state = _mint_state(user["auth_user_id"], origin_url=origin, redirect_path=path, mode="tiktok", extra_claims={"bot_id": bot_id})
    params = {
        "client_key": resolved_client_key,
        "redirect_uri": _tiktok_redirect_uri(),
        "state": state,
        "response_type": "code",
        "scope": "user.info.basic,business.message.manage",
    }
    return {"url": "https://www.tiktok.com/v2/auth/authorize/?" + urlencode(params)}


@router.get("/auth/tiktok/callback")
async def tiktok_callback(code: Optional[str] = None, state: Optional[str] = None, error: Optional[str] = None):
    if not state:
        return _channel_redirect(CHATTY_FRONTEND_URL, "/dashboard?tab=integrations", "tiktok", "error")
    try:
        claims = jwt.decode(state, FUNCTION_SECRET, algorithms=["HS256"])
        auth_user_id = claims["sub"]
        bot_id = claims["bot_id"]
        origin = (claims.get("origin") or "").rstrip("/")
        frontend = origin if origin in ALLOWED_ORIGINS else CHATTY_FRONTEND_URL
        path = claims.get("path") or "/dashboard?tab=integrations"
    except (jwt.PyJWTError, KeyError):
        return _channel_redirect(CHATTY_FRONTEND_URL, "/dashboard?tab=integrations", "tiktok", "error")
    if error or not code:
        return _channel_redirect(frontend, path, "tiktok", "error")

    bot_res = await run_db(lambda: supabase.table("chatty_bots").select("*").eq("id", bot_id).eq("user_id", auth_user_id).limit(1).execute())
    if not bot_res.data:
        return _channel_redirect(frontend, path, "tiktok", "error")
    bot = unpack_omnichannel_bot_row(bot_res.data[0])

    client_key = (bot.get("tiktok_client_key") or os.environ.get("TIKTOK_CLIENT_KEY") or "").strip()
    client_secret = decrypt_secret((bot.get("tiktok_client_secret") or "").strip()) or (os.environ.get("TIKTOK_CLIENT_SECRET") or "").strip()
    if not client_key or not client_secret:
        return _channel_redirect(frontend, path, "tiktok", "missing_app_secret")

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            token_res = await client.post(
                "https://open.tiktokapis.com/v2/oauth/token/",
                headers={"Content-Type": "application/x-www-form-urlencoded"},
                data={
                    "client_key": client_key,
                    "client_secret": client_secret,
                    "code": code,
                    "grant_type": "authorization_code",
                    "redirect_uri": _tiktok_redirect_uri(),
                },
            )
            token_res.raise_for_status()
            tok_data = token_res.json()
            if "data" in tok_data and isinstance(tok_data["data"], dict):
                tok_data = tok_data["data"]
            access_token = str(tok_data.get("access_token") or "").strip()
            refresh_token = str(tok_data.get("refresh_token") or "").strip()
            open_id = str(tok_data.get("open_id") or "").strip()
            if not access_token:
                raise ValueError("TikTok did not return an access_token")

            display_name = open_id
            try:
                u_res = await client.get(
                    "https://open.tiktokapis.com/v2/user/info/",
                    params={"fields": "open_id,union_id,display_name,avatar_url"},
                    headers={"Authorization": f"Bearer {access_token}"},
                )
                if u_res.status_code == 200:
                    u_user = ((u_res.json().get("data") or {}).get("user") or {})
                    display_name = str(u_user.get("display_name") or open_id)
                    open_id = str(u_user.get("open_id") or open_id)
            except Exception:
                pass
    except (httpx.HTTPError, ValueError, KeyError):
        logger.exception("TikTok OAuth callback failed")
        return _channel_redirect(frontend, path, "tiktok", "error")

    await update_bot_omnichannel_safe(supabase, bot_id, {
        "tiktok_enabled": True,
        "tiktok_open_id": open_id,
        "tiktok_business_id": bot.get("tiktok_business_id") or open_id,
        "tiktok_display_name": display_name,
        "tiktok_access_token": encrypt_secret(access_token),
        "tiktok_refresh_token": encrypt_secret(refresh_token) if refresh_token else None,
        "tiktok_verify_token": bot.get("tiktok_verify_token") or ("tt_" + secrets.token_urlsafe(24)),
    })
    return _channel_redirect(frontend, path, "tiktok", "connected")


@router.post("/api/integrations/tiktok/test")
async def tiktok_test(
    bot_id: str,
    open_id: Optional[str] = None,
    business_id: Optional[str] = None,
    access_token: Optional[str] = None,
    user: dict[str, Any] = Depends(require_user),
):
    """Validate TikTok Business Messaging credentials against TikTok Open API v2."""
    bot_res = await run_db(lambda: supabase.table("chatty_bots")
        .select("*")
        .eq("id", bot_id)
        .eq("user_id", user["auth_user_id"])
        .limit(1)
        .execute())
    if not bot_res.data:
        raise HTTPException(status_code=404, detail="Bot not found")
    b = unpack_omnichannel_bot_row(bot_res.data[0])
    oid = (open_id or business_id or b.get("tiktok_business_id") or b.get("tiktok_open_id") or "").strip()
    token = (access_token or "").strip() or decrypt_secret((b.get("tiktok_access_token") or "").strip())

    if not oid or not token:
        raise HTTPException(status_code=400, detail="Provide or save TikTok Business / Open ID and Access Token first")
    if not re.match(r"^[0-9a-zA-Z_.-]{2,128}$", oid):
        raise HTTPException(status_code=400, detail="TikTok Business / Open ID must be 2-128 alphanumeric characters")

    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            resp = await client.get(
                "https://open.tiktokapis.com/v2/user/info/",
                params={"fields": "open_id,union_id,display_name"},
                headers={"Authorization": f"Bearer {token}"},
            )
        data = resp.json() if resp.headers.get("content-type", "").startswith("application/json") else {}
        err_obj = data.get("error") if isinstance(data.get("error"), dict) else {}
        err_code = str(err_obj.get("code") or "ok").lower()
        if resp.status_code >= 400 or (err_code not in ("ok", "0", "")):
            err_msg = err_obj.get("message") or data.get("message") or "TikTok Open API rejected the access token"
            raise HTTPException(status_code=400, detail=f"TikTok API error: {str(err_msg)[:200]}")

        user_info = (data.get("data") or {}).get("user") or {}
        resolved_name = user_info.get("display_name") or b.get("tiktok_display_name") or oid
        resolved_oid = user_info.get("open_id") or oid
        return {
            "ok": True,
            "open_id": resolved_oid,
            "display_name": resolved_name,
            "message": f"TikTok Business account '{resolved_name}' verified and ready",
        }
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("TikTok connection test failed: %s", exc)
        raise HTTPException(status_code=502, detail="Could not reach TikTok Open API")


@router.post("/api/integrations/tiktok/disconnect")
async def tiktok_disconnect(bot_id: str, user: dict[str, Any] = Depends(require_user)):
    """Disable TikTok Business Messaging and clear stored credentials."""
    updated = await update_bot_omnichannel_safe(
        supabase,
        bot_id,
        {
            "tiktok_enabled": False,
            "tiktok_open_id": None,
            "tiktok_business_id": None,
            "tiktok_display_name": None,
            "tiktok_access_token": None,
            "tiktok_refresh_token": None,
            "tiktok_verify_token": None,
            "tiktok_client_key": None,
            "tiktok_client_secret": None,
            "tiktok_quick_replies": [],
        },
        user_id=user["auth_user_id"],
        allow_clear_secrets=True,
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Bot not found")
    return {"ok": True, "message": "TikTok Business disconnected"}


@router.post("/api/integrations/telegram/disconnect")
async def telegram_disconnect(bot_id: str, user: dict[str, Any] = Depends(require_user)):
    """Disable Telegram Bot and clear stored credentials."""
    updated = await update_bot_omnichannel_safe(
        supabase,
        bot_id,
        {
            "telegram_enabled": False,
            "telegram_bot_token": None,
            "telegram_secret_token": None,
            "telegram_bot_username": None,
        },
        user_id=user["auth_user_id"],
        allow_clear_secrets=True,
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Bot not found")
    return {"ok": True, "message": "Telegram Bot disconnected"}


@router.post("/api/integrations/sms/disconnect")
async def sms_disconnect(bot_id: str, user: dict[str, Any] = Depends(require_user)):
    """Disable Two-Way SMS and clear stored Twilio credentials."""
    updated = await update_bot_omnichannel_safe(
        supabase,
        bot_id,
        {
            "sms_enabled": False,
            "twilio_account_sid": None,
            "twilio_auth_token": None,
            "twilio_phone_number": None,
        },
        user_id=user["auth_user_id"],
        allow_clear_secrets=True,
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Bot not found")
    return {"ok": True, "message": "Two-Way SMS disconnected"}


@router.post("/api/integrations/email/disconnect")
async def email_disconnect(bot_id: str, user: dict[str, Any] = Depends(require_user)):
    """Disable Support Email channel and clear stored address/secret."""
    updated = await update_bot_omnichannel_safe(
        supabase,
        bot_id,
        {
            "email_channel_enabled": False,
            "email_support_address": None,
            "email_webhook_secret": None,
        },
        user_id=user["auth_user_id"],
        allow_clear_secrets=True,
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Bot not found")
    return {"ok": True, "message": "Support Email channel disconnected"}


@router.post("/api/integrations/telegram/test")
async def telegram_test(bot_id: str, bot_token: Optional[str] = None, user: dict[str, Any] = Depends(require_user)):
    """Validate a Telegram bot token against Telegram Bot API (getMe)."""
    token = (bot_token or "").strip()
    if not token:
        bot_res = await run_db(lambda: supabase.table("chatty_bots")
            .select("id,telegram_bot_token")
            .eq("id", bot_id)
            .eq("user_id", user["auth_user_id"])
            .limit(1)
            .execute())
        if not bot_res.data:
            raise HTTPException(status_code=404, detail="Bot not found")
        token = decrypt_secret((bot_res.data[0].get("telegram_bot_token") or "").strip())
    if not token:
        raise HTTPException(status_code=400, detail="Provide or save a Telegram Bot Token first")
    if not re.match(r"^[0-9]{5,16}:[A-Za-z0-9_-]{5,80}$", token):
        raise HTTPException(status_code=400, detail="Invalid Telegram Bot Token format")

    try:
        safe_token = quote(token, safe=":")
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(f"https://api.telegram.org/bot{safe_token}/getMe")
        data = resp.json() if resp.status_code == 200 else {}
        if not data.get("ok"):
            err_desc = data.get("description", "Telegram rejected this bot token")
            raise HTTPException(status_code=400, detail=f"Telegram error: {err_desc}")
        result = data.get("result", {})
        username = result.get("username", "")
        return {
            "ok": True,
            "username": username,
            "first_name": result.get("first_name", ""),
            "message": f"Telegram Bot @{username} is valid and reachable",
        }
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Telegram bot test failed: %s", exc)
        raise HTTPException(status_code=502, detail="Could not reach Telegram Bot API")


@router.post("/api/integrations/sms/test")
async def sms_test(
    bot_id: str,
    account_sid: Optional[str] = None,
    auth_token: Optional[str] = None,
    phone_number: Optional[str] = None,
    user: dict[str, Any] = Depends(require_user),
):
    """Validate Twilio credentials against Twilio REST API."""
    sid = (account_sid or "").strip()
    token = (auth_token or "").strip()
    phone = (phone_number or "").strip()
    if not sid or not token:
        bot_res = await run_db(lambda: supabase.table("chatty_bots")
            .select("id,twilio_account_sid,twilio_auth_token,twilio_phone_number")
            .eq("id", bot_id)
            .eq("user_id", user["auth_user_id"])
            .limit(1)
            .execute())
        if not bot_res.data:
            raise HTTPException(status_code=404, detail="Bot not found")
        b = bot_res.data[0]
        sid = sid or (b.get("twilio_account_sid") or "").strip()
        token = token or decrypt_secret((b.get("twilio_auth_token") or "").strip())
        phone = phone or (b.get("twilio_phone_number") or "").strip()

    if not sid or not token:
        raise HTTPException(status_code=400, detail="Provide or save Twilio Account SID and Auth Token first")
    if not re.match(r"^AC[a-zA-Z0-9_]{10,64}$", sid):
        raise HTTPException(status_code=400, detail="Twilio Account SID must start with 'AC' and contain 10-64 alphanumeric characters")

    try:
        safe_sid = quote(sid, safe="")
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"https://api.twilio.com/2010-04-01/Accounts/{safe_sid}.json",
                auth=(safe_sid, token),
            )
        if resp.status_code >= 400:
            raise HTTPException(status_code=400, detail="Twilio authentication failed (invalid Account SID or Auth Token)")
        data = resp.json()
        return {
            "ok": True,
            "friendly_name": data.get("friendly_name", "Twilio Account"),
            "status": data.get("status", "active"),
            "phone_number": phone,
            "message": f"Twilio account '{data.get('friendly_name')}' verified successfully",
        }
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Twilio SMS test failed: %s", exc)
        raise HTTPException(status_code=502, detail="Could not reach Twilio API")


@router.post("/api/integrations/instagram/test")
async def instagram_test(
    bot_id: str,
    page_id: Optional[str] = None,
    access_token: Optional[str] = None,
    user: dict[str, Any] = Depends(require_user),
):
    """Validate Instagram/Messenger credentials against Meta Graph API."""
    pid = (page_id or "").strip()
    token = (access_token or "").strip()
    if not pid or not token:
        bot_res = await run_db(lambda: supabase.table("chatty_bots")
            .select("id,instagram_page_id,instagram_access_token")
            .eq("id", bot_id)
            .eq("user_id", user["auth_user_id"])
            .limit(1)
            .execute())
        if not bot_res.data:
            raise HTTPException(status_code=404, detail="Bot not found")
        b = bot_res.data[0]
        pid = pid or (b.get("instagram_page_id") or "").strip()
        token = token or decrypt_secret((b.get("instagram_access_token") or "").strip())

    if not pid or not token:
        raise HTTPException(status_code=400, detail="Provide or save Meta Page ID and Access Token first")
    if not re.match(r"^[0-9a-zA-Z_]{1,64}$", pid):
        raise HTTPException(status_code=400, detail="Meta Page ID must be alphanumeric (up to 64 characters)")

    try:
        safe_pid = quote(pid, safe="")
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"https://graph.facebook.com/v21.0/{safe_pid}",
                params={"fields": "id,name"},
                headers={"Authorization": f"Bearer {token}"},
            )
        data = resp.json() if resp.status_code == 200 else {}
        if resp.status_code >= 400 or "error" in data:
            err_msg = data.get("error", {}).get("message", "Meta Graph API rejected credentials")
            raise HTTPException(status_code=400, detail=f"Meta error: {err_msg[:200]}")
        return {
            "ok": True,
            "page_id": data.get("id", pid),
            "name": data.get("name", "Meta Page"),
            "message": f"Meta Page '{data.get('name', pid)}' connected successfully",
        }
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Instagram test failed: %s", exc)
        raise HTTPException(status_code=502, detail="Could not reach Meta Graph API")


@router.post("/api/integrations/email/test")
async def email_test(
    bot_id: str,
    support_address: Optional[str] = None,
    user: dict[str, Any] = Depends(require_user),
):
    """Validate inbound email support routing address."""
    addr = (support_address or "").strip().lower()
    if not addr:
        bot_res = await run_db(lambda: supabase.table("chatty_bots")
            .select("id,email_support_address")
            .eq("id", bot_id)
            .eq("user_id", user["auth_user_id"])
            .limit(1)
            .execute())
        if not bot_res.data:
            raise HTTPException(status_code=404, detail="Bot not found")
        addr = (bot_res.data[0].get("email_support_address") or "").strip().lower()

    if not addr or "@" not in addr or "." not in addr.split("@")[-1]:
        raise HTTPException(status_code=400, detail="Provide a valid support email address (e.g. support@yourcompany.com)")

    return {
        "ok": True,
        "support_address": addr,
        "message": f"Two-way email routing active for {addr}",
    }


@router.post("/api/integrations/whatsapp/disconnect")
async def whatsapp_disconnect(bot_id: str, user: dict[str, Any] = Depends(require_user)):
    """Disable WhatsApp and remove the bot's stored Meta credentials."""
    updated = await update_bot_omnichannel_safe(
        supabase,
        bot_id,
        {
            "whatsapp_enabled": False,
            "whatsapp_phone_number_id": None,
            "whatsapp_waba_id": None,
            "whatsapp_access_token": None,
            "whatsapp_verify_token": None,
            "whatsapp_app_secret": None,
            "whatsapp_quick_replies": [],
        },
        user_id=user["auth_user_id"],
        allow_clear_secrets=True,
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Bot not found")
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
                # An already-invalid/revoked token is safe to clean up locally.
                if error_code != 190:
                    raise HTTPException(status_code=502, detail="Meta could not revoke the WhatsApp authorization")
        except HTTPException:
            raise
        except (httpx.HTTPError, ValueError, TypeError):
            logger.exception("WhatsApp Meta deauthorization failed")
            raise HTTPException(status_code=502, detail="Could not reach Meta to revoke the WhatsApp authorization")

    await update_bot_omnichannel_safe(
        supabase,
        bot_id,
        {
            "whatsapp_enabled": False,
            "whatsapp_phone_number_id": None,
            "whatsapp_waba_id": None,
            "whatsapp_access_token": None,
            "whatsapp_verify_token": None,
            "whatsapp_app_secret": None,
            "whatsapp_quick_replies": [],
        },
        user_id=user["auth_user_id"],
        allow_clear_secrets=True,
    )
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


# Pro/Executive/Chatty plans can connect extra Google accounts on top of their
# primary workspace one.
MAX_EXTRA_GOOGLE_ACCOUNTS: dict[str, int] = {
    "free": 5,
    "basic": 5,
    "pro": 10,
    "executive": 25,
    "chatty_hobby": 5,
    "chatty_standard": 10,
    "chatty_business": 25,
}


@router.post("/api/integrations/google/start")
async def google_start(
    request: Request,
    redirect_path: Optional[str] = None,
    mode: str = "primary",
    bot_id: Optional[str] = None,
    scope_type: Optional[str] = None,
    member_id: Optional[str] = None,
    user: dict[str, Any] = Depends(require_user)
):
    if bot_id:
        from app.core.permissions import get_bot_role_and_permissions
        role, perms = await get_bot_role_and_permissions(bot_id, user)
        if role != "owner" and not ({"meetings", "integrations", "settings", "team"} & set(perms)):
            raise HTTPException(status_code=403, detail="You don't have access to calendar integrations for this bot")
    if not os.environ.get("GOOGLE_CLIENT_ID"):
        raise HTTPException(status_code=500, detail="GOOGLE_CLIENT_ID not configured")
    if mode == "add":
        cap = MAX_EXTRA_GOOGLE_ACCOUNTS.get(plan_for(user), 5)
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
    extra_claims: dict[str, Any] = {}
    if bot_id:
        extra_claims["bot_id"] = bot_id
    if scope_type:
        extra_claims["scope_type"] = scope_type
    if member_id:
        extra_claims["member_id"] = member_id
    state = _mint_state(user["auth_user_id"], origin_url=origin, redirect_path=redirect_path, mode=mode, extra_claims=extra_claims or None)
    # Calendar-only scope for teammates: strictly NO Drive or Gmail permissions
    if scope_type == "calendar":
        scopes = g.GOOGLE_CALENDAR_ONLY_SCOPES
    elif is_chatty:
        scopes = g.CHATTY_SCOPES
    else:
        scopes = None
    return {"url": g.auth_url(state, scopes=scopes)}


@router.get("/auth/google/callback")
async def google_callback(code: str, state: str):
    auth_user_id, frontend, redirect_path, mode = _decode_state(state)
    target_bot_id = _decode_state_claim(state, "bot_id")
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

    target_member_id = _decode_state_claim(state, "member_id")
    if target_member_id:
        member_email = profile.get("email")
        member_update: dict[str, Any] = {
            "google_email": member_email,
            "google_calendar_connected": True,
            "google_access_token": encrypt_secret(access),
            "google_token_expiry": (
                datetime.now(tz=timezone.utc) + timedelta(seconds=expires_in)
            ).isoformat(),
        }
        if refresh:
            member_update["google_refresh_token"] = encrypt_secret(refresh)
        matched_member = False
        try:
            up_res = await run_db(lambda: supabase.table("chatty_team_members").update(member_update).eq("id", target_member_id).execute())
            if up_res and up_res.data:
                matched_member = True
        except Exception:
            logger.warning("Failed to store google calendar tokens on chatty_team_members, falling back to email", exc_info=True)
            try:
                up_res = await run_db(lambda: supabase.table("chatty_team_members").update({
                    "google_email": member_email,
                    "google_calendar_connected": True,
                }).eq("id", target_member_id).execute())
                if up_res and up_res.data:
                    matched_member = True
            except Exception:
                pass

        if not matched_member:
            try:
                owner_update: dict[str, Any] = {
                    "google_email": member_email,
                    "google_access_token": encrypt_secret(access),
                    "google_token_expiry": (
                        datetime.now(tz=timezone.utc) + timedelta(seconds=expires_in)
                    ).isoformat(),
                }
                if refresh:
                    owner_update["google_refresh_token"] = encrypt_secret(refresh)
                await run_db(lambda: supabase.table("users").update(owner_update).eq("auth_user_id", auth_user_id).execute())
            except Exception:
                logger.warning("Failed to store google calendar tokens on users for owner", exc_info=True)

        if target_bot_id:
            try:
                from app.routers.team import _write_team_audit_log
                await _write_team_audit_log(
                    target_bot_id,
                    "team_member_calendar_updated",
                    f"Connected personal Google Calendar (Calendar-only) for {member_email or target_member_id}",
                    {"auth_user_id": auth_user_id, "id": auth_user_id, "email": member_email or "teammate"}
                )
            except Exception:
                pass
        return RedirectResponse(f"{frontend}{redirect_path}?calendar_connected=google&member_id={target_member_id}")

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
        cap = MAX_EXTRA_GOOGLE_ACCOUNTS.get(plan_for(owner), 5)
        existing = await run_db(lambda: (
            supabase.table("kin_connected_accounts")
            .select("id", count="exact", head=True)
            .eq("user_id", owner["id"])
            .execute()
        ))
        if cap <= 0 or (existing.count or 0) >= cap:
            return RedirectResponse(f"{frontend}{redirect_path}?google=error")
        inserted = await run_db(lambda: supabase.table("kin_connected_accounts").insert({
            "user_id": owner["id"],
            "google_access_token": encrypt_secret(access),
            "google_refresh_token": encrypt_secret(refresh),
            "google_token_expiry": (
                datetime.now(tz=timezone.utc) + timedelta(seconds=expires_in)
            ).isoformat(),
            "google_scopes": scope,
            "google_email": profile.get("email"),
        }).execute())
        new_acc_id = inserted.data[0]["id"] if (inserted.data and len(inserted.data) > 0) else None
        if target_bot_id and new_acc_id:
            try:
                bot_check = await run_db(lambda: supabase.table("chatty_bots").select("id").eq("id", target_bot_id).eq("user_id", auth_user_id).limit(1).execute())
                if bot_check.data:
                    await run_db(lambda: supabase.table("chatty_bots").update({
                        "google_connected_account_id": new_acc_id,
                        "google_calendar_id": "primary",
                        "google_calendar_name": "Primary Calendar",
                        "sync_google_calendar": True,
                        "calendar_scheduling_enabled": True,
                        "meeting_provider": "google_meet",
                    }).eq("id", target_bot_id).execute())
                    return RedirectResponse(f"{frontend}{redirect_path}?google=connected_for_bot&bot_id={target_bot_id}")
            except Exception:
                logger.warning("Failed to auto-bind bot to new google account", exc_info=True)
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
    if target_bot_id:
        try:
            bot_check = await run_db(lambda: supabase.table("chatty_bots").select("id").eq("id", target_bot_id).eq("user_id", auth_user_id).limit(1).execute())
            if bot_check.data:
                await run_db(lambda: supabase.table("chatty_bots").update({
                    "google_connected_account_id": None,
                    "google_calendar_id": "primary",
                    "google_calendar_name": "Primary Calendar",
                    "sync_google_calendar": True,
                    "calendar_scheduling_enabled": True,
                    "meeting_provider": "google_meet",
                }).eq("id", target_bot_id).execute())
                return RedirectResponse(f"{frontend}{redirect_path}?google=ok&bot_id={target_bot_id}")
        except Exception:
            logger.warning("Failed to auto-bind bot to primary google account", exc_info=True)
    return RedirectResponse(f"{frontend}{redirect_path}?google=ok")


@router.post("/api/integrations/google/disconnect")
async def google_disconnect(
    body: Optional[DisconnectIntegrationRequest] = None,
    bot_id: Optional[str] = None,
    user: dict[str, Any] = Depends(require_user),
):
    target_bot_id = (body.bot_id if body else None) or bot_id
    scope = (body.scope if body else None) or "account"
    auth_user_id = user.get("auth_user_id") or user.get("id")

    # If specifically disconnecting only a single bot's calendar/drive without disconnecting the account
    if target_bot_id and scope == "bot":
        from app.core.permissions import verify_bot_permission
        await verify_bot_permission(target_bot_id, user, "calendar")
        await run_db(lambda: supabase.table("chatty_bots").update({
            "google_connected_account_id": None,
            "google_calendar_id": None,
            "google_calendar_name": None,
            "sync_google_calendar": False,
            "sync_google_drive": False,
            "calendar_scheduling_enabled": False,
        }).eq("id", target_bot_id).execute())
        return {"status": "disconnected", "bot_id": target_bot_id}

    # Disconnect the Google account across the workspace
    await run_db(lambda: supabase.table("users").update(
        {
            "google_access_token": None,
            "google_refresh_token": None,
            "google_token_expiry": None,
            "google_email": None,
            "google_scopes": None,
        }
    ).eq("auth_user_id", auth_user_id).execute())

    # Also clear calendar/drive sync on bots owned by this user
    try:
        await run_db(lambda: supabase.table("chatty_bots").update({
            "google_calendar_id": None,
            "google_calendar_name": None,
            "sync_google_calendar": False,
            "sync_google_drive": False,
            "calendar_scheduling_enabled": False,
        }).eq("user_id", auth_user_id).execute())
    except Exception as e:
        logger.warning("Failed to reset bots on google disconnect: %s", e)

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
            bot_owner = bot.get("user_id")
            if bot_owner not in (user.get("auth_user_id"), user.get("id")):
                from app.core.permissions import get_bot_role_and_permissions
                await get_bot_role_and_permissions(bot_id, user)
            target_account_id = bot.get("google_connected_account_id")

    try:
        calendars = await g.list_calendars(supabase, user, account_id=target_account_id)
        return {"calendars": calendars}
    except g.GoogleNotConnected:
        return {"calendars": [], "connected": False}
    except Exception:
        logger.warning("Failed to list Google calendars", exc_info=True)
        return {"calendars": [], "error": "Google calendar listing unavailable"}


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
            bot_owner = bot.get("user_id")
            if bot_owner not in (user.get("auth_user_id"), user.get("id")):
                from app.core.permissions import get_bot_role_and_permissions
                await get_bot_role_and_permissions(bot_id, user)
            target_account_id = bot.get("google_connected_account_id")

    try:
        folders = await g.list_drive_folders(supabase, user, parent_id=parent_id, account_id=target_account_id)
        return {"folders": folders}
    except g.GoogleNotConnected:
        return {"folders": [], "connected": False}
    except Exception:
        logger.warning("Failed to list Google Drive folders", exc_info=True)
        return {"folders": [], "error": "Google Drive folder listing unavailable"}


@router.delete("/api/integrations/google/accounts/{account_id}")
async def disconnect_extra_google_account(account_id: str, user: dict[str, Any] = Depends(require_user)):
    await run_db(lambda: supabase.table("kin_connected_accounts").delete().eq("id", account_id).eq(
        "user_id", user["id"]
    ).execute())
    return {"status": "disconnected"}



@router.get("/api/integrations/calendar/events")
async def calendar_events(
    bot_id: Optional[str] = None,
    user: dict[str, Any] = Depends(require_user)
):
    now = datetime.now(tz=timezone.utc)
    end = now + timedelta(days=7)

    events = []
    google_connected = bool(user.get("google_access_token"))
    ms_connected = bool(user.get("microsoft_access_token"))

    target_account_id = None
    target_calendar_id = "primary"
    bot_scheduling_enabled = True

    if bot_id:
        b_res = await run_db(lambda: supabase.table("chatty_bots").select(
            "id, user_id, calendar_scheduling_enabled, google_connected_account_id, google_calendar_id, sync_google_calendar, sync_outlook_calendar"
        ).eq("id", bot_id).execute())
        if b_res.data:
            bot = b_res.data[0]
            bot_owner = bot.get("user_id")
            if bot_owner not in (user.get("auth_user_id"), user.get("id")):
                try:
                    from app.core.permissions import get_bot_role_and_permissions
                    await get_bot_role_and_permissions(bot_id, user)
                except HTTPException:
                    return {
                        "events": [],
                        "connected": {
                            "google": False,
                            "microsoft": False,
                        },
                    }

            bot_scheduling_enabled = bool(bot.get("calendar_scheduling_enabled", False))
            target_account_id = bot.get("google_connected_account_id")
            target_calendar_id = bot.get("google_calendar_id") or "primary"

            # If scheduling is explicitly disabled, return empty events
            if not bot_scheduling_enabled:
                return {
                    "events": [],
                    "connected": {
                        "google": False,
                        "microsoft": False,
                    },
                }

    if google_connected and bot_scheduling_enabled:
        try:
            acc_user, table = await g.resolve_account_user(supabase, user, target_account_id)
            g_events = await g.list_calendar_events(
                supabase, acc_user, now - timedelta(hours=2), end,
                calendar_id=target_calendar_id,
                table=table
            )
            for e in g_events:
                e["source"] = "google"
            events.extend(g_events)
        except Exception:
            logger.warning("google calendar list failed", exc_info=True)

    if ms_connected and bot_scheduling_enabled:
        try:
            ms_events = await ms.list_outlook_events(
                supabase, user, time_min=now - timedelta(hours=2), time_max=end
            )
            for e in ms_events:
                e["source"] = "microsoft"
            events.extend(ms_events)
        except Exception:
            logger.warning("microsoft calendar list failed", exc_info=True)

    # Sort by start time ascending
    events.sort(key=lambda x: x.get("start") or "")
    return {
        "events": events,
        "connected": {
            "google": google_connected,
            "microsoft": ms_connected,
        },
    }


@router.post("/api/integrations/calendar/sync-from-bot")
async def sync_calendar_from_bot(
    body: dict[str, Any] = Body(...),
    user: dict[str, Any] = Depends(require_user),
):
    """Copy calendar connection configuration from source_bot_id to target_bot_id."""
    target_bot_id = body.get("target_bot_id")
    source_bot_id = body.get("source_bot_id")
    if not target_bot_id or not source_bot_id:
        raise HTTPException(status_code=400, detail="source_bot_id and target_bot_id are required")

    from app.core.permissions import get_bot_role_and_permissions
    await get_bot_role_and_permissions(source_bot_id, user)
    await get_bot_role_and_permissions(target_bot_id, user)

    src_res = await run_db(lambda: supabase.table("chatty_bots").select(
        "google_connected_account_id, google_calendar_id, google_calendar_name, google_calendar_color, "
        "meeting_provider, calendar_scheduling_enabled, sync_google_calendar, sync_outlook_calendar"
    ).eq("id", source_bot_id).limit(1).execute())
    if not src_res.data:
        raise HTTPException(status_code=404, detail="Source bot not found")

    src = src_res.data[0]
    updates = {
        "calendar_source_bot_id": source_bot_id,
        "google_connected_account_id": src.get("google_connected_account_id"),
        "google_calendar_id": src.get("google_calendar_id"),
        "google_calendar_name": src.get("google_calendar_name"),
        "google_calendar_color": src.get("google_calendar_color"),
        "meeting_provider": src.get("meeting_provider") or "google_meet",
        "calendar_scheduling_enabled": bool(src.get("calendar_scheduling_enabled")),
        "sync_google_calendar": bool(src.get("sync_google_calendar")),
        "sync_outlook_calendar": bool(src.get("sync_outlook_calendar")),
    }
    await run_db(lambda: supabase.table("chatty_bots").update(updates).eq("id", target_bot_id).execute())
    return {"ok": True, **updates}


# ---------------------------------------------------------------------------
# Microsoft 365 - OAuth flow + integration endpoints
# ---------------------------------------------------------------------------


@router.post("/api/integrations/microsoft/start")
async def microsoft_start(
    request: Request,
    redirect_path: Optional[str] = None,
    bot_id: Optional[str] = None,
    scope_type: Optional[str] = None,
    member_id: Optional[str] = None,
    user: dict[str, Any] = Depends(require_user)
):
    if bot_id:
        from app.core.permissions import get_bot_role_and_permissions
        role, perms = await get_bot_role_and_permissions(bot_id, user)
        if role != "owner" and not ({"meetings", "integrations", "settings", "team"} & set(perms)):
            raise HTTPException(status_code=403, detail="You don't have access to calendar integrations for this bot")
    if not os.environ.get("MICROSOFT_CLIENT_ID"):
        raise HTTPException(status_code=500, detail="MICROSOFT_CLIENT_ID not configured")
    origin = request.headers.get("origin", "")
    if not redirect_path:
        redirect_path = "/dashboard" if "chatty" in origin or "localhost:3001" in origin else "/dashboard/integrations"
    extra_claims: dict[str, Any] = {}
    if bot_id:
        extra_claims["bot_id"] = bot_id
    if scope_type:
        extra_claims["scope_type"] = scope_type
    if member_id:
        extra_claims["member_id"] = member_id
    state = _mint_state(user["auth_user_id"], origin_url=origin, redirect_path=redirect_path, extra_claims=extra_claims or None)
    scopes = ms.MICROSOFT_CALENDAR_ONLY_SCOPES if scope_type == "calendar" else None
    return {"url": ms.auth_url(state, scopes=scopes)}


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

    target_member_id = _decode_state_claim(state, "member_id")
    if target_member_id:
        member_email = profile.get("mail") or profile.get("userPrincipalName")
        member_update: dict[str, Any] = {
            "microsoft_email": member_email,
            "microsoft_calendar_connected": True,
            "microsoft_access_token": encrypt_secret(access),
            "microsoft_token_expiry": (
                datetime.now(tz=timezone.utc) + timedelta(seconds=expires_in)
            ).isoformat(),
        }
        if refresh:
            member_update["microsoft_refresh_token"] = encrypt_secret(refresh)
        matched_member = False
        try:
            up_res = await run_db(lambda: supabase.table("chatty_team_members").update(member_update).eq("id", target_member_id).execute())
            if up_res and up_res.data:
                matched_member = True
        except Exception:
            logger.warning("Failed to store microsoft calendar tokens on chatty_team_members, falling back to email", exc_info=True)
            try:
                up_res = await run_db(lambda: supabase.table("chatty_team_members").update({
                    "microsoft_email": member_email,
                    "microsoft_calendar_connected": True,
                }).eq("id", target_member_id).execute())
                if up_res and up_res.data:
                    matched_member = True
            except Exception:
                pass

        if not matched_member:
            try:
                owner_update: dict[str, Any] = {
                    "microsoft_email": member_email,
                    "microsoft_access_token": encrypt_secret(access),
                    "microsoft_token_expiry": (
                        datetime.now(tz=timezone.utc) + timedelta(seconds=expires_in)
                    ).isoformat(),
                }
                if refresh:
                    owner_update["microsoft_refresh_token"] = encrypt_secret(refresh)
                await run_db(lambda: supabase.table("users").update(owner_update).eq("auth_user_id", auth_user_id).execute())
            except Exception:
                logger.warning("Failed to store microsoft calendar tokens on users for owner", exc_info=True)

        if target_bot_id:
            try:
                from app.routers.team import _write_team_audit_log
                await _write_team_audit_log(
                    target_bot_id,
                    "team_member_calendar_updated",
                    f"Connected personal Microsoft Calendar (Calendar-only) for {member_email or target_member_id}",
                    {"auth_user_id": auth_user_id, "id": auth_user_id, "email": member_email or "teammate"}
                )
            except Exception:
                pass
        return RedirectResponse(f"{frontend}{redirect_path}?calendar_connected=microsoft&member_id={target_member_id}")

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
async def microsoft_disconnect(
    body: Optional[DisconnectIntegrationRequest] = None,
    bot_id: Optional[str] = None,
    user: dict[str, Any] = Depends(require_user),
):
    target_bot_id = (body.bot_id if body else None) or bot_id
    scope = (body.scope if body else None) or "account"
    auth_user_id = user.get("auth_user_id") or user.get("id")

    if target_bot_id and scope == "bot":
        from app.core.permissions import verify_bot_permission
        await verify_bot_permission(target_bot_id, user, "calendar")
        await run_db(lambda: supabase.table("chatty_bots").update({
            "sync_outlook_calendar": False,
            "calendar_scheduling_enabled": False,
        }).eq("id", target_bot_id).execute())
        return {"status": "disconnected", "bot_id": target_bot_id}

    # Disconnect the Microsoft account across the workspace
    await run_db(lambda: supabase.table("users").update(
        {
            "microsoft_access_token": None,
            "microsoft_refresh_token": None,
            "microsoft_token_expiry": None,
            "microsoft_email": None,
            "microsoft_scopes": None,
        }
    ).eq("auth_user_id", auth_user_id).execute())

    # Also clear calendar sync on bots owned by this user
    try:
        await run_db(lambda: supabase.table("chatty_bots").update({
            "sync_outlook_calendar": False,
            "calendar_scheduling_enabled": False,
        }).eq("user_id", auth_user_id).execute())
    except Exception as e:
        logger.warning("Failed to reset bots on microsoft disconnect: %s", e)

    return {"status": "disconnected"}


@router.post("/api/integrations/zoom/disconnect")
async def zoom_disconnect(
    body: Optional[DisconnectIntegrationRequest] = None,
    bot_id: Optional[str] = None,
    user: dict[str, Any] = Depends(require_user),
):
    target_bot_id = (body.bot_id if body else None) or bot_id
    if target_bot_id:
        from app.core.permissions import verify_bot_permission
        await verify_bot_permission(target_bot_id, user, "calendar")
        await run_db(lambda: supabase.table("chatty_bots").update({
            "custom_meeting_link": None,
            "meeting_provider": "google_meet",
        }).eq("id", target_bot_id).execute())
        return {"status": "disconnected", "bot_id": target_bot_id}
    return {"status": "disconnected"}


@router.get("/api/integrations/microsoft/calendars")
async def get_microsoft_calendars(
    bot_id: Optional[str] = None,
    user: dict[str, Any] = Depends(require_user),
):
    ms_connected = bool(user.get("microsoft_access_token"))
    if not ms_connected:
        return {"calendars": [], "connected": False}
    try:
        events = await ms.list_outlook_events(supabase, user)
        return {"calendars": [{"id": "default", "name": "Outlook Calendar", "primary": True}], "connected": True}
    except Exception:
        return {"calendars": [], "connected": False}

