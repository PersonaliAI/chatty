"""Pure, bounded runtime semantics for Flow Builder simulation nodes."""

from __future__ import annotations

import re
from typing import Any


def _bounded_int(value: Any, default: int, minimum: int, maximum: int) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        parsed = default
    return max(minimum, min(maximum, parsed))


def evaluate_retry(config: dict[str, Any] | None = None) -> dict[str, Any]:
    """Evaluate a retry policy without sleeping or performing side effects.

    ``simulate_failures`` is a dry-run-only knob representing how many initial
    attempts fail. ``simulate_timeout`` forces the timeout path. Both values
    are bounded so malformed or AI-generated config cannot create unbounded
    work.
    """
    settings = config if isinstance(config, dict) else {}
    max_attempts = _bounded_int(settings.get("max_attempts"), 3, 1, 10)
    timeout_ms = _bounded_int(settings.get("timeout_ms"), 30_000, 100, 300_000)
    failures = _bounded_int(settings.get("simulate_failures"), 0, 0, max_attempts)
    timed_out = bool(settings.get("simulate_timeout", False))
    attempts = max_attempts if timed_out else min(max_attempts, failures + 1)
    succeeded = not timed_out and failures < max_attempts
    return {
        "max_attempts": max_attempts,
        "timeout_ms": timeout_ms,
        "attempts": attempts,
        "succeeded": succeeded,
        "exhausted": not succeeded,
        "outcome": "timeout" if timed_out else ("success" if succeeded else "retry_exhausted"),
    }


def evaluate_condition(config: dict[str, Any] | None, user_input: str) -> dict[str, Any]:
    """Safely evaluate the small condition language used by flow dry-runs.

    This intentionally does *not* use ``eval``.  A flow can compare the
    current input with a quoted value using ``==``, ``!=``, ``contains``,
    ``starts_with``, or ``ends_with``.  Unsupported expressions fail closed
    and remain visible in the run trace instead of taking a surprising branch.
    """
    settings = config if isinstance(config, dict) else {}
    expression = str(settings.get("expression") or "").strip()
    normalized = str(user_input or "").strip().casefold()
    if not expression:
        return {"expression": "", "result": bool(normalized), "outcome": "input_present"}

    lowered = expression.casefold().strip()
    if lowered in {"true", "always"}:
        return {"expression": expression, "result": True, "outcome": "literal"}
    if lowered in {"false", "never"}:
        return {"expression": expression, "result": False, "outcome": "literal"}
    if lowered == "input":
        return {"expression": expression, "result": bool(normalized), "outcome": "input_present"}

    match = re.fullmatch(
        r"input\s*(==|!=|contains|starts_with|ends_with)\s*(['\"])(.*?)\2",
        expression,
        flags=re.IGNORECASE | re.DOTALL,
    )
    if not match:
        return {"expression": expression, "result": False, "outcome": "unsupported_expression"}
    operator, _, expected = match.groups()
    expected_normalized = expected.strip().casefold()
    operator = operator.casefold()
    if operator == "==":
        result = normalized == expected_normalized
    elif operator == "!=":
        result = normalized != expected_normalized
    elif operator == "contains":
        result = expected_normalized in normalized
    elif operator == "starts_with":
        result = normalized.startswith(expected_normalized)
    else:
        result = normalized.endswith(expected_normalized)
    return {"expression": expression, "result": result, "outcome": "evaluated"}


def select_condition_branch(
    outgoing: list[dict[str, Any]], user_input: str, condition_result: bool,
) -> tuple[dict[str, Any] | None, str]:
    """Choose condition output deterministically and make the reason visible."""
    normalized = str(user_input or "").strip().casefold()

    def labelled(value: str) -> dict[str, Any] | None:
        return next(
            (edge for edge in outgoing if str(edge.get("label") or "").strip().casefold() == value),
            None,
        )

    exact = labelled(normalized) if normalized else None
    if exact is not None:
        return exact, "input_label"
    boolean = labelled("true" if condition_result else "false")
    if boolean is not None:
        return boolean, "condition_result"
    default = labelled("default")
    if default is not None:
        return default, "default"
    return (outgoing[0], "first_outgoing") if outgoing else (None, "no_outgoing")
