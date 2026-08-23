"""plugins/llm_providers.py (BYOK) tests — verifies the LiteLLM request shape
per provider without hitting a real API. Usage logging is stubbed out since
it talks to Supabase (see test_ai_client.py / test_integration_live.py for
paths that exercise real network calls).

Uses asyncio.run() rather than a pytest-async plugin — the rest of this
suite is plain sync pytest, and this is the only place that needs to await
anything, so a wrapper is simpler than adding a new test dependency."""
import asyncio

import litellm
import pytest

from plugins import ai_client, llm_providers


class _FakeMessage:
    content = "hello from fake"
    tool_calls = None


class _FakeChoice:
    message = _FakeMessage()


class _FakeUsage:
    prompt_tokens = 5
    completion_tokens = 3
    total_tokens = 8


class _FakeResponse:
    choices = [_FakeChoice()]
    usage = _FakeUsage()


@pytest.fixture(autouse=True)
def _stub_litellm_and_logging(monkeypatch):
    captured: dict = {}

    async def fake_acompletion(**kwargs):
        captured["kwargs"] = kwargs
        return _FakeResponse()

    async def fake_log_usage(**kwargs):
        return None

    monkeypatch.setattr(litellm, "acompletion", fake_acompletion)
    monkeypatch.setattr(ai_client, "_log_usage", fake_log_usage)
    return captured


def _run(provider, model, captured, **overrides):
    kwargs = dict(
        provider=provider, api_key="sk-fake", model=model,
        system_prompt="You are a helpful bot.",
        history=[{"role": "user", "content": "hi"}, {"role": "assistant", "content": "hello"}],
        user_text="what is your name?",
        bot_id="bot-123", session_id="sess-456",
    )
    kwargs.update(overrides)
    reply = asyncio.run(llm_providers.generate_simple_reply(**kwargs))
    assert reply == "hello from fake"
    return captured["kwargs"]


def test_openai_uses_default_model_and_temperature(_stub_litellm_and_logging):
    kwargs = _run("openai", None, _stub_litellm_and_logging)
    assert kwargs["model"] == "openai/gpt-4o"
    assert kwargs["temperature"] == 0.2
    assert "base_url" not in kwargs


def test_anthropic_omits_temperature(_stub_litellm_and_logging):
    kwargs = _run("anthropic", None, _stub_litellm_and_logging)
    assert kwargs["model"] == "anthropic/claude-3-5-sonnet-latest"
    assert "temperature" not in kwargs


def test_openrouter_sets_base_url_and_preserves_vendor_slash(_stub_litellm_and_logging):
    kwargs = _run("openrouter", "mistralai/mistral-large", _stub_litellm_and_logging)
    assert kwargs["model"] == "openrouter/mistralai/mistral-large"
    assert kwargs["base_url"] == "https://openrouter.ai/api/v1"


def test_messages_put_system_prompt_first_then_history_then_user_text(_stub_litellm_and_logging):
    kwargs = _run("openai", None, _stub_litellm_and_logging)
    assert kwargs["messages"] == [
        {"role": "system", "content": "You are a helpful bot."},
        {"role": "user", "content": "hi"},
        {"role": "assistant", "content": "hello"},
        {"role": "user", "content": "what is your name?"},
    ]


def test_history_entries_with_empty_content_are_dropped(_stub_litellm_and_logging):
    kwargs = _run(
        "openai", None, _stub_litellm_and_logging,
        history=[{"role": "user", "content": ""}, {"role": "user", "content": "  "}, {"role": "user", "content": "real"}],
        user_text="hi",
    )
    assert kwargs["messages"] == [
        {"role": "system", "content": "You are a helpful bot."},
        {"role": "user", "content": "real"},
        {"role": "user", "content": "hi"},
    ]


def test_unknown_provider_raises_before_calling_litellm(_stub_litellm_and_logging):
    with pytest.raises(ValueError, match="Unknown BYOK provider"):
        asyncio.run(llm_providers.generate_simple_reply(
            provider="cohere", api_key="sk-fake", model="command-r",
            system_prompt="sys", history=[], user_text="hi",
        ))
    assert "kwargs" not in _stub_litellm_and_logging
