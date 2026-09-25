"""Redis Streams worker with explicit retry and dead-letter semantics."""

from __future__ import annotations

import asyncio
import hashlib
import inspect
import json
import logging
import time
import uuid
from dataclasses import dataclass
from typing import Any, Awaitable, Callable, Mapping

logger = logging.getLogger("chatty.job_worker")


class JobConcurrencyBusy(RuntimeError):
    """Raised when a distributed job lock is held by another worker."""

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
        pending_idle_ms: int = 60_000,
        recover_count: int = 10,
        retry_backoff_base_seconds: float = 0.0,
        retry_backoff_cap_seconds: float = 30.0,
        dedupe_ttl_seconds: int = 7 * 24 * 60 * 60,
        concurrency_lock_ttl_seconds: int = 60 * 60,
        concurrency_lock_wait_seconds: float = 5.0,
        concurrency_busy_retry_delay_seconds: float = 1.0,
        handlers: Mapping[str, JobHandler] | None = None,
    ) -> None:
        if max_attempts < 1:
            raise ValueError("max_attempts must be positive")
        if pending_idle_ms < 0:
            raise ValueError("pending_idle_ms must be non-negative")
        if recover_count < 1:
            raise ValueError("recover_count must be positive")
        if retry_backoff_base_seconds < 0 or retry_backoff_cap_seconds < 0:
            raise ValueError("retry backoff values must be non-negative")
        if retry_backoff_cap_seconds < retry_backoff_base_seconds:
            raise ValueError("retry_backoff_cap_seconds must not be below the base")
        if dedupe_ttl_seconds < 1:
            raise ValueError("dedupe_ttl_seconds must be positive")
        if concurrency_lock_ttl_seconds < 1 or concurrency_lock_wait_seconds < 0 or concurrency_busy_retry_delay_seconds < 0:
            raise ValueError("invalid concurrency lock settings")
        self.client = client
        self.stream = stream
        self.group = group
        self.consumer = consumer
        self.dead_letter_stream = dead_letter_stream or f"{stream}:dead-letter"
        self.max_attempts = max_attempts
        self.pending_idle_ms = pending_idle_ms
        self.recover_count = recover_count
        self.retry_backoff_base_seconds = retry_backoff_base_seconds
        self.retry_backoff_cap_seconds = retry_backoff_cap_seconds
        self.dedupe_ttl_seconds = dedupe_ttl_seconds
        self.concurrency_lock_ttl_seconds = concurrency_lock_ttl_seconds
        self.concurrency_lock_wait_seconds = concurrency_lock_wait_seconds
        self.concurrency_busy_retry_delay_seconds = concurrency_busy_retry_delay_seconds
        self.handlers = dict(handlers or {})

    def _dedupe_key(self, job: JobEnvelope) -> str:
        digest = hashlib.sha256(
            f"{job.name}:{job.idempotency_key}".encode("utf-8")
        ).hexdigest()
        return f"chatty:jobs:done:{digest}"

    async def _already_succeeded(self, job: JobEnvelope) -> bool:
        getter = getattr(self.client, "get", None)
        if not callable(getter):
            return False
        return bool(await getter(self._dedupe_key(job)))

    async def _mark_succeeded(self, job: JobEnvelope) -> None:
        setter = getattr(self.client, "set", None)
        if not callable(setter):
            return
        await setter(self._dedupe_key(job), "1", ex=self.dedupe_ttl_seconds)

    @staticmethod
    def _concurrency_lock_key(concurrency_key: str) -> str:
        digest = hashlib.sha256(concurrency_key.encode("utf-8")).hexdigest()
        return f"chatty:jobs:lock:{digest}"

    async def _acquire_concurrency_lock(self, job: JobEnvelope) -> tuple[str, str] | None:
        raw_key = str(job.payload.get("concurrency_key") or "").strip()
        setter = getattr(self.client, "set", None)
        if not raw_key or not callable(setter):
            return None
        lock_key = self._concurrency_lock_key(raw_key)
        token = uuid.uuid4().hex
        deadline = time.monotonic() + self.concurrency_lock_wait_seconds
        while True:
            acquired = await setter(
                lock_key,
                token,
                nx=True,
                ex=self.concurrency_lock_ttl_seconds,
            )
            if acquired:
                return lock_key, token
            if time.monotonic() >= deadline:
                raise JobConcurrencyBusy(f"concurrency lock is held for {raw_key}")
            await asyncio.sleep(0.25)

    async def _release_concurrency_lock(self, lock: tuple[str, str] | None) -> None:
        if not lock:
            return
        lock_key, token = lock
        evaluator = getattr(self.client, "eval", None)
        if callable(evaluator):
            await evaluator(
                "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
                1,
                lock_key,
                token,
            )
            return
        getter = getattr(self.client, "get", None)
        deleter = getattr(self.client, "delete", None)
        if callable(getter) and callable(deleter) and await getter(lock_key) == token:
            await deleter(lock_key)

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

    async def _read_pending(self) -> list[tuple[str, list[tuple[str, Mapping[str, Any]]]]]:
        """Claim a bounded batch of stale deliveries after a worker restart.

        Older Redis clients and the in-memory test doubles may not expose
        XAUTOCLAIM; in that case normal new-delivery processing still works.
        """
        autoclaim = getattr(self.client, "xautoclaim", None)
        if not callable(autoclaim):
            return []
        result = await autoclaim(
            self.stream,
            self.group,
            self.consumer,
            min_idle_time=self.pending_idle_ms,
            start_id="0-0",
            count=self.recover_count,
        )
        messages = result[1] if isinstance(result, (tuple, list)) and len(result) > 1 else []
        return [(self.stream, messages)] if messages else []

    async def run_once(self, *, count: int = 10, block_ms: int = 1_000) -> dict[str, int]:
        rows = await self._read_pending()
        rows.extend(await self.client.xreadgroup(
            groupname=self.group,
            consumername=self.consumer,
            streams={self.stream: ">"},
            count=count,
            block=block_ms,
        ) or [])
        stats = {"received": 0, "succeeded": 0, "retried": 0, "dead_lettered": 0}
        for _stream, messages in rows or []:
            for stream_id, fields in messages:
                stats["received"] += 1
                try:
                    job = self._decode(stream_id, fields)
                    handler = self.handlers.get(job.name)
                    if handler is None:
                        raise ValueError(f"no handler registered for {job.name}")
                    if await self._already_succeeded(job):
                        await self.client.xack(self.stream, self.group, stream_id)
                        stats["succeeded"] += 1
                        continue
                    lock = await self._acquire_concurrency_lock(job)
                    try:
                        result = handler(job.payload)
                        if inspect.isawaitable(result):
                            await result
                        await self._mark_succeeded(job)
                        await self.client.xack(self.stream, self.group, stream_id)
                        stats["succeeded"] += 1
                    finally:
                        await self._release_concurrency_lock(lock)
                except Exception as exc:  # noqa: BLE001 - worker isolation boundary
                    try:
                        job = self._decode(stream_id, fields)
                    except Exception as decode_error:
                        # A malformed delivery cannot be decoded into a normal
                        # retry envelope. Dead-letter it directly so one bad
                        # producer payload cannot remain pending forever.
                        malformed_payload = {
                            "raw_payload": str(fields.get("payload", ""))[:1_000],
                            "decode_error": str(decode_error)[:500],
                        }
                        await self.client.xadd(
                            self.dead_letter_stream,
                            {
                                "name": str(fields.get("name") or "__malformed__")[:200],
                                "payload": json.dumps(malformed_payload, separators=(",", ":")),
                                "idempotency_key": str(fields.get("idempotency_key") or f"malformed:{stream_id}")[:200],
                                "attempts": str(self.max_attempts),
                                "last_error": str(exc)[:500],
                            },
                            maxlen=100_000,
                            approximate=True,
                        )
                        await self.client.xack(self.stream, self.group, stream_id)
                        stats["dead_lettered"] += 1
                        continue
                    try:
                        if isinstance(exc, JobConcurrencyBusy):
                            busy_delay = min(
                                self.retry_backoff_cap_seconds,
                                self.concurrency_busy_retry_delay_seconds * (2 ** job.attempts),
                            )
                            if busy_delay > 0:
                                await asyncio.sleep(busy_delay)
                            await self.client.xadd(
                                self.stream,
                                {
                                    "name": job.name,
                                    "payload": json.dumps(dict(job.payload), separators=(",", ":")),
                                    "idempotency_key": job.idempotency_key,
                                    "attempts": str(job.attempts),
                                },
                                maxlen=100_000,
                                approximate=True,
                            )
                            await self.client.xack(self.stream, self.group, stream_id)
                            stats["retried"] += 1
                            continue
                        if job.attempts + 1 < self.max_attempts:
                            retry_delay = min(
                                self.retry_backoff_cap_seconds,
                                self.retry_backoff_base_seconds * (2 ** job.attempts),
                            )
                            if retry_delay > 0:
                                await asyncio.sleep(retry_delay)
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
