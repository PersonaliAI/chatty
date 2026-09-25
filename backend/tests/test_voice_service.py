"""Contract tests for the API-to-LiveKit voice session boundary."""

import asyncio
import json
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.services import voice_service


class _FakeToken:
    def __init__(self, *_args, **_kwargs):
        self.calls = []

    def with_identity(self, value):
        self.calls.append(("identity", value))
        return self

    def with_name(self, value):
        self.calls.append(("name", value))
        return self

    def with_grants(self, value):
        self.calls.append(("grants", value))
        return self

    def with_room_config(self, value):
        self.calls.append(("room_config", value))
        return self

    def to_jwt(self):
        return "signed-token"


def test_mint_voice_session_dispatches_worker_with_metadata(monkeypatch):
    dispatches = []
    closed = []

    class FakeDispatch:
        async def create_dispatch(self, request):
            dispatches.append(request)

    class FakeApi:
        agent_dispatch = FakeDispatch()

        def __init__(self, *_args):
            pass

        async def aclose(self):
            closed.append(True)

    monkeypatch.setattr(voice_service, "LIVEKIT_URL", "wss://livekit.example")
    monkeypatch.setattr(voice_service, "LIVEKIT_API_KEY", "key")
    monkeypatch.setattr(voice_service, "LIVEKIT_API_SECRET", "secret")
    monkeypatch.setattr(voice_service.api, "LiveKitAPI", FakeApi)
    monkeypatch.setattr(voice_service.api, "AccessToken", _FakeToken)
    result = asyncio.run(
        voice_service.mint_voice_session(
            bot_id="bot-1",
            session_id="session-1",
            visitor_timezone="Asia/Colombo",
            display_name="Visitor One",
        )
    )

    assert result["token"] == "signed-token"
    assert result["livekit_url"] == "wss://livekit.example"
    assert result["room_name"] == "chatty-voice-bot-1-session-1"
    assert result["session_id"] == "session-1"
    assert len(dispatches) == 1
    assert dispatches[0].agent_name == "chatty-voice"
    assert dispatches[0].room == result["room_name"]
    metadata = json.loads(dispatches[0].metadata)
    assert metadata == {
        "bot_id": "bot-1",
        "session_id": "session-1",
        "visitor_timezone": "Asia/Colombo",
    }
    assert closed == [True]


def test_mint_voice_session_returns_controlled_error_when_dispatch_fails(monkeypatch):
    closed = []

    class FakeDispatch:
        async def create_dispatch(self, _request):
            raise RuntimeError("LiveKit unavailable")

    class FakeApi:
        agent_dispatch = FakeDispatch()

        def __init__(self, *_args):
            pass

        async def aclose(self):
            closed.append(True)

    monkeypatch.setattr(voice_service, "LIVEKIT_URL", "wss://livekit.example")
    monkeypatch.setattr(voice_service, "LIVEKIT_API_KEY", "key")
    monkeypatch.setattr(voice_service, "LIVEKIT_API_SECRET", "secret")
    monkeypatch.setattr(voice_service.api, "LiveKitAPI", FakeApi)

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(voice_service.mint_voice_session(bot_id="bot-1", session_id="session-1"))

    assert exc_info.value.status_code == 502
    assert "Could not start the voice agent" in str(exc_info.value.detail)
    assert closed == [True]


def test_mint_voice_session_times_out_stalled_dispatch(monkeypatch):
    closed = []

    class FakeDispatch:
        async def create_dispatch(self, _request):
            await asyncio.sleep(60)

    class FakeApi:
        agent_dispatch = FakeDispatch()

        def __init__(self, *_args):
            pass

        async def aclose(self):
            closed.append(True)

    monkeypatch.setattr(voice_service, "LIVEKIT_URL", "wss://livekit.example")
    monkeypatch.setattr(voice_service, "LIVEKIT_API_KEY", "key")
    monkeypatch.setattr(voice_service, "LIVEKIT_API_SECRET", "secret")
    monkeypatch.setattr(voice_service, "VOICE_DISPATCH_TIMEOUT_SECONDS", 0.01)
    monkeypatch.setattr(voice_service.api, "LiveKitAPI", FakeApi)

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(voice_service.mint_voice_session(bot_id="bot-1", session_id="session-1"))

    assert exc_info.value.status_code == 502
    assert closed == [True]
