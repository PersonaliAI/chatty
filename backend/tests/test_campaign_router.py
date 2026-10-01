import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
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


def test_dispatch_plan_expands_consented_provider_jobs_without_pii(monkeypatch):
    permission = AsyncMock(return_value="owner")
    monkeypatch.setattr(bots, "verify_bot_permission", permission)
    campaign = {
        **_campaign(),
        "sequence_steps": [{"channel": "email", "after_minutes": 0, "message": "Hi"}],
        "audience_rules": {"recipient_source": "consented_leads", "segment": "all"},
    }
    monkeypatch.setattr(bots, "run_db", AsyncMock(return_value=SimpleNamespace(data=campaign)))
    monkeypatch.setattr(
        bots,
        "load_consented_lead_recipients",
        AsyncMock(return_value=[{"id": "lead-1", "email": "secret@example.com", "consent": True}]),
    )

    result = asyncio.run(bots.campaign_dispatch_plan("bot-1", "campaign-1", USER))

    assert len(result["jobs"]) == 1
    recipient = result["jobs"][0]["payload"]["recipient"]
    assert recipient == {"id": "lead-1", "consent": True, "has_email": True, "has_phone": False}
    assert "secret@example.com" not in str(result)


def test_dispatch_plan_defers_provider_without_consent_audience(monkeypatch):
    permission = AsyncMock(return_value="owner")
    monkeypatch.setattr(bots, "verify_bot_permission", permission)
    campaign = {
        **_campaign(),
        "sequence_steps": [{"channel": "sms", "after_minutes": 0, "message": "Hi"}],
        "audience_rules": {"recipient_source": "widget"},
    }
    monkeypatch.setattr(bots, "run_db", AsyncMock(return_value=SimpleNamespace(data=campaign)))

    result = asyncio.run(bots.campaign_dispatch_plan("bot-1", "campaign-1", USER))

    assert result["deferred"] is True
    assert result["deferred_reason"] == "provider delivery requires consented_leads recipient source"


def test_delivery_history_is_sanitized_and_bounded(monkeypatch):
    permission = AsyncMock(return_value="owner")
    monkeypatch.setattr(bots, "verify_bot_permission", permission)
    database = AsyncMock(side_effect=[
        SimpleNamespace(data={"id": "campaign-1"}),
        SimpleNamespace(data=[{
            "id": "delivery-1", "idempotency_key": "campaign.dispatch:key",
            "status": "failed", "channel": "email", "recipient_id": "lead-1",
            "error": "provider unavailable", "updated_at": "2026-09-30T10:00:00Z",
        }]),
    ])
    monkeypatch.setattr(bots, "run_db", database)

    result = asyncio.run(bots.campaign_delivery_history("bot-1", "campaign-1", 100, USER))

    assert result["available"] is True
    assert result["deliveries"][0]["recipient_id"] == "lead-1"
    assert "@" not in str(result["deliveries"][0])
    assert database.await_count == 2


def test_delivery_history_accepts_status_filter(monkeypatch):
    permission = AsyncMock(return_value="owner")
    monkeypatch.setattr(bots, "verify_bot_permission", permission)
    database = AsyncMock(side_effect=[
        SimpleNamespace(data={"id": "campaign-1"}),
        SimpleNamespace(data=[]),
    ])
    monkeypatch.setattr(bots, "run_db", database)

    result = asyncio.run(bots.campaign_delivery_history(
        "bot-1", "campaign-1", 25, USER, status="failed"
    ))

    assert result == {"campaign_id": "campaign-1", "available": True, "deliveries": []}
    assert database.await_count == 2


def test_campaign_sequence_update_merges_channels(monkeypatch):
    monkeypatch.setattr(bots, "verify_bot_permission", AsyncMock(return_value="owner"))
    captured = {}

    class Table:
        def select(self, *_):
            return self

        def update(self, payload):
            captured.update(payload)
            return self

        def eq(self, *_):
            return self

        def maybe_single(self):
            return self

        def execute(self):
            return SimpleNamespace(data=(
                {"start_date": None, "end_date": None, "channels": ["web"], "sequence_steps": []}
                if not captured else [{"id": "campaign-1", **captured}]
            ))

    monkeypatch.setattr(bots, "supabase", SimpleNamespace(table=lambda _: Table()))

    async def database(operation):
        return operation()

    monkeypatch.setattr(bots, "run_db", database)
    body = bots.CampaignUpdateRequest(sequence_steps=[{"channel": "email", "after_minutes": 0}])

    result = asyncio.run(bots.update_dashboard_campaign("bot-1", "campaign-1", body, USER))

    assert result["channels"] == ["web", "email"]
    assert captured["channels"] == ["web", "email"]


def test_campaign_update_rejects_more_than_four_merged_channels(monkeypatch):
    monkeypatch.setattr(bots, "verify_bot_permission", AsyncMock(return_value="owner"))
    database = AsyncMock(return_value=SimpleNamespace(data={
        "start_date": None, "end_date": None,
        "channels": ["web", "email", "sms", "push"],
        "sequence_steps": [],
    }))
    monkeypatch.setattr(bots, "run_db", database)
    body = bots.CampaignUpdateRequest(sequence_steps=[{"channel": "whatsapp", "after_minutes": 0}])
    with pytest.raises(HTTPException) as error:
        asyncio.run(bots.update_dashboard_campaign("bot-1", "campaign-1", body, USER))
    assert error.value.status_code == 422
    assert database.await_count == 1


def test_ai_campaign_suggestion_returns_canonical_validated_draft(monkeypatch):
    monkeypatch.setattr(bots, "verify_bot_permission", AsyncMock(return_value="owner"))
    monkeypatch.setattr(bots.ai_client, "resolve_gemini_model", lambda value: value)
    monkeypatch.setattr(bots.ai_client, "chat", AsyncMock(return_value=SimpleNamespace(
        choices=[SimpleNamespace(message=SimpleNamespace(content='''{"name":"Nurture","campaign_type":"chat_bubble","message_content":"Hello","trigger_type":"time_on_page","trigger_value":"12","url_patterns":["/pricing"],"sequence_steps":[{"channel":"EMAIL","after_minutes":"15","message":"Follow up"}]}'''))]
    )))

    result = asyncio.run(bots.suggest_dashboard_campaign(
        "bot-1", bots.CampaignSuggestRequest(goal="Recover pricing-page visitors"), USER
    ))

    assert result["channels"] == ["web", "email"]
    assert result["sequence_steps"] == [{"channel": "email", "after_minutes": 15, "message": "Follow up"}]
    assert result["trigger_value"] == 12
