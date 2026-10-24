import asyncio
import json
from unittest.mock import AsyncMock, patch

from app.routers.flow_builder import _flow_trace, _validate_flow_connections, _validate_flow_data
from app.services import flow_runtime
from app.services.flow_agent_service import (
    FLOW_LAYOUT_HEIGHT,
    FLOW_LAYOUT_WIDTH,
    _enrich_and_validate_graph,
    _extract_json_payload,
    _fallback_architect_response,
    auto_fix_validation_issues,
    compute_dag_coordinates,
    run_flow_agent,
)


def _assert_no_node_overlaps(nodes: list[dict]):
    """Assert that no two nodes in the list have overlapping bounding boxes."""
    min_dx = FLOW_LAYOUT_WIDTH + 64
    min_dy = FLOW_LAYOUT_HEIGHT + 48
    for i in range(len(nodes)):
        for j in range(i + 1, len(nodes)):
            n1, n2 = nodes[i], nodes[j]
            dx = abs(n1["x"] - n2["x"])
            dy = abs(n1["y"] - n2["y"])
            assert dx >= min_dx or dy >= min_dy, (
                f"Nodes {n1['id']} ({n1['x']},{n1['y']}) and "
                f"{n2['id']} ({n2['x']},{n2['y']}) overlap!"
            )


def test_extract_json_payload_markdown_blocks():
    raw_markdown = """```json
{
  "thought": "Building lead flow",
  "action": "build",
  "message": "Created the lead journey",
  "flow_name": "Lead Qualification Flow",
  "flow_data": {
    "nodes": [{"id": "trigger-1", "type": "chatty.event"}],
    "edges": []
  }
}
```"""
    result = _extract_json_payload(raw_markdown)
    assert result["action"] == "build"
    assert result["flow_name"] == "Lead Qualification Flow"
    assert len(result["flow_data"]["nodes"]) == 1


def test_compute_dag_coordinates_no_overlap_and_diamond_topology():
    # Diamond + multi-branch graph where c1 is connected both directly and via r1
    nodes = [
        {"id": "t1", "type": "chatty.event"},
        {"id": "c1", "type": "core.condition"},
        {"id": "r1", "type": "chatty.reply"},
        {"id": "e1", "type": "action.email"},
        {"id": "s1", "type": "action.slack"},
        {"id": "crm1", "type": "action.crm"},
    ]
    edges = [
        {"from": "t1", "to": "c1"},
        {"from": "t1", "to": "r1"},
        {"from": "r1", "to": "c1"},
        {"from": "c1", "to": "e1", "label": "email"},
        {"from": "c1", "to": "s1", "label": "slack"},
        {"from": "e1", "to": "crm1"},
        {"from": "s1", "to": "crm1"},
    ]
    positioned = compute_dag_coordinates(nodes, edges)
    assert len(positioned) == 6
    _assert_no_node_overlaps(positioned)

    by_id = {n["id"]: n for n in positioned}
    # Because t1 -> r1 -> c1 is length 2, c1 MUST be placed strictly to the right of r1
    assert by_id["t1"]["x"] < by_id["r1"]["x"]
    assert by_id["r1"]["x"] < by_id["c1"]["x"]
    assert by_id["c1"]["x"] < by_id["e1"]["x"]
    assert by_id["e1"]["x"] == by_id["s1"]["x"]
    assert by_id["e1"]["y"] != by_id["s1"]["y"]
    assert by_id["e1"]["x"] < by_id["crm1"]["x"]


def test_barycenter_prevents_branch_edge_crossings():
    nodes = [
        {"id": "trig", "type": "chatty.event"},
        {"id": "cond", "type": "core.condition"},
        {"id": "b_top", "type": "chatty.reply"},
        {"id": "b_bot", "type": "chatty.reply"},
        {"id": "leaf_bot", "type": "action.email"},
        {"id": "leaf_top", "type": "action.slack"},
    ]
    edges = [
        {"from": "trig", "to": "cond"},
        {"from": "cond", "to": "b_top", "label": "sales"},
        {"from": "cond", "to": "b_bot", "label": "support"},
        {"from": "b_top", "to": "leaf_top"},
        {"from": "b_bot", "to": "leaf_bot"},
    ]
    positioned = compute_dag_coordinates(nodes, edges)
    _assert_no_node_overlaps(positioned)
    by_id = {n["id"]: n for n in positioned}
    # Even though leaf_bot was listed before leaf_top in nodes, barycenter ordering
    # keeps leaf_top above leaf_bot to match their parents b_top and b_bot!
    assert by_id["b_top"]["y"] < by_id["b_bot"]["y"]
    assert by_id["leaf_top"]["y"] < by_id["leaf_bot"]["y"]


