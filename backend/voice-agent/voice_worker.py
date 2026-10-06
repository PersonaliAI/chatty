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
import importlib
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
from google.genai import types as genai_types
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
    TurnHandlingOptions,
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

# Optional, self-hosted AEC/NS/AGC processor.  Keep this lazy: the plugin
# loads native audio libraries, and importing those at module-import time can
# block test discovery or dashboard tooling on hosts that never enable
# denoise.  Production loads it only when VOICE_DENOISE_ENABLED is true.
telephony_denoise = None
_telephony_denoise_loaded = False

from app.core.clients import supabase
from app.core.db import run_db
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

# Older MCP/config records sometimes stored the display name instead of the
# ElevenLabs voice ID. Keep those records working while the dashboard now
# stores IDs explicitly.
ELEVENLABS_VOICE_ALIASES = {
    "rachel": "21m00Tcm4TlvDq8ikWAM",
    "bella": "EXAVITQu4vr4xnSDxMaL",
    "antoni": "ErXwobaYiN019PkySvjV",
    "elli": "MF3mGyEYCl7XYWbV9V6O",
    "josh": "TxGEqnHWrfWFTfGW9XjX",
    "adam": "pNInz6obpgDQGcFmaJgB",
}

# Chirp 3 HD voice names are locale-prefixed. Keep a conservative set of
# locales whose voice availability is documented by Google; unsupported
# locales continue to receive the text reply and keep the last working voice
# instead of breaking an otherwise healthy call.
_CHIRP_TTS_LOCALES = {
    "ar-XA", "bn-IN", "bg-BG", "yue-HK", "hr-HR", "cs-CZ", "da-DK",
    "nl-BE", "nl-NL", "en-AU", "en-IN", "en-GB", "en-US", "et-EE",
    "fi-FI", "fr-CA", "fr-FR", "de-DE", "el-GR", "gu-IN", "he-IL",
    "hi-IN", "hu-HU", "id-ID", "it-IT", "ja-JP", "kn-IN", "ko-KR",
    "lv-LV", "lt-LT", "ml-IN", "cmn-CN", "mr-IN", "nb-NO", "pl-PL",
    "pt-BR", "pa-IN", "ro-RO", "ru-RU", "sr-RS", "sk-SK", "sl-SI",
    "es-ES", "es-US", "sw-KE", "sv-SE", "ta-IN", "te-IN", "th-TH",
    "tr-TR", "uk-UA", "ur-IN", "vi-VN",
}

_VOICE_LANGUAGE_ALIASES = {
    "arabic": "ar-XA", "bengali": "bn-IN", "bulgarian": "bg-BG",
    "catalan": "ca-ES", "chinese": "cmn-CN", "chinease": "cmn-CN",
    "mandarin": "cmn-CN", "croatian": "hr-HR", "czech": "cs-CZ",
    "danish": "da-DK", "dutch": "nl-NL", "english": "en-US",
    "finnish": "fi-FI", "french": "fr-FR", "german": "de-DE",
    "greek": "el-GR", "gujarati": "gu-IN", "hebrew": "he-IL",
    "hindi": "hi-IN", "hungarian": "hu-HU", "indonesian": "id-ID",
    "italian": "it-IT", "japanese": "ja-JP", "kannada": "kn-IN",
    "korean": "ko-KR", "malayalam": "ml-IN", "marathi": "mr-IN",
    "norwegian": "nb-NO", "polish": "pl-PL", "portuguese": "pt-BR",
    "punjabi": "pa-IN", "romanian": "ro-RO", "russian": "ru-RU",
    "serbian": "sr-RS", "sinhala": "si-LK", "slovak": "sk-SK",
    "slovenian": "sl-SI", "spanish": "es-ES", "swahili": "sw-KE",
    "swedish": "sv-SE", "tamil": "ta-IN", "telugu": "te-IN",
    "thai": "th-TH", "turkish": "tr-TR", "ukrainian": "uk-UA",
    "urdu": "ur-IN", "vietnamese": "vi-VN",
}

_VOICE_LANGUAGE_SCRIPT_RULES = (
    (re.compile(r"[\u4e00-\u9fff]"), "cmn-CN"),
    (re.compile(r"[\u3040-\u30ff]"), "ja-JP"),
    (re.compile(r"[\uac00-\ud7af]"), "ko-KR"),
    (re.compile(r"[\u0600-\u06ff]"), "ar-XA"),
    (re.compile(r"[\u0900-\u097f]"), "hi-IN"),
    (re.compile(r"[\u0b80-\u0bff]"), "ta-IN"),
    (re.compile(r"[\u0c00-\u0c7f]"), "te-IN"),
    (re.compile(r"[\u0e00-\u0e7f]"), "th-TH"),
    (re.compile(r"[\u0370-\u03ff]"), "el-GR"),
    (re.compile(r"[\u0400-\u04ff]"), "ru-RU"),
)


def _voice_language_from_text(text: str) -> str | None:
    """Infer a requested/output language without blocking the voice turn."""
    value = (text or "").strip()
    if not value:
        return None
    lowered = value.lower()
    for name, locale in _VOICE_LANGUAGE_ALIASES.items():
        if re.search(rf"\b{name}\b", lowered):
            # Only treat a language word as a switch when it is an instruction,
            # not when the visitor is asking about a product feature named
            # "Spanish" or "Chinese".
            if re.search(r"\b(?:speak|talk|reply|respond|answer|language|use|switch|in)\b", lowered):
                return locale
    for pattern, locale in _VOICE_LANGUAGE_SCRIPT_RULES:
        if pattern.search(value):
            return locale
    return None


class AdaptiveGoogleTTS(google.TTS):
    """Google Chirp 3 TTS that follows explicit language switches per turn.

    The LiveKit pipeline owns one TTS object for a call. Updating the locale
    before each phrase keeps that session warm while still allowing a visitor
    to say “please speak in Chinese” without reconnecting the room.
    """

    def __init__(self, *, voice_name: str, **kwargs: Any) -> None:
        self._base_voice_name = voice_name or "en-US-Chirp3-HD-Charon"
        self._voice_language = "en-US"
        suffix = self._base_voice_name.split("-Chirp3-HD-", 1)[-1]
        self._voice_suffix = suffix if suffix and suffix != self._base_voice_name else "Charon"
        kwargs.pop("voice_name", None)
        kwargs.pop("language", None)
        super().__init__(voice_name=self._base_voice_name, language="en-US", **kwargs)

    @property
    def voice_language(self) -> str:
        return self._voice_language

    def set_language(self, language: str | None) -> None:
        locale = (language or "").strip()
        if not locale:
            return
        base = locale.lower().replace("_", "-")
        if base in {"zh", "zh-cn", "zh-hans", "zh-hans-cn"}:
            locale = "cmn-CN"
        elif base == "en":
            locale = "en-US"
        elif len(base) == 2:
            locale = next((candidate for candidate in _CHIRP_TTS_LOCALES if candidate.lower().startswith(base + "-")), locale)
        else:
            locale = locale.split("-")[0].lower() + ("-" + locale.split("-")[1].upper() if "-" in locale else "")
        if locale not in _CHIRP_TTS_LOCALES:
            logger.info("voice worker: TTS locale %s is not available in Chirp 3 HD; keeping %s", locale, self._voice_language)
            return
        if locale == self._voice_language:
            return
        self._voice_language = locale
        self.update_options(
            language=locale,
            voice_name=f"{locale}-Chirp3-HD-{self._voice_suffix}",
        )
        logger.info("voice worker: switched pipeline TTS language=%s", locale)

    def set_language_from_text(self, text: str) -> None:
        locale = _voice_language_from_text(text)
        if locale:
            self.set_language(locale)

    def synthesize(self, text: str, **kwargs: Any):
        # This catches a reply written in a requested language even when the
        # request itself was spoken in English (for example “speak Chinese”).
        self.set_language_from_text(text)
        return super().synthesize(text, **kwargs)


