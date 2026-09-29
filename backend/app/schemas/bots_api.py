from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from pydantic import BaseModel, Field, field_validator, model_validator


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
    max_daily_meetings: Optional[int] = None
    max_weekly_meetings: Optional[int] = None
    google_connected_account_id: Optional[str] = None
    google_calendar_id: Optional[str] = None
    google_calendar_name: Optional[str] = None
    google_drive_folder_id: Optional[str] = None
    google_drive_folder_name: Optional[str] = None


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
    without needing to also restate the other five - update_widget_styling
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
    # sound_enabled/mobile_fullscreen/teaser_delay_seconds - none of which
    # exist on chatty_bots or are read anywhere in the live widget (teaser
    # on/off is actually a per-embed <script data-teaser> attribute, not a
    # bot setting) - plus starter_questions and remove_branding, which are
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
    # by the dashboard Customizer's advanced color pickers - header/
    # sendBtn/inputBar/launcher/botBubble/userBubble). GET /api/widget/theme
    # (app/routers/widget.py) passes it straight through as-is; the actual
    # CSS-injection that makes it win over primary_color/widget_style for
    # any element it covers happens client-side, in both the widget's React
    # embed and the standalone chatty-app.js bundle. A bot customized this
    # way before, then simplified back to a plain primary_color/widget_style
    # change, keeps the old per-element colors fighting the new ones with no
    # way to see or undo it through this API - clear_color_scheme=True
    # resets it to null so primary_color/widget_style fully take over again.
    clear_color_scheme: Optional[bool] = None
    # Seed hex for plugins.color_scheme.generate_color_scheme - a direct
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


class FlowSimulationRequest(BaseModel):
    inputs: list[str] = Field(default_factory=lambda: ["Hello"], max_length=50)
    max_steps: int = Field(100, ge=1, le=500)
    context: dict[str, Any] = Field(default_factory=dict, max_length=100)
    # A dashboard dry-run may test an unsaved canvas.  These are deliberately
    # optional so replay can continue to use the immutable run snapshot, but
    # when one is present the other must be supplied as well.
    nodes: Optional[list[dict[str, Any]]] = Field(None, max_length=200)
    edges: Optional[list[dict[str, Any]]] = Field(None, max_length=500)

    @field_validator("inputs")
    @classmethod
    def validate_inputs(cls, value: list[str]) -> list[str]:
        cleaned = [str(item)[:4000] for item in value]
        return cleaned or ["Hello"]

    @field_validator("context")
    @classmethod
    def validate_context(cls, value: dict[str, Any]) -> dict[str, Any]:
        # The dry-run context is intentionally bounded. It is operator-supplied
        # test data, never a source of executable expressions.
        if len(value) > 100:
            raise ValueError("flow simulation context may contain at most 100 fields")
        return value

    @model_validator(mode="after")
    def validate_draft_graph_shape(self) -> "FlowSimulationRequest":
        if (self.nodes is None) != (self.edges is None):
            raise ValueError("flow simulation requires both nodes and edges when testing a draft")
        if self.nodes is not None:
            # Reuse the publish contract: a dry-run must never silently accept
            # a graph that would later be rejected at publish time.
            FlowVersionCreateRequest(nodes=self.nodes, edges=self.edges or [], status="draft")
        return self


