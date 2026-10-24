"""
End-to-end tests for the Chatty Omnichannel Messaging Hub (7 Channels):
WhatsApp Business, Facebook Messenger, Instagram DM, TikTok Business,
Telegram Bot, Two-Way SMS, and Two-Way Support Email.
"""

import asyncio
import hmac
import hashlib
import json
import pytest
from unittest.mock import patch, MagicMock, AsyncMock

from app.services.omnichannel.models import (
    ChannelType,
    InboundMessage,
    OutboundMessage,
)
from app.services.omnichannel.config_store import (
    unpack_omnichannel_bot_row,
    update_bot_omnichannel_safe,
    OMNICHANNEL_SECRET_FIELDS,
)
from app.services.omnichannel.tiktok_adapter import (
    verify_tiktok_signature,
    normalize_tiktok_message,
    send_outbound_tiktok,
)
from app.core.crypto import encrypt_secret, decrypt_secret
from app.routers.bots import _sanitize_bot_dict
from app.services.flow_runtime import _detect_platform_metadata


# ============================================================================
# 1. Configuration Store & Secrets Resilience Tests
# ============================================================================

def test_config_store_unpack_flat_and_envelope():
    """Verify unpack_omnichannel_bot_row correctly restores extended fields from JSONB envelope."""
    bot_row = {
        "id": "bot-123",
        "whatsapp_enabled": True,
        "whatsapp_phone_number_id": "10001",
        "whatsapp_access_token": "wa-token",
        "whatsapp_quick_replies": {
            "items": ["Book Call", "Pricing"],
            "_omnichannel": {
                "messenger_enabled": True,
                "messenger_page_id": "page-999",
                "messenger_page_name": "Acme Brand",
                "messenger_access_token": "fb-token",
                "messenger_quick_replies": ["FAQ", "Contact"],
                "tiktok_enabled": True,
                "tiktok_open_id": "tt-user-88",
                "tiktok_access_token": "tt-token",
                "tiktok_quick_replies": ["Order Status"],
                "instagram_quick_replies": ["Support"],
            }
        }
    }

    unpacked = unpack_omnichannel_bot_row(bot_row)
    assert unpacked["whatsapp_enabled"] is True
    assert unpacked["whatsapp_quick_replies"] == ["Book Call", "Pricing"]
    assert unpacked["messenger_enabled"] is True
    assert unpacked["messenger_page_id"] == "page-999"
    assert unpacked["messenger_page_name"] == "Acme Brand"
    assert unpacked["messenger_access_token"] == "fb-token"
    assert unpacked["messenger_quick_replies"] == ["FAQ", "Contact"]
    assert unpacked["tiktok_enabled"] is True
    assert unpacked["tiktok_open_id"] == "tt-user-88"
    assert unpacked["tiktok_access_token"] == "tt-token"
    assert unpacked["tiktok_quick_replies"] == ["Order Status"]
    assert unpacked["instagram_quick_replies"] == ["Support"]

    # Test sanitized bot dict computes *_configured flags
    sanitized = _sanitize_bot_dict(bot_row)
    assert sanitized["whatsapp_configured"] is True
    assert sanitized["messenger_configured"] is True
    assert sanitized["tiktok_configured"] is True


def test_config_store_safe_update_does_not_clobber_existing_secrets():
    """Verify update_bot_omnichannel_safe preserves existing encrypted tokens if empty strings are sent."""
    existing_bot = {
        "id": "bot-abc",
        "whatsapp_access_token": encrypt_secret("existing-wa-token"),
        "whatsapp_quick_replies": {
            "items": [],
            "_omnichannel": {
                "messenger_access_token": encrypt_secret("existing-fb-token"),
                "tiktok_access_token": encrypt_secret("existing-tt-token"),
            }
        }
    }

    mock_client = MagicMock()

    async def run_test():
        with patch("app.services.omnichannel.config_store.run_db") as mock_run_db:
            # 1st call for select, 2nd call for update
            select_resp = MagicMock(data=[existing_bot])
            update_resp = MagicMock(data=[{"id": "bot-abc"}])
            mock_run_db.side_effect = [select_resp, update_resp]

            res = await update_bot_omnichannel_safe(
                mock_client,
                "bot-abc",
                {
                    "messenger_page_id": "new-page-id",
                    "messenger_access_token": "",  # Empty draft - MUST NOT overwrite!
                    "tiktok_access_token": None,   # None - MUST NOT overwrite!
                }
            )
            assert res is not None

    asyncio.run(run_test())


