"""Tenant-safe LiveKit token and voice-agent configuration endpoints."""

from __future__ import annotations

import json
import os
import re
import uuid
from datetime import timedelta
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request

from app.core.clients import supabase
from app.core.crypto import encrypt_secret
from app.core.db import run_db
from app.core.deps import require_user
from app.core.permissions import verify_bot_permission
from app.schemas.voice import VoiceConfigUpdate, VoiceTokenRequest
from main import _client_ip, _widget_rate_limit_or_429

router = APIRouter()

_CONFIG_FIELDS = (
    "voice_enabled, voice_mode, voice_expression_enabled, voice_visualizer, voice_agent_name, "
    "voice_llm_provider, voice_llm_model, voice_llm_byok_key_encrypted, voice_stt_provider, "
    "voice_stt_model, voice_stt_language, voice_stt_byok_key_encrypted, voice_tts_provider, "
    "voice_tts_model, voice_tts_voice, voice_tts_byok_key_encrypted, voice_max_duration_minutes"
)


def _livekit_settings() -> tuple[str, str, str, str]:
    url = os.environ.get("LIVEKIT_URL", "").strip()
    key = os.environ.get("LIVEKIT_API_KEY", "").strip()
    secret = os.environ.get("LIVEKIT_API_SECRET", "").strip()
    agent_name = os.environ.get("LIVEKIT_AGENT_NAME", "chatty-voice-agent").strip()
    if not url or not key or not secret:
        raise HTTPException(status_code=503, detail="LiveKit is not configured")
    return url, key, secret, agent_name


def _safe_room_name(bot_id: str, session_id: str) -> str:
    clean_session = re.sub(r"[^a-zA-Z0-9_-]", "-", session_id).strip("-")[:80]
    return f"chatty-{bot_id}-{clean_session or uuid.uuid4().hex[:12]}"


def _public_voice_config(bot: dict[str, Any]) -> dict[str, Any]:
    return {
        "enabled": bool(bot.get("voice_enabled")),
        "mode": bot.get("voice_mode") or "pipeline",
        "expression_enabled": bool(bot.get("voice_expression_enabled", True)),
        "visualizer": bot.get("voice_visualizer") or "wave",
        "agent_name": bot.get("voice_agent_name") or "chatty-voice-agent",
        "llm_provider": bot.get("voice_llm_provider") or "google",
        "llm_model": bot.get("voice_llm_model") or "gemini-2.5-flash",
        "stt_provider": bot.get("voice_stt_provider") or "google",
        "stt_model": bot.get("voice_stt_model") or "chirp_3",
        "stt_language": bot.get("voice_stt_language") or "en-US",
        "tts_provider": bot.get("voice_tts_provider") or "google",
        "tts_model": bot.get("voice_tts_model") or "gemini-3.8-flash-tts",
        "tts_voice": bot.get("voice_tts_voice") or "Kore",
        "max_duration_minutes": bot.get("voice_max_duration_minutes") or 15,
    }


@router.get("/api/bots/{bot_id}/voice")
async def get_voice_config(bot_id: str, user: dict[str, Any] = Depends(require_user)):
    await verify_bot_permission(bot_id, user, "settings")
    result = await run_db(lambda: supabase.table("chatty_bots").select(_CONFIG_FIELDS).eq("id", bot_id).limit(1).execute())
    if not result.data:
        raise HTTPException(status_code=404, detail="Bot not found")
    row = result.data[0]
    return _public_voice_config(row) | {
        "llm_key_configured": bool(row.get("voice_llm_byok_key_encrypted")),
        "stt_key_configured": bool(row.get("voice_stt_byok_key_encrypted")),
        "tts_key_configured": bool(row.get("voice_tts_byok_key_encrypted")),
        "livekit_url": os.environ.get("LIVEKIT_URL", "").strip(),
    }


