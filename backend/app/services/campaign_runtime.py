"""Pure runtime policy helpers for campaign delivery and telemetry."""

from __future__ import annotations

from datetime import datetime, time, timezone
from zoneinfo import ZoneInfo
from typing import Any


def campaign_is_active_now(campaign: dict[str, Any], now: datetime | None = None) -> bool:
    """Fail closed when a campaign is disabled or outside its date window."""
    if campaign.get("is_active") is not True:
        return False
    current = now or datetime.now(timezone.utc)
    for field, lower_bound in (("start_date", "start"), ("end_date", "end")):
        raw = campaign.get(field)
        if not raw:
            continue
        try:
            parsed = datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=timezone.utc)
            parsed = parsed.astimezone(timezone.utc)
        except (TypeError, ValueError):
            return False
        if lower_bound == "start" and current < parsed:
            return False
        if lower_bound == "end" and current >= parsed:
            return False
    safety = campaign.get("safety_config") or {}
    quiet = safety.get("quiet_hours") if isinstance(safety, dict) else None
    if quiet is None:
        return True
    if not isinstance(quiet, dict):
        return False
    try:
        start = time.fromisoformat(str(quiet.get("start", "22:00")))
        end = time.fromisoformat(str(quiet.get("end", "08:00")))
        zone = ZoneInfo(str((campaign.get("schedule_config") or {}).get("timezone", "UTC")))
    except (TypeError, ValueError):
        return False
    local_now = current.astimezone(zone).time().replace(tzinfo=None)
    start_value = start.replace(tzinfo=None)
    end_value = end.replace(tzinfo=None)
    if start_value == end_value:
        return False
    in_quiet = (start_value <= local_now < end_value) if start_value < end_value else (local_now >= start_value or local_now < end_value)
    return not in_quiet
