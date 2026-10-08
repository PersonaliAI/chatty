"""Request contracts for Chatty's LiveKit voice integration."""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field


class VoiceTokenRequest(BaseModel):
    bot_id: str = Field(min_length=1, max_length=80)
    session_id: str = Field(min_length=1, max_length=160)
    # The Chatty conversation ID is stable across text and voice.  LiveKit
    # rooms, however, must be fresh for every voice connection attempt.
    # Keeping this nonce separate preserves conversation history while making
    # reconnects safe when the browser refreshes a cached TokenSource.
    room_nonce: Optional[str] = Field(default=None, min_length=8, max_length=80)
    participant_name: Optional[str] = Field(default=None, max_length=120)


class VoiceConfigUpdate(BaseModel):
    enabled: Optional[bool] = None
    mode: Optional[Literal["pipeline", "realtime"]] = None
    expression_enabled: Optional[bool] = None
    visualizer: Optional[Literal["wave", "bar", "grid", "radial", "aura"]] = None
    agent_name: Optional[str] = Field(default=None, min_length=1, max_length=80)
    realtime_provider: Optional[Literal["google", "openai", "azure", "aws", "nvidia", "phonic", "spacexai", "ultravox"]] = None
    realtime_model: Optional[str] = Field(default=None, min_length=1, max_length=120)
    realtime_api_key: Optional[str] = Field(default=None, max_length=500)
    llm_provider: Optional[Literal["google", "livekit-inference", "openai", "anthropic", "openrouter"]] = None
    llm_model: Optional[str] = Field(default=None, min_length=1, max_length=120)
    llm_api_key: Optional[str] = Field(default=None, max_length=500)
    stt_provider: Optional[Literal["google", "livekit-inference", "deepgram", "assemblyai", "soniox", "cartesia", "openai"]] = None
    stt_model: Optional[str] = Field(default=None, min_length=1, max_length=120)
    stt_language: Optional[str] = Field(default=None, min_length=2, max_length=20)
    stt_api_key: Optional[str] = Field(default=None, max_length=500)
    tts_provider: Optional[Literal["google", "livekit-inference", "cartesia", "elevenlabs", "openai", "fishaudio"]] = None
    tts_model: Optional[str] = Field(default=None, min_length=1, max_length=120)
    tts_voice: Optional[str] = Field(default=None, min_length=1, max_length=120)
    tts_api_key: Optional[str] = Field(default=None, max_length=500)
    max_duration_minutes: Optional[int] = Field(default=None, ge=1, le=60)
