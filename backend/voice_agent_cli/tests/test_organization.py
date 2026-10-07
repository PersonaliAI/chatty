import asyncio
from types import SimpleNamespace

from voice_agent_cli.config import VoiceSettings
from voice_agent_cli.organization import OrganizationError, OrganizationRepository


class _Result:
    def __init__(self, data):
        self.data = data


class _Query:
    def __init__(self, table, rows):
        self.table = table
        self.rows = rows
        self.filters = []

    def select(self, _columns):
        return self

    def ilike(self, column, value):
        self.filters.append((column, value))
        return self

    def eq(self, column, value):
        self.filters.append((column, value))
        return self

    def order(self, _column, desc=False):
        return self

    def limit(self, _count):
        return self

    def execute(self):
        rows = self.rows
        for column, value in self.filters:
            rows = [
                row
                for row in rows
                if str(row.get(column, "")).lower() == str(value).lower()
            ]
        return _Result(rows)


class _Supabase:
    def __init__(self):
        self.tables = {
            "users": [{"id": "owner-1", "email": "personaliai.com@gmail.com"}],
            "chatty_bots": [{"id": "bot-1", "user_id": "owner-1", "name": "Chatty"}],
        }

    def table(self, name):
        return _Query(name, self.tables[name])


def test_resolver_is_bound_to_the_configured_owner(monkeypatch):
    supabase = _Supabase()

    async def run_db(fn):
        return fn()

    modules = SimpleNamespace(
        supabase=supabase,
        run_db=run_db,
        agent_tools=None,
        doc_rag=None,
        widget_brain=None,
    )
    monkeypatch.setattr(
        "voice_agent_cli.organization.load_chatty_core", lambda _settings: modules
    )
    settings = VoiceSettings.from_env(env_file="")

    organization = asyncio.run(
        OrganizationRepository(settings, load_plugins=False).resolve()
    )

    assert organization.owner_user["email"] == "personaliai.com@gmail.com"
    assert organization.bot["user_id"] == organization.owner_user["id"]


def test_resolver_rejects_ambiguous_bot_selection(monkeypatch):
    supabase = _Supabase()
    supabase.tables["chatty_bots"].append(
        {"id": "bot-2", "user_id": "owner-1", "name": "Second"}
    )

    async def run_db(fn):
        return fn()

    modules = SimpleNamespace(
        supabase=supabase,
        run_db=run_db,
        agent_tools=None,
        doc_rag=None,
        widget_brain=None,
    )
    monkeypatch.setattr(
        "voice_agent_cli.organization.load_chatty_core", lambda _settings: modules
    )

    try:
        asyncio.run(
            OrganizationRepository(
                VoiceSettings.from_env(env_file=""), load_plugins=False
            ).resolve()
        )
    except OrganizationError as exc:
        assert "CHATTY_BOT_ID" in str(exc)
    else:
        raise AssertionError("ambiguous bot selection was not rejected")
