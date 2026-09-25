"""Safe, explicit replay helpers for Redis Stream dead-letter jobs."""

from __future__ import annotations

import json
from typing import Any

from app.workers.job_worker import RedisStreamWorker


async def replay_dead_letter_job(
    client: Any,
    stream_id: str,
    *,
    dead_letter_stream: str,
    target_stream: str,
) -> str:
    """Replay exactly one dead-letter entry and return the new stream ID.

    The source entry is deleted only after Redis accepts the target append. If
    deletion fails, the caller gets an error and can inspect the resulting
    duplicate rather than risking silent loss of a job.
    """
    rows = await client.xrange(dead_letter_stream, min=stream_id, max=stream_id, count=1)
    match = next((row for row in rows or [] if str(row[0]) == str(stream_id)), None)
    if not match:
        raise LookupError(f"dead-letter job {stream_id} was not found")

    job = RedisStreamWorker._decode(str(match[0]), match[1])
    fields = {
        "name": job.name,
        "payload": json.dumps(dict(job.payload), separators=(",", ":")),
        "idempotency_key": job.idempotency_key,
        "attempts": "0",
        "last_error": "replayed from dead-letter stream",
    }
    new_id = await client.xadd(target_stream, fields, maxlen=100_000, approximate=True)
    await client.xdel(dead_letter_stream, stream_id)
    return str(new_id)
