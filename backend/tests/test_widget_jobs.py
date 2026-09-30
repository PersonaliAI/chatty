import asyncio
import json
from contextlib import asynccontextmanager
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException

import main  # noqa: F401
from app.routers import widget
from app.schemas.widget import WidgetFlowWebhookRequest
from app.workers.widget_jobs import process_ticket_escalation, process_unanswered


def test_widget_ticket_escalation_uses_durable_queue(monkeypatch):
    class FakeQueue:
        def __init__(self):
            self.calls = []

        async def enqueue(self, **kwargs):
            self.calls.append(kwargs)
            return "1-0"

    queue = FakeQueue()
    monkeypatch.setattr(widget, "_widget_job_queue", queue)
    mode = asyncio.run(widget._enqueue_widget_ticket_escalation(
        bot_id="bot-1", session_id="session-1", reason="human",
        priority="high", custom_message="please help",
    ))

    assert mode == "queued"
    assert queue.calls[0]["name"] == "widget.ticket_escalation"
    assert queue.calls[0]["payload"]["concurrency_key"] == "widget-ticket:bot-1:session-1"


def test_widget_ticket_escalation_fails_closed_without_queue(monkeypatch):
    monkeypatch.setattr(widget, "_widget_job_queue", None)
    monkeypatch.delenv("CHATTY_ALLOW_EPHEMERAL_JOBS", raising=False)
    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(widget._enqueue_widget_ticket_escalation(
            bot_id="bot-1", session_id="session-1", reason="human",
            priority="high", custom_message="please help",
        ))
    assert exc_info.value.status_code == 503


def test_widget_ticket_escalation_worker_dispatches_and_alerts():
    payload = {
        "bot_id": "bot-1", "session_id": "session-1", "reason": "human",
        "priority": "high", "custom_message": "please help",
    }
    with patch("app.routers.admin._dispatch_ticket_to_agent", new_callable=AsyncMock, return_value={"dispatched": True}) as dispatch, \
         patch("app.services.slack_escalation.send_slack_escalation_alert", new_callable=AsyncMock) as alert:
        asyncio.run(process_ticket_escalation(payload))
    dispatch.assert_awaited_once_with("bot-1", "session-1")
    alert.assert_awaited_once_with("bot-1", "session-1", "human", "high", "please help")


def test_widget_unanswered_uses_durable_queue(monkeypatch):
    class FakeQueue:
        def __init__(self):
            self.calls = []

        async def enqueue(self, **kwargs):
            self.calls.append(kwargs)
            return "1-0"

    queue = FakeQueue()
    monkeypatch.setattr(widget, "_widget_job_queue", queue)
    mode = asyncio.run(widget._enqueue_widget_unanswered(
        bot_id="bot-1", session_id="session-1", question="Where is it?",
        reply="I don't know that information.",
    ))
    assert mode == "queued"
    assert queue.calls[0]["name"] == "widget.unanswered"
    assert queue.calls[0]["payload"]["concurrency_key"] == "widget-unanswered:bot-1:session-1"


def test_widget_unanswered_skips_confident_replies(monkeypatch):
    monkeypatch.setattr(widget, "_widget_job_queue", None)
    mode = asyncio.run(widget._enqueue_widget_unanswered(
        bot_id="bot-1", session_id="session-1", question="Where is it?",
        reply="It ships tomorrow.",
    ))
    assert mode == "skipped"


def test_widget_unanswered_worker_runs_sync_logger_off_loop():
    payload = {
        "bot_id": "bot-1", "session_id": "session-1",
        "question": "Where is it?", "reply": "I don't know that information.",
    }
    with patch("app.services.widget_session_service.log_unanswered_if_needed") as logger_fn:
        asyncio.run(process_unanswered(payload))
    logger_fn.assert_called_once_with("bot-1", "session-1", "Where is it?", "I don't know that information.")


def test_widget_webhook_is_published_to_durable_queue(monkeypatch):
    class FakeQueue:
        def __init__(self):
            self.calls = []

        async def enqueue(self, **kwargs):
            self.calls.append(kwargs)
            return "1-0"

    queue = FakeQueue()
    monkeypatch.setattr(widget, "_widget_job_queue", queue)
    mode = asyncio.run(widget._schedule_widget_webhook(
        widget.BackgroundTasks(), bot_id="bot-1", event="message.user",
        session_id="session-1", data={"content": "hello"},
    ))
    assert mode == "queued"
    assert queue.calls[0]["name"] == "webhook.fanout"
    assert queue.calls[0]["payload"]["event"] == "message.user"


def test_widget_webhook_worker_fans_out_event():
    payload = {
        "bot_id": "bot-1", "event": "message.user", "session_id": "session-1",
        "data": {"content": "hello"},
    }
    with patch("plugins.notifications.enqueue_webhook_event", new_callable=AsyncMock) as fanout:
        from app.workers.webhook_worker import _fanout_webhook
        asyncio.run(_fanout_webhook(payload))
    fanout.assert_awaited_once()
    assert fanout.await_args.kwargs["bot_id"] == "bot-1"
    assert fanout.await_args.kwargs["event"] == "message.user"


