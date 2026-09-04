"""Deterministic meeting-slot computation for calendar booking.

Before this module existed, "what times are open?" was entirely LLM
arithmetic: `check_calendar_availability`/`list_outlook_events` handed the
model a bag of raw busy intervals (or raw events, for Outlook) and a prompt
instruction to "look at the free gaps... and proactively recommend 2 to 3
guaranteed open slots" — the model was doing interval subtraction in its
head, which is exactly the kind of arithmetic LLMs are unreliable at (missed
a same-day Friday, invented slots that weren't actually free, ignored
business hours). This module does that computation in real code instead:
merge busy intervals from whichever calendar provider is connected, subtract
them (padded by the configured buffer) from the bot's configured business
hours/working days, skip anything inside the minimum-notice window or on a
day/week that's already at its meeting cap, and hand back exact, guaranteed-
bookable slots. The LLM's job becomes "call this, present exactly what it
returns" — not "do the math yourself".
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from datetime import timezone as dt_timezone
from typing import Any, Optional

import pytz

from app.core.db import run_db
from plugins import google_integrations as g
from plugins import microsoft_integrations as ms

_DAY_NUM = {"mon": 0, "tue": 1, "wed": 2, "thu": 3, "fri": 4, "sat": 5, "sun": 6}
_DAY_LABEL = {0: "Monday", 1: "Tuesday", 2: "Wednesday", 3: "Thursday",
              4: "Friday", 5: "Saturday", 6: "Sunday"}


def resolve_owner_timezone(bot: dict[str, Any], owner_user: dict[str, Any]) -> str:
    """Canonical timezone-resolution chain for "what timezone is the
    business/calendar owner in" — `widget_brain.py` and `agent_tools.py` each
    grew their own slightly different version of this fallback chain
    (one falls back to `owner_user["timezone"]`, the other doesn't); this is
    the one both should use going forward so they can't drift out of sync."""
    tz_str = bot.get("bot_timezone") or owner_user.get("timezone") or "UTC"
    try:
        pytz.timezone(tz_str)
        return tz_str
    except Exception:
        return "UTC"


def _parse_dt(s: str) -> datetime:
    s = (s or "").strip()
    if s.endswith("Z"):
        s = s[:-1] + "+00:00"
    dt = datetime.fromisoformat(s)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=dt_timezone.utc)
    return dt.astimezone(dt_timezone.utc)


def _merge_intervals(intervals: list[tuple[datetime, datetime]]) -> list[tuple[datetime, datetime]]:
    if not intervals:
        return []
    ordered = sorted(intervals, key=lambda iv: iv[0])
    merged = [ordered[0]]
    for start, end in ordered[1:]:
        last_start, last_end = merged[-1]
        if start <= last_end:
            merged[-1] = (last_start, max(last_end, end))
        else:
            merged.append((start, end))
    return merged


async def fetch_busy_intervals(
    supabase,
    user: dict[str, Any],
    *,
    use_ms_calendar: bool,
    time_min: datetime,
    time_max: datetime,
) -> list[tuple[datetime, datetime]]:
    """Provider-agnostic busy-interval fetch, normalized to a merged, sorted
    list of (start_utc, end_utc) tuples regardless of whether the connected
    calendar is Google (native freeBusy — already busy blocks) or Outlook
    (raw events — each one is itself a busy block; all-day events are
    ignored since they don't actually occupy a specific meeting-length
    window)."""
    intervals: list[tuple[datetime, datetime]] = []
    if use_ms_calendar:
        events = await ms.list_outlook_events(
            supabase, user, time_min=time_min, time_max=time_max, limit=250,
        )
        for ev in events:
            if ev.get("is_all_day"):
                continue
            s, e = ev.get("start"), ev.get("end")
            if not s or not e:
                continue
            try:
                intervals.append((_parse_dt(s), _parse_dt(e)))
            except ValueError:
                continue
    else:
        res = await g.check_calendar_availability(supabase, user, time_min=time_min, time_max=time_max)
        for cal_busy in (res.get("busy") or {}).values():
            for b in cal_busy:
                s, e = b.get("start"), b.get("end")
                if not s or not e:
                    continue
                try:
                    intervals.append((_parse_dt(s), _parse_dt(e)))
                except ValueError:
                    continue

    return _merge_intervals(intervals)


def _slot_conflicts(
    slot_start: datetime, slot_end: datetime,
    busy: list[tuple[datetime, datetime]], buffer_minutes: int,
) -> bool:
    buf = timedelta(minutes=buffer_minutes)
    for b_start, b_end in busy:
        if slot_start < (b_end + buf) and slot_end > (b_start - buf):
            return True
    return False


