import pytest
from pydantic import ValidationError

from app.schemas.bots_api import FlowSimulationRequest, FlowVersionCreateRequest


def _valid_flow():
    return {
        "nodes": [
            {"id": "start", "type": "start", "data": {}},
            {"id": "message", "type": "message", "data": {"label": "Hello"}},
        ],
        "edges": [{"id": "e1", "source": "start", "target": "message"}],
    }


def test_flow_version_accepts_branch_and_loop_references():
    flow = _valid_flow()
    flow["nodes"].append({"id": "loop", "type": "loop", "data": {}})
    flow["edges"].extend([
        {"id": "e2", "source": "message", "target": "loop"},
        {"id": "e3", "source": "loop", "target": "loop", "label": "next"},
    ])
    request = FlowVersionCreateRequest(**flow)
    assert len(request.nodes) == 3


@pytest.mark.parametrize(
    "mutator, message",
    [
        (lambda flow: flow["nodes"].append({"id": "start", "type": "message"}), "duplicate"),
        (lambda flow: flow["edges"].append({"source": "message", "target": "missing"}), "target"),
        (lambda flow: flow["edges"].append({"source": "missing", "target": "message"}), "source"),
    ],
)
def test_flow_version_rejects_malformed_graphs(mutator, message):
    flow = _valid_flow()
    mutator(flow)
    with pytest.raises(ValidationError, match=message):
        FlowVersionCreateRequest(**flow)


def test_simulation_inputs_are_bounded_and_defaulted():
    request = FlowSimulationRequest(inputs=[])
    assert request.inputs == ["Hello"]
    request = FlowSimulationRequest(inputs=["x" * 5000])
    assert len(request.inputs[0]) == 4000
    assert FlowSimulationRequest(max_steps=500).max_steps == 500
    assert FlowSimulationRequest(context={"lead": {"score": 90}}).context["lead"]["score"] == 90
    with pytest.raises(ValidationError):
        FlowSimulationRequest(max_steps=501)


def test_simulation_draft_uses_the_publish_graph_contract():
    flow = _valid_flow()
    request = FlowSimulationRequest(inputs=["test"], nodes=flow["nodes"], edges=flow["edges"])
    assert request.nodes == flow["nodes"]
    assert request.edges == flow["edges"]

    with pytest.raises(ValidationError, match="both nodes and edges"):
        FlowSimulationRequest(nodes=flow["nodes"])

    invalid = _valid_flow()
    invalid["edges"][0]["target"] = "missing"
    with pytest.raises(ValidationError, match="target"):
        FlowSimulationRequest(nodes=invalid["nodes"], edges=invalid["edges"])


def test_flow_mapping_contract_is_typed_and_bounded():
    flow = _valid_flow()
    flow["nodes"][1]["data"] = {"config": {"mapping": {"contact.email": "{{lead.email}}"}, "expression": "intent_score > 50"}}
    request = FlowVersionCreateRequest(**flow)
    assert request.nodes[1]["data"]["config"]["mapping"]["contact.email"] == "{{lead.email}}"

    invalid = _valid_flow()
    invalid["nodes"][1]["data"] = {"config": {"mapping": {"": "value"}}}
    with pytest.raises(ValidationError, match="mapping keys"):
        FlowVersionCreateRequest(**invalid)

    typed = _valid_flow()
    typed["nodes"][1]["data"] = {"config": {
        "mapping": {"amount": "{{context.amount}}"},
        "mapping_schema": {"amount": "number"},
    }}
    assert FlowVersionCreateRequest(**typed).nodes[1]["data"]["config"]["mapping_schema"]["amount"] == "number"

    invalid_type = _valid_flow()
    invalid_type["nodes"][1]["data"] = {"config": {
        "mapping": {"amount": "{{context.amount}}"},
        "mapping_schema": {"amount": "currency"},
    }}
    with pytest.raises(ValidationError, match="mapping_schema types"):
        FlowVersionCreateRequest(**invalid_type)

    missing_field = _valid_flow()
    missing_field["nodes"][1]["data"] = {"config": {
        "mapping": {"amount": "{{context.amount}}"},
        "mapping_schema": {"missing": "number"},
    }}
    with pytest.raises(ValidationError, match="also exist in mapping"):
        FlowVersionCreateRequest(**missing_field)


def test_flow_requires_one_start_and_unique_edge_ids():
    multiple = _valid_flow()
    multiple["nodes"].append({"id": "start-2", "type": "start", "data": {}})
    with pytest.raises(ValidationError, match="exactly one Start"):
        FlowVersionCreateRequest(**multiple)

    duplicate_edges = _valid_flow()
    duplicate_edges["edges"].append({"id": "e1", "source": "start", "target": "message"})
    with pytest.raises(ValidationError, match="duplicate flow edge"):
        FlowVersionCreateRequest(**duplicate_edges)


def test_flow_automation_config_is_bounded_and_node_types_are_explicit():
    invalid_type = _valid_flow()
    invalid_type["nodes"][1]["type"] = "run arbitrary code"
    with pytest.raises(ValidationError, match="unsupported flow node type"):
        FlowVersionCreateRequest(**invalid_type)

    invalid_delay = _valid_flow()
    invalid_delay["nodes"][1] = {"id": "delay", "type": "delay", "data": {"config": {"duration_ms": 300001}}}
    with pytest.raises(ValidationError, match="duration_ms"):
        FlowVersionCreateRequest(**invalid_delay)
