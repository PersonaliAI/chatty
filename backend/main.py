"""Chatty Dedicated API Backend.

A dedicated FastAPI service that powers Chatty:
  * Widget chat stream, theme, and polling endpoints (/api/widget/*)
  * Visual Flow Architect AI Copilot engine (/api/flow/*)
  * Knowledge base document indexing, RAG, and website web crawler (/api/kb/*)
  * Dashboard Inbox, session locking, human live agent takeover (/api/admin/inbox/*)
  * Lead capture, dynamic schema management, and CSV exports (/api/leads/*)
  * Billing checkout and customer subscription management (/api/billing/*)
"""

from __future__ import annotations

import contextlib
import hashlib
import hmac
import json
import logging
import os
import random
import secrets
import time
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import asyncio
import httpx
import jwt
from fastapi import (
    BackgroundTasks,
    Body,
    Depends,
    File,
    Form,
    Header,
    HTTPException,
    Request,
    UploadFile,
)
from fastapi.responses import RedirectResponse, StreamingResponse, PlainTextResponse, Response
from google.genai import errors as genai_errors
from google.genai import types as genai_types
from pydantic import BaseModel

from plugins import agent_tools
from plugins import doc_rag
from plugins import google_integrations as g
from plugins import llm_providers
from plugins import microsoft_integrations as ms
from plugins import notifications as notify
from plugins.widget_brain import run_widget_assistant, GEMINI_FALLBACK_MODELS, MAX_TOOL_ROUNDS  # noqa: F401 — back-compat re-export

from app.core import security as _sec
from app.core.app_factory import create_app
from app.core.clients import genai_client, supabase
from app.core.db import run_db
from app.core.config import (
    ADMIN_BYPASS_EMAILS,
    ALLOWED_ORIGINS,
    FRONTEND_URL,
    FUNCTION_SECRET,
    LEMON_VARIANT_TO_PLAN,
    LEMON_WEBHOOK_SECRET,
    MODEL_NAME,
    SUPABASE_URL,
)
from app.core.deps import require_user
from app.schemas.widget import WidgetChatResponse  # shared with /api/v1/chat (public_api, not yet split)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("chatty")

app = create_app()


# ---------------------------------------------------------------------------
# Plans / quotas — monthly message count enforced on /api/chat + telegram.
# Free covers evaluation; paid tiers cover real use.
# ---------------------------------------------------------------------------

PLAN_QUOTAS: dict[str, int] = {
    # Kept for plan_for()'s key-membership check and for
    # chatty_quota_exceeded()'s combined Kin+Chatty message count (an edge
    # case: a single account that's both a Kin subscriber and a Chatty bot
    # owner) — Kin's own quota gate uses KIN_TOKEN_QUOTAS below instead;
    # these numbers are not enforced anywhere for Kin's own chat/API.
    "free": 100,
    "basic": 500,
    "pro": 3000,
    "executive": 15000,
    # Chatty-specific tiers — quotas match what's advertised on chatty's own
    # pricing page (src/app/page.tsx): $19/$99/$399 for 1k/10k/40k msgs/mo.
    # Chatty still bills by message count — token tracking doesn't exist yet
    # for its separate widget conversation pipeline (run_widget_assistant).
    "chatty_hobby": 1000,
    "chatty_standard": 10000,
    "chatty_business": 40000,
}

# Real Kin quota gate, replacing the message-count model above (found
# 2026-07-20 to be structurally loss-making: a "message" can trigger 1-6
# internal Gemini calls depending on tool-calling complexity, so message
# count has near-zero correlation with actual LLM cost — a user asking
# simple questions and a user running multi-step agentic tasks paid the
# same price for wildly different cost). Token counts are billed at Gemini
# 3.5 Flash's real rates ($1.50/1M input, $9.00/1M output, ~$0.15/1M for
# cache-hit input — Gemini's automatic implicit caching already covers
# 65-96% of input tokens in production since the tool manifest + system
# prompt form a stable repeated prefix). These numbers target ~75% gross
# margin on LLM cost alone at FULL quota utilization, not just on average.
KIN_TOKEN_QUOTAS: dict[str, int] = {
    "free": 1_000_000,
    "basic": 3_000_000,
    "pro": 10_000_000,
    "executive": 30_000_000,
}

