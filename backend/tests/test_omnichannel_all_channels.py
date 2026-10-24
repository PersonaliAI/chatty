"""Comprehensive test suite for all Omnichannel channels:
1. Instagram DM & Facebook Messenger (Meta Graph API)
2. Telegram Bot API
3. Two-Way SMS (Twilio & TCPA compliance)
4. Two-Way Email Support (Resend Inbound)
5. OmnichannelPipeline cross-channel routing, human takeover, and booking bridge
"""

from __future__ import annotations

import asyncio
import hashlib
import hmac
import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

import main  # noqa: F401
from app.services.omnichannel import (
    ChannelType,
    InboundMessage,
    OmnichannelPipeline,
    build_channel_booking_cta,
    check_tcpa_opt_out,
    clean_email_body,
    normalize_email_message,
    normalize_instagram_message,
    normalize_sms_webhook,
    normalize_telegram_update,
    send_outbound_email,
    send_outbound_instagram,
    send_outbound_sms,
    send_outbound_telegram,
    verify_email_webhook_secret,
    verify_instagram_signature,
    verify_telegram_secret,
    verify_twilio_signature,
)


# ============================================================================
# 1. Instagram DM & Facebook Messenger Channel Tests
# ============================================================================

def test_instagram_signature_verification():
    secret = "meta_app_secret_999"
    payload = b'{"object":"instagram","entry":[]}'
    sig = "sha256=" + hmac.new(secret.encode("utf-8"), payload, hashlib.sha256).hexdigest()

    assert verify_instagram_signature(payload, sig, secret) is True
    assert verify_instagram_signature(payload + b"evil", sig, secret) is False
    assert verify_instagram_signature(payload, "invalid_sig", secret) is False


def test_instagram_normalize_text_and_quick_reply():
    event = {
        "sender": {"id": "ig_user_123"},
        "recipient": {"id": "ig_page_456"},
        "timestamp": 1700000000,
        "message": {
            "mid": "mid_001",
            "text": "How much is shipping to Canada?",
            "quick_reply": {"payload": "SHIPPING_QUERY"},
        },
    }

    inbound = normalize_instagram_message(event, is_instagram=True)
    assert inbound is not None
    assert inbound.channel == ChannelType.INSTAGRAM
    assert inbound.sender_id == "ig_user_123"
    assert inbound.session_id == "ig:ig_user_123"
    assert inbound.text == "How much is shipping to Canada?"
    assert inbound.interactive_reply_id == "SHIPPING_QUERY"


def test_messenger_normalize_postback():
    event = {
        "sender": {"id": "fb_user_789"},
        "recipient": {"id": "fb_page_456"},
        "timestamp": 1700000000,
        "postback": {
            "title": "Get Started",
            "payload": "USER_GET_STARTED",
            "mid": "mid_002",
        },
    }

    inbound = normalize_instagram_message(event, is_instagram=False)
    assert inbound is not None
    assert inbound.channel == ChannelType.MESSENGER
    assert inbound.session_id == "fb:fb_user_789"
    assert inbound.text == "Get Started"
    assert inbound.interactive_reply_id == "USER_GET_STARTED"


def test_instagram_send_outbound(monkeypatch):
    sent_requests = []

    class FakeResponse:
        status_code = 200
        text = '{"message_id":"mid_sent_1"}'

    async def fake_post(self, url, headers=None, json=None):
        sent_requests.append((url, headers, json))
        return FakeResponse()

    monkeypatch.setattr("httpx.AsyncClient.post", fake_post)

    success = asyncio.run(
        send_outbound_instagram(
            page_access_token="test_token_123",
            recipient_id="ig_user_123",
            text="Shipping to Canada is $15 with tracking.",
            quick_replies=["Place Order", "Talk to Human"],
        )
    )

    assert success is True
    assert len(sent_requests) == 1
    url, headers, body = sent_requests[0]
    assert url.startswith("https://graph.facebook.com/")
    assert headers["Authorization"] == "Bearer test_token_123"
    assert body["recipient"]["id"] == "ig_user_123"
    assert body["message"]["text"] == "Shipping to Canada is $15 with tracking."
    assert len(body["message"]["quick_replies"]) == 2


