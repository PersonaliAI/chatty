"""Pure, explainable campaign audience evaluation."""

from __future__ import annotations

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
