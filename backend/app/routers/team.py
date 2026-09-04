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
from app.schemas.team import AvailabilityRulesRequest, TeamInviteRequest, TeamUpdateRequest
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
    name = (req.name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="A name is required")
    role = req.role if req.role in ("admin", "agent") else "agent"
    permissions = _sanitize_permissions(req.permissions, role, caller_role)
    try:
        await run_db(lambda: supabase.table("chatty_team_members").upsert(
            {
                "bot_id": req.bot_id, "email": email, "name": name,
                "phone": (req.phone or "").strip() or None,
                "role": role, "permissions": permissions,
            },
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

    return {"ok": True, "email": email, "name": name, "role": role, "permissions": permissions, "email_status": email_status}


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
    if req.name is not None:
        name = req.name.strip()
        if not name:
            raise HTTPException(status_code=400, detail="Name cannot be empty")
        update["name"] = name
    if req.phone is not None:
        update["phone"] = req.phone.strip() or None
    if req.bookable is not None:
        update["bookable"] = req.bookable
    if req.book_on_own_calendar is not None:
        update["book_on_own_calendar"] = req.book_on_own_calendar

    await run_db(lambda: supabase.table("chatty_team_members").update(update).eq(
        "id", member_id).eq("bot_id", req.bot_id).execute())
    return {"ok": True, **update}


@router.delete("/api/team/{member_id}")
async def remove_team(member_id: str, bot_id: str, user: dict[str, Any] = Depends(require_user)):
    await verify_bot_permission(bot_id, user, "team")
    await run_db(lambda: supabase.table("chatty_team_members").delete().eq(
        "id", member_id).eq("bot_id", bot_id).execute())
    return {"ok": True}


async def _authorize_availability_access(member_id: str, bot_id: str, user: dict[str, Any]) -> dict[str, Any]:
    """A member may manage their own availability; anyone with the 'team'
    permission on this bot (owner, or an admin with that tab) may manage
    anyone's. Returns the member row (needed for its email) or raises 403/404."""
    existing = await run_db(lambda: supabase.table("chatty_team_members").select("*").eq(
        "id", member_id).eq("bot_id", bot_id).limit(1).execute())
    if not existing.data:
        raise HTTPException(status_code=404, detail="Member not found")
    member = existing.data[0]
    caller_email = (user.get("email") or "").strip().lower()
    if caller_email and caller_email == (member.get("email") or "").strip().lower():
        return member
    await verify_bot_permission(bot_id, user, "team")
    return member


@router.get("/api/team/{member_id}/availability")
async def get_availability(member_id: str, bot_id: str, user: dict[str, Any] = Depends(require_user)):
    member = await _authorize_availability_access(member_id, bot_id, user)
    rows = (await run_db(lambda: supabase.table("chatty_availability_rules").select("*").eq(
        "bot_id", bot_id).eq("member_email", member["email"]).order("day_of_week").execute())).data or []
    return {"rules": rows}


@router.put("/api/team/{member_id}/availability")
async def set_availability(member_id: str, req: AvailabilityRulesRequest, user: dict[str, Any] = Depends(require_user)):
    member = await _authorize_availability_access(member_id, req.bot_id, user)
    for r in req.rules:
        if not (0 <= r.day_of_week <= 6):
            raise HTTPException(status_code=400, detail="day_of_week must be 0-6")
        if not (0 <= r.start_minute < r.end_minute <= 1440):
            raise HTTPException(status_code=400, detail="Invalid start_minute/end_minute range")

    # Replace-all semantics: simplest correct behavior for "here is my full
    # weekly schedule" — the caller always sends the complete set, not a diff.
    await run_db(lambda: supabase.table("chatty_availability_rules").delete().eq(
        "bot_id", req.bot_id).eq("member_email", member["email"]).execute())
    if req.rules:
        rows = [
            {
                "bot_id": req.bot_id, "member_email": member["email"],
                "day_of_week": r.day_of_week, "start_minute": r.start_minute, "end_minute": r.end_minute,
            }
            for r in req.rules
        ]
        await run_db(lambda: supabase.table("chatty_availability_rules").insert(rows).execute())
    return {"ok": True, "rules": [r.model_dump() for r in req.rules]}
