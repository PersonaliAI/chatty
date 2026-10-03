import asyncio
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException

from app.routers import flow_builder
from app.routers.flow_builder import _flow_trace, _validate_flow_data


def _graph(*, action_url: str | None = "https://example.com/adapter") -> dict:
    action_config = {"url": action_url} if action_url is not None else {}
    return {
        "nodes": [
            {"id": "trigger", "kind": "trigger", "title": "Webhook", "config": {"event": "lead.created"}},
            {"id": "action", "kind": "action", "title": "Adapter", "config": action_config},
        ],
        "edges": [{"from": "trigger", "to": "action"}],
    }


def test_publish_graph_requires_a_trigger_and_configured_adapter():
    _validate_flow_data(_graph(), require_nodes=True)

    with pytest.raises(HTTPException, match="needs an adapter endpoint"):
        _validate_flow_data(_graph(action_url=None), require_nodes=True)

    with pytest.raises(HTTPException, match="needs at least one trigger"):
        _validate_flow_data({"nodes": [{"id": "action", "kind": "action", "config": {"url": "https://example.com"}}], "edges": []}, require_nodes=True)

    with pytest.raises(HTTPException, match="needs a message"):
        _validate_flow_data({
            "nodes": [
                {"id": "trigger", "kind": "trigger", "config": {"event": "message.user"}},
                {"id": "reply", "type": "chatty.reply", "kind": "chatty", "config": {}},
            ],
            "edges": [{"from": "trigger", "to": "reply"}],
        }, require_nodes=True)


def test_flow_trace_is_topological_and_rejects_cycles():
    graph = _graph()
    assert [step["node_id"] for step in _flow_trace(graph)] == ["trigger", "action"]

    with pytest.raises(HTTPException, match="cycle"):
        _flow_trace({"nodes": graph["nodes"], "edges": [{"from": "trigger", "to": "action"}, {"from": "action", "to": "trigger"}]})


def test_validation_rejects_duplicate_and_self_connections():
    graph = _graph()
    with pytest.raises(HTTPException, match="duplicate"):
        _validate_flow_data({**graph, "edges": graph["edges"] + [{"from": "trigger", "to": "action"}]})

    with pytest.raises(HTTPException, match="itself"):
        _validate_flow_data({**graph, "edges": graph["edges"] + [{"from": "action", "to": "action"}]})


def test_handoff_cannot_cross_bot_tenant(monkeypatch):
    permission = AsyncMock()
    monkeypatch.setattr(flow_builder, "verify_bot_permission", permission)

    with pytest.raises(HTTPException, match="bound to another bot"):
        asyncio.run(flow_builder._authorize("bot-b", {"_flow_handoff_bot_id": "bot-a", "auth_user_id": "user-a"}))

    permission.assert_not_awaited()
