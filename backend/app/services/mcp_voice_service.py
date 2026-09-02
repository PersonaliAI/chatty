"""Voice-agent configuration + token minting for the Developer API / MCP
tools. Token minting reuses app/services/voice_service.py — the exact same
LiveKit dispatch logic the public widget endpoint (app/routers/voice.py)
uses — rather than a second, separate implementation.
"""

from __future__ import annotations

from typing import Any

from fastapi import HTTPException

from app.core import oauth as _oauth
from app.core.clients import supabase
from app.core.db import run_db
from app.schemas.bots_api import VoiceAgentConfigRequest
from app.services import voice_service


async def configure_voice_agent(principal: dict[str, Any], bot_id: str, body: VoiceAgentConfigRequest) -> dict[str, Any]:
    await _oauth.require_bot_access(principal, bot_id)

    if body.voice_mode is not None and body.voice_mode not in ("pipeline", "realtime"):
        raise HTTPException(status_code=400, detail="voice_mode must be 'pipeline' or 'realtime'")

    updates = {k: v for k, v in {
        "voice_enabled": body.enabled,
        "voice_mode": body.voice_mode,
        "voice_stt_provider": body.voice_stt_provider,
        "voice_tts_provider": body.voice_tts_provider,
        "voice_tts_voice": body.voice_tts_voice,
    }.items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    res = await run_db(lambda: supabase.table("chatty_bots").update(updates).eq("id", bot_id).execute())
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to update voice settings")
    row = res.data[0]
    return {
        "bot_id": bot_id,
        "voice_enabled": bool(row.get("voice_enabled")),
        "voice_mode": row.get("voice_mode") or "pipeline",
        "voice_stt_provider": row.get("voice_stt_provider"),
        "voice_tts_provider": row.get("voice_tts_provider"),
        "voice_tts_voice": row.get("voice_tts_voice"),
    }


async def mint_voice_token(principal: dict[str, Any], bot_id: str, visitor_timezone: str = "UTC") -> dict[str, Any]:
    """Mints a real LiveKit token via the shared voice_service — the
    original version of this function returned a fabricated
    "mock-livekit-jwt-<random>" string (with a normal success response)
    whenever LiveKit wasn't configured, which a caller has no way to
    distinguish from a real, working token until it fails to connect.
    voice_service.mint_voice_session raises a clear 500 in that case
    instead, matching what the public widget endpoint has always done."""
    bot = await _oauth.require_bot_access(principal, bot_id)
    if not bot.get("voice_enabled"):
        raise HTTPException(status_code=403, detail="Voice is not enabled for this bot")
    return await voice_service.mint_voice_session(
        bot_id=bot_id,
        visitor_timezone=visitor_timezone,
        identity_prefix="dev-api",
        display_name="Developer API session",
    )
