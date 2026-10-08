"""Persist finalized LiveKit turns through Chatty's conversation port."""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from livekit.agents import llm

from .organization import OrganizationContext

logger = logging.getLogger("chatty.voice.conversation")


class ConversationRecorder:
    """Non-blocking event adapter for user/assistant transcript messages."""

    _MAX_WRITE_ATTEMPTS = 3
    _RETRY_DELAYS_SECONDS = (0.2, 0.5)

    def __init__(self, organization: OrganizationContext, session_id: str) -> None:
        from app.adapters.supabase_conversations import SupabaseConversationRepository

        self._repository = SupabaseConversationRepository(organization.supabase)
        self._bot_id = organization.bot["id"]
        self._session_id = session_id
        self._tasks: set[asyncio.Task[None]] = set()
        self._last_user_text = ""

    def handle(self, event: Any) -> None:
        """Schedule persistence without blocking LiveKit's event emitter."""
        item = getattr(event, "item", None)
        role = str(getattr(item, "role", ""))
        content = str(getattr(item, "raw_text_content", "") or "").strip()
        if role not in {"user", "assistant"} or not content:
            return
        if role == "user":
            self._last_user_text = content
        question = self._last_user_text if role == "assistant" else ""
        task = asyncio.create_task(self._append(role, content, question))
        self._tasks.add(task)
        task.add_done_callback(self._tasks.discard)

    async def flush(self) -> None:
        """Wait for queued transcript writes during graceful shutdown."""
        if self._tasks:
            await asyncio.gather(*self._tasks, return_exceptions=True)

    async def _append(self, role: str, content: str, question: str) -> None:
        for attempt in range(self._MAX_WRITE_ATTEMPTS):
            try:
                await self._repository.append_message(
                    bot_id=self._bot_id,
                    session_id=self._session_id,
                    role=role,
                    content=content,
                )
                if role == "assistant" and question:
                    from app.services.widget_session_service import (
                        log_unanswered_if_needed,
                    )

                    await asyncio.to_thread(
                        log_unanswered_if_needed,
                        self._bot_id,
                        self._session_id,
                        question,
                        content,
                    )
                return
            except Exception as exc:
                if attempt + 1 < self._MAX_WRITE_ATTEMPTS:
                    await asyncio.sleep(self._RETRY_DELAYS_SECONDS[attempt])
                    continue
                # Do not disable the recorder: a later turn may succeed after a
                # short Supabase/network interruption. The in-memory event is
                # still flushed and the failure remains visible in structured logs.
                logger.warning(
                    "Chatty transcript persistence failed after retries (%s)",
                    type(exc).__name__,
                    extra={
                        "role": role,
                        "attempts": self._MAX_WRITE_ATTEMPTS,
                        "session_id": self._session_id,
                    },
                )


async def load_chat_context(
    organization: OrganizationContext, session_id: str
) -> llm.ChatContext:
    """Hydrate LiveKit context from Chatty history when it is available."""
    context = llm.ChatContext()
    try:
        from app.adapters.supabase_conversations import SupabaseConversationRepository

        repository = SupabaseConversationRepository(organization.supabase)
        rows = await repository.list_history(
            bot_id=organization.bot["id"], session_id=session_id
        )
        for row in rows:
            role = str(row.get("role") or "")
            content = str(row.get("content") or "").strip()
            if role in {"user", "assistant", "system"} and content:
                context.add_message(role=role, content=content)
    except Exception as exc:
        logger.warning(
            "Chatty conversation history unavailable for this session (%s)",
            type(exc).__name__,
        )
    return context
