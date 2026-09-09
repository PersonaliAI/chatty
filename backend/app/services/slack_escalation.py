"""Interactive Slack Escalation Service.
Sends formatted Slack Block Kit alert messages when a ticket is escalated
(negative sentiment, human handoff request, or SLA risk).
"""

from __future__ import annotations

import logging
import os
from typing import Any, Optional

import httpx

from app.core.clients import supabase
from app.core.db import run_db

logger = logging.getLogger("chatty.slack_escalation")

FRONTEND_URL = os.environ.get("FRONTEND_URL", "https://app.chatty.com").rstrip("/")


async def send_slack_escalation_alert(
    bot_id: str,
    session_id: str,
    reason: str,
    priority: str = "urgent",
    custom_message: Optional[str] = None,
) -> dict[str, Any]:
    """Dispatches a rich Block Kit alert to the bot's configured Slack Escalation Webhook."""
    try:
        # 1. Fetch bot details
        bot_res = await run_db(lambda: supabase.table("chatty_bots")
            .select("id, name, slack_escalation_webhook_url, webhook_url")
            .eq("id", bot_id)
            .limit(1)
            .execute())
        if not bot_res.data:
            return {"sent": False, "reason": "bot_not_found"}

        bot = bot_res.data[0]
        webhook_url = bot.get("slack_escalation_webhook_url") or bot.get("webhook_url")

        # If not on bot directly, check chatty_webhooks for a slack url
        if not webhook_url:
            wh_res = await run_db(lambda: supabase.table("chatty_webhooks")
                .select("url")
                .eq("bot_id", bot_id)
                .eq("active", True)
                .execute())
            for wh in (wh_res.data or []):
                u = wh.get("url", "")
                if "hooks.slack.com" in u:
                    webhook_url = u
                    break

        if not webhook_url or "hooks.slack.com" not in webhook_url:
            logger.info("Slack escalation: no slack webhook configured for bot %s", bot_id)
            return {"sent": False, "reason": "no_slack_webhook"}

        # 2. Fetch session details
        sess_res = await run_db(lambda: supabase.table("chatty_sessions")
            .select("session_id, visitor_name, visitor_email, channel, subject, priority, last_message")
            .eq("bot_id", bot_id)
            .eq("session_id", session_id)
            .limit(1)
            .execute())
        session = sess_res.data[0] if sess_res.data else {}

        bot_name = bot.get("name") or "Chatty Bot"
        visitor_name = session.get("visitor_name") or "Visitor"
        visitor_email = session.get("visitor_email") or "Not provided"
        channel = (session.get("channel") or "web").lower()
        channel_label = "✉️ Email Ticket" if channel == "email" else "🌐 Live Chat"
        priority_str = (session.get("priority") or priority).upper()
        p_badge = "🚨 URGENT" if priority_str == "URGENT" else "⚠️ HIGH"
        last_msg = (custom_message or session.get("last_message") or "Visitor requested human assistance.")[:300]
        ticket_subject = session.get("subject") or f"Conversation with {visitor_name}"

        inbox_link = f"{FRONTEND_URL}/dashboard?tab=inbox&session_id={session_id}"

        # 3. Construct Slack Block Kit Payload
        payload = {
            "text": f"🚨 *{p_badge} Ticket Escalation* for {bot_name}: #{session_id[:8]}",
            "blocks": [
                {
                    "type": "header",
                    "text": {
                        "type": "plain_text",
                        "text": f"🚨 Ticket Escalated ({p_badge})",
                        "emoji": True,
                    },
                },
                {
                    "type": "section",
                    "fields": [
                        {"type": "mrkdwn", "text": f"*Bot:*\n{bot_name}"},
                        {"type": "mrkdwn", "text": f"*Ticket ID:*\n`#{session_id[:8]}`"},
                        {"type": "mrkdwn", "text": f"*Channel:*\n{channel_label}"},
                        {"type": "mrkdwn", "text": f"*Priority:*\n*{p_badge}*"},
                    ],
                },
                {
                    "type": "section",
                    "fields": [
                        {"type": "mrkdwn", "text": f"*Customer:*\n{visitor_name}"},
                        {"type": "mrkdwn", "text": f"*Email:*\n{visitor_email}"},
                    ],
                },
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": f"*Escalation Reason:*\n> {reason}\n*Last Message:*\n> _{last_msg}_",
                    },
                },
                {
                    "type": "actions",
                    "elements": [
                        {
                            "type": "button",
                            "text": {
                                "type": "plain_text",
                                "text": "👉 Open in Chatty Inbox",
                                "emoji": True,
                            },
                            "style": "primary",
                            "url": inbox_link,
                        },
                    ],
                },
                {
                    "type": "context",
                    "elements": [
                        {
                            "type": "mrkdwn",
                            "text": f"Subject: *{ticket_subject}* • Powered by Chatty Enterprise Helpdesk",
                        },
                    ],
                },
            ],
        }

        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(webhook_url, json=payload)
            if resp.status_code == 200:
                logger.info("Successfully posted Slack escalation alert for session %s", session_id)
                return {"sent": True, "status_code": 200}
            else:
                logger.warning("Slack webhook returned error %d: %s", resp.status_code, resp.text)
                return {"sent": False, "status_code": resp.status_code, "error": resp.text}

    except Exception as e:
        logger.exception("Failed to send Slack escalation alert: %s", e)
        return {"sent": False, "error": str(e)}
