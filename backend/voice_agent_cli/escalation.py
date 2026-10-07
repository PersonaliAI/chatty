"""Voice adapter for Chatty's existing human-handoff rules."""

from __future__ import annotations

import logging

from .organization import OrganizationContext

logger = logging.getLogger("chatty.voice.escalation")


async def maybe_escalate(
    organization: OrganizationContext, session_id: str, text: str
) -> bool:
    """Mark a session for human attention when Chatty's rules detect it."""
    try:
        from app.services.widget_session_service import (
            detect_sentiment_escalation,
            needs_human,
        )

        reason = detect_sentiment_escalation(text)
        if not reason and not needs_human(text):
            return False
        reason = reason or "Visitor requested a human agent"
        await organization.modules.run_db(
            lambda: (
                organization.supabase.table("chatty_sessions")
                .update(
                    {
                        "needs_attention": True,
                        "escalation_reason": reason,
                    }
                )
                .eq("bot_id", organization.bot["id"])
                .eq("session_id", session_id)
                .execute()
            )
        )
        try:
            from app.services.slack_escalation import send_slack_escalation_alert

            await send_slack_escalation_alert(
                bot_id=organization.bot["id"],
                session_id=session_id,
                reason=reason,
                priority="high"
                if reason != "Visitor requested a human agent"
                else "normal",
                custom_message=text,
            )
        except Exception:
            logger.exception("Slack escalation delivery failed")
        return True
    except Exception:
        logger.exception("Voice escalation could not be recorded")
        return False
