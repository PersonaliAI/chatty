import time
from unittest.mock import AsyncMock, patch
import pytest
from fastapi.testclient import TestClient

from main import app
from app.routers.woocommerce import _generate_auth_state, _verify_auth_state

client = TestClient(app)

BOT_ID = "ad32f373-7694-43f4-9465-f8d65ce291e3"
STORE_URL = "https://example-shop.com"


def test_auth_state_generation_and_verification():
    state = _generate_auth_state(BOT_ID, STORE_URL)
    assert state
    assert "." in state

    bot_id, store_url = _verify_auth_state(state)
    assert bot_id == BOT_ID
    assert store_url == STORE_URL


def test_auth_state_tampering():
    state = _generate_auth_state(BOT_ID, STORE_URL)
    payload_b64, sig = state.split(".", 1)

    # Tamper with payload
    tampered_state = f"{payload_b64}x.{sig}"
    bot_id, store_url = _verify_auth_state(tampered_state)
    assert bot_id is None
    assert store_url is None

    # Tamper with signature
    tampered_sig = f"{payload_b64}.badsignature123"
    bot_id, store_url = _verify_auth_state(tampered_sig)
    assert bot_id is None
    assert store_url is None


def test_auth_state_expiry():
    state = _generate_auth_state(BOT_ID, STORE_URL)
    # Test with max_age_seconds = 0 (immediately expired)
    time.sleep(0.01)
    bot_id, store_url = _verify_auth_state(state, max_age_seconds=0)
    assert bot_id is None
    assert store_url is None


def test_auth_state_malformed():
    assert _verify_auth_state("") == (None, None)
    assert _verify_auth_state("invalid") == (None, None)
    assert _verify_auth_state("a.b.c") == (None, None)


from app.core.deps import require_user


def test_get_woocommerce_authorize_url():
    app.dependency_overrides[require_user] = lambda: {"id": "user-123"}
    try:
        with patch("app.routers.woocommerce.verify_bot_permission", new_callable=AsyncMock):
            resp = client.post(
                f"/api/bots/{BOT_ID}/integrations/woocommerce/authorize-url",
                json={"store_url": "https://mystore.com", "return_url": "/dashboard?tab=catalog"},
            )
            assert resp.status_code == 200
            data = resp.json()
            assert "authorize_url" in data
            assert "state" in data
            assert "mystore.com/wc-auth/v1/authorize" in data["authorize_url"]
            assert "scope=read_write" in data["authorize_url"]
            assert "callback_url=" in data["authorize_url"]
            assert "return_url=" in data["authorize_url"]
    finally:
        app.dependency_overrides.pop(require_user, None)


def test_woocommerce_auth_callback_success():
    state = _generate_auth_state(BOT_ID, STORE_URL)

    with patch("app.routers.woocommerce.run_db", new_callable=AsyncMock) as mock_db, \
         patch("app.routers.woocommerce.woocommerce_service.save_integration", new_callable=AsyncMock) as mock_save, \
         patch("app.routers.woocommerce.woocommerce_service.run_woocommerce_sync_task", new_callable=AsyncMock) as mock_sync:

        class MockRes:
            data = [{"id": BOT_ID}]

        mock_db.return_value = MockRes()
        mock_save.return_value = {"bot_id": BOT_ID, "store_url": STORE_URL}

        resp = client.post(
            "/api/integrations/woocommerce/auth-callback",
            json={
                "key_id": 42,
                "user_id": state,
                "consumer_key": "ck_test1234567890",
                "consumer_secret": "cs_test1234567890",
                "key_permissions": "read_write",
            },
        )
        assert resp.status_code == 200
        assert resp.json() == {"status": "ok", "bot_id": BOT_ID, "store_url": STORE_URL}
        mock_save.assert_called_once_with(
            bot_id=BOT_ID,
            store_url=STORE_URL,
            consumer_key="ck_test1234567890",
            consumer_secret="cs_test1234567890",
        )
        mock_sync.assert_called_once_with(BOT_ID)


def test_woocommerce_auth_callback_invalid_state():
    resp = client.post(
        "/api/integrations/woocommerce/auth-callback",
        json={
            "key_id": 42,
            "user_id": "invalid.state",
            "consumer_key": "ck_test1234567890",
            "consumer_secret": "cs_test1234567890",
        },
    )
    assert resp.status_code == 400
    assert "Invalid or expired authorization state" in resp.text