_ELEVENLABS_TTS_LANGUAGES = {
    "ar", "bg", "bn", "cs", "da", "de", "el", "en", "es", "fi", "fr",
    "he", "hi", "hu", "id", "it", "ja", "ko", "ms", "nl", "pl", "pt",
    "ro", "ru", "sk", "sv", "ta", "tr", "uk", "vi", "zh",
}


class AdaptiveElevenLabsTTS(elevenlabs.TTS):
    """ElevenLabs multilingual TTS that follows explicit language switches."""

    def __init__(self, *, voice_id: str, **kwargs: Any) -> None:
        kwargs.setdefault("model", os.environ.get("ELEVENLABS_TTS_MODEL", "eleven_turbo_v2_5"))
        kwargs.setdefault("language", "en")
        self._voice_language = "en"
        super().__init__(voice_id=voice_id, **kwargs)

    @property
    def voice_language(self) -> str:
        return self._voice_language

    def set_language(self, language: str | None) -> None:
        value = (language or "").strip().lower().replace("_", "-")
        if not value:
            return
        base = value.split("-", 1)[0]
        if base not in _ELEVENLABS_TTS_LANGUAGES:
            logger.info(
                "voice worker: TTS locale %s is not available in ElevenLabs multilingual v2; keeping %s",
                language,
                self._voice_language,
            )
            return
        if base == self._voice_language:
            return
        self._voice_language = base
        self.update_options(language=base)
        logger.info("voice worker: switched pipeline ElevenLabs TTS language=%s", base)

    def set_language_from_text(self, text: str) -> None:
        locale = _voice_language_from_text(text)
        if locale:
            self.set_language(locale)

    def synthesize(self, text: str, **kwargs: Any):
        self.set_language_from_text(text)
        return super().synthesize(text, **kwargs)


def _voice_endpointing_options() -> dict[str, Any]:
    """Return low-latency endpointing for the streaming STT pipeline.

    Pipeline mode uses Google's bidirectional STT stream as the turn source;
    adding a second semantic turn-inference hop makes responses feel stuck
    and can delay a barge-in. Keep a short speech-end grace period for natural
    pauses while allowing operators to tune it without rebuilding the worker.
    """
    try:
        min_delay = float(os.environ.get("VOICE_ENDPOINTING_MIN_DELAY", "0.35"))
    except (TypeError, ValueError):
        min_delay = 0.35
    try:
        max_delay = float(os.environ.get("VOICE_ENDPOINTING_MAX_DELAY", "0.85"))
    except (TypeError, ValueError):
        max_delay = 0.85
    min_delay = max(0.2, min(1.0, min_delay))
    max_delay = max(min_delay, min(2.0, max_delay))
    return {"mode": "fixed", "min_delay": min_delay, "max_delay": max_delay}


def _voice_greeting(bot: dict[str, Any]) -> str:
    """Return only the configured greeting; keep the opening voice turn natural, warm, and polite."""
    raw = (bot.get("welcome_message") or "").strip()
    if raw:
        return raw
    name = (bot.get("name") or "").strip() or "Chatty"
    return f"Hello! Welcome. I'm {name}. It's a pleasure to speak with you today! How may I assist you?"


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


class _SpeechChunker:
    """Turn streamed assistant text into stable, speakable phrases.

    Feeds audio smoothly to TTS without clipping words or stalling playout.
    Releases the first natural clause quickly so first-word latency is minimal,
    then streams subsequent phrases at natural pause boundaries to prevent
    audio buffer underruns (eliminating signal drop / stuttering).
    """

    _MAX_CHARS = 220
    _MIN_SPLIT_CHARS = 60
    _SENTENCE_END = re.compile(r"[.!?](?:[\"'\u2019\u201d)]*)(?=\s|$)")
    _CLAUSE_END = re.compile(r"[,;:\u2014](?=\s|$)")

    def __init__(self) -> None:
        self._buffer = ""
        self._first_emitted = False

    def add(self, text: str) -> list[str]:
        if text:
            self._buffer += text
        return self._drain(force=False)

    def flush(self) -> list[str]:
        return self._drain(force=True)

    def _drain(self, *, force: bool) -> list[str]:
        chunks: list[str] = []
        while self._buffer:
            sentence = self._SENTENCE_END.search(self._buffer)
            if sentence:
                end = sentence.end()
                phrase = self._buffer[:end].strip()
                self._buffer = self._buffer[end:].lstrip()
                if phrase:
                    chunks.append(phrase)
                    self._first_emitted = True
                continue

            # For the first chunk, split on a natural multi-word clause boundary
            # (e.g. "Sure, I can help with that," or "Got it, let's take a look,")
            # so the user hears voice response quickly (<200ms) without emitting
            # awkward isolated 1-word fragments like "Take" or "Well".
            if not self._first_emitted:
                clause = self._CLAUSE_END.search(self._buffer)
                if clause:
                    candidate = self._buffer[:clause.end()].strip()
                    if len(candidate.split()) >= 3 and len(candidate) >= 14:
                        phrase = candidate
                        self._buffer = self._buffer[clause.end():].lstrip()
                        chunks.append(phrase)
                        self._first_emitted = True
                        continue

            # For subsequent chunks, allow splitting at natural clauses once the buffer
            # has enough spoken content (>= 60 chars, >= 5 words) to feed TTS smoothly.
            clause = self._CLAUSE_END.search(self._buffer)
            if clause and clause.end() >= self._MIN_SPLIT_CHARS:
                candidate = self._buffer[:clause.end()].strip()
                if len(candidate.split()) >= 5:
                    phrase = candidate
                    self._buffer = self._buffer[clause.end():].lstrip()
                    chunks.append(phrase)
                    self._first_emitted = True
                    continue

            if len(self._buffer) >= self._MAX_CHARS:
                boundary = self._buffer.rfind(" ", 0, self._MAX_CHARS + 1)
                if boundary >= self._MIN_SPLIT_CHARS:
                    phrase = self._buffer[:boundary].strip()
                    self._buffer = self._buffer[boundary + 1:].lstrip()
                    if phrase:
                        chunks.append(phrase)
                        self._first_emitted = True
                    continue
            break

        if force and self._buffer.strip():
            chunks.append(self._buffer.strip())
            self._buffer = ""
            self._first_emitted = True
        return chunks


