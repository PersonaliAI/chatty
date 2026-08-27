"""Health check, dashboard API-key management, and the public v1 REST API
(/, /api/keys*, /api/v1/*). Catch-all router for routes not owned by another
feature group."""

from __future__ import annotations

import asyncio
import logging
import secrets
import time
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Request

from app.core import security as _sec
from app.core.clients import supabase
from app.core.db import run_db
from app.core.deps import require_user
from app.core.ssrf import UnsafeURLError, assert_safe_url_async
from app.schemas.public_api import (
    ApiKeyCreateRequest,
    ApiKeyUpdateRequest,
    PublicChatRequest,
    PublicKnowledgeCreateRequest,
    WebhookCreateRequest,
)
from app.schemas.widget import WidgetChatResponse
from plugins import notifications as notify

# Bridged helpers still living in main.py (Phase 2 leaves these in place to
# avoid a large, risky helper-extraction pass alongside the route split —
# the API-key rate limiter is shared with the widget's rate limiter, and
# _fetch_url_content is shared with app/routers/crawl.py).
from main import (
    _API_KEY_PREFIX,
    _RATE_LIMIT,
    _fetch_url_content,
    _hash_api_key,
    _resolve_api_key,
    _update_key_usage,
)
from plugins.widget_brain import run_widget_assistant

logger = logging.getLogger("chatty")

router = APIRouter()


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------


@router.get(
    "/",
    tags=["Health"],
    summary="Health check",
    description="Returns server status. Used by Cloud Run health probes.",
    response_description="Server is healthy",
)
async def health_check(request: Request):
    return {
        "status": "healthy",
        "version": "1.0.0",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "request_id": _sec.get_request_id(request),
    }


# ---------------------------------------------------------------------------
# Public Bot API + API key management
# ---------------------------------------------------------------------------


@router.post(
    "/api/keys",
    tags=["Dashboard — API Keys"],
    summary="Create API key",
    description=(
        "Create a new API key for the specified bot. "
        "The plaintext key is returned **once** and is never retrievable again. "
        "Optionally restrict the key to specific scopes or IP addresses."
    ),
)
async def create_api_key(
    req: ApiKeyCreateRequest,
    user: dict[str, Any] = Depends(require_user),
):
    res = await run_db(lambda: supabase.table("chatty_bots").select("id").eq("id", req.bot_id).eq(
        "user_id", user["auth_user_id"]).execute())
    if not res.data:
        raise HTTPException(status_code=403, detail="Unauthorized")

    # Validate requested scopes
    requested_scopes = req.scopes or ["chat", "read"]
    invalid = [s for s in requested_scopes if s not in _sec.VALID_SCOPES]
    if invalid:
        raise HTTPException(status_code=400, detail=f"Invalid scopes: {invalid}. Valid: {sorted(_sec.VALID_SCOPES)}")

    raw = _API_KEY_PREFIX + secrets.token_hex(24)
    prefix = raw[: len(_API_KEY_PREFIX) + 6]
    try:
        row = await run_db(lambda: supabase.table("chatty_api_keys").insert({
            "bot_id": req.bot_id,
            "user_id": user["auth_user_id"],
            "name": req.name or "API Key",
            "key_prefix": prefix,
            "key_hash": _hash_api_key(raw),
            "scopes": requested_scopes,
            "allowed_ips": req.allowed_ips or None,
        }).execute())
        created = row.data[0] if row.data else {}
        return {
            "id": created.get("id"),
            "name": created.get("name"),
            "key_prefix": prefix,
            "api_key": raw,
            "scopes": created.get("scopes"),
            "allowed_ips": created.get("allowed_ips"),
            "created_at": created.get("created_at"),
            "warning": "Save this key now — it will not be shown again.",
        }
    except Exception as e:
        logger.exception("Failed to create API key")
        raise HTTPException(status_code=500, detail="Failed to create API key") from e


