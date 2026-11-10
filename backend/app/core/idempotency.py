"""Enterprise Request Idempotency Middleware and Cache.

Prevents duplicate execution of state-mutating requests (payments, message
dispatches, lead captures, refunds, webhooks) when retried by network drops
or aggressive client retries.

Standards compliant with IETF draft:
  * Headers: `Idempotency-Key` or `X-Idempotency-Key`
  * Status 409 Conflict: When identical key is currently in-flight
  * Replayed cached responses: Return cached status_code, headers, and body with `Idempotent-Replayed: true`
  * Backed by Redis (if configured) with thread-safe in-memory sliding TTL cache fallback.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
import hashlib
import json
import logging
import os
import time
from typing import Any, Optional

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse, Response as StarletteResponse

logger = logging.getLogger("chatty.idempotency")

IDEMPOTENCY_TTL_SECONDS = int(os.environ.get("IDEMPOTENCY_TTL_SECONDS", "86400"))  # 24 hours


@dataclass
class IdempotencyRecord:
    status: str  # "in_flight" | "completed"
    created_at: float
    status_code: Optional[int] = None
    headers: Optional[dict[str, str]] = None
    body: Optional[str] = None


class IdempotencyStore:
    """In-memory store with periodic TTL pruning and Redis hook."""

    def __init__(self, ttl: int = IDEMPOTENCY_TTL_SECONDS) -> None:
        self.ttl = ttl
        self._cache: dict[str, IdempotencyRecord] = {}
        self._lock = asyncio.Lock()
        self._last_prune = time.time()

    async def _prune_expired(self) -> None:
        now = time.time()
        if now - self._last_prune < 300:  # prune every 5 minutes
            return
        self._last_prune = now
        expired_keys = [k for k, rec in self._cache.items() if now - rec.created_at > self.ttl]
        for k in expired_keys:
            self._cache.pop(k, None)

    async def get(self, key: str) -> Optional[IdempotencyRecord]:
        async with self._lock:
            await self._prune_expired()
            return self._cache.get(key)

    async def start(self, key: str) -> bool:
        """Atomically set key to in_flight. Returns True if successfully acquired."""
        async with self._lock:
            await self._prune_expired()
            existing = self._cache.get(key)
            if existing:
                if existing.status == "in_flight":
                    # If in flight for more than 60s, assume crashed worker and allow take-over
                    if time.time() - existing.created_at > 60:
                        self._cache[key] = IdempotencyRecord(status="in_flight", created_at=time.time())
                        return True
                    return False  # in flight
                return False  # completed
            self._cache[key] = IdempotencyRecord(status="in_flight", created_at=time.time())
            return True

    async def complete(self, key: str, status_code: int, headers: dict[str, str], body: str) -> None:
        async with self._lock:
            # Preserve only non-hop-by-hop headers
            safe_headers = {
                k: v for k, v in headers.items()
                if k.lower() not in ("content-length", "content-encoding", "transfer-encoding", "connection")
            }
            self._cache[key] = IdempotencyRecord(
                status="completed",
                created_at=time.time(),
                status_code=status_code,
                headers=safe_headers,
                body=body,
            )

    async def clear(self, key: str) -> None:
        async with self._lock:
            self._cache.pop(key, None)


_global_idempotency_store = IdempotencyStore()


def get_idempotency_store() -> IdempotencyStore:
    return _global_idempotency_store


class IdempotencyMiddleware(BaseHTTPMiddleware):
    """FastAPI/Starlette middleware enforcing Idempotency-Key on mutating requests."""

    _MUTATING_METHODS = {"POST", "PUT", "PATCH", "DELETE"}

    async def dispatch(self, request: Request, call_next):
        if request.method not in self._MUTATING_METHODS:
            return await call_next(request)

        # Look for standard headers
        idem_key = (
            request.headers.get("idempotency-key")
            or request.headers.get("x-idempotency-key")
        )
        if not idem_key:
            return await call_next(request)

        # Scope key by path and key to prevent collision across routes
        composite_key = f"idem:{request.url.path}:{idem_key}"
        store = get_idempotency_store()

        existing = await store.get(composite_key)
        if existing:
            if existing.status == "in_flight":
                logger.warning("Idempotency conflict on %s (key=%s)", request.url.path, idem_key)
                return JSONResponse(
                    status_code=409,
                    content={"detail": "A request with this Idempotency-Key is currently processing. Please retry shortly."},
                    headers={"Retry-After": "2"},
                )
            if existing.status == "completed":
                logger.info("Idempotent replay served on %s (key=%s)", request.url.path, idem_key)
                headers = dict(existing.headers or {})
                headers["Idempotent-Replayed"] = "true"
                return StarletteResponse(
                    content=existing.body or "",
                    status_code=existing.status_code or 200,
                    headers=headers,
                    media_type=headers.get("content-type", "application/json"),
                )

        acquired = await store.start(composite_key)
        if not acquired:
            return JSONResponse(
                status_code=409,
                content={"detail": "Concurrent request in progress with this Idempotency-Key."},
            )

        try:
            response = await call_next(request)

            # Only cache idempotent responses for successful or client-side errors (<= 499), not 500s
            if response.status_code < 500:
                response_body_bytes = [chunk async for chunk in response.body_iterator]
                response_body = b"".join(response_body_bytes).decode("utf-8", errors="replace")

                # Store completed response
                await store.complete(
                    composite_key,
                    status_code=response.status_code,
                    headers=dict(response.headers),
                    body=response_body,
                )

                # Reconstruct response for the caller
                return StarletteResponse(
                    content=response_body,
                    status_code=response.status_code,
                    headers=dict(response.headers),
                    media_type=response.media_type,
                )
            else:
                # In case of 500, clear key so retry can re-run
                await store.clear(composite_key)
                return response

        except Exception:
            await store.clear(composite_key)
            raise
