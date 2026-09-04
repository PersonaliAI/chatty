"""Unit tests for app/routers/team.py — team-member invite/update and the
new per-member availability-rules endpoints. `team.py` calls the
module-level `supabase` singleton directly (not passed as a parameter, the
way plugins/agent_tools.py's handlers are), so these tests monkeypatch
`team.supabase` with a small chainable fake rather than a plain MagicMock.
"""
from __future__ import annotations

import asyncio
from types import SimpleNamespace
from typing import Any
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException

from app.routers import team
from app.schemas.team import AvailabilityRulesRequest, AvailabilityRule, TeamInviteRequest, TeamUpdateRequest


class _FakeQuery:
    """Mimics supabase-py's fluent query builder: every chained method
    (select/eq/order/limit/upsert/update/delete/insert) returns self, and
    `.execute()` pops the next queued result (a SimpleNamespace with a
    `.data` attribute) — set via `FakeSupabase.queue(...)` in call order."""

    def __init__(self, results: list[Any]):
        self._results = results

    def __getattr__(self, _name):
        def _chain(*_args, **_kwargs):
            return self
        return _chain

    def execute(self):
        return self._results.pop(0)


class FakeSupabase:
    def __init__(self):
        self._results: list[Any] = []

    def queue(self, data):
        self._results.append(SimpleNamespace(data=data))
        return self

    def table(self, _name):
        return _FakeQuery(self._results)


OWNER = {"auth_user_id": "owner-1", "email": "owner@example.com"}


def _patch_owner(monkeypatch, bot_id="bot-1"):
    """Fast-path verify_bot_permission by making get_bot_role_and_permissions
    resolve to 'owner' without hitting the fake DB."""
    monkeypatch.setattr(team, "verify_bot_permission", AsyncMock(return_value="owner"))


# ---------------------------------------------------------------------------
# invite_team — name now required
# ---------------------------------------------------------------------------


def test_invite_team_requires_name(monkeypatch):
    _patch_owner(monkeypatch)
    fake = FakeSupabase()
    monkeypatch.setattr(team, "supabase", fake)
    req = TeamInviteRequest(bot_id="bot-1", email="a@example.com", name="")
    with pytest.raises(HTTPException) as exc:
        asyncio.run(team.invite_team(req, OWNER))
    assert exc.value.status_code == 400
    assert "name" in exc.value.detail.lower()


def test_invite_team_upsert_payload_includes_name_phone(monkeypatch):
    _patch_owner(monkeypatch)
    upsert_calls = []

    class RecordingQuery(_FakeQuery):
        def upsert(self, payload, **kwargs):
            upsert_calls.append(payload)
            return self

    class RecordingSupabase(FakeSupabase):
        def table(self, name):
            return RecordingQuery(self._results)

    fake = RecordingSupabase()
    fake.queue(None)          # upsert().execute()
    fake.queue([{"name": "Acme Bot"}])  # bot name lookup
    monkeypatch.setattr(team, "supabase", fake)
    monkeypatch.setattr(team.notify, "build_team_invite_email_html", lambda **_: "<html/>")
    monkeypatch.setattr(team.notify, "deliver_email", AsyncMock(return_value="sent"))

    req = TeamInviteRequest(bot_id="bot-1", email="Jane@Example.com", name="  Jane Doe  ", phone=" 555-1234 ")
    result = asyncio.run(team.invite_team(req, OWNER))

    assert upsert_calls, "upsert was never called"
    payload = upsert_calls[0]
    assert payload["name"] == "Jane Doe"       # trimmed
    assert payload["phone"] == "555-1234"      # trimmed
    assert payload["email"] == "jane@example.com"  # lowercased
    assert result["name"] == "Jane Doe"
    assert result["email"] == "jane@example.com"


