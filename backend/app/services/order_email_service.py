"""Transactional Order & Payment Status Email Service for Chatty.

Delivers responsive, branded HTML emails to customers and bot owners when:
1. Payment succeeds (Official Payment Receipt & Confirmation)
2. Payment is refunded (Refund Processed Notification)
3. Payment fails / requires action (Payment Retry Link)
4. Checkout link is dispatched / resent (Invoice & Checkout Link)
5. Bot owner receives an instant New Sale Alert
"""

from __future__ import annotations

import html as _html
import logging
from datetime import datetime, timezone
from typing import Any, Optional

from app.services.billing_email_service import _send_raw_email
from app.services.email_templates_common import (
    render_email_head,
    render_gdpr_footer_html,
)

logger = logging.getLogger("chatty.order_emails")

PROVIDER_LABELS = {
    "polar": "Polar.sh",
    "stripe": "Stripe",
    "lemonsqueezy": "Lemon Squeezy",
    "paypal": "PayPal",
}


def format_amount(amount_cents: int, currency: str = "USD") -> str:
    cur = (currency or "USD").upper()
    val = (amount_cents or 0) / 100.0
    if cur == "USD":
        return f"${val:,.2f} USD"
    if cur == "EUR":
        return f"€{val:,.2f} EUR"
    if cur == "GBP":
        return f"£{val:,.2f} GBP"
    return f"{val:,.2f} {cur}"


