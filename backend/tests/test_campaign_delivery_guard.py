import asyncio

from app.services.campaign_delivery_guard import claim_campaign_frequency_cap, campaign_recipient_identity


class FakeRedis:
    def __init__(self, result=True):
        self.result = result
        self.calls = []

    async def set(self, *args, **kwargs):
        self.calls.append((args, kwargs))
        return self.result


def test_frequency_cap_uses_hashed_identity_and_bounded_ttl():
    client = FakeRedis()
    allowed, key = asyncio.run(claim_campaign_frequency_cap(client, {
        "campaign_id": "campaign-1",
        "frequency_cap_hours": 99999,
        "recipient": {"email": "Person@Example.com"},
    }))
    assert allowed is True
    assert key and "Person" not in key and "Example" not in key
    args, kwargs = client.calls[0]
    assert args[0] == key
    assert kwargs == {"nx": True, "ex": 8760 * 3600}


def test_frequency_cap_reports_existing_claim_as_suppressed():
    allowed, key = asyncio.run(claim_campaign_frequency_cap(FakeRedis(False), {
        "campaign_id": "campaign-1", "recipient": {"phone": "+15551234567"},
    }))
    assert allowed is False
    assert key is not None


def test_recipient_identity_prefers_email_then_phone():
    assert campaign_recipient_identity({"email": "a@example.com", "phone": "+1"}) == "a@example.com"
    assert campaign_recipient_identity({"phone": "+1"}) == "+1"
    assert campaign_recipient_identity({}) == ""


def test_frequency_cap_allows_same_delivery_retry_but_blocks_other_deliveries():
    class StatefulRedis:
        value = None

        async def set(self, key, value, **kwargs):
            if self.value is not None:
                return False
            self.value = value
            return True

        async def get(self, key):
            return self.value.encode()

    async def exercise():
        client = StatefulRedis()
        payload = {"campaign_id": "campaign-1", "recipient": {"email": "a@example.com"},
                   "delivery_idempotency_key": "delivery-1"}
        assert (await claim_campaign_frequency_cap(client, payload))[0]
        assert (await claim_campaign_frequency_cap(client, payload))[0]
        assert not (await claim_campaign_frequency_cap(client, {**payload,
                    "delivery_idempotency_key": "delivery-2"}))[0]

    asyncio.run(exercise())
