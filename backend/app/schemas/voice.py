"""Pydantic models for the voice-agent token endpoint (/api/widget/voice/*)."""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel


class VoiceTokenRequest(BaseModel):
    bot_id: str
    session_id: Optional[str] = None
    visitor_timezone: str = "UTC"


class VoiceTokenResponse(BaseModel):
    token: str
    livekit_url: str
    room_name: str
    session_id: str
