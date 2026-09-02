"""MCP (Model Context Protocol) server exposing Chatty bot management as
tools, resources, and prompts an MCP client (Claude Desktop, Cursor, Windsurf, etc.)
can call, authenticated via OAuth2 access tokens issued by app/routers/oauth.py.

Deliberately NO `from __future__ import annotations` here: FastMCP's @mcp.tool()
decorator inspects each tool function's real parameter type objects via
inspect.signature() at import time.
"""

import json
import logging
from typing import Any, Optional, List, Dict

from mcp.server.auth.middleware.auth_context import get_access_token
from mcp.server.auth.provider import AccessToken, TokenVerifier
from mcp.server.auth.settings import AuthSettings
from mcp.server.fastmcp import FastMCP
from pydantic import AnyHttpUrl

from app.core import oauth as _oauth
from app.schemas.bots_api import (
    BotCreateRequest,
    BotUpdateRequest,
    WidgetStylingUpdateRequest,
    FlowUpdateRequest,
    CampaignCreateRequest,
    CampaignUpdateRequest,
    VoiceAgentConfigRequest,
    LeadCaptureConfigRequest,
    CalendarIntegrationRequest,
    GuardrailsConfigRequest,
    BYOKConfigRequest,
    TeamMemberRequest,
    NotificationsConfigRequest,
)
from app.services import (
    bots_service,
    mcp_design_service,
    mcp_flow_service,
    mcp_campaign_service,
    mcp_voice_service,
    mcp_inbox_service,
)

logger = logging.getLogger("chatty")

_BACKEND_BASE_URL = "https://api.chatty.personaliai.com"
_MCP_RESOURCE_URL = f"{_BACKEND_BASE_URL}/mcp"


class ChattyTokenVerifier(TokenVerifier):
    async def verify_token(self, token: str) -> Optional[AccessToken]:
        try:
            row = await _oauth.resolve_access_token(f"Bearer {token}")
        except Exception:
            return None
        return AccessToken(
            token=token,
            client_id=row["client_id"],
            scopes=(row.get("scope") or "").split(),
            expires_at=None,
        )


mcp = FastMCP(
    name="chatty",
    instructions=(
        "Full-featured MCP server for Chatty AI chatbots: create, customize, and manage "
        "bots, flows, campaigns, voice agents, knowledge bases, lead capture, calendar meetings, "
        "analytics, and design audits."
    ),
    token_verifier=ChattyTokenVerifier(),
    auth=AuthSettings(
        issuer_url=AnyHttpUrl(_BACKEND_BASE_URL),
        resource_server_url=AnyHttpUrl(_MCP_RESOURCE_URL),
        required_scopes=["chat"],
    ),
)


async def _current_principal() -> dict:
    access_token = get_access_token()
    if access_token is None:
        raise RuntimeError("No authenticated MCP session")
    row = await _oauth.resolve_access_token(f"Bearer {access_token.token}")
    return {
        "auth_type": "oauth",
        "user_id": row["user_id"],
        "scopes": (row.get("scope") or "").split(),
        "client_id": row["client_id"],
    }


# ===========================================================================
# 1. BOT LIFECYCLE (Create, List, Get, Update, Clone, Delete)
# ===========================================================================


@mcp.tool()
async def list_chatbots() -> list:
    """List every chatbot owned or accessible by the authenticated user's account."""
    principal = await _current_principal()
    _oauth.check_principal_scope(principal, "read")
    return await bots_service.list_bots(principal)


@mcp.tool()
async def create_chatbot(
    name: str,
    welcome_message: Optional[str] = None,
    system_instructions: Optional[str] = None,
    selected_model: Optional[str] = None,
    primary_color: Optional[str] = None,
    response_language: Optional[str] = None,
) -> dict:
    """Create a new Chatty AI chatbot with initial identity and settings."""
    principal = await _current_principal()
    _oauth.check_principal_scope(principal, "write")
    body = BotCreateRequest(
        name=name,
        welcome_message=welcome_message,
        system_instructions=system_instructions,
        selected_model=selected_model,
        primary_color=primary_color,
        response_language=response_language,
    )
    return await bots_service.create_bot(principal, body)


