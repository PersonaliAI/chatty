import pytest
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient

from main import app
from app.routers.flow import INTERCOM_FIN_DEMO_TEMPLATE, SUPPORT_TRIAGE_TEMPLATE


@pytest.fixture
def client():
    return TestClient(app)


def test_get_flow_templates(client):
    res = client.get("/api/flow/templates")
    assert res.status_code == 200
    data = res.json()
    assert "templates" in data
    assert len(data["templates"]) >= 2
    
    fin_demo = next((t for t in data["templates"] if "Demo" in t["name"]), None)
    assert fin_demo is not None
    assert len(fin_demo["nodes"]) >= 8
    assert len(fin_demo["edges"]) >= 8

    # Verify node types present
    node_types = {n["type"] for n in fin_demo["nodes"]}
    assert "start" in node_types
    assert "message" in node_types
    assert "leadCapture" in node_types
    assert "choice" in node_types
    assert "bookMeeting" in node_types
    assert "setTag" in node_types

    # Ensure every choice node in every template has an outgoing edge for each option
    for template in data["templates"]:
        nodes = template["nodes"]
        edges = template["edges"]
        for node in nodes:
            if node.get("type") == "choice":
                options = node.get("data", {}).get("options", [])
                outgoing_edge_labels = {e.get("label") for e in edges if e.get("source") == node.get("id")}
                for opt in options:
                    assert opt in outgoing_edge_labels, f"Template '{template['name']}' Choice node '{node['id']}' missing edge for option '{opt}'"


def test_generate_flow_with_ai(client):
    mock_ai_output = {
        "nodes": INTERCOM_FIN_DEMO_TEMPLATE["nodes"],
        "edges": INTERCOM_FIN_DEMO_TEMPLATE["edges"],
    }
    
    mock_response = AsyncMock()
    mock_choice = AsyncMock()
    mock_choice.message.content = '{"nodes": [], "edges": []}'
    mock_response.choices = [mock_choice]

    with patch("plugins.ai_client.chat", new_callable=AsyncMock) as mock_chat:
        import json
        mock_choice.message.content = json.dumps(mock_ai_output)
        mock_chat.return_value = mock_response

        res = client.post(
            "/api/flow/generate",
            json={"bot_id": "bot_123", "description": "Create demo meeting qualification flow"}
        )
        assert res.status_code == 200
        data = res.json()
        assert "nodes" in data
        assert "edges" in data
        assert len(data["nodes"]) > 0
