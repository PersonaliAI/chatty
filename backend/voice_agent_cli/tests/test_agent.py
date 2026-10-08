import asyncio
import base64
import json
from types import SimpleNamespace

from livekit.agents import llm

from voice_agent_cli.agent import ChattyVoiceAgent
from voice_agent_cli.config import VoiceSettings
from voice_agent_cli.media import VoiceMediaBuffer
from voice_agent_cli.organization import OrganizationContext


def test_agent_builds_tenant_scoped_voice_tools_without_network():
    declarations = [
        {
            "type": "function",
            "function": {
                "name": "create_lead",
                "description": "Record a lead",
                "parameters": {
                    "type": "object",
                    "properties": {},
                    "required": [],
                },
            },
        }
    ]
    modules = SimpleNamespace(
        agent_tools=SimpleNamespace(DECLARATIONS=declarations),
        widget_brain=SimpleNamespace(
            scheduling_tool_names=lambda _bot, _owner: ["create_lead"]
        ),
        supabase=None,
        run_db=None,
        doc_rag=None,
    )
    organization = OrganizationContext(
        owner_user={"email": "personaliai.com@gmail.com"},
        bot={"id": "bot-1", "name": "Test bot", "answer_mode": "strict"},
        modules=modules,
    )

    agent = ChattyVoiceAgent(
        organization,
        VoiceSettings.from_env(env_file=""),
        "session-1",
    )

    assert [tool.info.name for tool in agent.tools] == [
        "create_lead",
        "search_knowledge",
        "search_catalog",
    ]


def test_business_tool_passes_trusted_tenant_context():
    captured = {}

    async def execute(name, arguments, *, user, supabase, context):
        captured.update(
            name=name,
            arguments=arguments,
            user=user,
            supabase=supabase,
            context=context,
        )
        return {"ok": True}

    modules = SimpleNamespace(
        agent_tools=SimpleNamespace(
            DECLARATIONS=[
                {
                    "type": "function",
                    "function": {
                        "name": "create_lead",
                        "description": "Record a lead",
                        "parameters": {
                            "type": "object",
                            "properties": {"bot_id": {"type": "string"}},
                            "required": [],
                        },
                    },
                }
            ],
            execute=execute,
        ),
        widget_brain=SimpleNamespace(
            scheduling_tool_names=lambda _bot, _owner: ["create_lead"]
        ),
        supabase="fake-supabase",
        run_db=None,
        doc_rag=None,
    )
    organization = OrganizationContext(
        owner_user={"id": "owner-1"},
        bot={"id": "bot-1", "answer_mode": "strict"},
        modules=modules,
    )
    tool = ChattyVoiceAgent(
        organization,
        VoiceSettings.from_env(env_file=""),
        "session-1",
    ).tools[0]

    result = asyncio.run(
        tool(
            None,
            {
                "bot_id": "attacker-bot",
                "name": "Visitor",
                "email": "visitor@example.com",
                "confirmed": True,
            },
        )
    )

    assert result == '{"ok": true}'
    assert captured["arguments"] == {
        "bot_id": "bot-1",
        "session_id": "session-1",
        "name": "Visitor",
        "email": "visitor@example.com",
    }
    assert captured["context"]["bot_id"] == "bot-1"
    assert captured["context"]["source"] == "widget"
    assert captured["context"]["channel"] == "voice"


def test_voice_lead_tool_requires_explicit_confirmation():
    modules = SimpleNamespace(
        agent_tools=SimpleNamespace(
            DECLARATIONS=[
                {
                    "type": "function",
                    "function": {
                        "name": "create_lead",
                        "description": "Record a lead",
                        "parameters": {
                            "type": "object",
                            "properties": {},
                            "required": [],
                        },
                    },
                }
            ],
            execute=lambda *args, **kwargs: {"unexpected": True},
        ),
        widget_brain=SimpleNamespace(
            scheduling_tool_names=lambda _bot, _owner: ["create_lead"]
        ),
        supabase="fake-supabase",
        run_db=None,
        doc_rag=None,
    )
    organization = OrganizationContext(
        owner_user={"id": "owner-1"},
        bot={"id": "bot-1", "answer_mode": "strict"},
        modules=modules,
    )
    tool = ChattyVoiceAgent(
        organization,
        VoiceSettings.from_env(env_file=""),
        "session-1",
    ).tools[0]

    result = asyncio.run(tool(None, {"name": "Visitor", "email": "visitor@example.com"}))

    assert "not confirmed" in result