async def _handle_text_input(sess: AgentSession, ev: room_io.TextInputEvent) -> None:
    """Route composer text through the same turn state machine as speech.

    LiveKit's default callback already does this, but keeping the callback
    explicit makes the typed path observable and gives us a clear failure log.
    It also makes the input modality explicit so a typed message cannot be
    mistaken for an audio turn by a realtime provider.
    """
    text = (getattr(ev, "text", "") or "").strip()
    if not text:
        return
    started_at = time.monotonic()
    try:
        async with sess._claim_user_turn():
            await sess.interrupt()
            speech_handle = sess.generate_reply(user_input=text, input_modality="text")

            def _log_typed_reply(handle) -> None:
                """Keep async typed-turn failures visible in worker logs.

                ``generate_reply`` returns a SpeechHandle immediately; the
                actual LLM/TTS work completes later.  Logging only after the
                call returns made a failed typed response look successful.
                """
                try:
                    error = handle.exception()
                except Exception:
                    logger.exception("voice worker: typed reply completion inspection failed chars=%d", len(text))
                    return
                if error is not None:
                    logger.error(
                        "voice worker: typed reply failed chars=%d error=%s",
                        len(text), error,
                    )
                else:
                    logger.info(
                        "voice worker: typed reply completed chars=%d elapsed_ms=%d",
                        len(text), round((time.monotonic() - started_at) * 1000),
                    )

            speech_handle.add_done_callback(_log_typed_reply)
        logger.info(
            "voice worker: typed input accepted chars=%d elapsed_ms=%d",
            len(text), round((time.monotonic() - started_at) * 1000),
        )
    except Exception:
        logger.exception("voice worker: typed input failed chars=%d", len(text))
        raise


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
        tts_router: Optional[Any] = None,
    ):
        super().__init__(instructions="", llm=_NullLLM(), tts=tts_router)
        self._bot = bot
        self._owner_user = owner_user
        self._bot_id = bot_id
        self._session_id = session_id
        self._visitor_timezone = visitor_timezone
        self._visitor_geo = visitor_geo
        self._room = room
        self._tts_router = tts_router

    async def llm_node(
        self,
        chat_ctx: llm.ChatContext,
        tools: list,
        model_settings: ModelSettings,
    ) -> AsyncIterable[str]:
        user_text = _latest_user_text(chat_ctx)
        if self._tts_router is not None and hasattr(self._tts_router, "set_language_from_text"):
            # A visitor can switch languages explicitly (“please speak in
            # Chinese”) at any point, including when the request itself was
            # recognized in English. The adaptive TTS keeps the room alive.
            self._tts_router.set_language_from_text(user_text)

        # Persist the visitor turn in background so database latency does not block audio streaming.
        async def _save_user_turn() -> None:
            try:
                await run_db(lambda: supabase.table("chatty_conversations").insert({
                    "bot_id": self._bot_id, "session_id": self._session_id,
                    "role": "user", "sender": "voice", "content": user_text,
                }).execute())
            except Exception:
                logger.exception("voice worker: failed to save user conversation message")

        asyncio.create_task(_save_user_turn())

        queue: asyncio.Queue = asyncio.Queue()
        _SENTINEL = object()
        # Do not hand individual model-token fragments to TTS.  The chunker
        # keeps one natural phrase per synthesis request and only splits long
        # punctuation-free answers at whitespace, which prevents stuttering
        # without delaying the first complete sentence.
        speech_chunker = _SpeechChunker()
        turn_started_at = time.monotonic()
        first_model_token_at: Optional[float] = None
        first_tts_phrase_at: Optional[float] = None

        # widget_brain._gemini_stream does `await on_token(part.text)` - on_token
        # MUST be an async callable (a fire-and-forget sync lambda would crash
        # with "object is not awaitable"). asyncio.Queue.put_nowait itself is
        # sync/non-blocking, so this async wrapper just awaits nothing extra.
        async def _on_token(tok: str) -> None:
            nonlocal first_model_token_at, first_tts_phrase_at
            # Strip UI-only markers so the TTS engine never reads JSON aloud.
            clean_tok = tok.replace("[BOOKING_WIDGET]", "")
            clean_tok = re.sub(r"\[(?:PRODUCT_CARD|VIDEO_CLIP):\{.*?\}\]", "", clean_tok)
            if clean_tok:
                if first_model_token_at is None:
                    first_model_token_at = time.monotonic()
                    logger.info(
                        "voice worker: first model token mode=pipeline elapsed_ms=%d",
                        round((first_model_token_at - turn_started_at) * 1000),
                    )
                for phrase in speech_chunker.add(clean_tok):
                    if first_tts_phrase_at is None:
                        first_tts_phrase_at = time.monotonic()
                        logger.info(
                            "voice worker: first tts phrase queued mode=pipeline elapsed_ms=%d chars=%d",
                            round((first_tts_phrase_at - turn_started_at) * 1000),
                            len(phrase),
                        )
                    queue.put_nowait(phrase)

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
        def _finish_stream(task: asyncio.Task) -> None:
            # Flush the final fragment before ending the generator.  The
            # callback runs on the event loop, so queue ordering is stable.
            for phrase in speech_chunker.flush():
                queue.put_nowait(phrase)
            try:
                task_error = task.exception()
            except asyncio.CancelledError:
                task_error = None
            except Exception as exc:  # pragma: no cover - defensive callback guard
                task_error = exc
            logger.info(
                "voice worker: assistant stream finished mode=pipeline elapsed_ms=%d first_model_token_ms=%s first_tts_phrase_ms=%s",
                round((time.monotonic() - turn_started_at) * 1000),
                round((first_model_token_at - turn_started_at) * 1000) if first_model_token_at else None,
                round((first_tts_phrase_at - turn_started_at) * 1000) if first_tts_phrase_at else None,
            )
            if task_error is not None:
                logger.error(
                    "voice worker: assistant turn failed mode=pipeline error_type=%s",
                    type(task_error).__name__,
                )
                participant = getattr(self._room, "local_participant", None)
                if participant is not None:
                    asyncio.create_task(
                        participant.publish_data(
                            json.dumps({
                                "type": "voice_error",
                                "message": "The assistant could not complete that turn. Please try again or type your message instead.",
                            }).encode("utf-8"),
                            reliable=True,
                        )
                    )
            queue.put_nowait(_SENTINEL)

        task.add_done_callback(_finish_stream)

        try:
            while True:
                item = await queue.get()
                if item is _SENTINEL:
                    break
                yield item

            result = task.result()  # propagates any exception raised by the task
        finally:
            # AgentSession cancels the speech generator on barge-in. The
            # assistant task is created separately so it must be cancelled
            # explicitly too; otherwise an interrupted turn keeps consuming
            # LLM/tool resources and can leak stale work into the next turn.
            if not task.done():
                task.cancel()
                await asyncio.gather(task, return_exceptions=True)

        # If the assistant turn triggered booking, publish a reliable data packet to the room
        # so the client's VoiceCallWidget displays the interactive calendar immediately.
        reply = result.get("reply") or ""
        if "[BOOKING_WIDGET]" in reply and self._room and getattr(self._room, "local_participant", None):
            if not getattr(self, "_booking_widget_opened", False):
                self._booking_widget_opened = True
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

        async def _save_assistant_turn() -> None:
            try:
                await run_db(lambda: supabase.table("chatty_conversations").insert({
                    "bot_id": self._bot_id, "session_id": self._session_id,
                    "role": "assistant", "sender": "voice", "content": reply,
                }).execute())
            except Exception:
                logger.exception("voice worker: failed to save assistant conversation message")

        asyncio.create_task(_save_assistant_turn())


def _decrypt_byok(enc: Optional[str]) -> Optional[str]:
    if not enc:
        return None
    try:
        return llm_providers.decrypt_api_key(enc)
    except Exception:
        logger.exception("voice worker: failed to decrypt BYOK key - falling back")
        return None


def _provider_error_guidance(stt_provider: str | None = None, tts_provider: str | None = None) -> str:
    """Return actionable provider guidance without exposing credentials."""
    providers = [str(value or "").strip().lower() for value in (stt_provider, tts_provider)]
    guidance = "Check the selected provider API key, voice ID, account quota, and provider status, then reconnect."
    if "elevenlabs" in providers:
        guidance += " ElevenLabs free API accounts cannot synthesize Voice Library IDs; use a voice you own/create or a paid ElevenLabs plan."
    if "fishaudio" in providers:
        guidance += " Fish Audio HTTP 402 means the account needs active billing/credits and access to the selected voice model; verify the Fish Audio plan, balance, and voice ID."
    return guidance