@router.get(
    "/api/keys",
    tags=["Dashboard — API Keys"],
    summary="List API keys",
    description="List all API keys for a bot. Key values are never returned.",
)
async def list_api_keys(
    bot_id: str,
    user: dict[str, Any] = Depends(require_user),
):
    res = await run_db(lambda: supabase.table("chatty_bots").select("id").eq("id", bot_id).eq(
        "user_id", user["auth_user_id"]).execute())
    if not res.data:
        raise HTTPException(status_code=403, detail="Unauthorized")
    try:
        keys = await run_db(lambda: supabase.table("chatty_api_keys").select(
            "id, name, key_prefix, scopes, allowed_ips, last_used_at, request_count, revoked, created_at"
        ).eq("bot_id", bot_id).order("created_at", desc=True).execute())
        return {"keys": keys.data or []}
    except Exception as e:
        logger.exception("Failed to list API keys")
        raise HTTPException(status_code=500, detail="Failed to list API keys") from e


@router.patch(
    "/api/keys/{key_id}",
    tags=["Dashboard — API Keys"],
    summary="Update API key",
    description="Update the name, scopes, or IP allowlist of an existing API key.",
)
async def update_api_key(
    key_id: str,
    req: ApiKeyUpdateRequest,
    user: dict[str, Any] = Depends(require_user),
):
    res = await run_db(lambda: supabase.table("chatty_api_keys").select("*").eq("id", key_id).eq(
        "user_id", user["auth_user_id"]).execute())
    if not res.data:
        raise HTTPException(status_code=404, detail="Key not found")
    updates: dict[str, Any] = {}
    if req.name is not None:
        updates["name"] = req.name
    if req.scopes is not None:
        invalid = [s for s in req.scopes if s not in _sec.VALID_SCOPES]
        if invalid:
            raise HTTPException(status_code=400, detail=f"Invalid scopes: {invalid}")
        updates["scopes"] = req.scopes
    if req.allowed_ips is not None:
        updates["allowed_ips"] = req.allowed_ips or None
    if not updates:
        raise HTTPException(status_code=400, detail="Nothing to update")
    try:
        await run_db(lambda: supabase.table("chatty_api_keys").update(updates).eq("id", key_id).execute())
        return {"success": True}
    except Exception as e:
        logger.exception("Failed to update API key")
        raise HTTPException(status_code=500, detail="Failed to update API key") from e


@router.delete(
    "/api/keys/{key_id}",
    tags=["Dashboard — API Keys"],
    summary="Revoke API key",
    description="Permanently revoke an API key. Revoked keys return 401 on all future requests.",
)
async def revoke_api_key(
    key_id: str,
    user: dict[str, Any] = Depends(require_user),
):
    res = await run_db(lambda: supabase.table("chatty_api_keys").select("*").eq("id", key_id).eq(
        "user_id", user["auth_user_id"]).execute())
    if not res.data:
        raise HTTPException(status_code=404, detail="Key not found")
    try:
        await run_db(lambda: supabase.table("chatty_api_keys").update({"revoked": True}).eq("id", key_id).execute())
        return {"success": True}
    except Exception as e:
        logger.exception("Failed to revoke API key")
        raise HTTPException(status_code=500, detail="Failed to revoke API key") from e


# ---------------------------------------------------------------------------
# Public REST API — v1
# All endpoints require: Authorization: Bearer chatty_sk_<key>
# ---------------------------------------------------------------------------


