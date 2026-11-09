"""Interactive Slack Integration & Escalation Service.

Provides:
- Canonical Slack Incoming Webhook validation (`https://hooks.slack.com/services/...`).
- Rich Slack Block Kit alert messages when a ticket is escalated (negative sentiment,
  human handoff request, or SLA risk) with interactive 1-click Take Over & Resolve buttons.
- 1-Click Test Alert dispatcher for dashboard verification.
- Flow Builder (`action.slack`) and Webhook Event (`lead.created`, `meeting.booked`, etc.)
  Block Kit message formatting.
- Cryptographic Slack Request Signature verification (`X-Slack-Signature` `v0=HMAC-SHA256`).
- Slack Events API (`url_verification`, `message`, `app_mention`) and Interactive Actions
  (`block_actions` for 1-click Take Over & Resolve directly from Slack).
"""

from __future__ import annotations

from datetime import datetime, timezone
import hashlib
import hmac
import json
import logging
import os
import time
from typing import Any, Optional
from urllib.parse import urlsplit

import httpx

from app.core import ssrf
from app.core.clients import supabase
from app.core.db import run_db

logger = logging.getLogger("chatty.slack_escalation")

FRONTEND_URL = (
    os.environ.get("CHATTY_FRONTEND_URL")
    or os.environ.get("FRONTEND_URL")
    or "https://chatty.personaliai.com"
).rstrip("/")

_CHANNEL_LABELS: dict[str, str] = {
    "web": "🌐 Live Chat",
    "email": "✉️ Email Ticket",
    "whatsapp": "💬 WhatsApp",
    "instagram": "📸 Instagram DM",
    "messenger": "💙 Messenger",
    "telegram": "✈️ Telegram",
    "tiktok": "🎵 TikTok",
    "sms": "📱 SMS",
    "slack": "🟣 Slack",
    "voice": "🎙️ Voice Agent",
}


def _is_slack_webhook_url(value: Any) -> bool:
    """Accept only canonical HTTPS Slack incoming-webhook URLs."""
    if not isinstance(value, str) or len(value) > 2048:
        return False
    try:
        parsed = urlsplit(value.strip())
    except ValueError:
        return False
    return (
        parsed.scheme == "https"
        and parsed.hostname in {"hooks.slack.com", "hooks.slack-gov.com"}
        and parsed.path.startswith("/services/")
        and not parsed.username
        and not parsed.password
        and not parsed.fragment
    )


def verify_slack_signature(
    signing_secret: str,
    timestamp: str,
    raw_body: bytes,
    signature: str,
    *,
    max_age_seconds: int = 300,
) -> bool:
    """Verify Slack request signature (`v0=HMAC-SHA256(signing_secret, f"v0:{timestamp}:{raw_body}")`)."""
    secret = (signing_secret or "").strip()
    ts_str = (timestamp or "").strip()
    sig_str = (signature or "").strip()
    if not secret or not ts_str or not sig_str or not sig_str.startswith("v0="):
        return False
    try:
        ts_int = int(ts_str)
    except ValueError:
        return False
    if abs(int(time.time()) - ts_int) > max_age_seconds:
        return False
    basestring = b"v0:" + ts_str.encode("utf-8") + b":" + (raw_body or b"")
    expected = "v0=" + hmac.new(secret.encode("utf-8"), basestring, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, sig_str)


async def resolve_bot_slack_webhook(bot_id: str) -> tuple[Optional[dict[str, Any]], Optional[str]]:
    """Resolve the bot record and its active Slack Incoming Webhook URL."""
    bot_res = await run_db(
        lambda: supabase.table("chatty_bots")
        .select("id, name, slack_escalation_webhook_url, webhook_url, whatsapp_quick_replies")
        .eq("id", bot_id)
        .limit(1)
        .execute()
    )
    if not bot_res or not bot_res.data:
        return None, None

    bot = dict(bot_res.data[0])
    webhook_url = str(bot.get("slack_escalation_webhook_url") or "").strip()
    if not _is_slack_webhook_url(webhook_url):
        fallback_bot_wh = str(bot.get("webhook_url") or "").strip()
        webhook_url = fallback_bot_wh if _is_slack_webhook_url(fallback_bot_wh) else ""

    if not webhook_url:
        wh_res = await run_db(
            lambda: supabase.table("chatty_webhooks")
            .select("url")
            .eq("bot_id", bot_id)
            .eq("active", True)
            .execute()
        )
        for wh in (wh_res.data or []):
            u = str(wh.get("url") or "").strip()
            if _is_slack_webhook_url(u):
                webhook_url = u
                break

    return bot, (webhook_url if _is_slack_webhook_url(webhook_url) else None)


