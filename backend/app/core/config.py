"""Environment-derived configuration constants, shared across the app."""

from __future__ import annotations

import os

from dotenv import load_dotenv

# Self-loading: must happen before any os.environ.get() below, and before
# any other module reads env vars - since this is the first thing anything
# in app.core imports, loading .env here (rather than relying on main.py to
# call it first) guarantees correct env state regardless of import order.
load_dotenv()

DEPLOYMENT_PROFILE = os.environ.get("DEPLOYMENT_PROFILE", "managed_supabase").strip().lower()
if DEPLOYMENT_PROFILE not in {"managed_supabase", "self_host"}:
    raise RuntimeError("DEPLOYMENT_PROFILE must be managed_supabase or self_host")
SELF_HOST_MODE = DEPLOYMENT_PROFILE == "self_host"

def _require_env(name: str) -> str:
    """Fail loudly at startup instead of silently falling back to a
    hardcoded production credential - a previous version of this file did
    exactly that (a real privileged key baked in as a fallback), which meant
    any environment that forgot to set these env vars would silently talk
    to production with full RLS-bypassing access instead of failing."""
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f"{name} environment variable is required but not set")
    return value


SUPABASE_URL = _require_env("SUPABASE_URL")
# Supabase's new Secret Key is the server-only replacement for the legacy
# service_role JWT. Keep the historical constant name for its call sites,
# but fail closed so deployments cannot silently retain a legacy JWT.
SUPABASE_SECRET_KEY = _require_env("SUPABASE_SECRET_KEY")
SUPABASE_JWT_SECRET = os.environ.get("SUPABASE_JWT_SECRET", "")
OIDC_ISSUER_URL = os.environ.get("OIDC_ISSUER_URL", "").rstrip("/")
OIDC_AUDIENCE = os.environ.get("OIDC_AUDIENCE", "chatty")

DATABASE_URL = os.environ.get("DATABASE_URL", "")
REDIS_URL = os.environ.get("REDIS_URL", "")
S3_ENDPOINT = os.environ.get("S3_ENDPOINT", "")
S3_ACCESS_KEY = os.environ.get("S3_ACCESS_KEY", "")
S3_SECRET_KEY = os.environ.get("S3_SECRET_KEY", "")
S3_BUCKET = os.environ.get("S3_BUCKET", "chatty")

# Primary model. Override with KIN_MODEL or (legacy) GEMMA_MODEL env vars.
#
# 2026-07-21: briefly tried gemini-2.5-flash-lite as primary for its ~15-22x
# lower cost, reverted the same day - confirmed in production, not just
# theorized: with a job-application request (a just-shared photo + resume,
# "need to apply this job"), the lite model repeatedly refused to call
# read_full_document and instead hallucinated "I can't access images" even
# after the resume/photo were successfully indexed and the existing
# no-tool-call refusal-detector forced a retry. flash (not flash-lite) is
# the brain; we only fall back to the lite model when flash is rate-limited.
MODEL_NAME = (
    os.environ.get("KIN_MODEL")
    or os.environ.get("GEMMA_MODEL")
    or "gemini-2.5-flash-lite"
)

FUNCTION_SECRET = os.environ.get("FUNCTION_SECRET", "")
# Lemon Squeezy - accept either naming convention.
LEMON_WEBHOOK_SECRET = (
    os.environ.get("LEMONSQUEEZY_WEBHOOK_SECRET")
    or os.environ.get("LEMON_SQUEEZY_WEBHOOK_SECRET", "")
)
LEMON_API_KEY = os.environ.get("LEMONSQUEEZY_API_KEY", "")
LEMON_STORE_ID = os.environ.get("LEMONSQUEEZY_STORE_ID", "")

# Resend inbound email (meeting reply capture - team scheduling Phase 4).
# RESEND_INBOUND_DOMAIN is the subdomain Resend's inbound routing is
# configured for (MX records point there); RESEND_INBOUND_WEBHOOK_SECRET is
# the `whsec_...` signing secret from the Resend webhook's dashboard page,
# used to verify the Svix-signed POST to /webhook/resend-inbound.
RESEND_INBOUND_DOMAIN = os.environ.get("RESEND_INBOUND_DOMAIN", "")
RESEND_INBOUND_WEBHOOK_SECRET = os.environ.get("RESEND_INBOUND_WEBHOOK_SECRET", "")

FRONTEND_URL = os.environ.get("FRONTEND_URL", "https://chatty.personaliai.com")
# Chatty's own frontend is the redirect fallback for Chatty OAuth flows. Keep
# FRONTEND_URL as a legacy alias for older deploy envs, but prefer the explicit
# Chatty name everywhere new code needs a product frontend URL.
CHATTY_FRONTEND_URL = os.environ.get("CHATTY_FRONTEND_URL", "https://chatty.personaliai.com")
# This service's own public URL - the OAuth issuer/resource identifiers the
# MCP server (app/routers/mcp.py) advertises in its metadata must exactly
# match the domain a client actually reaches it at, or every real OAuth
# client rejects the token as issued by the wrong party. Was hardcoded to
# PersonaliAI's own Cloud Run domain, which silently broke MCP/OAuth for
# anyone self-hosting this repo under their own domain.
CHATTY_BACKEND_URL = os.environ.get("CHATTY_BACKEND_URL", "https://api.chatty.personaliai.com")

ALLOWED_ORIGINS = [
    o.strip()
    for o in os.environ.get(
        "ALLOWED_ORIGINS",
        "https://personaliai.com,https://chatty.personaliai.com,http://localhost:3000",
    ).split(",")
    if o.strip()
]

