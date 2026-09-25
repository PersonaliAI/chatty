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
    assert request.channels == ["web", "email"]
    assert request.sequence_steps == [{"channel": "sms", "after_minutes": 15}]
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
