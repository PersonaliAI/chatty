"""Real delivery of meeting notifications: beautiful HTML email + push.

Channels, in priority order:
  1. OneSignal Email API  (if ONESIGNAL_APP_ID + ONESIGNAL_REST_API_KEY set)
  2. Owner's connected Gmail (if the bot owner has Google linked) — html=True
  3. Logged only (no credentials / not connected) -> status "logged"

OneSignal push is sent when ONESIGNAL_* is configured and a target
external_id / subscription is available; otherwise it degrades to "logged".

Everything degrades gracefully so a booking never fails because a channel
is unconfigured — the side-effects are best-effort.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import httpx

from plugins import google_integrations as g

logger = logging.getLogger("kin.notifications")

ONESIGNAL_APP_ID = os.environ.get("ONESIGNAL_APP_ID", "").strip()
ONESIGNAL_REST_API_KEY = os.environ.get("ONESIGNAL_REST_API_KEY", "").strip()
ONESIGNAL_EMAIL_FROM = os.environ.get("ONESIGNAL_EMAIL_FROM", "no-reply@personaliai.com").strip()
ONESIGNAL_EMAIL_FROM_NAME = os.environ.get("ONESIGNAL_EMAIL_FROM_NAME", "Personali AI").strip()

_ONESIGNAL_URL = "https://api.onesignal.com/notifications"


def onesignal_configured() -> bool:
    return bool(ONESIGNAL_APP_ID and ONESIGNAL_REST_API_KEY)


# ---------------------------------------------------------------------------
# Beautiful HTML email templates
# ---------------------------------------------------------------------------

_BRAND = "#f97316"


def _email_shell(*, title: str, intro: str, rows: list[tuple[str, str]],
                 cta_label: Optional[str] = None, cta_url: Optional[str] = None,
                 footer: str = "") -> str:
    """Responsive, inline-styled email body (email clients ignore <style> blocks)."""
    rows_html = "".join(
        f"""
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;color:#8a8a8a;
              font-size:12px;text-transform:uppercase;letter-spacing:.04em;width:38%;
              vertical-align:top;font-family:Arial,Helvetica,sans-serif;">{label}</td>
          <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;color:#1c1c1c;
              font-size:14px;font-weight:600;font-family:Arial,Helvetica,sans-serif;">{value}</td>
        </tr>"""
        for label, value in rows
    )
    cta_html = ""
    if cta_label and cta_url:
        cta_html = f"""
        <tr><td style="padding:28px 0 4px;">
          <a href="{cta_url}" style="background:{_BRAND};color:#ffffff;text-decoration:none;
             display:inline-block;padding:13px 26px;border-radius:10px;font-weight:700;
             font-size:14px;font-family:Arial,Helvetica,sans-serif;">{cta_label}</a>
        </td></tr>"""

    return f"""<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f5f5f5;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
         style="background:#f5f5f5;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
             style="max-width:560px;background:#ffffff;border-radius:18px;overflow:hidden;
             box-shadow:0 4px 24px rgba(0,0,0,.06);">
        <tr><td style="background:{_BRAND};padding:22px 32px;">
          <span style="color:#fff;font-size:18px;font-weight:800;letter-spacing:-.02em;
                font-family:Arial,Helvetica,sans-serif;">✦ Personali AI</span>
        </td></tr>
        <tr><td style="padding:32px 32px 8px;">
          <h1 style="margin:0 0 8px;font-size:20px;color:#111;font-weight:800;
              font-family:Arial,Helvetica,sans-serif;">{title}</h1>
          <p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:#555;
             font-family:Arial,Helvetica,sans-serif;">{intro}</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            {rows_html}
            {cta_html}
          </table>
        </td></tr>
        <tr><td style="padding:20px 32px 28px;">
          <p style="margin:0;font-size:11px;line-height:1.6;color:#aaa;
             font-family:Arial,Helvetica,sans-serif;">{footer or 'Sent automatically by your Personali AI assistant.'}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>"""


def build_client_email_html(*, visitor_name: str, summary: str, start: str,
                            timezone_label: str, meeting_link: str,
                            provider: str) -> str:
    provider_label = {"google_meet": "Google Meet", "zoom": "Zoom",
                      "teams": "Microsoft Teams"}.get(provider, provider)
    return _email_shell(
        title=f"You're booked, {visitor_name}! 🎉",
        intro=f"Your meeting <strong>“{summary}”</strong> is confirmed. "
              "We've added the details below — see you there!",
        rows=[
            ("Date &amp; Time", start),
            ("Timezone", timezone_label),
            ("Platform", provider_label),
        ],
        cta_label="Join the meeting",
        cta_url=meeting_link,
        footer="Need to reschedule? Just reply to this email.",
    )


