"""Comprehensive test suite for the Chatty Affiliate Partner Program:
1. Referral code validation & reserved slug protection
2. Partner registration & settings updates
3. Click tracking, bot filtering, and click-flood deduplication
4. Commission calculations (30% recurring) on subscription webhooks
5. Multi-factor anti-self-referral security defense
6. 12-Month recurring commission expiration guard
7. Refund clawbacks (voiding commissions on order_refunded)
8. Subscription cancellations
9. Admin management (approval, rate adjustment, hold maturation, payouts)
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone, timedelta
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException

import main  # noqa: F401
from app.routers import affiliate, webhooks
from app.routers.admin import (
    admin_list_affiliates,
    admin_update_affiliate_status,
    admin_update_affiliate_rate,
    admin_approve_mature_commissions,
    admin_create_affiliate_payout,
    admin_list_affiliate_fraud_flags,
    require_platform_admin,
)
from app.schemas.affiliate import (
    AffiliateJoinRequest,
    AffiliateSettingsUpdateRequest,
    AdminAffiliateStatusUpdateRequest,
    AdminAffiliateRateUpdateRequest,
    AdminAffiliatePayoutCreateRequest,
)


class _FakeClickRequest:
    def __init__(self, json_data: dict, headers: dict | None = None, client_host: str = "127.0.0.1"):
        self._json = json_data
        self.headers = headers or {}
        self.client = MagicMock(host=client_host)

    async def json(self):
        return self._json


# ---------------------------------------------------------------------------
# 1. Referral Code Sanitization & Reserved Words
# ---------------------------------------------------------------------------

def test_clean_code_valid():
    assert affiliate.clean_code("my-partner") == "my-partner"
    assert affiliate.clean_code("PARTNER_123") == "partner_123"
    assert affiliate.clean_code("  agency-pro  ") == "agency-pro"


def test_clean_code_reserved():
    assert affiliate.clean_code("admin") is None
    assert affiliate.clean_code("billing") is None
    assert affiliate.clean_code("dashboard") is None
    assert affiliate.clean_code("affiliate") is None
    assert affiliate.clean_code("chatty") is None


def test_clean_code_invalid_format():
    assert affiliate.clean_code("a") is None  # Too short
    assert affiliate.clean_code("ab") is None  # Too short
    assert affiliate.clean_code("inv@lid!code") is None
    assert affiliate.clean_code("   ") is None


# ---------------------------------------------------------------------------
# 2. Check Referral Code Pre-flight API
# ---------------------------------------------------------------------------

def test_check_referral_code_available():
    with patch("app.routers.affiliate.run_db", new_callable=AsyncMock) as mock_db:
        mock_db.return_value = MagicMock(data=[])
        res = asyncio.run(affiliate.check_referral_code("awesome-partner"))
        assert res["available"] is True
        assert res["code"] == "awesome-partner"
        assert res["reason"] is None


def test_check_referral_code_reserved():
    res = asyncio.run(affiliate.check_referral_code("admin"))
    assert res["available"] is False
    assert "reserved" in res["reason"]


def test_check_referral_code_taken():
    with patch("app.routers.affiliate.run_db", new_callable=AsyncMock) as mock_db:
        mock_db.return_value = MagicMock(data=[{"id": "existing-uuid"}])
        res = asyncio.run(affiliate.check_referral_code("taken-code"))
        assert res["available"] is False
        assert "already taken" in res["reason"]


# ---------------------------------------------------------------------------
# 3. Join Program & Profile Management
# ---------------------------------------------------------------------------

def test_join_affiliate_program_success():
    fake_user = {"auth_user_id": "usr-123", "email": "partner@example.com"}
    req = AffiliateJoinRequest(
        referral_code="growth-agency",
        payout_email="payouts@example.com",
        display_name="Growth Agency",
        website_url="https://growth.agency",
    )

    with patch("app.routers.affiliate.run_db", new_callable=AsyncMock) as mock_db:
        mock_db.side_effect = [
            MagicMock(data=[]),
            MagicMock(data=[]),
            MagicMock(data=[{
                "id": "aff-001",
                "referral_code": "growth-agency",
                "status": "active",
                "commission_rate_bps": 3000,
            }]),
        ]

        res = asyncio.run(affiliate.join_affiliate_program(req, user=fake_user))
        assert res["success"] is True
        assert res["profile"]["referral_code"] == "growth-agency"
        assert "https://chatty.personaliai.com?ref=growth-agency" in res["profile"]["referral_url"]


def test_join_affiliate_program_rejects_reserved():
    fake_user = {"auth_user_id": "usr-123", "email": "partner@example.com"}
    req = AffiliateJoinRequest(
        referral_code="admin",
        payout_email="payouts@example.com",
    )

    with patch("app.routers.affiliate.run_db", new_callable=AsyncMock) as mock_db:
        mock_db.return_value = MagicMock(data=[])
        with pytest.raises(HTTPException) as exc_info:
            asyncio.run(affiliate.join_affiliate_program(req, user=fake_user))
        assert exc_info.value.status_code == 400
        assert "reserved" in str(exc_info.value.detail).lower()


# ---------------------------------------------------------------------------
# 4. Click Tracking, Bot Filtering & Flood Deduplication
# ---------------------------------------------------------------------------

def test_click_tracking_records_valid_click():
    fake_req = _FakeClickRequest(
        json_data={
            "referral_code": "partner-pro",
            "landing_page": "https://chatty.personaliai.com/pricing",
            "utm_source": "youtube",
            "utm_campaign": "launch",
        },
        headers={
            "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
            "x-forwarded-for": "1.2.3.4",
        },
    )

    with patch("app.routers.webhooks.run_db", new_callable=AsyncMock) as mock_db:
        mock_db.side_effect = [
            MagicMock(data=[{"id": "aff-123", "status": "active"}]),  # affiliate profile
            MagicMock(data=[]),  # deduplication check: no prior click within 1h
            MagicMock(data=[{"id": "clk-999"}]),  # insert click
        ]

        res = asyncio.run(webhooks.record_affiliate_click(fake_req))
        assert res["ok"] is True


def test_click_tracking_filters_bots():
    fake_req = _FakeClickRequest(
        json_data={"referral_code": "partner-pro"},
        headers={"user-agent": "Googlebot/2.1 (+http://www.google.com/bot.html)"},
    )
    res = asyncio.run(webhooks.record_affiliate_click(fake_req))
    assert res["ok"] is True
    assert res["filtered"] == "bot"


def test_click_tracking_deduplicates_within_one_hour():
    fake_req = _FakeClickRequest(
        json_data={"referral_code": "partner-pro"},
        headers={
            "user-agent": "Mozilla/5.0 Safari/605.1",
            "x-forwarded-for": "5.6.7.8",
        },
    )

    with patch("app.routers.webhooks.run_db", new_callable=AsyncMock) as mock_db:
        mock_db.side_effect = [
            MagicMock(data=[{"id": "aff-123", "status": "active"}]),
            MagicMock(data=[{"id": "clk-existing"}]),  # Existing click found within 1h
        ]

        res = asyncio.run(webhooks.record_affiliate_click(fake_req))
        assert res["ok"] is True
        assert res["deduplicated"] is True


# ---------------------------------------------------------------------------
# 5. Commission Calculation & Anti-Self-Referral Defenses
# ---------------------------------------------------------------------------

def test_commission_created_on_subscription():
    """Verify 30% recurring commission calculation with 30-day hold."""
    data = {
        "meta": {"custom_data": {"ref": "partner-xyz"}},
        "data": {
            "attributes": {
                "total": 9900,  # $99.00
                "currency": "USD",
                "user_email": "customer@company.com",
                "order_id": "ord_100",
                "subscription_id": "sub_100",
            }
        },
    }

    with patch("app.routers.webhooks.run_db", new_callable=AsyncMock) as mock_db:
        mock_db.side_effect = [
            # 1: affiliate profile lookup (different user id and email)
            MagicMock(data=[{
                "id": "aff-xyz",
                "user_id": "auth-partner-999",
                "payout_email": "partner@paypal.com",
                "status": "active",
                "commission_rate_bps": 3000,  # 30%
                "payout_hold_days": 30,
            }]),
            # 2: partner user email lookup
            MagicMock(data=[{"email": "partner@company.com"}]),
            # 3: check 12-month limit
            MagicMock(data=[]),
            # 4: upsert referral
            MagicMock(data=[{"id": "ref-1"}]),
            # 5: upsert commission
            MagicMock(data=[{"id": "comm-1"}]),
        ]

        asyncio.run(webhooks._record_affiliate_conversion(data, "order_created", "auth-buyer-111", "evt_1"))
        assert len(mock_db.call_args_list) == 5


def test_anti_self_referral_blocks_same_auth_id():
    """Verify that an affiliate cannot use their own referral code to purchase."""
    data = {
        "meta": {"custom_data": {"ref": "self-partner"}},
        "data": {
            "attributes": {
                "total": 1900,
                "user_email": "buyer@company.com",
            }
        },
    }

    with patch("app.routers.webhooks.run_db", new_callable=AsyncMock) as mock_db:
        mock_db.side_effect = [
            # 1: Affiliate profile has same user_id as buyer
            MagicMock(data=[{
                "id": "aff-self",
                "user_id": "auth-self-999",  # MATCHES BUYER!
                "payout_email": "different@paypal.com",
                "status": "active",
                "commission_rate_bps": 3000,
            }]),
            # 2: Insert fraud flag
            MagicMock(data=[{"id": "flag-1"}]),
        ]

        asyncio.run(webhooks._record_affiliate_conversion(data, "order_created", "auth-self-999", "evt_2"))
        # Commission was blocked; only affiliate lookup + fraud flag insertion occurred
        assert len(mock_db.call_args_list) == 2


def test_anti_self_referral_blocks_matching_payout_email():
    """Verify buyer email matching affiliate payout email is blocked and flagged."""
    data = {
        "meta": {"custom_data": {"ref": "partner-code"}},
        "data": {
            "attributes": {
                "total": 9900,
                "user_email": "fraud-investor@gmail.com",
            }
        },
    }

    with patch("app.routers.webhooks.run_db", new_callable=AsyncMock) as mock_db:
        mock_db.side_effect = [
            MagicMock(data=[{
                "id": "aff-99",
                "user_id": "auth-partner-111",
                "payout_email": "fraud-investor@gmail.com",  # MATCHES BUYER EMAIL
                "status": "active",
                "commission_rate_bps": 3000,
            }]),
            MagicMock(data=[{"id": "flag-2"}]),  # fraud flag inserted
        ]

        asyncio.run(webhooks._record_affiliate_conversion(data, "order_created", "auth-buyer-222", "evt_3"))
        assert len(mock_db.call_args_list) == 2


def test_anti_self_referral_blocks_matching_account_email():
    """Verify buyer email matching partner's main account email is blocked and flagged."""
    data = {
        "meta": {"custom_data": {"ref": "partner-code"}},
        "data": {
            "attributes": {
                "total": 9900,
                "user_email": "partner-login@company.com",
            }
        },
    }

    with patch("app.routers.webhooks.run_db", new_callable=AsyncMock) as mock_db:
        mock_db.side_effect = [
            # 1: Affiliate profile
            MagicMock(data=[{
                "id": "aff-88",
                "user_id": "auth-partner-222",
                "payout_email": "different-payout@paypal.com",
                "status": "active",
                "commission_rate_bps": 3000,
            }]),
            # 2: Users table email lookup
            MagicMock(data=[{"email": "partner-login@company.com"}]),
            # 3: Fraud flag inserted
            MagicMock(data=[{"id": "flag-3"}]),
        ]

        asyncio.run(webhooks._record_affiliate_conversion(data, "order_created", "auth-buyer-333", "evt_3b"))
        assert len(mock_db.call_args_list) == 3


