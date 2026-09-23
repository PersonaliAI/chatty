"""Per-bot team-member permission tabs for the managed Supabase path."""

from __future__ import annotations

from typing import Any

from fastapi import HTTPException

from app.core.clients import supabase
from app.core.db import run_db

ALL_TABS = ("inbox", "sources", "design", "settings", "voice", "team", "meetings", "billing", "byok", "webhooks")
OWNER_ONLY_TABS = frozenset({"billing", "byok", "webhooks"})
DEFAULT_ADMIN_PERMISSIONS = ["inbox", "sources", "design", "settings", "voice", "team", "meetings"]
DEFAULT_AGENT_PERMISSIONS = ["inbox"]


def default_permissions_for_role(role: str) -> list[str]:
    return list(DEFAULT_ADMIN_PERMISSIONS if role == "admin" else DEFAULT_AGENT_PERMISSIONS)


async def get_bot_role_and_permissions(bot_id: str, user: dict[str, Any]) -> tuple[str, list[str]]:
    owned = await run_db(lambda: supabase.table("chatty_bots").select("id").eq(
        "id", bot_id).eq("user_id", user["auth_user_id"]).execute())
    if owned.data:
        return "owner", list(ALL_TABS)

    email = (user.get("email") or "").strip().lower()
    if email:
        members = await run_db(lambda: supabase.table("chatty_team_members").select(
            "role, permissions").eq("bot_id", bot_id).ilike("email", email).limit(1).execute())
        if members.data:
            row = members.data[0]
            return row.get("role") or "agent", list(row.get("permissions") or [])
    raise HTTPException(status_code=403, detail="Unauthorized")


async def verify_bot_permission(bot_id: str, user: dict[str, Any], tab: str) -> str:
    role, permissions = await get_bot_role_and_permissions(bot_id, user)
    if role == "owner" or tab in permissions:
        return role
    raise HTTPException(status_code=403, detail=f"You don't have access to '{tab}' for this bot")
