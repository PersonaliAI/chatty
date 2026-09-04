"""Pure unit tests for plugins/agent_tools.py — the tool implementations the
widget's tool-calling loop dispatches to: calendar booking (Google + Outlook),
availability checks, lead capture, web search, and the `execute` dispatcher.

All Google/Microsoft/HTTP calls are mocked at the module boundary
(plugins.agent_tools.g / plugins.agent_tools.ms / httpx), matching the
convention in test_google_integrations.py/test_microsoft_integrations.py
(which already cover the HTTP layer beneath those modules).

`_dedupe_doubled` already has coverage in tests/test_unit.py — not repeated
here. `_process_widget_booking` is a ~200-line orchestration function; only
its main success/failure branches are covered, not every branch.
"""
from __future__ import annotations

import asyncio
import json
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest

from plugins import agent_tools as at


# ---------------------------------------------------------------------------
# _need_google / _need_microsoft
# ---------------------------------------------------------------------------


def test_need_google_returns_error_when_not_connected():
    err = at._need_google({})
    assert err is not None
    assert "Google not connected" in err["error"]


def test_need_google_returns_none_when_connected():
    assert at._need_google({"google_access_token": "tok"}) is None


def test_need_microsoft_returns_error_when_not_connected():
    err = at._need_microsoft({})
    assert err is not None
    assert "Microsoft not connected" in err["error"]


def test_need_microsoft_returns_none_when_connected_and_no_scope_required():
    assert at._need_microsoft({"microsoft_access_token": "tok"}) is None


def test_need_microsoft_errors_when_required_scope_missing():
    user = {"microsoft_access_token": "tok", "microsoft_scopes": "Mail.Read offline_access"}
    err = at._need_microsoft(user, required_scope="Calendars.ReadWrite")
    assert err is not None
    assert "Calendars.ReadWrite" in err["error"]


def test_need_microsoft_passes_when_required_scope_present():
    user = {"microsoft_access_token": "tok", "microsoft_scopes": "Mail.Read Calendars.ReadWrite"}
    assert at._need_microsoft(user, required_scope="Calendars.ReadWrite") is None


def test_need_microsoft_scope_check_is_case_insensitive():
    user = {"microsoft_access_token": "tok", "microsoft_scopes": "calendars.readwrite"}
    assert at._need_microsoft(user, required_scope="Calendars.ReadWrite") is None


# ---------------------------------------------------------------------------
# _parse_iso
# ---------------------------------------------------------------------------


def test_parse_iso_handles_offset():
    dt = at._parse_iso("2026-06-25T09:00:00+05:30")
    assert dt.year == 2026 and dt.month == 6 and dt.day == 25


def test_parse_iso_handles_z_suffix():
    dt = at._parse_iso("2026-06-25T09:00:00Z")
    assert dt.tzinfo is not None


def test_parse_iso_handles_space_separator():
    dt = at._parse_iso("2026-06-25 09:00:00")
    assert dt.hour == 9


def test_parse_iso_handles_date_only():
    dt = at._parse_iso("2026-06-25")
    assert dt == datetime(2026, 6, 25, 0, 0, 0)


def test_parse_iso_raises_on_empty():
    with pytest.raises(ValueError):
        at._parse_iso("")


def test_parse_iso_raises_on_garbage():
    with pytest.raises(ValueError):
        at._parse_iso("not-a-date")


# ---------------------------------------------------------------------------
# _create_calendar_event
# ---------------------------------------------------------------------------


def test_create_calendar_event_requires_google_connection():
    result = asyncio.run(at._create_calendar_event({"summary": "x", "start": "a", "end": "b"}, {}, MagicMock()))
    assert "error" in result
    assert "Google not connected" in result["error"]


def test_create_calendar_event_delegates_to_google_integrations(monkeypatch):
    create_mock = AsyncMock(return_value={"id": "evt1", "hangoutLink": "https://meet.google.com/abc"})
    monkeypatch.setattr(at.g, "create_calendar_event", create_mock)
    user = {"google_access_token": "tok"}
    args = {
        "summary": "Demo Meeting with Jane", "start": "2026-06-25T09:00:00",
        "end": "2026-06-25T09:30:00", "attendees": ["jane@example.com"],
        "_owner_timezone": "America/New_York",
    }
    result = asyncio.run(at._create_calendar_event(args, user, MagicMock()))
    assert result["id"] == "evt1"
    create_mock.assert_awaited_once()
    _, kwargs = create_mock.call_args
    assert kwargs["summary"] == "Demo Meeting with Jane"
    assert kwargs["attendees"] == ["jane@example.com"]
    assert kwargs["timezone_override"] == "America/New_York"


# ---------------------------------------------------------------------------
# _check_calendar_availability
# ---------------------------------------------------------------------------


def test_check_calendar_availability_requires_google_connection():
    result = asyncio.run(at._check_calendar_availability(
        {"start": "2026-06-25T09:00:00", "end": "2026-06-25T09:30:00"}, {}, MagicMock()))
    assert "Google not connected" in result["error"]


def test_check_calendar_availability_rejects_bad_datetimes():
    user = {"google_access_token": "tok"}
    result = asyncio.run(at._check_calendar_availability({"start": "garbage", "end": "also garbage"}, user, MagicMock()))
    assert "Invalid time format" in result["error"]


def test_check_calendar_availability_rejects_end_before_start():
    user = {"google_access_token": "tok"}
    args = {"start": "2026-06-25T10:00:00", "end": "2026-06-25T09:00:00"}
    result = asyncio.run(at._check_calendar_availability(args, user, MagicMock()))
    assert "end' must be after" in result["error"]


def test_check_calendar_availability_delegates_to_google_integrations(monkeypatch):
    check_mock = AsyncMock(return_value={"busy": []})
    monkeypatch.setattr(at.g, "check_calendar_availability", check_mock)
    user = {"google_access_token": "tok"}
    args = {"start": "2026-06-25T09:00:00", "end": "2026-06-25T09:30:00"}
    result = asyncio.run(at._check_calendar_availability(args, user, MagicMock()))
    assert result == {"busy": []}
    check_mock.assert_awaited_once()


def test_check_calendar_availability_reraises_not_connected(monkeypatch):
    monkeypatch.setattr(at.g, "check_calendar_availability", AsyncMock(side_effect=at.g.GoogleNotConnected()))
    user = {"google_access_token": "tok"}
    args = {"start": "2026-06-25T09:00:00", "end": "2026-06-25T09:30:00"}
    with pytest.raises(at.g.GoogleNotConnected):
        asyncio.run(at._check_calendar_availability(args, user, MagicMock()))


def test_check_calendar_availability_wraps_other_exceptions(monkeypatch):
    monkeypatch.setattr(at.g, "check_calendar_availability", AsyncMock(side_effect=RuntimeError("boom")))
    user = {"google_access_token": "tok"}
    args = {"start": "2026-06-25T09:00:00", "end": "2026-06-25T09:30:00"}
    result = asyncio.run(at._check_calendar_availability(args, user, MagicMock()))
    assert "availability check failed" in result["error"]