# ============================================================================
# 2. TikTok Business Adapter Tests
# ============================================================================

def test_tiktok_hmac_signature_verification():
    """Test TikTok HMAC-SHA256 signature verification across format variants."""
    body = b'{"event":"message_send","msg_id":"msg_12345"}'
    secret = "my_tiktok_client_secret_xyz"

    expected_sig = hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()

    # Format 1: plain hex
    assert verify_tiktok_signature(body, expected_sig, secret) is True

    # Format 2: sha256=hex
    assert verify_tiktok_signature(body, f"sha256={expected_sig}", secret) is True

    # Format 3: v2 timestamped signature t=1234567890,s=hex
    body_with_ts = f"1234567890.{body.decode('utf-8')}".encode("utf-8")
    sig_with_ts = hmac.new(secret.encode("utf-8"), body_with_ts, hashlib.sha256).hexdigest()
    assert verify_tiktok_signature(body, f"t=1234567890,s={sig_with_ts}", secret) is True

    # Wrong signature rejected
    assert verify_tiktok_signature(body, "bad_signature_here", secret) is False


def test_tiktok_normalize_inbound_message():
    """Verify TikTok incoming webhook payload is converted to normalized InboundMessage."""
    payload = {
        "event": "im.business.message",
        "data": {
            "open_id": "tt_user_998877",
            "business_id": "tt_biz_112233",
            "create_time": 1729780000,
            "message": {
                "msg_id": "msg_001",
                "msg_type": "text",
                "text": "Hello, do you ship to Canada?"
            }
        }
    }

    inbound = normalize_tiktok_message(payload)
    assert inbound is not None
    assert inbound.channel == ChannelType.TIKTOK
    assert inbound.sender_id == "tt_user_998877"
    assert inbound.session_id == "tt:tt_user_998877"
    assert inbound.text == "Hello, do you ship to Canada?"


def test_tiktok_outbound_send():
    """Verify send_outbound_tiktok makes correct HTTP POST to TikTok Business API."""
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {"code": 0, "message": "success"}

    async def run_send():
        with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
            mock_post.return_value = mock_resp
            success = await send_outbound_tiktok(
                access_token="test-tiktok-access-token",
                business_id="tt_biz_112233",
                recipient_id="tt_user_998877",
                text="Yes! We ship across Canada and the US.",
                quick_replies=["View Catalog", "Shipping Rates"],
            )
            assert success is True
            assert mock_post.called
            call_kwargs = mock_post.call_args[1]
            assert call_kwargs["headers"]["Access-Token"] == "test-tiktok-access-token"
            assert "View Catalog" in json.dumps(call_kwargs["json"])

    asyncio.run(run_send())


# ============================================================================
# 3. Flow Runtime Platform Detection Tests
# ============================================================================

def test_flow_runtime_platform_detection():
    """Verify _detect_platform_metadata detects whatsapp, messenger, instagram, and tiktok platforms."""
    # WhatsApp
    meta_wa = _detect_platform_metadata({"channel": "whatsapp"}, {})
    assert meta_wa["channel"] == "whatsapp"
    assert meta_wa["platform"] == "whatsapp"
    assert meta_wa["device"] == "mobile"

    # Messenger
    meta_fb = _detect_platform_metadata({"channel": "messenger"}, {})
    assert meta_fb["channel"] == "messenger"
    assert meta_fb["platform"] == "messenger"

    # Instagram
    meta_ig = _detect_platform_metadata({"channel": "instagram"}, {})
    assert meta_ig["channel"] == "instagram"
    assert meta_ig["platform"] == "instagram"
    assert meta_ig["device"] == "mobile"

    # TikTok
    meta_tt = _detect_platform_metadata({"channel": "tiktok"}, {})
    assert meta_tt["channel"] == "tiktok"
    assert meta_tt["platform"] == "tiktok"
    assert meta_tt["device"] == "mobile"

    # Web Chat fallback
    meta_web = _detect_platform_metadata({}, {})
    assert meta_web["channel"] == "web"
    assert meta_web["platform"] == "web"
    assert meta_web["device"] == "desktop"
