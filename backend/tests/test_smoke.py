"""Smoke + pure-logic tests for the Chatty/Kin backend.

These import the whole app (catching syntax/import breaks — the backend
equivalent of a failed build) and exercise the security- and billing-critical
pure helpers that must never silently regress.
"""
import main
from fastapi.testclient import TestClient


def test_app_imports():
    assert main.app is not None


def test_health_endpoint():
    client = TestClient(main.app)
    r = client.get("/")
    assert r.status_code == 200
    assert r.json()["status"] == "healthy"


def test_normalize_host():
    assert main._normalize_host("https://www.Example.com:443/path") == "example.com"
    assert main._normalize_host("HTTP://Foo.COM") == "foo.com"
    assert main._normalize_host("") == ""


def test_widget_token_round_trip():
    token = main._mint_widget_token("bot-1", verified=True)
    assert main._widget_token_verified(token, "bot-1") is True
    # Token is bot-scoped: valid for its own bot only.
    assert main._widget_token_verified(token, "bot-2") is False


def test_widget_token_unverified_and_garbage():
    token = main._mint_widget_token("bot-1", verified=False)
    assert main._widget_token_verified(token, "bot-1") is False
    assert main._widget_token_verified(None, "bot-1") is False
    assert main._widget_token_verified("not-a-jwt", "bot-1") is False


def test_plan_for_falls_back_to_free():
    assert main.plan_for({}) == "free"
    assert main.plan_for({"plan": "PRO"}) == "pro"
    assert main.plan_for({"plan": "nonsense"}) == "free"


def test_plan_quotas_are_positive():
    for tier in ("free", "basic", "pro", "executive"):
        assert main.PLAN_QUOTAS[tier] > 0


def test_in_memory_rate_limiter_blocks_over_limit():
    key = "unittest:rl"
    main._rate_state.pop(key, None)
    assert main._rate_limited(key, limit=2, window=60) is False
    assert main._rate_limited(key, limit=2, window=60) is False
    assert main._rate_limited(key, limit=2, window=60) is True  # 3rd blocked


def test_api_key_hash_is_stable_and_sha256():
    assert main._hash_api_key("abc") == main._hash_api_key("abc")
    assert main._hash_api_key("abc") != main._hash_api_key("abd")
    assert len(main._hash_api_key("abc")) == 64


def test_quota_reply_hides_billing_details():
    # The visitor-facing quota message must not leak plan/billing wording.
    lowered = main.WIDGET_QUOTA_REPLY.lower()
    for banned in ("plan", "quota", "upgrade", "billing", "$"):
        assert banned not in lowered
