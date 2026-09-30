import asyncio
from datetime import datetime, timezone

import app.workers.campaign_scheduler as campaign_scheduler
from unittest.mock import AsyncMock
from app.workers.campaign_scheduler import schedule_campaigns_once


class _Result:
    def __init__(self, data):
        self.data = data


class _Table:
    def __init__(self, rows):
        self.rows = rows

    def select(self, *_):
        return self

    def eq(self, *_):
        return self

    def limit(self, *_):
        return self

    def execute(self):
        return _Result(self.rows)


class _Db:
    def __init__(self, rows, leads=None):
        self.rows = rows
        self.leads = leads or []

    def table(self, name):
        return _Table(self.leads if name == "chatty_leads" else self.rows)


class _Queue:
    def __init__(self):
        self.jobs = []

    async def enqueue(self, **job):
        self.jobs.append(job)


def _campaign():
    return {
        "id": "campaign-1", "bot_id": "bot-1", "is_active": True,
        "created_at": "2026-09-29T10:00:00Z", "message": "hello",
        "schedule_config": {"cadence": "once", "timezone": "UTC"},
        "safety_config": {"require_consent": True}, "sequence_steps": [],
    }


def test_scheduler_enqueues_only_due_jobs_and_claims_once():
    queue = _Queue()
    claimed = set()

    async def claim(key):
        if key in claimed:
            return False
        claimed.add(key)
        return True

    now = datetime(2026, 9, 29, 12, 0, tzinfo=timezone.utc)
    first = asyncio.run(schedule_campaigns_once(_Db([_campaign()]), queue, now=now, claim=claim))
    second = asyncio.run(schedule_campaigns_once(_Db([_campaign()]), queue, now=now, claim=claim))
    assert first["enqueued"] == 1
    assert second["enqueued"] == 0
    assert len(queue.jobs) == 1


def test_scheduler_bounds_campaign_batch():
    try:
        asyncio.run(schedule_campaigns_once(_Db([]), _Queue(), limit=501))
    except ValueError as exc:
        assert "between 1 and 500" in str(exc)
    else:
        raise AssertionError("expected limit validation")


def test_scheduler_tick_recovers_after_transient_failure(monkeypatch):
    attempts = AsyncMock(side_effect=[RuntimeError("database unavailable"), {"planned": 1}])
    monkeypatch.setattr(campaign_scheduler, "schedule_campaigns_once", attempts)

    async def two_ticks():
        first = await campaign_scheduler.schedule_campaigns_tick(None, None)
        second = await campaign_scheduler.schedule_campaigns_tick(None, None)
        return first, second

    assert asyncio.run(two_ticks()) == (None, {"planned": 1})


def test_scheduler_tick_preserves_shutdown_cancellation(monkeypatch):
    attempts = AsyncMock(side_effect=asyncio.CancelledError())
    monkeypatch.setattr(campaign_scheduler, "schedule_campaigns_once", attempts)
    import pytest
    with pytest.raises(asyncio.CancelledError):
        asyncio.run(campaign_scheduler.schedule_campaigns_tick(None, None))


def test_scheduler_defers_provider_steps_without_a_recipient():
    queue = _Queue()
    campaign = _campaign()
    campaign["sequence_steps"] = [{"channel": "email", "after_minutes": 0, "message": "hello"}]
    now = datetime(2026, 9, 29, 12, 0, tzinfo=timezone.utc)
    stats = asyncio.run(schedule_campaigns_once(_Db([campaign]), queue, now=now))
    assert stats["deferred"] == 1
    assert stats["enqueued"] == 0
    assert queue.jobs == []


def test_scheduler_expands_provider_steps_only_for_consented_leads():
    queue = _Queue()
    campaign = _campaign()
    campaign["sequence_steps"] = [{"channel": "email", "after_minutes": 0, "message": "hello"}]
    campaign["audience_rules"] = {"recipient_source": "consented_leads"}
    leads = [
        {"id": "lead-consented", "email": "opted-in@example.com", "phone": "+15551234567", "marketing_consent": True},
        {"id": "lead-no-consent", "email": "nope@example.com", "phone": "+15550000000", "marketing_consent": False},
    ]
    now = datetime(2026, 9, 29, 12, 0, tzinfo=timezone.utc)

    stats = asyncio.run(schedule_campaigns_once(_Db([campaign], leads), queue, now=now))

    assert stats["enqueued"] == 1
    assert queue.jobs[0]["payload"]["recipient"] == {
        "id": "lead-consented", "email": "opted-in@example.com", "phone": "+15551234567", "consent": True,
    }


def test_scheduler_applies_campaign_audience_to_consented_leads():
    queue = _Queue()
    campaign = _campaign()
    campaign["sequence_steps"] = [{"channel": "email", "after_minutes": 0, "message": "hello"}]
    campaign["audience_rules"] = {"recipient_source": "consented_leads", "segment": "high_intent", "min_intent_score": 70}
    leads = [
        {"id": "lead-high", "email": "high@example.com", "phone": "", "marketing_consent": True, "custom_fields": {"intent_score": 90}},
        {"id": "lead-low", "email": "low@example.com", "phone": "", "marketing_consent": True, "custom_fields": {"intent_score": 20}},
    ]
    now = datetime(2026, 9, 29, 12, 0, tzinfo=timezone.utc)

    stats = asyncio.run(schedule_campaigns_once(_Db([campaign], leads), queue, now=now))

    assert stats["enqueued"] == 1
    assert queue.jobs[0]["payload"]["recipient"]["id"] == "lead-high"


def test_scheduler_defers_one_campaign_when_audience_lookup_fails(monkeypatch):
    queue = _Queue()
    failing = _campaign()
    failing["id"] = "campaign-failing"
    failing["sequence_steps"] = [{"channel": "email", "after_minutes": 0, "message": "hello"}]
    failing["audience_rules"] = {"recipient_source": "consented_leads"}
    healthy = _campaign()
    healthy["id"] = "campaign-healthy"
    now = datetime(2026, 9, 29, 12, 0, tzinfo=timezone.utc)

    async def fail_for_one_campaign(_db, bot_id, *, audience_rules):
        if bot_id == "bot-1" and audience_rules.get("recipient_source") == "consented_leads":
            raise RuntimeError("temporary database outage")
        return []

    monkeypatch.setattr(campaign_scheduler, "_consented_lead_recipients", fail_for_one_campaign)
    stats = asyncio.run(schedule_campaigns_once(_Db([failing, healthy]), queue, now=now))

    assert stats["deferred"] == 1
    assert stats["enqueued"] == 1
    assert queue.jobs[0]["payload"]["campaign_id"] == "campaign-healthy"
