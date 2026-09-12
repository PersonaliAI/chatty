"""Unit tests for self-hosted interactive widget booking endpoints (/api/widget/booking/*)."""
from __future__ import annotations

import pytest
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi import BackgroundTasks, HTTPException
from starlette.requests import Request

import main  # noqa: F401 - must import before app.routers.widget
from app.schemas.widget import WidgetBookingConfirmRequest, WidgetChatRequest
from app.routers.widget import widget_booking_slots, widget_booking_confirm, widget_chat


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

        future_start = (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()
        future_end = (datetime.now(timezone.utc) + timedelta(days=2, minutes=30)).isoformat()

        req = WidgetBookingConfirmRequest(
            bot_id="bot-1",
            session_id="sess-456",
            start_time=future_start,
            end_time=future_end,
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


@pytest.mark.anyio
async def test_widget_assistant_injects_booking_widget():
    from plugins.widget_brain import run_widget_assistant

    mock_bot = {
        "id": "bot-1",
        "calendar_scheduling_enabled": True,
        "meeting_provider": "google_meet",
        "name": "Chatty",
    }
    mock_owner = {"auth_user_id": "u-1", "email": "owner@acme.com"}

    with patch("plugins.ai_client.chat_stream", new_callable=AsyncMock) as mock_chat, \
         patch("plugins.widget_brain.run_db") as mock_db:

        mock_db.return_value = MagicMock(data=[])
        mock_chat.return_value = {
            "text": "Yes, you can book a demo! What day and time works best for you?",
            "tool_calls": [],
        }

        res = await run_widget_assistant(
            bot_id="bot-1",
            owner_user=mock_owner,
            bot=mock_bot,
            session_id="sess-1",
            text="Can I book a demo?",
            visitor_timezone="UTC",
        )
        assert "[BOOKING_WIDGET]" in res["reply"]
        assert res["reply"].endswith("[BOOKING_WIDGET]")


@pytest.mark.anyio
async def test_widget_assistant_does_not_inject_booking_widget_for_general_queries():
    from plugins.widget_brain import run_widget_assistant

    mock_bot = {
        "id": "bot-1",
        "calendar_scheduling_enabled": True,
        "meeting_provider": "google_meet",
        "name": "Chatty",
    }
    mock_owner = {"auth_user_id": "u-1", "email": "owner@acme.com"}

    with patch("plugins.ai_client.chat_stream", new_callable=AsyncMock) as mock_chat, \
         patch("plugins.widget_brain.run_db") as mock_db:

        mock_db.return_value = MagicMock(data=[])
        mock_chat.return_value = {
            "text": "Our pricing starts at $29/mo.",
            "tool_calls": [],
        }

        res = await run_widget_assistant(
            bot_id="bot-1",
            owner_user=mock_owner,
            bot=mock_bot,
            session_id="sess-1",
            text="How much does it cost?",
            visitor_timezone="UTC",
        )
        assert "[BOOKING_WIDGET]" not in res["reply"]


@pytest.mark.anyio
async def test_widget_assistant_respects_conversational_only_mode():
    from plugins.widget_brain import run_widget_assistant

    mock_bot = {
        "id": "bot-1",
        "calendar_scheduling_enabled": True,
        "booking_mode": "conversational_only",
        "meeting_provider": "google_meet",
        "name": "Chatty",
    }
    mock_owner = {"auth_user_id": "u-1", "email": "owner@acme.com"}

    with patch("plugins.ai_client.chat_stream", new_callable=AsyncMock) as mock_chat, \
         patch("plugins.widget_brain.run_db") as mock_db:

        mock_db.return_value = MagicMock(data=[])
        mock_chat.return_value = {
            "text": "Yes, I can book a demo for you! What time works?",
            "tool_calls": [],
        }

        res = await run_widget_assistant(
            bot_id="bot-1",
            owner_user=mock_owner,
            bot=mock_bot,
            session_id="sess-1",
            text="Can I book a demo?",
            visitor_timezone="UTC",
        )
        assert "[BOOKING_WIDGET]" not in res["reply"]


@pytest.mark.anyio
async def test_offline_ticket_stores_contact_fields_and_skips_ai():
    req = WidgetChatRequest(
        bot_id="bot-1",
        session_id="offline-1",
        text="[Offline Support Ticket]\nName: Jane Smith\nEmail: jane@example.com\nMessage: Need help",
        visitor_name="Jane Smith",
        visitor_email="jane@example.com",
        visitor_timezone="Asia/Colombo",
        visitor_country="LK",
        offline_ticket=True,
    )
    request = Request({
        "type": "http",
        "method": "POST",
        "path": "/api/widget/chat",
        "headers": [],
        "client": ("127.0.0.1", 12345),
    })

    run_db_results = [
        MagicMock(data=[{"id": "bot-1", "user_id": "owner-1", "name": "Chatty"}]),
        MagicMock(data=[{"auth_user_id": "owner-1", "email": "owner@example.com"}]),
        MagicMock(data=[{"ok": True}]),  # mark offline ticket session
        MagicMock(data=[{"id": "msg-1"}]),  # persist user message
    ]

    with patch("app.routers.widget.run_db", new_callable=AsyncMock) as mock_run_db, \
         patch("app.routers.widget._widget_rate_limit_or_429", new_callable=AsyncMock), \
         patch("app.routers.widget._upsert_session", new_callable=AsyncMock) as mock_upsert, \
         patch("app.routers.widget._notify_new_conversation", new_callable=AsyncMock), \
         patch("app.routers.widget.run_widget_assistant", new_callable=AsyncMock) as mock_ai:
        mock_run_db.side_effect = run_db_results
        mock_upsert.return_value = ({}, True)

        result = await widget_chat(req, request, BackgroundTasks())

    assert result.ai_paused is True
    assert result.reply == ""
    mock_upsert.assert_awaited_once()
    _, kwargs = mock_upsert.call_args
    assert kwargs["visitor_name"] == "Jane Smith"
    assert kwargs["visitor_email"] == "jane@example.com"
    mock_ai.assert_not_awaited()

