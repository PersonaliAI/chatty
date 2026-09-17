import asyncio
from unittest.mock import AsyncMock, MagicMock
import pytest

from plugins.google_integrations import (
    GOOGLE_CALENDAR_COLORS,
    GOOGLE_CALENDAR_MULTI_PALETTE,
    resolve_google_calendar_color,
    _event_payload,
    create_calendar_event,
    update_calendar_event,
)


def test_resolve_explicit_valid_color():
    for cid in ("1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11"):
        assert resolve_google_calendar_color(preference=cid) == cid


def test_resolve_rescheduled_is_banana_yellow():
    assert resolve_google_calendar_color(summary="Demo Meeting", is_rescheduled=True) == "5"
    assert resolve_google_calendar_color(preference="3", is_rescheduled=False) == "3"


def test_resolve_semantic_topics():
    # Urgent / Critical -> Tomato (11)
    assert resolve_google_calendar_color(summary="Urgent escalation call") == "11"
    assert resolve_google_calendar_color(description="P0 critical bug outage") == "11"

    # Technical Support / Issues -> Tangerine (6)
    assert resolve_google_calendar_color(summary="Helpdesk support session") == "6"
    assert resolve_google_calendar_color(description="Customer issue troubleshooting") == "6"

    # Sales / Enterprise Pricing -> Basil (10)
    assert resolve_google_calendar_color(summary="Enterprise quote & pricing discussion") == "10"
    assert resolve_google_calendar_color(description="Annual contract review") == "10"

    # Executive / VIP -> Grape (3)
    assert resolve_google_calendar_color(summary="VIP partner strategy meeting") == "3"

    # Onboarding -> Blueberry (9)
    assert resolve_google_calendar_color(summary="New team onboarding kickoff") == "9"

    # Feedback / Review -> Flamingo (4)
    assert resolve_google_calendar_color(summary="Q3 product review & feedback") == "4"


def test_resolve_multi_color_distribution():
    # Distinct attendee emails should hash across the multi-color palette
    emails = [
        "alice@alpha.io",
        "bob@beta.org",
        "carol@cloud.com",
        "dan@delta.net",
        "eva@echo.ai",
        "frank@foxtrot.co",
    ]
    colors = set()
    for em in emails:
        c = resolve_google_calendar_color(summary="Product Demo", attendees=[em])
        assert c in GOOGLE_CALENDAR_MULTI_PALETTE
        colors.add(c)

    # Verifies multiple different colors are used
    assert len(colors) >= 3


def test_event_payload_includes_color_id():
    body = _event_payload(
        summary="Demo Meeting",
        start="2026-10-01T10:00:00",
        end="2026-10-01T10:30:00",
        color_id="7",
    )
    assert body["colorId"] == "7"
    assert body["summary"] == "Demo Meeting"


def test_create_calendar_event_sends_color_id(monkeypatch):
    mock_api = AsyncMock(return_value={
        "id": "evt-123",
        "summary": "Demo Meeting with John",
        "colorId": "7",
        "start": {"dateTime": "2026-10-01T10:00:00Z"},
        "end": {"dateTime": "2026-10-01T10:30:00Z"},
        "status": "confirmed",
    })
    import plugins.google_integrations as g
    monkeypatch.setattr(g, "_api", mock_api)

    user = {"google_access_token": "valid-tok", "email": "host@company.com"}
    res = asyncio.run(create_calendar_event(
        supabase=MagicMock(),
        user=user,
        summary="Demo Meeting with John",
        start="2026-10-01T10:00:00",
        end="2026-10-01T10:30:00",
        attendees=["john@visitor.com"],
        color_id="auto_multiple",
    ))

    assert res["id"] == "evt-123"
    mock_api.assert_awaited_once()
    _, kwargs = mock_api.call_args
    assert "colorId" in kwargs["json_body"]
    assert kwargs["json_body"]["colorId"] in GOOGLE_CALENDAR_MULTI_PALETTE


def test_update_calendar_event_updates_color_id(monkeypatch):
    mock_api = AsyncMock(return_value={
        "id": "evt-123",
        "summary": "Demo Meeting with John",
        "colorId": "5",
        "start": {"dateTime": "2026-10-01T14:00:00Z"},
        "end": {"dateTime": "2026-10-01T14:30:00Z"},
        "status": "confirmed",
    })
    import plugins.google_integrations as g
    monkeypatch.setattr(g, "_api", mock_api)

    user = {"google_access_token": "valid-tok", "email": "host@company.com"}
    res = asyncio.run(update_calendar_event(
        supabase=MagicMock(),
        user=user,
        event_id="evt-123",
        start="2026-10-01T14:00:00",
        end="2026-10-01T14:30:00",
        color_id="5",
    ))

    assert res["id"] == "evt-123"
    mock_api.assert_awaited_once()
    _, kwargs = mock_api.call_args
    assert kwargs["json_body"]["colorId"] == "5"
