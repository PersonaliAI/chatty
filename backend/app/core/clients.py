"""Shared client singletons - Supabase and the Gemini (genai) client."""

from __future__ import annotations

import httpx
from google import genai
from supabase import Client, ClientOptions, create_client

from app.core.config import (
    GEMINI_API_KEY,
    GOOGLE_CLOUD_LOCATION,
    GOOGLE_CLOUD_PROJECT,
    SUPABASE_SECRET_KEY,
    SUPABASE_URL,
    USE_VERTEX_AI,
)

# Supabase REST client uses httpx under the hood. Default postgrest-py enables http2=True,
# which is NOT thread-safe when queries run concurrently across worker threads in ThreadPoolExecutor
# (causing "deque mutated during iteration", "SEND_HEADERS in state 5", and broken pipe disconnects).
# Forcing http2=False with connection pooling and transport retries gives rock-solid thread-safe
# connection reuse to Supabase PostgREST.
_supabase_transport = httpx.HTTPTransport(
    retries=3,
    limits=httpx.Limits(
        max_keepalive_connections=64,
        max_connections=128,
        keepalive_expiry=30.0,
    ),
)
_supabase_http_client = httpx.Client(
    http2=False,
    transport=_supabase_transport,
    timeout=httpx.Timeout(30.0, connect=10.0),
)

supabase: Client = create_client(
    SUPABASE_URL,
    SUPABASE_SECRET_KEY,
    options=ClientOptions(httpx_client=_supabase_http_client),
)

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
