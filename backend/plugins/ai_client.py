"""Unified LLM/embedding client — every AI-provider call in the codebase
(Gemini via Vertex AI/AI Studio, and the BYOK OpenAI/Anthropic/OpenRouter
paths) routes through here via LiteLLM (https://github.com/BerriAI/litellm)
instead of calling each provider's SDK directly. One call surface means:

  - one place that knows how to retry/fall back across models,
  - one place that logs tokens + cost for every call, to chatty_ai_usage,
  - BYOK providers get the same call shape as Gemini instead of their own
    hand-rolled per-provider branch (see the old plugins/llm_providers.py).

Model name convention: callers pass a bare model name (e.g. "gemini-2.5-
flash", "claude-3-5-sonnet-latest") and resolve_model() prefixes it for
LiteLLM based on which provider it belongs to — mirrors the GEMINI_API_KEY
(AI Studio) vs Vertex AI dual path app/core/clients.py already had.
"""

from __future__ import annotations

import logging
import time
from typing import Any, Optional

import litellm

from app.core.clients import supabase
from app.core.config import GEMINI_API_KEY, GOOGLE_CLOUD_LOCATION, GOOGLE_CLOUD_PROJECT
from app.core.db import run_db

logger = logging.getLogger("chatty.ai")

# Drop kwargs a given provider doesn't support instead of raising — Gemini,
# Anthropic, and OpenAI don't all accept the same completion params (e.g.
# not every provider takes response_schema), and the old per-provider code
# in llm_providers.py handled this by only ever passing what that provider
# understood. This is LiteLLM's equivalent.
litellm.drop_params = True
litellm.telemetry = False

if GOOGLE_CLOUD_PROJECT:
    litellm.vertex_project = GOOGLE_CLOUD_PROJECT
    litellm.vertex_location = GOOGLE_CLOUD_LOCATION

_BYOK_PROVIDER_PREFIXES = ("openai/", "anthropic/", "openrouter/")
_TRANSIENT_EXCEPTIONS = (
    litellm.RateLimitError,
    litellm.InternalServerError,
    litellm.ServiceUnavailableError,
    litellm.Timeout,
    litellm.APIConnectionError,
)


def resolve_gemini_model(name: str) -> str:
    """Prefix a bare Gemini model name for LiteLLM. Already-prefixed model
    strings (any provider) pass through unchanged."""
    if "/" in name:
        return name
    return f"gemini/{name}" if GEMINI_API_KEY else f"vertex_ai/{name}"


def resolve_byok_model(provider: str, model: str) -> str:
    """Prefix a bare BYOK model name for LiteLLM. `provider` is one of
    "openai" | "anthropic" | "openrouter", matching chatty_bots.byok_provider.
    Note: openrouter model IDs are themselves "vendor/model" (e.g.
    "mistralai/mistral-large"), so — unlike resolve_gemini_model — a bare
    slash in `model` doesn't mean it's already a fully-qualified litellm
    string; only an explicit provider prefix does."""
    if model.startswith((f"{provider}/",) + _BYOK_PROVIDER_PREFIXES):
        return model
    return f"{provider}/{model}"


def _split_provider_model(litellm_model: str) -> tuple[str, str]:
    if "/" in litellm_model:
        provider, bare = litellm_model.split("/", 1)
        return provider, bare
    return "unknown", litellm_model


