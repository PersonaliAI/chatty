"""Tenant-scoped flow builder API for the standalone builder application."""

from __future__ import annotations

from typing import Any
from collections import deque

import time

import jwt
from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field

from app.core.clients import supabase
from app.core.db import run_db
from app.core.deps import get_user_by_auth_id, require_user
from app.core.deps import verify_supabase_jwt
from app.core.config import FUNCTION_SECRET
from app.core.permissions import verify_bot_permission

router = APIRouter(prefix="/api/flow-builder", tags=["Flow Builder"])


class FlowDraftRequest(BaseModel):
    bot_id: str
    flow_id: str | None = None
    name: str = "Chatty automation"
    flow_data: dict[str, Any] = Field(default_factory=dict)
    note: str | None = None


class FlowPublishRequest(FlowDraftRequest):
    version: int


class FlowStateRequest(BaseModel):
    bot_id: str
    flow_id: str | None = None
    enabled: bool


class FlowTestRequest(BaseModel):
    bot_id: str
    flow_id: str | None = None
    flow_data: dict[str, Any] = Field(default_factory=dict)


ALLOWED_NODE_KINDS = {
    "trigger", "action", "logic", "chatty",
    "chatty_event", "webhook", "http", "email", "google_sheets", "slack",
    "crm", "wait", "condition", "ai", "make", "zapier", "calendar",
    "notion", "hubspot", "discord", "airtable", "stripe", "telegram", "twilio",
}


def _validate_flow_data(flow_data: dict[str, Any], *, require_nodes: bool = False) -> None:
    """Validate the portable graph before it reaches storage or execution."""
    nodes = flow_data.get("nodes", [])
    edges = flow_data.get("edges", [])
    if not isinstance(nodes, list) or not isinstance(edges, list):
        raise HTTPException(status_code=400, detail="Flow nodes and edges must be arrays")
    if require_nodes and not nodes:
        raise HTTPException(status_code=400, detail="A flow needs at least one node before publishing")
    if len(nodes) > 100 or len(edges) > 250:
        raise HTTPException(status_code=400, detail="Flow exceeds the supported graph size")
    node_ids: set[str] = set()
    edge_keys: set[tuple[str, str]] = set()
    has_trigger = False
    for node in nodes:
        if not isinstance(node, dict) or not isinstance(node.get("id"), str):
            raise HTTPException(status_code=400, detail="Each node needs a unique id")
        node_id = node["id"]
        if node_id in node_ids:
            raise HTTPException(status_code=400, detail="Node ids must be unique")
        node_ids.add(node_id)
        kind = node.get("kind")
        if kind is not None and kind not in ALLOWED_NODE_KINDS:
            raise HTTPException(status_code=400, detail=f"Unsupported node kind: {kind}")
        if kind == "trigger":
            has_trigger = True
        if require_nodes and kind == "action":
            config = node.get("config") if isinstance(node.get("config"), dict) else {}
            if not str(config.get("url") or "").strip():
                raise HTTPException(status_code=400, detail=f"Action node {node.get('title') or node_id} needs an adapter endpoint before publishing")
        if kind == "chatty" and node.get("type") == "chatty.reply":
            config = node.get("config") if isinstance(node.get("config"), dict) else {}
            if not str(config.get("message") or "").strip():
                raise HTTPException(status_code=400, detail=f"Chat reply node {node.get('title') or node_id} needs a message before publishing")
    if require_nodes and not has_trigger:
        raise HTTPException(status_code=400, detail="A published flow needs at least one trigger node")
    for edge in edges:
        if not isinstance(edge, dict) or edge.get("from") not in node_ids or edge.get("to") not in node_ids:
            raise HTTPException(status_code=400, detail="Every edge must reference existing nodes")
        edge_key = (edge["from"], edge["to"])
        if edge_key in edge_keys:
            raise HTTPException(status_code=400, detail="A flow cannot contain duplicate connections")
        if edge["from"] == edge["to"]:
            raise HTTPException(status_code=400, detail="A node cannot connect to itself")
        edge_keys.add(edge_key)


