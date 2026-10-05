"""Pure unit tests for plugins/ai_client.py's model-name resolution and
plugins/memory.py's embedding model default - no network calls (see
tests/test_integration_live.py for the real-API smoke tests)."""
from types import SimpleNamespace
import asyncio
import pytest

from plugins import ai_client, memory
from app.core.config import _normalized_api_key


def test_api_key_trims_pasted_newlines_for_sdk_environment(monkeypatch):
    monkeypatch.setenv("TEST_PROVIDER_KEY", "fake-key\r\n")
    assert _normalized_api_key("TEST_PROVIDER_KEY") == "fake-key"
    import os
    assert os.environ["TEST_PROVIDER_KEY"] == "fake-key"


def test_api_key_rejects_embedded_control_without_exposing_value(monkeypatch):
    monkeypatch.setenv("TEST_PROVIDER_KEY", "secret\r\ninjected")
    with pytest.raises(RuntimeError, match="TEST_PROVIDER_KEY contains invalid control characters") as error:
        _normalized_api_key("TEST_PROVIDER_KEY")
    assert "secret" not in str(error.value)


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
    # embedContent) - regression guard against reintroducing it as the
    # default and silently breaking RAG/knowledge-base search again.
    assert memory.EMBED_MODEL != "text-embedding-004"


def test_chat_stream_deduplicates_fallbacks_and_limits_final_non_stream_retry(monkeypatch):
    calls = []

    async def fake_acompletion(*, model, stream=False, **kwargs):
        calls.append((model, stream))
        if stream:
            raise RuntimeError(f"stream unavailable: {model}")
        message = SimpleNamespace(
            content="degraded success",
            tool_calls=None,
            model_dump=lambda: {"role": "assistant", "content": "degraded success"},
        )
        return SimpleNamespace(
            choices=[SimpleNamespace(message=message)],
            usage=None,
        )

    monkeypatch.setattr(ai_client.litellm, "acompletion", fake_acompletion)
    monkeypatch.setattr(ai_client, "_log_usage", lambda **kwargs: _async_noop())

    result = asyncio.run(ai_client.chat_stream(
        model="gemini/primary",
        messages=[{"role": "user", "content": "hello"}],
        fallback_models=["gemini/fallback", "gemini/primary", "gemini/fallback"],
    ))

    assert result["text"] == "degraded success"
    assert calls == [
        ("gemini/primary", True),
        ("gemini/fallback", True),
        ("gemini/primary", False),
    ]


def test_chat_stream_does_not_replay_fallback_after_visible_output(monkeypatch):
    """A mid-stream provider failure must not make voice repeat its answer."""
    calls = []
    chunks = []

    async def broken_stream():
        yield SimpleNamespace(choices=[SimpleNamespace(
            delta=SimpleNamespace(content="Hello", tool_calls=None),
        )])
        raise RuntimeError("connection dropped")

    async def fake_acompletion(*, model, stream=False, **kwargs):
        calls.append((model, stream))
        if stream:
            return broken_stream()
        raise AssertionError("non-streaming recovery must not replay visible voice text")

    monkeypatch.setattr(ai_client.litellm, "acompletion", fake_acompletion)
    monkeypatch.setattr(ai_client, "_log_usage", lambda **kwargs: _async_noop())

    with pytest.raises(ai_client.PartialStreamError):
        asyncio.run(ai_client.chat_stream(
            model="gemini/primary",
            messages=[{"role": "user", "content": "hello"}],
            fallback_models=["gemini/fallback"],
            on_token=chunks.append,
        ))

    assert chunks == ["Hello"]
    assert calls == [("gemini/primary", True)]


async def _async_noop():
    return None
