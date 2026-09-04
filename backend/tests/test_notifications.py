"""Pure unit tests for plugins/notifications.py — webhook signing, retry
schedule, config-driven channel selection, and HTML-escaping in the email
templates (visitor-supplied fields flow unescaped into HTML sent by email if
this regresses — see the fix that added the escaping)."""
import asyncio
import hashlib
import hmac
import socket
from unittest.mock import patch

from plugins import notifications as notify


# ---------------------------------------------------------------------------
# Webhook signing
# ---------------------------------------------------------------------------


def test_sign_webhook_body_matches_manual_hmac():
    secret = "whsec_test123"
    body = b'{"event":"lead.created"}'
    expected = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    assert notify.sign_webhook_body(secret, body) == expected


def test_sign_webhook_body_differs_for_different_secrets():
    body = b"same body"
    sig_a = notify.sign_webhook_body("secret-a", body)
    sig_b = notify.sign_webhook_body("secret-b", body)
    assert sig_a != sig_b


def test_sign_webhook_body_differs_for_different_bodies():
    secret = "whsec_test123"
    sig_a = notify.sign_webhook_body(secret, b"body-a")
    sig_b = notify.sign_webhook_body(secret, b"body-b")
    assert sig_a != sig_b


# ---------------------------------------------------------------------------
# Retry backoff schedule
# ---------------------------------------------------------------------------


def test_webhook_backoff_schedule_is_ascending():
    schedule = notify.WEBHOOK_BACKOFF_SCHEDULE
    assert schedule == sorted(schedule)


def test_webhook_max_attempts_is_backoff_schedule_length_plus_initial_send():
    assert notify.WEBHOOK_MAX_ATTEMPTS == len(notify.WEBHOOK_BACKOFF_SCHEDULE) + 1


def test_webhook_events_are_all_dot_namespaced():
    for event in notify.WEBHOOK_EVENTS:
        assert "." in event, f"{event!r} doesn't follow the '<noun>.<verb>' convention"


# ---------------------------------------------------------------------------
# SSRF guard applied at delivery time (not just registration) — deliveries
# can happen up to WEBHOOK_BACKOFF_SCHEDULE's full 8h window after a URL was
# last validated, long enough for DNS to point somewhere else by then.
# ---------------------------------------------------------------------------


def _addrinfo_for(*ips: str):
    return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", (ip, 0)) for ip in ips]


def test_deliver_webhook_blocks_url_resolving_to_private_ip():
    with patch.object(socket, "getaddrinfo", return_value=_addrinfo_for("10.0.0.5")):
        result = asyncio.run(notify.deliver_webhook(
            url="http://internal.example/hook", event="new_conversation", bot_id="b1", data={},
        ))
    assert result is False


def test_post_signed_webhook_blocks_url_resolving_to_link_local_metadata_address():
    with patch.object(socket, "getaddrinfo", return_value=_addrinfo_for("169.254.169.254")):
        ok, error = asyncio.run(notify._post_signed_webhook(
            "http://metadata.example/hook", "whsec_test", {"event": "lead.created"},
        ))
    assert ok is False
    assert "unsafe" in (error or "").lower()


# ---------------------------------------------------------------------------
# Config-driven channel ordering
# ---------------------------------------------------------------------------


def test_onesignal_configured_requires_both_app_id_and_key(monkeypatch):
    monkeypatch.setattr(notify, "ONESIGNAL_APP_ID", "")
    monkeypatch.setattr(notify, "ONESIGNAL_REST_API_KEY", "")
    assert notify.onesignal_configured() is False
    monkeypatch.setattr(notify, "ONESIGNAL_APP_ID", "app-id")
    assert notify.onesignal_configured() is False  # key still missing
    monkeypatch.setattr(notify, "ONESIGNAL_REST_API_KEY", "key")
    assert notify.onesignal_configured() is True


def test_resend_configured_requires_api_key(monkeypatch):
    monkeypatch.setattr(notify, "RESEND_API_KEY", "")
    assert notify.resend_configured() is False
    monkeypatch.setattr(notify, "RESEND_API_KEY", "re_test")
    assert notify.resend_configured() is True


def test_email_channels_default_order_is_onesignal_first(monkeypatch):
    monkeypatch.setattr(notify, "EMAIL_PROVIDER_PREFERRED", "onesignal")
    channels = notify._email_channels()
    assert [label for label, _ in channels] == ["sent", "sent_resend"]


def test_email_channels_prefer_resend_reverses_order(monkeypatch):
    monkeypatch.setattr(notify, "EMAIL_PROVIDER_PREFERRED", "resend")
    channels = notify._email_channels()
    assert [label for label, _ in channels] == ["sent_resend", "sent"]


def test_email_channels_never_drops_a_channel(monkeypatch):
    # Whichever provider isn't preferred must still run as the fallback.
    for preferred in ("onesignal", "resend"):
        monkeypatch.setattr(notify, "EMAIL_PROVIDER_PREFERRED", preferred)
        labels = {label for label, _ in notify._email_channels()}
        assert labels == {"sent", "sent_resend"}


