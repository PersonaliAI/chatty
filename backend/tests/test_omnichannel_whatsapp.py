"""Comprehensive test suite for the industrial-grade Omnichannel Messaging system:
WhatsApp channel adapter, conversational booking bridge, human agent takeover,
live agent escalation, and end-to-end pipeline execution.
"""

from __future__ import annotations

import asyncio
import hashlib
import hmac
import json
import time
from unittest.mock import AsyncMock, patch

import pytest

import main  # noqa: F401
from app.services.omnichannel import (
    ChannelType,
    CustomerServiceWindowState,
    InboundMessage,
    OmnichannelPipeline,
    apply_human_takeover,
    build_whatsapp_booking_cta,
    detect_human_handoff_request,
    dispatch_whatsapp_booking_cancelled,
    dispatch_whatsapp_booking_confirmation,
    dispatch_whatsapp_booking_rescheduled,
    format_available_slots_for_whatsapp,
    format_whatsapp_reply,
    get_handoff_acknowledgement,
    is_booking_intent,
    is_session_ai_paused,
    normalize_meta_message,
    send_outbound_whatsapp,
    verify_meta_signature,
)


# ============================================================================
# 1. Meta Webhook HMAC-SHA256 Cryptographic Verification
# ============================================================================

def test_verify_meta_signature_valid():
    secret = "meta_app_secret_super_secure"
    payload = b'{"object":"whatsapp_business_account","entry":[]}'
    sig = "sha256=" + hmac.new(secret.encode("utf-8"), payload, hashlib.sha256).hexdigest()

    assert verify_meta_signature(payload, sig, secret) is True


def test_verify_meta_signature_rejects_tampered_payload():
    secret = "meta_app_secret_super_secure"
    payload = b'{"object":"whatsapp_business_account","entry":[]}'
    tampered = b'{"object":"whatsapp_business_account","entry":[{"id":"evil"}]}'
    sig = "sha256=" + hmac.new(secret.encode("utf-8"), payload, hashlib.sha256).hexdigest()

    assert verify_meta_signature(tampered, sig, secret) is False


def test_verify_meta_signature_rejects_invalid_headers():
    secret = "meta_app_secret_super_secure"
    payload = b'{"test":1}'

    assert verify_meta_signature(payload, "", secret) is False
    assert verify_meta_signature(payload, "invalid_header", secret) is False
    assert verify_meta_signature(payload, "sha1=abcdef", secret) is False


# ============================================================================
# 2. Inbound Meta Message Normalization
# ============================================================================

def test_normalize_meta_text_message():
    val_metadata = {"phone_number_id": "100200300"}
    raw_msg = {
        "id": "wamid.HBgLMTU1NTEyMzQ1Njc=",
        "from": "15551234567",
        "type": "text",
        "timestamp": 1700000000,
        "text": {"body": "Hello! What are your business hours?"},
    }

    inbound = normalize_meta_message(val_metadata, raw_msg)
    assert inbound is not None
    assert inbound.channel == ChannelType.WHATSAPP
    assert inbound.sender_id == "15551234567"
    assert inbound.recipient_id == "100200300"
    assert inbound.session_id == "wa:15551234567"
    assert inbound.text == "Hello! What are your business hours?"
    assert inbound.has_media is False


def test_normalize_meta_interactive_button_reply():
    val_metadata = {"phone_number_id": "100200300"}
    raw_msg = {
        "id": "wamid.btn_reply_01",
        "from": "15551234567",
        "type": "interactive",
        "interactive": {
            "type": "button_reply",
            "button_reply": {
                "id": "btn_talk_human",
                "title": "Talk to Human",
            },
        },
    }

    inbound = normalize_meta_message(val_metadata, raw_msg)
    assert inbound is not None
    assert inbound.text == "Talk to Human"
    assert inbound.interactive_reply_id == "btn_talk_human"


def test_normalize_meta_location_message():
    val_metadata = {"phone_number_id": "100200300"}
    raw_msg = {
        "id": "wamid.loc_01",
        "from": "15551234567",
        "type": "location",
        "location": {
            "latitude": 37.7749,
            "longitude": -122.4194,
            "name": "Headquarters",
        },
    }

    inbound = normalize_meta_message(val_metadata, raw_msg)
    assert inbound is not None
    assert "📍 Headquarters" in inbound.text
    assert "37.7749,-122.4194" in inbound.text