# ---------------------------------------------------------------------------
# _get_available_slots — delegates to the team-aware engine functions
# ---------------------------------------------------------------------------


def test_get_available_slots_requires_bot_in_context():
    result = asyncio.run(at._get_available_slots({}, {}, MagicMock(), context={}))
    assert "Scheduling isn't configured" in result["error"]


def test_get_available_slots_no_bookable_members_returns_connection_error(monkeypatch):
    from plugins import availability_engine as avail
    monkeypatch.setattr(avail, "get_bookable_members", AsyncMock(return_value=[]))
    user = {}  # no google_access_token
    context = {"bot": {"meeting_provider": "google_meet"}, "bot_id": "bot-1"}
    result = asyncio.run(at._get_available_slots({}, user, MagicMock(), context=context))
    assert "Google not connected" in result["error"]


def test_get_available_slots_delegates_to_team_engine(monkeypatch):
    from plugins import availability_engine as avail
    members = [{"email": "a@example.com", "user": {}, "use_ms_calendar": False}]
    monkeypatch.setattr(avail, "get_bookable_members", AsyncMock(return_value=members))
    team_mock = AsyncMock(return_value=[{"start": "2026-01-05T09:00:00Z", "end": "2026-01-05T09:30:00Z"}])
    monkeypatch.setattr(avail, "get_team_available_slots", team_mock)

    context = {"bot": {"meeting_provider": "google_meet"}, "bot_id": "bot-1"}
    result = asyncio.run(at._get_available_slots({}, {"google_access_token": "tok"}, MagicMock(), context=context))
    assert result["slots"][0]["start"] == "2026-01-05T09:00:00Z"
    team_mock.assert_awaited_once()
    _, kwargs = team_mock.call_args
    assert kwargs["members"] == members


def test_get_available_slots_empty_returns_helpful_message(monkeypatch):
    from plugins import availability_engine as avail
    monkeypatch.setattr(avail, "get_bookable_members", AsyncMock(return_value=[{"email": "a@example.com", "user": {}, "use_ms_calendar": False}]))
    monkeypatch.setattr(avail, "get_team_available_slots", AsyncMock(return_value=[]))
    context = {"bot": {"meeting_provider": "google_meet"}, "bot_id": "bot-1"}
    result = asyncio.run(at._get_available_slots({}, {"google_access_token": "tok"}, MagicMock(), context=context))
    assert result["slots"] == []
    assert "fully booked" in result["message"]


# ---------------------------------------------------------------------------
# _reschedule_meeting
# ---------------------------------------------------------------------------


def _reschedule_supabase(meeting_row, users_row=None):
    """A MagicMock supabase whose chatty_meetings select returns `meeting_row`
    (or none if falsy), and whose users select (for host resolution) returns
    `users_row` if given."""
    supabase = MagicMock()

    def table(name):
        t = MagicMock()
        if name == "chatty_meetings":
            t.select.return_value.eq.return_value.eq.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value = \
                MagicMock(data=[meeting_row] if meeting_row else [])
            t.update.return_value.eq.return_value.execute.return_value = MagicMock()
        elif name == "users":
            # _resolve_meeting_host uses .ilike("email", ...); the admin
            # owner-email lookup uses .eq("auth_user_id", ...) — support both.
            t.select.return_value.ilike.return_value.limit.return_value.execute.return_value = MagicMock(
                data=[users_row] if users_row else [])
            t.select.return_value.eq.return_value.limit.return_value.execute.return_value = MagicMock(data=[])
        elif name in ("chatty_audit_logs", "chatty_notifications"):
            t.insert.return_value.execute.return_value = MagicMock()
        return t

    supabase.table.side_effect = table
    return supabase


# ---------------------------------------------------------------------------
# _meeting_reply_to / _log_meeting_message
# ---------------------------------------------------------------------------


def test_meeting_reply_to_none_when_domain_unconfigured(monkeypatch):
    monkeypatch.setattr(at, "RESEND_INBOUND_DOMAIN", "")
    assert at._meeting_reply_to("meet-1") is None


def test_meeting_reply_to_none_without_meeting_id(monkeypatch):
    monkeypatch.setattr(at, "RESEND_INBOUND_DOMAIN", "meetings.example.com")
    assert at._meeting_reply_to("") is None


def test_meeting_reply_to_builds_address(monkeypatch):
    monkeypatch.setattr(at, "RESEND_INBOUND_DOMAIN", "meetings.example.com")
    assert at._meeting_reply_to("meet-1") == "meeting+meet-1@meetings.example.com"


def test_log_meeting_message_inserts_row():
    supabase = MagicMock()
    captured = {}

    def do_insert(payload):
        captured.update(payload)
        m = MagicMock()
        m.execute.return_value = MagicMock()
        return m
    supabase.table.return_value.insert.side_effect = do_insert

    asyncio.run(at._log_meeting_message(supabase, "meet-1", direction="outbound",
                                         from_email="chatty@example.com", subject="s", body_text="b"))
    assert captured["meeting_id"] == "meet-1"
    assert captured["direction"] == "outbound"
    assert captured["from_email"] == "chatty@example.com"


def test_log_meeting_message_noop_without_meeting_id():
    supabase = MagicMock()
    asyncio.run(at._log_meeting_message(supabase, "", direction="outbound", from_email="a@example.com"))
    supabase.table.assert_not_called()


def test_log_meeting_message_swallows_exceptions():
    supabase = MagicMock()
    supabase.table.side_effect = RuntimeError("db exploded")
    # Should not raise.
    asyncio.run(at._log_meeting_message(supabase, "meet-1", direction="outbound", from_email="a@example.com"))


def test_reschedule_meeting_requires_bot_in_context():
    result = asyncio.run(at._reschedule_meeting({}, {}, MagicMock(), context={}))
    assert "Scheduling isn't configured" in result["error"]


def test_reschedule_meeting_requires_visitor_email():
    context = {"bot": {"meeting_provider": "google_meet"}, "bot_id": "bot-1"}
    result = asyncio.run(at._reschedule_meeting({}, {}, MagicMock(), context=context))
    assert "visitor_email is required" in result["error"]


def test_reschedule_meeting_rejects_bad_datetimes():
    context = {"bot": {"meeting_provider": "google_meet"}, "bot_id": "bot-1"}
    args = {"visitor_email": "jane@example.com", "new_start": "garbage", "new_end": "also garbage"}
    result = asyncio.run(at._reschedule_meeting(args, {}, MagicMock(), context=context))
    assert "Invalid new_start" in result["error"]


def test_reschedule_meeting_rejects_end_before_start():
    context = {"bot": {"meeting_provider": "google_meet"}, "bot_id": "bot-1"}
    args = {"visitor_email": "jane@example.com", "new_start": "2026-06-25T10:00:00+00:00", "new_end": "2026-06-25T09:00:00+00:00"}
    result = asyncio.run(at._reschedule_meeting(args, {}, MagicMock(), context=context))
    assert "new_end must be after new_start" in result["error"]


