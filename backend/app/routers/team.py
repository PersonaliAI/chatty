"""Team member management endpoints (/api/team*)."""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from app.core.clients import supabase
from app.core.db import run_db
from app.core.deps import require_user
from app.core.permissions import (
    ALL_TABS,
    OWNER_ONLY_TABS,
    VALID_ROLES,
    ROLE_PERMISSIONS,
    default_permissions_for_role,
    get_bot_role_and_permissions,
    verify_bot_permission,
)
from app.schemas.team import AvailabilityRulesRequest, TeamInviteRequest, TeamUpdateRequest
from plugins import notifications as notify

logger = logging.getLogger("chatty")

router = APIRouter()




def _actor_email(user: dict[str, Any]) -> str:
    return (user.get("email") or user.get("auth_user_id") or "user").strip()


async def _write_team_audit_log(bot_id: str, action: str, details: str, user: dict[str, Any]) -> None:
    """Best-effort audit trail for dashboard team/availability changes."""
    try:
        await run_db(lambda: supabase.table("chatty_audit_logs").insert({
            "bot_id": bot_id,
            "action": action,
            "details": details,
            "performed_by": _actor_email(user),
        }).execute())
    except Exception:
        logger.warning("Failed to write team audit log", exc_info=True)


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

    # Check calendar connection status for each member in users table
    emails = [m["email"].strip().lower() for m in rows if m.get("email")]
    user_calendars: dict[str, Any] = {}
    if emails:
        try:
            u_res = await run_db(lambda: supabase.table("users").select(
                "email, google_email, google_access_token, microsoft_email, microsoft_access_token"
            ).in_("email", emails).execute())
            for u in (u_res.data or []):
                em = (u.get("email") or "").strip().lower()
                user_calendars[em] = {
                    "google_connected": bool(u.get("google_access_token")),
                    "google_email": u.get("google_email"),
                    "microsoft_connected": bool(u.get("microsoft_access_token")),
                    "microsoft_email": u.get("microsoft_email"),
                }
        except Exception:
            logger.warning("Failed to lookup member calendar status from users table", exc_info=True)

    for m in rows:
        em = (m.get("email") or "").strip().lower()
        cal = user_calendars.get(em, {})
        m["google_connected"] = bool(m.get("google_calendar_connected") or cal.get("google_connected"))
        m["google_email"] = m.get("google_email") or cal.get("google_email")
        m["microsoft_connected"] = bool(m.get("microsoft_calendar_connected") or cal.get("microsoft_connected"))
        m["microsoft_email"] = m.get("microsoft_email") or cal.get("microsoft_email")

    # Fetch the bot owner
    owner_info = None
    try:
        b_res = await run_db(lambda: supabase.table("chatty_bots").select("id, user_id, name").eq("id", bot_id).limit(1).execute())
        if b_res.data:
            owner_id = b_res.data[0].get("user_id")
            o_res = await run_db(lambda: supabase.table("users").select(
                "id, auth_user_id, email, name, full_name, google_email, google_access_token, microsoft_email, microsoft_access_token"
            ).or_(f"id.eq.{owner_id},auth_user_id.eq.{owner_id}").limit(1).execute())
            if o_res.data:
                o_user = o_res.data[0]
                owner_info = {
                    "id": o_user.get("id") or owner_id,
                    "email": o_user.get("email") or "owner@workspace.com",
                    "name": o_user.get("name") or o_user.get("full_name") or "Account Owner",
                    "role": "owner",
                    "permissions": list(ALL_TABS),
                    "is_owner": True,
                    "google_connected": bool(o_user.get("google_access_token")),
                    "google_email": o_user.get("google_email"),
                    "microsoft_connected": bool(o_user.get("microsoft_access_token")),
                    "microsoft_email": o_user.get("microsoft_email"),
                }
    except Exception:
        logger.warning("Failed to load bot owner info", exc_info=True)

    return {"members": rows, "owner": owner_info}


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
    raw_role = req.role if req.role in VALID_ROLES else "agent"
    if raw_role == "owner" and caller_role != "owner":
        raise HTTPException(status_code=403, detail="Only the owner can assign the owner role")
    role = raw_role
    permissions = _sanitize_permissions(req.permissions, role, caller_role)
    payload = {
        "bot_id": req.bot_id, "email": email, "name": name,
        "phone": (req.phone or "").strip() or None,
        "role": role, "permissions": permissions,
    }
    try:
        await run_db(lambda: supabase.table("chatty_team_members").upsert(
            payload,
            on_conflict="bot_id,email",
        ).execute())
    except Exception as exc:
        err_msg = str(exc).lower()
        if "role" in err_msg and role not in ("admin", "agent"):
            logger.warning("DB check constraint on role rejected %s; falling back to agent with customized permissions", role)
            payload["role"] = "admin" if role in ("editor", "billing_manager") else "agent"
            await run_db(lambda: supabase.table("chatty_team_members").upsert(
                payload,
                on_conflict="bot_id,email",
            ).execute())
        else:
            logger.exception("team invite failed")
            raise HTTPException(status_code=500, detail="Could not add member")

    await _write_team_audit_log(
        req.bot_id,
        "team_member_upserted",
        f"Added or updated {email} as {role} with permissions: {', '.join(permissions)}",
        user,
    )

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
        logger.exception("Team invite email failed")

    return {"ok": True, "email": email, "name": name, "role": role, "permissions": permissions, "email_status": email_status}


