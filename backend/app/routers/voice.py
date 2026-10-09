"""Tenant-safe LiveKit token and voice-agent configuration endpoints."""

from __future__ import annotations

import json
import os
import re
import uuid
from datetime import timedelta
from typing import Any
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, Request

from app.core.clients import supabase
from app.core.crypto import encrypt_secret
from app.core.db import run_db
from app.core.deps import require_user
from app.core.permissions import verify_bot_permission
from app.schemas.voice import VoiceConfigUpdate, VoiceTokenRequest
from app.services.contact_identity import guard_widget_session
from main import _client_ip, _widget_rate_limit_or_429

router = APIRouter()

_CONFIG_FIELDS = (
    "voice_enabled, voice_mode, voice_expression_enabled, voice_visualizer, voice_agent_name, "
    "voice_realtime_provider, voice_realtime_model, voice_realtime_byok_key_encrypted, "
    "voice_llm_provider, voice_llm_model, voice_llm_byok_key_encrypted, voice_stt_provider, "
    "voice_stt_model, voice_stt_language, voice_stt_byok_key_encrypted, voice_tts_provider, "
    "voice_tts_model, voice_tts_voice, voice_tts_byok_key_encrypted, voice_max_duration_minutes"
)

# Providers that receive a tenant-scoped API key in ``build_components`` or
# ``build_realtime_model``. Google uses the worker's Vertex ADC, while
# LiveKit Inference uses the server's LiveKit credentials. AWS and NVIDIA use
# the worker's IAM/runtime credentials and therefore are deliberately not
# treated as single-string BYOK providers here.
_PIPELINE_KEY_FIELDS = {
    "llm": {
        "openai": "voice_llm_byok_key_encrypted",
        "anthropic": "voice_llm_byok_key_encrypted",
        "openrouter": "voice_llm_byok_key_encrypted",
    },
    "stt": {
        "openai": "voice_stt_byok_key_encrypted",
        "deepgram": "voice_stt_byok_key_encrypted",
        "assemblyai": "voice_stt_byok_key_encrypted",
        "soniox": "voice_stt_byok_key_encrypted",
        "cartesia": "voice_stt_byok_key_encrypted",
    },
    "tts": {
        "openai": "voice_tts_byok_key_encrypted",
        "cartesia": "voice_tts_byok_key_encrypted",
        "deepgram": "voice_tts_byok_key_encrypted",
        "elevenlabs": "voice_tts_byok_key_encrypted",
        "fishaudio": "voice_tts_byok_key_encrypted",
    },
}

_REALTIME_KEY_FIELDS = {
    "openai": "voice_realtime_byok_key_encrypted",
    "azure": "voice_realtime_byok_key_encrypted",
    "phonic": "voice_realtime_byok_key_encrypted",
    "spacexai": "voice_realtime_byok_key_encrypted",
    "ultravox": "voice_realtime_byok_key_encrypted",
}


def _livekit_inference_available() -> bool:
    """Return whether this worker is connected to LiveKit Cloud.

    LiveKit Inference is a hosted gateway capability. A self-hosted LiveKit
    deployment can still use every direct provider plugin, but it must not
    persist a LiveKit Inference selection that the worker cannot execute.
    """
    raw_url = os.environ.get("LIVEKIT_URL", "").strip()
    if not raw_url:
        return False
    hostname = (urlparse(raw_url).hostname or "").lower().rstrip(".")
    return hostname == "livekit.cloud" or hostname.endswith(".livekit.cloud")


