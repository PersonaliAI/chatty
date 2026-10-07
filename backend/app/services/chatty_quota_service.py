"""Chatty plan resolution and widget-message quota enforcement.

This service intentionally owns the Chatty-specific quota path so routers and
business services do not import the application entrypoint.
"""
from __future__ import annotations

import logging
import math
from datetime import datetime, timezone
from typing import Any

from app.core.clients import supabase
from app.core.config import ADMIN_BYPASS_EMAILS, CHATTY_ENFORCE_AI_QUOTAS
from app.core.db import run_db

logger = logging.getLogger("chatty.quota")

PLAN_QUOTAS: dict[str, int] = {
    "free": 100,
    "basic": 500,
    "pro": 3000,
    "executive": 15000,
    "chatty_hobby": 1000,
    "chatty_standard": 10000,
    "chatty_business": 40000,
}

WHITELABEL_PLANS = {"pro", "executive", "chatty_business"}

# Flat plans sell predictable AI capacity rather than raw conversation rows.
# A normal short text turn costs one credit; larger or multimodal requests
# consume more credits because they cause materially more provider work.
MAX_MESSAGE_CREDITS = 8


def usage_units_for_message(text: str | None, *, has_media: bool = False) -> int:
    """Return server-calculated AI credits for one visitor request."""
    chars = len((text or "").strip())
    units = max(1, math.ceil(chars / 4000))
    if has_media:
        units += 3
    return min(MAX_MESSAGE_CREDITS, units)


def plan_for(user: dict[str, Any]) -> str:
    email = (user.get("email") or "").strip().lower()
    if email in ADMIN_BYPASS_EMAILS:
        return "chatty_business"
    plan = (user.get("plan") or "free").lower()
    return plan if plan in PLAN_QUOTAS else "free"


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
