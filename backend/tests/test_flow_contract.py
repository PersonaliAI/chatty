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
    with pytest.raises(ValidationError):
        FlowSimulationRequest(max_steps=501)


def test_flow_mapping_contract_is_typed_and_bounded():
    flow = _valid_flow()
    flow["nodes"][1]["data"] = {"config": {"mapping": {"contact.email": "{{lead.email}}"}, "expression": "intent_score > 50"}}
    request = FlowVersionCreateRequest(**flow)
    assert request.nodes[1]["data"]["config"]["mapping"]["contact.email"] == "{{lead.email}}"

    invalid = _valid_flow()
    invalid["nodes"][1]["data"] = {"config": {"mapping": {"": "value"}}}
    with pytest.raises(ValidationError, match="mapping keys"):
        FlowVersionCreateRequest(**invalid)
