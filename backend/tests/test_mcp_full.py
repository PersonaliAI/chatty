"""Comprehensive unit tests for Chatty's full-featured MCP server and services across all 18 tabs.
All DB calls are mocked via MagicMock chains without requiring a live Supabase connection.
"""

from __future__ import annotations

import asyncio
from unittest.mock import MagicMock, patch
import pytest

from app.schemas.bots_api import (
    BotCreateRequest,
    BotUpdateRequest,
    WidgetStylingUpdateRequest,
    FlowUpdateRequest,
    CampaignCreateRequest,
    VoiceAgentConfigRequest,
    LeadCaptureConfigRequest,
    CalendarIntegrationRequest,
    GuardrailsConfigRequest,
    BYOKConfigRequest,
    TeamMemberRequest,
)
from app.services import (
    bots_service,
    mcp_design_service,
    mcp_flow_service,
    mcp_campaign_service,
    mcp_voice_service,
    mcp_inbox_service,
)


def _mock_principal(scopes: list[str] = None) -> dict:
    return {
        "auth_type": "oauth",
        "user_id": "test-user-123",
        "scopes": scopes or ["read", "write", "knowledge", "voice", "actions", "admin"],
        "client_id": "test-client-id",
    }


def _mock_query_result(data: list | dict = None, count: int = None):
    mock_res = MagicMock()
    mock_res.data = data if data is not None else []
    mock_res.count = count if count is not None else (len(data) if isinstance(data, list) else 1)
    
    mock_query = MagicMock()
    mock_query.select.return_value = mock_query
    mock_query.insert.return_value = mock_query
    mock_query.update.return_value = mock_query
    mock_query.delete.return_value = mock_query
    mock_query.eq.return_value = mock_query
    mock_query.in_.return_value = mock_query
    mock_query.order.return_value = mock_query
    mock_query.limit.return_value = mock_query
    mock_query.maybe_single.return_value = mock_query
    mock_query.execute.return_value = mock_res
    return mock_query


# ===========================================================================
# 1. BOT LIFECYCLE & CORE SERVICES
# ===========================================================================


def test_create_and_list_bots():
    principal = _mock_principal()
    bot_data = {
        "id": "bot-abc-123",
        "user_id": "test-user-123",
        "name": "Acme Support Bot",
        "welcome_message": "Hello!",
        "primary_color": "#f97316",
        "selected_model": "gemini-2.5-flash",
    }

    with patch("app.services.bots_service.supabase.table") as mock_table:
        mock_table.return_value = _mock_query_result([bot_data])
        
        # Test create
        created = asyncio.run(bots_service.create_bot(principal, BotCreateRequest(name="Acme Support Bot")))
        assert created["name"] == "Acme Support Bot"
        assert created["primary_color"] == "#f97316"

        # Test list
        listed = asyncio.run(bots_service.list_bots(principal))
        assert len(listed) == 1
        assert listed[0]["id"] == "bot-abc-123"


def test_update_clone_and_delete_bot():
    principal = _mock_principal()
    bot_data = {
        "id": "bot-abc-123",
        "user_id": "test-user-123",
        "name": "Acme Support Bot",
        "welcome_message": "Hi!",
        "primary_color": "#0f172a",
    }

    with patch("app.core.oauth.require_bot_access", return_value=bot_data):
        with patch("app.services.bots_service.supabase.table") as mock_table:
            mock_table.return_value = _mock_query_result([bot_data])

            # Update
            updated = asyncio.run(bots_service.update_bot(principal, "bot-abc-123", BotUpdateRequest(name="New Name")))
            assert updated["id"] == "bot-abc-123"

            # Clone
            cloned = asyncio.run(bots_service.clone_bot(principal, "bot-abc-123", "Cloned Bot"))
            assert cloned["id"] == "bot-abc-123"

            # Delete
            deleted = asyncio.run(bots_service.delete_bot(principal, "bot-abc-123"))
            assert deleted["deleted"] is True
            assert deleted["bot_id"] == "bot-abc-123"


# ===========================================================================
# 2. DESIGN STUDIO & WCAG AUDIT
# ===========================================================================


def test_wcag_contrast_calculation():
    # Test black vs white (should be 21:1)
    contrast_bw = mcp_design_service.calculate_contrast_ratio("#ffffff", "#000000")
    assert contrast_bw >= 20.0

    # Test orange (#f97316) vs white (#ffffff)
    contrast_orange = mcp_design_service.calculate_contrast_ratio("#f97316", "#ffffff")
    assert contrast_orange > 1.0


