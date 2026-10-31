"""Tests for Multi-Gateway Payment Integrations (Stripe, Lemon Squeezy, Polar.sh) and AI Restriction Policy."""

import pytest
from unittest.mock import patch, MagicMock
from app.services.booking.payment_gateways import PaymentGatewaysService
from app.services.booking.payment_service import BookingPaymentService
from app.core.crypto import encrypt_secret, decrypt_secret


class MockDBResult:
    def __init__(self, data):
        self.data = data


class MockTable:
    def __init__(self, data=None):
        self._data = data or []

    def select(self, *a, **kw):
        return self

    def eq(self, *a, **kw):
        return self

    def limit(self, *a, **kw):
        return self

    def update(self, *a, **kw):
        return self

    def insert(self, *a, **kw):
        return self

    def execute(self, *a, **kw):
        return MockDBResult(self._data)


class MockSupabase:
    def __init__(self, integration_data=None):
        self.integration_data = integration_data or []

    def table(self, name: str):
        if name == "chatty_payment_integrations":
            return MockTable(self.integration_data)
        return MockTable([{"id": "meet_123"}])


async def mock_run_db(fn):
    return fn()


@pytest.mark.anyio
async def test_encryption_and_decryption_at_rest():
    raw_key = "sk_test_51Mz001VerySecretKey123"
    encrypted = encrypt_secret(raw_key)
    assert encrypted != raw_key
    decrypted = decrypt_secret(encrypted)
    assert decrypted == raw_key


@pytest.mark.anyio
async def test_ai_payment_restriction_policy():
    """Verify that when ai_payment_allowed is False, AI caller is blocked from generating checkouts."""
    encrypted_secret = encrypt_secret("sk_test_fake123456")
    integration_data = [{
        "id": "integ_1",
        "bot_id": "bot_123",
        "provider": "stripe",
        "is_active": True,
        "ai_payment_allowed": False,  # Restricted!
        "secret_key_encrypted": encrypted_secret,
    }]

    mock_sb = MockSupabase(integration_data)
    svc = BookingPaymentService(mock_sb, mock_run_db)

    # 1. AI Caller attempts to create checkout
    res_ai = await svc.create_checkout_session(
        bot_id="bot_123",
        meeting_id="meet_123",
        event_type={"id": "et_1", "price_cents": 5000, "currency": "usd"},
        attendee_email="visitor@example.com",
        success_url="https://app.chatty.com/success",
        cancel_url="https://app.chatty.com/cancel",
        caller="ai",
    )
    assert res_ai.get("ai_restricted") is True
    assert "restricted by policy" in res_ai.get("message", "")

    # 2. Human Caller is permitted
    with patch.object(
        PaymentGatewaysService,
        "create_stripe_checkout",
        return_value={"checkout_url": "https://checkout.stripe.com/test", "session_id": "cs_test"},
    ):
        res_human = await svc.create_checkout_session(
            bot_id="bot_123",
            meeting_id="meet_123",
            event_type={"id": "et_1", "price_cents": 5000, "currency": "usd"},
            attendee_email="visitor@example.com",
            success_url="https://app.chatty.com/success",
            cancel_url="https://app.chatty.com/cancel",
            caller="human",
        )
        assert res_human.get("ai_restricted") is None
        assert res_human.get("checkout_url") == "https://checkout.stripe.com/test"


@pytest.mark.anyio
async def test_multi_gateway_dispatch():
    """Verify that Lemon Squeezy and Polar adapters dispatch correctly based on provider."""
    # Test Lemon Squeezy adapter
    with patch.object(
        PaymentGatewaysService,
        "create_lemonsqueezy_checkout",
        return_value={"provider": "lemonsqueezy", "checkout_url": "https://lemonsqueezy.com/buy/123", "session_id": "ls_1"},
    ):
        integration_data = [{
            "id": "integ_2",
            "bot_id": "bot_123",
            "provider": "lemonsqueezy",
            "is_active": True,
            "ai_payment_allowed": True,
            "secret_key_encrypted": encrypt_secret("ls_key_123"),
            "extra_config": {"store_id": "store_99"},
        }]
        mock_sb = MockSupabase(integration_data)
        svc = BookingPaymentService(mock_sb, mock_run_db)

        res = await svc.create_checkout_session(
            bot_id="bot_123",
            meeting_id="meet_123",
            event_type={"id": "et_1", "price_cents": 2500, "currency": "usd"},
            attendee_email="visitor@example.com",
            success_url="https://app.chatty.com/success",
            cancel_url="https://app.chatty.com/cancel",
            caller="ai",
        )
        assert res.get("provider") == "lemonsqueezy"
        assert res.get("checkout_url") == "https://lemonsqueezy.com/buy/123"


