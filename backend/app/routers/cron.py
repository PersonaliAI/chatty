"""Scheduler-triggered maintenance endpoints not owned by another feature
group (/cron/purge-old-conversations, /cron/process-webhook-retries,
/cron/detect-ended-sessions). Protected by FUNCTION_SECRET, same convention
as the other /cron/* routes scattered across the other router modules."""

from __future__ import annotations

import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException

from app.core.clients import supabase
from app.core.config import FUNCTION_SECRET
from plugins import notifications as notify

logger = logging.getLogger("chatty")

router = APIRouter()


@router.post("/cron/purge-old-conversations")
async def purge_old_conversations(secret: Optional[str] = None):
    """Retention: delete conversations + sessions older than CHATTY_RETENTION_DAYS.
    Disabled (no-op) when the env var is unset or 0. Protected by FUNCTION_SECRET."""
    if FUNCTION_SECRET and secret != FUNCTION_SECRET:
        raise HTTPException(status_code=403, detail="invalid secret")
    days = int(os.environ.get("CHATTY_RETENTION_DAYS", "0") or "0")
    if days <= 0:
        return {"purged": 0, "note": "retention disabled (set CHATTY_RETENTION_DAYS)"}
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    n = 0
    try:
        res = supabase.table("chatty_conversations").delete().lt("created_at", cutoff).execute()
        n = len(res.data or [])
        supabase.table("chatty_sessions").delete().lt("last_message_at", cutoff).execute()
    except Exception:
        logger.exception("retention purge failed")
    return {"purged": n, "older_than_days": days}


@router.post("/cron/process-webhook-retries")
async def cron_process_webhook_retries(secret: Optional[str] = None):
    """Retries queued webhook deliveries per notify.WEBHOOK_BACKOFF_SCHEDULE.
    Protected by FUNCTION_SECRET, same convention as the other /cron/* routes."""
    if FUNCTION_SECRET and secret != FUNCTION_SECRET:
        raise HTTPException(status_code=403, detail="invalid secret")
    return await notify.process_due_webhook_retries(supabase)


@router.post("/cron/detect-ended-sessions")
async def cron_detect_ended_sessions(secret: Optional[str] = None):
    """Fires session.ended for sessions idle 30+ minutes. Protected by
    FUNCTION_SECRET, same convention as the other /cron/* routes."""
    if FUNCTION_SECRET and secret != FUNCTION_SECRET:
        raise HTTPException(status_code=403, detail="invalid secret")
    return await notify.detect_and_fire_ended_sessions(supabase, idle_minutes=30)
