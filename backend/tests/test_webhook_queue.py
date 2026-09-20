import asyncio

from plugins import notifications


class FakeQueue:
    def __init__(self):
        self.jobs = []

    async def enqueue(self, **kwargs):
        self.jobs.append(kwargs)
        return "job-1"


class Query:
    def __init__(self, data):
        self.data = data

    def select(self, *_args): return self
    def eq(self, *_args): return self
    def execute(self): return type("Response", (), {"data": self.data})()


class Client:
    def table(self, name):
        assert name == "chatty_webhooks"
        return Query([{"id": "wh-1", "url": "https://example.com/hook", "secret": "secret", "events": ["lead.created"]}])


def test_webhook_event_uses_durable_queue_when_configured():
    queue = FakeQueue()
    asyncio.run(notifications.enqueue_webhook_event(
        Client(), bot_id="bot-1", event="lead.created", data={"id": "lead-1"},
        job_queue=queue,
    ))
    assert len(queue.jobs) == 1
    job = queue.jobs[0]
    assert job["name"] == "webhook.deliver"
    assert job["payload"]["webhook_id"] == "wh-1"
    assert job["payload"]["payload"]["data"] == {"id": "lead-1"}
    assert job["idempotency_key"].startswith("wh-1:")
