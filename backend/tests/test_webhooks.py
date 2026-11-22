"""Unit tests for app/routers/webhooks.py's Resend inbound-email handler
(team scheduling Phase 4 - captures a visitor's reply to a meeting email
into that meeting's thread). Lemon Squeezy / WhatsApp webhooks in
this same router already had no test coverage before this file; not
backfilled here, out of scope for this change.
"""
from __future__ import annotations

import asyncio
import base64
import hashlib
import hmac
import json
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

import main  # noqa: F401 - see tests/test_admin.py for why this must come first
from app.routers import webhooks
from fastapi import HTTPException
from plugins import agent_tools


SECRET = "whsec_" + base64.b64encode(b"test-secret-bytes-32-long-000000").decode()


def _sign(svix_id: str, svix_timestamp: str, body: bytes, secret: str = SECRET) -> str:
    secret_bytes = base64.b64decode(secret.removeprefix("whsec_"))
    signed_content = f"{svix_id}.{svix_timestamp}.".encode() + body
    sig = base64.b64encode(hmac.new(secret_bytes, signed_content, hashlib.sha256).digest()).decode()
    return f"v1,{sig}"


class _FakeRequest:
    def __init__(self, body: bytes, headers: dict):
        self._body = body
        self.headers = headers

    async def body(self):
        return self._body


# ---------------------------------------------------------------------------
# _verify_svix_signature
# ---------------------------------------------------------------------------


def test_verify_svix_signature_accepts_valid():
    body = b'{"a":1}'
    svix_id, svix_ts = "msg_1", "1700000000"
    sig = _sign(svix_id, svix_ts, body)
    assert webhooks._verify_svix_signature(svix_id, svix_ts, body, sig, SECRET) is True


def test_verify_svix_signature_rejects_tampered_body():
    body = b'{"a":1}'
    svix_id, svix_ts = "msg_1", "1700000000"
    sig = _sign(svix_id, svix_ts, body)
    assert webhooks._verify_svix_signature(svix_id, svix_ts, b'{"a":2}', sig, SECRET) is False


def test_verify_svix_signature_rejects_wrong_secret():
    body = b'{"a":1}'
    svix_id, svix_ts = "msg_1", "1700000000"
    sig = _sign(svix_id, svix_ts, body)
    other_secret = "whsec_" + base64.b64encode(b"a-different-32-byte-secret-000000").decode()
    assert webhooks._verify_svix_signature(svix_id, svix_ts, body, sig, other_secret) is False


def test_verify_svix_signature_rejects_when_unconfigured():
    body = b'{"a":1}'
    sig = _sign("msg_1", "1700000000", body)
    assert webhooks._verify_svix_signature("msg_1", "1700000000", body, sig, "") is False


def test_verify_svix_signature_rejects_missing_headers():
    assert webhooks._verify_svix_signature("", "1700000000", b"{}", "v1,abc", SECRET) is False
    assert webhooks._verify_svix_signature("msg_1", "", b"{}", "v1,abc", SECRET) is False
    assert webhooks._verify_svix_signature("msg_1", "1700000000", b"{}", "", SECRET) is False


def test_verify_svix_signature_accepts_any_matching_candidate():
    body = b'{"a":1}'
    svix_id, svix_ts = "msg_1", "1700000000"
    real_sig = _sign(svix_id, svix_ts, body)
    header = f"v1,bogus {real_sig}"  # simulates a rotation with an old+new candidate
    assert webhooks._verify_svix_signature(svix_id, svix_ts, body, header, SECRET) is True


# ---------------------------------------------------------------------------
# resend_inbound
# ---------------------------------------------------------------------------


def _inbound_request(data: dict, secret: str = SECRET) -> _FakeRequest:
    body = json.dumps({"data": data}).encode()
    svix_id, svix_ts = "msg_1", "1700000000"
    sig = _sign(svix_id, svix_ts, body, secret)
    return _FakeRequest(body, {"svix-id": svix_id, "svix-timestamp": svix_ts, "svix-signature": sig})


