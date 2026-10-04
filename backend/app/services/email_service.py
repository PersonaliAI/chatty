"""Email Service for Chatty Enterprise Helpdesk.
Handles outbound threaded email replies with RFC 2822 In-Reply-To & References headers.
"""

from __future__ import annotations

import html as _html
import logging
import os
import re
from typing import Any, Optional

import httpx

logger = logging.getLogger("chatty.email_service")

RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "").strip()
RESEND_EMAIL_FROM = os.environ.get("RESEND_EMAIL_FROM", "Chatty Support <support@personaliai.com>").strip()
_RESEND_URL = "https://api.resend.com/emails"

ONESIGNAL_APP_ID = os.environ.get("ONESIGNAL_APP_ID", "").strip()
ONESIGNAL_REST_API_KEY = os.environ.get("ONESIGNAL_REST_API_KEY", "").strip()
ONESIGNAL_EMAIL_FROM = os.environ.get("ONESIGNAL_EMAIL_FROM", "support@personaliai.com").strip()
ONESIGNAL_EMAIL_FROM_NAME = os.environ.get("ONESIGNAL_EMAIL_FROM_NAME", "Chatty Support").strip()
_ONESIGNAL_URL = "https://api.onesignal.com/notifications"


def extract_email(addr: Any) -> str:
    """Extract clean email address from string like 'John Doe <john@example.com>' or dict."""
    if isinstance(addr, dict):
        addr = addr.get("email") or ""
    if not isinstance(addr, str):
        return ""
    m = re.search(r"<([^>]+)>", addr)
    if m:
        return m.group(1).strip().lower()
    return addr.strip().lower()


def extract_name(addr: Any) -> str:
    """Extract display name from string like 'John Doe <john@example.com>'."""
    if isinstance(addr, dict):
        return (addr.get("name") or addr.get("email") or "").strip()
    if not isinstance(addr, str):
        return ""
    m = re.match(r"^([^<]+)<", addr)
    if m:
        return m.group(1).strip().strip('"\'')
    return addr.split("@")[0].strip()


def format_ticket_subject(original_subject: str, session_id: str) -> str:
    """Formats an email subject with [Ticket #ID] stamp."""
    sub = (original_subject or "Support Request").strip()
    tag = f"[Ticket #{session_id[:8]}]"
    if tag in sub:
        return sub if sub.lower().startswith("re:") else f"Re: {sub}"
    # Remove any existing Re: prefix to clean up
    clean_sub = re.sub(r"^(re:\s*)+", "", sub, flags=re.IGNORECASE).strip()
    return f"Re: {clean_sub} {tag}"


