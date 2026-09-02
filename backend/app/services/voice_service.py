"""Core LiveKit token-minting + agent-dispatch logic, shared by the public
widget voice endpoint (app/routers/voice.py) and the Developer API / MCP
voice tool (app/services/bots_service.py, app/routers/mcp.py) — one
implementation of "start a voice session", not two.

The explicit agent_dispatch.create_dispatch() call (rather than relying
solely on the token's embedded RoomConfiguration) is load-bearing — see the
comment on mint_voice_session below for why, preserved from the original
widget-only implementation.
"""

from __future__ import annotations

import json
import logging
from typing import Any
from uuid import uuid4

from fastapi import HTTPException
from livekit import api

from app.core.config import LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_URL

logger = logging.getLogger("chatty")


async def mint_voice_session(
    *,
    bot_id: str,
    session_id: str | None = None,
    visitor_timezone: str = "UTC",
    identity_prefix: str = "visitor",
    display_name: str = "Visitor",
) -> dict[str, Any]:
    if not (LIVEKIT_URL and LIVEKIT_API_KEY and LIVEKIT_API_SECRET):
        raise HTTPException(status_code=500, detail="Voice is not configured on this server")

    session_id = session_id or f"voice:{uuid4()}"
    room_name = f"chatty-voice-{bot_id}-{session_id}"
    identity = f"{identity_prefix}-{uuid4().hex[:12]}"

    # Job metadata read back by voice_worker.py's entrypoint via ctx.job.metadata.
    job_metadata = json.dumps({
        "bot_id": bot_id,
        "session_id": session_id,
        "visitor_timezone": visitor_timezone or "UTC",
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
        .with_identity(identity)
        .with_name(display_name)
        .with_grants(api.VideoGrants(room_join=True, room=room_name))
        .with_room_config(room_config)
        .to_jwt()
    )

    return {
        "token": token,
        "livekit_url": LIVEKIT_URL,
        "room_name": room_name,
        "session_id": session_id,
    }
