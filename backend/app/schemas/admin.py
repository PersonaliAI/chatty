"""Pydantic models for the dashboard admin/inbox endpoints (/api/admin/*)."""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel


class MessageFeedbackRequest(BaseModel):
    bot_id: str
    rating: Optional[str] = None  # "up" | "down" | None (clears it)
    correction: Optional[str] = None


class InboxReplyRequest(BaseModel):
    bot_id: str
    session_id: str
    text: str


class InboxAIToggle(BaseModel):
    bot_id: str
    session_id: str
    ai_paused: bool


class InboxDeleteRequest(BaseModel):
    bot_id: str
    session_id: str


class RescheduleMeetingRequest(BaseModel):
    new_start: str  # ISO 8601, with timezone offset
    new_end: str