def test_resend_inbound_rejects_bad_signature(monkeypatch):
    monkeypatch.setattr(webhooks, "RESEND_INBOUND_WEBHOOK_SECRET", SECRET)
    req = _inbound_request({"to": ["meeting+11111111-1111-1111-1111-111111111111@meetings.example.com"]})
    req.headers = {**req.headers, "svix-signature": "v1,wrong"}
    with pytest.raises(HTTPException) as exc:
        asyncio.run(webhooks.resend_inbound(req))
    assert exc.value.status_code == 403


def test_resend_inbound_no_matching_address_returns_ok_unmatched(monkeypatch):
    monkeypatch.setattr(webhooks, "RESEND_INBOUND_WEBHOOK_SECRET", SECRET)
    req = _inbound_request({"to": ["someone-else@meetings.example.com"], "from": "visitor@example.com"})
    result = asyncio.run(webhooks.resend_inbound(req))
    assert result == {"ok": True, "matched": False}


def test_resend_inbound_unknown_meeting_id_returns_ok_unmatched(monkeypatch):
    monkeypatch.setattr(webhooks, "RESEND_INBOUND_WEBHOOK_SECRET", SECRET)
    fake_supabase = MagicMock()
    fake_supabase.table.return_value.select.return_value.eq.return_value.execute.return_value = SimpleNamespace(data=[])
    monkeypatch.setattr(webhooks, "supabase", fake_supabase)
    meeting_id = "11111111-1111-1111-1111-111111111111"
    req = _inbound_request({"to": [f"meeting+{meeting_id}@meetings.example.com"], "from": "visitor@example.com"})
    result = asyncio.run(webhooks.resend_inbound(req))
    assert result == {"ok": True, "matched": False}


def test_resend_inbound_records_matched_reply(monkeypatch):
    monkeypatch.setattr(webhooks, "RESEND_INBOUND_WEBHOOK_SECRET", SECRET)
    meeting_id = "11111111-1111-1111-1111-111111111111"
    inserted = {}

    fake_supabase = MagicMock()

    def table(name):
        t = MagicMock()
        if name == "chatty_meetings":
            t.select.return_value.eq.return_value.execute.return_value = SimpleNamespace(data=[{"id": meeting_id}])
        elif name == "chatty_meeting_messages":
            def do_insert(payload):
                inserted.update(payload)
                m = MagicMock()
                m.execute.return_value = SimpleNamespace(data=[{"id": "msg-1"}])
                return m
            t.insert.side_effect = do_insert
        return t
    fake_supabase.table.side_effect = table
    monkeypatch.setattr(webhooks, "supabase", fake_supabase)
    auto_reply_mock = AsyncMock()
    monkeypatch.setattr(agent_tools, "handle_meeting_email_reply", auto_reply_mock)

    req = _inbound_request({
        "to": [f"meeting+{meeting_id}@meetings.example.com"],
        "from": {"email": "visitor@example.com"},
        "subject": "Re: Meeting Confirmed",
        "text": "Can we move this to 3pm?",
    })
    result = asyncio.run(webhooks.resend_inbound(req))

    assert result == {"ok": True, "matched": True}
    auto_reply_mock.assert_awaited_once()
    assert inserted["meeting_id"] == meeting_id
    assert inserted["direction"] == "inbound"
    assert inserted["from_email"] == "visitor@example.com"
    assert inserted["body_text"] == "Can we move this to 3pm?"


def test_resend_inbound_handles_string_to_field(monkeypatch):
    monkeypatch.setattr(webhooks, "RESEND_INBOUND_WEBHOOK_SECRET", SECRET)
    meeting_id = "22222222-2222-2222-2222-222222222222"
    fake_supabase = MagicMock()

    def table(name):
        t = MagicMock()
        if name == "chatty_meetings":
            t.select.return_value.eq.return_value.execute.return_value = SimpleNamespace(data=[{"id": meeting_id}])
        elif name == "chatty_meeting_messages":
            t.insert.return_value.execute.return_value = SimpleNamespace(data=[{"id": "msg-1"}])
        return t
    fake_supabase.table.side_effect = table
    monkeypatch.setattr(webhooks, "supabase", fake_supabase)
    monkeypatch.setattr(agent_tools, "handle_meeting_email_reply", AsyncMock())

    req = _inbound_request({"to": f"meeting+{meeting_id}@meetings.example.com", "from": "visitor@example.com"})
    result = asyncio.run(webhooks.resend_inbound(req))
    assert result == {"ok": True, "matched": True}


