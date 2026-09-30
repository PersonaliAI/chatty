import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock

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
