"""End-to-end integration tests for the Instant Sandbox Demo and Bot Claiming lifecycle.
Verifies the complete flow from public URL submission -> interactive sandbox chat -> user claim transfer.
"""

import pytest
from unittest.mock import MagicMock, patch, AsyncMock
from fastapi.testclient import TestClient

import main
from app.core.deps import require_user


def test_instant_sandbox_to_chat_to_claim_lifecycle():
    client = TestClient(main.app)

    bot_db = {
        "id": "mock-bot-uuid-999",
        "user_id": None,
        "name": "Acme Store Assistant",
        "welcome_message": "Hi! How can I help you today?",
        "primary_color": "#c67139",
        "claim_token": "clm_test_e2e_token_123",
        "claim_status": "unclaimed",
        "demo_target_name": "Acme Store",
        "demo_target_url": "https://acme.example.com",
        "demo_expires_at": "2030-01-01T00:00:00Z",
        "suggested_prompts": ["What do you sell?", "Return policy?"],
        "created_at": "2026-10-29T12:00:00Z",
        "selected_model": "gemini",
        "system_instructions": "You are a customer assistant for Acme Store.",
        "allowed_domains": ["*"],
    }

    # Step 1: Call POST /api/claim/instant-sandbox
    with patch("app.routers.claim.run_db") as mock_claim_db, \
         patch("app.routers.claim.assert_safe_url_async", new_callable=AsyncMock), \
         patch("app.routers.claim._crawl_demo_target_site", new_callable=AsyncMock):

        # Existing query -> empty
        existing_res = MagicMock()
        existing_res.data = []

        # Insert query -> returns created bot
        insert_res = MagicMock()
        insert_res.data = [bot_db]

        mock_claim_db.side_effect = [existing_res, insert_res]

        create_res = client.post("/api/claim/instant-sandbox", json={"url": "https://acme.example.com"})
        assert create_res.status_code == 200, f"Failed sandbox create: {create_res.text}"
        create_data = create_res.json()
        assert create_data["success"] is True
        claim_token = create_data["claim_token"]
        assert claim_token.startswith("clm_")
        bot_db["claim_token"] = claim_token

    # Step 2: Fetch sanitized claim details for the preview screen
    with patch("app.routers.claim.run_db") as mock_claim_db:
        detail_bot_mock = MagicMock()
        detail_bot_mock.data = [bot_db]

        sources_mock = MagicMock()
        sources_mock.data = [{"name": "https://acme.example.com", "char_count": 1200}]

        mock_claim_db.side_effect = [detail_bot_mock, sources_mock]

        get_res = client.get(f"/api/claim/{claim_token}")
        assert get_res.status_code == 200, f"Failed claim details: {get_res.text}"
        detail_data = get_res.json()
        assert detail_data["status"] == "unclaimed"
        assert detail_data["name"] == "Acme Store Assistant"
        widget_token = detail_data["widget_token"]
        assert widget_token is not None

    # Step 3: Interactive Sandbox Chat (widget asking question on an unclaimed demo bot)
    with patch("app.routers.widget.run_db") as mock_widget_db, \
         patch("app.routers.widget.run_widget_assistant", new_callable=AsyncMock) as mock_agent:

        mock_agent.return_value = {
            "reply": "At Acme Store, we ship orders within 24 hours via FedEx and UPS.",
            "sources": [{"title": "Shipping Info", "url": "https://acme.example.com/shipping"}],
            "actions": [],
            "suggested_actions": [],
        }

        # 1. Fetch bot
        bot_res = MagicMock()
        bot_res.data = [bot_db]

        # 2. Session upsert
        sess_res = MagicMock()
        sess_res.data = [{"id": "sess-uuid-1", "bot_id": bot_db["id"], "session_id": "demo-sess-1"}]

        # 3. Insert user conversation message
        conv_user_res = MagicMock()
        conv_user_res.data = [{"id": "conv-1"}]

        # 4. Insert assistant conversation message
        conv_asst_res = MagicMock()
        conv_asst_res.data = [{"id": "conv-2"}]

        mock_widget_db.side_effect = [bot_res, sess_res, conv_user_res, conv_asst_res]

        chat_res = client.post(
            "/api/widget/chat",
            json={
                "bot_id": bot_db["id"],
                "session_id": "demo-sess-1",
                "text": "What are your shipping rates?",
            },
            headers={"x-widget-token": widget_token},
        )
        assert chat_res.status_code == 200, f"Failed widget chat: {chat_res.text}"
        chat_data = chat_res.json()
        assert "FedEx and UPS" in chat_data["reply"]
        assert chat_data["ai_paused"] is False

    # Step 4: Transfer ownership (User claims the bot)
    claimed_user = {
        "auth_user_id": "new-user-uuid-888",
        "email": "storeowner@acme.com",
    }
    main.app.dependency_overrides[require_user] = lambda: claimed_user

    try:
        with patch("app.routers.claim.run_db") as mock_claim_db:
            # 1. Lookup bot by claim token
            lookup_res = MagicMock()
            lookup_res.data = [bot_db]

            # 2. Update bot owner and set claim_status = claimed
            update_bot_res = MagicMock()
            updated_bot = dict(bot_db)
            updated_bot["user_id"] = claimed_user["auth_user_id"]
            updated_bot["claim_status"] = "claimed"
            update_bot_res.data = [updated_bot]

            # 3. Upsert admin team member
            team_res = MagicMock()
            team_res.data = [{"id": "tm-1"}]

            mock_claim_db.side_effect = [lookup_res, update_bot_res, team_res]

            claim_res = client.post(f"/api/claim/{claim_token}")
            assert claim_res.status_code == 200, f"Failed claim transfer: {claim_res.text}"
            claim_data = claim_res.json()
            assert claim_data["success"] is True
            assert "transferred" in claim_data["message"].lower()
            assert "claimed=1" in claim_data["dashboard_url"]

    finally:
        main.app.dependency_overrides.pop(require_user, None)
