"""Unit tests for app/routers/admin.py's reschedule endpoint — the
owner-driven counterpart to plugins/agent_tools.py's widget-driven
reschedule_meeting tool. Both share reschedule_meeting_core; this file only
covers the endpoint's own lookup/auth/validation wrapper around it, not the
core logic itself (already covered in tests/test_agent_tools.py).
"""
from __future__ import annotations

import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException

import main  # noqa: F401 — must import before app.routers.admin: admin.py does
# `from main import _verify_bot_access, _verify_bot_owner`, and main.py in
# turn imports and registers admin's own router at module load — importing
# main first here avoids a circular partial-import when this test file is
# collected on its own (same reasoning as test_smoke.py's `import main`).
from app.routers import admin
from app.schemas.admin import RescheduleMeetingRequest

OWNER = {"auth_user_id": "owner-1", "email": "owner@example.com"}


def _admin_supabase(meeting_row, bot_row):
    supabase = MagicMock()

    def table(name):
        t = MagicMock()
        if name == "chatty_meetings":
            t.select.return_value.eq.return_value.execute.return_value = SimpleNamespace(
                data=[meeting_row] if meeting_row else [])
        elif name == "chatty_bots":
            t.select.return_value.eq.return_value.execute.return_value = SimpleNamespace(
                data=[bot_row] if bot_row else [])
        return t

    supabase.table.side_effect = table
    return supabase


def test_admin_reschedule_meeting_404_for_missing_meeting(monkeypatch):
    monkeypatch.setattr(admin, "supabase", _admin_supabase(None, None))
    req = RescheduleMeetingRequest(new_start="2026-06-25T10:00:00+00:00", new_end="2026-06-25T10:30:00+00:00")
    with pytest.raises(HTTPException) as exc:
        asyncio.run(admin.admin_reschedule_meeting("ghost", req, OWNER))
    assert exc.value.status_code == 404


def test_admin_reschedule_meeting_requires_ownership(monkeypatch):
    meeting = {"id": "meet-1", "bot_id": "bot-1"}
    monkeypatch.setattr(admin, "supabase", _admin_supabase(meeting, {"id": "bot-1"}))
    monkeypatch.setattr(admin, "_verify_meeting_access", AsyncMock(side_effect=HTTPException(status_code=403, detail="Unauthorized")))
    req = RescheduleMeetingRequest(new_start="2026-06-25T10:00:00+00:00", new_end="2026-06-25T10:30:00+00:00")
    with pytest.raises(HTTPException) as exc:
        asyncio.run(admin.admin_reschedule_meeting("meet-1", req, OWNER))
    assert exc.value.status_code == 403


def test_admin_reschedule_meeting_rejects_bad_datetime(monkeypatch):
    meeting = {"id": "meet-1", "bot_id": "bot-1"}
    monkeypatch.setattr(admin, "supabase", _admin_supabase(meeting, {"id": "bot-1"}))
    monkeypatch.setattr(admin, "_verify_meeting_access", AsyncMock(return_value="owner"))
    req = RescheduleMeetingRequest(new_start="garbage", new_end="also garbage")
    with pytest.raises(HTTPException) as exc:
        asyncio.run(admin.admin_reschedule_meeting("meet-1", req, OWNER))
    assert exc.value.status_code == 400


def test_admin_reschedule_meeting_rejects_end_before_start(monkeypatch):
    meeting = {"id": "meet-1", "bot_id": "bot-1"}
    monkeypatch.setattr(admin, "supabase", _admin_supabase(meeting, {"id": "bot-1"}))
    monkeypatch.setattr(admin, "_verify_meeting_access", AsyncMock(return_value="owner"))
    req = RescheduleMeetingRequest(new_start="2026-06-25T10:00:00+00:00", new_end="2026-06-25T09:00:00+00:00")
    with pytest.raises(HTTPException) as exc:
        asyncio.run(admin.admin_reschedule_meeting("meet-1", req, OWNER))
    assert exc.value.status_code == 400


def test_admin_reschedule_meeting_delegates_to_core(monkeypatch):
    meeting = {"id": "meet-1", "bot_id": "bot-1"}
    bot = {"id": "bot-1", "meeting_provider": "google_meet"}
    monkeypatch.setattr(admin, "supabase", _admin_supabase(meeting, bot))
    monkeypatch.setattr(admin, "_verify_meeting_access", AsyncMock(return_value="owner"))

    from plugins import agent_tools
    core_mock = AsyncMock(return_value={"success": True, "message": "Meeting rescheduled to 2026-06-25T10:00:00+00:00."})
    monkeypatch.setattr(agent_tools, "reschedule_meeting_core", core_mock)

    req = RescheduleMeetingRequest(new_start="2026-06-25T10:00:00+00:00", new_end="2026-06-25T10:30:00+00:00")
    result = asyncio.run(admin.admin_reschedule_meeting("meet-1", req, OWNER))

    assert result["success"] is True
    core_mock.assert_awaited_once()
    args, kwargs = core_mock.call_args
    assert args[0] == meeting
    assert args[3] == bot
    assert args[4] == "bot-1"
    assert kwargs["performed_by"] == "user"