def test_reschedule_meeting_no_existing_booking():
    supabase = _reschedule_supabase(meeting_row=None)
    context = {"bot": {"meeting_provider": "google_meet"}, "bot_id": "bot-1"}
    args = {"visitor_email": "jane@example.com", "new_start": "2026-06-25T10:00:00+00:00", "new_end": "2026-06-25T10:30:00+00:00"}
    result = asyncio.run(at._reschedule_meeting(args, {"email": "owner@example.com"}, supabase, context=context))
    assert "No upcoming booking found" in result["error"]


def test_reschedule_meeting_without_provider_event_id_rejected():
    meeting = {"id": "meet-1", "attendee_email": "jane@example.com"}  # no provider_event_id
    supabase = _reschedule_supabase(meeting_row=meeting)
    context = {"bot": {"meeting_provider": "google_meet"}, "bot_id": "bot-1"}
    args = {"visitor_email": "jane@example.com", "new_start": "2026-06-25T10:00:00+00:00", "new_end": "2026-06-25T10:30:00+00:00"}
    result = asyncio.run(at._reschedule_meeting(args, {"email": "owner@example.com"}, supabase, context=context))
    assert "can't be rescheduled automatically" in result["error"]


def test_reschedule_meeting_rejects_when_new_slot_unavailable(monkeypatch):
    from plugins import availability_engine as avail
    meeting = {"id": "meet-1", "attendee_email": "jane@example.com", "provider_event_id": "evt-1", "assigned_to_email": ""}
    supabase = _reschedule_supabase(meeting_row=meeting)
    monkeypatch.setattr(avail, "is_slot_available", AsyncMock(return_value=False))
    context = {"bot": {"meeting_provider": "google_meet"}, "bot_id": "bot-1"}
    args = {"visitor_email": "jane@example.com", "new_start": "2026-06-25T10:00:00+00:00", "new_end": "2026-06-25T10:30:00+00:00"}
    result = asyncio.run(at._reschedule_meeting(args, {"email": "owner@example.com"}, supabase, context=context))
    assert "isn't available" in result["error"]


def test_reschedule_meeting_success_updates_calendar_and_row(monkeypatch):
    from plugins import availability_engine as avail
    meeting = {
        "id": "meet-1", "attendee_email": "jane@example.com", "attendee_name": "Jane",
        "provider_event_id": "evt-1", "assigned_to_email": "", "title": "Demo Meeting with Jane",
        "meeting_link": "https://meet.google.com/abc", "provider": "google_meet",
    }
    supabase = _reschedule_supabase(meeting_row=meeting)
    monkeypatch.setattr(avail, "is_slot_available", AsyncMock(return_value=True))
    update_mock = AsyncMock(return_value={"id": "evt-1"})
    monkeypatch.setattr(at.g, "update_calendar_event", update_mock)
    monkeypatch.setattr(at.notify, "build_client_email_html", MagicMock(return_value="<html/>"))
    monkeypatch.setattr(at.notify, "build_admin_email_html", MagicMock(return_value="<html/>"))
    monkeypatch.setattr(at.notify, "deliver_email", AsyncMock(return_value="sent"))

    context = {"bot": {"meeting_provider": "google_meet", "bot_timezone": "UTC"}, "bot_id": "bot-1"}
    args = {"visitor_email": "jane@example.com", "new_start": "2026-06-25T10:00:00+00:00", "new_end": "2026-06-25T10:30:00+00:00"}
    result = asyncio.run(at._reschedule_meeting(args, {"email": "owner@example.com", "auth_user_id": "owner-1"}, supabase, context=context))

    assert result["success"] is True
    update_mock.assert_awaited_once()
    _, kwargs = update_mock.call_args
    assert kwargs["event_id"] == "evt-1"


def test_reschedule_meeting_uses_assigned_host_credentials(monkeypatch):
    """When the meeting was assigned to a round-robin teammate, the PATCH
    must use THEIR calendar credentials, not the caller's."""
    from plugins import availability_engine as avail
    meeting = {
        "id": "meet-1", "attendee_email": "jane@example.com", "attendee_name": "Jane",
        "provider_event_id": "evt-1", "assigned_to_email": "teammate@example.com",
        "title": "Demo Meeting with Jane", "meeting_link": "https://meet.google.com/abc", "provider": "google_meet",
    }
    teammate_user = {"email": "teammate@example.com", "google_access_token": "teammate-tok"}
    supabase = _reschedule_supabase(meeting_row=meeting, users_row=teammate_user)
    monkeypatch.setattr(avail, "is_slot_available", AsyncMock(return_value=True))
    update_mock = AsyncMock(return_value={"id": "evt-1"})
    monkeypatch.setattr(at.g, "update_calendar_event", update_mock)
    monkeypatch.setattr(at.notify, "build_client_email_html", MagicMock(return_value="<html/>"))
    monkeypatch.setattr(at.notify, "build_admin_email_html", MagicMock(return_value="<html/>"))
    monkeypatch.setattr(at.notify, "deliver_email", AsyncMock(return_value="sent"))

    context = {"bot": {"meeting_provider": "google_meet", "bot_timezone": "UTC"}, "bot_id": "bot-1"}
    args = {"visitor_email": "jane@example.com", "new_start": "2026-06-25T10:00:00+00:00", "new_end": "2026-06-25T10:30:00+00:00"}
    caller = {"email": "owner@example.com", "auth_user_id": "owner-1"}
    asyncio.run(at._reschedule_meeting(args, caller, supabase, context=context))

    call_args, _ = update_mock.call_args
    assert call_args[1] == teammate_user  # the `user` positional arg to g.update_calendar_event


# ---------------------------------------------------------------------------
# handle_meeting_email_reply — email-based reschedule conversation
# ---------------------------------------------------------------------------


def _email_agent_supabase(bot, thread, owner=None, host=None):
    supabase = MagicMock()
    captured_inserts = []

    def table(name):
        t = MagicMock()
        if name == "chatty_bots":
            t.select.return_value.eq.return_value.execute.return_value = MagicMock(data=[bot] if bot else [])
        elif name == "chatty_meeting_messages":
            t.select.return_value.eq.return_value.order.return_value.execute.return_value = MagicMock(data=thread)

            def do_insert(payload):
                captured_inserts.append(payload)
                m = MagicMock()
                m.execute.return_value = MagicMock()
                return m
            t.insert.side_effect = do_insert
        elif name == "users":
            if owner is not None:
                t.select.return_value.eq.return_value.execute.return_value = MagicMock(data=[owner])
            if host is not None:
                t.select.return_value.ilike.return_value.limit.return_value.execute.return_value = MagicMock(data=[host])
        return t

    supabase.table.side_effect = table
    supabase._captured_inserts = captured_inserts  # test-only escape hatch
    return supabase