def build_admin_email_html(*, visitor_name: str, visitor_email: str, summary: str,
                           start: str, timezone_label: str, meeting_link: str,
                           provider: str) -> str:
    provider_label = {"google_meet": "Google Meet", "zoom": "Zoom",
                      "teams": "Microsoft Teams"}.get(provider, provider)
    return _email_shell(
        title="New meeting booked 📅",
        intro="Your AI assistant just scheduled a meeting with a new lead.",
        rows=[
            ("Lead", visitor_name),
            ("Email", f'<a href="mailto:{visitor_email}" style="color:{_BRAND};">{visitor_email}</a>'),
            ("Title", summary),
            ("Date &amp; Time", start),
            ("Timezone", timezone_label),
            ("Platform", provider_label),
        ],
        cta_label="Open meeting link",
        cta_url=meeting_link,
        footer="View full lead details in your Personali AI admin panel.",
    )


def build_team_invite_email_html(*, bot_name: str, inviter_email: str, role: str) -> str:
    return _email_shell(
        title=f"You've been added to {bot_name} 👋",
        intro=f"<strong>{inviter_email}</strong> gave you {('admin' if role == 'admin' else 'agent')} "
              f"access to the <strong>{bot_name}</strong> chatbot on Chatty.",
        rows=[
            ("Chatbot", bot_name),
            ("Invited by", inviter_email),
            ("Role", role.capitalize()),
        ],
        cta_label="Sign in to Chatty",
        cta_url="https://chatty.personaliai.com/login",
        footer="Sign in (or sign up) with this email address to see this chatbot in your dashboard.",
    )


# ---------------------------------------------------------------------------
# Delivery
# ---------------------------------------------------------------------------


async def _send_onesignal_email(*, to: str, subject: str, html: str) -> bool:
    if not onesignal_configured():
        return False
    payload = {
        "app_id": ONESIGNAL_APP_ID,
        "email_subject": subject,
        "email_body": html,
        "email_from_name": ONESIGNAL_EMAIL_FROM_NAME,
        "email_from_address": ONESIGNAL_EMAIL_FROM,
        "include_email_tokens": [to],
        "target_channel": "email",
    }
    headers = {
        "Authorization": f"Key {ONESIGNAL_REST_API_KEY}",
        "Content-Type": "application/json",
    }
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(_ONESIGNAL_URL, json=payload, headers=headers)
        if r.status_code < 300:
            return True
        logger.warning("OneSignal email failed (%s): %s", r.status_code, r.text[:300])
        return False
    except Exception:
        logger.exception("OneSignal email request errored")
        return False


ADMIN_ALERT_EMAIL = os.environ.get("ADMIN_ALERT_EMAIL", "").strip()


async def send_admin_alert_email(*, subject: str, html: str) -> bool:
    """System-level alert, not tied to any particular Kin user — for things
    like critical system failures, where there's no
    per-user context to hang the notification off of. Sent via OneSignal
    to ADMIN_ALERT_EMAIL; falls back to a log line (visible in Cloud
    Logging) if OneSignal or the recipient address isn't configured, so the
    alert is never just silently dropped."""
    if not ADMIN_ALERT_EMAIL:
        logger.warning("ADMIN_ALERT_EMAIL not set; alert not sent: %s", subject)
        return False
    ok = await _send_onesignal_email(to=ADMIN_ALERT_EMAIL, subject=subject, html=html)
    if not ok:
        logger.warning("admin alert email failed to send: %s", subject)
    return ok


async def _send_gmail_html(*, supabase, owner_user: dict, to: str,
                           subject: str, html: str) -> bool:
    try:
        await g.send_gmail(supabase, owner_user, to=[to], subject=subject,
                           body=html, html=True)
        return True
    except Exception:
        logger.exception("Gmail fallback send failed for %s", to)
        return False


async def deliver_email(*, supabase, owner_user: dict, to: str, subject: str,
                        html: str) -> str:
    """Best-effort email delivery. Returns the resulting status string:
    'sent' (OneSignal), 'sent_gmail', or 'logged'."""
    if await _send_onesignal_email(to=to, subject=subject, html=html):
        return "sent"
    # Fall back to owner's Gmail if they have Google connected
    if owner_user and owner_user.get("google_access_token"):
        if await _send_gmail_html(supabase=supabase, owner_user=owner_user, to=to,
                                  subject=subject, html=html):
            return "sent_gmail"
    return "logged"


