"""Comprehensive automated unit tests for timezone validations and conversions in Chatty.

Covers:
- Multi-region timezone formatting (_format_invitation_time)
- Date-boundary crossing (midnight roll-over forward and backward)
- Timezone fallback and invalid string handling
- Deterministic owner timezone resolution
- Slot grouping by visitor local calendar date
"""
from __future__ import annotations

import main  # noqa: F401 - must import before app.routers.widget
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch
import pytest
import pytz

from plugins import agent_tools as at
from plugins import availability_engine as avail
from app.routers.widget import widget_booking_slots


def test_format_invitation_time_multi_region():
    """Verify ISO timestamps convert accurately into diverse world timezones."""
    # 2026-09-11 04:00:00 UTC
    utc_iso = "2026-09-11T04:00:00Z"

    # Asia/Colombo is UTC+5:30 -> 09:30 AM on Friday, September 11, 2026
    colombo = at._format_invitation_time(utc_iso, "Asia/Colombo")
    assert "Friday, September 11, 2026 at 9:30 AM (Asia/Colombo)" in colombo

    # America/New_York is UTC-4 (EDT in September) -> 12:00 AM midnight
    ny = at._format_invitation_time(utc_iso, "America/New_York")
    assert "Friday, September 11, 2026 at 12:00 AM (America/New_York)" in ny

    # Europe/London is UTC+1 (BST in September) -> 5:00 AM
    london = at._format_invitation_time(utc_iso, "Europe/London")
    assert "Friday, September 11, 2026 at 5:00 AM (Europe/London)" in london

    # Asia/Tokyo is UTC+9 -> 1:00 PM
    tokyo = at._format_invitation_time(utc_iso, "Asia/Tokyo")
    assert "Friday, September 11, 2026 at 1:00 PM (Asia/Tokyo)" in tokyo

    # Australia/Sydney is UTC+10 (AEST in September) -> 2:00 PM
    sydney = at._format_invitation_time(utc_iso, "Australia/Sydney")
    assert "Friday, September 11, 2026 at 2:00 PM (Australia/Sydney)" in sydney


def test_format_invitation_time_date_boundary_backward():
    """Verify time roll-back across midnight to the previous day."""
    # 2026-09-11 02:00:00 UTC is Thursday night in Los Angeles (UTC-7 = 19:00 / 7:00 PM on Sept 10)
    utc_iso = "2026-09-11T02:00:00Z"
    la = at._format_invitation_time(utc_iso, "America/Los_Angeles")
    assert "Thursday, September 10, 2026 at 7:00 PM (America/Los_Angeles)" in la


def test_format_invitation_time_date_boundary_forward():
    """Verify time roll-forward across midnight to the next day."""
    # 2026-09-11 20:30:00 UTC is Saturday morning in Colombo (UTC+5:30 = 02:00 AM on Sept 12)
    utc_iso = "2026-09-11T20:30:00Z"
    colombo = at._format_invitation_time(utc_iso, "Asia/Colombo")
    assert "Saturday, September 12, 2026 at 2:00 AM (Asia/Colombo)" in colombo


def test_format_invitation_time_preserves_already_formatted():
    """Verify that calling format on an already bracketed time does not double-bracket."""
    existing = "Friday, September 11, 2026 at 9:30 AM (Asia/Colombo)"
    res = at._format_invitation_time(existing, "Asia/Colombo")
    assert res == existing
    assert "((Asia/Colombo))" not in res


def test_format_invitation_time_invalid_timezone_fallback():
    """Unknown or malformed timezones should fall back gracefully without unhandled crashes."""
    utc_iso = "2026-09-11T04:00:00Z"
    res1 = at._format_invitation_time(utc_iso, "Invalid/TimeZone_DoesNotExist")
    assert "2026-09-11T04:00:00Z" in res1

    res2 = at._format_invitation_time(utc_iso, None)
    # None defaults to UTC
    assert "(UTC)" in res2


def test_resolve_owner_timezone():
    """Verify owner timezone precedence hierarchy: bot_timezone > owner_user > UTC."""
    # 1. Bot timezone present
    bot1 = {"bot_timezone": "Asia/Colombo"}
    user1 = {"timezone": "America/New_York"}
    assert avail.resolve_owner_timezone(bot1, user1) == "Asia/Colombo"

    # 2. Bot timezone missing, owner user present
    bot2 = {"bot_timezone": None}
    user2 = {"timezone": "Europe/London"}
    assert avail.resolve_owner_timezone(bot2, user2) == "Europe/London"

    # 3. Both missing or invalid
    bot3 = {"bot_timezone": "Invalid/Trash"}
    user3 = {"timezone": None}
    assert avail.resolve_owner_timezone(bot3, user3) == "UTC"


