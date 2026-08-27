"""Bot management endpoints: shared-bot listing, logo/avatar upload, AI business
generation, BYOK config, dashboard webhook management, and capability
discovery (/api/bots/*, /api/bot/*, /api/generate-business, /api/capabilities)."""

from __future__ import annotations

import logging
import secrets
from typing import Any

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from app.core.clients import supabase
from app.core.config import MODEL_NAME
from app.core.db import run_db
from app.core.deps import require_user
from app.core.ssrf import UnsafeURLError, assert_safe_url_async
from app.schemas.bots import (
    BYOKUpdate,
    DashboardWebhookCreateRequest,
    GenerateBusinessRequest,
    VoiceSettingsUpdate,
)
from plugins import ai_client
from plugins import llm_providers
from plugins import notifications as notify
from plugins.widget_brain import GEMINI_FALLBACK_MODELS

# Bridged helpers still living in main.py (Phase 2 leaves these in place to
# avoid a large, risky helper-extraction pass alongside the route split).
from main import _verify_bot_owner
import json

logger = logging.getLogger("chatty")

router = APIRouter()


@router.get("/api/bots/shared")
async def list_shared_bots(user: dict[str, Any] = Depends(require_user)):
    """Bots the caller can access as a team member (not owner). Sensitive fields
    (e.g. BYOK keys) are stripped."""
    email = (user.get("email") or "").strip().lower()
    if not email:
        return {"bots": []}
    memberships = (await run_db(lambda: supabase.table("chatty_team_members").select(
        "bot_id, role").eq("email", email).execute())).data or []
    if not memberships:
        return {"bots": []}
    role_by_bot = {m["bot_id"]: m["role"] for m in memberships}
    bots = (await run_db(lambda: supabase.table("chatty_bots").select(
        "id, name, primary_color, widget_style, welcome_message, avatar_icon, avatar_url"
    ).in_("id", list(role_by_bot.keys())).execute())).data or []
    for b in bots:
        b["_role"] = role_by_bot.get(b["id"], "agent")
    return {"bots": bots}


@router.post("/api/bot/logo")
async def upload_bot_logo(
    bot_id: str = Form(...),
    file: UploadFile = File(...),
    user: dict[str, Any] = Depends(require_user),
):
    res = await run_db(lambda: supabase.table("chatty_bots").select("id").eq("id", bot_id).eq(
        "user_id", user["auth_user_id"]).execute())
    if not res.data:
        raise HTTPException(status_code=403, detail="Unauthorized")
    data = await file.read()
    if not data or len(data) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Logo must be a non-empty image under 10MB")
    mime = (file.content_type or "image/png").split(";")[0]
    if not mime.startswith("image/"):
        raise HTTPException(status_code=400, detail="Logo must be an image")
    import uuid as _uuid
    ext = (file.filename or "logo.png").split(".")[-1][:8]
    path = f"logos/{bot_id}/{_uuid.uuid4().hex[:8]}.{ext}"
    try:
        def _upload():
            supabase.storage.from_("chatty-uploads").upload(path, data, {"content-type": mime})
            url = supabase.storage.from_("chatty-uploads").get_public_url(path)
            supabase.table("chatty_bots").update({"logo_url": url}).eq("id", bot_id).execute()
            return url
        url = await run_db(_upload)
        return {"logo_url": url}
    except Exception as e:
        logger.exception("Logo upload failed")
        raise HTTPException(status_code=500, detail="Logo upload failed") from e


@router.post("/api/bot/avatar")
async def upload_bot_avatar(
    bot_id: str = Form(...),
    file: UploadFile = File(...),
    user: dict[str, Any] = Depends(require_user),
):
    """Upload a custom assistant avatar image (separate from the header logo)."""
    res = await run_db(lambda: supabase.table("chatty_bots").select("id").eq("id", bot_id).eq(
        "user_id", user["auth_user_id"]).execute())
    if not res.data:
        raise HTTPException(status_code=403, detail="Unauthorized")
    data = await file.read()
    if not data or len(data) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Avatar must be a non-empty image under 10MB")
    mime = (file.content_type or "image/png").split(";")[0]
    if not mime.startswith("image/"):
        raise HTTPException(status_code=400, detail="Avatar must be an image")
    import uuid as _uuid
    ext = (file.filename or "avatar.png").split(".")[-1][:8]
    path = f"avatars/{bot_id}/{_uuid.uuid4().hex[:8]}.{ext}"
    try:
        def _upload():
            supabase.storage.from_("chatty-uploads").upload(path, data, {"content-type": mime})
            url = supabase.storage.from_("chatty-uploads").get_public_url(path)
            supabase.table("chatty_bots").update({"avatar_url": url, "avatar_icon": "custom"}).eq("id", bot_id).execute()
            return url
        url = await run_db(_upload)
        return {"avatar_url": url}
    except Exception as e:
        logger.exception("Avatar upload failed")
        raise HTTPException(status_code=500, detail="Avatar upload failed") from e


