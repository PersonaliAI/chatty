import asyncio
import json

import pytest

from app.adapters.redis_jobs import RedisJobQueue


class FakeRedis:
    def __init__(self):
        self.calls = []

    async def xadd(self, stream, values, **kwargs):
        self.calls.append((stream, values, kwargs))
        return "171-0"


def test_redis_job_queue_serializes_a_durable_job():
    client = FakeRedis()
    job_id = asyncio.run(RedisJobQueue("redis://unused", client=client).enqueue(
        name="webhook.deliver",
        payload={"bot_id": "bot-1", "attempt": 1},
        idempotency_key="event-1",
        delay_seconds=5,
    ))
    assert job_id == "171-0"
    stream, values, kwargs = client.calls[0]
    assert stream == "chatty:jobs"
    assert json.loads(values["payload"]) == {"bot_id": "bot-1", "attempt": 1}
    assert values["name"] == "webhook.deliver"
    assert values["idempotency_key"] == "event-1"
    assert values["delay_seconds"] == "5"
    assert kwargs["maxlen"] == 100_000


@pytest.mark.parametrize("kwargs", [
    {"name": "", "idempotency_key": "id"},
    {"name": "job", "idempotency_key": ""},
    {"name": "job", "idempotency_key": "id", "delay_seconds": -1},
])
def test_redis_job_queue_rejects_invalid_jobs(kwargs):
    with pytest.raises(ValueError):
        asyncio.run(RedisJobQueue("redis://unused", client=FakeRedis()).enqueue(
            payload={}, **kwargs
        ))
