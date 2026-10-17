"""Widget session lifecycle, escalation, and best-effort enrichment helpers."""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import httpx

from app.core.clients import supabase
from app.core.db import run_db
from plugins import notifications as notify

logger = logging.getLogger("chatty.widget.session")


async def upsert_session(
    bot_id: str,
    session_id: str,
    last_message: str,
    visitor_name: Optional[str] = None,
    visitor_email: Optional[str] = None,
    channel: str = "web",
) -> tuple[dict[str, Any], bool]:
    """Create or update a conversation session. Returns (row, is_new)."""
    if session_id.startswith("ci-"):
        # Inbox display fields come from the signed profile when identified;
        # custom attributes never enter the assistant prompt here.
        bindings = (await run_db(lambda: supabase.table("chatty_visitor_credentials").select("contact_id")
            .eq("bot_id", bot_id).eq("session_id", session_id).limit(1).execute())).data or []
        if bindings:
            contacts = (await run_db(lambda: supabase.table("chatty_contacts").select("profile,external_user_id")
                .eq("bot_id", bot_id).eq("id", bindings[0]["contact_id"]).limit(1).execute())).data or []
            if contacts and contacts[0].get("external_user_id"):
                profile = contacts[0].get("profile") or {}
                visitor_name, visitor_email = profile.get("name"), profile.get("email")
    session_channel = (channel or "").strip().lower() or ("whatsapp" if session_id.startswith("wa:") else "web")
    if session_channel not in {"web", "voice", "email", "whatsapp", "slack", "api"}:
        session_channel = "web"
    try:
        existing = await run_db(lambda: supabase.table("chatty_sessions").select("*").eq(
            "bot_id", bot_id).eq("session_id", session_id).execute())
        if existing.data:
            row = existing.data[0]
            upd = {
                "last_message": last_message[:300],
                "last_message_at": datetime.now(timezone.utc).isoformat(),
            }
            if visitor_name and not row.get("visitor_name"):
                upd["visitor_name"] = visitor_name
            if visitor_email and not row.get("visitor_email"):
                upd["visitor_email"] = visitor_email
            if row.get("channel") != session_channel:
                upd["channel"] = session_channel
            await run_db(lambda: supabase.table("chatty_sessions").update(upd).eq("id", row["id"]).execute())
            return row, False

        now_dt = datetime.now(timezone.utc)
        ins = await run_db(lambda: supabase.table("chatty_sessions").insert({
            "bot_id": bot_id,
            "session_id": session_id,
            "channel": session_channel,
            "status": "open",
            "priority": "normal",
            "first_response_due_at": (now_dt + timedelta(minutes=15)).isoformat(),
            "resolution_due_at": (now_dt + timedelta(hours=4)).isoformat(),
            "sla_status": "on_track",
            "tags": [],
            "ai_paused": False,
            "visitor_name": visitor_name,
            "visitor_email": visitor_email,
            "last_message": last_message[:300],
        }).execute())
        return (ins.data[0] if ins.data else {}), True
    except Exception:
        logger.exception("session upsert failed")
        return {}, False


async def notify_new_conversation(
    bot: dict[str, Any],
    owner_user: dict[str, Any],
    first_message: str,
    session_id: str = "",
) -> None:
    """Email the owner and fire their webhook when a brand-new visitor conversation starts."""
    bot_name = bot.get("name") or "your assistant"
    try:
        recipients = []
        if owner_user.get("email"):
            recipients.append(owner_user["email"])
        if bot.get("notification_emails"):
            recipients.extend(e.strip() for e in str(bot["notification_emails"]).split(",") if e.strip())
        recipients = list(dict.fromkeys(recipients))

        for to in recipients:
            try:
                html = notify._email_shell(
                    title="New conversation started",
                    intro=f"A visitor just started chatting with <strong>{bot_name}</strong> on your website.",
                    rows=[("First message", (first_message or "")[:200] or "(attachment)")],
                    cta_label="Open your inbox",
                    cta_url="https://chatty.personaliai.com/dashboard",
                    footer="Reply from the Inbox tab in your Chatty dashboard.",
                )
                await notify.deliver_email(
                    supabase=supabase,
                    owner_user=owner_user,
                    to=to,
                    subject=f"New chat on {bot_name}",
                    html=html,
                )
            except Exception:
                logger.exception("new-conversation email failed for %s", to)
    except Exception:
        logger.exception("new-conversation notification block failed")

    if bot.get("webhook_url"):
        await notify.deliver_webhook(
            url=bot["webhook_url"],
            event="new_conversation",
            bot_id=bot["id"],
            data={"session_id": session_id, "bot_name": bot_name, "first_message": (first_message or "")[:500]},
        )


_geoip_cache: dict[str, dict[str, Any]] = {}