def _build_stt(bot: dict[str, Any]):
    """Construct the STT plugin for a bot's `voice_stt_provider`.

    Falls back to a server-side shared key (app.core.config) when the bot has
    no BYOK key of its own, and fails clearly when a selected provider has no
    usable credential. Azure was dropped from the option set - azure.STT needs
    speech_key + speech_region, not a single api_key, which didn't fit the
    single-encrypted-key BYOK column; soniox.STT() takes a clean single
    api_key (verified via source, not import - see _build_tts's fishaudio
    note for why) and is a well-regarded realtime STT provider, so it
    replaced azure as the 5th option. ElevenLabs Scribe v2 realtime is also
    supported for teams that want one provider for both STT and TTS.
    """
    provider = (bot.get("voice_stt_provider") or "google").strip().lower()
    if provider == "google":
        try:
            # Chirp 3 is Google's current low-latency streaming recognizer for
            # voice bots. Keep the model and endpointing sensitivity tunable
            # for operators, but never fall back to a batch recognizer: the
            # pipeline must continue to emit interim hypotheses while speech
            # is still arriving.
            stt_model = os.environ.get("GOOGLE_STT_MODEL", "chirp_3").strip() or "chirp_3"
            if stt_model not in {"chirp_3", "latest_long", "latest_short", "telephony"}:
                logger.warning("voice worker: unsupported GOOGLE_STT_MODEL=%r; using chirp_3", stt_model)
                stt_model = "chirp_3"
            endpointing_sensitivity = os.environ.get(
                "GOOGLE_STT_ENDPOINTING_SENSITIVITY",
                "ENDPOINTING_SENSITIVITY_SHORT",
            ).strip().upper()
            if endpointing_sensitivity not in {
                "ENDPOINTING_SENSITIVITY_STANDARD",
                "ENDPOINTING_SENSITIVITY_SHORT",
                "ENDPOINTING_SENSITIVITY_SUPERSHORT",
            }:
                logger.warning(
                    "voice worker: unsupported GOOGLE_STT_ENDPOINTING_SENSITIVITY=%r; using SHORT",
                    endpointing_sensitivity,
                )
                endpointing_sensitivity = "ENDPOINTING_SENSITIVITY_SHORT"
            # Chirp 3 is served from the `us`/`eu` multi-regions (not the
            # generic `global` endpoint). Keep this explicit so a valid
            # streaming model does not fail at runtime because the SDK used
            # its global default.
            stt_location = os.environ.get("GOOGLE_STT_LOCATION", "us").strip() or "us"
            # Keep the pipeline on Google's bidirectional streaming STT API;
            # ``interim_results`` alone is not enough if a plugin default ever
            # changes and would otherwise make the UI wait for a whole turn.
            # Chirp 3 V2 supports language_codes=["auto"] and still emits
            # interim streaming hypotheses. Pipeline mode remains STT -> LLM
            # -> TTS, while STT can identify the visitor's language itself.
            stt_languages = os.environ.get("GOOGLE_STT_LANGUAGES", "auto").strip() or "auto"
            kwargs: dict[str, Any] = {
                "languages": stt_languages,
                "detect_language": True,
                "model": stt_model,
                "location": stt_location,
                "interim_results": True,
                "use_streaming": True,
                "enable_voice_activity_events": True,
            }
            if stt_model == "chirp_3":
                kwargs["endpointing_sensitivity"] = endpointing_sensitivity
            return google.STT(**kwargs)
        except Exception as exc:
            raise RuntimeError(
                "Google Pipeline STT requires Google Application Default Credentials; "
                "configure GOOGLE_APPLICATION_CREDENTIALS or select a different STT provider"
            ) from exc

    key = _decrypt_byok(bot.get("voice_stt_byok_key_encrypted"))

    if provider == "cartesia":
        key = key or CARTESIA_API_KEY or None
        if not key:
            raise RuntimeError("Cartesia STT selected but no BYOK/CARTESIA_API_KEY is configured")
        return cartesia.STT(
            api_key=key,
            model=os.environ.get("CARTESIA_STT_MODEL", "ink-2"),
            language="en",
        )
    if provider == "deepgram":
        key = key or DEEPGRAM_API_KEY or None
        if not key:
            raise RuntimeError("Deepgram STT selected but no BYOK/DEEPGRAM_API_KEY is configured")
        return deepgram.STT(
            api_key=key,
            model=os.environ.get("DEEPGRAM_STT_MODEL", "nova-3"),
            language="en",
            interim_results=True,
            smart_format=True,
        )
    if provider == "assemblyai":
        key = key or ASSEMBLYAI_API_KEY or None
        if not key:
            raise RuntimeError("AssemblyAI STT selected but no BYOK/ASSEMBLYAI_API_KEY is configured")
        return assemblyai.STT(
            api_key=key,
            model="universal-streaming-multilingual",
            language_detection=True,
            continuous_partials=True,
            mode="min_latency",
        )
    if provider == "soniox":
        key = key or SONIOX_API_KEY or None
        if not key:
            raise RuntimeError(
                "Soniox STT selected but no BYOK/SONIOX_API_KEY is configured"
            )
        return soniox.STT(api_key=key)
    if provider == "elevenlabs":
        key = key or ELEVENLABS_API_KEY or None
        if not key:
            raise RuntimeError(
                "ElevenLabs STT selected but no BYOK/ElevenLabs API key is configured"
            )
        # Scribe v2 realtime streams interim and final transcript events and
        # lets LiveKit's native VAD/turn detector remain the source of truth
        # for endpointing and interruption behavior.
        return elevenlabs.STT(
            api_key=key,
            model="scribe_v2_realtime",
            no_verbatim=True,
        )
    if provider == "openai":
        key = key or OPENAI_API_KEY or None
        if not key:
            raise RuntimeError("OpenAI STT selected but no BYOK/OPENAI_API_KEY is configured")
        return openai.STT(api_key=key, detect_language=True)

    raise RuntimeError(f"Unsupported voice_stt_provider: {provider or 'empty'}")


def _build_tts(bot: dict[str, Any]):
    """Construct the TTS plugin for a bot's `voice_tts_provider`.

    Same server-side-shared-key behavior as `_build_stt`; a selected provider
    is never silently replaced with another provider.
    """
    provider = (bot.get("voice_tts_provider") or "google").strip().lower()
    # The dashboard's supported Google voice list is Chirp 3.  Keep pipeline
    # mode on that Cloud TTS path when an older bot has no saved voice; the
    # Google plugin otherwise defaults to Gemini Flash TTS, whose per-model
    # quota can be exhausted independently of the configured Gemini API key.
    voice = bot.get("voice_tts_voice") or os.environ.get(
        "GOOGLE_TTS_VOICE", "en-US-Chirp3-HD-Charon"
    )

    if provider == "google":
        # Google streaming synthesis keeps a single RPC open for the whole
        # assistant turn.  Long support answers can exceed that RPC's
        # deadline after partial audio has already played, which sounds like
        # a cut-off or stuck voice.  Non-streaming mode lets LiveKit's
        # sentence adapter synthesize each bounded phrase independently while
        # preserving natural turn pacing and clean retry boundaries.
        use_streaming = os.environ.get("GOOGLE_TTS_STREAMING", "false").strip().lower() in {
            "1", "true", "yes", "on"
        }
        try:
            speaking_rate = max(0.75, min(1.1, float(os.environ.get("GOOGLE_TTS_SPEAKING_RATE", "0.95"))))
        except ValueError:
            logger.warning("voice worker: invalid GOOGLE_TTS_SPEAKING_RATE; using 0.95")
            speaking_rate = 0.95
        try:
            # Cloud Text-to-Speech's unary synthesis endpoint returns Ogg Opus
            # cleanly for LiveKit's browser audio path; the plugin's PCM enum
            # is only supported by its streaming RPC.
            from google.cloud import texttospeech as google_cloud_texttospeech

            kwargs: dict[str, Any] = {
                "language": "en-US",
                "model_name": "chirp_3",
                "use_streaming": use_streaming,
                "speaking_rate": speaking_rate,
                "audio_encoding": google_cloud_texttospeech.AudioEncoding.OGG_OPUS,
            }
            if voice:
                kwargs["voice_name"] = voice
            return AdaptiveGoogleTTS(**kwargs)
        except Exception as exc:
            raise RuntimeError(
                "Google Pipeline TTS requires Google Application Default Credentials; "
                "configure GOOGLE_APPLICATION_CREDENTIALS or select a different TTS provider"
            ) from exc

    key = _decrypt_byok(bot.get("voice_tts_byok_key_encrypted"))

    if provider == "cartesia":
        key = key or CARTESIA_API_KEY or None
        if not key:
            raise RuntimeError(
                "Cartesia TTS selected but no BYOK/CARTESIA_API_KEY is configured"
            )
        kwargs: dict[str, Any] = {"api_key": key}
        if voice:
            kwargs["voice"] = voice
        return cartesia.TTS(**kwargs)
    if provider == "elevenlabs":
        key = key or ELEVENLABS_API_KEY or None
        if not key:
            raise RuntimeError(
                "ElevenLabs TTS selected but no BYOK/ElevenLabs API key is configured"
            )
        kwargs = {"api_key": key, "voice_id": "hpp4J3VqNfWAUOO0d1Us"}
        if voice:
            kwargs["voice_id"] = ELEVENLABS_VOICE_ALIASES.get(
                str(voice).strip().lower(), str(voice).strip()
            )
        return AdaptiveElevenLabsTTS(**kwargs)
    if provider == "openai":
        key = key or OPENAI_API_KEY or None
        if not key:
            raise RuntimeError(
                "OpenAI TTS selected but no BYOK/OPENAI_API_KEY is configured"
            )
        kwargs = {"api_key": key}
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
            raise RuntimeError(
                "Fish Audio TTS selected but no BYOK/FISH_API_KEY is configured"
            )
        target_voice = voice.strip() if (voice and voice.strip() != "custom") else "933563129e564b19a115bedd57b7406a"
        kwargs: dict[str, Any] = {
            "api_key": key,
            "model": os.environ.get("FISH_AUDIO_MODEL", "s2.1-pro"),
            "voice_id": target_voice,
            # LiveKit's browser transport is Opus/48 kHz; using Fish's Opus
            # stream avoids a second server-side WAV resample on every turn.
            "output_format": "opus",
            "sample_rate": 48000,
            "latency_mode": "balanced",
        }
        return fishaudio.TTS(**kwargs)

    raise RuntimeError(f"Unsupported voice_tts_provider: {provider or 'empty'}")