# ============================================================================
# 2. Telegram Bot API Channel Tests
# ============================================================================

def test_telegram_secret_token_verification():
    expected = "telegram_secret_token_abc"
    assert verify_telegram_secret("telegram_secret_token_abc", expected) is True
    assert verify_telegram_secret("wrong_token", expected) is False
    assert verify_telegram_secret("", expected) is False


def test_telegram_normalize_update():
    update = {
        "update_id": 99999,
        "message": {
            "message_id": 42,
            "from": {"id": 12345678, "first_name": "Alice"},
            "chat": {"id": 12345678, "type": "private"},
            "date": 1700000000,
            "text": "Can I book a demo call?",
        },
    }

    inbound = normalize_telegram_update(update)
    assert inbound is not None
    assert inbound.channel == ChannelType.TELEGRAM
    assert inbound.sender_id == "12345678"
    assert inbound.session_id == "tg:12345678"
    assert inbound.text == "Can I book a demo call?"


def test_telegram_normalize_callback_query():
    update = {
        "update_id": 100000,
        "callback_query": {
            "id": "cb_001",
            "from": {"id": 12345678},
            "message": {"chat": {"id": 12345678}},
            "data": "TALK_TO_HUMAN",
        },
    }

    inbound = normalize_telegram_update(update)
    assert inbound is not None
    assert inbound.channel == ChannelType.TELEGRAM
    assert inbound.text == "TALK_TO_HUMAN"
    assert inbound.interactive_reply_id == "TALK_TO_HUMAN"


def test_telegram_send_outbound_with_inline_buttons(monkeypatch):
    sent_requests = []

    class FakeResponse:
        status_code = 200
        text = '{"ok":true}'

    async def fake_post(self, url, json=None):
        sent_requests.append((url, json))
        return FakeResponse()

    monkeypatch.setattr("httpx.AsyncClient.post", fake_post)

    success = asyncio.run(
        send_outbound_telegram(
            bot_token="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11",
            chat_id=12345678,
            text="Please pick a time for your demo below:",
            inline_buttons=[{"text": "📅 Book Demo", "url": "https://chatty.personaliai.com/book/demo"}],
        )
    )

    assert success is True
    assert len(sent_requests) == 1
    url, body = sent_requests[0]
    assert "api.telegram.org/bot123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11/sendMessage" in url
    assert body["chat_id"] == 12345678
    assert "inline_keyboard" in body["reply_markup"]
    assert body["reply_markup"]["inline_keyboard"][0][0]["text"] == "📅 Book Demo"


# ============================================================================
# 3. Two-Way SMS (Twilio & TCPA Compliance) Tests
# ============================================================================

def test_twilio_signature_verification():
    auth_token = "12345auth_token"
    url = "https://chatty.personaliai.com/webhook/twilio/sms"
    params = {"From": "+15551234567", "To": "+15559876543", "Body": "Hello"}

    # Compute expected signature
    import base64
    data = url + "BodyHelloFrom+15551234567To+15559876543"
    sig = base64.b64encode(hmac.new(auth_token.encode("utf-8"), data.encode("utf-8"), hashlib.sha1).digest()).decode("utf-8")

    assert verify_twilio_signature(url, params, sig, auth_token) is True
    assert verify_twilio_signature(url, params, "bad_sig", auth_token) is False


def test_tcpa_compliance_opt_out():
    is_comp, reply = check_tcpa_opt_out("STOP")
    assert is_comp is True
    assert "unsubscribed" in reply.lower()

    is_comp, reply = check_tcpa_opt_out("cancel")
    assert is_comp is True

    is_comp, reply = check_tcpa_opt_out("START")
    assert is_comp is True
    assert "resubscribed" in reply.lower()

    is_comp, _ = check_tcpa_opt_out("What are your business hours?")
    assert is_comp is False