@mcp.tool()
async def get_chatbot(bot_id: str) -> dict:
    """Get full configuration details for a single chatbot by ID."""
    principal = await _current_principal()
    _oauth.check_principal_scope(principal, "read")
    return await bots_service.get_bot(principal, bot_id)


@mcp.tool()
async def update_chatbot(
    bot_id: str,
    name: Optional[str] = None,
    welcome_message: Optional[str] = None,
    system_instructions: Optional[str] = None,
    selected_model: Optional[str] = None,
    primary_color: Optional[str] = None,
    widget_style: Optional[str] = None,
    response_language: Optional[str] = None,
    strict_mode: Optional[bool] = None,
    lead_capture_enabled: Optional[bool] = None,
) -> dict:
    """Update settings for an existing chatbot (only passed fields are modified)."""
    principal = await _current_principal()
    _oauth.check_principal_scope(principal, "write")
    body = BotUpdateRequest(
        name=name,
        welcome_message=welcome_message,
        system_instructions=system_instructions,
        selected_model=selected_model,
        primary_color=primary_color,
        widget_style=widget_style,
        response_language=response_language,
        strict_mode=strict_mode,
        lead_capture_enabled=lead_capture_enabled,
    )
    return await bots_service.update_bot(principal, bot_id, body)


@mcp.tool()
async def clone_chatbot(bot_id: str, new_name: str) -> dict:
    """Clone an existing chatbot into a new bot instance."""
    principal = await _current_principal()
    _oauth.check_principal_scope(principal, "write")
    return await bots_service.clone_bot(principal, bot_id, new_name)


@mcp.tool()
async def delete_chatbot(bot_id: str) -> dict:
    """Delete a chatbot permanently."""
    principal = await _current_principal()
    _oauth.check_principal_scope(principal, "admin")
    return await bots_service.delete_bot(principal, bot_id)


# ===========================================================================
# 2. CUSTOMIZER & DESIGN STUDIO (Styling, WCAG Audit, HTML Sandbox, SDKs)
# ===========================================================================


@mcp.tool()
async def customize_widget_styling(
    bot_id: str,
    primary_color: Optional[str] = None,
    widget_style: Optional[str] = None,
    position: Optional[str] = None,
    avatar_url: Optional[str] = None,
    avatar_icon: Optional[str] = None,
    header_logo_url: Optional[str] = None,
    teaser_enabled: Optional[bool] = None,
    teaser_message: Optional[str] = None,
    teaser_delay_seconds: Optional[int] = None,
    sound_enabled: Optional[bool] = None,
    mobile_fullscreen: Optional[bool] = None,
    starter_questions: Optional[List[str]] = None,
    custom_css: Optional[str] = None,
    remove_branding: Optional[bool] = None,
) -> dict:
    """Customize widget appearance, colors, launcher, teaser bubble, and CSS."""
    principal = await _current_principal()
    _oauth.check_principal_scope(principal, "write")
    body = WidgetStylingUpdateRequest(
        primary_color=primary_color,
        widget_style=widget_style,
        position=position,
        avatar_url=avatar_url,
        avatar_icon=avatar_icon,
        header_logo_url=header_logo_url,
        teaser_enabled=teaser_enabled,
        teaser_message=teaser_message,
        teaser_delay_seconds=teaser_delay_seconds,
        sound_enabled=sound_enabled,
        mobile_fullscreen=mobile_fullscreen,
        starter_questions=starter_questions,
        custom_css=custom_css,
        remove_branding=remove_branding,
    )
    return await bots_service.update_widget_styling(principal, bot_id, body)


@mcp.tool()
async def analyze_widget_design(bot_id: str) -> dict:
    """Evaluate widget WCAG contrast ratios, mobile ergonomics, and microcopy."""
    principal = await _current_principal()
    _oauth.check_principal_scope(principal, "read")
    return await mcp_design_service.analyze_widget_design(principal, bot_id)


