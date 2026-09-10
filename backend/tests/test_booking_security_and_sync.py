"""Tests for booking security, input sanitization, rate limiting, and dashboard/team sync."""
from __future__ import annotations

import pytest
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi import HTTPException

import main  # noqa: F401 - must import before app.routers.widget
from app.schemas.widget import WidgetBookingConfirmRequest
from app.routers.widget import widget_booking_slots, widget_booking_confirm


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
