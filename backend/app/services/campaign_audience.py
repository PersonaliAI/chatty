"""Pure, explainable campaign audience evaluation."""

from __future__ import annotations

import asyncio
from typing import Any


def campaign_audience_matches(
    rules: dict[str, Any] | None,
    *,
    returning: bool = False,
    intent_score: int = 0,
    tags: list[str] | None = None,
    locale: str | None = None,
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
    if score < minimum or (segment == "high_intent" and score < 60):
        return False
    normalized_tags = {str(tag).strip().lower() for tag in (tags or []) if str(tag).strip()}
    any_tags = {str(tag).strip().lower() for tag in config.get("tags_any", []) if str(tag).strip()}
    all_tags = {str(tag).strip().lower() for tag in config.get("tags_all", []) if str(tag).strip()}
    if any_tags and not normalized_tags.intersection(any_tags):
        return False
    if all_tags and not all_tags.issubset(normalized_tags):
        return False
    required_locale = str(config.get("locale") or "").strip().lower()
    if required_locale and str(locale or "").strip().lower() != required_locale:
        return False
    return True


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
    raw_tags = row.get("tags", custom.get("tags", []))
    if isinstance(raw_tags, str):
        raw_tags = [raw_tags]
    tags = raw_tags if isinstance(raw_tags, list) else []
    return campaign_audience_matches(
        rules,
        returning=returning,
        intent_score=intent_score,
        tags=tags,
        locale=str(row.get("locale", custom.get("locale", "")) or ""),
    )


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
    def load_rows() -> Any:
        query = supabase_client.table("chatty_leads").select(
            "id,email,phone,marketing_consent,custom_fields"
        ).eq("bot_id", bot_id).eq("marketing_consent", True)
        order = getattr(query, "order", None)
        if callable(order):
            try:
                query = order("created_at", desc=False).order("id", desc=False)
            except (AttributeError, TypeError):
                pass
        return query.limit(limit).execute()

    result = await asyncio.to_thread(load_rows)
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