def _google_pipeline_credentials_available() -> bool:
    """Return whether Google Cloud ADC is explicitly mounted for the worker.

    Google STT/TTS use service-account ADC, while Gemini realtime uses the
    server's Gemini API key. The explicit file check lets Pipeline mode fail
    clearly when its required credential has not been mounted.
    """
    credentials_file = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS", "").strip()
    return bool(credentials_file and Path(credentials_file).is_file())


def _load_telephony_denoise():
    """Load the optional native audio filter only when a call needs it."""
    global telephony_denoise, _telephony_denoise_loaded
    if _telephony_denoise_loaded:
        return telephony_denoise
    _telephony_denoise_loaded = True
    try:
        telephony_denoise = importlib.import_module("livekit.plugins.telephony_denoise")
    except ImportError:
        telephony_denoise = None
    return telephony_denoise


def _build_call_denoiser():
    """Build one per-call self-hosted AEC/NS processor when enabled.

    Browser WebRTC echo cancellation is still requested by the widget.  This
    second reference path protects callers using speakerphone/embedded frames
    where the browser's reverse-stream reference is incomplete.  It is kept
    opt-in so older images and non-browser transports can fail open cleanly.
    """
    enabled = os.environ.get("VOICE_DENOISE_ENABLED", "false").strip().lower() in {
        "1", "true", "yes", "on"
    }
    if not enabled:
        return None
    _load_telephony_denoise()
    if telephony_denoise is None:
        logger.warning("voice worker: VOICE_DENOISE_ENABLED=true but telephony_denoise is not installed")
        return None
    try:
        enhancer = os.environ.get("VOICE_DENOISE_ENHANCER", "webrtc").strip().lower()
        if enhancer not in {"webrtc", "deepfilter"}:
            logger.warning("voice worker: invalid VOICE_DENOISE_ENHANCER=%r; using webrtc", enhancer)
            enhancer = "webrtc"
        try:
            stream_delay_ms = max(0, min(500, int(os.environ.get("VOICE_DENOISE_STREAM_DELAY_MS", "80"))))
        except ValueError:
            logger.warning("voice worker: invalid VOICE_DENOISE_STREAM_DELAY_MS; using 80")
            stream_delay_ms = 80
        denoiser = telephony_denoise.TelephonyDenoiser(
            telephony_denoise.DenoiseOptions(
                echo_cancellation=True,
                noise_suppression=True,
                high_pass_filter=True,
                auto_gain_control=True,
                enhancer=enhancer,
                stream_delay_ms=stream_delay_ms,
            )
        )
        logger.info(
            "voice worker: self-hosted denoise enabled enhancer=%s stream_delay_ms=%d",
            enhancer,
            stream_delay_ms,
        )
        return denoiser
    except Exception:
        logger.exception("voice worker: failed to initialize self-hosted denoise; using browser processing")
        return None


