import asyncio
import sys
from types import SimpleNamespace

from voice_agent_cli.conversation import ConversationRecorder, load_chat_context
from voice_agent_cli.organization import OrganizationContext


def test_conversation_recorder_persists_only_user_and_assistant_text(monkeypatch):
    calls = []
    unanswered = []

    class FakeRepository:
        def __init__(self, _supabase):
            pass

        async def append_message(self, **kwargs):
            calls.append(kwargs)

    monkeypatch.setitem(
        sys.modules,
        "app.adapters.supabase_conversations",
        SimpleNamespace(SupabaseConversationRepository=FakeRepository),
    )
    monkeypatch.setitem(
        sys.modules,
        "app.services.widget_session_service",
        SimpleNamespace(
            log_unanswered_if_needed=lambda *args: unanswered.append(args)
        ),
    )
    organization = OrganizationContext(
        owner_user={"id": "owner-1"},
        bot={"id": "bot-1"},
        modules=SimpleNamespace(supabase="fake-supabase"),
    )

    async def exercise():
        recorder = ConversationRecorder(organization, "voice-room-1")
        recorder.handle(
            SimpleNamespace(
                item=SimpleNamespace(role="system", raw_text_content="internal")
            )
        )
        recorder.handle(
            SimpleNamespace(item=SimpleNamespace(role="user", raw_text_content="Hello"))
        )
        recorder.handle(
            SimpleNamespace(
                item=SimpleNamespace(role="assistant", raw_text_content="Hi there")
            )
        )
        await recorder.flush()

    asyncio.run(exercise())

    assert calls == [
        {
            "bot_id": "bot-1",
            "session_id": "voice-room-1",
            "role": "user",
            "content": "Hello",
        },
        {
            "bot_id": "bot-1",
            "session_id": "voice-room-1",
            "role": "assistant",
            "content": "Hi there",
        },
    ]
    assert unanswered == [("bot-1", "voice-room-1", "Hello", "Hi there")]


def test_history_hydration_reuses_chatty_rows(monkeypatch):
    class FakeRepository:
        def __init__(self, _supabase):
            pass

        async def list_history(self, **_kwargs):
            return [
                {"role": "user", "content": "Earlier question"},
                {"role": "assistant", "content": "Earlier answer"},
                {"role": "tool", "content": "internal result"},
            ]

    monkeypatch.setitem(
        sys.modules,
        "app.adapters.supabase_conversations",
        SimpleNamespace(SupabaseConversationRepository=FakeRepository),
    )
    organization = OrganizationContext(
        owner_user={"id": "owner-1"},
        bot={"id": "bot-1"},
        modules=SimpleNamespace(supabase="fake-supabase"),
    )

    context = asyncio.run(load_chat_context(organization, "voice-room-1"))

    assert [
        (message.role, message.raw_text_content) for message in context.messages()
    ] == [
        ("user", "Earlier question"),
        ("assistant", "Earlier answer"),
    ]
