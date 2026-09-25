import asyncio
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException

# Importing main first completes the legacy router bridge before admin imports
# helpers back from the application module.
import main  # noqa: F401
from app.routers import admin
from app.workers.webhook_worker import _send_ticket_reply_email


PAYLOAD = {
    "to_email": "customer@example.com",
    "subject": "Support Request",
    "body_text": "We fixed this for you.",
    "session_id": "session-1",
    "bot_name": "Chatty Support",
    "agent_name": "Agent",
    "in_reply_to_message_id": "<inbound@example.com>",
}


def test_ticket_reply_email_uses_durable_queue(monkeypatch):
    class FakeQueue:
        def __init__(self):
            self.calls = []

        async def enqueue(self, **kwargs):
            self.calls.append(kwargs)
            return "1-0"

    queue = FakeQueue()
    monkeypatch.setattr(admin, "_admin_job_queue", queue)
    monkeypatch.delenv("CHATTY_ALLOW_EPHEMERAL_JOBS", raising=False)

    mode = asyncio.run(admin._enqueue_ticket_reply_email(**PAYLOAD))

    assert mode == "queued"
    assert queue.calls[0]["name"] == "email.ticket_reply"
    assert queue.calls[0]["payload"] == PAYLOAD
    assert queue.calls[0]["idempotency_key"].startswith("email.ticket_reply:")


def test_ticket_reply_email_fails_closed_without_queue(monkeypatch):
    monkeypatch.setattr(admin, "_admin_job_queue", None)
    monkeypatch.delenv("CHATTY_ALLOW_EPHEMERAL_JOBS", raising=False)

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(admin._enqueue_ticket_reply_email(**PAYLOAD))

    assert exc_info.value.status_code == 503


def test_ticket_reply_email_allows_explicit_local_fallback(monkeypatch):
    monkeypatch.setattr(admin, "_admin_job_queue", None)
    monkeypatch.setenv("CHATTY_ALLOW_EPHEMERAL_JOBS", "true")
    with patch("app.services.email_service.send_ticket_reply_email", new_callable=AsyncMock), \
         patch.object(admin.asyncio, "create_task", side_effect=lambda coro: coro.close()) as create_task:
        mode = asyncio.run(admin._enqueue_ticket_reply_email(**PAYLOAD))

    assert mode == "background"
    create_task.assert_called_once()


def test_worker_email_handler_retries_unsent_delivery():
    with patch("app.services.email_service.send_ticket_reply_email", new_callable=AsyncMock, return_value={"sent": False, "reason": "provider down"}):
        with pytest.raises(RuntimeError, match="provider down"):
            asyncio.run(_send_ticket_reply_email(PAYLOAD))
