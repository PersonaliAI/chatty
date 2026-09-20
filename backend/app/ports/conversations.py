"""Conversation persistence contract used by widget/application services."""

from __future__ import annotations

from typing import Any, Mapping, Protocol, Sequence


class ConversationRepository(Protocol):
    """Persistence boundary for tenant-scoped conversation messages.

    Implementations must preserve database ordering and return the canonical
    `created_at` value supplied by the database. Business logic must not know
    whether the backing store is Supabase, PostgreSQL, or another adapter.
    """

    async def list_history(self, *, bot_id: str, session_id: str) -> Sequence[Mapping[str, Any]]:
        """Return messages in ascending creation order."""

    async def append_message(
        self,
        *,
        bot_id: str,
        session_id: str,
        role: str,
        content: str,
        sender: str | None = None,
        sender_name: str | None = None,
        sender_avatar: str | None = None,
    ) -> Mapping[str, Any]:
        """Persist and return one canonical conversation message."""

