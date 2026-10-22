"""Omnichannel human agent takeover and escalation bridge."""

from __future__ import annotations

import logging
import re
from typing import Any, Optional

from app.core.clients import supabase
from app.core.db import run_db

logger = logging.getLogger("chatty.omnichannel.escalation")

HANDOFF_TRIGGERS = re.compile(
    r"\b(talk\s+to\s+(?:a\s+)?human|live\s+agent|human\s+agent|speak\s+to\s+(?:a\s+)?person|"
    r"real\s+person|customer\s+service|representative|support\s+agent|operator|agent|escalate)\b",
    re.IGNORECASE,
)

FRUSTRATION_TRIGGERS = re.compile(
    r"\b(terrible|awful|horrible|useless|scam|lawyer|sue|cancel\s+my\s+account|"
    r"speak\s+to\s+(?:a\s+)?manager|unacceptable|furious|angry)\b",
    re.IGNORECASE,
)


def detect_human_handoff_request(text: str) -> tuple[bool, str, str]:
    """Inspect visitor text for handoff requests or high-frustration escalation.
    Returns (is_escalation, reason, priority).
    """
    clean = (text or "").strip()
    if not clean:
        return False, "", "normal"

    if clean.lower() == "talk to human" or HANDOFF_TRIGGERS.search(clean):
        return True, "Visitor requested human agent", "high"

    if FRUSTRATION_TRIGGERS.search(clean):
        return True, "Negative visitor sentiment detected", "urgent"

    return False, "", "normal"


def is_session_ai_paused(session_row: Optional[dict[str, Any]]) -> bool:
    """Check if session is currently assigned to a human or has AI paused."""
    if not session_row:
        return False
    return bool(session_row.get("ai_paused"))


async def apply_human_takeover(
    bot_id: str,
    session_id: str,
    reason: str,
    text: str,
    priority: str = "high",
    owner_user: Optional[dict[str, Any]] = None,
) -> bool:
    """Pause AI on session, mark needs_attention, and trigger team notifications."""
    try:
        upd = {
            "ai_paused": True,
            "needs_attention": True,
            "escalation_reason": reason,
            "priority": priority,
        }
        await run_db(
            lambda: supabase.table("chatty_sessions")
            .update(upd)
            .eq("bot_id", bot_id)
            .eq("session_id", session_id)
            .execute()
        )
    except Exception:
        logger.exception("Failed to update session with human takeover status")
        return False

    # Trigger Slack escalation if available
    try:
        from app.services.slack_escalation import send_slack_escalation_alert
        await send_slack_escalation_alert(
            bot_id=bot_id,
            session_id=session_id,
            reason=reason,
            priority=priority,
            custom_message=text,
        )
    except Exception:
        logger.debug("Slack escalation not configured or failed for bot %s", bot_id)

    return True


def get_handoff_acknowledgement() -> str:
    """Standard empathetic acknowledgement sent to visitors when escalated."""
    return (
        "👤 *You are now connected with our support team.*\n\n"
        "An agent has been notified and will reply directly here on WhatsApp shortly."
    )
