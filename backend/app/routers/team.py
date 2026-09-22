"""Team member management endpoints (/api/team*)."""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from psycopg2.extras import RealDictCursor

from app.core.clients import supabase
from app.core.config import DEPLOYMENT_PROFILE
from app.core.db import run_db
from app.core.db_pool import connection
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


async def _self_host_member(member_id: str, bot_id: str) -> dict[str, Any] | None:
    if DEPLOYMENT_PROFILE != "self_host":
        return None

    def _fetch() -> dict[str, Any] | None:
        with connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    "SELECT * FROM chatty_team_members WHERE id = %s AND bot_id = %s LIMIT 1",
                    (member_id, bot_id),
                )
                row = cur.fetchone()
                return dict(row) if row else None

    return await run_db(_fetch)


def _actor_email(user: dict[str, Any]) -> str:
    return (user.get("email") or user.get("auth_user_id") or "user").strip()


async def _write_team_audit_log(bot_id: str, action: str, details: str, user: dict[str, Any]) -> None:
    """Best-effort audit trail for dashboard team/availability changes."""
    try:
        if DEPLOYMENT_PROFILE == "self_host":
            def _insert():
                with connection() as conn:
                    with conn.cursor() as cur:
                        cur.execute(
                            "INSERT INTO chatty_audit_logs (bot_id, action, details, performed_by) "
                            "VALUES (%s, %s, %s, %s)",
                            (bot_id, action, details, _actor_email(user)),
                        )
            await run_db(_insert)
        else:
            await run_db(lambda: supabase.table("chatty_audit_logs").insert({
                "bot_id": bot_id,
                "action": action,
                "details": details,
                "performed_by": _actor_email(user),
            }).execute())
    except Exception:
        logger.warning("Failed to write team audit log for %s/%s", bot_id, action, exc_info=True)


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
    if DEPLOYMENT_PROFILE == "self_host":
        def _list():
            with connection() as conn:
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    cur.execute(
                        "SELECT * FROM chatty_team_members WHERE bot_id = %s ORDER BY created_at ASC",
                        (bot_id,),
                    )
                    return [dict(row) for row in cur.fetchall()]
        rows = await run_db(_list)
    else:
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
        if DEPLOYMENT_PROFILE == "self_host":
            def _upsert():
                with connection() as conn:
                    with conn.cursor() as cur:
                        cur.execute(
                            "INSERT INTO chatty_team_members "
                            "(bot_id, email, name, phone, role, permissions) "
                            "VALUES (%s, %s, %s, %s, %s, %s) "
                            "ON CONFLICT (bot_id, email) DO UPDATE SET "
                            "name = EXCLUDED.name, phone = EXCLUDED.phone, role = EXCLUDED.role, "
                            "permissions = EXCLUDED.permissions",
                            (req.bot_id, email, name, (req.phone or "").strip() or None, role, permissions),
                        )
            await run_db(_upsert)
        else:
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

    await _write_team_audit_log(
        req.bot_id,
        "team_member_upserted",
        f"Added or updated {email} as {role} with permissions: {', '.join(permissions)}",
        user,
    )

    email_status = "logged"
    try:
        if DEPLOYMENT_PROFILE == "self_host":
            email_status = "not_configured"
        else:
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
    if DEPLOYMENT_PROFILE == "self_host":
        existing_row = await _self_host_member(member_id, req.bot_id)
        existing_role = existing_row.get("role") if existing_row else None
    else:
        existing = await run_db(lambda: supabase.table("chatty_team_members").select("role").eq(
            "id", member_id).eq("bot_id", req.bot_id).limit(1).execute())
        existing_role = existing.data[0].get("role") if existing.data else None
    if not existing_role:
        raise HTTPException(status_code=404, detail="Member not found")

    role = req.role if req.role in ("admin", "agent") else existing_role
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

    if DEPLOYMENT_PROFILE == "self_host":
        def _update():
            columns = ", ".join(f"{key} = %s" for key in update)
            values = [update[key] for key in update]
            with connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        f"UPDATE chatty_team_members SET {columns} WHERE id = %s AND bot_id = %s",
                        (*values, member_id, req.bot_id),
                    )
        await run_db(_update)
    else:
        await run_db(lambda: supabase.table("chatty_team_members").update(update).eq(
            "id", member_id).eq("bot_id", req.bot_id).execute())
    await _write_team_audit_log(
        req.bot_id,
        "team_member_updated",
        f"Updated team member {member_id}: {', '.join(sorted(update.keys()))}",
        user,
    )
    return {"ok": True, **update}


@router.delete("/api/team/{member_id}")
async def remove_team(member_id: str, bot_id: str, user: dict[str, Any] = Depends(require_user)):
    await verify_bot_permission(bot_id, user, "team")
    if DEPLOYMENT_PROFILE == "self_host":
        existing_row = await _self_host_member(member_id, bot_id)
        if existing_row:
            def _delete():
                with connection() as conn:
                    with conn.cursor() as cur:
                        cur.execute(
                            "DELETE FROM chatty_team_members WHERE id = %s AND bot_id = %s",
                            (member_id, bot_id),
                        )
            await run_db(_delete)
        removed_email = existing_row.get("email") if existing_row else member_id
    else:
        existing = await run_db(lambda: supabase.table("chatty_team_members").select("email").eq(
            "id", member_id).eq("bot_id", bot_id).limit(1).execute())
        await run_db(lambda: supabase.table("chatty_team_members").delete().eq(
            "id", member_id).eq("bot_id", bot_id).execute())
        removed_email = existing.data[0].get("email") if existing.data else member_id
    await _write_team_audit_log(bot_id, "team_member_removed", f"Removed team member {removed_email}", user)
    return {"ok": True}


async def _authorize_availability_access(member_id: str, bot_id: str, user: dict[str, Any]) -> dict[str, Any]:
    """A member may manage their own availability; anyone with the 'team'
    permission on this bot (owner, or an admin with that tab) may manage
    anyone's. Returns the member row (needed for its email) or raises 403/404."""
    if DEPLOYMENT_PROFILE == "self_host":
        member = await _self_host_member(member_id, bot_id)
    else:
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
    if DEPLOYMENT_PROFILE == "self_host":
        def _list():
            with connection() as conn:
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    cur.execute(
                        "SELECT * FROM chatty_availability_rules "
                        "WHERE bot_id = %s AND member_email = %s ORDER BY day_of_week",
                        (bot_id, member["email"]),
                    )
                    return [dict(row) for row in cur.fetchall()]
        rows = await run_db(_list)
    else:
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
    if DEPLOYMENT_PROFILE == "self_host":
        def _replace():
            with connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "DELETE FROM chatty_availability_rules WHERE bot_id = %s AND member_email = %s",
                        (req.bot_id, member["email"]),
                    )
                    if req.rules:
                        cur.executemany(
                            "INSERT INTO chatty_availability_rules "
                            "(bot_id, member_email, day_of_week, start_minute, end_minute) "
                            "VALUES (%s, %s, %s, %s, %s)",
                            [
                                (req.bot_id, member["email"], r.day_of_week, r.start_minute, r.end_minute)
                                for r in req.rules
                            ],
                        )
        await run_db(_replace)
    else:
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
        if DEPLOYMENT_PROFILE != "self_host":
            await run_db(lambda: supabase.table("chatty_availability_rules").insert(rows).execute())
    await _write_team_audit_log(
        req.bot_id,
        "team_availability_updated",
        f"Updated availability for {member['email']} with {len(req.rules)} weekly rule(s)",
        user,
    )
    return {"ok": True, "rules": [r.model_dump() for r in req.rules]}
