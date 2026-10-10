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

logger = logging.getLogger("chatty.flow_runtime")

_MAX_ADAPTER_ATTEMPTS = 3
_RETRY_DELAYS_SECONDS = (0.2, 0.5)
_MAX_WIDGET_REPLY_CHARS = 4000
_TEMPLATE_TOKEN = re.compile(r"\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}")


async def _resolve_connection(supabase, bot_id: str, connection_id: str) -> dict[str, Any] | None:
    """Resolve one connection for a server-side adapter call."""
    if connection_id in {"google-primary", "microsoft-primary"}:
        bot_result = await run_db(lambda: supabase.table("chatty_bots").select("user_id").eq("id", bot_id).maybe_single().execute())
        user_id = (bot_result.data or {}).get("user_id")
        if not user_id:
            return None
        columns = "google_access_token, google_refresh_token, google_email" if connection_id == "google-primary" else "microsoft_access_token, microsoft_refresh_token, microsoft_email"
        user_result = await run_db(lambda: supabase.table("users").select(columns).eq("id", user_id).maybe_single().execute())
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


async def _execute_graph(
    supabase,
    flow_data: dict[str, Any],
    inputs: dict[str, Any],
    *,
    persist_chat_replies: bool,
) -> dict[str, Any]:
    by_id, ordered_ids, failed = _graph_order(flow_data)
    trace: list[dict[str, Any]] = []
    replies: list[str] = []
    connection_cache: dict[str, dict[str, Any] | None] = {}
    for node_id in ordered_ids:
        node = by_id[node_id]
        title = node.get("title") or node_id
        status = "observed" if node.get("kind") in {"trigger", "logic", "chatty"} else "awaiting_adapter"
        config = node.get("config") if isinstance(node.get("config"), dict) else {}
        trace_step: dict[str, Any] = {"node_id": node_id, "title": title, "status": status}
        if node.get("kind") == "chatty" and node.get("type") == "chatty.reply":
            reply = _render_widget_reply(str(config.get("message") or ""), inputs)
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
        elif node.get("kind") == "action":
            url = str(config.get("url") or "").strip()
            if not url:
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
                if connection:
                    body["connection"] = connection
                for attempt in range(_MAX_ADAPTER_ATTEMPTS):
                    try:
                        async with httpx.AsyncClient(timeout=httpx.Timeout(10.0)) as client:
                            response = await ssrf.request_async(client, str(config.get("method") or "POST").upper(), url, json=body)
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