# Plans allowed to white-label (remove the "Powered by Chatty" mark).
WHITELABEL_PLANS = {"pro", "executive", "chatty_business"}

# Kin plan-gated features. These used to be advertised on pricing but only
# the message quota was actually enforced anywhere — audited and fixed.
PAID_PLANS = {"basic", "pro", "executive"}       # daily briefing, voice
PRO_PLUS_PLANS = {"pro", "executive"}             # custom system prompt
PRIORITY_PLANS = {"pro", "executive"}             # more retries before
# falling back to the weaker model under capacity contention

# Retry attempts on the primary model before falling back to the lite one
# (see _gemini_generate) — Executive gets a real edge over Pro here, not
# just a bigger quota number.
_PRIORITY_ATTEMPTS = {"executive": 8, "pro": 6}


def priority_attempts(plan: str) -> int:
    return _PRIORITY_ATTEMPTS.get(plan, 4)


def _month_start_iso() -> str:
    now = datetime.now(tz=timezone.utc)
    return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()


async def get_monthly_usage(user_id: str) -> int:
    """Count user-role messages persisted since the first of the current
    month. No longer used for Kin's own quota gate (see quota_state) —
    kept for chatty_quota_exceeded()'s combined Kin+Chatty message count."""
    try:
        res = await run_db(lambda: (
            supabase.table("messages")
            .select("id", count="exact", head=True)
            .eq("user_id", user_id)
            .eq("role", "user")
            .gte("created_at", _month_start_iso())
            .execute()
        ))
        return res.count or 0
    except Exception:  # noqa: BLE001
        logger.exception("usage count failed")
        return 0


def plan_for(user: dict[str, Any]) -> str:
    email = (user.get("email") or "").strip().lower()
    if email in ADMIN_BYPASS_EMAILS:
        return "chatty_business"
    plan = (user.get("plan") or "free").lower()
    return plan if plan in PLAN_QUOTAS else "free"


def _fmt_tokens(n: int) -> str:
    """1000000 -> '1M', 3500000 -> '3.5M' — for user-facing quota messages."""
    if n >= 1_000_000:
        v = n / 1_000_000
        return f"{v:.1f}M".replace(".0M", "M")
    if n >= 1_000:
        return f"{n // 1_000}K"
    return str(n)


def quota_state(user: dict[str, Any]) -> tuple[int, int]:
    """Return (tokens_used_this_month, token_limit). Falls back to the Free
    token quota for a plan value KIN_TOKEN_QUOTAS doesn't recognize (e.g. a
    Chatty-only plan like chatty_hobby, if that account also messages Kin
    directly) rather than raising."""
    limit = KIN_TOKEN_QUOTAS.get(plan_for(user), KIN_TOKEN_QUOTAS["free"])
    return get_monthly_token_usage(user["id"])["total_tokens"], limit


async def get_chatty_monthly_usage(owner_auth_id: str) -> int:
    """Count visitor (user-role) messages across ALL of an owner's Chatty bots
    since the first of the current month. Widget LLM calls are billed to the
    bot owner, so they must count against the same monthly plan quota."""
    try:
        bots = await run_db(lambda: supabase.table("chatty_bots").select("id").eq("user_id", owner_auth_id).execute())
        bot_ids = [b["id"] for b in (bots.data or [])]
        if not bot_ids:
            return 0
        res = await run_db(lambda: (
            supabase.table("chatty_conversations")
            .select("id", count="exact", head=True)
            .in_("bot_id", bot_ids)
            .eq("role", "user")
            .gte("created_at", _month_start_iso())
            .execute()
        ))
        return res.count or 0
    except Exception:  # noqa: BLE001
        logger.exception("chatty usage count failed")
        return 0


async def chatty_quota_exceeded(owner_user: dict[str, Any], owner_auth_id: str) -> bool:
    """True when the bot owner has used up their monthly message allowance
    (Kin web messages + Chatty widget messages combined)."""
    email = (owner_user.get("email") or "").strip().lower()
    if email in ADMIN_BYPASS_EMAILS:
        return False
    limit = PLAN_QUOTAS[plan_for(owner_user)]
    if limit <= 0:  # 0 == unlimited
        return False
    used = (await get_monthly_usage(owner_user["id"])) + (await get_chatty_monthly_usage(owner_auth_id))
    return used >= limit


