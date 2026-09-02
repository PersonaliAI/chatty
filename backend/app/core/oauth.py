"""OAuth2 authorization-code + PKCE core: token/code generation, hashing,
and PKCE verification. Kept separate from app/routers/oauth.py so the
resolve-a-bearer-token logic (used by both the public API and the MCP
server) can import just this, not the router module.

Design mirrors chatty_api_keys' existing pattern deliberately: opaque
random tokens, stored as SHA-256 hashes only, raw value shown to the
caller exactly once at issuance. Scopes reuse the same chat|read|write|admin
vocabulary as API keys (see app/core/security.py's check_scope) so a single
mental model — and a single check_scope() call — covers both auth methods.
"""

from __future__ import annotations

import base64
import hashlib
import secrets
import time
from typing import Any, Optional

from fastapi import HTTPException

from app.core.clients import supabase
from app.core.db import run_db

ACCESS_TOKEN_TTL_SECONDS = 60 * 60          # 1 hour
REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30  # 30 days
AUTH_CODE_TTL_SECONDS = 5 * 60               # 5 minutes, single-use

_ACCESS_TOKEN_PREFIX = "chatty_oat_"   # OAuth Access Token
_REFRESH_TOKEN_PREFIX = "chatty_ort_"  # OAuth Refresh Token
_CLIENT_ID_PREFIX = "chatty_client_"
_CLIENT_SECRET_PREFIX = "chatty_secret_"


def hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def _new_opaque_token(prefix: str) -> str:
    return f"{prefix}{secrets.token_urlsafe(32)}"


def new_client_id() -> str:
    return _new_opaque_token(_CLIENT_ID_PREFIX)


def new_client_secret() -> str:
    return _new_opaque_token(_CLIENT_SECRET_PREFIX)


def new_authorization_code() -> str:
    return secrets.token_urlsafe(32)


def verify_pkce(code_verifier: Optional[str], code_challenge: Optional[str], method: Optional[str]) -> bool:
    """RFC 7636. `method` is "S256" (required in practice — plain is not
    accepted here) or absent (no PKCE was used at /authorize time, in which
    case a verifier must not be supplied either)."""
    if not code_challenge:
        return not code_verifier
    if not code_verifier:
        return False
    if method != "S256":
        return False
    digest = hashlib.sha256(code_verifier.encode()).digest()
    computed = base64.urlsafe_b64encode(digest).rstrip(b"=").decode()
    return secrets.compare_digest(computed, code_challenge)


async def issue_tokens(*, client_id: str, user_id: str, scope: str) -> dict[str, Any]:
    """Mint a fresh access+refresh token pair and persist their hashes.
    Returns the RAW values — the only time they're ever available."""
    access_token = _new_opaque_token(_ACCESS_TOKEN_PREFIX)
    refresh_token = _new_opaque_token(_REFRESH_TOKEN_PREFIX)
    now = time.time()
    row = {
        "access_token_hash": hash_token(access_token),
        "refresh_token_hash": hash_token(refresh_token),
        "client_id": client_id,
        "user_id": user_id,
        "scope": scope,
        "access_expires_at": _iso(now + ACCESS_TOKEN_TTL_SECONDS),
        "refresh_expires_at": _iso(now + REFRESH_TOKEN_TTL_SECONDS),
    }
    await run_db(lambda: supabase.table("chatty_oauth_tokens").insert(row).execute())
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "Bearer",
        "expires_in": ACCESS_TOKEN_TTL_SECONDS,
        "scope": scope,
    }


def _iso(unix_ts: float) -> str:
    import datetime
    return datetime.datetime.fromtimestamp(unix_ts, tz=datetime.timezone.utc).isoformat()


