"""BYOK (bring your own key) support for non-Gemini AI Models.

Agentic tool-calling (lead capture, calendar booking, Gmail, memory) stays
Gemini-only — these providers' tool/function-call schemas differ enough that
wiring them in is a separate, larger effort. BYOK replies here are still
knowledge-base-grounded: the caller passes the same RAG-augmented system
prompt used for Gemini, just without function declarations.

Routes through plugins/ai_client.py (LiteLLM) rather than each provider's
own SDK — LiteLLM already normalizes the system-prompt-as-a-message vs.
system-prompt-as-a-separate-param difference between OpenAI/OpenRouter and
Anthropic, so this no longer needs a per-provider branch the way the old
direct-SDK version did.
"""
import os
from typing import Any, Optional

from cryptography.fernet import Fernet, InvalidToken

from plugins import ai_client

DEFAULT_MODELS = {
    "openai": "gpt-4o",
    "anthropic": "claude-3-5-sonnet-latest",
    "openrouter": "mistralai/mistral-large",
}


def _fernet() -> Fernet:
    key = os.environ.get("BYOK_ENCRYPTION_KEY")
    if not key:
        raise RuntimeError("BYOK_ENCRYPTION_KEY not configured")
    return Fernet(key.encode())


def encrypt_api_key(raw: str) -> str:
    return _fernet().encrypt(raw.encode()).decode()


def decrypt_api_key(enc: str) -> str:
    try:
        return _fernet().decrypt(enc.encode()).decode()
    except InvalidToken as exc:
        raise RuntimeError("Stored BYOK key could not be decrypted (wrong/rotated BYOK_ENCRYPTION_KEY?)") from exc


async def generate_simple_reply(
    *,
    provider: str,
    api_key: str,
    model: Optional[str],
    system_prompt: str,
    history: list[dict[str, Any]],
    user_text: str,
    bot_id: Optional[str] = None,
    session_id: Optional[str] = None,
) -> str:
    """Plain text-completion reply (no function calling) via a customer-supplied key."""
    model = model or DEFAULT_MODELS.get(provider, "")
    if not model:
        raise ValueError(f"Unknown BYOK provider: {provider}")
    if provider not in ("openai", "anthropic", "openrouter"):
        raise ValueError(f"Unknown BYOK provider: {provider}")

    litellm_model = ai_client.resolve_byok_model(provider, model)
    messages: list[dict[str, str]] = [{"role": "system", "content": system_prompt}]
    messages += [
        {"role": "user" if h.get("role") == "user" else "assistant", "content": h["content"]}
        for h in history if (h.get("content") or "").strip()
    ]
    messages.append({"role": "user", "content": user_text})

    extra: dict[str, Any] = {"max_tokens": 2048}
    if provider == "openrouter":
        extra["base_url"] = "https://openrouter.ai/api/v1"
    if provider != "anthropic":
        extra["temperature"] = 0.2

    resp = await ai_client.chat(
        model=litellm_model,
        messages=messages,
        api_key=api_key,
        bot_id=bot_id,
        session_id=session_id,
        is_byok=True,
        call_type="byok_chat",
        **extra,
    )
    return (resp.choices[0].message.content or "").strip()
