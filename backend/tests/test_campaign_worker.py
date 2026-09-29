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


def test_unconfigured_channels_fail_closed():
    with pytest.raises(RuntimeError, match="email campaign delivery adapter"):
        asyncio.run(_process_campaign_dispatch({
            "bot_id": "bot-1",
            "channel": "email",
            "message": "Hello",
            "requires_consent": False,
            "recipient": {"email": "a@example.com"},
        }))


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
