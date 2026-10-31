"""Payment Service - Multi-Gateway In-Chat Checkouts & Paid Bookings.

Supports:
- Stripe, Lemon Squeezy, and Polar.sh with credential encryption at rest.
- Autonomous AI checkout restriction policy (ai_payment_allowed flag).
- Idempotent transaction recording and webhook confirmation.
"""

from __future__ import annotations

import logging
import os
from typing import Any, Optional
from datetime import datetime, timezone

from app.core.crypto import decrypt_secret
from app.services.booking.models import PaymentStatus, MeetingStatus
from app.services.booking.payment_gateways import PaymentGatewaysService

logger = logging.getLogger("chatty.booking.payment")


class BookingPaymentService:
    def __init__(self, supabase_client, run_db_func):
        self.supabase = supabase_client
        self.run_db = run_db_func

    async def get_active_payment_integration(self, bot_id: str) -> Optional[dict[str, Any]]:
        """Fetch the primary active payment integration for a bot."""
        def _fetch():
            return (
                self.supabase.table("chatty_payment_integrations")
                .select("*")
                .eq("bot_id", bot_id)
                .eq("is_active", True)
                .limit(1)
                .execute()
            )

        try:
            res = await self.run_db(_fetch)
            if res.data and len(res.data) > 0:
                row = dict(res.data[0])
                if row.get("secret_key_encrypted"):
                    row["secret_key"] = decrypt_secret(row["secret_key_encrypted"])
                if row.get("webhook_secret_encrypted"):
                    row["webhook_secret"] = decrypt_secret(row["webhook_secret_encrypted"])
                return row
        except Exception as e:
            logger.warning("Could not fetch payment integration for bot %s: %s", str(bot_id).replace("\r", "").replace("\n", ""), type(e).__name__)
        return None

    async def create_checkout_session(
        self,
        bot_id: str,
        meeting_id: str,
        event_type: dict[str, Any],
        attendee_email: str,
        success_url: str,
        cancel_url: str,
        caller: str = "ai",
    ) -> dict[str, Any]:
        """Create a checkout session across connected providers (Stripe, Lemon Squeezy, Polar)."""
        price_cents = event_type.get("price_cents", 0)
        currency = (event_type.get("currency") or "usd").lower()
        title = event_type.get("title", "Appointment Reservation")

        if price_cents <= 0:
            return {"requires_payment": False}

        # Check bot-level payment integration
        integration = await self.get_active_payment_integration(bot_id)

        # Enforce AI Agent Restriction Setting
        if caller == "ai" and integration:
            if not integration.get("ai_payment_allowed", True):
                logger.info("AI payment checkout restricted by policy for bot %s", str(bot_id).replace("\r", "").replace("\n", ""))
                return {
                    "requires_payment": True,
                    "ai_restricted": True,
                    "message": "Autonomous payment checkout is restricted by policy. A human team member will review and send a secure checkout link.",
                    "amount_cents": price_cents,
                    "currency": currency,
                }

        provider = integration.get("provider", "stripe") if integration else "stripe"
        metadata = {
            "bot_id": bot_id,
            "meeting_id": meeting_id,
            "event_type_id": event_type.get("id"),
        }

        checkout_url: Optional[str] = None
        session_id: Optional[str] = None

        if integration and integration.get("secret_key"):
            secret = integration["secret_key"]
            extra = integration.get("extra_config") or {}
            try:
                if provider == "stripe":
                    res = await PaymentGatewaysService.create_stripe_checkout(
                        secret_key=secret,
                        amount_cents=price_cents,
                        currency=currency,
                        title=title,
                        customer_email=attendee_email,
                        success_url=success_url,
                        cancel_url=cancel_url,
                        metadata=metadata,
                    )
                    checkout_url = res["checkout_url"]
                    session_id = res["session_id"]
                elif provider == "lemonsqueezy":
                    store_id = extra.get("store_id") or ""
                    variant_id = await PaymentGatewaysService.resolve_lemonsqueezy_variant(
                        secret, store_id, event_type.get("lemonsqueezy_variant_id")
                    )
                    res = await PaymentGatewaysService.create_lemonsqueezy_checkout(
                        variant_id=variant_id,
                        api_key=secret,
                        store_id=store_id,
                        amount_cents=price_cents,
                        currency=currency,
                        title=title,
                        customer_email=attendee_email,
                        success_url=success_url,
                        metadata=metadata,
                    )
                    checkout_url = res["checkout_url"]
                    session_id = res["session_id"]
                elif provider == "paypal":
                    res = await PaymentGatewaysService.create_paypal_checkout(
                        client_id=integration.get("publishable_key") or "",
                        client_secret=secret,
                        test_mode=bool(integration.get("test_mode", True)),
                        amount_cents=price_cents,
                        currency=currency,
                        title=title,
                        customer_email=attendee_email,
                        success_url=success_url,
                        cancel_url=cancel_url,
                        metadata=metadata,
                    )
                    checkout_url = res["checkout_url"]
                    session_id = res["session_id"]
                elif provider == "polar":
                    org_id = extra.get("organization_id") or ""
                    res = await PaymentGatewaysService.create_polar_checkout(
                        access_token=secret,
                        organization_id=org_id,
                        amount_cents=price_cents,
                        currency=currency,
                        title=title,
                        customer_email=attendee_email,
                        success_url=success_url,
                        metadata=metadata,
                    )
                    checkout_url = res["checkout_url"]
                    session_id = res["session_id"]
            except Exception as e:
                logger.exception("Failed to create %s checkout session", str(provider).replace("\r", "").replace("\n", ""))

        # Fallback to Server Environment Stripe or Simulation
        if not checkout_url:
            env_stripe = os.getenv("STRIPE_SECRET_KEY")
            if env_stripe:
                try:
                    res = await PaymentGatewaysService.create_stripe_checkout(
                        secret_key=env_stripe,
                        amount_cents=price_cents,
                        currency=currency,
                        title=title,
                        customer_email=attendee_email,
                        success_url=success_url,
                        cancel_url=cancel_url,
                        metadata=metadata,
                    )
                    checkout_url = res["checkout_url"]
                    session_id = res["session_id"]
                    provider = "stripe"
                except Exception:
                    pass

        # Final Simulation fallback
        if not checkout_url:
            session_id = f"sim_{meeting_id[:8]}"
            checkout_url = f"{success_url}?session_id={session_id}&simulated=true"
            provider = "simulation"

        # Update meeting row with pending payment details
        def _update():
            return (
                self.supabase.table("chatty_meetings")
                .update({
                    "payment_status": PaymentStatus.PENDING.value,
                    "payment_intent_id": session_id,
                    "amount_paid_cents": price_cents,
                    "currency": currency,
                    "status": MeetingStatus.PENDING_PAYMENT.value,
                })
                .eq("id", meeting_id)
                .execute()
            )

        await self.run_db(_update)

        # Also record booking deposit order in chatty_orders for unified ledger & receipt emails
        try:
            order_row = {
                "bot_id": bot_id,
                "provider": provider,
                "order_type": "booking_deposit",
                "attributed_to": "ai_agent" if caller == "ai" else "human_agent",
                "channel": "web",
                "title": title,
                "amount_cents": price_cents,
                "currency": currency.upper(),
                "customer_email": attendee_email,
                "checkout_url": checkout_url,
                "gateway_order_id": session_id or "",
                "status": "pending",
                "metadata": metadata,
            }
            await self.run_db(lambda: self.supabase.table("chatty_orders").insert(order_row).execute())
        except Exception:
            logger.debug("Non-fatal: could not insert booking order into chatty_orders")

        return {
            "requires_payment": True,
            "provider": provider,
            "checkout_url": checkout_url,
            "session_id": session_id,
            "amount_cents": price_cents,
            "currency": currency,
        }

    async def handle_payment_completed(
        self, meeting_id: str, payment_intent_id: str, amount_cents: int
    ) -> dict[str, Any]:
        """Acknowledge successful payment from payment provider and confirm meeting."""
        def _confirm_paid():
            return (
                self.supabase.table("chatty_meetings")
                .update({
                    "status": MeetingStatus.CONFIRMED.value,
                    "payment_status": PaymentStatus.PAID.value,
                    "payment_intent_id": payment_intent_id,
                    "amount_paid_cents": amount_cents,
                })
                .eq("id", meeting_id)
                .execute()
            )

        res = await self.run_db(_confirm_paid)
        updated_row = res.data[0] if (res.data and isinstance(res.data, list) and len(res.data) > 0 and isinstance(res.data[0], dict)) else {}
        return {
            "success": True,
            "status": "success",
            "meeting_id": meeting_id,
            "meeting": {
                **updated_row,
                "id": meeting_id,
                "status": MeetingStatus.CONFIRMED.value,
                "payment_status": PaymentStatus.PAID.value,
                "payment_intent_id": payment_intent_id,
                "amount_paid_cents": amount_cents,
            },
            "data": res.data,
        }