_BOT = {
    "id": "bot-1", "user_id": "owner-auth-1", "calendar_scheduling_enabled": True,
    "meeting_provider": "google_meet", "bot_timezone": "UTC", "name": "Acme Bot",
}
_OWNER = {"auth_user_id": "owner-auth-1", "email": "owner@example.com", "google_access_token": "owner-tok"}
_MEETING = {
    "id": "meet-1", "bot_id": "bot-1", "title": "Demo Meeting with Jane",
    "attendee_email": "jane@example.com", "attendee_name": "Jane",
    "start_time": "2026-06-25T09:00:00+00:00", "assigned_to_email": "",
}


def test_handle_meeting_email_reply_noop_without_ids():
    supabase = MagicMock()
    asyncio.run(at.handle_meeting_email_reply(supabase, {}, "visitor@example.com"))
    supabase.table.assert_not_called()


def test_handle_meeting_email_reply_skips_when_scheduling_disabled(monkeypatch):
    from plugins import ai_client
    bot = {**_BOT, "calendar_scheduling_enabled": False}
    supabase = _email_agent_supabase(bot, [])
    stream_mock = AsyncMock()
    monkeypatch.setattr(ai_client, "chat_stream", stream_mock)
    asyncio.run(at.handle_meeting_email_reply(supabase, _MEETING, "jane@example.com"))
    stream_mock.assert_not_awaited()


def test_handle_meeting_email_reply_skips_when_thread_too_long(monkeypatch):
    from plugins import ai_client
    long_thread = [{"direction": "inbound", "body_text": "hi"} for _ in range(at._MAX_EMAIL_THREAD_MESSAGES + 1)]
    supabase = _email_agent_supabase(_BOT, long_thread)
    stream_mock = AsyncMock()
    monkeypatch.setattr(ai_client, "chat_stream", stream_mock)
    asyncio.run(at.handle_meeting_email_reply(supabase, _MEETING, "jane@example.com"))
    stream_mock.assert_not_awaited()


def test_handle_meeting_email_reply_sends_reply_when_no_tool_call(monkeypatch):
    from plugins import ai_client
    supabase = _email_agent_supabase(_BOT, [], owner=_OWNER)
    monkeypatch.setattr(ai_client, "chat_stream", AsyncMock(return_value={
        "text": "Sure, 3pm works — you're all set to keep the original time.",
        "tool_calls": [], "message": {"role": "assistant", "content": "..."},
    }))
    deliver_mock = AsyncMock(return_value="sent")
    monkeypatch.setattr(at.notify, "deliver_email", deliver_mock)

    asyncio.run(at.handle_meeting_email_reply(supabase, _MEETING, "jane@example.com"))

    deliver_mock.assert_awaited_once()
    _, kwargs = deliver_mock.call_args
    assert kwargs["to"] == "jane@example.com"
    assert "3pm works" in kwargs["html"]
    # Logged as an outbound meeting message.
    outbound = [p for p in supabase._captured_inserts if p.get("direction") == "outbound"]
    assert len(outbound) == 1
    assert "3pm works" in outbound[0]["body_text"]


def test_handle_meeting_email_reply_calls_get_available_slots(monkeypatch):
    from plugins import ai_client
    supabase = _email_agent_supabase(_BOT, [], owner=_OWNER)

    call_log = []

    async def fake_chat_stream(**kwargs):
        if not call_log:
            call_log.append(1)
            return {
                "tool_calls": [{"id": "tc1", "type": "function", "function": {"name": "get_available_slots", "arguments": "{}"}}],
                "text": "", "message": {"role": "assistant", "tool_calls": [
                    {"id": "tc1", "type": "function", "function": {"name": "get_available_slots", "arguments": "{}"}}
                ]},
            }
        return {"text": "Here are a few options: ...", "tool_calls": [], "message": {"role": "assistant", "content": "..."}}
    monkeypatch.setattr(ai_client, "chat_stream", fake_chat_stream)

    slots_mock = AsyncMock(return_value={"slots": [{"start": "2026-06-26T15:00:00Z", "end": "2026-06-26T15:30:00Z"}]})
    monkeypatch.setattr(at, "_get_available_slots", slots_mock)
    monkeypatch.setattr(at.notify, "deliver_email", AsyncMock(return_value="sent"))

    asyncio.run(at.handle_meeting_email_reply(supabase, _MEETING, "jane@example.com"))
    slots_mock.assert_awaited_once()


def test_handle_meeting_email_reply_confirms_reschedule(monkeypatch):
    from plugins import ai_client
    supabase = _email_agent_supabase(_BOT, [], owner=_OWNER)

    call_log = []

    async def fake_chat_stream(**kwargs):
        if not call_log:
            call_log.append(1)
            args = json.dumps({"new_start": "2026-06-26T15:00:00+00:00", "new_end": "2026-06-26T15:30:00+00:00"})
            return {
                "tool_calls": [{"id": "tc1", "type": "function", "function": {"name": "confirm_reschedule", "arguments": args}}],
                "text": "", "message": {"role": "assistant", "tool_calls": [
                    {"id": "tc1", "type": "function", "function": {"name": "confirm_reschedule", "arguments": args}}
                ]},
            }
        return {"text": "Great, you're rebooked for 3pm tomorrow!", "tool_calls": [], "message": {"role": "assistant", "content": "..."}}
    monkeypatch.setattr(ai_client, "chat_stream", fake_chat_stream)

    core_mock = AsyncMock(return_value={"success": True, "message": "rescheduled"})
    monkeypatch.setattr(at, "reschedule_meeting_core", core_mock)
    monkeypatch.setattr(at.notify, "deliver_email", AsyncMock(return_value="sent"))

    asyncio.run(at.handle_meeting_email_reply(supabase, _MEETING, "jane@example.com"))

    core_mock.assert_awaited_once()
    call_args, kwargs = core_mock.call_args
    assert call_args[0] == _MEETING
    assert kwargs["performed_by"] == "visitor_email"


def test_handle_meeting_email_reply_swallows_exceptions():
    supabase = MagicMock()
    supabase.table.side_effect = RuntimeError("db exploded")
    # Should not raise.
    asyncio.run(at.handle_meeting_email_reply(supabase, _MEETING, "jane@example.com"))


# ---------------------------------------------------------------------------
# _list_outlook_events / _create_outlook_event
# ---------------------------------------------------------------------------


def test_list_outlook_events_requires_microsoft_connection():
    result = asyncio.run(at._list_outlook_events({}, {}, MagicMock()))
    assert "Microsoft not connected" in result["error"]


def test_list_outlook_events_delegates_to_microsoft_integrations(monkeypatch):
    list_mock = AsyncMock(return_value=[{"id": "e1"}])
    monkeypatch.setattr(at.ms, "list_outlook_events", list_mock)
    user = {"microsoft_access_token": "tok", "microsoft_scopes": "Calendars.ReadWrite"}
    result = asyncio.run(at._list_outlook_events({"days_ahead": 3, "limit": 10}, user, MagicMock()))
    assert result == {"events": [{"id": "e1"}]}
    list_mock.assert_awaited_once()
    _, kwargs = list_mock.call_args
    assert kwargs["limit"] == 10


