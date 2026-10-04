"""Signed, public unsubscribe tokens for consented campaign emails."""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import time
from typing import Any


def _secret() -> bytes:
    value = os.environ.get("FUNCTION_SECRET") or os.environ.get("SUPABASE_SECRET_KEY")
    if not value:
        raise RuntimeError("A server secret is required for unsubscribe links")
    return value.encode("utf-8")


def make_unsubscribe_token(lead_id: str, email: str) -> str:
    payload = {"lead_id": str(lead_id), "email": email.strip().lower(), "iat": int(time.time())}
    raw = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
    signature = hmac.new(_secret(), raw, hashlib.sha256).digest()
    return base64.urlsafe_b64encode(raw + b"." + signature).decode("ascii").rstrip("=")


def verify_unsubscribe_token(token: str) -> dict[str, Any] | None:
    try:
        padded = token + "=" * (-len(token) % 4)
        decoded = base64.urlsafe_b64decode(padded.encode("ascii"))
        raw, signature = decoded.rsplit(b".", 1)
        expected = hmac.new(_secret(), raw, hashlib.sha256).digest()
        if not hmac.compare_digest(signature, expected):
            return None
        payload = json.loads(raw.decode("utf-8"))
        if not payload.get("lead_id") or not payload.get("email"):
            return None
        return payload
    except (ValueError, TypeError, json.JSONDecodeError, UnicodeError):
        return None