@mcp.tool()
async def preview_widget_html(bot_id: str, test_theme: str = "light") -> str:
    """Generate a standalone live HTML preview of the customized Shadow-DOM widget."""
    principal = await _current_principal()
    _oauth.check_principal_scope(principal, "read")
    return await mcp_design_service.preview_widget_html(principal, bot_id, test_theme)


@mcp.tool()
async def generate_embed_code(bot_id: str, framework: str = "html_script") -> dict:
    """Generate embed code for HTML, Next.js, WordPress, Shopify, iOS, or Android."""
    principal = await _current_principal()
    _oauth.check_principal_scope(principal, "read")
    return await mcp_design_service.generate_embed_code(principal, bot_id, framework)


# ===========================================================================
# 3. VISUAL FLOW BUILDER
# ===========================================================================


@mcp.tool()
async def generate_flow_with_ai(bot_id: str, description: str) -> dict:
    """Generate a visual conversational React Flow schema using AI."""
    principal = await _current_principal()
    _oauth.check_principal_scope(principal, "write")
    return await mcp_flow_service.generate_flow_with_ai(principal, bot_id, description)


@mcp.tool()
async def get_bot_flow(bot_id: str) -> dict:
    """Get the visual conversational flow nodes and edges for a bot."""
    principal = await _current_principal()
    _oauth.check_principal_scope(principal, "read")
    return await mcp_flow_service.get_bot_flow(principal, bot_id)


@mcp.tool()
async def update_bot_flow(bot_id: str, nodes: List[Dict[str, Any]], edges: List[Dict[str, Any]], is_active: bool = True) -> dict:
    """Update and activate/deactivate a visual flow schema for a bot."""
    principal = await _current_principal()
    _oauth.check_principal_scope(principal, "write")
    body = FlowUpdateRequest(nodes=nodes, edges=edges, is_active=is_active)
    return await mcp_flow_service.update_bot_flow(principal, bot_id, body)


@mcp.tool()
async def simulate_flow_execution(bot_id: str, simulated_user_inputs: List[str]) -> dict:
    """Simulate user interactions through the bot's visual flow."""
    principal = await _current_principal()
    _oauth.check_principal_scope(principal, "read")
    return await mcp_flow_service.simulate_flow_execution(principal, bot_id, simulated_user_inputs)


# ===========================================================================
# 4. PROACTIVE CAMPAIGNS
# ===========================================================================


@mcp.tool()
async def create_campaign(
    bot_id: str,
    name: str,
    message_content: str,
    campaign_type: str = "chat_bubble",
    url_patterns: Optional[List[str]] = None,
    trigger_type: str = "time_on_page",
    trigger_value: int = 5,
    target_devices: Optional[List[str]] = None,
    is_active: bool = True,
) -> dict:
    """Create a proactive announcement or visitor engagement campaign."""
    principal = await _current_principal()
    _oauth.check_principal_scope(principal, "write")
    body = CampaignCreateRequest(
        name=name,
        message_content=message_content,
        campaign_type=campaign_type,
        url_patterns=url_patterns or ["*"],
        trigger_type=trigger_type,
        trigger_value=trigger_value,
        target_devices=target_devices or ["desktop", "mobile"],
        is_active=is_active,
    )
    return await mcp_campaign_service.create_campaign(principal, bot_id, body)


@mcp.tool()
async def list_campaigns(bot_id: str) -> list:
    """List all proactive campaigns created for a bot."""
    principal = await _current_principal()
    _oauth.check_principal_scope(principal, "read")
    return await mcp_campaign_service.list_campaigns(principal, bot_id)


