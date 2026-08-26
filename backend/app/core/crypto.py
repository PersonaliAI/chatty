"""Symmetric encryption for sensitive values stored at rest — OAuth access/
refresh tokens (Google, Microsoft) alongside the existing BYOK LLM-key use in
plugins/llm_providers.py. Shares BYOK_ENCRYPTION_KEY rather than adding a
second secret to rotate/deploy.

decrypt_secret() falls back to returning its input unchanged when it isn't a
valid Fernet token, rather than raising. This lets already-connected OAuth
accounts (stored as plaintext before this module existed) keep working
without a data migration — each token re-encrypts itself the next time it's
refreshed and written back.
"""
from __future__ import annotations

import os

from cryptography.fernet import Fernet, InvalidToken


def _fernet() -> Fernet:
    key = os.environ.get("BYOK_ENCRYPTION_KEY")
    if not key:
        raise RuntimeError("BYOK_ENCRYPTION_KEY not configured")
    return Fernet(key.encode())


def encrypt_secret(raw: str) -> str:
    return _fernet().encrypt(raw.encode()).decode()


def decrypt_secret(value: str) -> str:
    """Decrypt a Fernet-encrypted value; pass through unchanged if `value`
    isn't one (legacy plaintext row, or an already-decrypted in-memory
    value from earlier in the same request)."""
    if not value:
        return value
    try:
        return _fernet().decrypt(value.encode()).decode()
    except InvalidToken:
        return value
