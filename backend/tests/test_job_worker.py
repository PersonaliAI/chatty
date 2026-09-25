import asyncio
import json

from app.workers import job_worker
from app.workers.job_worker import RedisStreamWorker


class FakeRedis:
    def __init__(self, messages):
        self.messages = messages
        self.published = []
        self.acked = []
        self.groups = []
        self.done = {}

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

    async def get(self, key):
        return self.done.get(key)

    async def set(self, key, value, **kwargs):
        if kwargs.get("nx") and key in self.done:
            return None
        self.done[key] = value
        return True

    async def delete(self, key):
        self.done.pop(key, None)


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


def test_worker_skips_a_successful_redelivery_using_idempotency_marker():
    client = FakeRedis([("1-0", {
        "name": "ok",
        "payload": json.dumps({"id": "1"}),
        "idempotency_key": "event-1",
    })])
    seen = []
    worker = RedisStreamWorker(client, handlers={"ok": lambda payload: seen.append(payload)})
    first = asyncio.run(worker.run_once())
    client.messages = [("2-0", {
        "name": "ok",
        "payload": json.dumps({"id": "1"}),
        "idempotency_key": "event-1",
    })]
    second = asyncio.run(worker.run_once())
    assert first["succeeded"] == 1
    assert second["succeeded"] == 1
    assert seen == [{"id": "1"}]


def test_worker_releases_distributed_concurrency_lock_after_success():
    client = FakeRedis([("1-0", {
        "name": "ok",
        "payload": json.dumps({"concurrency_key": "woocommerce:https://shop.example"}),
        "idempotency_key": "event-1",
    })])
    worker = RedisStreamWorker(client, handlers={"ok": lambda payload: None})

    stats = asyncio.run(worker.run_once())

    assert stats["succeeded"] == 1
    assert not [key for key in client.done if key.startswith("chatty:jobs:lock:")]


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


def test_worker_dead_letters_malformed_delivery_instead_of_leaving_it_pending():
    client = FakeRedis([("1-0", {
        "name": "broken",
        "payload": "not-json",
        "idempotency_key": "event-bad",
    })])
    worker = RedisStreamWorker(client)

    stats = asyncio.run(worker.run_once(block_ms=0))

    assert stats["dead_lettered"] == 1
    assert client.published[0][0] == "chatty:jobs:dead-letter"
    assert json.loads(client.published[0][1]["payload"])["raw_payload"] == "not-json"
    assert client.acked == [("chatty:jobs", "chatty-workers", "1-0")]


def test_worker_applies_bounded_exponential_retry_backoff(monkeypatch):
    client = FakeRedis([("1-0", {
        "name": "broken", "payload": "{}", "idempotency_key": "event-1"
    })])
    delays = []

    async def no_sleep(seconds):
        delays.append(seconds)

    monkeypatch.setattr(job_worker.asyncio, "sleep", no_sleep)
    worker = RedisStreamWorker(
        client,
        max_attempts=3,
        retry_backoff_base_seconds=2,
        retry_backoff_cap_seconds=3,
        handlers={"broken": lambda _: (_ for _ in ()).throw(RuntimeError("nope"))},
    )

    stats = asyncio.run(worker.run_once())

    assert stats["retried"] == 1
    assert delays == [2]
