"""Chatty plan resolution and widget-message quota enforcement.

This service intentionally owns the Chatty-specific quota path so routers and
business services do not import the application entrypoint.
"""
from __future__ import annotations

import logging
import math
from datetime import datetime, timezone, timedelta
from typing import Any

from app.core.clients import supabase
from app.core.config import ADMIN_BYPASS_EMAILS, CHATTY_ENFORCE_AI_QUOTAS
from app.core.db import run_db

logger = logging.getLogger("chatty.quota")

PLAN_QUOTAS: dict[str, int] = {
    "free": 1000,
    "basic": 500,
    "pro": 3000,
    "executive": 15000,
    "chatty_hobby": 1000,
    "chatty_standard": 10000,
    "chatty_business": 40000,
    "chatty_enterprise": 999999999,
}

WHITELABEL_PLANS = {"pro", "executive", "chatty_business", "chatty_enterprise"}

# Flat plans sell predictable AI capacity rather than raw conversation rows.
# A normal short text turn costs one credit; larger or multimodal requests
# consume more credits because they cause materially more provider work.
MAX_MESSAGE_CREDITS = 8

# Model credit weighting: Multipliers against base message units
MODEL_CREDIT_MULTIPLIERS: dict[str, float] = {
    # Gemma 4 (Google AI Studio) - Default, ultra fast and lightweight (1 credit/msg)
    "gemma": 1.0,
    "gemma-4-31b": 1.0,
    "gemma-4-31b-it": 1.0,
    "gemma-4-26b-a4b": 1.0,
    "gemma-4-26b-a4b-it": 1.0,
    "gemma-3-27b-it": 1.0,

    # Gemini 2.5 family
    "gemini-2.5-flash-lite": 1.0,
    "gemini-2.5-flash": 1.0,
    "gemini-2.5-pro": 3.0,

    # Gemini 3.x family
    "gemini-3.5-flash": 1.5,
    "gemini-3.8-flash": 2.0,
    "gemini-3.1-pro-preview": 3.0,
    "gemini-3-flash-preview": 1.5,
    "gemini": 1.0,
}

BUILTIN_GOOGLE_MODELS: frozenset[str] = frozenset({
    "gemma",
    "gemma-4-31b",
    "gemma-4-31b-it",
    "gemma-4-26b-a4b",
    "gemma-4-26b-a4b-it",
    "gemma-3-27b-it",
    "gemini",
    "gemini-2.5-flash-lite",
    "gemini-2.5-flash",
    "gemini-2.5-pro",
    "gemini-3.5-flash",
    "gemini-3.8-flash",
    "gemini-3.1-pro-preview",
    "gemini-3-flash-preview",
})


def is_builtin_google_model(model: str | None) -> bool:
    """Return True if model is natively hosted and covered by Chatty plan credits."""
    if not model:
        return True
    m = model.strip().lower()
    return m in BUILTIN_GOOGLE_MODELS or m.startswith("gemini-") or m.startswith("gemma-")


def get_model_credit_multiplier(model: str | None, *, is_byok: bool = False) -> float:
    """Return usage unit multiplier for the chosen model."""
    if is_byok or not model:
        return 1.0
    clean = model.strip().lower()
    return MODEL_CREDIT_MULTIPLIERS.get(clean, 1.0)


def usage_units_for_message(
    text: str | None,
    *,
    has_media: bool = False,
    model: str | None = None,
    is_byok: bool = False,
) -> int:
    """Return server-calculated AI credits for one visitor request.
    
    Credits scale with message length, multimodal media, and the computational
    weight of the selected foundation model. BYOK requests consume standard base
    credits (1 unit) for Chatty's RAG/orchestration infrastructure while model
    inference is paid directly by the tenant's own key.
    """
    chars = len((text or "").strip())
    units = max(1, math.ceil(chars / 4000))
    if has_media:
        units += 3
    if not is_byok and model:
        multiplier = get_model_credit_multiplier(model, is_byok=is_byok)
        units = max(1, math.ceil(units * multiplier))
    return min(MAX_MESSAGE_CREDITS, units)


def plan_for(user: dict[str, Any]) -> str:
    email = (user.get("email") or "").strip().lower()
    if email in ADMIN_BYPASS_EMAILS:
        return "chatty_enterprise"
    plan = (user.get("plan") or "").lower()
    if plan in PLAN_QUOTAS and plan != "free":
        return plan
    pref = (user.get("plan_preference") or "").lower()
    if pref in PLAN_QUOTAS and pref != "free":
        return pref
    return "chatty_standard"


