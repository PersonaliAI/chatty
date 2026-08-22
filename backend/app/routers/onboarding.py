"""Bot onboarding wizard endpoint (/api/onboarding/*)."""

from __future__ import annotations

import logging
import os
import re
from typing import Any

import psycopg2
from fastapi import APIRouter, Depends, HTTPException

from app.core.clients import supabase
from app.core.config import SUPABASE_URL
from app.core.db import run_db
from app.core.deps import require_user
from app.schemas.onboarding import OnboardingUpdateRequest

logger = logging.getLogger("chatty")

router = APIRouter()


def add_lead_column(column_name: str):
    clean_name = re.sub(r'[^a-zA-Z0-9_]', '', column_name.lower().replace(" ", "_"))
    if not clean_name:
        return

    # Check reserved words
    if clean_name in ["id", "bot_id", "name", "email", "phone", "created_at", "company", "job_title", "country", "industry", "budget", "custom_fields"]:
        return

    sql = f"ALTER TABLE chatty_leads ADD COLUMN IF NOT EXISTS {clean_name} TEXT;"
    # Direct-connection credentials read from environment (no hardcoded secrets).
    project_ref = (SUPABASE_URL or "").split("//")[-1].split(".")[0]
    host = os.environ.get("SUPABASE_DB_HOST", "aws-1-ap-northeast-1.pooler.supabase.com")
    user = os.environ.get("SUPABASE_DB_USER", f"postgres.{project_ref}")
    password = os.environ.get("SUPABASE_DB_PASSWORD", "")
    dbname = os.environ.get("SUPABASE_DB_NAME", "postgres")
    port = int(os.environ.get("SUPABASE_DB_PORT", "6543"))
    if not password:
        logger.error("SUPABASE_DB_PASSWORD not set; cannot add lead column %s", clean_name)
        return

    try:
        conn = psycopg2.connect(
            host=host,
            user=user,
            password=password,
            dbname=dbname,
            port=port,
            connect_timeout=5
        )
        cursor = conn.cursor()
        cursor.execute(sql)
        conn.commit()
        cursor.close()
        conn.close()
        logger.info("Successfully added dynamic column %s to chatty_leads", clean_name)
    except Exception as e:
        logger.exception("Failed to add dynamic column %s to chatty_leads: %s", clean_name, e)


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
        # Dynamically add custom columns to the database
        std_cols = ["name", "email", "phone", "company", "job_title", "country", "industry", "budget"]
        for field in req.lead_fields:
            if field.lower() not in std_cols:
                await run_db(lambda field=field: add_lead_column(field))
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
        raise HTTPException(status_code=500, detail=str(e))
