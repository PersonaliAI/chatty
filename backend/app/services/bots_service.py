"""Bot create/list/get/update/analytics — the single implementation shared
by the REST API (app/routers/bots_api.py) and the MCP tools
(app/routers/mcp.py), so "create a bot from the dashboard's Developer API
docs" and "create a bot by asking an MCP-connected AI agent" run the exact
same code path rather than two hand-maintained copies that could drift.

Every function here takes an already-resolved `principal` (see
app/core/oauth.py's resolve_principal) — auth/scope checks are the caller's
job, this module is just the actual database work.
"""

from __future__ import annotations

from typing import Any

from fastapi import HTTPException

from app.core import oauth as _oauth
from app.core.clients import supabase
from app.core.db import run_db
from app.schemas.bots_api import BotCreateRequest, BotUpdateRequest

_BOT_LIST_COLUMNS = "id, name, welcome_message, primary_color, selected_model, created_at"
_BOT_DETAIL_FIELDS = [
    "id", "name", "welcome_message", "primary_color", "selected_model", "system_instructions",
    "widget_style", "response_language", "strict_mode", "lead_capture_enabled", "created_at", "updated_at",
]


def _project_bot(row: dict[str, Any]) -> dict[str, Any]:
    """insert()/update() return every column on the row (PostgREST's default
    return=representation) — trim to the curated public field set rather
    than leaking internal columns (e.g. user_id) to callers."""
    return {k: row.get(k) for k in _BOT_DETAIL_FIELDS}


async def create_bot(principal: dict[str, Any], body: BotCreateRequest) -> dict[str, Any]:
    if principal["auth_type"] != "oauth":
        raise HTTPException(
            status_code=403,
            detail="Bot creation requires an OAuth2 access token (a single API key is scoped to one existing bot). Authenticate via /oauth/authorize.",
        )
    row = {
        "user_id": principal["user_id"],
        "name": body.name,
        "welcome_message": body.welcome_message or "Hello! How can I help you today?",
        "system_instructions": body.system_instructions,
        "selected_model": body.selected_model,
        "primary_color": body.primary_color or "#f97316",
        "response_language": body.response_language,
    }
    res = await run_db(lambda: supabase.table("chatty_bots").insert(row).execute())
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to create bot")
    return _project_bot(res.data[0])


async def list_bots(principal: dict[str, Any]) -> list[dict[str, Any]]:
    if principal["auth_type"] != "oauth":
        raise HTTPException(
            status_code=403,
            detail="Listing bots requires an OAuth2 access token — a single API key is already scoped to its one bot.",
        )
    res = await run_db(lambda: supabase.table("chatty_bots").select(_BOT_LIST_COLUMNS).eq(
        "user_id", principal["user_id"]).order("created_at", desc=True).execute())
    return res.data or []


async def get_bot(principal: dict[str, Any], bot_id: str) -> dict[str, Any]:
    bot = await _oauth.require_bot_access(principal, bot_id)
    return _project_bot(bot)


async def update_bot(principal: dict[str, Any], bot_id: str, body: BotUpdateRequest) -> dict[str, Any]:
    await _oauth.require_bot_access(principal, bot_id)
    updates = {k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    res = await run_db(lambda: supabase.table("chatty_bots").update(updates).eq("id", bot_id).execute())
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to update bot")
    return _project_bot(res.data[0])


async def add_knowledge_text(principal: dict[str, Any], bot_id: str, name: str, content: str) -> dict[str, Any]:
    """Text-only knowledge ingestion (the "integrate" capability for MCP
    tools/the multi-bot OAuth API). URL crawling is deliberately not
    exposed here — it's already covered by the existing per-bot API-key
    endpoint (public_api.py's public_api_knowledge_create), which reuses
    the SSRF-guarded crawler; duplicating that path onto the OAuth
    principal model isn't worth the added surface for this pass."""
    await _oauth.require_bot_access(principal, bot_id)
    name = (name or "").strip()
    content = (content or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="name is required")
    if not content:
        raise HTTPException(status_code=400, detail="content is required")
    if len(content) > 100_000:
        raise HTTPException(status_code=400, detail="content exceeds 100 KB limit")
    res = await run_db(lambda: supabase.table("chatty_sources").insert({
        "bot_id": bot_id,
        "type": "text",
        "name": name[:255],
        "content": content,
        "status": "trained",
        "char_count": len(content),
    }).execute())
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to add knowledge source")
    row = res.data[0]
    return {"id": row.get("id"), "name": row.get("name"), "char_count": row.get("char_count")}


async def bot_analytics(principal: dict[str, Any], bot_id: str) -> dict[str, Any]:
    await _oauth.require_bot_access(principal, bot_id)
    # Same tables/columns as the existing per-key GET /api/v1/analytics
    # (public_api.py's public_api_analytics) — kept consistent rather than
    # inventing a second analytics shape for the multi-bot OAuth path.
    conv_res = await run_db(lambda: supabase.table("chatty_conversations").select(
        "id, role, session_id", count="exact").eq("bot_id", bot_id).execute())
    leads_res = await run_db(lambda: supabase.table("chatty_leads").select(
        "id", count="exact").eq("bot_id", bot_id).execute())

    messages = conv_res.data or []
    return {
        "bot_id": bot_id,
        "total_messages": conv_res.count or 0,
        "user_messages": sum(1 for m in messages if m.get("role") == "user"),
        "bot_messages": sum(1 for m in messages if m.get("role") == "assistant"),
        "unique_sessions": len({m["session_id"] for m in messages if m.get("session_id")}),
        "total_leads": leads_res.count or 0,
    }