def render_ticket_email_html(
    agent_name: str,
    bot_name: str,
    body_text: str,
    session_id: str,
    ticket_subject: str,
) -> str:
    """Renders a modern, responsive HTML support reply email."""
    escaped_body = _html.escape(body_text).replace("\n", "<br/>")
    escaped_subject = _html.escape(ticket_subject)
    escaped_agent = _html.escape(agent_name or "Support Team")
    escaped_bot = _html.escape(bot_name or "Chatty")

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>{escaped_subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1e293b;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background-color:#ffffff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.03);">
          <!-- Header -->
          <tr>
            <td style="background-color:#0f172a;padding:20px 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span style="color:#ffffff;font-size:16px;font-weight:700;letter-spacing:-0.02em;">{escaped_bot} Support</span>
                  </td>
                  <td align="right">
                    <span style="display:inline-block;background-color:#1e293b;color:#94a3b8;font-size:11px;font-weight:600;padding:4px 10px;border-radius:20px;font-family:monospace;">Ticket #{session_id[:8]}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding:28px 28px 12px;">
              <div style="font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:12px;">
                Update from {escaped_agent}
              </div>
              <div style="font-size:14px;line-height:1.7;color:#1e293b;background-color:#f8fafc;padding:18px;border-radius:12px;border:1px solid #e2e8f0;">
                {escaped_body}
              </div>
            </td>
          </tr>

          <!-- Reply notice -->
          <tr>
            <td style="padding:12px 28px 28px;">
              <p style="margin:0;font-size:12px;color:#64748b;line-height:1.5;">
                💬 <strong>Need more help?</strong> Simply reply directly to this email and our team will be notified immediately.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f1f5f9;padding:16px 28px;border-top:1px solid #e2e8f0;">
              <p style="margin:0;font-size:11px;color:#94a3b8;line-height:1.4;">
                This message was sent by {escaped_bot} Customer Support in response to your inquiry. Reference Ticket ID: #{session_id}.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


def render_campaign_email_html(bot_name: str, body_text: str, unsubscribe_url: str = "") -> str:
    """Render a small, safe transactional campaign email.

    Campaigns must not reuse ticket wording or ticket identifiers.  Keep the
    output intentionally plain: content comes from an operator-authored,
    consent-gated campaign and is HTML-escaped before provider delivery.
    """
    escaped_body = _html.escape(body_text).replace("\n", "<br/>")
    escaped_bot = _html.escape(bot_name or "Chatty")
    unsubscribe = f'<p style="margin:22px 0 0;font-size:11px;color:#64748b"><a href="{_html.escape(unsubscribe_url, quote=True)}" style="color:#64748b">Unsubscribe from marketing emails</a></p>' if unsubscribe_url else ""
    return f"""<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"></head>
<body style=\"margin:0;padding:24px;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1e293b\">
  <main style=\"max-width:600px;margin:auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:28px;line-height:1.6\">
    <p style=\"margin:0 0 18px;font-weight:700\">{escaped_bot}</p>
    <div>{escaped_body}</div>
    {unsubscribe}
  </main>
</body></html>"""


async def send_campaign_email(*, to_email: str, subject: str, body_text: str, bot_name: str = "Chatty", unsubscribe_url: str = "") -> dict[str, Any]:
    """Deliver a consent-checked campaign through configured email providers.

    The worker owns consent/frequency checks. This provider boundary only
    validates the destination and returns a structured result so missing or
    failing providers cannot be mistaken for a delivered message.
    """
    clean_to = extract_email(to_email)
    clean_subject = str(subject or "Update from Chatty").strip()[:200]
    if not clean_to or "@" not in clean_to:
        return {"sent": False, "error": "invalid campaign recipient email"}
    html_content = render_campaign_email_html(bot_name, body_text, unsubscribe_url)

    if RESEND_API_KEY:
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.post(_RESEND_URL, json={
                    "from": RESEND_EMAIL_FROM,
                    "to": [clean_to],
                    "subject": clean_subject,
                    "html": html_content,
                }, headers={"Authorization": f"Bearer {RESEND_API_KEY}", "Content-Type": "application/json"})
            if response.status_code < 300:
                return {"sent": True, "provider": "resend", "id": response.json().get("id")}
            logger.warning("Resend campaign delivery failed (%d): %s", response.status_code, response.text[:300])
        except Exception:
            logger.exception("Resend campaign delivery failed")

    if ONESIGNAL_APP_ID and ONESIGNAL_REST_API_KEY:
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.post(_ONESIGNAL_URL, json={
                    "app_id": ONESIGNAL_APP_ID,
                    "email_subject": clean_subject,
                    "email_body": html_content,
                    "email_from_address": ONESIGNAL_EMAIL_FROM,
                    "email_from_name": bot_name or ONESIGNAL_EMAIL_FROM_NAME,
                    "include_email_tokens": [clean_to],
                }, headers={"Authorization": f"Key {ONESIGNAL_REST_API_KEY}", "Content-Type": "application/json"})
            if response.status_code < 300:
                return {"sent": True, "provider": "onesignal"}
            logger.warning("OneSignal campaign delivery failed (%d): %s", response.status_code, response.text[:300])
        except Exception:
            logger.exception("OneSignal campaign delivery failed")

    return {"sent": False, "reason": "no_email_provider_configured"}


async def send_ticket_reply_email(
    *,
    to_email: str,
    subject: str,
    body_text: str,
    session_id: str,
    bot_name: str = "Chatty Support",
    agent_name: str = "Support Team",
    in_reply_to_message_id: Optional[str] = None,
    reply_to_address: Optional[str] = None,
) -> dict[str, Any]:
    """Sends an outbound threaded email reply to a customer ticket.
    Injects RFC 2822 In-Reply-To and References headers to maintain native thread in Gmail/Outlook."""
    clean_to = extract_email(to_email)
    if not clean_to:
        return {"sent": False, "error": "Invalid recipient email"}

    formatted_subject = format_ticket_subject(subject, session_id)
    html_content = render_ticket_email_html(agent_name, bot_name, body_text, session_id, formatted_subject)

    # 1. Try Resend API
    if RESEND_API_KEY:
        try:
            payload: dict[str, Any] = {
                "from": RESEND_EMAIL_FROM,
                "to": [clean_to],
                "subject": formatted_subject,
                "html": html_content,
            }
            if reply_to_address:
                payload["reply_to"] = reply_to_address

            # Add In-Reply-To / References for email client threading
            if in_reply_to_message_id:
                clean_msg_id = in_reply_to_message_id.strip().strip("<>")
                formatted_msg_id = f"<{clean_msg_id}>"
                payload["headers"] = {
                    "In-Reply-To": formatted_msg_id,
                    "References": formatted_msg_id,
                }

            headers = {
                "Authorization": f"Bearer {RESEND_API_KEY}",
                "Content-Type": "application/json",
            }

            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(_RESEND_URL, json=payload, headers=headers)
                if resp.status_code < 300:
                    data = resp.json()
                    logger.info("Outbound ticket reply sent via Resend for session %s, ID: %s", session_id, data.get("id"))
                    return {"sent": True, "provider": "resend", "id": data.get("id")}
                logger.warning("Resend reply failed (%d): %s", resp.status_code, resp.text[:300])
        except Exception as e:
            logger.exception("Error sending ticket reply via Resend: %s", e)

    # 2. Try OneSignal Email Fallback
    if ONESIGNAL_APP_ID and ONESIGNAL_REST_API_KEY:
        try:
            os_payload = {
                "app_id": ONESIGNAL_APP_ID,
                "email_subject": formatted_subject,
                "email_body": html_content,
                "email_from_address": ONESIGNAL_EMAIL_FROM,
                "email_from_name": bot_name or ONESIGNAL_EMAIL_FROM_NAME,
                "include_email_tokens": [clean_to],
            }
            if reply_to_address:
                os_payload["email_reply_to_address"] = reply_to_address

            os_headers = {
                "Authorization": f"Key {ONESIGNAL_REST_API_KEY}",
                "Content-Type": "application/json",
            }
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(_ONESIGNAL_URL, json=os_payload, headers=os_headers)
                if resp.status_code < 300:
                    logger.info("Outbound ticket reply sent via OneSignal for session %s", session_id)
                    return {"sent": True, "provider": "onesignal"}
                logger.warning("OneSignal email failed (%d): %s", resp.status_code, resp.text[:300])
        except Exception as e:
            logger.exception("Error sending ticket reply via OneSignal: %s", e)

    logger.warning("No email provider configured or delivery failed for ticket reply %s", session_id)
    return {"sent": False, "reason": "no_email_provider_configured"}