def test_sms_normalize_webhook():
    form_data = {
        "From": "+1 (555) 234-5678",
        "To": "+15559876543",
        "Body": "Can someone call me back about my quote?",
        "MessageSid": "SM_1234567890",
    }

    inbound = normalize_sms_webhook(form_data)
    assert inbound is not None
    assert inbound.channel == ChannelType.SMS
    assert inbound.sender_id == "+15552345678"
    assert inbound.session_id == "sms:+15552345678"
    assert inbound.text == "Can someone call me back about my quote?"


def test_sms_send_outbound(monkeypatch):
    sent_requests = []

    class FakeResponse:
        status_code = 200
        text = '{"sid":"SM_sent_1"}'

    async def fake_post(self, url, data=None, auth=None):
        sent_requests.append((url, data, auth))
        return FakeResponse()

    monkeypatch.setattr("httpx.AsyncClient.post", fake_post)

    res = asyncio.run(
        send_outbound_sms(
            account_sid="AC12345",
            auth_token="auth_xyz",
            from_number="+15559876543",
            to_number="+15551234567",
            text="Hello from Chatty SMS support!",
        )
    )

    assert res is True
    assert len(sent_requests) == 1
    url, data, auth = sent_requests[0]
    assert url.startswith("https://api.twilio.com/")
    assert data["To"] == "+15551234567"
    assert data["From"] == "+15559876543"
    assert data["Body"] == "Hello from Chatty SMS support!"
    assert auth == ("AC12345", "auth_xyz")


# ============================================================================
# 4. Two-Way Email Support Channel Tests
# ============================================================================

def test_email_webhook_secret_verification():
    expected = "resend_secret_token_123"
    assert verify_email_webhook_secret("Bearer resend_secret_token_123", expected) is True
    assert verify_email_webhook_secret("resend_secret_token_123", expected) is True
    assert verify_email_webhook_secret("Bearer invalid", expected) is False


def test_clean_email_body_strips_quoted_replies():
    dirty_body = (
        "Here is my question about the API limits.\n\n"
        "On Oct 20, 2026, at 10:00 AM, Support <support@chatty.ai> wrote:\n"
        "> Hello, thanks for reaching out."
    )
    cleaned = clean_email_body(dirty_body)
    assert cleaned == "Here is my question about the API limits."


def test_email_normalize_message():
    payload = {
        "from": "Alex Morgan <alex@enterprise.com>",
        "to": ["support@mybot.chatty.ai"],
        "subject": "Enterprise Plan Inquiry",
        "text": "We are interested in a 50-seat plan.",
        "message_id": "<msg-001@enterprise.com>",
    }

    inbound = normalize_email_message(payload)
    assert inbound is not None
    assert inbound.channel == ChannelType.EMAIL
    assert inbound.sender_id == "alex@enterprise.com"
    assert inbound.session_id == "email:alex@enterprise.com"
    assert "Subject: Enterprise Plan Inquiry" in inbound.text
    assert "50-seat plan" in inbound.text
    assert inbound.raw["message_id"] == "<msg-001@enterprise.com>"


def test_email_send_outbound_with_threading(monkeypatch):
    sent_requests = []

    class FakeResponse:
        status_code = 200
        text = '{"id":"email_id_1"}'

    async def fake_post(self, url, headers=None, json=None):
        sent_requests.append((url, headers, json))
        return FakeResponse()

    monkeypatch.setattr("httpx.AsyncClient.post", fake_post)

    success = asyncio.run(
        send_outbound_email(
            api_key="re_123456",
            from_address="support@chatty.personaliai.com",
            to_address="alex@enterprise.com",
            subject="Enterprise Plan Inquiry",
            text_content="Thank you for inquiring! Here are the details.",
            in_reply_to="<msg-001@enterprise.com>",
        )
    )

    assert success is True
    assert len(sent_requests) == 1
    url, headers, body = sent_requests[0]
    assert body["to"] == ["alex@enterprise.com"]
    assert body["subject"] == "Re: Enterprise Plan Inquiry"
    assert body["headers"]["In-Reply-To"] == "<msg-001@enterprise.com>"
    assert body["headers"]["References"] == "<msg-001@enterprise.com>"


