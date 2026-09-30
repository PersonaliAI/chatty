"""Pure, explainable campaign audience evaluation."""

from __future__ import annotations

import asyncio
from typing import Any


def campaign_audience_matches(
    rules: dict[str, Any] | None,
    *,
    returning: bool = False,
    intent_score: int = 0,
) -> bool:
    """Evaluate the bounded audience contract used by public widget campaigns.

    Signals are deliberately coarse and non-sensitive. The browser supplies
    only whether it has a prior local conversation and a bounded interaction
    score; all rule interpretation remains server-side and fails closed.
    """
    config = rules if isinstance(rules, dict) else {}
    segment = str(config.get("segment") or "all").strip().lower()
    if segment not in {"all", "returning", "high_intent"}:
        return False
    if bool(config.get("returning_only")) and not returning:
        return False
    if segment == "returning" and not returning:
        return False
    try:
        minimum = max(0, min(100, int(config.get("min_intent_score", 0))))
    except (TypeError, ValueError):
        return False
    try:
        score = max(0, min(100, int(intent_score)))
    except (TypeError, ValueError):
        return False
    return score >= minimum and (segment != "high_intent" or score >= 60)


def campaign_lead_matches(rules: dict[str, Any] | None, lead: dict[str, Any] | None) -> bool:
    """Apply the same audience contract to an opted-in provider lead.

    Provider delivery has no browser request from which to obtain live signals.
    The lead record may carry bounded qualification signals in first-class
    fields or ``custom_fields`` (for example from an AI qualification step).
    Missing signals fail closed for returning/high-intent segments, while an
    ``all`` segment remains eligible after the separate consent check.
    """
    row = lead if isinstance(lead, dict) else {}
    custom = row.get("custom_fields") if isinstance(row.get("custom_fields"), dict) else {}
    # Qualification integrations can supply malformed strings ("false" is
    # truthy in Python). Never turn those into a positive targeting signal.
    returning = row.get("returning") is True or custom.get("returning") is True
    raw_score = row.get("intent_score", custom.get("intent_score", 0))
    try:
        intent_score = max(0, min(100, int(raw_score or 0)))
    except (TypeError, ValueError):
        intent_score = 0
    return campaign_audience_matches(rules, returning=returning, intent_score=intent_score)


async def load_consented_lead_recipients(
    supabase_client: Any,
    bot_id: str,
    *,
    audience_rules: dict[str, Any] | None = None,
    limit: int = 100,
) -> list[dict[str, Any]]:
    """Load the bounded, opted-in audience shared by preview and workers."""
    if limit < 1 or limit > 500:
        raise ValueError("limit must be between 1 and 500")
    result = await asyncio.to_thread(
        lambda: supabase_client.table("chatty_leads").select(
            "id,email,phone,marketing_consent,custom_fields"
        ).eq("bot_id", bot_id).eq("marketing_consent", True).limit(limit).execute()
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
