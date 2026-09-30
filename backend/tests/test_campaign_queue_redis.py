"""Real Redis regression tests; CI supplies an isolated Redis service."""
import asyncio
import hashlib
import os
import uuid

import pytest

from app.adapters.redis_jobs import RedisJobQueue


def test_atomic_campaign_enqueue_under_concurrency_and_append_failure():
    url = os.environ.get("CHATTY_TEST_REDIS_URL")
    if not url:
        pytest.skip("requires isolated CHATTY_TEST_REDIS_URL")

    async def exercise():
        from redis.asyncio import Redis
        client = Redis.from_url(url, decode_responses=True)
        suffix = uuid.uuid4().hex
        stream = f"chatty:test:campaign:{suffix}"
        key = f"campaign-test:{suffix}"
        marker = "chatty:campaign:scheduled:" + hashlib.sha256(key.encode()).hexdigest()
        queue = RedisJobQueue(url, stream=stream, client=client)
        try:
            # WRONGTYPE causes XADD to fail inside Lua. Redis scripts do not
            # roll back earlier writes: this proves the marker is written last.
            await client.set(stream, "wrong-type")
            from redis.exceptions import ResponseError
            with pytest.raises(ResponseError):
                await queue.enqueue_once(name="campaign.dispatch", payload={}, idempotency_key=key)
            assert await client.exists(marker) == 0
            await client.delete(stream)
            results = await asyncio.gather(*[
                queue.enqueue_once(name="campaign.dispatch", payload={"bot_id": "test"}, idempotency_key=key)
                for _ in range(20)
            ])
            assert sum(result is not None for result in results) == 1
            assert await client.xlen(stream) == 1
            assert await client.get(marker) == next(result for result in results if result)
            assert 0 < await client.ttl(marker) <= 604800
        finally:
            await client.delete(stream, marker)
            await client.aclose()

    asyncio.run(exercise())