@mcp.tool()
async def update_campaign(
    bot_id: str,
    campaign_id: str,
    name: Optional[str] = None,
    message_content: Optional[str] = None,
    campaign_type: Optional[str] = None,
    url_patterns: Optional[List[str]] = None,
    trigger_type: Optional[str] = None,
    trigger_value: Optional[int] = None,
    target_devices: Optional[List[str]] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    is_active: Optional[bool] = None,
) -> dict:
    """Update an existing campaign (only passed fields are modified)."""
    principal = await _current_principal()
    _oauth.check_principal_scope(principal, "write")
    body = CampaignUpdateRequest(
        name=name, message_content=message_content, campaign_type=campaign_type,
        url_patterns=url_patterns, trigger_type=trigger_type, trigger_value=trigger_value,
        target_devices=target_devices, start_date=start_date, end_date=end_date, is_active=is_active,
    )
    return await mcp_campaign_service.update_campaign(principal, bot_id, campaign_id, body)


@mcp.tool()
async def delete_campaign(bot_id: str, campaign_id: str) -> dict:
    """Permanently delete a campaign."""
    principal = await _current_principal()
    _oauth.check_principal_scope(principal, "write")
    return await mcp_campaign_service.delete_campaign(principal, bot_id, campaign_id)


@mcp.tool()
async def get_campaign_analytics(bot_id: str, campaign_id: str) -> dict:
    """Get performance metrics (impressions, clicks, CTR, conversions) for a campaign."""
    principal = await _current_principal()
    _oauth.check_principal_scope(principal, "read")
    return await mcp_campaign_service.get_campaign_analytics(principal, bot_id, campaign_id)


# ===========================================================================
# 5. VOICE AGENT (LiveKit Real-Time Audio)
# ===========================================================================


@mcp.tool()
async def configure_voice_agent(
    bot_id: str,
    enabled: bool = True,
    tts_provider: str = "openai",
    voice_id: str = "alloy",
    voice_temperature: float = 0.7,
    stt_provider: str = "deepgram",
    language: str = "en",
    interruption_enabled: bool = True,
    vad_sensitivity: str = "medium",
    endpointing_delay_ms: int = 500,
    voice_system_prompt: Optional[str] = None,
) -> dict:
    """Configure LiveKit real-time voice parameters, STT/TTS models, and turn-detection."""
    principal = await _current_principal()
    _oauth.check_principal_scope(principal, "write")
    body = VoiceAgentConfigRequest(
        enabled=enabled,
        tts_provider=tts_provider,
        voice_id=voice_id,
        voice_temperature=voice_temperature,
        stt_provider=stt_provider,
        language=language,
        interruption_enabled=interruption_enabled,
        vad_sensitivity=vad_sensitivity,
        endpointing_delay_ms=endpointing_delay_ms,
        voice_system_prompt=voice_system_prompt,
    )
    return await mcp_voice_service.configure_voice_agent(principal, bot_id, body)


@mcp.tool()
async def mint_voice_token(bot_id: str, visitor_timezone: str = "UTC") -> dict:
    """Generate a LiveKit JWT token and dispatch the real-time voice worker for a room."""
    principal = await _current_principal()
    _oauth.check_principal_scope(principal, "read")
    return await mcp_voice_service.mint_voice_token(principal, bot_id, visitor_timezone)


# ===========================================================================
# 6. KNOWLEDGE BASE & RAG
# ===========================================================================


@mcp.tool()
async def add_chatbot_knowledge(bot_id: str, name: str, content: str) -> dict:
    """Add a text snippet or Q&A document to a chatbot's knowledge base."""
    principal = await _current_principal()
    _oauth.check_principal_scope(principal, "write")
    return await bots_service.add_knowledge_text(principal, bot_id, name, content)


@mcp.tool()
async def crawl_website_knowledge(bot_id: str, url: str) -> dict:
    """Fetch a URL and index its content as a knowledge source (same crawl used by the dashboard's URL-import and the Developer API's POST /api/v1/knowledge)."""
    principal = await _current_principal()
    _oauth.check_principal_scope(principal, "write")
    return await bots_service.crawl_website_knowledge(principal, bot_id, url)


