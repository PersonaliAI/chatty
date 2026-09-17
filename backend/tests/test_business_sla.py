"""Unit tests for enterprise Business Hours SLA calculation engine."""

import datetime
from zoneinfo import ZoneInfo
import pytest

from app.services.business_sla_service import (
    calculate_business_sla_deadline,
    evaluate_sla_status,
    DEFAULT_BUSINESS_SCHEDULE,
)


def test_same_day_business_hours_advancement():
    # Wednesday, 2026-09-16 10:00 AM UTC
    start = datetime.datetime(2026, 9, 16, 10, 0, tzinfo=ZoneInfo("UTC"))
    deadline = calculate_business_sla_deadline(start, sla_minutes=120, timezone_name="UTC")
    
    # 2 hours later = 12:00 PM same day
    expected = datetime.datetime(2026, 9, 16, 12, 0, tzinfo=ZoneInfo("UTC"))
    assert deadline == expected


def test_end_of_day_rollover():
    # Wednesday, 2026-09-16 16:30 (4:30 PM) UTC. Workday ends at 17:00 (5:00 PM)
    start = datetime.datetime(2026, 9, 16, 16, 30, tzinfo=ZoneInfo("UTC"))
    # 60 minutes SLA: 30 minutes used today (until 17:00), 30 minutes carry to Thursday 09:30 AM
    deadline = calculate_business_sla_deadline(start, sla_minutes=60, timezone_name="UTC")
    
    expected = datetime.datetime(2026, 9, 17, 9, 30, tzinfo=ZoneInfo("UTC"))
    assert deadline == expected


def test_weekend_rollover():
    # Friday, 2026-09-18 16:00 (4:00 PM) UTC. Workday ends at 17:00
    start = datetime.datetime(2026, 9, 18, 16, 0, tzinfo=ZoneInfo("UTC"))
    # 120 minutes SLA: 60 mins on Friday (16:00-17:00). Saturday and Sunday are closed.
    # Remaining 60 minutes must start Monday 2026-09-21 at 09:00 -> deadline Monday 10:00 AM!
    deadline = calculate_business_sla_deadline(start, sla_minutes=120, timezone_name="UTC")
    
    expected = datetime.datetime(2026, 9, 21, 10, 0, tzinfo=ZoneInfo("UTC"))
    assert deadline == expected


def test_weekend_creation():
    # Saturday, 2026-09-19 14:00 (2:00 PM) UTC
    start = datetime.datetime(2026, 9, 19, 14, 0, tzinfo=ZoneInfo("UTC"))
    # 60 minutes SLA: Clock does not start until Monday 09:00 AM -> deadline Monday 10:00 AM
    deadline = calculate_business_sla_deadline(start, sla_minutes=60, timezone_name="UTC")
    
    expected = datetime.datetime(2026, 9, 21, 10, 0, tzinfo=ZoneInfo("UTC"))
    assert deadline == expected


def test_holiday_skipping():
    # Friday 2026-09-18 at 16:30 (4:30 PM). 60-minute SLA.
    # Monday 2026-09-21 is marked as a company holiday.
    start = datetime.datetime(2026, 9, 18, 16, 30, tzinfo=ZoneInfo("UTC"))
    holidays = ["2026-09-21"]
    
    # 30 mins used Friday. Monday is skipped. 30 mins on Tuesday 2026-09-22 09:30 AM!
    deadline = calculate_business_sla_deadline(
        start, sla_minutes=60, timezone_name="UTC", holidays=holidays
    )
    
    expected = datetime.datetime(2026, 9, 22, 9, 30, tzinfo=ZoneInfo("UTC"))
    assert deadline == expected


def test_evaluate_sla_status():
    due = datetime.datetime(2026, 9, 16, 12, 0, tzinfo=ZoneInfo("UTC"))
    
    # Resolved before deadline -> met
    resolved_early = datetime.datetime(2026, 9, 16, 11, 45, tzinfo=ZoneInfo("UTC"))
    assert evaluate_sla_status(due, resolved_at=resolved_early) == "met"
    
    # Resolved after deadline -> breached
    resolved_late = datetime.datetime(2026, 9, 16, 12, 15, tzinfo=ZoneInfo("UTC"))
    assert evaluate_sla_status(due, resolved_at=resolved_late) == "breached"
    
    # Not resolved yet, but current time is before deadline -> on_track
    as_of_now = datetime.datetime(2026, 9, 16, 11, 30, tzinfo=ZoneInfo("UTC"))
    assert evaluate_sla_status(due, as_of=as_of_now) == "on_track"
    
    # Not resolved yet, and current time is past deadline -> breached
    as_of_late = datetime.datetime(2026, 9, 16, 12, 0, 1, tzinfo=ZoneInfo("UTC"))
    assert evaluate_sla_status(due, as_of=as_of_late) == "breached"
