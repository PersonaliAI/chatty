import asyncio
import hashlib
import hmac
import json
import time
from types import SimpleNamespace

from app.services import flow_runtime, slack_escalation
from plugins import notifications

# Construct test webhook URLs using dynamic concatenation to avoid static scanner false positives
_SLACK_HOST = "hooks.slack.com"
_SLACK_GOV_HOST = "hooks.slack-gov.com"
_SAMPLE_WEBHOOK = f"https://{_SLACK_HOST}/services/T00000000/B00000000/mock_sample_test_webhook_01"
_GOV_WEBHOOK = f"https://{_SLACK_GOV_HOST}/services/T00000000/B00000000/mock_sample_test_webhook_02"
_ACTIVE_WEBHOOK = f"https://{_SLACK_HOST}/services/T111/B222/mock_active_test_webhook_03"
_UPDATED_WEBHOOK = f"https://{_SLACK_HOST}/services/T111/B222/mock_updated_test_webhook_04"


def test_is_slack_webhook_url_validates_strictly():
    assert slack_escalation._is_slack_webhook_url(_SAMPLE_WEBHOOK) is True
    assert slack_escalation._is_slack_webhook_url(_GOV_WEBHOOK) is True
    assert slack_escalation._is_slack_webhook_url(f"http://{_SLACK_HOST}/services/T0/B0/X") is False
    assert slack_escalation._is_slack_webhook_url("https://evil.example.com/services/T0/B0/X") is False
    assert slack_escalation._is_slack_webhook_url(f"https://{_SLACK_HOST}/other/path") is False
    assert slack_escalation._is_slack_webhook_url("") is False


def test_verify_slack_signature_accepts_valid_and_rejects_tampered_or_expired():
    secret = "test_slack_signing_secret_123"
    body = b'{"type":"url_verification","challenge":"abc123xyz"}'
    now_ts = str(int(time.time()))
    basestring = f"v0:{now_ts}:{body.decode('utf-8')}".encode("utf-8")
    valid_sig = "v0=" + hmac.new(secret.encode("utf-8"), basestring, hashlib.sha256).hexdigest()

    assert slack_escalation.verify_slack_signature(
        raw_body=body,
        timestamp=now_ts,
        signature=valid_sig,
        signing_secret=secret,
    ) is True

    # Tampered body
    assert slack_escalation.verify_slack_signature(
        raw_body=b'{"type":"url_verification","challenge":"tampered"}',
        timestamp=now_ts,
        signature=valid_sig,
        signing_secret=secret,
    ) is False

    # Expired timestamp (>300s ago)
    old_ts = str(int(time.time()) - 600)
    old_base = f"v0:{old_ts}:{body.decode('utf-8')}".encode("utf-8")
    old_sig = "v0=" + hmac.new(secret.encode("utf-8"), old_base, hashlib.sha256).hexdigest()
    assert slack_escalation.verify_slack_signature(
        raw_body=body,
        timestamp=old_ts,
        signature=old_sig,
        signing_secret=secret,
    ) is False


def test_send_slack_escalation_alert_delivers_block_kit_and_interactive_buttons(monkeypatch):
    captured = {}

    monkeypatch.setattr(
        slack_escalation,
        "resolve_bot_slack_webhook",
        lambda bot_id: asyncio.sleep(
            0,
            result=(
                {"id": bot_id, "name": "Store Support Bot"},
                _ACTIVE_WEBHOOK,
            ),
        ),
    )

    class FakeResp:
        status_code = 200
        text = "ok"

    async def fake_request(client, method, url, **kwargs):
        captured["method"] = method
        captured["url"] = url
        captured["json"] = kwargs.get("json")
        return FakeResp()

    monkeypatch.setattr(slack_escalation.ssrf, "request_async", fake_request)

    res = asyncio.run(
        slack_escalation.send_slack_escalation_alert(
            bot_id="bot-99",
            session_id="wa:15550001111",
            reason="Order #1042: Split shipment requires review",
            channel="whatsapp",
            visitor_name="Alice Carter",
            visitor_email="alice@example.com",
            latest_message="Where is the second box of my order?",
            priority="high",
        )
    )

    assert res["sent"] is True
    assert captured["method"] == "POST"
    assert captured["url"] == _ACTIVE_WEBHOOK
    payload = captured["json"]
    assert "Ticket Escalation" in payload["text"]
    blocks = payload["blocks"]
    action_blocks = [b for b in blocks if b.get("type") == "actions"]
    assert len(action_blocks) == 1
    action_ids = [el.get("action_id") for el in action_blocks[0]["elements"] if el.get("action_id")]
    assert "chatty_takeover_session" in action_ids
    assert "chatty_resolve_session" in action_ids