def _month_start_iso() -> str:
    now = datetime.now(tz=timezone.utc)
    return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()


async def get_monthly_usage(user_id: str) -> int:
    try:
        res = await run_db(lambda: supabase.table("messages").select("id", count="exact", head=True).eq("user_id", user_id).eq("role", "user").gte("created_at", _month_start_iso()).execute())
        return res.count or 0
    except Exception:  # noqa: BLE001
        logger.exception("usage count failed")
        return 0


async def get_chatty_monthly_usage(owner_auth_id: str) -> int:
    """Return weighted AI credits used by all of an owner's Chatty bots."""
    try:
        # Aggregate in Postgres so usage checks do not download every
        # conversation row as a tenant grows.
        res = await run_db(lambda: supabase.rpc(
            "chatty_monthly_ai_credits",
            {"p_owner_auth_id": owner_auth_id, "p_month_start": _month_start_iso()},
        ).execute())
        value = res.data
        if isinstance(value, list):
            value = value[0] if value else 0
        return int(value or 0)
    except Exception:  # noqa: BLE001
        # Safe rollout fallback for installations that have not applied the
        # additive credit migration yet. Existing rows count as one credit.
        logger.warning("weighted usage RPC unavailable; using legacy message count", exc_info=True)
        try:
            bots = await run_db(lambda: supabase.table("chatty_bots").select("id").eq("user_id", owner_auth_id).execute())
            bot_ids = [bot["id"] for bot in (bots.data or [])]
            if not bot_ids:
                return 0
            res = await run_db(lambda: supabase.table("chatty_conversations").select("id", count="exact", head=True).in_("bot_id", bot_ids).eq("role", "user").gte("created_at", _month_start_iso()).execute())
            return res.count or 0
        except Exception:  # noqa: BLE001
            logger.exception("chatty usage count failed")
            return 0


async def get_chatty_bot_usage(
    bot_id: str,
    *,
    from_iso: str | None = None,
    to_iso: str | None = None,
) -> tuple[int, int]:
    """Return ``(visitor_messages, weighted_ai_credits)`` for one bot.

    The aggregation lives in Postgres so analytics does not download an
    unbounded conversation transcript.  The fallback keeps analytics usable
    for self-hosted installations that have not run the additive migration
    yet; legacy rows count as one credit.
    """
    try:
        args: dict[str, Any] = {"p_bot_id": bot_id}
        if from_iso is not None:
            args["p_from"] = from_iso
        if to_iso is not None:
            args["p_to"] = to_iso
        res = await run_db(lambda: supabase.rpc("chatty_bot_ai_credits", args).execute())
        value = res.data
        if isinstance(value, list):
            value = value[0] if value else {}
        if isinstance(value, dict):
            return int(value.get("visitor_messages") or 0), int(value.get("ai_credits") or 0)
    except Exception:  # noqa: BLE001
        logger.warning("bot usage RPC unavailable; using legacy analytics fallback", exc_info=True)

    try:
        query = supabase.table("chatty_conversations").select("role, usage_units").eq("bot_id", bot_id).eq("role", "user")
        if from_iso is not None:
            query = query.gte("created_at", from_iso)
        if to_iso is not None:
            query = query.lte("created_at", to_iso)
        res = await run_db(query.execute)
        rows = res.data or []
        return len(rows), sum(max(1, int(row.get("usage_units") or 1)) for row in rows)
    except Exception:  # noqa: BLE001
        # Pre-migration installations do not have usage_units. Keep their
        # analytics accurate by treating every historical visitor row as one.
        try:
            query = supabase.table("chatty_conversations").select("role").eq("bot_id", bot_id).eq("role", "user")
            if from_iso is not None:
                query = query.gte("created_at", from_iso)
            if to_iso is not None:
                query = query.lte("created_at", to_iso)
            res = await run_db(query.execute)
            count = len(res.data or [])
            return count, count
        except Exception:  # noqa: BLE001
            logger.exception("bot usage count failed")
            return 0, 0