def test_list_outlook_events_clamps_days_ahead(monkeypatch):
    list_mock = AsyncMock(return_value=[])
    monkeypatch.setattr(at.ms, "list_outlook_events", list_mock)
    user = {"microsoft_access_token": "tok", "microsoft_scopes": "Calendars.ReadWrite"}
    asyncio.run(at._list_outlook_events({"days_ahead": 9999}, user, MagicMock()))
    _, kwargs = list_mock.call_args
    delta = kwargs["time_max"] - kwargs["time_min"]
    assert delta.days <= 62  # clamped to <=60 days ahead plus the 2hr lookback


def test_create_outlook_event_requires_microsoft_connection():
    result = asyncio.run(at._create_outlook_event({"subject": "x", "start": "a", "end": "b"}, {}, MagicMock()))
    assert "Microsoft not connected" in result["error"]


def test_create_outlook_event_delegates_to_microsoft_integrations(monkeypatch):
    create_mock = AsyncMock(return_value={"id": "evt1", "online_meeting_url": "https://teams.microsoft.com/1"})
    monkeypatch.setattr(at.ms, "create_outlook_event", create_mock)
    user = {"microsoft_access_token": "tok", "microsoft_scopes": "Calendars.ReadWrite"}
    args = {
        "subject": "Demo Meeting with Bob", "start": "2026-06-25T09:00:00",
        "end": "2026-06-25T09:30:00", "attendees": ["bob@example.com"],
        "online_meeting": True, "_owner_timezone": "UTC",
    }
    result = asyncio.run(at._create_outlook_event(args, user, MagicMock()))
    assert result["id"] == "evt1"
    _, kwargs = create_mock.call_args
    assert kwargs["subject"] == "Demo Meeting with Bob"
    assert kwargs["online_meeting"] is True
    assert kwargs["timezone_override"] == "UTC"


# ---------------------------------------------------------------------------
# _create_lead — mocked at the supabase boundary
# ---------------------------------------------------------------------------


def _supabase_for_insert(insert_return_data):
    """Build a MagicMock supabase client where select().eq()...execute()
    returns no existing rows (fresh lead) and insert(...).execute() returns
    the given row(s)."""
    supabase = MagicMock()

    select_result = MagicMock()
    select_result.data = []
    select_chain = MagicMock()
    select_chain.eq.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value = select_result

    insert_result = MagicMock()
    insert_result.data = insert_return_data
    insert_chain = MagicMock()
    insert_chain.execute.return_value = insert_result

    def table(name):
        t = MagicMock()
        t.select.return_value = select_chain
        t.insert.return_value = insert_chain
        return t

    supabase.table.side_effect = table
    return supabase


def test_create_lead_requires_bot_id():
    result = asyncio.run(at._create_lead({"name": "Jane"}, {}, MagicMock()))
    assert result == {"error": "bot_id required"}


def test_create_lead_inserts_new_lead_and_returns_success(monkeypatch):
    # Matches the shape asserted by test_integration_live.py's live round-trip:
    # {"success": True, "lead_id": ..., "message": ...} on a fresh insert.
    monkeypatch.setattr(at.notify, "deliver_webhook", AsyncMock())
    monkeypatch.setattr(at.notify, "enqueue_webhook_event", AsyncMock())
    supabase = _supabase_for_insert([{"id": "lead-123"}])
    # bot webhook lookup (chatty_bots select) — reuse a plain empty result.
    bots_result = MagicMock()
    bots_result.data = [{"webhook_url": None}]

    def table(name):
        if name == "chatty_bots":
            t = MagicMock()
            t.select.return_value.eq.return_value.execute.return_value = bots_result
            return t
        if name == "chatty_leads":
            t = MagicMock()
            select_result = MagicMock()
            select_result.data = []
            t.select.return_value.eq.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value = select_result
            insert_result = MagicMock()
            insert_result.data = [{"id": "lead-123"}]
            t.insert.return_value.execute.return_value = insert_result
            return t
        if name == "chatty_audit_logs":
            t = MagicMock()
            t.insert.return_value.execute.return_value = MagicMock()
            return t
        return MagicMock()

    supabase.table.side_effect = table

    args = {"bot_id": "bot1", "session_id": "sess1", "name": "Integration Test", "email": "integration-test@example.com"}
    result = asyncio.run(at._create_lead(args, {}, supabase))
    assert result["success"] is True
    assert result["lead_id"] == "lead-123"


def test_create_lead_deduplicates_by_collapsing_a_doubled_value(monkeypatch):
    # Reproduces the incident test_integration_live.py verifies live: the
    # model emitted the value doubled with no separator.
    monkeypatch.setattr(at.notify, "deliver_webhook", AsyncMock())
    monkeypatch.setattr(at.notify, "enqueue_webhook_event", AsyncMock())

    def table(name):
        if name == "chatty_bots":
            t = MagicMock()
            t.select.return_value.eq.return_value.execute.return_value = MagicMock(data=[{"webhook_url": None}])
            return t
        if name == "chatty_leads":
            t = MagicMock()
            t.select.return_value.eq.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value = MagicMock(data=[])
            captured = {}

            def insert(data):
                captured["data"] = data
                m = MagicMock()
                m.execute.return_value = MagicMock(data=[{"id": "lead-1"}])
                return m
            t.insert.side_effect = insert
            t._captured = captured
            return t
        if name == "chatty_audit_logs":
            t = MagicMock()
            t.insert.return_value.execute.return_value = MagicMock()
            return t
        return MagicMock()

    supabase = MagicMock()
    tables = {}

    def table_wrap(name):
        if name not in tables:
            tables[name] = table(name)
        return tables[name]
    supabase.table.side_effect = table_wrap

    args = {"bot_id": "bot1", "session_id": "sess2", "email": "dup@example.comdup@example.com"}
    result = asyncio.run(at._create_lead(args, {}, supabase))
    assert result["success"] is True
    assert tables["chatty_leads"]._captured["data"]["email"] == "dup@example.com"


def test_create_lead_merges_into_existing_session_lead(monkeypatch):
    monkeypatch.setattr(at.notify, "deliver_webhook", AsyncMock())
    monkeypatch.setattr(at.notify, "enqueue_webhook_event", AsyncMock())
    supabase = MagicMock()
    existing = {"id": "lead-existing", "custom_fields": {}}

    def table(name):
        t = MagicMock()
        if name == "chatty_leads":
            t.select.return_value.eq.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value = MagicMock(data=[existing])
            t.update.return_value.eq.return_value.execute.return_value = MagicMock()
        return t

    supabase.table.side_effect = table
    args = {"bot_id": "bot1", "session_id": "sess3", "phone": "555-1234"}
    result = asyncio.run(at._create_lead(args, {}, supabase))
    assert result == {"success": True, "lead_id": "lead-existing", "message": "Lead updated"}