async def send_slack_escalation_alert(
    bot_id: str,
    session_id: str,
    reason: str,
    priority: str = "urgent",
    custom_message: Optional[str] = None,
    *,
    channel: Optional[str] = None,
    visitor_name: Optional[str] = None,
    visitor_email: Optional[str] = None,
    latest_message: Optional[str] = None,
) -> dict[str, Any]:
    """Dispatches a rich Block Kit alert to the bot's configured Slack Escalation Webhook."""
    try:
        bot, webhook_url = await resolve_bot_slack_webhook(bot_id)
        if not bot:
            return {"sent": False, "reason": "bot_not_found"}

        if not webhook_url or not _is_slack_webhook_url(webhook_url):
            logger.info("Slack escalation: no slack webhook configured for bot %s", bot_id)
            return {"sent": False, "reason": "no_slack_webhook"}

        # 2. Fetch session details
        session: dict[str, Any] = {}
        try:
            sess_res = await run_db(
                lambda: supabase.table("chatty_sessions")
                .select("session_id, visitor_name, visitor_email, channel, subject, priority, last_message")
                .eq("bot_id", bot_id)
                .eq("session_id", session_id)
                .limit(1)
                .execute()
            )
            session = sess_res.data[0] if (sess_res and getattr(sess_res, "data", None)) else {}
        except Exception:
            session = {}

        bot_name = bot.get("name") or "Chatty Bot"
        visitor_name_val = visitor_name or session.get("visitor_name") or "Visitor"
        visitor_email_val = visitor_email or session.get("visitor_email") or "Not provided"
        channel_val = (channel or session.get("channel") or "web").lower()
        channel_label = _CHANNEL_LABELS.get(channel_val, "🌐 Live Chat")
        priority_str = (session.get("priority") or priority).upper()
        p_badge = "🚨 URGENT" if priority_str == "URGENT" else "⚠️ HIGH"
        last_msg = (latest_message or custom_message or session.get("last_message") or "Visitor requested human assistance.")[:300]
        visitor_name = visitor_name_val
        visitor_email = visitor_email_val
        ticket_subject = session.get("subject") or f"Conversation with {visitor_name}"

        inbox_link = f"{FRONTEND_URL}/dashboard?tab=inbox&session_id={session_id}"
        action_value = json.dumps({"bot_id": bot_id, "session_id": session_id}, separators=(",", ":"))

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
                        {
                            "type": "button",
                            "action_id": "chatty_takeover_session",
                            "text": {
                                "type": "plain_text",
                                "text": "🙋‍♂️ Take Over (Pause AI)",
                                "emoji": True,
                            },
                            "value": action_value,
                        },
                        {
                            "type": "button",
                            "action_id": "chatty_resolve_session",
                            "text": {
                                "type": "plain_text",
                                "text": "✅ Mark Resolved",
                                "emoji": True,
                            },
                            "value": action_value,
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
            resp = await ssrf.request_async(client, "POST", webhook_url, json=payload)
            if resp.status_code == 200:
                logger.info("Successfully posted Slack escalation alert for session %s", session_id)
                return {"sent": True, "status_code": 200}
            else:
                logger.warning("Slack webhook returned error %d: %s", resp.status_code, resp.text)
                return {"sent": False, "status_code": resp.status_code, "error": resp.text}

    except Exception as e:
        logger.exception("Failed to send Slack escalation alert: %s", e)
        return {"sent": False, "error": str(e)}


async def send_slack_test_notification(
    bot_id: str,
    *,
    webhook_url: Optional[str] = None,
    channel_name: Optional[str] = None,
) -> dict[str, Any]:
    """Send a 1-click verification Block Kit card to the bot's Slack Incoming Webhook."""
    bot, stored_webhook = await resolve_bot_slack_webhook(bot_id)
    if not bot:
        return {"sent": False, "reason": "bot_not_found", "error": "Bot not found"}

    target_url = (webhook_url or stored_webhook or "").strip()
    if not _is_slack_webhook_url(target_url):
        return {
            "sent": False,
            "reason": "invalid_slack_webhook",
            "error": "Slack Webhook URL must be a valid https://hooks.slack.com/services/... URL.",
        }

    try:
        await ssrf.assert_safe_url_async(target_url)
    except Exception as exc:
        return {"sent": False, "reason": "unsafe_url", "error": str(exc)}

    bot_name = bot.get("name") or "Chatty Assistant"
    ch_display = (channel_name or "#support").strip() or "#support"
    inbox_link = f"{FRONTEND_URL}/dashboard?tab=inbox&bot_id={bot_id}"

    payload = {
        "text": f"✅ *Chatty Slack Integration Connected* for *{bot_name}* ({ch_display})",
        "blocks": [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": "✅ Chatty Slack Integration Verified",
                    "emoji": True,
                },
            },
            {
                "type": "section",
                "fields": [
                    {"type": "mrkdwn", "text": f"*Assistant:*\n{bot_name}"},
                    {"type": "mrkdwn", "text": f"*Target Channel:*\n`{ch_display}`"},
                    {"type": "mrkdwn", "text": "*Status:*\n🟢 Connected & Ready"},
                    {"type": "mrkdwn", "text": "*Events:*\nEscalations, Leads & Flow Alerts"},
                ],
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": (
                        "Your workspace will now receive real-time Block Kit notifications whenever a visitor "
                        "requests a human agent, triggers negative sentiment escalation, or hits a Slack action node."
                    ),
                },
            },
            {
                "type": "actions",
                "elements": [
                    {
                        "type": "button",
                        "text": {"type": "plain_text", "text": "👉 Open Chatty Dashboard", "emoji": True},
                        "style": "primary",
                        "url": inbox_link,
                    }
                ],
            },
        ],
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await ssrf.request_async(client, "POST", target_url, json=payload)
        if resp.status_code == 200:
            return {"sent": True, "status_code": 200, "bot_id": bot_id, "channel": ch_display}
        return {
            "sent": False,
            "status_code": resp.status_code,
            "error": f"Slack returned HTTP {resp.status_code}: {resp.text[:200]}",
        }
    except Exception as exc:
        logger.warning("Slack test notification failed: %s", exc)
        return {"sent": False, "error": str(exc)}


