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


def test_create_instant_sandbox_bot_success():
    client = TestClient(main.app)
    with patch("app.routers.claim.run_db") as mock_db, \
         patch("app.routers.claim.assert_safe_url_async") as mock_ssrf, \
         patch("app.routers.claim._crawl_demo_target_site") as mock_crawl:
        
        # 1. Check existing bots (empty)
        existing_mock = MagicMock()
        existing_mock.data = []

        # 2. Insert new bot
        insert_mock = MagicMock()
        insert_mock.data = [{
            "id": "22222222-3333-4444-5555-666666666666",
            "name": "Nike Assistant",
            "claim_token": "clm_test_sandbox_123"
        }]

        mock_db.side_effect = [existing_mock, insert_mock]

        response = client.post(
            "/api/claim/instant-sandbox",
            json={"url": "https://nike.com"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "claim_token" in data
        assert "/claim/" in data["claim_url"]
        assert data["target_name"] == "Nike"


def test_create_instant_sandbox_bot_empty_url():
    client = TestClient(main.app)
    response = client.post(
        "/api/claim/instant-sandbox",
        json={"url": "   "}
    )
    assert response.status_code == 400
    assert "valid website url" in response.json()["detail"].lower()



def test_generate_claimable_bot_forbidden_for_non_admin():
    from app.core.deps import require_user
    client = TestClient(main.app)
    main.app.dependency_overrides[require_user] = lambda: {
        "auth_user_id": "regular-user-123",
        "email": "regular@example.com",
        "role": "user",
    }
    try:
        response = client.post(
            "/api/claim/generate",
            json={
                "target_name": "Acme",
                "target_url": "https://acme.com",
            },
            headers={"Authorization": "Bearer mock-token"},
        )
        assert response.status_code == 403
        assert "only platform administrators" in response.json()["detail"].lower()
    finally:
        main.app.dependency_overrides.pop(require_user, None)


def test_generate_claimable_bot_allowed_for_admin():
    from app.core.deps import require_user
    client = TestClient(main.app)
    main.app.dependency_overrides[require_user] = lambda: {
        "auth_user_id": "admin-user-123",
        "email": "personaliai.com@gmail.com",
        "role": "admin",
    }
    try:
        with patch("app.routers.claim.run_db") as mock_db,              patch("app.routers.claim.assert_safe_url_async"):
            insert_mock = MagicMock()
            insert_mock.data = [{
                "id": "bot-admin-123",
                "claim_token": "clm_admin_test_123",
            }]
            mock_db.return_value = insert_mock

            response = client.post(
                "/api/claim/generate",
                json={
                    "target_name": "Acme",
                    "target_url": "https://acme.com",
                },
                headers={"Authorization": "Bearer mock-token"},
            )
            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True
            assert data["claim_token"].startswith("clm_")
            assert "/claim/" in data["claim_url"]
    finally:
        main.app.dependency_overrides.pop(require_user, None)


def test_heuristic_prompts_developer_and_ai_avoid_shipping():
    from app.routers.claim import _heuristic_prompts_from_content

    # Technical platform
    dev_content = "Welcome to Acme Dev. Read our API documentation, SDKs, and REST endpoints for developers."
    dev_prompts = _heuristic_prompts_from_content("Acme Dev", dev_content)
    assert len(dev_prompts) == 3
    assert any("api" in p.lower() or "developer" in p.lower() for p in dev_prompts)
    assert not any("shipping" in p.lower() or "return" in p.lower() or "place an order" in p.lower() for p in dev_prompts)

    # Search & AI Cloud platform (like Baidu)
    ai_content = "Baidu is an artificial intelligence and internet search engine company providing cloud compute and LLMs."
    ai_prompts = _heuristic_prompts_from_content("Baidu", ai_content)
    assert len(ai_prompts) == 3
    assert any("ai" in p.lower() or "cloud" in p.lower() or "products" in p.lower() for p in ai_prompts)
    assert not any("shipping" in p.lower() or "return" in p.lower() or "place an order" in p.lower() for p in ai_prompts)


def test_heuristic_prompts_ecommerce_allows_shipping():
    from app.routers.claim import _heuristic_prompts_from_content

    shop_content = "Exclusive streetwear store. Add to cart, fast checkout, 30-day return policy and shipping details."
    shop_prompts = _heuristic_prompts_from_content("Streetwear Co", shop_content)
    assert len(shop_prompts) == 3
    assert any("shipping" in p.lower() or "return" in p.lower() for p in shop_prompts)


@pytest.mark.anyio
async def test_extract_dynamic_prompts_llm_json_parsing():
    from unittest.mock import AsyncMock, patch
    from app.routers.claim import _extract_dynamic_prompts_from_content

    mock_resp = MagicMock()
    mock_choice = MagicMock()
    mock_choice.message.content = '["What is your core LLM model?", "How can I deploy models on your cloud?", "What are the API pricing tiers?"]'
    mock_resp.choices = [mock_choice]

    with patch("plugins.ai_client.resolve_gemini_model", return_value="gemini/gemini-2.5-flash"), \
         patch("plugins.ai_client.chat", new_callable=AsyncMock) as mock_chat:
        mock_chat.return_value = mock_resp

        prompts = await _extract_dynamic_prompts_from_content(
            bot_id="bot-test-123",
            target_url="https://cloud.example.com",
            content="Enterprise cloud computing and LLM model deployment."
        )

        assert len(prompts) == 3
        assert "What is your core LLM model?" in prompts
        assert "What are the API pricing tiers?" in prompts


@pytest.mark.anyio
async def test_extract_dynamic_prompts_fallback_on_failure():
    from unittest.mock import AsyncMock, patch
    from app.routers.claim import _extract_dynamic_prompts_from_content

    with patch("plugins.ai_client.resolve_gemini_model", side_effect=Exception("API Key unavailable")):
        prompts = await _extract_dynamic_prompts_from_content(
            bot_id="bot-test-123",
            target_url="https://dentalcare.example.com",
            content="Welcome to Dental Care Clinic. We provide patient appointments, dental treatments, and doctor visits."
        )

        assert len(prompts) == 3
        assert any("dental" in p.lower() or "healthcare" in p.lower() or "appointment" in p.lower() for p in prompts)
        assert not any("shipping" in p.lower() for p in prompts)