# ---------------------------------------------------------------------------
# WhatsApp Webhook Tests
# ---------------------------------------------------------------------------


def test_verify_meta_signature_accepts_valid():
    secret = "app_secret_12345"
    payload = b'{"object":"whatsapp_business_account","entry":[]}'
    expected_sig = "sha256=" + hmac.new(secret.encode("utf-8"), payload, hashlib.sha256).hexdigest()
    assert webhooks._verify_meta_signature(payload, expected_sig, secret) is True


def test_verify_meta_signature_rejects_tampered_payload():
    secret = "app_secret_12345"
    payload = b'{"object":"whatsapp_business_account","entry":[]}'
    expected_sig = "sha256=" + hmac.new(secret.encode("utf-8"), payload, hashlib.sha256).hexdigest()
    assert webhooks._verify_meta_signature(b'{"tampered":true}', expected_sig, secret) is False


def test_verify_meta_signature_rejects_wrong_secret():
    payload = b'{"object":"whatsapp_business_account","entry":[]}'
    expected_sig = "sha256=" + hmac.new(b"secret_a", payload, hashlib.sha256).hexdigest()
    assert webhooks._verify_meta_signature(payload, expected_sig, "secret_b") is False


def test_whatsapp_receive_fails_closed_without_app_secret():
    request = _FakeRequest(
        json.dumps({"entry": [{"changes": [{"value": {"metadata": {"phone_number_id": "pnid"}}}]}]}).encode(),
        {},
    )
    with patch.object(webhooks, "run_db", new_callable=AsyncMock) as db:
        db.return_value = SimpleNamespace(data=[{
            "id": "bot-1",
            "user_id": "user-1",
            "whatsapp_phone_number_id": "pnid",
        }])
        with pytest.raises(HTTPException) as exc:
            asyncio.run(webhooks.whatsapp_receive(request))
    assert exc.value.status_code == 503


def test_whatsapp_product_card_is_rendered_as_text():
    reply = (
        'Found it! [PRODUCT_CARD:{"title":"Trail shoe","variant_id":"4201",'
        '"variant_sku":"TRAIL-42-BLK","price":"99.00","currency":"USD",'
        '"url":"https://shop.example/trail?variation_id=4201","in_stock":true}]'
    )
    rendered = webhooks._render_whatsapp_product_cards(reply)
    assert "PRODUCT_CARD" not in rendered
    assert "Trail shoe" in rendered
    assert "TRAIL-42-BLK" in rendered
    assert "USD 99.00" in rendered
    assert "https://shop.example/trail?variation_id=4201" in rendered


def test_whatsapp_product_card_does_not_emit_untrusted_link():
    rendered = webhooks._render_whatsapp_product_cards(
        '[PRODUCT_CARD:{"title":"Item","url":"javascript:alert(1)","in_stock":false}]'
    )
    assert "Item" in rendered
    assert "javascript:" not in rendered
    assert "Out of stock" in rendered


def test_whatsapp_media_boundary_checks():
    assert webhooks._is_allowed_whatsapp_media_url("https://lookaside.fbsbx.com/media") is True
    assert webhooks._is_allowed_whatsapp_media_url("https://attacker.example/media") is False
    assert webhooks._is_allowed_whatsapp_media_url("http://lookaside.fbsbx.com/media") is False
    assert webhooks._WHATSAPP_MEDIA_LIMITS["image"] == 5 * 1024 * 1024
    assert webhooks._WHATSAPP_MEDIA_LIMITS["audio"] == 16 * 1024 * 1024
    assert webhooks._WHATSAPP_MEDIA_LIMITS["document"] == 25 * 1024 * 1024
    assert webhooks._media_signature_matches(b"\xff\xd8\xffimage", "image/jpeg") is True
    assert webhooks._media_signature_matches(b"not-an-image", "image/jpeg") is False
    assert webhooks._media_signature_matches(b"%PDF-1.7", "application/pdf") is True