@mcp.tool()
async def upload_knowledge_document(bot_id: str, file_name: str, file_base64: str, mime_type: str = "") -> dict:
    """Index a PDF, DOCX, XLSX, PPTX, image, or text file (base64-encoded, max 20MB) as a knowledge source."""
    principal = await _current_principal()
    _oauth.check_principal_scope(principal, "write")
    return await bots_service.upload_knowledge_document(principal, bot_id, file_name, file_base64, mime_type)


@mcp.tool()
async def sync_cloud_storage(bot_id: str, provider: str, folder_id_or_url: str, max_files: int = 50) -> dict:
    """Index a Google Drive or OneDrive folder (provider='gdrive'|'onedrive') into the account's knowledge base. Requires the account already connected that provider from the dashboard."""
    principal = await _current_principal()
    _oauth.check_principal_scope(principal, "write")
    return await bots_service.sync_cloud_storage(principal, bot_id, provider, folder_id_or_url, max_files)


@mcp.tool()
async def list_knowledge_sources(bot_id: str) -> list:
    """List all indexed knowledge sources, character counts, and training statuses."""
    principal = await _current_principal()
    _oauth.check_principal_scope(principal, "read")
    return await bots_service.list_knowledge_sources(principal, bot_id)


@mcp.tool()
async def delete_knowledge_source(bot_id: str, source_id: str) -> dict:
    """Delete a knowledge source and its vector embeddings."""
    principal = await _current_principal()
    _oauth.check_principal_scope(principal, "write")
    return await bots_service.delete_knowledge_source(principal, bot_id, source_id)


@mcp.tool()
async def test_rag_retrieval(bot_id: str, query: str, top_k: int = 4) -> dict:
    """Simulate a test query against the bot's vector index and inspect retrieved chunks."""
    principal = await _current_principal()
    _oauth.check_principal_scope(principal, "read")
    return await bots_service.test_rag_retrieval(principal, bot_id, query, top_k)


# ===========================================================================
# 7. INBOX, LIVE CHAT & HUMAN TAKEOVER
# ===========================================================================


@mcp.tool()
async def list_conversations(bot_id: str, status: str = "all", limit: int = 50) -> list:
    """List recent visitor conversation sessions."""
    principal = await _current_principal()
    _oauth.check_principal_scope(principal, "read")
    return await mcp_inbox_service.list_conversations(principal, bot_id, status, limit)


@mcp.tool()
async def get_conversation_transcript(bot_id: str, session_id: str) -> dict:
    """Get full message transcripts and citations for a conversation session."""
    principal = await _current_principal()
    _oauth.check_principal_scope(principal, "read")
    return await mcp_inbox_service.get_conversation_transcript(principal, bot_id, session_id)


@mcp.tool()
async def human_agent_takeover(bot_id: str, session_id: str, pause_ai: bool = True) -> dict:
    """Pause AI responses to allow a human support agent to take over the live chat."""
    principal = await _current_principal()
    _oauth.check_principal_scope(principal, "write")
    return await mcp_inbox_service.human_agent_takeover(principal, bot_id, session_id, pause_ai)


@mcp.tool()
async def send_agent_message(bot_id: str, session_id: str, message: str) -> dict:
    """Send a human agent message into an active visitor conversation."""
    principal = await _current_principal()
    _oauth.check_principal_scope(principal, "write")
    return await mcp_inbox_service.send_agent_message(principal, bot_id, session_id, message)


@mcp.tool()
async def add_conversation_internal_note(bot_id: str, session_id: str, note: str) -> dict:
    """Add a private agent note to a conversation. Never sent to the visitor — for other human agents working the inbox."""
    principal = await _current_principal()
    _oauth.check_principal_scope(principal, "write")
    return await mcp_inbox_service.add_conversation_internal_note(principal, bot_id, session_id, note)


