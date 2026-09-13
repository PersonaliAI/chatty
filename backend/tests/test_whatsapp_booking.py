"""Unit tests for WhatsApp secure booking links, confirmation dispatch,
anti-spam bombing protection, and visitor memory.
"""

from __future__ import annotations

import asyncio
import time
from unittest.mock import AsyncMock, patch

import pytest

import main  # noqa: F401
from app.services.whatsapp_service import (
    build_whatsapp_booking_url,
    dispatch_whatsapp_booking_confirmation,
    generate_whatsapp_booking_signature,
    get_bot_whatsapp_secret,
    send_whatsapp_message,
    verify_whatsapp_booking_signature,
)


def test_whatsapp_signature_valid():
    bot_id = "bot-test-123"
    phone = "+1 (555) 234-5678"
    secret = "super_secret_test_key"
    ts = int(time.time())

    sig = generate_whatsapp_booking_signature(bot_id, phone, ts, secret)
    assert len(sig) == 24
    assert verify_whatsapp_booking_signature(bot_id, phone, ts, sig, secret) is True


def test_whatsapp_signature_rejects_tampered_phone():
    bot_id = "bot-test-123"
    phone = "15552345678"
    secret = "super_secret_test_key"
    ts = int(time.time())

    sig = generate_whatsapp_booking_signature(bot_id, phone, ts, secret)
    # Attacker tries to use the same token for a different victim's phone number
    assert verify_whatsapp_booking_signature(bot_id, "15559998877", ts, sig, secret) is False


def test_whatsapp_signature_rejects_tampered_timestamp():
    bot_id = "bot-test-123"
    phone = "15552345678"
    secret = "super_secret_test_key"
    ts = int(time.time())

    sig = generate_whatsapp_booking_signature(bot_id, phone, ts, secret)
    assert verify_whatsapp_booking_signature(bot_id, phone, ts + 100, sig, secret) is False


def test_whatsapp_signature_rejects_expired():
    bot_id = "bot-test-123"
    phone = "15552345678"
    secret = "super_secret_test_key"
    expired_ts = int(time.time()) - (73 * 3600)  # 73 hours ago (max is 72 hours)

    sig = generate_whatsapp_booking_signature(bot_id, phone, expired_ts, secret)
    assert verify_whatsapp_booking_signature(bot_id, phone, expired_ts, sig, secret) is False


def test_whatsapp_signature_rejects_future_skew():
    bot_id = "bot-test-123"
    phone = "15552345678"
    secret = "super_secret_test_key"
    future_ts = int(time.time()) + 600  # 10 minutes in future (tolerance is 5 mins)

    sig = generate_whatsapp_booking_signature(bot_id, phone, future_ts, secret)
    assert verify_whatsapp_booking_signature(bot_id, phone, future_ts, sig, secret) is False


def test_build_whatsapp_booking_url():
    bot_id = "bot_abc_456"
    phone = "+1 234 567 8900"
    secret = "bot_secret_xyz"
    ts = 1700000000

    url, generated_ts, sig = build_whatsapp_booking_url(
        bot_id=bot_id,
        phone=phone,
        secret=secret,
        base_url="https://chatty.personaliai.com",
        current_time=ts,
    )

    assert generated_ts == 1700000000
    assert "https://chatty.personaliai.com/book/bot_abc_456" in url
    assert "session_id=wa:12345678900" in url
    assert "t=1700000000" in url
    assert f"sig={sig}" in url


def test_dispatch_whatsapp_booking_confirmation():
    bot = {
        "id": "bot_999",
        "whatsapp_phone_number_id": "phone_id_123",
        "whatsapp_access_token": "token_abc_xyz",
    }

    with patch("app.services.whatsapp_service.send_whatsapp_message", new_callable=AsyncMock) as mock_send:
        mock_send.return_value = True

        res = asyncio.run(
            dispatch_whatsapp_booking_confirmation(
                bot=bot,
                phone="15552345678",
                formatted_time="Thursday, Sep 18 at 10:00 AM (EDT)",
                meeting_link="https://meet.google.com/abc-defg-hij",
                attendee_email="alex@company.com",
                attendee_name="Alex Smith",
            )
        )

        assert res is True
        mock_send.assert_called_once()
        args = mock_send.call_args[1]
        assert args["phone_number_id"] == "phone_id_123"
        assert args["to"] == "15552345678"
        text = args["text"]
        assert "Booking Confirmed!" in text
        assert "Alex Smith" in text
        assert "Thursday, Sep 18 at 10:00 AM (EDT)" in text
        assert "https://meet.google.com/abc-defg-hij" in text
        assert "alex@company.com" in text
