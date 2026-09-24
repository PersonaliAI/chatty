"""Test bootstrap: provide dummy env + stub the Vertex client so `import main`
succeeds in CI without real Google Cloud / Supabase credentials.

The backend is also tested from the monorepo root (``pytest backend/tests``),
so make the backend package root importable in that invocation as well as in
the CI job that runs with ``backend/`` as its working directory.
"""
import os
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_SECRET_KEY", "sb_secret_test")
os.environ.setdefault("SUPABASE_ANON_KEY", "test-anon-key")
os.environ.setdefault("SUPABASE_JWT_SECRET", "test-jwt-secret")
os.environ.setdefault("TELEGRAM_BOT_TOKEN", "123456:TEST")
os.environ.setdefault("FUNCTION_SECRET", "test-function-secret-32-bytes-minimum")
os.environ.setdefault("BYOK_ENCRYPTION_KEY", "Ti7qlTpobe6JGMgpbQIHpU0Q6-JAXMKxIq4mBm995dM=")

# Avoid constructing a real Vertex AI client (needs GCP ADC) at import time.
from google import genai as _genai  # noqa: E402

_genai.Client = lambda *a, **k: object()
