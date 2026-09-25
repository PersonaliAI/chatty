"""Replay one Redis dead-letter job after operator review."""

from __future__ import annotations

import argparse
import asyncio
import os

from app.workers.dead_letter import replay_dead_letter_job


async def _run(args: argparse.Namespace) -> str:
    queue_url = os.environ.get("CHATTY_JOB_QUEUE_URL", "").strip()
    if not queue_url:
        raise RuntimeError("CHATTY_JOB_QUEUE_URL is required")
    try:
        from redis import asyncio as redis_asyncio
    except ImportError as exc:  # pragma: no cover
        raise RuntimeError("The replay tool requires the 'redis' package") from exc

    client = redis_asyncio.from_url(queue_url, decode_responses=True)
    try:
        return await replay_dead_letter_job(
            client,
            args.stream_id,
            dead_letter_stream=args.dead_letter_stream,
            target_stream=args.target_stream,
        )
    finally:
        await client.aclose()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("stream_id", help="exact Redis Stream ID in the dead-letter stream")
    parser.add_argument("--dead-letter-stream", default="chatty:webhooks:dead-letter")
    parser.add_argument("--target-stream", default="chatty:webhooks")
    args = parser.parse_args()
    print(asyncio.run(_run(args)))


if __name__ == "__main__":  # pragma: no cover
    main()
