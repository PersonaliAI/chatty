"""Pydantic models for bot management endpoints (/api/bots/*, /api/bot/*,
/api/generate-business)."""

from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel


class GenerateBusinessRequest(BaseModel):
    bot_id: str
    hint: str = ""


class BYOKUpdate(BaseModel):
    provider: str  # "openai" | "anthropic" | "openrouter" | "" (empty clears BYOK)
    api_key: Optional[str] = None  # plaintext; only sent when setting/replacing the key
    model: Optional[str] = None


class DashboardWebhookCreateRequest(BaseModel):
    url: str
    events: list[str]


class VoiceSettingsUpdate(BaseModel):
    voice_enabled: Optional[bool] = None
    voice_mode: Optional[str] = None  # pipeline | realtime
    voice_stt_provider: Optional[str] = None
    voice_tts_provider: Optional[str] = None
    voice_tts_voice: Optional[str] = None
    voice_stt_api_key: Optional[str] = None  # plaintext; gets encrypted. "" clears it
    voice_tts_api_key: Optional[str] = None  # plaintext; gets encrypted. "" clears it
    voice_agent_role: Optional[str] = None  # general | booking | info | lead
    voice_max_duration_minutes: Optional[int] = None
    # Realtime mode (speech-to-speech: Gemini Live / OpenAI Realtime) — no
    # separate STT/TTS stage, so voice_tts_voice above is reused as the
    # realtime voice (e.g. "Puck"/"marin") rather than adding another column.
    voice_realtime_provider: Optional[str] = None  # google | openai
    voice_realtime_model: Optional[str] = None
    voice_realtime_api_key: Optional[str] = None  # plaintext; gets encrypted. "" clears it
