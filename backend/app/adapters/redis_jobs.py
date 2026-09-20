"""Redis Streams adapter for the background-job port.

The Redis client is imported lazily so local unit tests and deployments that
use another queue do not need Redis installed at import time.
"""

from __future__ import annotations

import json
from typing import Any, Mapping

from app.ports.jobs import JobQueue


class RedisJobQueue(JobQueue):
    """Append jobs to a Redis Stream for an independently scalable worker."""

    def __init__(self, url: str, *, stream: str = "chatty:jobs", client: Any | None = None):
        self.url = url
        self.stream = stream
        self._client = client

    async def _redis(self) -> Any:
        if self._client is None:
            try:
                from redis import asyncio as redis_asyncio
            except ImportError as exc:  # pragma: no cover - environment-specific
                raise RuntimeError("RedisJobQueue requires the 'redis' package") from exc
            self._client = redis_asyncio.from_url(self.url, decode_responses=True)
        return self._client

    async def enqueue(
        self,
        *,
        name: str,
        payload: Mapping[str, Any],
        idempotency_key: str,
        delay_seconds: int = 0,
    ) -> str:
        if not name or not idempotency_key:
            raise ValueError("job name and idempotency_key are required")
        if delay_seconds < 0:
            raise ValueError("delay_seconds cannot be negative")
        client = await self._redis()
        return await client.xadd(self.stream, {
            "name": name,
            "payload": json.dumps(dict(payload), separators=(",", ":")),
            "idempotency_key": idempotency_key,
            "delay_seconds": str(delay_seconds),
        }, maxlen=100_000, approximate=True)