def _voice_configuration_error(bot: dict[str, Any]) -> str | None:
    """Return a safe save-time error for an unusable enabled configuration.

    Provider construction happens in the isolated worker, so the API must not
    attempt to instantiate SDKs here. This check only verifies the contract
    that can be established without contacting a provider: the selected mode
    has the credentials it needs. Secret values are never included in the
    returned message.
    """
    if not bool(bot.get("voice_enabled")):
        return None

    mode = str(bot.get("voice_mode") or "pipeline").strip().lower()
    if mode == "realtime":
        provider = str(bot.get("voice_realtime_provider") or "google").strip().lower()
        key_field = _REALTIME_KEY_FIELDS.get(provider)
        if key_field and not str(bot.get(key_field) or "").strip():
            return f"Voice is enabled, but the {provider} realtime API key is missing."
        return None

    for kind, provider_field in (
        ("llm", "voice_llm_provider"),
        ("stt", "voice_stt_provider"),
        ("tts", "voice_tts_provider"),
    ):
        provider = str(bot.get(provider_field) or "google").strip().lower()
        if provider == "livekit-inference" and not _livekit_inference_available():
            return (
                "LiveKit Inference is available only with LiveKit Cloud. "
                "Select a direct provider for this self-hosted LiveKit deployment."
            )
        key_field = _PIPELINE_KEY_FIELDS[kind].get(provider)
        if key_field and not str(bot.get(key_field) or "").strip():
            return f"Voice is enabled, but the {provider} {kind.upper()} API key is missing."
    return None


def _livekit_settings() -> tuple[str, str, str, str]:
    url = os.environ.get("LIVEKIT_URL", "").strip()
    key = os.environ.get("LIVEKIT_API_KEY", "").strip()
    secret = os.environ.get("LIVEKIT_API_SECRET", "").strip()
    agent_name = os.environ.get("LIVEKIT_AGENT_NAME", "chatty-voice-agent").strip()
    if not url or not key or not secret:
        raise HTTPException(status_code=503, detail="LiveKit is not configured")
    return url, key, secret, agent_name


def _safe_room_name(bot_id: str, session_id: str, room_nonce: str | None = None) -> str:
    clean_session = re.sub(r"[^a-zA-Z0-9_-]", "-", session_id).strip("-")[:80]
    clean_nonce = re.sub(r"[^a-zA-Z0-9_-]", "-", room_nonce or "").strip("-")[:80]
    suffix = f"{clean_session}-{clean_nonce}" if clean_nonce else clean_session
    return f"chatty-{bot_id}-{suffix or uuid.uuid4().hex[:12]}"


def _public_voice_config(bot: dict[str, Any]) -> dict[str, Any]:
    return {
        "enabled": bool(bot.get("voice_enabled")),
        "mode": bot.get("voice_mode") or "pipeline",
        "expression_enabled": bool(bot.get("voice_expression_enabled", True)),
        "visualizer": bot.get("voice_visualizer") or "wave",
        "agent_name": bot.get("voice_agent_name") or "chatty-voice-agent",
        "realtime_provider": bot.get("voice_realtime_provider") or "google",
        "realtime_model": bot.get("voice_realtime_model") or "gemini-live-2.5-flash-native-audio",
        "llm_provider": bot.get("voice_llm_provider") or "google",
        "llm_model": bot.get("voice_llm_model") or "gemini-2.5-flash",
        "stt_provider": bot.get("voice_stt_provider") or "google",
        "stt_model": bot.get("voice_stt_model") or "chirp_3",
        "stt_language": bot.get("voice_stt_language") or "en-US",
        "tts_provider": bot.get("voice_tts_provider") or "google",
        "tts_model": bot.get("voice_tts_model") or "gemini-3.1-flash-tts-preview",
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
        "realtime_key_configured": bool(row.get("voice_realtime_byok_key_encrypted")),
        "llm_key_configured": bool(row.get("voice_llm_byok_key_encrypted")),
        "stt_key_configured": bool(row.get("voice_stt_byok_key_encrypted")),
        "tts_key_configured": bool(row.get("voice_tts_byok_key_encrypted")),
        "livekit_url": os.environ.get("LIVEKIT_URL", "").strip(),
        "livekit_inference_available": _livekit_inference_available(),
    }


