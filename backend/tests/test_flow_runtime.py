from app.services.flow_runtime import evaluate_retry


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