def test_voice_lead_tool_rejects_missing_required_details_after_confirmation():
    modules = SimpleNamespace(
        agent_tools=SimpleNamespace(
            DECLARATIONS=[
                {
                    "type": "function",
                    "function": {
                        "name": "create_lead",
                        "description": "Record a lead",
                        "parameters": {"type": "object", "properties": {}, "required": []},
                    },
                }
            ],
            execute=lambda *args, **kwargs: {"unexpected": True},
        ),
        widget_brain=SimpleNamespace(
            scheduling_tool_names=lambda _bot, _owner: ["create_lead"]
        ),
        supabase="fake-supabase",
        run_db=None,
        doc_rag=None,
    )
    organization = OrganizationContext(
        owner_user={"id": "owner-1"},
        bot={"id": "bot-1", "answer_mode": "strict"},
        modules=modules,
    )
    tool = ChattyVoiceAgent(
        organization,
        VoiceSettings.from_env(env_file=""),
        "session-1",
    ).tools[0]

    result = asyncio.run(tool(None, {"name": "Visitor", "confirmed": True}))

    assert "email is required" in result


def test_voice_lead_tool_rejects_malformed_email_after_confirmation():
    modules = SimpleNamespace(
        agent_tools=SimpleNamespace(
            DECLARATIONS=[
                {
                    "type": "function",
                    "function": {
                        "name": "create_lead",
                        "description": "Record a lead",
                        "parameters": {"type": "object", "properties": {}, "required": []},
                    },
                }
            ],
            execute=lambda *args, **kwargs: {"unexpected": True},
        ),
        widget_brain=SimpleNamespace(
            scheduling_tool_names=lambda _bot, _owner: ["create_lead"]
        ),
        supabase="fake-supabase",
        run_db=None,
        doc_rag=None,
    )
    organization = OrganizationContext(
        owner_user={"id": "owner-1"},
        bot={"id": "bot-1", "answer_mode": "strict"},
        modules=modules,
    )
    tool = ChattyVoiceAgent(
        organization,
        VoiceSettings.from_env(env_file=""),
        "session-1",
    ).tools[0]

    result = asyncio.run(
        tool(
            None,
            {"name": "Visitor", "email": "not-an-email", "confirmed": True},
        )
    )

    assert "email address is invalid" in result


def test_agent_uses_chatty_bot_prompt_and_greeting_fields():
    modules = SimpleNamespace(
        agent_tools=SimpleNamespace(DECLARATIONS=[]),
        widget_brain=SimpleNamespace(scheduling_tool_names=lambda _bot, _owner: []),
        supabase=None,
        run_db=None,
        doc_rag=None,
    )
    organization = OrganizationContext(
        owner_user={"email": "personaliai.com@gmail.com"},
        bot={
            "id": "bot-1",
            "name": "Configured bot",
            "welcome_message": "Welcome to the configured bot.",
            "system_instructions": "Use a calm, professional tone.",
            "response_language": "English",
            "guardrail_topics": "politics",
            "lead_capture_enabled": False,
        },
        modules=modules,
    )

    agent = ChattyVoiceAgent(
        organization, VoiceSettings.from_env(env_file=""), "session-1"
    )

    assert agent.greeting == "Welcome to the configured bot."
    assert "Use a calm, professional tone." in agent.instructions
    assert "Always reply in English" in agent.instructions
    assert (
        "Never discuss or give opinions on these configured topics: politics"
        in agent.instructions
    )
    assert "Lead capture is disabled" in agent.instructions


def test_agent_attaches_pending_image_to_vertex_turn(monkeypatch):
    modules = SimpleNamespace(
        agent_tools=SimpleNamespace(DECLARATIONS=[]),
        widget_brain=SimpleNamespace(scheduling_tool_names=lambda _bot, _owner: []),
        supabase=None,
        run_db=None,
        doc_rag=None,
    )
    organization = OrganizationContext(
        owner_user={"email": "personaliai.com@gmail.com"},
        bot={"id": "bot-1", "answer_mode": "strict"},
        modules=modules,
    )
    media = VoiceMediaBuffer()
    assert media.accept_packet(
        json.dumps(
            {
                "mime_type": "image/png",
                "data": base64.b64encode(b"image-bytes").decode("ascii"),
            }
        )
    )
    monkeypatch.setattr(
        "voice_agent_cli.agent.maybe_escalate", _async_false
    )
    monkeypatch.setattr(
        "voice_agent_cli.flows.PublishedFlowService.reply_for", _async_empty
    )

    agent = ChattyVoiceAgent(
        organization,
        VoiceSettings.from_env(env_file=""),
        "session-1",
        media_buffer=media,
    )

    async def fake_search(_query):
        return {"context": "", "sources": []}

    agent.knowledge.search = fake_search
    message = llm.ChatMessage(role="user", content=["what is this?"])
    asyncio.run(agent.on_user_turn_completed(llm.ChatContext(), message))

    image = next(content for content in message.content if isinstance(content, llm.ImageContent))
    assert image.mime_type == "image/png"
    assert image.image == (
        "data:image/png;base64," + base64.b64encode(b"image-bytes").decode("ascii")
    )
    provider_turns, _ = llm.ChatContext(items=[message]).to_provider_format(
        format="google"
    )
    assert any(
        "inline_data" in part for part in provider_turns[0]["parts"]
    )


async def _async_false(*_args, **_kwargs):
    return False


async def _async_empty(*_args, **_kwargs):
    return ""
