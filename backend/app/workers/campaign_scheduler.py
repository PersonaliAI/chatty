"""Durable campaign scheduler entry point.

Run this as a small periodic worker (or invoke ``schedule_campaigns_once`` from
an existing scheduler). It only enqueues due jobs; channel delivery remains in
the normal Redis worker and is therefore independently scalable/retryable.
"""

from __future__ import annotations

import asyncio
import logging
import os
from datetime import datetime, timezone
from typing import Any, Awaitable, Callable

from app.services.campaign_dispatch import build_campaign_dispatch_plan
from app.services.campaign_audience import load_consented_lead_recipients

logger = logging.getLogger("chatty.campaign_scheduler")
Claim = Callable[[str], Awaitable[bool]]


async def _enqueue_scheduled(queue: Any, job: dict[str, Any], key: str) -> bool:
    enqueue_once = getattr(queue, "enqueue_once", None)
    enqueue = enqueue_once if callable(enqueue_once) else queue.enqueue
    result = await enqueue(
        name=str(job["name"]),
        payload={**dict(job["payload"]), "delivery_idempotency_key": key},
        idempotency_key=key,
    )
    return result is not None if callable(enqueue_once) else True


async def schedule_campaigns_tick(*args: Any, **kwargs: Any) -> dict[str, int] | None:
    """Keep the periodic service alive after a transient tick failure.

    Cancellation propagates so shutdown remains prompt. Log only the exception
    class: database/provider exception text may contain contact information.
    """
    try:
        return await schedule_campaigns_once(*args, **kwargs)
    except Exception as exc:
        logger.error("campaign scheduler tick failed error_type=%s", type(exc).__name__)
        return None


async def _consented_lead_recipients(*args: Any, **kwargs: Any) -> list[dict[str, Any]]:
    """Compatibility wrapper for worker callers and existing integrations."""
    return await load_consented_lead_recipients(*args, **kwargs)


async def schedule_campaigns_once(
    supabase_client: Any,
    queue: Any,
    *,
    now: datetime | None = None,
    claim: Claim | None = None,
    limit: int = 100,
) -> dict[str, int]:
    """Plan and enqueue due campaign jobs with bounded work per tick."""
    if limit < 1 or limit > 500:
        raise ValueError("limit must be between 1 and 500")
    current = now or datetime.now(timezone.utc)
    result = await asyncio.to_thread(
        lambda: supabase_client.table("chatty_campaigns").select("*").eq("is_active", True).limit(limit).execute()
    )
    stats = {"campaigns": 0, "planned": 0, "enqueued": 0, "skipped": 0, "deferred": 0, "invalid": 0}
    for campaign in result.data or []:
        stats["campaigns"] += 1
        try:
            jobs = build_campaign_dispatch_plan(campaign, now=current)
        except ValueError:
            stats["invalid"] += 1
            logger.warning("skipping invalid campaign id=%s", campaign.get("id"))
            continue
        provider_jobs = [job for job in jobs if str((job.get("payload") or {}).get("channel") or "web").lower() != "web"]
        for job in jobs:
            stats["planned"] += 1
            # The periodic scheduler has no visitor/contact recipient. Web
            # steps are evaluated by the widget, while provider steps must be
            # dispatched by an audience/contact-aware trigger. Do not enqueue
            # an undeliverable job that would only churn retries and DLQ.
            payload = job.get("payload") if isinstance(job.get("payload"), dict) else {}
            channel = str(payload.get("channel") or "web").strip().lower()
            # Provider jobs are expanded below against the selected recipient
            # source. Never enqueue a recipient-less provider job first.
            if channel != "web":
                continue
            scheduled_at = datetime.fromisoformat(str(job["scheduled_at"]).replace("Z", "+00:00"))
            if scheduled_at > current:
                stats["skipped"] += 1
                continue
            key = str(job["idempotency_key"])
            if claim is not None and not await claim(key):
                stats["skipped"] += 1
                continue
            stats["enqueued" if await _enqueue_scheduled(queue, job, key) else "skipped"] += 1
        if not provider_jobs:
            continue
        rules = campaign.get("audience_rules") if isinstance(campaign.get("audience_rules"), dict) else {}
        if str(rules.get("recipient_source") or "widget").strip().lower() != "consented_leads":
            stats["deferred"] += len(provider_jobs)
            continue
        try:
            recipients = await _consented_lead_recipients(
                supabase_client,
                str(campaign.get("bot_id") or ""),
                audience_rules=rules,
            )
        except Exception as exc:
            # A transient audience/database failure must not abort the whole
            # scheduler tick. Fail closed for this campaign, leave the jobs
            # unqueued so a later tick can retry, and keep unrelated campaigns
            # moving. The warning is intentionally bounded to campaign IDs;
            # recipient data must never enter scheduler logs.
            stats["deferred"] += len(provider_jobs)
            logger.warning(
                "deferring campaign provider jobs after audience lookup failure campaign=%s error_type=%s",
                campaign.get("id"),
                type(exc).__name__,
            )
            continue
        if not recipients:
            stats["deferred"] += len(provider_jobs)
            continue
        for recipient in recipients:
            try:
                recipient_jobs = build_campaign_dispatch_plan(campaign, now=current, recipient=recipient)
            except ValueError:
                stats["invalid"] += 1
                continue
            for job in recipient_jobs:
                payload = job.get("payload") if isinstance(job.get("payload"), dict) else {}
                if str(payload.get("channel") or "web").strip().lower() == "web":
                    continue
                scheduled_at = datetime.fromisoformat(str(job["scheduled_at"]).replace("Z", "+00:00"))
                if scheduled_at > current:
                    stats["skipped"] += 1
                    continue
                key = str(job["idempotency_key"])
                if claim is not None and not await claim(key):
                    stats["skipped"] += 1
                    continue
                stats["enqueued" if await _enqueue_scheduled(queue, job, key) else "skipped"] += 1
    return stats


async def run() -> None:  # pragma: no cover - deployment entry point
    queue_url = os.environ.get("CHATTY_JOB_QUEUE_URL", "").strip()
    if not queue_url:
        raise RuntimeError("CHATTY_JOB_QUEUE_URL is required for the campaign scheduler")
    try:
        from redis import asyncio as redis_asyncio
        from app.core.clients import supabase
        from app.adapters.redis_jobs import RedisJobQueue
    except ImportError as exc:
        raise RuntimeError("campaign scheduler dependencies are unavailable") from exc
    client = redis_asyncio.from_url(queue_url, decode_responses=True)
    queue = RedisJobQueue(queue_url, stream="chatty:webhooks", client=client)

    try:
        while True:
            stats = await schedule_campaigns_tick(supabase, queue)
            if stats and stats["planned"]:
                logger.info("campaign scheduler tick=%s", stats)
            await asyncio.sleep(float(os.environ.get("CHATTY_CAMPAIGN_SCHEDULER_INTERVAL", "30")))
    finally:
        await client.aclose()


def main() -> None:  # pragma: no cover - deployment entry point
    logging.basicConfig(level=os.environ.get("LOG_LEVEL", "INFO"))
    asyncio.run(run())


if __name__ == "__main__":
    main()
