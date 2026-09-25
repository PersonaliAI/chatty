import asyncio
import inspect
import time
from unittest.mock import AsyncMock, patch
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from main import app
from app.routers.woocommerce import _generate_auth_state, _verify_auth_state
from app.routers import woocommerce as woocommerce_router

client = TestClient(app)

BOT_ID = "ad32f373-7694-43f4-9465-f8d65ce291e3"
STORE_URL = "https://example-shop.com"
SECRET = "woocommerce-secret-for-tests"


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


def test_woocommerce_sync_uses_durable_queue_when_configured():
    class FakeQueue:
        def __init__(self):
            self.calls = []

        async def enqueue(self, **kwargs):
            self.calls.append(kwargs)
            return "1-0"

    queue = FakeQueue()
    with patch.object(woocommerce_router, "_commerce_job_queue", queue), \
         patch.object(woocommerce_router.woocommerce_service, "get_integration", new_callable=AsyncMock) as get_integration, \
         patch.object(woocommerce_router.asyncio, "create_task") as create_task:
        get_integration.return_value = {"store_url": STORE_URL}
        mode = asyncio.run(woocommerce_router._start_woocommerce_sync(BOT_ID))

    assert mode == "queued"
    assert queue.calls[0] == {
        "name": "woocommerce.sync",
        "payload": {"bot_id": BOT_ID, "concurrency_key": f"woocommerce:{STORE_URL.lower()}"},
        "idempotency_key": f"woocommerce.sync:{BOT_ID}",
    }
    create_task.assert_not_called()


def test_woocommerce_sync_does_not_fall_back_to_ephemeral_task_when_queue_fails():
    class BrokenQueue:
        async def enqueue(self, **kwargs):
            raise RuntimeError("redis unavailable")

    with patch.object(woocommerce_router, "_commerce_job_queue", BrokenQueue()), \
         patch.object(woocommerce_router.asyncio, "create_task") as create_task:
        with pytest.raises(HTTPException) as exc_info:
            asyncio.run(woocommerce_router._start_woocommerce_sync(BOT_ID))

    assert exc_info.value.status_code == 503
    create_task.assert_not_called()


def test_woocommerce_bulk_sync_keeps_tls_certificate_verification_enabled():
    source = inspect.getsource(woocommerce_router.woocommerce_service.run_woocommerce_sync_task)
    assert "verify=False" not in source


def test_woocommerce_outbound_requests_use_pinned_ssrf_guard():
    service = woocommerce_router.woocommerce_service
    assert "ssrf.request_async" in inspect.getsource(service.verify_credentials)
    assert "ssrf.request_async" in inspect.getsource(service._fetch_product_variations)
    assert "ssrf.request_async" in inspect.getsource(service.run_woocommerce_sync_task)


def test_woocommerce_webhook_rejects_missing_signature():
    with patch.object(woocommerce_router.woocommerce_service, "get_integration", new_callable=AsyncMock) as get_integration, \
         patch.object(woocommerce_router.woocommerce_service, "process_webhook_payload", new_callable=AsyncMock) as process:
        get_integration.return_value = {"webhook_secret": SECRET}
        response = client.post(
            f"/api/integrations/woocommerce/webhook/{BOT_ID}",
            json={"id": 42, "name": "Untrusted"},
        )

    assert response.status_code == 401
    assert "Missing webhook signature" in response.text
    process.assert_not_awaited()


def test_woocommerce_webhook_claims_and_deduplicates_delivery():
    class Response:
        def __init__(self, data):
            self.data = data

    with patch.object(woocommerce_router, "run_db", new_callable=AsyncMock) as db:
        db.side_effect = [Response([{"id": "event-1"}]), Response([])]
        assert asyncio.run(
            woocommerce_router._claim_woocommerce_webhook(BOT_ID, "wc-delivery-1")
        ) is True
        assert asyncio.run(
            woocommerce_router._claim_woocommerce_webhook(BOT_ID, "wc-delivery-1")
        ) is False
        assert db.await_count == 2


