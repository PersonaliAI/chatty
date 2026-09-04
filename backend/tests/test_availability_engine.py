"""Unit tests for plugins/availability_engine.py — the deterministic
slot-computation engine that replaced LLM-guesswork gap arithmetic for
calendar booking. `compute_available_slots` is a pure function (no I/O), so
most of this is tested directly without mocking; `fetch_busy_intervals` /
`get_available_slots` / `is_slot_available` are the thin async wrappers
around it and get their own coverage with Google/Outlook mocked at the
module boundary, matching the convention in test_agent_tools.py.
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock

import pytz

from plugins import availability_engine as avail


def _utc(y, m, d, h=0, mi=0):
    return datetime(y, m, d, h, mi, tzinfo=timezone.utc)


# A fixed Monday in a DST-free-ish window, in plain UTC, used as "now" for
# most tests below so results are reproducible.
_MONDAY_9AM_UTC = _utc(2026, 1, 5, 9, 0)
assert _MONDAY_9AM_UTC.weekday() == 0  # sanity: this really is a Monday


DEFAULT_KWARGS = dict(
    owner_tz_str="UTC",
    business_hours_start=9,
    business_hours_end=17,
    working_days=["mon", "tue", "wed", "thu", "fri"],
    duration_minutes=30,
    buffer_minutes=0,
    advance_notice_hours=0,
    max_daily_meetings=0,
    max_weekly_meetings=0,
    daily_counts={},
    weekly_counts={},
)


# ---------------------------------------------------------------------------
# resolve_owner_timezone
# ---------------------------------------------------------------------------


def test_resolve_owner_timezone_prefers_bot_timezone():
    assert avail.resolve_owner_timezone({"bot_timezone": "Asia/Colombo"}, {"timezone": "America/New_York"}) == "Asia/Colombo"


def test_resolve_owner_timezone_falls_back_to_owner_user():
    assert avail.resolve_owner_timezone({}, {"timezone": "America/New_York"}) == "America/New_York"


def test_resolve_owner_timezone_falls_back_to_utc():
    assert avail.resolve_owner_timezone({}, {}) == "UTC"


def test_resolve_owner_timezone_rejects_garbage():
    assert avail.resolve_owner_timezone({"bot_timezone": "Not/AZone"}, {}) == "UTC"


# ---------------------------------------------------------------------------
# _merge_intervals
# ---------------------------------------------------------------------------


def test_merge_intervals_combines_overlapping():
    a = _utc(2026, 1, 5, 9, 0)
    b = _utc(2026, 1, 5, 10, 0)
    c = _utc(2026, 1, 5, 9, 30)
    d = _utc(2026, 1, 5, 11, 0)
    merged = avail._merge_intervals([(a, b), (c, d)])
    assert merged == [(a, d)]


def test_merge_intervals_keeps_disjoint_separate():
    a, b = _utc(2026, 1, 5, 9, 0), _utc(2026, 1, 5, 10, 0)
    c, d = _utc(2026, 1, 5, 11, 0), _utc(2026, 1, 5, 12, 0)
    assert avail._merge_intervals([(a, b), (c, d)]) == [(a, b), (c, d)]


# ---------------------------------------------------------------------------
# compute_available_slots — the core deterministic engine
# ---------------------------------------------------------------------------


def test_finds_first_slot_at_business_hours_start():
    slots = avail.compute_available_slots(
        busy_intervals=[], now_utc=_MONDAY_9AM_UTC, max_results=1, **DEFAULT_KWARGS,
    )
    assert len(slots) == 1
    assert slots[0]["start"] == "2026-01-05T09:00:00Z"
    assert slots[0]["end"] == "2026-01-05T09:30:00Z"


def test_respects_end_of_business_hours():
    slots = avail.compute_available_slots(
        busy_intervals=[], now_utc=_MONDAY_9AM_UTC, max_results=100, **DEFAULT_KWARGS,
    )
    # 9:00 to 17:00 in 30-min increments = 16 slots per day; last one starts 16:30.
    monday_slots = [s for s in slots if s["start"].startswith("2026-01-05")]
    assert len(monday_slots) == 16
    assert monday_slots[-1]["start"] == "2026-01-05T16:30:00Z"
    assert all(s["end"] <= "2026-01-05T17:00:00Z" for s in monday_slots)


def test_skips_weekend():
    # Friday 2026-01-09 -> next working day is Monday 2026-01-12, not Sat/Sun.
    friday_4pm = _utc(2026, 1, 9, 16, 30)
    kwargs = {**DEFAULT_KWARGS, "advance_notice_hours": 1}
    slots = avail.compute_available_slots(
        busy_intervals=[], now_utc=friday_4pm, max_results=3, **kwargs,
    )
    days = {s["start"][:10] for s in slots}
    assert "2026-01-10" not in days  # Saturday
    assert "2026-01-11" not in days  # Sunday
    assert "2026-01-12" in days      # Monday


def test_busy_interval_blocks_overlapping_slots():
    busy = [(_utc(2026, 1, 5, 10, 0), _utc(2026, 1, 5, 11, 0))]
    slots = avail.compute_available_slots(
        busy_intervals=busy, now_utc=_MONDAY_9AM_UTC, max_results=100, **DEFAULT_KWARGS,
    )
    monday_starts = {s["start"] for s in slots if s["start"].startswith("2026-01-05")}
    assert "2026-01-05T10:00:00Z" not in monday_starts
    assert "2026-01-05T10:30:00Z" not in monday_starts
    assert "2026-01-05T09:00:00Z" in monday_starts   # untouched
    assert "2026-01-05T11:00:00Z" in monday_starts   # right after busy block, no buffer


def test_buffer_extends_around_busy_interval():
    busy = [(_utc(2026, 1, 5, 10, 0), _utc(2026, 1, 5, 11, 0))]
    kwargs = {**DEFAULT_KWARGS, "buffer_minutes": 30}
    slots = avail.compute_available_slots(
        busy_intervals=busy, now_utc=_MONDAY_9AM_UTC, max_results=100, **kwargs,
    )
    monday_starts = {s["start"] for s in slots if s["start"].startswith("2026-01-05")}
    # 9:30 candidate slot [9:30,10:00) is within 30min buffer before the 10:00 busy start -> blocked
    assert "2026-01-05T09:30:00Z" not in monday_starts
    assert "2026-01-05T11:00:00Z" not in monday_starts  # within 30min buffer after busy end
    assert "2026-01-05T11:30:00Z" in monday_starts      # clear of the buffer


def test_advance_notice_excludes_near_term_slots():
    kwargs = {**DEFAULT_KWARGS, "advance_notice_hours": 4}
    # now = Monday 09:00 -> nothing before 13:00 should be offered.
    slots = avail.compute_available_slots(
        busy_intervals=[], now_utc=_MONDAY_9AM_UTC, max_results=100, **kwargs,
    )
    monday_starts = {s["start"] for s in slots if s["start"].startswith("2026-01-05")}
    assert "2026-01-05T09:00:00Z" not in monday_starts
    assert "2026-01-05T12:30:00Z" not in monday_starts
    assert "2026-01-05T13:00:00Z" in monday_starts


def test_max_daily_meetings_skips_full_day():
    kwargs = {**DEFAULT_KWARGS, "max_daily_meetings": 2, "daily_counts": {"2026-01-05": 2}}
    slots = avail.compute_available_slots(
        busy_intervals=[], now_utc=_MONDAY_9AM_UTC, max_results=100, **kwargs,
    )
    assert not any(s["start"].startswith("2026-01-05") for s in slots)
    assert any(s["start"].startswith("2026-01-06") for s in slots)  # Tuesday still open


def test_max_weekly_meetings_skips_full_week():
    kwargs = {**DEFAULT_KWARGS, "max_weekly_meetings": 1, "weekly_counts": {"2026-01-05": 1}}
    slots = avail.compute_available_slots(
        busy_intervals=[], now_utc=_MONDAY_9AM_UTC, max_results=100, **kwargs,
    )
    # Week of 2026-01-05 (Mon) through 2026-01-09 (Fri) all excluded.
    assert not any("2026-01-05" <= s["start"][:10] <= "2026-01-09" for s in slots)
    assert any(s["start"].startswith("2026-01-12") for s in slots)  # next Monday open


def test_near_sorts_by_proximity_not_chronology():
    near = _utc(2026, 1, 5, 14, 0)  # visitor asked for 2pm Monday
    slots = avail.compute_available_slots(
        busy_intervals=[], now_utc=_MONDAY_9AM_UTC, max_results=3, near_utc=near, **DEFAULT_KWARGS,
    )
    assert slots[0]["start"] == "2026-01-05T14:00:00Z"  # exact match first


def test_no_near_sorts_chronologically():
    slots = avail.compute_available_slots(
        busy_intervals=[], now_utc=_MONDAY_9AM_UTC, max_results=3, **DEFAULT_KWARGS,
    )
    assert [s["start"] for s in slots] == [
        "2026-01-05T09:00:00Z", "2026-01-05T09:30:00Z", "2026-01-05T10:00:00Z",
    ]


def test_respects_non_utc_owner_timezone():
    # Owner in Asia/Colombo (+05:30). Business hours 9am-5pm local means the
    # first slot in UTC should start at 03:30 UTC (09:00 - 5:30).
    kwargs = {**DEFAULT_KWARGS, "owner_tz_str": "Asia/Colombo"}
    now = _utc(2026, 1, 5, 0, 0)  # midnight UTC = 05:30 local Monday
    slots = avail.compute_available_slots(
        busy_intervals=[], now_utc=now, max_results=1, **kwargs,
    )
    assert slots[0]["start"] == "2026-01-05T03:30:00Z"
    assert "owner_local_label" in slots[0]


def test_visitor_local_label_included_when_tz_given():
    kwargs = {**DEFAULT_KWARGS}
    slots = avail.compute_available_slots(
        busy_intervals=[], now_utc=_MONDAY_9AM_UTC, max_results=1,
        visitor_tz_str="America/New_York", **kwargs,
    )
    assert "visitor_local_label" in slots[0]


def test_empty_working_days_yields_no_slots():
    kwargs = {**DEFAULT_KWARGS, "working_days": []}
    slots = avail.compute_available_slots(
        busy_intervals=[], now_utc=_MONDAY_9AM_UTC, max_results=10, **kwargs,
    )
    assert slots == []


# ---------------------------------------------------------------------------
# _week_key
# ---------------------------------------------------------------------------


def test_week_key_is_monday_of_that_week():
    from datetime import date
    # Wednesday 2026-01-07 -> Monday 2026-01-05
    assert avail._week_key(date(2026, 1, 7)) == "2026-01-05"


# ---------------------------------------------------------------------------
# fetch_busy_intervals — provider-agnostic wrapper
# ---------------------------------------------------------------------------


def test_fetch_busy_intervals_google(monkeypatch):
    monkeypatch.setattr(avail.g, "check_calendar_availability", AsyncMock(return_value={
        "busy": {"primary": [{"start": "2026-01-05T10:00:00Z", "end": "2026-01-05T11:00:00Z"}]}
    }))
    result = asyncio.run(avail.fetch_busy_intervals(
        MagicMock(), {"google_access_token": "tok"}, use_ms_calendar=False,
        time_min=_MONDAY_9AM_UTC, time_max=_MONDAY_9AM_UTC + timedelta(days=1),
    ))
    assert result == [(_utc(2026, 1, 5, 10, 0), _utc(2026, 1, 5, 11, 0))]


def test_fetch_busy_intervals_outlook_ignores_all_day(monkeypatch):
    monkeypatch.setattr(avail.ms, "list_outlook_events", AsyncMock(return_value=[
        {"start": "2026-01-05T10:00:00Z", "end": "2026-01-05T11:00:00Z", "is_all_day": False},
        {"start": "2026-01-05T00:00:00Z", "end": "2026-01-06T00:00:00Z", "is_all_day": True},
    ]))
    result = asyncio.run(avail.fetch_busy_intervals(
        MagicMock(), {"microsoft_access_token": "tok"}, use_ms_calendar=True,
        time_min=_MONDAY_9AM_UTC, time_max=_MONDAY_9AM_UTC + timedelta(days=1),
    ))
    assert result == [(_utc(2026, 1, 5, 10, 0), _utc(2026, 1, 5, 11, 0))]


# ---------------------------------------------------------------------------
# is_slot_available — the hard double-booking guard
# ---------------------------------------------------------------------------


def test_is_slot_available_true_when_clear(monkeypatch):
    monkeypatch.setattr(avail.g, "check_calendar_availability", AsyncMock(return_value={"busy": {}}))
    ok = asyncio.run(avail.is_slot_available(
        MagicMock(), {"google_access_token": "tok"}, bot={}, use_ms_calendar=False,
        start_utc=_utc(2026, 1, 5, 10, 0), end_utc=_utc(2026, 1, 5, 10, 30),
    ))
    assert ok is True


def test_is_slot_available_false_when_conflicting(monkeypatch):
    monkeypatch.setattr(avail.g, "check_calendar_availability", AsyncMock(return_value={
        "busy": {"primary": [{"start": "2026-01-05T10:00:00Z", "end": "2026-01-05T10:30:00Z"}]}
    }))
    ok = asyncio.run(avail.is_slot_available(
        MagicMock(), {"google_access_token": "tok"}, bot={}, use_ms_calendar=False,
        start_utc=_utc(2026, 1, 5, 10, 15), end_utc=_utc(2026, 1, 5, 10, 45),
    ))
    assert ok is False