@mcp.tool()
async def list_conversation_notes(bot_id: str, session_id: str) -> list:
    """List private agent notes on a conversation."""
    principal = await _current_principal()
    _oauth.check_principal_scope(principal, "read")
    return await mcp_inbox_service.list_conversation_notes(principal, bot_id, session_id)


# ===========================================================================
# 8. LEADS, CALENDAR & MEETINGS
# ===========================================================================


@mcp.tool()
async def configure_lead_capture(
    bot_id: str,
    enabled: bool = True,
    collect_name: bool = True,
    collect_email: bool = True,
    collect_phone: bool = False,
) -> dict:
    """Configure in-chat lead capture: whether it's on and which fields (name/email/phone) are required before a lead is captured."""
    principal = await _current_principal()
    _oauth.check_principal_scope(principal, "write")
    body = LeadCaptureConfigRequest(
        enabled=enabled,
        collect_name=collect_name,
        collect_email=collect_email,
        collect_phone=collect_phone,
    )
    return await bots_service.configure_lead_capture(principal, bot_id, body)


@mcp.tool()
async def list_leads(bot_id: str, limit: int = 100) -> list:
    """List captured visitor contact leads."""
    principal = await _current_principal()
    _oauth.check_principal_scope(principal, "read")
    return await bots_service.list_leads(principal, bot_id, limit)


@mcp.tool()
async def export_leads(bot_id: str, limit: int = 100, format: str = "json") -> Any:
    """Export captured leads as JSON (default) or CSV text."""
    principal = await _current_principal()
    _oauth.check_principal_scope(principal, "read")
    return await bots_service.export_leads(principal, bot_id, limit, format)


@mcp.tool()
async def get_mailbox_logs(bot_id: str, limit: int = 50) -> list:
    """Get the log of outgoing meeting-confirmation emails/push notifications sent by this bot."""
    principal = await _current_principal()
    _oauth.check_principal_scope(principal, "read")
    return await bots_service.get_mailbox_logs(principal, bot_id, limit)


@mcp.tool()
async def export_visitor_data(bot_id: str) -> dict:
    """GDPR data-portability export: every conversation, session, and lead held for this bot, as JSON."""
    principal = await _current_principal()
    _oauth.check_principal_scope(principal, "admin")
    return await bots_service.export_visitor_data(principal, bot_id)


@mcp.tool()
async def configure_calendar_integration(
    bot_id: str,
    enabled: bool = True,
    provider: str = "google_calendar",
    meeting_duration_minutes: int = 30,
    timezone: str = "UTC",
) -> dict:
    """Configure Google Calendar/Outlook/Office365 for direct in-chat meeting scheduling."""
    principal = await _current_principal()
    _oauth.check_principal_scope(principal, "write")
    body = CalendarIntegrationRequest(
        enabled=enabled,
        provider=provider,
        meeting_duration_minutes=meeting_duration_minutes,
        timezone=timezone,
    )
    return await bots_service.configure_calendar(principal, bot_id, body)


@mcp.tool()
async def list_meetings(bot_id: str) -> list:
    """List meetings booked by visitors through the chatbot."""
    principal = await _current_principal()
    _oauth.check_principal_scope(principal, "read")
    return await bots_service.list_meetings(principal, bot_id)


# ===========================================================================
# 9. ANALYTICS, DATA SCIENCE & SELF-HEALING GAPS
# ===========================================================================


@mcp.tool()
async def analyze_chatbot(bot_id: str, since: Optional[str] = None) -> dict:
    """Get usage analytics: message counts, visitor sessions, and leads captured. Optionally filter to activity at or after `since` (ISO 8601 datetime)."""
    principal = await _current_principal()
    _oauth.check_principal_scope(principal, "read")
    return await bots_service.bot_analytics(principal, bot_id, since)


@mcp.tool()
async def discover_knowledge_gaps(bot_id: str) -> list:
    """Scan transcripts for unanswered user queries and cluster missing FAQ topics."""
    principal = await _current_principal()
    _oauth.check_principal_scope(principal, "read")
    return await mcp_inbox_service.discover_knowledge_gaps(principal, bot_id)


