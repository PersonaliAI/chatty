"""Minimal LiveKit voice worker for Chatty's widget voice mode (Phase B/C).

STT/TTS provider is chosen per-bot (Phase C) from `voice_stt_provider` /
`voice_tts_provider` on `chatty_bots`, with BYOK key decryption for non-Google
providers (falling back to a server-side shared key, then to Google, if no
key is configured). The actual "brain" (Gemini tool-calling loop, knowledge
retrieval, lead capture, etc.) is fully delegated to
`plugins.widget_brain.run_widget_assistant`, the exact same function the
text-chat widget endpoints use - this worker's job is purely to bridge
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
import re
import time
try:
    import resource
except ImportError:  # pragma: no cover - Windows development hosts
    resource = None
from pathlib import Path
import sys
from typing import Any, AsyncIterable, Optional

# Ensure project root is in sys.path so app and plugins are always importable
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

import litellm
from litellm.types.utils import Usage as LitellmUsage

from livekit import api
from livekit.agents import (
    Agent,
    AgentServer,
    AgentSession,
    AutoSubscribe,
    JobContext,
    JobProcess,
    ModelSettings,
    RunContext,
    cli,
    function_tool,
    inference,
    llm,
    metrics,
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
    GEMINI_API_KEY,
    LIVEKIT_API_KEY,
    LIVEKIT_API_SECRET,
    LIVEKIT_URL,
    OPENAI_API_KEY,
    SONIOX_API_KEY,
)
from plugins import agent_tools
from plugins import widget_brain
from plugins import llm_providers
from app.services import multimodal_service

logger = logging.getLogger("chatty.voice_worker")


def _process_rss_mb() -> Optional[float]:
    """Return this worker process' peak resident memory in MiB when available."""
    if resource is None:
        return None
    try:
        # Linux reports ru_maxrss in KiB; macOS reports bytes.
        raw = float(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss)
        return round(raw / (1024 * 1024 if raw > 1024 * 1024 * 4 else 1024), 2)
    except Exception:
        return None


def _extract_rich_media(reply: str) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    products: list[dict[str, Any]] = []
    clips: list[dict[str, Any]] = []
    for marker, target in (("PRODUCT_CARD", products), ("VIDEO_CLIP", clips)):
        for match in re.finditer(rf"\[{marker}:(\{{.*?\}})\]", reply or ""):
            try:
                value = json.loads(match.group(1))
                if isinstance(value, dict):
                    target.append(value)
            except (TypeError, ValueError, json.JSONDecodeError):
                continue
    return products, clips