# Live API model ids are passed through to the provider plugin. Keep the
# default aligned with Google's current recommended low-latency model; the
# explicit allowlist also prevents stale dashboard values from silently
# creating a broken session.
REALTIME_DEFAULT_MODEL = {
    "google": "gemini-3.8-live",
    "openai": "gpt-realtime",
}
GOOGLE_REALTIME_MODELS = frozenset({
    "gemini-3.8-live",
    "gemini-3.8-live-extended-thinking",
    "gemini-3.1-flash-live-preview",
    "gemini-2.5-flash-native-audio-preview-12-2025",
})
REALTIME_DEFAULT_VOICE = {"google": "Puck", "openai": "marin"}
# The dashboard stores the selected Google TTS voice in `voice_tts_voice`.
# Cloud TTS/Chirp ids are not valid Gemini Live voices, so normalize those
# selections before constructing the realtime model.
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
    if provider == "google" and model not in GOOGLE_REALTIME_MODELS:
        logger.warning(
            "voice worker: unsupported Google Live model %r; using %s",
            model,
            REALTIME_DEFAULT_MODEL["google"],
        )
        model = REALTIME_DEFAULT_MODEL["google"]
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
        # Do not rely on provider defaults for captions. Gemini Live requires
        # explicit input/output audio-transcription configuration for a
        # dependable transcript stream, and the browser consumes both sides
        # through LiveKit's TranscriptionReceived event.
        kwargs: dict[str, Any] = {
            "model": model,
            "input_audio_transcription": genai_types.AudioTranscriptionConfig(),
            "output_audio_transcription": genai_types.AudioTranscriptionConfig(),
        }
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

    LiveKit emits cumulative ``session_usage_updated`` events. Keep the
    per-response helper for older worker images, but prefer replacing totals
    from cumulative usage so retries cannot double-count billing.
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
                widget_brain.search_knowledge(
                    bot_id, owner_user, bot, query, translate_query=False,
                ),
                timeout=tool_timeout_seconds,
            )
        except asyncio.TimeoutError:
            logger.warning("voice worker: knowledge search timed out after %.1fs", tool_timeout_seconds)
            knowledge_context = ""
        try:
            items, visual_attrs = await asyncio.wait_for(
                multimodal_service.search_multimodal_catalog(
                    bot_id=bot_id, query_text=query, top_k=3,
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
    allowed_tool_names = widget_brain.scheduling_tool_names(
        bot, owner_user, include_voice_confirmation=True,
    )

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
                "voice_mode": True,
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
                    "attendee_name": (raw_arguments.get("visitor_name") or raw_arguments.get("name") or summary.replace("Demo Meeting with ", "").strip() or "Guest"),
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
            + "You are having a live, natural voice conversation with a website visitor. Keep replies "
            "conversational, warm, and concise (1-2 sentences) - this is speech like a real phone call, not a chat window. Use brief "
            "natural acknowledgements and ask one helpful follow-up question at a time to keep the conversation engaging. Never announce "
            "that the visitor can speak or type, or that you will read replies aloud - converse naturally. Use the "
            "same conversation for voice and typed input. Accept typed messages "
            "from the composer and answer them with the same context while speaking the response "
            "and showing the text transcript. Always call the "
            "search_knowledge_base tool for any question about this specific business rather "
            "than guessing. When a visitor wants to book, always use the availability and "
            "calendar tools; never invent a time, and collect the required name and email. "
            "Lead capture is part of every qualified conversation: after answering the "
            "visitor's main question or when they show buying interest, naturally ask for "
            "their name and best email one field at a time, without interrupting support "
            "or asking again after a clear refusal. Treat every speech-to-text contact "
            "value as an uncertain draft: never call create_lead until the visitor has "
            "explicitly confirmed the spelling. For a name, repeat it character-by-character "
            "(for example, `I heard S-H-I-J-A. Is that correct?`). For an email, read it "
            "back slowly (`s h i j a at example dot com`) and ask if it is correct. If they "
            "correct or reject it, discard the draft, ask them to spell it one character at a "
            "time, repeat it, and confirm again. After each explicit yes, call "
            "confirm_contact_detail for that field, passing the exact character-by-character or voice-friendly "
            "read-back in its spelling argument and confirmed=true, then call create_lead with "
            "voice_confirmation=true only after both required fields are confirmed. Keep "
            "confirmed fields and merge later fields into the same lead rather than creating "
            "a duplicate. "
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
            "the remembered start/end, the real email in attendees, and their full name in visitor_name. "
            "Also call create_lead with the same bot and session context.\n"
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
        self._greeting = _voice_greeting(bot)

    async def on_enter(self) -> None:
        # Realtime sessions synthesize through the model; AgentSession.say()
        # only works when a standalone TTS model is attached.
        await self.session.generate_reply(instructions=self._greeting, input_modality="text")


# AgentServer's built-in HTTP port (health/monitoring endpoint, distinct from
# the outbound WebSocket connection it makes to LIVEKIT_URL for job dispatch).
# On Docker Compose / VPS, defaults to 8081.
# Keep one native-VAD process warm so the first call does not pay the 4-5 second
# process/model cold-start. Native LiveKit VAD shares its model singleton and
# remains stable on the production 4-vCPU/8-GB VPS; smaller hosts can override
# LIVEKIT_NUM_IDLE_PROCESSES=0 explicitly.
DEFAULT_IDLE_PROCESSES = 1
server = AgentServer(
    port=int(os.environ.get("PORT", 8081)),
    num_idle_processes=int(os.environ.get("LIVEKIT_NUM_IDLE_PROCESSES", str(DEFAULT_IDLE_PROCESSES))),
    log_level=os.environ.get("LIVEKIT_LOG_LEVEL", "INFO"),
)


def prewarm_fnc(proc: JobProcess) -> None:
    # Loaded once per worker process and reused across jobs - model loads are
    # the expensive part, so this must not happen per-call.
    # min_silence_duration close to Silero's own default: how long the
    # visitor must go quiet before VAD reports speech-end. The previous 0.35s
    # (tuned down for snappier turn-taking) was cutting visitor speech short
    # on real mobile mics - brief silence blips from network jitter/handling
    # noise read as "done talking". Google Chirp 3 endpointing is the primary
    # turn-taking signal in pipeline mode, so this only needs to be
    # conservative enough not to mis-trigger.
    # LiveKit's bundled native inference VAD keeps the Silero model singleton
    # in the worker and gives each call a lightweight stream executor. This
    # avoids ONNX Runtime thread contention that made the 4-vCPU VPS fall
    # behind realtime during a live call. Keep the plugin implementation as
    # an explicit compatibility fallback for older images.
    vad_backend = os.environ.get("VOICE_VAD_BACKEND", "native").strip().lower()
    if vad_backend in {"plugin", "onnx", "silero-plugin"}:
        proc.userdata["vad"] = silero.VAD.load(min_silence_duration=0.5)
    else:
        proc.userdata["vad"] = inference.VAD(
            model="silero",
            min_silence_duration=0.5,
            activation_threshold=0.5,
        )
    logger.info("voice worker: prewarmed VAD backend=%s", "plugin" if vad_backend in {"plugin", "onnx", "silero-plugin"} else "native")


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
    visitor_language = (meta.get("visitor_language") or "").strip()
    visitor_country = (meta.get("visitor_country") or "").strip().upper()

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

    async def _publish_setup_error(message: str) -> None:
        """Surface configuration failures instead of leaving a silent call."""
        participant = getattr(ctx.room, "local_participant", None)
        if participant is None:
            return
        try:
            await participant.publish_data(
                json.dumps({"type": "voice_error", "message": message}).encode("utf-8"),
                reliable=True,
            )
        except Exception:
            logger.exception("voice worker: failed to publish setup error packet")

    vad = ctx.proc.userdata.get("vad")
    # Browser-side WebRTC processing remains enabled by the widget. When the
    # VPS has the optional self-hosted processor installed, add a second AEC /
    # noise-suppression path and feed it the agent output as an echo reference.
    denoiser = _build_call_denoiser()
    audio_input = room_io.AudioInputOptions(
        noise_cancellation=denoiser,
        auto_gain_control=False if denoiser is not None else True,
        pre_connect_audio=True,
    )

    voice_mode = (bot.get("voice_mode") or "pipeline").strip().lower()
    realtime_provider = (bot.get("voice_realtime_provider") or "google").strip().lower()
    realtime_model = bot.get("voice_realtime_model") or REALTIME_DEFAULT_MODEL.get(realtime_provider, "")
    configured_realtime_model = realtime_model if voice_mode == "realtime" else "not-used"
    stt_provider = (bot.get("voice_stt_provider") or "google").strip().lower()
    tts_provider = (bot.get("voice_tts_provider") or "google").strip().lower()
    shared_provider_keys = {
        "deepgram": DEEPGRAM_API_KEY,
        "assemblyai": ASSEMBLYAI_API_KEY,
        "soniox": SONIOX_API_KEY,
        "elevenlabs": ELEVENLABS_API_KEY,
        "openai": OPENAI_API_KEY,
        "cartesia": CARTESIA_API_KEY,
        "fishaudio": FISH_API_KEY,
    }
    stt_key_configured = (
        _google_pipeline_credentials_available() if stt_provider == "google"
        else bool(bot.get("voice_stt_byok_key_encrypted") or shared_provider_keys.get(stt_provider))
    )
    tts_key_configured = (
        _google_pipeline_credentials_available() if tts_provider == "google"
        else bool(bot.get("voice_tts_byok_key_encrypted") or shared_provider_keys.get(tts_provider))
    )
    logger.info(
        "voice worker: session configuration mode=%s stt_provider=%s tts_provider=%s "
        "stt_model=%s realtime_provider=%s realtime_model=%s vad_backend=%s denoise_enabled=%s "
        "stt_key_configured=%s tts_key_configured=%s tts_voice=%s endpointing=%s",
        voice_mode,
        stt_provider,
        tts_provider,
        os.environ.get("GOOGLE_STT_MODEL", "chirp_3") if stt_provider == "google" else "not-used",
        realtime_provider,
        configured_realtime_model or "default",
        os.environ.get("VOICE_VAD_BACKEND", "native").strip().lower(),
        denoiser is not None,
        stt_key_configured,
        tts_key_configured,
        str(bot.get("voice_tts_voice") or "default"),
        _voice_endpointing_options() if voice_mode == "pipeline" else "not-used",
    )
    realtime_usage = _RealtimeUsageTotals()
    call_start = time.monotonic()
    process_cpu_start = time.process_time()
    first_response_at: Optional[float] = None
    turn_count = 0
    nudge_count = 0
    error_count = 0
    max_duration_task: Optional[asyncio.Task] = None
    silence_engagement_task: Optional[asyncio.Task] = None
    last_interaction_at = time.monotonic()
    silence_nudge_stage = 0
    call_logged = False
    pipeline_tts: Any = None

    # A Google pipeline needs service-account ADC for both STT and TTS. Never
    # silently change the user's selected mode: a pipeline configuration with
    # missing ADC must fail clearly rather than becoming a different realtime
    # product with different latency, billing, and transcript behavior.
    if (
        voice_mode == "pipeline"
        and (bot.get("voice_stt_provider") or "google").strip().lower() == "google"
        and (bot.get("voice_tts_provider") or "google").strip().lower() == "google"
        and not _google_pipeline_credentials_available()
    ):
        await _publish_setup_error(
            "Google Pipeline STT/TTS is not configured on the voice worker. "
            "Ask the administrator to mount GOOGLE_APPLICATION_CREDENTIALS or select another provider."
        )
        logger.error(
            "voice worker: Google pipeline selected but GOOGLE_APPLICATION_CREDENTIALS "
            "is not available; refusing to fall back to realtime"
        )
        return

    try:
        if voice_mode == "realtime":
            # No stt/tts/vad/turn_detection at all - the RealtimeModel handles
            # listening, thinking, and speaking as one speech-to-speech session
            # (set on the Agent itself below, not here).
            session = AgentSession()
            session.on("session_usage_updated", realtime_usage.replace_from_session_usage)
        else:
            adaptive_interruption_enabled = os.environ.get(
                "LIVEKIT_ADAPTIVE_INTERRUPTION_ENABLED", "false"
            ).strip().lower() in {"1", "true", "yes", "on"}
            interruption_mode = "adaptive" if adaptive_interruption_enabled else "vad"
            if not adaptive_interruption_enabled:
                logger.info(
                    "voice worker: adaptive interruption disabled; using local VAD interruption "
                    "(set LIVEKIT_ADAPTIVE_INTERRUPTION_ENABLED=true only when LiveKit inference is authorized)"
                )
            pipeline_stt = _build_stt(bot)
            pipeline_tts = _build_tts(bot)
            if isinstance(pipeline_tts, AdaptiveGoogleTTS):
                pipeline_tts.set_language(visitor_language)
            elif isinstance(pipeline_tts, AdaptiveElevenLabsTTS):
                pipeline_tts.set_language(visitor_language)
            session = AgentSession(
                stt=pipeline_stt,
                tts=pipeline_tts,
                vad=vad,
                # Industrial turn-taking: Google STT endpointing avoids cutting
                # visitors off mid-thought; local VAD handles immediate barge-in.
                # The speech generator is explicitly cancellable so a new turn
                # cannot leave stale TTS/LLM work speaking over the visitor.
                # Google Chirp 3 already provides streaming interim/final
                # hypotheses and endpointing events. Using the STT turn mode
                # avoids an additional semantic-inference hop that can lag
                # behind realtime and prevents timely barge-in.
                turn_handling=TurnHandlingOptions(
                    turn_detection="stt",
                    endpointing=_voice_endpointing_options(),
                    interruption={
                        "enabled": True,
                        "mode": interruption_mode,
                        # A natural "stop" / "wait" is often shorter than
                        # 500 ms. Let a real one-word barge-in clear TTS
                        # promptly while min_words and the denoised VAD still
                        # reject most clicks and background noise.
                        "min_duration": 0.25,
                        "min_words": 0,
                        "false_interruption_timeout": 0.8,
                        "resume_false_interruption": True,
                        "backchannel_boundary": (0.8, 1.5),
                    },
                    preemptive_generation={
                        "enabled": True,
                        "preemptive_tts": False,
                        "max_speech_duration": 10.0,
                        "max_retries": 1,
                    },
                ),
                aec_warmup_duration=3.0,
                tts_text_transforms=["filter_markdown", "filter_emoji"],
                # Do not turn a quiet visitor into an automatic away/nudge
                # cycle. Support calls may contain long pauses while someone
                # checks a detail; the conversation remains open until the
                # visitor or the call limit ends it.
                user_away_timeout=None,
            )
    except Exception:
        logger.exception(
            "voice worker: selected provider setup failed mode=%s stt=%s tts=%s",
            voice_mode, stt_provider, tts_provider,
        )
        await _publish_setup_error(
            f"Voice setup failed for the selected {stt_provider} speech-to-text and "
            f"{tts_provider} text-to-speech providers. "
            f"{_provider_error_guidance(stt_provider, tts_provider)}"
        )
        return

    def _record_user_input(ev) -> None:
        nonlocal turn_count, last_interaction_at, silence_nudge_stage
        last_interaction_at = time.monotonic()
        silence_nudge_stage = 0
        transcript = (getattr(ev, "transcript", "") or "").strip()
        is_final = bool(getattr(ev, "is_final", False))
        if is_final and transcript:
            turn_count += 1
        # RoomIO's _ParticipantTranscriptionOutput already forwards both
        # interim and final user_input_transcribed events with one stable
        # segment id and the remote visitor identity. Publishing a second
        # segment here made every spoken turn appear twice in the widget.
        logger.info(
            "voice worker: transcript (final=%s, room_io_published=true) %r",
            is_final,
            (getattr(ev, "transcript", "") or "")[:120],
        )

    # Targeted diagnostics (INFO level, so these survive without the earlier
    # DEBUG-dump noise): confirms exactly where a real call's audio pipeline
    # is versus isn't producing signal - was previously impossible to tell
    # apart "visitor never spoke" from "VAD/STT saw speech but no transcript
    # resulted" from "agent speech got falsely interrupted and auto-resumed".
    def _on_user_state(ev) -> None:
        nonlocal last_interaction_at, silence_nudge_stage
        logger.info("voice worker: user_state %s -> %s", ev.old_state, ev.new_state)
        if str(getattr(ev, "new_state", "")).lower() == "speaking":
            last_interaction_at = time.monotonic()
            silence_nudge_stage = 0
    session.on("user_state_changed", _on_user_state)
    session.on("user_input_transcribed", _record_user_input)
    def _record_agent_state(ev) -> None:
        nonlocal first_response_at, last_interaction_at
        state = str(getattr(ev, "new_state", "") or "").lower()
        if state == "speaking":
            last_interaction_at = time.monotonic()
            if first_response_at is None:
                first_response_at = time.monotonic()
    session.on("agent_state_changed", _record_agent_state)
    def _record_close(ev) -> None:
        nonlocal error_count
        if getattr(ev, "error", None) is not None:
            error_count += 1
            logger.error("voice worker: session closed with an error: %s", ev.error)
    session.on("close", _record_close)
    async def _publish_voice_error(message: str) -> None:
        """Tell the widget why audio could not be produced.

        Provider failures otherwise happen in LiveKit's background speech
        task and look like a healthy but silent call. The packet is safe to
        expose because it contains no provider credentials or raw exceptions.
        """
        participant = getattr(ctx.room, "local_participant", None)
        if participant is None:
            return
        try:
            await participant.publish_data(
                json.dumps({"type": "voice_error", "message": message}).encode("utf-8"),
                reliable=True,
            )
        except Exception:
            logger.exception("voice worker: failed to publish voice error packet")

    def _record_session_error(ev) -> None:
        nonlocal error_count
        error_count += 1
        err_obj = getattr(ev, "error", None) or ev
        underlying = getattr(err_obj, "error", err_obj)
        status_code = getattr(underlying, "status_code", None)
        err_str = str(underlying)
        source = getattr(ev, "source", None)
        source_name = getattr(source, "__class__", type(source)).__name__
        logger.error(
            "voice worker: session error source=%s error=%s (status=%s)",
            source_name, err_str, status_code,
        )
        provider = tts_provider if "tts" in source_name.lower() else (stt_provider or "voice")
        if status_code == 402 or "402" in err_str:
            detail = (
                f"{provider.title()} HTTP 402: Insufficient credits or payment required on your provider account. "
                "Please top up your credits or switch TTS provider in the dashboard."
            )
        elif status_code == 401 or "401" in err_str:
            detail = (
                f"{provider.title()} HTTP 401: Invalid API key or unauthorized. "
                "Please verify your provider API key in the dashboard."
            )
        elif status_code == 429 or "429" in err_str:
            detail = f"{provider.title()} HTTP 429: Rate limit or quota exceeded on provider account."
        else:
            detail = f"{provider.title()} audio error: {_provider_error_guidance(stt_provider, tts_provider)}"

        asyncio.create_task(_publish_voice_error(detail))

    session.on("error", _record_session_error)
    session.on(
        "user_transcription_timeout",
        lambda ev: logger.warning("voice worker: user_transcription_timeout - speech detected, no transcript"),
    )
    session.on(
        "agent_false_interruption",
        lambda ev: logger.warning("voice worker: agent_false_interruption - resuming agent speech"),
    )

    if voice_mode == "realtime":
        # Realtime sessions do not pass through ChattyVoiceAgent.llm_node, so
        # persist both committed turns explicitly for widget history.
        def _persist_realtime_item(ev) -> None:
            item = getattr(ev, "item", None)
            role = str(getattr(item, "role", "") or "").lower()
            if role not in {"user", "assistant"}:
                return
            content = (
                getattr(item, "text_content", None)
                or getattr(item, "raw_text_content", None)
                or ""
            ).strip()
            if not content:
                return
            async def _save_realtime_item() -> None:
                try:
                    await run_db(lambda: supabase.table("chatty_conversations").insert({
                        "bot_id": bot_id,
                        "session_id": session_id,
                        "role": role,
                        "sender": "voice",
                        "content": content,
                    }).execute())
                except Exception:
                    logger.exception("voice worker: failed to persist realtime %s conversation item", role)

            asyncio.create_task(_save_realtime_item())

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
            visitor_geo={"country": visitor_country, "language": visitor_language},
            room=ctx.room,
            tts_router=pipeline_tts,
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
            task for task in (max_duration_task, silence_engagement_task)
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
        # Keep assistant transcript delivery aligned with the audio actually
        # being played. Publishing generated text ahead of TTS makes the UI
        # appear to answer before the voice has spoken, which is confusing in
        # a production voice experience. User interim transcription remains
        # live; only assistant output is paced to its spoken audio.
        room_options=room_io.RoomOptions(
            audio_input=audio_input,
            # Accept visitor text sent from the voice composer as a normal
            # user turn. This keeps typed and spoken messages in one context
            # and routes typed turns through the same LLM/TTS response path.
            text_input=room_io.TextInputOptions(text_input_cb=_handle_text_input),
            text_output=room_io.TextOutputOptions(sync_transcription=True),
        ),
    )

    if denoiser is not None and telephony_denoise is not None:
        output_audio = getattr(session.output, "audio", None)
        if output_audio is not None:
            try:
                session.output.audio = telephony_denoise.EchoReferenceTap(
                    denoiser,
                    next_in_chain=output_audio,
                )
                logger.info("voice worker: echo reference tap installed")
            except Exception:
                logger.exception(
                    "voice worker: failed to install echo reference tap; "
                    "continuing with input denoise only"
                )
        else:
            logger.warning(
                "voice worker: denoise enabled but session output audio is unavailable; "
                "continuing with input denoise only"
            )

    async def _speak(text: str):
        """Speak text through the correct LiveKit API for this session mode."""
        started_at = time.monotonic()
        try:
            if voice_mode == "realtime":
                result = await session.generate_reply(instructions=text, input_modality="text")
            else:
                result = await session.say(text)
            # SpeechHandle.__await__ waits for playout but intentionally does
            # not raise its background provider error.  Inspect it explicitly;
            # otherwise an ElevenLabs zero-frame response is logged as a false
            # success and leaves the visitor staring at a silent call.
            speech_error = None
            exception_fn = getattr(result, "exception", None)
            if callable(exception_fn):
                speech_error = exception_fn()
            if speech_error is not None:
                provider = (
                    bot.get("voice_tts_provider") if voice_mode != "realtime"
                    else bot.get("voice_realtime_provider")
                ) or "selected voice provider"
                safe_message = (
                    f"Voice audio failed for the selected {str(provider).strip()} provider. "
                    f"{_provider_error_guidance(tts_provider=str(provider).strip())}"
                )
                logger.error(
                    "voice worker: speech provider failed mode=%s provider=%s chars=%d error=%s",
                    voice_mode, provider, len(text), speech_error,
                )
                await _publish_voice_error(safe_message)
                raise RuntimeError(safe_message) from speech_error
            logger.info(
                "voice worker: speech completed mode=%s chars=%d elapsed_ms=%d",
                voice_mode, len(text), round((time.monotonic() - started_at) * 1000),
            )
            return result
        except RuntimeError as exc:
            # A browser can disconnect between an idle/max-duration timer
            # waking up and the LiveKit session finishing its shutdown. Do not
            # turn that normal race into a noisy worker error.
            if "AgentSession isn't running" in str(exc):
                logger.debug("voice worker: skipped speech after session shutdown")
                return None
            logger.exception("voice worker: speech failed mode=%s chars=%d", voice_mode, len(text))
            raise
        except Exception:
            logger.exception("voice worker: speech failed mode=%s chars=%d", voice_mode, len(text))
            raise

    if voice_mode != "realtime":
        # Greet with the bot's own configured welcome message (same field text
        # chat already shows via GET /api/widget/theme) rather than a generic
        # line, so voice matches the bot's actual branding/tone. session.say
        # (not generate_reply) since there's no user turn yet - this doesn't
        # route through llm_node/run_widget_assistant at all. Realtime mode's
        # own ChattyRealtimeAgent.on_enter already does this greeting itself.
        greeting = _voice_greeting(bot)
        try:
            await _speak(greeting)
        except Exception:
            logger.warning("voice worker: initial greeting failed mode=%s (error reported to widget)", voice_mode)

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

    async def _monitor_silence_and_engage() -> None:
        nonlocal silence_nudge_stage, last_interaction_at, nudge_count
        await asyncio.sleep(8.0)
        try:
            while True:
                await asyncio.sleep(2.0)
                elapsed = time.monotonic() - last_interaction_at
                agent_speaking = False
                try:
                    if hasattr(session, "is_speaking"):
                        agent_speaking = bool(session.is_speaking)
                except Exception:
                    pass
                if agent_speaking:
                    last_interaction_at = time.monotonic()
                    continue

                # Stage 1: visitor quiet for 18 seconds
                if elapsed >= 18.0 and silence_nudge_stage == 0:
                    silence_nudge_stage = 1
                    nudge_count += 1
                    logger.info("voice worker: silence re-engagement stage 1 elapsed=%.1fs", elapsed)
                    if voice_mode == "realtime":
                        await session.generate_reply(
                            instructions="The visitor has been quiet for a moment. In one short, warm sentence (under 12 words), gently check in, e.g. 'I'm right here whenever you're ready—let me know if you have any questions!'",
                            input_modality="text",
                        )
                    else:
                        await _speak("Take your time, I'm right here whenever you're ready.")
                    last_interaction_at = time.monotonic()

                # Stage 2: still quiet 35s after Stage 1
                elif elapsed >= 35.0 and silence_nudge_stage == 1:
                    silence_nudge_stage = 2
                    nudge_count += 1
                    logger.info("voice worker: silence re-engagement stage 2 elapsed=%.1fs", elapsed)
                    if voice_mode == "realtime":
                        await session.generate_reply(
                            instructions="The visitor has been quiet for a while. In one concise sentence, remind them what you can help with or offer to help with pricing, features, or scheduling.",
                            input_modality="text",
                        )
                    else:
                        await _speak("Feel free to ask about our pricing, features, or scheduling a demo whenever you'd like!")
                    last_interaction_at = time.monotonic()

                # Stage 3: still quiet 60s after Stage 2
                elif elapsed >= 60.0 and silence_nudge_stage == 2:
                    silence_nudge_stage = 3
                    nudge_count += 1
                    logger.info("voice worker: silence re-engagement stage 3 elapsed=%.1fs", elapsed)
                    if voice_mode == "realtime":
                        await session.generate_reply(
                            instructions="The visitor has been quiet for a long time. In one very brief sentence, let them know you'll stay right on the line.",
                            input_modality="text",
                        )
                    else:
                        await _speak("Just let me know if you need anything, otherwise I'll stay right here on the line.")
                    last_interaction_at = time.monotonic()
        except asyncio.CancelledError:
            pass
        except Exception:
            logger.exception("voice worker: silence engagement monitor error")

    silence_engagement_task = asyncio.create_task(_monitor_silence_and_engage(), name=f"voice-silence-monitor:{session_id}")

server.setup_fnc = prewarm_fnc


if __name__ == "__main__":
    cli.run_app(server)
