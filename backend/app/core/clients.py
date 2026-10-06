"""Shared client singletons - Supabase and the Gemini (genai) client."""

from __future__ import annotations

from google import genai
from supabase import Client, create_client

from app.core.config import (
    GEMINI_API_KEY,
    GOOGLE_CLOUD_LOCATION,
    GOOGLE_CLOUD_PROJECT,
    SUPABASE_SECRET_KEY,
    SUPABASE_URL,
    USE_VERTEX_AI,
)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SECRET_KEY)

# GEMINI_API_KEY (Google AI Studio, free tier) is a separate billing surface
# from Vertex AI. Setting USE_VERTEX_AI=true (or unsetting GEMINI_API_KEY)
# routes all model calls through Vertex AI using GCP credentials/project.
if USE_VERTEX_AI:
    genai_client = genai.Client(
        vertexai=True,
        project=GOOGLE_CLOUD_PROJECT,
        location=GOOGLE_CLOUD_LOCATION,
    )
else:
    genai_client = genai.Client(api_key=GEMINI_API_KEY)
