import asyncio

from app.core import db_pool, permissions


class _Cursor:
    def __init__(self, rows):
        self.rows = iter(rows)
        self.executed = []

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def execute(self, sql, params):
        self.executed.append((sql, params))

    def fetchone(self):
        return next(self.rows)


class _Connection:
    def __init__(self, cursor):
        self._cursor = cursor

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def cursor(self, **_kwargs):
        return self._cursor


def test_self_host_owner_permission_uses_postgres(monkeypatch):
    cursor = _Cursor([{"id": "bot-1"}])
    monkeypatch.setattr(permissions, "DEPLOYMENT_PROFILE", "self_host")
    monkeypatch.setattr(db_pool, "connection", lambda: _Connection(cursor))

    async def immediate(fn):
        return fn()

    monkeypatch.setattr(permissions, "run_db", immediate)
    role, granted = asyncio.run(
        permissions.get_bot_role_and_permissions(
            "bot-1", {"auth_user_id": "owner-1", "email": "owner@example.com"}
        )
    )

    assert role == "owner"
    assert set(granted) == set(permissions.ALL_TABS)
    assert cursor.executed[0][1] == ("bot-1", "owner-1")


def test_self_host_member_permission_is_case_insensitive(monkeypatch):
    cursor = _Cursor([None, {"role": "admin", "permissions": ["settings"]}])
    monkeypatch.setattr(permissions, "DEPLOYMENT_PROFILE", "self_host")
    monkeypatch.setattr(db_pool, "connection", lambda: _Connection(cursor))

    async def immediate(fn):
        return fn()

    monkeypatch.setattr(permissions, "run_db", immediate)
    role, granted = asyncio.run(
        permissions.get_bot_role_and_permissions(
            "bot-1", {"auth_user_id": "member-1", "email": "Member@Example.com"}
        )
    )

    assert role == "admin"
    assert granted == ["settings"]
    assert cursor.executed[1][1] == ("bot-1", "member@example.com")