@router.patch("/api/team/{member_id}")
async def update_team(member_id: str, req: TeamUpdateRequest, user: dict[str, Any] = Depends(require_user)):
    caller_role = await verify_bot_permission(req.bot_id, user, "team")
    existing = await run_db(lambda: supabase.table("chatty_team_members").select("role, email").eq(
        "id", member_id).eq("bot_id", req.bot_id).limit(1).execute())
    existing_role = existing.data[0].get("role") if existing.data else None
    if not existing_role:
        raise HTTPException(status_code=404, detail="Member not found")

    target_role = req.role if req.role in VALID_ROLES else existing_role
    if target_role == "owner" and caller_role != "owner":
        raise HTTPException(status_code=403, detail="Only the owner can assign the owner role")
    role = target_role
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
    if req.zoom_meeting_link is not None:
        update["zoom_meeting_link"] = req.zoom_meeting_link.strip() or None
    if req.google_email is not None:
        update["google_email"] = req.google_email.strip().lower() or None
        update["google_calendar_connected"] = bool(update["google_email"])
    if req.microsoft_email is not None:
        update["microsoft_email"] = req.microsoft_email.strip().lower() or None
        update["microsoft_calendar_connected"] = bool(update["microsoft_email"])

    try:
        await run_db(lambda: supabase.table("chatty_team_members").update(update).eq(
            "id", member_id).eq("bot_id", req.bot_id).execute())
    except Exception as exc:
        err_msg = str(exc).lower()
        if "role" in err_msg and role not in ("admin", "agent"):
            logger.warning("DB constraint rejected %s; falling back to agent role", role)
            update["role"] = "admin" if role in ("editor", "billing_manager") else "agent"
            await run_db(lambda: supabase.table("chatty_team_members").update(update).eq(
                "id", member_id).eq("bot_id", req.bot_id).execute())
        else:
            raise

    await _write_team_audit_log(
        req.bot_id,
        "team_member_updated",
        f"Updated team member {existing.data[0].get('email') or member_id}: {', '.join(sorted(update.keys()))}",
        user,
    )
    return {"ok": True, **update}


@router.delete("/api/team/{member_id}")
async def remove_team(member_id: str, bot_id: str, user: dict[str, Any] = Depends(require_user)):
    await verify_bot_permission(bot_id, user, "team")
    existing = await run_db(lambda: supabase.table("chatty_team_members").select("email").eq(
        "id", member_id).eq("bot_id", bot_id).limit(1).execute())
    if not existing.data:
        return {"ok": True}
    member_email = existing.data[0].get("email")

    # Ensure not removing bot owner
    bot_res = await run_db(lambda: supabase.table("chatty_bots").select("user_id").eq("id", bot_id).limit(1).execute())
    if bot_res.data:
        owner_id = bot_res.data[0].get("user_id")
        u_res = await run_db(lambda: supabase.table("users").select("email").or_(f"id.eq.{owner_id},auth_user_id.eq.{owner_id}").limit(1).execute())
        if u_res.data and u_res.data[0].get("email", "").lower() == (member_email or "").lower():
            raise HTTPException(status_code=400, detail="Cannot remove the bot owner from the team")

    await run_db(lambda: supabase.table("chatty_team_members").delete().eq(
        "id", member_id).eq("bot_id", bot_id).execute())
    await _write_team_audit_log(bot_id, "team_member_removed", f"Removed team member {member_email}", user)
    return {"ok": True}


