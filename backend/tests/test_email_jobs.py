import asyncio
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException

import main  # noqa: F401
from app.routers import email_inbound
from app.workers.email_jobs import process_ticket_escalation


def test_ticket_escalation_uses_durable_queue(monkeypatch):
    class FakeQueue:
        def __init__(self):
            self.calls = []

        async def enqueue(self, **kwargs):
            self.calls.append(kwargs)
            return "1-0"

    queue = FakeQueue()
    monkeypatch.setattr(email_inbound, "_email_job_queue", queue)
    mode = asyncio.run(email_inbound._enqueue_ticket_escalation(
        bot_id="bot-1", session_id="email-1", reason="urgent",
        priority="urgent", custom_message="help", dispatch=True,
    ))

    assert mode == "queued"
    assert queue.calls[0]["name"] == "email.ticket_escalation"
    assert queue.calls[0]["payload"]["concurrency_key"] == "email-ticket:bot-1:email-1"


def test_ticket_escalation_fails_closed_without_queue(monkeypatch):
    monkeypatch.setattr(email_inbound, "_email_job_queue", None)
    monkeypatch.delenv("CHATTY_ALLOW_EPHEMERAL_JOBS", raising=False)
    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(email_inbound._enqueue_ticket_escalation(
            bot_id="bot-1", session_id="email-1", reason="urgent",
            priority="urgent", custom_message="help", dispatch=True,
        ))
    assert exc_info.value.status_code == 503


def test_ticket_escalation_worker_dispatches_and_alerts():
    payload = {
        "bot_id": "bot-1", "session_id": "email-1", "reason": "urgent",
        "priority": "urgent", "custom_message": "help", "dispatch": True,
    }
    with patch("app.routers.admin._dispatch_ticket_to_agent", new_callable=AsyncMock, return_value={"dispatched": True}) as dispatch, \
         patch("app.services.slack_escalation.send_slack_escalation_alert", new_callable=AsyncMock) as alert:
        asyncio.run(process_ticket_escalation(payload))
    dispatch.assert_awaited_once_with("bot-1", "email-1")
    alert.assert_awaited_once_with("bot-1", "email-1", "urgent", "urgent", "help")
