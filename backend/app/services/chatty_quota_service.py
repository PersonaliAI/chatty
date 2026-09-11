"""Chatty plan resolution and widget-message quota enforcement.

This service intentionally owns the Chatty-specific quota path so routers and
business services do not import the application entrypoint.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from app.core.clients import supabase
from app.core.config import ADMIN_BYPASS_EMAILS
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


async def chatty_quota_exceeded(owner_user: dict[str, Any], owner_auth_id: str) -> bool:
    if (owner_user.get("email") or "").strip().lower() in ADMIN_BYPASS_EMAILS:
        return False
    limit = PLAN_QUOTAS[plan_for(owner_user)]
    if limit <= 0:
        return False
    used = await get_monthly_usage(owner_user["id"])
    used += await get_chatty_monthly_usage(owner_auth_id)
    return used >= limit
