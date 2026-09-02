"""HTTP plumbing (auth resolution, scope checks, status codes) for bot
create/list/get/update/analytics. The actual logic lives in
app/services/bots_service.py, shared with the MCP tools in
app/routers/mcp.py — see that module's docstring for why.
"""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Header

from app.core import oauth as _oauth
from app.schemas.bots_api import BotCreateRequest, BotUpdateRequest, KnowledgeTextCreateRequest
from app.services import bots_service

logger = logging.getLogger("chatty")

router = APIRouter()


@router.post(
    "/api/v1/bots",
    tags=["Public API — Bots"],
    summary="Create a bot",
    description="Create a new chatbot under the authenticated developer's account.\n\n**Required scope:** `write` (OAuth2 access token only — a single-bot API key cannot create additional bots)",
    status_code=201,
)
async def create_bot(body: BotCreateRequest, authorization: Optional[str] = Header(None)):
    principal = await _oauth.resolve_principal(authorization)
    _oauth.check_principal_scope(principal, "write")
    return await bots_service.create_bot(principal, body)


@router.get(
    "/api/v1/bots",
    tags=["Public API — Bots"],
    summary="List your bots",
    description="List every bot owned by the authenticated developer's account.\n\n**Required scope:** `read` (OAuth2 access token only)",
)
async def list_bots(authorization: Optional[str] = Header(None)):
    principal = await _oauth.resolve_principal(authorization)
    _oauth.check_principal_scope(principal, "read")
    return await bots_service.list_bots(principal)


@router.get(
    "/api/v1/bots/{bot_id}",
    tags=["Public API — Bots"],
    summary="Get a bot",
    description="Get one bot's configuration.\n\n**Required scope:** `read`",
)
async def get_bot(bot_id: str, authorization: Optional[str] = Header(None)):
    principal = await _oauth.resolve_principal(authorization)
    _oauth.check_principal_scope(principal, "read")
    return await bots_service.get_bot(principal, bot_id)


@router.patch(
    "/api/v1/bots/{bot_id}",
    tags=["Public API — Bots"],
    summary="Customize a bot",
    description="Update a bot's configuration.\n\n**Required scope:** `write`",
)
async def update_bot(bot_id: str, body: BotUpdateRequest, authorization: Optional[str] = Header(None)):
    principal = await _oauth.resolve_principal(authorization)
    _oauth.check_principal_scope(principal, "write")
    return await bots_service.update_bot(principal, bot_id, body)


@router.post(
    "/api/v1/bots/{bot_id}/knowledge",
    tags=["Public API — Bots"],
    summary="Add a text knowledge source",
    description="Add a text snippet to a bot's knowledge base.\n\n**Required scope:** `write`",
    status_code=201,
)
async def add_bot_knowledge(bot_id: str, body: KnowledgeTextCreateRequest, authorization: Optional[str] = Header(None)):
    principal = await _oauth.resolve_principal(authorization)
    _oauth.check_principal_scope(principal, "write")
    return await bots_service.add_knowledge_text(principal, bot_id, body.name, body.content)


@router.get(
    "/api/v1/bots/{bot_id}/analytics",
    tags=["Public API — Bots"],
    summary="Analyze a bot",
    description="Aggregate usage stats (messages, leads, sessions) for one bot.\n\n**Required scope:** `read`",
)
async def bot_analytics(bot_id: str, authorization: Optional[str] = Header(None)):
    principal = await _oauth.resolve_principal(authorization)
    _oauth.check_principal_scope(principal, "read")
    return await bots_service.bot_analytics(principal, bot_id)
