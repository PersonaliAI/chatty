import asyncio
import base64
import json
import sys
from types import SimpleNamespace

from voice_agent_cli.media import VoiceMediaBuffer
from voice_agent_cli.organization import OrganizationContext
from voice_agent_cli.tools import ChattyToolRegistry, _bounded_limit, _normalize_spoken_email


def test_catalog_tool_forwards_pending_image_to_chatty_retriever(monkeypatch):
    captured = {}

    async def fake_search(**kwargs):
        captured.update(kwargs)
        return ([{"id": "item-1", "title": "Red shoe"}], {"color": "red"})

    monkeypatch.setitem(
        sys.modules,
        "app.services.multimodal_service",
        SimpleNamespace(search_multimodal_catalog=fake_search),
    )
    media = VoiceMediaBuffer()
    media.accept_packet(
        json.dumps(
            {
                "mime_type": "image/jpeg",
                "data": base64.b64encode(b"jpeg-bytes").decode("ascii"),
            }
        )
    )
    modules = SimpleNamespace(
        agent_tools=SimpleNamespace(DECLARATIONS=[]),
        widget_brain=SimpleNamespace(scheduling_tool_names=lambda *_args: []),
        supabase="fake-supabase",
    )
    organization = OrganizationContext(
        owner_user={"id": "owner-1"},
        bot={"id": "bot-1"},
        modules=modules,
    )

    tools = ChattyToolRegistry(
        organization, "session-1", media_buffer=media
    ).build()
    catalog_tool = next(tool for tool in tools if tool.info.name == "search_catalog")
    result = asyncio.run(catalog_tool(None, {"query": "find this shoe"}))

    output = json.loads(result)
    assert output["items"][0]["id"] == "item-1"
    assert captured["bot_id"] == "bot-1"
    assert captured["session_id"] == "session-1"
    assert captured["image_bytes"] == b"jpeg-bytes"
    assert captured["mime_type"] == "image/jpeg"
    assert media.take_image() is None


def test_voice_tool_limits_are_safe_for_malformed_model_arguments():
    assert _bounded_limit("not-a-number", default=5, maximum=10) == 5
    assert _bounded_limit("999", default=5, maximum=10) == 10
    assert _bounded_limit("0", default=5, maximum=10) == 1
    assert _normalize_spoken_email("Alex at example dot com") == "alex@example.com"


def test_catalog_tool_returns_safe_error_for_empty_query(monkeypatch):
    async def should_not_search(**_kwargs):
        raise AssertionError("empty catalog queries must not reach the retriever")

    monkeypatch.setitem(
        sys.modules,
        "app.services.multimodal_service",
        SimpleNamespace(search_multimodal_catalog=should_not_search),
    )
    modules = SimpleNamespace(
        agent_tools=SimpleNamespace(DECLARATIONS=[]),
        widget_brain=SimpleNamespace(scheduling_tool_names=lambda *_args: []),
        supabase="fake-supabase",
    )
    organization = OrganizationContext(
        owner_user={"id": "owner-1"},
        bot={"id": "bot-1"},
        modules=modules,
    )

    catalog_tool = next(
        tool
        for tool in ChattyToolRegistry(organization, "session-1").build()
        if tool.info.name == "search_catalog"
    )
    output = json.loads(asyncio.run(catalog_tool(None, {"query": "", "limit": "three"})))

    assert output == {"error": "A catalog-search question is required."}


def test_lead_tool_requires_confirmation_and_injects_signed_session_context():
    calls = []

    async def execute(name, arguments, **kwargs):
        calls.append((name, arguments, kwargs))
        return {"created": True}

    modules = SimpleNamespace(
        agent_tools=SimpleNamespace(
            DECLARATIONS=[
                {
                    "function": {
                        "name": "create_lead",
                        "description": "Create a lead.",
                        "parameters": {
                            "type": "object",
                            "properties": {
                                "name": {"type": "string"},
                                "email": {"type": "string"},
                            },
                            "required": ["name", "email"],
                        },
                    }
                }
            ],
            execute=execute,
        ),
        widget_brain=SimpleNamespace(
            scheduling_tool_names=lambda *_args: ["create_lead"]
        ),
        supabase="fake-supabase",
    )
    organization = OrganizationContext(
        owner_user={"id": "owner-1"},
        bot={"id": "bot-1"},
        modules=modules,
    )
    lead_tool = next(
        tool
        for tool in ChattyToolRegistry(
            organization, "session-1", visitor_timezone="Asia/Colombo"
        ).build()
        if tool.info.name == "create_lead"
    )

    not_confirmed = json.loads(
        asyncio.run(
            lead_tool(
                None,
                {"name": "Alex", "email": "Alex at example dot com", "confirmed": False},
            )
        )
    )
    assert "not confirmed" in not_confirmed["error"]
    assert calls == []

    confirmed = json.loads(
        asyncio.run(
            lead_tool(
                None,
                {"name": "Alex", "email": "Alex at example dot com", "confirmed": True},
            )
        )
    )
    assert confirmed == {"created": True}
    assert calls[0][0] == "create_lead"
    assert calls[0][1]["email"] == "alex@example.com"
    assert calls[0][1]["bot_id"] == "bot-1"
    assert calls[0][1]["session_id"] == "session-1"
    assert calls[0][2]["context"]["channel"] == "voice"
    assert calls[0][2]["context"]["visitor_timezone"] == "Asia/Colombo"