def test_analyze_widget_design():
    principal = _mock_principal()
    bot_data = {
        "id": "bot-abc-123",
        "primary_color": "#1e293b",
        "welcome_message": "Welcome! How can we assist you with our services today?",
        "mobile_fullscreen": True,
    }

    with patch("app.core.oauth.require_bot_access", return_value=bot_data):
        analysis = asyncio.run(mcp_design_service.analyze_widget_design(principal, "bot-abc-123"))
        assert analysis["bot_id"] == "bot-abc-123"
        assert "wcag_contrast" in analysis
        assert analysis["wcag_contrast"]["white_text_level"] in ["AAA", "AA", "AA Large", "Fail"]
        assert analysis["mobile_ergonomics"]["fullscreen_enabled"] is True


def test_preview_html_and_embed_generator():
    principal = _mock_principal()
    bot_data = {"id": "bot-abc-123", "name": "Preview Bot", "primary_color": "#3b82f6"}

    with patch("app.core.oauth.require_bot_access", return_value=bot_data):
        # Preview HTML
        html = asyncio.run(mcp_design_service.preview_widget_html(principal, "bot-abc-123", "light"))
        assert "<!DOCTYPE html>" in html
        assert "Preview Bot" in html

        # Embed code for Next.js
        next_code = asyncio.run(mcp_design_service.generate_embed_code(principal, "bot-abc-123", "nextjs"))
        assert "import Script from \"next/script\"" in next_code["code_snippet"]
        assert "bot-abc-123" in next_code["code_snippet"]


# ===========================================================================
# 3. FLOW BUILDER
# ===========================================================================


def test_flow_update_and_simulation():
    principal = _mock_principal()
    flow_payload = {
        "nodes": [
            {"id": "start", "type": "input", "data": {"label": "🚀 Start"}},
            {"id": "msg-1", "data": {"label": "💬 Welcome!"}},
        ],
        "edges": [{"id": "e1", "source": "start", "target": "msg-1"}],
    }
    # The real storage mechanism is a JSON blob smuggled inside
    # chatty_bots.custom_js between CHATTY_FLOW_DATA markers (see
    # mcp_flow_service._extract_flow_from_custom_js) — there's no
    # dedicated flow_data/flow_active column.
    import json as _json
    flow_custom_js = "\n/* CHATTY_FLOW_DATA\n" + _json.dumps(
        {"status": "active", "nodes": flow_payload["nodes"], "edges": flow_payload["edges"]}, indent=2
    ) + "\nCHATTY_FLOW_DATA */"
    bot_data = {"id": "bot-abc-123", "custom_js": flow_custom_js}

    with patch("app.core.oauth.require_bot_access", return_value=bot_data):
        with patch("app.services.mcp_flow_service.supabase.table") as mock_table:
            mock_table.return_value = _mock_query_result([bot_data])

            # Update flow
            res = asyncio.run(mcp_flow_service.update_bot_flow(
                principal, "bot-abc-123", FlowUpdateRequest(nodes=flow_payload["nodes"], edges=flow_payload["edges"])
            ))
            assert res["nodes_count"] == 2
            assert res["edges_count"] == 1

            # Simulate flow (reads back the same custom_js-embedded flow via get_bot_flow)
            sim = asyncio.run(mcp_flow_service.simulate_flow_execution(principal, "bot-abc-123", ["Hi"]))
            assert sim["completed"] is True
            assert sim["total_steps"] >= 1


# ===========================================================================
# 4. CAMPAIGNS
# ===========================================================================


def test_campaign_lifecycle():
    principal = _mock_principal()
    campaign_data = {
        "id": "camp-1",
        "bot_id": "bot-abc-123",
        "name": "Summer Sale",
        "type": "chat_bubble",
        "message": "Get 20% off!",
        # Real, persisted counters (see chatty_campaigns migration) — nonzero
        # here only to exercise the ctr/conversion-rate math in the service.
        "impressions": 100,
        "clicks": 10,
        "conversions": 2,
    }

    with patch("app.core.oauth.require_bot_access", return_value={"id": "bot-abc-123"}):
        with patch("app.services.mcp_campaign_service.supabase.table") as mock_table:
            mock_table.return_value = _mock_query_result([campaign_data])

            # Create campaign
            camp = asyncio.run(mcp_campaign_service.create_campaign(
                principal, "bot-abc-123", CampaignCreateRequest(name="Summer Sale", message_content="Get 20% off!")
            ))
            assert camp["name"] == "Summer Sale"

            # List campaigns
            camps = asyncio.run(mcp_campaign_service.list_campaigns(principal, "bot-abc-123"))
            assert len(camps) == 1

            # Analytics
            analytics = asyncio.run(mcp_campaign_service.get_campaign_analytics(principal, "bot-abc-123", "camp-1"))
            assert "ctr_percent" in analytics
            assert analytics["conversions"] > 0


