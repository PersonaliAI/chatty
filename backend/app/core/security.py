"""Security middleware and helpers for the Chatty backend.

Provides:
  * RequestIDMiddleware  — attaches X-Request-ID to every request/response
  * SecurityHeadersMiddleware — browser-hardening headers on every response
  * IP-based rate limiting (separate from per-API-key limiting)
  * API key IP-allowlist enforcement (CIDR or exact IP)
  * API key scope enforcement (chat / read / write / admin)
  * Input sanitisation (control chars, length)
  * Fire-and-forget audit logging to chatty_api_audit_log
"""
from __future__ import annotations

import ipaddress
import logging
import time
import uuid
from typing import Any, Optional

from fastapi import HTTPException, Request
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger("chatty.security")

# ---------------------------------------------------------------------------
# Request-ID middleware
# ---------------------------------------------------------------------------


class RequestIDMiddleware(BaseHTTPMiddleware):
    """Echo or generate an X-Request-ID on every request/response."""

    async def dispatch(self, request: Request, call_next):
        req_id = request.headers.get("x-request-id") or str(uuid.uuid4())
        request.state.request_id = req_id
        response = await call_next(request)
        response.headers["x-request-id"] = req_id
        return response


# ---------------------------------------------------------------------------
# Security headers middleware
# ---------------------------------------------------------------------------


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add browser-hardening response headers to every response.

    Safe to apply globally — headers are set with setdefault so they don't
    override any already-set values (e.g. CORS headers from widget middleware).
    """

    _HEADERS = {
        "x-content-type-options": "nosniff",
        "x-frame-options": "DENY",
        "referrer-policy": "strict-origin-when-cross-origin",
        "x-permitted-cross-domain-policies": "none",
        # Cloud Run is always HTTPS so we can safely set HSTS
        "strict-transport-security": "max-age=31536000; includeSubDomains; preload",
        # The API only serves JSON — block everything else
        "content-security-policy": "default-src 'none'",
        "permissions-policy": "geolocation=(), camera=(), microphone=()",
    }

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        for name, value in self._HEADERS.items():
            response.headers.setdefault(name, value)
        return response


# ---------------------------------------------------------------------------
# IP-based rate limiter
# ---------------------------------------------------------------------------

_ip_state: dict[str, list[float]] = {}


def ip_rate_limited(bucket: str, limit: int, window: int) -> bool:
    """Sliding-window check. Returns True when the bucket has hit the limit."""
    now = time.time()
    hits = [t for t in _ip_state.get(bucket, []) if now - t < window]
    if len(hits) >= limit:
        _ip_state[bucket] = hits
        return True
    hits.append(now)
    _ip_state[bucket] = hits
    return False


def check_ip_rate(request: Request, limit: int = 120, window: int = 60) -> None:
    """Raise 429 when the request IP exceeds the given rate on this path."""
    ip = _client_ip(request)
    bucket = f"ip:{ip}:{request.url.path}"
    if ip_rate_limited(bucket, limit=limit, window=window):
        raise HTTPException(
            status_code=429,
            detail="Too many requests from this IP address. Please slow down.",
            headers={"Retry-After": str(window)},
        )


# ---------------------------------------------------------------------------
# IP allowlist enforcement
# ---------------------------------------------------------------------------


def check_ip_allowlist(key_row: dict[str, Any], request: Request) -> None:
    """If the key has an IP allowlist, verify the request IP is in it.

    Each entry in allowed_ips may be an exact IPv4/IPv6 address or a CIDR
    range (e.g. "10.0.0.0/8", "2001:db8::/32").
    """
    allowed: list[str] = key_row.get("allowed_ips") or []
    if not allowed:
        return
    client_ip = _client_ip(request)
    try:
        parsed_client = ipaddress.ip_address(client_ip)
    except ValueError:
        # Unparseable IP — deny by default
        raise HTTPException(
            status_code=403,
            detail="Could not determine request IP address for allowlist check.",
        )
    for entry in allowed:
        entry = entry.strip()
        if not entry:
            continue
        try:
            if "/" in entry:
                if parsed_client in ipaddress.ip_network(entry, strict=False):
                    return
            else:
                if parsed_client == ipaddress.ip_address(entry):
                    return
        except ValueError:
            logger.warning("Invalid entry in allowed_ips: %r", entry)
    raise HTTPException(
        status_code=403,
        detail=(
            f"IP address {client_ip!r} is not permitted for this API key. "
            "Update the allowlist in your Chatty dashboard → API Keys."
        ),
    )


# ---------------------------------------------------------------------------
# Scope enforcement
# ---------------------------------------------------------------------------

# Available scopes and what they grant:
#   chat   — call /api/v1/chat (send messages to the bot)
#   read   — read leads, conversations, usage, bot metadata, knowledge sources
#   write  — add/delete knowledge sources, manage conversation sessions
#   admin  — all of the above (super-scope; granted to dashboard-created keys)
VALID_SCOPES = {"chat", "read", "write", "admin"}
_DEFAULT_SCOPES = ["chat", "read"]


def check_scope(key_row: dict[str, Any], required: str) -> None:
    """Raise 403 when the API key does not have the required scope.

    The 'admin' scope is a super-scope that satisfies any requirement.
    """
    scopes: list[str] = key_row.get("scopes") or _DEFAULT_SCOPES
    if "admin" in scopes or required in scopes:
        return
    raise HTTPException(
        status_code=403,
        detail=(
            f"This API key is missing the '{required}' scope. "
            f"Current scopes: {scopes}. "
            "Update your key's scopes in the Chatty dashboard → API Keys."
        ),
    )


# ---------------------------------------------------------------------------
# Input sanitisation
# ---------------------------------------------------------------------------

# Control characters that are never valid in chat text
# (allow tab \t=9, newline \n=10, carriage return \r=13)
_CTRL = frozenset(range(32)) - {9, 10, 13}


def sanitize_text(text: str, max_len: int = 4000) -> str:
    """Strip C0 control characters and truncate to max_len."""
    return "".join(ch for ch in text if ord(ch) not in _CTRL)[:max_len]


# ---------------------------------------------------------------------------
# Audit logging (fire-and-forget, non-blocking)
# ---------------------------------------------------------------------------


def log_api_access(
    supabase_client,
    *,
    key_id: str,
    bot_id: str,
    endpoint: str,
    method: str,
    client_ip: str,
    request_id: str,
    status_code: int = 200,
    duration_ms: int = 0,
) -> None:
    """Write one row to chatty_api_audit_log. Failures are swallowed — never
    let audit logging break a live request."""
    try:
        supabase_client.table("chatty_api_audit_log").insert({
            "key_id": key_id,
            "bot_id": bot_id,
            "endpoint": endpoint,
            "method": method,
            "client_ip": client_ip,
            "request_id": request_id,
            "status_code": status_code,
            "duration_ms": duration_ms,
        }).execute()
    except Exception:
        logger.warning("Failed to write audit log", exc_info=True)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for", "")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def get_request_id(request: Request) -> str:
    return getattr(request.state, "request_id", "")
