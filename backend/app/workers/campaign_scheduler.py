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
from app.services.campaign_audience import campaign_lead_matches

logger = logging.getLogger("chatty.campaign_scheduler")
Claim = Callable[[str], Awaitable[bool]]


async def _consented_lead_recipients(
    supabase_client: Any,
    bot_id: str,
    *,
    audience_rules: dict[str, Any] | None = None,
    limit: int = 100,
) -> list[dict[str, Any]]:
    """Load the only scheduler-owned provider audience: consented leads.

    Campaign workers must never infer marketing consent from contact presence.
    A migration adds ``marketing_consent`` with a false default, keeping older
    captured contacts excluded until a user has explicitly opted in.
    """
    result = await asyncio.to_thread(
        lambda: supabase_client.table("chatty_leads").select("id,email,phone,marketing_consent,custom_fields").eq(
            "bot_id", bot_id).eq("marketing_consent", True).limit(limit).execute()
    )
    recipients: list[dict[str, Any]] = []
    for lead in result.data or []:
        if not isinstance(lead, dict) or not lead.get("marketing_consent"):
            continue
        if not campaign_lead_matches(audience_rules, lead):
            continue
        recipients.append({
            "id": str(lead.get("id") or ""),
            "email": str(lead.get("email") or "").strip(),
            "phone": str(lead.get("phone") or "").strip(),
            "consent": True,
        })
    return recipients


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
            await queue.enqueue(
                name=str(job["name"]),
                payload=dict(job["payload"]),
                idempotency_key=key,
            )
            stats["enqueued"] += 1
        if not provider_jobs:
            continue
        rules = campaign.get("audience_rules") if isinstance(campaign.get("audience_rules"), dict) else {}
        if str(rules.get("recipient_source") or "widget").strip().lower() != "consented_leads":
            stats["deferred"] += len(provider_jobs)
            continue
        recipients = await _consented_lead_recipients(
            supabase_client,
            str(campaign.get("bot_id") or ""),
            audience_rules=rules,
        )
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
                await queue.enqueue(
                    name=str(job["name"]),
                    payload=dict(payload),
                    idempotency_key=key,
                )
                stats["enqueued"] += 1
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
    queue = RedisJobQueue(queue_url, stream="chatty:webhooks")
    client = redis_asyncio.from_url(queue_url, decode_responses=True)

    async def claim(key: str) -> bool:
        return bool(await client.set(f"chatty:campaign:scheduled:{key}", "1", nx=True, ex=86_400))

    try:
        while True:
            stats = await schedule_campaigns_once(supabase, queue, claim=claim)
            if stats["planned"]:
                logger.info("campaign scheduler tick=%s", stats)
            await asyncio.sleep(float(os.environ.get("CHATTY_CAMPAIGN_SCHEDULER_INTERVAL", "30")))
    finally:
        await client.aclose()


def main() -> None:  # pragma: no cover - deployment entry point
    logging.basicConfig(level=os.environ.get("LOG_LEVEL", "INFO"))
    asyncio.run(run())


if __name__ == "__main__":
    main()
