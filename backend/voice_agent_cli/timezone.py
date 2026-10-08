"""Validated visitor timezone helpers for Chatty voice sessions."""

from __future__ import annotations

import logging
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

logger = logging.getLogger("chatty.voice.timezone")


def resolve_visitor_timezone(raw: object, fallback: str) -> str:
    """Accept only an IANA timezone before handing it to booking tools."""
    candidate = str(raw or "").strip()
    if not candidate:
        return fallback
    try:
        ZoneInfo(candidate)
    except (ValueError, ZoneInfoNotFoundError):
        logger.warning("Ignoring invalid visitor timezone %r", candidate)
        return fallback
    return candidate
