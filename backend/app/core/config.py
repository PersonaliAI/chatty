"""Environment-derived configuration constants, shared across the app."""

from __future__ import annotations

import os

from dotenv import load_dotenv

# Self-loading: must happen before any os.environ.get() below, and before
# any other module reads env vars — since this is the first thing anything
# in app.core imports, loading .env here (rather than relying on main.py to
# call it first) guarantees correct env state regardless of import order.
load_dotenv()

def _require_env(name: str) -> str:
    """Fail loudly at startup rather than silently falling back to an
    unset/wrong value — a service-role key falling back to the anon key
    would silently downgrade to RLS-filtered access instead of erroring,
    producing confusing partial failures rather than a clear error."""
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f"{name} environment variable is required but not set")
    return value


SUPABASE_URL = _require_env("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = _require_env("SUPABASE_SERVICE_ROLE_KEY")
SUPABASE_JWT_SECRET = os.environ.get("SUPABASE_JWT_SECRET", "")

# Primary model. Override with KIN_MODEL or (legacy) GEMMA_MODEL env vars.
#
# 2026-07-21: briefly tried gemini-2.5-flash-lite as primary for its ~15-22x
# lower cost, reverted the same day — confirmed in production, not just
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
# Lemon Squeezy — accept either naming convention.
LEMON_WEBHOOK_SECRET = (
    os.environ.get("LEMONSQUEEZY_WEBHOOK_SECRET")
    or os.environ.get("LEMON_SQUEEZY_WEBHOOK_SECRET", "")
)
LEMON_API_KEY = os.environ.get("LEMONSQUEEZY_API_KEY", "")
LEMON_STORE_ID = os.environ.get("LEMONSQUEEZY_STORE_ID", "")

FRONTEND_URL = os.environ.get("FRONTEND_URL", "https://personaliai.com")

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
    # Yearly variants map to the same plan — quota is monthly regardless of
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
# (quota/429, transient 5xx, or any other error) — the free-tier AI Studio
# key's daily quota varies wildly per model (e.g. 20 RPD on gemini-2.5-flash
# vs 500 RPD on gemini-3.1-flash-lite), so a single fallback isn't enough to
# ride out a busy day. Gemini 3.x models require a thought_signature on
# every function-call part in a multi-turn conversation, which the manual
# tool-calling loop in plugins/widget_brain.py doesn't propagate — if a
# later round in an ongoing conversation breaks on one of those for that
# reason, it's just another failure this same chain retries past, landing
# back on a 2.5 model (no signature requirement) for that round instead of
# hard-failing.
GEMINI_FALLBACK_MODELS: list[str] = [
    m.strip() for m in os.environ.get(
        "KIN_FALLBACK_MODELS",
        # gemini-3-flash doesn't exist as a callable model (404 NOT_FOUND on
        # generateContent) and was a dead last resort. The two flash-lite 3.x
        # models carry a 500 RPD quota vs. 20 RPD on both 2.5 models, so they
        # sit right after the thought-signature-safe 2.5-flash instead of
        # last, and 2.5-flash-lite (a distinct quota bucket from 2.5-flash)
        # replaces the broken entry as the final fallback.
        "gemini-2.5-flash,gemini-3.1-flash-lite,gemini-3.5-flash-lite,gemini-2.5-flash-lite",
    ).split(",") if m.strip()
]
# Back-compat: some call sites/log messages still refer to a single fallback name.
GEMINI_FALLBACK_MODEL = GEMINI_FALLBACK_MODELS[0] if GEMINI_FALLBACK_MODELS else "gemini-2.5-flash"

SENTRY_DSN = os.environ.get("SENTRY_DSN", "").strip()
SENTRY_ENV = os.environ.get("SENTRY_ENV", "production")
SENTRY_TRACES_SAMPLE_RATE = float(os.environ.get("SENTRY_TRACES_SAMPLE_RATE", "0.05"))

# LiveKit — voice agent worker + token-minting endpoint (Phase B).
LIVEKIT_URL = os.environ.get("LIVEKIT_URL", "")
LIVEKIT_API_KEY = os.environ.get("LIVEKIT_API_KEY", "")
LIVEKIT_API_SECRET = os.environ.get("LIVEKIT_API_SECRET", "")

# Voice worker STT/TTS provider matrix (Phase C) — server-side shared
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