@router.post(
    "/api/v1/chat",
    response_model=WidgetChatResponse,
    tags=["Public API — Chat"],
    summary="Send a message to the bot",
    description=(
        "Send a text message and receive an AI reply. The bot uses its configured "
        "knowledge base, guardrails, and language settings.\n\n"
        "**Required scope:** `chat`\n\n"
        "A `session_id` groups messages into a conversation. Omit it to start a new "
        "session — the generated session ID is returned and must be passed in "
        "subsequent requests to continue the same thread.\n\n"
        "The bot may include lead-capture or meeting-booking intents in its reply "
        "depending on its configuration."
    ),
    responses={
        200: {"description": "AI reply and session ID"},
        400: {"description": "Empty message text"},
        401: {"description": "Missing or invalid API key"},
        403: {"description": "Missing `chat` scope or IP not on allowlist"},
        429: {"description": "Rate limit exceeded"},
        502: {"description": "Upstream AI provider error"},
    },
)
async def public_api_chat(
    request: Request,
    body: PublicChatRequest,
    authorization: Optional[str] = Header(None),
):
    t0 = time.monotonic()
    key_row = await _resolve_api_key(authorization, request)
    _sec.check_scope(key_row, "chat")

    text = _sec.sanitize_text(body.text.strip())
    if not text:
        raise HTTPException(status_code=400, detail="text is required and must not be empty")

    bot_id = key_row["bot_id"]
    res = await run_db(lambda: supabase.table("chatty_bots").select("*").eq("id", bot_id).execute())
    if not res.data:
        raise HTTPException(status_code=404, detail="Bot not found")
    bot = res.data[0]

    res_user = await run_db(lambda: supabase.table("users").select("*").eq("auth_user_id", bot["user_id"]).execute())
    if not res_user.data:
        raise HTTPException(status_code=404, detail="Bot owner not found")
    owner_user = res_user.data[0]

    session_id = body.session_id or f"api-{key_row['id'][:8]}"
    try:
        result = await run_widget_assistant(
            bot_id=bot_id,
            owner_user=owner_user,
            bot=bot,
            session_id=session_id,
            text=text,
            visitor_timezone=body.visitor_timezone,
        )
    except Exception:
        logger.exception("Public API assistant run failed")
        raise HTTPException(status_code=502, detail="assistant error")

    await run_db(lambda: _update_key_usage(key_row))
    _sec.log_api_access(
        supabase,
        key_id=key_row["id"],
        bot_id=bot_id,
        endpoint="/api/v1/chat",
        method="POST",
        client_ip=_sec._client_ip(request),
        request_id=_sec.get_request_id(request),
        status_code=200,
        duration_ms=int((time.monotonic() - t0) * 1000),
    )
    return WidgetChatResponse(reply=result["reply"], session_id=session_id)


@router.get(
    "/api/v1/bot",
    tags=["Public API — Bot"],
    summary="Get bot details",
    description=(
        "Return public configuration details about the bot tied to this API key.\n\n"
        "**Required scope:** `read`"
    ),
    responses={
        200: {"description": "Bot configuration object"},
        401: {"description": "Missing or invalid API key"},
        404: {"description": "Bot not found"},
    },
)
async def public_api_bot(request: Request, authorization: Optional[str] = Header(None)):
    key_row = await _resolve_api_key(authorization, request)
    _sec.check_scope(key_row, "read")
    res = await run_db(lambda: supabase.table("chatty_bots").select(
        "id, name, welcome_message, primary_color, selected_model, "
        "lead_capture_enabled, lead_fields, calendar_scheduling_enabled, meeting_provider, "
        "response_language, created_at"
    ).eq("id", key_row["bot_id"]).execute())
    if not res.data:
        raise HTTPException(status_code=404, detail="Bot not found")
    await run_db(lambda: _update_key_usage(key_row))
    return res.data[0]


@router.get(
    "/api/v1/leads",
    tags=["Public API — Leads"],
    summary="List captured leads",
    description=(
        "Return leads captured by the bot, most recent first.\n\n"
        "**Required scope:** `read`\n\n"
        "Supports cursor-based pagination via `offset`."
    ),
    responses={
        200: {"description": "Paginated list of leads"},
        401: {"description": "Missing or invalid API key"},
        403: {"description": "Missing `read` scope"},
    },
)
async def public_api_leads(
    request: Request,
    authorization: Optional[str] = Header(None),
    limit: int = 50,
    offset: int = 0,
):
    key_row = await _resolve_api_key(authorization, request)
    _sec.check_scope(key_row, "read")
    limit = min(max(limit, 1), 200)
    offset = max(offset, 0)
    res = await run_db(lambda: supabase.table("chatty_leads").select("*").eq(
        "bot_id", key_row["bot_id"]).order(
        "created_at", desc=True).range(offset, offset + limit - 1).execute())
    total_res = await run_db(lambda: supabase.table("chatty_leads").select(
        "id", count="exact").eq("bot_id", key_row["bot_id"]).execute())
    await run_db(lambda: _update_key_usage(key_row))
    return {
        "leads": res.data or [],
        "limit": limit,
        "offset": offset,
        "total": total_res.count or 0,
    }


