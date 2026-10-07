import asyncio
import sys
from types import SimpleNamespace

from voice_agent_cli.escalation import maybe_escalate
from voice_agent_cli.organization import OrganizationContext


def test_escalation_reuses_chatty_detection_and_slack_adapter(monkeypatch):
    updates = []
    slack_calls = []

    async def run_db(fn):
        updates.append(fn)
        return SimpleNamespace(data=[])

    def detect_sentiment_escalation(_text):
        return "Negative sentiment detected"

    def needs_human(_text):
        return False

    async def send_slack_escalation_alert(**kwargs):
        slack_calls.append(kwargs)

    monkeypatch.setitem(
        sys.modules,
        "app.services.widget_session_service",
        SimpleNamespace(
            detect_sentiment_escalation=detect_sentiment_escalation,
            needs_human=needs_human,
        ),
    )
    monkeypatch.setitem(
        sys.modules,
        "app.services.slack_escalation",
        SimpleNamespace(send_slack_escalation_alert=send_slack_escalation_alert),
    )
    organization = OrganizationContext(
        owner_user={"id": "owner-1"},
        bot={"id": "bot-1"},
        modules=SimpleNamespace(
            supabase=SimpleNamespace(table=lambda _name: None), run_db=run_db
        ),
    )

    result = asyncio.run(maybe_escalate(organization, "voice-room-1", "This is broken"))

    assert result is True
    assert len(updates) == 1
    assert slack_calls == [
        {
            "bot_id": "bot-1",
            "session_id": "voice-room-1",
            "reason": "Negative sentiment detected",
            "priority": "high",
            "custom_message": "This is broken",
        }
    ]
