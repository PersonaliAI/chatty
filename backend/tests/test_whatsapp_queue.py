import asyncio
import hashlib
import hmac
import json
from unittest.mock import AsyncMock, patch

import main  # noqa: F401
from app.routers import webhooks
from app.workers.webhook_worker import _process_whatsapp_message


def test_whatsapp_job_resolves_bot_credentials_and_dispatches(monkeypatch):
    bot = {"id": "bot-1", "user_id": "user-1", "whatsapp_access_token": ""}
    owner = {"id": "user-1"}
    responses = iter([
        type("Response", (), {"data": [bot]})(),
        type("Response", (), {"data": [owner]})(),
    ])

    async def fake_run_db(_callback):
        return next(responses)

    monkeypatch.setattr(webhooks, "run_db", fake_run_db)
    monkeypatch.setattr(webhooks, "WHATSAPP_ACCESS_TOKEN", "token")
    dispatch = AsyncMock()
    monkeypatch.setattr(webhooks, "_dispatch_whatsapp_message", dispatch)

    payload = {
        "bot_id": "bot-1",
        "phone_number_id": "phone-1",
        "message": {"id": "wamid-1", "from": "15551234567", "type": "text", "text": {"body": "Hi"}},
    }
    asyncio.run(webhooks.process_whatsapp_job(payload))

    dispatch.assert_awaited_once_with(
        "phone-1", payload["message"], bot, owner, "token"
    )


def test_whatsapp_worker_handler_delegates_to_job_processor():
    with patch("app.routers.webhooks.process_whatsapp_job", new_callable=AsyncMock) as process:
        payload = {"bot_id": "bot-1", "phone_number_id": "phone-1", "message": {"type": "text"}}
        asyncio.run(_process_whatsapp_message(payload))
    process.assert_awaited_once_with(payload)


def test_whatsapp_webhook_publishes_before_claiming(monkeypatch):
    class Query:
        def __init__(self, name):
            self.name = name
        def select(self, *_args): return self
        def eq(self, *_args): return self
        def limit(self, *_args): return self
        def execute(self):
            if self.name == "chatty_bots":
                return type("Response", (), {"data": [{"id": "bot-1", "user_id": "user-1", "whatsapp_app_secret": "secret", "whatsapp_access_token": ""}]})()
            return type("Response", (), {"data": [{"id": "user-1"}]})()

    class FakeSupabase:
        def table(self, name): return Query(name)

    class FakeQueue:
        def __init__(self): self.calls = []
        async def enqueue(self, **kwargs):
            self.calls.append(kwargs)
            return "1-0"

    body = {"entry": [{"changes": [{"value": {
        "metadata": {"phone_number_id": "phone-1"},
        "messages": [{"id": "wamid-1", "from": "15551234567", "type": "text", "text": {"body": "Hi"}}],
    }}]}]}
    raw = json.dumps(body).encode()

    class Request:
        headers = {"x-hub-signature-256": "sha256=" + hmac.new(b"secret", raw, hashlib.sha256).hexdigest()}
        async def body(self): return raw

    queue = FakeQueue()
    monkeypatch.setattr(webhooks, "supabase", FakeSupabase())
    monkeypatch.setattr(webhooks, "run_db", lambda callback: asyncio.sleep(0, result=callback()))
    monkeypatch.setattr(webhooks, "WHATSAPP_ACCESS_TOKEN", "token")
    monkeypatch.setattr(webhooks, "_whatsapp_job_queue", queue)
    claim = AsyncMock(return_value=True)
    monkeypatch.setattr(webhooks, "_claim_whatsapp_message", claim)
    dispatch = AsyncMock()
    monkeypatch.setattr(webhooks, "_dispatch_whatsapp_message", dispatch)

    asyncio.run(webhooks.whatsapp_receive(Request()))

    assert queue.calls[0]["name"] == "whatsapp.message"
    assert queue.calls[0]["payload"]["concurrency_key"] == "whatsapp:bot-1:15551234567"
    claim.assert_awaited_once_with("bot-1", "wamid-1")
    dispatch.assert_not_awaited()