def _week_key(d: date) -> str:
    """Monday of d's ISO week, as a string — the grouping key both
    `get_meeting_counts` and `compute_available_slots` use so a week's count
    and a week's capacity check are always looking at the same 7-day bucket."""
    monday = d - timedelta(days=d.weekday())
    return monday.isoformat()


async def get_meeting_counts(
    supabase,
    bot_id: str,
    owner_tz_str: str,
    window_start_utc: datetime,
    window_end_utc: datetime,
) -> tuple[dict[str, int], dict[str, int]]:
    """Per-day and per-week (Monday-start, in the OWNER's own timezone —
    unlike the existing `agent_tools.check_bot_meeting_quota`, which buckets
    in UTC and can miscount a booking into the wrong local day/week for a
    non-UTC business) meeting counts across the window, in a single query."""
    tz = pytz.timezone(owner_tz_str)
    daily: dict[str, int] = {}
    weekly: dict[str, int] = {}
    try:
        res = await run_db(lambda: supabase.table("chatty_meetings")
            .select("start_time")
            .eq("bot_id", bot_id)
            .neq("status", "cancelled")
            .gte("start_time", window_start_utc.isoformat())
            .lt("start_time", window_end_utc.isoformat())
            .execute())
        for row in res.data or []:
            raw = row.get("start_time")
            if not raw:
                continue
            try:
                local_date = _parse_dt(raw).astimezone(tz).date()
            except ValueError:
                continue
            day_key = local_date.isoformat()
            daily[day_key] = daily.get(day_key, 0) + 1
            wk = _week_key(local_date)
            weekly[wk] = weekly.get(wk, 0) + 1
    except Exception:
        # Same fail-open posture as the existing quota check elsewhere in
        # this codebase — a counting-query failure shouldn't take booking
        # down entirely, it just means caps aren't enforced for this call.
        pass
    return daily, weekly


@dataclass
class AvailableSlot:
    start_utc: datetime
    end_utc: datetime
    owner_tz_str: str
    visitor_tz_str: Optional[str] = None

    def to_dict(self) -> dict[str, Any]:
        owner_local = self.start_utc.astimezone(pytz.timezone(self.owner_tz_str))
        out = {
            "start": self.start_utc.isoformat().replace("+00:00", "Z"),
            "end": self.end_utc.isoformat().replace("+00:00", "Z"),
            "owner_local_label": _format_slot_label(owner_local),
        }
        if self.visitor_tz_str:
            try:
                visitor_local = self.start_utc.astimezone(pytz.timezone(self.visitor_tz_str))
                out["visitor_local_label"] = _format_slot_label(visitor_local)
            except Exception:
                pass
        return out


def _format_slot_label(dt: datetime) -> str:
    """"Monday, Jan 5 at 9:00 AM" — built with portable strftime directives
    only (no `%-d`/`%-I`; those are glibc extensions Windows' C runtime
    doesn't support, and this needs to run the same in local dev as in the
    Linux container it's deployed to)."""
    hour12 = dt.hour % 12 or 12
    ampm = "AM" if dt.hour < 12 else "PM"
    return f"{dt.strftime('%A, %b')} {dt.day} at {hour12}:{dt.minute:02d} {ampm}"


def compute_available_slots(
    *,
    busy_intervals: list[tuple[datetime, datetime]],
    owner_tz_str: str,
    business_hours_start: int,
    business_hours_end: int,
    working_days: list[str],
    duration_minutes: int,
    buffer_minutes: int,
    advance_notice_hours: int,
    max_daily_meetings: int,
    max_weekly_meetings: int,
    daily_counts: dict[str, int],
    weekly_counts: dict[str, int],
    now_utc: datetime,
    search_days: int = 21,
    max_results: int = 5,
    near_utc: Optional[datetime] = None,
    visitor_tz_str: Optional[str] = None,
) -> list[dict[str, Any]]:
    """The actual slot generator. Walks each working day in the owner's own
    calendar (in their timezone, so business hours/day-of-week boundaries
    mean what they say), builds candidate slots at `duration_minutes`
    increments across business hours, and keeps only the ones that clear
    every real constraint: not already busy (padded by `buffer_minutes`),
    not inside the `advance_notice_hours` window, and not on a day/week
    already at its meeting cap. Returns up to `max_results` slots, nearest
    to `near_utc` first if given (use this when the visitor asked for a
    specific time that turned out to be unavailable — the alternatives
    should be close to what they wanted, not just chronologically first),
    otherwise soonest-first."""
    tz = pytz.timezone(owner_tz_str)
    slot_len = timedelta(minutes=duration_minutes)
    min_start_utc = now_utc + timedelta(hours=advance_notice_hours)
    work_day_nums = {_DAY_NUM[d] for d in working_days if d in _DAY_NUM}

    found: list[AvailableSlot] = []
    start_local_date = now_utc.astimezone(tz).date()

    for offset in range(search_days):
        day = start_local_date + timedelta(days=offset)
        if day.weekday() not in work_day_nums:
            continue
        day_key = day.isoformat()
        if max_daily_meetings and daily_counts.get(day_key, 0) >= max_daily_meetings:
            continue
        wk = _week_key(day)
        if max_weekly_meetings and weekly_counts.get(wk, 0) >= max_weekly_meetings:
            continue

        try:
            local_start = tz.localize(datetime.combine(day, time(hour=business_hours_start)))
            local_end = tz.localize(datetime.combine(day, time(hour=business_hours_end)))
        except Exception:
            continue
        cursor = local_start.astimezone(dt_timezone.utc)
        day_end_utc = local_end.astimezone(dt_timezone.utc)

        while cursor + slot_len <= day_end_utc:
            slot_end = cursor + slot_len
            if cursor >= min_start_utc and not _slot_conflicts(cursor, slot_end, busy_intervals, buffer_minutes):
                found.append(AvailableSlot(cursor, slot_end, owner_tz_str, visitor_tz_str))
            cursor += slot_len

    if near_utc is not None:
        found.sort(key=lambda s: abs((s.start_utc - near_utc).total_seconds()))
    else:
        found.sort(key=lambda s: s.start_utc)

    return [s.to_dict() for s in found[:max_results]]