class _WidgetRequest:
    headers = {"x-widget-token": "test-token"}
    client = SimpleNamespace(host="203.0.113.10")


def _published_webhook_flow(config: dict) -> str:
    return "/* CHATTY_FLOW_DATA\n" + json.dumps({
        "status": "active",
        "nodes": [{"id": "hook-1", "type": "webhook", "data": {"config": config}}],
        "edges": [],
    }) + "\nCHATTY_FLOW_DATA */"


def test_widget_flow_webhook_never_accepts_a_browser_supplied_url(monkeypatch):
    """Only the persisted node config may supply the destination URL."""
    async def fake_run_db(_fn):
        return SimpleNamespace(data={"id": "bot-1", "custom_js": _published_webhook_flow({}), "allowed_domains": []})

    async def allowed(*_args, **_kwargs):
        return None

    monkeypatch.setattr(widget, "run_db", fake_run_db)
    monkeypatch.setattr(widget, "_widget_rate_limit_or_429", allowed)
    result = asyncio.run(widget.widget_flow_webhook(
        WidgetFlowWebhookRequest(
            bot_id="bot-1", session_id="session-1", node_id="hook-1",
            input="hello", context={"url": "https://attacker.invalid"},
        ),
        _WidgetRequest(),
    ))
    assert result == {"success": False, "retryable": False, "reason": "webhook_url_not_configured"}


def test_widget_flow_webhook_rejects_non_webhook_node(monkeypatch):
    async def fake_run_db(_fn):
        return SimpleNamespace(data={"id": "bot-1", "custom_js": "/* CHATTY_FLOW_DATA\n" + json.dumps({
            "status": "active", "nodes": [{"id": "message-1", "type": "message", "data": {}}], "edges": [],
        }) + "\nCHATTY_FLOW_DATA */", "allowed_domains": []})

    async def allowed(*_args, **_kwargs):
        return None

    monkeypatch.setattr(widget, "run_db", fake_run_db)
    monkeypatch.setattr(widget, "_widget_rate_limit_or_429", allowed)
    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(widget.widget_flow_webhook(
            WidgetFlowWebhookRequest(bot_id="bot-1", session_id="session-1", node_id="message-1"),
            _WidgetRequest(),
        ))
    assert exc_info.value.status_code == 404


def test_widget_flow_webhook_uses_only_published_url_and_server_mapping(monkeypatch):
    calls = []

    async def fake_run_db(_fn):
        return SimpleNamespace(data={
            "id": "bot-1",
            "custom_js": _published_webhook_flow({
                "url": "https://integrations.example.test/flow",
                "mapping": {"message": "{{input}}", "lead": "{{context.captured_lead.email}}", "missing": "{{context.unknown}}"},
            }),
            "allowed_domains": [],
        })

    async def allowed(*_args, **_kwargs):
        return None

    @asynccontextmanager
    async def safe_stream(_client, method, url, **kwargs):
        calls.append((method, url, kwargs))
        yield SimpleNamespace(status_code=202)

    monkeypatch.setattr(widget, "run_db", fake_run_db)
    monkeypatch.setattr(widget, "_widget_rate_limit_or_429", allowed)
    monkeypatch.setattr(widget.ssrf, "stream_async", safe_stream)
    result = asyncio.run(widget.widget_flow_webhook(
        WidgetFlowWebhookRequest(
            bot_id="bot-1", session_id="session-1", node_id="hook-1", input="Hello",
            context={"captured_lead": {"email": "visitor@example.com"}, "url": "https://attacker.invalid"},
        ),
        _WidgetRequest(),
    ))
    assert result == {"success": True, "status_code": 202, "attempts": 1, "retryable": False}
    assert calls[0][0] == "POST"
    assert calls[0][1] == "https://integrations.example.test/flow"
    assert calls[0][2]["json"]["data"] == {"message": "Hello", "lead": "visitor@example.com"}
    assert calls[0][2]["json"]["unresolved_fields"] == ["missing"]


def test_widget_flow_webhook_retries_transient_statuses(monkeypatch):
    calls = []

    async def fake_run_db(_fn):
        return SimpleNamespace(data={
            "id": "bot-1",
            "custom_js": _published_webhook_flow({
                "url": "https://integrations.example.test/flow", "max_attempts": 3, "backoff_ms": 0,
            }),
            "allowed_domains": [],
        })

    async def allowed(*_args, **_kwargs):
        return None

    statuses = iter((503, 202))

    @asynccontextmanager
    async def safe_stream(*_args, **_kwargs):
        calls.append(1)
        yield SimpleNamespace(status_code=next(statuses))

    monkeypatch.setattr(widget, "run_db", fake_run_db)
    monkeypatch.setattr(widget, "_widget_rate_limit_or_429", allowed)
    monkeypatch.setattr(widget.ssrf, "stream_async", safe_stream)
    result = asyncio.run(widget.widget_flow_webhook(
        WidgetFlowWebhookRequest(bot_id="bot-1", session_id="session-1", node_id="hook-1"),
        _WidgetRequest(),
    ))
    assert result == {"success": True, "status_code": 202, "attempts": 2, "retryable": False}
    assert len(calls) == 2
