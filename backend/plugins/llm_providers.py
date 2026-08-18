"""BYOK (bring your own key) support for non-Gemini AI Models.

Agentic tool-calling (lead capture, calendar booking, Gmail, memory) stays
Gemini-only — these providers' tool/function-call schemas differ enough that
wiring them in is a separate, larger effort. BYOK replies here are still
knowledge-base-grounded: the caller passes the same RAG-augmented system
prompt used for Gemini, just without function declarations.
"""
import os
from typing import Any, Optional

from cryptography.fernet import Fernet, InvalidToken

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
) -> str:
    """Plain text-completion reply (no function calling) via a customer-supplied key."""
    model = model or DEFAULT_MODELS.get(provider, "")
    if not model:
        raise ValueError(f"Unknown BYOK provider: {provider}")

    if provider == "anthropic":
        import anthropic

        client = anthropic.AsyncAnthropic(api_key=api_key)
        msgs = [
            {"role": "user" if h.get("role") == "user" else "assistant", "content": h["content"]}
            for h in history if (h.get("content") or "").strip()
        ]
        msgs.append({"role": "user", "content": user_text})
        resp = await client.messages.create(model=model, system=system_prompt, max_tokens=2048, messages=msgs)
        return "".join(b.text for b in resp.content if getattr(b, "type", "") == "text").strip()

    if provider in ("openai", "openrouter"):
        import openai

        base_url = "https://openrouter.ai/api/v1" if provider == "openrouter" else None
        client = openai.AsyncOpenAI(api_key=api_key, base_url=base_url)
        msgs: list[dict[str, str]] = [{"role": "system", "content": system_prompt}]
        msgs += [
            {"role": "user" if h.get("role") == "user" else "assistant", "content": h["content"]}
            for h in history if (h.get("content") or "").strip()
        ]
        msgs.append({"role": "user", "content": user_text})
        resp = await client.chat.completions.create(model=model, messages=msgs, max_tokens=2048, temperature=0.2)
        return (resp.choices[0].message.content or "").strip()

    raise ValueError(f"Unknown BYOK provider: {provider}")
