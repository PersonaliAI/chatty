"""Builds the FastAPI app: metadata, middleware stack, and the CORS-on-error
exception handler. Route registration happens in main.py via include_router.
"""

from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.requests import Request as _StarletteRequest
from starlette.responses import Response as _StarletteResponse

from app.core import security as _sec
from app.core.config import ALLOWED_ORIGINS, SENTRY_DSN, SENTRY_ENV, SENTRY_TRACES_SAMPLE_RATE

logger = logging.getLogger("chatty")

_API_DESCRIPTION = """
## Chatty Public API — v1

Build custom integrations on top of your Chatty bots.

### Authentication

All `/api/v1/*` endpoints require a **Bearer API key**:

```
Authorization: Bearer chatty_sk_<your-key>
```

Generate keys in **Dashboard → API Keys**. Keys carry scopes that control
which endpoints they can call:

| Scope   | Grants access to |
|---------|-----------------|
| `chat`  | `POST /api/v1/chat` — send messages |
| `read`  | leads, conversations, analytics, knowledge list, usage stats |
| `write` | add / delete knowledge sources, clear conversation sessions |
| `admin` | all scopes combined |

### Rate limits

* **60 requests / minute** per API key
* **120 requests / minute** per IP address across all public endpoints
* HTTP `429` is returned when a limit is exceeded; retry after the
  `Retry-After` header (seconds).

### Error format

All errors return JSON:

```json
{ "detail": "Human-readable error message" }
```

### Versioning

The current stable version is **v1**. Breaking changes will be released under
a new version prefix.
"""

_OPENAPI_TAGS = [
    {
        "name": "Public API — Chat",
        "description": "Send messages to your bot programmatically.",
    },
    {
        "name": "Public API — Bot",
        "description": "Read public metadata about the bot tied to your API key.",
    },
    {
        "name": "Public API — Leads",
        "description": "Access leads captured by the bot.",
    },
    {
        "name": "Public API — Conversations",
        "description": "Browse and manage conversation sessions.",
    },
    {
        "name": "Public API — Knowledge",
        "description": "Add and manage knowledge sources for the bot (requires `write` scope).",
    },
    {
        "name": "Public API — Analytics",
        "description": "Usage and performance statistics for the bot.",
    },
    {
        "name": "Public API — Usage",
        "description": "API key usage statistics.",
    },
    {
        "name": "Dashboard — Bots",
        "description": "Bot management endpoints (Supabase session auth).",
    },
    {
        "name": "Dashboard — Inbox",
        "description": "Inbox / human handoff management (Supabase session auth).",
    },
    {
        "name": "Dashboard — Knowledge Base",
        "description": "Crawl and source management (Supabase session auth).",
    },
    {
        "name": "Dashboard — API Keys",
        "description": "Create, list, and revoke API keys (Supabase session auth).",
    },
    {
        "name": "Dashboard — Integrations",
        "description": "Google / Microsoft OAuth and integration management (Supabase session auth).",
    },
    {
        "name": "Widget",
        "description": "Unauthenticated endpoints consumed by the embed widget.",
    },
    {
        "name": "Cron",
        "description": "Internal cron endpoints — called by Cloud Scheduler, protected by FUNCTION_SECRET.",
    },
    {
        "name": "Health",
        "description": "Health-check endpoint.",
    },
]


def _init_sentry() -> None:
    """No-op when SENTRY_DSN is unset, so local/dev runs need no Sentry account."""
    if not SENTRY_DSN:
        return
    try:
        import sentry_sdk
        sentry_sdk.init(
            dsn=SENTRY_DSN,
            environment=SENTRY_ENV,
            traces_sample_rate=SENTRY_TRACES_SAMPLE_RATE,
            send_default_pii=False,
        )
        logger.info("Sentry error monitoring enabled")
    except Exception:  # noqa: BLE001
        logger.exception("Sentry init failed — continuing without it")


def create_app() -> FastAPI:
    _init_sentry()

    app = FastAPI(
        title="Chatty API",
        version="1.0.0",
        description=_API_DESCRIPTION,
        contact={
            "name": "Chatty Support",
            "email": "support@chatty.ai",
        },
        license_info={
            "name": "Proprietary",
        },
        openapi_tags=_OPENAPI_TAGS,
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
    )

    # Order matters: RequestID first (so it's available to security header middleware),
    # then SecurityHeaders, then CORS.
    app.add_middleware(_sec.SecurityHeadersMiddleware)
    app.add_middleware(_sec.RequestIDMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=ALLOWED_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["X-Request-ID"],
    )

    @app.middleware("http")
    async def _widget_open_cors(request: _StarletteRequest, call_next):
        """Public widget endpoints are embedded on ANY customer domain, so they
        can't use the fixed origin allowlist. Reflect the request Origin (no
        credentials) for /api/widget/* — widget.js fetches these from the host page."""
        if request.url.path.startswith("/api/widget/"):
            origin = request.headers.get("origin", "*")
            if request.method == "OPTIONS":
                return _StarletteResponse(status_code=204, headers={
                    "Access-Control-Allow-Origin": origin,
                    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Widget-Token",
                    "Access-Control-Max-Age": "86400",
                    "Vary": "Origin",
                })
            resp = await call_next(request)
            resp.headers["Access-Control-Allow-Origin"] = origin
            resp.headers["Vary"] = "Origin"
            return resp
        return await call_next(request)

    # Global exception handler — ensure CORS headers are present on 500 responses.
    # Starlette's CORSMiddleware only wraps SUCCESSFUL responses by default; when
    # an unhandled exception escapes, the response has no CORS headers and the
    # browser reports "blocked by CORS policy" hiding the real 500.
    @app.exception_handler(Exception)
    async def _global_exception_handler(request: _StarletteRequest, exc: Exception):
        logger.exception("unhandled exception on %s %s", request.method, request.url.path)
        origin = request.headers.get("origin", "")
        allow_origin = origin if origin in ALLOWED_ORIGINS else (ALLOWED_ORIGINS[0] if ALLOWED_ORIGINS else "*")
        return JSONResponse(
            status_code=500,
            content={"detail": f"server error: {type(exc).__name__}: {str(exc)[:300]}"},
            headers={
                "Access-Control-Allow-Origin": allow_origin,
                "Access-Control-Allow-Credentials": "true",
                "Vary": "Origin",
            },
        )

    return app