def test_whatsapp_verify_handshake_server_token(monkeypatch):
    monkeypatch.setattr(webhooks, "WHATSAPP_VERIFY_TOKEN", "global_token_123")
    req = SimpleNamespace(
        query_params={
            "hub.mode": "subscribe",
            "hub.verify_token": "global_token_123",
            "hub.challenge": "challenge_string_abc",
        }
    )
    res = asyncio.run(webhooks.whatsapp_verify(req))
    assert res.body.decode() == "challenge_string_abc"


def test_whatsapp_verify_handshake_per_bot_token(monkeypatch):
    monkeypatch.setattr(webhooks, "WHATSAPP_VERIFY_TOKEN", "other_token")
    fake_supabase = MagicMock()
    t = MagicMock()
    t.select.return_value.eq.return_value.limit.return_value.execute.return_value = SimpleNamespace(
        data=[{"id": "bot-123"}]
    )
    fake_supabase.table.return_value = t
    monkeypatch.setattr(webhooks, "supabase", fake_supabase)

    req = SimpleNamespace(
        query_params={
            "hub.mode": "subscribe",
            "hub.verify_token": "bot_custom_token_456",
            "hub.challenge": "challenge_custom_123",
        }
    )
    res = asyncio.run(webhooks.whatsapp_verify(req))
    assert res.body.decode() == "challenge_custom_123"


def test_whatsapp_verify_handshake_rejects_invalid_token(monkeypatch):
    monkeypatch.setattr(webhooks, "WHATSAPP_VERIFY_TOKEN", "other_token")
    fake_supabase = MagicMock()
    t = MagicMock()
    t.select.return_value.eq.return_value.limit.return_value.execute.return_value = SimpleNamespace(data=[])
    fake_supabase.table.return_value = t
    monkeypatch.setattr(webhooks, "supabase", fake_supabase)

    req = SimpleNamespace(
        query_params={
            "hub.mode": "subscribe",
            "hub.verify_token": "wrong_token",
            "hub.challenge": "challenge_123",
        }
    )
    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(webhooks.whatsapp_verify(req))
    assert exc_info.value.status_code == 403


# ---------------------------------------------------------------------------
# Polar.sh Platform Subscription Webhook Tests
# ---------------------------------------------------------------------------


def _polar_sign(wh_id: str, wh_ts: str, body: bytes, secret: str) -> str:
    signed_content = f"{wh_id}.{wh_ts}.".encode("utf-8") + body
    sig = base64.b64encode(hmac.new(secret.encode("utf-8"), signed_content, hashlib.sha256).digest()).decode("utf-8")
    return f"v1,{sig}"


def test_verify_polar_signature_standard_webhooks():
    secret = "polar_whs_test_secret_key_12345"
    body = b'{"type":"subscription.created","data":{"id":"sub_polar_1"}}'
    wh_id, wh_ts = "msg_polar_1", "1700000000"
    sig = _polar_sign(wh_id, wh_ts, body, secret)
    headers = {"webhook-id": wh_id, "webhook-timestamp": wh_ts, "webhook-signature": sig}
    assert webhooks._verify_polar_signature(headers, body, secret) is True
    assert webhooks._verify_polar_signature(headers, b'{"tampered":true}', secret) is False
    assert webhooks._verify_polar_signature(headers, body, "wrong_secret") is False