def test_create_lead_returns_error_when_insert_fails(monkeypatch):
    monkeypatch.setattr(at.notify, "deliver_webhook", AsyncMock())
    monkeypatch.setattr(at.notify, "enqueue_webhook_event", AsyncMock())
    supabase = MagicMock()

    def table(name):
        t = MagicMock()
        if name == "chatty_leads":
            t.select.return_value.eq.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value = MagicMock(data=[])
            t.insert.return_value.execute.return_value = MagicMock(data=None)
        return t

    supabase.table.side_effect = table
    args = {"bot_id": "bot1", "name": "Jane"}
    result = asyncio.run(at._create_lead(args, {}, supabase))
    assert result == {"error": "Failed to create lead"}


def test_create_lead_catches_unexpected_exceptions(monkeypatch):
    supabase = MagicMock()

    def table(name):
        raise RuntimeError("db unreachable")

    supabase.table.side_effect = table
    args = {"bot_id": "bot1", "name": "Jane", "session_id": None}
    result = asyncio.run(at._create_lead(args, {}, supabase))
    assert "error" in result
    assert "db unreachable" in result["error"]


# ---------------------------------------------------------------------------
# _web_search (agent_tools' own copy)
# ---------------------------------------------------------------------------


class _FakeResponse:
    def __init__(self, status_code=200, text=""):
        self.status_code = status_code
        self.text = text


class _FakeAsyncClient:
    def __init__(self, response):
        self._response = response

    async def __aenter__(self):
        return self

    async def __aexit__(self, *a):
        return False

    async def get(self, url, headers=None):
        return self._response


def test_web_search_requires_query():
    result = asyncio.run(at._web_search({}, {}, MagicMock()))
    assert result == {"error": "query is required"}


def test_web_search_returns_results_on_success(monkeypatch):
    monkeypatch.setattr(at.httpx, "AsyncClient", lambda **kw: _FakeAsyncClient(_FakeResponse(200, "top results")))
    result = asyncio.run(at._web_search({"query": "weather"}, {}, MagicMock()))
    assert result == {"results": "top results"}


def test_web_search_returns_error_on_failure(monkeypatch):
    monkeypatch.setattr(at.httpx, "AsyncClient", lambda **kw: _FakeAsyncClient(_FakeResponse(500, "")))
    result = asyncio.run(at._web_search({"query": "weather"}, {}, MagicMock()))
    assert "error" in result


# ---------------------------------------------------------------------------
# execute — the tool-name dispatcher
# ---------------------------------------------------------------------------


def test_execute_dispatches_to_create_lead(monkeypatch):
    create_lead_mock = AsyncMock(return_value={"success": True, "lead_id": "l1", "message": "Lead registered successfully"})
    monkeypatch.setattr(at, "_create_lead", create_lead_mock)
    result = asyncio.run(at.execute("create_lead", {"bot_id": "b1", "name": "x", "email": "y"}, user={}, supabase=MagicMock()))
    assert result["success"] is True
    create_lead_mock.assert_awaited_once()


def test_execute_overrides_llm_supplied_bot_id_with_trusted_context_bot_id(monkeypatch):
    # A visitor could prompt-inject the model into calling create_lead with
    # someone else's bot_id — the real bot_id for this conversation is known
    # server-side (context, set from the actual widget session) and must
    # always win over whatever the model put in its tool-call args.
    create_lead_mock = AsyncMock(return_value={"success": True})
    monkeypatch.setattr(at, "_create_lead", create_lead_mock)
    asyncio.run(at.execute(
        "create_lead",
        {"bot_id": "attacker-supplied-other-tenant-bot-id", "name": "x", "email": "y"},
        user={}, supabase=MagicMock(),
        context={"source": "widget", "session_id": "s1", "bot_id": "real-trusted-bot-id"},
    ))
    called_args = create_lead_mock.call_args[0][0]
    assert called_args["bot_id"] == "real-trusted-bot-id"


def test_execute_leaves_bot_id_alone_when_no_context_is_given(monkeypatch):
    # No trusted context to override with (shouldn't happen for the widget's
    # only real caller today, but execute() must not crash or blank out
    # bot_id if it's ever called without one).
    create_lead_mock = AsyncMock(return_value={"success": True})
    monkeypatch.setattr(at, "_create_lead", create_lead_mock)
    asyncio.run(at.execute(
        "create_lead", {"bot_id": "b1", "name": "x", "email": "y"}, user={}, supabase=MagicMock(),
    ))
    called_args = create_lead_mock.call_args[0][0]
    assert called_args["bot_id"] == "b1"


def test_execute_dispatches_to_check_calendar_availability(monkeypatch):
    mock = AsyncMock(return_value={"busy": []})
    monkeypatch.setattr(at, "_check_calendar_availability", mock)
    result = asyncio.run(at.execute("check_calendar_availability", {}, user={}, supabase=MagicMock()))
    assert result == {"busy": []}
    mock.assert_awaited_once()


def test_execute_dispatches_to_web_search(monkeypatch):
    mock = AsyncMock(return_value={"results": "abc"})
    monkeypatch.setattr(at, "_web_search", mock)
    result = asyncio.run(at.execute("web_search", {"query": "x"}, user={}, supabase=MagicMock()))
    assert result == {"results": "abc"}
    mock.assert_awaited_once()


def test_execute_dispatches_to_list_outlook_events(monkeypatch):
    mock = AsyncMock(return_value={"events": []})
    monkeypatch.setattr(at, "_list_outlook_events", mock)
    result = asyncio.run(at.execute("list_outlook_events", {}, user={}, supabase=MagicMock()))
    assert result == {"events": []}
    mock.assert_awaited_once()


def test_execute_create_calendar_event_triggers_widget_booking_side_effects(monkeypatch):
    create_mock = AsyncMock(return_value={"id": "evt1"})
    booking_mock = AsyncMock()
    monkeypatch.setattr(at, "_create_calendar_event", create_mock)
    monkeypatch.setattr(at, "_process_widget_booking", booking_mock)
    result = asyncio.run(at.execute(
        "create_calendar_event",
        {"summary": "Demo Meeting with Jane Doe", "start": "a", "end": "b", "attendees": ["jane@example.org"]},
        user={}, supabase=MagicMock(), context={"source": "widget", "bot_id": "b1"},
    ))
    assert result == {"id": "evt1"}
    booking_mock.assert_awaited_once()


def test_execute_create_calendar_event_skips_booking_side_effects_on_error(monkeypatch):
    create_mock = AsyncMock(return_value={"error": "not connected"})
    booking_mock = AsyncMock()
    monkeypatch.setattr(at, "_create_calendar_event", create_mock)
    monkeypatch.setattr(at, "_process_widget_booking", booking_mock)
    result = asyncio.run(at.execute(
        "create_calendar_event",
        {"summary": "Demo Meeting with Jane Doe", "start": "a", "end": "b", "attendees": ["jane@example.org"]},
        user={}, supabase=MagicMock(), context={"source": "widget", "bot_id": "b1"},
    ))
    assert "error" in result
    booking_mock.assert_not_awaited()