async def deliver_push(*, headings: str, contents: str,
                       external_id: Optional[str] = None) -> str:
    """Best-effort OneSignal push. Returns 'delivered' or 'logged'.
    Without a target subscription/external_id we can't push, so we log."""
    if not onesignal_configured() or not external_id:
        return "logged"
    payload = {
        "app_id": ONESIGNAL_APP_ID,
        "headings": {"en": headings},
        "contents": {"en": contents},
        "include_aliases": {"external_id": [external_id]},
        "target_channel": "push",
    }
    headers = {
        "Authorization": f"Key {ONESIGNAL_REST_API_KEY}",
        "Content-Type": "application/json",
    }
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(_ONESIGNAL_URL, json=payload, headers=headers)
        return "delivered" if r.status_code < 300 else "logged"
    except Exception:
        logger.exception("OneSignal push request errored")
        return "logged"


async def deliver_webhook(*, url: str, event: str, bot_id: str, data: dict) -> bool:
    """Best-effort POST of `{event, bot_id, data, timestamp}` to a customer-configured
    webhook URL (e.g. Zapier, Slack incoming webhook, or their own backend). Fire-and-
    forget — failures are logged, never raised, so a broken customer endpoint can't
    break the conversation/lead flow that triggered it."""
    if not url:
        return False
    payload = {
        "event": event,
        "bot_id": bot_id,
        "data": data,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.post(url, json=payload)
        return r.status_code < 300
    except Exception:
        logger.exception("Webhook delivery failed for %s (event=%s)", url, event)
        return False


# ---------------------------------------------------------------------------
# Subscription-based webhooks (chatty_webhooks / chatty_webhook_deliveries)
#
# Separate from deliver_webhook() above, which remains the delivery path for
# the legacy single chatty_bots.webhook_url field (unsigned, "new_conversation"
# only) so existing customers using that field keep working unchanged. This
# is the newer multi-subscription system: a bot can register several
# webhooks, each filtered to specific event types, each with its own HMAC
# signing secret and a durable retry queue.
# ---------------------------------------------------------------------------

WEBHOOK_EVENTS = (
    "lead.created",
    "message.user",
    "message.assistant",
    "session.started",
    "session.ended",
)

# Seconds to wait before each retry: 1s, 5s, 30s, 5min, 30min, 2h, 8h.
# 7 attempts total (the initial send + 6 of these) before an event is dropped.
WEBHOOK_BACKOFF_SCHEDULE = [1, 5, 30, 300, 1800, 7200, 28800]
WEBHOOK_MAX_ATTEMPTS = len(WEBHOOK_BACKOFF_SCHEDULE) + 1
WEBHOOK_TIMEOUT_SECONDS = 10


def sign_webhook_body(secret: str, body: bytes) -> str:
    return hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()


async def _post_signed_webhook(url: str, secret: str, payload: dict) -> tuple[bool, Optional[str]]:
    """Returns (success, error_message)."""
    body = json.dumps(payload, default=str).encode()
    signature = sign_webhook_body(secret, body)
    try:
        async with httpx.AsyncClient(timeout=WEBHOOK_TIMEOUT_SECONDS) as client:
            r = await client.post(
                url,
                content=body,
                headers={"Content-Type": "application/json", "X-Chatty-Signature": signature},
            )
        if r.status_code < 300:
            return True, None
        return False, f"HTTP {r.status_code}"
    except Exception as exc:  # noqa: BLE001
        return False, str(exc)[:300]


async def enqueue_webhook_event(
    supabase, *, bot_id: str, event: str, session_id: str = "", data: dict
) -> None:
    """Fan out `event` to every active chatty_webhooks subscription for this
    bot that's subscribed to it. First attempt happens inline; on failure the
    delivery is queued for retry (see process_due_webhook_retries). Never
    raises — a broken/slow customer endpoint must never affect the chat flow
    that triggered the event."""
    try:
        res = (
            supabase.table("chatty_webhooks")
            .select("id, url, secret, events")
            .eq("bot_id", bot_id)
            .eq("active", True)
            .execute()
        )
        webhooks = res.data or []
    except Exception:
        logger.exception("webhook subscription lookup failed for bot %s", bot_id)
        return

    subscribed = [w for w in webhooks if event in (w.get("events") or [])]
    if not subscribed:
        return

    payload = {
        "event": event,
        "bot_id": bot_id,
        "session_id": session_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "data": data,
    }

    for wh in subscribed:
        ok, err = await _post_signed_webhook(wh["url"], wh["secret"], payload)
        if ok:
            continue
        try:
            supabase.table("chatty_webhook_deliveries").insert({
                "webhook_id": wh["id"],
                "event": event,
                "payload": payload,
                "status": "pending",
                "attempt_count": 1,
                "next_attempt_at": (
                    datetime.now(timezone.utc) + timedelta(seconds=WEBHOOK_BACKOFF_SCHEDULE[0])
                ).isoformat(),
                "last_error": err,
            }).execute()
        except Exception:
            logger.exception("failed to enqueue webhook retry for %s", wh.get("url"))


async def process_due_webhook_retries(supabase, *, limit: int = 100) -> dict:
    """Cron entry point: attempt every delivery whose next_attempt_at has
    passed. Reschedules on failure per WEBHOOK_BACKOFF_SCHEDULE, or marks
    'failed' (dropped) once WEBHOOK_MAX_ATTEMPTS is reached."""
    now_iso = datetime.now(timezone.utc).isoformat()
    try:
        res = (
            supabase.table("chatty_webhook_deliveries")
            .select("*")
            .eq("status", "pending")
            .lte("next_attempt_at", now_iso)
            .order("next_attempt_at")
            .limit(limit)
            .execute()
        )
        due = res.data or []
    except Exception:
        logger.exception("webhook retry lookup failed")
        return {"processed": 0, "delivered": 0, "dropped": 0}

    delivered = 0
    dropped = 0
    for delivery in due:
        try:
            wh_res = (
                supabase.table("chatty_webhooks")
                .select("id, url, secret, active")
                .eq("id", delivery["webhook_id"])
                .limit(1)
                .execute()
            )
            wh = wh_res.data[0] if wh_res.data else None
        except Exception:
            wh = None

        if not wh or not wh.get("active"):
            supabase.table("chatty_webhook_deliveries").update(
                {"status": "failed", "last_error": "webhook removed or deactivated"}
            ).eq("id", delivery["id"]).execute()
            dropped += 1
            continue

        ok, err = await _post_signed_webhook(wh["url"], wh["secret"], delivery["payload"])
        attempt = int(delivery.get("attempt_count") or 0) + 1

        if ok:
            supabase.table("chatty_webhook_deliveries").update({
                "status": "delivered",
                "attempt_count": attempt,
                "delivered_at": datetime.now(timezone.utc).isoformat(),
            }).eq("id", delivery["id"]).execute()
            delivered += 1
            continue

        if attempt >= WEBHOOK_MAX_ATTEMPTS:
            supabase.table("chatty_webhook_deliveries").update({
                "status": "failed", "attempt_count": attempt, "last_error": err,
            }).eq("id", delivery["id"]).execute()
            dropped += 1
        else:
            backoff = WEBHOOK_BACKOFF_SCHEDULE[min(attempt - 1, len(WEBHOOK_BACKOFF_SCHEDULE) - 1)]
            supabase.table("chatty_webhook_deliveries").update({
                "attempt_count": attempt,
                "last_error": err,
                "next_attempt_at": (datetime.now(timezone.utc) + timedelta(seconds=backoff)).isoformat(),
            }).eq("id", delivery["id"]).execute()

    return {"processed": len(due), "delivered": delivered, "dropped": dropped}


async def detect_and_fire_ended_sessions(supabase, *, idle_minutes: int = 30, limit: int = 200) -> dict:
    """Cron entry point: chatty_sessions have no explicit 'the visitor left'
    signal, so this scans for sessions that have gone idle_minutes without a
    new message and haven't already fired session.ended, then fires it once
    per session."""
    cutoff = (datetime.now(timezone.utc) - timedelta(minutes=idle_minutes)).isoformat()
    try:
        res = (
            supabase.table("chatty_sessions")
            .select("id, bot_id, session_id, last_message_at")
            .eq("ended_webhook_fired", False)
            .lt("last_message_at", cutoff)
            .limit(limit)
            .execute()
        )
        sessions = res.data or []
    except Exception:
        logger.exception("idle-session scan failed")
        return {"fired": 0}

    fired = 0
    for s in sessions:
        await enqueue_webhook_event(
            supabase,
            bot_id=s["bot_id"],
            event="session.ended",
            session_id=s["session_id"],
            data={"idle_minutes": idle_minutes, "last_message_at": s.get("last_message_at")},
        )
        try:
            supabase.table("chatty_sessions").update(
                {"ended_webhook_fired": True}
            ).eq("id", s["id"]).execute()
        except Exception:
            logger.exception("failed to mark session %s as ended-fired", s["id"])
        fired += 1

    return {"fired": fired}