@router.post("/api/generate-business")
async def generate_business(
    req: GenerateBusinessRequest,
    user: dict[str, Any] = Depends(require_user),
):
    """AI-generate a business description, support persona instructions, and a
    welcome message from a short hint (business name / URL / one-liner)."""
    res = await run_db(lambda: supabase.table("chatty_bots").select("id").eq("id", req.bot_id).eq(
        "user_id", user["auth_user_id"]).execute())
    if not res.data:
        raise HTTPException(status_code=403, detail="Unauthorized")

    prompt = (
        "You are helping configure an AI customer-support assistant. Based on the hint below, "
        "produce a JSON object with EXACTLY these keys:\n"
        '  "description": a concise 2-3 sentence description of the business, what it sells, and who its customers are.\n'
        '  "system_instructions": clear support-agent guidelines for this specific business (tone, what to help with, what to avoid).\n'
        '  "welcome_message": a short friendly first message the chat assistant shows visitors.\n'
        "Return ONLY raw JSON, no markdown, no commentary.\n\n"
        f"Hint: {req.hint or 'A small business that wants a helpful website support assistant.'}"
    )
    try:
        response = await ai_client.chat(
            model=ai_client.resolve_gemini_model(MODEL_NAME),
            messages=[{"role": "user", "content": prompt}],
            fallback_models=[ai_client.resolve_gemini_model(m) for m in GEMINI_FALLBACK_MODELS],
            temperature=0.6,
            max_tokens=1024,
            bot_id=req.bot_id,
            call_type="generate_business",
        )
        raw = (response.choices[0].message.content or "").strip()
        if raw.startswith("```"):
            raw = raw.split("```", 2)[1] if "```" in raw else raw
            raw = raw.replace("json", "", 1).strip() if raw.lower().startswith("json") else raw
        data = json.loads(raw)
        return {
            "description": str(data.get("description", ""))[:2000],
            "system_instructions": str(data.get("system_instructions", ""))[:2000],
            "welcome_message": str(data.get("welcome_message", ""))[:300],
        }
    except Exception:
        logger.exception("generate-business failed")
        raise HTTPException(status_code=502, detail="Could not generate. Please try again.")


@router.get("/api/bots/{bot_id}/byok")
async def get_byok_status(bot_id: str, user: dict[str, Any] = Depends(require_user)):
    """Never returns the decrypted key — only whether one is configured."""
    res = await run_db(lambda: supabase.table("chatty_bots").select("byok_provider, byok_model, byok_api_key_encrypted, user_id") \
        .eq("id", bot_id).execute())
    if not res.data or res.data[0]["user_id"] != user["auth_user_id"]:
        raise HTTPException(status_code=403, detail="Unauthorized")
    row = res.data[0]
    return {
        "provider": row.get("byok_provider"),
        "model": row.get("byok_model"),
        "configured": bool(row.get("byok_api_key_encrypted")),
    }


@router.post("/api/bots/{bot_id}/byok")
async def set_byok(bot_id: str, req: BYOKUpdate, user: dict[str, Any] = Depends(require_user)):
    res = await run_db(lambda: supabase.table("chatty_bots").select("id, user_id").eq("id", bot_id).execute())
    if not res.data or res.data[0]["user_id"] != user["auth_user_id"]:
        raise HTTPException(status_code=403, detail="Unauthorized")

    if req.provider and req.provider not in ("openai", "anthropic", "openrouter"):
        raise HTTPException(status_code=400, detail="provider must be openai, anthropic, or openrouter")

    update: dict[str, Any] = {"byok_provider": req.provider or None, "byok_model": (req.model or None)}
    if req.api_key:
        update["byok_api_key_encrypted"] = llm_providers.encrypt_api_key(req.api_key)
    elif not req.provider:
        update["byok_api_key_encrypted"] = None  # clearing BYOK entirely

    await run_db(lambda: supabase.table("chatty_bots").update(update).eq("id", bot_id).execute())
    return {"success": True}


@router.get("/api/bots/{bot_id}/voice-settings")
async def get_voice_settings(bot_id: str, user: dict[str, Any] = Depends(require_user)):
    """Never returns decrypted BYOK keys — only whether one is configured."""
    res = await run_db(lambda: supabase.table("chatty_bots").select(
        "voice_enabled, voice_stt_provider, voice_stt_byok_key_encrypted, "
        "voice_tts_provider, voice_tts_byok_key_encrypted, voice_tts_voice, "
        "voice_agent_role, voice_max_duration_minutes, user_id"
    ).eq("id", bot_id).execute())
    if not res.data or res.data[0]["user_id"] != user["auth_user_id"]:
        raise HTTPException(status_code=403, detail="Unauthorized")
    row = res.data[0]
    return {
        "voice_enabled": bool(row.get("voice_enabled")),
        "voice_stt_provider": row.get("voice_stt_provider") or "google",
        "voice_tts_provider": row.get("voice_tts_provider") or "google",
        "voice_tts_voice": row.get("voice_tts_voice"),
        "voice_stt_configured": bool(row.get("voice_stt_byok_key_encrypted")),
        "voice_tts_configured": bool(row.get("voice_tts_byok_key_encrypted")),
        "voice_agent_role": row.get("voice_agent_role") or "general",
        "voice_max_duration_minutes": row.get("voice_max_duration_minutes") or 15,
    }


