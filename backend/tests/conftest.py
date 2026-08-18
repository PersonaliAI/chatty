"""Test bootstrap: provide dummy env + stub the Vertex client so `import main`
succeeds in CI without real Google Cloud / Supabase credentials."""
import os

os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-key")
os.environ.setdefault("SUPABASE_ANON_KEY", "test-anon-key")
os.environ.setdefault("SUPABASE_JWT_SECRET", "test-jwt-secret")
os.environ.setdefault("TELEGRAM_BOT_TOKEN", "123456:TEST")

# Avoid constructing a real Vertex AI client (needs GCP ADC) at import time.
from google import genai as _genai  # noqa: E402

_genai.Client = lambda *a, **k: object()
