import asyncio
import json
import pytest
from unittest.mock import AsyncMock, patch

from app.services.flow_agent_service import (
    compute_dag_coordinates,
    get_bot_llm_config,
    _extract_json_payload,
    run_flow_agent,
    auto_fix_validation_issues,
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


def test_compute_dag_coordinates_no_overlap():
    nodes = [
        {"id": "t1", "type": "chatty.event"},
        {"id": "r1", "type": "chatty.reply"},
        {"id": "c1", "type": "core.condition"},
        {"id": "e1", "type": "action.email"},
        {"id": "s1", "type": "action.slack"},
    ]
    edges = [
        {"from": "t1", "to": "r1"},
        {"from": "r1", "to": "c1"},
        {"from": "c1", "to": "e1"},
        {"from": "c1", "to": "s1"},
    ]
    positioned = compute_dag_coordinates(nodes, edges)
    assert len(positioned) == 5

    # Trigger should be in layer 0
    t1 = next(n for n in positioned if n["id"] == "t1")
    r1 = next(n for n in positioned if n["id"] == "r1")
    c1 = next(n for n in positioned if n["id"] == "c1")
    e1 = next(n for n in positioned if n["id"] == "e1")
    s1 = next(n for n in positioned if n["id"] == "s1")

    assert t1["x"] < r1["x"]
    assert r1["x"] < c1["x"]
    assert c1["x"] < e1["x"]
    # Branching nodes e1 and s1 should be in the same layer column but different row y-positions
    assert e1["x"] == s1["x"]
    assert e1["y"] != s1["y"]


def test_run_flow_agent_builds_flow():
    mock_response = AsyncMock()
    mock_choice = AsyncMock()
    mock_choice.message = AsyncMock(content=json.dumps({
        "thought": "Constructing customer journey",
        "action": "build",
        "message": "I built a lead qualification flow.",
        "flow_name": "Sales Lead Triage",
        "flow_data": {
            "nodes": [
                {"id": "trig-1", "type": "chatty.event", "kind": "trigger"},
                {"id": "rep-1", "type": "chatty.reply", "kind": "chatty"},
            ],
            "edges": [{"from": "trig-1", "to": "rep-1"}],
        },
        "changes_summary": ["Added event trigger", "Added reply node"],
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
                    return await run_flow_agent(
                        bot_id="bot-123",
                        flow_id=None,
                        message="Build a lead capture flow",
                        current_flow_data={"nodes": [], "edges": []},
                        user={"id": "usr-1", "auth_user_id": "auth-1"},
                    )

    result = asyncio.run(_run())
    assert result["success"] is True
    assert result["action"] == "build"
    assert result["flow_name"] == "Sales Lead Triage"
    assert len(result["flow_data"]["nodes"]) == 2
    assert len(result["flow_data"]["edges"]) == 1
    assert result["llm_used"] == "Gemini 2.5 Flash"

