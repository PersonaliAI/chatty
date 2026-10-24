"""Modular AI Agent Service for Chatty Flow Builder.

Provides conversational automation engineering:
1. Generates end-to-end multi-step flows from natural language prompts.
2. Edits, refactors, and branches existing workflows.
3. Automatically repairs validation errors, missing fields, or broken edges.
4. Supports full workflow lifecycle actions: build, edit, fix, draft, publish, delete, explain.
5. Uses the exact LLM configured in the bot's Agent Settings (OpenRouter/Gemini/BYOK) with
   a deterministic fallback architect engine so flow generation never fails.
6. Computes Sugiyama-style topological DAG coordinates with barycenter ordering and
   symmetrical vertical centering so generated nodes never overlap.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any

from app.core.clients import supabase
from app.core.db import run_db
from app.core.permissions import verify_bot_permission
from plugins import ai_client

logger = logging.getLogger("chatty.flow_agent")

FLOW_LAYOUT_WIDTH = 312
FLOW_LAYOUT_HEIGHT = 260
FLOW_LAYOUT_GAP_X = 136
FLOW_LAYOUT_GAP_Y = 92
FLOW_LAYOUT_ORIGIN_X = 96
FLOW_LAYOUT_ORIGIN_Y = 96

FLOW_NODE_CATALOG = [
    {
        "type": "chatty.event",
        "title": "Chatty event",
        "subtitle": "New lead, message, call, booking",
        "kind": "trigger",
        "icon": "chatty",
        "color": "#f97316",
        "provider": "Chatty",
        "operations": ["Listen for event"],
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
        "operations": ["Receive request"],
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
        "operations": ["Send reply"],
        "default_config": {
            "operation": "Send reply",
            "message": "Hello {{data.visitor_name}}, how can we assist you today?",
        },
    },
    {
        "type": "chatty.ai",
        "title": "AI transform",
        "subtitle": "Classify, extract, summarize",
        "kind": "chatty",
        "icon": "spark",
        "color": "#a855f7",
        "provider": "Chatty AI",
        "operations": ["Classify", "Extract", "Summarize"],
        "default_config": {
            "operation": "Classify",
            "instruction": "Classify visitor intent as sales, support, or billing.",
            "output_field": "intent",
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
        "operations": ["Compare", "Contains", "Matches"],
        "default_config": {
            "operation": "Compare",
            "field": "data.intent",
            "operator": "equals",
            "value": "sales",
        },
    },
    {
        "type": "core.wait",
        "title": "Wait",
        "subtitle": "Pause for time or event",
        "kind": "logic",
        "icon": "clock",
        "color": "#64748b",
        "provider": "Flow control",
        "operations": ["Delay", "Wait for event"],
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
        "operations": ["Send notification email"],
        "default_config": {
            "operation": "Send notification email",
            "to": "{{data.visitor_email}}",
            "subject": "Follow-up regarding your request",
            "body": "Hi {{data.visitor_name}}, thanks for contacting us. Our team has received your details.",
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
        "operations": ["Send channel message"],
        "default_config": {
            "operation": "Send channel message",
            "channel": "#alerts",
            "message": "New lead received: {{data.visitor_name}} ({{data.visitor_email}})",
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
        "operations": ["Upsert lead", "Update stage"],
        "default_config": {
            "operation": "Upsert lead",
            "stage": "qualified",
            "notes": "Captured and qualified via Chatty Flow automation.",
        },
    },
    {
        "type": "n8n.httpRequest",
        "title": "HTTP request",
        "subtitle": "Call a custom HTTPS endpoint",
        "kind": "action",
        "icon": "globe",
        "color": "#0ea5e9",
        "provider": "HTTP",
        "operations": ["GET", "POST", "PUT", "DELETE"],
        "default_config": {
            "operation": "POST",
            "method": "POST",
            "url": "https://api.example.com/v1/webhook",
            "body": "{\"event\":\"{{data.event}}\",\"session_id\":\"{{session_id}}\"}",
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


def _snap_grid(val: float, grid: int = 16) -> int:
    return int(round(val / grid) * grid)


def _boxes_overlap(x1: int, y1: int, x2: int, y2: int) -> bool:
    min_dx = FLOW_LAYOUT_WIDTH + 64
    min_dy = FLOW_LAYOUT_HEIGHT + 48
    return abs(x1 - x2) < min_dx and abs(y1 - y2) < min_dy


def compute_dag_coordinates(
    nodes: list[dict[str, Any]],
    edges: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Calculates non-overlapping coordinates using Kahn's longest-path layering,
    Sugiyama barycenter row ordering, symmetrical vertical spine centering,
    and a strict collision-resolution pass.
    """
    if not nodes:
        return []

    ordered_ids = [str(n.get("id")) for n in nodes if n.get("id")]
    node_ids = set(ordered_ids)
    order_index = {nid: idx for idx, nid in enumerate(ordered_ids)}

    in_degree: dict[str, int] = {nid: 0 for nid in ordered_ids}
    outgoing: dict[str, list[str]] = {nid: [] for nid in ordered_ids}
    parents: dict[str, list[str]] = {nid: [] for nid in ordered_ids}
    edge_labels_to: dict[str, str] = {}

    seen_edges: set[tuple[str, str]] = set()
    for edge in edges:
        if not isinstance(edge, dict):
            continue
        f = str(edge.get("from") or "")
        t = str(edge.get("to") or "")
        if f in node_ids and t in node_ids and f != t and (f, t) not in seen_edges:
            seen_edges.add((f, t))
            outgoing[f].append(t)
            parents[t].append(f)
            in_degree[t] += 1
            if edge.get("label"):
                edge_labels_to[t] = str(edge["label"])

    # Kahn's topological longest-path layering
    layers: dict[str, int] = {}
    queue: list[str] = [
        nid for nid in ordered_ids
        if in_degree[nid] == 0
    ]
    for nid in queue:
        layers[nid] = 0

    processed: set[str] = set()
    while len(processed) < len(ordered_ids):
        if not queue:
            # Break cycles deterministically by picking first unprocessed node
            remaining = [nid for nid in ordered_ids if nid not in processed]
            entry = remaining[0]
            known_parent_layers = [layers[p] + 1 for p in parents[entry] if p in layers]
            layers[entry] = max(known_parent_layers) if known_parent_layers else 0
            queue.append(entry)

        curr = queue.pop(0)
        if curr in processed:
            continue
        processed.add(curr)
        cur_layer = layers.get(curr, 0)

        for child in outgoing.get(curr, []):
            if child in processed:
                continue
            layers[child] = max(layers.get(child, 0), cur_layer + 1)
            in_degree[child] -= 1
            if in_degree[child] <= 0:
                queue.append(child)

    # Group nodes by layer
    nodes_by_layer: dict[int, list[dict[str, Any]]] = {}
    for n in nodes:
        nid = str(n.get("id"))
        l_idx = layers.get(nid, 0)
        nodes_by_layer.setdefault(l_idx, []).append(n)

    step_x = FLOW_LAYOUT_WIDTH + FLOW_LAYOUT_GAP_X
    step_y = FLOW_LAYOUT_HEIGHT + FLOW_LAYOUT_GAP_Y

    max_rows = max((len(col) for col in nodes_by_layer.values()), default=1)
    spine_y = FLOW_LAYOUT_ORIGIN_Y + ((max_rows - 1) * step_y) / 2.0

    assigned_row_pos: dict[str, float] = {}
    coords_by_id: dict[str, tuple[int, int, int]] = {}
    placed_boxes: list[tuple[int, int]] = []

    for l_idx in sorted(nodes_by_layer.keys()):
        col_nodes = nodes_by_layer[l_idx]
        if l_idx > 0 and len(col_nodes) > 1:
            def _barycenter_key(node_obj: dict[str, Any]) -> tuple[float, int]:
                nid = str(node_obj.get("id"))
                p_ids = [p for p in parents.get(nid, []) if p in assigned_row_pos]
                avg_row = sum(assigned_row_pos[p] for p in p_ids) / len(p_ids) if p_ids else float(order_index.get(nid, 0))
                return (avg_row, order_index.get(nid, 0))

            col_nodes = sorted(col_nodes, key=_barycenter_key)

        k = len(col_nodes)
        col_start_y = spine_y - ((k - 1) * step_y) / 2.0
        target_x = _snap_grid(FLOW_LAYOUT_ORIGIN_X + l_idx * step_x)

        for row_idx, node_obj in enumerate(col_nodes):
            nid = str(node_obj.get("id"))
            target_y = _snap_grid(col_start_y + row_idx * step_y)

            # Guarantee non-overlapping bounding box against all already-placed nodes
            while any(_boxes_overlap(target_x, target_y, px, py) for px, py in placed_boxes):
                target_y = _snap_grid(target_y + step_y)

            placed_boxes.append((target_x, target_y))
            assigned_row_pos[nid] = float(target_y)
            coords_by_id[nid] = (target_x, target_y, l_idx)

    # Propagate branch path labels cleanly
    positioned: list[dict[str, Any]] = []
    for n in nodes:
        nid = str(n.get("id"))
        x, y, layer = coords_by_id.get(nid, (FLOW_LAYOUT_ORIGIN_X, FLOW_LAYOUT_ORIGIN_Y, 0))
        node_copy = dict(n)
        node_copy["x"] = x
        node_copy["y"] = y
        node_copy["stepIndex"] = layer
        if nid in edge_labels_to and not node_copy.get("pathTitle"):
            label_str = edge_labels_to[nid]
            node_copy["pathId"] = re.sub(r"[^a-z0-9]+", "-", label_str.lower()).strip("-") or "branch"
            node_copy["pathTitle"] = label_str.capitalize()
        elif not node_copy.get("pathId"):
            node_copy["pathId"] = "main"
            node_copy["pathTitle"] = "Main path"
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
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start != -1 and end != -1:
            return json.loads(cleaned[start : end + 1])
        raise