async def send_slack_flow_message(
    bot_id: str,
    *,
    channel: str = "#alerts",
    text: str,
    session_id: str = "",
    webhook_url: Optional[str] = None,
) -> dict[str, Any]:
    """Send a Flow Builder (`action.slack`) message to the bot's configured Slack webhook."""
    clean_text = (text or "").strip()
    if not clean_text:
        return {"sent": False, "reason": "empty_message"}

    bot, stored_webhook = await resolve_bot_slack_webhook(bot_id)
    target_url = (webhook_url or stored_webhook or "").strip()
    if not _is_slack_webhook_url(target_url):
        return {"sent": False, "reason": "no_slack_webhook"}

    bot_name = (bot or {}).get("name") or "Chatty Flow"
    ch_label = (channel or "#alerts").strip()
    payload: dict[str, Any] = {
        "text": f"*{bot_name}* ({ch_label}): {clean_text}",
        "blocks": [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"🔔 *{bot_name}* • `{ch_label}`\n{clean_text}",
                },
            }
        ],
    }
    if session_id:
        inbox_link = f"{FRONTEND_URL}/dashboard?tab=inbox&session_id={session_id}"
        payload["blocks"].append(
            {
                "type": "context",
                "elements": [
                    {"type": "mrkdwn", "text": f"Session `#{session_id[:8]}` • <{inbox_link}|Open in Inbox>"}
                ],
            }
        )

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await ssrf.request_async(client, "POST", target_url, json=payload)
        return {"sent": resp.status_code < 300, "status_code": resp.status_code}
    except Exception as exc:
        logger.warning("Flow Slack notification failed: %s", exc)
        return {"sent": False, "error": str(exc)}


