import asyncio
import base64
import json
import sys
from types import SimpleNamespace

from voice_agent_cli.media import VoiceMediaBuffer
from voice_agent_cli.organization import OrganizationContext
from voice_agent_cli.tools import ChattyToolRegistry


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