# ---------------------------------------------------------------------------
# reply_to threading (team scheduling Phase 4 — meeting reply capture)
# ---------------------------------------------------------------------------


class _FakeHttpxResponse:
    def __init__(self, status_code=200):
        self.status_code = status_code
        self.text = ""

    def json(self):
        return {}


class _FakeHttpxClient:
    """Captures the last JSON payload posted, regardless of URL."""
    last_payload = None

    def __init__(self, *a, **kw):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, *a):
        return False

    async def post(self, url, json=None, headers=None):
        _FakeHttpxClient.last_payload = json
        return _FakeHttpxResponse()


def test_send_resend_email_includes_reply_to_when_given(monkeypatch):
    monkeypatch.setattr(notify, "RESEND_API_KEY", "re_test")
    monkeypatch.setattr(notify.httpx, "AsyncClient", _FakeHttpxClient)
    asyncio.run(notify._send_resend_email(to="a@example.com", subject="s", html="<p/>", reply_to="meeting+abc@meetings.example.com"))
    assert _FakeHttpxClient.last_payload["reply_to"] == "meeting+abc@meetings.example.com"


def test_send_resend_email_omits_reply_to_when_not_given(monkeypatch):
    monkeypatch.setattr(notify, "RESEND_API_KEY", "re_test")
    monkeypatch.setattr(notify.httpx, "AsyncClient", _FakeHttpxClient)
    asyncio.run(notify._send_resend_email(to="a@example.com", subject="s", html="<p/>"))
    assert "reply_to" not in _FakeHttpxClient.last_payload


def test_send_onesignal_email_includes_reply_to_when_given(monkeypatch):
    monkeypatch.setattr(notify, "ONESIGNAL_APP_ID", "app")
    monkeypatch.setattr(notify, "ONESIGNAL_REST_API_KEY", "key")
    monkeypatch.setattr(notify.httpx, "AsyncClient", _FakeHttpxClient)
    asyncio.run(notify._send_onesignal_email(to="a@example.com", subject="s", html="<p/>", reply_to="meeting+abc@meetings.example.com"))
    assert _FakeHttpxClient.last_payload["email_reply_to_address"] == "meeting+abc@meetings.example.com"


def test_deliver_email_threads_reply_to_through(monkeypatch):
    from unittest.mock import AsyncMock
    captured = {}

    async def fake_sender(*, to, subject, html, reply_to=None):
        captured["reply_to"] = reply_to
        return True
    monkeypatch.setattr(notify, "_email_channels", lambda: [("sent", fake_sender)])
    asyncio.run(notify.deliver_email(supabase=None, owner_user={}, to="a@example.com",
                                      subject="s", html="<p/>", reply_to="meeting+abc@meetings.example.com"))
    assert captured["reply_to"] == "meeting+abc@meetings.example.com"


# ---------------------------------------------------------------------------
# Email template HTML-escaping (XSS regression guard)
# ---------------------------------------------------------------------------

_PAYLOAD = '<img src=x onerror=alert(1)>"\'&'
_ESCAPED_FRAGMENT = "&lt;img src=x onerror=alert(1)&gt;"


def test_client_email_escapes_visitor_supplied_name_and_summary():
    html = notify.build_client_email_html(
        visitor_name=_PAYLOAD, summary=_PAYLOAD, start="2026-09-01T10:00:00Z",
        timezone_label="UTC", meeting_link="https://meet.example/abc", provider="zoom",
    )
    assert "<img src=x onerror=alert(1)>" not in html
    assert _ESCAPED_FRAGMENT in html


def test_admin_email_escapes_visitor_supplied_fields():
    html = notify.build_admin_email_html(
        visitor_name=_PAYLOAD, visitor_email="attacker@example.com", summary=_PAYLOAD,
        start="2026-09-01T10:00:00Z", timezone_label="UTC",
        meeting_link="https://meet.example/abc", provider="zoom",
    )
    assert "<img src=x onerror=alert(1)>" not in html
    assert _ESCAPED_FRAGMENT in html


def test_admin_email_still_renders_a_clickable_mailto_link():
    html = notify.build_admin_email_html(
        visitor_name="Jane", visitor_email="jane@example.com", summary="Intro call",
        start="2026-09-01T10:00:00Z", timezone_label="UTC",
        meeting_link="https://meet.example/abc", provider="zoom",
    )
    assert 'href="mailto:jane@example.com"' in html


def test_team_invite_email_escapes_bot_name_and_inviter_email():
    html = notify.build_team_invite_email_html(
        bot_name=_PAYLOAD, inviter_email="owner@example.com", role="admin",
    )
    assert "<img src=x onerror=alert(1)>" not in html
    assert _ESCAPED_FRAGMENT in html


def test_email_templates_leave_normal_content_readable():
    # Escaping shouldn't mangle ordinary text with no special characters.
    html = notify.build_client_email_html(
        visitor_name="Jane Doe", summary="Product demo", start="2026-09-01T10:00:00Z",
        timezone_label="America/New_York", meeting_link="https://meet.example/abc",
        provider="google_meet",
    )
    assert "Jane Doe" in html
    assert "Product demo" in html
    assert "Google Meet" in html  # provider label mapping still applied
