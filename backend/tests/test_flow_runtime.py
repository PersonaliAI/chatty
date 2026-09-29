from app.services.flow_runtime import evaluate_condition, evaluate_retry, select_condition_branch


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
