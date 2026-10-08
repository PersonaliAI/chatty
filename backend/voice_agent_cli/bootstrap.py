"""Process bootstrap helpers for importing the Chatty backend safely."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from .config import VoiceSettings


@dataclass(frozen=True, slots=True)
class ChattyModules:
    """Lazy imports used by the voice adapter."""

    supabase: Any
    run_db: Any
    agent_tools: Any
    doc_rag: Any
    widget_brain: Any


def load_chatty_core(settings: VoiceSettings) -> ChattyModules:
    """Load only Supabase access for fast account diagnostics."""
    prepare_environment(settings)
    from app.core.clients import supabase  # noqa: PLC0415
    from app.core.db import run_db  # noqa: PLC0415

    return ChattyModules(
        supabase=supabase,
        run_db=run_db,
        agent_tools=None,
        doc_rag=None,
        widget_brain=None,
    )


def prepare_environment(settings: VoiceSettings) -> None:
    """Apply local env values before importing Chatty's settings-dependent code."""
    settings.apply_provider_environment()


def warm_voice_dependencies() -> None:
    """Warm one-time provider and transcript dependencies in the job process.

    Google STT lazily imports gRPC credential helpers and builds protobuf
    schemas on the first stream. LiveKit's transcript synchronizer also
    lazily constructs its word hyphenator. Doing that work during the first
    room makes the audio loop report a several-hundred-millisecond stall.
    These imports are intentionally best-effort: a worker configured for a
    different provider must still be able to start and report its own
    provider error at session construction time.
    """
    try:
        import grpc._plugin_wrapping  # noqa: F401, PLC0415
    except Exception:
        pass

    try:
        from livekit.agents.tokenize import basic  # noqa: PLC0415

        basic.hyphenate_word("Chatty")
    except Exception:
        pass

    try:
        from google.cloud.speech_v2.types import cloud_speech  # noqa: PLC0415

        cloud_speech.RecognitionFeatures()
    except Exception:
        pass


def load_chatty_modules(settings: VoiceSettings) -> ChattyModules:
    """Import Chatty modules after environment setup has completed."""
    core = load_chatty_core(settings)
    from plugins import agent_tools, doc_rag, widget_brain  # noqa: PLC0415

    return ChattyModules(
        supabase=core.supabase,
        run_db=core.run_db,
        agent_tools=agent_tools,
        doc_rag=doc_rag,
        widget_brain=widget_brain,
    )
