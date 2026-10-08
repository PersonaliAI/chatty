"""Regression coverage for the public LiveKit voice token contract."""

from __future__ import annotations

import json

import pytest
from fastapi import HTTPException
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
    metadata = json.loads(claims["roomConfig"]["agents"][0]["metadata"])
    assert metadata["visitor_timezone"] == ""


@pytest.mark.anyio
async def test_widget_voice_token_separates_room_nonce_from_chat_session(monkeypatch):
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
        VoiceTokenRequest(bot_id="bot-1", session_id="session-1", room_nonce="attempt-123456"),
        _request(),
    )

    assert response["roomName"].startswith("chatty-bot-1-session-1-attempt-123456")


@pytest.mark.anyio
async def test_widget_voice_token_carries_browser_timezone_in_signed_dispatch_metadata(monkeypatch):
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
        VoiceTokenRequest(
            bot_id="bot-1",
            session_id="session-1",
            visitor_timezone="Asia/Colombo",
        ),
        _request(),
    )

    payload = response["participantToken"].split(".")[1]
    padded = payload + "=" * (-len(payload) % 4)
    claims = json.loads(__import__("base64").urlsafe_b64decode(padded))
    metadata = json.loads(claims["roomConfig"]["agents"][0]["metadata"])
    assert metadata["visitor_timezone"] == "Asia/Colombo"


def test_voice_config_accepts_livekit_inference_for_each_model_role():
    config = VoiceConfigUpdate(
        llm_provider="livekit-inference",
        stt_provider="livekit-inference",
        tts_provider="livekit-inference",
    )

    assert config.llm_provider == "livekit-inference"
    assert config.stt_provider == "livekit-inference"
    assert config.tts_provider == "livekit-inference"


def test_voice_config_accepts_every_direct_tts_provider_exposed_by_dashboard():
    for provider in ("google", "livekit-inference", "cartesia", "deepgram", "elevenlabs", "openai", "fishaudio"):
        assert VoiceConfigUpdate(tts_provider=provider).tts_provider == provider


def test_enabled_google_pipeline_has_no_byok_preflight_error():
    assert voice._voice_configuration_error(
        {
            "voice_enabled": True,
            "voice_mode": "pipeline",
            "voice_llm_provider": "google",
            "voice_stt_provider": "google",
            "voice_tts_provider": "google",
        }
    ) is None


def test_enabled_pipeline_requires_the_selected_byok_key():
    error = voice._voice_configuration_error(
        {
            "voice_enabled": True,
            "voice_mode": "pipeline",
            "voice_llm_provider": "google",
            "voice_stt_provider": "deepgram",
            "voice_tts_provider": "google",
        }
    )

    assert error == "Voice is enabled, but the deepgram STT API key is missing."


def test_enabled_realtime_requires_key_for_byok_provider_but_not_google():
    assert voice._voice_configuration_error(
        {
            "voice_enabled": True,
            "voice_mode": "realtime",
            "voice_realtime_provider": "google",
        }
    ) is None
    assert voice._voice_configuration_error(
        {
            "voice_enabled": True,
            "voice_mode": "realtime",
            "voice_realtime_provider": "openai",
        }
    ) == "Voice is enabled, but the openai realtime API key is missing."


@pytest.mark.anyio
async def test_update_voice_config_rejects_missing_key_before_writing(monkeypatch):
    calls = 0

    async def allow_settings(*_args, **_kwargs):
        return None

    async def fake_db(_fn):
        nonlocal calls
        calls += 1
        return type(
            "Result",
            (),
            {
                "data": [
                    {
                        "voice_enabled": False,
                        "voice_mode": "pipeline",
                        "voice_llm_provider": "google",
                        "voice_stt_provider": "google",
                        "voice_tts_provider": "google",
                    }
                ]
            },
        )()

    monkeypatch.setattr(voice, "verify_bot_permission", allow_settings)
    monkeypatch.setattr(voice, "run_db", fake_db)

    with pytest.raises(HTTPException) as raised:
        await voice.update_voice_config(
            "bot-1",
            VoiceConfigUpdate(enabled=True, stt_provider="deepgram"),
            {},
        )

    assert raised.value.status_code == 422
    assert "deepgram STT API key is missing" in str(raised.value.detail)
    assert calls == 1
