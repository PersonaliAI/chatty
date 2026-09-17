"""Integration tests for AI Copilot, Collision Detection, and Automation endpoints."""

import time
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient
import pytest

from main import app
from app.core.deps import require_user
from app.services.copilot_service import record_viewer_heartbeat, get_active_viewers, _ACTIVE_VIEWERS


@pytest.fixture(autouse=True)
def clean_viewers():
    _ACTIVE_VIEWERS.clear()
    yield
    _ACTIVE_VIEWERS.clear()


def test_collision_heartbeat_and_viewers_direct():
    bot_id = "bot-123"
    session_id = "sess-abc"

    # Agent 1 views
    record_viewer_heartbeat(bot_id, session_id, "agent1@company.com", "Sarah")
    # Agent 2 views
    record_viewer_heartbeat(bot_id, session_id, "agent2@company.com", "John")

    # From Agent 1's perspective, Agent 2 is viewing
    viewers_for_1 = get_active_viewers(bot_id, session_id, current_agent_email="agent1@company.com")
    assert len(viewers_for_1) == 1
    assert viewers_for_1[0]["email"] == "agent2@company.com"
    assert viewers_for_1[0]["name"] == "John"

    # From Agent 2's perspective, Agent 1 is viewing
    viewers_for_2 = get_active_viewers(bot_id, session_id, current_agent_email="agent2@company.com")
    assert len(viewers_for_2) == 1
    assert viewers_for_2[0]["email"] == "agent1@company.com"


def test_collision_viewers_expiry():
    bot_id = "bot-123"
    session_id = "sess-abc"

    # Insert viewer with timestamp 40 seconds in the past
    _ACTIVE_VIEWERS[f"{bot_id}:{session_id}"] = {
        "old_agent@company.com": (time.time() - 40, "Old Agent")
    }

    viewers = get_active_viewers(bot_id, session_id, current_agent_email="active@company.com")
    assert len(viewers) == 0  # Expired after 35s


def test_automation_rules_api():
    client = TestClient(app)
    mock_user = {"auth_user_id": "test-user-id", "email": "admin@example.com"}
    app.dependency_overrides[require_user] = lambda: mock_user

    with patch("app.routers.admin.verify_bot_permission", new_callable=AsyncMock) as mock_perm, \
         patch("app.routers.admin._write_admin_audit_log", new_callable=AsyncMock):
        mock_perm.return_value = "owner"

        try:
            bot_id = "test-bot-rules"
            # 1. Create automation rule
            create_res = client.post("/api/admin/automation-rules", json={
                "bot_id": bot_id,
                "name": "Auto-flag VIP",
                "event_type": "session_created",
                "condition_match": "all",
                "conditions": [
                    {"field": "visitor_email", "operator": "contains", "value": "@vip.com"}
                ],
                "actions": [
                    {"type": "set_priority", "value": "urgent"},
                    {"type": "add_tag", "value": "VIP"},
                ],
                "is_active": True,
            })
            assert create_res.status_code == 200
            data = create_res.json()
            assert data["success"] is True
            rule_id = data["rule"]["id"]

            # 2. List rules
            list_res = client.get(f"/api/admin/automation-rules?bot_id={bot_id}")
            assert list_res.status_code == 200
            rules = list_res.json()["rules"]
            assert len(rules) == 1
            assert rules[0]["id"] == rule_id

            # 3. Test evaluate dry-run
            test_res = client.post("/api/admin/automation-rules/test", json={
                "bot_id": bot_id,
                "event_type": "session_created",
                "session": {"visitor_email": "ceo@vip.com", "priority": "normal"},
                "context": {},
            })
            assert test_res.status_code == 200
            t_data = test_res.json()
            assert t_data["resulting_updates"]["priority"] == "urgent"
            assert "VIP" in t_data["resulting_updates"]["tags"]

            # 4. Delete rule
            del_res = client.delete(f"/api/admin/automation-rules/{rule_id}?bot_id={bot_id}")
            assert del_res.status_code == 200
            assert del_res.json()["success"] is True

            # Verify empty
            list_res2 = client.get(f"/api/admin/automation-rules?bot_id={bot_id}")
            assert len(list_res2.json()["rules"]) == 0
        finally:
            app.dependency_overrides.pop(require_user, None)


@pytest.mark.anyio
async def test_copilot_draft_reply_service():
    from unittest.mock import MagicMock
    from app.services.copilot_service import generate_ai_draft_reply

    with patch("app.services.copilot_service.run_db") as mock_db, \
         patch("plugins.ai_client.chat") as mock_chat:
        mock_db.return_value = MagicMock(data=[
            {"role": "user", "content": "How do I return an item?", "sender": "user"},
        ])
        mock_choice = MagicMock()
        mock_choice.message.content = "You can return any item within 30 days of delivery by visiting our portal."
        mock_chat.return_value = MagicMock(choices=[mock_choice])

        result = await generate_ai_draft_reply("bot-1", "sess-1")
        assert "within 30 days" in result["draft"]


@pytest.mark.anyio
async def test_copilot_summarize_service():
    from unittest.mock import MagicMock
    from app.services.copilot_service import generate_conversation_summary

    with patch("app.services.copilot_service.run_db") as mock_db, \
         patch("plugins.ai_client.chat") as mock_chat:
        mock_db.return_value = MagicMock(data=[
            {"role": "user", "content": "My payment failed", "sender": "user"},
            {"role": "assistant", "content": "I updated your billing card", "sender": "agent"},
        ])
        mock_choice = MagicMock()
        mock_choice.message.content = "• Inquiry: Payment failed.\n• Discussion: Updated billing card.\n• Status: Resolved.\nSENTIMENT: satisfied"
        mock_chat.return_value = MagicMock(choices=[mock_choice])

        result = await generate_conversation_summary("bot-1", "sess-1")
        assert "Payment failed" in result["summary"]
        assert result["sentiment"] == "satisfied"
        assert result["message_count"] == 2
