"""LiveKit server entrypoint for the local Chatty voice agent."""

from __future__ import annotations

import asyncio
import json
import logging
import time
from typing import Any

from livekit.agents import (
    AgentServer,
    AgentSession,
    JobContext,
    JobProcess,
    TurnHandlingOptions,
    cli,
    room_io,
)
from livekit.agents.types import APIConnectOptions
from livekit.agents.voice.agent_session import SessionConnectOptions
from .providers import build_components, build_realtime_model

from .agent import ChattyVoiceAgent
from .config import VoiceSettings
from .conversation import ConversationRecorder, load_chat_context
from .media import MEDIA_TOPIC, VoiceMediaBuffer
from .organization import OrganizationRepository
from .session import open_voice_session, record_voice_call
from .timezone import resolve_visitor_timezone

logger = logging.getLogger("chatty.voice.runtime")
settings = VoiceSettings.from_env()
settings.apply_provider_environment()


def _setup_job_process(proc: JobProcess) -> None:
    """Warm Chatty's synchronous imports before the process accepts a job.

    The LiveKit Agents server invokes ``setup_fnc`` during worker-process
    initialization.  Chatty's Supabase clients and plugin modules are
    synchronous imports, so loading them here keeps the first assigned room
    from blocking the audio/event loop for several seconds.
    """
    from .bootstrap import load_chatty_modules, warm_voice_dependencies

    load_chatty_modules(settings)
    warm_voice_dependencies()
    proc.userdata["chatty_modules_warmed"] = True
    logger.debug(
        "Chatty voice modules warmed in LiveKit job process",
        extra={"pid": proc.pid},
    )


server = AgentServer(
    setup_fnc=_setup_job_process,
    # Chatty's Supabase/plugin warm-up happens before a process accepts a
    # room. Allow that one-time import cost without reporting a false startup
    # timeout or registering before the idle pool is ready.
    initialize_process_timeout=60,
)


async def _build_pipeline_components(
    organization: Any, settings: VoiceSettings
) -> tuple[Any, Any, Any]:
    """Construct provider clients away from the LiveKit audio event loop."""
    return await asyncio.to_thread(build_components, organization, settings)


async def _build_realtime_component(
    organization: Any, settings: VoiceSettings, *, expression_enabled: bool
) -> Any:
    """Construct a realtime provider away from the LiveKit audio event loop."""
    return await asyncio.to_thread(
        build_realtime_model,
        organization,
        settings,
        expression_enabled=expression_enabled,
    )


def _resolve_max_duration_minutes(value: object) -> int:
    """Return the persisted voice-session limit with a safe runtime fallback."""
    try:
        duration = int(value) if value is not None else 15
    except (TypeError, ValueError):
        duration = 15
    return max(1, min(duration, 60))


async def _close_session_after_timeout(
    session: Any, room: Any, max_duration_minutes: int
) -> None:
    """Close the LiveKit session and room when the tenant limit is reached."""
    try:
        await asyncio.sleep(max_duration_minutes * 60)
    except asyncio.CancelledError:
        raise

    logger.info(
        "Voice session reached configured maximum duration; closing room",
        extra={"max_duration_minutes": max_duration_minutes},
    )
    try:
        await session.aclose()
    finally:
        await room.disconnect()


