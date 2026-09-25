"""Durable widget ticket side-effect handlers."""

from __future__ import annotations

import asyncio


async def process_ticket_escalation(payload: dict) -> None:
    """Dispatch a persisted widget ticket and optionally notify Slack."""
    from app.routers.admin import _dispatch_ticket_to_agent

    bot_id = str(payload.get("bot_id") or "").strip()
    session_id = str(payload.get("session_id") or "").strip()
    if not bot_id or not session_id:
        raise ValueError("widget ticket escalation job is missing bot_id or session_id")

    result = await _dispatch_ticket_to_agent(bot_id, session_id)
    if not isinstance(result, dict):
        raise RuntimeError("ticket dispatch returned an invalid result")

    custom_message = payload.get("custom_message")
    if custom_message:
        from app.services.slack_escalation import send_slack_escalation_alert

        result = await send_slack_escalation_alert(
            bot_id,
            session_id,
            str(payload.get("reason") or "Widget Ticket Escalation"),
            str(payload.get("priority") or "high"),
            str(custom_message),
        )
        if isinstance(result, dict) and result.get("error"):
            raise RuntimeError(result["error"])


async def process_unanswered(payload: dict) -> None:
    """Persist a knowledge gap outside the request lifecycle."""
    from app.services.widget_session_service import log_unanswered_if_needed

    bot_id = str(payload.get("bot_id") or "").strip()
    session_id = str(payload.get("session_id") or "").strip()
    question = str(payload.get("question") or "")
    reply = str(payload.get("reply") or "")
    if not bot_id or not session_id or not question or not reply:
        raise ValueError("widget unanswered job is missing required fields")
    await asyncio.to_thread(log_unanswered_if_needed, bot_id, session_id, question, reply)
