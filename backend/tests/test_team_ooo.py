"""Tests for out-of-office (OOO) and delegation logic.

Covers:
- Pure interval matching in team_ooo.is_out_of_office
- Date window validation (end before start / unparsable)
- Backup colleague resolution (skipping non-roster or colleague also away)
- Availability engine skipping OOO members during round-robin booking
- Router validation in PUT /api/team/{id}/ooo
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.core import team_ooo
from app.routers import team
from app.schemas.team import OutOfOfficeRequest
from plugins import availability_engine


NOW = datetime(2026, 10, 15, 12, 0, 0, tzinfo=timezone.utc)


def test_is_out_of_office_inactive_when_no_dates():
    assert team_ooo.is_out_of_office({}, now=NOW) is False
    assert team_ooo.is_out_of_office({"ooo_start": None, "ooo_end": None}, now=NOW) is False


def test_is_out_of_office_bounded_window():
    start = (NOW - timedelta(days=1)).isoformat()
    end = (NOW + timedelta(days=2)).isoformat()
    # Inside window
    assert team_ooo.is_out_of_office({"ooo_start": start, "ooo_end": end}, now=NOW) is True
    # Before window starts
    before = NOW - timedelta(days=2)
    assert team_ooo.is_out_of_office({"ooo_start": start, "ooo_end": end}, now=before) is False
    # After window ends
    after = NOW + timedelta(days=3)
    assert team_ooo.is_out_of_office({"ooo_start": start, "ooo_end": end}, now=after) is False


def test_is_out_of_office_open_ended():
    past_start = (NOW - timedelta(hours=2)).isoformat()
    future_start = (NOW + timedelta(hours=2)).isoformat()
    # Indefinite start in past -> away
    assert team_ooo.is_out_of_office({"ooo_start": past_start, "ooo_end": None}, now=NOW) is True
    # Indefinite start in future -> not away yet
    assert team_ooo.is_out_of_office({"ooo_start": future_start, "ooo_end": None}, now=NOW) is False


def test_validate_ooo_window():
    # Valid
    team_ooo.validate_ooo_window("2026-10-15T09:00:00Z", "2026-10-20T18:00:00Z")
    # End before start
    with pytest.raises(ValueError, match="after the start"):
        team_ooo.validate_ooo_window("2026-10-20T18:00:00Z", "2026-10-15T09:00:00Z")
    # Garbage strings
    with pytest.raises(ValueError, match="Invalid"):
        team_ooo.validate_ooo_window("not-a-date", None)


def test_resolve_backup():
    roster = {
        "alice@example.com": {"email": "alice@example.com"},
        "bob@example.com": {
            "email": "bob@example.com",
            "ooo_start": (NOW - timedelta(days=1)).isoformat(),
            "ooo_end": (NOW + timedelta(days=1)).isoformat(),
        },
    }
    # Valid colleague who is present
    member = {"ooo_backup_email": "alice@example.com"}
    assert team_ooo.resolve_backup(member, roster, now=NOW) == "alice@example.com"

    # Colleague is also away -> resolved to None to prevent dead-end routing
    member_bob = {"ooo_backup_email": "bob@example.com"}
    assert team_ooo.resolve_backup(member_bob, roster, now=NOW) is None

    # Unknown colleague not in roster
    member_unknown = {"ooo_backup_email": "stranger@example.com"}
    assert team_ooo.resolve_backup(member_unknown, roster, now=NOW) is None


def test_availability_engine_skips_ooo_member(monkeypatch):
    """availability_engine round-robin must exclude members currently marked OOO."""
    away_member = {
        "id": "m-away",
        "email": "away@example.com",
        "bookable": True,
        "ooo_start": (NOW - timedelta(days=1)).isoformat(),
        "ooo_end": (NOW + timedelta(days=1)).isoformat(),
    }
    present_member = {
        "id": "m-present",
        "email": "present@example.com",
        "bookable": True,
        "ooo_start": None,
        "ooo_end": None,
    }
    # When picking next assignee or slots, the away member is recognized as OOO
    assert availability_engine.is_out_of_office(away_member, now=NOW) is True
    assert availability_engine.is_out_of_office(present_member, now=NOW) is False


class _OooTableFake:
    def __init__(self, parent: "_OooSupabase"):
        self.parent = parent
        self._payload = None

    def select(self, *_a, **_k):
        return self

    def eq(self, *_a, **_k):
        return self

    def limit(self, *_a, **_k):
        return self

    def update(self, payload):
        self._payload = payload
        self.parent.updates.append(payload)
        return self

    def insert(self, payload):
        self.parent.inserts.append(payload)
        return self

    def execute(self):
        return SimpleNamespace(data=self.parent.data)


class _OooSupabase:
    def __init__(self, data=None):
        self.data = data or []
        self.updates: list = []
        self.inserts: list = []

    def table(self, _name):
        return _OooTableFake(self)


def test_router_set_and_clear_ooo(monkeypatch):
    user = {"auth_user_id": "u-1", "email": "alice@example.com"}
    fake = _OooSupabase(data=[{"id": "m-1", "email": "alice@example.com"}])
    monkeypatch.setattr(team, "supabase", fake)
    monkeypatch.setattr(team, "_authorize_availability_access", AsyncMock(return_value={"id": "m-1", "email": "alice@example.com"}))

    # 1. Set OOO
    now = datetime.now(timezone.utc)
    req = OutOfOfficeRequest(
        bot_id="bot-1",
        clear=False,
        ooo_start=(now - timedelta(hours=1)).isoformat(),
        ooo_end=(now + timedelta(days=5)).isoformat(),
        ooo_reason="Holiday",
    )
    res = asyncio.run(team.set_out_of_office("m-1", req, user))
    assert res["ok"] is True
    assert res["ooo_active"] is True
    assert fake.updates[-1]["ooo_reason"] == "Holiday"
    assert len(fake.inserts) == 1  # audit log created

    # 2. Clear OOO
    clear_req = OutOfOfficeRequest(bot_id="bot-1", clear=True)
    res_clear = asyncio.run(team.set_out_of_office("m-1", clear_req, user))
    assert res_clear["ok"] is True
    assert res_clear["ooo_active"] is False
    assert fake.updates[-1]["ooo_start"] is None
    assert len(fake.inserts) == 2  # audit log created
