"""Runnable Redis Streams worker for durable webhook deliveries.

Deploy this module as a separate process/service from the HTTP API. The API
only publishes to Redis; this process owns delivery, retries, and dead-letter
handling through :class:`RedisStreamWorker`.
"""

from __future__ import annotations

import asyncio
import logging
import os
import socket

from app.workers.job_worker import RedisStreamWorker

logger = logging.getLogger("chatty.webhook_worker")


async def _deliver(payload: dict) -> None:
    # Import lazily so importing the worker module does not initialize the API
    # application's database/configuration graph in health checks or tests.
    from plugins.notifications import process_webhook_job

    delivered, error = await process_webhook_job(payload)
    if not delivered:
        raise RuntimeError(error or "webhook delivery failed")


async def run() -> None:
    queue_url = os.environ.get("CHATTY_JOB_QUEUE_URL", "").strip()
    if not queue_url:
        raise RuntimeError("CHATTY_JOB_QUEUE_URL is required for the webhook worker")

    try:
        from redis import asyncio as redis_asyncio
    except ImportError as exc:  # pragma: no cover - deployment dependency
        raise RuntimeError("The webhook worker requires the 'redis' package") from exc

    consumer = os.environ.get(
        "CHATTY_WORKER_CONSUMER",
        f"{socket.gethostname()}-{os.getpid()}",
    )
    stream = os.environ.get("CHATTY_WEBHOOK_STREAM", "chatty:webhooks")
    group = os.environ.get("CHATTY_WORKER_GROUP", "chatty-webhook-workers")
    max_attempts = int(os.environ.get("CHATTY_WORKER_MAX_ATTEMPTS", "5"))
    client = redis_asyncio.from_url(queue_url, decode_responses=True)
    worker = RedisStreamWorker(
        client,
        stream=stream,
        group=group,
        consumer=consumer,
        max_attempts=max_attempts,
        handlers={"webhook.deliver": _deliver},
    )
    await worker.ensure_group()
    logger.info("webhook worker started stream=%s group=%s consumer=%s", stream, group, consumer)
    try:
        while True:
            stats = await worker.run_once()
            if stats["received"]:
                logger.info("webhook worker batch=%s", stats)
    finally:
        await client.aclose()


def main() -> None:
    logging.basicConfig(level=os.environ.get("LOG_LEVEL", "INFO"))
    asyncio.run(run())


if __name__ == "__main__":  # pragma: no cover - exercised in deployment
    main()
