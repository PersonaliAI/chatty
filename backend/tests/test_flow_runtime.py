import asyncio
from types import SimpleNamespace

from app.services import flow_runtime


class _Query:
    def __init__(self, owner):
        self.owner = owner
        self.operation = None

    def __getattr__(self, name):
        if name == "execute":
            return lambda: self.owner.next_result(self.operation)

        def method(*args, **kwargs):
            if name in {"select", "update", "insert", "delete"}:
                self.operation = (name, args[0] if args else None)
            return self

        return method


class _Supabase:
    def __init__(self, results):
        self.results = list(results)
        self.operations = []

    def table(self, _name):
        return _Query(self)

    def next_result(self, operation):
        self.operations.append(operation)
        return self.results.pop(0)


def test_execute_flow_job_orders_nodes_retries_and_records_success(monkeypatch):
    supabase = _Supabase([
        SimpleNamespace(data=[{"id": "run-1"}]),
        SimpleNamespace(data={"inputs": {"event": "lead.created", "data": {"id": "lead-1"}}}),
        SimpleNamespace(data={"flow_data": {"nodes": [
            {"id": "action", "kind": "action", "title": "Adapter", "config": {"url": "https://example.com"}},
            {"id": "trigger", "kind": "trigger", "title": "Trigger", "config": {"event": "lead.created"}},
        ], "edges": [{"from": "trigger", "to": "action"}]}}),
        SimpleNamespace(data=[{"id": "run-1"}]),
    ])
    responses = iter([SimpleNamespace(status_code=500), SimpleNamespace(status_code=500), SimpleNamespace(status_code=204)])
    calls = []

    async def run_db(operation):
        return operation()

    async def request_async(_client, method, url, **kwargs):
        calls.append((method, url, kwargs["json"]))
        return next(responses)

    monkeypatch.setattr(flow_runtime, "run_db", run_db)
    monkeypatch.setattr(flow_runtime.ssrf, "request_async", request_async)
    asyncio.run(flow_runtime.execute_flow_job(supabase, {"run_id": "run-1", "version_id": "version-1"}))

    assert len(calls) == 3
    assert calls[-1][0:2] == ("POST", "https://example.com")
    assert supabase.operations[-1][1]["status"] == "completed"
    assert [step["node_id"] for step in supabase.operations[-1][1]["trace"]] == ["trigger", "action"]


def test_execute_flow_job_fails_unconfigured_actions(monkeypatch):
    supabase = _Supabase([
        SimpleNamespace(data=[{"id": "run-1"}]),
        SimpleNamespace(data={"inputs": {"event": "lead.created", "data": {}}}),
        SimpleNamespace(data={"flow_data": {"nodes": [
            {"id": "trigger", "kind": "trigger", "title": "Trigger", "config": {}},
            {"id": "action", "kind": "action", "title": "Adapter", "config": {}},
        ], "edges": [{"from": "trigger", "to": "action"}]}}),
        SimpleNamespace(data=[{"id": "run-1"}]),
    ])

    async def run_db(operation):
        return operation()

    monkeypatch.setattr(flow_runtime, "run_db", run_db)
    asyncio.run(flow_runtime.execute_flow_job(supabase, {"run_id": "run-1", "version_id": "version-1"}))

    final_update = supabase.operations[-1][1]
    assert final_update["status"] == "failed"
    assert "no adapter endpoint" in final_update["error"]