# Visitor-facing message when the bot owner is out of quota. Deliberately does
# NOT expose plan/billing details to end visitors.
WIDGET_QUOTA_REPLY = (
    "Sorry, the assistant is temporarily unavailable right now. "
    "Please try again later, or leave your contact details and the team will get back to you."
)


def _extract_usage(response) -> tuple[int, int]:
    """(prompt_tokens, completion_tokens) from a Gemini response, or (0, 0) if
    the SDK didn't return usage_metadata (e.g. mid-stream chunks)."""
    meta = getattr(response, "usage_metadata", None)
    if not meta:
        return 0, 0
    return (
        getattr(meta, "prompt_token_count", None) or 0,
        getattr(meta, "candidates_token_count", None) or 0,
    )





# ---------------------------------------------------------------------------
# Chatty Widget & Flow Endpoints
# ---------------------------------------------------------------------------


async def _upsert_session(bot_id: str, session_id: str, last_message: str,
                          visitor_name: Optional[str] = None) -> tuple[dict, bool]:
    """Create or update a conversation session. Returns (row, is_new)."""
    try:
        existing = await run_db(lambda: supabase.table("chatty_sessions").select("*").eq(
            "bot_id", bot_id).eq("session_id", session_id).execute())
        if existing.data:
            row = existing.data[0]
            upd = {"last_message": last_message[:300],
                   "last_message_at": datetime.now(timezone.utc).isoformat()}
            if visitor_name and not row.get("visitor_name"):
                upd["visitor_name"] = visitor_name
            await run_db(lambda: supabase.table("chatty_sessions").update(upd).eq("id", row["id"]).execute())
            return row, False
        ins = await run_db(lambda: supabase.table("chatty_sessions").insert({
            "bot_id": bot_id, "session_id": session_id, "status": "open",
            "ai_paused": False, "visitor_name": visitor_name,
            "last_message": last_message[:300],
        }).execute())
        return (ins.data[0] if ins.data else {}), True
    except Exception:
        logger.exception("session upsert failed")
        return {}, False


async def _notify_new_conversation(bot: dict, owner_user: dict, first_message: str, session_id: str = ""):
    """Email the owner + fire their webhook (if configured) when a brand-new visitor conversation starts."""
    bot_name = bot.get("name") or "your assistant"
    try:
        recipients = []
        if owner_user.get("email"):
            recipients.append(owner_user["email"])
        if bot.get("notification_emails"):
            extra = [e.strip() for e in str(bot["notification_emails"]).split(",") if e.strip()]
            recipients.extend(extra)
        # Deduplicate
        recipients = list(dict.fromkeys(recipients))

        for to in recipients:
            try:
                html = notify._email_shell(
                    title="New conversation started 💬",
                    intro=f"A visitor just started chatting with <strong>{bot_name}</strong> on your website.",
                    rows=[("First message", (first_message or "")[:200] or "(attachment)")],
                    cta_label="Open your inbox", cta_url="https://chatty.personaliai.com/dashboard",
                    footer="Reply from the Inbox tab in your Chatty dashboard.",
                )
                await notify.deliver_email(supabase=supabase, owner_user=owner_user, to=to,
                                           subject=f"New chat on {bot_name}", html=html)
            except Exception:
                logger.exception("new-conversation email failed for %s", to)
    except Exception:
        logger.exception("new-conversation notification block failed")

    if bot.get("webhook_url"):
        await notify.deliver_webhook(
            url=bot["webhook_url"], event="new_conversation", bot_id=bot["id"],
            data={"session_id": session_id, "bot_name": bot_name, "first_message": (first_message or "")[:500]},
        )


# Auto-detect visitor location from IP (free geo-IP, cached per process).
_geoip_cache: dict[str, dict[str, Any]] = {}


