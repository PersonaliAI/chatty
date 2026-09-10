"""Unit tests for self-hosted interactive widget booking endpoints (/api/widget/booking/*)."""
from __future__ import annotations

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi import HTTPException

import main  # noqa: F401 - must import before app.routers.widget
from app.schemas.widget import WidgetBookingConfirmRequest
from app.routers.widget import widget_booking_slots, widget_booking_confirm


@pytest.mark.anyio
async def test_widget_booking_slots_disabled():
    with patch("app.routers.widget.run_db") as mock_db:
        mock_res = MagicMock()
        mock_res.data = [{"id": "bot-1", "calendar_scheduling_enabled": False}]
        mock_db.return_value = mock_res

        res = await widget_booking_slots(bot_id="bot-1")
        assert res["enabled"] is False
        assert "Scheduling is not enabled" in res["message"]


@pytest.mark.anyio
async def test_widget_booking_confirm_rejects_generic_name():
    with patch("app.routers.widget.run_db") as mock_db:
        mock_res = MagicMock()
        mock_res.data = [{"id": "bot-1", "calendar_scheduling_enabled": True, "user_id": "u-1"}]
        mock_owner = MagicMock()
        mock_owner.data = [{"auth_user_id": "u-1", "email": "owner@acme.com"}]
        mock_db.side_effect = [mock_res, mock_owner]

        req = WidgetBookingConfirmRequest(
            bot_id="bot-1",
            start_time="2026-09-11T10:00:00Z",
            end_time="2026-09-11T10:30:00Z",
            name="Guest",
            email="visitor@example.com",
        )

        with pytest.raises(HTTPException) as exc:
            await widget_booking_confirm(req)
        assert exc.value.status_code == 400
        assert "full name" in exc.value.detail.lower()


@pytest.mark.anyio
async def test_widget_booking_confirm_rejects_invalid_email():
    with patch("app.routers.widget.run_db") as mock_db:
        mock_res = MagicMock()
        mock_res.data = [{"id": "bot-1", "calendar_scheduling_enabled": True, "user_id": "u-1"}]
        mock_owner = MagicMock()
        mock_owner.data = [{"auth_user_id": "u-1", "email": "owner@acme.com"}]
        mock_db.side_effect = [mock_res, mock_owner]

        req = WidgetBookingConfirmRequest(
            bot_id="bot-1",
            start_time="2026-09-11T10:00:00Z",
            end_time="2026-09-11T10:30:00Z",
            name="Alice Smith",
            email="not-an-email",
        )

        with pytest.raises(HTTPException) as exc:
            await widget_booking_confirm(req)
        assert exc.value.status_code == 400
        assert "valid email address" in exc.value.detail


@pytest.mark.anyio
async def test_widget_booking_confirm_success():
    with patch("app.routers.widget.run_db") as mock_db, \
         patch("plugins.agent_tools.execute", new_callable=AsyncMock) as mock_exec:

        mock_bot = MagicMock()
        mock_bot.data = [{
            "id": "bot-1",
            "calendar_scheduling_enabled": True,
            "user_id": "u-1",
            "meeting_provider": "google_meet",
        }]
        mock_owner = MagicMock()
        mock_owner.data = [{"auth_user_id": "u-1", "email": "owner@acme.com"}]
        mock_db.side_effect = [mock_bot, mock_owner, MagicMock(), MagicMock()]

        mock_exec.return_value = {
            "id": "evt-123",
            "hangout_link": "https://meet.google.com/abc-defg-hij",
            "summary": "Demo Meeting with Alice Smith",
        }

        req = WidgetBookingConfirmRequest(
            bot_id="bot-1",
            session_id="sess-456",
            start_time="2026-09-11T10:00:00Z",
            end_time="2026-09-11T10:30:00Z",
            visitor_timezone="Asia/Colombo",
            name="Alice Smith",
            email="alice@company.com",
            phone="+1234567890",
            company="Acme Corp",
            notes="Interested in enterprise tier",
        )

        res = await widget_booking_confirm(req)
        assert res["success"] is True
        assert res["meeting_link"] == "https://meet.google.com/abc-defg-hij"
        assert res["attendee_name"] == "Alice Smith"
        assert res["attendee_email"] == "alice@company.com"
