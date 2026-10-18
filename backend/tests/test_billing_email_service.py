"""Unit tests for billing_email_service and trial lifecycle notifications."""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from datetime import datetime, timedelta, timezone

from app.services.billing_email_service import (
    _render_base_email,
    send_trial_ending_soon_email,
    send_trial_expired_email,
    send_subscription_activated_email,
    send_payment_success_email,
    send_payment_failed_email,
    send_subscription_cancelled_email,
    send_subscription_paused_email,
    send_subscription_resumed_email,
    run_trial_lifecycle_scan,
)


def test_render_base_email():
    """Verify HTML template structure and styling."""
    html = _render_base_email(
        subject="Important Notice",
        badge_text="Action Required",
        badge_bg="#fee2e2",
        badge_color="#dc2626",
        title="Your Agent Status <Alert>",
        body_paragraphs=["Paragraph 1", "Paragraph 2 with <b>tags</b>"],
        highlight_box={"Plan": "Chatty Standard", "Cost": "$49/mo"},
        cta_text="Upgrade Now",
        cta_url="https://chatty.personaliai.com/dashboard/billing",
        secondary_text="Need help? Contact support.",
    )

    assert "Important Notice" in html
    assert "Action Required" in html
    assert "Your Agent Status &lt;Alert&gt;" in html
    assert "Paragraph 1" in html
    assert "Paragraph 2 with <b>tags</b>" in html
    assert "Chatty Standard" in html
    assert "$49/mo" in html
    assert "Upgrade Now" in html
    assert "https://chatty.personaliai.com/dashboard/billing" in html
    assert "Need help? Contact support." in html
    assert "support@personaliai.com" in html


@pytest.mark.anyio
async def test_trial_ending_soon_deduplication():
    """Verify that trial_ending_soon does not send if already logged."""
    with patch("app.services.billing_email_service.has_lifecycle_email_been_sent", new=AsyncMock(return_value=True)):
        with patch("app.services.billing_email_service._send_raw_email", new=AsyncMock()) as mock_send:
            res = await send_trial_ending_soon_email(
                user_id="user-123",
                email="alex@example.com",
                name="Alex",
                days_left=3,
            )
            assert res["sent"] is False
            assert res["reason"] == "already_sent"
            mock_send.assert_not_called()


@pytest.mark.anyio
async def test_trial_ending_soon_sends_and_logs():
    """Verify that trial_ending_soon sends and records when not previously sent."""
    with patch("app.services.billing_email_service.has_lifecycle_email_been_sent", new=AsyncMock(return_value=False)):
        with patch("app.services.billing_email_service._send_raw_email", new=AsyncMock(return_value={"sent": True, "id": "msg-123"})) as mock_send:
            with patch("app.services.billing_email_service.record_lifecycle_email_sent", new=AsyncMock()) as mock_record:
                res = await send_trial_ending_soon_email(
                    user_id="user-456",
                    email="sara@example.com",
                    name="Sara",
                    days_left=3,
                )
                assert res["sent"] is True
                mock_send.assert_called_once()
                mock_record.assert_called_once_with("user-456", "sara@example.com", "trial_ending_soon", {"days_left": 3})


@pytest.mark.anyio
async def test_trial_expired_sends_and_logs():
    """Verify that trial_expired sends and records when not previously sent."""
    with patch("app.services.billing_email_service.has_lifecycle_email_been_sent", new=AsyncMock(return_value=False)):
        with patch("app.services.billing_email_service._send_raw_email", new=AsyncMock(return_value={"sent": True, "id": "msg-456"})) as mock_send:
            with patch("app.services.billing_email_service.record_lifecycle_email_sent", new=AsyncMock()) as mock_record:
                res = await send_trial_expired_email(
                    user_id="user-789",
                    email="jason@example.com",
                    name="Jason",
                )
                assert res["sent"] is True
                mock_send.assert_called_once()
                mock_record.assert_called_once_with("user-789", "jason@example.com", "trial_expired")


@pytest.mark.anyio
async def test_payment_lifecycle_emails():
    """Verify that billing status change emails trigger delivery and logging."""
    with patch("app.services.billing_email_service._send_raw_email", new=AsyncMock(return_value={"sent": True, "id": "msg-ok"})) as mock_send:
        with patch("app.services.billing_email_service.record_lifecycle_email_sent", new=AsyncMock()) as mock_record:
            # 1. Activation
            res1 = await send_subscription_activated_email(
                user_id="u1",
                email="u1@example.com",
                name="U1",
                plan_name="chatty_standard",
            )
            assert res1["sent"] is True

            # 2. Payment Succeeded
            res2 = await send_payment_success_email(
                user_id="u1",
                email="u1@example.com",
                name="U1",
                plan_name="chatty_standard",
                amount_formatted="$49.00",
            )
            assert res2["sent"] is True

            # 3. Payment Failed
            res3 = await send_payment_failed_email(
                user_id="u1",
                email="u1@example.com",
                name="U1",
                plan_name="chatty_standard",
            )
            assert res3["sent"] is True

            # 4. Cancellation
            res4 = await send_subscription_cancelled_email(
                user_id="u1",
                email="u1@example.com",
                name="U1",
                plan_name="chatty_standard",
            )
            assert res4["sent"] is True

            assert mock_send.call_count == 4
            assert mock_record.call_count == 4


@pytest.mark.anyio
async def test_run_trial_lifecycle_scan():
    """Verify the scan categorizes users properly into ending soon, expired, and skipped."""
    now = datetime.now(timezone.utc)
    mock_users = [
        # User 1: Active paid subscriber -> skip
        {
            "id": "u-active",
            "auth_user_id": "u-active",
            "email": "active@example.com",
            "subscription_status": "active",
            "trial_started_at": (now - timedelta(days=20)).isoformat(),
        },
        # User 2: Day 12 of trial (2 days left) -> send ending soon
        {
            "id": "u-soon",
            "auth_user_id": "u-soon",
            "email": "soon@example.com",
            "subscription_status": "trialing",
            "trial_started_at": (now - timedelta(days=12)).isoformat(),
        },
        # User 3: Day 16 (trial ended 2 days ago) -> send expired
        {
            "id": "u-expired",
            "auth_user_id": "u-expired",
            "email": "expired@example.com",
            "subscription_status": "trialing",
            "trial_started_at": (now - timedelta(days=16)).isoformat(),
        },
    ]

    mock_db = MagicMock()
    mock_db.table.return_value.select.return_value.execute.return_value.data = mock_users

    async def fake_run_db(fn):
        return fn()

    with patch("app.services.billing_email_service._get_db", return_value=(mock_db, fake_run_db)):
        with patch("app.services.billing_email_service.has_lifecycle_email_been_sent", new=AsyncMock(return_value=False)):
            with patch("app.services.billing_email_service._send_raw_email", new=AsyncMock(return_value={"sent": True})):
                with patch("app.services.billing_email_service.record_lifecycle_email_sent", new=AsyncMock()):
                    res = await run_trial_lifecycle_scan()

                    assert res["ok"] is True
                    stats = res["stats"]
                    assert stats["scanned"] == 3
                    assert stats["skipped_active_paid"] == 1
                    assert stats["ending_soon_sent"] == 1
                    assert stats["expired_sent"] == 1
                    assert stats["errors"] == 0