def test_execute_rejects_booking_when_nobody_free(monkeypatch):
    from plugins import availability_engine as avail
    monkeypatch.setattr(avail, "get_bookable_members", AsyncMock(return_value=[{"email": "a@example.com", "user": {}, "use_ms_calendar": False}]))
    monkeypatch.setattr(avail, "pick_assignee", AsyncMock(return_value=None))
    create_mock = AsyncMock(return_value={"id": "evt1"})
    monkeypatch.setattr(at, "_create_calendar_event", create_mock)

    result = asyncio.run(at.execute(
        "create_calendar_event",
        {"summary": "Demo Meeting with Jane Doe", "start": "2026-06-25T09:00:00+00:00",
         "end": "2026-06-25T09:30:00+00:00", "attendees": ["jane@example.org"]},
        user={"email": "owner@example.com"}, supabase=MagicMock(),
        context={"source": "widget", "bot_id": "b1", "bot": {"meeting_provider": "google_meet"}},
    ))
    assert "no longer available" in result["error"]
    create_mock.assert_not_awaited()


def test_execute_books_against_assigned_member_not_caller(monkeypatch):
    from plugins import availability_engine as avail
    assignee = {"email": "jane@example.com", "user": {"email": "jane@example.com", "google_access_token": "jane-tok"}, "use_ms_calendar": False}
    monkeypatch.setattr(avail, "get_bookable_members", AsyncMock(return_value=[assignee]))
    monkeypatch.setattr(avail, "pick_assignee", AsyncMock(return_value=assignee))
    create_mock = AsyncMock(return_value={"id": "evt1"})
    booking_mock = AsyncMock()
    monkeypatch.setattr(at, "_create_calendar_event", create_mock)
    monkeypatch.setattr(at, "_process_widget_booking", booking_mock)

    owner_user = {"email": "owner@example.com", "google_access_token": "owner-tok"}
    result = asyncio.run(at.execute(
        "create_calendar_event",
        {"summary": "Demo Meeting with Jane Doe", "start": "2026-06-25T09:00:00+00:00",
         "end": "2026-06-25T09:30:00+00:00", "attendees": ["jane@example.org"]},
        user=owner_user, supabase=MagicMock(),
        context={"source": "widget", "bot_id": "b1", "bot": {"meeting_provider": "google_meet"}},
    ))
    assert result == {"id": "evt1"}
    # The event was created using the ASSIGNED member's credentials, not the caller's.
    create_args, _ = create_mock.call_args
    assert create_args[1] == assignee["user"]
    # And _process_widget_booking received args carrying the assignment, and
    # the assignee's user dict too (needed for add_meet_to_event to attach
    # the conference to the right calendar).
    booking_args, _ = booking_mock.call_args
    assert booking_args[0]["_assigned_to_email"] == "jane@example.com"
    assert booking_args[1] == assignee["user"]


def test_execute_create_calendar_event_rejects_missing_attendee_email():
    result = asyncio.run(at.execute(
        "create_calendar_event",
        {"summary": "Demo Meeting with Jane Doe", "start": "a", "end": "b"},
        user={}, supabase=MagicMock(), context={"source": "widget", "bot_id": "b1"},
    ))
    assert "error" in result
    assert "valid visitor email address is REQUIRED" in result["error"]


def test_execute_create_calendar_event_rejects_dummy_attendee_email():
    result = asyncio.run(at.execute(
        "create_calendar_event",
        {"summary": "Demo Meeting with Jane Doe", "start": "a", "end": "b", "attendees": ["guest@example.com"]},
        user={}, supabase=MagicMock(), context={"source": "widget", "bot_id": "b1"},
    ))
    assert "error" in result
    assert "valid visitor email address is REQUIRED" in result["error"]


def test_execute_create_calendar_event_rejects_missing_name_when_required():
    result = asyncio.run(at.execute(
        "create_calendar_event",
        {"summary": "Demo Meeting", "start": "a", "end": "b", "attendees": ["valid@domain.com"]},
        user={}, supabase=MagicMock(),
        context={"source": "widget", "bot_id": "b1", "bot": {"lead_required_fields": ["name", "email"]}},
    ))
    assert "error" in result
    assert "Visitor's name is REQUIRED before booking" in result["error"]


def test_execute_unknown_tool_returns_error_dict():
    result = asyncio.run(at.execute("not_a_real_tool", {}, user={}, supabase=MagicMock()))
    assert result == {"error": "unknown tool: not_a_real_tool"}


def test_execute_translates_microsoft_not_connected_into_error_dict(monkeypatch):
    monkeypatch.setattr(at, "_list_outlook_events", AsyncMock(side_effect=at.ms.MicrosoftNotConnected()))
    result = asyncio.run(at.execute("list_outlook_events", {}, user={}, supabase=MagicMock()))
    assert "Microsoft not connected" in result["error"]


def test_execute_translates_google_not_connected_into_error_dict(monkeypatch):
    monkeypatch.setattr(at, "_check_calendar_availability", AsyncMock(side_effect=at.g.GoogleNotConnected()))
    result = asyncio.run(at.execute("check_calendar_availability", {}, user={}, supabase=MagicMock()))
    assert "Google not connected" in result["error"]


def test_execute_catches_unexpected_exceptions(monkeypatch):
    monkeypatch.setattr(at, "_create_lead", AsyncMock(side_effect=RuntimeError("boom")))
    result = asyncio.run(at.execute("create_lead", {}, user={}, supabase=MagicMock()))
    assert "tool failed" in result["error"]


# ---------------------------------------------------------------------------
# _process_widget_booking — high-value success/failure branches only
# ---------------------------------------------------------------------------


def test_process_widget_booking_noop_without_bot_id():
    # No bot_id in context — should return without touching supabase at all.
    supabase = MagicMock()
    asyncio.run(at._process_widget_booking({}, {}, supabase, {}, {}))
    supabase.table.assert_not_called()


