"""Pydantic models for the widget chat/theme/feedback endpoints (/api/widget/*)."""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


class WidgetChatRequest(BaseModel):
    bot_id: str
    session_id: str
    text: str
    visitor_timezone: Optional[str] = "UTC"
    visitor_country: Optional[str] = None
    visitor_name: Optional[str] = None
    visitor_email: Optional[str] = None
    offline_ticket: bool = False
    host: Optional[str] = None  # parent page host, sent by widget.js - advisory only, not trusted
    flow_context: Optional[dict] = None
    ai_paused: bool = False


class WidgetVerifyOriginRequest(BaseModel):
    bot_id: str
    referer: Optional[str] = None


class WidgetContactRequest(BaseModel):
    """A visitor's explicit contact detail for follow-up in the widget."""
    bot_id: str
    session_id: str
    email: str
    marketing_consent: bool = False


class WidgetPushRegistrationRequest(BaseModel):
    """Push identity supplied by OneSignal or a native SDK adapter."""
    bot_id: str
    session_id: Optional[str] = None
    external_id: Optional[str] = None
    subscription_id: Optional[str] = None
    platform: str = "web"
    channel: str = "push"
    metadata: dict = Field(default_factory=dict)


class WidgetChatResponse(BaseModel):
    reply: str
    session_id: str
    ai_paused: bool = False
    sources: Optional[list[dict]] = None
    flow_action: Optional[dict] = None


class WidgetFlowWebhookRequest(BaseModel):
    """A bounded request to execute one published Flow Builder webhook node.

    The client identifies a node, but the URL and mapping are always loaded
    from the bot's persisted active flow by the API. This prevents a visitor
    from turning the public widget endpoint into an arbitrary proxy.
    """
    bot_id: str
    session_id: str
    node_id: str
    input: str = ""
    context: dict = Field(default_factory=dict)


class WidgetMediaResponse(WidgetChatResponse):
    file_url: Optional[str] = None
    file_type: Optional[str] = None
    transcript: Optional[str] = None


class WidgetFeedbackRequest(BaseModel):
    bot_id: str
    session_id: str
    rating: str  # "up" | "down"


class WidgetCampaignEventRequest(BaseModel):
    """A bounded, idempotent campaign telemetry event from the widget."""
    bot_id: str
    campaign_id: str
    event_type: str  # impression | click | conversion
    session_id: Optional[str] = None
    idempotency_key: Optional[str] = None
    metadata: dict = Field(default_factory=dict)


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
    t: Optional[str] = None
    sig: Optional[str] = None


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