async def geoip_lookup(ip: str) -> dict[str, Any]:
    """Return {country, region, city} for an IP, or empty dict for private/unknown IPs."""
    if (
        not ip
        or ip in ("unknown", "127.0.0.1", "::1")
        or ip.startswith(("10.", "192.168.", "169.254.", "172.16."))
    ):
        return {}
    if ip in _geoip_cache:
        return _geoip_cache[ip]

    info: dict[str, Any] = {}
    try:
        async with httpx.AsyncClient(timeout=4) as client:
            response = await client.get(f"https://ipapi.co/{ip}/json/")
        if response.status_code < 300:
            data = response.json()
            if not data.get("error"):
                info = {
                    "country": data.get("country_name"),
                    "region": data.get("region"),
                    "city": data.get("city"),
                    "lat": data.get("latitude"),
                    "lon": data.get("longitude"),
                }
    except Exception:
        logger.exception("geoip lookup failed for %s", ip)
    _geoip_cache[ip] = info
    return info


_HANDOFF_PATTERNS = (
    "human", "real person", "real human", "speak to someone", "speak with someone",
    "speak to a person", "speak to an agent", "talk to someone", "talk to a person",
    "talk to an agent", "talk to agent", "speak to agent", "connect to agent",
    "connect with agent", "connect me to a person", "connect me to an agent",
    "connect to human", "live agent", "customer service", "representative",
    "contact a person", "call me", "phone me", "live support", "support agent",
    "real agent", "transfer to agent", "transfer to human", "handoff to agent",
    "handoff to human", "talk to human", "speak to human", "human assistance",
    "help from a person", "get a human", "get an agent", "need a person", "need a human",
)

_AFFIRMATIVE_HANDOFF_PATTERNS = (
    "yes", "yes please", "please", "sure", "connect me", "connect me please",
    "talk to them", "talk to agent", "let me talk", "speak with them", "i want to",
    "transfer me", "pass me", "escalate", "yeah", "yep", "ok please", "okay please",
    "yes connect me", "yes transfer me", "yes talk to human", "yes talk to agent",
)

_NEGATIVE_PATTERNS = (
    "frustrated", "angry", "terrible", "horrible", "worst service", "waste of time",
    "useless", "ridiculous", "unacceptable", "scam", "cancel subscription",
    "refund", "complain", "complaint", "broken", "does not work", "doesn't work",
)

_UNANSWERED_MARKERS = (
    "i don't have", "i do not have", "don't have that information",
    "don't have information", "i'm not sure", "i am not sure",
    "i don't know", "i do not know", "couldn't find", "could not find",
    "no information", "not in my knowledge", "outside my knowledge",
    "unable to find", "wasn't able to", "was not able to",
    "i can't help with that", "i cannot help with that",
    "don't have details", "do not have details",
    "unable to provide", "cannot provide", "can't provide", "not able to provide",
    "unable to assist", "cannot assist", "can't assist", "not able to assist",
    "unable to answer", "cannot answer", "can't answer", "not able to answer",
    "team member follow up", "team member to follow up", "have a team member",
    "follow up with you", "outside my scope", "outside the scope", "outside of my scope",
    "not covered in", "not in the documentation", "not in my documentation",
    "not in our documentation", "not in our knowledge", "specialize in assisting with",
    "only assist with",
)


def looks_unanswered(reply: str) -> bool:
    lowered = (reply or "").lower()
    return any(marker in lowered for marker in _UNANSWERED_MARKERS)


def needs_human(text: str) -> bool:
    lowered = (text or "").lower()
    return any(pattern in lowered for pattern in _HANDOFF_PATTERNS)


def detect_sentiment_escalation(text: str, previous_message: Optional[str] = None) -> Optional[str]:
    lowered = (text or "").strip().lower()
    if any(pattern in lowered for pattern in _HANDOFF_PATTERNS):
        return "Customer requested human agent"
    if any(pattern in lowered for pattern in _NEGATIVE_PATTERNS):
        return "Negative sentiment detected"
    if previous_message:
        prev_lowered = previous_message.lower()
        has_handoff_context = (
            looks_unanswered(previous_message)
            or "[handoff_actions]" in prev_lowered
            or any(kw in prev_lowered for kw in ("connect you", "team member", "human agent", "support team", "live agent", "follow up"))
        )
        if has_handoff_context and any(
            lowered == aff or lowered.startswith(aff + " ") or lowered.endswith(" " + aff)
            for aff in _AFFIRMATIVE_HANDOFF_PATTERNS
        ):
            return "Customer accepted human handoff offer"
    return None


def log_unanswered_if_needed(bot_id: str, session_id: str, question: str, reply: str) -> None:
    """Record a visitor question the bot could not confidently answer."""
    try:
        if not question or not looks_unanswered(reply):
            return
        existing = supabase.table("chatty_unanswered").select("id") \
            .eq("bot_id", bot_id).eq("question", question[:2000]) \
            .eq("status", "open").limit(1).execute()
        if existing.data:
            return
        supabase.table("chatty_unanswered").insert({
            "bot_id": bot_id,
            "session_id": session_id,
            "question": question[:2000],
        }).execute()
    except Exception:
        logger.exception("failed to log unanswered question")


_upsert_session = upsert_session
_notify_new_conversation = notify_new_conversation
_needs_human = needs_human
_detect_sentiment_escalation = detect_sentiment_escalation
_log_unanswered_if_needed = log_unanswered_if_needed
