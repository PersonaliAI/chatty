"""Regression tests for team role/permission saving (PATCH /api/team/{id}).

Covers: permissions actually persist, the DB role-constraint fallback is
reported (not silently swallowed), and the audit trail records a readable diff.
"""
from __future__ import annotations

import asyncio
from types import SimpleNamespace
from typing import Any
from unittest.mock import AsyncMock

from app.routers import team
from app.schemas.team import TeamUpdateRequest

OWNER = {"auth_user_id": "owner-1", "email": "owner@example.com"}


class _TableFake:
    def __init__(self, parent: "TableAwareSupabase", name: str):
        self.parent, self.name = parent, name
        self._op: str | None = None
        self._payload: Any = None

    def select(self, *_a, **_k):
        self._op = "select"
        return self

    def insert(self, payload):
        self._op, self._payload = "insert", payload
        return self

    def update(self, payload):
        self._op, self._payload = "update", payload
        return self

    def __getattr__(self, _name):
        return lambda *a, **k: self

    def execute(self):
        p = self.parent
        if self._op == "insert":
            p.inserts.setdefault(self.name, []).append(self._payload)
            return SimpleNamespace(data=[self._payload])
        if self._op == "update":
            p.updates.setdefault(self.name, []).append(self._payload)
            if self.name == "chatty_team_members" and p.reject_role and self._payload.get("role") in p.reject_role:
                raise Exception('new row violates check constraint "chatty_team_members_role_check" (role)')
            return SimpleNamespace(data=[self._payload])
        return SimpleNamespace(data=p.rows.get(self.name, []))


class TableAwareSupabase:
    def __init__(self, rows=None, reject_role=()):
        self.rows = rows or {}
        self.reject_role = set(reject_role)
        self.inserts: dict[str, list] = {}
        self.updates: dict[str, list] = {}

    def table(self, name):
        return _TableFake(self, name)


def _setup(monkeypatch, *, reject_role=(), old_role="agent", old_perms=("inbox", "meetings")):
    monkeypatch.setattr(team, "verify_bot_permission", AsyncMock(return_value="owner"))
    fake = TableAwareSupabase(
        rows={"chatty_team_members": [{"role": old_role, "email": "emp@example.com", "permissions": list(old_perms)}]},
        reject_role=reject_role,
    )
    monkeypatch.setattr(team, "supabase", fake)
    return fake


def test_permissions_persist_and_are_returned(monkeypatch):
    fake = _setup(monkeypatch)
    req = TeamUpdateRequest(bot_id="bot-1", role="agent", permissions=["inbox", "sources"])
    out = asyncio.run(team.update_team("m-1", req, OWNER))
    assert out["ok"] is True
    assert out["permissions"] == ["inbox", "sources"]
    assert out["role_fallback"] is False
    assert fake.updates["chatty_team_members"][0]["permissions"] == ["inbox", "sources"]


def test_role_constraint_fallback_is_reported_and_permissions_kept(monkeypatch):
    fake = _setup(monkeypatch, reject_role={"editor"})
    req = TeamUpdateRequest(bot_id="bot-1", role="editor", permissions=["sources", "design", "inbox"])
    out = asyncio.run(team.update_team("m-1", req, OWNER))
    assert out["role_fallback"] is True
    assert out["role_requested"] == "editor"
    assert out["role"] == "admin"  # stored fallback until migration is applied
    assert out["permissions"] == ["sources", "design", "inbox"]
    # second write (the retry) carried the permissions through
    assert fake.updates["chatty_team_members"][-1]["permissions"] == ["sources", "design", "inbox"]


def test_audit_log_records_role_and_permission_diff(monkeypatch):
    fake = _setup(monkeypatch)
    req = TeamUpdateRequest(bot_id="bot-1", role="viewer", permissions=["inbox", "sources"])
    asyncio.run(team.update_team("m-1", req, OWNER))
    entry = fake.inserts["chatty_audit_logs"][0]
    assert entry["action"] == "team_member_updated"
    assert "role agent -> viewer" in entry["details"]
    assert "granted sources" in entry["details"]
    assert "revoked meetings" in entry["details"]
    assert "emp@example.com" in entry["details"]


def test_non_owner_cannot_grant_owner_only_tabs(monkeypatch):
    monkeypatch.setattr(team, "verify_bot_permission", AsyncMock(return_value="admin"))
    fake = TableAwareSupabase(rows={"chatty_team_members": [{"role": "agent", "email": "e@x.com", "permissions": ["inbox"]}]})
    monkeypatch.setattr(team, "supabase", fake)
    req = TeamUpdateRequest(bot_id="bot-1", role="agent", permissions=["inbox", "billing", "byok"])
    out = asyncio.run(team.update_team("m-1", req, OWNER))
    assert out["permissions"] == ["inbox"]