async def get_available_slots(
    supabase,
    user: dict[str, Any],
    *,
    bot_id: str,
    bot: dict[str, Any],
    owner_tz_str: str,
    use_ms_calendar: bool,
    now_utc: datetime,
    visitor_tz_str: Optional[str] = None,
    near_utc: Optional[datetime] = None,
    max_results: int = 5,
    search_days: int = 21,
) -> list[dict[str, Any]]:
    """Convenience wrapper: fetch busy intervals + meeting counts for the
    whole search window in two calls total (not one per candidate day), then
    compute slots. This is what `agent_tools.get_available_slots` and the
    booking-time conflict guard both call."""
    duration_minutes = int(bot.get("scheduling_duration_minutes") or 30)
    bh_start = int(bot.get("business_hours_start") if bot.get("business_hours_start") is not None else 9)
    bh_end = int(bot.get("business_hours_end") if bot.get("business_hours_end") is not None else 17)
    working_days = bot.get("working_days") or ["mon", "tue", "wed", "thu", "fri"]
    buffer_minutes = int(bot.get("buffer_minutes") or 0)
    advance_notice_hours = int(bot.get("advance_notice_hours") or 0)
    max_daily = int(bot.get("max_daily_meetings") or 0)
    max_weekly = int(bot.get("max_weekly_meetings") or 0)

    window_start = now_utc
    window_end = now_utc + timedelta(days=search_days + 1)

    busy = await fetch_busy_intervals(
        supabase, user, use_ms_calendar=use_ms_calendar,
        time_min=window_start, time_max=window_end,
    )
    daily_counts, weekly_counts = {}, {}
    if max_daily or max_weekly:
        daily_counts, weekly_counts = await get_meeting_counts(
            supabase, bot_id, owner_tz_str, window_start, window_end,
        )

    return compute_available_slots(
        busy_intervals=busy,
        owner_tz_str=owner_tz_str,
        business_hours_start=bh_start,
        business_hours_end=bh_end,
        working_days=working_days,
        duration_minutes=duration_minutes,
        buffer_minutes=buffer_minutes,
        advance_notice_hours=advance_notice_hours,
        max_daily_meetings=max_daily,
        max_weekly_meetings=max_weekly,
        daily_counts=daily_counts,
        weekly_counts=weekly_counts,
        now_utc=now_utc,
        search_days=search_days,
        max_results=max_results,
        near_utc=near_utc,
        visitor_tz_str=visitor_tz_str,
    )


async def is_slot_available(
    supabase,
    user: dict[str, Any],
    *,
    bot: dict[str, Any],
    use_ms_calendar: bool,
    start_utc: datetime,
    end_utc: datetime,
) -> bool:
    """Hard server-side guard against double-booking. Neither
    `create_calendar_event` nor `create_outlook_event` did any conflict
    checking before this — they trusted the LLM to have called an
    availability check first and to have gotten it right, so a model that
    skipped the check (or hallucinated a slot) could double-book. Call this
    right before actually creating the event."""
    buffer_minutes = int(bot.get("buffer_minutes") or 0)
    buf = timedelta(minutes=buffer_minutes)
    busy = await fetch_busy_intervals(
        supabase, user, use_ms_calendar=use_ms_calendar,
        time_min=start_utc - buf - timedelta(minutes=1),
        time_max=end_utc + buf + timedelta(minutes=1),
    )
    return not _slot_conflicts(start_utc, end_utc, busy, buffer_minutes)
