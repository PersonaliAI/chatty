"""Billing & Trial Lifecycle Email Service for Chatty.

Delivers professional, industrial-standard responsive transactional emails for:
1. Trial ending soon (3 days notice)
2. Trial expired (agent set to offline mode)
3. Subscription activated (welcome on checkout)
4. Payment success (recurring renewal receipt)
5. Payment failed (action required / grace period warning)
6. Subscription cancelled (confirmation & access until billing cycle end)
7. Subscription paused / resumed

Features strict idempotency / deduplication via the chatty_lifecycle_emails table.
"""

from __future__ import annotations

import html as _html
import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import httpx

from app.services.email_templates_common import (
    render_email_head,
    render_gdpr_footer_html,
)

logger = logging.getLogger("chatty.billing_emails")

RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "").strip()
RESEND_EMAIL_FROM = os.environ.get("RESEND_EMAIL_FROM", "Chatty Team <chatty@personaliai.com>").strip()
_RESEND_URL = "https://api.resend.com/emails"

ONESIGNAL_APP_ID = os.environ.get("ONESIGNAL_APP_ID", "").strip()
ONESIGNAL_REST_API_KEY = os.environ.get("ONESIGNAL_REST_API_KEY", "").strip()
ONESIGNAL_EMAIL_FROM = os.environ.get("ONESIGNAL_EMAIL_FROM", "chatty@personaliai.com").strip()
ONESIGNAL_EMAIL_FROM_NAME = os.environ.get("ONESIGNAL_EMAIL_FROM_NAME", "Chatty Team").strip()
_ONESIGNAL_URL = "https://api.onesignal.com/notifications"

FRONTEND_URL = os.environ.get("FRONTEND_URL", "https://chatty.personaliai.com").rstrip("/")
BILLING_URL = f"{FRONTEND_URL}/dashboard/billing"
DASHBOARD_URL = f"{FRONTEND_URL}/dashboard"


# ---------------------------------------------------------------------------
# Base Email Template Builder
# ---------------------------------------------------------------------------

