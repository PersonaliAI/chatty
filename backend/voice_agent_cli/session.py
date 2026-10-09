"""Conversation-session adapter for voice sessions."""

from __future__ import annotations

import logging
from collections.abc import Iterable
from typing import Any

from app.core.db import run_db

from .organization import OrganizationContext

logger = logging.getLogger("chatty.voice.session")


async def open_voice_session(
    organization: OrganizationContext, session_id: str
) -> dict[str, Any]:
    """Reuse Chatty's widget session persistence for a LiveKit conversation."""
    try:
        from app.services.widget_session_service import upsert_session

        row, _is_new = await upsert_session(
            bot_id=organization.bot["id"],
            session_id=session_id,
            last_message="(voice session started)",
            channel="voice",
        )
        return row
    except Exception:
        # A missing or incomplete local schema must not prevent provider/API
        # construction; the account preflight reports that separately.
        logger.exception("Could not open Chatty session %s", session_id)
        return {}


def _usage_payload(usage: Any) -> tuple[str | None, str | None, int, int]:
    """Flatten LiveKit usage summaries into the Chatty call-log contract."""
    model_usage = getattr(usage, "model_usage", None)
    if not isinstance(model_usage, Iterable) or isinstance(model_usage, (str, bytes)):
        model_usage = []

    provider: str | None = None
    model: str | None = None
    input_tokens = 0
    output_tokens = 0
    for item in model_usage:
        if hasattr(item, "model_dump"):
            values = item.model_dump()
        elif isinstance(item, dict):
            values = item
        else:
            values = vars(item)
        provider = provider or str(values.get("provider") or "") or None
        model = model or str(values.get("model") or "") or None
        input_tokens += max(0, int(values.get("input_tokens") or 0))
        output_tokens += max(0, int(values.get("output_tokens") or 0))

    return provider, model, input_tokens, output_tokens


async def record_voice_call(
    organization: OrganizationContext,
    session_id: str,
    *,
    mode: str,
    duration_seconds: float,
    usage: Any,
    turn_count: int = 0,
    error_count: int = 0,
) -> bool:
    """Persist one tenant-scoped LiveKit call record without breaking shutdown."""
    try:
        provider, model, input_tokens, output_tokens = _usage_payload(usage)
        payload = {
            "bot_id": organization.bot["id"],
            "session_id": session_id,
            "mode": mode if mode in {"pipeline", "realtime"} else "pipeline",
            "provider": provider,
            "model": model,
            "duration_seconds": round(max(0.0, float(duration_seconds)), 3),
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "turn_count": max(0, int(turn_count)),
            "error_count": max(0, int(error_count)),
        }
        await run_db(
            lambda: organization.supabase.table("chatty_voice_calls")
            .insert(payload)
            .execute()
        )
        return True
    except Exception:
        # Telemetry must never turn a successful conversation into a failed
        # shutdown. The structured log still makes schema/dependency drift
        # observable and the next deployment can repair it safely.
        logger.exception(
            "Could not persist Chatty voice call telemetry",
            extra={"bot_id": organization.bot.get("id"), "session_id": session_id},
        )
        return False