class _NullLLM(llm.LLM):
    """Placeholder LLM to satisfy Agent/AgentSession plumbing.

    `llm.LLM` (installed livekit-agents==1.6.10) has exactly one abstract
    method: `chat(...) -> LLMStream` (a *sync* method that returns a stream
    object, not a coroutine - verified via `inspect.getsource(llm.LLM.chat)`).
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
        raise NotImplementedError("_NullLLM.chat should never be called - llm_node is fully overridden")


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
        room: Optional[Any] = None,
    ):
        super().__init__(instructions="", llm=_NullLLM())
        self._bot = bot
        self._owner_user = owner_user
        self._bot_id = bot_id
        self._session_id = session_id
        self._visitor_timezone = visitor_timezone
        self._visitor_geo = visitor_geo
        self._room = room

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
                "role": "user", "sender": "voice", "content": user_text,
            }).execute()
        except Exception:
            logger.exception("voice worker: failed to save user conversation message")

        queue: asyncio.Queue = asyncio.Queue()
        _SENTINEL = object()

        # widget_brain._gemini_stream does `await on_token(part.text)` - on_token
        # MUST be an async callable (a fire-and-forget sync lambda would crash
        # with "object is not awaitable"). asyncio.Queue.put_nowait itself is
        # sync/non-blocking, so this async wrapper just awaits nothing extra.
        async def _on_token(tok: str) -> None:
            # Strip UI-only markers so the TTS engine never reads JSON aloud.
            clean_tok = tok.replace("[BOOKING_WIDGET]", "")
            clean_tok = re.sub(r"\[(?:PRODUCT_CARD|VIDEO_CLIP):\{.*?\}\]", "", clean_tok)
            if clean_tok:
                queue.put_nowait(clean_tok)

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

        # If the assistant turn triggered booking, publish a reliable data packet to the room
        # so the client's VoiceCallWidget displays the interactive calendar immediately.
        reply = result.get("reply") or ""
        if "[BOOKING_WIDGET]" in reply and self._room and getattr(self._room, "local_participant", None):
            try:
                await self._room.local_participant.publish_data(
                    json.dumps({"type": "booking_widget", "action": "open"}).encode("utf-8"),
                    reliable=True,
                )
            except Exception:
                logger.exception("voice worker: failed to publish booking_widget data packet")

        if self._room and getattr(self._room, "local_participant", None):
            products, clips = _extract_rich_media(reply)
            for product in products:
                try:
                    await self._room.local_participant.publish_data(
                        json.dumps({"type": "product_card", "product": product}, default=str).encode("utf-8"),
                        reliable=True,
                    )
                except Exception:
                    logger.exception("voice worker: failed to publish pipeline product card")
            for clip in clips:
                try:
                    await self._room.local_participant.publish_data(
                        json.dumps({"type": "video_clip", "clip": clip}, default=str).encode("utf-8"),
                        reliable=True,
                    )
                except Exception:
                    logger.exception("voice worker: failed to publish pipeline video clip")

        try:
            supabase.table("chatty_conversations").insert({
                "bot_id": self._bot_id, "session_id": self._session_id,
                "role": "assistant", "sender": "voice", "content": reply,
            }).execute()
        except Exception:
            logger.exception("voice worker: failed to save assistant conversation message")


def _decrypt_byok(enc: Optional[str]) -> Optional[str]:
    if not enc:
        return None
    try:
        return llm_providers.decrypt_api_key(enc)
    except Exception:
        logger.exception("voice worker: failed to decrypt BYOK key - falling back")
        return None


def _build_stt(bot: dict[str, Any]):
    """Construct the STT plugin for a bot's `voice_stt_provider`.

    Falls back to a server-side shared key (app.core.config) when the bot has
    no BYOK key of its own, and falls back to Google entirely for unknown
    providers. Azure was dropped from the option set - azure.STT needs
    speech_key + speech_region, not a single api_key, which didn't fit the
    single-encrypted-key BYOK column; soniox.STT() takes a clean single
    api_key (verified via source, not import - see _build_tts's fishaudio
    note for why) and is a well-regarded realtime STT provider, so it
    replaced azure as the 5th option.
    """
    provider = (bot.get("voice_stt_provider") or "google").strip().lower()
    if provider == "google":
        try:
            return google.STT(languages="en-US", model="latest_long")
        except ValueError as exc:
            # Google STT requires Application Default Credentials, which are
            # not present on a normal VPS. Keep Google as the preferred path,
            # but fail over to the configured server key instead of crashing
            # the entire LiveKit job before it can transcribe anything.
            if OPENAI_API_KEY:
                logger.warning("voice worker: Google STT credentials unavailable; falling back to OpenAI STT: %s", exc)
                return openai.STT(api_key=OPENAI_API_KEY)
            raise

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
                "- falling back to google"
            )
            return google.STT(languages="en-US", model="latest_long")
        return soniox.STT(api_key=key)
    if provider == "openai":
        key = key or OPENAI_API_KEY or None
        return openai.STT(api_key=key) if key else openai.STT()

    logger.warning("voice worker: unknown voice_stt_provider %r - falling back to google", provider)
    return google.STT(languages="en-US", model="latest_long")


def _build_tts(bot: dict[str, Any]):
    """Construct the TTS plugin for a bot's `voice_tts_provider`.

    Same server-side-shared-key / google-fallback behavior as `_build_stt`.
    """
    provider = (bot.get("voice_tts_provider") or "google").strip().lower()
    voice = bot.get("voice_tts_voice") or None

    if provider == "google":
        try:
            return google.TTS(language="en-US", voice_name=voice) if voice else google.TTS(language="en-US")
        except ValueError as exc:
            if OPENAI_API_KEY:
                # A Google voice id is not valid for OpenAI TTS, so let the
                # OpenAI plugin select its configured default voice.
                logger.warning("voice worker: Google TTS credentials unavailable; falling back to OpenAI TTS: %s", exc)
                return openai.TTS(api_key=OPENAI_API_KEY)
            raise

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
        # neither the kwarg nor FISH_API_KEY env is set - unlike deepgram/
        # openai/elevenlabs it does NOT silently no-op, so unlike those we
        # must not call it with an empty kwargs dict) plus `voice_id` for the
        # reference voice - verified via source read (livekit/plugins/
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
                "- falling back to google"
            )
            return google.TTS(language="en-US")
        kwargs: dict[str, Any] = {"api_key": key}
        if voice:
            kwargs["voice_id"] = voice
        return fishaudio.TTS(**kwargs)

    logger.warning("voice worker: unknown voice_tts_provider %r - falling back to google", provider)
    return google.TTS(language="en-US")


def _google_pipeline_credentials_available() -> bool:
    """Return whether Google Cloud ADC is explicitly mounted for the worker.

    Google STT/TTS use service-account ADC, while Gemini realtime uses the
    server's Gemini API key. A normal VPS has no metadata-server ADC, so the
    explicit file check lets the worker choose the realtime path without
    mutating the bot's saved settings or crashing a LiveKit job.
    """
    credentials_file = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS", "").strip()
    return bool(credentials_file and Path(credentials_file).is_file())


# Model ids confirmed against the installed livekit-plugins-google/openai
# versions and litellm's model_cost map (both need to recognize these exact
# strings - google.realtime.RealtimeModel/openai.realtime.RealtimeModel for
# the actual call, litellm.cost_per_token for _cost_of_realtime_usage below)
# - check both before assuming a newer model id works, these move fast.
REALTIME_DEFAULT_MODEL = {"google": "gemini-2.5-flash-native-audio-preview-12-2025", "openai": "gpt-realtime"}
REALTIME_DEFAULT_VOICE = {"google": "Puck", "openai": "marin"}
# The dashboard stores the selected Google TTS voice in `voice_tts_voice`.
# Google Chirp voice ids (for example `en-US-Chirp3-HD-Aoede`) are valid for
# Cloud TTS but are rejected by Gemini Live's native-audio model. Keep the
# shared setting backward-compatible while allowing only Gemini Live voices in
# realtime mode.
GOOGLE_REALTIME_VOICES = frozenset({
    "Puck", "Charon", "Kore", "Fenrir", "Aoede", "Leda", "Orus", "Zephyr",
    "Achird", "Gacrux", "Schedar", "Sulafat", "Vindemiatrix", "Sadachbia",
    "Sadaltager", "Laomedeia", "Callirrhoe", "Autonoe", "Enceladus", "Iapetus",
    "Umbriel", "Alnilam", "Rasalgethi", "Algenib",
})
# litellm.cost_per_token needs an explicit provider for "gemini-*" model ids
# (it can't infer one the way it can for "gpt-*") - openai's own model ids
# already resolve without this.
_LITELLM_PROVIDER_FOR_REALTIME = {"google": "gemini", "openai": "openai"}


def build_realtime(provider: str, model: Optional[str], voice: Optional[str], api_key: Optional[str]):
    """Speech-to-speech model (audio in, audio out) - used instead of
    _build_stt/_build_tts entirely when a bot's voice_mode is "realtime".
    Passed as AgentSession's implicit llm via ChattyRealtimeAgent's own
    super().__init__(llm=...) - LiveKit's Agent accepts a RealtimeModel
    exactly like a regular LLM. Mirrors kin-voice-worker/worker.py's
    build_realtime() (same two providers, same LiveKit plugin classes)."""
    model = model or REALTIME_DEFAULT_MODEL.get(provider, "")
    voice = voice or REALTIME_DEFAULT_VOICE.get(provider)
    if provider == "google" and voice not in GOOGLE_REALTIME_VOICES:
        if voice:
            logger.warning(
                "voice worker: %r is a Cloud TTS voice, not a Gemini Live voice; using %s",
                voice,
                REALTIME_DEFAULT_VOICE["google"],
            )
        voice = REALTIME_DEFAULT_VOICE["google"]
    if provider == "google":
        kwargs: dict[str, Any] = {"model": model}
        if api_key:
            kwargs["api_key"] = api_key
        if voice:
            kwargs["voice"] = voice
        return google.realtime.RealtimeModel(**kwargs)
    if provider == "openai":
        kwargs = {"model": model}
        if api_key:
            kwargs["api_key"] = api_key
        if voice:
            kwargs["voice"] = voice
        return openai.realtime.RealtimeModel(**kwargs)
    raise ValueError(f"Unsupported voice_realtime_provider: {provider}")


def _cost_of_realtime_usage(provider: str, model: str, agg: "_RealtimeUsageTotals") -> Optional[float]:
    """Cost in USD for a realtime-mode call's total token usage, via
    litellm's own pricing data (litellm.model_cost) rather than a
    hand-maintained rate table - the same mechanism plugins/ai_client.py
    uses for text-chat cost tracking (litellm.completion_cost), just called
    through cost_per_token directly since there's no single "completion
    response" object for a whole call's worth of realtime audio turns to
    hand it. Returns None (not 0) when litellm has no pricing entry for this
    model - a missing price should read as "unknown", not "free"."""
    try:
        usage = LitellmUsage(
            prompt_tokens=agg.input_tokens,
            completion_tokens=agg.output_tokens,
            prompt_tokens_details={"audio_tokens": agg.input_audio_tokens, "text_tokens": agg.input_text_tokens},
            completion_tokens_details={"audio_tokens": agg.output_audio_tokens, "text_tokens": agg.output_text_tokens},
        )
        prompt_cost, completion_cost = litellm.cost_per_token(
            model=model,
            usage_object=usage,
            call_type="_arealtime",
            custom_llm_provider=_LITELLM_PROVIDER_FOR_REALTIME.get(provider),
        )
        return round(prompt_cost + completion_cost, 6)
    except Exception:
        logger.warning("voice worker: could not price realtime usage for %s/%s", provider, model, exc_info=True)
        return None


class _RealtimeUsageTotals:
    """Accumulates realtime usage across a call.

    LiveKit now emits ``session_usage_updated`` with cumulative usage. Keep
    the older per-response ``add`` helper for compatibility with older worker
    images, but prefer replacing totals from the cumulative event so a retry
    or duplicate metric can never double-count billing.
    """
    def __init__(self) -> None:
        self.input_tokens = 0
        self.output_tokens = 0
        self.input_audio_tokens = 0
        self.output_audio_tokens = 0
        self.input_text_tokens = 0
        self.output_text_tokens = 0

    def add(self, m: "metrics.RealtimeModelMetrics") -> None:
        self.input_tokens += m.input_tokens
        self.output_tokens += m.output_tokens
        self.input_audio_tokens += m.input_token_details.audio_tokens
        self.output_audio_tokens += m.output_token_details.audio_tokens
        self.input_text_tokens += m.input_token_details.text_tokens
        self.output_text_tokens += m.output_token_details.text_tokens

    def replace_from_session_usage(self, event: Any) -> None:
        """Replace totals from a LiveKit ``SessionUsageUpdatedEvent``."""
        usage = getattr(event, "usage", None)
        summaries = getattr(usage, "model_usage", None) or []
        llm_summaries = [item for item in summaries if getattr(item, "type", None) == "llm_usage"]
        self.input_tokens = sum(int(getattr(item, "input_tokens", 0) or 0) for item in llm_summaries)
        self.output_tokens = sum(int(getattr(item, "output_tokens", 0) or 0) for item in llm_summaries)
        self.input_audio_tokens = sum(int(getattr(item, "input_audio_tokens", 0) or 0) for item in llm_summaries)
        self.output_audio_tokens = sum(int(getattr(item, "output_audio_tokens", 0) or 0) for item in llm_summaries)
        self.input_text_tokens = sum(int(getattr(item, "input_text_tokens", 0) or 0) for item in llm_summaries)
        self.output_text_tokens = sum(int(getattr(item, "output_text_tokens", 0) or 0) for item in llm_summaries)


def _log_voice_call(
    *, bot_id: str, session_id: str, mode: str, provider: Optional[str], model: Optional[str],
    duration_seconds: float, input_tokens: Optional[int] = None, output_tokens: Optional[int] = None,
    cost_usd: Optional[float] = None,
    peak_rss_mb: Optional[float] = None, cpu_seconds: Optional[float] = None,
    avg_cpu_percent: Optional[float] = None, first_response_latency_ms: Optional[int] = None,
    turn_count: Optional[int] = None, nudge_count: Optional[int] = None,
    error_count: Optional[int] = None,
) -> None:
    """Writes the per-call usage/cost row `chatty_voice_calls` didn't have
    before this - voice usage was previously tracked nowhere at all."""
    try:
        supabase.table("chatty_voice_calls").insert({
            "bot_id": bot_id, "session_id": session_id, "mode": mode,
            "provider": provider, "model": model,
            "duration_seconds": round(duration_seconds, 1),
            "input_tokens": input_tokens, "output_tokens": output_tokens,
            "cost_usd": cost_usd,
            "peak_rss_mb": peak_rss_mb, "cpu_seconds": cpu_seconds,
            "avg_cpu_percent": avg_cpu_percent,
            "first_response_latency_ms": first_response_latency_ms,
            "turn_count": turn_count, "nudge_count": nudge_count,
            "error_count": error_count,
        }).execute()
    except Exception:
        logger.exception("voice worker: failed to log voice call cost")


def _build_realtime_tools(
    bot: dict[str, Any],
    bot_id: str,
    owner_user: dict[str, Any],
    *,
    room: Optional[Any] = None,
    session_id: Optional[str] = None,
    visitor_timezone: str = "UTC",
) -> list:
    """Tools available to a realtime-mode (speech-to-speech) session - the
    same knowledge-base search and booking/lead-capture actions pipeline
    mode gets for free via widget_brain.run_widget_assistant's own RAG step
    and tool-calling loop. A realtime model has no discrete "build a
    prompt, run RAG, call the LLM" turn of our own to hook that into (it
    manages the whole turn itself over its own audio session), so both are
    exposed as ordinary function-calling tools instead - which Gemini
    Live/OpenAI Realtime support natively, same as any other LLM tool call."""
    tools: list = []
    # Realtime models can call get_available_slots more than once while they
    # are trying to understand a spoken date. Keep the interactive picker
    # idempotent for the call: one picker is enough, and it must not replace a
    # completed booking with a fresh availability card.
    booking_state = {"picker_published": False, "booked": False}
    published_media_ids: set[str] = set()
    try:
        tool_timeout_seconds = min(
            120.0,
            max(5.0, float(os.environ.get("VOICE_TOOL_TIMEOUT_SECONDS", "20"))),
        )
    except (TypeError, ValueError):
        tool_timeout_seconds = 20.0

    async def _publish_booking_packet(packet: dict[str, Any]) -> None:
        """Send booking state to the widget without making voice tools UI-aware.

        The browser already renders these packets into the same InlineBookingCard
        used by text chat. Keeping this at the LiveKit boundary means calendar
        tools stay reusable and realtime calls get the same booking UX.
        """
        if not room or not getattr(room, "local_participant", None):
            return
        try:
            await room.local_participant.publish_data(
                json.dumps(packet, default=str).encode("utf-8"),
                reliable=True,
            )
        except Exception:
            logger.exception("voice worker: failed to publish booking packet")

    async def _publish_catalog_packets(items: list[dict[str, Any]]) -> None:
        """Publish commerce cards so voice has the same rich UI as chat."""
        if not room or not getattr(room, "local_participant", None):
            return
        for item in items:
            item_id = str(item.get("id") or item.get("sku") or item.get("title") or "")
            if not item_id or item_id in published_media_ids:
                continue
            published_media_ids.add(item_id)
            metadata = item.get("metadata") or {}
            media_type = str(item.get("media_type") or "product").lower()
            if media_type in {"video", "video_frame", "clip"} and item.get("video_url"):
                packet = {"type": "video_clip", "clip": {
                    "title": item.get("title") or "Video",
                    "video_url": item.get("video_url"),
                    "timestamp": item.get("video_timestamp_start"),
                    "thumbnail_url": item.get("thumbnail_url") or item.get("media_url"),
                }}
            else:
                packet = {"type": "product_card", "product": {
                    "id": item.get("id"), "title": item.get("title") or "Product",
                    "price": item.get("price"), "currency": item.get("currency") or "USD",
                    "url": item.get("url") or item.get("media_url"),
                    "image_url": item.get("thumbnail_url") or item.get("media_url"),
                    "thumbnail_url": item.get("thumbnail_url"), "sku": item.get("sku"),
                    "in_stock": metadata.get("in_stock", True),
                }}
            try:
                await room.local_participant.publish_data(
                    json.dumps(packet, default=str).encode("utf-8"), reliable=True,
                )
            except Exception:
                logger.exception("voice worker: failed to publish catalog packet")

    @function_tool(
        name="search_knowledge_base",
        description=(
            "Search this business's knowledge base (website content, uploaded docs, FAQs) for "
            "information relevant to what the visitor is asking. Call this before answering any "
            "question about the business, its products/services, pricing, or policies - don't "
            "guess or rely on general knowledge for anything business-specific."
        ),
    )
    async def search_knowledge_base(query: str, context: RunContext) -> str:
        # A voice turn must never remain open indefinitely if an embedding or
        # provider request stalls. Keep the call responsive and let the model
        # continue with a safe fallback instead of holding an audio session.
        try:
            knowledge_context, _ = await asyncio.wait_for(
                widget_brain.search_knowledge(bot_id, owner_user, bot, query),
                timeout=tool_timeout_seconds,
            )
        except asyncio.TimeoutError:
            logger.warning("voice worker: knowledge search timed out after %.1fs", tool_timeout_seconds)
            knowledge_context = ""
        try:
            items, visual_attrs = await asyncio.wait_for(
                multimodal_service.search_multimodal_catalog(
                    bot_id=bot_id, query_text=query, top_k=5,
                ),
                timeout=tool_timeout_seconds,
            )
            if items or visual_attrs:
                await _publish_catalog_packets(items)
                knowledge_context = (knowledge_context + "\n\n" +
                    multimodal_service.format_multimodal_context_for_prompt(items, visual_attrs)).strip()
        except Exception:
            logger.exception("voice worker: multimodal catalog search failed")
        return knowledge_context.strip() or "No relevant information found in the knowledge base."

    tools.append(search_knowledge_base)

    # Same tool selection as text/pipeline mode (widget_brain.scheduling_tool_names)
    # - get_available_slots, Outlook/Teams support, and reschedule_meeting all
    # used to be missing here specifically because this list was hand-rolled
    # separately and had quietly drifted out of parity with the text path.
    allowed_tool_names = widget_brain.scheduling_tool_names(bot, owner_user)

    for tool_name in allowed_tool_names:
        schema = next((d["function"] for d in agent_tools.DECLARATIONS if d["function"]["name"] == tool_name), None)
        if not schema:
            continue

        async def _run(raw_arguments: dict[str, Any], context: RunContext, _name: str = tool_name) -> Any:
            tool_context = {
                "bot_id": bot_id,
                "bot": bot,
                "source": "widget",
                "session_id": session_id,
                "visitor_timezone": visitor_timezone,
            }
            tool_arguments = dict(raw_arguments or {})
            if _name == "create_lead":
                # The realtime tool schema exposes bot_id for model
                # compatibility, but the session is trusted server context and
                # must be attached here so spoken name/email capture updates
                # the same lead used by the booking confirmation flow.
                tool_arguments.setdefault("bot_id", bot_id)
                tool_arguments.setdefault("session_id", session_id)
            try:
                result = await asyncio.wait_for(
                    agent_tools.execute(
                        _name, tool_arguments, user=owner_user, supabase=supabase,
                        # "bot" is required here (not just bot_id) - agent_tools.execute's
                        # round-robin assignment/conflict-guard and get_available_slots/
                        # reschedule_meeting handlers all key off context["bot"]; without
                        # it those silently no-op back to "always book the owner's own
                        # calendar, no real conflict check", exactly the gap this fixes.
                        context=tool_context,
                    ),
                    timeout=tool_timeout_seconds,
                )
            except asyncio.TimeoutError:
                logger.warning("voice worker: tool %s timed out after %.1fs", _name, tool_timeout_seconds)
                return {"error": f"{_name} timed out; please try again."}

            if not isinstance(result, dict) or result.get("error"):
                return result

            if _name == "get_available_slots" and result.get("slots"):
                if not booking_state["picker_published"] and not booking_state["booked"]:
                    booking_state["picker_published"] = True
                    await _publish_booking_packet({"type": "booking_widget", "action": "open"})

            if _name in ("create_calendar_event", "create_outlook_event"):
                attendees = raw_arguments.get("attendees") or []
                if isinstance(attendees, str):
                    attendees = [attendees]
                summary = raw_arguments.get("summary") or raw_arguments.get("subject") or "Meeting"
                attendee_email = next((a for a in attendees if isinstance(a, str) and "@" in a), "")
                start_value = raw_arguments.get("start") or result.get("start") or ""
                try:
                    formatted_time = agent_tools._format_invitation_time(start_value, visitor_timezone) or start_value
                except Exception:
                    formatted_time = start_value or "Scheduled time"
                meeting_link = (
                    result.get("hangout_link")
                    or result.get("hangoutLink")
                    or result.get("online_meeting_url")
                    or result.get("web_link")
                    or result.get("html_link")
                    or result.get("htmlLink")
                )
                meeting = {
                    "id": result.get("meeting_id") or result.get("chatty_meeting_id") or result.get("id"),
                    "meeting_link": meeting_link or "",
                    "formatted_time": formatted_time,
                    "summary": summary,
                    "start_time": start_value,
                    "end_time": raw_arguments.get("end") or result.get("end") or "",
                    "attendee_name": summary.replace("Demo Meeting with ", "").strip(),
                    "attendee_email": attendee_email,
                    "assigned_to_email": result.get("assigned_to_email"),
                    "status": "scheduled",
                }
                booking_state["booked"] = True
                await _publish_booking_packet({"type": "meeting_confirmed", "meeting": meeting})
            return result

        tools.append(function_tool(_run, raw_schema=schema))

    return tools


class ChattyRealtimeAgent(Agent):
    """Speech-to-speech counterpart to ChattyVoiceAgent above - used instead
    of it when a bot's voice_mode is "realtime". Unlike ChattyVoiceAgent,
    this doesn't override llm_node at all: a RealtimeModel handles the
    entire turn (listening, thinking, speaking) itself, so there's no
    separate text-generation step to intercept the way there is for the
    STT->LLM->TTS pipeline."""
    def __init__(
        self,
        *,
        bot: dict[str, Any],
        owner_user: dict[str, Any],
        bot_id: str,
        realtime_llm,
        room: Optional[Any] = None,
        session_id: Optional[str] = None,
        visitor_timezone: str = "UTC",
    ) -> None:
        system_instructions = (bot.get("system_instructions") or "").strip()
        instructions = (
            (system_instructions + "\n\n" if system_instructions else "")
            + "You are having a live voice conversation with a website visitor. Keep replies "
            "conversational, warm, and concise - this is speech, not a chat window. Use brief "
            "natural acknowledgements, ask one clear follow-up question at a time, and if the "
            "visitor pauses, wait patiently rather than filling the silence. You can gently "
            "check in after a long silence. Use the "
            "search_knowledge_base tool for any question about this specific business rather "
            "than guessing. When a visitor wants to book, always use the availability and "
            "calendar tools; never invent a time, and collect the required name and email. "
            "When knowledge search returns products, images, or videos, describe them naturally "
            "and let the interface render rich cards; never read JSON or card markers aloud.\n\n"
            "BOOKING WORKFLOW (follow this exact state machine):\n"
            "1. When the visitor asks to book or gives a preferred date/time, call "
            "get_available_slots with near set to that spoken date/time. Offer only the "
            "returned slots. Never calculate or invent a slot.\n"
            "2. After the visitor chooses one returned slot, remember that exact slot's "
            "start and end values. Ask for their full name and email in the same turn. Do "
            "not call get_available_slots again just because they supplied their details.\n"
            "3. Once the visitor has supplied both a real name and a real email, call "
            "create_calendar_event (or create_outlook_event for Teams) immediately using "
            "the remembered start/end and the real email in attendees. Also call create_lead "
            "with the same bot and session context.\n"
            "4. Only say the meeting is scheduled after the calendar tool returns success. "
            "Read the returned meeting link and time back to the visitor. Do not append a "
            "booking widget marker or request another slot after successful booking.\n"
            "5. If a booking tool returns an error asking for missing information, ask only "
            "for that missing field; do not reopen the availability picker."
        )
        super().__init__(
            instructions=instructions,
            llm=realtime_llm,
            tools=_build_realtime_tools(
                bot,
                bot_id,
                owner_user,
                room=room,
                session_id=session_id,
                visitor_timezone=visitor_timezone,
            ),
        )
        self._greeting = (bot.get("welcome_message") or "").strip() or (
            "Hi, I'm Chatty. I'm here and ready to help. What would you like to do today?"
        )

    async def on_enter(self) -> None:
        # Realtime sessions synthesize through the model; AgentSession.say()
        # only works when a standalone TTS model is attached.
        await self.session.generate_reply(instructions=self._greeting, input_modality="text")


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
    # Loaded once per worker process and reused across jobs - model loads are
    # the expensive part, so this must not happen per-call.
    # min_silence_duration close to Silero's own default: how long the
    # visitor must go quiet before VAD reports speech-end. The previous 0.35s
    # (tuned down for snappier turn-taking) was cutting visitor speech short
    # on real mobile mics - brief silence blips from network jitter/handling
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
        logger.warning("voice worker: job missing bot_id/session_id in metadata (%r) - not connecting", meta)
        return

    bot_res = supabase.table("chatty_bots").select("*").eq("id", bot_id).single().execute()
    bot = bot_res.data
    if not bot or not bot.get("voice_enabled"):
        logger.warning("voice worker: bot %s missing or voice_enabled=false - not connecting", bot_id)
        return

    # Same owner-lookup pattern as app/routers/widget.py's widget_chat handler.
    owner_id = bot["user_id"]
    owner_res = supabase.table("users").select("*").eq("auth_user_id", owner_id).execute()
    if not owner_res.data:
        logger.warning("voice worker: bot owner not found for bot %s - not connecting", bot_id)
        return
    owner_user = owner_res.data[0]

    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)

    vad = ctx.proc.userdata.get("vad")

    voice_mode = (bot.get("voice_mode") or "pipeline").strip().lower()
    realtime_provider = (bot.get("voice_realtime_provider") or "google").strip().lower()
    realtime_model = bot.get("voice_realtime_model") or REALTIME_DEFAULT_MODEL.get(realtime_provider, "")
    realtime_usage = _RealtimeUsageTotals()
    call_start = time.monotonic()
    process_cpu_start = time.process_time()
    first_response_at: Optional[float] = None
    turn_count = 0
    nudge_count = 0
    error_count = 0
    max_duration_task: Optional[asyncio.Task] = None
    idle_nudge_task: Optional[asyncio.Task] = None
    call_logged = False

    # A Google pipeline needs service-account ADC for both STT and TTS. The
    # managed worker image intentionally carries only the Gemini API key, so
    # promote this specific unusable configuration to Gemini realtime in
    # memory. The saved dashboard settings remain unchanged and a VPS owner
    # can opt back into the pipeline by mounting ADC later.
    if (
        voice_mode == "pipeline"
        and (bot.get("voice_stt_provider") or "google").strip().lower() == "google"
        and (bot.get("voice_tts_provider") or "google").strip().lower() == "google"
        and realtime_provider == "google"
        and GEMINI_API_KEY
        and not _google_pipeline_credentials_available()
    ):
        logger.warning("voice worker: Google pipeline selected without ADC; using Gemini realtime for this session")
        voice_mode = "realtime"

    if voice_mode == "realtime":
        # No stt/tts/vad/turn_detection at all - the RealtimeModel handles
        # listening, thinking, and speaking as one speech-to-speech session
        # (set on the Agent itself below, not here).
        session = AgentSession()
        session.on("session_usage_updated", realtime_usage.replace_from_session_usage)
    else:
        session = AgentSession(
            stt=_build_stt(bot),
            tts=_build_tts(bot),
            vad=vad,
            # Semantic turn detection (LiveKit's hosted inference - no local
            # model to load, keeps this worker's cold-start light) rather than
            # relying on VAD silence-timeout alone: distinguishes "visitor
            # paused mid-thought" from "visitor is actually done talking", so
            # the agent replies as soon as it's really the agent's turn instead
            # of waiting out a fixed silence window every time.
            turn_detection=inference.TurnDetector(),
        )

    # Keep the conversation human-like when a visitor pauses after the
    # greeting. The client still receives this through LiveKit's normal
    # transcription stream, so it appears as a real agent turn (and is saved
    # with the rest of the call transcript), rather than a browser-only hint.
    last_user_activity = time.monotonic()
    idle_nudge_count = 0

    def _record_user_input(ev) -> None:
        nonlocal last_user_activity, idle_nudge_count, turn_count
        if getattr(ev, "is_final", False) and (getattr(ev, "transcript", "") or "").strip():
            last_user_activity = time.monotonic()
            idle_nudge_count = 0
            turn_count += 1
        logger.info(
            "voice worker: transcript (final=%s) %r",
            getattr(ev, "is_final", False),
            (getattr(ev, "transcript", "") or "")[:120],
        )

    # Targeted diagnostics (INFO level, so these survive without the earlier
    # DEBUG-dump noise): confirms exactly where a real call's audio pipeline
    # is versus isn't producing signal - was previously impossible to tell
    # apart "visitor never spoke" from "VAD/STT saw speech but no transcript
    # resulted" from "agent speech got falsely interrupted and auto-resumed".
    session.on(
        "user_state_changed",
        lambda ev: logger.info("voice worker: user_state %s -> %s", ev.old_state, ev.new_state),
    )
    session.on("user_input_transcribed", _record_user_input)
    def _record_agent_state(ev) -> None:
        nonlocal first_response_at
        state = str(getattr(ev, "new_state", "") or "").lower()
        if first_response_at is None and state in {"speaking", "listening"}:
            first_response_at = time.monotonic()
    session.on("agent_state_changed", _record_agent_state)
    def _record_close(ev) -> None:
        nonlocal error_count
        if getattr(ev, "error", None) is not None:
            error_count += 1
            logger.error("voice worker: session closed with an error: %s", ev.error)
    session.on("close", _record_close)
    session.on(
        "user_transcription_timeout",
        lambda ev: logger.warning("voice worker: user_transcription_timeout - speech detected, no transcript"),
    )
    session.on(
        "agent_false_interruption",
        lambda ev: logger.warning("voice worker: agent_false_interruption - resuming agent speech"),
    )

    if voice_mode == "realtime":
        # Realtime models do not pass through ChattyVoiceAgent.llm_node, so
        # there is no single interception point for persistence. LiveKit
        # commits both visitor and agent turns to the session history and
        # emits this event for each committed ChatMessage. Persist those turns
        # with an explicit voice sender so closing the voice surface can merge
        # them back into the normal widget thread.
        def _persist_realtime_item(ev) -> None:
            item = getattr(ev, "item", None)
            role = str(getattr(item, "role", "") or "").lower()
            if role not in {"user", "assistant"}:
                return
            content = (getattr(item, "text_content", None) or getattr(item, "raw_text_content", None) or "").strip()
            if not content:
                return
            try:
                supabase.table("chatty_conversations").insert({
                    "bot_id": bot_id,
                    "session_id": session_id,
                    "role": role,
                    "sender": "voice",
                    "content": content,
                }).execute()
            except Exception:
                logger.exception("voice worker: failed to persist realtime %s conversation item", role)

        session.on("conversation_item_added", _persist_realtime_item)

    if voice_mode == "realtime":
        api_key = _decrypt_byok(bot.get("voice_realtime_byok_key_encrypted"))
        if realtime_provider == "openai":
            api_key = api_key or OPENAI_API_KEY or None
        elif realtime_provider == "google":
            api_key = api_key or GEMINI_API_KEY or None
        realtime_llm = build_realtime(realtime_provider, realtime_model, bot.get("voice_tts_voice"), api_key)
        agent = ChattyRealtimeAgent(
            bot=bot,
            owner_user=owner_user,
            bot_id=bot_id,
            realtime_llm=realtime_llm,
            room=ctx.room,
            session_id=session_id,
            visitor_timezone=visitor_timezone,
        )
    else:
        agent = ChattyVoiceAgent(
            bot=bot,
            owner_user=owner_user,
            bot_id=bot_id,
            session_id=session_id,
            visitor_timezone=visitor_timezone,
            room=ctx.room,
        )

    async def _log_call_cost() -> None:
        nonlocal call_logged
        # AgentServer shutdown callbacks can be reached through more than one
        # teardown path. The usage row must be exactly once per session so
        # analytics and billing never double-count a call.
        if call_logged:
            return
        call_logged = True
        duration = time.monotonic() - call_start
        cpu_seconds = max(0.0, time.process_time() - process_cpu_start)
        peak_rss_mb = _process_rss_mb()
        avg_cpu_percent = round((cpu_seconds / duration) * 100, 2) if duration > 0 else None
        first_latency = round((first_response_at - call_start) * 1000) if first_response_at else None
        if voice_mode == "realtime":
            cost = _cost_of_realtime_usage(realtime_provider, realtime_model, realtime_usage)
            _log_voice_call(
                bot_id=bot_id, session_id=session_id, mode="realtime",
                provider=realtime_provider, model=realtime_model, duration_seconds=duration,
                input_tokens=realtime_usage.input_tokens, output_tokens=realtime_usage.output_tokens,
                cost_usd=cost,
                peak_rss_mb=peak_rss_mb, cpu_seconds=round(cpu_seconds, 3),
                avg_cpu_percent=avg_cpu_percent, first_response_latency_ms=first_latency,
                turn_count=turn_count, nudge_count=nudge_count, error_count=error_count,
            )
        else:
            # STT/TTS providers here (Deepgram, ElevenLabs, etc.) aren't
            # priced in litellm's model_cost the way LLM/realtime-audio
            # tokens are - the pipeline mode's own LLM cost is already
            # tracked separately via ai_client.chat_stream's existing
            # litellm.completion_cost call (call_type="widget_chat"), so
            # this just logs call duration/provider; cost_usd stays null
            # (unknown) rather than a misleading 0 or a made-up rate.
            _log_voice_call(
                bot_id=bot_id, session_id=session_id, mode="pipeline",
                provider=bot.get("voice_stt_provider"), model=None, duration_seconds=duration,
                peak_rss_mb=peak_rss_mb, cpu_seconds=round(cpu_seconds, 3),
                avg_cpu_percent=avg_cpu_percent, first_response_latency_ms=first_latency,
                turn_count=turn_count, nudge_count=nudge_count, error_count=error_count,
            )

    ctx.add_shutdown_callback(_log_call_cost)

    async def _cancel_background_tasks() -> None:
        current_task = asyncio.current_task()
        tasks = [
            task for task in (max_duration_task, idle_nudge_task)
            if task is not None and task is not current_task
        ]
        for task in tasks:
            if not task.done():
                task.cancel()
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

    ctx.add_shutdown_callback(_cancel_background_tasks)

    await session.start(
        agent=agent,
        room=ctx.room,
        # sync_transcription=True (the default) paces the transcription
        # stream to match TTS audio playback - real-time-feeling speech, but
        # "chunky" as chat text (whole sentences appear only once spoken).
        # False publishes each text chunk to the room as soon as the LLM
        # actually produces it, decoupled from how fast TTS is speaking it -
        # what the widget's transcript view actually wants: fast, ChatGPT-
        # style token streaming, not audio-paced reveal.
        room_options=room_io.RoomOptions(
            text_output=room_io.TextOutputOptions(sync_transcription=False),
        ),
    )

    async def _speak(text: str):
        """Speak text through the correct LiveKit API for this session mode."""
        if voice_mode == "realtime":
            return await session.generate_reply(instructions=text, input_modality="text")
        return await session.say(text)

    if voice_mode != "realtime":
        # Greet with the bot's own configured welcome message (same field text
        # chat already shows via GET /api/widget/theme) rather than a generic
        # line, so voice matches the bot's actual branding/tone. session.say
        # (not generate_reply) since there's no user turn yet - this doesn't
        # route through llm_node/run_widget_assistant at all. Realtime mode's
        # own ChattyRealtimeAgent.on_enter already does this greeting itself.
        greeting = (bot.get("welcome_message") or "").strip() or (
            "Hi, I'm Chatty. I'm here and ready to help. What would you like to do today?"
        )
        await _speak(greeting)

    # Start idle monitoring after the greeting has finished so a long first
    # response cannot trigger a follow-up over the top of the introduction.
    last_user_activity = time.monotonic()

    # Cost/abuse circuit-breaker: no per-minute quota exists yet (a known,
    # explicitly-accepted gap - usage is tracked, not gated), but an
    # abandoned open call (visitor closes the tab without hanging up) must
    # not run/bill indefinitely. Runs as a background task (not awaited
    # inline) so it doesn't hold up normal job completion/cleanup when the
    # call ends naturally well before the limit - ctx.shutdown() cancels
    # this along with everything else once the job is done either way.
    try:
        max_minutes = min(120, max(1, int(bot.get("voice_max_duration_minutes") or 15)))
    except (TypeError, ValueError):
        max_minutes = 15

    async def _enforce_max_duration() -> None:
        try:
            await asyncio.sleep(max_minutes * 60)
            logger.info("voice worker: call for bot %s hit the %d-minute limit - ending", bot_id, max_minutes)
            await _speak(
                "We're at the time limit for this call - thanks for chatting! "
                "Feel free to reach out again anytime."
            )
            ctx.shutdown(reason="voice_max_duration_minutes reached")
        except asyncio.CancelledError:
            pass

    max_duration_task = asyncio.create_task(_enforce_max_duration(), name=f"voice-max-duration:{session_id}")

    async def _nudge_when_idle() -> None:
        """Monitor silence and re-engage a few times without spamming visitors."""
        nonlocal last_user_activity, idle_nudge_count
        try:
            await asyncio.sleep(8)
            while True:
                # Three nudges is enough to recover an attentive visitor. Keep
                # monitoring after that, but stay quiet until they speak again.
                if idle_nudge_count >= 3:
                    await asyncio.sleep(5)
                    continue
                idle_for = time.monotonic() - last_user_activity
                threshold = 18 if idle_nudge_count == 0 else 35
                if idle_for >= threshold:
                    idle_nudge_count += 1
                    if idle_nudge_count == 1:
                        nudge = "Hey, are you still there? I'm here if you'd like help with anything."
                    elif idle_nudge_count == 2:
                        nudge = "I'm still here. You can ask a question, share a time to book, or type a message below."
                    else:
                        nudge = "No problem if you need a moment. I'll keep this call open quietly until you're ready."
                    await _speak(
                        nudge
                    )
                    last_user_activity = time.monotonic()
                    await asyncio.sleep(5)
                else:
                    await asyncio.sleep(min(10, max(1, threshold - idle_for)))
        except asyncio.CancelledError:
            pass
        except RuntimeError as exc:
            # A visitor can hang up while a reminder is being generated. The
            # session is already shutting down in that case; don't report a
            # normal disconnect as a worker failure.
            if "AgentSession isn't running" not in str(exc):
                logger.exception("voice worker: idle follow-up failed")
        except Exception:
            logger.exception("voice worker: idle follow-up failed")

    idle_nudge_task = asyncio.create_task(_nudge_when_idle(), name=f"voice-idle-nudge:{session_id}")

    async def _cancel_idle_nudge() -> None:
        idle_nudge_task.cancel()

    ctx.add_shutdown_callback(_cancel_idle_nudge)


server.setup_fnc = prewarm_fnc


if __name__ == "__main__":
    cli.run_app(server)