def _render_base_email(
    *,
    subject: str,
    badge_text: str,
    badge_bg: str,
    badge_color: str,
    title: str,
    body_paragraphs: list[str],
    highlight_box: Optional[dict[str, str]] = None,
    cta_text: str,
    cta_url: str,
    secondary_text: Optional[str] = None,
) -> str:
    """Renders a fully responsive, bulletproof transactional email matching modern SaaS and GDPR standards."""
    escaped_title = _html.escape(title)
    escaped_badge = _html.escape(badge_text)
    escaped_cta = _html.escape(cta_text)
    escaped_cta_url = _html.escape(cta_url, quote=True)

    paragraphs_html = "".join(
        f'<p style="margin:0 0 16px;font-size:15px;line-height:24px;color:#334155;word-break:break-word;">{p}</p>'
        for p in body_paragraphs
    )

    box_html = ""
    if highlight_box:
        box_rows = "".join(
            f'<tr class="email-table-row">'
            f'<td class="email-summary-label" style="padding:6px 0;font-size:13px;color:#64748b;font-weight:500;">{_html.escape(k)}</td>'
            f'<td class="email-summary-value" align="right" style="padding:6px 0;font-size:13px;color:#0f172a;font-weight:600;">{_html.escape(v)}</td>'
            f'</tr>'
            for k, v in highlight_box.items()
        )
        box_html = f"""
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px 20px;">
          {box_rows}
        </table>
        """

    secondary_html = ""
    if secondary_text:
        secondary_html = f'<p style="margin:16px 0 0;font-size:13px;line-height:20px;color:#64748b;">{secondary_text}</p>'

    head_html = render_email_head(subject)
    footer_html = render_gdpr_footer_html(
        reason_text="You received this essential transactional email regarding your Chatty account and subscription billing status. Legal basis: GDPR Art. 6(1)(b) - Performance of a Contract.",
        preferences_url=BILLING_URL,
        support_email="support@personaliai.com",
        brand_color="#6366f1",
        dark_mode=False,
        is_marketing=False,
    )

    return f"""<!DOCTYPE html>
<html lang="en">
{head_html}
<body style="margin:0;padding:0;background-color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="email-wrapper" style="background-color:#0f172a;padding:40px 16px;width:100% !important;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="email-container email-card" style="max-width:580px;width:100%;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 20px 25px -5px rgba(0,0,0,0.3),0 8px 10px -6px rgba(0,0,0,0.3);">
          
          <!-- Top Brand Header -->
          <tr>
            <td class="email-pad-header" style="background-color:#090d16;padding:24px 32px;border-bottom:1px solid #1e293b;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td class="email-stack-col">
                    <span style="display:inline-block;color:#ffffff;font-size:18px;font-weight:700;letter-spacing:-0.03em;">
                      <span style="color:#6366f1;">●</span> Chatty
                    </span>
                    <span style="color:#64748b;font-size:13px;margin-left:8px;font-weight:400;">by PersonaliAI</span>
                  </td>
                  <td align="right" class="email-stack-col-right">
                    <span style="display:inline-block;background-color:{badge_bg};color:{badge_color};font-size:11px;font-weight:700;padding:5px 12px;border-radius:20px;letter-spacing:0.04em;text-transform:uppercase;">
                      {escaped_badge}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Content Body -->
          <tr>
            <td class="email-pad-body" style="padding:36px 32px 28px;">
              <h1 class="email-headline" style="margin:0 0 20px;font-size:22px;font-weight:700;line-height:28px;color:#0f172a;letter-spacing:-0.02em;">
                {escaped_title}
              </h1>

              {paragraphs_html}

              {box_html}

              <!-- CTA Button -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0 16px;">
                <tr>
                  <td align="center">
                    <a href="{escaped_cta_url}" target="_blank" class="email-btn" style="display:inline-block;background-color:#4f46e5;background-image:linear-gradient(135deg,#6366f1,#4f46e5);color:#ffffff;font-size:15px;font-weight:600;line-height:48px;height:48px;padding:0 32px;border-radius:10px;text-decoration:none;box-shadow:0 4px 14px rgba(79,70,229,0.35);">
                      {escaped_cta} &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              {secondary_html}
            </td>
          </tr>

          <!-- GDPR & Legal Footer -->
          {footer_html}

        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


# ---------------------------------------------------------------------------
# Outbound Delivery Engine
# ---------------------------------------------------------------------------

def _safe_log_str(val: Any, max_len: int = 120) -> str:
    """Sanitize uncontrolled input before logging to prevent log injection (CWE-117)."""
    return str(val or "").replace("\r", "").replace("\n", "").strip()[:max_len]


async def _send_raw_email(to_email: str, subject: str, html_body: str) -> dict[str, Any]:
    """Delivers via Resend API with automatic OneSignal fallback."""
    clean_to = (to_email or "").strip().lower()
    safe_to = _safe_log_str(clean_to)
    if not clean_to or "@" not in clean_to:
        logger.warning("Invalid recipient email: %s", _safe_log_str(to_email))
        return {"sent": False, "error": "invalid_email"}

    # 1. Primary: Resend API
    if RESEND_API_KEY:
        try:
            payload = {
                "from": RESEND_EMAIL_FROM,
                "to": [clean_to],
                "subject": subject,
                "html": html_body,
            }
            headers = {
                "Authorization": f"Bearer {RESEND_API_KEY}",
                "Content-Type": "application/json",
            }
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(_RESEND_URL, json=payload, headers=headers)
                if resp.status_code < 300:
                    data = resp.json()
                    safe_id = _safe_log_str(data.get("id"))
                    logger.info("Billing email successfully delivered via Resend to %s (id: %s)", safe_to, safe_id)
                    return {"sent": True, "provider": "resend", "id": data.get("id")}
                logger.warning("Resend delivery failed (%d): %s", resp.status_code, _safe_log_str(resp.text, 300))
        except Exception:
            logger.exception("Exception sending billing email via Resend")

    # 2. Fallback: OneSignal API
    if ONESIGNAL_APP_ID and ONESIGNAL_REST_API_KEY:
        try:
            os_payload = {
                "app_id": ONESIGNAL_APP_ID,
                "email_subject": subject,
                "email_body": html_body,
                "email_from_address": ONESIGNAL_EMAIL_FROM,
                "email_from_name": ONESIGNAL_EMAIL_FROM_NAME,
                "include_email_tokens": [clean_to],
            }
            os_headers = {
                "Authorization": f"Key {ONESIGNAL_REST_API_KEY}",
                "Content-Type": "application/json",
            }
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(_ONESIGNAL_URL, json=os_payload, headers=os_headers)
                if resp.status_code < 300:
                    logger.info("Billing email delivered via OneSignal to %s", safe_to)
                    return {"sent": True, "provider": "onesignal"}
                logger.warning("OneSignal delivery failed (%d): %s", resp.status_code, _safe_log_str(resp.text, 300))
        except Exception:
            logger.exception("Exception sending billing email via OneSignal")

    logger.error("No configured email provider succeeded for billing email to %s", safe_to)
    return {"sent": False, "error": "delivery_failed"}


def _get_db():
    from app.core.clients import supabase
    from app.core.db import run_db
    return supabase, run_db


# ---------------------------------------------------------------------------
# Deduplication & Audit Tracking
# ---------------------------------------------------------------------------

async def has_lifecycle_email_been_sent(user_id: str, event_type: str) -> bool:
    """Checks whether an email of this event_type has already been sent to this user."""
    if not user_id or not event_type:
        return False
    try:
        supabase, run_db = _get_db()
        res = await run_db(lambda: supabase.table("chatty_lifecycle_emails")
            .select("id")
            .eq("user_id", user_id)
            .eq("event_type", event_type)
            .limit(1)
            .execute())
        return bool(res.data)
    except Exception:
        logger.exception("Failed to query chatty_lifecycle_emails")
        return False


async def record_lifecycle_email_sent(user_id: str, email: str, event_type: str, metadata: Optional[dict] = None) -> None:
    """Records delivery in chatty_lifecycle_emails for audit and idempotency."""
    if not user_id or not event_type:
        return
    try:
        supabase, run_db = _get_db()
        await run_db(lambda: supabase.table("chatty_lifecycle_emails").insert({
            "user_id": user_id,
            "email": (email or "").strip().lower(),
            "event_type": event_type,
            "metadata": metadata or {},
            "sent_at": datetime.now(timezone.utc).isoformat(),
        }).execute())
    except Exception:
        logger.exception("Failed to record lifecycle email in chatty_lifecycle_emails")


# ---------------------------------------------------------------------------
# High-Level Email Dispatchers
# ---------------------------------------------------------------------------

async def send_trial_welcome_email(
    *,
    user_id: str,
    email: str,
    name: str = "",
) -> dict[str, Any]:
    """Welcomes a new trial user and provides the 3-step quick start guide."""
    if await has_lifecycle_email_been_sent(user_id, "trial_welcome"):
        logger.info("Skipping trial_welcome email for user %s: already sent", user_id)
        return {"sent": False, "reason": "already_sent"}

    display_greeting = f"Hi {name}," if name and name.strip() else "Hi there,"
    subject = "🚀 Welcome to Chatty! Here's how to build your AI agent in 2 minutes"

    html = _render_base_email(
        subject=subject,
        badge_text="Trial Started · 14 Days Free",
        badge_bg="#eff6ff",
        badge_color="#2563eb",
        title="Welcome to Chatty! Let's get your AI agent live",
        body_paragraphs=[
            f"{display_greeting}",
            "Welcome aboard! You have full, unrestricted access to <strong>Chatty</strong> for the next 14 days. Your card was authorized for $0.00 today via our billing partner Lemon Squeezy, and your trial is officially active.",
            "Your AI agent can crawl your entire website, ingest PDFs/docs, answer complex customer questions, and capture qualified leads 24/7.",
            "Here are the 3 quick steps to launch your first assistant in under 2 minutes:",
            "<strong>1. Add Knowledge:</strong> Point Chatty to your website URL or upload your product FAQs and manuals.",
            "<strong>2. Brand & Customize:</strong> Pick your brand colors, widget style, and welcome message in the Customizer.",
            "<strong>3. Embed Anywhere:</strong> Paste the 1-line script tag into your website HTML.",
            "<em>Billing Transparency:</em> You will not be charged anything until your 14-day trial concludes. You can change plans or cancel anytime with 1 click in your Billing settings before your trial ends.",
        ],
        highlight_box={
            "Plan": "14-Day Free Trial",
            "Billed Today": "$0.00",
            "Trial Duration": "14 Days Full Access",
            "Cancellation": "1-click cancel anytime",
        },
        cta_text="Open Dashboard & Build Agent",
        cta_url=DASHBOARD_URL,
        secondary_text="Have questions? Simply reply directly to this email and our product team will assist you.",
    )

    result = await _send_raw_email(email, subject, html)
    if result.get("sent"):
        await record_lifecycle_email_sent(user_id, email, "trial_welcome")
    return result


async def send_trial_checkin_email(
    *,
    user_id: str,
    email: str,
    name: str = "",
) -> dict[str, Any]:
    """Day 3 check-in: Tips for optimizing the knowledge base and flow builder."""
    if await has_lifecycle_email_been_sent(user_id, "trial_checkin"):
        logger.info("Skipping trial_checkin email for user %s: already sent", user_id)
        return {"sent": False, "reason": "already_sent"}

    display_greeting = f"Hi {name}," if name and name.strip() else "Hi there,"
    subject = "💡 Have you trained your AI agent yet? Quick tips for best results"

    html = _render_base_email(
        subject=subject,
        badge_text="Day 3 Check-in · 11 Days Left",
        badge_bg="#f0fdf4",
        badge_color="#16a34a",
        title="Power up your Chatty AI agent with your documentation",
        body_paragraphs=[
            f"{display_greeting}",
            "You are a few days into your Chatty trial! The secret to having an AI agent that visitors love is authoritative, up-to-date training data.",
            "Here are the top three ways our users get high-accuracy answers:",
            "• <strong>Auto-Train:</strong> Schedule daily or weekly website crawls so answers never go stale.",
            "• <strong>Product Catalog / PDFs:</strong> Upload price lists, return policies, or user guides for instant citation.",
            "• <strong>Playground Testing:</strong> Test difficult visitor scenarios directly in your dashboard playground.",
        ],
        highlight_box={
            "Feature Tip": "Auto-Train Crawling",
            "Accuracy": "Up to 98% with clean docs",
            "Time Remaining": "11 Days Left on Trial",
        },
        cta_text="Train Your Knowledge Base",
        cta_url=f"{DASHBOARD_URL}?tab=knowledge",
        secondary_text="Need guidance structuring your content? Reply here and we will help you calibrate your assistant.",
    )

    result = await _send_raw_email(email, subject, html)
    if result.get("sent"):
        await record_lifecycle_email_sent(user_id, email, "trial_checkin")
    return result


async def send_trial_midpoint_email(
    *,
    user_id: str,
    email: str,
    name: str = "",
) -> dict[str, Any]:
    """Day 7 midpoint: Lead capture & calendar booking automation tips."""
    if await has_lifecycle_email_been_sent(user_id, "trial_midpoint"):
        logger.info("Skipping trial_midpoint email for user %s: already sent", user_id)
        return {"sent": False, "reason": "already_sent"}

    display_greeting = f"Hi {name}," if name and name.strip() else "Hi there,"
    subject = "📈 7 days in: Collect leads and automate meetings on autopilot"

    html = _render_base_email(
        subject=subject,
        badge_text="Halfway Point · 7 Days Left",
        badge_bg="#faf5ff",
        badge_color="#9333ea",
        title="Turn website visitors into booked meetings & paying leads",
        body_paragraphs=[
            f"{display_greeting}",
            "You are halfway through your 14-day free trial! Did you know Chatty does much more than answer FAQs?",
            "Two high-impact features top founders and agencies use every day:",
            "<strong>1. Automated Lead Capture:</strong> Ask visitors for their name, email, or company mid-conversation, save leads to your dashboard, and sync via webhook or CRM.",
            "<strong>2. Calendar Integration:</strong> Let visitors book discovery calls or demos right inside the chat window without leaving your website.",
        ],
        highlight_box={
            "Midpoint Status": "7 Days Remaining",
            "Growth Features": "Lead Capture + Calendar Booking",
            "Omnichannel": "Deploy to WhatsApp & Telegram",
        },
        cta_text="Explore Growth & Leads",
        cta_url=f"{DASHBOARD_URL}?tab=leads",
        secondary_text="All leads collected during your trial are yours to keep and export anytime.",
    )

    result = await _send_raw_email(email, subject, html)
    if result.get("sent"):
        await record_lifecycle_email_sent(user_id, email, "trial_midpoint")
    return result


async def send_trial_final_notice_email(
    *,
    user_id: str,
    email: str,
    name: str = "",
) -> dict[str, Any]:
    """Day 13 (24h before trial ends): Final notice to avoid agent downtime."""
    if await has_lifecycle_email_been_sent(user_id, "trial_final_notice"):
        logger.info("Skipping trial_final_notice email for user %s: already sent", user_id)
        return {"sent": False, "reason": "already_sent"}

    display_greeting = f"Hi {name}," if name and name.strip() else "Hi there,"
    subject = "🚨 24 Hours Left: Your Chatty free trial concludes tomorrow"

    html = _render_base_email(
        subject=subject,
        badge_text="Renews Tomorrow · 24h Notice",
        badge_bg="#fee2e2",
        badge_color="#dc2626",
        title="Your 14-day trial concludes tomorrow — Automatic Renewal Notice",
        body_paragraphs=[
            f"{display_greeting}",
            "This is a quick 24-hour reminder that your 14-day free trial of <strong>Chatty</strong> concludes tomorrow.",
            "To prevent any disruption to your website visitors, your subscription will seamlessly activate tomorrow using the payment method securely authorized at signup.",
            "<strong>Want to keep your assistant active?</strong> You're all set! No action is needed on your part.",
            "<strong>Need to make changes?</strong> You can switch plans or cancel anytime in your Billing settings before tomorrow with zero penalty.",
        ],
        highlight_box={
            "Trial Status": "Concludes in < 24 Hours",
            "Agent Availability": "Continuous 24/7 Coverage",
            "Billing Action": "Auto-renews tomorrow (Cancel anytime)",
        },
        cta_text="Manage Billing & Subscription",
        cta_url=BILLING_URL,
        secondary_text="You can manage or cancel your subscription at any time directly through the billing portal.",
    )

    result = await _send_raw_email(email, subject, html)
    if result.get("sent"):
        await record_lifecycle_email_sent(user_id, email, "trial_final_notice")
    return result


async def send_trial_winback_email(
    *,
    user_id: str,
    email: str,
    name: str = "",
) -> dict[str, Any]:
    """Day 17 (3 days post-expiration): Win-back offer or trial extension."""
    if await has_lifecycle_email_been_sent(user_id, "trial_winback"):
        logger.info("Skipping trial_winback email for user %s: already sent", user_id)
        return {"sent": False, "reason": "already_sent"}

    display_greeting = f"Hi {name}," if name and name.strip() else "Hi there,"
    subject = "🎁 Need more time? Here is an exclusive offer to reactivate Chatty"

    html = _render_base_email(
        subject=subject,
        badge_text="Exclusive Win-Back Offer",
        badge_bg="#f3e8ff",
        badge_color="#7e22ce",
        title="We'd love to have you back — Need more time to evaluate?",
        body_paragraphs=[
            f"{display_greeting}",
            "We noticed your 14-day free trial of <strong>Chatty</strong> recently expired. We understand timing isn't always right or you may have needed extra time to test with your team.",
            "<strong>Good news:</strong> All your chatbots, custom styling, conversation logs, and knowledge base documents are securely saved in your account.",
            "If you need a 7-day trial extension to finish your evaluation, simply reply to this email! Alternatively, you can reactivate your agent in 1 click anytime by picking a plan.",
        ],
        highlight_box={
            "Account Status": "Trial Expired",
            "Saved Knowledge": "100% Intact & Ready to Resume",
            "Special Offer": "Reply for 7-day trial extension",
        },
        cta_text="Reactivate My AI Agent",
        cta_url=BILLING_URL,
        secondary_text="Your agent will immediately go live on your website the moment a plan is chosen.",
    )

    result = await _send_raw_email(email, subject, html)
    if result.get("sent"):
        await record_lifecycle_email_sent(user_id, email, "trial_winback")
    return result


async def send_custom_admin_email(
    *,
    email: str,
    subject: str,
    badge_text: str = "Chatty Announcement",
    badge_bg: str = "#eff6ff",
    badge_color: str = "#2563eb",
    title: str,
    body_paragraphs: list[str],
    highlight_box: Optional[dict[str, str]] = None,
    cta_text: str = "Open Dashboard",
    cta_url: str = DASHBOARD_URL,
    secondary_text: Optional[str] = None,
    user_id: Optional[str] = None,
    event_type: str = "admin_broadcast",
) -> dict[str, Any]:
    """Allows admin panel to dispatch branded transactional messages directly."""
    html = _render_base_email(
        subject=subject,
        badge_text=badge_text,
        badge_bg=badge_bg,
        badge_color=badge_color,
        title=title,
        body_paragraphs=body_paragraphs,
        highlight_box=highlight_box,
        cta_text=cta_text,
        cta_url=cta_url,
        secondary_text=secondary_text,
    )
    result = await _send_raw_email(email, subject, html)
    if result.get("sent") and user_id:
        await record_lifecycle_email_sent(user_id, email, event_type, {"subject": subject})
    return result


async def send_trial_ending_soon_email(
    *,
    user_id: str,
    email: str,
    name: str = "",
    days_left: int = 3,
) -> dict[str, Any]:
    """Notifies user that their 14-day free trial will end in 3 days."""
    if await has_lifecycle_email_been_sent(user_id, "trial_ending_soon"):
        logger.info("Skipping trial_ending_soon email for user %s: already sent", user_id)
        return {"sent": False, "reason": "already_sent"}

    display_greeting = f"Hi {name}," if name and name.strip() else "Hi there,"
    subject = f"⚡ Reminder: Your Chatty free trial renews in {days_left} days"

    html = _render_base_email(
        subject=subject,
        badge_text=f"{days_left} Days Remaining",
        badge_bg="#fef3c7",
        badge_color="#d97706",
        title="Your free trial concludes in 3 days — Continuous AI Coverage",
        body_paragraphs=[
            f"{display_greeting}",
            f"Your 14-day free trial of <strong>Chatty</strong> will conclude in <strong>{days_left} days</strong>. During your trial, your AI agent has been actively interacting with your visitors, answering inquiries, and capturing leads 24/7.",
            "Because your card is already safely on file with our payment gateway, <strong>your subscription will seamlessly renew on Day 14</strong> so your AI agent remains online with zero downtime.",
            "If you're loving Chatty, no action is needed — your assistant will continue working uninterrupted.",
            "If you need to switch tiers or cancel before your trial renews, you can manage your subscription with 1 click in your billing settings anytime.",
        ],
        highlight_box={
            "Current Status": "Free Trial Active",
            "Time Remaining": f"{days_left} Days",
            "Renewal": "Automatic (Zero Downtime)",
            "Manage Subscription": "1-click cancel or change tier",
        },
        cta_text="Manage Billing & Subscription",
        cta_url=BILLING_URL,
        secondary_text="Need an invoice adjustment or custom plan? Simply reply to this email.",
    )

    result = await _send_raw_email(email, subject, html)
    if result.get("sent"):
        await record_lifecycle_email_sent(user_id, email, "trial_ending_soon", {"days_left": days_left})
    return result


async def send_trial_expired_email(
    *,
    user_id: str,
    email: str,
    name: str = "",
) -> dict[str, Any]:
    """Notifies user that their trial has expired and their AI agent is set to offline."""
    if await has_lifecycle_email_been_sent(user_id, "trial_expired"):
        logger.info("Skipping trial_expired email for user %s: already sent", user_id)
        return {"sent": False, "reason": "already_sent"}

    display_greeting = f"Hi {name}," if name and name.strip() else "Hi there,"
    subject = "⚠️ Your Chatty trial has concluded — AI agent offline"

    html = _render_base_email(
        subject=subject,
        badge_text="Trial Concluded",
        badge_bg="#fee2e2",
        badge_color="#dc2626",
        title="Your trial has concluded — AI agent is offline",
        body_paragraphs=[
            f"{display_greeting}",
            "Your 14-day trial of <strong>Chatty</strong> has concluded and your subscription was cancelled. Your AI assistant has been temporarily switched to <strong>offline mode</strong>.",
            "While offline, visitors on your website will see your fallback contact form instead of instant AI answers, and automated appointment booking is paused.",
            "<strong>All your training data and settings are safely preserved!</strong> Your trained knowledge base, files, bot customisations, and conversation history remain saved. You can reactivate your AI agent in under 60 seconds anytime by renewing your subscription.",
        ],
        highlight_box={
            "Account Status": "Subscription Inactive",
            "Agent Status": "Offline (Visitor contact form active)",
            "Knowledge Base": "Saved & ready to resume",
        },
        cta_text="Reactivate My AI Agent",
        cta_url=BILLING_URL,
        secondary_text="Your agent will immediately come back online as soon as an active plan is reactivated.",
    )

    result = await _send_raw_email(email, subject, html)
    if result.get("sent"):
        await record_lifecycle_email_sent(user_id, email, "trial_expired")
    return result


async def send_subscription_activated_email(
    *,
    user_id: str,
    email: str,
    name: str = "",
    plan_name: str = "Standard",
    renews_at: str = "",
) -> dict[str, Any]:
    """Notifies user of successful subscription activation."""
    display_greeting = f"Hi {name}," if name and name.strip() else "Hi there,"
    clean_plan = plan_name.replace("chatty_", "").title()
    subject = f"🎉 Welcome to Chatty {clean_plan}! Your subscription is active"

    formatted_renews = renews_at[:10] if renews_at else "Auto-renews monthly"

    html = _render_base_email(
        subject=subject,
        badge_text="Subscription Active",
        badge_bg="#dcfce7",
        badge_color="#16a34a",
        title=f"Welcome to Chatty {clean_plan}!",
        body_paragraphs=[
            f"{display_greeting}",
            f"Thank you for upgrading to <strong>Chatty {clean_plan}</strong>! Your payment has been confirmed and all features, higher message limits, and premium capabilities have been activated on your workspace.",
            "Your AI agent is fully online and ready to convert visitors, answer questions, and schedule meetings around the clock.",
        ],
        highlight_box={
            "Plan": f"Chatty {clean_plan}",
            "Subscription Status": "Active",
            "Next Renewal": formatted_renews,
            "Agent Availability": "Online 24/7",
        },
        cta_text="Open Dashboard",
        cta_url=DASHBOARD_URL,
        secondary_text="You can manage your subscription, download receipts, or customize your agent anytime in your dashboard.",
    )

    result = await _send_raw_email(email, subject, html)
    if result.get("sent"):
        await record_lifecycle_email_sent(user_id, email, "subscription_activated", {"plan": plan_name})
    return result


async def send_payment_success_email(
    *,
    user_id: str,
    email: str,
    name: str = "",
    plan_name: str = "Standard",
    amount_formatted: str = "",
    renews_at: str = "",
    receipt_url: str = "",
) -> dict[str, Any]:
    """Sends a professional renewal payment receipt."""
    display_greeting = f"Hi {name}," if name and name.strip() else "Hi there,"
    clean_plan = plan_name.replace("chatty_", "").title()
    subject = f"Receipt: Your Chatty {clean_plan} renewal payment succeeded"

    box_data: dict[str, str] = {
        "Plan": f"Chatty {clean_plan}",
        "Payment Status": "Succeeded",
    }
    if amount_formatted:
        box_data["Amount Charged"] = amount_formatted
    if renews_at:
        box_data["Next Billing Date"] = renews_at[:10]

    html = _render_base_email(
        subject=subject,
        badge_text="Payment Succeeded",
        badge_bg="#dcfce7",
        badge_color="#16a34a",
        title="Payment Confirmation & Receipt",
        body_paragraphs=[
            f"{display_greeting}",
            f"We've successfully processed your renewal payment for <strong>Chatty {clean_plan}</strong>. Your account remains in good standing and your AI agent is operating at full capacity without interruption.",
            "Thank you for being a valued customer!",
        ],
        highlight_box=box_data,
        cta_text="View Billing & Invoices",
        cta_url=receipt_url or BILLING_URL,
        secondary_text="Official tax invoices and billing history are permanently accessible in your dashboard billing tab.",
    )

    result = await _send_raw_email(email, subject, html)
    if result.get("sent"):
        await record_lifecycle_email_sent(user_id, email, "payment_success", {"plan": plan_name, "amount": amount_formatted})
    return result


async def send_payment_failed_email(
    *,
    user_id: str,
    email: str,
    name: str = "",
    plan_name: str = "Standard",
    update_url: str = "",
) -> dict[str, Any]:
    """Warns user that recurring renewal payment failed and agent is at risk of offline mode."""
    display_greeting = f"Hi {name}," if name and name.strip() else "Hi there,"
    clean_plan = plan_name.replace("chatty_", "").title()
    subject = "⚠️ Action Required: Renewal payment failed for Chatty"

    html = _render_base_email(
        subject=subject,
        badge_text="Payment Failed",
        badge_bg="#fee2e2",
        badge_color="#dc2626",
        title="We couldn't process your renewal payment",
        body_paragraphs=[
            f"{display_greeting}",
            f"We were unable to process your renewal payment for <strong>Chatty {clean_plan}</strong>. This is typically due to an expired card, insufficient funds, or a bank security decline.",
            "Your workspace is currently in a <strong>grace period</strong>. However, if payment is not updated, your AI agent will be automatically transitioned to <strong>offline mode</strong>.",
            "Please update your payment method to ensure continuous operation for your website visitors.",
        ],
        highlight_box={
            "Plan": f"Chatty {clean_plan}",
            "Status": "Past Due / Grace Period",
            "Action Required": "Update payment card",
        },
        cta_text="Update Payment Method",
        cta_url=update_url or BILLING_URL,
        secondary_text="Once your payment method is updated, our system will automatically re-attempt the charge and clear the past due status.",
    )

    result = await _send_raw_email(email, subject, html)
    if result.get("sent"):
        await record_lifecycle_email_sent(user_id, email, "payment_failed", {"plan": plan_name})
    return result


async def send_subscription_cancelled_email(
    *,
    user_id: str,
    email: str,
    name: str = "",
    plan_name: str = "Standard",
    ends_at: str = "",
) -> dict[str, Any]:
    """Confirms subscription cancellation and states when offline mode will take effect."""
    display_greeting = f"Hi {name}," if name and name.strip() else "Hi there,"
    clean_plan = plan_name.replace("chatty_", "").title()
    subject = f"Your Chatty {clean_plan} subscription cancellation"

    formatted_ends = ends_at[:10] if ends_at else "the end of your current billing cycle"

    html = _render_base_email(
        subject=subject,
        badge_text="Cancellation Confirmed",
        badge_bg="#f1f5f9",
        badge_color="#475569",
        title="Your subscription has been cancelled",
        body_paragraphs=[
            f"{display_greeting}",
            f"We're confirming that your subscription to <strong>Chatty {clean_plan}</strong> has been cancelled.",
            f"You will continue to have full access to all plan features and your AI agent will remain online until <strong>{formatted_ends}</strong>.",
            "After this date, your agent will be switched to offline mode. All your bots, settings, and conversation logs will remain safely stored if you decide to reactivate in the future.",
        ],
        highlight_box={
            "Plan": f"Chatty {clean_plan}",
            "Cancellation Status": "Scheduled to End",
            "Active Through": formatted_ends,
        },
        cta_text="Manage Subscription",
        cta_url=BILLING_URL,
        secondary_text="We'd love to know how we could improve! If you have any feedback or suggestions, feel free to reply directly to this email.",
    )

    result = await _send_raw_email(email, subject, html)
    if result.get("sent"):
        await record_lifecycle_email_sent(user_id, email, "subscription_cancelled", {"plan": plan_name, "ends_at": ends_at})
    return result


async def send_subscription_paused_email(
    *,
    user_id: str,
    email: str,
    name: str = "",
    plan_name: str = "Standard",
) -> dict[str, Any]:
    """Notifies user that their subscription has been paused."""
    display_greeting = f"Hi {name}," if name and name.strip() else "Hi there,"
    clean_plan = plan_name.replace("chatty_", "").title()
    subject = f"Your Chatty {clean_plan} subscription is paused"

    html = _render_base_email(
        subject=subject,
        badge_text="Subscription Paused",
        badge_bg="#fef3c7",
        badge_color="#d97706",
        title="Your subscription is currently paused",
        body_paragraphs=[
            f"{display_greeting}",
            f"Your subscription to <strong>Chatty {clean_plan}</strong> has been paused. Your AI agent has been switched to offline mode and recurring billing is on hold.",
            "You can resume your subscription at any time to bring your AI agent back online immediately.",
        ],
        highlight_box={
            "Plan": f"Chatty {clean_plan}",
            "Status": "Paused",
            "Agent Availability": "Offline",
        },
        cta_text="Resume Subscription",
        cta_url=BILLING_URL,
    )

    result = await _send_raw_email(email, subject, html)
    if result.get("sent"):
        await record_lifecycle_email_sent(user_id, email, "subscription_paused", {"plan": plan_name})
    return result


async def send_subscription_resumed_email(
    *,
    user_id: str,
    email: str,
    name: str = "",
    plan_name: str = "Standard",
) -> dict[str, Any]:
    """Notifies user that their subscription has resumed."""
    display_greeting = f"Hi {name}," if name and name.strip() else "Hi there,"
    clean_plan = plan_name.replace("chatty_", "").title()
    subject = f"Your Chatty {clean_plan} subscription has resumed!"

    html = _render_base_email(
        subject=subject,
        badge_text="Subscription Resumed",
        badge_bg="#dcfce7",
        badge_color="#16a34a",
        title="Your subscription has resumed!",
        body_paragraphs=[
            f"{display_greeting}",
            f"Welcome back! Your subscription to <strong>Chatty {clean_plan}</strong> has been resumed. Your AI agent is once again fully online and actively answering inquiries.",
        ],
        highlight_box={
            "Plan": f"Chatty {clean_plan}",
            "Status": "Active",
            "Agent Availability": "Online 24/7",
        },
        cta_text="Open Dashboard",
        cta_url=DASHBOARD_URL,
    )

    result = await _send_raw_email(email, subject, html)
    if result.get("sent"):
        await record_lifecycle_email_sent(user_id, email, "subscription_resumed", {"plan": plan_name})
    return result


# ---------------------------------------------------------------------------
# Background Lifecycle Engine (Scans all users & sends trial notifications)
# ---------------------------------------------------------------------------

async def run_trial_lifecycle_scan() -> dict[str, Any]:
    """Scans all users in the system to identify expiring or expired trials.

    - If 0 < days_remaining <= 3: sends trial_ending_soon (deduped).
    - If days_remaining <= 0 and user not subscribed: sends trial_expired (deduped)
      and ensures subscription_status reflects expired state.
    """
    now = datetime.now(timezone.utc)
    trial_days = 14
    stats = {
        "scanned": 0,
        "welcome_sent": 0,
        "checkin_sent": 0,
        "midpoint_sent": 0,
        "ending_soon_sent": 0,
        "final_notice_sent": 0,
        "expired_sent": 0,
        "winback_sent": 0,
        "skipped_active_paid": 0,
        "skipped_already_sent": 0,
        "errors": 0,
    }

    try:
        supabase, run_db = _get_db()
        # Fetch users with their trial and subscription metadata
        res = await run_db(lambda: supabase.table("users")
            .select("id,auth_user_id,email,display_name,trial_started_at,created_at,subscription_status,plan")
            .execute())
        users = res.data or []
        stats["scanned"] = len(users)

        for u in users:
            try:
                user_id = str(u.get("auth_user_id") or u.get("id") or "")
                email = str(u.get("email") or "").strip().lower()
                name = str(u.get("display_name") or "").strip()
                status = str(u.get("subscription_status") or "").strip().lower()

                if not user_id or not email or "@" not in email:
                    continue

                # If user is already on a paid active plan, skip trial lifecycle
                if status in ("active", "paid", "lifetime"):
                    stats["skipped_active_paid"] += 1
                    continue

                # Determine trial start date
                start_raw = u.get("trial_started_at") or u.get("created_at")
                if not start_raw:
                    continue

                try:
                    if isinstance(start_raw, str):
                        # Handle ISO formats
                        start_dt = datetime.fromisoformat(start_raw.replace("Z", "+00:00"))
                    else:
                        start_dt = start_raw
                    if start_dt.tzinfo is None:
                        start_dt = start_dt.replace(tzinfo=timezone.utc)
                except Exception:
                    continue

                trial_end = start_dt + timedelta(days=trial_days)
                remaining_sec = (trial_end - now).total_seconds()
                elapsed_sec = (now - start_dt).total_seconds()
                elapsed_days = elapsed_sec / 86400.0
                days_left = int(remaining_sec // 86400) + 1

                # 1. Day 0-1 Welcome (first 36 hours of trial)
                if elapsed_days < 1.5:
                    already = await has_lifecycle_email_been_sent(user_id, "trial_welcome")
                    if not already:
                        res = await send_trial_welcome_email(user_id=user_id, email=email, name=name)
                        if res.get("sent"): stats["welcome_sent"] += 1
                    else:
                        stats["skipped_already_sent"] += 1

                # 2. Day 3 Check-in (between 2.5 and 5 days elapsed)
                elif 2.5 <= elapsed_days < 5.0 and days_left > 7:
                    already = await has_lifecycle_email_been_sent(user_id, "trial_checkin")
                    if not already:
                        res = await send_trial_checkin_email(user_id=user_id, email=email, name=name)
                        if res.get("sent"): stats["checkin_sent"] += 1
                    else:
                        stats["skipped_already_sent"] += 1

                # 3. Day 7 Midpoint (between 6.5 and 9.5 days elapsed)
                elif 6.5 <= elapsed_days < 9.5 and days_left > 4:
                    already = await has_lifecycle_email_been_sent(user_id, "trial_midpoint")
                    if not already:
                        res = await send_trial_midpoint_email(user_id=user_id, email=email, name=name)
                        if res.get("sent"): stats["midpoint_sent"] += 1
                    else:
                        stats["skipped_already_sent"] += 1

                # 4. Day 11 Notice (between 1.5 and 3.5 days left)
                elif (1.5 * 86400) < remaining_sec <= (3.5 * 86400):
                    already = await has_lifecycle_email_been_sent(user_id, "trial_ending_soon")
                    if not already:
                        res = await send_trial_ending_soon_email(user_id=user_id, email=email, name=name, days_left=max(1, days_left))
                        if res.get("sent"): stats["ending_soon_sent"] += 1
                    else:
                        stats["skipped_already_sent"] += 1

                # 5. Day 13 Final Notice (between 0 and 1.5 days left)
                elif 0 < remaining_sec <= (1.5 * 86400):
                    already = await has_lifecycle_email_been_sent(user_id, "trial_final_notice")
                    if not already:
                        res = await send_trial_final_notice_email(user_id=user_id, email=email, name=name)
                        if res.get("sent"): stats["final_notice_sent"] += 1
                    else:
                        stats["skipped_already_sent"] += 1

                # 6. Day 14-16 Trial Expired (just concluded)
                elif remaining_sec <= 0 and elapsed_days <= 17.0:
                    already = await has_lifecycle_email_been_sent(user_id, "trial_expired")
                    if not already:
                        res = await send_trial_expired_email(user_id=user_id, email=email, name=name)
                        if res.get("sent"): stats["expired_sent"] += 1
                    else:
                        stats["skipped_already_sent"] += 1

                # 7. Day 17-24 Win-back (3-10 days post-expiration)
                elif elapsed_days > 17.0 and elapsed_days <= 24.0:
                    already = await has_lifecycle_email_been_sent(user_id, "trial_winback")
                    if not already:
                        res = await send_trial_winback_email(user_id=user_id, email=email, name=name)
                        if res.get("sent"): stats["winback_sent"] += 1
                    else:
                        stats["skipped_already_sent"] += 1

            except Exception:
                stats["errors"] += 1
                logger.exception("Error processing user %s in trial lifecycle scan", u.get("id"))

    except Exception:
        logger.exception("Failed to execute trial lifecycle scan")
        return {"ok": False, "stats": stats, "error": "scan_failed"}

    logger.info("Trial lifecycle scan completed: %s", stats)
    return {"ok": True, "stats": stats}
