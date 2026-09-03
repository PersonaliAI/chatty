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


class SectionColorsInput(BaseModel):
    bg: Optional[str] = None
    text: Optional[str] = None
    icon: Optional[str] = None


class WidgetColorSchemeInput(BaseModel):
    """Mirrors WidgetColorScheme in chatty/src/lib/color-contrast.ts. Every
    section is optional so a caller can set just one (e.g. only `header`)
    without needing to also restate the other five — update_widget_styling
    merges whatever's given here on top of the bot's existing color_scheme,
    section by section, field by field."""
    header: Optional[SectionColorsInput] = None
    botBubble: Optional[SectionColorsInput] = None
    userBubble: Optional[SectionColorsInput] = None
    inputBar: Optional[SectionColorsInput] = None
    sendBtn: Optional[SectionColorsInput] = None
    launcher: Optional[SectionColorsInput] = None


class WidgetStylingUpdateRequest(BaseModel):
    # Matches app/routers/widget.py's real theme columns exactly. The
    # earlier version of this schema had position/teaser_enabled/
    # sound_enabled/mobile_fullscreen/teaser_delay_seconds — none of which
    # exist on chatty_bots or are read anywhere in the live widget (teaser
    # on/off is actually a per-embed <script data-teaser> attribute, not a
    # bot setting) — plus starter_questions and remove_branding, which are
    # real features under different column names (conversation_starters,
    # hide_branding).
    primary_color: Optional[str] = None
    widget_style: Optional[str] = None
    avatar_url: Optional[str] = None
    avatar_icon: Optional[str] = None
    header_logo_url: Optional[str] = None
    teaser_message: Optional[str] = None
    conversation_starters: Optional[list[str]] = None
    custom_css: Optional[str] = None
    hide_branding: Optional[bool] = None
    # chatty_bots.color_scheme is a separate, per-element hex override (set
    # by the dashboard Customizer's advanced color pickers — header/
    # sendBtn/inputBar/launcher/botBubble/userBubble). GET /api/widget/theme
    # (app/routers/widget.py) passes it straight through as-is; the actual
    # CSS-injection that makes it win over primary_color/widget_style for
    # any element it covers happens client-side, in both the widget's React
    # embed and the standalone chatty-app.js bundle. A bot customized this
    # way before, then simplified back to a plain primary_color/widget_style
    # change, keeps the old per-element colors fighting the new ones with no
    # way to see or undo it through this API — clear_color_scheme=True
    # resets it to null so primary_color/widget_style fully take over again.
    clear_color_scheme: Optional[bool] = None
    # Seed hex for plugins.color_scheme.generate_color_scheme — a direct
    # Python port of generateColorScheme in color-contrast.ts (verified
    # byte-identical output against the real TS source for the same seed),
    # so "auto-generate from this color" gives the same result whether
    # triggered here or from the dashboard's own Auto-generate button.
    # Applied first; any section/field also set via `color_scheme` below
    # overrides the generated value for that field.
    auto_generate_color_scheme: Optional[str] = None
    color_scheme: Optional[WidgetColorSchemeInput] = None


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
    # chatty_bots only has lead_capture_enabled (bool) and lead_required_fields
    # (text[], default {name,email} — the fields plugins/widget_brain.py
    # actually requires before capturing a lead). There's no trigger_timing,
    # custom_fields, or crm_destination column or consumer anywhere in this
    # codebase — the earlier version of this schema declared them but
    # bots_service.configure_lead_capture silently dropped them on write.
    enabled: bool = True
    collect_name: bool = True
    collect_email: bool = True
    collect_phone: bool = False


class CalendarIntegrationRequest(BaseModel):
    # chatty_bots has calendar_scheduling_enabled, scheduling_duration_minutes,
    # bot_timezone, sync_google_calendar, sync_outlook_calendar/
    # sync_office365_calendar, and meeting_provider (the video-call link
    # generator, e.g. google_meet/zoom) — there's no available_days/
    # working_hours_start/working_hours_end column or business-hours check
    # anywhere in the booking flow (plugins/agent_tools.py books whatever
    # time is requested); the earlier version of this schema declared those
    # three plus a "provider" field that don't map to any real column.
    enabled: bool = True
    provider: str = Field("google_calendar", description="google_calendar, microsoft_outlook, or office365")
    meeting_duration_minutes: int = 30
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
    # chatty_bots.notification_emails is the only real column here — Slack/
    # Discord/custom alerting is the separate chatty_webhooks subscription
    # system (see bots_service.create_webhook_subscription), not a per-bot
    # webhook URL field.
    admin_emails: list[str] = Field(default_factory=list)