def test_normalize_meta_voice_note_media():
    val_metadata = {"phone_number_id": "100200300"}
    raw_msg = {
        "id": "wamid.audio_01",
        "from": "15551234567",
        "type": "voice",
        "voice": {"id": "media_voice_123", "mime_type": "audio/ogg"},
    }

    audio_bytes = b"OggS\x00\x02FakeAudioStream"
    inbound = normalize_meta_message(
        val_metadata,
        raw_msg,
        media_bytes=audio_bytes,
        media_mime="audio/ogg",
        media_filename="voice_note.ogg",
    )
    assert inbound is not None
    assert inbound.has_media is True
    assert inbound.media_mime == "audio/ogg"
    assert inbound.media_filename == "voice_note.ogg"


# ============================================================================
# 3. Conversational Booking Bridge & Slot Presentation
# ============================================================================

def test_is_booking_intent_detection():
    assert is_booking_intent("I want to book a demo", "Sure, let me check.", calendar_enabled=True) is True
    assert is_booking_intent("Can we schedule an appointment?", "Of course.", calendar_enabled=True) is True
    assert is_booking_intent("What is your price?", "[BOOKING_WIDGET] Here is the calendar", calendar_enabled=True) is True
    assert is_booking_intent("Here is my question", "Check https://chatty.personaliai.com/book/bot123", calendar_enabled=True) is True

    # When already booked, meeting link is in reply, so booking intent should be false
    assert is_booking_intent("Great", "Your demo is booked: https://meet.google.com/abc-def-ghi", calendar_enabled=True) is False

    # When calendar is disabled for bot
    assert is_booking_intent("I want to book a demo", "Sure", calendar_enabled=False) is False


def test_build_whatsapp_booking_cta_has_valid_hmac():
    bot_id = "bot_demo_101"
    phone = "+1 (555) 345-6789"
    secret = "secret_demo_key"

    cta, url = build_whatsapp_booking_cta(bot_id, phone, secret, base_url="https://chatty.personaliai.com")

    assert "📅 *Schedule your appointment here:*" in cta
    assert "https://chatty.personaliai.com/book/bot_demo_101?session_id=wa:15553456789" in url
    assert "&sig=" in url
    assert "&t=" in url


def test_format_available_slots_for_whatsapp():
    slots = [
        {"label": "Thursday, Oct 24 at 10:00 AM"},
        {"label": "Thursday, Oct 24 at 2:00 PM"},
        {"label": "Friday, Oct 25 at 11:30 AM"},
    ]
    formatted = format_available_slots_for_whatsapp(slots, timezone_label="EDT")

    assert "📅 *Available Appointment Times:*" in formatted
    assert "• Thursday, Oct 24 at 10:00 AM (EDT)" in formatted
    assert "• Thursday, Oct 24 at 2:00 PM (EDT)" in formatted
    assert "• Friday, Oct 25 at 11:30 AM (EDT)" in formatted


def test_dispatch_whatsapp_booking_rescheduled():
    bot = {
        "id": "bot_resched_1",
        "whatsapp_phone_number_id": "pn_12345",
        "whatsapp_access_token": "token_abc",
    }

    with patch("app.services.whatsapp_service.send_whatsapp_message", new_callable=AsyncMock) as mock_send:
        mock_send.return_value = True

        res = asyncio.run(
            dispatch_whatsapp_booking_rescheduled(
                bot=bot,
                phone="15551234567",
                formatted_time="Friday, Oct 25 at 3:00 PM (EDT)",
                meeting_link="https://meet.google.com/xyz-uvw-rst",
                attendee_email="jordan@example.com",
                attendee_name="Jordan",
            )
        )

        assert res is True
        mock_send.assert_called_once()
        sent_text = mock_send.call_args[1]["text"]
        assert "🗓️ *Appointment Rescheduled*" in sent_text
        assert "Hi Jordan," in sent_text
        assert "Friday, Oct 25 at 3:00 PM (EDT)" in sent_text
        assert "https://meet.google.com/xyz-uvw-rst" in sent_text
        assert "jordan@example.com" in sent_text