@server.rtc_session(agent_name=settings.agent_name)
async def entrypoint(ctx: JobContext) -> None:
    """Start one tenant-scoped LiveKit voice session."""
    dispatch_metadata: dict[str, object] = {}
    try:
        raw_metadata = str(getattr(ctx.job, "metadata", "") or "")
        parsed = json.loads(raw_metadata) if raw_metadata else {}
        if isinstance(parsed, dict):
            dispatch_metadata = parsed
    except (TypeError, ValueError, json.JSONDecodeError):
        logger.warning("Ignoring malformed LiveKit dispatch metadata")
    organization = await OrganizationRepository(settings).resolve(
        str(dispatch_metadata.get("bot_id"))
        if dispatch_metadata.get("bot_id")
        else None
    )
    session_id = str(
        dispatch_metadata.get("session_id")
        or settings.session_id
        or f"voice-{ctx.room.name}"
    )
    visitor_timezone = resolve_visitor_timezone(
        dispatch_metadata.get("visitor_timezone"), settings.visitor_timezone
    )
    await open_voice_session(organization, session_id)
    chat_ctx = await load_chat_context(organization, session_id)
    ctx.log_context_fields = {
        "room": ctx.room.name,
        "organization_email": settings.organization_email,
        "bot_id": str(organization.bot.get("id", "")),
        "session_id": session_id,
    }

    bot_config = organization.bot
    mode = str(bot_config.get("voice_mode") or "pipeline").lower()
    expression_enabled = bool(bot_config.get("voice_expression_enabled", True))
    if mode == "realtime":
        session = AgentSession(
            llm=await _build_realtime_component(
                organization,
                settings,
                expression_enabled=expression_enabled,
            ),
            preemptive_generation=True,
        )
    else:
        stt, llm, tts = await _build_pipeline_components(organization, settings)
        session = AgentSession(
            stt=stt,
            llm=llm,
            tts=tts,
            conn_options=SessionConnectOptions(
                llm_conn_options=APIConnectOptions(
                    timeout=settings.llm_timeout_seconds
                ),
            ),
            expressive=expression_enabled,
            turn_handling=TurnHandlingOptions(
                interruption={
                    "resume_false_interruption": True,
                    "false_interruption_timeout": 1.0,
                },
                preemptive_generation={"enabled": True, "max_retries": 2},
            ),
            aec_warmup_duration=3.0,
            tts_text_transforms=["filter_emoji", "filter_markdown"],
        )
    recorder = ConversationRecorder(organization, session_id)
    media_buffer = VoiceMediaBuffer()
    max_duration_minutes = _resolve_max_duration_minutes(
        bot_config.get("voice_max_duration_minutes")
    )
    call_started_at = time.monotonic()
    timeout_task: asyncio.Task[None] | None = None
    telemetry_recorded = False

    async def _cancel_session_timeout(_reason: str) -> None:
        nonlocal timeout_task
        if (
            timeout_task is None
            or timeout_task.done()
            or timeout_task is asyncio.current_task()
        ):
            return
        timeout_task.cancel()
        await asyncio.gather(timeout_task, return_exceptions=True)

    async def _record_voice_call() -> None:
        nonlocal telemetry_recorded
        if telemetry_recorded:
            return
        telemetry_recorded = True
        usage = None
        try:
            usage = session.usage
        except Exception:
            logger.exception("Could not read LiveKit session usage")
        await record_voice_call(
            organization,
            session_id,
            mode=mode,
            duration_seconds=time.monotonic() - call_started_at,
            usage=usage,
            turn_count=getattr(recorder, "user_turn_count", 0),
        )
        logger.info("Voice session usage: %s", usage)

    ctx.add_shutdown_callback(_cancel_session_timeout)
    timeout_task = asyncio.create_task(
        _close_session_after_timeout(session, ctx.room, max_duration_minutes),
        name="chatty_voice_session_timeout",
    )

    @ctx.room.on("data_received")
    def _on_data_received(packet) -> None:
        if getattr(packet, "topic", None) == MEDIA_TOPIC:
            media_buffer.accept_packet(getattr(packet, "data", b""))

    session.on("conversation_item_added", recorder.handle)
    ctx.add_shutdown_callback(recorder.flush)
    ctx.add_shutdown_callback(_record_voice_call)
    await session.start(
        agent=ChattyVoiceAgent(
            organization,
            settings,
            session_id,
            chat_ctx,
            media_buffer=media_buffer,
            visitor_timezone=visitor_timezone,
        ),
        room=ctx.room,
        room_options=room_io.RoomOptions(video_input=settings.enable_video_input),
    )


def run_livekit_cli(argv: list[str] | None = None) -> None:
    """Run the official LiveKit Agents CLI for console, dev, or start."""
    cli.run_app(server)
