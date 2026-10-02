"""Tests for n8n Automation Engine integration in Chatty."""

import asyncio
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
