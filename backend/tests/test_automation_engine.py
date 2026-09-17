"""Unit tests for enterprise Ticket Automation Rules Engine."""

import pytest
from app.services.automation_engine import evaluate_rules


def test_basic_trigger_contains_text():
    rules = [
        {
            "id": "rule-1",
            "name": "Auto-escalate refunds to urgent and tag billing",
            "event_type": "message_received",
            "conditions": [
                {"field": "message_text", "operator": "contains", "value": "refund"}
            ],
            "actions": [
                {"type": "set_priority", "value": "urgent"},
                {"type": "add_tag", "value": "billing"},
            ],
            "is_active": True,
        }
    ]

    session = {"session_id": "s-123", "priority": "normal", "tags": ["inquiry"]}
    context = {"message_text": "I want a refund on my last payment please."}

    updates, executed = evaluate_rules(rules, "message_received", session, context)

    assert updates["priority"] == "urgent"
    assert "billing" in updates["tags"]
    assert "inquiry" in updates["tags"]
    assert len(executed) == 1
    assert executed[0]["rule_name"] == "Auto-escalate refunds to urgent and tag billing"


def test_trigger_match_all_conditions():
    rules = [
        {
            "id": "rule-2",
            "name": "VIP email routing",
            "event_type": "session_created",
            "condition_match": "all",
            "conditions": [
                {"field": "channel", "operator": "equals", "value": "email"},
                {"field": "visitor_email", "operator": "ends_with", "value": "@enterprise.com"},
            ],
            "actions": [
                {"type": "set_priority", "value": "urgent"},
                {"type": "assign_agent", "value": "vip-lead@company.com"},
                {"type": "add_tag", "value": "VIP"},
            ],
            "is_active": True,
        }
    ]

    # Passes both
    sess1 = {"channel": "email", "visitor_email": "cto@enterprise.com", "tags": []}
    upd1, exec1 = evaluate_rules(rules, "session_created", sess1)
    assert upd1.get("priority") == "urgent"
    assert upd1.get("assigned_agent_email") == "vip-lead@company.com"
    assert "VIP" in upd1.get("tags", [])

    # Fails channel condition
    sess2 = {"channel": "web", "visitor_email": "cto@enterprise.com", "tags": []}
    upd2, exec2 = evaluate_rules(rules, "session_created", sess2)
    assert upd2 == {}
    assert len(exec2) == 0


def test_trigger_match_any_condition():
    rules = [
        {
            "id": "rule-3",
            "name": "Keyword Alert",
            "event_type": "message_received",
            "condition_match": "any",
            "conditions": [
                {"field": "message_text", "operator": "contains", "value": "lawyer"},
                {"field": "message_text", "operator": "contains", "value": "sue"},
            ],
            "actions": [
                {"type": "set_priority", "value": "urgent"},
                {"type": "add_tag", "value": "legal-escalation"},
            ],
            "is_active": True,
        }
    ]

    context = {"message_text": "I will consult my lawyer about this delay"}
    upd, exec_list = evaluate_rules(rules, "message_received", {"priority": "low"}, context)
    assert upd["priority"] == "urgent"
    assert "legal-escalation" in upd["tags"]


def test_event_type_filtering_and_inactive():
    rules = [
        {
            "id": "rule-inactive",
            "name": "Inactive rule",
            "event_type": "session_created",
            "is_active": False,
            "actions": [{"type": "set_priority", "value": "urgent"}],
        },
        {
            "id": "rule-wrong-event",
            "name": "Update rule",
            "event_type": "session_updated",
            "is_active": True,
            "actions": [{"type": "set_priority", "value": "high"}],
        },
    ]

    # Evaluated on session_created -> neither should run
    upd, exec_list = evaluate_rules(rules, "session_created", {"priority": "normal"})
    assert upd == {}
    assert len(exec_list) == 0
