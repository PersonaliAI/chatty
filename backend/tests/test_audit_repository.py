import asyncio

from app.adapters.supabase_audit import SupabaseAuditLogRepository


class Query:
    def __init__(self, row):
        self.row = row
        self.inserted = None

    def insert(self, row):
        self.inserted = row
        return self

    def execute(self):
        return type("Response", (), {"data": [self.row]})()


class Client:
    def __init__(self):
        self.query = Query({"id": "audit-1"})

    def table(self, name):
        assert name == "chatty_audit_logs"
        return self.query


def test_supabase_audit_adapter_writes_tenant_scoped_event():
    client = Client()
    result = asyncio.run(SupabaseAuditLogRepository(client).append(
        bot_id="bot-1",
        action="meeting_booked",
        performed_by="assistant",
        details="Booked",
        metadata={"meeting_id": "meeting-1"},
    ))
    assert result == {"id": "audit-1"}
    assert client.query.inserted == {
        "bot_id": "bot-1",
        "action": "meeting_booked",
        "performed_by": "assistant",
        "details": "Booked",
        "metadata": {"meeting_id": "meeting-1"},
    }
