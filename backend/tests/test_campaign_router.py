import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock

from fastapi import HTTPException

from app.routers import bots


USER = {"auth_user_id": "operator-1", "email": "operator@example.com"}


def _campaign():
    return {
        "id": "campaign-1",
        "bot_id": "bot-1",
        "message": "Welcome back",
        "is_active": True,
        "created_at": "2026-09-01T10:00:00Z",
        "schedule_config": {"cadence": "once", "timezone": "UTC"},
        "safety_config": {"frequency_cap_hours": 24, "require_consent": True},
        "sequence_steps": [],
    }


def test_dispatch_plan_requires_settings_permission(monkeypatch):
    permission = AsyncMock(side_effect=HTTPException(status_code=403, detail="Forbidden"))
    monkeypatch.setattr(bots, "verify_bot_permission", permission)
    monkeypatch.setattr(bots, "run_db", AsyncMock())

    try:
        asyncio.run(bots.campaign_dispatch_plan("bot-1", "campaign-1", USER))
        assert False, "expected permission failure"
    except HTTPException as exc:
        assert exc.status_code == 403
    permission.assert_awaited_once_with("bot-1", USER, "settings")
    bots.run_db.assert_not_awaited()


def test_dispatch_plan_is_preview_after_authorization(monkeypatch):
    permission = AsyncMock(return_value="owner")
    monkeypatch.setattr(bots, "verify_bot_permission", permission)
    monkeypatch.setattr(bots, "run_db", AsyncMock(return_value=SimpleNamespace(data=_campaign())))

    result = asyncio.run(bots.campaign_dispatch_plan("bot-1", "campaign-1", USER))

    permission.assert_awaited_once_with("bot-1", USER, "settings")
    assert result["campaign_id"] == "campaign-1"
    assert len(result["jobs"]) == 1
    assert result["jobs"][0]["payload"]["channel"] == "web"
