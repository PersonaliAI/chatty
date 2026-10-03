"""Durable event handoff for published Chatty flows."""

from __future__ import annotations

import hashlib
import asyncio
import json
import logging
import time
import uuid
from datetime import datetime, timezone
from typing import Any

from app.core.db import run_db
from app.core import ssrf
import httpx

logger = logging.getLogger("chatty.flow_runtime")

_MAX_ADAPTER_ATTEMPTS = 3
_RETRY_DELAYS_SECONDS = (0.2, 0.5)


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
    raw = json.dumps({"event": event, "session_id": session_id, "data": data, "nonce": uuid.uuid4().hex}, sort_keys=True, default=str)
    return hashlib.sha256(raw.encode()).hexdigest()


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
        logger.exception("published flow event handoff failed bot=%s event=%s", bot_id, event)


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
    run = await run_db(lambda: supabase.table("chatty_flow_runs").select("inputs").eq("id", run_id).maybe_single().execute())
    version = await run_db(lambda: supabase.table("chatty_flow_versions").select("flow_data").eq("id", version_id).maybe_single().execute())
    flow_data = (version.data or {}).get("flow_data") or {}
    inputs = (run.data or {}).get("inputs") or {}
    trace = []
    failed = None
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
        failed = "Flow contains a cycle"
        ordered_ids = list(by_id)
    for node_id in ordered_ids:
        node = by_id[node_id]
        if not isinstance(node, dict):
            continue
        title = node.get("title") or node_id
        status = "observed" if node.get("kind") in {"trigger", "logic", "chatty"} else "awaiting_adapter"
        config = node.get("config") if isinstance(node.get("config"), dict) else {}
        if node.get("kind") == "action":
            url = str(config.get("url") or "").strip()
            if not url:
                status = "failed"
                failed = f"{title} has no adapter endpoint configured"
            else:
                body = {
                    "event": inputs.get("event"),
                    "session_id": inputs.get("session_id"),
                    "data": inputs.get("data", {}),
                    "flow_node_id": node_id,
                    "provider": node.get("provider"),
                    "n8n_type": node.get("n8nType"),
                    "n8n_type_version": node.get("n8nTypeVersion"),
                    "n8n_parameters": node.get("n8nParameters") if isinstance(node.get("n8nParameters"), dict) else {},
                }
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
        trace.append({"node_id": node_id, "title": title, "status": status})
        if failed:
            break
    final_status = "failed" if failed else "completed"
    await run_db(lambda: supabase.table("chatty_flow_runs").update({
        "status": final_status, "trace": trace, "error": failed, "duration_ms": int((time.perf_counter() - started) * 1000), "completed_at": datetime.now(timezone.utc).isoformat()
    }).eq("id", run_id).eq("status", "running").execute())
