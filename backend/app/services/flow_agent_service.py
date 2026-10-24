"""Modular AI Agent Service for Chatty Flow Builder.

Provides conversational automation engineering:
1. Generates end-to-end multi-step flows from natural language prompts.
2. Edits, refactors, and branches existing workflows.
3. Automatically repairs validation errors, missing fields, or broken edges.
4. Explains flows, audits bottlenecks, and provides optimization suggestions.
5. Uses the exact LLM configured in the bot's Agent Settings (OpenRouter/Gemini/BYOK).
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any, Optional

from app.core.clients import supabase
from app.core.db import run_db
from app.core.permissions import verify_bot_permission
from plugins import ai_client

logger = logging.getLogger("chatty.flow_agent")

FLOW_NODE_CATALOG = [
    {
        "type": "chatty.event",
        "title": "Chatty event",
        "subtitle": "New lead, message, call, booking",
        "kind": "trigger",
        "icon": "chatty",
        "color": "#f97316",
        "provider": "Chatty",
        "allowed_events": [
            "session.started", "session.ended", "message.user",
            "message.assistant", "lead.created", "lead.updated",
            "meeting.booked", "csat.submitted"
        ],
        "default_config": {"event": "lead.created", "operation": "Listen for event"},
    },
    {
        "type": "n8n.webhook",
        "title": "Webhook",
        "subtitle": "Receive an HTTP event",
        "kind": "trigger",
        "icon": "webhook",
        "color": "#8b5cf6",
        "provider": "HTTP",
        "default_config": {"path": "/incoming-event", "operation": "Receive request"},
    },
    {
        "type": "chatty.reply",
        "title": "Reply in chat",
        "subtitle": "Send a message to the visitor",
        "kind": "chatty",
        "icon": "chatty",
        "color": "#f97316",
        "provider": "Chatty",
        "default_config": {"operation": "Send reply", "message": "Hello {{data.visitor_name}}, how can we assist you?"},
    },
    {
        "type": "chatty.ai",
        "title": "AI transform",
        "subtitle": "Classify, extract, summarize",
        "kind": "chatty",
        "icon": "spark",
        "color": "#a855f7",
        "provider": "Chatty AI",
        "default_config": {
            "operation": "Classify",
            "instruction": "Classify visitor intent as sales, support, or billing.",
            "url": "https://api.personaliai.com/api/ai/transform"
        },
    },
    {
        "type": "core.condition",
        "title": "Condition",
        "subtitle": "Branch on customer data",
        "kind": "logic",
        "icon": "branch",
        "color": "#f59e0b",
        "provider": "Flow control",
        "default_config": {"operation": "Compare", "field": "data.intent", "operator": "equals", "value": "sales"},
    },
    {
        "type": "core.wait",
        "title": "Wait",
        "subtitle": "Pause for time or event",
        "kind": "logic",
        "icon": "clock",
        "color": "#64748b",
        "provider": "Flow control",
        "default_config": {"operation": "Delay", "duration": "300"},
    },
    {
        "type": "action.email",
        "title": "Send email",
        "subtitle": "Notify customer or team",
        "kind": "action",
        "icon": "mail",
        "color": "#2563eb",
        "provider": "Email",
        "default_config": {
            "operation": "Send notification email",
            "to": "{{data.visitor_email}}",
            "subject": "Follow-up regarding your request",
            "body": "Hi {{data.visitor_name}}, thanks for contacting us."
        },
    },
    {
        "type": "action.slack",
        "title": "Slack alert",
        "subtitle": "Post message to channel",
        "kind": "action",
        "icon": "slack",
        "color": "#4a154b",
        "provider": "Slack",
        "default_config": {
            "operation": "Send channel message",
            "channel": "#alerts",
            "message": "New lead received: {{data.visitor_name}} ({{data.visitor_email}})"
        },
    },
    {
        "type": "action.crm",
        "title": "Update CRM",
        "subtitle": "Create or update lead record",
        "kind": "action",
        "icon": "crm",
        "color": "#10b981",
        "provider": "Chatty CRM",
        "default_config": {"operation": "Upsert lead", "stage": "qualified"},
    },
    {
        "type": "n8n.httpRequest",
        "title": "HTTP request",
        "subtitle": "Call a custom HTTPS endpoint",
        "kind": "action",
        "icon": "globe",
        "color": "#0ea5e9",
        "provider": "HTTP",
        "default_config": {
            "method": "POST",
            "url": "https://api.example.com/v1/webhook",
            "body": "{\"event\":\"{{data.event}}\"}"
        },
    },
]

CATALOG_BY_TYPE = {item["type"]: item for item in FLOW_NODE_CATALOG}


async def get_bot_llm_config(bot_id: str) -> dict[str, Any]:
    """Resolves the configured LLM from the bot's Agent Settings."""
    res = await run_db(
        lambda: supabase.table("chatty_bots")
        .select("id, name, selected_model, byok_provider, byok_model, byok_api_key_encrypted")
        .eq("id", bot_id)
        .maybe_single()
        .execute()
    )
    bot = res.data or {}
    byok_provider = bot.get("byok_provider")
    byok_model = bot.get("byok_model")
    selected_model = bot.get("selected_model") or "gemini-2.5-flash"

    if byok_provider and byok_model and bot.get("byok_api_key_encrypted"):
        resolved = ai_client.resolve_byok_model(byok_provider, byok_model)
        display = f"{byok_provider.upper()} ({byok_model})"
        is_byok = True
    else:
        resolved = ai_client.resolve_gemini_model(selected_model)
        display = selected_model
        is_byok = False

    return {
        "bot_name": bot.get("name", "Chatty Assistant"),
        "model": resolved,
        "display_name": display,
        "is_byok": is_byok,
    }


