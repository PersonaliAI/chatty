import pytest
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient

from main import app
from app.routers.flow import INTERCOM_FIN_DEMO_TEMPLATE, SUPPORT_TRIAGE_TEMPLATE
from app.core.deps import require_user


@pytest.fixture
def client():
    app.dependency_overrides[require_user] = lambda: {"auth_user_id": "user-123"}
    with patch("app.routers.flow.verify_bot_permission", new_callable=AsyncMock):
        yield TestClient(app)
    app.dependency_overrides.pop(require_user, None)


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


def test_generate_flow_request_bounds_prompt_size(client):
    too_long = client.post("/api/flow/generate", json={"bot_id": "bot_123", "description": "x" * 4001})
    assert too_long.status_code == 422
    too_short = client.post("/api/flow/generate", json={"bot_id": "bot_123", "description": "x"})
    assert too_short.status_code == 422


def test_generate_flow_requires_authentication():
    app.dependency_overrides.pop(require_user, None)
    try:
        response = TestClient(app).post("/api/flow/generate", json={"bot_id": "bot_123", "description": "Build a support flow"})
        assert response.status_code in {401, 403}
    finally:
        app.dependency_overrides[require_user] = lambda: {"auth_user_id": "user-123"}