@router.put("/api/bots/{bot_id}/voice")
async def update_voice_config(
    bot_id: str,
    body: VoiceConfigUpdate,
    user: dict[str, Any] = Depends(require_user),
):
    await verify_bot_permission(bot_id, user, "settings")
    current_result = await run_db(
        lambda: supabase.table("chatty_bots")
        .select(_CONFIG_FIELDS)
        .eq("id", bot_id)
        .limit(1)
        .execute()
    )
    if not current_result.data:
        raise HTTPException(status_code=404, detail="Bot not found")
    current = dict(current_result.data[0])
    mapping = {
        "enabled": "voice_enabled", "mode": "voice_mode",
        "expression_enabled": "voice_expression_enabled", "visualizer": "voice_visualizer",
        "agent_name": "voice_agent_name", "llm_provider": "voice_llm_provider",
        "realtime_provider": "voice_realtime_provider", "realtime_model": "voice_realtime_model",
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
        "realtime_api_key": "voice_realtime_byok_key_encrypted",
        "llm_api_key": "voice_llm_byok_key_encrypted",
        "stt_api_key": "voice_stt_byok_key_encrypted",
        "tts_api_key": "voice_tts_byok_key_encrypted",
    }.items():
        value = getattr(body, source)
        if value is not None:
            updates[target] = encrypt_secret(value.strip()) if value.strip() else None
    if not updates:
        raise HTTPException(status_code=400, detail="No voice settings supplied")
    effective = current | updates
    configuration_error = _voice_configuration_error(effective)
    if configuration_error:
        raise HTTPException(status_code=422, detail=configuration_error)
    result = await run_db(lambda: supabase.table("chatty_bots").update(updates).eq("id", bot_id).execute())
    if not result.data:
        raise HTTPException(status_code=404, detail="Bot not found")
    row = result.data[0]
    return _public_voice_config(row) | {
        "realtime_key_configured": bool(row.get("voice_realtime_byok_key_encrypted")),
        "llm_key_configured": bool(row.get("voice_llm_byok_key_encrypted")),
        "stt_key_configured": bool(row.get("voice_stt_byok_key_encrypted")),
        "tts_key_configured": bool(row.get("voice_tts_byok_key_encrypted")),
        "livekit_url": os.environ.get("LIVEKIT_URL", "").strip(),
        "livekit_inference_available": _livekit_inference_available(),
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
    # Credential-backed widget sessions must prove ownership before a
    # short-lived LiveKit room token is minted. Dashboard/standalone sessions
    # use non-ci IDs and remain compatible with the public SDK.
    await guard_widget_session(request)
    result = await run_db(lambda: supabase.table("chatty_bots").select("*").eq("id", body.bot_id).limit(1).execute())
    if not result.data:
        raise HTTPException(status_code=404, detail="Bot not found")
    bot = result.data[0]
    await _widget_rate_limit_or_429(bot, body.bot_id, _client_ip(request), request.headers.get("x-widget-token"))
    if not bot.get("voice_enabled"):
        raise HTTPException(status_code=409, detail="Voice agent is disabled for this bot")
    server_url, api_key, api_secret, default_agent_name = _livekit_settings()
    room_name = _safe_room_name(body.bot_id, body.session_id, body.room_nonce)
    identity = f"chatty-visitor-{uuid.uuid4().hex}"
    participant_name = (body.participant_name or "Visitor").strip()[:120]
    from livekit import api

    # One worker process currently registers one LiveKit dispatch name. Keep
    # the dashboard label descriptive, but never dispatch to an arbitrary
    # unregistered name saved on a bot.
    dispatch = api.RoomAgentDispatch(
        agent_name=default_agent_name,
        metadata=json.dumps(
            {
                "bot_id": body.bot_id,
                "session_id": body.session_id,
                "visitor_timezone": (body.visitor_timezone or "").strip(),
            }
        ),
    )
    token = (
        api.AccessToken(api_key, api_secret)
        .with_identity(identity)
        .with_name(participant_name)
        .with_ttl(timedelta(minutes=15))
        .with_grants(api.VideoGrants(
            room_join=True, room=room_name, can_publish=True,
            can_publish_data=True, can_subscribe=True,
        ))
        .with_room_config(api.RoomConfiguration(agents=[dispatch]))
        .to_jwt()
    )
    return {
        "serverUrl": server_url,
        "participantToken": token,
        "roomName": room_name,
        "participantName": participant_name,
    }
