"""Best-effort durable state for provider campaign deliveries."""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
import re
from typing import Any

_STATUSES = {"queued", "sent", "failed", "suppressed"}
_EMAIL_RE = re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.IGNORECASE)
_PHONE_RE = re.compile(r"(?<!\w)\+\d[\d\s().-]{7,}\d(?!\w)")
_SECRET_RE = re.compile(
    r"(?i)\b(?:token|secret|api[_-]?key|authorization|password)\s*[=:]\s*[^\s,;]+"
)


def sanitize_campaign_error(error: object | None) -> str | None:
    """Keep durable delivery diagnostics useful without persisting recipient secrets."""
    text = str(error or "").strip()
    if not text:
        return None
    text = _SECRET_RE.sub(lambda match: match.group(0).split("=")[0].split(":")[0] + "=[redacted]", text)
    text = _EMAIL_RE.sub("[redacted-email]", text)
    text = _PHONE_RE.sub("[redacted-phone]", text)
    return text[:500] or None


async def record_campaign_delivery(
    supabase_client: Any,
    payload: dict[str, Any],
    status: str,
    *,
    error: str | None = None,
) -> None:
    """Upsert one bounded delivery state; callers must not fail a send on ledger errors."""
    status = str(status).strip().lower()
    if status not in _STATUSES:
        raise ValueError("invalid campaign delivery status")
    bot_id = str(payload.get("bot_id") or "").strip()
    campaign_id = str(payload.get("campaign_id") or "").strip()
    key = str(payload.get("delivery_idempotency_key") or "").strip()[:200]
    if not bot_id or not campaign_id or not key:
        return
    recipient = payload.get("recipient") if isinstance(payload.get("recipient"), dict) else {}
    row = {
        "bot_id": bot_id,
        "campaign_id": campaign_id,
        "idempotency_key": key,
        "status": status,
        "channel": str(payload.get("channel") or "web").strip().lower()[:32],
        "recipient_id": str(recipient.get("id") or "").strip()[:128] or None,
        "error": sanitize_campaign_error(error),
        "metadata": {"frequency_cap_hours": payload.get("frequency_cap_hours")},
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    if status == "sent":
        row["sent_at"] = datetime.now(timezone.utc).isoformat()
    await asyncio.to_thread(
        lambda: supabase_client.table("chatty_campaign_deliveries").upsert(
            row, on_conflict="bot_id,idempotency_key"
        ).execute()
    )
