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


_MAPPING_TOKEN = re.compile(r"\{\{\s*([A-Za-z_][A-Za-z0-9_.-]*)\s*\}\}")
_SENSITIVE_MAPPING_KEY = re.compile(r"(?:password|secret|token|api[_-]?key|authorization)", re.IGNORECASE)
_TRACE_SENSITIVE_MAPPING_KEY = re.compile(
    r"(?:password|secret|token|api[_-]?key|authorization|email|phone|mobile|contact)",
    re.IGNORECASE,
)


def redact_flow_trace_value(value: Any, depth: int = 0) -> Any:
    """Redact nested credentials without mutating operator context.

    Bound traversal for deeply nested input so execution logging cannot exhaust
    the Python stack. Full-token object mappings retain their JSON types.
    """
    if depth >= 32 and isinstance(value, (dict, list)):
        return "[depth limit]"
    if isinstance(value, dict):
        return {
            str(key): "[redacted]" if _TRACE_SENSITIVE_MAPPING_KEY.search(str(key))
            else redact_flow_trace_value(item, depth + 1)
            for key, item in value.items()
        }
    if isinstance(value, list):
        return [redact_flow_trace_value(item, depth + 1) for item in value]
    return value


def _resolve_mapping_path(path: str, user_input: str, context: dict[str, Any]) -> tuple[bool, Any]:
    if path == "input":
        return True, user_input
    if not path.startswith("context."):
        return False, None
    current: Any = context
    segments = path.removeprefix("context.").split(".")
    for segment in segments:
        if not isinstance(current, dict) or segment not in current:
            return False, None
        current = current[segment]
    if any(_SENSITIVE_MAPPING_KEY.search(segment) for segment in segments):
        return True, "[redacted]"
    # Redact before interpolation too: converting an object to a string would
    # otherwise conceal its credential keys from the final recursive pass.
    return True, redact_flow_trace_value(current)


def resolve_mapping(
    mapping: dict[str, Any] | None, user_input: str, context: dict[str, Any] | None = None,
    mapping_schema: dict[str, str] | None = None,
) -> dict[str, Any]:
    """Resolve the safe ``{{input}}``/``{{context.path}}`` mapping language.

    Full-token values preserve their JSON type. Interpolated strings use their
    textual representation. Unknown paths stay visible in ``unresolved`` so a
    dry run cannot hide an incomplete action payload.
    """
    source = mapping if isinstance(mapping, dict) else {}
    safe_context = context if isinstance(context, dict) else {}
    resolved: dict[str, Any] = {}
    unresolved: list[str] = []
    for key, raw_value in source.items():
        if not isinstance(raw_value, str):
            resolved[str(key)] = raw_value
            continue
        tokens = list(_MAPPING_TOKEN.finditer(raw_value))
        if not tokens:
            resolved[str(key)] = raw_value
            continue
        if len(tokens) == 1 and tokens[0].span() == (0, len(raw_value)):
            found, value = _resolve_mapping_path(tokens[0].group(1), user_input, safe_context)
            if found:
                resolved[str(key)] = value
            else:
                unresolved.append(str(key))
            continue
        failed = False
        def replace(match: re.Match[str]) -> str:
            nonlocal failed
            found, value = _resolve_mapping_path(match.group(1), user_input, safe_context)
            if not found:
                failed = True
                return match.group(0)
            return str(value)
        resolved[str(key)] = _MAPPING_TOKEN.sub(replace, raw_value)
        if failed:
            unresolved.append(str(key))
    type_errors: list[dict[str, str]] = []
    schema = mapping_schema if isinstance(mapping_schema, dict) else {}
    for key, expected in schema.items():
        if key not in resolved:
            continue
        value = resolved[key]
        expected = str(expected).lower()
        if expected == "any":
            continue
        if expected == "string" and not isinstance(value, str):
            resolved[key] = str(value)
        elif expected == "number" and (isinstance(value, bool) or not isinstance(value, (int, float))):
            try:
                text = str(value).strip()
                resolved[key] = float(text) if "." in text else int(text)
            except (TypeError, ValueError):
                type_errors.append({"field": str(key), "expected": expected, "actual": type(value).__name__})
        elif expected == "boolean" and not isinstance(value, bool):
            normalized = str(value).strip().lower()
            if normalized in {"true", "1", "yes", "on"}:
                resolved[key] = True
            elif normalized in {"false", "0", "no", "off"}:
                resolved[key] = False
            else:
                type_errors.append({"field": str(key), "expected": expected, "actual": type(value).__name__})
        elif expected == "object" and (not isinstance(value, dict)):
            type_errors.append({"field": str(key), "expected": expected, "actual": type(value).__name__})
        elif expected == "array" and (not isinstance(value, list)):
            type_errors.append({"field": str(key), "expected": expected, "actual": type(value).__name__})
    # Runs are persisted for later replay and troubleshooting. Never put an
    # obvious credential-shaped mapping value into that durable trace.
    # Keep the operational payload intact for the outbound integration. A
    # separate trace payload is returned for durable run history so contact
    # fields (email/phone) cannot leak into operator logs or replay snapshots.
    return {
        "mapped_payload": resolved,
        "trace_payload": redact_flow_trace_value(resolved),
        "unresolved_fields": unresolved,
        "type_errors": type_errors,
    }
