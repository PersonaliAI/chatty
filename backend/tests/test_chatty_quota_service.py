"""Pure tests for Chatty's server-side weighted AI credit policy and subscription enforcement."""

import pytest
from datetime import datetime, timezone, timedelta
from app.services.chatty_quota_service import (
    usage_units_for_message,
    check_bot_owner_subscription,
    OFFLINE_TRIAL_EXPIRED_MESSAGE,
    OFFLINE_SUBSCRIPTION_INACTIVE_MESSAGE,
)


def test_normal_text_turn_costs_one_credit():
    assert usage_units_for_message("What are your opening hours?") == 1


def test_long_text_is_bounded_and_progressively_weighted():
    assert usage_units_for_message("x" * 4000) == 1
    assert usage_units_for_message("x" * 4001) == 2
    assert usage_units_for_message("x" * 20000) == 5
    assert usage_units_for_message("x" * 100000) == 8


def test_media_request_has_a_fixed_multimodal_surcharge():
    assert usage_units_for_message("Please inspect this", has_media=True) == 4
    assert usage_units_for_message("x" * 20000, has_media=True) == 8


@pytest.mark.anyio
async def test_trial_expired_shows_offline():
    # User created 20 days ago, no active subscription
    past_date = (datetime.now(timezone.utc) - timedelta(days=20)).isoformat()
    user = {
        "email": "store@example.com",
        "plan": "free",
        "subscription_status": None,
        "created_at": past_date,
        "trial_started_at": past_date,
    }
    result = await check_bot_owner_subscription(user, "user-uuid-1")
    assert result["is_active"] is False
    assert result["status"] == "trial_expired"
    assert result["offline_message"] == OFFLINE_TRIAL_EXPIRED_MESSAGE


@pytest.mark.anyio
async def test_active_trial_shows_online():
    # User created 3 days ago, no active subscription
    recent_date = (datetime.now(timezone.utc) - timedelta(days=3)).isoformat()
    user = {
        "email": "newuser@example.com",
        "plan": "free",
        "subscription_status": None,
        "created_at": recent_date,
        "trial_started_at": recent_date,
    }
    result = await check_bot_owner_subscription(user, "user-uuid-2")
    assert result["is_active"] is True
    assert result["status"] == "on_trial"


@pytest.mark.anyio
async def test_active_subscription_shows_online():
    user = {
        "email": "customer@example.com",
        "plan": "chatty_standard",
        "subscription_status": "active",
        "created_at": "2025-01-01T00:00:00Z",
    }
    result = await check_bot_owner_subscription(user, "user-uuid-3")
    assert result["is_active"] is True
    assert result["status"] == "active"


@pytest.mark.anyio
async def test_cancelled_subscription_shows_offline():
    user = {
        "email": "churned@example.com",
        "plan": "chatty_hobby",
        "subscription_status": "cancelled",
        "created_at": "2025-01-01T00:00:00Z",
    }
    result = await check_bot_owner_subscription(user, "user-uuid-4")
    assert result["is_active"] is False
    assert result["status"] == "subscription_canceled"
    assert result["offline_message"] == OFFLINE_SUBSCRIPTION_INACTIVE_MESSAGE


@pytest.mark.anyio
async def test_payment_failed_subscription_shows_offline():
    user = {
        "email": "delinquent@example.com",
        "plan": "chatty_standard",
        "subscription_status": "past_due",
        "created_at": "2025-01-01T00:00:00Z",
    }
    result = await check_bot_owner_subscription(user, "user-uuid-5")
    assert result["is_active"] is False
    assert result["status"] == "payment_failed"
    assert result["offline_message"] == OFFLINE_SUBSCRIPTION_INACTIVE_MESSAGE