def test_dispatch_whatsapp_booking_cancelled():
    bot = {
        "id": "bot_cancel_1",
        "whatsapp_phone_number_id": "pn_12345",
        "whatsapp_access_token": "token_abc",
    }

    with patch("app.services.whatsapp_service.send_whatsapp_message", new_callable=AsyncMock) as mock_send:
        mock_send.return_value = True

        res = asyncio.run(
            dispatch_whatsapp_booking_cancelled(
                bot=bot,
                phone="15551234567",
                formatted_time="Friday, Oct 25 at 3:00 PM (EDT)",
                attendee_name="Jordan",
                reason="Schedule conflict",
            )
        )

        assert res is True
        mock_send.assert_called_once()
        sent_text = mock_send.call_args[1]["text"]
        assert "❌ *Appointment Cancelled*" in sent_text
        assert "Hi Jordan," in sent_text
        assert "Friday, Oct 25 at 3:00 PM (EDT)" in sent_text
        assert "Schedule conflict" in sent_text


# ============================================================================
# 4. Human Agent Takeover & Live Escalation Bridge
# ============================================================================

def test_detect_human_handoff_request():
    is_esc, reason, priority = detect_human_handoff_request("Talk to human")
    assert is_esc is True
    assert priority == "high"

    is_esc, reason, priority = detect_human_handoff_request("I need to speak to an agent please")
    assert is_esc is True
    assert priority == "high"

    is_esc, reason, priority = detect_human_handoff_request("This is terrible, I will sue you!")
    assert is_esc is True
    assert priority == "urgent"

    is_esc, reason, priority = detect_human_handoff_request("What is your return policy?")
    assert is_esc is False
    assert priority == "normal"


def test_is_session_ai_paused():
    assert is_session_ai_paused(None) is False
    assert is_session_ai_paused({"ai_paused": False}) is False
    assert is_session_ai_paused({"ai_paused": True}) is True


def test_apply_human_takeover_marks_session(monkeypatch):
    calls = []

    class FakeQuery:
        def __init__(self, table): self._table = table
        def update(self, payload):
            calls.append(("update", self._table, payload))
            return self
        def eq(self, k, v):
            calls.append(("eq", k, v))
            return self
        def execute(self):
            return type("Resp", (), {"data": [{"success": True}]})()

    class FakeSupabase:
        def table(self, name): return FakeQuery(name)

    monkeypatch.setattr("app.services.omnichannel.escalation_bridge.supabase", FakeSupabase())
    monkeypatch.setattr(
        "app.services.omnichannel.escalation_bridge.run_db",
        lambda cb: asyncio.sleep(0, result=cb()),
    )

    with patch("app.services.slack_escalation.send_slack_escalation_alert", new_callable=AsyncMock) as mock_slack:
        res = asyncio.run(
            apply_human_takeover(
                bot_id="bot_takeover_1",
                session_id="wa:15551234567",
                reason="Visitor requested human agent",
                text="I want a real person",
                priority="high",
            )
        )

        assert res is True
        mock_slack.assert_called_once()
        # Verify db update set ai_paused=True and needs_attention=True
        update_calls = [c for c in calls if c[0] == "update"]
        assert len(update_calls) == 1
        payload = update_calls[0][2]
        assert payload["ai_paused"] is True
        assert payload["needs_attention"] is True


# ============================================================================
# 5. OmnichannelPipeline End-to-End Orchestration
# ============================================================================

def test_pipeline_suppresses_ai_when_human_takeover_active(monkeypatch):
    """When a session has ai_paused=True, the visitor's message must be logged
    to chat history for the agent, but AI generation must be suppressed.
    """
    bot = {
        "id": "bot_paused_1",
        "user_id": "user_100",
        "whatsapp_phone_number_id": "pn_100",
        "whatsapp_access_token": "token_100",
    }
    owner_user = {"auth_user_id": "user_100", "id": "user_100"}
    inbound = InboundMessage(
        channel=ChannelType.WHATSAPP,
        sender_id="15551234567",
        recipient_id="pn_100",
        session_id="wa:15551234567",
        message_id="msg_001",
        text="Hello, are you still there?",
    )

    db_inserts = []

    class FakeQuery:
        def __init__(self, table): self._table = table
        def select(self, *_): return self
        def eq(self, *_): return self
        def limit(self, *_): return self
        def insert(self, payload):
            db_inserts.append((self._table, payload))
            return self
        def execute(self):
            if self._table == "chatty_sessions":
                # Report ai_paused is TRUE
                return type("Resp", (), {"data": [{"ai_paused": True, "needs_attention": True}]})()
            return type("Resp", (), {"data": [{"id": "ok"}]})()

    class FakeSupabase:
        def table(self, name): return FakeQuery(name)

    monkeypatch.setattr("app.services.omnichannel.pipeline.supabase", FakeSupabase())
    monkeypatch.setattr(
        "app.services.omnichannel.pipeline.run_db",
        lambda cb: asyncio.sleep(0, result=cb()),
    )
    monkeypatch.setattr(
        "app.services.omnichannel.pipeline.chatty_quota_exceeded",
        AsyncMock(return_value=False),
    )
    monkeypatch.setattr(
        "app.services.omnichannel.pipeline._upsert_session",
        AsyncMock(),
    )

    with patch("app.services.omnichannel.pipeline.run_widget_assistant", new_callable=AsyncMock) as mock_ai, \
         patch("app.services.omnichannel.pipeline.send_outbound_whatsapp", new_callable=AsyncMock) as mock_send:

        pipeline = OmnichannelPipeline()
        result = asyncio.run(
            pipeline.process_inbound(
                message=inbound,
                bot=bot,
                owner_user=owner_user,
                access_token="token_100",
            )
        )

        assert result["status"] == "ai_paused"
        assert result["handled_by"] == "human_agent"
        # User message was recorded for the dashboard
        conv_inserts = [p for t, p in db_inserts if t == "chatty_conversations" and p.get("role") == "user"]
        assert len(conv_inserts) == 1
        assert conv_inserts[0]["content"] == "Hello, are you still there?"
        # AI assistant was NOT invoked
        mock_ai.assert_not_called()
        # Visitor receives a localized queue notice acknowledging human takeover
        assert mock_send.call_count == 1
        assert "routed to our support team" in mock_send.call_args[1]["text"]


