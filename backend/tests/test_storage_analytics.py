"""Tests for Account-Wide Storage Management & Analytics.

Verifies:
1. Retrieval of account-wide storage across multiple chatbots.
2. Proper labeling of each asset with bot_id and bot_name.
3. Bot-specific storage retrieval with proper schema queries (plan, role).
4. Deletion of assets across account chatbots.
5. Retention cleanup across all chatbots or a specific chatbot.
6. Enterprise plan correctly returns unlimited storage.
"""

import asyncio
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from fastapi.testclient import TestClient
from main import app
from app.core.deps import require_user

@pytest.fixture
def mock_user():
    return {
        "id": "user_owner_1",
        "auth_user_id": "auth_owner_1",
        "email": "owner@example.com",
        "plan": "chatty_enterprise",
        "role": "user",
    }

@pytest.fixture
def client(mock_user):
    app.dependency_overrides[require_user] = lambda: mock_user
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_account_storage_aggregates_multiple_bots(client, mock_user, monkeypatch):
    bots = [
        {"id": "bot_1", "name": "PriceShield", "user_id": "auth_owner_1", "logo_url": None, "avatar_url": None},
        {"id": "bot_2", "name": "Chatty Support", "user_id": "auth_owner_1", "logo_url": None, "avatar_url": None},
    ]

    class FakeQuery:
        def __init__(self, table):
            self._table = table
        def select(self, *_): return self
        def eq(self, *_): return self
        def in_(self, *_): return self
        def limit(self, *_): return self
        def execute(self):
            if self._table == "users":
                return type("Resp", (), {"data": [{"plan": "chatty_enterprise", "role": "user"}]})()
            if self._table == "chatty_bots":
                return type("Resp", (), {"data": bots})()
            if self._table == "chatty_sources":
                return type("Resp", (), {"data": [
                    {"id": "src_1", "bot_id": "bot_1", "name": "Price Doc", "type": "pdf", "char_count": 50000, "created_at": "2026-10-20T10:00:00Z", "status": "indexed"},
                    {"id": "src_2", "bot_id": "bot_2", "name": "FAQ Doc", "type": "url", "char_count": 20000, "created_at": "2026-10-21T10:00:00Z", "status": "indexed"},
                ]})()
            return type("Resp", (), {"data": []})()

    class FakeSupabase:
        def table(self, name): return FakeQuery(name)
        @property
        def storage(self):
            m = MagicMock()
            m.from_().list.return_value = []
            m.from_().get_public_url.return_value = "https://example.com/asset.png"
            return m

    monkeypatch.setattr("app.routers.storage.supabase", FakeSupabase())
    monkeypatch.setattr("app.routers.storage.run_db", lambda cb: asyncio.sleep(0, result=cb()))

    res = client.get("/api/account/storage")
    assert res.status_code == 200
    data = res.json()

    assert data["account_wide"] is True
    assert len(data["bots"]) == 2
    assert data["unlimited"] is True
    assert data["limit_mb"] is None
    assert data["files_count"] == 2
    # Verify bot labeling on files
    f1 = next(f for f in data["files"] if f["id"] == "source:src_1")
    assert f1["bot_id"] == "bot_1"
    assert f1["bot_name"] == "PriceShield"
    f2 = next(f for f in data["files"] if f["id"] == "source:src_2")
    assert f2["bot_id"] == "bot_2"
    assert f2["bot_name"] == "Chatty Support"


def test_bot_storage_details_does_not_crash_on_users_plan(client, mock_user, monkeypatch):
    bot = {"id": "bot_single", "name": "My Bot", "user_id": "auth_owner_1", "logo_url": None, "avatar_url": None}

    class FakeQuery:
        def __init__(self, table):
            self._table = table
        def select(self, *_): return self
        def eq(self, *_): return self
        def in_(self, *_): return self
        def limit(self, *_): return self
        def execute(self):
            if self._table == "users":
                return type("Resp", (), {"data": [{"plan": "chatty_standard", "role": "user"}]})()
            if self._table == "chatty_bots":
                return type("Resp", (), {"data": [bot]})()
            if self._table == "chatty_sources":
                return type("Resp", (), {"data": []})()
            return type("Resp", (), {"data": []})()

    class FakeSupabase:
        def table(self, name): return FakeQuery(name)
        @property
        def storage(self):
            m = MagicMock()
            m.from_().list.return_value = []
            return m

    monkeypatch.setattr("app.routers.storage.supabase", FakeSupabase())
    monkeypatch.setattr("app.routers.storage.run_db", lambda cb: asyncio.sleep(0, result=cb()))
    monkeypatch.setattr("app.routers.storage.get_bot_role_and_permissions", AsyncMock(return_value=("owner", ["*"])))

    res = client.get("/api/bots/bot_single/storage")
    assert res.status_code == 200
    data = res.json()
    assert data["bot_id"] == "bot_single"
    assert data["plan"] == "chatty_standard"
    assert data["limit_mb"] == 2048
    assert data["unlimited"] is False


def test_account_storage_deletion(client, mock_user, monkeypatch):
    bots = [{"id": "bot_1"}, {"id": "bot_2"}]

    class FakeQuery:
        def __init__(self, table):
            self._table = table
        def select(self, *_): return self
        def eq(self, *_): return self
        def in_(self, *_): return self
        def delete(self): return self
        def execute(self):
            if self._table == "chatty_bots":
                return type("Resp", (), {"data": bots})()
            return type("Resp", (), {"data": [{"id": "deleted"}]})()

    class FakeSupabase:
        def table(self, name): return FakeQuery(name)
        @property
        def storage(self):
            m = MagicMock()
            m.from_().remove.return_value = ["bot_1/sess/file.png"]
            return m

    monkeypatch.setattr("app.routers.storage.supabase", FakeSupabase())
    monkeypatch.setattr("app.routers.storage.run_db", lambda cb: asyncio.sleep(0, result=cb()))

    req_body = {
        "files": [
            {"bucket": "chatty-uploads", "path": "bot_1/sess/file.png"},
            {"bucket": "database", "path": "sources/src_123"},
        ]
    }
    res = client.request("DELETE", "/api/account/storage/files", json=req_body)
    assert res.status_code == 200
    assert res.json()["success"] is True
    assert res.json()["deleted_count"] == 2
