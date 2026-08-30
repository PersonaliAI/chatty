"""Per-bot team-member permission tabs.

A `chatty_team_members` row's `role` ('admin' | 'agent') sets the DEFAULT
permission set on invite; `permissions` is the actual, editable source of
truth an owner/admin can adjust per member afterward. The owner always has
every permission implicitly — there's no chatty_team_members row for the
owner, so checks short-circuit on bot ownership first.
"""

from __future__ import annotations

from typing import Any

from fastapi import HTTPException

from app.core.db import run_db

# Dashboard-tab permission keys. Keep in sync with the frontend's
# CHATTY_TEAM_TABS in src/app/dashboard/page.tsx.
ALL_TABS = ("inbox", "sources", "design", "settings", "voice", "team", "billing", "byok", "webhooks")

# Only the bot owner may grant/revoke these, regardless of who is editing a
# member's permissions (an admin with the 'team' permission can manage the
# roster but can't hand out billing/API-key/webhook access).
OWNER_ONLY_TABS = frozenset({"billing", "byok", "webhooks"})

DEFAULT_ADMIN_PERMISSIONS = ["inbox", "sources", "design", "settings", "voice", "team"]
DEFAULT_AGENT_PERMISSIONS = ["inbox"]  # the most useful single tab for a first invite


def default_permissions_for_role(role: str) -> list[str]:
    return list(DEFAULT_ADMIN_PERMISSIONS if role == "admin" else DEFAULT_AGENT_PERMISSIONS)


async def get_bot_role_and_permissions(bot_id: str, user: dict[str, Any]) -> tuple[str, list[str]]:
    """Return (role, permissions) for the caller on this bot, or ('owner', [*ALL_TABS]).

    Raises 403 if the caller has no relationship to the bot at all.
    """
    from app.core.clients import supabase  # local import avoids a cycle with clients importing config only

    owned = await run_db(lambda: supabase.table("chatty_bots").select("id").eq("id", bot_id).eq(
        "user_id", user["auth_user_id"]).execute())
    if owned.data:
        return "owner", list(ALL_TABS)

    email = (user.get("email") or "").strip().lower()
    if email:
        m = await run_db(lambda: supabase.table("chatty_team_members").select("role, permissions").eq(
            "bot_id", bot_id).eq("email", email).limit(1).execute())
        if m.data:
            row = m.data[0]
            return row.get("role") or "agent", list(row.get("permissions") or [])
    raise HTTPException(status_code=403, detail="Unauthorized")


async def verify_bot_permission(bot_id: str, user: dict[str, Any], tab: str) -> str:
    """Raise 403 unless the caller (owner, or a team member with `tab` in
    their permissions) may use this dashboard tab for this bot. Returns the
    caller's role on success."""
    role, permissions = await get_bot_role_and_permissions(bot_id, user)
    if role == "owner" or tab in permissions:
        return role
    raise HTTPException(status_code=403, detail=f"You don't have access to '{tab}' for this bot")