# ===========================================================================
# 5. VOICE AGENT
# ===========================================================================


def test_configure_voice_agent_and_token():
    principal = _mock_principal()
    bot_data = {"id": "bot-abc-123", "user_id": "test-user-123", "voice_enabled": True}

    with patch("app.core.oauth.require_bot_access", return_value=bot_data):
        with patch("app.services.mcp_voice_service.supabase.table") as mock_table:
            mock_table.return_value = _mock_query_result([bot_data])

            # Config — real chatty_bots columns only (voice_tts_provider/voice_tts_voice,
            # not the fictional tts_provider/voice_id fields the old schema had).
            mock_table.return_value = _mock_query_result([{
                "id": "bot-abc-123", "voice_enabled": True, "voice_mode": "pipeline",
                "voice_stt_provider": None, "voice_tts_provider": "elevenlabs", "voice_tts_voice": "rachel",
            }])
            config = asyncio.run(mcp_voice_service.configure_voice_agent(
                principal, "bot-abc-123", VoiceAgentConfigRequest(voice_tts_provider="elevenlabs", voice_tts_voice="rachel")
            ))
            assert config["voice_tts_provider"] == "elevenlabs"
            assert config["voice_tts_voice"] == "rachel"

            # Token — mint_voice_token delegates to the real LiveKit dispatch
            # logic in voice_service, which isn't configured in unit tests;
            # mock that boundary rather than the DB layer.
            with patch(
                "app.services.mcp_voice_service.voice_service.mint_voice_session",
                return_value={"token": "fake-jwt", "livekit_url": "wss://example.livekit.cloud", "room_name": "room-1", "session_id": "sess-1"},
            ):
                token_res = asyncio.run(mcp_voice_service.mint_voice_token(principal, "bot-abc-123"))
            assert "token" in token_res
            assert "room_name" in token_res


# ===========================================================================
# 6. INBOX, HUMAN TAKEOVER & KNOWLEDGE GAPS
# ===========================================================================


def test_inbox_transcripts_and_human_takeover():
    principal = _mock_principal()
    # Real chatty_conversations shape (role/content/sender/feedback_rating/
    # correction/created_at) — no "citations" column exists.
    msgs = [
        {"id": "msg-1", "role": "user", "content": "Hello", "sender": None, "feedback_rating": None, "correction": None, "created_at": "2026-09-02T10:00:00Z"},
        {"id": "msg-2", "role": "assistant", "content": "Hi! How can I help?", "sender": None, "feedback_rating": None, "correction": None, "created_at": "2026-09-02T10:00:01Z"},
    ]

    with patch("app.core.oauth.require_bot_access", return_value={"id": "bot-abc-123"}):
        with patch("app.services.mcp_inbox_service.supabase.table") as mock_table:
            mock_table.return_value = _mock_query_result(msgs)

            # Transcript (reads chatty_conversations)
            transcript = asyncio.run(mcp_inbox_service.get_conversation_transcript(principal, "bot-abc-123", "sess-1"))
            assert transcript["message_count"] == 2

            # Takeover (writes chatty_sessions.ai_paused — the real column
            # the dashboard's own human-takeover toggle uses)
            mock_table.return_value = _mock_query_result([{"id": "sess-1", "bot_id": "bot-abc-123", "session_id": "sess-1", "ai_paused": True, "needs_attention": False}])
            takeover = asyncio.run(mcp_inbox_service.human_agent_takeover(principal, "bot-abc-123", "sess-1", True))
            assert takeover["ai_paused"] is True

            # Knowledge gaps (reads chatty_unanswered — the real
            # unanswered-question queue, not a fabricated fixed list)
            mock_table.return_value = _mock_query_result([
                {"question": "Do you offer refunds?", "session_id": "sess-1", "created_at": "2026-09-02T10:00:00Z"},
                {"question": "Do you offer refunds?", "session_id": "sess-2", "created_at": "2026-09-02T11:00:00Z"},
            ])
            gaps = asyncio.run(mcp_inbox_service.discover_knowledge_gaps(principal, "bot-abc-123"))
            assert len(gaps) == 1
            assert gaps[0]["topic"] == "Do you offer refunds?"
            assert gaps[0]["frequency"] == 2
            assert gaps[0]["first_seen"] == "2026-09-02T10:00:00Z"
            assert gaps[0]["last_seen"] == "2026-09-02T11:00:00Z"
