"""Redis Streams worker with explicit retry and dead-letter semantics."""

from __future__ import annotations

import inspect
import json
import logging
from dataclasses import dataclass
from typing import Any, Awaitable, Callable, Mapping

logger = logging.getLogger("chatty.job_worker")

JobHandler = Callable[[Mapping[str, Any]], Any | Awaitable[Any]]


@dataclass(frozen=True)
class JobEnvelope:
    stream_id: str
    name: str
    payload: Mapping[str, Any]
    idempotency_key: str
    attempts: int = 0


class RedisStreamWorker:
    """Consume jobs using a Redis consumer group.

    A message is acknowledged only after its handler succeeds. Failures are
    re-published with an incremented attempt count; poison messages are copied
    to the dead-letter stream and acknowledged so they cannot block the group.
    """

    def __init__(
        self,
        client: Any,
        *,
        stream: str = "chatty:jobs",
        group: str = "chatty-workers",
        consumer: str = "worker-1",
        dead_letter_stream: str | None = None,
        max_attempts: int = 5,
        handlers: Mapping[str, JobHandler] | None = None,
    ) -> None:
        if max_attempts < 1:
            raise ValueError("max_attempts must be positive")
        self.client = client
        self.stream = stream
        self.group = group
        self.consumer = consumer
        self.dead_letter_stream = dead_letter_stream or f"{stream}:dead-letter"
        self.max_attempts = max_attempts
        self.handlers = dict(handlers or {})

    async def ensure_group(self) -> None:
        try:
            await self.client.xgroup_create(
                name=self.stream, groupname=self.group, id="0", mkstream=True
            )
        except Exception as exc:
            # Redis reports BUSYGROUP when another replica already created it.
            if "BUSYGROUP" not in str(exc):
                raise

    @staticmethod
    def _decode(stream_id: str, fields: Mapping[str, Any]) -> JobEnvelope:
        name = str(fields.get("name") or "")
        key = str(fields.get("idempotency_key") or "")
        if not name or not key:
            raise ValueError("job is missing name or idempotency_key")
        raw_payload = fields.get("payload", "{}")
        payload = json.loads(raw_payload) if isinstance(raw_payload, str) else raw_payload
        if not isinstance(payload, dict):
            raise ValueError("job payload must be an object")
        return JobEnvelope(
            stream_id=stream_id,
            name=name,
            payload=payload,
            idempotency_key=key,
            attempts=int(fields.get("attempts", 0) or 0),
        )

    async def _retry_or_dead_letter(self, job: JobEnvelope, error: Exception) -> None:
        attempts = job.attempts + 1
        fields = {
            "name": job.name,
            "payload": json.dumps(dict(job.payload), separators=(",", ":")),
            "idempotency_key": job.idempotency_key,
            "attempts": str(attempts),
            "last_error": str(error)[:500],
        }
        destination = self.dead_letter_stream if attempts >= self.max_attempts else self.stream
        await self.client.xadd(destination, fields, maxlen=100_000, approximate=True)

    async def run_once(self, *, count: int = 10, block_ms: int = 1_000) -> dict[str, int]:
        rows = await self.client.xreadgroup(
            groupname=self.group,
            consumername=self.consumer,
            streams={self.stream: ">"},
            count=count,
            block=block_ms,
        )
        stats = {"received": 0, "succeeded": 0, "retried": 0, "dead_lettered": 0}
        for _stream, messages in rows or []:
            for stream_id, fields in messages:
                stats["received"] += 1
                try:
                    job = self._decode(stream_id, fields)
                    handler = self.handlers.get(job.name)
                    if handler is None:
                        raise ValueError(f"no handler registered for {job.name}")
                    result = handler(job.payload)
                    if inspect.isawaitable(result):
                        await result
                    await self.client.xack(self.stream, self.group, stream_id)
                    stats["succeeded"] += 1
                except Exception as exc:  # noqa: BLE001 - worker isolation boundary
                    try:
                        job = self._decode(stream_id, fields)
                        await self._retry_or_dead_letter(job, exc)
                        await self.client.xack(self.stream, self.group, stream_id)
                        if job.attempts + 1 >= self.max_attempts:
                            stats["dead_lettered"] += 1
                        else:
                            stats["retried"] += 1
                    except Exception:
                        # Leave the original pending for a later recovery pass.
                        logger.exception("job recovery failed for %s", stream_id)
        return stats
