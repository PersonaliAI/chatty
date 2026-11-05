"""Tests for email template mobile responsiveness and GDPR compliance across Chatty."""

import pytest

from app.services.email_service import (
    render_ticket_email_html,
    render_campaign_email_html,
)
from app.services.billing_email_service import _render_base_email
from app.services.order_email_service import render_order_status_email
from plugins.notifications import (
    build_client_email_html,
    build_admin_email_html,
    build_team_invite_email_html,
    build_booking_otp_email_html,
)
from app.services.email_templates_common import (
    COMPANY_LEGAL_NAME,
    COMPANY_ADDRESS,
    PRIVACY_POLICY_URL,
    TERMS_OF_SERVICE_URL,
    DPO_EMAIL,
)


def _assert_mobile_responsive(html: str) -> None:
    """Assert essential responsive email standards."""
    assert "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\"/>" in html
    assert "@media only screen and (max-width: 600px)" in html
    assert "email-container" in html
    assert "email-wrapper" in html
    assert "width:100%" in html.replace(" ", "") or "width: 100%" in html


def _assert_gdpr_compliant(html: str, *, expect_unsubscribe: bool = False) -> None:
    """Assert GDPR compliance elements."""
    assert COMPANY_LEGAL_NAME in html
    assert "San Francisco" in html
    assert PRIVACY_POLICY_URL in html
    assert TERMS_OF_SERVICE_URL in html
    assert DPO_EMAIL in html
    if expect_unsubscribe:
        assert "Unsubscribe from marketing emails" in html


def test_ticket_reply_email_responsive_and_gdpr():
    html = render_ticket_email_html(
        agent_name="Sarah Miller",
        bot_name="TechCorp Assistant",
        body_text="Your issue has been resolved. Here is the documentation link.",
        session_id="sess_12345678abcdef",
        ticket_subject="API rate limit inquiry",
    )
    _assert_mobile_responsive(html)
    _assert_gdpr_compliant(html, expect_unsubscribe=False)
    assert "Ticket #sess_123" in html
    assert "TechCorp Assistant Support" in html
    assert "Sarah Miller" in html
    assert "You received this customer service email in response to your support inquiry" in html


def test_campaign_email_responsive_and_gdpr():
    unsub_url = "https://chatty.personaliai.com/api/marketing/unsubscribe?token=sig_xyz"
    html = render_campaign_email_html(
        bot_name="Product Bot",
        body_text="We have just launched a brand new voice assistant feature!",
        unsubscribe_url=unsub_url,
    )
    _assert_mobile_responsive(html)
    _assert_gdpr_compliant(html, expect_unsubscribe=True)
    assert unsub_url in html
    assert "Product Bot" in html
    assert "opted in to receive announcements" in html


def test_billing_email_responsive_and_gdpr():
    html = _render_base_email(
        subject="Your 14-day free trial concludes tomorrow",
        badge_text="24h Notice",
        badge_bg="#fee2e2",
        badge_color="#dc2626",
        title="Automatic Renewal Notice",
        body_paragraphs=["Your free trial ends tomorrow.", "You can cancel anytime in 1 click."],
        highlight_box={"Plan": "Chatty Standard", "Renewal Date": "Tomorrow"},
        cta_text="Manage Billing",
        cta_url="https://chatty.personaliai.com/dashboard/billing",
        secondary_text="Questions? Contact support.",
    )
    _assert_mobile_responsive(html)
    _assert_gdpr_compliant(html, expect_unsubscribe=False)
    assert "Manage email preferences" in html
    assert "Automatic Renewal Notice" in html
    assert "email-btn" in html
    assert "GDPR Art. 6(1)(b)" in html


def test_order_receipt_email_responsive_and_gdpr():
    order = {
        "id": "ord_987654321",
        "gateway_order_id": "pi_stripe_live_12345",
        "title": "Annual Pro License",
        "amount_cents": 49000,
        "currency": "USD",
        "status": "succeeded",
        "customer_name": "Jane Doe",
        "customer_email": "jane@example.com",
        "provider": "stripe",
        "checkout_url": "https://chatty.personaliai.com/checkout/success",
    }
    subject, html = render_order_status_email(
        order=order,
        bot_name="Design Studio Assistant",
    )
    _assert_mobile_responsive(html)
    _assert_gdpr_compliant(html, expect_unsubscribe=False)
    assert "Payment Receipt: Annual Pro License" in subject
    assert "$490.00 USD" in html
    assert "Design Studio Assistant" in html
    assert "Jane Doe" in html
    assert "jane@example.com" in html
    assert "pi_stripe_live_12345" in html
    assert "GDPR Art. 6(1)(b)" in html


def test_booking_notifications_email_responsive_and_gdpr():
    # 1. Client booking
    client_html = build_client_email_html(
        visitor_name="John Smith",
        summary="Product Architecture Discovery",
        start="November 12, 2026 at 10:00 AM",
        timezone_label="America/New_York (EST)",
        meeting_link="https://meet.google.com/abc-defg-hij",
        provider="google_meet",
    )
    _assert_mobile_responsive(client_html)
    _assert_gdpr_compliant(client_html, expect_unsubscribe=False)
    assert "You're booked, John Smith!" in client_html
    assert "Google Meet" in client_html
    assert "Need to reschedule? Just reply to this email." in client_html

    # 2. Team invite
    invite_html = build_team_invite_email_html(
        bot_name="Sales Bot",
        inviter_email="founder@company.com",
        role="agent",
    )
    _assert_mobile_responsive(invite_html)
    _assert_gdpr_compliant(invite_html, expect_unsubscribe=False)
    assert "You've been added to Sales Bot" in invite_html
    assert "founder@company.com" in invite_html

    # 3. Booking OTP
    otp_html = build_booking_otp_email_html(
        bot_name="Booking Assistant",
        code="839201",
    )
    _assert_mobile_responsive(otp_html)
    _assert_gdpr_compliant(otp_html, expect_unsubscribe=False)
    assert "839201" in otp_html
    assert "Verify your email to confirm booking" in otp_html
