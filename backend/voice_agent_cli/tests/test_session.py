import asyncio
import sys
from types import SimpleNamespace

from voice_agent_cli.organization import OrganizationContext
from voice_agent_cli.session import open_voice_session


def test_voice_session_reuses_chatty_upsert(monkeypatch):
    calls = {}

    async def upsert_session(**kwargs):
        calls.update(kwargs)
        return {"id": "session-row"}, True

    fake_module = SimpleNamespace(upsert_session=upsert_session)
    monkeypatch.setitem(sys.modules, "app.services.widget_session_service", fake_module)
    organization = OrganizationContext(
        owner_user={"id": "owner-1"},
        bot={"id": "bot-1"},
        modules=SimpleNamespace(),
    )

    row = asyncio.run(open_voice_session(organization, "voice-room-1"))

    assert row == {"id": "session-row"}
    assert calls == {
        "bot_id": "bot-1",
        "session_id": "voice-room-1",
        "last_message": "(voice session started)",
        "channel": "web",
    }