@router.get(
    "/api/v1/conversations",
    tags=["Public API — Conversations"],
    summary="List conversation sessions",
    description=(
        "Return recent messages across all sessions for this bot, newest first.\n\n"
        "**Required scope:** `read`\n\n"
        "Use `GET /api/v1/conversations/{session_id}` to fetch a single thread."
    ),
    responses={
        200: {"description": "List of messages with session IDs"},
        401: {"description": "Missing or invalid API key"},
        403: {"description": "Missing `read` scope"},
    },
)
async def public_api_conversations(
    request: Request,
    authorization: Optional[str] = Header(None),
    limit: int = 50,
    offset: int = 0,
):
    key_row = await _resolve_api_key(authorization, request)
    _sec.check_scope(key_row, "read")
    limit = min(max(limit, 1), 200)
    offset = max(offset, 0)
    res = await run_db(lambda: supabase.table("chatty_conversations").select(
        "id, session_id, role, content, created_at, feedback_rating").eq(
        "bot_id", key_row["bot_id"]).order(
        "created_at", desc=True).range(offset, offset + limit - 1).execute())
    await run_db(lambda: _update_key_usage(key_row))
    return {"messages": res.data or [], "limit": limit, "offset": offset}


@router.get(
    "/api/v1/conversations/{session_id}",
    tags=["Public API — Conversations"],
    summary="Get a specific conversation",
    description=(
        "Return all messages in a single conversation thread identified by `session_id`.\n\n"
        "**Required scope:** `read`"
    ),
    responses={
        200: {"description": "Ordered list of messages in the session"},
        401: {"description": "Missing or invalid API key"},
        403: {"description": "Missing `read` scope"},
        404: {"description": "Session not found"},
    },
)
async def public_api_conversation_get(
    session_id: str,
    request: Request,
    authorization: Optional[str] = Header(None),
):
    key_row = await _resolve_api_key(authorization, request)
    _sec.check_scope(key_row, "read")
    res = await run_db(lambda: supabase.table("chatty_conversations").select(
        "id, session_id, role, content, created_at, feedback_rating"
    ).eq("bot_id", key_row["bot_id"]).eq("session_id", session_id).order("created_at").execute())
    if not res.data:
        raise HTTPException(status_code=404, detail="Session not found or belongs to a different bot")
    await run_db(lambda: _update_key_usage(key_row))
    return {"session_id": session_id, "messages": res.data}


@router.delete(
    "/api/v1/conversations/{session_id}",
    tags=["Public API — Conversations"],
    summary="Clear a conversation session",
    description=(
        "Delete all messages in the given session. Useful for resetting a chat "
        "thread without creating a new visitor session.\n\n"
        "**Required scope:** `write`\n\n"
        "This operation is **irreversible**."
    ),
    responses={
        200: {"description": "Session cleared"},
        401: {"description": "Missing or invalid API key"},
        403: {"description": "Missing `write` scope"},
        404: {"description": "Session not found"},
    },
)
async def public_api_conversation_delete(
    session_id: str,
    request: Request,
    authorization: Optional[str] = Header(None),
):
    key_row = await _resolve_api_key(authorization, request)
    _sec.check_scope(key_row, "write")
    # Verify the session belongs to this bot before deleting
    check = await run_db(lambda: supabase.table("chatty_conversations").select("id").eq(
        "bot_id", key_row["bot_id"]).eq("session_id", session_id).limit(1).execute())
    if not check.data:
        raise HTTPException(status_code=404, detail="Session not found or belongs to a different bot")
    await run_db(lambda: supabase.table("chatty_conversations").delete().eq(
        "bot_id", key_row["bot_id"]).eq("session_id", session_id).execute())
    await run_db(lambda: _update_key_usage(key_row))
    return {"success": True, "session_id": session_id, "deleted": True}


