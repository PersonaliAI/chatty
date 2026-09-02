"""OAuth2 authorization server for third-party developer / MCP client
access to a Chatty user's account (spans every bot they own — unlike
chatty_api_keys, which are minted for exactly one bot).

Flow (authorization-code + mandatory PKCE, matching the MCP spec's current
auth recommendation):
  1. MCP client discovers this AS via GET /.well-known/oauth-protected-resource
     (served by the MCP endpoint itself) or /.well-known/oauth-authorization-server.
  2. MCP client registers itself: POST /oauth/register (RFC 7591).
  3. MCP client opens the user's browser to GET /oauth/authorize?... — this
     backend has no HTML of its own, so it redirects to Chatty's frontend
     consent page, which is what actually calls consent-info / authorize
     below (authenticated as the logged-in dashboard user).
  4. User approves -> POST /api/oauth/authorize -> auth code minted -> the
     frontend redirects the browser to client's redirect_uri?code=...&state=...
  5. MCP client's local callback receives the code, calls POST /oauth/token
     (with its PKCE code_verifier) to get an access + refresh token.
"""

from __future__ import annotations

import logging
from typing import Any, Optional
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, Form, HTTPException
from fastapi.responses import RedirectResponse

from app.core import oauth as _oauth
from app.core.clients import supabase
from app.core.config import CHATTY_FRONTEND_URL
from app.core.db import run_db
from app.core.deps import require_user
from app.schemas.oauth import (
    AuthorizeDecisionRequest,
    ClientRegistrationRequest,
    ClientRegistrationResponse,
    TokenRequest,
)

logger = logging.getLogger("chatty")

router = APIRouter()

_BACKEND_BASE_URL = "https://api.chatty.personaliai.com"

_SCOPE_DESCRIPTIONS = {
    "chat": "Send messages to your bots and read their replies",
    "read": "Read your bots' configuration, leads, conversations, and analytics",
    "write": "Create bots and change their configuration, knowledge base, and webhooks",
    "admin": "Full access, including API key and webhook management",
}


# ---------------------------------------------------------------------------
# Discovery metadata
# ---------------------------------------------------------------------------


@router.get("/.well-known/oauth-authorization-server", tags=["OAuth2"])
async def oauth_authorization_server_metadata():
    return {
        "issuer": _BACKEND_BASE_URL,
        "authorization_endpoint": f"{_BACKEND_BASE_URL}/oauth/authorize",
        "token_endpoint": f"{_BACKEND_BASE_URL}/oauth/token",
        "registration_endpoint": f"{_BACKEND_BASE_URL}/oauth/register",
        "revocation_endpoint": f"{_BACKEND_BASE_URL}/oauth/revoke",
        "scopes_supported": list(_SCOPE_DESCRIPTIONS.keys()),
        "response_types_supported": ["code"],
        "grant_types_supported": ["authorization_code", "refresh_token"],
        "token_endpoint_auth_methods_supported": ["none", "client_secret_post"],
        "code_challenge_methods_supported": ["S256"],
    }


_MCP_RESOURCE_URL = f"{_BACKEND_BASE_URL}/mcp"


def _protected_resource_metadata() -> dict[str, Any]:
    return {
        "resource": _MCP_RESOURCE_URL,
        "authorization_servers": [_BACKEND_BASE_URL],
        "scopes_supported": list(_SCOPE_DESCRIPTIONS.keys()),
    }


# RFC 9728 (oauth-protected-resource) is ALSO auto-served by the MCP mount
# itself (app/routers/mcp.py, via FastMCP's AuthSettings.resource_server_url)
# — in theory at /.well-known/oauth-protected-resource/mcp per the spec's
# path-scoped convention. In practice this repo's local TestClient and the
# real deployed Cloud Run service disagreed about which of
# /.well-known/oauth-protected-resource and its /mcp-suffixed sibling
# FastMCP actually serves (a discrepancy not worth chasing further — root
# cause unconfirmed). These two explicit routes, registered ahead of the
# MCP mount in main.py's app.mount("/", ...) call, make both paths work
# deterministically regardless of environment, rather than depending on
# FastMCP's own registration for either.
@router.get("/.well-known/oauth-protected-resource", tags=["OAuth2"])
async def oauth_protected_resource_metadata_root():
    return _protected_resource_metadata()


@router.get("/.well-known/oauth-protected-resource/mcp", tags=["OAuth2"])
async def oauth_protected_resource_metadata_mcp():
    return _protected_resource_metadata()


# ---------------------------------------------------------------------------
# Dynamic client registration (RFC 7591)
# ---------------------------------------------------------------------------


