"""Contract tests for the public widget voice-token gate."""

from __future__ import annotations

from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from starlette.requests import Request

import main  # noqa: F401 - initialize the legacy router bridge first
from app.routers import voice
from app.schemas.voice import VoiceTokenRequest


def _request() -> Request:
    return Request(
        {
            "type": "http",
            "method": "POST",
            "path": "/api/widget/voice/token",
            "headers": [],
            "client": ("198.51.100.42", 43210),
            "scheme": "https",
        }
    )


def _db_sequence(monkeypatch, *rows):
    results = iter(SimpleNamespace(data=row) for row in rows)

    async def run_db(_callback):
        return next(results)

    monkeypatch.setattr(voice, "run_db", run_db)


@pytest.mark.anyio
async def test_voice_token_success_passes_session_context(monkeypatch):
    _db_sequence(
        monkeypatch,
        [{"id": "bot-1", "user_id": "owner-auth", "voice_enabled": True}],
        [{"id": "owner-row", "email": "owner@example.com"}],
    )
    monkeypatch.setattr(voice, "_widget_rate_limit_or_429", lambda *_args: _async_noop())
    monkeypatch.setattr(voice, "chatty_quota_exceeded", lambda *_args: _async_false())
    captured = {}

    async def mint(**kwargs):
        captured.update(kwargs)
        return {
            "token": "jwt",
            "livekit_url": "wss://livekit.example",
            "room_name": "room",
            "session_id": "session-1",
        }

    monkeypatch.setattr(voice.voice_service, "mint_voice_session", mint)
    result = await voice.widget_voice_token(
        VoiceTokenRequest(bot_id="bot-1", session_id="session-1", visitor_timezone="Asia/Colombo"),
        _request(),
    )

    assert result.token == "jwt"
    assert captured == {
        "bot_id": "bot-1",
        "session_id": "session-1",
        "visitor_timezone": "Asia/Colombo",
    }


async def _async_noop():
    return None


async def _async_false():
    return False


@pytest.mark.anyio
async def test_voice_token_rejects_unknown_bot_before_rate_limit(monkeypatch):
    _db_sequence(monkeypatch, [])
    rate_limited = False

    async def rate_limit(*_args):
        nonlocal rate_limited
        rate_limited = True

    monkeypatch.setattr(voice, "_widget_rate_limit_or_429", rate_limit)

    with pytest.raises(HTTPException) as exc_info:
        await voice.widget_voice_token(VoiceTokenRequest(bot_id="missing"), _request())

    assert exc_info.value.status_code == 404
    assert rate_limited is False


@pytest.mark.anyio
async def test_voice_token_rejects_missing_owner(monkeypatch):
    _db_sequence(
        monkeypatch,
        [{"id": "bot-1", "user_id": "owner-auth", "voice_enabled": True}],
        [],
    )
    monkeypatch.setattr(voice, "_widget_rate_limit_or_429", lambda *_args: _async_noop())

    with pytest.raises(HTTPException) as exc_info:
        await voice.widget_voice_token(VoiceTokenRequest(bot_id="bot-1"), _request())

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == "Bot owner not found"


@pytest.mark.anyio
async def test_voice_token_rejects_quota_exhaustion(monkeypatch):
    _db_sequence(
        monkeypatch,
        [{"id": "bot-1", "user_id": "owner-auth", "voice_enabled": True}],
        [{"id": "owner-row", "email": "owner@example.com"}],
    )
    monkeypatch.setattr(voice, "_widget_rate_limit_or_429", lambda *_args: _async_noop())

    async def exceeded(*_args):
        return True

    monkeypatch.setattr(voice, "chatty_quota_exceeded", exceeded)

    with pytest.raises(HTTPException) as exc_info:
        await voice.widget_voice_token(VoiceTokenRequest(bot_id="bot-1"), _request())

    assert exc_info.value.status_code == 402
    assert exc_info.value.detail == "Usage quota exceeded"


@pytest.mark.anyio
async def test_voice_token_rejects_disabled_voice_before_livekit(monkeypatch):
    _db_sequence(
        monkeypatch,
        [{"id": "bot-1", "user_id": "owner-auth", "voice_enabled": False}],
        [{"id": "owner-row", "email": "owner@example.com"}],
    )
    monkeypatch.setattr(voice, "_widget_rate_limit_or_429", lambda *_args: _async_noop())
    monkeypatch.setattr(voice, "chatty_quota_exceeded", lambda *_args: _async_false())

    called = False

    async def mint(**_kwargs):
        nonlocal called
        called = True
        return {}

    monkeypatch.setattr(voice.voice_service, "mint_voice_session", mint)

    with pytest.raises(HTTPException) as exc_info:
        await voice.widget_voice_token(VoiceTokenRequest(bot_id="bot-1"), _request())

    assert exc_info.value.status_code == 403
    assert exc_info.value.detail == "Voice is not enabled for this bot"
    assert called is False


@pytest.mark.anyio
async def test_voice_token_preserves_rate_limit_failure(monkeypatch):
    _db_sequence(monkeypatch, [{"id": "bot-1", "user_id": "owner-auth", "voice_enabled": True}])

    async def reject(*_args):
        raise HTTPException(status_code=429, detail="Too many messages")

    monkeypatch.setattr(voice, "_widget_rate_limit_or_429", reject)

    with pytest.raises(HTTPException) as exc_info:
        await voice.widget_voice_token(VoiceTokenRequest(bot_id="bot-1"), _request())

    assert exc_info.value.status_code == 429