def _flow_trace(flow_data: dict[str, Any]) -> list[dict[str, Any]]:
    """Return a deterministic dry-run trace without calling external providers."""
    nodes = flow_data.get("nodes", [])
    edges = flow_data.get("edges", [])
    incoming = {node["id"]: 0 for node in nodes}
    outgoing: dict[str, list[str]] = {node["id"]: [] for node in nodes}
    for edge in edges:
        outgoing[edge["from"]].append(edge["to"])
        incoming[edge["to"]] += 1
    queue = deque(node_id for node_id, count in incoming.items() if count == 0)
    ordered: list[str] = []
    while queue:
        node_id = queue.popleft()
        ordered.append(node_id)
        for child in outgoing[node_id]:
            incoming[child] -= 1
            if incoming[child] == 0:
                queue.append(child)
    if len(ordered) != len(nodes):
        raise HTTPException(status_code=400, detail="Flow contains a cycle")
    by_id = {node["id"]: node for node in nodes}
    return [{"node_id": node_id, "title": by_id[node_id].get("title", node_id), "status": "ready"} for node_id in ordered]


async def require_flow_user(
    authorization: str | None = Header(None),
    handoff: str | None = Header(None, alias="X-Chatty-Flow-Handoff"),
) -> dict[str, Any]:
    """Accept a normal Supabase session or a short-lived builder handoff."""
    if authorization:
        claims = verify_supabase_jwt(authorization)
        return await run_db(lambda: get_user_by_auth_id(claims["sub"]))
    if not handoff or not FUNCTION_SECRET:
        raise HTTPException(status_code=401, detail="Flow builder authentication required")
    try:
        claims = jwt.decode(handoff, FUNCTION_SECRET, algorithms=["HS256"], audience="chatty-flow-builder")
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=401, detail="Invalid flow builder handoff") from exc
    user = await run_db(lambda: get_user_by_auth_id(claims["sub"]))
    user["_flow_handoff_bot_id"] = claims.get("bot_id")
    return user


async def _authorize(bot_id: str, user: dict[str, Any]) -> None:
    # Flow editing follows the existing Chatty design permission. This keeps
    # the separate builder aligned with the dashboard until a dedicated flow
    # permission is introduced.
    handoff_bot_id = user.get("_flow_handoff_bot_id")
    if handoff_bot_id and handoff_bot_id != bot_id:
        raise HTTPException(status_code=403, detail="This flow handoff is bound to another bot")
    await verify_bot_permission(bot_id, user, "design")


async def _ensure_flow(body: FlowDraftRequest, user: dict[str, Any]) -> str:
    if body.flow_id:
        flow = await run_db(lambda: supabase.table("chatty_flows").select("id, bot_id").eq("id", body.flow_id).eq("bot_id", body.bot_id).maybe_single().execute())
        if flow.data:
            return body.flow_id
        raise HTTPException(status_code=404, detail="Flow not found")
    result = await run_db(lambda: supabase.table("chatty_flows").insert({
        "bot_id": body.bot_id, "name": body.name[:120], "created_by": user["auth_user_id"]
    }).select("id").execute())
    if not result.data or not isinstance(result.data, list):
        raise HTTPException(status_code=500, detail="Flow could not be created")
    return result.data[0]["id"]


@router.post("/handoff")
async def create_builder_handoff(bot_id: str, user: dict[str, Any] = Depends(require_user)):
    """Mint a one-minute handoff so the separate origin can use Chatty auth."""
    await _authorize(bot_id, user)
    if not FUNCTION_SECRET:
        raise HTTPException(status_code=503, detail="Flow builder handoff is not configured")
    token = jwt.encode(
        {"sub": user["auth_user_id"], "email": user.get("email", ""), "bot_id": bot_id,
         "aud": "chatty-flow-builder", "exp": int(time.time()) + 60},
        FUNCTION_SECRET,
        algorithm="HS256",
    )
    return {"handoff": token, "expires_in": 60}


@router.get("/versions")
async def list_flow_versions(bot_id: str, user: dict[str, Any] = Depends(require_flow_user)):
    await _authorize(bot_id, user)
    result = await run_db(
        lambda: supabase.table("chatty_flow_versions")
        .select("id, bot_id, flow_id, version, status, is_enabled, flow_data, note, created_by, created_at, published_at")
        .eq("bot_id", bot_id)
        .order("version", desc=True)
        .limit(50)
        .execute()
    )
    flows = await run_db(lambda: supabase.table("chatty_flows").select("id, name, is_enabled").eq("bot_id", bot_id).execute())
    flow_map = {item["id"]: item for item in (flows.data or [])}
    versions = []
    for item in result.data or []:
        flow = flow_map.get(item.get("flow_id"), {})
        versions.append({**item, "flow_name": flow.get("name", "Chatty automation"), "is_enabled": flow.get("is_enabled", item.get("is_enabled", True))})
    return {"versions": versions}