from app.core.deps import require_user


def test_get_woocommerce_authorize_url():
    app.dependency_overrides[require_user] = lambda: {"id": "user-123"}
    try:
        with patch("app.routers.woocommerce.verify_bot_permission", new_callable=AsyncMock), \
             patch("app.routers.woocommerce.ssrf.assert_safe_url_async", new_callable=AsyncMock):
            resp = client.post(
                f"/api/bots/{BOT_ID}/integrations/woocommerce/authorize-url",
                json={"store_url": "https://mystore.com", "return_url": "/dashboard?tab=catalog"},
            )
            assert resp.status_code == 200
            data = resp.json()
            assert "authorize_url" in data
            assert "state" in data
            assert "mystore.com/wc-auth/v1/authorize" in data["authorize_url"]
            assert "scope=read" in data["authorize_url"]
            assert "callback_url=" in data["authorize_url"]
            assert "return_url=" in data["authorize_url"]
    finally:
        app.dependency_overrides.pop(require_user, None)


def test_get_woocommerce_status_uses_sources_permission():
    """The catalog status route must pass the required permission tab."""
    app.dependency_overrides[require_user] = lambda: {"auth_user_id": "user-123", "id": "user-123"}
    try:
        with patch("app.routers.woocommerce.verify_bot_permission", new_callable=AsyncMock) as mock_permission, \
             patch("app.routers.woocommerce.woocommerce_service.get_integration", new_callable=AsyncMock, return_value=None), \
             patch("app.routers.woocommerce.run_db", new_callable=AsyncMock) as mock_db:
            mock_db.return_value = type("Result", (), {"count": 0, "data": []})()
            resp = client.get(f"/api/bots/{BOT_ID}/integrations/woocommerce")

        assert resp.status_code == 200
        mock_permission.assert_awaited_once_with(BOT_ID, {"auth_user_id": "user-123", "id": "user-123"}, "sources")
        assert resp.json()["connected"] is False
    finally:
        app.dependency_overrides.pop(require_user, None)


def test_get_woocommerce_authorize_url_rejects_non_https():
    app.dependency_overrides[require_user] = lambda: {"id": "user-123"}
    try:
        with patch("app.routers.woocommerce.verify_bot_permission", new_callable=AsyncMock):
            resp = client.post(
                f"/api/bots/{BOT_ID}/integrations/woocommerce/authorize-url",
                json={"store_url": "http://mystore.com"},
            )
        assert resp.status_code == 400
        assert "HTTPS" in resp.text
    finally:
        app.dependency_overrides.pop(require_user, None)


def test_woocommerce_auth_callback_success():
    state = _generate_auth_state(BOT_ID, STORE_URL)

    with patch("app.routers.woocommerce.run_db", new_callable=AsyncMock) as mock_db, \
         patch("app.routers.woocommerce.woocommerce_service.save_integration", new_callable=AsyncMock) as mock_save, \
         patch("app.routers.woocommerce.woocommerce_service.run_woocommerce_sync_task", new_callable=AsyncMock) as mock_sync, \
         patch("app.routers.woocommerce.ssrf.assert_safe_url_async", new_callable=AsyncMock):

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
                "key_permissions": "read",
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


def test_woocommerce_auth_callback_rejects_write_credentials():
    state = _generate_auth_state(BOT_ID, STORE_URL)
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
    assert resp.status_code == 400
    assert "read-only" in resp.text


def test_woocommerce_auth_callback_rejects_non_https_state_url():
    state = _generate_auth_state(BOT_ID, "http://example-shop.com")
    resp = client.post(
        "/api/integrations/woocommerce/auth-callback",
        json={
            "user_id": state,
            "consumer_key": "ck_test1234567890",
            "consumer_secret": "cs_test1234567890",
        },
    )
    assert resp.status_code == 400
    assert "HTTPS" in resp.text