def compute_dag_coordinates(nodes: list[dict[str, Any]], edges: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Calculates clean aesthetic non-overlapping coordinates in DAG layout."""
    if not nodes:
        return []

    node_ids = {n.get("id") for n in nodes if n.get("id")}
    incoming: dict[str, int] = {nid: 0 for nid in node_ids}
    outgoing: dict[str, list[str]] = {nid: [] for nid in node_ids}

    for edge in edges:
        f = edge.get("from")
        t = edge.get("to")
        if f in outgoing and t in incoming:
            outgoing[f].append(t)
            incoming[t] += 1

    layers: dict[str, int] = {}
    queue = [nid for nid, count in incoming.items() if count == 0]
    if not queue and nodes:
        queue = [nodes[0]["id"]]

    for nid in queue:
        layers[nid] = 0

    visited = set()
    while queue:
        curr = queue.pop(0)
        visited.add(curr)
        cur_l = layers.get(curr, 0)
        for child in outgoing.get(curr, []):
            layers[child] = max(layers.get(child, 0), cur_l + 1)
            if child not in visited:
                visited.add(child)
                queue.append(child)

    max_l = max(layers.values()) if layers else 0
    for n in nodes:
        nid = n.get("id")
        if nid not in layers:
            max_l += 1
            layers[nid] = max_l

    rows_by_layer: dict[int, int] = {}
    origin_x = 96
    origin_y = 96
    step_x = 312 + 108  # width + horizontal gap
    step_y = 260 + 72   # height + vertical gap

    positioned: list[dict[str, Any]] = []
    for n in nodes:
        nid = n.get("id")
        layer = layers.get(nid, 0)
        row = rows_by_layer.get(layer, 0)
        rows_by_layer[layer] = row + 1

        node_copy = dict(n)
        node_copy["x"] = origin_x + (layer * step_x)
        node_copy["y"] = origin_y + (row * step_y)
        node_copy["stepIndex"] = layer
        positioned.append(node_copy)

    return positioned


def _extract_json_payload(raw_text: str) -> dict[str, Any]:
    """Robustly extracts JSON from an LLM response string."""
    cleaned = raw_text.strip()
    if cleaned.startswith("```"):
        match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", cleaned)
        if match:
            cleaned = match.group(1).strip()
    try:
        return json.loads(cleaned)
    except Exception:
        # Fallback find first { and last }
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start != -1 and end != -1:
            return json.loads(cleaned[start : end + 1])
        raise


SYSTEM_PROMPT = """You are the Chatty Automation Architect, an expert AI agent that designs, modifies, audits, and repairs enterprise decision-tree automation workflows.

You generate and manipulate workflows for Chatty Flow Builder (an industrial-standard visual canvas).

AVAILABLE NODE TYPES:
1. "chatty.event" (kind: "trigger"):
   Fires on Chatty events (session.started, message.user, lead.created, meeting.booked, csat.submitted).
2. "n8n.webhook" (kind: "trigger"):
   Fires on incoming HTTP webhook (/incoming-event).
3. "chatty.reply" (kind: "chatty"):
   Sends a message to the visitor in chat. config: { "message": "text" }.
4. "chatty.ai" (kind: "chatty"):
   AI classification, extraction, or summarization. config: { "instruction": "...", "url": "https://api.personaliai.com/api/ai/transform" }.
5. "core.condition" (kind: "logic"):
   Branches execution based on customer/payload data. config: { "field": "data.intent", "operator": "equals", "value": "sales" }.
   Outgoing edges can specify label (e.g. "sales", "support", "else").
6. "core.wait" (kind: "logic"):
   Delay execution. config: { "duration": "300" } (in seconds).
7. "action.email" (kind: "action"):
   Send email notification. config: { "to": "...", "subject": "...", "body": "..." }.
8. "action.slack" (kind: "action"):
   Send alert to Slack channel. config: { "channel": "#alerts", "message": "..." }.
9. "action.crm" (kind: "action"):
   Update lead stage in CRM. config: { "stage": "qualified", "notes": "..." }.
10. "n8n.httpRequest" (kind: "action"):
    Call external API. config: { "method": "POST", "url": "...", "body": "..." }.

RULES FOR VALID WORKFLOWS:
1. Every workflow MUST have at least one trigger node ("chatty.event" or "n8n.webhook").
2. Nodes must connect sequentially or branch via condition nodes. No orphaned or disconnected action nodes.
3. Node IDs must be unique strings (e.g., "trigger-1", "reply-2", "condition-3").
4. No cyclical loops without terminating condition or wait.
5. Provide realistic, helpful configurations (messages, fields, instructions).

OUTPUT FORMAT:
Always return a strict JSON object with NO preamble or conversational markdown outside the JSON:
{
  "thought": "Short internal reasoning of what was designed or modified.",
  "action": "build" | "edit" | "fix" | "publish" | "draft" | "delete" | "explain",
  "message": "Clear, friendly explanation to the user of what was built or changed, including advice.",
  "flow_name": "Name of the workflow",
  "flow_data": {
    "nodes": [
      {
        "id": "trigger-1",
        "type": "chatty.event",
        "kind": "trigger",
        "title": "Chatty event",
        "subtitle": "New lead, message, call, booking",
        "icon": "chatty",
        "color": "#f97316",
        "provider": "Chatty",
        "config": { "event": "lead.created", "operation": "Listen for event" }
      }
    ],
    "edges": [
      { "from": "trigger-1", "to": "reply-2", "label": "optional branch label" }
    ],
    "paths": [
      { "id": "main", "title": "Main path", "color": "#f97316" }
    ]
  },
  "changes_summary": [
    "Added Chatty event trigger",
    "Connected AI intent classifier",
    "Routed qualified leads to Slack alert"
  ]
}
"""


async def run_flow_agent(
    bot_id: str,
    flow_id: str | None,
    message: str,
    current_flow_data: dict[str, Any],
    user: dict[str, Any],
    conversation_history: list[dict[str, str]] | None = None,
) -> dict[str, Any]:
    """Executes the AI Flow Architect turn using the bot's configured LLM."""
    await verify_bot_permission(bot_id, user, "design")
    llm_info = await get_bot_llm_config(bot_id)

    nodes = current_flow_data.get("nodes", []) if isinstance(current_flow_data, dict) else []
    edges = current_flow_data.get("edges", []) if isinstance(current_flow_data, dict) else []

    current_summary = f"Current workflow has {len(nodes)} nodes and {len(edges)} connections."
    if nodes:
        node_names = [f"{n.get('id')} ({n.get('type')})" for n in nodes[:15]]
        current_summary += f" Existing nodes: {', '.join(node_names)}."

    context_prompt = (
        f"User request: {message}\n"
        f"Bot Name: {llm_info['bot_name']}\n"
        f"State: {current_summary}\n\n"
        f"Current Graph JSON:\n{json.dumps({'nodes': nodes, 'edges': edges}, indent=2)}\n\n"
        "Return the updated or generated workflow as strict JSON following the schema."
    )

    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    if conversation_history:
        for turn in conversation_history[-6:]:
            role = turn.get("role") or "user"
            content = turn.get("content") or ""
            if content:
                messages.append({"role": role, "content": content})

    messages.append({"role": "user", "content": context_prompt})

    try:
        response = await ai_client.chat(
            model=llm_info["model"],
            messages=messages,
            bot_id=bot_id,
            call_type="flow_agent",
            temperature=0.3,
            max_tokens=4000,
        )
        content = response.choices[0].message.content or "{}"
        parsed = _extract_json_payload(content)

        # Ensure layout coordinates
        proposed_flow = parsed.get("flow_data") or {}
        raw_nodes = proposed_flow.get("nodes", [])
        raw_edges = proposed_flow.get("edges", [])

        # Enrich node definitions from catalog
        enriched_nodes = []
        for n in raw_nodes:
            ntype = n.get("type", "chatty.reply")
            cat_item = CATALOG_BY_TYPE.get(ntype, {})
            enriched = {
                "id": str(n.get("id") or f"node-{len(enriched_nodes) + 1}"),
                "type": ntype,
                "kind": n.get("kind") or cat_item.get("kind", "action"),
                "title": n.get("title") or cat_item.get("title", ntype),
                "subtitle": n.get("subtitle") or cat_item.get("subtitle", ""),
                "icon": n.get("icon") or cat_item.get("icon", "code"),
                "color": n.get("color") or cat_item.get("color", "#0ea5e9"),
                "provider": n.get("provider") or cat_item.get("provider", "HTTP"),
                "config": {**cat_item.get("default_config", {}), **(n.get("config") if isinstance(n.get("config"), dict) else {})},
                "operations": cat_item.get("operations", ["Execute"]),
            }
            enriched_nodes.append(enriched)

        positioned_nodes = compute_dag_coordinates(enriched_nodes, raw_edges)

        validated_edges = []
        node_ids = {n["id"] for n in positioned_nodes}
        for e in raw_edges:
            if isinstance(e, dict) and e.get("from") in node_ids and e.get("to") in node_ids:
                edge_item = {"from": e["from"], "to": e["to"]}
                if e.get("label"):
                    edge_item["label"] = str(e["label"])
                validated_edges.append(edge_item)

        final_flow_data = {
            "nodes": positioned_nodes,
            "edges": validated_edges,
            "paths": proposed_flow.get("paths") or [{"id": "main", "title": "Main path", "color": "#f97316"}],
        }

        return {
            "success": True,
            "action": parsed.get("action", "build"),
            "thought": parsed.get("thought", ""),
            "message": parsed.get("message", "Workflow updated successfully."),
            "flow_name": parsed.get("flow_name") or "Automated workflow",
            "flow_data": final_flow_data,
            "changes_summary": parsed.get("changes_summary", []),
            "llm_used": llm_info["display_name"],
        }
    except Exception as exc:
        logger.exception("Flow agent execution error: %s", exc)
        return {
            "success": False,
            "action": "error",
            "thought": str(exc),
            "message": f"I encountered an issue processing your request: {exc}",
            "flow_name": "Workflow",
            "flow_data": current_flow_data,
            "changes_summary": [],
            "llm_used": llm_info["display_name"],
        }


async def auto_fix_validation_issues(
    bot_id: str,
    flow_id: str | None,
    current_flow_data: dict[str, Any],
    issues: list[str],
    user: dict[str, Any],
) -> dict[str, Any]:
    """Repairs graph validation issues automatically."""
    issue_text = "\n".join(f"- {i}" for i in issues)
    prompt = (
        f"Please auto-fix the following validation issues in this workflow:\n{issue_text}\n\n"
        "1. If a trigger node is missing, add an appropriate 'chatty.event' trigger node at the start.\n"
        "2. If an action or reply node is missing required fields (like message or URL), provide sensible defaults.\n"
        "3. If there are cycles or disconnected nodes, connect them properly into a valid DAG.\n"
        "4. Return the complete corrected workflow JSON."
    )
    return await run_flow_agent(
        bot_id=bot_id,
        flow_id=flow_id,
        message=prompt,
        current_flow_data=current_flow_data,
        user=user,
    )
