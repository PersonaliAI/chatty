"""Omnichannel human agent takeover and escalation bridge."""

from __future__ import annotations

import logging
import re
from typing import Any, Optional

from app.core.clients import supabase
from app.core.db import run_db

logger = logging.getLogger("chatty.omnichannel.escalation")

HANDOFF_TRIGGERS = re.compile(
    r"\b((?:talk|speak|chat|connect)\s+(?:to|with)\s+(?:a\s+)?(?:human|person|agent|team|someone|representative)|"
    r"live\s+agent|human\s+agent|human\s+support|real\s+person|customer\s+service|representative|"
    r"support\s+agent|operator|agent|escalate|"
    r"agent\s*kenek|human\s*kenek|support\s*kenek|kenek|katha\s*karanna|kathakaranna)\b|"
    r"(කෙනෙක්|කතා\s*කරන්න|නියෝජිත|කණ්ඩායම|මිනිසෙක්)",
    re.IGNORECASE,
)

FRUSTRATION_TRIGGERS = re.compile(
    r"\b(terrible|awful|horrible|useless|scam|lawyer|sue|cancel\s+my\s+account|"
    r"speak\s+to\s+(?:a\s+)?manager|unacceptable|furious|angry)\b",
    re.IGNORECASE,
)

AFFIRMATIVE_RESPONSES = re.compile(
    r"^(ow|oww|yes|yep|yeah|yup|ok|okay|sure|please|plz|of\s*course|definitely|certainly|"
    r"si|sí|claro|por\s*favor|vale|de\s*acuerdo|"
    r"oui|ouais|d'accord|volontiers|svp|"
    r"ja|gerne|bitte|natürlich|"
    r"sim|com\s*certeza|"
    r"certo|per\s*favore|"
    r"haan|ha|ji|theek|हाँ|जी|"
    r"aam|aama|sari|seri|ஆம்|சரி|"
    r"tamam|na'am|نعم|أجل|طبعا|حسنا|"
    r"да|конечно|"
    r"好|好的|是的|可以|"
    r"はい|お願い|"
    r"ya|boleh|bisa|oo|"
    r"ඔව්|හරි|කැමතියි|එහෙමයි|ehemai|hari|ow\s*kamathi|ow\s*kamathiyi)$",
    re.IGNORECASE,
)

TEAM_NOTIFIED_PATTERNS = re.compile(
    r"(notified\s+our\s+team|informed\s+our\s+team|passed\s+(?:this|your\s+details)\s+to\s+our\s+team|"
    r"team\s+will\s+(?:contact|reach\s+out\s+to)\s+you|connected\s+with\s+our\s+team|"
    r"agent\s+will\s+be\s+in\s+touch|support\s+team\s+will\s+contact|transferred\s+to\s+a\s+human|"
    r"කණ්ඩායමට\s+දැනුම්\s+දී|කණ්ඩායම\s+ඔබව\s+සම්බන්ධ|නියෝජිතයෙකු\s+සම්බන්ධ|දැනුම්\s+දී\s+තිබෙනවා)",
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


async def check_affirmative_handoff(bot_id: str, session_id: str, text: str) -> bool:
    """Check if the user responded affirmatively to an assistant offer to connect with human/team."""
    clean = (text or "").strip().lower()
    if not clean:
        return False

    # Check if affirmative
    is_affirmative = bool(AFFIRMATIVE_RESPONSES.match(clean)) or bool(
        re.match(r"^(ow|yes|yep|yeah|ok|okay|sure|please|si|sí|oui|ja|sim|haan|aam|tamam|ஆம்|சரி|ඔව්|හරි|කැමතියි|نعم|да|好|はい)\b", clean)
    )
    if not is_affirmative:
        return False

    try:
        last_msgs = await run_db(
            lambda: supabase.table("chatty_conversations")
            .select("role, content")
            .eq("bot_id", bot_id)
            .eq("session_id", session_id)
            .order("created_at", desc=True)
            .limit(4)
            .execute()
        )
        for msg in (last_msgs.data or []):
            if msg.get("role") == "assistant":
                content = (msg.get("content") or "").lower()
                handoff_prompts = [
                    "connect", "team", "human", "agent", "representative", "contact you",
                    "සම්බන්ධ", "කණ්ඩායම", "නියෝජිත", "කැමතිද", "would you like",
                    "do you like", "reach out",
                ]
                if any(p in content for p in handoff_prompts):
                    return True
                break
    except Exception:
        logger.debug("Failed to check recent conversation message for handoff prompt")
    return False


def is_team_handoff_promised(reply: str) -> bool:
    """Check if assistant reply confirms that human team has been notified."""
    if not reply:
        return False
    return bool(TEAM_NOTIFIED_PATTERNS.search(reply))


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


def get_handoff_acknowledgement(channel: Optional[Any] = None) -> str:
    """Standard empathetic acknowledgement sent to visitors when escalated."""
    channel_name = "chat"
    if channel is not None:
        ch_val = channel.value if hasattr(channel, "value") else str(channel).lower()
        if "telegram" in ch_val:
            channel_name = "Telegram"
        elif "whatsapp" in ch_val:
            channel_name = "WhatsApp"
        elif "instagram" in ch_val:
            channel_name = "Instagram"
        elif "messenger" in ch_val:
            channel_name = "Messenger"
        elif "sms" in ch_val:
            channel_name = "SMS"
        elif "email" in ch_val:
            channel_name = "email"

    return (
        "👤 *You are now connected with our support team.*\n\n"
        f"An agent has been notified and will reply directly here on {channel_name} shortly."
    )
