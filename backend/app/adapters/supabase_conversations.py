"""Supabase adapter for the conversation repository port.

This module is the only place the conversation service needs to know the
Supabase REST query shape. Replacing Supabase later means implementing the
same port, not changing widget orchestration or domain code.
"""

from __future__ import annotations

from typing import Any, Mapping, Sequence

from app.core.db import run_db


class SupabaseConversationRepository:
    """ConversationRepository backed by the existing Supabase client."""

    def __init__(self, client: Any):
        self._client = client

    async def list_history(self, *, bot_id: str, session_id: str) -> Sequence[Mapping[str, Any]]:
        response = await run_db(
            lambda: self._client.table("chatty_conversations")
            .select("*")
            .eq("bot_id", bot_id)
            .eq("session_id", session_id)
            .order("created_at", desc=False)
            .execute()
        )
        return response.data or []

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
        payload: dict[str, Any] = {
            "bot_id": bot_id,
            "session_id": session_id,
            "role": role,
            "content": content,
        }
        for key, value in {
            "sender": sender,
            "sender_name": sender_name,
            "sender_avatar": sender_avatar,
        }.items():
            if value is not None:
                payload[key] = value
        response = await run_db(
            lambda: self._client.table("chatty_conversations")
            .insert(payload)
            .execute()
        )
        return (response.data or [payload])[0]
