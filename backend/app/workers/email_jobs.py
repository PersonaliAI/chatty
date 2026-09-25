"""Durable inbound-email ticket side-effect handlers."""

from __future__ import annotations


async def process_ticket_escalation(payload: dict) -> None:
    """Dispatch a persisted email ticket and optionally notify Slack."""
    from app.routers.admin import _dispatch_ticket_to_agent

    bot_id = str(payload.get("bot_id") or "").strip()
    session_id = str(payload.get("session_id") or "").strip()
    if not bot_id or not session_id:
        raise ValueError("email ticket escalation job is missing bot_id or session_id")

    if payload.get("dispatch", True):
        result = await _dispatch_ticket_to_agent(bot_id, session_id)
        if not isinstance(result, dict):
            raise RuntimeError("ticket dispatch returned an invalid result")

    # custom_message is only present for an urgent escalation, so ordinary
    # inbound tickets do not generate Slack noise.
    custom_message = payload.get("custom_message")
    if custom_message:
        from app.services.slack_escalation import send_slack_escalation_alert

        result = await send_slack_escalation_alert(
            bot_id,
            session_id,
            str(payload.get("reason") or "Inbound Email Escalation"),
            str(payload.get("priority") or "urgent"),
            str(custom_message),
        )
        if isinstance(result, dict) and result.get("error"):
            raise RuntimeError(result["error"])
