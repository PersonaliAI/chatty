"""Tests for booking security, input sanitization, rate limiting, and dashboard/team sync."""
from __future__ import annotations

import pytest
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi import HTTPException

import main  # noqa: F401 - must import before app.routers.widget
from app.schemas.widget import (
    WidgetBookingConfirmRequest,
    WidgetBookingRescheduleRequest,
    WidgetBookingCancelRequest,
)
from app.routers.widget import (
    widget_booking_slots,
    widget_booking_confirm,
    widget_booking_reschedule,
    widget_booking_cancel,
    widget_booking_active,
)


@pytest.mark.anyio
async def test_widget_booking_sanitizes_html_tags():
    """Verify HTML tags and malicious scripts are stripped from all fields."""
    with patch("app.routers.widget.run_db") as mock_db, \
         patch("plugins.agent_tools.execute", new_callable=AsyncMock) as mock_exec:

        mock_bot = MagicMock(data=[{
            "id": "bot-sec-1",
            "calendar_scheduling_enabled": True,
            "user_id": "u-sec-1",
            "meeting_provider": "google_meet",
        }])
        mock_owner = MagicMock(data=[{"auth_user_id": "u-sec-1", "email": "owner@sec1.com"}])
        mock_db.side_effect = [mock_bot, mock_owner, MagicMock(), MagicMock()]

        mock_exec.return_value = {
            "id": "evt-sec",
            "meeting_link": "https://meet.google.com/sec-meet",
            "summary": "Demo Meeting with John Doe",
            "assigned_to_email": "teammate@sec1.com",
        }

        future_start = (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()
        future_end = (datetime.now(timezone.utc) + timedelta(days=2, minutes=30)).isoformat()

        req = WidgetBookingConfirmRequest(
            bot_id="bot-sec-1",
            session_id="sess-sec-1",
            start_time=future_start,
            end_time=future_end,
            name="John <script>alert('xss')</script>Doe",
            email="xss.user@company.com",
            phone="<b onclick=alert(1)>+1-555-0199</b>",
            company="Acme <img src=x onerror=alert(2)> Corp",
            notes="<p>Looking forward to <i>seeing</i> you!</p>",
        )

        res = await widget_booking_confirm(req)
        assert res["success"] is True
        assert res["attendee_name"] == "John Doe"
        assert res["assigned_to_email"] == "teammate@sec1.com"

        call_args = mock_exec.call_args[0]
        tool_args = call_args[1]
        assert "<script>" not in tool_args["description"]
        assert "<img" not in tool_args["description"]
        assert "John Doe" in tool_args["summary"]


@pytest.mark.anyio
async def test_widget_booking_rejects_past_time():
    """Verify slots in the past are rejected."""
    with patch("app.routers.widget.run_db") as mock_db:
        mock_bot = MagicMock(data=[{
            "id": "bot-sec-2",
            "calendar_scheduling_enabled": True,
            "user_id": "u-sec-2",
        }])
        mock_owner = MagicMock(data=[{"auth_user_id": "u-sec-2", "email": "owner@sec2.com"}])
        mock_db.side_effect = [mock_bot, mock_owner]

        past_start = (datetime.now(timezone.utc) - timedelta(hours=2)).isoformat()
        past_end = (datetime.now(timezone.utc) - timedelta(hours=1, minutes=30)).isoformat()

        req = WidgetBookingConfirmRequest(
            bot_id="bot-sec-2",
            start_time=past_start,
            end_time=past_end,
            name="Past User",
            email="past.user@company.com",
        )

        with pytest.raises(HTTPException) as exc:
            await widget_booking_confirm(req)
        assert exc.value.status_code == 400
        assert "past" in exc.value.detail.lower()


@pytest.mark.anyio
async def test_widget_booking_rejects_more_than_90_days():
    """Verify slots more than 90 days out are rejected."""
    with patch("app.routers.widget.run_db") as mock_db:
        mock_bot = MagicMock(data=[{
            "id": "bot-sec-3",
            "calendar_scheduling_enabled": True,
            "user_id": "u-sec-3",
        }])
        mock_owner = MagicMock(data=[{"auth_user_id": "u-sec-3", "email": "owner@sec3.com"}])
        mock_db.side_effect = [mock_bot, mock_owner]

        far_start = (datetime.now(timezone.utc) + timedelta(days=95)).isoformat()
        far_end = (datetime.now(timezone.utc) + timedelta(days=95, minutes=30)).isoformat()

        req = WidgetBookingConfirmRequest(
            bot_id="bot-sec-3",
            start_time=far_start,
            end_time=far_end,
            name="Far User",
            email="far.user@company.com",
        )

        with pytest.raises(HTTPException) as exc:
            await widget_booking_confirm(req)
        assert exc.value.status_code == 400
        assert "90 days" in exc.value.detail.lower()


@pytest.mark.anyio
async def test_widget_booking_enforces_required_lead_fields():
    """Verify lead_required_fields (e.g. phone, company) are strictly enforced."""
    with patch("app.routers.widget.run_db") as mock_db:
        mock_bot = MagicMock(data=[{
            "id": "bot-sec-4",
            "calendar_scheduling_enabled": True,
            "user_id": "u-sec-4",
            "lead_required_fields": ["name", "email", "phone"],
        }])
        mock_owner = MagicMock(data=[{"auth_user_id": "u-sec-4", "email": "owner@sec4.com"}])
        mock_db.side_effect = [mock_bot, mock_owner]

        future_start = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
        future_end = (datetime.now(timezone.utc) + timedelta(days=1, minutes=30)).isoformat()

        req = WidgetBookingConfirmRequest(
            bot_id="bot-sec-4",
            start_time=future_start,
            end_time=future_end,
            name="Req Lead User",
            email="req.lead@company.com",
            phone="",
        )

        with pytest.raises(HTTPException) as exc:
            await widget_booking_confirm(req)
        assert exc.value.status_code == 400
        assert "phone number is required" in exc.value.detail.lower()


@pytest.mark.anyio
async def test_widget_booking_enforces_limit_one_active():
    """Verify booking_limit_one_active prevents multiple active future bookings."""
    with patch("app.routers.widget.run_db") as mock_db:
        mock_bot = MagicMock(data=[{
            "id": "bot-sec-5",
            "calendar_scheduling_enabled": True,
            "user_id": "u-sec-5",
            "booking_limit_one_active": True,
        }])
        mock_owner = MagicMock(data=[{"auth_user_id": "u-sec-5", "email": "owner@sec5.com"}])
        mock_existing_meeting = MagicMock(data=[{
            "id": "m-existing",
            "start_time": (datetime.now(timezone.utc) + timedelta(days=3)).isoformat(),
            "status": "scheduled",
        }])
        mock_db.side_effect = [mock_bot, mock_owner, mock_existing_meeting]

        future_start = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
        future_end = (datetime.now(timezone.utc) + timedelta(days=1, minutes=30)).isoformat()

        req = WidgetBookingConfirmRequest(
            bot_id="bot-sec-5",
            start_time=future_start,
            end_time=future_end,
            name="Active Booker",
            email="active.booker@company.com",
        )

        with pytest.raises(HTTPException) as exc:
            await widget_booking_confirm(req)
        assert exc.value.status_code == 400
        assert "upcoming scheduled meeting" in exc.value.detail.lower()


@pytest.mark.anyio
async def test_widget_booking_rate_limit_blocking():
    """Verify rate limiter blocks rapid booking attempts."""
    mock_request = MagicMock()
    mock_request.headers = {}
    mock_request.client.host = "192.168.1.200"

    with patch("app.routers.widget.run_db") as mock_db, \
         patch("app.routers.widget._rate_limited_async", new_callable=AsyncMock) as mock_rl:

        mock_bot = MagicMock(data=[{
            "id": "bot-sec-6",
            "calendar_scheduling_enabled": True,
            "user_id": "u-sec-6",
        }])
        mock_db.return_value = mock_bot
        mock_rl.return_value = True

        future_start = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
        future_end = (datetime.now(timezone.utc) + timedelta(days=1, minutes=30)).isoformat()

        req = WidgetBookingConfirmRequest(
            bot_id="bot-sec-6",
            start_time=future_start,
            end_time=future_end,
            name="Spam User",
            email="spam.user@company.com",
        )

        with pytest.raises(HTTPException) as exc:
            await widget_booking_confirm(req, request=mock_request)
        assert exc.value.status_code == 429
        assert "too many booking attempts" in exc.value.detail.lower()


@pytest.mark.anyio
async def test_widget_booking_reschedule_success():
    """Verify meeting can be rescheduled to a valid slot within business hours."""
    with patch("app.routers.widget.run_db") as mock_db, \
         patch("plugins.agent_tools.reschedule_meeting_core", new_callable=AsyncMock) as mock_core, \
         patch("plugins.availability_engine.is_slot_available", new_callable=AsyncMock) as mock_avail:

        mock_bot = MagicMock(data=[{
            "id": "bot-resched-1",
            "calendar_scheduling_enabled": True,
            "user_id": "u-resched-1",
            "business_hours_start": 9,
            "business_hours_end": 17,
            "working_days": ["mon", "tue", "wed", "thu", "fri"],
        }])
        mock_meeting = MagicMock(data=[{
            "id": "meet-resched-1",
            "bot_id": "bot-resched-1",
            "attendee_name": "Resched User",
            "attendee_email": "resched.user@company.com",
            "status": "scheduled",
            "lead_id": "lead-resched-1",
            "meeting_link": "https://meet.google.com/resched-link",
        }])
        mock_leads = MagicMock(data=[{"id": "lead-resched-1", "email": "resched.user@company.com"}])
        mock_owner = MagicMock(data=[{"auth_user_id": "u-resched-1", "email": "owner@resched.com"}])

        mock_db.side_effect = [mock_bot, mock_meeting, mock_leads, mock_owner, MagicMock()]
        mock_avail.return_value = True
        mock_core.return_value = {"success": True, "message": "Meeting rescheduled"}

        # Find next Tuesday 10:00 AM UTC
        now = datetime.now(timezone.utc)
        days_ahead = (1 - now.weekday() + 7) % 7
        if days_ahead == 0:
            days_ahead = 7
        tuesday = (now + timedelta(days=days_ahead)).replace(hour=10, minute=0, second=0, microsecond=0)
        new_start = tuesday.isoformat()
        new_end = (tuesday + timedelta(minutes=30)).isoformat()

        req = WidgetBookingRescheduleRequest(
            bot_id="bot-resched-1",
            session_id="sess-resched-1",
            meeting_id="meet-resched-1",
            attendee_email="resched.user@company.com",
            new_start_time=new_start,
            new_end_time=new_end,
            visitor_timezone="UTC",
        )

        res = await widget_booking_reschedule(req)
        assert res["success"] is True
        assert res["meeting_id"] == "meet-resched-1"
        assert res["meeting_link"] == "https://meet.google.com/resched-link"
        assert res["attendee_name"] == "Resched User"


@pytest.mark.anyio
async def test_widget_booking_reschedule_rejects_outside_business_hours():
    """Verify reschedule to a time outside configured business hours is rejected."""
    with patch("app.routers.widget.run_db") as mock_db:
        mock_bot = MagicMock(data=[{
            "id": "bot-resched-2",
            "calendar_scheduling_enabled": True,
            "user_id": "u-resched-2",
            "business_hours_start": 9,
            "business_hours_end": 17,
            "working_days": ["mon", "tue", "wed", "thu", "fri"],
        }])
        mock_meeting = MagicMock(data=[{
            "id": "meet-resched-2",
            "bot_id": "bot-resched-2",
            "attendee_name": "Night Owl",
            "attendee_email": "night.owl@company.com",
            "status": "scheduled",
            "lead_id": "lead-resched-2",
        }])
        mock_leads = MagicMock(data=[{"id": "lead-resched-2", "email": "night.owl@company.com"}])
        mock_owner = MagicMock(data=[{"auth_user_id": "u-resched-2", "email": "owner@resched2.com"}])

        mock_db.side_effect = [mock_bot, mock_meeting, mock_leads, mock_owner]

        # Next Tuesday at 8:00 PM (20:00), which is outside 9-17
        now = datetime.now(timezone.utc)
        days_ahead = (1 - now.weekday() + 7) % 7
        if days_ahead == 0:
            days_ahead = 7
        late_time = (now + timedelta(days=days_ahead)).replace(hour=20, minute=0, second=0, microsecond=0)

        req = WidgetBookingRescheduleRequest(
            bot_id="bot-resched-2",
            session_id="sess-resched-2",
            meeting_id="meet-resched-2",
            attendee_email="night.owl@company.com",
            new_start_time=late_time.isoformat(),
            new_end_time=(late_time + timedelta(minutes=30)).isoformat(),
            visitor_timezone="UTC",
        )

        with pytest.raises(HTTPException) as exc:
            await widget_booking_reschedule(req)
        assert exc.value.status_code == 400
        assert "working hours" in exc.value.detail.lower()


@pytest.mark.anyio
async def test_widget_booking_reschedule_requires_session_ownership():
    """Verify unauthorized reschedule requests from other sessions are rejected."""
    with patch("app.routers.widget.run_db") as mock_db:
        mock_bot = MagicMock(data=[{
            "id": "bot-resched-3",
            "calendar_scheduling_enabled": True,
            "user_id": "u-resched-3",
        }])
        mock_meeting = MagicMock(data=[{
            "id": "meet-resched-3",
            "bot_id": "bot-resched-3",
            "attendee_name": "Victim User",
            "attendee_email": "victim@company.com",
            "status": "scheduled",
            "lead_id": "lead-victim-1",
        }])
        mock_leads = MagicMock(data=[{"id": "lead-attacker-1", "email": "attacker@other.com"}])

        mock_db.side_effect = [mock_bot, mock_meeting, mock_leads]

        future_start = (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()
        future_end = (datetime.now(timezone.utc) + timedelta(days=2, minutes=30)).isoformat()

        req = WidgetBookingRescheduleRequest(
            bot_id="bot-resched-3",
            session_id="sess-attacker",
            meeting_id="meet-resched-3",
            attendee_email="victim@company.com",
            new_start_time=future_start,
            new_end_time=future_end,
        )

        with pytest.raises(HTTPException) as exc:
            await widget_booking_reschedule(req)
        assert exc.value.status_code == 403
        assert "previous sessions" in exc.value.detail.lower()


@pytest.mark.anyio
async def test_widget_booking_cancel_success():
    """Verify meeting cancellation deletes event, updates status, and logs audit."""
    with patch("app.routers.widget.run_db") as mock_db, \
         patch("plugins.agent_tools.cancel_meeting_core", new_callable=AsyncMock) as mock_cancel:

        mock_bot = MagicMock(data=[{
            "id": "bot-cancel-1",
            "calendar_scheduling_enabled": True,
            "user_id": "u-cancel-1",
        }])
        mock_meeting = MagicMock(data=[{
            "id": "meet-cancel-1",
            "bot_id": "bot-cancel-1",
            "attendee_name": "Cancelling User",
            "attendee_email": "cancelling.user@company.com",
            "status": "scheduled",
            "lead_id": "lead-cancel-1",
            "start_time": (datetime.now(timezone.utc) + timedelta(days=2)).isoformat(),
        }])
        mock_leads = MagicMock(data=[{"id": "lead-cancel-1", "email": "cancelling.user@company.com"}])
        mock_owner = MagicMock(data=[{"auth_user_id": "u-cancel-1", "email": "owner@cancel.com"}])

        mock_db.side_effect = [mock_bot, mock_meeting, mock_leads, mock_owner, MagicMock()]
        mock_cancel.return_value = {"success": True, "message": "Cancelled"}

        req = WidgetBookingCancelRequest(
            bot_id="bot-cancel-1",
            session_id="sess-cancel-1",
            meeting_id="meet-cancel-1",
            attendee_email="cancelling.user@company.com",
        )

        res = await widget_booking_cancel(req)
        assert res["success"] is True
        assert res["meeting_id"] == "meet-cancel-1"
        assert res["status"] == "cancelled"


@pytest.mark.anyio
async def test_widget_booking_active_retrieval():
    """Verify GET /api/widget/booking/active retrieves active scheduled meetings."""
    with patch("app.routers.widget.run_db") as mock_db:
        mock_active_meeting = MagicMock(data=[{
            "id": "meet-active-1",
            "bot_id": "bot-active-1",
            "attendee_name": "Active Attendee",
            "attendee_email": "active@company.com",
            "start_time": (datetime.now(timezone.utc) + timedelta(days=3)).isoformat(),
            "end_time": (datetime.now(timezone.utc) + timedelta(days=3, minutes=30)).isoformat(),
            "title": "Demo Meeting with Active Attendee",
            "status": "scheduled",
            "meeting_link": "https://meet.google.com/active-meet",
            "assigned_to_email": "host@company.com",
            "timezone": "UTC",
        }])
        mock_db.return_value = mock_active_meeting

        res = await widget_booking_active(bot_id="bot-active-1", email="active@company.com")
        assert res["has_active"] is True
        assert res["meeting"]["id"] == "meet-active-1"
        assert res["meeting"]["attendee_name"] == "Active Attendee"