def test_pipeline_handles_human_escalation_request(monkeypatch):
    """When a visitor explicitly asks for a human agent, the pipeline marks
    the session paused, notifies the team, and sends an empathetic acknowledgement.
    """
    bot = {
        "id": "bot_esc_1",
        "user_id": "user_200",
        "whatsapp_phone_number_id": "pn_200",
        "whatsapp_access_token": "token_200",
    }
    owner_user = {"auth_user_id": "user_200", "id": "user_200"}
    inbound = InboundMessage(
        channel=ChannelType.WHATSAPP,
        sender_id="15551234567",
        recipient_id="pn_200",
        session_id="wa:15551234567",
        message_id="msg_002",
        text="I need to talk to a human agent right now",
    )

    class FakeQuery:
        def __init__(self, table): self._table = table
        def select(self, *_): return self
        def eq(self, *_): return self
        def limit(self, *_): return self
        def insert(self, payload): return self
        def execute(self):
            # Session not yet paused
            return type("Resp", (), {"data": [{"ai_paused": False}]})()

    class FakeSupabase:
        def table(self, name): return FakeQuery(name)

    monkeypatch.setattr("app.services.omnichannel.pipeline.supabase", FakeSupabase())
    monkeypatch.setattr(
        "app.services.omnichannel.pipeline.run_db",
        lambda cb: asyncio.sleep(0, result=cb()),
    )
    monkeypatch.setattr(
        "app.services.omnichannel.pipeline.chatty_quota_exceeded",
        AsyncMock(return_value=False),
    )
    monkeypatch.setattr(
        "app.services.omnichannel.pipeline._upsert_session",
        AsyncMock(),
    )

    with patch("app.services.omnichannel.pipeline.apply_human_takeover", new_callable=AsyncMock) as mock_takeover, \
         patch("app.services.omnichannel.pipeline.send_outbound_whatsapp", new_callable=AsyncMock) as mock_send, \
         patch("app.services.omnichannel.pipeline.run_widget_assistant", new_callable=AsyncMock) as mock_ai:

        pipeline = OmnichannelPipeline()
        result = asyncio.run(
            pipeline.process_inbound(
                message=inbound,
                bot=bot,
                owner_user=owner_user,
                access_token="token_200",
            )
        )

        assert result["status"] == "escalated"
        mock_takeover.assert_called_once()
        mock_send.assert_called_once()
        sent_ack = mock_send.call_args[1]["text"]
        assert "connected with our support team" in sent_ack
        # Automated AI was not called
        mock_ai.assert_not_called()