async def chatty_quota_exceeded(
    owner_user: dict[str, Any],
    owner_auth_id: str,
    *,
    additional_units: int = 0,
    recorded_units: int = 0,
) -> bool:
    """Check whether a new AI request would exceed the owner's credit cap."""
    if not CHATTY_ENFORCE_AI_QUOTAS:
        return False
    if (owner_user.get("email") or "").strip().lower() in ADMIN_BYPASS_EMAILS:
        return False
    limit = PLAN_QUOTAS[plan_for(owner_user)]
    if limit <= 0:
        return False
    used = await get_monthly_usage(owner_user["id"])
    used += await get_chatty_monthly_usage(owner_auth_id)
    pending = max(0, int(additional_units))
    already_recorded = max(0, int(recorded_units))
    # Text routes persist the visitor row before the final gate so the
    # conversation is never lost. Remove that row's units from the observed
    # total for the decision; media/WhatsApp use a pre-flight pending amount.
    committed_before_request = max(0, used - already_recorded)
    return committed_before_request + pending > limit if pending else committed_before_request >= limit


OFFLINE_TRIAL_EXPIRED_MESSAGE = (
    "Our AI assistant is currently offline. "
    "Please leave your contact information and message below, and our team will get back to you shortly."
)

OFFLINE_SUBSCRIPTION_INACTIVE_MESSAGE = (
    "Our AI assistant is currently offline. "
    "Please leave your contact information and message below, and our team will get back to you shortly."
)


async def check_bot_owner_subscription(
    owner_user: dict[str, Any],
    owner_auth_id: str,
) -> dict[str, Any]:
    """Evaluate whether an owner's account has an active trial or valid subscription.

    If the 14-day free trial has expired or the subscription is cancelled/unpaid/past_due,
    returns is_active=False, reason code, and a polite visitor-facing offline message.
    """
    if not CHATTY_ENFORCE_AI_QUOTAS:
        return {"is_active": True, "status": "active", "reason": None, "offline_message": ""}

    owner_email = (owner_user.get("email") or "").strip().lower()
    if owner_email in ADMIN_BYPASS_EMAILS:
        return {"is_active": True, "status": "active", "reason": None, "offline_message": ""}

    sub_status = (owner_user.get("subscription_status") or "").strip().lower()

    # Active paid subscription or active provider-managed trial
    if sub_status in ("active", "on_trial", "paid"):
        return {"is_active": True, "status": "active", "reason": None, "offline_message": ""}

    # Explicit cancelled or expired subscription
    if sub_status in ("cancelled", "canceled", "expired"):
        return {
            "is_active": False,
            "status": "subscription_canceled",
            "reason": "Subscription cancelled or expired",
            "offline_message": OFFLINE_SUBSCRIPTION_INACTIVE_MESSAGE,
        }

    # Explicit past-due or unpaid billing problem
    if sub_status in ("past_due", "unpaid"):
        return {
            "is_active": False,
            "status": "payment_failed",
            "reason": "Subscription payment failed or past due",
            "offline_message": OFFLINE_SUBSCRIPTION_INACTIVE_MESSAGE,
        }

    # Explicit paused or suspended statuses
    if sub_status in ("paused", "suspended", "inactive"):
        return {
            "is_active": False,
            "status": "inactive",
            "reason": "Subscription paused or inactive",
            "offline_message": OFFLINE_SUBSCRIPTION_INACTIVE_MESSAGE,
        }

    # Free plan or no active subscription record -> Evaluate 14-day trial
    trial_start_raw = owner_user.get("trial_started_at") or owner_user.get("created_at")
    start_dt: datetime | None = None
    if trial_start_raw:
        if isinstance(trial_start_raw, datetime):
            start_dt = trial_start_raw
        elif isinstance(trial_start_raw, str):
            try:
                start_dt = datetime.fromisoformat(trial_start_raw.replace("Z", "+00:00"))
            except Exception:
                pass

    if not start_dt and owner_auth_id:
        try:
            u_resp = await run_db(lambda: supabase.auth.admin.get_user_by_id(owner_auth_id))
            if u_resp and u_resp.user:
                meta = u_resp.user.user_metadata or {}
                raw_meta = meta.get("trial_started_at") or u_resp.user.created_at
                if raw_meta:
                    start_dt = datetime.fromisoformat(str(raw_meta).replace("Z", "+00:00"))
        except Exception:
            pass

    if not start_dt:
        start_dt = datetime.now(timezone.utc)

    if start_dt.tzinfo is None:
        start_dt = start_dt.replace(tzinfo=timezone.utc)

    now = datetime.now(timezone.utc)
    if now > (start_dt + timedelta(days=14)):
        return {
            "is_active": False,
            "status": "trial_expired",
            "reason": "14-day free trial has expired",
            "offline_message": OFFLINE_TRIAL_EXPIRED_MESSAGE,
        }

    return {"is_active": True, "status": "on_trial", "reason": None, "offline_message": ""}

