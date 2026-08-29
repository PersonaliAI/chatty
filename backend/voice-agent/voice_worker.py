"""Minimal LiveKit voice worker for Chatty's widget voice mode (Phase B/C).

STT/TTS provider is chosen per-bot (Phase C) from `voice_stt_provider` /
`voice_tts_provider` on `chatty_bots`, with BYOK key decryption for non-Google
providers (falling back to a server-side shared key, then to Google, if no
key is configured). The actual "brain" (Gemini tool-calling loop, knowledge
retrieval, lead capture, etc.) is fully delegated to
`plugins.widget_brain.run_widget_assistant`, the exact same function the
text-chat widget endpoints use — this worker's job is purely to bridge
LiveKit's voice pipeline (audio in -> STT -> our brain -> TTS -> audio out)
to that existing function.

This module is intentionally import-safe: importing it must never open a
LiveKit connection or otherwise touch the network. All of that only happens
once the worker actually runs (`python voice_worker.py start`, etc.) via
`cli.run_app` at the bottom of this file.

Run with e.g.:
    python voice_worker.py dev      # local dev, connects to LIVEKIT_URL
    python voice_worker.py start    # production worker process
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
from pathlib import Path
import sys
from typing import Any, AsyncIterable, Optional

# Ensure project root is in sys.path so app and plugins are always importable
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from livekit import api
from livekit.agents import (
    Agent,
    AgentServer,
    AgentSession,
    AutoSubscribe,
    JobContext,
    JobProcess,
    ModelSettings,
    cli,
    inference,
    llm,
    room_io,
)
from livekit.plugins import (
    assemblyai,
    cartesia,
    deepgram,
    elevenlabs,
    fishaudio,
    google,
    openai,
    silero,
    soniox,
)

from app.core.clients import supabase
from app.core.config import (
    ASSEMBLYAI_API_KEY,
    CARTESIA_API_KEY,
    DEEPGRAM_API_KEY,
    ELEVENLABS_API_KEY,
    FISH_API_KEY,
    LIVEKIT_API_KEY,
    LIVEKIT_API_SECRET,
    LIVEKIT_URL,
    OPENAI_API_KEY,
    SONIOX_API_KEY,
)
from plugins import widget_brain
from plugins import llm_providers

logger = logging.getLogger("chatty.voice_worker")


class _NullLLM(llm.LLM):
    """Placeholder LLM to satisfy Agent/AgentSession plumbing.

    `llm.LLM` (installed livekit-agents==1.6.10) has exactly one abstract
    method: `chat(...) -> LLMStream` (a *sync* method that returns a stream
    object, not a coroutine — verified via `inspect.getsource(llm.LLM.chat)`).
    ChattyVoiceAgent overrides `llm_node` completely, so this class's `chat`
    is never actually invoked; it exists only so `Agent(llm=_NullLLM())` type
    checks and constructs cleanly.
    """

    def chat(
        self,
        *,
        chat_ctx: llm.ChatContext,
        tools: Optional[list] = None,
        conn_options=None,
        parallel_tool_calls=None,
        tool_choice=None,
        extra_kwargs=None,
    ):
        raise NotImplementedError("_NullLLM.chat should never be called — llm_node is fully overridden")


def _latest_user_text(chat_ctx: llm.ChatContext) -> str:
    """Pull the most recent user message's text out of a ChatContext.

    Verified against the installed SDK: `ChatContext.items` is a list of
    `ChatMessage` (role/text_content) plus possibly function-call items;
    `ChatMessage.text_content` concatenates its text content parts.
    """
    for item in reversed(chat_ctx.items):
        if getattr(item, "type", None) == "message" and getattr(item, "role", None) == "user":
            return (item.text_content or "").strip()
    return ""


class ChattyVoiceAgent(Agent):
    def __init__(
        self,
        *,
        bot: dict[str, Any],
        owner_user: dict[str, Any],
        bot_id: str,
        session_id: str,
        visitor_timezone: str,
        visitor_geo: Optional[dict[str, Any]] = None,
    ):
        super().__init__(instructions="", llm=_NullLLM())
        self._bot = bot
        self._owner_user = owner_user
        self._bot_id = bot_id
        self._session_id = session_id
        self._visitor_timezone = visitor_timezone
        self._visitor_geo = visitor_geo

    async def llm_node(
        self,
        chat_ctx: llm.ChatContext,
        tools: list,
        model_settings: ModelSettings,
    ) -> AsyncIterable[str]:
        user_text = _latest_user_text(chat_ctx)

        # Persist the visitor turn up front, same shape as widget.py's inserts.
        try:
            supabase.table("chatty_conversations").insert({
                "bot_id": self._bot_id, "session_id": self._session_id,
                "role": "user", "content": user_text,
            }).execute()
        except Exception:
            logger.exception("voice worker: failed to save user conversation message")

        queue: asyncio.Queue = asyncio.Queue()
        _SENTINEL = object()

        # widget_brain._gemini_stream does `await on_token(part.text)` — on_token
        # MUST be an async callable (a fire-and-forget sync lambda would crash
        # with "object is not awaitable"). asyncio.Queue.put_nowait itself is
        # sync/non-blocking, so this async wrapper just awaits nothing extra.
        async def _on_token(tok: str) -> None:
            queue.put_nowait(tok)

        task = asyncio.create_task(widget_brain.run_widget_assistant(
            bot_id=self._bot_id,
            owner_user=self._owner_user,
            bot=self._bot,
            session_id=self._session_id,
            text=user_text,
            visitor_timezone=self._visitor_timezone,
            visitor_geo=self._visitor_geo,
            voice_mode=True,
            on_token=_on_token,
        ))
        task.add_done_callback(lambda t: queue.put_nowait(_SENTINEL))

        while True:
            item = await queue.get()
            if item is _SENTINEL:
                break
            yield item

        result = task.result()  # propagates any exception raised by the task

        try:
            supabase.table("chatty_conversations").insert({
                "bot_id": self._bot_id, "session_id": self._session_id,
                "role": "assistant", "content": result["reply"],
            }).execute()
        except Exception:
            logger.exception("voice worker: failed to save assistant conversation message")


def _decrypt_byok(enc: Optional[str]) -> Optional[str]:
    if not enc:
        return None
    try:
        return llm_providers.decrypt_api_key(enc)
    except Exception:
        logger.exception("voice worker: failed to decrypt BYOK key — falling back")
        return None


def _build_stt(bot: dict[str, Any]):
    """Construct the STT plugin for a bot's `voice_stt_provider`.

    Falls back to a server-side shared key (app.core.config) when the bot has
    no BYOK key of its own, and falls back to Google entirely for unknown
    providers. Azure was dropped from the option set — azure.STT needs
    speech_key + speech_region, not a single api_key, which didn't fit the
    single-encrypted-key BYOK column; soniox.STT() takes a clean single
    api_key (verified via source, not import — see _build_tts's fishaudio
    note for why) and is a well-regarded realtime STT provider, so it
    replaced azure as the 5th option.
    """
    provider = (bot.get("voice_stt_provider") or "google").strip().lower()
    if provider == "google":
        return google.STT(languages="en-US", model="latest_long")

    key = _decrypt_byok(bot.get("voice_stt_byok_key_encrypted"))

    if provider == "deepgram":
        key = key or DEEPGRAM_API_KEY or None
        return deepgram.STT(api_key=key) if key else deepgram.STT()
    if provider == "assemblyai":
        key = key or ASSEMBLYAI_API_KEY or None
        return assemblyai.STT(api_key=key) if key else assemblyai.STT()
    if provider == "soniox":
        key = key or SONIOX_API_KEY or None
        if not key:
            logger.warning(
                "voice worker: soniox STT selected but no BYOK/SONIOX_API_KEY configured "
                "— falling back to google"
            )
            return google.STT(languages="en-US", model="latest_long")
        return soniox.STT(api_key=key)
    if provider == "openai":
        key = key or OPENAI_API_KEY or None
        return openai.STT(api_key=key) if key else openai.STT()

    logger.warning("voice worker: unknown voice_stt_provider %r — falling back to google", provider)
    return google.STT(languages="en-US", model="latest_long")


def _build_tts(bot: dict[str, Any]):
    """Construct the TTS plugin for a bot's `voice_tts_provider`.

    Same server-side-shared-key / google-fallback behavior as `_build_stt`.
    """
    provider = (bot.get("voice_tts_provider") or "google").strip().lower()
    voice = bot.get("voice_tts_voice") or None

    if provider == "google":
        return google.TTS(language="en-US", voice_name=voice) if voice else google.TTS(language="en-US")

    key = _decrypt_byok(bot.get("voice_tts_byok_key_encrypted"))

    if provider == "cartesia":
        key = key or CARTESIA_API_KEY or None
        kwargs: dict[str, Any] = {"api_key": key} if key else {}
        if voice:
            kwargs["voice"] = voice
        return cartesia.TTS(**kwargs)
    if provider == "elevenlabs":
        key = key or ELEVENLABS_API_KEY or None
        kwargs = {"api_key": key} if key else {}
        if voice:
            kwargs["voice_id"] = voice
        return elevenlabs.TTS(**kwargs)
    if provider == "openai":
        key = key or OPENAI_API_KEY or None
        kwargs = {"api_key": key} if key else {}
        if voice:
            kwargs["voice"] = voice
        return openai.TTS(**kwargs)
    if provider == "fishaudio":
        # fishaudio.TTS takes a clean single `api_key` (raises ValueError if
        # neither the kwarg nor FISH_API_KEY env is set — unlike deepgram/
        # openai/elevenlabs it does NOT silently no-op, so unlike those we
        # must not call it with an empty kwargs dict) plus `voice_id` for the
        # reference voice — verified via source read (livekit/plugins/
        # fishaudio/tts.py), not import: importing any livekit.plugins.*
        # module pulls in the full livekit.agents package init chain, and
        # this environment hit a transient low-memory DLL failure loading
        # its native turn-detection inference binary at the time; the
        # plugin's actual TTS class is unrelated to that binary, so reading
        # the source was sufficient to confirm the real constructor.
        key = key or FISH_API_KEY or None
        if not key:
            logger.warning(
                "voice worker: fishaudio TTS selected but no BYOK/FISH_API_KEY configured "
                "— falling back to google"
            )
            return google.TTS(language="en-US")
        kwargs: dict[str, Any] = {"api_key": key}
        if voice:
            kwargs["voice_id"] = voice
        return fishaudio.TTS(**kwargs)

    logger.warning("voice worker: unknown voice_tts_provider %r — falling back to google", provider)
    return google.TTS(language="en-US")


# AgentServer's built-in HTTP port (health/monitoring endpoint, distinct from
# the outbound WebSocket connection it makes to LIVEKIT_URL for job dispatch).
# On Docker Compose / VPS, defaults to 8081.
# num_idle_processes defaults to 3 on VPS (4 vCPU / 8GB RAM has plenty of headroom
# for 3 warm worker processes).
server = AgentServer(
    port=int(os.environ.get("PORT", 8081)),
    num_idle_processes=int(os.environ.get("LIVEKIT_NUM_IDLE_PROCESSES", "3")),
    log_level=os.environ.get("LIVEKIT_LOG_LEVEL", "INFO"),
)


def prewarm_fnc(proc: JobProcess) -> None:
    # Loaded once per worker process and reused across jobs — model loads are
    # the expensive part, so this must not happen per-call.
    # min_silence_duration close to Silero's own default: how long the
    # visitor must go quiet before VAD reports speech-end. The previous 0.35s
    # (tuned down for snappier turn-taking) was cutting visitor speech short
    # on real mobile mics — brief silence blips from network jitter/handling
    # noise read as "done talking". inference.TurnDetector (semantic, not
    # just silence-based) remains the primary turn-taking signal below, so
    # this only needs to be conservative enough not to mis-trigger.
    proc.userdata["vad"] = silero.VAD.load(min_silence_duration=0.5)


@server.rtc_session(agent_name="chatty-voice")
async def entrypoint(ctx: JobContext) -> None:
    raw_metadata = ctx.job.metadata or "{}"
    try:
        meta = json.loads(raw_metadata)
    except Exception:
        logger.warning("voice worker: could not parse job metadata %r", raw_metadata)
        meta = {}

    bot_id = meta.get("bot_id")
    session_id = meta.get("session_id")
    visitor_timezone = meta.get("visitor_timezone") or "UTC"

    if not bot_id or not session_id:
        logger.warning("voice worker: job missing bot_id/session_id in metadata (%r) — not connecting", meta)
        return

    bot_res = supabase.table("chatty_bots").select("*").eq("id", bot_id).single().execute()
    bot = bot_res.data
    if not bot or not bot.get("voice_enabled"):
        logger.warning("voice worker: bot %s missing or voice_enabled=false — not connecting", bot_id)
        return

    # Same owner-lookup pattern as app/routers/widget.py's widget_chat handler.
    owner_id = bot["user_id"]
    owner_res = supabase.table("users").select("*").eq("auth_user_id", owner_id).execute()
    if not owner_res.data:
        logger.warning("voice worker: bot owner not found for bot %s — not connecting", bot_id)
        return
    owner_user = owner_res.data[0]

    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)

    vad = ctx.proc.userdata.get("vad")

    session = AgentSession(
        stt=_build_stt(bot),
        tts=_build_tts(bot),
        vad=vad,
        # Semantic turn detection (LiveKit's hosted inference — no local
        # model to load, keeps this worker's cold-start light) rather than
        # relying on VAD silence-timeout alone: distinguishes "visitor
        # paused mid-thought" from "visitor is actually done talking", so
        # the agent replies as soon as it's really the agent's turn instead
        # of waiting out a fixed silence window every time.
        turn_detection=inference.TurnDetector(),
    )

    # Targeted diagnostics (INFO level, so these survive without the earlier
    # DEBUG-dump noise): confirms exactly where a real call's audio pipeline
    # is versus isn't producing signal — was previously impossible to tell
    # apart "visitor never spoke" from "VAD/STT saw speech but no transcript
    # resulted" from "agent speech got falsely interrupted and auto-resumed".
    session.on(
        "user_state_changed",
        lambda ev: logger.info("voice worker: user_state %s -> %s", ev.old_state, ev.new_state),
    )
    session.on(
        "user_input_transcribed",
        lambda ev: logger.info(
            "voice worker: transcript (final=%s) %r", ev.is_final, ev.transcript[:120]
        ),
    )
    session.on(
        "user_transcription_timeout",
        lambda ev: logger.warning("voice worker: user_transcription_timeout — speech detected, no transcript"),
    )
    session.on(
        "agent_false_interruption",
        lambda ev: logger.warning("voice worker: agent_false_interruption — resuming agent speech"),
    )

    agent = ChattyVoiceAgent(
        bot=bot,
        owner_user=owner_user,
        bot_id=bot_id,
        session_id=session_id,
        visitor_timezone=visitor_timezone,
    )

    await session.start(
        agent=agent,
        room=ctx.room,
        # sync_transcription=True (the default) paces the transcription
        # stream to match TTS audio playback — real-time-feeling speech, but
        # "chunky" as chat text (whole sentences appear only once spoken).
        # False publishes each text chunk to the room as soon as the LLM
        # actually produces it, decoupled from how fast TTS is speaking it —
        # what the widget's transcript view actually wants: fast, ChatGPT-
        # style token streaming, not audio-paced reveal.
        room_output_options=room_io.RoomOutputOptions(sync_transcription=False),
    )

    # Greet with the bot's own configured welcome message (same field text
    # chat already shows via GET /api/widget/theme) rather than a generic
    # line, so voice matches the bot's actual branding/tone. session.say
    # (not generate_reply) since there's no user turn yet — this doesn't
    # route through llm_node/run_widget_assistant at all.
    greeting = (bot.get("welcome_message") or "").strip() or "Hi! How can I help you today?"
    await session.say(greeting)

    # Cost/abuse circuit-breaker: no per-minute quota exists yet (a known,
    # explicitly-accepted gap — usage is tracked, not gated), but an
    # abandoned open call (visitor closes the tab without hanging up) must
    # not run/bill indefinitely. Runs as a background task (not awaited
    # inline) so it doesn't hold up normal job completion/cleanup when the
    # call ends naturally well before the limit — ctx.shutdown() cancels
    # this along with everything else once the job is done either way.
    max_minutes = bot.get("voice_max_duration_minutes") or 15

    async def _enforce_max_duration() -> None:
        try:
            await asyncio.sleep(max_minutes * 60)
            logger.info("voice worker: call for bot %s hit the %d-minute limit — ending", bot_id, max_minutes)
            await session.say(
                "We're at the time limit for this call — thanks for chatting! "
                "Feel free to reach out again anytime."
            )
            ctx.shutdown(reason="voice_max_duration_minutes reached")
        except asyncio.CancelledError:
            pass

    asyncio.create_task(_enforce_max_duration())


server.setup_fnc = prewarm_fnc


if __name__ == "__main__":
    cli.run_app(server)