def test_pipeline_normal_flow_with_conversational_booking(monkeypatch):
    """When a visitor asks to book, the pipeline injects the phone-bound HMAC
    signed WhatsApp booking URL into the outgoing reply.
    """
    bot = {
        "id": "bot_book_1",
        "user_id": "user_300",
        "whatsapp_phone_number_id": "pn_300",
        "whatsapp_access_token": "token_300",
        "calendar_scheduling_enabled": True,
        "whatsapp_app_secret": "bot_secret_xyz",
    }
    owner_user = {"auth_user_id": "user_300", "id": "user_300"}
    inbound = InboundMessage(
        channel=ChannelType.WHATSAPP,
        sender_id="15559876543",
        recipient_id="pn_300",
        session_id="wa:15559876543",
        message_id="msg_003",
        text="I would love to book a demo please!",
    )

    class FakeQuery:
        def __init__(self, table): self._table = table
        def select(self, *_): return self
        def eq(self, *_): return self
        def limit(self, *_): return self
        def insert(self, payload): return self
        def execute(self):
            return type("Resp", (), {"data": [{"ai_paused": False}]})()

    class FakeSupabase:
        def table(self, name): return FakeQuery(name)

    monkeypatch.setattr("app.services.omnichannel.pipeline.supabase", FakeSupabase())
    monkeypatch.setattr(
        "app.services.omnichannel.pipeline.run_db",
        lambda cb: asyncio.sleep(0, result=cb()),
    )
    monkeypatch.setattr(
        "app.services.omnichannel.pipeline.chatty_quota_exceeded",
        AsyncMock(return_value=False),
    )
    monkeypatch.setattr(
        "app.services.omnichannel.pipeline._upsert_session",
        AsyncMock(),
    )

    with patch("app.services.omnichannel.pipeline.run_widget_assistant", new_callable=AsyncMock) as mock_ai, \
         patch("app.services.omnichannel.pipeline.send_outbound_whatsapp", new_callable=AsyncMock) as mock_send:

        mock_ai.return_value = {
            "reply": "I'd be glad to help you schedule a demo! [BOOKING_WIDGET]"
        }

        pipeline = OmnichannelPipeline()
        result = asyncio.run(
            pipeline.process_inbound(
                message=inbound,
                bot=bot,
                owner_user=owner_user,
                access_token="token_300",
            )
        )

        assert result["status"] == "delivered"
        # Channel receives the interim notice + final response
        assert mock_send.call_count >= 1
        sent_text = mock_send.call_args_list[-1][1]["text"]
        # Booking marker stripped, signed booking URL CTA injected
        assert "[BOOKING_WIDGET]" not in sent_text
        assert "📅 *Schedule your appointment here:*" in sent_text
        assert "/book/bot_book_1?session_id=wa:15559876543" in sent_text
        assert "&sig=" in sent_text


# ============================================================================
# 6. Synchronized Booking Reschedule and Cancel Lifecycle
# ============================================================================

def test_widget_reschedule_dispatches_whatsapp_notice(monkeypatch):
    """When a meeting booked via WhatsApp is rescheduled, the attendee receives
    an updated WhatsApp appointment notice with new time and meeting link.
    """
    from app.routers import widget
    from app.schemas.widget import WidgetBookingRescheduleRequest

    bot = {
        "id": "bot_resched_wa",
        "user_id": "owner_123",
        "whatsapp_phone_number_id": "pn_123",
        "whatsapp_access_token": "token_abc",
        "whatsapp_app_secret": "secret_abc",
        "buffer_minutes": 0,
        "meeting_provider": "google_meet",
        "calendar_scheduling_enabled": True,
    }
    owner_user = {"auth_user_id": "owner_123", "id": "owner_123", "email": "host@example.com"}
    meeting = {
        "id": "meeting_uuid_123",
        "title": "Strategy Demo",
        "attendee_name": "Taylor Swift",
        "attendee_email": "taylor@example.com",
        "assigned_to_email": "host@example.com",
        "start_time": "2026-10-25T14:00:00Z",
        "meeting_link": "https://meet.google.com/xyz-123",
        "session_id": "wa:15554443322",
    }

    class FakeQuery:
        def __init__(self, table): self._table = table
        def select(self, *_): return self
        def eq(self, *_): return self
        def limit(self, *_): return self
        def maybe_single(self): return self
        def insert(self, payload): return self
        def update(self, payload): return self
        def execute(self):
            if self._table == "chatty_bots":
                return type("Resp", (), {"data": [bot]})()
            if self._table == "users":
                return type("Resp", (), {"data": [owner_user]})()
            return type("Resp", (), {"data": [{"id": "ok"}]})()

    class FakeSupabase:
        def table(self, name): return FakeQuery(name)

    monkeypatch.setattr(widget, "supabase", FakeSupabase())
    monkeypatch.setattr(widget, "run_db", lambda cb: asyncio.sleep(0, result=cb()))
    monkeypatch.setattr(widget, "_lookup_widget_meeting", AsyncMock(return_value=meeting))
    monkeypatch.setattr(widget, "_widget_rate_limit_or_429", AsyncMock())
    monkeypatch.setattr("plugins.availability_engine.is_slot_available", AsyncMock(return_value=True))

    with patch("plugins.agent_tools.reschedule_meeting_core", new_callable=AsyncMock) as mock_resched_core, \
         patch("app.routers.widget.dispatch_whatsapp_booking_rescheduled", new_callable=AsyncMock) as mock_dispatch:

        mock_resched_core.return_value = {"id": "meeting_uuid_123"}
        mock_dispatch.return_value = True

        from datetime import datetime, timezone, timedelta
        now = datetime.now(timezone.utc)
        days_ahead = (1 - now.weekday()) % 7 or 7
        target_day = (now + timedelta(days=days_ahead)).date()
        future_start = f"{target_day}T14:00:00Z"
        future_end = f"{target_day}T14:30:00Z"

        req = WidgetBookingRescheduleRequest(
            bot_id="bot_resched_wa",
            session_id="wa:15554443322",
            meeting_id="meeting_uuid_123",
            attendee_email="taylor@example.com",
            new_start_time=future_start,
            new_end_time=future_end,
            visitor_timezone="UTC",
        )

        resp = asyncio.run(widget.widget_booking_reschedule(req))

        assert resp["success"] is True
        mock_dispatch.assert_called_once()
        args = mock_dispatch.call_args[1]
        assert args["phone"] == "15554443322"
        assert args["attendee_email"] == "taylor@example.com"
        assert args["attendee_name"] == "Taylor Swift"
        assert "2026" in args["formatted_time"]


