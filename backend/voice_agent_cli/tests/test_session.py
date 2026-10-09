import asyncio
import sys
from types import SimpleNamespace

from voice_agent_cli.organization import OrganizationContext
from voice_agent_cli.session import open_voice_session, record_voice_call


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
        "channel": "voice",
    }


def test_record_voice_call_persists_tenant_scoped_usage(monkeypatch):
    captured = {}

    class FakeQuery:
        def insert(self, payload):
            captured.update(payload)
            return self

        def execute(self):
            return SimpleNamespace(data=[captured])

    class FakeSupabase:
        def table(self, name):
            assert name == "chatty_voice_calls"
            return FakeQuery()

    async def fake_run_db(callback):
        return callback()

    monkeypatch.setattr("voice_agent_cli.session.run_db", fake_run_db)
    organization = OrganizationContext(
        owner_user={"id": "owner-1"},
        bot={"id": "bot-1"},
        modules=SimpleNamespace(supabase=FakeSupabase()),
    )
    usage = SimpleNamespace(
        model_usage=[
            SimpleNamespace(
                model_dump=lambda: {
                    "type": "llm_usage",
                    "provider": "google",
                    "model": "gemini-2.5-flash",
                    "input_tokens": 12,
                    "output_tokens": 7,
                }
            ),
            SimpleNamespace(
                model_dump=lambda: {
                    "type": "tts_usage",
                    "provider": "google",
                    "model": "gemini-3.1-flash-tts-preview",
                    "input_tokens": 3,
                    "output_tokens": 0,
                }
            ),
        ]
    )

    persisted = asyncio.run(
        record_voice_call(
            organization,
            "voice-room-1",
            mode="pipeline",
            duration_seconds=4.5678,
            usage=usage,
            turn_count=2,
        )
    )

    assert persisted is True
    assert captured == {
        "bot_id": "bot-1",
        "session_id": "voice-room-1",
        "mode": "pipeline",
        "provider": "google",
        "model": "gemini-2.5-flash",
        "duration_seconds": 4.568,
        "input_tokens": 15,
        "output_tokens": 7,
        "turn_count": 2,
        "error_count": 0,
    }


def test_record_voice_call_is_best_effort_when_telemetry_schema_is_unavailable(monkeypatch):
    async def failing_run_db(_callback):
        raise RuntimeError("chatty_voice_calls is not available")

    monkeypatch.setattr("voice_agent_cli.session.run_db", failing_run_db)
    organization = OrganizationContext(
        owner_user={"id": "owner-1"},
        bot={"id": "bot-1"},
        modules=SimpleNamespace(supabase=object()),
    )

    assert (
        asyncio.run(
            record_voice_call(
                organization,
                "voice-room-1",
                mode="realtime",
                duration_seconds=1,
                usage=None,
            )
        )
        is False
    )