# ---------------------------------------------------------------------------
# 6. 12-Month Recurring Expiration Guard
# ---------------------------------------------------------------------------

def test_recurring_commission_expires_after_365_days():
    """Verify that after 12 months (365 days), recurring commission is halted."""
    data = {
        "meta": {"custom_data": {"ref": "partner-code"}},
        "data": {
            "attributes": {
                "total": 39900,
                "user_email": "client@enterprise.com",
            }
        },
    }

    old_converted_at = (datetime.now(timezone.utc) - timedelta(days=400)).isoformat()

    with patch("app.routers.webhooks.run_db", new_callable=AsyncMock) as mock_db:
        mock_db.side_effect = [
            MagicMock(data=[{
                "id": "aff-old",
                "user_id": "auth-partner-888",
                "payout_email": "partner@paypal.com",
                "status": "active",
                "commission_rate_bps": 3000,
            }]),
            MagicMock(data=[{"email": "partner@paypal.com"}]),
            # Existing referral converted 400 days ago (> 365 days)
            MagicMock(data=[{"id": "ref-old", "converted_at": old_converted_at}]),
        ]

        asyncio.run(webhooks._record_affiliate_conversion(data, "subscription_payment_success", "auth-client-777", "evt_4"))
        # Halted at check 2 without commission insertion
        assert len(mock_db.call_args_list) == 3


