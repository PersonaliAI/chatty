"""Integration tests against the real Supabase schema and the real
create_lead/conversation-history code paths — the exact class of test that
would have caught this session's two production incidents:
chatty_conversations was missing its `sender` column and chatty_leads was
missing `lat`/`lon`, so every write silently 400'd (PGRST204) while the
model kept narrating success. A unit test with a mocked DB client stays
green through a schema-drift bug like that; only a test against the real
schema catches it.

Skipped automatically unless real Supabase credentials are present.
tests/conftest.py deliberately stubs SUPABASE_URL to a fake host so the
rest of the suite runs in CI with zero real credentials — these tests
detect that stub and skip rather than fail on a DNS error. To actually run
them, export the real SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY from
env.yaml into the shell *before* pytest starts (conftest's
os.environ.setdefault is a no-op once the real values are already set),
e.g.:

    export SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=...
    python -m pytest tests/test_integration_live.py -v

Every row these tests write uses a `pytest-<uuid>` session_id and is
deleted in a finally block regardless of outcome, so a failed run can't
leave test data behind in the Leads/Inbox tabs.
"""
from __future__ import annotations

import asyncio
import os
import uuid

import httpx
import pytest

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
_LIVE = bool(SUPABASE_URL) and "example.supabase.co" not in SUPABASE_URL

pytestmark = pytest.mark.skipif(
    not _LIVE, reason="requires real Supabase credentials (conftest.py stubs a fake host by default)"
)

# The same bot used for manual runtime verification elsewhere in this
# project. Any bot works — this one is guaranteed to already exist.
_TEST_BOT_ID = "c8fa19c8-dd25-43a3-9c55-e8099e6f532e"

# Every column the live code writes on a normal request, per table. A column
# missing here means a real insert 400s in production — see PGRST204 in
# postgrest.exceptions.APIError — invisible to any test using a mocked client.
REQUIRED_COLUMNS = {
    "chatty_conversations": {"id", "bot_id", "session_id", "role", "content", "sender", "created_at"},
    "chatty_leads": {
        "id", "bot_id", "session_id", "name", "email", "phone", "company", "job_title",
        "country", "city", "region", "lat", "lon", "industry", "budget", "custom_fields", "created_at",
    },
}


def _headers(extra: dict | None = None) -> dict:
    h = {"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"}
    if extra:
        h.update(extra)
    return h


def test_schema_has_every_column_the_code_writes():
    r = httpx.get(f"{SUPABASE_URL}/rest/v1/", headers=_headers(), timeout=15)
    r.raise_for_status()
    definitions = r.json()["definitions"]
    problems = []
    for table, required in REQUIRED_COLUMNS.items():
        actual = set(definitions.get(table, {}).get("properties", {}).keys())
        missing = required - actual
        if missing:
            problems.append(f"{table} is missing: {sorted(missing)}")
    assert not problems, "Schema drift — " + "; ".join(problems)


def test_conversation_history_round_trip():
    session_id = f"pytest-{uuid.uuid4().hex[:12]}"
    try:
        for role, sender, content in [
            ("user", "visitor", "integration test message"),
            ("assistant", "ai", "integration test reply"),
        ]:
            r = httpx.post(
                f"{SUPABASE_URL}/rest/v1/chatty_conversations",
                headers=_headers({"Content-Type": "application/json", "Prefer": "return=representation"}),
                json={
                    "bot_id": _TEST_BOT_ID, "session_id": session_id,
                    "role": role, "content": content, "sender": sender,
                },
                timeout=15,
            )
            assert r.status_code == 201, r.text

        r = httpx.get(
            f"{SUPABASE_URL}/rest/v1/chatty_conversations",
            headers=_headers(),
            params={"bot_id": f"eq.{_TEST_BOT_ID}", "session_id": f"eq.{session_id}", "order": "created_at.asc"},
            timeout=15,
        )
        rows = r.json()
        assert [row["role"] for row in rows] == ["user", "assistant"], rows
        assert rows[0]["content"] == "integration test message"
        assert rows[1]["content"] == "integration test reply"
    finally:
        httpx.delete(
            f"{SUPABASE_URL}/rest/v1/chatty_conversations",
            headers=_headers(),
            params={"session_id": f"eq.{session_id}"},
            timeout=15,
        )


def test_create_lead_round_trip():
    from app.core.clients import supabase
    from plugins import agent_tools

    session_id = f"pytest-{uuid.uuid4().hex[:12]}"
    try:
        result = asyncio.run(agent_tools._create_lead(
            {
                "bot_id": _TEST_BOT_ID, "session_id": session_id, "name": "Integration Test",
                "email": "integration-test@example.com", "lat": 1.23, "lon": 4.56,
            },
            user={}, supabase=supabase,
        ))
        assert result.get("success") is True, result

        r = httpx.get(
            f"{SUPABASE_URL}/rest/v1/chatty_leads",
            headers=_headers(), params={"session_id": f"eq.{session_id}"}, timeout=15,
        )
        rows = r.json()
        assert len(rows) == 1, rows
        assert rows[0]["email"] == "integration-test@example.com"
        assert rows[0]["lat"] == 1.23
        assert rows[0]["lon"] == 4.56
    finally:
        httpx.delete(
            f"{SUPABASE_URL}/rest/v1/chatty_leads",
            headers=_headers(), params={"session_id": f"eq.{session_id}"}, timeout=15,
        )


def test_create_lead_collapses_a_doubled_value_before_it_reaches_the_database():
    """Reproduces the exact live incident: the model called create_lead with
    email="dup@example.comdup@example.com" — the value doubled back-to-back
    with no separator, an LLM generation artifact. Confirms the fix holds
    end-to-end through the real tool function and the real database, not
    just in isolation against _dedupe_doubled()."""
    from app.core.clients import supabase
    from plugins import agent_tools

    session_id = f"pytest-{uuid.uuid4().hex[:12]}"
    try:
        result = asyncio.run(agent_tools._create_lead(
            {"bot_id": _TEST_BOT_ID, "session_id": session_id, "email": "dup@example.comdup@example.com"},
            user={}, supabase=supabase,
        ))
        assert result.get("success") is True, result

        r = httpx.get(
            f"{SUPABASE_URL}/rest/v1/chatty_leads",
            headers=_headers(), params={"session_id": f"eq.{session_id}"}, timeout=15,
        )
        rows = r.json()
        assert rows[0]["email"] == "dup@example.com", rows
    finally:
        httpx.delete(
            f"{SUPABASE_URL}/rest/v1/chatty_leads",
            headers=_headers(), params={"session_id": f"eq.{session_id}"}, timeout=15,
        )
