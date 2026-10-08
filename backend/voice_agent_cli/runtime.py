"""LiveKit server entrypoint for the local Chatty voice agent."""

from __future__ import annotations

import logging
import json

from livekit.agents import (
    AgentServer,
    AgentSession,
    JobContext,
    JobProcess,
    MetricsCollectedEvent,
    TurnHandlingOptions,
    cli,
    metrics,
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
from .session import open_voice_session
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
    from .bootstrap import load_chatty_modules

    load_chatty_modules(settings)
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
        str(dispatch_metadata.get("bot_id")) if dispatch_metadata.get("bot_id") else None
    )
    session_id = str(dispatch_metadata.get("session_id") or settings.session_id or f"voice-{ctx.room.name}")
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
            llm=build_realtime_model(organization, settings, expression_enabled=expression_enabled),
            preemptive_generation=True,
        )
    else:
        stt, llm, tts = build_components(organization, settings)
        session = AgentSession(
            stt=stt,
            llm=llm,
            tts=tts,
            conn_options=SessionConnectOptions(
                llm_conn_options=APIConnectOptions(timeout=settings.llm_timeout_seconds),
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

    @ctx.room.on("data_received")
    def _on_data_received(packet) -> None:
        if getattr(packet, "topic", None) == MEDIA_TOPIC:
            media_buffer.accept_packet(getattr(packet, "data", b""))

    session.on("conversation_item_added", recorder.handle)
    ctx.add_shutdown_callback(recorder.flush)

    @session.on("metrics_collected")
    def _on_metrics_collected(event: MetricsCollectedEvent) -> None:
        if event.metrics.type != "stt_metrics":
            metrics.log_metrics(event.metrics)

    async def _log_usage() -> None:
        logger.info("Voice session usage: %s", session.usage)

    ctx.add_shutdown_callback(_log_usage)
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
