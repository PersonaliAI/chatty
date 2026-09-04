"""Unit tests for app/routers/webhooks.py's Resend inbound-email handler
(team scheduling Phase 4 — captures a visitor's reply to a meeting email
into that meeting's thread). Lemon Squeezy / WhatsApp / Slack webhooks in
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
from unittest.mock import MagicMock

import pytest

import main  # noqa: F401 — see tests/test_admin.py for why this must come first
from app.routers import webhooks
from fastapi import HTTPException


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

    req = _inbound_request({
        "to": [f"meeting+{meeting_id}@meetings.example.com"],
        "from": {"email": "visitor@example.com"},
        "subject": "Re: Meeting Confirmed",
        "text": "Can we move this to 3pm?",
    })
    result = asyncio.run(webhooks.resend_inbound(req))

    assert result == {"ok": True, "matched": True}
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

    req = _inbound_request({"to": f"meeting+{meeting_id}@meetings.example.com", "from": "visitor@example.com"})
    result = asyncio.run(webhooks.resend_inbound(req))
    assert result == {"ok": True, "matched": True}