async def _log_usage(
    *,
    response: Any,
    litellm_model: str,
    call_type: str,
    bot_id: Optional[str] = None,
    session_id: Optional[str] = None,
    is_byok: bool = False,
    latency_ms: Optional[int] = None,
    success: bool = True,
    error: Optional[str] = None,
) -> None:
    usage = getattr(response, "usage", None)
    prompt_tokens = getattr(usage, "prompt_tokens", 0) or 0
    completion_tokens = getattr(usage, "completion_tokens", 0) or 0
    total_tokens = getattr(usage, "total_tokens", 0) or (prompt_tokens + completion_tokens)
    cost: Optional[float] = None
    if response is not None:
        try:
            cost = litellm.completion_cost(completion_response=response)
        except Exception:  # noqa: BLE001 — pricing unknown for this model (e.g. an unlisted BYOK model)
            cost = None
    provider, bare_model = _split_provider_model(litellm_model)
    try:
        await run_db(lambda: supabase.table("chatty_ai_usage").insert({
            "bot_id": bot_id,
            "session_id": session_id,
            "call_type": call_type,
            "provider": provider,
            "model": bare_model,
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "total_tokens": total_tokens,
            "cost_usd": cost,
            "is_byok": is_byok,
            "success": success,
            "error": (error or "")[:2000] or None,
            "latency_ms": latency_ms,
        }).execute())
    except Exception:  # noqa: BLE001 — usage logging must never break the actual AI call
        logger.warning("failed to log AI usage for %s", litellm_model, exc_info=True)


async def chat(
    *,
    model: str,
    messages: list[dict],
    fallback_models: Optional[list[str]] = None,
    max_attempts: int = 4,
    bot_id: Optional[str] = None,
    session_id: Optional[str] = None,
    is_byok: bool = False,
    call_type: str = "chat",
    **kwargs: Any,
):
    """Non-streaming chat completion with retry-then-fallback, matching the
    old _gemini_generate's semantics: retry the primary model through
    max_attempts on transient errors (rate limit/5xx/timeout), then try each
    fallback model once in order. Every attempt (success or final failure)
    is logged to chatty_ai_usage. Returns a LiteLLM ModelResponse (OpenAI
    Chat Completions shape: response.choices[0].message.content/.tool_calls,
    response.usage.*)."""
    import asyncio
    import random

    candidates = [model] + [m for m in (fallback_models or []) if m != model]
    last_err: Optional[Exception] = None

    for attempt in range(max_attempts):
        start = time.monotonic()
        try:
            resp = await litellm.acompletion(model=model, messages=messages, **kwargs)
            await _log_usage(
                response=resp, litellm_model=model, call_type=call_type, bot_id=bot_id,
                session_id=session_id, is_byok=is_byok,
                latency_ms=int((time.monotonic() - start) * 1000),
            )
            return resp
        except _TRANSIENT_EXCEPTIONS as exc:
            last_err = exc
            if attempt == max_attempts - 1:
                break
            backoff = (2 ** attempt) * (1 + random.uniform(-0.2, 0.2))
            logger.warning(
                "%s transient error — retry %d/%d in %.1fs: %s",
                model, attempt + 1, max_attempts, backoff, exc,
            )
            await asyncio.sleep(backoff)
        except Exception as exc:  # noqa: BLE001
            last_err = exc
            await _log_usage(
                response=None, litellm_model=model, call_type=call_type, bot_id=bot_id,
                session_id=session_id, is_byok=is_byok, success=False, error=str(exc),
                latency_ms=int((time.monotonic() - start) * 1000),
            )
            break

    for fallback_model in candidates[1:]:
        logger.warning("falling back from %s to %s", model, fallback_model)
        start = time.monotonic()
        try:
            resp = await litellm.acompletion(model=fallback_model, messages=messages, **kwargs)
            await _log_usage(
                response=resp, litellm_model=fallback_model, call_type=call_type, bot_id=bot_id,
                session_id=session_id, is_byok=is_byok,
                latency_ms=int((time.monotonic() - start) * 1000),
            )
            return resp
        except Exception as exc:  # noqa: BLE001
            last_err = exc
            await _log_usage(
                response=None, litellm_model=fallback_model, call_type=call_type, bot_id=bot_id,
                session_id=session_id, is_byok=is_byok, success=False, error=str(exc),
                latency_ms=int((time.monotonic() - start) * 1000),
            )

    assert last_err is not None
    raise last_err