@router.get(
    "/api/v1/knowledge",
    tags=["Public API — Knowledge"],
    summary="List knowledge sources",
    description=(
        "Return all knowledge sources (text, URL, and file) for the bot.\n\n"
        "**Required scope:** `read`"
    ),
    responses={
        200: {"description": "List of knowledge source objects"},
        401: {"description": "Missing or invalid API key"},
        403: {"description": "Missing `read` scope"},
    },
)
async def public_api_knowledge_list(
    request: Request,
    authorization: Optional[str] = Header(None),
):
    key_row = await _resolve_api_key(authorization, request)
    _sec.check_scope(key_row, "read")
    res = await run_db(lambda: supabase.table("chatty_sources").select(
        "id, type, name, status, char_count, crawl_schedule, next_crawl_at, last_crawled_at, created_at"
    ).eq("bot_id", key_row["bot_id"]).order("created_at", desc=True).execute())
    await run_db(lambda: _update_key_usage(key_row))
    return {"sources": res.data or []}


@router.post(
    "/api/v1/knowledge",
    tags=["Public API — Knowledge"],
    summary="Add a knowledge source",
    description=(
        "Add a text snippet or crawl a URL into the bot's knowledge base.\n\n"
        "**Required scope:** `write`\n\n"
        "- `type: \"text\"` — provide `content` directly (max 100 KB)\n"
        "- `type: \"url\"` — provide `url`; the page will be fetched and indexed "
        "immediately. Supports the same Jina-powered crawl as the dashboard."
    ),
    responses={
        200: {"description": "Source created and indexed"},
        400: {"description": "Invalid type, missing content/url, or content too large"},
        401: {"description": "Missing or invalid API key"},
        403: {"description": "Missing `write` scope"},
    },
)
async def public_api_knowledge_create(
    body: PublicKnowledgeCreateRequest,
    request: Request,
    authorization: Optional[str] = Header(None),
):
    key_row = await _resolve_api_key(authorization, request)
    _sec.check_scope(key_row, "write")
    bot_id = key_row["bot_id"]

    if body.type not in ("text", "url"):
        raise HTTPException(status_code=400, detail="type must be 'text' or 'url'")
    if not body.name.strip():
        raise HTTPException(status_code=400, detail="name is required")

    if body.type == "text":
        content = (body.content or "").strip()
        if not content:
            raise HTTPException(status_code=400, detail="content is required for type=text")
        if len(content) > 100_000:
            raise HTTPException(status_code=400, detail="content exceeds 100 KB limit")
        row = await run_db(lambda: supabase.table("chatty_sources").insert({
            "bot_id": bot_id,
            "type": "text",
            "name": body.name.strip()[:255],
            "content": content,
            "status": "trained",
            "char_count": len(content),
        }).execute())
        await run_db(lambda: _update_key_usage(key_row))
        return {"success": True, "source": row.data[0] if row.data else {}}

    # type == "url"
    url = (body.url or "").strip()
    if not url:
        raise HTTPException(status_code=400, detail="url is required for type=url")
    try:
        content = await _fetch_url_content(url)
    except Exception as exc:
        logger.exception("Failed to fetch URL for source ingestion")
        raise HTTPException(status_code=502, detail="Failed to fetch URL") from exc
    if not content.strip():
        raise HTTPException(status_code=422, detail="URL returned no usable content")
    row = await run_db(lambda: supabase.table("chatty_sources").insert({
        "bot_id": bot_id,
        "type": "url",
        "name": url,
        "content": content,
        "status": "trained",
        "char_count": len(content),
    }).execute())
    await run_db(lambda: _update_key_usage(key_row))
    return {"success": True, "chars": len(content), "source": row.data[0] if row.data else {}}


