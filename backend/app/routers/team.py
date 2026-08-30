"""Team member management endpoints (/api/team*)."""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from app.core.clients import supabase
from app.core.db import run_db
from app.core.deps import require_user
from app.core.permissions import (
    OWNER_ONLY_TABS,
    default_permissions_for_role,
    get_bot_role_and_permissions,
    verify_bot_permission,
)
from app.schemas.team import TeamInviteRequest, TeamUpdateRequest
from plugins import notifications as notify

logger = logging.getLogger("chatty")

router = APIRouter()


def _sanitize_permissions(requested: list[str] | None, role: str, caller_role: str) -> list[str]:
    """Fill in the role's default set when unset, and strip owner-only tabs
    (billing/byok/webhooks) unless the caller granting them is the owner."""
    perms = list(requested) if requested is not None else default_permissions_for_role(role)
    if caller_role != "owner":
        perms = [p for p in perms if p not in OWNER_ONLY_TABS]
    return perms


@router.get("/api/team")
async def list_team(bot_id: str, user: dict[str, Any] = Depends(require_user)):
    await verify_bot_permission(bot_id, user, "team")
    rows = (await run_db(lambda: supabase.table("chatty_team_members").select("*").eq(
        "bot_id", bot_id).order("created_at", desc=False).execute())).data or []
    return {"members": rows}


@router.get("/api/team/me")
async def my_team_role(bot_id: str, user: dict[str, Any] = Depends(require_user)):
    """The caller's own role + dashboard-tab permissions for this bot, so the
    frontend can gate which tabs/actions to render."""
    role, permissions = await get_bot_role_and_permissions(bot_id, user)
    return {"role": role, "permissions": permissions}


@router.post("/api/team")
async def invite_team(req: TeamInviteRequest, user: dict[str, Any] = Depends(require_user)):
    caller_role = await verify_bot_permission(req.bot_id, user, "team")
    email = (req.email or "").strip().lower()
    if "@" not in email or "." not in email:
        raise HTTPException(status_code=400, detail="A valid email is required")
    role = req.role if req.role in ("admin", "agent") else "agent"
    permissions = _sanitize_permissions(req.permissions, role, caller_role)
    try:
        await run_db(lambda: supabase.table("chatty_team_members").upsert(
            {"bot_id": req.bot_id, "email": email, "role": role, "permissions": permissions},
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

    return {"ok": True, "email": email, "role": role, "permissions": permissions, "email_status": email_status}


@router.patch("/api/team/{member_id}")
async def update_team(member_id: str, req: TeamUpdateRequest, user: dict[str, Any] = Depends(require_user)):
    caller_role = await verify_bot_permission(req.bot_id, user, "team")
    existing = await run_db(lambda: supabase.table("chatty_team_members").select("role").eq(
        "id", member_id).eq("bot_id", req.bot_id).limit(1).execute())
    if not existing.data:
        raise HTTPException(status_code=404, detail="Member not found")

    role = req.role if req.role in ("admin", "agent") else existing.data[0]["role"]
    update: dict[str, Any] = {"role": role}
    if req.permissions is not None:
        update["permissions"] = _sanitize_permissions(req.permissions, role, caller_role)

    await run_db(lambda: supabase.table("chatty_team_members").update(update).eq(
        "id", member_id).eq("bot_id", req.bot_id).execute())
    return {"ok": True, **update}


@router.delete("/api/team/{member_id}")
async def remove_team(member_id: str, bot_id: str, user: dict[str, Any] = Depends(require_user)):
    await verify_bot_permission(bot_id, user, "team")
    await run_db(lambda: supabase.table("chatty_team_members").delete().eq(
        "id", member_id).eq("bot_id", bot_id).execute())
    return {"ok": True}
