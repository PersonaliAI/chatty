import asyncio

import pytest

from app.workers.webhook_worker import _process_campaign_dispatch


def test_web_campaign_step_is_delegated_to_widget():
    asyncio.run(_process_campaign_dispatch({
        "bot_id": "bot-1",
        "campaign_id": "campaign-1",
        "channel": "web",
        "message": "Hello",
    }))


def test_campaign_provider_step_requires_consent_and_recipient():
    with pytest.raises(ValueError, match="consent"):
        asyncio.run(_process_campaign_dispatch({
            "bot_id": "bot-1",
            "channel": "whatsapp",
            "message": "Hello",
            "recipient": {"phone": "+15551234567"},
        }))
    with pytest.raises(ValueError, match="recipient.phone"):
        asyncio.run(_process_campaign_dispatch({
            "bot_id": "bot-1",
            "channel": "whatsapp",
            "message": "Hello",
            "requires_consent": False,
            "recipient": {},
        }))


def test_unconfigured_email_channel_fails_closed():
    with pytest.raises(RuntimeError, match="no_email_provider_configured"):
        asyncio.run(_process_campaign_dispatch({
            "bot_id": "bot-1",
            "channel": "email",
            "message": "Hello",
            "requires_consent": False,
            "recipient": {"email": "a@example.com"},
        }))


def test_configured_email_campaign_delivery_uses_provider_boundary(monkeypatch):
    from app.services import email_service

    async def sent(**kwargs):
        assert kwargs["to_email"] == "a@example.com"
        assert kwargs["body_text"] == "Hello"
        return {"sent": True, "provider": "resend"}

    monkeypatch.setattr(email_service, "send_campaign_email", sent)
    asyncio.run(_process_campaign_dispatch({
        "bot_id": "bot-1",
        "channel": "email",
        "message": "Hello",
        "requires_consent": False,
        "recipient": {"email": "a@example.com"},
    }))


def test_configured_sms_campaign_delivery_uses_provider_boundary(monkeypatch):
    from app.services import sms_service

    async def sent(**kwargs):
        assert kwargs == {"to": "+15551234567", "body": "Hello"}
        return True

    monkeypatch.setattr(sms_service, "send_campaign_sms", sent)
    asyncio.run(_process_campaign_dispatch({
        "bot_id": "bot-1",
        "channel": "sms",
        "message": "Hello",
        "requires_consent": False,
        "recipient": {"phone": "+15551234567"},
    }))


def test_sms_campaign_requires_phone_before_provider_call():
    with pytest.raises(ValueError, match="recipient.phone"):
        asyncio.run(_process_campaign_dispatch({
            "bot_id": "bot-1",
            "channel": "sms",
            "message": "Hello",
            "requires_consent": False,
            "recipient": {},
        }))


def test_frequency_capped_provider_step_is_suppressed_before_send(monkeypatch):
    from app.services import email_service

    class ExistingClaim:
        async def set(self, *args, **kwargs):
            return False

    async def should_not_send(**kwargs):
        raise AssertionError("frequency-capped campaign must not send")

    monkeypatch.setattr(email_service, "send_campaign_email", should_not_send)
    asyncio.run(_process_campaign_dispatch({
        "bot_id": "bot-1",
        "campaign_id": "campaign-1",
        "channel": "email",
        "message": "Hello",
        "requires_consent": False,
        "recipient": {"email": "a@example.com"},
    }, redis_client=ExistingClaim()))


def test_campaign_worker_rechecks_quiet_hours():
    # Suppression is an intentional no-op, not a retryable delivery failure.
    asyncio.run(_process_campaign_dispatch({
        "bot_id": "bot-1",
        "channel": "email",
        "message": "Hello",
        "requires_consent": False,
        "recipient": {"email": "a@example.com"},
        "quiet_hours": {"start": "00:00", "end": "23:59"},
        "timezone": "UTC",
    }))


def test_paused_campaign_suppresses_already_queued_provider_delivery(monkeypatch):
    from app.services import email_service
    from app.core import clients
    from app.services import campaign_delivery_ledger

    ledger_updates = []

    class Query:
        def select(self, *_args): return self
        def eq(self, *_args): return self
        def maybe_single(self): return self
        def execute(self): return type("Result", (), {"data": {"is_active": False}})()

    class Supabase:
        def table(self, name):
            assert name == "chatty_campaigns"
            return Query()

    async def should_not_send(**_kwargs):
        raise AssertionError("paused campaign must not send queued delivery")

    async def record_delivery(_supabase, payload, status, *, error=None):
        ledger_updates.append((payload.get("delivery_idempotency_key"), status, error))

    monkeypatch.setattr(clients, "supabase", Supabase())
    monkeypatch.setattr(email_service, "send_campaign_email", should_not_send)
    monkeypatch.setattr(campaign_delivery_ledger, "record_campaign_delivery", record_delivery)
    asyncio.run(_process_campaign_dispatch({
        "bot_id": "bot-1", "campaign_id": "campaign-1",
        "enforce_campaign_state": True, "channel": "email", "message": "Hello",
        "requires_consent": False, "recipient": {"email": "a@example.com"},
        "delivery_idempotency_key": "delivery-paused-1",
    }))
    assert ledger_updates == [("delivery-paused-1", "suppressed", "campaign_paused")]


def test_provider_failure_can_retry_without_frequency_cap_suppression(monkeypatch):
    from app.services import email_service

    class CapRedis:
        value = None

        async def set(self, key, value, **kwargs):
            if self.value is not None:
                return False
            self.value = value
            return True

        async def get(self, key):
            return self.value

    calls = []

    async def send(**kwargs):
        calls.append(kwargs)
        return {"sent": len(calls) > 1, "error": "temporary provider failure"}

    monkeypatch.setattr(email_service, "send_campaign_email", send)

    async def exercise():
        client = CapRedis()
        payload = {"bot_id": "bot-1", "campaign_id": "campaign-1",
                   "channel": "email", "message": "Hello", "requires_consent": False,
                   "recipient": {"email": "a@example.com"},
                   "delivery_idempotency_key": "delivery-1"}
        with pytest.raises(RuntimeError, match="temporary provider failure"):
            await _process_campaign_dispatch(payload, redis_client=client)
        await _process_campaign_dispatch(payload, redis_client=client)
        await _process_campaign_dispatch({**payload, "delivery_idempotency_key": "delivery-2"},
                                         redis_client=client)
        assert len(calls) == 2

    asyncio.run(exercise())