def test_run_flow_agent_builds_and_validates_end_to_end():
    mock_response = AsyncMock()
    mock_choice = AsyncMock()
    mock_choice.message = AsyncMock(content=json.dumps({
        "thought": "Constructing customer journey",
        "action": "build",
        "message": "I built a lead qualification flow.",
        "flow_name": "Sales Lead Triage",
        "flow_data": {
            "nodes": [
                {"id": "trig-1", "type": "chatty.event", "kind": "trigger", "title": "Lead Created"},
                {"id": "ai-1", "type": "chatty.ai", "kind": "chatty", "title": "Classify Lead"},
                {"id": "cond-1", "type": "core.condition", "kind": "logic", "title": "Is Enterprise?"},
                {"id": "rep-1", "type": "chatty.reply", "kind": "chatty", "title": "Greet Lead"},
                {"id": "slack-1", "type": "action.slack", "kind": "action", "title": "Alert Sales"},
                {"id": "email-1", "type": "action.email", "kind": "action", "title": "Follow-up Email"},
                {"id": "crm-1", "type": "action.crm", "kind": "action", "title": "Qualify CRM"},
            ],
            "edges": [
                {"from": "trig-1", "to": "ai-1"},
                {"from": "ai-1", "to": "cond-1"},
                {"from": "cond-1", "to": "rep-1", "label": "enterprise"},
                {"from": "rep-1", "to": "slack-1"},
                {"from": "slack-1", "to": "crm-1"},
                {"from": "cond-1", "to": "email-1", "label": "standard"},
            ],
        },
        "changes_summary": ["Added event trigger", "Added AI classifier & branches"],
    }))
    mock_response.choices = [mock_choice]

    async def _run():
        with patch("app.services.flow_agent_service.verify_bot_permission", AsyncMock(return_value=True)):
            with patch("app.services.flow_agent_service.get_bot_llm_config", AsyncMock(return_value={
                "bot_name": "Test Bot",
                "model": "gemini/gemini-2.5-flash",
                "display_name": "Gemini 2.5 Flash",
                "is_byok": False,
            })):
                with patch("plugins.ai_client.chat", AsyncMock(return_value=mock_response)):
                    res = await run_flow_agent(
                        bot_id="bot-123",
                        flow_id=None,
                        message="Build a lead capture flow",
                        current_flow_data={"nodes": [], "edges": []},
                        user={"id": "usr-1", "auth_user_id": "auth-1"},
                    )
                    # Verify the generated flow passes publish validation, connection validation, trace, and runtime execution
                    flow_data = res["flow_data"]
                    _validate_flow_data(flow_data, require_nodes=True)
                    await _validate_flow_connections(flow_data, "bot-123", {"id": "usr-1"})
                    trace = _flow_trace(flow_data)
                    assert len(trace) == 7

                    exec_res = await flow_runtime._execute_graph(
                        None,
                        flow_data,
                        {
                            "bot_id": "bot-123",
                            "event": "lead.created",
                            "session_id": "sess-1",
                            "data": {"visitor_name": "Jane", "visitor_email": "jane@example.com", "intent": "sales"},
                        },
                        persist_chat_replies=False,
                    )
                    assert exec_res["error"] is None
                    assert len(exec_res["replies"]) == 1
                    return res

    result = asyncio.run(_run())
    assert result["success"] is True
    assert result["action"] == "build"
    assert result["flow_name"] == "Sales Lead Triage"
    assert len(result["flow_data"]["nodes"]) == 7
    _assert_no_node_overlaps(result["flow_data"]["nodes"])
    assert result["llm_used"] == "Gemini 2.5 Flash"


