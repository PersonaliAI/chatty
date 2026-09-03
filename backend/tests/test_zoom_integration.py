"""Pure unit tests for plugins/zoom_integration.py — Server-to-Server OAuth
token minting (with the in-process cache), meeting creation, and the
zoom_configured() capability check. All HTTP is mocked; nothing here
touches the network.
"""
from __future__ import annotations

import asyncio

import pytest

from plugins import zoom_integration as z


# ---------------------------------------------------------------------------
# Fake httpx.AsyncClient — records every request, replays queued responses
# ---------------------------------------------------------------------------


class _FakeResponse:
    def __init__(self, status_code=200, json_data=None, text=""):
        self.status_code = status_code
        self._json = json_data
        self.text = text

    def json(self):
        if self._json is None:
            raise ValueError("response has no json body")
        return self._json

    def raise_for_status(self):
        if self.status_code >= 400:
            raise RuntimeError(f"HTTP {self.status_code}")


def _fake_client_factory(responses, calls):
    class _FakeAsyncClient:
        def __init__(self, *a, **kw):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

        async def post(self, url, **kwargs):
            calls.append({"url": url, **kwargs})
            return responses.pop(0)

    return _FakeAsyncClient


def _set_zoom_env(monkeypatch):
    monkeypatch.setenv("ZOOM_ACCOUNT_ID", "acct-1")
    monkeypatch.setenv("ZOOM_CLIENT_ID", "client-1")
    monkeypatch.setenv("ZOOM_CLIENT_SECRET", "secret-1")


@pytest.fixture(autouse=True)
def _reset_token_cache():
    """The module-level token cache would otherwise leak state between
    tests (a token minted in one test satisfying another test's assertion
    that a fresh fetch happened)."""
    z._token_cache["access_token"] = None
    z._token_cache["expires_at"] = 0.0
    yield
    z._token_cache["access_token"] = None
    z._token_cache["expires_at"] = 0.0


# ---------------------------------------------------------------------------
# zoom_configured
# ---------------------------------------------------------------------------


def test_zoom_configured_false_when_any_var_missing(monkeypatch):
    monkeypatch.delenv("ZOOM_ACCOUNT_ID", raising=False)
    monkeypatch.delenv("ZOOM_CLIENT_ID", raising=False)
    monkeypatch.delenv("ZOOM_CLIENT_SECRET", raising=False)
    assert z.zoom_configured() is False

    monkeypatch.setenv("ZOOM_ACCOUNT_ID", "acct-1")
    monkeypatch.setenv("ZOOM_CLIENT_ID", "client-1")
    assert z.zoom_configured() is False  # secret still missing


def test_zoom_configured_true_when_all_set(monkeypatch):
    _set_zoom_env(monkeypatch)
    assert z.zoom_configured() is True


# ---------------------------------------------------------------------------
# _get_access_token
# ---------------------------------------------------------------------------


def test_get_access_token_uses_account_credentials_grant(monkeypatch):
    _set_zoom_env(monkeypatch)
    calls = []
    resp = _FakeResponse(200, json_data={"access_token": "tok-1", "expires_in": 3600})
    monkeypatch.setattr(z.httpx, "AsyncClient", _fake_client_factory([resp], calls))

    token = asyncio.run(z._get_access_token())

    assert token == "tok-1"
    assert calls[0]["url"] == z.ZOOM_TOKEN_URL
    assert calls[0]["params"]["grant_type"] == "account_credentials"
    assert calls[0]["params"]["account_id"] == "acct-1"
    assert calls[0]["auth"] == ("client-1", "secret-1")


def test_get_access_token_caches_until_expiry(monkeypatch):
    _set_zoom_env(monkeypatch)
    calls = []
    resp = _FakeResponse(200, json_data={"access_token": "tok-1", "expires_in": 3600})
    monkeypatch.setattr(z.httpx, "AsyncClient", _fake_client_factory([resp], calls))

    first = asyncio.run(z._get_access_token())
    second = asyncio.run(z._get_access_token())

    assert first == second == "tok-1"
    assert len(calls) == 1  # second call reused the cached token, no new HTTP request


def test_get_access_token_refetches_after_expiry(monkeypatch):
    _set_zoom_env(monkeypatch)
    calls = []
    responses = [
        _FakeResponse(200, json_data={"access_token": "tok-1", "expires_in": 3600}),
        _FakeResponse(200, json_data={"access_token": "tok-2", "expires_in": 3600}),
    ]
    monkeypatch.setattr(z.httpx, "AsyncClient", _fake_client_factory(responses, calls))

    first = asyncio.run(z._get_access_token())
    # Force the cached token to look expired instead of sleeping for real.
    z._token_cache["expires_at"] = 0.0
    second = asyncio.run(z._get_access_token())

    assert first == "tok-1"
    assert second == "tok-2"
    assert len(calls) == 2


def test_get_access_token_raises_on_http_error(monkeypatch):
    _set_zoom_env(monkeypatch)
    calls = []
    resp = _FakeResponse(401, text="invalid client")
    monkeypatch.setattr(z.httpx, "AsyncClient", _fake_client_factory([resp], calls))
    with pytest.raises(RuntimeError):
        asyncio.run(z._get_access_token())


# ---------------------------------------------------------------------------
# create_meeting
# ---------------------------------------------------------------------------


def test_create_meeting_raises_when_not_configured(monkeypatch):
    monkeypatch.delenv("ZOOM_ACCOUNT_ID", raising=False)
    monkeypatch.delenv("ZOOM_CLIENT_ID", raising=False)
    monkeypatch.delenv("ZOOM_CLIENT_SECRET", raising=False)
    with pytest.raises(RuntimeError, match="not configured"):
        asyncio.run(z.create_meeting(topic="Demo", start="2026-09-10T15:00:00"))


def test_create_meeting_returns_join_url(monkeypatch):
    _set_zoom_env(monkeypatch)
    calls = []
    token_resp = _FakeResponse(200, json_data={"access_token": "tok-1", "expires_in": 3600})
    meeting_resp = _FakeResponse(200, json_data={
        "id": 123456789, "join_url": "https://zoom.us/j/123456789", "start_url": "https://zoom.us/s/123456789",
    })
    monkeypatch.setattr(z.httpx, "AsyncClient", _fake_client_factory([token_resp, meeting_resp], calls))

    result = asyncio.run(z.create_meeting(
        topic="Demo Meeting with Jane", start="2026-09-10T15:00:00", duration_minutes=45, timezone_str="America/New_York",
    ))

    assert result == {
        "meeting_id": 123456789,
        "join_url": "https://zoom.us/j/123456789",
        "start_url": "https://zoom.us/s/123456789",
    }
    meeting_call = calls[1]
    assert meeting_call["url"] == f"{z.ZOOM_API_BASE}/users/me/meetings"
    assert meeting_call["headers"]["Authorization"] == "Bearer tok-1"
    body = meeting_call["json"]
    assert body["topic"] == "Demo Meeting with Jane"
    assert body["duration"] == 45
    assert body["timezone"] == "America/New_York"
    assert body["type"] == 2


def test_create_meeting_raises_on_http_error(monkeypatch):
    _set_zoom_env(monkeypatch)
    calls = []
    token_resp = _FakeResponse(200, json_data={"access_token": "tok-1", "expires_in": 3600})
    err_resp = _FakeResponse(400, text="invalid start_time")
    monkeypatch.setattr(z.httpx, "AsyncClient", _fake_client_factory([token_resp, err_resp], calls))
    with pytest.raises(RuntimeError):
        asyncio.run(z.create_meeting(topic="Demo", start="not-a-date"))
