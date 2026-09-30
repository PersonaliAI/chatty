"""Deterministic campaign sequence planning.

The planner is deliberately side-effect free. It turns one campaign
occurrence into bounded, idempotent channel jobs so a worker or an operator
can enqueue them without duplicating deliveries during retries.
"""

from __future__ import annotations

import hashlib
from datetime import datetime, timedelta, timezone
from typing import Any
from zoneinfo import ZoneInfo

from app.services.campaign_runtime import campaign_is_active_now
from app.services.campaign_delivery_guard import campaign_recipient_identity

_CHANNELS = {"web", "email", "whatsapp", "sms"}


def campaign_occurrence_at(campaign: dict[str, Any], now: datetime | None = None) -> datetime | None:
    """Return the latest cadence occurrence at or before ``now``."""
    config = campaign.get("schedule_config") or {}
    cadence = str(config.get("cadence", "once")).strip().lower()
    if cadence not in {"once", "hourly", "daily", "weekly"}:
        return None
    try:
        zone = ZoneInfo(str(config.get("timezone", "UTC")))
        anchor = datetime.fromisoformat(str(campaign.get("start_date") or campaign.get("created_at")).replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return None
    if anchor.tzinfo is None:
        anchor = anchor.replace(tzinfo=timezone.utc)
    anchor = anchor.astimezone(zone)
    current = (now or datetime.now(timezone.utc)).astimezone(zone)
    if anchor > current:
        return None
    if cadence == "once":
        candidate = anchor
    else:
        interval = {"hourly": timedelta(hours=1), "daily": timedelta(days=1), "weekly": timedelta(days=7)}[cadence]
        periods = int((current - anchor).total_seconds() // interval.total_seconds())
        candidate = anchor + periods * interval
    raw_end = campaign.get("end_date")
    if raw_end:
        try:
            end = datetime.fromisoformat(str(raw_end).replace("Z", "+00:00"))
            if end.tzinfo is None:
                end = end.replace(tzinfo=timezone.utc)
            if candidate >= end.astimezone(zone):
                return None
        except ValueError:
            return None
    return candidate.astimezone(timezone.utc)


def build_campaign_dispatch_plan(
    campaign: dict[str, Any],
    *,
    now: datetime | None = None,
    recipient: dict[str, Any] | None = None,
    due_steps: bool = False,
) -> list[dict[str, Any]]:
    """Build bounded sequence jobs with stable idempotency keys.

    Jobs carry consent and frequency-cap policy as data. A channel worker must
    enforce those fields before sending; unsupported channels are rejected
    rather than silently downgraded.
    """
    current = now or datetime.now(timezone.utc)
    if not campaign_is_active_now(campaign, current):
        return []
    occurrence = campaign_occurrence_at(campaign, current)
    if occurrence is None:
        return []
    raw_steps = campaign.get("sequence_steps") or []
    steps = raw_steps if isinstance(raw_steps, list) and raw_steps else [{"channel": "web", "after_minutes": 0, "message": campaign.get("message", "")}]
    if len(steps) > 20:
        raise ValueError("campaign sequence exceeds the 20-step limit")
    safety = campaign.get("safety_config") or {}
    schedule_config = campaign.get("schedule_config") or {}
    try:
        frequency_cap_hours = max(1, min(8_760, int(safety.get("frequency_cap_hours", 24))))
    except (TypeError, ValueError) as exc:
        raise ValueError("invalid campaign frequency cap") from exc
    requires_consent = bool(safety.get("require_consent", True))
    jobs: list[dict[str, Any]] = []
    campaign_id = str(campaign.get("id") or "").strip()
    bot_id = str(campaign.get("bot_id") or "").strip()
    if not campaign_id or not bot_id:
        raise ValueError("campaign id and bot id are required")
    for index, raw_step in enumerate(steps):
        if not isinstance(raw_step, dict):
            raise ValueError("campaign sequence steps must be objects")
        channel = str(raw_step.get("channel") or "web").strip().lower()
        if channel not in _CHANNELS:
            raise ValueError(f"unsupported campaign channel: {channel}")
        try:
            delay_minutes = int(raw_step.get("after_minutes", 0))
        except (TypeError, ValueError) as exc:
            raise ValueError("sequence delay must be an integer") from exc
        if delay_minutes < 0 or delay_minutes > 43_200:
            raise ValueError("sequence delay must be between 0 and 43200 minutes")
        step_occurrence = occurrence
        if due_steps:
            # Find the occurrence whose delayed step is due, not simply the
            # newest campaign occurrence. Otherwise a 90-minute step in an
            # hourly campaign is perpetually planned in the future.
            step_occurrence = campaign_occurrence_at(campaign, current - timedelta(minutes=delay_minutes))
            if step_occurrence is None:
                continue
        scheduled_at = step_occurrence + timedelta(minutes=delay_minutes)
        recipient_id = str((recipient or {}).get("id") or "").strip() or campaign_recipient_identity(recipient)
        recipient_seed = hashlib.sha256(recipient_id.encode()).hexdigest()[:16] if recipient_id else "broadcast"
        seed = f"{campaign_id}:{step_occurrence.isoformat()}:{index}:{channel}:{recipient_seed}"
        jobs.append({
            "name": "campaign.dispatch",
            "idempotency_key": f"campaign.dispatch:{hashlib.sha256(seed.encode()).hexdigest()[:32]}",
            "scheduled_at": scheduled_at.isoformat(),
            "payload": {
                "bot_id": bot_id,
                "campaign_id": campaign_id,
                "step_index": index,
                "channel": channel,
                "message": str(raw_step.get("message") or campaign.get("message") or "")[:4000],
                "recipient": recipient or {},
                "requires_consent": requires_consent,
                "frequency_cap_hours": frequency_cap_hours,
                "quiet_hours": safety.get("quiet_hours"),
                "timezone": str(schedule_config.get("timezone", "UTC")),
            },
        })
    return jobs
