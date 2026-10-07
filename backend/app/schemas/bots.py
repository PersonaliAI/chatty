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