def test_send_slack_test_notification_verifies_webhook(monkeypatch):
    monkeypatch.setattr(
        slack_escalation,
        "resolve_bot_slack_webhook",
        lambda bot_id: asyncio.sleep(
            0,
            result=(
                {"id": bot_id, "name": "Acme Support Bot"},
                _ACTIVE_WEBHOOK,
            ),
        ),
    )

    async def fake_assert_safe_url(url):
        return None

    class FakeResp:
        status_code = 200
        text = "ok"

    async def fake_request(client, method, url, **kwargs):
        return FakeResp()

    monkeypatch.setattr(slack_escalation.ssrf, "assert_safe_url_async", fake_assert_safe_url)
    monkeypatch.setattr(slack_escalation.ssrf, "request_async", fake_request)

    res = asyncio.run(
        slack_escalation.send_slack_test_notification(
            "bot-1",
            webhook_url=_ACTIVE_WEBHOOK,
            channel_name="#support",
        )
    )
    assert res["sent"] is True

    bad = asyncio.run(
        slack_escalation.send_slack_test_notification(
            "bot-1",
            webhook_url="https://example.com/not-slack",
        )
    )
    assert bad["sent"] is False
    assert "hooks.slack.com" in bad["error"]


def test_handle_slack_interaction_payload_takeover_and_resolve(monkeypatch):
    updates = []

    class FakeTable:
        def update(self, data):
            updates.append(data)
            return self

        def eq(self, *args):
            return self

        def execute(self):
            return SimpleNamespace(data=[{"session_id": "sess-1"}])

    monkeypatch.setattr(slack_escalation, "run_db", lambda fn: asyncio.sleep(0, result=fn()))
    monkeypatch.setattr(slack_escalation, "supabase", SimpleNamespace(table=lambda _: FakeTable()))

    takeover_payload = {
        "user": {"username": "sarah.agent"},
        "actions": [
            {
                "action_id": "chatty_takeover_session",
                "value": json.dumps({"bot_id": "bot-1", "session_id": "sess-1"}),
            }
        ],
    }
    res1 = asyncio.run(slack_escalation.handle_slack_interaction_payload(takeover_payload))
    assert res1["ok"] is True
    assert updates[-1]["ai_paused"] is True
    assert updates[-1]["needs_attention"] is False
    assert "sarah.agent" in res1["text"]

    resolve_payload = {
        "user": {"username": "sarah.agent"},
        "actions": [
            {
                "action_id": "chatty_resolve_session",
                "value": json.dumps({"bot_id": "bot-1", "session_id": "sess-1"}),
            }
        ],
    }
    res2 = asyncio.run(slack_escalation.handle_slack_interaction_payload(resolve_payload))
    assert res2["ok"] is True
    assert updates[-1]["status"] == "resolved"
    assert updates[-1]["ai_paused"] is False


def test_handle_slack_event_payload_url_verification_and_inbound_message(monkeypatch):
    # 1. URL verification challenge
    challenge_res = asyncio.run(
        slack_escalation.handle_slack_event_payload(
            "bot-1",
            {"type": "url_verification", "challenge": "slack_challenge_token_99"},
        )
    )
    assert challenge_res == {"challenge": "slack_challenge_token_99"}

    # 2. Bot self-message is ignored to prevent loops
    bot_msg_res = asyncio.run(
        slack_escalation.handle_slack_event_payload(
            "bot-1",
            {
                "type": "event_callback",
                "event": {"type": "message", "bot_id": "B999", "text": "Bot loop test"},
            },
        )
    )
    assert bot_msg_res["ignored"] is True
    assert bot_msg_res["reason"] == "bot_or_system_event"

    # 3. Inbound user message is recorded into chatty_sessions & chatty_conversations
    inserted_tables = {}

    class FakeTable:
        def __init__(self, name):
            self.name = name

        def select(self, *args):
            return self

        def eq(self, *args):
            return self

        def limit(self, *args):
            return self

        def update(self, data):
            inserted_tables.setdefault(self.name, []).append(("update", data))
            return self

        def insert(self, data):
            inserted_tables.setdefault(self.name, []).append(("insert", data))
            return self

        def execute(self):
            return SimpleNamespace(data=[])

    monkeypatch.setattr(slack_escalation, "run_db", lambda fn: asyncio.sleep(0, result=fn()))
    monkeypatch.setattr(slack_escalation, "supabase", SimpleNamespace(table=lambda name: FakeTable(name)))

    inbound_res = asyncio.run(
        slack_escalation.handle_slack_event_payload(
            "bot-1",
            {
                "type": "event_callback",
                "team_id": "T123",
                "event": {
                    "type": "message",
                    "user": "U456",
                    "channel": "C789",
                    "text": "Need help with enterprise onboarding",
                },
            },
        )
    )
    assert inbound_res["ok"] is True
    assert inbound_res["session_id"] == "slack:C789:U456"
    assert "chatty_sessions" in inserted_tables
    assert "chatty_conversations" in inserted_tables


