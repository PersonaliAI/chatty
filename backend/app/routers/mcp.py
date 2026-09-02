"""MCP (Model Context Protocol) server exposing Chatty bot management as
tools an MCP client (Claude Desktop, etc.) can call, authenticated via the
OAuth2 access tokens issued by app/routers/oauth.py.

Every tool is a thin wrapper over app/services/bots_service.py — the exact
same code the REST /api/v1/bots* endpoints call — so there is one
implementation of "create a bot" / "customize a bot" / etc., not two that
could drift apart. Auth is handled by the MCP SDK's own Bearer-token
middleware (ChattyTokenVerifier below); each tool re-resolves the token to
a full `principal` dict (see app/core/oauth.py) because AccessToken (the
SDK's own verified-token model) doesn't carry the Chatty user_id our
service functions need — the extra DB lookup is cheap (one indexed query)
and keeps the SDK's token model untouched rather than smuggling extra
fields into it.

Deliberately NO `from __future__ import annotations` here, unlike every
other file in this codebase: FastMCP's @mcp.tool() decorator inspects each
tool function's real parameter type objects via inspect.signature() at
import time — with PEP 563 deferred evaluation active, every annotation
becomes a plain string instead, and FastMCP's issubclass(annotation, ...)
check crashes on a string with "issubclass() arg 1 must be a class"
(confirmed the hard way: this took the service down on first deploy).
"""

import logging
from typing import Any, Optional

from mcp.server.auth.middleware.auth_context import get_access_token
from mcp.server.auth.provider import AccessToken, TokenVerifier
from mcp.server.auth.settings import AuthSettings
from mcp.server.fastmcp import FastMCP
from pydantic import AnyHttpUrl

from app.core import oauth as _oauth
from app.schemas.bots_api import BotCreateRequest, BotUpdateRequest
from app.services import bots_service

logger = logging.getLogger("chatty")

_BACKEND_BASE_URL = "https://api.chatty.personaliai.com"
_MCP_RESOURCE_URL = f"{_BACKEND_BASE_URL}/mcp"


class ChattyTokenVerifier(TokenVerifier):
    async def verify_token(self, token: str) -> Optional[AccessToken]:
        try:
            row = await _oauth.resolve_access_token(f"Bearer {token}")
        except Exception:
            return None
        return AccessToken(
            token=token,
            client_id=row["client_id"],
            scopes=(row.get("scope") or "").split(),
            expires_at=None,
        )


mcp = FastMCP(
    name="chatty",
    instructions=(
        "Tools for creating and managing Chatty AI chatbots: create a bot, "
        "list your bots, read or update a bot's configuration, add knowledge "
        "to its knowledge base, and pull usage analytics."
    ),
    token_verifier=ChattyTokenVerifier(),
    auth=AuthSettings(
        issuer_url=AnyHttpUrl(_BACKEND_BASE_URL),
        resource_server_url=AnyHttpUrl(_MCP_RESOURCE_URL),
        required_scopes=["chat"],
    ),
)


async def _current_principal() -> dict[str, Any]:
    """Re-resolves the already-verified request token into the same
    `principal` shape the REST API uses (see module docstring)."""
    access_token = get_access_token()
    if access_token is None:
        raise RuntimeError("No authenticated MCP session — this should be unreachable, the SDK's auth middleware already rejects unauthenticated calls")
    row = await _oauth.resolve_access_token(f"Bearer {access_token.token}")
    return {
        "auth_type": "oauth",
        "user_id": row["user_id"],
        "scopes": (row.get("scope") or "").split(),
        "client_id": row["client_id"],
    }


@mcp.tool()
async def list_chatbots() -> list[dict[str, Any]]:
    """List every chatbot owned by the authenticated user's account."""
    principal = await _current_principal()
    _oauth.check_principal_scope(principal, "read")
    return await bots_service.list_bots(principal)


@mcp.tool()
async def create_chatbot(
    name: str,
    welcome_message: Optional[str] = None,
    system_instructions: Optional[str] = None,
    selected_model: Optional[str] = None,
    primary_color: Optional[str] = None,
    response_language: Optional[str] = None,
) -> dict[str, Any]:
    """Create a new Chatty AI chatbot.

    Args:
        name: The bot's display name.
        welcome_message: First message visitors see when opening the widget.
        system_instructions: The bot's system prompt — its persona, rules, and knowledge boundaries.
        selected_model: LLM model id to use (leave unset for the account default).
        primary_color: Hex color (e.g. "#f97316") for the widget's accent color.
        response_language: Language the bot should reply in (e.g. "en", "es").
    """
    principal = await _current_principal()
    _oauth.check_principal_scope(principal, "write")
    body = BotCreateRequest(
        name=name,
        welcome_message=welcome_message,
        system_instructions=system_instructions,
        selected_model=selected_model,
        primary_color=primary_color,
        response_language=response_language,
    )
    return await bots_service.create_bot(principal, body)


@mcp.tool()
async def get_chatbot(bot_id: str) -> dict[str, Any]:
    """Get one chatbot's current configuration by id."""
    principal = await _current_principal()
    _oauth.check_principal_scope(principal, "read")
    return await bots_service.get_bot(principal, bot_id)


@mcp.tool()
async def update_chatbot(
    bot_id: str,
    name: Optional[str] = None,
    welcome_message: Optional[str] = None,
    system_instructions: Optional[str] = None,
    selected_model: Optional[str] = None,
    primary_color: Optional[str] = None,
    widget_style: Optional[str] = None,
    response_language: Optional[str] = None,
    strict_mode: Optional[bool] = None,
    lead_capture_enabled: Optional[bool] = None,
) -> dict[str, Any]:
    """Customize an existing chatbot. Only the fields you pass are changed —
    omit anything you don't want to touch."""
    principal = await _current_principal()
    _oauth.check_principal_scope(principal, "write")
    body = BotUpdateRequest(
        name=name,
        welcome_message=welcome_message,
        system_instructions=system_instructions,
        selected_model=selected_model,
        primary_color=primary_color,
        widget_style=widget_style,
        response_language=response_language,
        strict_mode=strict_mode,
        lead_capture_enabled=lead_capture_enabled,
    )
    return await bots_service.update_bot(principal, bot_id, body)


@mcp.tool()
async def add_chatbot_knowledge(bot_id: str, name: str, content: str) -> dict[str, Any]:
    """Add a text snippet to a chatbot's knowledge base, so it can answer
    questions grounded in that content.

    Args:
        bot_id: The chatbot to add knowledge to.
        name: A short label for this knowledge source (shown in the dashboard).
        content: The text content itself (max 100,000 characters).
    """
    principal = await _current_principal()
    _oauth.check_principal_scope(principal, "write")
    return await bots_service.add_knowledge_text(principal, bot_id, name, content)


@mcp.tool()
async def analyze_chatbot(bot_id: str) -> dict[str, Any]:
    """Get usage analytics for a chatbot: message counts, unique visitor
    sessions, and leads captured."""
    principal = await _current_principal()
    _oauth.check_principal_scope(principal, "read")
    return await bots_service.bot_analytics(principal, bot_id)


# Mounted into the main FastAPI app at /mcp (see main.py) via this ASGI
# sub-app — streamable-HTTP is the current MCP transport (SSE is legacy).
mcp_asgi_app = mcp.streamable_http_app()