class FlowVersionCreateRequest(BaseModel):
    nodes: list[dict[str, Any]] = Field(default_factory=list, max_length=200)
    edges: list[dict[str, Any]] = Field(default_factory=list, max_length=500)
    status: str = Field("draft", pattern="^(draft|published)$")
    note: Optional[str] = Field(None, max_length=500)

    @model_validator(mode="after")
    def validate_graph(self) -> "FlowVersionCreateRequest":
        """Reject malformed graphs before they can be published or executed.

        Loops are intentionally allowed (they are a first-class node), but all
        references must resolve and node IDs must be stable and unique. This
        keeps version history/replay deterministic and prevents runtime walks
        from silently disappearing at dangling edges.
        """
        node_ids: list[str] = []
        start_nodes = 0
        for node in self.nodes:
            raw_id = node.get("id")
            if not isinstance(raw_id, str) or not raw_id.strip() or len(raw_id) > 128:
                raise ValueError("every flow node must have a non-empty id (max 128 characters)")
            node_id = raw_id.strip()
            if node_id in node_ids:
                raise ValueError(f"duplicate flow node id: {node_id}")
            node_ids.append(node_id)
            if str(node.get("type") or "").strip().lower() in {"start", "input"} or node_id == "start":
                start_nodes += 1
            data = node.get("data")
            if data is not None and not isinstance(data, dict):
                raise ValueError("flow node data must be an object")
            config = data.get("config") if isinstance(data, dict) else None
            if config is not None and not isinstance(config, dict):
                raise ValueError("flow node config must be an object")
            if isinstance(config, dict):
                mapping = config.get("mapping")
                if mapping is not None:
                    if not isinstance(mapping, dict) or len(mapping) > 100:
                        raise ValueError("flow mapping must be an object with at most 100 fields")
                    if any(not isinstance(key, str) or not key.strip() or len(key) > 128 for key in mapping):
                        raise ValueError("flow mapping keys must be non-empty strings of at most 128 characters")
                    if any(not isinstance(value, (str, int, float, bool, list, dict)) and value is not None for value in mapping.values()):
                        raise ValueError("flow mapping values must be JSON-compatible")
                expression = config.get("expression")
                if expression is not None and (not isinstance(expression, str) or len(expression) > 2000):
                    raise ValueError("flow condition expressions must be strings of at most 2000 characters")
        if self.nodes and start_nodes != 1:
            raise ValueError(f"a flow must contain exactly one Start node (found {start_nodes})")
        known = set(node_ids)
        edge_ids: set[str] = set()
        for edge in self.edges:
            edge_id = edge.get("id")
            if edge_id is not None:
                if not isinstance(edge_id, str) or not edge_id.strip() or len(edge_id) > 128:
                    raise ValueError("flow edge ids must be non-empty strings of at most 128 characters")
                if edge_id in edge_ids:
                    raise ValueError(f"duplicate flow edge id: {edge_id}")
                edge_ids.add(edge_id)
            source = edge.get("source")
            target = edge.get("target")
            if not isinstance(source, str) or source not in known:
                raise ValueError("flow edge source must reference an existing node")
            if not isinstance(target, str) or target not in known:
                raise ValueError("flow edge target must reference an existing node")
        return self


def _parse_campaign_datetime(value: Optional[str], field_name: str) -> Optional[datetime]:
    if value is None or not str(value).strip():
        return None
    try:
        parsed = datetime.fromisoformat(str(value).strip().replace("Z", "+00:00"))
    except ValueError as exc:
        raise ValueError(f"{field_name} must be a valid ISO-8601 datetime") from exc
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed


def _normalize_audience_rules(value: dict[str, Any]) -> dict[str, Any]:
    rules = dict(value or {})
    segment = str(rules.get("segment", "all")).strip().lower()
    if segment not in {"all", "returning", "high_intent"}:
        raise ValueError("audience segment must be all, returning, or high_intent")
    try:
        score = int(rules.get("min_intent_score", 0))
    except (TypeError, ValueError) as exc:
        raise ValueError("audience min_intent_score must be an integer") from exc
    if score < 0 or score > 100:
        raise ValueError("audience min_intent_score must be between 0 and 100")
    return {
        "segment": segment,
        "min_intent_score": score,
        "returning_only": bool(rules.get("returning_only", segment == "returning")),
    }


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
    audience_rules: dict[str, Any] = Field(default_factory=dict)
    channels: list[str] = Field(default_factory=lambda: ["web"])
    sequence_steps: list[dict[str, Any]] = Field(default_factory=list)
    safety_config: dict[str, Any] = Field(default_factory=dict)
    schedule_config: dict[str, Any] = Field(default_factory=dict)

    @field_validator("campaign_type")
    @classmethod
    def validate_campaign_type(cls, value: str) -> str:
        value = value.strip().lower()
        if value not in {"chat_bubble", "popup_modal", "top_banner", "slide_in"}:
            raise ValueError("campaign_type is invalid")
        return value

    @field_validator("trigger_type")
    @classmethod
    def validate_trigger_type(cls, value: str) -> str:
        value = value.strip().lower()
        if value not in {"time_on_page", "scroll_percentage", "exit_intent", "url_match"}:
            raise ValueError("trigger_type is invalid")
        return value

    @field_validator("trigger_value")
    @classmethod
    def validate_trigger_value(cls, value: int) -> int:
        if value < 0 or value > 86_400:
            raise ValueError("trigger_value must be between 0 and 86400")
        return value

    @field_validator("channels")
    @classmethod
    def validate_channels(cls, value: list[str]) -> list[str]:
        allowed = {"web", "email", "whatsapp", "sms"}
        normalized = list(dict.fromkeys(str(item).strip().lower() for item in value if str(item).strip()))
        if not normalized or any(item not in allowed for item in normalized):
            raise ValueError("channels must contain only web, email, whatsapp, or sms")
        if len(normalized) > 4:
            raise ValueError("a campaign may use at most four channels")
        return normalized

    @field_validator("audience_rules")
    @classmethod
    def validate_audience_rules(cls, value: dict[str, Any]) -> dict[str, Any]:
        return _normalize_audience_rules(value)

    @field_validator("sequence_steps")
    @classmethod
    def validate_sequence_steps(cls, value: list[dict[str, Any]]) -> list[dict[str, Any]]:
        if len(value) > 20:
            raise ValueError("a campaign sequence may contain at most 20 steps")
        clean: list[dict[str, Any]] = []
        for step in value:
            if not isinstance(step, dict):
                raise ValueError("sequence steps must be objects")
            channel = str(step.get("channel") or "web").strip().lower()
            if channel not in {"web", "email", "whatsapp", "sms"}:
                raise ValueError("sequence step channel is invalid")
            delay = step.get("after_minutes", 0)
            try:
                delay_num = int(delay)
            except (TypeError, ValueError) as exc:
                raise ValueError("sequence step after_minutes must be an integer") from exc
            if delay_num < 0 or delay_num > 43_200:
                raise ValueError("sequence step delay must be between 0 and 43200 minutes")
            clean.append({**step, "channel": channel, "after_minutes": delay_num})
        return clean

    @field_validator("safety_config")
    @classmethod
    def validate_safety_config(cls, value: dict[str, Any]) -> dict[str, Any]:
        config = dict(value or {})
        try:
            cap = int(config.get("frequency_cap_hours", 24))
        except (TypeError, ValueError) as exc:
            raise ValueError("frequency_cap_hours must be an integer") from exc
        if cap < 1 or cap > 8_760:
            raise ValueError("frequency_cap_hours must be between 1 and 8760")
        config["frequency_cap_hours"] = cap
        config["require_consent"] = bool(config.get("require_consent", True))
        quiet = config.get("quiet_hours")
        if quiet is not None:
            if not isinstance(quiet, dict):
                raise ValueError("quiet_hours must be an object")
            for bound in ("start", "end"):
                raw = str(quiet.get(bound, ""))
                try:
                    datetime.strptime(raw, "%H:%M")
                except ValueError as exc:
                    raise ValueError("quiet_hours start/end must use HH:MM") from exc
            config["quiet_hours"] = {"start": str(quiet["start"]), "end": str(quiet["end"])}
        return config

    @field_validator("schedule_config")
    @classmethod
    def validate_schedule_config(cls, value: dict[str, Any]) -> dict[str, Any]:
        config = dict(value or {})
        cadence = str(config.get("cadence", "once")).strip().lower()
        if cadence not in {"once", "hourly", "daily", "weekly"}:
            raise ValueError("cadence must be once, hourly, daily, or weekly")
        timezone = str(config.get("timezone", "UTC")).strip()[:64] or "UTC"
        try:
            ZoneInfo(timezone)
        except ZoneInfoNotFoundError as exc:
            raise ValueError("schedule timezone must be a valid IANA timezone") from exc
        config.update({"cadence": cadence, "timezone": timezone})
        return config

    @model_validator(mode="after")
    def validate_date_window(self) -> "CampaignCreateRequest":
        start = _parse_campaign_datetime(self.start_date, "start_date")
        end = _parse_campaign_datetime(self.end_date, "end_date")
        if start and end and start >= end:
            raise ValueError("start_date must be earlier than end_date")
        # A sequence is authoritative for delivery: automatically include any
        # channel used by a step so AI-generated sequences remain runnable.
        self.channels = list(dict.fromkeys([*self.channels, *(step["channel"] for step in self.sequence_steps)]))
        return self


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
    audience_rules: Optional[dict[str, Any]] = None
    channels: Optional[list[str]] = None
    sequence_steps: Optional[list[dict[str, Any]]] = None
    safety_config: Optional[dict[str, Any]] = None
    schedule_config: Optional[dict[str, Any]] = None

    @field_validator("audience_rules")
    @classmethod
    def validate_update_audience_rules(cls, value: Optional[dict[str, Any]]) -> Optional[dict[str, Any]]:
        return _normalize_audience_rules(value) if value is not None else value

    @field_validator("campaign_type")
    @classmethod
    def validate_update_campaign_type(cls, value: Optional[str]) -> Optional[str]:
        return CampaignCreateRequest.validate_campaign_type(value) if value is not None else value

    @field_validator("trigger_type")
    @classmethod
    def validate_update_trigger_type(cls, value: Optional[str]) -> Optional[str]:
        return CampaignCreateRequest.validate_trigger_type(value) if value is not None else value

    @field_validator("trigger_value")
    @classmethod
    def validate_update_trigger_value(cls, value: Optional[int]) -> Optional[int]:
        return CampaignCreateRequest.validate_trigger_value(value) if value is not None else value

    @field_validator("channels")
    @classmethod
    def validate_update_channels(cls, value: Optional[list[str]]) -> Optional[list[str]]:
        if value is None:
            return value
        return CampaignCreateRequest.validate_channels(value)

    @field_validator("sequence_steps")
    @classmethod
    def validate_update_sequence(cls, value: Optional[list[dict[str, Any]]]) -> Optional[list[dict[str, Any]]]:
        if value is None:
            return value
        return CampaignCreateRequest.validate_sequence_steps(value)

    @field_validator("safety_config")
    @classmethod
    def validate_update_safety(cls, value: Optional[dict[str, Any]]) -> Optional[dict[str, Any]]:
        if value is None:
            return value
        return CampaignCreateRequest.validate_safety_config(value)

    @field_validator("schedule_config")
    @classmethod
    def validate_update_schedule(cls, value: Optional[dict[str, Any]]) -> Optional[dict[str, Any]]:
        if value is None:
            return value
        return CampaignCreateRequest.validate_schedule_config(value)

    @model_validator(mode="after")
    def validate_update_date_window(self) -> "CampaignUpdateRequest":
        start = _parse_campaign_datetime(self.start_date, "start_date")
        end = _parse_campaign_datetime(self.end_date, "end_date")
        if start and end and start >= end:
            raise ValueError("start_date must be earlier than end_date")
        if self.channels is not None and self.sequence_steps is not None:
            self.channels = list(dict.fromkeys([*self.channels, *(step["channel"] for step in self.sequence_steps)]))
        return self