def test_widget_cancel_dispatches_whatsapp_notice(monkeypatch):
    """When a meeting booked via WhatsApp is cancelled, the attendee receives
    a WhatsApp cancellation notice.
    """
    from app.routers import widget
    from app.schemas.widget import WidgetBookingCancelRequest

    bot = {
        "id": "bot_cancel_wa",
        "user_id": "owner_123",
        "whatsapp_phone_number_id": "pn_123",
        "whatsapp_access_token": "token_abc",
        "whatsapp_app_secret": "secret_abc",
    }
    owner_user = {"auth_user_id": "owner_123", "id": "owner_123", "email": "host@example.com"}
    meeting = {
        "id": "meeting_uuid_456",
        "attendee_name": "Taylor Swift",
        "attendee_email": "taylor@example.com",
        "start_time": "2026-10-25T14:00:00Z",
        "timezone": "UTC",
        "session_id": "wa:15554443322",
    }

    class FakeQuery:
        def __init__(self, table): self._table = table
        def select(self, *_): return self
        def eq(self, *_): return self
        def limit(self, *_): return self
        def maybe_single(self): return self
        def insert(self, payload): return self
        def execute(self):
            if self._table == "chatty_bots":
                return type("Resp", (), {"data": [bot]})()
            if self._table == "users":
                return type("Resp", (), {"data": [owner_user]})()
            return type("Resp", (), {"data": [{"id": "ok"}]})()

    class FakeSupabase:
        def table(self, name): return FakeQuery(name)

    monkeypatch.setattr(widget, "supabase", FakeSupabase())
    monkeypatch.setattr(widget, "run_db", lambda cb: asyncio.sleep(0, result=cb()))
    monkeypatch.setattr(widget, "_lookup_widget_meeting", AsyncMock(return_value=meeting))
    monkeypatch.setattr(widget, "_widget_rate_limit_or_429", AsyncMock())

    with patch("plugins.agent_tools.cancel_meeting_core", new_callable=AsyncMock) as mock_cancel_core, \
         patch("app.routers.widget.dispatch_whatsapp_booking_cancelled", new_callable=AsyncMock) as mock_dispatch:

        mock_cancel_core.return_value = {"id": "meeting_uuid_456"}
        mock_dispatch.return_value = True

        req = WidgetBookingCancelRequest(
            bot_id="bot_cancel_wa",
            session_id="wa:15554443322",
            meeting_id="meeting_uuid_456",
            attendee_email="taylor@example.com",
            reason="Rescheduled via phone call",
        )

        resp = asyncio.run(widget.widget_booking_cancel(req))

        assert resp["success"] is True
        mock_dispatch.assert_called_once()
        args = mock_dispatch.call_args[1]
        assert args["phone"] == "15554443322"
        assert args["attendee_name"] == "Taylor Swift"
        assert args["reason"] == "Rescheduled via phone call"