def test_invite_team_rejects_bad_email(monkeypatch):
    _patch_owner(monkeypatch)
    monkeypatch.setattr(team, "supabase", FakeSupabase())
    req = TeamInviteRequest(bot_id="bot-1", email="not-an-email", name="Jane")
    with pytest.raises(HTTPException) as exc:
        asyncio.run(team.invite_team(req, OWNER))
    assert exc.value.status_code == 400


# ---------------------------------------------------------------------------
# update_team — bookable / name / phone
# ---------------------------------------------------------------------------


def test_update_team_sets_bookable(monkeypatch):
    _patch_owner(monkeypatch)
    fake = FakeSupabase()
    fake.queue([{"role": "agent"}])  # existing-member lookup
    fake.queue(None)                 # update().execute()
    monkeypatch.setattr(team, "supabase", fake)

    req = TeamUpdateRequest(bot_id="bot-1", bookable=True)
    result = asyncio.run(team.update_team("member-1", req, OWNER))
    assert result["bookable"] is True


def test_update_team_sets_book_on_own_calendar(monkeypatch):
    _patch_owner(monkeypatch)
    fake = FakeSupabase()
    fake.queue([{"role": "agent"}])
    fake.queue(None)
    monkeypatch.setattr(team, "supabase", fake)

    req = TeamUpdateRequest(bot_id="bot-1", book_on_own_calendar=False)
    result = asyncio.run(team.update_team("member-1", req, OWNER))
    assert result["book_on_own_calendar"] is False


def test_update_team_rejects_empty_name(monkeypatch):
    _patch_owner(monkeypatch)
    fake = FakeSupabase()
    fake.queue([{"role": "agent"}])
    monkeypatch.setattr(team, "supabase", fake)

    req = TeamUpdateRequest(bot_id="bot-1", name="   ")
    with pytest.raises(HTTPException) as exc:
        asyncio.run(team.update_team("member-1", req, OWNER))
    assert exc.value.status_code == 400


def test_update_team_404_for_missing_member(monkeypatch):
    _patch_owner(monkeypatch)
    fake = FakeSupabase()
    fake.queue([])
    monkeypatch.setattr(team, "supabase", fake)

    req = TeamUpdateRequest(bot_id="bot-1", bookable=True)
    with pytest.raises(HTTPException) as exc:
        asyncio.run(team.update_team("ghost", req, OWNER))
    assert exc.value.status_code == 404


# ---------------------------------------------------------------------------
# availability rules — authorization
# ---------------------------------------------------------------------------


def test_get_availability_allows_self(monkeypatch):
    fake = FakeSupabase()
    fake.queue([{"id": "member-1", "email": "jane@example.com", "bot_id": "bot-1"}])
    fake.queue([{"day_of_week": 0, "start_minute": 540, "end_minute": 1020}])
    monkeypatch.setattr(team, "supabase", fake)
    # verify_bot_permission would raise if called for a non-owner — make sure
    # the self-service path never reaches it.
    monkeypatch.setattr(team, "verify_bot_permission", AsyncMock(side_effect=AssertionError("should not be called")))

    caller = {"auth_user_id": "u2", "email": "Jane@Example.com"}
    result = asyncio.run(team.get_availability("member-1", "bot-1", caller))
    assert result["rules"][0]["start_minute"] == 540


def test_get_availability_denies_other_member_without_team_permission(monkeypatch):
    fake = FakeSupabase()
    fake.queue([{"id": "member-1", "email": "jane@example.com", "bot_id": "bot-1"}])
    monkeypatch.setattr(team, "supabase", fake)
    monkeypatch.setattr(team, "verify_bot_permission", AsyncMock(side_effect=HTTPException(status_code=403, detail="nope")))

    caller = {"auth_user_id": "u3", "email": "someone-else@example.com"}
    with pytest.raises(HTTPException) as exc:
        asyncio.run(team.get_availability("member-1", "bot-1", caller))
    assert exc.value.status_code == 403