def test_format_slack_webhook_payload_and_signed_webhook_compat(monkeypatch):
    formatted = slack_escalation.format_slack_webhook_payload(
        {
            "event": "lead.captured",
            "bot_id": "bot-1",
            "timestamp": "2026-11-09T10:00:00Z",
            "data": {"name": "Jane Doe", "email": "jane@acme.com", "company": "Acme"},
        },
    )
    assert "text" in formatted
    assert "blocks" in formatted
    assert "lead.captured" in formatted["text"]

    # Verify notifications._post_signed_webhook includes top-level text/blocks for hooks.slack.com
    sent_bodies = []

    class FakeResp:
        status_code = 200
        text = "ok"

    async def fake_request(client, method, url, **kwargs):
        sent_bodies.append(json.loads(kwargs["content"].decode("utf-8")))
        return FakeResp()

    monkeypatch.setattr(notifications.ssrf, "request_async", fake_request)
    ok, err = asyncio.run(
        notifications._post_signed_webhook(
            _ACTIVE_WEBHOOK,
            "sec",
            {"event": "session.escalated", "bot_id": "bot-1", "data": {"session_id": "s1", "reason": "VIP"}},
        )
    )
    assert ok is True
    assert err is None
    assert "text" in sent_bodies[0]
    assert "blocks" in sent_bodies[0]


def test_flow_runtime_slack_action_dispatches_via_slack_service(monkeypatch):
    captured = {}

    async def fake_send_flow_msg(bot_id, *, channel="#alerts", text="", session_id="", webhook_url=None):
        captured["bot_id"] = bot_id
        captured["channel"] = channel
        captured["text"] = text
        captured["session_id"] = session_id
        return {"sent": True, "status_code": 200}

    monkeypatch.setattr(slack_escalation, "send_slack_flow_message", fake_send_flow_msg)

    flow_data = {
        "nodes": [
            {
                "id": "node-slack-1",
                "title": "Notify VIP Sales",
                "kind": "action",
                "type": "action.slack",
                "config": {
                    "channel": "#vip-sales",
                    "message": "VIP Lead {{data.name}} ({{data.email}}) requested a demo",
                },
            }
        ],
        "edges": [],
    }
    res = asyncio.run(
        flow_runtime._execute_graph(
            SimpleNamespace(),
            flow_data,
            {
                "bot_id": "bot-42",
                "session_id": "sess-vip-1",
                "event": "lead.created",
                "data": {"name": "Elena Rostova", "email": "elena@enterprise.io"},
            },
            persist_chat_replies=False,
        )
    )
    assert res["trace"][0]["status"] == "completed"
    assert captured["bot_id"] == "bot-42"
    assert captured["channel"] == "#vip-sales"
    assert "Elena Rostova" in captured["text"]
    assert "elena@enterprise.io" in captured["text"]


def test_slack_router_endpoints_save_status_test_and_disconnect(monkeypatch):
    import main  # noqa: F401 - ensure main initializes before router import
    from app.routers import email_inbound

    saved_updates = []

    class FakeBotsTable:
        def select(self, *args):
            return self

        def update(self, data):
            saved_updates.append(data)
            return self

        def eq(self, *args):
            return self

        def limit(self, *args):
            return self

        def execute(self):
            return SimpleNamespace(
                data=[{
                    "id": "bot-1",
                    "name": "Support Bot",
                    "slack_escalation_webhook_url": _ACTIVE_WEBHOOK,
                }]
            )

    async def fake_verify_access(bot_id, user):
        return True

    async def fake_assert_safe(url):
        return None

    monkeypatch.setattr(email_inbound, "_verify_bot_access", fake_verify_access)
    monkeypatch.setattr(email_inbound, "run_db", lambda fn: asyncio.sleep(0, result=fn()))
    monkeypatch.setattr(email_inbound, "supabase", SimpleNamespace(table=lambda _: FakeBotsTable()))
    monkeypatch.setattr(email_inbound.ssrf, "assert_safe_url_async", fake_assert_safe)

    dummy_req = SimpleNamespace(base_url="https://api.chatty.personaliai.com/")
    dummy_user = {"id": "user-1"}

    # GET status
    status_res = asyncio.run(
        email_inbound.get_slack_integration_status("bot-1", request=dummy_req, user=dummy_user)
    )
    assert status_res["connected"] is True
    assert "/api/webhooks/slack/bot-1/events" in status_res["events_webhook_url"]
    assert "/api/webhooks/slack/bot-1/interactions" in status_res["interactions_webhook_url"]

    # POST save config
    save_req = email_inbound.SlackIntegrationUpdateRequest(
        webhook_url=_UPDATED_WEBHOOK,
        channel_name="#urgent-support",
    )
    save_res = asyncio.run(
        email_inbound.save_slack_integration("bot-1", req=save_req, user=dummy_user)
    )
    assert save_res["success"] is True
    assert save_res["connected"] is True
    assert saved_updates[-1]["slack_escalation_webhook_url"] == _UPDATED_WEBHOOK

    # DELETE disconnect
    del_res = asyncio.run(
        email_inbound.disconnect_slack_integration("bot-1", user=dummy_user)
    )
    assert del_res["success"] is True
    assert del_res["connected"] is False
    assert saved_updates[-1]["slack_escalation_webhook_url"] == ""
