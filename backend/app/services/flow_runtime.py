"""Pure, bounded runtime semantics for Flow Builder simulation nodes."""

from __future__ import annotations

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