@mcp.tool()
async def analyze_sentiment_trends(bot_id: str, sample_size: int = 50) -> dict:
    """Perform NLP sentiment analysis across recent visitor chat interactions."""
    principal = await _current_principal()
    _oauth.check_principal_scope(principal, "read")
    return await mcp_inbox_service.analyze_sentiment(principal, bot_id, sample_size)


@mcp.tool()
async def get_feedback_and_csat(bot_id: str) -> dict:
    """Get visitor CSAT scores and feedback comments."""
    principal = await _current_principal()
    _oauth.check_principal_scope(principal, "read")
    return await bots_service.get_feedback_summary(principal, bot_id)


# ===========================================================================
# 10. SETTINGS, GUARDRAILS, BYOK & TEAM RBAC
# ===========================================================================


@mcp.tool()
async def configure_guardrails(
    bot_id: str,
    strict_mode: bool = True,
    blocked_topics: Optional[List[str]] = None,
    blocked_keywords: Optional[List[str]] = None,
    fallback_message: Optional[str] = None,
) -> dict:
    """Set strict RAG grounding boundaries, blocked topics, and safety fallback messages."""
    principal = await _current_principal()
    _oauth.check_principal_scope(principal, "write")
    body = GuardrailsConfigRequest(
        strict_mode=strict_mode,
        blocked_topics=blocked_topics,
        blocked_keywords=blocked_keywords,
        fallback_message=fallback_message,
    )
    return await bots_service.configure_guardrails(principal, bot_id, body)


@mcp.tool()
async def configure_byok(bot_id: str, provider: str, api_key: str) -> dict:
    """Configure Bring-Your-Own-Key (OpenAI, Anthropic, OpenRouter) to minimize token costs."""
    principal = await _current_principal()
    _oauth.check_principal_scope(principal, "admin")
    body = BYOKConfigRequest(provider=provider, api_key=api_key)
    return await bots_service.configure_byok(principal, bot_id, body)


@mcp.tool()
async def manage_team_members(bot_id: str, action: str, email: str, role: str = "agent") -> dict:
    """Invite, update, or remove team members for a chatbot."""
    principal = await _current_principal()
    _oauth.check_principal_scope(principal, "admin")
    body = TeamMemberRequest(email=email, role=role)
    return await bots_service.manage_team_members(principal, bot_id, action, body)


@mcp.tool()
async def configure_notifications(bot_id: str, admin_emails: List[str]) -> dict:
    """Set the admin email addresses that receive lead/escalation alert emails. For Slack/Discord/custom event alerts, use create_webhook_subscription instead."""
    principal = await _current_principal()
    _oauth.check_principal_scope(principal, "admin")
    body = NotificationsConfigRequest(admin_emails=admin_emails)
    return await bots_service.configure_notifications(principal, bot_id, body)


@mcp.tool()
async def create_webhook_subscription(bot_id: str, url: str, events: List[str]) -> dict:
    """Subscribe a URL (Slack/Discord incoming webhook, or any HTTPS endpoint) to real-time bot events. Returns a signing secret used to verify delivered payloads."""
    principal = await _current_principal()
    _oauth.check_principal_scope(principal, "admin")
    return await bots_service.create_webhook_subscription(principal, bot_id, url, events)


@mcp.tool()
async def list_webhook_subscriptions(bot_id: str) -> list:
    """List event-webhook subscriptions configured for a bot."""
    principal = await _current_principal()
    _oauth.check_principal_scope(principal, "admin")
    return await bots_service.list_webhook_subscriptions(principal, bot_id)


@mcp.tool()
async def delete_webhook_subscription(bot_id: str, webhook_id: str) -> dict:
    """Delete an event-webhook subscription."""
    principal = await _current_principal()
    _oauth.check_principal_scope(principal, "admin")
    return await bots_service.delete_webhook_subscription(principal, bot_id, webhook_id)