async def geoip_lookup(ip: str) -> dict[str, Any]:
    """Return {country, region, city} for an IP (empty dict if private/unknown)."""
    if (not ip or ip in ("unknown", "127.0.0.1", "::1")
            or ip.startswith(("10.", "192.168.", "169.254.", "172.16."))):
        return {}
    if ip in _geoip_cache:
        return _geoip_cache[ip]
    info: dict[str, Any] = {}
    try:
        # ipapi.co over HTTPS (ip-api.com's HTTPS endpoint requires a paid
        # plan) — avoids sending visitor IPs over plaintext HTTP.
        async with httpx.AsyncClient(timeout=4) as c:
            r = await c.get(f"https://ipapi.co/{ip}/json/")
        if r.status_code < 300:
            d = r.json()
            if not d.get("error"):
                info = {
                    "country": d.get("country_name"), "region": d.get("region"),
                    "city": d.get("city"), "lat": d.get("latitude"), "lon": d.get("longitude"),
                }
    except Exception:
        logger.exception("geoip lookup failed for %s", ip)
    _geoip_cache[ip] = info
    return info


async def _verify_bot_owner(bot_id: str, user: dict):
    res = await run_db(lambda: supabase.table("chatty_bots").select("id").eq("id", bot_id).eq(
        "user_id", user["auth_user_id"]).execute())
    if not res.data:
        raise HTTPException(status_code=403, detail="Unauthorized")


async def _verify_bot_access(bot_id: str, user: dict) -> str:
    """Return the caller's role for a bot ('owner' | 'admin' | 'agent'), or
    raise 403. Used by collaborative endpoints so invited teammates can work a
    shared bot; owner-only actions keep using _verify_bot_owner."""
    owned = await run_db(lambda: supabase.table("chatty_bots").select("id").eq("id", bot_id).eq(
        "user_id", user["auth_user_id"]).execute())
    if owned.data:
        return "owner"
    email = (user.get("email") or "").strip().lower()
    if email:
        m = await run_db(lambda: supabase.table("chatty_team_members").select("role").eq(
            "bot_id", bot_id).eq("email", email).limit(1).execute())
        if m.data:
            return m.data[0].get("role") or "agent"
    raise HTTPException(status_code=403, detail="Unauthorized")


_HANDOFF_PATTERNS = (
    "human", "real person", "real human", "speak to someone", "speak with someone",
    "speak to a person", "speak to an agent", "talk to someone", "talk to a person",
    "talk to an agent", "live agent", "customer service", "representative",
    "contact a person", "call me", "phone me",
)


def _needs_human(text: str) -> bool:
    t = (text or "").lower()
    return any(p in t for p in _HANDOFF_PATTERNS)


# Phrases the assistant uses when it lacks the answer — used to detect
# knowledge gaps worth surfacing to the owner for retraining.
_UNANSWERED_MARKERS = (
    "i don't have", "i do not have", "don't have that information",
    "don't have information", "i'm not sure", "i am not sure",
    "i don't know", "i do not know", "couldn't find", "could not find",
    "no information", "not in my knowledge", "outside my knowledge",
    "unable to find", "wasn't able to", "was not able to",
    "i can't help with that", "i cannot help with that",
    "don't have details", "do not have details",
)


def _looks_unanswered(reply: str) -> bool:
    r = (reply or "").lower()
    return any(m in r for m in _UNANSWERED_MARKERS)


def _log_unanswered_if_needed(bot_id: str, session_id: str, question: str, reply: str) -> None:
    """Record a visitor question the bot couldn't confidently answer, so the
    owner can review + retrain from the dashboard. Best-effort; never raises."""
    try:
        if not question or not _looks_unanswered(reply):
            return
        # Skip if the exact question is already open for this bot (dedupe).
        existing = supabase.table("chatty_unanswered").select("id") \
            .eq("bot_id", bot_id).eq("question", question[:2000]) \
            .eq("status", "open").limit(1).execute()
        if existing.data:
            return
        supabase.table("chatty_unanswered").insert({
            "bot_id": bot_id, "session_id": session_id, "question": question[:2000],
        }).execute()
    except Exception:
        logger.exception("failed to log unanswered question")


# ---------------------------------------------------------------------------
# Public Bot API + API key management
# ---------------------------------------------------------------------------

_API_KEY_PREFIX = "chatty_sk_"
# very simple in-memory sliding-window rate limit (per key, per process)
_RATE_LIMIT = 60          # requests
_RATE_WINDOW = 60         # seconds
_rate_state: dict[str, list[float]] = {}