async def resolve_access_token(authorization: Optional[str]) -> dict[str, Any]:
    """Validate a Bearer OAuth access token, return its token row (with
    user_id + scope). Raises 401 on anything invalid/expired/revoked."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing Bearer token")
    raw = authorization.split(" ", 1)[1].strip()
    if not raw.startswith(_ACCESS_TOKEN_PREFIX):
        raise HTTPException(status_code=401, detail="Not a valid OAuth access token")
    res = await run_db(lambda: supabase.table("chatty_oauth_tokens").select("*").eq(
        "access_token_hash", hash_token(raw)).execute())
    if not res.data:
        raise HTTPException(status_code=401, detail="Invalid or expired access token")
    row = res.data[0]
    if row.get("revoked"):
        raise HTTPException(status_code=401, detail="Access token revoked")
    import datetime
    expires_at = datetime.datetime.fromisoformat(row["access_expires_at"].replace("Z", "+00:00"))
    if expires_at < datetime.datetime.now(datetime.timezone.utc):
        raise HTTPException(status_code=401, detail="Access token expired")
    return row


async def resolve_principal(authorization: Optional[str], request: Any = None) -> dict[str, Any]:
    """Unified auth for endpoints that accept EITHER an OAuth access token
    (chatty_oat_...) or a legacy per-bot API key (chatty_sk_...) — bot
    listing/creation only makes sense for the former (a user-scoped
    principal spanning every bot they own), while existing single-bot
    endpoints keep working for both by additionally checking bot ownership
    (see require_bot_access below).

    Returns a common shape:
      {"auth_type": "oauth", "user_id": ..., "scopes": [...], "client_id": ...}
      {"auth_type": "api_key", "user_id": ..., "scopes": [...], "bot_id": ..., "key_row": {...}}

    IMPORTANT: "user_id" here is always the Supabase **auth_user_id**, not
    the internal `users.id` — matching chatty_bots.user_id and
    chatty_api_keys.user_id's own convention (see bots.py, admin.py,
    crawl.py, onboarding.py, public_api.py: every one of them compares
    chatty_bots.user_id against user["auth_user_id"]). Both branches below
    already return the right thing (chatty_api_keys.user_id was always
    written as auth_user_id — see public_api.py's key-creation endpoint);
    the OAuth token issuance side (oauth.py's authorize_decision) is what
    has to store auth_user_id too, or every downstream require_bot_access
    check silently compares the wrong id space.
    """
    raw = (authorization or "").split(" ", 1)[-1].strip()
    if raw.startswith(_ACCESS_TOKEN_PREFIX):
        token_row = await resolve_access_token(authorization)
        return {
            "auth_type": "oauth",
            "user_id": token_row["user_id"],
            "scopes": (token_row.get("scope") or "").split(),
            "client_id": token_row["client_id"],
        }
    # Legacy API key path — imported lazily to avoid a circular import
    # (main.py imports several routers, which would import this module).
    from main import _resolve_api_key

    key_row = await _resolve_api_key(authorization, request)
    return {
        "auth_type": "api_key",
        "user_id": key_row["user_id"],
        "scopes": key_row.get("scopes") or ["chat", "read"],
        "bot_id": key_row["bot_id"],
        "key_row": key_row,
    }


def check_principal_scope(principal: dict[str, Any], required: str) -> None:
    scopes = principal.get("scopes") or []
    if "admin" in scopes or required in scopes:
        return
    raise HTTPException(
        status_code=403,
        detail=f"Missing required scope '{required}'. Granted scopes: {scopes}.",
    )


async def user_dict_for_principal(principal: dict[str, Any]) -> dict[str, Any]:
    """Bridges an OAuth/API-key principal into the full `users` row shape
    app.core.permissions.verify_bot_permission expects (auth_user_id +
    email, for its owner-vs-team-member RBAC check) — for endpoints that
    need real permission checking beyond simple bot ownership (e.g. team
    member management), not just require_bot_access's ownership check."""
    from app.core.deps import get_user_by_auth_id  # local import avoids a cycle

    return await run_db(lambda: get_user_by_auth_id(principal["user_id"]))


async def require_bot_access(principal: dict[str, Any], bot_id: str) -> dict[str, Any]:
    """Confirms `principal` may act on `bot_id`, returning the bot row.

    - api_key principals are only ever scoped to the one bot their key was
      minted for (unrelated to this specific bot_id -> 403, not a lookup).
    - oauth principals may act on any bot they own (chatty_bots.user_id
      matches the token's user_id) — checked by an actual query, since one
      user can own several bots.
    """
    if principal["auth_type"] == "api_key":
        if principal["bot_id"] != bot_id:
            raise HTTPException(status_code=403, detail="This API key is not authorized for this bot")

    res = await run_db(lambda: supabase.table("chatty_bots").select("*").eq("id", bot_id).execute())
    if not res.data:
        raise HTTPException(status_code=404, detail="Bot not found")
    bot = res.data[0]
    if principal["auth_type"] == "oauth" and bot.get("user_id") != principal["user_id"]:
        raise HTTPException(status_code=404, detail="Bot not found")
    return bot