@mcp.tool()
async def configure_domain_allowlist(bot_id: str, allowed_domains: List[str]) -> dict:
    """Restrict widget embedding strictly to authorized domains."""
    principal = await _current_principal()
    _oauth.check_principal_scope(principal, "admin")
    return await bots_service.configure_domain_allowlist(principal, bot_id, allowed_domains)


@mcp.tool()
async def get_audit_logs(bot_id: str, limit: int = 50) -> list:
    """Get immutable audit logs of administrative actions and configuration changes."""
    principal = await _current_principal()
    _oauth.check_principal_scope(principal, "read")
    return await bots_service.get_audit_logs(principal, bot_id, limit)


@mcp.tool()
async def get_account_billing() -> dict:
    """Get message credits, active bot counts, and subscription status."""
    principal = await _current_principal()
    _oauth.check_principal_scope(principal, "read")
    return await bots_service.get_account_billing(principal)


# ===========================================================================
# 11. MCP RESOURCES (Live Context Providers)
# ===========================================================================


@mcp.resource("chatty://bots/list")
async def resource_bots_list() -> str:
    """Live JSON catalog of all chatbots owned by the user."""
    principal = await _current_principal()
    bots = await bots_service.list_bots(principal)
    return json.dumps(bots, indent=2)


@mcp.resource("chatty://bots/{bot_id}/config")
async def resource_bot_config(bot_id: str) -> str:
    """Live full configuration snapshot for a specific chatbot."""
    principal = await _current_principal()
    bot = await bots_service.get_bot(principal, bot_id)
    return json.dumps(bot, indent=2)


@mcp.resource("chatty://bots/{bot_id}/analytics")
async def resource_bot_analytics(bot_id: str) -> str:
    """Real-time analytics and message throughput for a chatbot."""
    principal = await _current_principal()
    analytics = await bots_service.bot_analytics(principal, bot_id)
    return json.dumps(analytics, indent=2)


@mcp.resource("chatty://bots/{bot_id}/knowledge-gaps")
async def resource_bot_knowledge_gaps(bot_id: str) -> str:
    """Auto-clustered list of missing knowledge topics based on user queries."""
    principal = await _current_principal()
    gaps = await mcp_inbox_service.discover_knowledge_gaps(principal, bot_id)
    return json.dumps(gaps, indent=2)


# ===========================================================================
# 12. MCP PROMPTS (Pre-Configured Autonomous Workflows)
# ===========================================================================


@mcp.prompt("audit-and-optimize-bot")
def prompt_audit_and_optimize(bot_id: str) -> str:
    """Runs a 360-degree audit across RAG accuracy, WCAG contrast, and unanswered queries."""
    return (
        f"Please run a comprehensive audit on Chatty Bot '{bot_id}':\n"
        f"1. Check knowledge sources and test RAG retrieval with `list_knowledge_sources` and `test_rag_retrieval`.\n"
        f"2. Audit widget design accessibility with `analyze_widget_design`.\n"
        f"3. Mine conversation logs for unanswered queries with `discover_knowledge_gaps`.\n"
        f"4. Propose an updated system prompt and action plan to optimize performance."
    )


@mcp.prompt("build-bot-from-brand")
def prompt_build_bot_from_brand(website_url: str, bot_name: str) -> str:
    """Autonomous brand onboarding: sets up RAG, visual flow, and styling for a company URL."""
    return (
        f"Please build a complete, ready-to-deploy Chatty chatbot for '{website_url}':\n"
        f"1. Create the bot named '{bot_name}' with `create_chatbot`.\n"
        f"2. Add initial brand knowledge text with `add_chatbot_knowledge`.\n"
        f"3. Generate a multi-step visual flow using `generate_flow_with_ai`.\n"
        f"4. Verify WCAG contrast with `analyze_widget_design`.\n"
        f"5. Return the ready-to-embed WordPress and React snippets from `generate_embed_code`."
    )


# ASGI mount for streamable-HTTP transport
mcp_asgi_app = mcp.streamable_http_app()
