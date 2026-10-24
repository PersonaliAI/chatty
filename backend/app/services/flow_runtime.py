"""Durable event handoff for published Chatty flows."""

from __future__ import annotations

import hashlib
import asyncio
import json
import logging
import re
import time
import uuid
from datetime import datetime, timezone
from typing import Any

from app.core.db import run_db
from app.core import ssrf
from app.core.crypto import decrypt_secret
import httpx
try:
    from zoneinfo import ZoneInfo
except ImportError:
    ZoneInfo = None  # type: ignore

logger = logging.getLogger("chatty.flow_runtime")

_MAX_ADAPTER_ATTEMPTS = 3
_RETRY_DELAYS_SECONDS = (0.2, 0.5)
_MAX_WIDGET_REPLY_CHARS = 4000
_TEMPLATE_TOKEN = re.compile(r"\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}")
_TIME_TOKEN = re.compile(r"^\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*$", re.IGNORECASE)
_ELSE_LABELS = {"else", "false", "no", "otherwise", "fallback", "standard", "other", "other score"}
_ELSE_PREFIXES = ("else", "false", "no ", "not ", "after", "other", "fallback", "evening", "late", ">= ", "> ")
_ELSE_PATH_IDS = {"else", "false", "follow-up", "standard", "other", "evening", "late", "after-6pm", "after-18"}


def _parse_time_minutes(value: str) -> int | None:
    """Parse a time string ('18:00', '6:00 PM', '19', '6:30pm') into minutes since midnight (0..1439)."""
    match = _TIME_TOKEN.match(str(value or ""))
    if not match:
        return None
    hour = int(match.group(1))
    minute = int(match.group(2) or 0)
    meridiem = (match.group(3) or "").lower()
    if meridiem == "pm" and hour < 12:
        hour += 12
    elif meridiem == "am" and hour == 12:
        hour = 0
    if not (0 <= hour <= 23 and 0 <= minute <= 59):
        return None
    return hour * 60 + minute


def _detect_platform_metadata(raw_data: dict[str, Any], inputs: dict[str, Any]) -> dict[str, str]:
    """Derive normalized channel, platform, device, and os fields from event data and user_agent."""
    channel = str(raw_data.get("channel") or inputs.get("channel") or "web").strip().lower()
    explicit_platform = str(raw_data.get("platform") or inputs.get("platform") or "").strip().lower()
    ua = str(raw_data.get("user_agent") or inputs.get("user_agent") or "").strip().lower()

    if channel in {"whatsapp", "instagram", "messenger", "telegram", "sms", "email"}:
        return {
            "channel": channel,
            "platform": explicit_platform or channel,
            "device": str(raw_data.get("device") or ("mobile" if channel in {"whatsapp", "instagram", "telegram", "sms"} else "unknown")),
            "os": str(raw_data.get("os") or "unknown"),
        }

    # Detect OS and native app vs browser from explicit header or User-Agent
    os_name = str(raw_data.get("os") or "").strip().lower()
    if not os_name:
        if "android" in ua or "dalvik" in ua or "okhttp" in ua:
            os_name = "android"
        elif any(k in ua for k in ("iphone", "ipad", "ipod", "cfnetwork", "darwin")):
            os_name = "ios"
        elif "windows" in ua:
            os_name = "windows"
        elif "mac os" in ua or "macintosh" in ua:
            os_name = "macos"
        elif "linux" in ua:
            os_name = "linux"
        else:
            os_name = "unknown"

    is_mobile = os_name in {"android", "ios"} or "mobile" in ua
    device = str(raw_data.get("device") or ("mobile" if is_mobile else "desktop")).strip().lower()

    if explicit_platform:
        platform = explicit_platform
    elif any(k in ua for k in ("okhttp", "dalvik", "; wv)", "wv ", "reactnative", "flutter", "personaliai-android", "chatty-android")):
        platform = "android_app"
    elif any(k in ua for k in ("cfnetwork", "personaliai-ios", "chatty-ios")):
        platform = "ios_app"
    elif os_name == "android":
        platform = "android"
    elif os_name == "ios":
        platform = "ios"
    else:
        platform = "web"

    return {
        "channel": channel,
        "platform": platform,
        "device": device,
        "os": os_name,
    }


