"""Pure runtime policy helpers for campaign delivery and telemetry."""

from __future__ import annotations

from datetime import datetime, timezone
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
    return True
