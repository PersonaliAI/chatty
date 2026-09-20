"""Contract checks for the first persistence port."""

from __future__ import annotations

import asyncio
from types import SimpleNamespace

from app.adapters.supabase_conversations import SupabaseConversationRepository


class _Query:
    def __init__(self, rows=None):
        self.rows = rows or []
        self.filters = []
        self.ordering = None
        self.inserted = None

    def select(self, value):
        return self

    def eq(self, key, value):
        self.filters.append((key, value))
        return self

    def order(self, key, desc=False):
        self.ordering = (key, desc)
        return self

    def insert(self, payload):
        self.inserted = payload
        return self

    def execute(self):
        return SimpleNamespace(data=self.rows or ([self.inserted] if self.inserted else []))


class _Client:
    def __init__(self):
        self.query = _Query([{"id": "m1", "role": "user", "content": "hello"}])

    def table(self, name):
        assert name == "chatty_conversations"
        return self.query


def test_list_history_preserves_tenant_scope_and_order(monkeypatch):
    client = _Client()
    monkeypatch.setattr("app.adapters.supabase_conversations.run_db", lambda fn: _await(fn()))
    rows = asyncio.run(SupabaseConversationRepository(client).list_history(bot_id="b1", session_id="s1"))
    assert rows[0]["id"] == "m1"
    assert client.query.filters == [("bot_id", "b1"), ("session_id", "s1")]
    assert client.query.ordering == ("created_at", False)


def test_append_message_omits_unset_optional_fields(monkeypatch):
    client = _Client()
    client.query.rows = []
    monkeypatch.setattr("app.adapters.supabase_conversations.run_db", lambda fn: _await(fn()))
    row = asyncio.run(SupabaseConversationRepository(client).append_message(
        bot_id="b1", session_id="s1", role="assistant", content="ok", sender="ai"
    ))
    assert row["sender"] == "ai"
    assert "sender_name" not in row
    assert client.query.inserted["bot_id"] == "b1"


async def _await(value):
    return value