def test_get_availability_404_for_missing_member(monkeypatch):
    fake = FakeSupabase()
    fake.queue([])
    monkeypatch.setattr(team, "supabase", fake)
    with pytest.raises(HTTPException) as exc:
        asyncio.run(team.get_availability("ghost", "bot-1", OWNER))
    assert exc.value.status_code == 404


# ---------------------------------------------------------------------------
# availability rules — validation + replace-all semantics
# ---------------------------------------------------------------------------


def test_set_availability_rejects_invalid_range(monkeypatch):
    fake = FakeSupabase()
    fake.queue([{"id": "member-1", "email": "jane@example.com", "bot_id": "bot-1"}])
    monkeypatch.setattr(team, "supabase", fake)

    caller = {"auth_user_id": "u2", "email": "jane@example.com"}
    req = AvailabilityRulesRequest(bot_id="bot-1", rules=[AvailabilityRule(day_of_week=0, start_minute=600, end_minute=500)])
    with pytest.raises(HTTPException) as exc:
        asyncio.run(team.set_availability("member-1", req, caller))
    assert exc.value.status_code == 400


def test_set_availability_rejects_bad_day(monkeypatch):
    fake = FakeSupabase()
    fake.queue([{"id": "member-1", "email": "jane@example.com", "bot_id": "bot-1"}])
    monkeypatch.setattr(team, "supabase", fake)

    caller = {"auth_user_id": "u2", "email": "jane@example.com"}
    req = AvailabilityRulesRequest(bot_id="bot-1", rules=[AvailabilityRule(day_of_week=9, start_minute=0, end_minute=60)])
    with pytest.raises(HTTPException) as exc:
        asyncio.run(team.set_availability("member-1", req, caller))
    assert exc.value.status_code == 400


def test_set_availability_replaces_existing_rules(monkeypatch):
    delete_calls = []
    insert_calls = []

    class RecordingQuery(_FakeQuery):
        def delete(self, *a, **k):
            delete_calls.append(True)
            return self

        def insert(self, payload, **k):
            insert_calls.append(payload)
            return self

    class RecordingSupabase(FakeSupabase):
        def table(self, name):
            return RecordingQuery(self._results)

    fake = RecordingSupabase()
    fake.queue([{"id": "member-1", "email": "jane@example.com", "bot_id": "bot-1"}])  # member lookup
    fake.queue(None)  # delete().execute()
    fake.queue(None)  # insert().execute()
    monkeypatch.setattr(team, "supabase", fake)

    caller = {"auth_user_id": "u2", "email": "jane@example.com"}
    req = AvailabilityRulesRequest(bot_id="bot-1", rules=[
        AvailabilityRule(day_of_week=0, start_minute=540, end_minute=1020),
        AvailabilityRule(day_of_week=2, start_minute=540, end_minute=1020),
    ])
    result = asyncio.run(team.set_availability("member-1", req, caller))
    assert result["ok"] is True
    assert len(delete_calls) == 1
    assert len(insert_calls) == 1
    assert len(insert_calls[0]) == 2
    assert all(row["member_email"] == "jane@example.com" for row in insert_calls[0])


def test_set_availability_empty_rules_skips_insert(monkeypatch):
    insert_calls = []

    class RecordingQuery(_FakeQuery):
        def insert(self, payload, **k):
            insert_calls.append(payload)
            return self

    class RecordingSupabase(FakeSupabase):
        def table(self, name):
            return RecordingQuery(self._results)

    fake = RecordingSupabase()
    fake.queue([{"id": "member-1", "email": "jane@example.com", "bot_id": "bot-1"}])
    fake.queue(None)  # delete().execute()
    monkeypatch.setattr(team, "supabase", fake)

    caller = {"auth_user_id": "u2", "email": "jane@example.com"}
    req = AvailabilityRulesRequest(bot_id="bot-1", rules=[])
    result = asyncio.run(team.set_availability("member-1", req, caller))
    assert result["ok"] is True
    assert insert_calls == []
