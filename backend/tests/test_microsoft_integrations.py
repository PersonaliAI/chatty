"""Pure unit tests for plugins/microsoft_integrations.py — OAuth token
exchange/refresh, the generic Graph API request/error-handling helper, and
the pure data-transformation helpers (message/event/contact/OneDrive-item
formatting, body-preview truncation). All HTTP is mocked; nothing here
touches the network or a real DB.
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest

from plugins import microsoft_integrations as m


# ---------------------------------------------------------------------------
# auth_url
# ---------------------------------------------------------------------------


def test_auth_url_requires_client_id(monkeypatch):
    monkeypatch.delenv("MICROSOFT_CLIENT_ID", raising=False)
    with pytest.raises(RuntimeError):
        m.auth_url("state123")


def test_auth_url_includes_state_and_scopes(monkeypatch):
    monkeypatch.setenv("MICROSOFT_CLIENT_ID", "test-client-id")
    monkeypatch.setenv("MICROSOFT_REDIRECT_URI", "https://example.com/callback")
    url = m.auth_url("state123")
    assert "state=state123" in url
    assert "Mail.ReadWrite" in url
    assert "offline_access" in url
    assert url.startswith(m.AUTH_URL)


# ---------------------------------------------------------------------------
# _valid_access_token — the token-refresh decision logic
# ---------------------------------------------------------------------------


def test_valid_access_token_returns_none_when_never_connected():
    supabase = MagicMock()
    user = {"id": "u1"}
    token = asyncio.run(m._valid_access_token(supabase, user))
    assert token is None


def test_valid_access_token_reuses_unexpired_token(monkeypatch):
    supabase = MagicMock()
    future = (datetime.now(tz=timezone.utc) + timedelta(hours=1)).isoformat()
    user = {
        "id": "u1",
        "microsoft_access_token": "still-good",
        "microsoft_refresh_token": "r1",
        "microsoft_token_expiry": future,
    }
    refresh_mock = AsyncMock()
    monkeypatch.setattr(m, "refresh_access_token", refresh_mock)
    token = asyncio.run(m._valid_access_token(supabase, user))
    assert token == "still-good"
    refresh_mock.assert_not_called()


def test_valid_access_token_refreshes_when_expired(monkeypatch):
    past = (datetime.now(tz=timezone.utc) - timedelta(hours=1)).isoformat()
    user = {
        "id": "u1",
        "microsoft_access_token": "stale",
        "microsoft_refresh_token": "r1",
        "microsoft_token_expiry": past,
    }
    refresh_mock = AsyncMock(return_value={
        "access_token": "fresh-token",
        "refresh_token": "r2",
        "expires_in": 3600,
    })
    monkeypatch.setattr(m, "refresh_access_token", refresh_mock)

    execute_mock = MagicMock()
    table_chain = MagicMock()
    table_chain.update.return_value.eq.return_value.execute = execute_mock
    supabase = MagicMock()
    supabase.table.return_value = table_chain

    token = asyncio.run(m._valid_access_token(supabase, user))
    assert token == "fresh-token"
    refresh_mock.assert_awaited_once_with("r1")
    # Refreshed values written back onto the in-memory user dict too.
    assert user["microsoft_access_token"] == "fresh-token"
    assert user["microsoft_refresh_token"] == "r2"


def test_valid_access_token_refreshes_when_no_expiry_recorded(monkeypatch):
    # No stored expiry at all — must not assume the token is still good.
    user = {
        "id": "u1",
        "microsoft_access_token": "unknown-age",
        "microsoft_refresh_token": "r1",
        "microsoft_token_expiry": None,
    }
    refresh_mock = AsyncMock(return_value={"access_token": "fresh", "expires_in": 3600})
    monkeypatch.setattr(m, "refresh_access_token", refresh_mock)
    supabase = MagicMock()
    supabase.table.return_value.update.return_value.eq.return_value.execute = MagicMock()

    token = asyncio.run(m._valid_access_token(supabase, user))
    assert token == "fresh"
    refresh_mock.assert_awaited_once()


def test_valid_access_token_keeps_old_refresh_token_if_none_returned(monkeypatch):
    # Microsoft doesn't always rotate the refresh token — must not drop it.
    past = (datetime.now(tz=timezone.utc) - timedelta(hours=1)).isoformat()
    user = {
        "id": "u1",
        "microsoft_access_token": "stale",
        "microsoft_refresh_token": "original-refresh",
        "microsoft_token_expiry": past,
    }
    refresh_mock = AsyncMock(return_value={"access_token": "fresh", "expires_in": 3600})
    monkeypatch.setattr(m, "refresh_access_token", refresh_mock)
    supabase = MagicMock()
    supabase.table.return_value.update.return_value.eq.return_value.execute = MagicMock()

    asyncio.run(m._valid_access_token(supabase, user))
    assert user["microsoft_refresh_token"] == "original-refresh"


# ---------------------------------------------------------------------------
# _api — error handling
# ---------------------------------------------------------------------------


class _FakeResponse:
    def __init__(self, status_code=200, json_data=None, text="", content=None):
        self.status_code = status_code
        self._json = json_data
        self.text = text
        self.content = content if content is not None else (b"x" if json_data is not None else b"")

    def json(self):
        if self._json is None:
            raise ValueError("no json body")
        return self._json


class _FakeAsyncClient:
    def __init__(self, response):
        self._response = response

    async def __aenter__(self):
        return self

    async def __aexit__(self, *a):
        return False

    async def request(self, method, url, **kwargs):
        return self._response


def test_api_raises_when_not_connected(monkeypatch):
    monkeypatch.setattr(m, "_valid_access_token", AsyncMock(return_value=None))
    with pytest.raises(m.MicrosoftNotConnected):
        asyncio.run(m._api(MagicMock(), {"id": "u1"}, "GET", "https://graph.microsoft.com/v1.0/me"))


def test_api_returns_empty_dict_on_204(monkeypatch):
    monkeypatch.setattr(m, "_valid_access_token", AsyncMock(return_value="tok"))
    monkeypatch.setattr(m.httpx, "AsyncClient", lambda **kw: _FakeAsyncClient(_FakeResponse(status_code=204)))
    result = asyncio.run(m._api(MagicMock(), {"id": "u1"}, "DELETE", "https://graph.microsoft.com/v1.0/me/messages/1"))
    assert result == {}


def test_api_raises_runtime_error_on_http_error_with_json_body(monkeypatch):
    monkeypatch.setattr(m, "_valid_access_token", AsyncMock(return_value="tok"))
    err_body = {"error": {"code": "InvalidAuthenticationToken", "message": "expired"}}
    monkeypatch.setattr(
        m.httpx, "AsyncClient",
        lambda **kw: _FakeAsyncClient(_FakeResponse(status_code=401, json_data=err_body)),
    )
    with pytest.raises(RuntimeError, match="InvalidAuthenticationToken"):
        asyncio.run(m._api(MagicMock(), {"id": "u1"}, "GET", "https://graph.microsoft.com/v1.0/me"))


def test_api_raises_runtime_error_on_http_error_with_non_json_body(monkeypatch):
    # Graph occasionally returns a plain-text/HTML error body — must not crash
    # trying to parse it as JSON.
    monkeypatch.setattr(m, "_valid_access_token", AsyncMock(return_value="tok"))
    resp = _FakeResponse(status_code=500, text="Internal Server Error")
    resp.json = MagicMock(side_effect=ValueError("not json"))
    monkeypatch.setattr(m.httpx, "AsyncClient", lambda **kw: _FakeAsyncClient(resp))
    with pytest.raises(RuntimeError, match="Internal Server Error"):
        asyncio.run(m._api(MagicMock(), {"id": "u1"}, "GET", "https://graph.microsoft.com/v1.0/me"))


def test_api_returns_raw_bytes_when_requested(monkeypatch):
    monkeypatch.setattr(m, "_valid_access_token", AsyncMock(return_value="tok"))
    resp = _FakeResponse(status_code=200, content=b"binary-file-data")
    monkeypatch.setattr(m.httpx, "AsyncClient", lambda **kw: _FakeAsyncClient(resp))
    result = asyncio.run(m._api(
        MagicMock(), {"id": "u1"}, "GET", "https://graph.microsoft.com/v1.0/me/drive/items/1/content",
        return_raw=True,
    ))
    assert result == b"binary-file-data"


def test_api_gracefully_handles_empty_success_body(monkeypatch):
    monkeypatch.setattr(m, "_valid_access_token", AsyncMock(return_value="tok"))
    resp = _FakeResponse(status_code=200, content=b"")
    monkeypatch.setattr(m.httpx, "AsyncClient", lambda **kw: _FakeAsyncClient(resp))
    result = asyncio.run(m._api(MagicMock(), {"id": "u1"}, "GET", "https://graph.microsoft.com/v1.0/me"))
    assert result == {}


# ---------------------------------------------------------------------------
# _clean_snippet
# ---------------------------------------------------------------------------


def test_clean_snippet_returns_short_text_unchanged():
    assert m._clean_snippet("Hello there") == "Hello there"


def test_clean_snippet_returns_empty_for_empty_input():
    assert m._clean_snippet("") == ""


def test_clean_snippet_collapses_whitespace():
    assert m._clean_snippet("Hello   \n\n  there") == "Hello there"


def test_clean_snippet_cuts_at_sentence_boundary():
    long_text = "First sentence here. " * 20
    result = m._clean_snippet(long_text, limit=100)
    assert result.endswith(" …")
    assert len(result) <= 105


def test_clean_snippet_falls_back_to_word_boundary_without_sentence():
    long_text = "word " * 40  # no sentence punctuation at all
    result = m._clean_snippet(long_text, limit=100)
    assert result.endswith(" …")
    assert not result[:-2].endswith(" ")


# ---------------------------------------------------------------------------
# _format_outlook_msg
# ---------------------------------------------------------------------------


def test_format_outlook_msg_extracts_core_fields():
    raw = {
        "id": "msg1",
        "conversationId": "conv1",
        "subject": "Hello",
        "from": {"emailAddress": {"name": "Alice", "address": "alice@example.com"}},
        "toRecipients": [{"emailAddress": {"address": "bob@example.com"}}],
        "bodyPreview": "Quick note",
        "receivedDateTime": "2026-01-01T00:00:00Z",
        "isRead": True,
        "webLink": "https://outlook.office.com/mail/1",
    }
    out = m._format_outlook_msg(raw)
    assert out["id"] == "msg1"
    assert out["from"] == "Alice <alice@example.com>"
    assert out["from_email"] == "alice@example.com"
    assert out["to"] == "bob@example.com"
    assert out["is_read"] is True


def test_format_outlook_msg_defaults_missing_subject():
    out = m._format_outlook_msg({"id": "msg2"})
    assert out["subject"] == "(no subject)"
    assert out["from"] == "<>"
    assert out["to"] == ""
    assert out["is_read"] is False


# ---------------------------------------------------------------------------
# _format_onedrive_item
# ---------------------------------------------------------------------------


def test_format_onedrive_item_detects_file():
    raw = {
        "id": "f1",
        "name": "report.pdf",
        "file": {"mimeType": "application/pdf"},
        "size": 1024,
        "lastModifiedDateTime": "2026-01-01T00:00:00Z",
        "webUrl": "https://onedrive.com/f1",
        "parentReference": {"id": "parent1"},
    }
    out = m._format_onedrive_item(raw)
    assert out["is_folder"] is False
    assert out["mime_type"] == "application/pdf"
    assert out["parent_folder_id"] == "parent1"


def test_format_onedrive_item_detects_folder():
    raw = {"id": "d1", "name": "Documents", "folder": {"childCount": 3}}
    out = m._format_onedrive_item(raw)
    assert out["is_folder"] is True
    assert out["mime_type"] is None


# ---------------------------------------------------------------------------
# _build_message_payload
# ---------------------------------------------------------------------------


def test_build_message_payload_basic_text():
    payload = m._build_message_payload(to=["a@example.com"], subject="Hi", body="Hello")
    assert payload["body"]["contentType"] == "Text"
    assert payload["toRecipients"] == [{"emailAddress": {"address": "a@example.com"}}]
    assert "ccRecipients" not in payload
    assert "bccRecipients" not in payload


def test_build_message_payload_html_with_cc_and_bcc():
    payload = m._build_message_payload(
        to=["a@example.com"], subject="Hi", body="<b>Hello</b>",
        cc=["c@example.com"], bcc=["d@example.com"], html=True,
    )
    assert payload["body"]["contentType"] == "HTML"
    assert payload["ccRecipients"] == [{"emailAddress": {"address": "c@example.com"}}]
    assert payload["bccRecipients"] == [{"emailAddress": {"address": "d@example.com"}}]


def test_build_message_payload_multiple_recipients():
    payload = m._build_message_payload(to=["a@x.com", "b@x.com"], subject="Hi", body="text")
    assert len(payload["toRecipients"]) == 2


# ---------------------------------------------------------------------------
# _format_outlook_event
# ---------------------------------------------------------------------------


def test_format_outlook_event_extracts_core_fields():
    raw = {
        "id": "e1",
        "subject": "Standup",
        "body": {"content": "Daily sync"},
        "location": {"displayName": "Room 1"},
        "start": {"dateTime": "2026-01-01T09:00:00"},
        "end": {"dateTime": "2026-01-01T09:30:00"},
        "isAllDay": False,
        "attendees": [{"emailAddress": {"address": "a@x.com"}}, {"emailAddress": {}}],
        "organizer": {"emailAddress": {"address": "org@x.com"}},
        "webLink": "https://outlook.office.com/cal/1",
        "onlineMeeting": {"joinUrl": "https://teams.microsoft.com/1"},
    }
    out = m._format_outlook_event(raw)
    assert out["subject"] == "Standup"
    assert out["location"] == "Room 1"
    # Attendee with no email address is filtered out.
    assert out["attendees"] == ["a@x.com"]
    assert out["organizer"] == "org@x.com"
    assert out["online_meeting_url"] == "https://teams.microsoft.com/1"


def test_format_outlook_event_defaults_missing_title():
    out = m._format_outlook_event({"id": "e2"})
    assert out["subject"] == "(no title)"
    assert out["attendees"] == []
    assert out["organizer"] is None


def test_format_outlook_event_truncates_long_body():
    out = m._format_outlook_event({"body": {"content": "x" * 3000}})
    assert len(out["body"]) == 2000


def test_format_outlook_event_falls_back_to_legacy_online_meeting_url():
    out = m._format_outlook_event({"onlineMeetingUrl": "https://legacy.example.com/join"})
    assert out["online_meeting_url"] == "https://legacy.example.com/join"


# ---------------------------------------------------------------------------
# _format_outlook_contact
# ---------------------------------------------------------------------------


def test_format_outlook_contact_prefers_display_name():
    raw = {
        "id": "c1",
        "displayName": "Alice Smith",
        "givenName": "Alice",
        "surname": "Smith",
        "emailAddresses": [{"address": "alice@x.com"}, {"address": ""}],
        "businessPhones": ["111"],
        "homePhones": ["222"],
        "mobilePhone": "333",
        "companyName": "Acme",
        "jobTitle": "Engineer",
    }
    out = m._format_outlook_contact(raw)
    assert out["name"] == "Alice Smith"
    assert out["emails"] == ["alice@x.com"]
    assert out["phones"] == ["111", "222", "333"]


def test_format_outlook_contact_falls_back_to_given_and_surname():
    raw = {"id": "c2", "givenName": "Bob", "surname": "Jones", "emailAddresses": []}
    out = m._format_outlook_contact(raw)
    assert out["name"] == "Bob Jones"
    assert out["phones"] == []


def test_format_outlook_contact_no_mobile_phone_not_included_as_none():
    raw = {"id": "c3", "emailAddresses": []}
    out = m._format_outlook_contact(raw)
    assert None not in out["phones"]
    assert out["phones"] == []


# ---------------------------------------------------------------------------
# update_outlook_event — reschedule (PATCH, not delete+recreate)
# ---------------------------------------------------------------------------


def test_update_outlook_event_patches_default_calendar(monkeypatch):
    api_mock = AsyncMock(return_value={"id": "evt1", "webLink": "https://outlook.com/evt1"})
    monkeypatch.setattr(m, "_api", api_mock)
    result = asyncio.run(m.update_outlook_event(
        MagicMock(), {"email": "owner@example.com"},
        event_id="evt1", start="2026-06-25T10:00:00", end="2026-06-25T10:30:00",
        timezone_override="America/New_York",
    ))
    assert result["id"] == "evt1"
    args, kwargs = api_mock.call_args
    assert args[2] == "PATCH"
    assert args[3] == f"{m.GRAPH_BASE}/me/events/evt1"
    body = kwargs["json_body"]
    assert body["start"] == {"dateTime": "2026-06-25T10:00:00", "timeZone": "America/New_York"}
    assert body["end"] == {"dateTime": "2026-06-25T10:30:00", "timeZone": "America/New_York"}


def test_update_outlook_event_uses_named_calendar_when_given(monkeypatch):
    api_mock = AsyncMock(return_value={"id": "evt1"})
    monkeypatch.setattr(m, "_api", api_mock)
    asyncio.run(m.update_outlook_event(
        MagicMock(), {"email": "owner@example.com"},
        event_id="evt1", start="2026-06-25T10:00:00", end="2026-06-25T10:30:00",
        calendar_id="cal-2",
    ))
    args, _ = api_mock.call_args
    assert args[3] == f"{m.GRAPH_BASE}/me/calendars/cal-2/events/evt1"