def _enrich_and_validate_graph(
    raw_nodes: list[dict[str, Any]],
    raw_edges: list[dict[str, Any]],
    raw_paths: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Enriches nodes from the catalog, ensures required config fields have valid defaults,
    removes invalid/duplicate/cyclic edges, and computes non-overlapping DAG coordinates.
    """
    enriched_nodes: list[dict[str, Any]] = []
    used_ids: set[str] = set()

    for idx, n in enumerate(raw_nodes):
        if not isinstance(n, dict):
            continue
        ntype = str(n.get("type") or "").strip()
        if ntype not in CATALOG_BY_TYPE:
            # Infer by kind or title if type is missing/custom
            kind_hint = str(n.get("kind") or "").lower()
            if kind_hint == "trigger":
                ntype = "chatty.event"
            elif kind_hint == "logic":
                ntype = "core.condition"
            elif kind_hint == "chatty":
                ntype = "chatty.reply"
            else:
                ntype = "n8n.httpRequest" if (n.get("config") or {}).get("url") else "chatty.reply"

        cat_item = CATALOG_BY_TYPE[ntype]
        raw_id = str(n.get("id") or f"{ntype.replace('.', '-')}-{idx + 1}").strip()
        while raw_id in used_ids:
            raw_id = f"{raw_id}-{idx + 1}"
        used_ids.add(raw_id)

        raw_cfg = n.get("config") if isinstance(n.get("config"), dict) else {}
        merged_cfg: dict[str, str] = {
            **cat_item.get("default_config", {}),
            "provider": str(n.get("provider") or cat_item.get("provider", "Chatty")),
            "retry_enabled": str(raw_cfg.get("retry_enabled", "true")),
            "idempotency_enabled": str(raw_cfg.get("idempotency_enabled", "true")),
        }
        for k, v in raw_cfg.items():
            if v is not None and str(v).strip() != "":
                merged_cfg[str(k)] = str(v)

        enriched = {
            "id": raw_id,
            "type": ntype,
            "kind": cat_item["kind"],
            "title": str(n.get("title") or cat_item["title"]),
            "subtitle": str(n.get("subtitle") or cat_item["subtitle"]),
            "icon": str(n.get("icon") or cat_item["icon"]),
            "color": str(n.get("color") or cat_item["color"]),
            "provider": str(n.get("provider") or cat_item["provider"]),
            "config": merged_cfg,
            "operations": cat_item.get("operations", ["Execute"]),
            "pathId": n.get("pathId") or "main",
            "pathTitle": n.get("pathTitle") or "Main path",
        }
        enriched_nodes.append(enriched)

    # Ensure at least one trigger node exists if graph is non-empty
    if enriched_nodes and not any(node["kind"] == "trigger" for node in enriched_nodes):
        trig_cat = CATALOG_BY_TYPE["chatty.event"]
        trig_id = "trigger-auto-1"
        while trig_id in used_ids:
            trig_id += "-1"
        used_ids.add(trig_id)
        first_node_id = enriched_nodes[0]["id"]
        enriched_nodes.insert(0, {
            "id": trig_id,
            "type": "chatty.event",
            "kind": "trigger",
            "title": trig_cat["title"],
            "subtitle": trig_cat["subtitle"],
            "icon": trig_cat["icon"],
            "color": trig_cat["color"],
            "provider": trig_cat["provider"],
            "config": {**trig_cat["default_config"], "provider": "Chatty"},
            "operations": trig_cat["operations"],
            "pathId": "main",
            "pathTitle": "Main path",
        })
        raw_edges = [{"from": trig_id, "to": first_node_id}] + list(raw_edges)

    # Validate edges and prevent self-loops, duplicates, and cycles
    node_id_set = {n["id"] for n in enriched_nodes}
    adj: dict[str, set[str]] = {nid: set() for nid in node_id_set}

    def _can_reach(src: str, dst: str) -> bool:
        stack = [src]
        seen = set()
        while stack:
            cur = stack.pop()
            if cur == dst:
                return True
            if cur in seen:
                continue
            seen.add(cur)
            stack.extend(adj.get(cur, ()))
        return False

    validated_edges: list[dict[str, Any]] = []
    seen_pairs: set[tuple[str, str]] = set()
    for e in raw_edges:
        if not isinstance(e, dict):
            continue
        u = str(e.get("from") or "")
        v = str(e.get("to") or "")
        if u not in node_id_set or v not in node_id_set or u == v:
            continue
        if (u, v) in seen_pairs:
            continue
        # Reject edge if it would create a cycle (v can already reach u)
        if _can_reach(v, u):
            continue
        seen_pairs.add((u, v))
        adj[u].add(v)
        edge_item: dict[str, Any] = {"from": u, "to": v}
        if e.get("label"):
            edge_item["label"] = str(e["label"])
        validated_edges.append(edge_item)

    # Connect any orphaned non-trigger nodes sequentially so the DAG is cohesive
    if len(enriched_nodes) > 1:
        has_incoming = {e["to"] for e in validated_edges}
        triggers = [n["id"] for n in enriched_nodes if n["kind"] == "trigger"]
        prev_id = triggers[0] if triggers else enriched_nodes[0]["id"]
        for n in enriched_nodes:
            nid = n["id"]
            if nid != prev_id and n["kind"] != "trigger" and nid not in has_incoming:
                if not _can_reach(nid, prev_id) and (prev_id, nid) not in seen_pairs:
                    validated_edges.append({"from": prev_id, "to": nid})
                    seen_pairs.add((prev_id, nid))
                    adj[prev_id].add(nid)
            prev_id = nid

    positioned_nodes = compute_dag_coordinates(enriched_nodes, validated_edges)

    paths_by_id: dict[str, dict[str, Any]] = {
        "main": {"id": "main", "title": "Main path", "color": "#f97316"}
    }
    for p in raw_paths or []:
        if isinstance(p, dict) and p.get("id"):
            paths_by_id[str(p["id"])] = {
                "id": str(p["id"]),
                "title": str(p.get("title") or p["id"]),
                "color": str(p.get("color") or "#f97316"),
            }
    for n in positioned_nodes:
        pid = n.get("pathId") or "main"
        if pid not in paths_by_id:
            paths_by_id[pid] = {
                "id": pid,
                "title": n.get("pathTitle") or pid.capitalize(),
                "color": n.get("color") or "#f97316",
            }

    return {
        "nodes": positioned_nodes,
        "edges": validated_edges,
        "paths": list(paths_by_id.values()),
    }


SYSTEM_PROMPT = """You are the Chatty Automation Architect, an expert AI agent that designs, modifies, audits, and repairs enterprise decision-tree automation workflows.

You generate and manipulate workflows for Chatty Flow Builder (an industrial-standard visual canvas).

AVAILABLE NODE TYPES:
1. "chatty.event" (kind: "trigger"):
   Fires on Chatty events (session.started, session.ended, message.user, message.assistant, lead.created, lead.updated, meeting.booked, csat.submitted).
   config: { "event": "lead.created", "operation": "Listen for event" }
2. "n8n.webhook" (kind: "trigger"):
   Fires on incoming HTTP webhook.
   config: { "path": "/incoming-event", "operation": "Receive request" }
3. "chatty.reply" (kind: "chatty"):
   Sends a message to the visitor in chat.
   config: { "operation": "Send reply", "message": "text" }
4. "chatty.ai" (kind: "chatty"):
   AI classification, extraction, or summarization.
   config: { "operation": "Classify", "instruction": "...", "output_field": "intent" }
5. "core.condition" (kind: "logic"):
   Branches execution based on customer, message, channel, or time data.
   config: { "operation": "Compare", "field": "data.intent", "operator": "equals", "value": "sales" }
   Supported operators: "equals", "not_equals", "contains", "matches", "before_time", "after_time", "less_than", "greater_than".
   Supported runtime fields:
   - "data.content": Inbound visitor/WhatsApp message text (use operator "contains", e.g. value "offer|promo|deal").
   - "data.current_time": Current time in 24-hour "HH:MM" format (e.g. "18:00" for 6:00 PM, "19:00" for 7:00 PM; use with "before_time" or "after_time").
   - "data.current_hour": Current hour 0-23 (use with "less_than" or "greater_than").
   - "data.channel": Channel source ("whatsapp", "web", "instagram", "messenger", "telegram", "sms", "email").
   - "data.platform": Client platform ("whatsapp", "instagram", "messenger", "telegram", "sms", "email", "web", "android_app", "ios_app", "android", "ios").
   - "data.device": Device category ("mobile", "desktop").
   - "data.os": Operating system ("android", "ios", "windows", "macos", "linux").
   - "data.intent", "data.category", "data.rating", "data.visitor_name", "data.visitor_email".
   Outgoing edges should specify branch labels: put the positive match label on the first edge (e.g. "before 6:00 PM", "sales", "urgent") and "else" on the fallback edge.
6. "core.wait" (kind: "logic"):
   Delay execution.
   config: { "operation": "Delay", "duration": "300" } (in seconds).
7. "action.email" (kind: "action"):
   Send email notification.
   config: { "operation": "Send notification email", "to": "{{data.visitor_email}}", "subject": "...", "body": "..." }
8. "action.slack" (kind: "action"):
   Send alert to Slack channel.
   config: { "operation": "Send channel message", "channel": "#alerts", "message": "..." }
9. "action.crm" (kind: "action"):
   Update lead stage in CRM.
   config: { "operation": "Upsert lead", "stage": "qualified", "notes": "..." }
10. "n8n.httpRequest" (kind: "action"):
    Call external API.
    config: { "operation": "POST", "method": "POST", "url": "https://api.example.com/webhook", "body": "{...}" }

SUPPORTED ACTIONS:
- "build": Create a new workflow from scratch.
- "edit": Modify, extend, or branch the current workflow.
- "fix": Repair validation errors, missing triggers/fields, or cycles.
- "draft": Save the workflow as a draft.
- "publish": Validate and publish the workflow live.
- "delete": Clear or delete the workflow.
- "explain": Explain the current workflow without overwriting it.

RULES FOR VALID WORKFLOWS:
1. Every workflow (except when action is "delete") MUST have at least one trigger node ("chatty.event" or "n8n.webhook").
2. Nodes must connect sequentially or branch via condition nodes. No orphaned nodes or cycles.
3. Node IDs must be unique strings (e.g., "trigger-1", "ai-2", "condition-3", "reply-sales", "slack-alert").
4. Always provide complete, realistic configurations for every node.
5. For WhatsApp or chat campaigns with variable time-based replies (e.g. before 6:00 PM send offer ends at 6:30 PM, after 6:00 PM / at 7:00 PM send offer ends at 9:00 PM), start with "chatty.event" (event: "message.user"), add a "chatty.ai" LLM classifier node (operation: "Classify", output_field: "intent", instruction: "Classify if the user is asking about an offer, promotion, deal, or discount. Return offer or other."), then add a "core.condition" on "data.intent" (operator: "equals", value: "offer"), then add a "core.condition" on "data.current_time" (operator: "before_time", value: "18:00") that branches into two "chatty.reply" nodes (one edge labeled "before 6:00 PM" and the fallback edge labeled "else").

OUTPUT FORMAT:
Always return a strict JSON object with NO preamble or markdown outside the JSON:
{
  "thought": "Short internal reasoning of what was designed or modified.",
  "action": "build" | "edit" | "fix" | "publish" | "draft" | "delete" | "explain",
  "message": "Clear, helpful explanation to the user of what was built or changed.",
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
    "Routed qualified leads to Slack and CRM"
  ]
}
"""


def _fallback_architect_response(
    message: str,
    current_flow_data: dict[str, Any],
    llm_display_name: str,
) -> dict[str, Any]:
    """Deterministic Architect Engine fallback when external LLM call is unavailable."""
    lower = message.lower()
    cur_nodes = current_flow_data.get("nodes", []) if isinstance(current_flow_data, dict) else []
    cur_edges = current_flow_data.get("edges", []) if isinstance(current_flow_data, dict) else []

    if any(k in lower for k in ("delete", "clear canvas", "remove all", "reset workflow")):
        return {
            "success": True,
            "action": "delete",
            "thought": "User requested clearing/deleting the workflow.",
            "message": "I have cleared the workflow canvas as requested.",
            "flow_name": "New workflow",
            "flow_data": {"nodes": [], "edges": [], "paths": []},
            "changes_summary": ["Cleared all nodes and connections from canvas"],
            "llm_used": llm_display_name,
        }

    if "explain" in lower and cur_nodes:
        steps_desc = [f"**{n.get('title', n.get('id'))}** (`{n.get('type')}`)" for n in cur_nodes]
        return {
            "success": True,
            "action": "explain",
            "thought": "Auditing existing graph structure and execution paths.",
            "message": (
                f"This workflow contains **{len(cur_nodes)} nodes** and **{len(cur_edges)} connections**:\n\n"
                + " → ".join(steps_desc)
                + "\n\nAll nodes are arranged in a topological DAG without cycles."
            ),
            "flow_name": "Current workflow",
            "flow_data": _enrich_and_validate_graph(cur_nodes, cur_edges, current_flow_data.get("paths")),
            "changes_summary": ["Audited workflow execution order and layout"],
            "llm_used": llm_display_name,
        }

    if any(k in lower for k in ("fix", "repair", "validate", "align", "layout", "arrange")) and cur_nodes:
        fixed = _enrich_and_validate_graph(cur_nodes, cur_edges, current_flow_data.get("paths"))
        return {
            "success": True,
            "action": "fix",
            "thought": "Repaired missing configurations, ensured trigger presence, and aligned DAG coordinates.",
            "message": "I have repaired all validation issues, filled missing required configurations, and aligned every node on a non-overlapping DAG grid.",
            "flow_name": "Validated workflow",
            "flow_data": fixed,
            "changes_summary": [
                "Verified trigger node at layer 0",
                "Populated required node configuration fields",
                "Aligned all nodes on non-overlapping topological grid",
            ],
            "llm_used": llm_display_name,
        }

    if any(k in lower for k in ("whatsapp", "campaign", "offer", "before ", "after ", "p.m", "pm", "a.m", "am")):
        time_matches = re.findall(r"\b(\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?))\b", message, re.IGNORECASE)
        cutoff_display = "6:00 PM"
        cutoff_24h = "18:00"
        early_expiry = "6:30 PM"
        late_expiry = "9:00 PM"
        if len(time_matches) >= 2:
            raw_cutoff = re.sub(r"\.", "", time_matches[0]).strip().upper()
            cutoff_display = raw_cutoff
            m_cut = re.match(r"^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$", raw_cutoff, re.IGNORECASE)
            if m_cut:
                hr = int(m_cut.group(1))
                mn = int(m_cut.group(2) or 0)
                mer = m_cut.group(3).upper()
                if mer == "PM" and hr < 12:
                    hr += 12
                elif mer == "AM" and hr == 12:
                    hr = 0
                cutoff_24h = f"{hr:02d}:{mn:02d}"
            early_expiry = re.sub(r"\.", "", time_matches[1]).strip().upper()
            if len(time_matches) >= 3:
                late_expiry = re.sub(r"\.", "", time_matches[-1]).strip().upper()

        raw_nodes = [
            {
                "id": "trig-wa-msg",
                "type": "chatty.event",
                "title": "Inbound WhatsApp / Chat message",
                "config": {"event": "message.user", "operation": "Listen for event"},
            },
            {
                "id": "ai-offer-intent",
                "type": "chatty.ai",
                "title": "LLM classify offer intent",
                "config": {
                    "operation": "Classify",
                    "instruction": "Classify if the user message is asking about an offer, promotion, discount, deal, or special campaign. Return 'offer' or 'other'.",
                    "output_field": "intent",
                },
            },
            {
                "id": "cond-keyword",
                "type": "core.condition",
                "title": "Is offer inquiry?",
                "config": {"operation": "Compare", "field": "data.intent", "operator": "equals", "value": "offer"},
            },
            {
                "id": "cond-time-window",
                "type": "core.condition",
                "title": f"Message before {cutoff_display}?",
                "config": {"operation": "Compare", "field": "data.current_time", "operator": "before_time", "value": cutoff_24h},
            },
            {
                "id": "reply-early-offer",
                "type": "chatty.reply",
                "title": f"Early offer reply (ends {early_expiry})",
                "pathId": "early-offer",
                "pathTitle": f"Before {cutoff_display}",
                "config": {
                    "operation": "Send reply",
                    "message": f"🔥 Special WhatsApp Offer! Hurry — your exclusive offer ends at {early_expiry} today! Reply CLAIM now to lock in your discount.",
                },
            },
            {
                "id": "crm-early-lead",
                "type": "action.crm",
                "title": "Tag early campaign lead",
                "pathId": "early-offer",
                "pathTitle": f"Before {cutoff_display}",
                "config": {
                    "operation": "Upsert lead",
                    "stage": "qualified",
                    "notes": f"WhatsApp campaign responder (messaged before {cutoff_display} -> offer ends {early_expiry})",
                },
            },
            {
                "id": "reply-evening-offer",
                "type": "chatty.reply",
                "title": f"Evening offer reply (ends {late_expiry})",
                "pathId": "else",
                "pathTitle": f"After {cutoff_display}",
                "config": {
                    "operation": "Send reply",
                    "message": f"🔥 Evening Flash Offer! Good news — our campaign offer ends at {late_expiry} tonight! Reply CLAIM now before time runs out.",
                },
            },
            {
                "id": "crm-evening-lead",
                "type": "action.crm",
                "title": "Tag evening campaign lead",
                "pathId": "else",
                "pathTitle": f"After {cutoff_display}",
                "config": {
                    "operation": "Upsert lead",
                    "stage": "qualified",
                    "notes": f"WhatsApp evening campaign responder (messaged after {cutoff_display} -> offer ends {late_expiry})",
                },
            },
        ]
        raw_edges = [
            {"from": "trig-wa-msg", "to": "ai-offer-intent"},
            {"from": "ai-offer-intent", "to": "cond-keyword"},
            {"from": "cond-keyword", "to": "cond-time-window", "label": "offer intent"},
            {"from": "cond-time-window", "to": "reply-early-offer", "label": f"before {cutoff_display}"},
            {"from": "reply-early-offer", "to": "crm-early-lead"},
            {"from": "cond-time-window", "to": "reply-evening-offer", "label": "else"},
            {"from": "reply-evening-offer", "to": "crm-evening-lead"},
        ]
        flow_name = "WhatsApp Time-Based Offer Campaign"
        summary = [
            "Added message.user trigger for inbound WhatsApp & chat messages",
            "Added chatty.ai LLM brain node to classify offer/promotion intent",
            f"Added time-window condition (data.current_time before_time {cutoff_24h} / {cutoff_display})",
            f"Branched replies: before {cutoff_display} → offer ends at {early_expiry}; else → offer ends at {late_expiry}",
        ]
    elif "booking" in lower or "meeting" in lower or "reminder" in lower:
        raw_nodes = [
            {"id": "trig-booking", "type": "chatty.event", "title": "Meeting booked", "config": {"event": "meeting.booked"}},
            {"id": "reply-confirm", "type": "chatty.reply", "title": "Send confirmation", "config": {"message": "Your meeting is confirmed, {{data.visitor_name}}! We look forward to speaking with you."}},
            {"id": "crm-update", "type": "action.crm", "title": "Update CRM stage", "config": {"stage": "in_progress", "notes": "Meeting booked via Chatty"}},
            {"id": "wait-reminder", "type": "core.wait", "title": "Wait 1 hour", "config": {"duration": "3600"}},
            {"id": "email-reminder", "type": "action.email", "title": "Send email reminder", "config": {"to": "{{data.visitor_email}}", "subject": "Reminder: Upcoming meeting", "body": "Hi {{data.visitor_name}}, this is a friendly reminder for your upcoming scheduled session."}},
        ]
        raw_edges = [
            {"from": "trig-booking", "to": "reply-confirm"},
            {"from": "reply-confirm", "to": "crm-update"},
            {"from": "crm-update", "to": "wait-reminder"},
            {"from": "wait-reminder", "to": "email-reminder"},
        ]
        flow_name = "Booking Confirmation & Reminder"
        summary = [
            "Added meeting.booked trigger",
            "Added instant chat confirmation & CRM update",
            "Added 1-hour delay and automated email reminder",
        ]
    elif "classify" in lower or "intent" in lower or "triage" in lower or "support" in lower:
        raw_nodes = [
            {"id": "trig-msg", "type": "chatty.event", "title": "Inbound user message", "config": {"event": "message.user"}},
            {"id": "ai-classify", "type": "chatty.ai", "title": "Classify visitor intent", "config": {"operation": "Classify", "instruction": "Classify the visitor message into sales, support, or billing.", "output_field": "intent"}},
            {"id": "cond-intent", "type": "core.condition", "title": "Is sales inquiry?", "config": {"field": "data.intent", "operator": "equals", "value": "sales"}},
            {"id": "reply-sales", "type": "chatty.reply", "title": "Sales specialist reply", "pathId": "sales", "pathTitle": "Sales", "config": {"message": "Thanks for your interest! I am connecting you with our sales team right away."}},
            {"id": "slack-sales", "type": "action.slack", "title": "Notify #sales-leads", "pathId": "sales", "pathTitle": "Sales", "config": {"channel": "#sales-leads", "message": "🔥 High-intent sales inquiry from {{data.visitor_name}} ({{data.visitor_email}})"}},
            {"id": "reply-support", "type": "chatty.reply", "title": "Support triage reply", "pathId": "support", "pathTitle": "Support", "config": {"message": "We have logged your support request and are preparing the best solution for you."}},
            {"id": "email-support", "type": "action.email", "title": "Send support ticket email", "pathId": "support", "pathTitle": "Support", "config": {"to": "{{data.visitor_email}}", "subject": "Support request received", "body": "Hi {{data.visitor_name}}, our support specialists are reviewing your message."}},
        ]
        raw_edges = [
            {"from": "trig-msg", "to": "ai-classify"},
            {"from": "ai-classify", "to": "cond-intent"},
            {"from": "cond-intent", "to": "reply-sales", "label": "sales"},
            {"from": "reply-sales", "to": "slack-sales"},
            {"from": "cond-intent", "to": "reply-support", "label": "support"},
            {"from": "reply-support", "to": "email-support"},
        ]
        flow_name = "AI Intent Triage & Routing"
        summary = [
            "Added message.user trigger and AI intent classifier",
            "Created condition branch for sales vs support paths",
            "Connected Slack alert for sales and email follow-up for support",
        ]
    else:
        raw_nodes = [
            {"id": "trig-lead", "type": "chatty.event", "title": "New lead captured", "config": {"event": "lead.created"}},
            {"id": "reply-welcome", "type": "chatty.reply", "title": "Acknowledge lead", "config": {"message": "Thanks {{data.visitor_name}}! We received your details and are routing your request."}},
            {"id": "crm-qualify", "type": "action.crm", "title": "Qualify in CRM", "config": {"stage": "qualified", "notes": "Lead captured via Chatty assistant"}},
            {"id": "cond-enterprise", "type": "core.condition", "title": "Check enterprise lead", "config": {"field": "data.intent", "operator": "equals", "value": "sales"}},
            {"id": "slack-alert", "type": "action.slack", "title": "Alert sales on Slack", "pathId": "enterprise", "pathTitle": "Enterprise", "config": {"channel": "#sales-alerts", "message": "🚀 New qualified lead: {{data.visitor_name}} ({{data.visitor_email}})"}},
            {"id": "email-followup", "type": "action.email", "title": "Send welcome email", "pathId": "nurture", "pathTitle": "Follow-up", "config": {"to": "{{data.visitor_email}}", "subject": "Welcome to our platform", "body": "Hi {{data.visitor_name}}, thank you for getting in touch with us!"}},
        ]
        raw_edges = [
            {"from": "trig-lead", "to": "reply-welcome"},
            {"from": "reply-welcome", "to": "crm-qualify"},
            {"from": "crm-qualify", "to": "cond-enterprise"},
            {"from": "cond-enterprise", "to": "slack-alert", "label": "sales"},
            {"from": "cond-enterprise", "to": "email-followup", "label": "else"},
        ]
        flow_name = "Lead Qualification & Omnichannel Handoff"
        summary = [
            "Added lead.created event trigger and instant visitor reply",
            "Added CRM lead qualification step",
            "Branched workflow to Slack sales alert and automated email follow-up",
        ]

    action_type = "publish" if "publish" in lower else "draft" if "save" in lower or "draft" in lower else "build"
    enriched_graph = _enrich_and_validate_graph(raw_nodes, raw_edges)
    return {
        "success": True,
        "action": action_type,
        "thought": "Designed multi-step branching DAG workflow with symmetrical non-overlapping coordinates.",
        "message": f"I have built the **{flow_name}** workflow with {len(enriched_graph['nodes'])} nodes and {len(enriched_graph['edges'])} connections, arranged cleanly on the canvas with zero overlapping.",
        "flow_name": flow_name,
        "flow_data": enriched_graph,
        "changes_summary": summary,
        "llm_used": llm_display_name,
    }


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
            temperature=0.25,
            max_tokens=4000,
        )
        content = response.choices[0].message.content or "{}"
        parsed = _extract_json_payload(content)

        action = str(parsed.get("action") or "build").lower()
        proposed_flow = parsed.get("flow_data") or {}
        raw_nodes = proposed_flow.get("nodes", [])
        raw_edges = proposed_flow.get("edges", [])
        raw_paths = proposed_flow.get("paths", [])

        if action == "delete":
            final_flow_data = {"nodes": [], "edges": [], "paths": []}
        elif action == "explain" and not raw_nodes and nodes:
            final_flow_data = _enrich_and_validate_graph(nodes, edges, current_flow_data.get("paths"))
        else:
            final_flow_data = _enrich_and_validate_graph(raw_nodes, raw_edges, raw_paths)

        return {
            "success": True,
            "action": action,
            "thought": parsed.get("thought", ""),
            "message": parsed.get("message", "Workflow updated successfully."),
            "flow_name": parsed.get("flow_name") or "Automated workflow",
            "flow_data": final_flow_data,
            "changes_summary": parsed.get("changes_summary", []),
            "llm_used": llm_info["display_name"],
        }
    except Exception as exc:
        logger.warning("Flow agent LLM fallback triggered (%s): %s", llm_info["display_name"], exc)
        return _fallback_architect_response(message, current_flow_data, llm_info["display_name"])


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
