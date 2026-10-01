import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock
import pytest

from fastapi import HTTPException

from app.routers import bots


USER = {"auth_user_id": "operator-1", "email": "operator@example.com"}


@pytest.mark.parametrize("snapshot", [None, {}, {"nodes": []}, "invalid"])
def test_replay_missing_snapshot_never_runs_current_workflow(monkeypatch, snapshot):
    monkeypatch.setattr(bots, "verify_bot_permission", AsyncMock(return_value="owner"))
    monkeypatch.setattr(bots, "run_db", AsyncMock(return_value=SimpleNamespace(data={"flow_data": snapshot})))
    simulate = AsyncMock()
    monkeypatch.setattr(bots, "simulate_dashboard_flow", simulate)
    with pytest.raises(HTTPException) as error:
        asyncio.run(bots.replay_dashboard_flow_run("bot-1", "run-1", USER))
    assert error.value.status_code == 409
    simulate.assert_not_awaited()


def test_replay_uses_saved_snapshot_and_inputs(monkeypatch):
    snapshot = {"nodes": [{"id": "start", "type": "start"}], "edges": [],
                "simulation_context": {"name": "Ari"}}
    monkeypatch.setattr(bots, "verify_bot_permission", AsyncMock(return_value="owner"))
    monkeypatch.setattr(bots, "run_db", AsyncMock(return_value=SimpleNamespace(
        data={"flow_data": snapshot, "inputs": ["saved input"]})))
    simulate = AsyncMock(return_value={"completed": True})
    monkeypatch.setattr(bots, "simulate_dashboard_flow", simulate)
    result = asyncio.run(bots.replay_dashboard_flow_run("bot-1", "run-1", USER))
    assert result["replayed_from_snapshot"] is True
    assert simulate.await_args.kwargs["flow_override"] == snapshot
    assert simulate.await_args.args[1].inputs == ["saved input"]
    assert simulate.await_args.args[1].context == {"name": "Ari"}


def test_replay_permission_failure_prevents_snapshot_read(monkeypatch):
    monkeypatch.setattr(bots, "verify_bot_permission", AsyncMock(side_effect=HTTPException(403, "Forbidden")))
    database = AsyncMock()
    monkeypatch.setattr(bots, "run_db", database)
    with pytest.raises(HTTPException) as error:
        asyncio.run(bots.replay_dashboard_flow_run("bot-1", "run-1", USER))
    assert error.value.status_code == 403
    database.assert_not_awaited()


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


def test_flow_run_detail_reports_missing_history_migration(monkeypatch):
    class MissingHistoryError(Exception):
        pass

    monkeypatch.setattr(bots, "PostgrestAPIError", MissingHistoryError)
    monkeypatch.setattr(bots, "verify_bot_permission", AsyncMock(return_value="owner"))
    monkeypatch.setattr(
        bots,
        "run_db",
        AsyncMock(side_effect=MissingHistoryError("PGRST205 chatty_flow_runs not found")),
    )
    with pytest.raises(HTTPException) as error:
        asyncio.run(bots.get_dashboard_flow_run("bot-1", "run-1", USER))
    assert error.value.status_code == 503
    assert "chatty_flow_runs migration" in error.value.detail


def test_flow_run_replay_reports_missing_history_migration(monkeypatch):
    class MissingHistoryError(Exception):
        pass

    monkeypatch.setattr(bots, "PostgrestAPIError", MissingHistoryError)
    monkeypatch.setattr(bots, "verify_bot_permission", AsyncMock(return_value="owner"))
    monkeypatch.setattr(
        bots,
        "run_db",
        AsyncMock(side_effect=MissingHistoryError("PGRST205 chatty_flow_runs not found")),
    )
    with pytest.raises(HTTPException) as error:
        asyncio.run(bots.replay_dashboard_flow_run("bot-1", "run-1", USER))
    assert error.value.status_code == 503
    assert "chatty_flow_runs migration" in error.value.detail


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


def test_publishing_flow_rejects_unsafe_webhook_target(monkeypatch):
    monkeypatch.setattr(bots, "verify_bot_permission", AsyncMock(return_value="owner"))
    monkeypatch.setattr(
        bots,
        "assert_safe_url_async",
        AsyncMock(side_effect=bots.UnsafeURLError("127.0.0.1 is private")),
    )
    database = AsyncMock()
    monkeypatch.setattr(bots, "run_db", database)
    body = bots.FlowVersionCreateRequest(
        status="published",
        nodes=[
            {"id": "start", "type": "start", "data": {}},
            {"id": "notify", "type": "webhook", "data": {"config": {"url": "http://127.0.0.1/hook"}}},
        ],
        edges=[{"id": "e1", "source": "start", "target": "notify"}],
    )
    with pytest.raises(HTTPException) as error:
        asyncio.run(bots.create_dashboard_flow_version("bot-1", body, USER))
    assert error.value.status_code == 422
    assert "unsafe target" in error.value.detail
    database.assert_not_awaited()


def test_publishing_flow_requires_webhook_url(monkeypatch):
    monkeypatch.setattr(bots, "verify_bot_permission", AsyncMock(return_value="owner"))
    monkeypatch.setattr(bots, "assert_safe_url_async", AsyncMock())
    database = AsyncMock()
    monkeypatch.setattr(bots, "run_db", database)
    body = bots.FlowVersionCreateRequest(
        status="published",
        nodes=[
            {"id": "start", "type": "start", "data": {}},
            {"id": "notify", "type": "webhook", "data": {"config": {}}},
        ],
        edges=[{"id": "e1", "source": "start", "target": "notify"}],
    )
    with pytest.raises(HTTPException) as error:
        asyncio.run(bots.create_dashboard_flow_version("bot-1", body, USER))
    assert error.value.status_code == 422
    assert "requires a public" in error.value.detail
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