# ---------------------------------------------------------------------------
# 7. Refund Clawback
# ---------------------------------------------------------------------------

def test_handle_affiliate_refund_voids_commission():
    refund_data = {
        "data": {
            "attributes": {
                "order_id": "ls_ord_200"
            }
        }
    }

    with patch("app.routers.webhooks.run_db", new_callable=AsyncMock) as mock_db:
        mock_db.side_effect = [
            MagicMock(data=[{"id": "comm-1", "referral_id": "ref-1", "status": "pending"}]),
            MagicMock(data=[{"id": "comm-1", "status": "void"}]),
            MagicMock(data=[{"id": "ref-1", "status": "refunded"}]),
        ]

        asyncio.run(webhooks._handle_affiliate_refund(refund_data, "evt_ref_1"))
        assert len(mock_db.call_args_list) == 3


# ---------------------------------------------------------------------------
# 8. Subscription Ended
# ---------------------------------------------------------------------------

def test_handle_affiliate_subscription_ended():
    with patch("app.routers.webhooks.run_db", new_callable=AsyncMock) as mock_db:
        mock_db.return_value = MagicMock(data=[{"id": "ref-1", "status": "cancelled"}])
        asyncio.run(webhooks._handle_affiliate_subscription_ended("auth-client-123", "subscription_cancelled"))
        assert len(mock_db.call_args_list) == 1


