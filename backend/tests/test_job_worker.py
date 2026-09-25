import asyncio
import json

from app.workers.job_worker import RedisStreamWorker


class FakeRedis:
    def __init__(self, messages):
        self.messages = messages
        self.published = []
        self.acked = []
        self.groups = []

    async def xgroup_create(self, **kwargs):
        self.groups.append(kwargs)

    async def xreadgroup(self, **kwargs):
        rows, self.messages = self.messages, []
        return [("chatty:jobs", rows)] if rows else []

    async def xack(self, stream, group, stream_id):
        self.acked.append((stream, group, stream_id))

    async def xadd(self, stream, fields, **kwargs):
        self.published.append((stream, fields, kwargs))
        return "2-0"


class RecoveringFakeRedis(FakeRedis):
    def __init__(self, messages):
        super().__init__(messages)
        self.claims = []

    async def xautoclaim(self, *args, **kwargs):
        self.claims.append((args, kwargs))
        return ("0-0", [("0-1", {
            "name": "ok",
            "payload": json.dumps({"id": "recovered"}),
            "idempotency_key": "event-recovered",
        })], [])


def test_worker_acknowledges_only_successful_handlers():
    client = FakeRedis([("1-0", {
        "name": "ok",
        "payload": json.dumps({"id": "1"}),
        "idempotency_key": "event-1",
    })])
    seen = []
    worker = RedisStreamWorker(client, handlers={"ok": lambda payload: seen.append(payload)})
    stats = asyncio.run(worker.run_once())
    assert stats == {"received": 1, "succeeded": 1, "retried": 0, "dead_lettered": 0}
    assert seen == [{"id": "1"}]
    assert client.acked == [("chatty:jobs", "chatty-workers", "1-0")]
    assert client.published == []


def test_worker_retries_then_dead_letters_poison_job():
    client = FakeRedis([("1-0", {
        "name": "broken", "payload": "{}", "idempotency_key": "event-1", "attempts": "1"
    })])
    worker = RedisStreamWorker(client, max_attempts=2, handlers={"broken": lambda _: (_ for _ in ()).throw(RuntimeError("nope"))})
    stats = asyncio.run(worker.run_once())
    assert stats["dead_lettered"] == 1
    assert client.published[0][0] == "chatty:jobs:dead-letter"
    assert client.published[0][1]["attempts"] == "2"
    assert client.acked == [("chatty:jobs", "chatty-workers", "1-0")]


def test_worker_creates_consumer_group():
    client = FakeRedis([])
    asyncio.run(RedisStreamWorker(client).ensure_group())
    assert client.groups[0]["groupname"] == "chatty-workers"


def test_worker_reclaims_stale_pending_deliveries_before_new_messages():
    client = RecoveringFakeRedis([])
    seen = []
    worker = RedisStreamWorker(
        client,
        pending_idle_ms=30_000,
        recover_count=3,
        handlers={"ok": lambda payload: seen.append(payload)},
    )

    stats = asyncio.run(worker.run_once(block_ms=0))

    assert stats["received"] == 1
    assert stats["succeeded"] == 1
    assert seen == [{"id": "recovered"}]
    assert client.claims[0][1]["min_idle_time"] == 30_000
    assert client.claims[0][1]["count"] == 3
    assert client.acked == [("chatty:jobs", "chatty-workers", "0-1")]
