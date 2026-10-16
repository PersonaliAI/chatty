"""Bot onboarding wizard endpoint (/api/onboarding/*)."""

from __future__ import annotations

import logging
import os
import re
from typing import Any

import psycopg2
from psycopg2 import sql as pg_sql
from fastapi import APIRouter, Depends, HTTPException

from app.core.clients import supabase
from app.core.config import SUPABASE_URL
from app.core.db import run_db
from app.core.deps import require_user
from app.schemas.onboarding import OnboardingUpdateRequest

logger = logging.getLogger("chatty")

router = APIRouter()


def add_lead_column(column_name: str):
    """Lead custom fields are stored dynamically in chatty_leads.custom_fields (JSONB).
    DDL schema mutation is not performed at runtime."""
    return


@router.post("/api/onboarding/update")
async def onboarding_update(
    req: OnboardingUpdateRequest,
    user: dict[str, Any] = Depends(require_user),
):
    # Verify bot belongs to user
    res = await run_db(lambda: supabase.table("chatty_bots").select("*").eq("id", req.bot_id).eq("user_id", user["auth_user_id"]).execute())
    if not res.data:
        raise HTTPException(status_code=404, detail="Bot not found or unauthorized")

    update_data = {
        "onboarding_step": req.step,
        "onboarding_completed": req.completed,
    }

    if req.custom_instructions is not None:
        update_data["system_instructions"] = req.custom_instructions
    if req.lead_fields is not None:
        update_data["lead_fields"] = req.lead_fields
    if req.lead_capture_enabled is not None:
        update_data["lead_capture_enabled"] = req.lead_capture_enabled
    if req.lead_required_fields is not None:
        update_data["lead_required_fields"] = req.lead_required_fields

    if req.bot_country is not None:
        update_data["bot_country"] = req.bot_country
    if req.bot_timezone is not None:
        update_data["bot_timezone"] = req.bot_timezone
    if req.sync_google_drive is not None:
        update_data["sync_google_drive"] = req.sync_google_drive
    if req.sync_google_calendar is not None:
        update_data["sync_google_calendar"] = req.sync_google_calendar
    if req.sync_outlook_calendar is not None:
        update_data["sync_outlook_calendar"] = req.sync_outlook_calendar
    if req.sync_office365_calendar is not None:
        update_data["sync_office365_calendar"] = req.sync_office365_calendar
    if req.meeting_provider is not None:
        update_data["meeting_provider"] = req.meeting_provider
    if req.calendar_scheduling_enabled is not None:
        update_data["calendar_scheduling_enabled"] = req.calendar_scheduling_enabled

    try:
        await run_db(lambda: supabase.table("chatty_bots").update(update_data).eq("id", req.bot_id).execute())

        # Insert audit log
        action_name = f"onboarding_step_{req.step}"
        if req.completed:
            action_name = "onboarding_completed"

        await run_db(lambda: supabase.table("chatty_audit_logs").insert({
            "bot_id": req.bot_id,
            "action": action_name,
            "details": f"Completed setup step {req.step} (onboarding_completed: {req.completed})",
            "performed_by": "user"
        }).execute())

        return {"success": True, "message": "Onboarding state updated successfully"}
    except Exception as e:
        logger.exception("Failed to update onboarding state")
        raise HTTPException(status_code=500, detail="Failed to update onboarding state") from e