def test_visitor_local_date_grouping_across_day_boundaries():
    """Simulate slot grouping logic in widget_booking_slots across timezones."""
    slots = [
        {"start": "2026-09-11T02:00:00Z", "end": "2026-09-11T02:30:00Z"},
        {"start": "2026-09-11T14:00:00Z", "end": "2026-09-11T14:30:00Z"},
    ]

    # In Los Angeles (UTC-7):
    la_tz = pytz.timezone("America/Los_Angeles")
    la_dates = set()
    for s in slots:
        dt_utc = datetime.fromisoformat(s["start"].replace("Z", "+00:00"))
        dt_la = dt_utc.astimezone(la_tz)
        la_dates.add(dt_la.strftime("%Y-%m-%d"))

    assert "2026-09-10" in la_dates
    assert "2026-09-11" in la_dates
    assert len(la_dates) == 2

    # In Colombo (UTC+5:30):
    colombo_tz = pytz.timezone("Asia/Colombo")
    colombo_dates = set()
    for s in slots:
        dt_utc = datetime.fromisoformat(s["start"].replace("Z", "+00:00"))
        dt_colombo = dt_utc.astimezone(colombo_tz)
        colombo_dates.add(dt_colombo.strftime("%Y-%m-%d"))

    assert colombo_dates == {"2026-09-11"}


@pytest.mark.anyio
async def test_widget_booking_slots_with_timezone_grouping():
    """Verify widget_booking_slots correctly organizes slots into visitor timezone dates."""
    mock_bot = MagicMock()
    mock_bot.data = [{
        "id": "bot-tz-test",
        "calendar_scheduling_enabled": True,
        "user_id": "u-tz-owner",
        "bot_timezone": "UTC",
        "scheduling_duration_minutes": 30,
        "meeting_provider": "google_meet",
    }]
    mock_owner = MagicMock()
    mock_owner.data = [{
        "auth_user_id": "u-tz-owner",
        "email": "owner@tz.com",
        "timezone": "UTC",
    }]

    mock_slots = [
        # 2026-09-11 02:00:00 UTC (Sept 10 19:00 in America/Los_Angeles, Sept 11 07:30 in Asia/Colombo)
        {"start": "2026-09-11T02:00:00Z", "end": "2026-09-11T02:30:00Z", "visitor_local_label": "Sept 11 at 7:30 AM"},
        # 2026-09-11 14:00:00 UTC (Sept 11 07:00 in America/Los_Angeles, Sept 11 19:30 in Asia/Colombo)
        {"start": "2026-09-11T14:00:00Z", "end": "2026-09-11T14:30:00Z", "visitor_local_label": "Sept 11 at 7:30 PM"},
    ]

    with patch("app.routers.widget.run_db") as mock_db, \
         patch("plugins.availability_engine.get_bookable_members", new_callable=AsyncMock) as mock_members, \
         patch("plugins.availability_engine.get_team_available_slots", new_callable=AsyncMock) as mock_team_slots:

        mock_db.side_effect = [mock_bot, mock_owner]
        mock_members.return_value = [{"email": "owner@tz.com"}]
        mock_team_slots.return_value = mock_slots

        # Test visitor in America/Los_Angeles
        res_la = await widget_booking_slots(bot_id="bot-tz-test", visitor_timezone="America/Los_Angeles")
        assert res_la["enabled"] is True
        assert res_la["visitor_timezone"] == "America/Los_Angeles"
        assert "2026-09-10" in res_la["slots_by_date"]
        assert "2026-09-11" in res_la["slots_by_date"]
        assert res_la["slots_by_date"]["2026-09-10"][0]["time_label"] == "7:00 PM"
        assert res_la["slots_by_date"]["2026-09-11"][0]["time_label"] == "7:00 AM"

        # Now test visitor in Asia/Colombo
        mock_db.side_effect = [mock_bot, mock_owner]
        res_colombo = await widget_booking_slots(bot_id="bot-tz-test", visitor_timezone="Asia/Colombo")
        assert res_colombo["enabled"] is True
        assert res_colombo["visitor_timezone"] == "Asia/Colombo"
        assert "2026-09-11" in res_colombo["slots_by_date"]
        assert len(res_colombo["slots_by_date"]["2026-09-11"]) == 2
        assert res_colombo["slots_by_date"]["2026-09-11"][0]["time_label"] == "7:30 AM"
        assert res_colombo["slots_by_date"]["2026-09-11"][1]["time_label"] == "7:30 PM"
