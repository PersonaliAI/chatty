"""Regression coverage for the public LiveKit voice token contract."""

from __future__ import annotations

import json

import pytest
from starlette.requests import Request

# Import the application first; the production router reuses two helpers from
# ``main`` and the app registers all routers during that module's import.
import main  # noqa: F401, E402
from app.routers import voice
from app.schemas.voice import VoiceConfigUpdate, VoiceTokenRequest


def _request() -> Request:
    return Request({
        "type": "http",
        "method": "POST",
        "path": "/api/widget/voice/token",
        "headers": [],
        "query_string": b"",
        "client": ("127.0.0.1", 443),
        "server": ("testserver", 443),
        "scheme": "https",
    })


@pytest.mark.anyio
async def test_widget_voice_token_uses_public_livekit_agent_dispatch(monkeypatch):
    async def fake_db(_fn):
        return type("Result", (), {"data": [{"id": "bot-1", "voice_enabled": True}]})()

    async def no_rate_limit(*_args, **_kwargs):
        return None

    monkeypatch.setattr(voice, "run_db", fake_db)
    monkeypatch.setattr(voice, "_widget_rate_limit_or_429", no_rate_limit)
    monkeypatch.setattr(
        voice,
        "_livekit_settings",
        lambda: ("wss://livekit.example", "APIkey", "secret", "chatty-voice-agent"),
    )

    response = await voice.create_widget_voice_token(
        VoiceTokenRequest(bot_id="bot-1", session_id="session-1"),
        _request(),
    )

    assert response["serverUrl"] == "wss://livekit.example"
    assert response["roomName"].startswith("chatty-bot-1-session-1")
    assert response["participantToken"]

    # Decode the JWT payload only to prove the room dispatch is encoded in the
    # token. Signature validation belongs to LiveKit, not this contract test.
    payload = response["participantToken"].split(".")[1]
    padded = payload + "=" * (-len(payload) % 4)
    claims = json.loads(__import__("base64").urlsafe_b64decode(padded))
    assert claims["roomConfig"]["agents"][0]["agentName"] == "chatty-voice-agent"


def test_voice_config_accepts_livekit_inference_for_each_model_role():
    config = VoiceConfigUpdate(
        llm_provider="livekit-inference",
        stt_provider="livekit-inference",
        tts_provider="livekit-inference",
    )

    assert config.llm_provider == "livekit-inference"
    assert config.stt_provider == "livekit-inference"
    assert config.tts_provider == "livekit-inference"