# ============================================================================
# 5. OmnichannelPipeline Multi-Channel Execution
# ============================================================================

def test_pipeline_routes_sms_tcpa_stop(monkeypatch):
    bot = {"id": "bot_sms_1", "user_id": "u1", "twilio_phone_number": "+15559998888"}
    owner = {"id": "u1", "auth_user_id": "u1"}
    inbound = InboundMessage(
        channel=ChannelType.SMS,
        sender_id="+15551234567",
        recipient_id="+15559998888",
        session_id="sms:+15551234567",
        message_id="SM_optout",
        text="STOP",
    )

    with patch("app.services.omnichannel.pipeline.send_outbound_sms", new_callable=AsyncMock) as mock_sms:
        mock_sms.return_value = True
        pipeline = OmnichannelPipeline()

        res = asyncio.run(
            pipeline.process_inbound(
                message=inbound,
                bot=bot,
                owner_user=owner,
                access_token="auth_123",
            )
        )

        assert res["status"] == "tcpa_compliance"
        assert "unsubscribed" in res["reply"].lower()
        mock_sms.assert_called_once()


def test_pipeline_routes_telegram_with_booking_inline_button(monkeypatch):
    bot = {
        "id": "bot_tg_1",
        "user_id": "u1",
        "telegram_bot_token": "tg_token_123",
        "calendar_scheduling_enabled": True,
        "whatsapp_app_secret": "secret_demo",
    }
    owner = {"id": "u1", "auth_user_id": "u1"}
    inbound = InboundMessage(
        channel=ChannelType.TELEGRAM,
        sender_id="987654321",
        recipient_id="bot",
        session_id="tg:987654321",
        message_id="msg_tg_01",
        text="Can I book a meeting for tomorrow?",
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
    monkeypatch.setattr("app.services.omnichannel.pipeline.run_db", lambda cb: asyncio.sleep(0, result=cb()))
    monkeypatch.setattr("app.services.omnichannel.pipeline.chatty_quota_exceeded", AsyncMock(return_value=False))
    monkeypatch.setattr("app.services.omnichannel.pipeline._upsert_session", AsyncMock())

    with patch("app.services.omnichannel.pipeline.run_widget_assistant", new_callable=AsyncMock) as mock_ai, \
         patch("app.services.omnichannel.pipeline.send_outbound_telegram", new_callable=AsyncMock) as mock_tg:

        mock_ai.return_value = {"reply": "I'd love to set up a meeting! [BOOKING_WIDGET]"}
        mock_tg.return_value = True

        pipeline = OmnichannelPipeline()
        res = asyncio.run(
            pipeline.process_inbound(
                message=inbound,
                bot=bot,
                owner_user=owner,
                access_token="tg_token_123",
            )
        )

        assert res["status"] == "delivered"
        mock_tg.assert_called_once()
        args = mock_tg.call_args[1]
        assert args["chat_id"] == "987654321"
        assert args["inline_buttons"] is not None
        assert "book/bot_tg_1?session_id=tg:987654321" in args["inline_buttons"][0]["url"]


def test_build_channel_booking_cta_across_all_channels():
    bot_id = "bot_univ"
    secret = "secret_key"

    # SMS
    sms_cta, sms_url = build_channel_booking_cta(ChannelType.SMS, bot_id, "+15551234567", secret)
    assert "session_id=sms:15551234567" in sms_url
    assert "Schedule your appointment here:" in sms_cta

    # Telegram
    tg_cta, tg_url = build_channel_booking_cta(ChannelType.TELEGRAM, bot_id, "12345678", secret)
    assert "session_id=tg:12345678" in tg_url
    assert "📅 *Schedule your appointment:*" in tg_cta

    # Email
    em_cta, em_url = build_channel_booking_cta(ChannelType.EMAIL, bot_id, "user@example.com", secret)
    assert "session_id=email:user@example.com" in em_url
    assert "Click the link to choose" in em_cta

    # Instagram
    ig_cta, ig_url = build_channel_booking_cta(ChannelType.INSTAGRAM, bot_id, "ig_user_1", secret)
    assert "session_id=ig:ig_user_1" in ig_url


# ============================================================================
# 6. Channel Test Endpoints & Bot Sanitization Tests
# ============================================================================

def test_bot_sanitization_masks_omnichannel_secrets():
    from app.routers.bots import _sanitize_bot_dict

    raw_bot = {
        "id": "bot_123",
        "name": "Omnichannel Assistant",
        "whatsapp_access_token": "EAAwa123",
        "whatsapp_app_secret": "wasecret",
        "instagram_access_token": "EAAig123",
        "instagram_app_secret": "igsecret",
        "telegram_bot_token": "123:tgtoken",
        "telegram_secret_token": "tgsecret",
        "twilio_auth_token": "twilioauth",
        "twilio_phone_number": "+15551234567",
        "email_support_address": "support@example.com",
        "email_webhook_secret": "emsecret",
    }

    sanitized = _sanitize_bot_dict(raw_bot, role="owner")

    # Sensitive secrets must be stripped
    assert "whatsapp_access_token" not in sanitized
    assert "whatsapp_app_secret" not in sanitized
    assert "instagram_access_token" not in sanitized
    assert "instagram_app_secret" not in sanitized
    assert "telegram_bot_token" not in sanitized
    assert sanitized.get("telegram_secret_token") == "tgsecret"  # Verify tokens/webhook secrets retained for owner dashboard
    assert "twilio_auth_token" not in sanitized
    assert "email_webhook_secret" not in sanitized

    # Configuration boolean flags must be computed
    assert sanitized["whatsapp_configured"] is True
    assert sanitized["instagram_configured"] is True
    assert sanitized["telegram_configured"] is True
    assert sanitized["sms_configured"] is True
    assert sanitized["email_configured"] is True


def test_telegram_test_endpoint():
    from app.routers.integrations import telegram_test

    mock_user = {"auth_user_id": "usr_test"}

    with patch("httpx.AsyncClient.get") as mock_get:
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "ok": True,
            "result": {"username": "test_support_bot", "first_name": "Test Support"},
        }
        mock_get.return_value = mock_resp

        res = asyncio.run(telegram_test(bot_id="bot_1", bot_token="123456:ABC-DEF", user=mock_user))
        assert res["ok"] is True
        assert res["username"] == "test_support_bot"


def test_sms_test_endpoint():
    from app.routers.integrations import sms_test

    mock_user = {"auth_user_id": "usr_test"}

    with patch("httpx.AsyncClient.get") as mock_get:
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "friendly_name": "Production Twilio Account",
            "status": "active",
        }
        mock_get.return_value = mock_resp

        res = asyncio.run(
            sms_test(
                bot_id="bot_1",
                account_sid="AC_TEST_MOCK_TWILIO_ACCOUNT_SID",
                auth_token="auth_secret_token",
                phone_number="+15551234567",
                user=mock_user,
            )
        )
        assert res["ok"] is True
        assert res["friendly_name"] == "Production Twilio Account"


def test_email_test_endpoint():
    from app.routers.integrations import email_test

    mock_user = {"auth_user_id": "usr_test"}

    res = asyncio.run(
        email_test(
            bot_id="bot_1",
            support_address="support@company.com",
            user=mock_user,
        )
    )
    assert res["ok"] is True
    assert res["support_address"] == "support@company.com"