def _hash_api_key(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


async def _resolve_api_key(
    authorization: Optional[str],
    request: Optional["Request"] = None,
) -> dict[str, Any]:
    """Validate a Bearer API key, enforce IP allowlist + rate limit, return row."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing Bearer API key")
    raw = authorization.split(" ", 1)[1].strip()
    key_res = await run_db(lambda: supabase.table("chatty_api_keys").select("*").eq(
        "key_hash", _hash_api_key(raw)).execute())
    if not key_res.data:
        raise HTTPException(status_code=401, detail="Invalid API key")
    key_row = key_res.data[0]
    if key_row.get("revoked"):
        raise HTTPException(status_code=401, detail="API key revoked")
    # IP allowlist (optional — only enforced when the key has entries)
    if request is not None:
        _sec.check_ip_allowlist(key_row, request)
        await _sec.check_ip_rate(request)
    # Shared, cross-instance limiter (Upstash-backed, falls back to
    # in-memory) — same mechanism the widget path uses, so a key's 60/min
    # budget is enforced across all Cloud Run instances, not per-instance.
    if await _rate_limited_async(key_row["id"]):
        raise HTTPException(
            status_code=429,
            detail="Rate limit exceeded (60/min per key)",
            headers={"Retry-After": str(_RATE_WINDOW)},
        )
    return key_row


def _rate_limited(key_id: str, limit: int = _RATE_LIMIT, window: int = _RATE_WINDOW) -> bool:
    """In-memory sliding window. Per-process only — used as the fallback when
    the shared Upstash limiter is unconfigured or unreachable."""
    now = time.time()
    hits = [t for t in _rate_state.get(key_id, []) if now - t < window]
    if len(hits) >= limit:
        _rate_state[key_id] = hits
        return True
    hits.append(now)
    _rate_state[key_id] = hits
    return False


# Shared, cross-instance rate limiter backed by Upstash Redis (REST API).
# Fixed-window counter: key "rl:{id}:{bucket}" INCR'd per hit, auto-expiring
# after `window`. Falls back to the in-memory limiter on any error so a Redis
# outage degrades gracefully instead of blocking (or crashing) requests.
UPSTASH_REDIS_REST_URL = os.environ.get("UPSTASH_REDIS_REST_URL", "").rstrip("/")
UPSTASH_REDIS_REST_TOKEN = os.environ.get("UPSTASH_REDIS_REST_TOKEN", "")


async def _rate_limited_async(
    key_id: str, limit: int = _RATE_LIMIT, window: int = _RATE_WINDOW
) -> bool:
    if not (UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN):
        return _rate_limited(key_id, limit, window)
    bucket = int(time.time()) // window
    rkey = f"rl:{key_id}:{bucket}"
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            resp = await client.post(
                f"{UPSTASH_REDIS_REST_URL}/pipeline",
                headers={"Authorization": f"Bearer {UPSTASH_REDIS_REST_TOKEN}"},
                json=[["INCR", rkey], ["EXPIRE", rkey, str(window)]],
            )
        resp.raise_for_status()
        count = int(resp.json()[0]["result"])
        return count > limit
    except Exception:  # noqa: BLE001 — never let the limiter take down a request
        logger.warning("Upstash rate limiter unavailable; using in-memory fallback", exc_info=True)
        return _rate_limited(key_id, limit, window)


def _client_ip(request: "Request") -> str:
    fwd = request.headers.get("x-forwarded-for", "")
    if fwd:
        # Cloud Run appends the real connecting client's IP as the LAST hop;
        # the first entry is attacker-controlled if the client sets this
        # header itself.
        return fwd.split(",")[-1].strip()
    return request.client.host if request.client else "unknown"


def _normalize_host(value: str) -> str:
    """example.com from https://www.Example.com:443/path -> example.com"""
    if not value:
        return ""
    v = value.strip().lower()
    v = v.split("://", 1)[-1]          # drop scheme
    v = v.split("/", 1)[0]             # drop path
    v = v.split(":", 1)[0]             # drop port
    if v.startswith("www."):
        v = v[4:]
    return v


# ---------------------------------------------------------------------------
# Widget origin verification
#
# `host`/`Origin`/`Referer` on the actual /api/widget/chat call are useless
# for domain restriction: those requests run from JS *inside* the embed
# iframe (served from chatty.personaliai.com), so their Origin is always
# chatty.personaliai.com, never the customer's site. The customer's real
# page URL is only genuinely visible to a browser once — on the iframe's own
# initial document load — so the frontend captures it there (server-side,
# via next/headers) and exchanges it for a short-lived signed token via
# POST /api/widget/verify-origin. That token then rides along on every
# chat/media call instead of a re-trusted host field.
#
# This is defense-in-depth, not a hard guarantee: a non-browser client can
# still fake the Referer on that very first request. Unverified traffic is
# therefore throttled hard, never blocked outright, since legitimate
# visitors can also lack a Referer (strict Referrer-Policy, some browsers).
# ---------------------------------------------------------------------------

WIDGET_TOKEN_TTL = 120  # seconds


def _mint_widget_token(bot_id: str, verified: bool) -> str:
    payload = {"bot_id": bot_id, "verified": verified, "exp": int(time.time()) + WIDGET_TOKEN_TTL}
    return jwt.encode(payload, FUNCTION_SECRET, algorithm="HS256")


def _widget_token_verified(token: Optional[str], bot_id: str) -> bool:
    if not token:
        return False
    try:
        claims = jwt.decode(token, FUNCTION_SECRET, algorithms=["HS256"])
    except Exception:  # noqa: BLE001 — expired/invalid/tampered = unverified
        return False
    return claims.get("bot_id") == bot_id and bool(claims.get("verified"))


# Limits for the public widget endpoint
WIDGET_RATE_LIMIT = 30          # messages
WIDGET_RATE_WINDOW = 60         # seconds, per bot+IP
WIDGET_RATE_LIMIT_UNVERIFIED = 5   # messages
WIDGET_RATE_WINDOW_UNVERIFIED = 120  # seconds, per bot+IP — origin not verified
WIDGET_MAX_CHARS = 4000


async def _widget_rate_limit_or_429(bot: dict, bot_id: str, ip: str, token: Optional[str]) -> None:
    """Rate-limit a widget request. Bots with allowed_domains configured get a
    much tighter tier when the caller's origin token isn't verified, instead
    of the old hard 403 — see the "Widget origin verification" block above."""
    if bot.get("allowed_domains") and not _widget_token_verified(token, bot_id):
        if await _rate_limited_async(
            f"widget-unverified:{bot_id}:{ip}", WIDGET_RATE_LIMIT_UNVERIFIED, WIDGET_RATE_WINDOW_UNVERIFIED
        ):
            raise HTTPException(status_code=429, detail="Too many messages. Please slow down.")
        return
    if await _rate_limited_async(f"widget:{bot_id}:{ip}", WIDGET_RATE_LIMIT, WIDGET_RATE_WINDOW):
        raise HTTPException(status_code=429, detail="Too many messages. Please slow down.")


async def _fetch_url_content(u: str) -> str:
    """Fetch readable text content for a URL via the Jina reader, with retry/backoff
    on rate limits. Returns "" on failure. Shared by manual crawl and scheduled re-crawl."""
    content = ""
    # One Jina key covers Reader (crawl) + Search (web_search). When set, it
    # lifts the anonymous rate limits that otherwise cause 429 backoff.
    _jina_headers = {"User-Agent": "ChattyCrawler/1.0"}
    _jina_key = os.environ.get("JINA_API_KEY", "").strip()
    if _jina_key:
        _jina_headers["Authorization"] = f"Bearer {_jina_key}"
    async with httpx.AsyncClient(timeout=30, follow_redirects=True,
                                 headers=_jina_headers) as client:
        for attempt in range(3):
            try:
                r = await client.get(f"https://r.jina.ai/{u}")
                if r.status_code == 429:
                    await asyncio.sleep(2 * (attempt + 1))
                    continue
                if r.status_code < 300:
                    content = r.text
                break
            except Exception:
                if attempt == 2:
                    raise
                await asyncio.sleep(2 * (attempt + 1))
    return content[:200000]


_CRAWL_SCHEDULE_INTERVALS = {"daily": timedelta(days=1), "weekly": timedelta(days=7), "monthly": timedelta(days=30)}


def _next_crawl_at(schedule: str, now: Optional[datetime] = None) -> Optional[str]:
    interval = _CRAWL_SCHEDULE_INTERVALS.get(schedule)
    if not interval:
        return None
    return ((now or datetime.now(timezone.utc)) + interval).isoformat()


# ---------------------------------------------------------------------------
# Public REST API — v1
# All endpoints require: Authorization: Bearer chatty_sk_<key>
# ---------------------------------------------------------------------------


def _update_key_usage(key_row: dict[str, Any]) -> None:
    """Best-effort update of last_used_at and request_count."""
    try:
        supabase.table("chatty_api_keys").update({
            "last_used_at": datetime.now(timezone.utc).isoformat(),
            "request_count": (key_row.get("request_count") or 0) + 1,
        }).eq("id", key_row["id"]).execute()
    except Exception:
        logger.warning("Failed to update API key usage")












# ---------------------------------------------------------------------------
# Routers (Phase 2 modularization). Imported here, at the bottom of the file,
# rather than right after `app = create_app()` — each router module bridges
# back into main.py for shared helpers/constants via `from main import ...`,
# and importing them earlier (while those names don't exist on the
# partially-initialized `main` module yet) would raise a circular ImportError.
# ---------------------------------------------------------------------------
from app.routers import admin as _router_admin  # noqa: E402
from app.routers import bots as _router_bots  # noqa: E402
from app.routers import bots_api as _router_bots_api  # noqa: E402
from app.routers import crawl as _router_crawl  # noqa: E402
from app.routers import cron as _router_cron  # noqa: E402
from app.routers import documents as _router_documents  # noqa: E402
from app.routers import flow as _router_flow  # noqa: E402
from app.routers import integrations as _router_integrations  # noqa: E402
from app.routers import mcp as _router_mcp  # noqa: E402
from app.routers import oauth as _router_oauth  # noqa: E402
from app.routers import onboarding as _router_onboarding  # noqa: E402
from app.routers import public_api as _router_public_api  # noqa: E402
from app.routers import team as _router_team  # noqa: E402
from app.routers import voice as _router_voice  # noqa: E402
from app.routers import webhooks as _router_webhooks  # noqa: E402
from app.routers import widget as _router_widget  # noqa: E402

app.include_router(_router_widget.router)
app.include_router(_router_voice.router)
app.include_router(_router_webhooks.router)
app.include_router(_router_team.router)
app.include_router(_router_admin.router)
app.include_router(_router_bots.router)
app.include_router(_router_bots_api.router)
app.include_router(_router_crawl.router)
app.include_router(_router_documents.router)
app.include_router(_router_integrations.router)
app.include_router(_router_onboarding.router)
app.include_router(_router_flow.router)
app.include_router(_router_cron.router)
app.include_router(_router_public_api.router)
app.include_router(_router_oauth.router)
# Full ASGI sub-app (not a FastAPI router — the MCP SDK builds its own
# Starlette app with its own auth middleware), mounted at root so its
# internal route (streamable_http_path, "/mcp") becomes the final path.
# Registered last: Starlette tries specific routes/routers above first and
# only falls through to this mount for paths none of them matched, so it
# can't shadow any other endpoint.
app.mount("/", _router_mcp.mcp_asgi_app)


# mcp_asgi_app carries its own internal lifespan (it's a separate Starlette
# app), but Starlette/FastAPI never runs a mounted sub-app's lifespan on its
# own — only the ROOT app's lifespan fires. Without this, FastMCP's
# StreamableHTTPSessionManager.run() (which sets up the task group every
# session depends on) never executes, and every real MCP client connection
# fails after OAuth succeeds with "RuntimeError: Task group is not
# initialized. Make sure to use run()." — this had no test coverage because
# TestClient's `with` context and the app never being exercised as a
# long-lived ASGI server both papered over it locally.
@contextlib.asynccontextmanager
async def _lifespan(_app):
    async with _router_mcp.mcp.session_manager.run():
        yield


app.router.lifespan_context = _lifespan


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", 8080)))
