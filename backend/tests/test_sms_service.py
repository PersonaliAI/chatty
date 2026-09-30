import asyncio

import pytest

from app.services import sms_service


class _Response:
    def __init__(self, status_code: int):
        self.status_code = status_code


class _Client:
    def __init__(self, response: _Response, calls: list[dict]):
        self.response = response
        self.calls = calls

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_args):
        return False

    async def post(self, url, **kwargs):
        self.calls.append({"url": url, **kwargs})
        return self.response


def _configured(monkeypatch, response: _Response):
    calls: list[dict] = []
    monkeypatch.setenv("TWILIO_ACCOUNT_SID", "AC123")
    monkeypatch.setenv("TWILIO_AUTH_TOKEN", "token")
    monkeypatch.setenv("TWILIO_FROM_NUMBER", "+14155550123")
    monkeypatch.setattr(sms_service.httpx, "AsyncClient", lambda **_kwargs: _Client(response, calls))
    return calls


def test_sms_posts_to_twilio_without_exposing_body_in_url(monkeypatch):
    calls = _configured(monkeypatch, _Response(201))

    assert asyncio.run(sms_service.send_campaign_sms(to="+15551234567", body="Private campaign update"))
    assert len(calls) == 1
    assert calls[0]["data"] == {"To": "+15551234567", "From": "+14155550123", "Body": "Private campaign update"}
    assert "Private" not in calls[0]["url"]
    assert calls[0]["auth"] == ("AC123", "token")


def test_sms_fails_closed_for_missing_provider_or_invalid_phone(monkeypatch):
    monkeypatch.delenv("TWILIO_ACCOUNT_SID", raising=False)
    monkeypatch.delenv("TWILIO_AUTH_TOKEN", raising=False)
    monkeypatch.delenv("TWILIO_FROM_NUMBER", raising=False)
    with pytest.raises(RuntimeError, match="sms_provider_not_configured"):
        asyncio.run(sms_service.send_campaign_sms(to="+15551234567", body="Hello"))

    _configured(monkeypatch, _Response(201))
    with pytest.raises(ValueError, match="E.164"):
        asyncio.run(sms_service.send_campaign_sms(to="5551234567", body="Hello"))