@router.post("/oauth/register", tags=["OAuth2"], response_model=ClientRegistrationResponse)
async def register_client(body: ClientRegistrationRequest):
    if not body.redirect_uris:
        raise HTTPException(status_code=400, detail="redirect_uris is required")
    for uri in body.redirect_uris:
        # Loopback redirects (http://127.0.0.1:<port>/...) are the standard
        # pattern for native/CLI MCP clients per RFC 8252 and are exempt from
        # the https requirement; everything else must be https.
        is_loopback = uri.startswith("http://127.0.0.1") or uri.startswith("http://localhost")
        if not (uri.startswith("https://") or is_loopback):
            raise HTTPException(status_code=400, detail=f"redirect_uri must be https (or a loopback URL): {uri}")

    is_confidential = body.token_endpoint_auth_method == "client_secret_post"
    client_id = _oauth.new_client_id()
    client_secret = _oauth.new_client_secret() if is_confidential else None

    row = {
        "client_id": client_id,
        "client_secret_hash": _oauth.hash_token(client_secret) if client_secret else None,
        "is_confidential": is_confidential,
        "client_name": body.client_name[:100],
        "redirect_uris": body.redirect_uris,
    }
    await run_db(lambda: supabase.table("chatty_oauth_clients").insert(row).execute())

    return ClientRegistrationResponse(
        client_id=client_id,
        client_secret=client_secret,
        client_name=row["client_name"],
        redirect_uris=body.redirect_uris,
        token_endpoint_auth_method="client_secret_post" if is_confidential else "none",
    )


# ---------------------------------------------------------------------------
# Authorization endpoint — this backend has no HTML pages, so GET /oauth/authorize
# just forwards the request to Chatty's own frontend, which renders the real
# consent screen and calls the two authenticated endpoints below.
# ---------------------------------------------------------------------------


@router.get("/oauth/authorize", tags=["OAuth2"])
async def authorize_redirect(
    client_id: str,
    redirect_uri: str,
    response_type: str = "code",
    scope: str = "chat read",
    state: Optional[str] = None,
    code_challenge: Optional[str] = None,
    code_challenge_method: Optional[str] = None,
):
    if response_type != "code":
        raise HTTPException(status_code=400, detail="Only response_type=code is supported")
    params = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "scope": scope,
    }
    if state:
        params["state"] = state
    if code_challenge:
        params["code_challenge"] = code_challenge
        params["code_challenge_method"] = code_challenge_method or "S256"
    return RedirectResponse(f"{CHATTY_FRONTEND_URL}/oauth/consent?{urlencode(params)}")


async def _get_client_or_404(client_id: str) -> dict[str, Any]:
    res = await run_db(lambda: supabase.table("chatty_oauth_clients").select("*").eq(
        "client_id", client_id).execute())
    if not res.data:
        raise HTTPException(status_code=400, detail="Unknown client_id")
    return res.data[0]


@router.get("/api/oauth/consent-info", tags=["OAuth2"])
async def consent_info(
    client_id: str,
    scope: str = "chat read",
    user: dict[str, Any] = Depends(require_user),
):
    """Authenticated as the logged-in dashboard user — the frontend calls
    this to render "<App> wants to: ...". Requires login first, same as
    every other /api/* route in this backend; the frontend consent page is
    responsible for redirecting to /login if there's no session yet."""
    client = await _get_client_or_404(client_id)
    scopes = scope.split()
    return {
        "client_name": client["client_name"],
        "scopes": [{"id": s, "description": _SCOPE_DESCRIPTIONS.get(s, s)} for s in scopes],
        "user_email": user.get("email"),
    }


@router.post("/api/oauth/authorize", tags=["OAuth2"])
async def authorize_decision(
    body: AuthorizeDecisionRequest,
    user: dict[str, Any] = Depends(require_user),
):
    client = await _get_client_or_404(body.client_id)
    if body.redirect_uri not in client["redirect_uris"]:
        raise HTTPException(status_code=400, detail="redirect_uri does not match a registered URI for this client")

    if not body.approve:
        params = {"error": "access_denied"}
        if body.state:
            params["state"] = body.state
        return {"redirect_url": f"{body.redirect_uri}?{urlencode(params)}"}

    code = _oauth.new_authorization_code()
    import datetime
    row = {
        "code": code,
        "client_id": body.client_id,
        "user_id": user["id"],
        "redirect_uri": body.redirect_uri,
        "scope": body.scope,
        "code_challenge": body.code_challenge,
        "code_challenge_method": body.code_challenge_method,
        "expires_at": (datetime.datetime.now(datetime.timezone.utc)
                       + datetime.timedelta(seconds=_oauth.AUTH_CODE_TTL_SECONDS)).isoformat(),
    }
    await run_db(lambda: supabase.table("chatty_oauth_codes").insert(row).execute())

    params = {"code": code}
    if body.state:
        params["state"] = body.state
    return {"redirect_url": f"{body.redirect_uri}?{urlencode(params)}"}


# ---------------------------------------------------------------------------
# Token endpoint — RFC 6749 §3.2 requires application/x-www-form-urlencoded,
# not JSON. Off-the-shelf OAuth2 client libraries (which is what real MCP
# clients use) send exactly this and nothing else, so this has to be Form(...)
# fields for actual interoperability, not a Pydantic JSON body.
# ---------------------------------------------------------------------------


