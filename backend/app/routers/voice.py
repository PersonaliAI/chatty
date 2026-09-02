"""Voice-agent token-minting endpoint (/api/widget/voice/*).

Mints a short-lived LiveKit access token so the widget's voice UI can join a
LiveKit room where `voice_worker.py` (a separate long-running process, not
part of this FastAPI app) picks up the job and runs the actual STT/LLM/TTS
pipeline. This endpoint does no LiveKit connection itself — it only talks to
the LiveKit HTTP-free JWT signing helper in `livekit.api`.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException, Request

from app.core.clients import supabase
from app.core.db import run_db
from app.schemas.voice import VoiceTokenRequest, VoiceTokenResponse
from app.services import voice_service

# Bridged helpers still living in main.py — same pattern as app/routers/widget.py.
from main import _client_ip, _widget_rate_limit_or_429, chatty_quota_exceeded

logger = logging.getLogger("chatty")

router = APIRouter()


@router.post("/api/widget/voice/token", response_model=VoiceTokenResponse)
async def widget_voice_token(body: VoiceTokenRequest, request: Request):
    bot_id = body.bot_id

    # 1. Fetch bot (mirrors widget_chat's auth chain).
    res = await run_db(lambda: supabase.table("chatty_bots").select("*").eq("id", bot_id).execute())
    if not res.data:
        raise HTTPException(status_code=404, detail="Bot not found")
    bot = res.data[0]

    # 2. Rate limit per bot + IP.
    ip = _client_ip(request)
    await _widget_rate_limit_or_429(bot, bot_id, ip, request.headers.get("x-widget-token"))

    # 3. Resolve owner + quota gate.
    owner_id = bot["user_id"]
    res_user = await run_db(lambda: supabase.table("users").select("*").eq("auth_user_id", owner_id).execute())
    if not res_user.data:
        raise HTTPException(status_code=404, detail="Bot owner not found")
    owner_user = res_user.data[0]

    if await chatty_quota_exceeded(owner_user, owner_id):
        raise HTTPException(status_code=402, detail="Usage quota exceeded")

    # 4. Voice must be explicitly enabled for this bot.
    if not bot.get("voice_enabled"):
        raise HTTPException(status_code=403, detail="Voice is not enabled for this bot")

    result = await voice_service.mint_voice_session(
        bot_id=bot_id,
        session_id=body.session_id,
        visitor_timezone=body.visitor_timezone,
    )
    return VoiceTokenResponse(**result)
