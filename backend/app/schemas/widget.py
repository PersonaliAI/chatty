"""Pydantic models for the widget chat/theme/feedback endpoints (/api/widget/*)."""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel


class WidgetChatRequest(BaseModel):
    bot_id: str
    session_id: str
    text: str
    visitor_timezone: Optional[str] = "UTC"
    visitor_country: Optional[str] = None
    host: Optional[str] = None  # parent page host, sent by widget.js - advisory only, not trusted


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


class WidgetCsatRequest(BaseModel):
    bot_id: str
    session_id: str
    rating: int  # 1-5 stars
    comment: Optional[str] = None


class WidgetBookingConfirmRequest(BaseModel):
    bot_id: str
    session_id: Optional[str] = None
    start_time: str
    end_time: str
    visitor_timezone: Optional[str] = "UTC"
    visitor_country: Optional[str] = None
    name: str
    email: str
    phone: Optional[str] = ""
    company: Optional[str] = ""
    notes: Optional[str] = ""
    verification_code: Optional[str] = None


class WidgetBookingRescheduleRequest(BaseModel):
    bot_id: str
    session_id: Optional[str] = None
    meeting_id: str
    attendee_email: str
    new_start_time: str
    new_end_time: str
    visitor_timezone: Optional[str] = "UTC"


class WidgetBookingCancelRequest(BaseModel):
    bot_id: str
    session_id: Optional[str] = None
    meeting_id: str
    attendee_email: str
    reason: Optional[str] = None

