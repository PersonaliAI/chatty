from __future__ import annotations

from typing import Any, Optional
from pydantic import BaseModel, Field


class BotCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    welcome_message: Optional[str] = None
    system_instructions: Optional[str] = None
    selected_model: Optional[str] = None
    primary_color: Optional[str] = None
    response_language: Optional[str] = None


class BotUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    welcome_message: Optional[str] = None
    system_instructions: Optional[str] = None
    selected_model: Optional[str] = None
    primary_color: Optional[str] = None
    widget_style: Optional[str] = None
    response_language: Optional[str] = None
    strict_mode: Optional[bool] = None
    lead_capture_enabled: Optional[bool] = None


class KnowledgeTextCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    content: str = Field(..., min_length=1, max_length=100_000)


class WidgetStylingUpdateRequest(BaseModel):
    primary_color: Optional[str] = None
    widget_style: Optional[str] = None
    position: Optional[str] = None
    avatar_url: Optional[str] = None
    avatar_icon: Optional[str] = None
    header_logo_url: Optional[str] = None
    teaser_enabled: Optional[bool] = None
    teaser_message: Optional[str] = None
    teaser_delay_seconds: Optional[int] = None
    sound_enabled: Optional[bool] = None
    mobile_fullscreen: Optional[bool] = None
    starter_questions: Optional[list[str]] = None
    custom_css: Optional[str] = None
    remove_branding: Optional[bool] = None


class FlowUpdateRequest(BaseModel):
    nodes: list[dict[str, Any]] = Field(default_factory=list)
    edges: list[dict[str, Any]] = Field(default_factory=list)
    is_active: bool = True


class CampaignCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    campaign_type: str = Field("chat_bubble", description="chat_bubble, popup_modal, top_banner, slide_in")
    message_content: str = Field(..., min_length=1)
    url_patterns: list[str] = Field(default_factory=lambda: ["*"])
    trigger_type: str = Field("time_on_page", description="time_on_page, scroll_percentage, exit_intent")
    trigger_value: int = Field(5, description="seconds or percentage")
    target_devices: list[str] = Field(default_factory=lambda: ["desktop", "mobile"])
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    is_active: bool = True


class CampaignUpdateRequest(BaseModel):
    name: Optional[str] = None
    campaign_type: Optional[str] = None
    message_content: Optional[str] = None
    url_patterns: Optional[list[str]] = None
    trigger_type: Optional[str] = None
    trigger_value: Optional[int] = None
    target_devices: Optional[list[str]] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    is_active: Optional[bool] = None


class VoiceAgentConfigRequest(BaseModel):
    # Matches app/routers/bots.py's real voice-settings columns exactly —
    # the earlier version of this schema (tts_provider/voice_id/
    # voice_temperature/vad_sensitivity/endpointing_delay_ms/...) named
    # columns that don't exist on chatty_bots at all.
    enabled: Optional[bool] = None
    voice_mode: Optional[str] = Field(None, description="pipeline or realtime")
    voice_stt_provider: Optional[str] = None
    voice_tts_provider: Optional[str] = None
    voice_tts_voice: Optional[str] = None


class LeadCaptureConfigRequest(BaseModel):
    enabled: bool = True
    trigger_timing: str = Field("mid_conversation", description="pre_chat, mid_conversation, post_chat")
    collect_name: bool = True
    collect_email: bool = True
    collect_phone: bool = False
    custom_fields: Optional[list[str]] = None
    crm_destination: Optional[str] = None


class CalendarIntegrationRequest(BaseModel):
    provider: str = Field("google_calendar", description="google_calendar, microsoft_outlook")
    meeting_duration_minutes: int = 30
    available_days: list[str] = Field(default_factory=lambda: ["mon", "tue", "wed", "thu", "fri"])
    working_hours_start: str = "09:00"
    working_hours_end: str = "17:00"
    timezone: str = "UTC"


class GuardrailsConfigRequest(BaseModel):
    strict_mode: bool = True
    blocked_topics: Optional[list[str]] = None
    blocked_keywords: Optional[list[str]] = None
    fallback_message: Optional[str] = None


class BYOKConfigRequest(BaseModel):
    provider: str = Field(..., description="openai, openrouter, anthropic")
    api_key: Optional[str] = Field(None, min_length=1, description="Plaintext in the request only — stored encrypted, never returned")
    model: Optional[str] = None


class TeamMemberRequest(BaseModel):
    email: str = Field(..., min_length=3)
    role: str = Field("agent", description="admin or agent — an invite can never grant owner")


class NotificationsConfigRequest(BaseModel):
    admin_emails: list[str] = Field(default_factory=list)
    slack_webhook_url: Optional[str] = None
    discord_webhook_url: Optional[str] = None
    notify_on_lead: bool = True
    notify_on_human_escalation: bool = True
