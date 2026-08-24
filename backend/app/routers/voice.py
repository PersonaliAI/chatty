"""Voice-agent token-minting endpoint (/api/widget/voice/*).

Mints a short-lived LiveKit access token so the widget's voice UI can join a
LiveKit room where `voice_worker.py` (a separate long-running process, not
part of this FastAPI app) picks up the job and runs the actual STT/LLM/TTS
pipeline. This endpoint does no LiveKit connection itself — it only talks to
the LiveKit HTTP-free JWT signing helper in `livekit.api`.
"""

from __future__ import annotations

import json
import logging
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Request
from livekit import api

from app.core.clients import supabase
from app.core.config import LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_URL
from app.core.db import run_db
from app.schemas.voice import VoiceTokenRequest, VoiceTokenResponse

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

    if not (LIVEKIT_URL and LIVEKIT_API_KEY and LIVEKIT_API_SECRET):
        raise HTTPException(status_code=500, detail="Voice is not configured on this server")

    session_id = body.session_id or f"voice:{uuid4()}"
    room_name = f"chatty-voice-{bot_id}-{session_id}"
    visitor_identity = f"visitor-{uuid4().hex[:12]}"

    # Job metadata read back by voice_worker.py's entrypoint via ctx.job.metadata.
    job_metadata = json.dumps({
        "bot_id": bot_id,
        "session_id": session_id,
        "visitor_timezone": body.visitor_timezone or "UTC",
    })

    # Explicit dispatch — call agent_dispatch.create_dispatch() server-side
    # rather than relying solely on the token's embedded RoomConfiguration.
    # Both mechanisms exist in the API and the token-embedded one LOOKS
    # correct (room_config.agents does show up in the decoded JWT), but
    # empirically verified against the real LiveKit Cloud project: a client
    # connecting with only a room_config-carrying token never gets a worker
    # assigned (job sits at JS_PENDING indefinitely) — whereas an explicit
    # create_dispatch() call reliably gets picked up within a few seconds
    # every time. Keeping the token's room_config too (harmless, and some
    # LiveKit deployments may rely on it) but the explicit call below is
    # what actually makes the agent join.
    lkapi = api.LiveKitAPI(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
    try:
        await lkapi.agent_dispatch.create_dispatch(
            api.CreateAgentDispatchRequest(
                agent_name="chatty-voice", room=room_name, metadata=job_metadata,
            )
        )
    except Exception:
        logger.exception("voice token: explicit agent dispatch failed for room %s", room_name)
        raise HTTPException(status_code=502, detail="Could not start the voice agent — please try again")
    finally:
        await lkapi.aclose()

    room_config = api.RoomConfiguration(
        agents=[api.RoomAgentDispatch(agent_name="chatty-voice", metadata=job_metadata)],
    )

    token = (
        api.AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
        .with_identity(visitor_identity)
        .with_name("Visitor")
        .with_grants(api.VideoGrants(room_join=True, room=room_name))
        .with_room_config(room_config)
        .to_jwt()
    )

    return VoiceTokenResponse(
        token=token,
        livekit_url=LIVEKIT_URL,
        room_name=room_name,
        session_id=session_id,
    )