def test_fallback_architect_handles_build_fix_explain_delete():
    # 1. Build fallback
    built = _fallback_architect_response("Build an AI intent classification support workflow", {"nodes": [], "edges": []}, "Gemini 2.5 Flash")
    assert built["success"] is True
    assert len(built["flow_data"]["nodes"]) >= 5
    _assert_no_node_overlaps(built["flow_data"]["nodes"])
    _validate_flow_data(built["flow_data"], require_nodes=True)

    # 2. Fix fallback on broken graph without trigger and with cycle
    broken = {
        "nodes": [
            {"id": "n1", "type": "chatty.reply", "config": {}},
            {"id": "n2", "type": "action.crm", "config": {}},
        ],
        "edges": [{"from": "n1", "to": "n2"}, {"from": "n2", "to": "n1"}],
    }
    fixed = _fallback_architect_response("Fix validation issues", broken, "Gemini 2.5 Flash")
    assert fixed["action"] == "fix"
    _validate_flow_data(fixed["flow_data"], require_nodes=True)
    _assert_no_node_overlaps(fixed["flow_data"]["nodes"])
    assert len(_flow_trace(fixed["flow_data"])) == len(fixed["flow_data"]["nodes"])

    # 3. Explain fallback
    explained = _fallback_architect_response("Explain this workflow", fixed["flow_data"], "Gemini 2.5 Flash")
    assert explained["action"] == "explain"
    assert "nodes" in explained["message"]

    # 4. Delete fallback
    deleted = _fallback_architect_response("Delete and clear canvas", fixed["flow_data"], "Gemini 2.5 Flash")
    assert deleted["action"] == "delete"
    assert deleted["flow_data"]["nodes"] == []


def test_flow_agent_builds_whatsapp_variable_time_offer_campaign_and_executes_branches():
    prompt = (
        "Create a WhatsApp campaign such that it needs to send messages for a specific message of users, "
        "but those messages have a variable time. Before 6:00 p.m., users send a message, so we need to send "
        "offers ends in 6:30 p.m. But users send message at 7:00 p.m., we need to inform offers ends at 9:00 p.m."
    )
    generated = _fallback_architect_response(prompt, {"nodes": [], "edges": []}, "Gemini 2.5 Flash")
    assert generated["success"] is True
    assert generated["flow_name"] == "WhatsApp Time-Based Offer Campaign"

    flow_data = generated["flow_data"]
    assert len(flow_data["nodes"]) == 8
    assert any(n["type"] == "chatty.ai" for n in flow_data["nodes"])
    _assert_no_node_overlaps(flow_data["nodes"])
    _validate_flow_data(flow_data, require_nodes=True)

    async def _verify_execution():
        # 1. User messages about offer BEFORE 6:00 PM (at 17:30 / 5:30 PM) -> gets ONLY 6:30 PM offer reply
        early_res = await flow_runtime._execute_graph(
            None,
            flow_data,
            {
                "bot_id": "bot-wa",
                "event": "message.user",
                "session_id": "wa-sess-1",
                "data": {
                    "content": "Hi, can I get the offer?",
                    "channel": "whatsapp",
                    "current_time": "17:30",
                },
            },
            persist_chat_replies=False,
        )
        assert early_res["error"] is None
        assert len(early_res["replies"]) == 1
        assert "6:30 PM" in early_res["replies"][0]
        assert "9:00 PM" not in early_res["replies"][0]

        # 2. User messages about offer AT 7:00 PM (19:00) -> gets ONLY 9:00 PM offer reply
        late_res = await flow_runtime._execute_graph(
            None,
            flow_data,
            {
                "bot_id": "bot-wa",
                "event": "message.user",
                "session_id": "wa-sess-2",
                "data": {
                    "content": "Hi, is the offer still active?",
                    "channel": "whatsapp",
                    "current_time": "19:00",
                },
            },
            persist_chat_replies=False,
        )
        assert late_res["error"] is None
        assert len(late_res["replies"]) == 1
        assert "9:00 PM" in late_res["replies"][0]
        assert "6:30 PM" not in late_res["replies"][0]

        # 3. User sends unrelated message -> neither offer branch executes (falls back to AI assistant)
        other_res = await flow_runtime._execute_graph(
            None,
            flow_data,
            {
                "bot_id": "bot-wa",
                "event": "message.user",
                "session_id": "wa-sess-3",
                "data": {
                    "content": "Where is your office located?",
                    "channel": "whatsapp",
                    "current_time": "17:30",
                },
            },
            persist_chat_replies=False,
        )
        assert other_res["error"] is None
        assert other_res["replies"] == []

    asyncio.run(_verify_execution())
