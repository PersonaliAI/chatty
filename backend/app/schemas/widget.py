"""Pydantic models for the widget chat/theme/feedback endpoints (/api/widget/*)."""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel


class WidgetChatRequest(BaseModel):
    bot_id: str
    session_id: str
    text: str
    visitor_timezone: Optional[str] = "UTC"
    host: Optional[str] = None  # parent page host, sent by widget.js — advisory only, not trusted


class WidgetVerifyOriginRequest(BaseModel):
    bot_id: str
    referer: Optional[str] = None


class WidgetChatResponse(BaseModel):
    reply: str
    session_id: str
    ai_paused: bool = False
    sources: Optional[list[dict]] = None


class WidgetMediaResponse(WidgetChatResponse):
    file_url: Optional[str] = None
    file_type: Optional[str] = None


class WidgetFeedbackRequest(BaseModel):
    bot_id: str
    session_id: str
    rating: str  # "up" | "down"
