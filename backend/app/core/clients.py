"""Shared client singletons — Supabase and the Gemini (genai) client."""

from __future__ import annotations

from google import genai
from supabase import Client, create_client

from app.core.config import (
    GEMINI_API_KEY,
    GOOGLE_CLOUD_LOCATION,
    GOOGLE_CLOUD_PROJECT,
    SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_URL,
)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

# GEMINI_API_KEY (Google AI Studio, free tier) is a separate billing surface
# from Vertex AI — set it to route all Gemini calls through AI Studio instead
# (e.g. when the GCP project's Vertex AI billing is blocked/suspended).
# Vertex AI stays as the default/fallback path when GEMINI_API_KEY is unset,
# unchanged from before.
if GEMINI_API_KEY:
    genai_client = genai.Client(api_key=GEMINI_API_KEY)
else:
    genai_client = genai.Client(
        vertexai=True,
        project=GOOGLE_CLOUD_PROJECT,
        # gemini-3.x models are only served from the "global" Vertex AI endpoint,
        # not region-pinned ones like us-central1 (confirmed empirically — they
        # 404 there). "global" also works fine for the older 2.5 models and
        # text-embedding-004 that OCR/memory still use, so one client covers all.
        location=GOOGLE_CLOUD_LOCATION,
    )