@router.post("/oauth/token", tags=["OAuth2"])
async def token(
    grant_type: str = Form(...),
    code: Optional[str] = Form(None),
    redirect_uri: Optional[str] = Form(None),
    client_id: Optional[str] = Form(None),
    client_secret: Optional[str] = Form(None),
    code_verifier: Optional[str] = Form(None),
    refresh_token: Optional[str] = Form(None),
):
    body = TokenRequest(
        grant_type=grant_type,
        code=code,
        redirect_uri=redirect_uri,
        client_id=client_id,
        client_secret=client_secret,
        code_verifier=code_verifier,
        refresh_token=refresh_token,
    )
    if body.grant_type == "authorization_code":
        return await _grant_authorization_code(body)
    if body.grant_type == "refresh_token":
        return await _grant_refresh_token(body)
    raise HTTPException(status_code=400, detail=f"Unsupported grant_type: {body.grant_type}")


async def _authenticate_client(client_id: Optional[str], client_secret: Optional[str]) -> dict[str, Any]:
    if not client_id:
        raise HTTPException(status_code=401, detail="client_id is required")
    client = await _get_client_or_404(client_id)
    if client["is_confidential"]:
        if not client_secret or _oauth.hash_token(client_secret) != client["client_secret_hash"]:
            raise HTTPException(status_code=401, detail="Invalid client credentials")
    return client


async def _grant_authorization_code(body: TokenRequest):
    if not body.code or not body.redirect_uri:
        raise HTTPException(status_code=400, detail="code and redirect_uri are required")
    client = await _authenticate_client(body.client_id, body.client_secret)

    res = await run_db(lambda: supabase.table("chatty_oauth_codes").select("*").eq("code", body.code).execute())
    if not res.data:
        raise HTTPException(status_code=400, detail="Invalid authorization code")
    code_row = res.data[0]

    import datetime
    expires_at = datetime.datetime.fromisoformat(code_row["expires_at"].replace("Z", "+00:00"))
    if (
        code_row["used"]
        or expires_at < datetime.datetime.now(datetime.timezone.utc)
        or code_row["client_id"] != client["client_id"]
        or code_row["redirect_uri"] != body.redirect_uri
    ):
        raise HTTPException(status_code=400, detail="Authorization code is invalid, expired, or already used")

    if not _oauth.verify_pkce(body.code_verifier, code_row.get("code_challenge"), code_row.get("code_challenge_method")):
        raise HTTPException(status_code=400, detail="PKCE verification failed")

    # Single-use: mark consumed before issuing tokens, not after — a crash
    # between issuing and marking would otherwise let the same code be
    # replayed to mint a second token pair.
    await run_db(lambda: supabase.table("chatty_oauth_codes").update({"used": True}).eq("code", body.code).execute())

    return await _oauth.issue_tokens(client_id=client["client_id"], user_id=code_row["user_id"], scope=code_row["scope"])


async def _grant_refresh_token(body: TokenRequest):
    if not body.refresh_token:
        raise HTTPException(status_code=400, detail="refresh_token is required")
    client = await _authenticate_client(body.client_id, body.client_secret)

    res = await run_db(lambda: supabase.table("chatty_oauth_tokens").select("*").eq(
        "refresh_token_hash", _oauth.hash_token(body.refresh_token)).execute())
    if not res.data:
        raise HTTPException(status_code=400, detail="Invalid refresh token")
    old = res.data[0]

    import datetime
    if old["revoked"] or old["client_id"] != client["client_id"]:
        raise HTTPException(status_code=400, detail="Refresh token is invalid or revoked")
    if old.get("refresh_expires_at"):
        refresh_expires = datetime.datetime.fromisoformat(old["refresh_expires_at"].replace("Z", "+00:00"))
        if refresh_expires < datetime.datetime.now(datetime.timezone.utc):
            raise HTTPException(status_code=400, detail="Refresh token expired")

    # Rotate: revoke the old pair, issue a fresh one — standard practice so a
    # leaked refresh token has a bounded, single-use lifetime.
    await run_db(lambda: supabase.table("chatty_oauth_tokens").update({"revoked": True}).eq("id", old["id"]).execute())
    return await _oauth.issue_tokens(client_id=client["client_id"], user_id=old["user_id"], scope=old["scope"])


# ---------------------------------------------------------------------------
# Revocation (RFC 7009)
# ---------------------------------------------------------------------------


@router.post("/oauth/revoke", tags=["OAuth2"])
async def revoke_token(
    token: str = Form(...),
    token_type_hint: Optional[str] = Form(None),
):
    # Revoking is idempotent — an unknown token is still a 200, not an
    # error (RFC 7009 §2.2), so a client can't probe token validity via
    # this endpoint's response code.
    digest = _oauth.hash_token(token)
    await run_db(lambda: supabase.table("chatty_oauth_tokens").update({"revoked": True}).or_(
        f"access_token_hash.eq.{digest},refresh_token_hash.eq.{digest}").execute())
    return {"status": "ok"}