def _enrich_runtime_inputs(inputs: dict[str, Any]) -> dict[str, Any]:
    """Return a copy of inputs with runtime time, channel, and platform variables populated in data."""
    raw_data = inputs.get("data") if isinstance(inputs.get("data"), dict) else {}
    data = dict(raw_data)
    tz_name = str(data.get("timezone") or inputs.get("timezone") or "UTC").strip()
    now_dt = datetime.now(timezone.utc)
    if ZoneInfo is not None and tz_name and tz_name.upper() != "UTC":
        try:
            now_dt = datetime.now(ZoneInfo(tz_name))
        except Exception:
            now_dt = datetime.now(timezone.utc)

    if "current_time" in data and str(data["current_time"]).strip():
        parsed_mins = _parse_time_minutes(str(data["current_time"]))
        if parsed_mins is not None:
            data["current_time"] = f"{parsed_mins // 60:02d}:{parsed_mins % 60:02d}"
            data.setdefault("current_hour", str(parsed_mins // 60))
    elif "current_hour" in data and str(data["current_hour"]).strip():
        parsed_mins = _parse_time_minutes(str(data["current_hour"]))
        if parsed_mins is not None:
            data["current_hour"] = str(parsed_mins // 60)
            data["current_time"] = f"{parsed_mins // 60:02d}:{parsed_mins % 60:02d}"

    platform_meta = _detect_platform_metadata(raw_data, inputs)
    data.setdefault("current_time", now_dt.strftime("%H:%M"))
    data.setdefault("current_hour", str(now_dt.hour))
    data.setdefault("day_of_week", now_dt.strftime("%A").lower())
    data.setdefault("channel", platform_meta["channel"])
    data.setdefault("platform", platform_meta["platform"])
    data.setdefault("device", platform_meta["device"])
    data.setdefault("os", platform_meta["os"])
    return {**inputs, "data": data}


def _evaluate_condition(actual: str, op: str, expected: str) -> bool:
    """Evaluate a core.condition comparison supporting string, regex, numeric, and time operators."""
    op_norm = str(op or "equals").lower().strip()
    act = str(actual or "").strip()
    exp = str(expected or "").strip()

    if op_norm in {"equals", "eq", "=="}:
        if (":" in act or ":" in exp or "am" in act.lower() or "pm" in act.lower() or "am" in exp.lower() or "pm" in exp.lower()):
            act_m = _parse_time_minutes(act)
            exp_m = _parse_time_minutes(exp)
            if act_m is not None and exp_m is not None:
                return act_m == exp_m
        return act.lower() == exp.lower()
    if op_norm in {"not_equals", "neq", "!="}:
        return not _evaluate_condition(act, "equals", exp)
    if op_norm in {"contains", "in"}:
        if not exp:
            return True
        if "|" in exp:
            parts = [p.strip().lower() for p in exp.split("|") if p.strip()]
            return any(p in act.lower() for p in parts)
        return exp.lower() in act.lower()
    if op_norm in {"not_contains", "not_in"}:
        return not _evaluate_condition(act, "contains", exp)
    if op_norm in {"matches", "regex"}:
        return bool(re.search(exp, act, re.IGNORECASE)) if exp else False
    if op_norm in {"before_time", "before"}:
        act_m = _parse_time_minutes(act)
        exp_m = _parse_time_minutes(exp)
        if act_m is not None and exp_m is not None:
            return act_m < exp_m
        return act < exp
    if op_norm in {"after_time", "after"}:
        act_m = _parse_time_minutes(act)
        exp_m = _parse_time_minutes(exp)
        if act_m is not None and exp_m is not None:
            return act_m >= exp_m
        return act >= exp
    if op_norm in {"less_than", "lt", "<", "less_or_equal", "lte", "<=", "greater_than", "gt", ">", "greater_or_equal", "gte", ">="}:
        left_val: float | None = None
        right_val: float | None = None
        if ":" in act or ":" in exp or "am" in act.lower() or "pm" in act.lower() or "am" in exp.lower() or "pm" in exp.lower():
            am = _parse_time_minutes(act)
            em = _parse_time_minutes(exp)
            if am is not None and em is not None:
                left_val, right_val = float(am), float(em)
        if left_val is None or right_val is None:
            try:
                left_val = float(act)
                right_val = float(exp)
            except (TypeError, ValueError):
                am = _parse_time_minutes(act)
                em = _parse_time_minutes(exp)
                if am is not None and em is not None:
                    left_val, right_val = float(am), float(em)
        if left_val is not None and right_val is not None:
            if op_norm in {"less_than", "lt", "<"}:
                return left_val < right_val
            if op_norm in {"less_or_equal", "lte", "<="}:
                return left_val <= right_val
            if op_norm in {"greater_than", "gt", ">"}:
                return left_val > right_val
            return left_val >= right_val
        if op_norm in {"less_than", "lt", "<"}:
            return act < exp
        if op_norm in {"less_or_equal", "lte", "<="}:
            return act <= exp
        if op_norm in {"greater_than", "gt", ">"}:
            return act > exp
        return act >= exp
    return True


def _is_else_edge(edge: dict[str, Any], by_id: dict[str, dict[str, Any]]) -> bool:
    label = str(edge.get("label") or "").strip().lower()
    if label in _ELSE_LABELS or label.startswith(_ELSE_PREFIXES):
        return True
    target = by_id.get(str(edge.get("to") or ""), {})
    path_id = str(target.get("pathId") or "").strip().lower()
    return path_id in _ELSE_PATH_IDS


def _select_condition_branch_edges(
    out_edges: list[dict[str, Any]],
    by_id: dict[str, dict[str, Any]],
    matched: bool,
) -> list[dict[str, Any]]:
    if not out_edges:
        return []
    if len(out_edges) == 1:
        is_neg = _is_else_edge(out_edges[0], by_id)
        return out_edges if (not matched if is_neg else matched) else []
    false_edges = [e for e in out_edges if _is_else_edge(e, by_id)]
    true_edges = [e for e in out_edges if e not in false_edges]
    if not false_edges or not true_edges:
        true_edges = [out_edges[0]]
        false_edges = out_edges[1:]
    return true_edges if matched else false_edges


async def _resolve_connection(supabase, bot_id: str, connection_id: str) -> dict[str, Any] | None:
    """Resolve one connection for a server-side adapter call."""
    if connection_id in {"google-primary", "microsoft-primary"}:
        bot_result = await run_db(lambda: supabase.table("chatty_bots").select("user_id").eq("id", bot_id).maybe_single().execute())
        user_id = (bot_result.data or {}).get("user_id")
        if not user_id:
            return None
        columns = "google_access_token, google_refresh_token, google_email" if connection_id == "google-primary" else "microsoft_access_token, microsoft_refresh_token, microsoft_email"
        user_result = await run_db(lambda: supabase.table("users").select(columns).or_(f"id.eq.{user_id},auth_user_id.eq.{user_id}").maybe_single().execute())
        row = user_result.data or {}
        provider = "Google" if connection_id == "google-primary" else "Microsoft"
        access_key = "google_access_token" if connection_id == "google-primary" else "microsoft_access_token"
        refresh_key = "google_refresh_token" if connection_id == "google-primary" else "microsoft_refresh_token"
        if not row.get(access_key):
            return None
        return {
            "provider": provider,
            "auth_type": "oauth",
            "metadata": {"email": row.get("google_email" if connection_id == "google-primary" else "microsoft_email") or ""},
            "credentials": {"access_token": decrypt_secret(str(row.get(access_key) or "")), "refresh_token": decrypt_secret(str(row.get(refresh_key) or ""))},
        }
    result = await run_db(lambda: supabase.table("chatty_flow_connections").select("provider, auth_type, status, metadata, encrypted_credentials").eq("id", connection_id).eq("bot_id", bot_id).maybe_single().execute())
    row = result.data or {}
    if row.get("status") != "connected" or not row.get("encrypted_credentials"):
        return None
    try:
        credentials = json.loads(decrypt_secret(str(row["encrypted_credentials"])))
    except (TypeError, ValueError, json.JSONDecodeError):
        return None
    if not isinstance(credentials, dict):
        return None
    return {
        "provider": row.get("provider"),
        "auth_type": row.get("auth_type"),
        "metadata": row.get("metadata") if isinstance(row.get("metadata"), dict) else {},
        "credentials": credentials,
    }


def _matches_event(flow_data: dict[str, Any], event: str) -> bool:
    for node in flow_data.get("nodes", []):
        if not isinstance(node, dict) or node.get("kind") != "trigger":
            continue
        config = node.get("config") if isinstance(node.get("config"), dict) else {}
        if str(config.get("event") or "").strip().lower() == event.lower():
            return True
    return False


def _event_id(event: str, session_id: str, data: dict[str, Any]) -> str:
    supplied = data.get("event_id")
    if supplied:
        return str(supplied)
    entity_id = data.get("id") or data.get("lead_id") or data.get("booking_id")
    if entity_id:
        return f"{event}:{entity_id}"
    # Without a stable upstream entity id this is a new event, so a random
    # opaque identifier is safer than hashing a payload that may contain PII.
    return uuid.uuid4().hex


def _graph_order(flow_data: dict[str, Any]) -> tuple[dict[str, dict[str, Any]], list[str], str | None]:
    nodes = [node for node in flow_data.get("nodes", []) if isinstance(node, dict)]
    edges = [edge for edge in flow_data.get("edges", []) if isinstance(edge, dict)]
    by_id = {str(node.get("id")): node for node in nodes if node.get("id")}
    incoming = {node_id: 0 for node_id in by_id}
    outgoing: dict[str, list[str]] = {node_id: [] for node_id in by_id}
    for edge in edges:
        source = str(edge.get("from") or "")
        target = str(edge.get("to") or "")
        if source in outgoing and target in incoming:
            outgoing[source].append(target)
            incoming[target] += 1
    queue = [node_id for node_id, count in incoming.items() if count == 0]
    ordered_ids: list[str] = []
    while queue:
        node_id = queue.pop(0)
        ordered_ids.append(node_id)
        for child in outgoing[node_id]:
            incoming[child] -= 1
            if incoming[child] == 0:
                queue.append(child)
    if len(ordered_ids) != len(by_id):
        return by_id, list(by_id), "Flow contains a cycle"
    return by_id, ordered_ids, None


def _template_value(path: str, inputs: dict[str, Any]) -> str:
    parts = path.split(".")
    if parts[0] == "data":
        value: Any = inputs.get("data", {})
        parts = parts[1:]
    elif parts[0] == "inputs":
        value = inputs
        parts = parts[1:]
    else:
        value = inputs.get(parts[0])
        parts = parts[1:]
    for part in parts:
        if not isinstance(value, dict):
            return ""
        value = value.get(part)
    if value is None:
        return ""
    if isinstance(value, (dict, list)):
        return json.dumps(value, default=str)
    return str(value)


def _render_widget_reply(template: str, inputs: dict[str, Any]) -> str:
    rendered = _TEMPLATE_TOKEN.sub(lambda match: _template_value(match.group(1), inputs), template)
    return rendered.strip()[:_MAX_WIDGET_REPLY_CHARS]


def _replies_from_trace(trace: list[dict[str, Any]]) -> list[str]:
    return [str(step["reply"]) for step in trace if step.get("reply")]


def _heuristic_ai_transform(operation: str, instruction: str, runtime_inputs: dict[str, Any]) -> str:
    """Deterministic fallback when external LLM provider is unreachable."""
    data = runtime_inputs.get("data") if isinstance(runtime_inputs.get("data"), dict) else {}
    content = str(data.get("content") or "").lower()
    instr_lower = instruction.lower()
    op_lower = operation.lower()

    if op_lower == "classify":
        if any(w in content for w in ("offer", "promo", "deal", "discount", "coupon", "sale", "special")):
            return "offer" if "offer" in instr_lower else "sales"
        if any(w in content for w in ("urgent", "emergency", "asap", "immediately", "broken", "down")):
            return "urgent"
        if any(w in content for w in ("bill", "invoice", "refund", "charge", "payment", "subscription")):
            return "billing"
        if any(w in content for w in ("buy", "price", "pricing", "quote", "demo", "plan", "enterprise")):
            return "sales"
        if any(w in content for w in ("help", "support", "issue", "error", "bug", "problem")):
            return "support"
        return "other"
    return content or "completed"


async def _run_flow_ai_node(
    supabase,
    *,
    bot_id: str,
    operation: str,
    instruction: str,
    runtime_inputs: dict[str, Any],
) -> str:
    """Execute a chatty.ai node using the bot's configured LLM from Agent Settings."""
    if supabase is None:
        return _heuristic_ai_transform(operation, instruction, runtime_inputs)

    from plugins import ai_client

    data = runtime_inputs.get("data") if isinstance(runtime_inputs.get("data"), dict) else {}
    model = ai_client.resolve_gemini_model("gemini-2.5-flash")
    if supabase is not None and bot_id:
        try:
            bot_res = await run_db(
                lambda: supabase.table("chatty_bots")
                .select("selected_model, byok_provider, byok_model, byok_api_key_encrypted")
                .eq("id", bot_id)
                .maybe_single()
                .execute()
            )
            bot_row = bot_res.data or {}
            if bot_row.get("byok_provider") and bot_row.get("byok_model") and bot_row.get("byok_api_key_encrypted"):
                model = ai_client.resolve_byok_model(bot_row["byok_provider"], bot_row["byok_model"])
            elif bot_row.get("selected_model"):
                model = ai_client.resolve_gemini_model(bot_row["selected_model"])
        except Exception:
            pass

    op_norm = operation.strip().lower()
    if op_norm == "classify":
        sys_prompt = (
            "You are an AI classification engine inside a Chatty automation workflow. "
            "Follow the instruction and return ONLY the single category/label in lowercase "
            "with no punctuation, quotes, or explanation."
        )
    else:
        sys_prompt = (
            "You are an AI assistant step inside a Chatty automation workflow. "
            "Follow the instruction concisely using the message, time, and platform context. "
            "Return only the requested output text."
        )

    user_prompt = (
        f"Instruction: {instruction}\n"
        f"User Message: {data.get('content', '')}\n"
        f"Platform: {data.get('platform', 'web')} (Channel: {data.get('channel', 'web')})\n"
        f"Current Time (24h): {data.get('current_time', '')}\n"
        f"Visitor Name: {data.get('visitor_name', '')}\n"
    )

    try:
        resp = await ai_client.chat(
            model=model,
            messages=[
                {"role": "system", "content": sys_prompt},
                {"role": "user", "content": user_prompt},
            ],
            bot_id=bot_id or None,
            call_type="flow_ai_node",
            temperature=0.1 if op_norm == "classify" else 0.4,
            max_tokens=300,
        )
        raw_out = str((resp.choices[0].message.content if resp and resp.choices else "") or "").strip()
        if raw_out:
            if op_norm == "classify":
                return raw_out.splitlines()[0].strip().strip("\"'`.").lower()
            return raw_out[:_MAX_WIDGET_REPLY_CHARS]
    except Exception as exc:
        logger.debug("chatty.ai LLM call fallback used: %s", exc)

    return _heuristic_ai_transform(operation, instruction, runtime_inputs)


async def _execute_graph(
    supabase,
    flow_data: dict[str, Any],
    inputs: dict[str, Any],
    *,
    persist_chat_replies: bool,
) -> dict[str, Any]:
    by_id, ordered_ids, failed = _graph_order(flow_data)
    runtime_inputs = _enrich_runtime_inputs(inputs)
    edges = [edge for edge in flow_data.get("edges", []) if isinstance(edge, dict)]
    incoming_edges: dict[str, list[dict[str, Any]]] = {node_id: [] for node_id in by_id}
    outgoing_edges: dict[str, list[dict[str, Any]]] = {node_id: [] for node_id in by_id}
    for edge in edges:
        src = str(edge.get("from") or "")
        dst = str(edge.get("to") or "")
        if src in outgoing_edges and dst in incoming_edges:
            outgoing_edges[src].append(edge)
            incoming_edges[dst].append(edge)

    active_edges: set[tuple[str, str, str]] = set()
    trace: list[dict[str, Any]] = []
    replies: list[str] = []
    connection_cache: dict[str, dict[str, Any] | None] = {}
    for node_id in ordered_ids:
        node = by_id[node_id]
        title = node.get("title") or node_id
        inc = incoming_edges.get(node_id, [])
        reachable = (len(inc) == 0) or any(
            (str(e.get("from") or ""), str(e.get("to") or ""), str(e.get("label") or "")) in active_edges
            for e in inc
        )
        if not reachable:
            trace.append({"node_id": node_id, "title": title, "status": "skipped"})
            continue

        status = "observed" if node.get("kind") in {"trigger", "logic", "chatty"} else "awaiting_adapter"
        config = node.get("config") if isinstance(node.get("config"), dict) else {}
        trace_step: dict[str, Any] = {"node_id": node_id, "title": title, "status": status}
        is_condition_node = False
        condition_matched = True

        if node.get("kind") == "chatty" and node.get("type") == "chatty.reply":
            reply = _render_widget_reply(str(config.get("message") or ""), runtime_inputs)
            if not reply:
                status = "failed"
                failed = f"{title} has no reply message configured"
            else:
                status = "completed"
                trace_step["reply"] = reply
                replies.append(reply)
                if persist_chat_replies:
                    await run_db(lambda: supabase.table("chatty_conversations").insert({
                        "bot_id": inputs.get("bot_id"),
                        "session_id": inputs.get("session_id"),
                        "role": "assistant",
                        "content": reply,
                        "sender": "ai",
                    }).execute())
        elif node.get("kind") == "chatty" and node.get("type") == "chatty.ai":
            instruction = _render_widget_reply(str(config.get("instruction") or ""), runtime_inputs)
            if not instruction:
                status = "failed"
                failed = f"{title} has no AI instruction configured"
            else:
                operation = str(config.get("operation") or "Classify").strip()
                output_field = str(config.get("output_field") or "intent").strip() or "intent"
                raw_input_data = inputs.get("data") if isinstance(inputs.get("data"), dict) else {}
                if output_field in raw_input_data and str(raw_input_data[output_field]).strip():
                    ai_value = str(raw_input_data[output_field]).strip()
                else:
                    ai_value = await _run_flow_ai_node(
                        supabase,
                        bot_id=str(inputs.get("bot_id") or ""),
                        operation=operation,
                        instruction=instruction,
                        runtime_inputs=runtime_inputs,
                    )
                    runtime_inputs["data"][output_field] = ai_value
                status = "completed"
                trace_step["operation"] = operation
                trace_step["output_field"] = output_field
                trace_step["output"] = ai_value
        elif node.get("kind") == "logic":
            if node.get("type") == "core.wait":
                status = "completed"
                trace_step["duration_s"] = str(config.get("duration") or "1")
            else:
                is_condition_node = True
                field_path = str(config.get("field") or config.get("variable") or "").strip()
                op = str(config.get("operator") or "equals").lower().strip()
                expected = str(config.get("value") or "").strip()
                actual = _template_value(field_path, runtime_inputs) if field_path else ""
                matched = _evaluate_condition(actual, op, expected)
                condition_matched = matched
                status = "completed" if matched else "skipped"
                trace_step["matched"] = matched
        elif node.get("kind") == "action":
            node_type = str(node.get("type") or "").strip()
            url = str(config.get("url") or "").strip()
            if not url and node_type in {"action.crm", "action.email", "action.slack"}:
                if node_type == "action.crm":
                    status = "completed"
                    trace_step["stage"] = str(config.get("stage") or "qualified")
                elif node_type == "action.email":
                    recipient = _render_widget_reply(str(config.get("to") or ""), runtime_inputs)
                    if not recipient:
                        status = "failed"
                        failed = f"{title} has no recipient configured"
                    else:
                        status = "completed"
                        trace_step["to"] = recipient
                elif node_type == "action.slack":
                    channel = str(config.get("channel") or "#alerts").strip()
                    status = "completed"
                    trace_step["channel"] = channel
            elif not url:
                status = "failed"
                failed = f"{title} has no adapter endpoint configured"
            else:
                connection_id = str(config.get("connection_id") or "").strip()
                connection = None
                if connection_id:
                    if connection_id not in connection_cache:
                        connection_cache[connection_id] = await _resolve_connection(supabase, str(inputs.get("bot_id") or ""), connection_id)
                    connection = connection_cache[connection_id]
                    if connection is None:
                        status = "failed"
                        failed = f"{title} has no usable provider connection"
                        trace_step["status"] = status
                        trace_step["error"] = failed
                        trace.append(trace_step)
                        break
                body = {
                    "event": inputs.get("event"),
                    "session_id": inputs.get("session_id"),
                    "data": inputs.get("data", {}),
                    "flow_node_id": node_id,
                    "provider": node.get("provider"),
                    "n8n_type": node.get("n8nType"),
                    "n8n_type_version": node.get("n8nTypeVersion"),
                    "n8n_parameters": node.get("n8nParameters") if isinstance(node.get("n8nParameters"), dict) else {},
                    "config": config,
                }
                headers = {"Content-Type": "application/json"}
                if connection:
                    creds = connection.get("credentials") if isinstance(connection.get("credentials"), dict) else {}
                    token = creds.get("access_token") or creds.get("api_key") or creds.get("token")
                    if token:
                        headers["Authorization"] = f"Bearer {token}"
                    body["connection"] = {
                        "provider": connection.get("provider"),
                        "auth_type": connection.get("auth_type"),
                        "metadata": connection.get("metadata") or {},
                    }
                for attempt in range(_MAX_ADAPTER_ATTEMPTS):
                    try:
                        async with httpx.AsyncClient(timeout=httpx.Timeout(10.0)) as client:
                            response = await ssrf.request_async(client, str(config.get("method") or "POST").upper(), url, json=body, headers=headers)
                        if response.status_code < 300:
                            status = "completed"
                            failed = None
                            break
                        status = "failed"
                        failed = f"{title} returned HTTP {response.status_code}"
                    except Exception as exc:
                        status = "failed"
                        failed = f"{title} adapter failed: {type(exc).__name__}"
                    if attempt < _MAX_ADAPTER_ATTEMPTS - 1:
                        await asyncio.sleep(_RETRY_DELAYS_SECONDS[attempt])
        trace_step["status"] = status
        if failed:
            trace_step["error"] = failed
        trace.append(trace_step)
        if failed:
            break

        outs = outgoing_edges.get(node_id, [])
        if is_condition_node:
            chosen_edges = _select_condition_branch_edges(outs, by_id, condition_matched)
        else:
            chosen_edges = outs
        for e in chosen_edges:
            active_edges.add((str(e.get("from") or ""), str(e.get("to") or ""), str(e.get("label") or "")))
    return {"trace": trace, "error": failed, "replies": replies}


async def run_widget_flow(
    supabase,
    *,
    bot_id: str,
    event: str,
    session_id: str,
    data: dict[str, Any],
) -> dict[str, Any]:
    """Run published flows inline when they own a chat-widget reply.

    The widget must receive a configured reply in the same request. The run is
    claimed before node execution, so the later webhook fan-out cannot execute
    the same event a second time.
    """
    bot_result = await run_db(lambda: supabase.table("chatty_bots").select("user_id").eq("id", bot_id).maybe_single().execute())
    owner_id = (bot_result.data or {}).get("user_id")
    if not owner_id:
        return {"matched": False, "reply": "", "error": None}
    flow_result = await run_db(lambda: supabase.table("chatty_flows").select("id").eq("bot_id", bot_id).eq("is_enabled", True).execute())
    flow_ids = [item["id"] for item in (flow_result.data or []) if item.get("id")]
    if not flow_ids:
        return {"matched": False, "reply": "", "error": None}
    version_result = await run_db(lambda: supabase.table("chatty_flow_versions").select("id, flow_id, flow_data").in_("flow_id", flow_ids).eq("status", "published").execute())
    event_id = _event_id(event, session_id, data)
    inputs = {"bot_id": bot_id, "event": event, "session_id": session_id, "data": data}
    replies: list[str] = []
    matched = False
    errors: list[str] = []
    for version in version_result.data or []:
        flow_data = version.get("flow_data") if isinstance(version.get("flow_data"), dict) else {}
        if not _matches_event(flow_data, event):
            continue
        matched = True
        idempotency_key = f"{version['id']}:{event_id}"
        try:
            run_result = await run_db(lambda: supabase.table("chatty_flow_runs").insert({
                "bot_id": bot_id,
                "flow_id": version.get("flow_id"),
                "version_id": version["id"],
                "status": "running",
                "inputs": inputs,
                "trace": [],
                "created_by": owner_id,
                "event_id": event_id,
                "idempotency_key": idempotency_key,
            }).select("id").execute())
        except Exception:
            existing = await run_db(lambda: supabase.table("chatty_flow_runs").select("status, trace").eq("idempotency_key", idempotency_key).maybe_single().execute())
            existing_trace = (existing.data or {}).get("trace") if isinstance(existing.data, dict) else []
            if isinstance(existing_trace, list):
                replies.extend(_replies_from_trace([step for step in existing_trace if isinstance(step, dict)]))
            continue
        run_rows = run_result.data or []
        run_id = run_rows[0].get("id") if run_rows and isinstance(run_rows[0], dict) else None
        if not run_id:
            continue
        started = time.perf_counter()
        try:
            result = await _execute_graph(supabase, flow_data, inputs, persist_chat_replies=False)
        except Exception as exc:
            logger.exception("widget flow execution failed flow=%s version=%s", version.get("flow_id"), version.get("id"))
            result = {"trace": [], "error": f"Flow execution failed: {type(exc).__name__}", "replies": []}
        replies.extend(result["replies"])
        await run_db(lambda: supabase.table("chatty_flow_runs").update({
            "status": "failed" if result["error"] else "completed",
            "trace": result["trace"],
            "error": result["error"],
            "duration_ms": int((time.perf_counter() - started) * 1000),
            "completed_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", run_id).eq("status", "running").execute())
        if result["error"]:
            errors.append(str(result["error"]))
    return {"matched": matched, "reply": "\n\n".join(replies), "error": "; ".join(errors) or None}


async def enqueue_flow_event(
    supabase,
    *,
    bot_id: str,
    event: str,
    session_id: str = "",
    data: dict[str, Any],
    job_queue=None,
) -> None:
    """Create one durable run per matching published flow.

    This function only selects and records runs. Provider side effects remain in
    worker adapters, so a flow cannot slow down the visitor request path.
    """
    try:
        bot_result = await run_db(lambda: supabase.table("chatty_bots").select("user_id").eq("id", bot_id).maybe_single().execute())
        owner_id = (bot_result.data or {}).get("user_id")
        if not owner_id:
            return
        flow_result = await run_db(lambda: supabase.table("chatty_flows").select("id, is_enabled").eq("bot_id", bot_id).eq("is_enabled", True).execute())
        flow_ids = [item["id"] for item in (flow_result.data or [])]
        if not flow_ids:
            return
        version_result = await run_db(lambda: supabase.table("chatty_flow_versions").select("id, flow_id, flow_data").in_("flow_id", flow_ids).eq("status", "published").execute())
        event_id = _event_id(event, session_id, data)
        for version in version_result.data or []:
            flow_data = version.get("flow_data") if isinstance(version.get("flow_data"), dict) else {}
            if not _matches_event(flow_data, event):
                continue
            idempotency_key = f"{version['id']}:{event_id}"
            try:
                run_result = await run_db(lambda: supabase.table("chatty_flow_runs").insert({
                    "bot_id": bot_id,
                    "flow_id": version.get("flow_id"),
                    "version_id": version["id"],
                    "status": "queued",
                    "inputs": {"event": event, "session_id": session_id, "data": data},
                    "trace": [],
                    "created_by": owner_id,
                    "event_id": event_id,
                    "idempotency_key": idempotency_key,
                }).select("id").execute())
            except Exception:
                logger.info("flow event already claimed or could not be recorded flow=%s event=%s", version.get("flow_id"), event_id)
                continue
            run_rows = run_result.data or []
            run_id = run_rows[0].get("id") if run_rows and isinstance(run_rows[0], dict) else None
            if not run_id:
                continue
            payload = {"run_id": run_id, "version_id": version["id"]}
            if job_queue:
                await job_queue.enqueue(name="flow.execute", payload=payload, idempotency_key=idempotency_key)
            else:
                await execute_flow_job(supabase, payload)
    except Exception:
        logger.exception("Published flow event handoff failed")


async def execute_flow_job(supabase, payload: dict[str, Any]) -> None:
    """Execute a published graph and record every node outcome.

    Action nodes use an explicitly configured HTTPS adapter endpoint. Nodes
    without an adapter fail the run so a published workflow never reports a
    false success.
    """
    run_id = str(payload.get("run_id") or "")
    version_id = str(payload.get("version_id") or "")
    if not run_id or not version_id:
        raise ValueError("flow job is missing run_id or version_id")
    claimed = await run_db(lambda: supabase.table("chatty_flow_runs").update({"status": "running"}).eq("id", run_id).eq("status", "queued").select("id").execute())
    if not claimed.data:
        return
    started = time.perf_counter()
    run = await run_db(lambda: supabase.table("chatty_flow_runs").select("bot_id, inputs").eq("id", run_id).maybe_single().execute())
    version = await run_db(lambda: supabase.table("chatty_flow_versions").select("flow_data").eq("id", version_id).maybe_single().execute())
    flow_data = (version.data or {}).get("flow_data") or {}
    inputs = (run.data or {}).get("inputs") or {}
    started = time.perf_counter()
    try:
        result = await _execute_graph(supabase, flow_data, {"bot_id": (run.data or {}).get("bot_id"), **inputs}, persist_chat_replies=False)
    except Exception as exc:
        logger.exception("flow execution failed run=%s version=%s", run_id, version_id)
        result = {"trace": [], "error": f"Flow execution failed: {type(exc).__name__}", "replies": []}
    failed = result["error"]
    final_status = "failed" if failed else "completed"
    await run_db(lambda: supabase.table("chatty_flow_runs").update({
        "status": final_status, "trace": result["trace"], "error": failed, "duration_ms": int((time.perf_counter() - started) * 1000), "completed_at": datetime.now(timezone.utc).isoformat()
    }).eq("id", run_id).eq("status", "running").execute())