async def chat_stream(
    *,
    model: str,
    messages: list[dict],
    fallback_models: Optional[list[str]] = None,
    on_token=None,
    bot_id: Optional[str] = None,
    session_id: Optional[str] = None,
    call_type: str = "chat_stream",
    **kwargs: Any,
) -> dict:
    """Streaming counterpart to chat(). Invokes `await on_token(delta)` per
    visible text chunk. Returns {"text", "tool_calls", "message", "usage"} —
    "message" is the assistant message dict (with content/tool_calls) ready
    to append to the running `messages` list for a follow-up round. Falls
    back to each fallback model, then to the non-streaming chat() as a last
    resort, on any streaming error."""

    async def _run(m: str) -> dict:
        start = time.monotonic()
        stream = await litellm.acompletion(model=m, messages=messages, stream=True, **kwargs)
        text_parts: list[str] = []
        tool_calls: dict[int, dict] = {}
        usage = None
        async for chunk in stream:
            choice = chunk.choices[0] if chunk.choices else None
            if choice is None:
                continue
            delta = choice.delta
            if getattr(chunk, "usage", None):
                usage = chunk.usage
            if delta and delta.content:
                text_parts.append(delta.content)
                if on_token:
                    await on_token(delta.content)
            if delta and delta.tool_calls:
                for tc in delta.tool_calls:
                    slot = tool_calls.setdefault(tc.index, {
                        "id": tc.id, "type": "function",
                        "function": {"name": "", "arguments": ""},
                    })
                    if tc.id:
                        slot["id"] = tc.id
                    if tc.function and tc.function.name:
                        slot["function"]["name"] += tc.function.name
                    if tc.function and tc.function.arguments:
                        slot["function"]["arguments"] += tc.function.arguments
        text = "".join(text_parts).strip()
        ordered_tool_calls = [tool_calls[k] for k in sorted(tool_calls)]
        message = {"role": "assistant", "content": text or None}
        if ordered_tool_calls:
            message["tool_calls"] = ordered_tool_calls
        # Streaming responses don't always report usage in the final chunk
        # depending on provider — best-effort logging, never fatal.
        class _FakeResp:
            pass
        fake = _FakeResp()
        fake.usage = usage
        await _log_usage(
            response=fake if usage else None, litellm_model=m, call_type=call_type,
            bot_id=bot_id, session_id=session_id,
            latency_ms=int((time.monotonic() - start) * 1000),
        )
        return {"text": text, "tool_calls": ordered_tool_calls, "message": message, "usage": usage}

    try:
        return await _run(model)
    except Exception:  # noqa: BLE001
        logger.exception("stream failed on %s", model)
        for fallback_model in (fallback_models or []):
            if fallback_model == model:
                continue
            try:
                return await _run(fallback_model)
            except Exception:  # noqa: BLE001
                logger.exception("stream fallback failed on %s", fallback_model)
        # Last resort: non-streaming call (has its own retry + fallback chain).
        resp = await chat(model=model, messages=messages, fallback_models=fallback_models,
                           bot_id=bot_id, session_id=session_id, call_type=call_type, **kwargs)
        msg = resp.choices[0].message
        text = (msg.content or "").strip()
        if on_token and text and not getattr(msg, "tool_calls", None):
            await on_token(text)
        return {
            "text": text,
            "tool_calls": [tc.model_dump() for tc in (msg.tool_calls or [])] if getattr(msg, "tool_calls", None) else [],
            "message": msg.model_dump() if hasattr(msg, "model_dump") else dict(msg),
            "usage": getattr(resp, "usage", None),
        }


async def embed(
    *,
    model: str,
    input: list[str] | str,
    bot_id: Optional[str] = None,
    call_type: str = "embedding",
    **kwargs: Any,
):
    """Embedding call, logged the same way as chat(). Returns a LiteLLM
    EmbeddingResponse (response.data[i]["embedding"])."""
    start = time.monotonic()
    try:
        resp = await litellm.aembedding(model=model, input=input, **kwargs)
        await _log_usage(
            response=resp, litellm_model=model, call_type=call_type, bot_id=bot_id,
            latency_ms=int((time.monotonic() - start) * 1000),
        )
        return resp
    except Exception as exc:  # noqa: BLE001
        await _log_usage(
            response=None, litellm_model=model, call_type=call_type, bot_id=bot_id,
            success=False, error=str(exc), latency_ms=int((time.monotonic() - start) * 1000),
        )
        raise
