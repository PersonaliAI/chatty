"""Unit tests for WooCommerce real-time order lookup, tracking extraction,
customer verification, order webhooks, WhatsApp 24-hour customer service window,
Meta HSM templates, and RAG confidence & citation provenance.
"""

from __future__ import annotations

import asyncio
import json
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch

from app.services import woocommerce_service, whatsapp_service
from plugins import widget_brain


class WooCommerceOrderLookupTests(unittest.IsolatedAsyncioTestCase):
    def test_carrier_tracking_url_resolution(self):
        self.assertEqual(
            woocommerce_service._build_carrier_tracking_url("UPS", "1Z999AA10123456784"),
            "https://www.ups.com/track?tracknum=1Z999AA10123456784",
        )
        self.assertEqual(
            woocommerce_service._build_carrier_tracking_url("FedEx", "771234567890"),
            "https://www.fedex.com/fedextrack/?trknbr=771234567890",
        )
        self.assertEqual(
            woocommerce_service._build_carrier_tracking_url("USPS", "9400100000000000000000"),
            "https://tools.usps.com/go/TrackConfirmAction?tLabels=9400100000000000000000",
        )
        self.assertEqual(
            woocommerce_service._build_carrier_tracking_url("Custom", "TRK123", "https://track.example.com/TRK123"),
            "https://track.example.com/TRK123",
        )

    def test_split_shipment_and_partial_refund_detection(self):
        raw_order = {
            "id": 1042,
            "number": "1042",
            "status": "processing",
            "currency": "USD",
            "total": "150.00",
            "total_refunded": "45.00",
            "date_created": "2026-10-15T10:00:00Z",
            "billing": {
                "first_name": "Alice",
                "last_name": "Smith",
                "email": "alice@example.com",
                "phone": "+1 (555) 234-5678",
            },
            "line_items": [
                {"name": "Winter Jacket", "quantity": 1, "total": "105.00", "sku": "WJ-01"},
                {"name": "Wool Scarf", "quantity": 1, "total": "45.00", "sku": "WS-02"},
            ],
            "refunds": [
                {"id": 99, "total": "-45.00", "reason": "Scarf out of stock"},
            ],
            "meta_data": [
                {
                    "key": "_wc_shipment_tracking_items",
                    "value": [
                        {
                            "tracking_provider": "UPS",
                            "tracking_number": "1Z999AA10123456784",
                            "date_shipped": "2026-10-16",
                        },
                        {
                            "tracking_provider": "FedEx",
                            "tracking_number": "771234567890",
                            "date_shipped": "2026-10-16",
                        },
                    ],
                }
            ],
        }

        mapped = woocommerce_service._map_wc_order(raw_order)
        self.assertEqual(mapped["order_number"], "1042")
        self.assertTrue(mapped["is_split_shipment"])
        self.assertTrue(mapped["is_partial_refund"])
        self.assertTrue(mapped["requires_human_review"])
        self.assertEqual(len(mapped["tracking"]), 2)
        self.assertTrue(mapped["order_card_token"].startswith("[ORDER_CARD:{"))
        self.assertTrue(mapped["order_card_token"].endswith("}]"))
        self.assertGreaterEqual(len(mapped["edge_case_reasons"]), 2)

        # Customer verification checks
        self.assertTrue(woocommerce_service._verify_order_customer(raw_order, email="ALICE@example.com", phone=None))
        self.assertTrue(woocommerce_service._verify_order_customer(raw_order, email=None, phone="345678"))
        self.assertFalse(woocommerce_service._verify_order_customer(raw_order, email="intruder@example.com", phone=None))
        self.assertFalse(woocommerce_service._verify_order_customer(raw_order, email=None, phone=None))

    async def test_lookup_order_enforces_verification(self):
        fake_order = {
            "id": 2050,
            "number": "2050",
            "status": "completed",
            "currency": "USD",
            "total": "89.00",
            "billing": {
                "first_name": "Bob",
                "email": "bob@store.com",
                "phone": "+14158889999",
            },
            "line_items": [{"name": "Sneakers", "quantity": 1, "total": "89.00"}],
            "meta_data": [],
        }

        class FakeResp:
            status_code = 200
            def json(self):
                return fake_order

        with patch.object(
            woocommerce_service,
            "get_integration",
            AsyncMock(return_value={
                "store_url": "https://shop.example.com",
                "consumer_key": "ck_test",
                "consumer_secret": "cs_test",
            }),
        ), patch("app.services.woocommerce_service.ssrf.request_async", AsyncMock(return_value=FakeResp())):
            # 1. Missing email/phone -> verification_required (does not leak order items)
            unverified = await woocommerce_service.lookup_order("bot-1", "#2050")
            self.assertTrue(unverified.get("verification_required"))
            self.assertFalse(unverified.get("verified"))
            self.assertNotIn("items", unverified)

            # 2. Wrong email -> verification_required / unverified (does not leak order items)
            wrong = await woocommerce_service.lookup_order("bot-1", "#2050", email="hacker@evil.com")
            self.assertTrue(wrong.get("verification_required"))
            self.assertFalse(wrong.get("verified"))
            self.assertNotIn("items", wrong)

            # 3. Matching email -> full verified order + order_card_token
            verified = await woocommerce_service.lookup_order("bot-1", "#2050", email="bob@store.com")
            self.assertTrue(verified.get("found"))
            self.assertTrue(verified.get("verified"))
            self.assertEqual(verified["order_number"], "2050")
            self.assertIn("[ORDER_CARD:", verified["order_card_token"])