def render_order_status_email(
    order: dict[str, Any],
    bot_name: str = "Chatty Store",
    email_config: Optional[dict[str, Any]] = None,
) -> tuple[str, str]:
    """Build (subject, html_body) for any order status: succeeded, refunded, failed, pending."""
    cfg = email_config or {}
    status = str(order.get("status") or "succeeded").lower()
    title = str(order.get("title") or "Order Purchase").strip()
    customer_name = str(order.get("customer_name") or "Valued Customer").strip()
    customer_email = str(order.get("customer_email") or "").strip()
    amount_cents = int(order.get("amount_cents") or 0)
    currency = str(order.get("currency") or "USD").upper()
    amount_str = format_amount(amount_cents, currency)
    provider_raw = str(order.get("provider") or "stripe").lower()
    provider_label = PROVIDER_LABELS.get(provider_raw, provider_raw.capitalize())
    ref_id = str(order.get("gateway_order_id") or order.get("id") or "N/A")[:36]
    checkout_url = str(order.get("checkout_url") or "https://chatty.personaliai.com").strip()

    brand_color = str(cfg.get("receipt_brand_color") or "#f97316").strip()
    if not brand_color.startswith("#") or len(brand_color) not in (4, 7):
        brand_color = "#f97316"
    custom_message = str(cfg.get("receipt_custom_message") or "").strip()
    support_email = str(cfg.get("receipt_support_email") or "support@personaliai.com").strip()

    now_str = datetime.now(timezone.utc).strftime("%b %d, %Y at %H:%M UTC")

    if status == "succeeded":
        subject = f"Payment Receipt: {title} ({amount_str}) — {bot_name}"
        badge_text = "Payment Confirmed"
        badge_bg = "rgba(16, 185, 129, 0.18)"
        badge_color = "#34d399"
        headline = f"Thank you for your purchase, {customer_name}!"
        intro_html = (
            f"We have received your payment of <strong>{_html.escape(amount_str)}</strong> for "
            f"<strong>{_html.escape(title)}</strong>. Your transaction has been verified and recorded."
        )
        status_label = "Paid & Confirmed"
        cta_text = "View Order Confirmation"
        cta_url = checkout_url if checkout_url.startswith("http") else "https://chatty.personaliai.com"
    elif status == "refunded":
        subject = f"Refund Processed: {title} ({amount_str}) — {bot_name}"
        badge_text = "Refund Issued"
        badge_bg = "rgba(168, 85, 247, 0.20)"
        badge_color = "#c084fc"
        headline = f"Your refund of {amount_str} has been processed"
        intro_html = (
            f"Hi {_html.escape(customer_name)}, a refund of <strong>{_html.escape(amount_str)}</strong> "
            f"for <strong>{_html.escape(title)}</strong> has been initiated via {_html.escape(provider_label)}. "
            "Please allow 3–5 business days for the funds to appear on your original payment statement."
        )
        status_label = "Refunded"
        cta_text = "Contact Support"
        cta_url = f"mailto:{support_email}"
    elif status in ("failed", "cancelled"):
        subject = f"Action Required: Payment unsuccessful for {title} — {bot_name}"
        badge_text = "Payment Unsuccessful"
        badge_bg = "rgba(239, 68, 68, 0.20)"
        badge_color = "#f87171"
        headline = "We couldn't complete your payment"
        intro_html = (
            f"Hi {_html.escape(customer_name)}, your recent payment attempt of "
            f"<strong>{_html.escape(amount_str)}</strong> for <strong>{_html.escape(title)}</strong> "
            "could not be completed. You can safely retry using your secure checkout link below."
        )
        status_label = "Failed / Action Needed"
        cta_text = "Retry Secure Checkout"
        cta_url = checkout_url
    else:
        subject = f"Complete Your Purchase: {title} ({amount_str}) — {bot_name}"
        badge_text = "Awaiting Payment"
        badge_bg = "rgba(245, 158, 11, 0.20)"
        badge_color = "#fbbf24"
        headline = f"Your secure checkout link for {title}"
        intro_html = (
            f"Hi {_html.escape(customer_name)}, your order for <strong>{_html.escape(title)}</strong> "
            f"(<strong>{_html.escape(amount_str)}</strong>) is ready. Click the button below to complete "
            f"your payment securely via {_html.escape(provider_label)}."
        )
        status_label = "Pending Payment"
        cta_text = f"Pay {amount_str} Now"
        cta_url = checkout_url

    custom_note_html = ""
    if custom_message:
        custom_note_html = f"""
        <div style="margin:20px 0;padding:16px 20px;background-color:#fff7ed;border-left:4px solid {_html.escape(brand_color)};border-radius:8px;">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#9a3412;margin-bottom:4px;">
            Message from {_html.escape(bot_name)}
          </div>
          <div style="font-size:14px;line-height:22px;color:#431407;">
            {_html.escape(custom_message)}
          </div>
        </div>
        """

    escaped_bot = _html.escape(bot_name)
    escaped_brand_color = _html.escape(brand_color)
    escaped_cta_url = _html.escape(cta_url, quote=True)
    escaped_cta_text = _html.escape(cta_text)
    escaped_support_email = _html.escape(support_email, quote=True)

    head_html = render_email_head(subject)
    footer_html = render_gdpr_footer_html(
        reason_text=f"You received this transaction and payment record in connection with your purchase from {escaped_bot} via Chatty. Legal basis: GDPR Art. 6(1)(b) - Performance of a Contract.",
        preferences_url=None,
        support_email=support_email,
        brand_color=brand_color,
        dark_mode=False,
        is_marketing=False,
    )

    html_body = f"""<!DOCTYPE html>
<html lang="en">
{head_html}
<body style="margin:0;padding:0;background-color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="email-wrapper" style="background-color:#0f172a;padding:36px 16px;width:100% !important;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="email-container email-card" style="max-width:580px;width:100%;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 20px 25px -5px rgba(0,0,0,0.35);">
          <!-- Header -->
          <tr>
            <td class="email-pad-header" style="background-color:#090d16;padding:24px 32px;border-bottom:1px solid #1e293b;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td class="email-stack-col">
                    <span style="display:inline-block;color:#ffffff;font-size:18px;font-weight:700;letter-spacing:-0.02em;">
                      <span style="color:{escaped_brand_color};">●</span> {escaped_bot}
                    </span>
                  </td>
                  <td align="right" class="email-stack-col-right">
                    <span class="email-badge" style="display:inline-block;background-color:{badge_bg};color:{badge_color};font-size:11px;font-weight:700;line-height:1.4;padding:6px 14px;border-radius:999px;letter-spacing:0.04em;text-transform:uppercase;">
                      {_html.escape(badge_text)}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td class="email-pad-body" style="padding:32px;">
              <h1 class="email-headline" style="margin:0 0 14px;font-size:21px;font-weight:700;line-height:28px;color:#0f172a;">
                {_html.escape(headline)}
              </h1>
              <p style="margin:0 0 20px;font-size:15px;line-height:24px;color:#334155;word-break:break-word;">
                {intro_html}
              </p>

              <!-- Order Summary Box -->
              <div class="email-summary-box" style="margin:20px 0;background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px 20px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr class="email-table-row">
                    <td class="email-summary-label" style="padding:8px 12px 8px 0;border-bottom:1px solid #e2e8f0;font-size:13px;line-height:20px;color:#64748b;font-weight:500;">Item / Service</td>
                    <td class="email-summary-value" align="right" style="padding:8px 0 8px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;line-height:20px;color:#0f172a;font-weight:700;word-break:break-word;">{_html.escape(title)}</td>
                  </tr>
                  <tr class="email-table-row">
                    <td class="email-summary-label" style="padding:8px 12px 8px 0;border-bottom:1px solid #e2e8f0;font-size:13px;line-height:20px;color:#64748b;font-weight:500;">Total Amount</td>
                    <td class="email-summary-value" align="right" style="padding:8px 0 8px 12px;border-bottom:1px solid #e2e8f0;font-size:15px;line-height:20px;color:#0f172a;font-weight:800;font-family:monospace;">{_html.escape(amount_str)}</td>
                  </tr>
                  <tr class="email-table-row">
                    <td class="email-summary-label" style="padding:8px 12px 8px 0;border-bottom:1px solid #e2e8f0;font-size:13px;line-height:20px;color:#64748b;font-weight:500;">Payment Status</td>
                    <td class="email-summary-value" align="right" style="padding:8px 0 8px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;line-height:20px;color:#0f172a;font-weight:600;">{_html.escape(status_label)}</td>
                  </tr>
                  <tr class="email-table-row">
                    <td class="email-summary-label" style="padding:8px 12px 8px 0;border-bottom:1px solid #e2e8f0;font-size:13px;line-height:20px;color:#64748b;font-weight:500;">Payment Gateway</td>
                    <td class="email-summary-value" align="right" style="padding:8px 0 8px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;line-height:20px;color:#0f172a;font-weight:600;">{_html.escape(provider_label)}</td>
                  </tr>
                  <tr class="email-table-row">
                    <td class="email-summary-label" style="padding:8px 12px 8px 0;border-bottom:1px solid #e2e8f0;font-size:13px;line-height:20px;color:#64748b;font-weight:500;">Customer</td>
                    <td class="email-summary-value" align="right" style="padding:8px 0 8px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;line-height:20px;color:#0f172a;font-weight:500;word-break:break-word;">{_html.escape(customer_name)} ({_html.escape(customer_email or 'N/A')})</td>
                  </tr>
                  <tr class="email-table-row">
                    <td class="email-summary-label" style="padding:8px 12px 8px 0;border-bottom:1px solid #e2e8f0;font-size:13px;line-height:20px;color:#64748b;font-weight:500;">Reference ID</td>
                    <td class="email-summary-value" align="right" style="padding:8px 0 8px 12px;border-bottom:1px solid #e2e8f0;font-size:12px;line-height:20px;color:#475569;font-family:monospace;word-break:break-all;">{_html.escape(ref_id)}</td>
                  </tr>
                  <tr class="email-table-row email-table-row-last">
                    <td class="email-summary-label" style="padding:8px 12px 8px 0;font-size:13px;line-height:20px;color:#64748b;font-weight:500;">Date</td>
                    <td class="email-summary-value" align="right" style="padding:8px 0 8px 12px;font-size:12px;line-height:20px;color:#64748b;">{_html.escape(now_str)}</td>
                  </tr>
                </table>
              </div>

              {custom_note_html}

              <!-- CTA -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0 8px;">
                <tr>
                  <td align="center">
                    <a href="{escaped_cta_url}" target="_blank" class="email-btn" style="display:inline-block;background-color:{escaped_brand_color};color:#ffffff;font-size:14px;font-weight:700;line-height:1.4;height:auto;padding:14px 28px;border-radius:10px;text-decoration:none;text-align:center;">
                      {escaped_cta_text} &rarr;
                    </a>
                  </td>
                </tr>
              </table>
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

    return subject, html_body


async def send_order_notification_emails(
    order: dict[str, Any],
    bot_name: str = "Chatty Assistant",
    email_config: Optional[dict[str, Any]] = None,
    owner_email: Optional[str] = None,
    force_send: bool = False,
) -> dict[str, Any]:
    """Send customer receipt/status email and optional owner sale alert."""
    cfg = email_config or {}
    enabled = cfg.get("email_notifications_enabled", True)
    customer_email = str(order.get("customer_email") or "").strip()

    results: dict[str, Any] = {"customer_email_sent": False, "owner_alert_sent": False}

    if (enabled or force_send) and customer_email and "@" in customer_email:
        subject, html_body = render_order_status_email(order, bot_name=bot_name, email_config=cfg)
        res = await _send_raw_email(customer_email, subject, html_body)
        results["customer_email_sent"] = bool(res.get("sent"))
        results["customer_delivery"] = res

    # Send instant sale alert to bot owner when order succeeds
    status = str(order.get("status") or "").lower()
    if status == "succeeded" and cfg.get("send_owner_sale_alert", True) and owner_email and "@" in owner_email:
        amount_str = format_amount(int(order.get("amount_cents") or 0), str(order.get("currency") or "USD"))
        title = str(order.get("title") or "Order")
        attr = "AI Agent Autonomous" if order.get("attributed_to") == "ai_agent" else "Human Agent (Inbox)"
        owner_subj = f"🎉 New Sale ({amount_str}): {title} [{attr}]"
        _, owner_html = render_order_status_email(order, bot_name=f"{bot_name} (Admin Alert)", email_config=cfg)
        o_res = await _send_raw_email(owner_email, owner_subj, owner_html)
        results["owner_alert_sent"] = bool(o_res.get("sent"))

    return results
