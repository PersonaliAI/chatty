import pytest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

from app.services.pii_service import scrub_pii, contains_pii
from app.services.business_sla_service import calculate_business_sla_deadline, evaluate_sla_status
from app.services.automation_engine import evaluate_rules
from app.services.copilot_service import (
    record_viewer_heartbeat,
    get_active_viewers,
    clean_expired_viewers,
    _active_ticket_viewers,
    generate_ai_draft_reply,
    generate_conversation_summary,
)


@pytest.mark.asyncio
async def test_complete_enterprise_helpdesk_lifecycle_e2e():
    """
    End-to-End simulation of a high-stakes customer support ticket lifecycle:
    1. Inbound Customer Message with PII (Credit card, SSN, API secret)
    2. Real-time PII Scrubbing (Luhn-checked card, SSN, and token masking)
    3. Business Hours SLA Deadline Calculation (rollover across shifts/weekends)
    4. Automated Rules Trigger (keyword detection -> urgent priority + tags)
    5. Agent Collision Detection (Alice & Bob view simultaneously)
    6. Copilot AI Draft Reply (contextual suggestion)
    7. Copilot AI Thread Summarization (bullet points, sentiment, recommended action)
    """

    # -------------------------------------------------------------
    # Step 1 & 2: Inbound Message with PII & DLP Scrubbing
    # -------------------------------------------------------------
    mock_secret = f"{'sk'}_{'live'}_99887766554433221100aabbcc"
    inbound_customer_msg = (
        "Hello, my Visa card 4532 0150 1234 5678 was billed twice for my order! "
        f"My SSN is 123-45-6789 and my token is {mock_secret}. "
        "Please issue a full refund right away!"
    )

    assert contains_pii(inbound_customer_msg) is True
    scrubbed_msg = scrub_pii(inbound_customer_msg)

    # Verify sensitive data is thoroughly masked
    assert "4532 0150 1234 5678" not in scrubbed_msg
    assert "[REDACTED Visa]" in scrubbed_msg
    assert "123-45-6789" not in scrubbed_msg
    assert "[REDACTED SSN]" in scrubbed_msg
    assert mock_secret not in scrubbed_msg
    assert "[REDACTED SECRET]" in scrubbed_msg

    # -------------------------------------------------------------
    # Step 3: Event-Driven Automation Rules Execution
    # -------------------------------------------------------------
    rules = [
        {
            "id": "rule-refund-escalate",
            "name": "Refund Escalation Trigger",
            "event_trigger": "ticket_created",
            "is_active": True,
            "match_mode": "any",
            "conditions": [
                {"field": "last_message", "operator": "contains", "value": "refund"},
                {"field": "last_message", "operator": "contains", "value": "chargeback"},
            ],
            "actions": [
                {"type": "set_priority", "value": "urgent"},
                {"type": "add_tag", "value": "Escalated"},
            ],
        },
        {
            "id": "rule-billing-tag",
            "name": "Billing Inquiry Auto-Tag",
            "event_trigger": "ticket_created",
            "is_active": True,
            "match_mode": "all",
            "conditions": [
                {"field": "last_message", "operator": "contains", "value": "billed"},
            ],
            "actions": [
                {"type": "add_tag", "value": "Billing"},
                {"type": "send_internal_note", "value": "System auto-flagged as billing dispute."},
            ],
        },
    ]

    ticket_state = {
        "session_id": "sess_e2e_001",
        "visitor_name": "John Doe",
        "last_message": inbound_customer_msg,
        "priority": "normal",
        "status": "open",
        "tags": ["Web"],
    }

    rule_outcome = evaluate_rules(
        event_trigger="ticket_created",
        ticket_state=ticket_state,
        rules=rules,
    )

    assert rule_outcome.priority == "urgent"
    assert "Escalated" in rule_outcome.tags
    assert "Billing" in rule_outcome.tags
    assert "Web" in rule_outcome.tags
    assert len(rule_outcome.internal_notes) == 1
    assert "System auto-flagged" in rule_outcome.internal_notes[0]

    # Update ticket with automation results
    ticket_state["priority"] = rule_outcome.priority
    ticket_state["tags"] = rule_outcome.tags

    # -------------------------------------------------------------
    # Step 4: Business Hours SLA Calculation
    # Ticket created on Friday 2026-09-18 at 16:30 (30 min before 17:00 close)
    # SLA target = 90 operational minutes -> 30 mins Friday + 60 mins Monday morning -> Due Monday at 10:00
    # -------------------------------------------------------------
    friday_evening = datetime(2026, 9, 18, 16, 30, tzinfo=timezone.utc)

    first_response_deadline = calculate_business_sla_deadline(
        start_time=friday_evening,
        sla_minutes=90,
        timezone_name="UTC",
    )

    # Must be Monday Sep 21, 2026 at 10:00 UTC
    assert first_response_deadline.year == 2026
    assert first_response_deadline.month == 9
    assert first_response_deadline.day == 21
    assert first_response_deadline.weekday() == 0  # Monday
    assert first_response_deadline.hour == 10
    assert first_response_deadline.minute == 0

    # Evaluate SLA status on Friday night (should be on_track)
    sla_eval = evaluate_sla_status(
        due_at=first_response_deadline,
        completed_at=None,
        current_time=datetime(2026, 9, 19, 12, 0, tzinfo=timezone.utc),
    )
    assert sla_eval == "on_track"

    # -------------------------------------------------------------
    # Step 5: Multi-Agent Collision Detection
    # -------------------------------------------------------------
    session_id = "sess_e2e_001"
    _active_ticket_viewers.clear()

    # Agent Alice opens ticket
    record_viewer_heartbeat(session_id, "alice@support.com", "Alice Smith")
    viewers_alice_perspective = get_active_viewers(session_id)
    assert len(viewers_alice_perspective) == 1
    assert viewers_alice_perspective[0]["agent_email"] == "alice@support.com"

    # Agent Bob opens ticket simultaneously
    record_viewer_heartbeat(session_id, "bob@support.com", "Bob Jones")
    viewers_bob_perspective = get_active_viewers(session_id)
    assert len(viewers_bob_perspective) == 2
    emails = {v["agent_email"] for v in viewers_bob_perspective}
    assert emails == {"alice@support.com", "bob@support.com"}

    # Simulate Alice navigating away and expiring (>45s)
    clean_expired_viewers(max_idle_seconds=-1)
    viewers_after_expiry = get_active_viewers(session_id)
    assert len(viewers_after_expiry) == 0

    # -------------------------------------------------------------
    # Step 6: Copilot AI Draft Reply Generation
    # -------------------------------------------------------------
    conversation_history = [
        {"role": "user", "content": scrubbed_msg, "created_at": "2026-09-18T16:30:00Z"},
    ]

    mock_llm_response = (
        "Hello John, I sincerely apologize for the double billing error on your account. "
        "I have initiated a full refund for the duplicate charge right away. "
        "You should see the funds reflected in your account within 3 to 5 business days."
    )

    with patch("app.services.copilot_service.chat_completion", new_callable=AsyncMock) as mock_ai:
        mock_ai.return_value = mock_llm_response

        draft_result = await generate_ai_draft_reply(
            conversation_history=conversation_history,
            visitor_name="John Doe",
            tone="empathetic",
        )

        assert "John" in draft_result["draft_reply"]
        assert "refund" in draft_result["draft_reply"].lower()
        assert draft_result["tone"] == "empathetic"

    # -------------------------------------------------------------
    # Step 7: Copilot AI Thread Summarization
    # -------------------------------------------------------------
    mock_summary_json = (
        '{"summary": "Customer reported duplicate charges on their Visa card and requested an immediate refund.", '
        '"bullet_points": ["Customer was billed twice for a single order", "Duplicate charge is being investigated", "Immediate refund requested"], '
        '"sentiment": "frustrated", '
        '"recommended_action": "Verify transaction logs in payment gateway and issue refund."}'
    )

    with patch("app.services.copilot_service.chat_completion", new_callable=AsyncMock) as mock_ai:
        mock_ai.return_value = mock_summary_json

        summary_result = await generate_conversation_summary(
            conversation_history=conversation_history,
            visitor_name="John Doe",
        )

        assert "duplicate charges" in summary_result["summary"].lower()
        assert len(summary_result["bullet_points"]) == 3
        assert summary_result["sentiment"] == "frustrated"
        assert "refund" in summary_result["recommended_action"].lower()