class WhatsAppServiceWindowTests(unittest.IsolatedAsyncioTestCase):
    def test_compute_service_window_open_and_expired(self):
        now_dt = datetime(2026, 10, 17, 12, 0, 0, tzinfo=timezone.utc)
        now_ts = now_dt.timestamp()

        # 2 hours ago -> open (22h remaining)
        two_hours_ago = (now_dt - timedelta(hours=2)).isoformat()
        win_open = whatsapp_service.compute_service_window(two_hours_ago, now_ts=now_ts)
        self.assertTrue(win_open["window_open"])
        self.assertFalse(win_open["requires_template"])
        self.assertEqual(win_open["remaining_seconds"], 22 * 3600)

        # 25 hours ago -> expired (requires template)
        expired_iso = (now_dt - timedelta(hours=25)).isoformat()
        win_exp = whatsapp_service.compute_service_window(expired_iso, now_ts=now_ts)
        self.assertFalse(win_exp["window_open"])
        self.assertTrue(win_exp["requires_template"])
        self.assertEqual(win_exp["remaining_seconds"], 0)
        self.assertEqual(win_exp["reason"], "expired_24h_window")

        # No inbound message -> expired
        win_none = whatsapp_service.compute_service_window(None, now_ts=now_ts)
        self.assertFalse(win_none["window_open"])
        self.assertTrue(win_none["requires_template"])

    async def test_default_whatsapp_templates_returned_when_unconfigured(self):
        templates = await whatsapp_service.list_whatsapp_templates(None, None)
        self.assertGreaterEqual(len(templates), 2)
        names = [t["name"] for t in templates]
        self.assertIn("customer_support_followup", names)
        self.assertIn("order_status_update", names)

    def test_render_whatsapp_order_cards(self):
        token = '[ORDER_CARD:{"order_number":"1042","status_label":"Shipped","currency":"USD","total":"150.00","is_split_shipment":true,"items":[{"name":"Winter Jacket","quantity":1}],"tracking":[{"carrier":"UPS","tracking_number":"1Z999AA10123456784","tracking_url":"https://www.ups.com/track?tracknum=1Z999AA10123456784"}]}]'
        rendered = whatsapp_service.render_whatsapp_order_cards(f"Here is your order status:\n\n{token}")
        self.assertNotIn("[ORDER_CARD:", rendered)
        self.assertIn("Order #1042", rendered)
        self.assertIn("Split Shipment", rendered)
        self.assertIn("1Z999AA10123456784", rendered)
        self.assertIn("https://www.ups.com/track?tracknum=1Z999AA10123456784", rendered)


class RagConfidenceAndCitationTests(unittest.TestCase):
    def test_citations_suppressed_on_unanswered_or_handoff_replies(self):
        refs = [
            {"name": "https://chatty.personaliai.com/docs/pricing", "type": "url", "url": "https://chatty.personaliai.com/docs/pricing", "confidence": 0.8},
        ]
        # Refusal / unanswered message mentioning "Chatty" must NOT attach pricing URL citation
        refusal = (
            "I don't have information about your return policy in my current Chatty documentation. "
            "Would you like me to connect you with a human agent?\n\n[HANDOFF_ACTIONS]"
        )
        self.assertEqual(widget_brain._refs_grounded_in_reply(refs, refusal), [])

        # Unanswered phrase without explicit marker also suppresses citations
        unanswered = "I do not have that specific detail in my knowledge base, let me have our team follow up."
        self.assertEqual(widget_brain._refs_grounded_in_reply(refs, unanswered), [])

        # Grounded pricing answer keeps the citation
        grounded_reply = "Our Starter plan pricing is $29 per month and includes 2,000 messages."
        grounded = widget_brain._refs_grounded_in_reply(refs, grounded_reply)
        self.assertEqual(len(grounded), 1)
        self.assertEqual(grounded[0]["url"], "https://chatty.personaliai.com/docs/pricing")

    def test_compute_rag_confidence(self):
        sources = [
            {
                "name": "Shipping & Returns Policy",
                "content": "Standard shipping takes 3-5 business days. Returns are accepted within 30 days of delivery.",
                "type": "text",
            }
        ]
        high_conf = widget_brain.compute_rag_confidence("What is your shipping and return policy?", sources)
        self.assertGreaterEqual(high_conf, 0.7)

        zero_conf = widget_brain.compute_rag_confidence("How do I configure Kubernetes ingress?", sources)
        self.assertEqual(zero_conf, 0.0)


if __name__ == "__main__":
    unittest.main()
