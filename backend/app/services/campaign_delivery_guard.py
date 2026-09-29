"""Atomic safeguards for provider-backed campaign delivery."""

from __future__ import annotations

import hashlib
from typing import Any


def campaign_recipient_identity(recipient: dict[str, Any] | None) -> str:
    """Return a stable, privacy-safe identity seed for a delivery target."""
    values = recipient if isinstance(recipient, dict) else {}
    for field in ("email", "phone", "whatsapp", "id", "session_id"):
        value = str(values.get(field) or "").strip().casefold()
        if value:
            return value
    return ""


async def claim_campaign_frequency_cap(redis_client: Any, payload: dict[str, Any]) -> tuple[bool, str | None]:
    """Claim the provider delivery window once, using Redis SET NX EX.

    The Redis key contains only hashes, never recipient details. A false return
    is an intentional suppression rather than a delivery failure, so a worker
    will not retry a campaign simply because its configured cap was reached.
    """
    recipient = payload.get("recipient") if isinstance(payload.get("recipient"), dict) else {}
    identity = campaign_recipient_identity(recipient)
    campaign_id = str(payload.get("campaign_id") or "").strip()
    if not identity or not campaign_id:
        return True, None
    try:
        hours = max(1, min(8_760, int(payload.get("frequency_cap_hours", 24))))
    except (TypeError, ValueError):
        hours = 24
    seed = f"{campaign_id}:{identity}".encode("utf-8")
    key = f"chatty:campaign:frequency:{hashlib.sha256(seed).hexdigest()}"
    claimed = await redis_client.set(key, "1", nx=True, ex=hours * 3600)
    return bool(claimed), key
