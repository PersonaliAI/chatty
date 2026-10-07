import asyncio
from types import SimpleNamespace

from app.services import flow_runtime

from voice_agent_cli.flows import PublishedFlowService
from voice_agent_cli.organization import OrganizationContext


class _Query:
    def insert(self, payload):
        self.payload = payload
        return self

    def execute(self):
        return SimpleNamespace(data=[])


class _Supabase:
    def __init__(self):
        self.query = _Query()

    def table(self, _name):
        return self.query


def test_published_flow_reply_uses_widget_event_and_persists_visitor(monkeypatch):
    captured = {}

    async def fake_run_widget_flow(supabase, **kwargs):
        captured["supabase"] = supabase
        captured.update(kwargs)
        return {"matched": True, "reply": "Flow reply", "error": None}

    monkeypatch.setattr(flow_runtime, "run_widget_flow", fake_run_widget_flow)
    supabase = _Supabase()
    organization = OrganizationContext(
        owner_user={"id": "owner-1"},
        bot={"id": "bot-1"},
        modules=SimpleNamespace(supabase=supabase),
    )

    result = asyncio.run(PublishedFlowService(organization, "session-1").reply_for("hello"))

    assert result == "Flow reply"
    assert captured["event"] == "message.user"
    assert captured["bot_id"] == "bot-1"
    assert captured["data"]["content"] == "hello"
    assert supabase.query.payload["role"] == "user"
    assert supabase.query.payload["sender"] == "visitor"
