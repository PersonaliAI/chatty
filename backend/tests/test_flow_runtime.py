from app.services.flow_runtime import evaluate_condition, evaluate_retry, resolve_mapping, select_condition_branch


def test_retry_succeeds_after_bounded_failures():
    result = evaluate_retry({"max_attempts": 3, "timeout_ms": 5000, "simulate_failures": 1})
    assert result == {
        "max_attempts": 3,
        "timeout_ms": 5000,
        "attempts": 2,
        "succeeded": True,
        "exhausted": False,
        "outcome": "success",
    }


def test_retry_exhaustion_and_timeout_are_explicit():
    exhausted = evaluate_retry({"max_attempts": 2, "simulate_failures": 9})
    assert exhausted["outcome"] == "retry_exhausted"
    assert exhausted["attempts"] == 2
    timeout = evaluate_retry({"max_attempts": 4, "simulate_timeout": True})
    assert timeout["outcome"] == "timeout"
    assert timeout["exhausted"] is True


def test_retry_config_is_bounded_and_safe_for_ai_input():
    result = evaluate_retry({"max_attempts": "not-a-number", "timeout_ms": -100, "simulate_failures": 10_000})
    assert result["max_attempts"] == 3
    assert result["timeout_ms"] == 100
    assert result["attempts"] == 3


def test_condition_evaluator_is_declarative_and_fails_closed():
    assert evaluate_condition({"expression": 'input contains "demo"'}, "Need a DEMO") ["result"] is True
    assert evaluate_condition({"expression": "input != 'cancel'"}, "continue")["result"] is True
    unsupported = evaluate_condition({"expression": "__import__('os').system('bad')"}, "hello")
    assert unsupported["result"] is False
    assert unsupported["outcome"] == "unsupported_expression"


def test_condition_branches_are_deterministic_and_traceable():
    edges = [
        {"id": "fallback", "label": "default", "target": "fallback"},
        {"id": "no", "label": "false", "target": "no"},
        {"id": "yes", "label": "true", "target": "yes"},
        {"id": "sales", "label": "sales", "target": "sales"},
    ]
    selected, reason = select_condition_branch(edges, "sales", False)
    assert selected and selected["id"] == "sales"
    assert reason == "input_label"
    selected, reason = select_condition_branch(edges, "other", True)
    assert selected and selected["id"] == "yes"
    assert reason == "condition_result"


def test_mapping_resolution_preserves_types_and_surfaces_missing_values():
    result = resolve_mapping({
        "message": "Hello {{context.contact.name}} — {{input}}",
        "email": "{{context.contact.email}}",
        "score": "{{context.score}}",
        "api_key": "{{context.integration.api_key}}",
        "missing": "{{context.unknown}}",
        "literal": 4,
    }, "need a demo", {"contact": {"name": "Ari", "email": "ari@example.com"}, "score": 92, "integration": {"api_key": "should-not-appear"}})
    assert result["mapped_payload"] == {
        "message": "Hello Ari — need a demo",
        "email": "ari@example.com",
        "score": 92,
        "api_key": "[redacted]",
        "literal": 4,
    }
    assert result["trace_payload"]["email"] == "[redacted]"
    assert result["trace_payload"]["message"] == "Hello Ari — need a demo"
    assert result["unresolved_fields"] == ["missing"]


def test_mapping_redacts_nested_credentials_and_preserves_source_context():
    context = {"integration": {"name": "CRM", "credentials": [
        {"api_key": "private-key", "enabled": True},
        {"nested": {"Authorization": "Bearer private-token"}},
    ]}}
    result = resolve_mapping({"integration": "{{context.integration}}"}, "", context)
    payload = result["mapped_payload"]["integration"]
    assert payload["name"] == "CRM"
    assert payload["credentials"][0] == {"api_key": "[redacted]", "enabled": True}
    assert payload["credentials"][1]["nested"]["Authorization"] == "[redacted]"
    assert context["integration"]["credentials"][0]["api_key"] == "private-key"


def test_mapping_redacts_sensitive_source_paths_even_with_non_sensitive_aliases():
    result = resolve_mapping({"value": "{{context.integration.api_key}}",
                              "description": "Details: {{context.integration}}"}, "",
                             {"integration": {"api_key": "private-credential", "name": "CRM"}})
    assert result["mapped_payload"]["value"] == "[redacted]"
    assert "private-credential" not in result["mapped_payload"]["description"]
    assert "CRM" in result["mapped_payload"]["description"]
    assert result["unresolved_fields"] == []


def test_mapping_keeps_operational_contact_payload_but_redacts_trace():
    result = resolve_mapping(
        {"email": "{{context.email}}", "phone": "{{context.phone}}"},
        "",
        {"email": "visitor@example.com", "phone": "+15551234567"},
    )
    assert result["mapped_payload"] == {
        "email": "visitor@example.com",
        "phone": "+15551234567",
    }
    assert result["trace_payload"] == {
        "email": "[redacted]",
        "phone": "[redacted]",
    }


def test_typed_mapping_coerces_scalars_and_reports_invalid_values():
    result = resolve_mapping(
        {"amount": "{{context.amount}}", "confirmed": "{{context.confirmed}}", "bad": "{{context.bad}}"},
        "", {"amount": "12.50", "confirmed": "yes", "bad": "not-a-number"},
        {"amount": "number", "confirmed": "boolean", "bad": "number"},
    )
    assert result["mapped_payload"]["amount"] == 12.5
    assert result["mapped_payload"]["confirmed"] is True
    assert result["type_errors"] == [{"field": "bad", "expected": "number", "actual": "str"}]
