"""Security and update semantics for provider-neutral catalog webhooks."""

import hashlib
import hmac
import json
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi.testclient import TestClient

from main import app
from app.core.deps import require_user


BOT_ID = "ad32f373-7694-43f4-9465-f8d65ce291e3"
SECRET = "catalog-secret-for-tests"
client = TestClient(app)


def _signature(raw: bytes) -> str:
    return "sha256=" + hmac.new(SECRET.encode(), raw, hashlib.sha256).hexdigest()


def test_manual_catalog_webhook_provision_returns_url_and_secret():
    app.dependency_overrides[require_user] = lambda: {"id": "user-123"}
    try:
        with patch("app.routers.multimodal.verify_bot_permission", new_callable=AsyncMock) as permission, \
             patch("app.routers.multimodal.encrypt_secret", side_effect=lambda value: value), \
             patch("app.routers.multimodal.run_db", new_callable=AsyncMock) as db:
            db.side_effect = [
                MagicMock(data=[]),
                MagicMock(data=[{"bot_id": BOT_ID}]),
            ]
            response = client.post(f"/api/bots/{BOT_ID}/media-webhook")

        assert response.status_code == 200
        body = response.json()
        assert body["webhook_url"].endswith(f"/api/integrations/catalog/webhook/{BOT_ID}")
        assert body["signing_secret"]
        assert body["enabled"] is True
        permission.assert_awaited_once_with(BOT_ID, {"id": "user-123"}, "sources")
    finally:
        app.dependency_overrides.pop(require_user, None)


def test_manual_catalog_webhook_rejects_bad_signature_and_updates_by_external_id():
    app.dependency_overrides[require_user] = lambda: {"id": "user-123"}
    payload = {
        "event": "product.updated",
        "external_id": "ERP-10042",
        "item": {"price": 79.99, "metadata": {"in_stock": False}},
    }
    raw = json.dumps(payload, separators=(",", ":")).encode()
    try:
        with patch("app.routers.multimodal.run_db", new_callable=AsyncMock) as db, \
             patch("app.routers.multimodal.decrypt_secret", return_value=SECRET):
            db.return_value = MagicMock(data=[{"signing_secret": SECRET, "enabled": True}])
            bad = client.post(
                f"/api/integrations/catalog/webhook/{BOT_ID}",
                content=raw,
                headers={"x-chatty-signature": "sha256=invalid"},
            )
            assert bad.status_code == 401

        with patch("app.routers.multimodal.run_db", new_callable=AsyncMock) as db, \
             patch("app.routers.multimodal.decrypt_secret", return_value=SECRET), \
             patch("app.routers.multimodal.multimodal_service.embed_catalog_item", new_callable=AsyncMock, return_value=[0.1] * 768) as embed:
            db.side_effect = [
                MagicMock(data=[{"signing_secret": SECRET, "enabled": True}]),
                MagicMock(data=[{
                    "id": "item-1",
                    "bot_id": BOT_ID,
                    "title": "Jacket",
                    "price": 49.99,
                    "metadata": {"source": "manual", "external_id": "ERP-10042"},
                }]),
                MagicMock(data=[{"id": "item-1"}]),
            ]
            good = client.post(
                f"/api/integrations/catalog/webhook/{BOT_ID}",
                content=raw,
                headers={"x-chatty-signature": _signature(raw)},
            )

        assert good.status_code == 200
        assert good.json()["event"] == "updated"
        assert good.json()["item_id"] == "item-1"
        embed.assert_awaited_once()
        assert embed.await_args.kwargs["metadata"]["in_stock"] is False
        update_payload = db.call_args_list[-1].args[0] if db.call_args_list else None
        assert update_payload is not None
    finally:
        app.dependency_overrides.pop(require_user, None)


def test_manual_catalog_webhook_rejects_non_object_item():
    payload = {"event": "product.updated", "external_id": "ERP-1", "item": "not-an-object"}
    raw = json.dumps(payload, separators=(",", ":")).encode()
    with patch("app.routers.multimodal.run_db", new_callable=AsyncMock) as db, \
         patch("app.routers.multimodal.decrypt_secret", return_value=SECRET):
        db.return_value = MagicMock(data=[{"signing_secret": SECRET, "enabled": True}])
        response = client.post(
            f"/api/integrations/catalog/webhook/{BOT_ID}",
            content=raw,
            headers={"x-chatty-signature": _signature(raw)},
        )
    assert response.status_code == 400


def test_manual_catalog_webhook_rejects_ambiguous_external_id():
    payload = {"event": "product.updated", "external_id": "ERP-duplicate", "item": {"price": 10}}
    raw = json.dumps(payload, separators=(",", ":")).encode()
    try:
        with patch("app.routers.multimodal.run_db", new_callable=AsyncMock) as db, \
             patch("app.routers.multimodal.decrypt_secret", return_value=SECRET):
            db.side_effect = [
                MagicMock(data=[{"signing_secret": SECRET, "enabled": True}]),
                MagicMock(data=[
                    {"id": "item-1", "metadata": {"external_id": "ERP-duplicate"}},
                    {"id": "item-2", "metadata": {"external_id": "ERP-duplicate"}},
                ]),
            ]
            response = client.post(
                f"/api/integrations/catalog/webhook/{BOT_ID}",
                content=raw,
                headers={"x-chatty-signature": _signature(raw)},
            )
        assert response.status_code == 409
        assert "not unique" in response.json()["detail"]
    finally:
        app.dependency_overrides.pop(require_user, None)
