import asyncio
from types import SimpleNamespace

from app.services.campaign_delivery_ledger import record_campaign_delivery


class _Table:
    def __init__(self):
        self.row = None

    def upsert(self, row, **kwargs):
        self.row = row
        assert kwargs == {"on_conflict": "bot_id,idempotency_key"}
        return self

    def execute(self):
        return SimpleNamespace(data=[self.row])


class _Db:
    def __init__(self):
        self.table_obj = _Table()

    def table(self, name):
        assert name == "chatty_campaign_deliveries"
        return self.table_obj


def test_delivery_ledger_upserts_bounded_state():
    db = _Db()
    asyncio.run(record_campaign_delivery(db, {
        "bot_id": "bot-1",
        "campaign_id": "campaign-1",
        "delivery_idempotency_key": "campaign.dispatch:key",
        "channel": "email",
        "recipient": {"id": "lead-1", "email": "secret@example.com"},
    }, "sent"))
    row = db.table_obj.row
    assert row["status"] == "sent"
    assert row["recipient_id"] == "lead-1"
    assert "secret@example.com" not in str(row)


def test_delivery_ledger_ignores_missing_identity():
    db = _Db()
    asyncio.run(record_campaign_delivery(db, {"bot_id": "bot-1"}, "sent"))
    assert db.table_obj.row is None