@router.patch("/state")
async def set_flow_state(body: FlowStateRequest, user: dict[str, Any] = Depends(require_flow_user)):
    await _authorize(body.bot_id, user)
    if body.flow_id:
        result = await run_db(lambda: supabase.table("chatty_flows").update({"is_enabled": body.enabled}).eq("id", body.flow_id).eq("bot_id", body.bot_id).select("id, bot_id, is_enabled").execute())
        if not result.data:
            raise HTTPException(status_code=404, detail="Flow not found")
        return result.data[0]
    result = await run_db(
        lambda: supabase.table("chatty_flow_versions")
        .update({"is_enabled": body.enabled})
        .eq("bot_id", body.bot_id)
        .eq("status", "published")
        .select("id, bot_id, version, status, is_enabled")
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="No published workflow exists for this bot")
    return result.data[0]


@router.post("/test")
async def test_flow(body: FlowTestRequest, user: dict[str, Any] = Depends(require_flow_user)):
    """Validate a graph and return a dry-run trace before side effects execute."""
    await _authorize(body.bot_id, user)
    _validate_flow_data(body.flow_data, require_nodes=True)
    trace = _flow_trace(body.flow_data)
    return {"valid": True, "flow_id": body.flow_id, "trace": trace, "side_effects": False}


@router.get("/runs")
async def list_flow_runs(bot_id: str, flow_id: str | None = None, user: dict[str, Any] = Depends(require_flow_user)):
    await _authorize(bot_id, user)
    query = supabase.table("chatty_flow_runs").select(
        "id, bot_id, flow_id, version_id, status, inputs, trace, error, duration_ms, created_at, completed_at"
    ).eq("bot_id", bot_id).order("created_at", desc=True).limit(50)
    if flow_id:
        query = query.eq("flow_id", flow_id)
    result = await run_db(lambda: query.execute())
    return {"runs": result.data or []}


@router.delete("/workflow")
async def delete_flow(bot_id: str, flow_id: str | None = None, user: dict[str, Any] = Depends(require_flow_user)):
    await _authorize(bot_id, user)
    if flow_id:
        result = await run_db(lambda: supabase.table("chatty_flows").delete().eq("id", flow_id).eq("bot_id", bot_id).execute())
        return {"deleted": bool(result.data), "count": len(result.data or [])}
    result = await run_db(
        lambda: supabase.table("chatty_flow_versions").delete().eq("bot_id", bot_id).execute()
    )
    return {"deleted": True, "count": len(result.data or [])}


@router.post("/versions")
async def create_flow_draft(body: FlowDraftRequest, user: dict[str, Any] = Depends(require_flow_user)):
    await _authorize(body.bot_id, user)
    _validate_flow_data(body.flow_data)
    flow_id = await _ensure_flow(body, user)
    latest = await run_db(
        lambda: supabase.table("chatty_flow_versions")
        .select("version")
        .eq("bot_id", body.bot_id).eq("flow_id", flow_id)
        .order("version", desc=True)
        .limit(1)
        .execute()
    )
    next_version = int((latest.data or [{"version": 0}])[0].get("version") or 0) + 1
    result = await run_db(
        lambda: supabase.table("chatty_flow_versions")
        .insert({
            "bot_id": body.bot_id,
            "flow_id": flow_id,
            "version": next_version,
            "status": "draft",
            "flow_data": body.flow_data,
            "note": body.note,
            "created_by": user["auth_user_id"],
        })
        .select()
        .execute()
    )
    if not result.data or not isinstance(result.data, list):
        raise HTTPException(status_code=500, detail="Flow draft could not be saved")
    return result.data[0]


@router.post("/publish")
async def publish_flow(body: FlowPublishRequest, user: dict[str, Any] = Depends(require_flow_user)):
    await _authorize(body.bot_id, user)
    _validate_flow_data(body.flow_data, require_nodes=True)
    _flow_trace(body.flow_data)
    flow_id = await _ensure_flow(body, user)
    latest = await run_db(
        lambda: supabase.table("chatty_flow_versions")
        .select("version")
        .eq("bot_id", body.bot_id).eq("flow_id", flow_id)
        .order("version", desc=True)
        .limit(1)
        .execute()
    )
    next_version = int((latest.data or [{"version": 0}])[0].get("version") or 0) + 1
    result = await run_db(
        lambda: supabase.rpc("publish_chatty_flow_version_v2", {
            "p_flow_id": flow_id,
            "p_version": next_version,
            "p_flow_data": body.flow_data,
            "p_note": body.note,
            "p_created_by": user["auth_user_id"],
            "p_custom_js": "",
        }).execute()
    )
    published = (result.data or [None])[0]
    return {"published": True, "flow_id": flow_id, "version": published.get("version") if isinstance(published, dict) else next_version}
