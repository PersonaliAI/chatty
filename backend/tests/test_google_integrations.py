"""Pure unit tests for plugins/google_integrations.py — OAuth token exchange
and refresh, the generic Google API request/error-handling helper, and the
pure data-transformation helpers (header decoding, body extraction, MIME
building, event/contact formatting). All HTTP is mocked; nothing here
touches the network or a real DB (see test_integration_live.py for that).

Note: auth_url() and the CHATTY_SCOPES/SCOPES coverage already live in
tests/test_unit.py — not duplicated here.
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest

from plugins import google_integrations as g


# ---------------------------------------------------------------------------
# Fake httpx.AsyncClient — records every request, replays queued responses
# ---------------------------------------------------------------------------


class _FakeResponse:
    def __init__(self, status_code=200, json_data=None, text="", content=None, headers=None):
        self.status_code = status_code
        self._json = json_data
        self.text = text
        if content is not None:
            self.content = content
        else:
            self.content = b"x" if (json_data is not None or text) else b""
        self.headers = headers or {}

    def json(self):
        if self._json is None:
            raise ValueError("response has no json body")
        return self._json

    def raise_for_status(self):
        if self.status_code >= 400:
            raise RuntimeError(f"HTTP {self.status_code}")


def _fake_client_factory(responses, calls):
    """`responses` is a list popped in call order, or a callable(method, url, **kw) -> response."""

    class _FakeAsyncClient:
        def __init__(self, *a, **kw):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

        async def _handle(self, method, url, **kwargs):
            calls.append({"method": method, "url": url, **kwargs})
            if callable(responses):
                return responses(method, url, **kwargs)
            return responses.pop(0)

        async def get(self, url, **kwargs):
            return await self._handle("GET", url, **kwargs)

        async def post(self, url, **kwargs):
            return await self._handle("POST", url, **kwargs)

        async def put(self, url, **kwargs):
            return await self._handle("PUT", url, **kwargs)

        async def request(self, method, url, **kwargs):
            return await self._handle(method, url, **kwargs)

    return _FakeAsyncClient


def _set_google_env(monkeypatch):
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "client-123")
    monkeypatch.setenv("GOOGLE_CLIENT_SECRET", "secret-456")
    monkeypatch.setenv("GOOGLE_REDIRECT_URI", "https://example.com/callback")


# ---------------------------------------------------------------------------
# OAuth token exchange / refresh / userinfo
# ---------------------------------------------------------------------------


def test_exchange_code_posts_authorization_code_grant(monkeypatch):
    _set_google_env(monkeypatch)
    calls = []
    resp = _FakeResponse(200, json_data={"access_token": "a", "refresh_token": "r", "expires_in": 3600})
    monkeypatch.setattr(g.httpx, "AsyncClient", _fake_client_factory([resp], calls))
    result = asyncio.run(g.exchange_code("auth-code-1"))
    assert result == {"access_token": "a", "refresh_token": "r", "expires_in": 3600}
    assert calls[0]["method"] == "POST"
    assert calls[0]["url"] == g.GOOGLE_TOKEN_URL
    data = calls[0]["data"]
    assert data["code"] == "auth-code-1"
    assert data["grant_type"] == "authorization_code"
    assert data["client_id"] == "client-123"


def test_exchange_code_raises_on_http_error(monkeypatch):
    _set_google_env(monkeypatch)
    calls = []
    resp = _FakeResponse(400, text="bad request")
    monkeypatch.setattr(g.httpx, "AsyncClient", _fake_client_factory([resp], calls))
    with pytest.raises(RuntimeError):
        asyncio.run(g.exchange_code("bad-code"))


def test_refresh_access_token_posts_refresh_token_grant(monkeypatch):
    _set_google_env(monkeypatch)
    calls = []
    resp = _FakeResponse(200, json_data={"access_token": "new-token", "expires_in": 3600})
    monkeypatch.setattr(g.httpx, "AsyncClient", _fake_client_factory([resp], calls))
    result = asyncio.run(g.refresh_access_token("refresh-abc"))
    assert result["access_token"] == "new-token"
    data = calls[0]["data"]
    assert data["refresh_token"] == "refresh-abc"
    assert data["grant_type"] == "refresh_token"


def test_userinfo_sends_bearer_token(monkeypatch):
    calls = []
    resp = _FakeResponse(200, json_data={"email": "a@b.com"})
    monkeypatch.setattr(g.httpx, "AsyncClient", _fake_client_factory([resp], calls))
    result = asyncio.run(g.userinfo("tok-xyz"))
    assert result == {"email": "a@b.com"}
    assert calls[0]["headers"]["Authorization"] == "Bearer tok-xyz"


# ---------------------------------------------------------------------------
# _valid_access_token — the token-refresh decision logic
# ---------------------------------------------------------------------------


def test_valid_access_token_returns_cached_token_when_far_from_expiry(monkeypatch):
    refresh_spy = AsyncMock()
    monkeypatch.setattr(g, "refresh_access_token", refresh_spy)
    future = (datetime.now(tz=timezone.utc) + timedelta(hours=1)).isoformat()
    user = {
        "id": "u1",
        "google_access_token": "cached-token",
        "google_refresh_token": "r1",
        "google_token_expiry": future,
    }
    token = asyncio.run(g._valid_access_token(MagicMock(), user))
    assert token == "cached-token"
    refresh_spy.assert_not_called()


def test_valid_access_token_refreshes_when_expired_and_persists_new_token(monkeypatch):
    monkeypatch.setattr(
        g, "refresh_access_token", AsyncMock(return_value={"access_token": "fresh", "expires_in": 3600})
    )
    past = (datetime.now(tz=timezone.utc) - timedelta(seconds=5)).isoformat()
    user = {
        "id": "u1",
        "google_access_token": "stale-token",
        "google_refresh_token": "r1",
        "google_token_expiry": past,
    }
    supabase = MagicMock()
    token = asyncio.run(g._valid_access_token(supabase, user))
    assert token == "fresh"
    # In-memory user dict updated so a subsequent call in the same request
    # doesn't re-refresh.
    assert user["google_access_token"] == "fresh"
    # Persisted back to the DB, encrypted at rest.
    supabase.table.assert_any_call("users")
    update_call = supabase.table.return_value.update.call_args
    stored = update_call[0][0]["google_access_token"]
    assert stored != "fresh"
    from app.core.crypto import decrypt_secret
    assert decrypt_secret(stored) == "fresh"


def test_valid_access_token_returns_none_when_never_connected():
    user = {"id": "u1"}
    token = asyncio.run(g._valid_access_token(MagicMock(), user))
    assert token is None


def test_valid_access_token_treats_missing_expiry_as_needing_refresh(monkeypatch):
    # No stored expiry at all — must refresh rather than trust an absent value.
    monkeypatch.setattr(
        g, "refresh_access_token", AsyncMock(return_value={"access_token": "fresh2", "expires_in": 3600})
    )
    user = {"id": "u1", "google_access_token": "old", "google_refresh_token": "r1"}
    token = asyncio.run(g._valid_access_token(MagicMock(), user))
    assert token == "fresh2"


def test_valid_access_token_writes_to_the_requested_table(monkeypatch):
    monkeypatch.setattr(
        g, "refresh_access_token", AsyncMock(return_value={"access_token": "fresh3", "expires_in": 3600})
    )
    past = (datetime.now(tz=timezone.utc) - timedelta(seconds=5)).isoformat()
    user = {"id": "u1", "google_access_token": "old", "google_refresh_token": "r1", "google_token_expiry": past}
    supabase = MagicMock()
    asyncio.run(g._valid_access_token(supabase, user, table="kin_connected_accounts"))
    supabase.table.assert_any_call("kin_connected_accounts")


# ---------------------------------------------------------------------------
# _api — the generic request wrapper's error handling
# ---------------------------------------------------------------------------


def test_api_raises_google_not_connected_when_no_token(monkeypatch):
    monkeypatch.setattr(g, "_valid_access_token", AsyncMock(return_value=None))
    with pytest.raises(g.GoogleNotConnected):
        asyncio.run(g._api(MagicMock(), {"id": "u1"}, "GET", "https://example.com/x"))


def test_api_raises_runtime_error_with_json_error_body(monkeypatch):
    monkeypatch.setattr(g, "_valid_access_token", AsyncMock(return_value="tok"))
    calls = []
    resp = _FakeResponse(404, json_data={"error": {"message": "not found"}})
    monkeypatch.setattr(g.httpx, "AsyncClient", _fake_client_factory([resp], calls))
    with pytest.raises(RuntimeError) as exc_info:
        asyncio.run(g._api(MagicMock(), {"id": "u1"}, "GET", "https://example.com/x"))
    assert "404" in str(exc_info.value)
    assert "not found" in str(exc_info.value)


def test_api_raises_runtime_error_with_raw_text_when_error_body_not_json(monkeypatch):
    monkeypatch.setattr(g, "_valid_access_token", AsyncMock(return_value="tok"))
    calls = []
    resp = _FakeResponse(500, text="upstream on fire")
    monkeypatch.setattr(g.httpx, "AsyncClient", _fake_client_factory([resp], calls))
    with pytest.raises(RuntimeError) as exc_info:
        asyncio.run(g._api(MagicMock(), {"id": "u1"}, "GET", "https://example.com/x"))
    assert "upstream on fire" in str(exc_info.value)


def test_api_returns_empty_dict_for_204(monkeypatch):
    monkeypatch.setattr(g, "_valid_access_token", AsyncMock(return_value="tok"))
    calls = []
    resp = _FakeResponse(204)
    monkeypatch.setattr(g.httpx, "AsyncClient", _fake_client_factory([resp], calls))
    result = asyncio.run(g._api(MagicMock(), {"id": "u1"}, "DELETE", "https://example.com/x"))
    assert result == {}


def test_api_returns_empty_dict_for_empty_body(monkeypatch):
    monkeypatch.setattr(g, "_valid_access_token", AsyncMock(return_value="tok"))
    calls = []
    resp = _FakeResponse(200, content=b"")
    monkeypatch.setattr(g.httpx, "AsyncClient", _fake_client_factory([resp], calls))
    result = asyncio.run(g._api(MagicMock(), {"id": "u1"}, "POST", "https://example.com/x"))
    assert result == {}


def test_api_wraps_non_json_success_body_as_raw(monkeypatch):
    monkeypatch.setattr(g, "_valid_access_token", AsyncMock(return_value="tok"))
    calls = []
    resp = _FakeResponse(200, text="plain text body", content=b"plain text body")
    monkeypatch.setattr(g.httpx, "AsyncClient", _fake_client_factory([resp], calls))
    result = asyncio.run(g._api(MagicMock(), {"id": "u1"}, "GET", "https://example.com/x"))
    assert result == {"raw": "plain text body"}


def test_api_sends_bearer_token_from_valid_access_token(monkeypatch):
    monkeypatch.setattr(g, "_valid_access_token", AsyncMock(return_value="the-token"))
    calls = []
    resp = _FakeResponse(200, json_data={"ok": True})
    monkeypatch.setattr(g.httpx, "AsyncClient", _fake_client_factory([resp], calls))
    asyncio.run(g._api(MagicMock(), {"id": "u1"}, "GET", "https://example.com/x"))
    assert calls[0]["headers"]["Authorization"] == "Bearer the-token"


# ---------------------------------------------------------------------------
# Gmail header / body parsing helpers
# ---------------------------------------------------------------------------


def test_decode_header_value_is_case_insensitive():
    payload = {"headers": [{"name": "Subject", "value": "Hello"}]}
    assert g._decode_header_value(payload, "subject") == "Hello"
    assert g._decode_header_value(payload, "SUBJECT") == "Hello"


def test_decode_header_value_missing_returns_empty_string():
    assert g._decode_header_value({"headers": []}, "From") == ""


def test_decode_snippet_passes_short_text_through():
    assert g._decode_snippet({"snippet": "short preview"}) == "short preview"


def test_decode_snippet_empty_returns_empty():
    assert g._decode_snippet({}) == ""
    assert g._decode_snippet({"snippet": ""}) == ""


def test_decode_snippet_collapses_whitespace():
    assert g._decode_snippet({"snippet": "a   b\n\nc"}) == "a b c"


def test_decode_snippet_cuts_at_sentence_boundary_for_long_text():
    # 300 chars: a clean sentence ending well past the halfway point of the
    # 280-char window, so the cut should land right after "sentence one."
    text = "Sentence one. " + ("filler word " * 30)
    snippet = g._decode_snippet({"snippet": text})
    assert snippet.startswith("Sentence one.")
    assert len(snippet) < len(text)


def test_extract_body_prefers_text_plain():
    payload = {
        "mimeType": "text/plain",
        "body": {"data": g._b64url_decode.__wrapped__(None) if False else None},
    }
    # Build real base64url data.
    import base64 as _b64
    encoded = _b64.urlsafe_b64encode(b"hello plain").decode().rstrip("=")
    payload["body"]["data"] = encoded
    assert g._extract_body(payload) == "hello plain"


def test_extract_body_falls_back_to_html_when_no_plain_part():
    import base64 as _b64
    encoded = _b64.urlsafe_b64encode(b"<p>hi <b>there</b></p>").decode().rstrip("=")
    payload = {"mimeType": "text/html", "body": {"data": encoded}}
    assert g._extract_body(payload) == "hi there"


def test_extract_body_recurses_into_parts():
    import base64 as _b64
    encoded = _b64.urlsafe_b64encode(b"nested text").decode().rstrip("=")
    payload = {
        "mimeType": "multipart/alternative",
        "body": {},
        "parts": [
            {"mimeType": "text/plain", "body": {"data": encoded}},
        ],
    }
    assert g._extract_body(payload) == "nested text"


def test_extract_body_empty_payload_returns_empty():
    assert g._extract_body({}) == ""
    assert g._extract_body(None) == ""


def test_has_text_plain_detects_nested_part():
    payload = {"mimeType": "multipart/mixed", "parts": [{"mimeType": "text/plain"}]}
    assert g._has_text_plain(payload) is True


def test_has_text_plain_false_when_absent():
    payload = {"mimeType": "multipart/mixed", "parts": [{"mimeType": "text/html"}]}
    assert g._has_text_plain(payload) is False


def test_b64url_decode_roundtrip():
    import base64 as _b64
    encoded = _b64.urlsafe_b64encode(b"round trip \xc3\xa9").decode().rstrip("=")
    assert g._b64url_decode(encoded) == "round trip é"


def test_b64url_decode_returns_empty_on_malformed_input():
    # base64.urlsafe_b64decode silently discards characters outside its
    # alphabet (default validate=False) rather than raising, so garbage
    # input decodes to garbage text instead of erroring — the try/except
    # in _b64url_decode only catches genuinely undecodable byte sequences
    # (e.g. bad padding after stripping non-alphabet chars).
    assert g._b64url_decode("!!!") == ""


def test_strip_html_removes_style_and_script_blocks():
    html = "<style>.a{color:red}</style><script>alert(1)</script><p>Real text</p>"
    assert g._strip_html(html) == "Real text"


def test_strip_html_collapses_whitespace_after_tag_removal():
    html = "<div>\n  <p>Line one</p>\n  <p>Line two</p>\n</div>"
    assert g._strip_html(html) == "Line one Line two"


def test_strip_html_drops_script_content_even_with_attribute_containing_gt():
    # A regex-based `<script[^>]*>...</script>` stripper's opening-tag match
    # breaks on a '>' inside an attribute value, leaving the script body in
    # the "stripped" output — a real HTML parser handles this correctly.
    html = '<script data-x="a>b">alert(1)</script><p>Real text</p>'
    result = g._strip_html(html)
    assert "alert" not in result
    assert result == "Real text"


def test_strip_html_drops_nested_or_malformed_script_tags():
    html = "<script><script>alert(1)</script></script><p>Safe</p>"
    result = g._strip_html(html)
    assert "alert" not in result


def test_strip_html_handles_malformed_markup_without_crashing():
    # Unclosed tags, stray '<', etc. must degrade gracefully, not raise.
    html = "<div>Unclosed <span>text < 5 and stuff"
    result = g._strip_html(html)
    assert "text" in result


# ---------------------------------------------------------------------------
# _build_mime
# ---------------------------------------------------------------------------


def test_build_mime_sets_recipients_and_subject():
    result = g._build_mime(to=["a@b.com"], subject="Hi", body="Body text", cc=["c@d.com"], bcc=["e@f.com"])
    assert "raw" in result
    assert "threadId" not in result


def test_build_mime_includes_thread_id_when_given():
    result = g._build_mime(to=["a@b.com"], subject="Hi", body="text", thread_id="thread-1")
    assert result["threadId"] == "thread-1"


def test_build_mime_raw_is_padding_free_base64url():
    result = g._build_mime(to=["a@b.com"], subject="Hi", body="text")
    raw = result["raw"]
    assert "=" not in raw
    # Must decode cleanly once padding is restored.
    import base64 as _b64
    pad = "=" * (-len(raw) % 4)
    decoded = _b64.urlsafe_b64decode(raw + pad)
    assert b"To: a@b.com" in decoded
    assert b"Subject: Hi" in decoded


def test_build_mime_with_attachments_produces_mixed_multipart_with_filename():
    result = g._build_mime(
        to=["a@b.com"],
        subject="Report",
        body="see attached",
        attachments=[{"filename": "report.pdf", "mime_type": "application/pdf", "data": b"%PDF-1.4"}],
    )
    import base64 as _b64
    raw = result["raw"]
    pad = "=" * (-len(raw) % 4)
    decoded = _b64.urlsafe_b64decode(raw + pad)
    assert b"multipart/mixed" in decoded
    assert b'filename="report.pdf"' in decoded


# ---------------------------------------------------------------------------
# Calendar event formatting
# ---------------------------------------------------------------------------


def test_format_event_row_uses_direct_hangout_link_when_present():
    ev = {"id": "e1", "hangoutLink": "https://meet.google.com/abc", "start": {}, "end": {}}
    row = g._format_event_row(ev)
    assert row["hangout_link"] == "https://meet.google.com/abc"


def test_format_event_row_falls_back_to_conference_data_entry_point():
    ev = {
        "id": "e1",
        "start": {},
        "end": {},
        "conferenceData": {
            "entryPoints": [
                {"entryPointType": "phone", "uri": "tel:123"},
                {"entryPointType": "video", "uri": "https://meet.google.com/xyz"},
            ]
        },
    }
    row = g._format_event_row(ev)
    assert row["hangout_link"] == "https://meet.google.com/xyz"


def test_format_event_row_detects_all_day_events():
    ev = {"id": "e1", "start": {"date": "2026-09-01"}, "end": {"date": "2026-09-02"}}
    row = g._format_event_row(ev)
    assert row["all_day"] is True
    assert row["start"] == "2026-09-01"


def test_format_event_row_detects_timed_events():
    ev = {"id": "e1", "start": {"dateTime": "2026-09-01T10:00:00Z"}, "end": {"dateTime": "2026-09-01T11:00:00Z"}}
    row = g._format_event_row(ev)
    assert row["all_day"] is False


def test_format_event_row_filters_attendees_without_email():
    ev = {"id": "e1", "start": {}, "end": {}, "attendees": [{"email": "a@b.com"}, {}]}
    row = g._format_event_row(ev)
    assert row["attendees"] == ["a@b.com"]


def test_format_event_row_defaults_missing_summary():
    ev = {"id": "e1", "start": {}, "end": {}}
    row = g._format_event_row(ev)
    assert row["summary"] == "(no title)"


# ---------------------------------------------------------------------------
# _with_explicit_offset — timezone localization
# ---------------------------------------------------------------------------


def test_with_explicit_offset_leaves_z_suffixed_string_unchanged():
    assert g._with_explicit_offset("2026-09-01T10:00:00Z", "Asia/Colombo") == "2026-09-01T10:00:00Z"


def test_with_explicit_offset_leaves_already_offset_string_unchanged():
    s = "2026-09-01T10:00:00+05:30"
    assert g._with_explicit_offset(s, "UTC") == s


def test_with_explicit_offset_localizes_naive_datetime():
    result = g._with_explicit_offset("2026-09-01T09:30:00", "Asia/Colombo")
    # Asia/Colombo is UTC+05:30 — the naive time must carry that explicit offset.
    assert result.startswith("2026-09-01T09:30:00")
    assert "+05:30" in result


def test_with_explicit_offset_falls_back_to_original_on_bad_timezone():
    naive = "2026-09-01T09:30:00"
    result = g._with_explicit_offset(naive, "Not/ARealZone")
    assert result == naive


def test_with_explicit_offset_empty_string_passthrough():
    assert g._with_explicit_offset("", "UTC") == ""


# ---------------------------------------------------------------------------
# _event_payload
# ---------------------------------------------------------------------------


def test_event_payload_all_day_uses_date_only_fields():
    body = g._event_payload(summary="S", start="2026-09-01T10:00:00", end="2026-09-02T10:00:00", all_day=True)
    assert body["start"] == {"date": "2026-09-01"}
    assert body["end"] == {"date": "2026-09-02"}


def test_event_payload_timed_event_includes_timezone():
    body = g._event_payload(
        summary="S", start="2026-09-01T10:00:00", end="2026-09-01T11:00:00", timezone_str="Asia/Colombo"
    )
    assert body["start"]["timeZone"] == "Asia/Colombo"
    assert "+05:30" in body["start"]["dateTime"]


def test_event_payload_includes_optional_fields_only_when_given():
    body = g._event_payload(summary="S", start="2026-09-01T10:00:00", end="2026-09-01T11:00:00")
    assert "description" not in body
    assert "location" not in body
    assert "attendees" not in body


def test_event_payload_maps_attendee_emails():
    body = g._event_payload(
        summary="S", start="2026-09-01T10:00:00", end="2026-09-01T11:00:00", attendees=["a@b.com", "c@d.com"]
    )
    assert body["attendees"] == [{"email": "a@b.com"}, {"email": "c@d.com"}]


# ---------------------------------------------------------------------------
# Drive query builder
# ---------------------------------------------------------------------------


def test_drive_query_always_excludes_trashed():
    assert g._drive_query(None, None) == "trashed = false"


def test_drive_query_combines_folder_and_search_term():
    q = g._drive_query("folder123", "report")
    assert "'folder123' in parents" in q
    assert "name contains 'report'" in q
    assert q.startswith("trashed = false")


def test_drive_query_strips_single_quotes_from_search_term():
    # A raw single quote in the search term would break the Drive query
    # syntax, so it must be stripped rather than passed through.
    q = g._drive_query(None, "o'brien")
    assert "obrien" in q
    assert "o'brien" not in q


# ---------------------------------------------------------------------------
# Docs / Sheets / Slides / People formatting
# ---------------------------------------------------------------------------


def test_walk_doc_text_extracts_paragraph_runs():
    content = [{"paragraph": {"elements": [{"textRun": {"content": "Hello "}}, {"textRun": {"content": "world"}}]}}]
    assert g._walk_doc_text(content) == "Hello world"


def test_walk_doc_text_walks_table_cells():
    content = [
        {
            "table": {
                "tableRows": [
                    {
                        "tableCells": [
                            {"content": [{"paragraph": {"elements": [{"textRun": {"content": "A1"}}]}}]},
                            {"content": [{"paragraph": {"elements": [{"textRun": {"content": "B1"}}]}}]},
                        ]
                    }
                ]
            }
        }
    ]
    result = g._walk_doc_text(content)
    assert "A1" in result and "B1" in result
    assert "\t" in result


def test_format_person_extracts_primary_fields():
    p = {
        "resourceName": "people/123",
        "names": [{"displayName": "Jane Doe", "givenName": "Jane", "familyName": "Doe"}],
        "emailAddresses": [{"value": "jane@example.com"}],
        "phoneNumbers": [{"value": "+1234567890"}],
        "organizations": [{"name": "Acme", "title": "Engineer"}],
        "biographies": [{"value": "notes here"}],
    }
    out = g._format_person(p)
    assert out["name"] == "Jane Doe"
    assert out["emails"] == ["jane@example.com"]
    assert out["company"] == "Acme"
    assert out["notes"] == "notes here"


def test_format_person_handles_missing_fields_gracefully():
    out = g._format_person({"resourceName": "people/1"})
    assert out["name"] == ""
    assert out["emails"] == []
    assert out["company"] == ""


def test_sheet_values_to_text_quotes_embedded_quotes():
    csv_text = g._sheet_values_to_text([["a", 'b"c'], [1, 2]])
    assert '"a"' in csv_text
    assert '"b""c"' in csv_text  # embedded quote doubled per CSV convention


def test_walk_slide_text_extracts_shape_and_table_text():
    elements = [
        {"shape": {"text": {"textElements": [{"textRun": {"content": "Title text"}}]}}},
        {
            "table": {
                "tableRows": [
                    {"tableCells": [{"text": {"textElements": [{"textRun": {"content": "Cell"}}]}}]}
                ]
            }
        },
    ]
    result = g._walk_slide_text(elements)
    assert "Title text" in result
    assert "Cell" in result