# Lemon Squeezy variant_id → plan name. Prefer dedicated env vars, then fall back
# to a comma-separated LEMON_VARIANT_PLANS list.
LEMON_VARIANT_TO_PLAN: dict[str, str] = {}
for _env_key, _plan in (
    ("LEMONSQUEEZY_VARIANT_BASIC", "basic"),
    ("LEMONSQUEEZY_VARIANT_PRO", "pro"),
    ("LEMONSQUEEZY_VARIANT_EXECUTIVE", "executive"),
    ("LEMONSQUEEZY_VARIANT_CHATTY_HOBBY", "chatty_hobby"),
    ("LEMONSQUEEZY_VARIANT_CHATTY_STANDARD", "chatty_standard"),
    ("LEMONSQUEEZY_VARIANT_CHATTY_BUSINESS", "chatty_business"),
    # Yearly variants map to the same plan - quota is monthly regardless of
    # billing interval, only price/frequency differs.
    ("LEMONSQUEEZY_VARIANT_CHATTY_HOBBY_YEARLY", "chatty_hobby"),
    ("LEMONSQUEEZY_VARIANT_CHATTY_STANDARD_YEARLY", "chatty_standard"),
    ("LEMONSQUEEZY_VARIANT_CHATTY_BUSINESS_YEARLY", "chatty_business"),
):
    _val = os.environ.get(_env_key)
    if _val:
        LEMON_VARIANT_TO_PLAN[_val.strip()] = _plan
for _v in os.environ.get("LEMON_VARIANT_PLANS", "").split(","):
    if ":" in _v:
        _k, _p = _v.strip().split(":", 1)
        LEMON_VARIANT_TO_PLAN[_k] = _p

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
GOOGLE_CLOUD_PROJECT = os.environ.get("GOOGLE_CLOUD_PROJECT")
GOOGLE_CLOUD_LOCATION = os.environ.get("GOOGLE_CLOUD_LOCATION", "global")

# Ordered fallback chain tried in sequence whenever a Gemini call fails
# (quota/429, transient 5xx, or any other error) - the free-tier AI Studio
# key's daily quota varies wildly per model (e.g. 20 RPD on gemini-2.5-flash
# vs 500 RPD on gemini-3.1-flash-lite), so a single fallback isn't enough to
# ride out a busy day. Gemini 3.x models require a thought_signature on
# every function-call part in a multi-turn conversation, which the manual
# tool-calling loop in plugins/widget_brain.py doesn't propagate - if a
# later round in an ongoing conversation breaks on one of those for that
# reason, it's just another failure this same chain retries past, landing
# back on a 2.5 model (no signature requirement) for that round instead of
# hard-failing.
GEMINI_FALLBACK_MODELS: list[str] = [
    m.strip() for m in os.environ.get(
        "KIN_FALLBACK_MODELS",
        # The flash-lite models carry a 500 RPD quota vs 20 RPD on gemini-2.5-flash
        # on Google AI Studio free tier. Prioritizing flash-lite prevents hitting
        # the 20 RPD quota lockouts.
        "gemini-2.5-flash-lite,gemini-3.1-flash-lite,gemini-3.5-flash-lite,gemini-2.5-flash",
    ).split(",") if m.strip()
]
# Back-compat: some call sites/log messages still refer to a single fallback name.
GEMINI_FALLBACK_MODEL = GEMINI_FALLBACK_MODELS[0] if GEMINI_FALLBACK_MODELS else "gemini-2.5-flash-lite"

SENTRY_DSN = os.environ.get("SENTRY_DSN", "").strip()
SENTRY_ENV = os.environ.get("SENTRY_ENV", "production")
SENTRY_TRACES_SAMPLE_RATE = float(os.environ.get("SENTRY_TRACES_SAMPLE_RATE", "0.05"))

# LiveKit - voice agent worker + token-minting endpoint (Phase B).
LIVEKIT_URL = os.environ.get("LIVEKIT_URL", "")
LIVEKIT_API_KEY = os.environ.get("LIVEKIT_API_KEY", "")
LIVEKIT_API_SECRET = os.environ.get("LIVEKIT_API_SECRET", "")

# Voice worker STT/TTS provider matrix (Phase C) - server-side shared
# fallback keys, used only when a bot selects a non-google provider but has
# no BYOK key of its own configured. Mirrors GEMINI_API_KEY's role as a
# shared fallback above. OpenAI already has a key used elsewhere for the
# text-chat BYOK feature (plugins/llm_providers.py reads it straight from
# the customer-supplied key, not from here), so a dedicated constant is
# still added here for the voice worker's own fallback use.
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
DEEPGRAM_API_KEY = os.environ.get("DEEPGRAM_API_KEY", "")
ASSEMBLYAI_API_KEY = os.environ.get("ASSEMBLYAI_API_KEY", "")
SONIOX_API_KEY = os.environ.get("SONIOX_API_KEY", "")
CARTESIA_API_KEY = os.environ.get("CARTESIA_API_KEY", "")
ELEVENLABS_API_KEY = os.environ.get("ELEVENLABS_API_KEY", "")
FISH_API_KEY = os.environ.get("FISH_API_KEY", "")

# Admin / billing bypass emails (comma-separated, e.g. "admin@example.com,owner@domain.com")
ADMIN_BYPASS_EMAILS = {
    e.strip().lower()
    for e in os.environ.get("ADMIN_BYPASS_EMAILS", "personaliai.com@gmail.com").split(",")
    if e.strip()
}