def format_slack_webhook_payload(payload: dict[str, Any]) -> dict[str, Any]:
    """Ensure a Chatty webhook event dictionary has Slack-compatible `text` and `blocks`
    so subscribing a `hooks.slack.com` URL in `chatty_webhooks` succeeds with HTTP 200."""
    if not isinstance(payload, dict) or payload.get("text"):
        return payload

    event = str(payload.get("event") or "chatty.event")
    session_id = str(payload.get("session_id") or "")
    data = payload.get("data") if isinstance(payload.get("data"), dict) else {}

    summary_parts: list[str] = []
    for k in ("name", "visitor_name", "email", "visitor_email", "phone", "subject", "title", "reason", "status"):
        val = data.get(k)
        if val not in (None, ""):
            summary_parts.append(f"*{k.replace('_', ' ').title()}:* {val}")

    summary_line = " • ".join(summary_parts[:5]) if summary_parts else json.dumps(data, default=str)[:240]
    text_str = f"🔔 *Chatty Event `{event}`*" + (f" (`#{session_id[:8]}`)" if session_id else "") + f" — {summary_line}"

    blocks: list[dict[str, Any]] = [
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": f"🔔 *Chatty Event:* `{event}`" + (f"  •  *Session:* `#{session_id[:8]}`" if session_id else "") + f"\n{summary_line}",
            },
        }
    ]
    if session_id:
        inbox_link = f"{FRONTEND_URL}/dashboard?tab=inbox&session_id={session_id}"
        blocks.append(
            {
                "type": "context",
                "elements": [{"type": "mrkdwn", "text": f"<{inbox_link}|👉 View conversation in Chatty Inbox>"}],
            }
        )

    return {
        **payload,
        "text": text_str,
        "blocks": blocks,
    }


async def handle_slack_interaction_payload(
    payload: dict[str, Any],
    *,
    default_bot_id: Optional[str] = None,
) -> dict[str, Any]:
    """Process Slack Interactive Block Kit button clicks (`chatty_takeover_session`, `chatty_resolve_session`)."""
    actions = payload.get("actions") if isinstance(payload.get("actions"), list) else []
    slack_user = payload.get("user") if isinstance(payload.get("user"), dict) else {}
    actor_name = (
        slack_user.get("name")
        or slack_user.get("username")
        or slack_user.get("id")
        or "Slack Agent"
    )

    if not actions:
        return {"ok": True, "action": "noop"}

    first_action = actions[0] if isinstance(actions[0], dict) else {}
    action_id = str(first_action.get("action_id") or "").strip()
    raw_val = str(first_action.get("value") or "").strip()

    parsed_val: dict[str, Any] = {}
    if raw_val.startswith("{"):
        try:
            parsed_val = json.loads(raw_val)
        except Exception:
            parsed_val = {}

    bot_id = str(parsed_val.get("bot_id") or default_bot_id or "").strip()
    session_id = str(parsed_val.get("session_id") or raw_val or "").strip()
    if not bot_id or not session_id:
        return {"ok": False, "error": "Missing bot_id or session_id in Slack action payload"}

    now_iso = datetime.now(timezone.utc).isoformat()

    if action_id == "chatty_takeover_session":
        upd = {
            "ai_paused": True,
            "needs_attention": False,
            "assigned_agent_name": f"{actor_name} (Slack)",
            "updated_at": now_iso,
        }
        await run_db(
            lambda: supabase.table("chatty_sessions")
            .update(upd)
            .eq("bot_id", bot_id)
            .eq("session_id", session_id)
            .execute()
        )
        return {
            "ok": True,
            "action": "takeover",
            "bot_id": bot_id,
            "session_id": session_id,
            "assigned_agent_name": f"{actor_name} (Slack)",
            "response_type": "in_channel",
            "replace_original": False,
            "text": f"🙋‍♂️ *{actor_name}* took over session `#{session_id[:8]}` (AI paused).",
        }

    if action_id == "chatty_resolve_session":
        upd = {
            "status": "resolved",
            "needs_attention": False,
            "ai_paused": False,
            "resolved_at": now_iso,
            "updated_at": now_iso,
        }
        await run_db(
            lambda: supabase.table("chatty_sessions")
            .update(upd)
            .eq("bot_id", bot_id)
            .eq("session_id", session_id)
            .execute()
        )
        return {
            "ok": True,
            "action": "resolved",
            "bot_id": bot_id,
            "session_id": session_id,
            "resolved_by": actor_name,
            "response_type": "in_channel",
            "replace_original": False,
            "text": f"✅ *{actor_name}* marked session `#{session_id[:8]}` as *Resolved*.",
        }

    return {"ok": True, "action": action_id or "ignored"}