def test_webhook_polar_subscription_created_syncs_user_and_subscription(monkeypatch):
    secret = "polar_whs_secret_abc"
    monkeypatch.setattr(webhooks, "POLAR_WEBHOOK_SECRET", secret)
    monkeypatch.setattr(webhooks, "POLAR_PRODUCT_TO_PLAN", {"prod_std_123": "chatty_standard"})

    user_updates_captured = {}
    sub_upserts_captured = {}

    fake_supabase = MagicMock()

    def table(name):
        t = MagicMock()
        if name == "users":
            def do_update(payload):
                user_updates_captured.update(payload)
                m = MagicMock()
                m.eq.return_value.execute.return_value = SimpleNamespace(data=[{"auth_user_id": "u-123"}])
                return m
            t.update.side_effect = do_update
            t.select.return_value.eq.return_value.limit.return_value.execute.return_value = SimpleNamespace(
                data=[{"email": "founder@acme.io", "display_name": "Founder"}]
            )
        elif name == "user_subscriptions":
            def do_upsert(payload, **kw):
                sub_upserts_captured.update(payload)
                m = MagicMock()
                m.execute.return_value = SimpleNamespace(data=[payload])
                return m
            t.upsert.side_effect = do_upsert
        else:
            t.upsert.return_value.execute.return_value = SimpleNamespace(data=[])
        return t

    fake_supabase.table.side_effect = table
    monkeypatch.setattr(webhooks, "supabase", fake_supabase)

    payload = {
        "type": "subscription.created",
        "data": {
            "id": "sub_polar_999",
            "status": "active",
            "product_id": "prod_std_123",
            "customer_id": "cust_polar_888",
            "current_period_end": "2026-12-22T00:00:00Z",
            "customer": {"id": "cust_polar_888", "email": "founder@acme.io", "name": "Founder"},
            "metadata": {"user_id": "u-123"},
        },
    }
    raw_body = json.dumps(payload).encode("utf-8")
    wh_id, wh_ts = "wh_evt_100", "1700000100"
    sig = _polar_sign(wh_id, wh_ts, raw_body, secret)
    req = _FakeRequest(raw_body, {"webhook-id": wh_id, "webhook-timestamp": wh_ts, "webhook-signature": sig})

    res = asyncio.run(webhooks.webhook_polar(req))
    assert res == {"status": "success"}
    assert user_updates_captured["plan"] == "chatty_standard"
    assert user_updates_captured["subscription_status"] == "active"
    assert user_updates_captured["lemon_customer_id"] == "cust_polar_888"
    assert user_updates_captured["lemon_subscription_id"] == "sub_polar_999"
    assert sub_upserts_captured["plan"] == "standard"
    assert sub_upserts_captured["variant_id"] == "prod_std_123"


def test_webhook_polar_subscription_canceled_updates_status(monkeypatch):
    secret = "polar_whs_secret_abc"
    monkeypatch.setattr(webhooks, "POLAR_WEBHOOK_SECRET", secret)

    user_updates_captured = {}
    fake_supabase = MagicMock()

    def table(name):
        t = MagicMock()
        if name == "users":
            def do_update(payload):
                user_updates_captured.update(payload)
                m = MagicMock()
                m.eq.return_value.execute.return_value = SimpleNamespace(data=[{"auth_user_id": "u-123"}])
                return m
            t.update.side_effect = do_update
            t.select.return_value.eq.return_value.limit.return_value.execute.return_value = SimpleNamespace(data=[])
        else:
            t.upsert.return_value.execute.return_value = SimpleNamespace(data=[])
            t.update.return_value.eq.return_value.execute.return_value = SimpleNamespace(data=[])
        return t

    fake_supabase.table.side_effect = table
    monkeypatch.setattr(webhooks, "supabase", fake_supabase)

    payload = {
        "type": "subscription.canceled",
        "data": {
            "id": "sub_polar_999",
            "status": "canceled",
            "product": {"id": "prod_hobby_1", "name": "Chatty Hobby"},
            "ends_at": "2026-12-22T00:00:00Z",
            "metadata": {"user_id": "u-123"},
        },
    }
    raw_body = json.dumps(payload).encode("utf-8")
    wh_id, wh_ts = "wh_evt_101", "1700000200"
    sig = _polar_sign(wh_id, wh_ts, raw_body, secret)
    req = _FakeRequest(raw_body, {"webhook-id": wh_id, "webhook-timestamp": wh_ts, "webhook-signature": sig})

    res = asyncio.run(webhooks.webhook_polar(req))
    assert res == {"status": "success"}
    assert user_updates_captured["subscription_status"] == "cancelled"
    assert user_updates_captured["subscription_renews_at"] == "2026-12-22T00:00:00Z"