def test_admin_reschedule_meeting_translates_core_error(monkeypatch):
    meeting = {"id": "meet-1", "bot_id": "bot-1"}
    bot = {"id": "bot-1", "meeting_provider": "google_meet"}
    monkeypatch.setattr(admin, "supabase", _admin_supabase(meeting, bot))
    monkeypatch.setattr(admin, "_verify_meeting_access", AsyncMock(return_value="owner"))

    from plugins import agent_tools
    monkeypatch.setattr(agent_tools, "reschedule_meeting_core", AsyncMock(return_value={"error": "That new time isn't available."}))

    req = RescheduleMeetingRequest(new_start="2026-06-25T10:00:00+00:00", new_end="2026-06-25T10:30:00+00:00")
    with pytest.raises(HTTPException) as exc:
        asyncio.run(admin.admin_reschedule_meeting("meet-1", req, OWNER))
    assert exc.value.status_code == 400
    assert "isn't available" in exc.value.detail


# ---------------------------------------------------------------------------
# admin_get_meetings — owner/admin see all, agent sees only their own
# ---------------------------------------------------------------------------


def _meetings_list_supabase(meetings):
    supabase = MagicMock()

    def table(name):
        t = MagicMock()
        if name == "chatty_meetings":
            eq_chain = t.select.return_value.eq.return_value
            eq_chain.order.return_value.execute.return_value = SimpleNamespace(data=meetings)
            eq_chain.eq.return_value.order.return_value.execute.return_value = SimpleNamespace(
                data=[m for m in meetings if m.get("assigned_to_email") == "agent@example.com"])
        return t

    supabase.table.side_effect = table
    return supabase


def test_admin_get_meetings_owner_sees_all(monkeypatch):
    meetings = [{"id": "m1", "assigned_to_email": "agent@example.com"}, {"id": "m2", "assigned_to_email": "owner@example.com"}]
    monkeypatch.setattr(admin, "supabase", _meetings_list_supabase(meetings))
    monkeypatch.setattr(admin, "verify_bot_permission", AsyncMock(return_value="owner"))
    result = asyncio.run(admin.admin_get_meetings("bot-1", OWNER))
    assert len(result["meetings"]) == 2


def test_admin_get_meetings_agent_sees_only_own(monkeypatch):
    meetings = [{"id": "m1", "assigned_to_email": "agent@example.com"}, {"id": "m2", "assigned_to_email": "owner@example.com"}]
    monkeypatch.setattr(admin, "supabase", _meetings_list_supabase(meetings))
    monkeypatch.setattr(admin, "verify_bot_permission", AsyncMock(return_value="agent"))
    agent_user = {"auth_user_id": "agent-1", "email": "agent@example.com"}
    result = asyncio.run(admin.admin_get_meetings("bot-1", agent_user))
    assert [m["id"] for m in result["meetings"]] == ["m1"]


def test_admin_get_meetings_denies_without_permission(monkeypatch):
    monkeypatch.setattr(admin, "supabase", MagicMock())
    monkeypatch.setattr(admin, "verify_bot_permission", AsyncMock(side_effect=HTTPException(status_code=403, detail="Unauthorized")))
    with pytest.raises(HTTPException) as exc:
        asyncio.run(admin.admin_get_meetings("bot-1", {"auth_user_id": "x", "email": "x@example.com"}))
    assert exc.value.status_code == 403


# ---------------------------------------------------------------------------
# admin_get_meeting_messages
# ---------------------------------------------------------------------------


def _messages_supabase(meeting_row, messages):
    supabase = MagicMock()

    def table(name):
        t = MagicMock()
        if name == "chatty_meetings":
            t.select.return_value.eq.return_value.execute.return_value = SimpleNamespace(
                data=[meeting_row] if meeting_row else [])
        elif name == "chatty_meeting_messages":
            t.select.return_value.eq.return_value.order.return_value.execute.return_value = SimpleNamespace(data=messages)
        return t

    supabase.table.side_effect = table
    return supabase


def test_admin_get_meeting_messages_404_for_missing_meeting(monkeypatch):
    monkeypatch.setattr(admin, "supabase", _messages_supabase(None, []))
    with pytest.raises(HTTPException) as exc:
        asyncio.run(admin.admin_get_meeting_messages("ghost", OWNER))
    assert exc.value.status_code == 404


def test_admin_get_meeting_messages_denies_agent_for_others_meeting(monkeypatch):
    meeting = {"bot_id": "bot-1", "assigned_to_email": "someone-else@example.com"}
    monkeypatch.setattr(admin, "supabase", _messages_supabase(meeting, []))
    monkeypatch.setattr(admin, "verify_bot_permission", AsyncMock(return_value="agent"))
    agent_user = {"auth_user_id": "agent-1", "email": "agent@example.com"}
    with pytest.raises(HTTPException) as exc:
        asyncio.run(admin.admin_get_meeting_messages("meet-1", agent_user))
    assert exc.value.status_code == 403


def test_admin_get_meeting_messages_returns_thread(monkeypatch):
    meeting = {"bot_id": "bot-1", "assigned_to_email": "owner@example.com"}
    messages = [{"id": "msg-1", "direction": "outbound"}, {"id": "msg-2", "direction": "inbound"}]
    monkeypatch.setattr(admin, "supabase", _messages_supabase(meeting, messages))
    monkeypatch.setattr(admin, "verify_bot_permission", AsyncMock(return_value="owner"))
    result = asyncio.run(admin.admin_get_meeting_messages("meet-1", OWNER))
    assert len(result["messages"]) == 2
