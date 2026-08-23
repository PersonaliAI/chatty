"""Pure unit tests for plugins/ai_client.py's model-name resolution and
plugins/memory.py's embedding model default — no network calls (see
tests/test_integration_live.py for the real-API smoke tests)."""
from plugins import ai_client, memory


def test_resolve_gemini_model_uses_ai_studio_prefix_when_key_set(monkeypatch):
    monkeypatch.setattr(ai_client, "GEMINI_API_KEY", "fake-key")
    assert ai_client.resolve_gemini_model("gemini-2.5-flash") == "gemini/gemini-2.5-flash"


def test_resolve_gemini_model_uses_vertex_prefix_without_key(monkeypatch):
    monkeypatch.setattr(ai_client, "GEMINI_API_KEY", "")
    assert ai_client.resolve_gemini_model("gemini-2.5-flash") == "vertex_ai/gemini-2.5-flash"


def test_resolve_gemini_model_passes_through_already_prefixed_names(monkeypatch):
    monkeypatch.setattr(ai_client, "GEMINI_API_KEY", "fake-key")
    assert ai_client.resolve_gemini_model("vertex_ai/gemini-2.5-flash") == "vertex_ai/gemini-2.5-flash"
    assert ai_client.resolve_gemini_model("openai/gpt-5") == "openai/gpt-5"


def test_resolve_byok_model_prefixes_by_provider():
    assert ai_client.resolve_byok_model("openai", "gpt-4o") == "openai/gpt-4o"
    assert ai_client.resolve_byok_model("anthropic", "claude-3-5-sonnet-latest") == "anthropic/claude-3-5-sonnet-latest"
    assert ai_client.resolve_byok_model("openrouter", "mistralai/mistral-large") == "openrouter/mistralai/mistral-large"


def test_split_provider_model():
    assert ai_client._split_provider_model("gemini/gemini-2.5-flash") == ("gemini", "gemini-2.5-flash")
    assert ai_client._split_provider_model("bare-model-no-slash") == ("unknown", "bare-model-no-slash")


def test_embed_model_default_is_not_the_retired_text_embedding_004():
    # text-embedding-004 was retired from the Gemini API (404s on
    # embedContent) — regression guard against reintroducing it as the
    # default and silently breaking RAG/knowledge-base search again.
    assert memory.EMBED_MODEL != "text-embedding-004"
