import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
import pytest
import main  # noqa: F401
from app.routers.admin import account_gdpr_export, account_gdpr_delete, AccountDeletionRequest
from fastapi import HTTPException


def test_account_gdpr_export_aggregates_all_resources(monkeypatch):
    user = {"auth_user_id": "usr_gdpr_1", "email": "founder@example.com"}

    fake_user_profile = {"id": "u1", "auth_user_id": "usr_gdpr_1", "email": "founder@example.com", "name": "Founder", "plan": "chatty_business", "role": "user", "created_at": "2026-01-01T00:00:00Z"}
    fake_bots = [{"id": "bot_1", "name": "Bot One", "user_id": "usr_gdpr_1"}, {"id": "bot_2", "name": "Bot Two", "user_id": "usr_gdpr_1"}]
    fake_sources = [{"id": "s1", "bot_id": "bot_1", "name": "FAQ", "type": "text", "status": "trained", "char_count": 100}]
    fake_conv = [{"id": "c1", "bot_id": "bot_1", "session_id": "s-1", "role": "user", "content": "hi"}]
    fake_sess = [{"id": "sess_1", "bot_id": "bot_1", "session_id": "s-1", "visitor_name": "Alice"}]
    fake_leads = [{"id": "l1", "bot_id": "bot_1", "email": "alice@example.com"}]
    fake_meetings = [{"id": "m1", "bot_id": "bot_1", "attendee_name": "Alice"}]
    fake_logs = [{"id": "log1", "bot_id": "bot_1", "action": "bot_created"}]

    class FakeQuery:
        def __init__(self, data): self._data = data
        def select(self, *_): return self
        def eq(self, *_): return self
        def in_(self, *_): return self
        def limit(self, *_): return self
        def execute(self):
            return type("Resp", (), {"data": self._data})()

    class FakeSupabase:
        def table(self, name):
            if name == "users": return FakeQuery([fake_user_profile])
            if name == "chatty_bots": return FakeQuery(fake_bots)
            if name == "chatty_sources": return FakeQuery(fake_sources)
            if name == "chatty_conversations": return FakeQuery(fake_conv)
            if name == "chatty_sessions": return FakeQuery(fake_sess)
            if name == "chatty_leads": return FakeQuery(fake_leads)
            if name == "chatty_meetings": return FakeQuery(fake_meetings)
            if name == "admin_audit_logs": return FakeQuery(fake_logs)
            return FakeQuery([])

    monkeypatch.setattr("app.routers.admin.supabase", FakeSupabase())
    monkeypatch.setattr("app.routers.admin.run_db", lambda cb: asyncio.sleep(0, result=cb()))

    res = asyncio.run(account_gdpr_export(user=user))
    assert res.status_code == 200
    import json
    data = json.loads(res.body.decode("utf-8"))
    assert data["account_profile"]["email"] == "founder@example.com"
    assert data["summary_counts"]["chatbots"] == 2
    assert data["summary_counts"]["knowledge_sources"] == 1
    assert data["summary_counts"]["conversations"] == 1
    assert data["summary_counts"]["leads"] == 1


def test_account_gdpr_delete_requires_exact_confirmation(monkeypatch):
    user = {"auth_user_id": "usr_gdpr_2", "email": "delete@example.com"}
    req = AccountDeletionRequest(confirmation="delete please")

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(account_gdpr_delete(req=req, user=user))
    assert exc_info.value.status_code == 400
    assert "DELETE MY ACCOUNT" in exc_info.value.detail


def test_account_gdpr_delete_executes_cascading_deletion(monkeypatch):
    user = {"auth_user_id": "usr_gdpr_3", "email": "goodbye@example.com"}
    req = AccountDeletionRequest(confirmation="DELETE MY ACCOUNT")

    fake_bots = [{"id": "bot_to_delete"}]
    deleted_tables = []

    class FakeQuery:
        def __init__(self, name): self._name = name
        def select(self, *_): return self
        def eq(self, *_): return self
        def in_(self, *_): return self
        def delete(self):
            deleted_tables.append(self._name)
            return self
        def execute(self):
            if self._name == "chatty_bots" and "chatty_bots" not in deleted_tables:
                return type("Resp", (), {"data": fake_bots})()
            return type("Resp", (), {"data": []})()

    class FakeAuthAdmin:
        def __init__(self):
            self.deleted_user_id = None
        def delete_user(self, uid):
            self.deleted_user_id = uid

    fake_auth_admin = FakeAuthAdmin()

    class FakeSupabase:
        def __init__(self):
            self.auth = type("Auth", (), {"admin": fake_auth_admin})()
        def table(self, name):
            return FakeQuery(name)

    monkeypatch.setattr("app.routers.admin.supabase", FakeSupabase())
    monkeypatch.setattr("app.routers.admin.run_db", lambda cb: asyncio.sleep(0, result=cb()))

    res = asyncio.run(account_gdpr_delete(req=req, user=user))
    assert res["success"] is True
    assert "permanently deleted" in res["message"]
    assert "chatty_conversations" in deleted_tables
    assert "chatty_bots" in deleted_tables
    assert "users" in deleted_tables
    assert fake_auth_admin.deleted_user_id == "usr_gdpr_3"
