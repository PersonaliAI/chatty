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


class SessionUpdateRequest(BaseModel):
    bot_id: str
    session_id: str
    status: Optional[str] = None
    priority: Optional[str] = None
    assigned_agent_email: Optional[str] = None
    assigned_agent_name: Optional[str] = None
    ai_paused: Optional[bool] = None
    needs_attention: Optional[bool] = None
    tags: Optional[list[str]] = None
    escalation_reason: Optional[str] = None


class SessionNoteCreateRequest(BaseModel):
    bot_id: str
    session_id: str
    note: str

