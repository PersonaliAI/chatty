import asyncio
from datetime import datetime, timezone

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
    def __init__(self, rows):
        self.rows = rows

    def table(self, *_):
        return _Table(self.rows)


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


def test_scheduler_defers_provider_steps_without_a_recipient():
    queue = _Queue()
    campaign = _campaign()
    campaign["sequence_steps"] = [{"channel": "email", "after_minutes": 0, "message": "hello"}]
    now = datetime(2026, 9, 29, 12, 0, tzinfo=timezone.utc)
    stats = asyncio.run(schedule_campaigns_once(_Db([campaign]), queue, now=now))
    assert stats["deferred"] == 1
    assert stats["enqueued"] == 0
    assert queue.jobs == []