async def handle_slack_event_payload(
    bot_id: str,
    payload: dict[str, Any],
) -> dict[str, Any]:
    """Handle Slack Events API webhook payloads (`url_verification` and `event_callback`)."""
    event_type = str(payload.get("type") or "").strip()

    if event_type == "url_verification":
        return {"challenge": str(payload.get("challenge") or "")}

    if event_type != "event_callback":
        return {"ok": True, "ignored": True, "type": event_type}

    event = payload.get("event") if isinstance(payload.get("event"), dict) else {}
    inner_type = str(event.get("type") or "").strip()
    subtype = str(event.get("subtype") or "").strip()

    # Ignore bot messages and message edits/deletions to prevent echo loops
    if event.get("bot_id") or subtype in {"bot_message", "message_changed", "message_deleted"}:
        return {"ok": True, "ignored": True, "reason": "bot_or_system_event"}

    if inner_type not in {"message", "app_mention"}:
        return {"ok": True, "ignored": True, "event_type": inner_type}

    raw_text = str(event.get("text") or "").strip()
    if not raw_text:
        return {"ok": True, "ignored": True, "reason": "empty_text"}

    slack_channel = str(event.get("channel") or "general").strip()
    slack_user = str(event.get("user") or "visitor").strip()
    thread_ts = str(event.get("thread_ts") or event.get("ts") or "").strip()
    session_id = f"slack:{slack_channel}:{thread_ts or slack_user}"[:120]
    now_iso = datetime.now(timezone.utc).isoformat()

    try:
        existing_sess = await run_db(
            lambda: supabase.table("chatty_sessions")
            .select("session_id")
            .eq("bot_id", bot_id)
            .eq("session_id", session_id)
            .limit(1)
            .execute()
        )
        if existing_sess and existing_sess.data:
            await run_db(
                lambda: supabase.table("chatty_sessions")
                .update({"last_message": raw_text[:300], "last_message_at": now_iso})
                .eq("bot_id", bot_id)
                .eq("session_id", session_id)
                .execute()
            )
        else:
            await run_db(
                lambda: supabase.table("chatty_sessions")
                .insert({
                    "bot_id": bot_id,
                    "session_id": session_id,
                    "channel": "slack",
                    "visitor_name": f"Slack User ({slack_user})",
                    "status": "open",
                    "last_message": raw_text[:300],
                    "last_message_at": now_iso,
                })
                .execute()
            )

        await run_db(
            lambda: supabase.table("chatty_conversations")
            .insert({
                "bot_id": bot_id,
                "session_id": session_id,
                "role": "user",
                "content": raw_text,
            })
            .execute()
        )
    except Exception as exc:
        logger.warning("Failed to persist inbound Slack event message: %s", exc)

    return {
        "ok": True,
        "processed": True,
        "bot_id": bot_id,
        "session_id": session_id,
        "event_type": inner_type,
    }
