from datetime import datetime, timezone

import pytest

from app.services.campaign_dispatch import build_campaign_dispatch_plan, campaign_occurrence_at


NOW = datetime(2026, 9, 29, 12, 0, tzinfo=timezone.utc)


def _campaign(**overrides):
    value = {
        "id": "campaign-1",
        "bot_id": "bot-1",
        "is_active": True,
        "created_at": "2026-09-29T10:00:00Z",
        "message": "Welcome",
        "schedule_config": {"cadence": "hourly", "timezone": "UTC"},
        "safety_config": {"frequency_cap_hours": 12, "require_consent": True},
        "sequence_steps": [
            {"channel": "web", "after_minutes": 0, "message": "Hello"},
            {"channel": "email", "after_minutes": 15, "message": "Follow up"},
        ],
    }
    value.update(overrides)
    return value


def test_occurrence_and_plan_are_deterministic():
    campaign = _campaign()
    assert campaign_occurrence_at(campaign, NOW).isoformat() == "2026-09-29T12:00:00+00:00"
    first = build_campaign_dispatch_plan(campaign, now=NOW, recipient={"email": "a@example.com"})
    second = build_campaign_dispatch_plan(campaign, now=NOW, recipient={"email": "a@example.com"})
    assert first == second
    assert first[0]["payload"]["requires_consent"] is True
    assert first[0]["payload"]["frequency_cap_hours"] == 12
    assert first[0]["idempotency_key"] == first[0]["idempotency_key"]
    assert first[1]["scheduled_at"] == "2026-09-29T12:15:00+00:00"


def test_inactive_or_future_campaign_has_no_jobs():
    assert build_campaign_dispatch_plan(_campaign(is_active=False), now=NOW) == []
    assert build_campaign_dispatch_plan(_campaign(start_date="2026-09-30T00:00:00Z"), now=NOW) == []


def test_unsupported_channel_fails_closed():
    with pytest.raises(ValueError, match="unsupported campaign channel"):
        build_campaign_dispatch_plan(_campaign(sequence_steps=[{"channel": "carrier-pigeon"}]), now=NOW)
