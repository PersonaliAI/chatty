import asyncio
import json

import pytest

from app.workers.dead_letter import replay_dead_letter_job


class FakeRedis:
    def __init__(self, rows):
        self.rows = rows
        self.published = []
        self.deleted = []

    async def xrange(self, stream, *, min, max, count):
        assert stream == "chatty:webhooks:dead-letter"
        return [row for row in self.rows if row[0] == min][:count]

    async def xadd(self, stream, fields, **kwargs):
        self.published.append((stream, fields, kwargs))
        return "9-0"

    async def xdel(self, stream, stream_id):
        self.deleted.append((stream, stream_id))


def test_replay_validates_and_removes_only_after_publish():
    client = FakeRedis([("4-0", {
        "name": "email.ticket_reply",
        "payload": json.dumps({"session_id": "s1"}),
        "idempotency_key": "reply-1",
        "attempts": "5",
        "last_error": "provider unavailable",
    })])

    new_id = asyncio.run(replay_dead_letter_job(
        client, "4-0", dead_letter_stream="chatty:webhooks:dead-letter",
        target_stream="chatty:webhooks",
    ))

    assert new_id == "9-0"
    assert client.published[0][0] == "chatty:webhooks"
    assert client.published[0][1]["attempts"] == "0"
    assert json.loads(client.published[0][1]["payload"]) == {"session_id": "s1"}
    assert client.deleted == [("chatty:webhooks:dead-letter", "4-0")]


def test_replay_rejects_missing_entry():
    with pytest.raises(LookupError):
        asyncio.run(replay_dead_letter_job(
            FakeRedis([]), "4-0", dead_letter_stream="chatty:webhooks:dead-letter",
            target_stream="chatty:webhooks",
        ))
