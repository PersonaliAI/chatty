from __future__ import annotations

import json
import logging
import re
from typing import Any, Optional
from fastapi import HTTPException

from app.core import oauth as _oauth
from app.core.clients import supabase
from app.core.config import MODEL_NAME
from app.core.db import run_db
from app.schemas.bots_api import FlowUpdateRequest
from plugins import ai_client
from plugins.widget_brain import GEMINI_FALLBACK_MODELS

logger = logging.getLogger("chatty")

# The bot flow builder has no dedicated flow_data/flow_active columns —
# chatty_bots doesn't have either. The real, and only, storage mechanism
# (chatty/src/components/chatbot-flow-builder.tsx's saveFlowToBackend) is a
# JSON blob smuggled inside chatty_bots.custom_js between these comment
# markers, alongside whatever other custom JS the bot owner has written.
# The earlier version of get_bot_flow/update_bot_flow read and wrote
# nonexistent columns instead — silently returning an empty flow for every
# bot regardless of what's actually configured, and failing (or writing to
# a column nothing else ever reads) on update. These two functions now use
# the exact same marker format and strip/replace logic as the frontend, so
# a flow created or edited here is the SAME flow the widget actually runs.
_FLOW_DATA_RE = re.compile(r"/\* CHATTY_FLOW_DATA([\s\S]*?)CHATTY_FLOW_DATA \*/")
_FLOW_LEGACY_RE = re.compile(r"/\* CHATTY_FLOW_START \*/[\s\S]*?/\* CHATTY_FLOW_END \*/")


def _extract_flow_from_custom_js(custom_js: Optional[str]) -> dict[str, Any]:
    if not custom_js:
        return {"nodes": [], "edges": [], "status": "paused"}
    match = _FLOW_DATA_RE.search(custom_js)
    if not match:
        return {"nodes": [], "edges": [], "status": "paused"}
    try:
        flow = json.loads(match.group(1).strip())
        if isinstance(flow, dict) and "nodes" in flow and "edges" in flow:
            return flow
    except Exception:
        logger.warning("Failed to parse CHATTY_FLOW_DATA block for a bot", exc_info=True)
    return {"nodes": [], "edges": [], "status": "paused"}


def _inject_flow_into_custom_js(custom_js: Optional[str], flow_config: dict[str, Any]) -> str:
    base_js = (custom_js or "")
    base_js = _FLOW_LEGACY_RE.sub("", base_js).strip()
    base_js = _FLOW_DATA_RE.sub("", base_js).strip()
    flow_js = f"\n/* CHATTY_FLOW_DATA\n{json.dumps(flow_config, indent=2)}\nCHATTY_FLOW_DATA */"
    return (base_js + flow_js).strip()


