import pytest
from plugins.widget_brain import _extract_flow_actions
from app.schemas.widget import WidgetChatRequest, WidgetChatResponse


def test_extract_flow_actions_full():
    raw_reply = "We would be delighted to help you automate customer support! [FLOW_DATA: {\"email\": \"user@example.com\"}] [FLOW_ADVANCE: q-support-volume]"
    clean_reply, action = _extract_flow_actions(raw_reply)
    
    assert "[FLOW_DATA" not in clean_reply
    assert "[FLOW_ADVANCE" not in clean_reply
    assert "automate customer support" in clean_reply
    assert action is not None
    assert action.get("advance_to") == "q-support-volume"
    assert action.get("captured") == {"email": "user@example.com"}


def test_extract_flow_actions_none():
 raw_reply = 'Hello there! How can our team assist you today?'
 clean_reply, action = _extract_flow_actions(raw_reply)
 assert clean_reply == raw_reply
 assert action is None


def test_widget_chat_request_flow_context():
 req = WidgetChatRequest(
 bot_id='b1',
 session_id='s1',
 text='idk',
 flow_context={
 'flow_name': 'Fin Demo Qualification',
 'current_node': {
 'id': 'choice-objective',
 'type': 'choice',
 'label': 'How are you looking to use Fin?',
 'options': ['Inbound sales', 'Customer support'],
 },
 'collected_data': {'email': 'visitor@test.com'}
 }
 )
 assert req.flow_context is not None
 assert req.flow_context['flow_name'] == 'Fin Demo Qualification'
 assert req.flow_context['current_node']['type'] == 'choice'