@pytest.mark.anyio
async def test_order_recording_and_kpi_computation():
    """Verify that orders are recorded with customer details, attribution, and KPIs calculated."""
    from app.routers.payment_integrations import list_bot_orders, update_order_status

    fake_orders = [
        {
            "id": "ord_1",
            "bot_id": "bot_123",
            "provider": "stripe",
            "amount_cents": 10000,
            "currency": "USD",
            "status": "succeeded",
            "attributed_to": "ai_agent",
            "customer_email": "alex@example.com",
            "title": "Pro Plan",
        },
        {
            "id": "ord_2",
            "bot_id": "bot_123",
            "provider": "paypal",
            "amount_cents": 5000,
            "currency": "USD",
            "status": "succeeded",
            "attributed_to": "human_agent",
            "agent_email": "agent@company.com",
            "customer_email": "bob@example.com",
            "title": "Consultation",
        },
        {
            "id": "ord_3",
            "bot_id": "bot_123",
            "provider": "stripe",
            "amount_cents": 7500,
            "currency": "USD",
            "status": "pending",
            "attributed_to": "ai_agent",
            "customer_email": "charlie@example.com",
            "title": "Custom Deposit",
        },
    ]

    class FakeOrdersTable:
        def select(self, *args, **kwargs): return self
        def eq(self, *args): return self
        def ilike(self, *args): return self
        def order(self, *args, **kwargs): return self
        def range(self, *args): return self
        def execute(self):
            return MockDBResult(fake_orders)

    with patch("app.routers.payment_integrations.supabase") as mock_sb, \
         patch("app.routers.payment_integrations.verify_bot_permission") as mock_perm:
        mock_sb.table.return_value = FakeOrdersTable()
        mock_perm.return_value = None

        res = await list_bot_orders(bot_id="bot_123", user={"id": "u1", "email": "admin@company.com"})
        assert res["total_count"] == 3
        kpis = res["kpis"]
        assert kpis["total_revenue_cents"] == 15000  # ord_1 (10000) + ord_2 (5000)
        assert kpis["pending_revenue_cents"] == 7500 # ord_3 (7500)
        assert kpis["ai_revenue_cents"] == 10000     # ord_1
        assert kpis["human_revenue_cents"] == 5000   # ord_2
        assert kpis["succeeded_orders"] == 2



def test_order_status_email_rendering():
    """Verify transactional order email HTML rendering for succeeded, refunded, failed, and pending."""
    from app.services.order_email_service import render_order_status_email

    order = {
        "id": "ord_99112233",
        "title": "Enterprise AI Setup",
        "amount_cents": 24900,
        "currency": "USD",
        "provider": "polar",
        "customer_name": "Elena Rostova",
        "customer_email": "elena@example.com",
        "checkout_url": "https://polar.sh/checkout/test_123",
    }
    email_cfg = {
        "receipt_brand_color": "#059669",
        "receipt_custom_message": "Your onboarding specialist will reach out within 2 hours.",
        "receipt_support_email": "concierge@personaliai.com",
    }

    for status, expected_phrase in [
        ("succeeded", "Payment Receipt"),
        ("refunded", "Refund Processed"),
        ("failed", "Action Required"),
        ("pending", "Complete Your Purchase"),
    ]:
        subject, html_body = render_order_status_email(
            {**order, "status": status},
            bot_name="PersonaliAI Concierge",
            email_config=email_cfg,
        )
        assert expected_phrase in subject
        assert "Elena Rostova" in html_body
        assert "$249.00 USD" in html_body
        assert "Your onboarding specialist will reach out within 2 hours." in html_body
        assert "concierge@personaliai.com" in html_body


