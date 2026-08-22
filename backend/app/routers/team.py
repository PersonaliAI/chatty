"""Team member management endpoints (/api/team*)."""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from app.core.clients import supabase
from app.core.db import run_db
from app.core.deps import require_user
from app.schemas.team import TeamInviteRequest
from plugins import notifications as notify

# Bridged helper still living in main.py (shared across many route groups).
from main import _verify_bot_owner

logger = logging.getLogger("chatty")

router = APIRouter()


@router.get("/api/team")
async def list_team(bot_id: str, user: dict[str, Any] = Depends(require_user)):
    await _verify_bot_owner(bot_id, user)
    rows = (await run_db(lambda: supabase.table("chatty_team_members").select("*").eq(
        "bot_id", bot_id).order("created_at", desc=False).execute())).data or []
    return {"members": rows}


@router.post("/api/team")
async def invite_team(req: TeamInviteRequest, user: dict[str, Any] = Depends(require_user)):
    await _verify_bot_owner(req.bot_id, user)
    email = (req.email or "").strip().lower()
    if "@" not in email or "." not in email:
        raise HTTPException(status_code=400, detail="A valid email is required")
    role = req.role if req.role in ("admin", "agent") else "agent"
    try:
        await run_db(lambda: supabase.table("chatty_team_members").upsert(
            {"bot_id": req.bot_id, "email": email, "role": role},
            on_conflict="bot_id,email",
        ).execute())
    except Exception:
        logger.exception("team invite failed")
        raise HTTPException(status_code=500, detail="Could not add member")

    email_status = "logged"
    try:
        bot_row = await run_db(lambda: supabase.table("chatty_bots").select("name").eq(
            "id", req.bot_id).limit(1).execute())
        bot_name = (bot_row.data[0].get("name") if bot_row.data else None) or "a chatbot"
        html = notify.build_team_invite_email_html(
            bot_name=bot_name, inviter_email=user.get("email") or "A teammate", role=role,
        )
        email_status = await notify.deliver_email(
            supabase=supabase, owner_user=user, to=email,
            subject=f"You've been added to {bot_name}", html=html,
        )
    except Exception:
        logger.exception("team invite email failed for %s", email)

    return {"ok": True, "email": email, "role": role, "email_status": email_status}


@router.delete("/api/team/{member_id}")
async def remove_team(member_id: str, bot_id: str, user: dict[str, Any] = Depends(require_user)):
    await _verify_bot_owner(bot_id, user)
    await run_db(lambda: supabase.table("chatty_team_members").delete().eq(
        "id", member_id).eq("bot_id", bot_id).execute())
    return {"ok": True}