async def generate_flow_with_ai(principal: dict[str, Any], bot_id: str, description: str) -> dict[str, Any]:
    bot = await _oauth.require_bot_access(principal, bot_id)
    bot_name = bot.get("name", "Chatty Assistant")
    welcome_message = bot.get("welcome_message", "Hi! How can I help you today?")

    prompt = (
        "You are an expert chatbot designer. Your task is to design a high-converting, "
        "industrial-grade visual conversational flow based on the business description and requirements below.\n\n"
        f"BOT NAME: {bot_name}\n"
        f"DEFAULT WELCOME MESSAGE: {welcome_message}\n"
        f"USER DESIGN REQUEST: {description}\n\n"
        "Generate a React Flow schema mapping nodes and edges in JSON format. The nodes must have distinct positions (e.g. x and y coordinates that do not overlap, with spacing of at least y=120px) and styles.\n\n"
        "Supported node types/visual styles:\n"
        "1. Start conversation node: id='start', label='🚀 Start Conversation', style: {background: '#f97316', color: '#fff', border: 'none', borderRadius: '12px', padding: '10px', fontWeight: 'bold'}\n"
        "2. Message node: id like 'msg-X', label like '💬 Hello...', style: {background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '12px', minWidth: '150px'}\n"
        "3. Question node (must connect to multiple paths based on user responses): id like 'q-X', label like '❓ Ask: <question>', style: {background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '12px', minWidth: '150px'}\n"
        "4. Set Tag node: id like 'tag-X', label like '🏷️ Tag session: <tag>', style: {background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e40af', borderRadius: '12px', padding: '12px', minWidth: '150px', fontWeight: 'semibold'}\n"
        "5. Escalate node: id like 'esc-X', label like '🔔 Escalate to Live Agent', style: {background: '#fff5f5', border: '1px solid #feb2b2', color: '#9b2c2c', borderRadius: '12px', padding: '12px', minWidth: '150px', fontWeight: 'bold'}\n\n"
        "Ensure all nodes are properly wired with edges! Start node must connect to the first action node.\n"
        "Respond with ONLY a JSON block containing two lists: 'nodes' and 'edges'."
    )

    try:
        resp = await ai_client.chat(
            model=ai_client.resolve_gemini_model(MODEL_NAME),
            messages=[{"role": "user", "content": prompt}],
            fallback_models=[ai_client.resolve_gemini_model(m) for m in GEMINI_FALLBACK_MODELS],
            temperature=0.3,
            response_format={"type": "json_object"},
            bot_id=bot_id,
            call_type="flow_generate_mcp",
        )
        text = (resp.choices[0].message.content or "").strip()
        schema = json.loads(text)
        return {"bot_id": bot_id, "flow": schema}
    except Exception as e:
        logger.exception("Failed to generate flow with AI")
        # Fallback default flow schema
        return {
            "bot_id": bot_id,
            "flow": {
                "nodes": [
                    {"id": "start", "type": "input", "data": {"label": "🚀 Start Conversation"}, "position": {"x": 250, "y": 0}},
                    {"id": "msg-1", "data": {"label": f"💬 {welcome_message}"}, "position": {"x": 250, "y": 120}},
                    {"id": "q-1", "data": {"label": "❓ How can we help today?"}, "position": {"x": 250, "y": 240}},
                ],
                "edges": [
                    {"id": "e-start-msg1", "source": "start", "target": "msg-1"},
                    {"id": "e-msg1-q1", "source": "msg-1", "target": "q-1"},
                ]
            }
        }


async def get_bot_flow(principal: dict[str, Any], bot_id: str) -> dict[str, Any]:
    bot = await _oauth.require_bot_access(principal, bot_id)
    flow = _extract_flow_from_custom_js(bot.get("custom_js"))
    return {
        "bot_id": bot_id,
        "flow": {"nodes": flow.get("nodes", []), "edges": flow.get("edges", [])},
        "is_active": flow.get("status") == "active",
    }


async def update_bot_flow(principal: dict[str, Any], bot_id: str, body: FlowUpdateRequest) -> dict[str, Any]:
    bot = await _oauth.require_bot_access(principal, bot_id)
    flow_config = {"status": "active" if body.is_active else "paused", "nodes": body.nodes, "edges": body.edges}
    new_custom_js = _inject_flow_into_custom_js(bot.get("custom_js"), flow_config)
    res = await run_db(lambda: supabase.table("chatty_bots").update({"custom_js": new_custom_js}).eq("id", bot_id).execute())
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to save flow")
    return {"bot_id": bot_id, "nodes_count": len(body.nodes), "edges_count": len(body.edges), "is_active": body.is_active}


async def simulate_flow_execution(principal: dict[str, Any], bot_id: str, simulated_user_inputs: list[str]) -> dict[str, Any]:
    flow_info = await get_bot_flow(principal, bot_id)
    flow = flow_info.get("flow", {})
    nodes = flow.get("nodes", [])
    edges = flow.get("edges", [])

    steps_taken: list[dict[str, Any]] = []
    current_node = next((n for n in nodes if n.get("id") == "start" or n.get("type") == "input"), None)
    if not current_node and nodes:
        current_node = nodes[0]

    for i, user_input in enumerate(simulated_user_inputs or ["Hello"]):
        if not current_node:
            break
        steps_taken.append({
            "step": i + 1,
            "node_id": current_node.get("id"),
            "node_label": current_node.get("data", {}).get("label") or current_node.get("label"),
            "simulated_user_input": user_input,
        })
        # Traverse to next connected edge
        next_edge = next((e for e in edges if e.get("source") == current_node.get("id")), None)
        if next_edge:
            current_node = next((n for n in nodes if n.get("id") == next_edge.get("target")), None)
        else:
            break

    return {
        "bot_id": bot_id,
        "total_steps": len(steps_taken),
        "execution_path": steps_taken,
        "completed": True,
    }
