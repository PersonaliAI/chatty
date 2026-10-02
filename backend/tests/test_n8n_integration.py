"""Tests for n8n Automation Engine integration in Chatty."""

import asyncio
import pytest
from fastapi import HTTPException
from unittest.mock import AsyncMock, patch, MagicMock
from app.services import n8n_service


def test_n8n_starter_template():
    bot_id = "test-bot-12345678"
    bot_name = "Acme Support Bot"
    template = asyncio.run(n8n_service.get_bot_starter_template(bot_id, bot_name))

    assert "Chatty Bot: Acme Support Bot" in template["name"]
    assert len(template["nodes"]) == 2
    assert template["nodes"][0]["name"] == "Chatty Event Trigger"
    assert template["nodes"][0]["parameters"]["path"] == f"chatty-{bot_id}"
    assert template["nodes"][1]["name"] == "Respond to Chatty"
    assert "Chatty Event Trigger" in template["connections"]


def test_n8n_health_check_ok():
    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_get.return_value = mock_resp

        health = asyncio.run(n8n_service.check_n8n_health())
        assert health["status"] == "ok"
        assert health["reachable"] is True


def test_n8n_health_check_offline():
    with patch("httpx.AsyncClient.get", side_effect=Exception("Connection refused")):
        health = asyncio.run(n8n_service.check_n8n_health())
        assert health["status"] == "unavailable"
        assert health["reachable"] is False


def test_trigger_bot_workflow_success():
    bot_id = "bot-abc-123"
    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"success": True, "lead_id": "crm-999"}
        mock_post.return_value = mock_resp

        result = asyncio.run(n8n_service.trigger_bot_workflow(
            bot_id=bot_id,
            action="lead_captured",
            payload={"email": "visitor@example.com"}
        ))

        assert result["success"] is True
        assert result["lead_id"] == "crm-999"
        mock_post.assert_awaited_once()


def test_trigger_preserves_canonical_event_fields():
    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as post:
        post.return_value = MagicMock(status_code=200)
        post.return_value.json.return_value = {"success": True}
        asyncio.run(n8n_service.trigger_bot_workflow(
            "owned-bot", "lead_captured", {"bot_id": "other-bot", "action": "other"}
        ))
        assert post.call_args.kwargs["json"] == {
            "bot_id": "owned-bot", "action": "lead_captured"
        }


def test_existing_starter_is_reused_by_webhook_path():
    workflow = {"id": "workflow-1", "name": "Renamed workflow", "nodes": [
        {"type": "n8n-nodes-base.webhook", "parameters": {"path": "chatty-owned-bot"}}
    ]}
    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as get, \
         patch("httpx.AsyncClient.post", new_callable=AsyncMock) as post:
        get.return_value = MagicMock(status_code=200)
        get.return_value.json.return_value = {"data": [workflow]}
        result = asyncio.run(n8n_service.get_or_create_bot_workflow("owned-bot", "Bot"))
        assert result["workflow_id"] == "workflow-1"
        assert result["created"] is False
        post.assert_not_awaited()


def test_n8n_bot_access_checks_non_owner_permission():
    from app.routers import n8n
    response = MagicMock(data={"id": "bot", "name": "Bot", "user_id": "owner"})
    with patch.object(n8n, "run_db", new=AsyncMock(return_value=response)), \
         patch("app.core.permissions.verify_bot_permission", new_callable=AsyncMock) as permission:
        permission.side_effect = HTTPException(status_code=403, detail="Access denied")
        with pytest.raises(HTTPException) as error:
            asyncio.run(n8n._verify_bot_access("bot", {"sub": "other"}))
        assert error.value.status_code == 403
        permission.assert_awaited_once_with("bot", {"sub": "other"}, "webhooks")
