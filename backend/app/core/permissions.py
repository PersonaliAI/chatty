"""Per-bot team-member permission tabs for the managed Supabase path."""

from __future__ import annotations

from typing import Any

from fastapi import HTTPException

from app.core.clients import supabase
from app.core.db import run_db

ALL_TABS = (
    "overview",
    "workspace",
    "customizer",
    "knowledge",
    "playground",
    "inbox",
    "campaigns",
    "flow_builder",
    "leads",
    "feedback",
    "map",
    "meetings",
    "mailbox",
    "notifications",
    "audit_log",
    "analytics",
    "integrations",
    "voice",
    "mcp",
    "developer",
    "billing",
    "settings",
    "team",
    # Legacy aliases preserved for database backward compatibility
    "sources",
    "design",
    "byok",
    "webhooks",
)
OWNER_ONLY_TABS = frozenset({"billing", "byok"})

VALID_ROLES = ("owner", "admin", "agent", "editor", "billing_manager", "viewer")

ROLE_PERMISSIONS: dict[str, list[str]] = {
    "owner": list(ALL_TABS),
    "admin": [
        "overview", "workspace", "customizer", "knowledge", "playground",
        "inbox", "campaigns", "flow_builder", "leads", "feedback", "map",
        "meetings", "mailbox", "notifications", "audit_log", "analytics",
        "integrations", "voice", "mcp", "developer", "settings", "team",
        "sources", "design", "webhooks",
    ],
    "agent": [
        "overview", "inbox", "playground", "meetings", "mailbox", "leads", "feedback",
    ],
    "editor": [
        "overview", "customizer", "knowledge", "playground", "flow_builder",
        "campaigns", "voice", "inbox", "sources", "design",
    ],
    "billing_manager": [
        "overview", "billing", "analytics",
    ],
    "viewer": [
        "overview", "leads", "feedback", "map", "analytics", "audit_log", "inbox",
    ],
}

DEFAULT_ADMIN_PERMISSIONS = ROLE_PERMISSIONS["admin"]
DEFAULT_AGENT_PERMISSIONS = ROLE_PERMISSIONS["agent"]

TAB_EQUIVALENTS: dict[str, set[str]] = {
    "sources": {"sources", "knowledge"},
    "knowledge": {"sources", "knowledge"},
    "design": {"design", "customizer", "flow_builder"},
    "customizer": {"design", "customizer"},
    "flow_builder": {"design", "flow_builder"},
    "webhooks": {"webhooks", "developer", "mcp"},
    "developer": {"webhooks", "developer"},
    "mcp": {"webhooks", "mcp"},
    "byok": {"byok", "settings"},
    "settings": {"settings", "byok"},
    "voice": {"voice", "settings"},
    "calendar": {"meetings"},
    "meetings": {"meetings", "calendar"},
}


def default_permissions_for_role(role: str) -> list[str]:
    return list(ROLE_PERMISSIONS.get(role, ROLE_PERMISSIONS["agent"]))


async def get_bot_role_and_permissions(bot_id: str, user: dict[str, Any]) -> tuple[str, list[str]]:
    auth_id = user.get("auth_user_id") or user.get("user_id") or user.get("id")
    owned = await run_db(lambda: supabase.table("chatty_bots").select("id").eq(
        "id", bot_id).eq("user_id", auth_id).execute())
    if owned.data:
        return "owner", list(ALL_TABS)

    email = (user.get("email") or "").strip().lower()
    if email:
        members = await run_db(lambda: supabase.table("chatty_team_members").select(
            "role, permissions").eq("bot_id", bot_id).ilike("email", email).limit(1).execute())
        if members.data:
            row = members.data[0]
            role = row.get("role") or "agent"
            configured = row.get("permissions")
            # Older invitations stored NULL/[] instead of materializing the
            # role defaults. Normalize them at the authorization boundary so
            # team/me and write routes make the same decision.
            return role, list(configured) if configured else default_permissions_for_role(role)
    raise HTTPException(status_code=403, detail="Unauthorized")


async def verify_bot_permission(bot_id: str, user: dict[str, Any], tab: str) -> str:
    role, permissions = await get_bot_role_and_permissions(bot_id, user)
    if role == "owner" or tab in permissions:
        return role
    equivalents = TAB_EQUIVALENTS.get(tab, set())
    if any(eq in permissions for eq in equivalents):
        return role
    raise HTTPException(status_code=403, detail=f"You don't have access to '{tab}' for this bot")
