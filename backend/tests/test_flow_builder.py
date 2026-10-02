import pytest
from fastapi import HTTPException

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


def test_flow_trace_is_topological_and_rejects_cycles():
    graph = _graph()
    assert [step["node_id"] for step in _flow_trace(graph)] == ["trigger", "action"]

    with pytest.raises(HTTPException, match="cycle"):
        _flow_trace({"nodes": graph["nodes"], "edges": [{"from": "trigger", "to": "action"}, {"from": "action", "to": "trigger"}]})