@router.post("/api/bots/{bot_id}/voice-settings")
async def set_voice_settings(
    bot_id: str, req: VoiceSettingsUpdate, user: dict[str, Any] = Depends(require_user)
):
    res = await run_db(lambda: supabase.table("chatty_bots").select("id, user_id").eq("id", bot_id).execute())
    if not res.data or res.data[0]["user_id"] != user["auth_user_id"]:
        raise HTTPException(status_code=403, detail="Unauthorized")

    update: dict[str, Any] = {}
    if req.voice_enabled is not None:
        update["voice_enabled"] = req.voice_enabled
    if req.voice_stt_provider is not None:
        update["voice_stt_provider"] = req.voice_stt_provider
        if req.voice_stt_provider == "google":
            update["voice_stt_byok_key_encrypted"] = None  # no key needed for the default
    if req.voice_tts_provider is not None:
        update["voice_tts_provider"] = req.voice_tts_provider
        if req.voice_tts_provider == "google":
            update["voice_tts_byok_key_encrypted"] = None
    if req.voice_tts_voice is not None:
        update["voice_tts_voice"] = req.voice_tts_voice or None
    if req.voice_stt_api_key is not None:
        update["voice_stt_byok_key_encrypted"] = (
            llm_providers.encrypt_api_key(req.voice_stt_api_key) if req.voice_stt_api_key else None
        )
    if req.voice_tts_api_key is not None:
        update["voice_tts_byok_key_encrypted"] = (
            llm_providers.encrypt_api_key(req.voice_tts_api_key) if req.voice_tts_api_key else None
        )
    if req.voice_agent_role is not None:
        update["voice_agent_role"] = req.voice_agent_role
    if req.voice_max_duration_minutes is not None:
        update["voice_max_duration_minutes"] = max(1, min(60, req.voice_max_duration_minutes))

    if update:
        await run_db(lambda: supabase.table("chatty_bots").update(update).eq("id", bot_id).execute())
    return {"success": True}


@router.get("/api/bots/{bot_id}/webhooks")
async def dashboard_list_webhooks(bot_id: str, user: dict[str, Any] = Depends(require_user)):
    await _verify_bot_owner(bot_id, user)
    res = await run_db(lambda: supabase.table("chatty_webhooks").select(
        "id, url, events, active, created_at"
    ).eq("bot_id", bot_id).order("created_at", desc=True).execute())
    return {"webhooks": res.data or []}


@router.post("/api/bots/{bot_id}/webhooks")
async def dashboard_create_webhook(
    bot_id: str, req: DashboardWebhookCreateRequest, user: dict[str, Any] = Depends(require_user)
):
    await _verify_bot_owner(bot_id, user)
    url = (req.url or "").strip()
    if not url.startswith(("http://", "https://")):
        raise HTTPException(status_code=400, detail="url must be a valid http(s) URL")
    try:
        await assert_safe_url_async(url)
    except UnsafeURLError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid url: {exc}") from exc
    events = [e for e in (req.events or []) if e in notify.WEBHOOK_EVENTS]
    if not events:
        raise HTTPException(
            status_code=400,
            detail=f"events must include at least one of: {', '.join(notify.WEBHOOK_EVENTS)}",
        )
    secret = f"whsec_{secrets.token_hex(24)}"
    row = await run_db(lambda: supabase.table("chatty_webhooks").insert({
        "bot_id": bot_id, "url": url, "events": events, "secret": secret, "active": True,
    }).execute())
    return row.data[0] if row.data else {"url": url, "events": events, "secret": secret}


@router.delete("/api/bots/{bot_id}/webhooks/{webhook_id}")
async def dashboard_delete_webhook(
    bot_id: str, webhook_id: str, user: dict[str, Any] = Depends(require_user)
):
    await _verify_bot_owner(bot_id, user)
    res = await run_db(lambda: supabase.table("chatty_webhooks").select("id").eq("id", webhook_id).eq("bot_id", bot_id).execute())
    if not res.data:
        raise HTTPException(status_code=404, detail="Webhook not found")
    await run_db(lambda: supabase.table("chatty_webhooks").delete().eq("id", webhook_id).execute())
    return {"success": True, "deleted_id": webhook_id}


@router.get("/api/capabilities")
async def get_capabilities(user: dict[str, Any] = Depends(require_user)):
    """Report which optional integrations are configured on the backend so the
    UI can gate provider choices."""
    from plugins import notifications as _notify
    return {
        "onesignal_configured": _notify.onesignal_configured(),
    }
