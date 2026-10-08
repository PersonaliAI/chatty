"""Conversation-session adapter for voice sessions."""

from __future__ import annotations

import logging
from typing import Any

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
