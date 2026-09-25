import asyncio
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException

import main  # noqa: F401
from app.routers import widget
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