@router.delete(
    "/api/v1/knowledge/{source_id}",
    tags=["Public API — Knowledge"],
    summary="Delete a knowledge source",
    description=(
        "Permanently delete a knowledge source from the bot's knowledge base.\n\n"
        "**Required scope:** `write`"
    ),
    responses={
        200: {"description": "Source deleted"},
        401: {"description": "Missing or invalid API key"},
        403: {"description": "Missing `write` scope, or source belongs to a different bot"},
        404: {"description": "Source not found"},
    },
)
async def public_api_knowledge_delete(
    source_id: str,
    request: Request,
    authorization: Optional[str] = Header(None),
):
    key_row = await _resolve_api_key(authorization, request)
    _sec.check_scope(key_row, "write")
    res = await run_db(lambda: supabase.table("chatty_sources").select("id, bot_id").eq("id", source_id).execute())
    if not res.data:
        raise HTTPException(status_code=404, detail="Source not found")
    if res.data[0]["bot_id"] != key_row["bot_id"]:
        raise HTTPException(status_code=403, detail="Source belongs to a different bot")
    await run_db(lambda: supabase.table("chatty_sources").delete().eq("id", source_id).execute())
    await run_db(lambda: _update_key_usage(key_row))
    return {"success": True, "deleted_id": source_id}


@router.get(
    "/api/v1/analytics",
    tags=["Public API — Analytics"],
    summary="Bot analytics summary",
    description=(
        "Return aggregated usage statistics for the bot: message volume, "
        "unique sessions, lead count, and average AI response time.\n\n"
        "**Required scope:** `read`\n\n"
        "All counts are lifetime totals unless filtered by `since` (ISO 8601 datetime)."
    ),
    responses={
        200: {"description": "Analytics summary object"},
        401: {"description": "Missing or invalid API key"},
        403: {"description": "Missing `read` scope"},
    },
)
async def public_api_analytics(
    request: Request,
    authorization: Optional[str] = Header(None),
    since: Optional[str] = None,
):
    key_row = await _resolve_api_key(authorization, request)
    _sec.check_scope(key_row, "read")
    bot_id = key_row["bot_id"]

    q_conv = supabase.table("chatty_conversations").select("id, role, session_id", count="exact").eq("bot_id", bot_id)
    q_lead = supabase.table("chatty_leads").select("id", count="exact").eq("bot_id", bot_id)
    q_src  = supabase.table("chatty_sources").select("id, char_count", count="exact").eq("bot_id", bot_id)

    if since:
        q_conv = q_conv.gte("created_at", since)
        q_lead = q_lead.gte("created_at", since)

    r_conv, r_lead, r_src = await asyncio.gather(
        run_db(q_conv.execute), run_db(q_lead.execute), run_db(q_src.execute)
    )

    messages = r_conv.data or []
    total_messages   = r_conv.count or 0
    user_messages    = sum(1 for m in messages if m.get("role") == "user")
    bot_messages     = sum(1 for m in messages if m.get("role") == "assistant")
    unique_sessions  = len({m["session_id"] for m in messages if m.get("session_id")})
    total_leads      = r_lead.count or 0
    total_sources    = r_src.count or 0
    total_kb         = sum((s.get("char_count") or 0) for s in (r_src.data or [])) // 1024

    await run_db(lambda: _update_key_usage(key_row))
    return {
        "bot_id": bot_id,
        "since": since,
        "total_messages": total_messages,
        "user_messages": user_messages,
        "bot_messages": bot_messages,
        "unique_sessions": unique_sessions,
        "total_leads": total_leads,
        "knowledge_sources": total_sources,
        "knowledge_kb": total_kb,
    }


@router.get(
    "/api/v1/usage",
    tags=["Public API — Usage"],
    summary="API key usage stats",
    description=(
        "Return usage statistics and configuration for the calling API key.\n\n"
        "**Required scope:** any (no minimum scope required)"
    ),
    responses={
        200: {"description": "Usage statistics for this key"},
        401: {"description": "Missing or invalid API key"},
    },
)
async def public_api_usage(request: Request, authorization: Optional[str] = Header(None)):
    key_row = await _resolve_api_key(authorization, request)
    return {
        "key_prefix": key_row.get("key_prefix"),
        "scopes": key_row.get("scopes") or ["chat", "read"],
        "allowed_ips": key_row.get("allowed_ips"),
        "request_count": key_row.get("request_count") or 0,
        "last_used_at": key_row.get("last_used_at"),
        "created_at": key_row.get("created_at"),
        "rate_limit_per_min": _RATE_LIMIT,
    }