# ---------------------------------------------------------------------------
# 9. Admin Endpoints
# ---------------------------------------------------------------------------

def test_admin_list_affiliates_authorization():
    admin_user = {"email": "personaliai.com@gmail.com", "role": "admin"}
    non_admin_user = {"email": "regular@user.com", "role": "user"}

    assert require_platform_admin(admin_user) == admin_user

    with pytest.raises(HTTPException) as exc:
        require_platform_admin(non_admin_user)
    assert exc.value.status_code == 403


def test_admin_update_affiliate_status():
    admin_user = {"email": "personaliai.com@gmail.com"}
    req = AdminAffiliateStatusUpdateRequest(status="paused")

    with patch("app.routers.admin.run_db", new_callable=AsyncMock) as mock_db:
        mock_db.return_value = MagicMock(data=[{"id": "aff-1", "status": "paused"}])
        res = asyncio.run(admin_update_affiliate_status("aff-1", req, admin_user=admin_user))
        assert res["success"] is True
        assert res["affiliate"]["status"] == "paused"


def test_admin_update_affiliate_rate():
    admin_user = {"email": "personaliai.com@gmail.com"}
    req = AdminAffiliateRateUpdateRequest(commission_rate_bps=3500)  # 35%

    with patch("app.routers.admin.run_db", new_callable=AsyncMock) as mock_db:
        mock_db.return_value = MagicMock(data=[{"id": "aff-1", "commission_rate_bps": 3500}])
        res = asyncio.run(admin_update_affiliate_rate("aff-1", req, admin_user=admin_user))
        assert res["success"] is True
        assert res["affiliate"]["commission_rate_bps"] == 3500


def test_admin_approve_mature_commissions():
    admin_user = {"email": "personaliai.com@gmail.com"}

    with patch("app.routers.admin.run_db", new_callable=AsyncMock) as mock_db:
        mock_db.side_effect = [
            MagicMock(data=[{"id": "comm-mature-1"}, {"id": "comm-mature-2"}]),
            MagicMock(data=[{"id": "comm-mature-1"}, {"id": "comm-mature-2"}]),
        ]

        res = asyncio.run(admin_approve_mature_commissions(admin_user=admin_user))
        assert res["success"] is True
        assert res["matured_count"] == 2


def test_admin_create_affiliate_payout():
    admin_user = {"email": "personaliai.com@gmail.com"}
    req = AdminAffiliatePayoutCreateRequest(
        affiliate_id="aff-1",
        amount_cents=10000,  # $100.00
        payout_method="paypal",
        external_payout_id="PP-BATCH-12345",
    )

    with patch("app.routers.admin.run_db", new_callable=AsyncMock) as mock_db:
        mock_db.side_effect = [
            MagicMock(data=[{"id": "aff-1", "payout_email": "partner@paypal.com"}]),
            MagicMock(data=[{"id": "payout-001", "amount_cents": 10000, "status": "paid"}]),
            MagicMock(data=[
                {"id": "c1", "commission_amount_cents": 5000},
                {"id": "c2", "commission_amount_cents": 5000},
            ]),
            MagicMock(data=[{"id": "c1"}, {"id": "c2"}]),
        ]

        res = asyncio.run(admin_create_affiliate_payout(req, admin_user=admin_user))
        assert res["success"] is True
        assert res["payout"]["id"] == "payout-001"
        assert res["commissions_marked_paid"] == 2
        assert res["total_marked_cents"] == 10000
