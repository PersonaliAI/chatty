"""Tests for the Bot Claim and Outreach Transfer system."""

import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient

import main
from app.routers.claim import _mint_demo_widget_token


def test_claim_openapi_routes_registered():
    client = TestClient(main.app)
    r = client.get("/openapi.json")
    assert r.status_code == 200
    paths = r.json()["paths"]
    assert "/api/claim/{claim_token}" in paths
    assert "/api/claim/generate" in paths


def test_mint_demo_widget_token():
    token = _mint_demo_widget_token("test-bot-123")
    assert token is not None
    assert isinstance(token, str)


def test_get_claim_details_not_found():
    client = TestClient(main.app)
    with patch("app.routers.claim.run_db") as mock_db:
        # Mock empty return from database
        mock_res = MagicMock()
        mock_res.data = []
        mock_db.return_value = mock_res
        
        response = client.get("/api/claim/clm_non_existent_token")
        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()


def test_get_claim_details_success():
    client = TestClient(main.app)
    with patch("app.routers.claim.run_db") as mock_db:
        bot_mock = MagicMock()
        bot_mock.data = [{
            "id": "11111111-2222-3333-4444-555555555555",
            "name": "Supadata Assistant",
            "welcome_message": "Hi, how can I help?",
            "primary_color": "#2563eb",
            "avatar_url": None,
            "avatar_icon": "bot",
            "claim_status": "unclaimed",
            "claimed_at": None,
            "demo_target_name": "Supadata",
            "demo_target_url": "https://supadata.ai",
            "demo_expires_at": "2030-01-01T00:00:00Z",
            "suggested_prompts": ["What is Supadata?", "Show pricing"],
            "created_at": "2026-10-14T00:00:00Z"
        }]

        sources_mock = MagicMock()
        sources_mock.data = [
            {"name": "Home Page", "type": "url", "status": "trained", "char_count": 1200},
            {"name": "Pricing", "type": "url", "status": "trained", "char_count": 800}
        ]

        mock_db.side_effect = [bot_mock, sources_mock]

        response = client.get("/api/claim/clm_valid_test_token")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "unclaimed"
        assert data["demo_target_name"] == "Supadata"
        assert data["sources_count"] == 2
        assert len(data["suggested_prompts"]) == 2
        assert data["widget_token"] is not None


def test_claim_bot_transfer_success():
    from app.core.deps import require_user
    client = TestClient(main.app)
    main.app.dependency_overrides[require_user] = lambda: {
        "auth_user_id": "user-uuid-999",
        "email": "founder@supadata.ai",
    }
    try:
        with patch("app.routers.claim.run_db") as mock_db:
            # 1. Fetch bot
            bot_mock = MagicMock()
            bot_mock.data = [{
                "id": "11111111-2222-3333-4444-555555555555",
                "name": "Supadata Assistant",
                "user_id": "admin-uuid",
                "claim_status": "unclaimed",
                "demo_expires_at": "2030-01-01T00:00:00Z"
            }]

            # 2. Update bot
            update_mock = MagicMock()
            update_mock.data = [{"id": "11111111-2222-3333-4444-555555555555"}]

            # 3. Upsert team member
            team_mock = MagicMock()
            team_mock.data = [{"id": "team-member-1"}]

            mock_db.side_effect = [bot_mock, update_mock, team_mock]

            response = client.post(
                "/api/claim/clm_valid_test_token",
                headers={"Authorization": "Bearer mock-token"}
            )
            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True
            assert "transferred" in data["message"].lower()
            assert "claimed=1" in data["dashboard_url"]
    finally:
        main.app.dependency_overrides.pop(require_user, None)


def test_decline_and_delete_demo_bot():
    client = TestClient(main.app)
    with patch("app.routers.claim.run_db") as mock_db:
        bot_mock = MagicMock()
        bot_mock.data = [{
            "id": "11111111-2222-3333-4444-555555555555",
            "name": "Supadata Assistant",
            "claim_status": "unclaimed"
        }]

        delete_mock = MagicMock()
        delete_mock.data = [{"id": "11111111-2222-3333-4444-555555555555"}]

        mock_db.side_effect = [bot_mock, delete_mock]

        response = client.delete("/api/claim/clm_valid_test_token")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "permanently deleted" in data["message"].lower()