@router.post("/api/team/{member_id}/calendar-link")
async def link_member_calendar(
    member_id: str,
    body: dict[str, Any],
    user: dict[str, Any] = Depends(require_user),
):
    """Allows an employee (or an admin/owner with 'team' permission) to link a
    personal Google email, Microsoft email, or Zoom meeting room for that member."""
    bot_id = body.get("bot_id")
    if not bot_id:
        raise HTTPException(status_code=400, detail="bot_id is required")
    member = await _authorize_availability_access(member_id, bot_id, user)

    update: dict[str, Any] = {}
    if "google_email" in body:
        update["google_email"] = (body["google_email"] or "").strip().lower() or None
        update["google_calendar_connected"] = bool(update["google_email"])
    if "microsoft_email" in body:
        update["microsoft_email"] = (body["microsoft_email"] or "").strip().lower() or None
        update["microsoft_calendar_connected"] = bool(update["microsoft_email"])
    if "zoom_meeting_link" in body:
        update["zoom_meeting_link"] = (body["zoom_meeting_link"] or "").strip() or None

    if not update:
        raise HTTPException(status_code=400, detail="No calendar fields provided")

    try:
        await run_db(lambda: supabase.table("chatty_team_members").update(update).eq(
            "id", member_id).eq("bot_id", bot_id).execute())
    except Exception:
        logger.warning("Failed to update calendar fields on chatty_team_members", exc_info=True)

    await _write_team_audit_log(
        bot_id,
        "team_member_calendar_updated",
        f"Updated calendar connection for {member['email']}: {', '.join(update.keys())}",
        user,
    )
    return {"ok": True, "member_id": member_id, **update}


async def _authorize_availability_access(member_id: str, bot_id: str, user: dict[str, Any]) -> dict[str, Any]:
    """A member may manage their own availability; anyone with the 'team'
    permission on this bot (owner, or an admin with that tab) may manage
    anyone's. Returns the member row (needed for its email) or raises 403/404."""
    existing = await run_db(lambda: supabase.table("chatty_team_members").select("*").eq(
        "id", member_id).eq("bot_id", bot_id).limit(1).execute())
    member = existing.data[0] if existing.data else None
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
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
    # weekly schedule" - the caller always sends the complete set, not a diff.
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
    await _write_team_audit_log(
        req.bot_id,
        "team_availability_updated",
        f"Updated availability for {member['email']} with {len(req.rules)} weekly rule(s)",
        user,
    )
    return {"ok": True, "rules": [r.model_dump() for r in req.rules]}


@router.post("/api/team/sync-from-bot")
async def sync_team_from_bot(
    body: dict[str, Any],
    user: dict[str, Any] = Depends(require_user),
):
    """Copy or sync team members from source_bot_id to target_bot_id."""
    target_bot_id = body.get("target_bot_id")
    source_bot_id = body.get("source_bot_id")
    if not target_bot_id or not source_bot_id:
        raise HTTPException(status_code=400, detail="source_bot_id and target_bot_id are required")
    if target_bot_id == source_bot_id:
        raise HTTPException(status_code=400, detail="Source and target bot cannot be the same")

    await verify_bot_permission(source_bot_id, user, "team")
    await verify_bot_permission(target_bot_id, user, "team")

    src_rows = (await run_db(lambda: supabase.table("chatty_team_members").select("*").eq(
        "bot_id", source_bot_id
    ).execute())).data or []

    copied = 0
    for m in src_rows:
        row = {
            "bot_id": target_bot_id,
            "email": m["email"],
            "name": m.get("name"),
            "role": m.get("role") or "agent",
            "permissions": m.get("permissions") or [],
            "phone": m.get("phone"),
            "bookable": m.get("bookable", False),
            "book_on_own_calendar": m.get("book_on_own_calendar", True),
            "avatar_url": m.get("avatar_url"),
        }
        await run_db(lambda: supabase.table("chatty_team_members").upsert(
            row, on_conflict="bot_id,email"
        ).execute())
        copied += 1

    await run_db(lambda: supabase.table("chatty_bots").update({
        "team_source_bot_id": source_bot_id
    }).eq("id", target_bot_id).execute())

    await _write_team_audit_log(
        target_bot_id,
        "team_synced_from_bot",
        f"Copied {copied} member(s) from bot {source_bot_id}",
        user,
    )
    return {"ok": True, "copied": copied}


@router.post("/api/team/unlink-shared")
async def unlink_shared_team(
    body: dict[str, Any],
    user: dict[str, Any] = Depends(require_user),
):
    bot_id = body.get("bot_id")
    if not bot_id:
        raise HTTPException(status_code=400, detail="bot_id is required")
    await verify_bot_permission(bot_id, user, "team")
    await run_db(lambda: supabase.table("chatty_bots").update({
        "team_source_bot_id": None
    }).eq("id", bot_id).execute())
    return {"ok": True}