@router.post(
    "/api/v1/webhooks",
    tags=["Public API — Webhooks"],
    summary="Register a webhook",
    description=(
        "Subscribe a URL to one or more event types. A signing secret is generated "
        "and returned once — store it to verify the `X-Chatty-Signature` header on "
        "incoming deliveries.\n\n"
        f"**Required scope:** `write`\n\n"
        f"Valid events: {', '.join(notify.WEBHOOK_EVENTS)}"
    ),
    responses={
        200: {"description": "Webhook created, including its signing secret"},
        400: {"description": "Invalid url or events"},
        401: {"description": "Missing or invalid API key"},
        403: {"description": "Missing `write` scope"},
    },
)
async def public_api_webhook_create(
    body: WebhookCreateRequest,
    request: Request,
    authorization: Optional[str] = Header(None),
):
    key_row = await _resolve_api_key(authorization, request)
    _sec.check_scope(key_row, "write")

    url = (body.url or "").strip()
    if not url.startswith(("http://", "https://")):
        raise HTTPException(status_code=400, detail="url must be a valid http(s) URL")
    try:
        await assert_safe_url_async(url)
    except UnsafeURLError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid url: {exc}") from exc
    events = [e for e in (body.events or []) if e in notify.WEBHOOK_EVENTS]
    if not events:
        raise HTTPException(
            status_code=400,
            detail=f"events must include at least one of: {', '.join(notify.WEBHOOK_EVENTS)}",
        )

    secret = f"whsec_{secrets.token_hex(24)}"
    row = await run_db(lambda: supabase.table("chatty_webhooks").insert({
        "bot_id": key_row["bot_id"],
        "url": url,
        "events": events,
        "secret": secret,
        "active": True,
    }).execute())
    await run_db(lambda: _update_key_usage(key_row))
    return row.data[0] if row.data else {"url": url, "events": events, "secret": secret}


@router.get(
    "/api/v1/webhooks",
    tags=["Public API — Webhooks"],
    summary="List webhooks",
    description="List all webhooks registered for this bot.\n\n**Required scope:** `read`",
    responses={
        200: {"description": "List of registered webhooks"},
        401: {"description": "Missing or invalid API key"},
        403: {"description": "Missing `read` scope"},
    },
)
async def public_api_webhook_list(request: Request, authorization: Optional[str] = Header(None)):
    key_row = await _resolve_api_key(authorization, request)
    _sec.check_scope(key_row, "read")
    res = await run_db(lambda: supabase.table("chatty_webhooks").select(
        "id, url, events, active, created_at"
    ).eq("bot_id", key_row["bot_id"]).order("created_at", desc=True).execute())
    await run_db(lambda: _update_key_usage(key_row))
    return {"webhooks": res.data or []}


@router.delete(
    "/api/v1/webhooks/{webhook_id}",
    tags=["Public API — Webhooks"],
    summary="Delete a webhook",
    description="Remove a webhook subscription.\n\n**Required scope:** `write`",
    responses={
        200: {"description": "Webhook deleted"},
        401: {"description": "Missing or invalid API key"},
        403: {"description": "Missing `write` scope, or webhook belongs to a different bot"},
        404: {"description": "Webhook not found"},
    },
)
async def public_api_webhook_delete(
    webhook_id: str,
    request: Request,
    authorization: Optional[str] = Header(None),
):
    key_row = await _resolve_api_key(authorization, request)
    _sec.check_scope(key_row, "write")
    res = await run_db(lambda: supabase.table("chatty_webhooks").select("id, bot_id").eq("id", webhook_id).execute())
    if not res.data:
        raise HTTPException(status_code=404, detail="Webhook not found")
    if res.data[0]["bot_id"] != key_row["bot_id"]:
        raise HTTPException(status_code=403, detail="Webhook belongs to a different bot")
    await run_db(lambda: supabase.table("chatty_webhooks").delete().eq("id", webhook_id).execute())
    await run_db(lambda: _update_key_usage(key_row))
    return {"success": True, "deleted_id": webhook_id}
