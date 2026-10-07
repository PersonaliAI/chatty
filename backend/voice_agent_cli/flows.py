"""Bridge voice turns to Chatty's published-flow runtime."""

from __future__ import annotations

import logging
import uuid

from .organization import OrganizationContext

logger = logging.getLogger("chatty.voice.flows")


class PublishedFlowService:
    """Run the existing Chatty widget flow engine for a voice user turn.

    Flow execution is intentionally delegated to Chatty's canonical runtime;
    this adapter only translates a voice transcript into the widget event
    shape and persists the visitor message when a flow owns the reply.
    """

    def __init__(self, organization: OrganizationContext, session_id: str) -> None:
        self.organization = organization
        self.session_id = session_id

    async def reply_for(self, text: str) -> str:
        try:
            from app.services.flow_runtime import run_widget_flow

            result = await run_widget_flow(
                self.organization.modules.supabase,
                bot_id=str(self.organization.bot["id"]),
                event="message.user",
                session_id=self.session_id,
                data={
                    "content": text,
                    "offline_ticket": False,
                    "event_id": uuid.uuid4().hex,
                },
            )
        except Exception:
            logger.exception("Published Chatty flow execution failed")
            return ""

        if not isinstance(result, dict) or not result.get("reply"):
            return ""

        await self._persist_user_message(text)
        return str(result["reply"])

    async def _persist_user_message(self, text: str) -> None:
        """Match the widget's visitor transcript persistence for flow turns."""
        try:
            from app.core.db import run_db

            await run_db(
                lambda: self.organization.modules.supabase.table(
                    "chatty_conversations"
                )
                .insert(
                    {
                        "bot_id": self.organization.bot["id"],
                        "session_id": self.session_id,
                        "role": "user",
                        "content": text,
                        "sender": "visitor",
                    }
                )
                .execute()
            )
        except Exception:
            # A flow response should remain usable even if transcript storage
            # is temporarily unavailable; the regular recorder still handles
            # ordinary LLM turns.
            logger.exception("Failed to persist published-flow voice message")
