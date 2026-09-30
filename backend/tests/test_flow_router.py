import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock
import pytest

from fastapi import HTTPException

from app.routers import bots


USER = {"auth_user_id": "operator-1", "email": "operator@example.com"}


def test_flow_run_detail_requires_bot_ownership(monkeypatch):
    permission = AsyncMock(side_effect=HTTPException(status_code=403, detail="Forbidden"))
    monkeypatch.setattr(bots, "verify_bot_permission", permission)
    monkeypatch.setattr(bots, "run_db", AsyncMock())
    try:
        asyncio.run(bots.get_dashboard_flow_run("bot-1", "run-1", USER))
        assert False, "expected permission failure"
    except HTTPException as exc:
        assert exc.status_code == 403


def test_flow_run_detail_returns_immutable_trace(monkeypatch):
    monkeypatch.setattr(bots, "verify_bot_permission", AsyncMock(return_value="owner"))
    monkeypatch.setattr(bots, "run_db", AsyncMock(return_value=SimpleNamespace(data={
        "id": "run-1", "status": "failed", "trace": [{"node_id": "webhook", "runtime": {"outcome": "timeout"}}],
        "flow_data": {"nodes": [], "edges": []},
    })))
    result = asyncio.run(bots.get_dashboard_flow_run("bot-1", "run-1", USER))
    assert result["trace"][0]["runtime"]["outcome"] == "timeout"
    assert result["flow_data"]["nodes"] == []


def test_flow_run_list_rejects_unknown_status_before_query(monkeypatch):
    monkeypatch.setattr(bots, "verify_bot_permission", AsyncMock(return_value="owner"))
    database = AsyncMock()
    monkeypatch.setattr(bots, "run_db", database)
    try:
        asyncio.run(bots.list_dashboard_flow_runs("bot-1", 50, "running", USER))
        assert False, "expected invalid status"
    except HTTPException as exc:
        assert exc.status_code == 422
    database.assert_not_awaited()


def test_simulation_persists_redacted_context_without_mutating_request(monkeypatch):
    from app.routers.bots import FlowSimulationRequest

    captured = {}

    class Table:
        def insert(self, payload):
            captured.update(payload)
            return self

        def execute(self):
            return SimpleNamespace(data=[{"id": "run-1"}])

    async def database(operation):
        return operation()

    monkeypatch.setattr(bots, "verify_bot_permission", AsyncMock(return_value="owner"))
    monkeypatch.setattr(bots, "run_db", database)
    monkeypatch.setattr(bots, "supabase", SimpleNamespace(table=lambda _: Table()))
    body = FlowSimulationRequest(nodes=[{"id": "start", "type": "start", "data": {}}],
                                 edges=[], context={"crm": {"api_key": "private-value", "name": "CRM"}})
    asyncio.run(bots.simulate_dashboard_flow("bot-1", body, USER, flow_override=None))
    assert captured["flow_data"]["simulation_context"] == {"crm": {"api_key": "[redacted]", "name": "CRM"}}
    assert body.context["crm"]["api_key"] == "private-value"


def test_unhandled_retry_failure_does_not_follow_success_edge(monkeypatch):
    from app.routers.bots import FlowSimulationRequest
    monkeypatch.setattr(bots, "verify_bot_permission", AsyncMock(return_value="owner"))
    database = AsyncMock(return_value=SimpleNamespace(data=[{"id": "run-1"}]))
    monkeypatch.setattr(bots, "run_db", database)
    body = FlowSimulationRequest(nodes=[
        {"id": "start", "type": "start", "data": {}},
        {"id": "retry", "type": "retry", "data": {"config": {"max_attempts": 2, "simulate_failures": 2}}},
        {"id": "success", "type": "message", "data": {}},
    ], edges=[{"id": "e1", "source": "start", "target": "retry"},
              {"id": "e2", "source": "retry", "target": "success", "label": "success"}])
    result = asyncio.run(bots.simulate_dashboard_flow("bot-1", body, USER, flow_override=None))
    assert not result["completed"]
    assert "unhandled retry failure" in result["error"]
    assert [step["node_id"] for step in result["execution_path"]] == ["start", "retry"]


@pytest.mark.parametrize("failures, expected", [(0, "success"), (2, "error")])
def test_retry_output_is_selected_by_outcome_not_edge_order(monkeypatch, failures, expected):
    monkeypatch.setattr(bots, "verify_bot_permission", AsyncMock(return_value="owner"))
    monkeypatch.setattr(bots, "run_db", AsyncMock(return_value=SimpleNamespace(data=[{"id": "run-1"}])))
    body = bots.FlowSimulationRequest(nodes=[
        {"id": "start", "type": "start", "data": {}},
        {"id": "retry", "type": "retry", "data": {"config": {"max_attempts": 2, "simulate_failures": failures}}},
        {"id": "success", "type": "message", "data": {}},
        {"id": "error", "type": "message", "data": {}},
    ], edges=[{"id": "start-edge", "source": "start", "target": "retry"},
              {"id": "error-edge", "source": "retry", "target": "error", "label": "error"},
              {"id": "success-edge", "source": "retry", "target": "success", "label": "success"}])
    result = asyncio.run(bots.simulate_dashboard_flow("bot-1", body, USER, flow_override=None))
    assert result["completed"]
    assert [step["node_id"] for step in result["execution_path"]] == ["start", "retry", expected]