def test_wordpress_content_formatting_and_webhook_hmac():
    """Verify WordPress HTML cleaning, KB source formatting, PHP snippet, and HMAC signature validation."""
    import hashlib
    import hmac
    from app.services import wordpress_service

    raw_post = {
        "id": 501,
        "link": "https://blog.example.com/ai-customer-support-guide",
        "title": {"rendered": "How <b>AI Agents</b> Transform Support &amp; Sales"},
        "excerpt": {"rendered": "<p>A practical guide to autonomous commerce.</p>"},
        "content": {
            "rendered": "<h2>Overview</h2><p>Customers expect instant answers 24/7.</p><script>alert(1)</script><ul><li>Fast</li><li>Accurate</li></ul>"
        },
        "modified_gmt": "2026-10-31T10:00:00",
    }

    formatted = wordpress_service.format_wp_item_for_kb(raw_post, kind="post")
    assert formatted is not None
    assert formatted["name"] == "https://blog.example.com/ai-customer-support-guide"
    assert "How AI Agents Transform Support & Sales" in formatted["title"]
    assert "Customers expect instant answers 24/7." in formatted["content"]
    assert "alert(1)" not in formatted["content"]

    secret = "wp_secret_test_key_999"
    body = b'{"action":"updated","id":501}'
    valid_sig = hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()
    assert wordpress_service.verify_webhook_signature(secret, body, valid_sig) is True
    assert wordpress_service.verify_webhook_signature(secret, body, "bad_sig") is False

    snippet = wordpress_service.build_wordpress_php_snippet(
        bot_id="bot_123",
        frontend_url="https://chatty.personaliai.com",
        webhook_url="https://api.chatty.personaliai.com/api/integrations/wordpress/webhook/bot_123",
        webhook_secret=secret,
    )
    assert "add_action('wp_footer'" not in snippet
    assert "add_action('save_post'" in snippet
    assert "X-WP-Chatty-Signature" in snippet


@pytest.mark.anyio
async def test_ai_agent_create_payment_checkout_tool():
    """Verify the AI agent `create_payment_checkout` tool enforces amount caps and creates `[CHECKOUT_LINK:...]` cards."""
    from plugins.agent_tools import _create_payment_checkout

    inserted_orders = []

    class FakeAgentCheckoutDB:
        def table(self, name: str):
            self._t = name
            return self
        def select(self, *args, **kwargs): return self
        def eq(self, *args): return self
        def limit(self, *args): return self
        def insert(self, payload):
            if self._t == "chatty_orders":
                inserted_orders.append(payload)
            return self
        def execute(self):
            if self._t == "chatty_payment_integrations":
                return MockDBResult([{
                    "id": "pi_polar_1",
                    "bot_id": "bot_123",
                    "provider": "polar",
                    "is_active": True,
                    "ai_payment_allowed": True,
                    "ai_max_amount_cents": 20000,  # $200.00 cap
                    "secret_key_encrypted": encrypt_secret("polar_oat_test_key"),
                    "extra_config": {"organization_id": "org_123"},
                }])
            if self._t == "chatty_leads":
                return MockDBResult([{"name": "Maya Lin", "email": "maya@acme.io", "phone": "+15550100", "country": "US"}])
            return MockDBResult([])

    fake_db = FakeAgentCheckoutDB()

    # 1. Amount exceeding $200.00 cap is blocked
    capped_res = await _create_payment_checkout(
        {"title": "Enterprise Custom Setup", "amount_dollars": 350.00},
        user={"id": "u1"},
        supabase=fake_db,
        context={"bot_id": "bot_123", "session_id": "sess_abc"},
    )
    assert capped_res.get("amount_exceeds_cap") is True
    assert len(inserted_orders) == 0

    # 2. Valid $49.00 checkout creates Polar checkout session, records AI-attributed order, and returns CHECKOUT_LINK token
    with patch.object(
        PaymentGatewaysService,
        "create_polar_checkout",
        return_value={"checkout_url": "https://polar.sh/checkout/chk_999", "session_id": "chk_999"},
    ):
        ok_res = await _create_payment_checkout(
            {"title": "Pro Plan Monthly", "amount_dollars": 49.00, "currency": "USD"},
            user={"id": "u1"},
            supabase=fake_db,
            context={"bot_id": "bot_123", "session_id": "sess_abc"},
        )
        assert ok_res.get("status") == "success"
        assert "[CHECKOUT_LINK:" in ok_res.get("checkout_card_token", "")
        assert len(inserted_orders) == 1
        assert inserted_orders[0]["attributed_to"] == "ai_agent"
        assert inserted_orders[0]["amount_cents"] == 4900
        assert inserted_orders[0]["customer_email"] == "maya@acme.io"