@router.put("/api/bots/{bot_id}/voice")
async def update_voice_config(
    bot_id: str,
    body: VoiceConfigUpdate,
    user: dict[str, Any] = Depends(require_user),
):
    await verify_bot_permission(bot_id, user, "settings")
    mapping = {
        "enabled": "voice_enabled", "mode": "voice_mode",
        "expression_enabled": "voice_expression_enabled", "visualizer": "voice_visualizer",
        "agent_name": "voice_agent_name", "llm_provider": "voice_llm_provider",
        "llm_model": "voice_llm_model", "stt_provider": "voice_stt_provider",
        "stt_model": "voice_stt_model", "stt_language": "voice_stt_language",
        "tts_provider": "voice_tts_provider", "tts_model": "voice_tts_model",
        "tts_voice": "voice_tts_voice", "max_duration_minutes": "voice_max_duration_minutes",
    }
    updates: dict[str, Any] = {}
    for source, target in mapping.items():
        value = getattr(body, source)
        if value is not None:
            updates[target] = value.strip() if isinstance(value, str) else value
    for source, target in {
        "llm_api_key": "voice_llm_byok_key_encrypted",
        "stt_api_key": "voice_stt_byok_key_encrypted",
        "tts_api_key": "voice_tts_byok_key_encrypted",
    }.items():
        value = getattr(body, source)
        if value is not None:
            updates[target] = encrypt_secret(value.strip()) if value.strip() else None
    if not updates:
        raise HTTPException(status_code=400, detail="No voice settings supplied")
    result = await run_db(lambda: supabase.table("chatty_bots").update(updates).eq("id", bot_id).execute())
    if not result.data:
        raise HTTPException(status_code=404, detail="Bot not found")
    row = result.data[0]
    return _public_voice_config(row) | {
        "llm_key_configured": bool(row.get("voice_llm_byok_key_encrypted")),
        "stt_key_configured": bool(row.get("voice_stt_byok_key_encrypted")),
        "tts_key_configured": bool(row.get("voice_tts_byok_key_encrypted")),
    }


@router.get("/api/widget/voice/config")
async def get_widget_voice_config(bot_id: str, request: Request):
    result = await run_db(lambda: supabase.table("chatty_bots").select(_CONFIG_FIELDS).eq("id", bot_id).limit(1).execute())
    if not result.data:
        raise HTTPException(status_code=404, detail="Bot not found")
    bot = result.data[0]
    await _widget_rate_limit_or_429(bot, bot_id, _client_ip(request), request.headers.get("x-widget-token"))
    return _public_voice_config(bot)


@router.post("/api/widget/voice/token")
async def create_widget_voice_token(body: VoiceTokenRequest, request: Request):
    result = await run_db(lambda: supabase.table("chatty_bots").select("*").eq("id", body.bot_id).limit(1).execute())
    if not result.data:
        raise HTTPException(status_code=404, detail="Bot not found")
    bot = result.data[0]
    await _widget_rate_limit_or_429(bot, body.bot_id, _client_ip(request), request.headers.get("x-widget-token"))
    if not bot.get("voice_enabled"):
        raise HTTPException(status_code=409, detail="Voice agent is disabled for this bot")
    server_url, api_key, api_secret, default_agent_name = _livekit_settings()
    room_name = _safe_room_name(body.bot_id, body.session_id)
    identity = f"chatty-visitor-{uuid.uuid4().hex}"
    participant_name = (body.participant_name or "Visitor").strip()[:120]
    from livekit import api
    from livekit.protocol import room

    # One worker process currently registers one LiveKit dispatch name. Keep
    # the dashboard label descriptive, but never dispatch to an arbitrary
    # unregistered name saved on a bot.
    dispatch = room.RoomAgentDispatch(
        agent_name=default_agent_name,
        metadata=json.dumps({"bot_id": body.bot_id, "session_id": body.session_id}),
    )
    token = (
        api.AccessToken(api_key, api_secret, identity=identity, name=participant_name)
        .with_ttl(timedelta(minutes=15))
        .with_grants(api.VideoGrants(
            room_join=True, room=room_name, can_publish=True,
            can_publish_data=True, can_subscribe=True,
        ))
        .with_room_config(room.RoomConfiguration(agents=[dispatch]))
        .to_jwt()
    )
    return {
        "serverUrl": server_url,
        "participantToken": token,
        "roomName": room_name,
        "participantName": participant_name,
    }
