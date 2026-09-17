"""Enterprise Business Hours SLA Calculation Engine.

Calculates SLA deadlines (First Response & Resolution) by tracking operational
business hours and pausing during nights, weekends, and holidays.
"""

from __future__ import annotations

import datetime
from zoneinfo import ZoneInfo
from typing import Any


DEFAULT_BUSINESS_SCHEDULE: dict[str, list[tuple[str, str]]] = {
    "mon": [("09:00", "17:00")],
    "tue": [("09:00", "17:00")],
    "wed": [("09:00", "17:00")],
    "thu": [("09:00", "17:00")],
    "fri": [("09:00", "17:00")],
}

_DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]


def _parse_time(time_str: str) -> datetime.time:
    parts = time_str.split(":")
    return datetime.time(int(parts[0]), int(parts[1]))


def calculate_business_sla_deadline(
    start_time: datetime.datetime,
    sla_minutes: int,
    timezone_name: str = "UTC",
    schedule: dict[str, list[tuple[str, str]]] | None = None,
    holidays: list[str] | None = None,
) -> datetime.datetime:
    """Calculates the exact SLA deadline timestamp by advancing only through

    working hours defined in the operational schedule.
    
    :param start_time: Datetime when ticket was created (timezone-aware or UTC).
    :param sla_minutes: SLA allowance in operational minutes (e.g. 60 or 240).
    :param timezone_name: IANA timezone (e.g. 'America/New_York', 'UTC').
    :param schedule: Map of day keys ('mon'-'sun') to list of (open_time, close_time) strings.
    :param holidays: List of ISO date strings ('YYYY-MM-DD') to treat as closed holidays.
    :return: Timezone-aware UTC datetime of the calculated SLA deadline.
    """
    if sla_minutes <= 0:
        return start_time

    # Normalize timezone
    try:
        tz = ZoneInfo(timezone_name)
    except Exception:
        tz = ZoneInfo("UTC")

    holidays_set = set(holidays or [])
    active_sched = schedule or DEFAULT_BUSINESS_SCHEDULE

    # Ensure start_time has timezone
    if start_time.tzinfo is None:
        current_dt = start_time.replace(tzinfo=ZoneInfo("UTC")).astimezone(tz)
    else:
        current_dt = start_time.astimezone(tz)

    remaining_minutes = sla_minutes
    max_days_safety = 365  # Infinite loop guard

    for _ in range(max_days_safety):
        date_str = current_dt.strftime("%Y-%m-%d")
        day_key = _DAY_KEYS[current_dt.weekday()]
        day_shifts = active_sched.get(day_key, [])

        if date_str in holidays_set or not day_shifts:
            # Day is closed or holiday: advance to next day at midnight
            current_dt = (current_dt + datetime.timedelta(days=1)).replace(
                hour=0, minute=0, second=0, microsecond=0
            )
            continue

        # Sort shifts by start time
        parsed_shifts = []
        for s_open, s_close in day_shifts:
            t_open = _parse_time(s_open)
            t_close = _parse_time(s_close)
            dt_open = current_dt.replace(
                hour=t_open.hour, minute=t_open.minute, second=0, microsecond=0
            )
            dt_close = current_dt.replace(
                hour=t_close.hour, minute=t_close.minute, second=0, microsecond=0
            )
            parsed_shifts.append((dt_open, dt_close))

        for dt_open, dt_close in parsed_shifts:
            if current_dt >= dt_close:
                # This shift has already passed today
                continue

            # If current time is before shift starts, advance to shift start
            if current_dt < dt_open:
                current_dt = dt_open

            # Available minutes in this shift window
            shift_avail_minutes = int((dt_close - current_dt).total_seconds() // 60)

            if remaining_minutes <= shift_avail_minutes:
                # Deadline is reached within this shift!
                deadline_local = current_dt + datetime.timedelta(minutes=remaining_minutes)
                return deadline_local.astimezone(ZoneInfo("UTC"))

            # Consume the entire shift window
            remaining_minutes -= shift_avail_minutes
            current_dt = dt_close

        # End of day reached: move to next day at 00:00
        current_dt = (current_dt + datetime.timedelta(days=1)).replace(
            hour=0, minute=0, second=0, microsecond=0
        )

    # Fallback if maximum days reached
    return (start_time + datetime.timedelta(minutes=sla_minutes)).astimezone(ZoneInfo("UTC"))


def evaluate_sla_status(
    due_date: datetime.datetime,
    resolved_at: datetime.datetime | None = None,
    as_of: datetime.datetime | None = None,
) -> str:
    """Evaluates SLA state as 'met', 'breached', or 'on_track'."""
    now = as_of or datetime.datetime.now(datetime.timezone.utc)
    
    # Ensure UTC timezone comparability
    if due_date.tzinfo is None:
        due_date = due_date.replace(tzinfo=datetime.timezone.utc)
    if resolved_at and resolved_at.tzinfo is None:
        resolved_at = resolved_at.replace(tzinfo=datetime.timezone.utc)
    if now.tzinfo is None:
        now = now.replace(tzinfo=datetime.timezone.utc)

    if resolved_at:
        return "met" if resolved_at <= due_date else "breached"
    
    return "breached" if now > due_date else "on_track"
