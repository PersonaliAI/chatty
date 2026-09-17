"""Enterprise Ticket Automation Rules Engine (Event Triggers).

Evaluates trigger conditions (IF-THIS) on conversation events (session creation,
incoming message, status updates) and executes automated actions (THEN-THAT)
such as priority bumps, auto-tagging, routing, and staff alerts.
"""

from __future__ import annotations

import re
from typing import Any, Callable


def _match_condition(actual: Any, operator: str, expected: Any) -> bool:
    if actual is None:
        actual_str = ""
    else:
        actual_str = str(actual).strip()

    expected_str = str(expected).strip() if expected is not None else ""

    op = operator.lower().strip()
    if op in ("equals", "eq", "=="):
        return actual_str.lower() == expected_str.lower()
    elif op in ("not_equals", "neq", "!="):
        return actual_str.lower() != expected_str.lower()
    elif op in ("contains", "in"):
        return expected_str.lower() in actual_str.lower()
    elif op in ("not_contains", "not_in"):
        return expected_str.lower() not in actual_str.lower()
    elif op in ("starts_with", "prefix"):
        return actual_str.lower().startswith(expected_str.lower())
    elif op in ("ends_with", "suffix"):
        return actual_str.lower().endswith(expected_str.lower())
    elif op == "regex":
        try:
            return bool(re.search(expected_str, actual_str, re.IGNORECASE))
        except re.error:
            return False
    return False


def evaluate_rules(
    rules: list[dict[str, Any]],
    event_type: str,
    session: dict[str, Any],
    context: dict[str, Any] | None = None,
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    """Evaluates an ordered list of automation rules against a session and context.

    :param rules: List of automation rule dictionaries.
    :param event_type: Event being evaluated ('session_created', 'message_received', 'session_updated').
    :param session: Current session data dict (status, priority, channel, tags, etc.).
    :param context: Supplemental event payload (e.g. {'message_text': 'I need a refund'}).
    :return: (merged_updates, executed_rules_summary)
    """
    ctx = dict(session)
    if context:
        ctx.update(context)

    merged_updates: dict[str, Any] = {}
    executed_rules: list[dict[str, Any]] = []

    for rule in rules:
        if not rule.get("is_active", True):
            continue

        rule_event = rule.get("event_type", "session_created")
        if rule_event != "*" and rule_event != event_type:
            continue

        conditions = rule.get("conditions", [])
        condition_match = rule.get("condition_match", "all").lower()

        if conditions:
            results = []
            for cond in conditions:
                field = cond.get("field", "")
                operator = cond.get("operator", "equals")
                expected = cond.get("value")
                actual = ctx.get(field)
                results.append(_match_condition(actual, operator, expected))

            if condition_match == "any":
                matched = any(results)
            else:
                matched = all(results)
        else:
            matched = True  # No conditions = unconditional trigger

        if matched:
            rule_actions_taken = []
            for action in rule.get("actions", []):
                act_type = action.get("type", "").lower()
                val = action.get("value")

                if act_type == "set_priority":
                    merged_updates["priority"] = val
                    ctx["priority"] = val
                    rule_actions_taken.append({"action": "set_priority", "value": val})

                elif act_type == "set_status":
                    merged_updates["status"] = val
                    ctx["status"] = val
                    rule_actions_taken.append({"action": "set_status", "value": val})

                elif act_type == "add_tag":
                    existing_tags = list(merged_updates.get("tags") or ctx.get("tags") or [])
                    if str(val) not in existing_tags:
                        existing_tags.append(str(val))
                        merged_updates["tags"] = existing_tags
                        ctx["tags"] = existing_tags
                        rule_actions_taken.append({"action": "add_tag", "value": val})

                elif act_type == "remove_tag":
                    existing_tags = list(merged_updates.get("tags") or ctx.get("tags") or [])
                    if str(val) in existing_tags:
                        existing_tags.remove(str(val))
                        merged_updates["tags"] = existing_tags
                        ctx["tags"] = existing_tags
                        rule_actions_taken.append({"action": "remove_tag", "value": val})

                elif act_type == "assign_agent":
                    merged_updates["assigned_agent_email"] = val
                    ctx["assigned_agent_email"] = val
                    rule_actions_taken.append({"action": "assign_agent", "value": val})

                elif act_type == "send_internal_note":
                    existing_notes = list(merged_updates.get("internal_notes") or [])
                    existing_notes.append(str(val))
                    merged_updates["internal_notes"] = existing_notes
                    rule_actions_taken.append({"action": "send_internal_note", "value": val})

            executed_rules.append({
                "rule_id": rule.get("id"),
                "rule_name": rule.get("name", "Untitled Rule"),
                "actions": rule_actions_taken,
            })

    return merged_updates, executed_rules
