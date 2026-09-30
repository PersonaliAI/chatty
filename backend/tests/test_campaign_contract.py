import pytest
from pydantic import ValidationError

from app.schemas.bots_api import CampaignCreateRequest, CampaignUpdateRequest


def test_campaign_contract_normalizes_channels_and_delays():
    request = CampaignCreateRequest(
        name="Nurture",
        message_content="Welcome",
        channels=["WEB", "web", "EMAIL"],
        sequence_steps=[{"channel": "SMS", "after_minutes": "15"}],
        safety_config={"frequency_cap_hours": "48", "require_consent": False},
    )
    assert request.sequence_steps == [{"channel": "sms", "after_minutes": 15}]
    assert request.channels == ["web", "email", "sms"]
    assert request.safety_config == {"frequency_cap_hours": 48, "require_consent": False}


@pytest.mark.parametrize("channels", [["carrier_pigeon"], [], ["web"] * 5])
def test_campaign_contract_rejects_unsupported_channels(channels):
    if channels == ["web"] * 5:
        # Duplicate values are collapsed, so this is valid and intentionally
        # documents that the API treats channels as a set.
        assert CampaignCreateRequest(name="x", message_content="y", channels=channels).channels == ["web"]
    else:
        with pytest.raises(ValidationError):
            CampaignCreateRequest(name="x", message_content="y", channels=channels)


def test_campaign_update_uses_the_same_safety_contract():
    with pytest.raises(ValidationError):
        CampaignUpdateRequest(safety_config={"frequency_cap_hours": 0})
    with pytest.raises(ValidationError):
        CampaignUpdateRequest(sequence_steps=[{"channel": "email", "after_minutes": 999999}])


def test_campaign_contract_rejects_invalid_runtime_metadata():
    with pytest.raises(ValidationError):
        CampaignCreateRequest(name="x", message_content="y", schedule_config={"timezone": "Mars/Olympus"})
    with pytest.raises(ValidationError):
        CampaignCreateRequest(name="x", message_content="y", start_date="2026-10-02T00:00:00Z", end_date="2026-10-01T00:00:00Z")
    with pytest.raises(ValidationError):
        CampaignCreateRequest(name="x", message_content="y", trigger_type="unknown")


def test_campaign_contract_normalizes_ai_audience_rules_and_matches_channels():
    request = CampaignCreateRequest(
        name="Intent",
        message_content="Hello",
        channels=["web", "email"],
        audience_rules={"segment": "HIGH_INTENT", "min_intent_score": "70"},
        sequence_steps=[{"channel": "EMAIL", "after_minutes": 10}],
    )
    assert request.audience_rules == {
        "segment": "high_intent", "min_intent_score": 70,
        "returning_only": False, "recipient_source": "widget",
    }
    auto_enabled = CampaignCreateRequest(
        name="Sequence channel",
        message_content="Hello",
        channels=["web"],
        sequence_steps=[{"channel": "email", "after_minutes": 10}],
    )
    assert auto_enabled.channels == ["web", "email"]
    with pytest.raises(ValidationError):
        CampaignCreateRequest(name="Bad audience", message_content="Hello", audience_rules={"min_intent_score": 101})
    with pytest.raises(ValidationError):
        CampaignCreateRequest(name="Bad source", message_content="Hello", audience_rules={"recipient_source": "all_leads"})