def test_process_widget_booking_creates_lead_and_meeting_for_google_meet(monkeypatch):
    supabase = MagicMock()

    bots_result = MagicMock(data=[{"meeting_provider": "google_meet", "bot_timezone": "UTC"}])
    leads_select_result = MagicMock(data=[])  # no existing lead for this email
    leads_insert_result = MagicMock(data=[{"id": "lead-9"}])
    meetings_insert_result = MagicMock(data=[{"id": "meet-1"}])

    def table(name):
        t = MagicMock()
        if name == "chatty_bots":
            t.select.return_value.eq.return_value.execute.return_value = bots_result
        elif name == "chatty_leads":
            t.select.return_value.eq.return_value.eq.return_value.execute.return_value = leads_select_result
            t.insert.return_value.execute.return_value = leads_insert_result
        elif name == "chatty_meetings":
            t.insert.return_value.execute.return_value = meetings_insert_result
        elif name == "chatty_notifications":
            t.insert.return_value.execute.return_value = MagicMock()
        elif name == "chatty_audit_logs":
            t.insert.return_value.execute.return_value = MagicMock()
        return t

    supabase.table.side_effect = table
    monkeypatch.setattr(at.notify, "enqueue_webhook_event", AsyncMock())
    monkeypatch.setattr(at.notify, "build_client_email_html", MagicMock(return_value="<html>client</html>"))
    monkeypatch.setattr(at.notify, "build_admin_email_html", MagicMock(return_value="<html>admin</html>"))
    monkeypatch.setattr(at.notify, "deliver_email", AsyncMock(return_value="sent"))
    monkeypatch.setattr(at.notify, "deliver_push", AsyncMock(return_value="sent"))

    args = {
        "summary": "Demo Meeting with Jane", "start": "2026-06-25T09:00:00",
        "end": "2026-06-25T09:30:00", "attendees": ["jane@example.com"],
    }
    result = {"id": "evt1", "hangoutLink": "https://meet.google.com/abc"}
    user = {"email": "owner@example.com"}
    context = {"bot_id": "bot1", "session_id": "sess1"}

    asyncio.run(at._process_widget_booking(args, user, supabase, result, context))

    # Meeting record was inserted with the real Meet link (no add_meet_to_event
    # fallback call needed since hangoutLink was already present).
    meetings_table_calls = [c for c in supabase.table.call_args_list if c.args[0] == "chatty_meetings"]
    assert meetings_table_calls


def test_process_widget_booking_stores_assigned_to_email(monkeypatch):
    supabase = MagicMock()
    bots_result = MagicMock(data=[{"meeting_provider": "google_meet", "bot_timezone": "UTC", "user_id": "owner-auth-1"}])
    leads_select_result = MagicMock(data=[])
    leads_insert_result = MagicMock(data=[{"id": "lead-9"}])
    captured_meeting_insert = {}

    def table(name):
        t = MagicMock()
        if name == "chatty_bots":
            t.select.return_value.eq.return_value.execute.return_value = bots_result
        elif name == "chatty_leads":
            t.select.return_value.eq.return_value.eq.return_value.execute.return_value = leads_select_result
            t.insert.return_value.execute.return_value = leads_insert_result
        elif name == "chatty_meetings":
            def do_insert(payload):
                captured_meeting_insert.update(payload)
                m = MagicMock()
                m.execute.return_value = MagicMock(data=[{"id": "meet-1"}])
                return m
            t.insert.side_effect = do_insert
        elif name == "users":
            t.select.return_value.eq.return_value.limit.return_value.execute.return_value = MagicMock(
                data=[{"email": "real-owner@example.com"}])
        elif name in ("chatty_notifications", "chatty_audit_logs"):
            t.insert.return_value.execute.return_value = MagicMock()
        return t

    supabase.table.side_effect = table
    monkeypatch.setattr(at.notify, "enqueue_webhook_event", AsyncMock())
    monkeypatch.setattr(at.notify, "build_client_email_html", MagicMock(return_value="<html/>"))
    monkeypatch.setattr(at.notify, "build_admin_email_html", MagicMock(return_value="<html/>"))
    captured_admin_recipient = {}

    async def fake_deliver_email(*, supabase, owner_user, to, subject, html, reply_to=None):
        if subject.startswith("New Meeting"):
            captured_admin_recipient["to"] = to
        return "sent"
    monkeypatch.setattr(at.notify, "deliver_email", fake_deliver_email)
    monkeypatch.setattr(at.notify, "deliver_push", AsyncMock(return_value="sent"))

    args = {
        "summary": "Demo Meeting with Jane", "start": "2026-06-25T09:00:00",
        "end": "2026-06-25T09:30:00", "attendees": ["jane@example.com"],
        "_assigned_to_email": "jane-assignee@example.com",
    }
    result = {"id": "evt1", "hangoutLink": "https://meet.google.com/abc"}
    # `user` is the ASSIGNEE (whose credentials created the event) — deliberately
    # different from the bot's real owner (user_id "owner-auth-1").
    assignee_user = {"email": "jane-assignee@example.com", "auth_user_id": "assignee-auth-2"}
    context = {"bot_id": "bot1", "session_id": "sess1"}

    asyncio.run(at._process_widget_booking(args, assignee_user, supabase, result, context))

    assert captured_meeting_insert["assigned_to_email"] == "jane-assignee@example.com"
    # Admin notification still reaches the REAL owner, not the assignee.
    assert captured_admin_recipient["to"] == "real-owner@example.com"


def test_process_widget_booking_swallows_exceptions_and_does_not_raise(monkeypatch):
    supabase = MagicMock()
    supabase.table.side_effect = RuntimeError("db exploded")
    # Must not propagate — booking side effects are best-effort.
    asyncio.run(at._process_widget_booking(
        {"summary": "x", "start": "a", "end": "b"}, {}, supabase, {}, {"bot_id": "bot1"},
    ))


def test_check_bot_meeting_quota_under_limit():
    supabase = MagicMock()
    mock_res = MagicMock(count=2, data=[{"id": "1"}, {"id": "2"}])
    supabase.table.return_value.select.return_value.eq.return_value.neq.return_value.gte.return_value.lt.return_value.execute.return_value = mock_res

    bot = {"max_daily_meetings": 4}
    res = asyncio.run(at.check_bot_meeting_quota("bot1", datetime(2026, 9, 5, 10, 0, tzinfo=timezone.utc), bot, supabase))
    assert res is None


def test_check_bot_meeting_quota_reaches_daily_limit():
    supabase = MagicMock()
    mock_res = MagicMock(count=4, data=[{"id": "1"}, {"id": "2"}, {"id": "3"}, {"id": "4"}])
    supabase.table.return_value.select.return_value.eq.return_value.neq.return_value.gte.return_value.lt.return_value.execute.return_value = mock_res

    bot = {"max_daily_meetings": 4}
    res = asyncio.run(at.check_bot_meeting_quota("bot1", datetime(2026, 9, 5, 10, 0, tzinfo=timezone.utc), bot, supabase))
    assert res is not None
    assert res["limit_reached"] is True
    assert res["reason"] == "daily_limit"
    assert "Daily meeting limit of 4 reached" in res["message"]


def test_execute_blocks_create_calendar_event_when_quota_reached(monkeypatch):
    quota_err = {"limit_reached": True, "message": "Daily meeting limit reached"}
    monkeypatch.setattr(at, "check_bot_meeting_quota", AsyncMock(return_value=quota_err))

    context = {"bot_id": "bot1", "bot": {"max_daily_meetings": 3}}
    res = asyncio.run(at.execute(
        "create_calendar_event",
        {"summary": "Demo", "start": "2026-09-05T10:00:00Z", "end": "2026-09-05T10:30:00Z"},
        user={},
        supabase=MagicMock(),
        context=context,
    ))
    assert "error" in res
    assert "Daily meeting limit reached" in res["error"]