class CampaignSuggestRequest(BaseModel):
    goal: str = Field(..., min_length=3, max_length=500)
    audience: Optional[str] = Field(None, max_length=500)


class VoiceAgentConfigRequest(BaseModel):
    # Matches app/routers/bots.py's real voice-settings columns exactly -
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
    # (text[], default {name,email} - the fields plugins/widget_brain.py
    # actually requires before capturing a lead). There's no trigger_timing,
    # custom_fields, or crm_destination column or consumer anywhere in this
    # codebase - the earlier version of this schema declared them but
    # bots_service.configure_lead_capture silently dropped them on write.
    enabled: bool = True
    collect_name: bool = True
    collect_email: bool = True
    collect_phone: bool = False


class CalendarIntegrationRequest(BaseModel):
    # chatty_bots has calendar_scheduling_enabled, scheduling_duration_minutes,
    # bot_timezone, sync_google_calendar, sync_outlook_calendar/
    # sync_office365_calendar, and meeting_provider (the video-call link
    # generator, e.g. google_meet/zoom) - there's no available_days/
    # working_hours_start/working_hours_end column or business-hours check
    # anywhere in the booking flow (plugins/agent_tools.py books whatever
    # time is requested); the earlier version of this schema declared those
    # three plus a "provider" field that don't map to any real column.
    enabled: bool = True
    provider: str = Field("google_calendar", description="google_calendar, microsoft_outlook, or office365")
    meeting_duration_minutes: int = 30
    timezone: str = "UTC"
    max_daily_meetings: Optional[int] = 0
    max_weekly_meetings: Optional[int] = 0
    booking_email_verification: Optional[bool] = False
    booking_block_disposable_emails: Optional[bool] = False
    booking_limit_one_active: Optional[bool] = False
    booking_require_business_email: Optional[bool] = False


class GuardrailsConfigRequest(BaseModel):
    strict_mode: bool = True
    blocked_topics: Optional[list[str]] = None
    blocked_keywords: Optional[list[str]] = None
    fallback_message: Optional[str] = None


class BYOKConfigRequest(BaseModel):
    provider: str = Field(..., description="openai, openrouter, anthropic")
    api_key: Optional[str] = Field(None, min_length=1, description="Plaintext in the request only - stored encrypted, never returned")
    model: Optional[str] = None


class TeamMemberRequest(BaseModel):
    email: str = Field(..., min_length=3)
    role: str = Field("agent", description="admin or agent - an invite can never grant owner")


class NotificationsConfigRequest(BaseModel):
    # chatty_bots.notification_emails is the only real column here - Slack/
    # Discord/custom alerting is the separate chatty_webhooks subscription
    # system (see bots_service.create_webhook_subscription), not a per-bot
    # webhook URL field.
    admin_emails: list[str] = Field(default_factory=list)
