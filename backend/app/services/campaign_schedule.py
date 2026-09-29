"""Deterministic campaign cadence calculations shared by workers and APIs."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any
from zoneinfo import ZoneInfo


def next_campaign_run_at(campaign: dict[str, Any], now: datetime | None = None) -> datetime | None:
    config = campaign.get("schedule_config") or {}
    cadence = str(config.get("cadence", "once")).strip().lower()
    if cadence not in {"once", "hourly", "daily", "weekly"}:
        return None
    try:
        zone = ZoneInfo(str(config.get("timezone", "UTC")))
    except Exception:
        return None
    current = (now or datetime.now(timezone.utc)).astimezone(zone)
    raw_anchor = campaign.get("start_date") or campaign.get("created_at")
    if not raw_anchor:
        return None
    try:
        anchor = datetime.fromisoformat(str(raw_anchor).replace("Z", "+00:00"))
    except ValueError:
        return None
    if anchor.tzinfo is None:
        anchor = anchor.replace(tzinfo=timezone.utc)
    anchor = anchor.astimezone(zone)
    if cadence == "once":
        candidate = anchor
    else:
        interval = {"hourly": timedelta(hours=1), "daily": timedelta(days=1), "weekly": timedelta(days=7)}[cadence]
        if anchor > current:
            candidate = anchor
        else:
            elapsed = current - anchor
            periods = int(elapsed.total_seconds() // interval.total_seconds()) + 1
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
