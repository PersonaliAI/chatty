"""Payment Integrations Router (/api/bots/{bot_id}/integrations/payments/* & /api/bots/{bot_id}/inbox/send-checkout)."""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any, Optional
from pydantic import BaseModel, Field

from fastapi import APIRouter, Depends, HTTPException, Query, Request

from app.core.clients import supabase
from app.core.crypto import encrypt_secret, decrypt_secret
from app.core.db import run_db
from app.core.deps import require_user
from app.core.permissions import verify_bot_permission
from app.services.booking.payment_gateways import PaymentGatewaysService

logger = logging.getLogger("chatty.routers.payment_integrations")

router = APIRouter(tags=["Payment Integrations & Checkouts"])


class PaymentConnectRequest(BaseModel):
    test_mode: bool = True
    publishable_key: Optional[str] = None
    secret_key: str = Field(..., min_length=4)
    webhook_secret: Optional[str] = None
    extra_config: Optional[dict[str, Any]] = None


class PaymentPolicyUpdate(BaseModel):
    ai_payment_allowed: bool
    ai_max_amount_cents: Optional[int] = Field(None, ge=100, le=10000000)


class InboxSendCheckoutRequest(BaseModel):
    session_id: str
    amount_cents: int = Field(..., ge=50, le=10000000)
    currency: str = Field("usd", min_length=3, max_length=5)
    title: str = Field(..., min_length=2, max_length=255)
    customer_email: Optional[str] = None
    provider: Optional[str] = None  # stripe, lemonsqueezy, polar, paypal (or default active)
    variant_id: Optional[str] = Field(None, max_length=64)


def _mask_key(key: Optional[str]) -> Optional[str]:
    """Mask sensitive API keys for safe UI display (e.g. sk_test_••••••••1234)."""
    if not key:
        return None
    k = key.strip()
    if len(k) <= 8:
        return "••••••••"
    return f"{k[:7]}••••••••{k[-4:]}"


# --- 1. LIST PAYMENT INTEGRATIONS FOR BOT ---
@router.get("/api/bots/{bot_id}/integrations/payments")
async def get_bot_payment_integrations(
    bot_id: str,
    user: dict[str, Any] = Depends(require_user),
):
    """Retrieve connected payment gateways with safe masked credentials and AI restriction flags."""
    await verify_bot_permission(user, bot_id, required_tab="sources")

    def _fetch():
        return (
            supabase.table("chatty_payment_integrations")
            .select("*")
            .eq("bot_id", bot_id)
            .execute()
        )

    res = await run_db(_fetch)
    rows = {r["provider"]: r for r in (res.data or [])}

    providers_status = {}
    for p in ["stripe", "lemonsqueezy", "polar", "paypal"]:
        row = rows.get(p)
        if row:
            providers_status[p] = {
                "connected": True,
                "is_active": row.get("is_active", True),
                "test_mode": row.get("test_mode", True),
                "publishable_key": row.get("publishable_key"),
                "secret_key_preview": _mask_key(decrypt_secret(row.get("secret_key_encrypted") or "")),
                "webhook_secret_preview": _mask_key(decrypt_secret(row.get("webhook_secret_encrypted") or "")),
                "extra_config": row.get("extra_config") or {},
                "ai_payment_allowed": row.get("ai_payment_allowed", True),
                "ai_max_amount_cents": row.get("ai_max_amount_cents"),
                "last_tested_at": row.get("last_tested_at"),
            }
        else:
            providers_status[p] = {
                "connected": False,
                "is_active": False,
                "test_mode": True,
                "ai_payment_allowed": True,
            }

    # Aggregate AI policy (if any active gateway has ai_payment_allowed = false, global flag is false)
    ai_allowed = all(v.get("ai_payment_allowed", True) for v in providers_status.values() if v.get("connected"))

    return {
        "bot_id": bot_id,
        "providers": providers_status,
        "ai_payment_allowed": ai_allowed,
    }


# --- 1b. FETCH PRODUCTS & PRICING PLANS FROM GATEWAYS ---
@router.get("/api/bots/{bot_id}/integrations/payments/products")
async def list_gateway_products(
    bot_id: str,
    provider: Optional[str] = Query(None, description="stripe, lemonsqueezy, or polar"),
    user: dict[str, Any] = Depends(require_user),
):
    """Fetch active products and price plans from connected payment gateway platforms."""
    try:
        await verify_bot_permission(user, bot_id, required_tab="sources")
    except Exception:
        await verify_bot_permission(user, bot_id, required_tab="conversations")

    def _fetch():
        q = supabase.table("chatty_payment_integrations").select("*").eq("bot_id", bot_id).eq("is_active", True)
        if provider:
            q = q.eq("provider", provider.lower().strip())
        return q.execute()

    res = await run_db(_fetch)
    integrations = res.data or []
    all_products: list[dict[str, Any]] = []

    for row in integrations:
        prov = row["provider"]
        secret = decrypt_secret(row.get("secret_key_encrypted") or "")
        extra = row.get("extra_config") or {}
        if not secret:
            continue

        try:
            if prov == "stripe":
                prods = await PaymentGatewaysService.fetch_stripe_products(secret)
                all_products.extend(prods)
            elif prov == "lemonsqueezy":
                prods = await PaymentGatewaysService.fetch_lemonsqueezy_products(
                    secret, store_id=extra.get("store_id")
                )
                all_products.extend(prods)
            elif prov == "polar":
                prods = await PaymentGatewaysService.fetch_polar_products(
                    secret, organization_id=extra.get("organization_id")
                )
                all_products.extend(prods)
        except Exception as e:
            logger.warning("Error fetching products from %s: %s", prov, e)

    return {
        "bot_id": bot_id,
        "count": len(all_products),
        "products": all_products,
    }


# --- 2. CONNECT PAYMENT GATEWAY (STRIPE, LEMON SQUEEZY, POLAR) ---
@router.post("/api/bots/{bot_id}/integrations/payments/{provider}/connect")
async def connect_payment_gateway(
    bot_id: str,
    provider: str,
    body: PaymentConnectRequest,
    user: dict[str, Any] = Depends(require_user),
):
    """Verify credentials and securely encrypt keys at rest."""
    await verify_bot_permission(user, bot_id, required_tab="sources")
    prov = provider.lower().strip()
    if prov not in {"stripe", "lemonsqueezy", "polar", "paypal"}:
        raise HTTPException(status_code=400, detail="Unsupported payment provider")

    # 1. Live Verification Ping
    test_res: dict[str, Any] = {"valid": False}
    extra = body.extra_config or {}

    try:
        if prov == "stripe":
            test_res = await PaymentGatewaysService.verify_stripe(body.secret_key)
        elif prov == "lemonsqueezy":
            test_res = await PaymentGatewaysService.verify_lemonsqueezy(
                body.secret_key, store_id=extra.get("store_id")
            )
            if test_res.get("store_id"):
                extra["store_id"] = test_res["store_id"]
        elif prov == "paypal":
            if not (body.publishable_key or "").strip():
                raise HTTPException(status_code=400, detail="PayPal requires the REST app Client ID")
            test_res = await PaymentGatewaysService.verify_paypal(
                body.publishable_key, body.secret_key, test_mode=body.test_mode
            )
        elif prov == "polar":
            test_res = await PaymentGatewaysService.verify_polar(
                body.secret_key, organization_id=extra.get("organization_id")
            )
            if test_res.get("organization_id"):
                extra["organization_id"] = test_res["organization_id"]
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        logger.exception("Verification call failed for %s", prov)
        raise HTTPException(status_code=400, detail=f"Failed to connect {prov}. Check your credentials and try again.")

    if not test_res.get("valid"):
        raise HTTPException(
            status_code=400,
            detail=test_res.get("error") or f"Invalid credentials for {prov.capitalize()}",
        )

    # 2. Encrypt Secrets at Rest
    encrypted_secret = encrypt_secret(body.secret_key.strip())
    encrypted_webhook = encrypt_secret(body.webhook_secret.strip()) if body.webhook_secret else None

    row_data = {
        "bot_id": bot_id,
        "provider": prov,
        "is_active": True,
        "test_mode": body.test_mode,
        "publishable_key": body.publishable_key.strip() if body.publishable_key else None,
        "secret_key_encrypted": encrypted_secret,
        "webhook_secret_encrypted": encrypted_webhook,
        "extra_config": extra,
        "last_tested_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    def _upsert():
        return (
            supabase.table("chatty_payment_integrations")
            .upsert(row_data, on_conflict="bot_id,provider")
            .execute()
        )

    await run_db(_upsert)

    return {
        "status": "success",
        "provider": prov,
        "connected": True,
        "verification": test_res,
        "message": f"{prov.capitalize()} successfully connected and verified.",
    }


# --- 3. DISCONNECT PAYMENT GATEWAY ---
@router.delete("/api/bots/{bot_id}/integrations/payments/{provider}")
async def disconnect_payment_gateway(
    bot_id: str,
    provider: str,
    user: dict[str, Any] = Depends(require_user),
):
    """Disconnect and remove payment provider credentials for this bot."""
    await verify_bot_permission(user, bot_id, required_tab="sources")
    prov = provider.lower().strip()

    def _delete():
        return (
            supabase.table("chatty_payment_integrations")
            .delete()
            .eq("bot_id", bot_id)
            .eq("provider", prov)
            .execute()
        )

    await run_db(_delete)
    return {"status": "success", "message": f"{prov.capitalize()} disconnected."}


# --- 4. UPDATE AI AGENT RESTRICTION POLICY ---
@router.patch("/api/bots/{bot_id}/integrations/payments/policy")
async def update_ai_payment_policy(
    bot_id: str,
    body: PaymentPolicyUpdate,
    user: dict[str, Any] = Depends(require_user),
):
    """Configure whether AI agent is permitted to autonomously generate payment checkouts."""
    await verify_bot_permission(user, bot_id, required_tab="sources")

    def _update():
        return (
            supabase.table("chatty_payment_integrations")
            .update({
                "ai_payment_allowed": body.ai_payment_allowed,
                "ai_max_amount_cents": body.ai_max_amount_cents,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            })
            .eq("bot_id", bot_id)
            .execute()
        )

    await run_db(_update)
    return {
        "status": "success",
        "ai_payment_allowed": body.ai_payment_allowed,
        "ai_max_amount_cents": body.ai_max_amount_cents,
    }


# --- 5. HUMAN AGENT INBOX: SEND CUSTOM CHECKOUT LINK ---
@router.post("/api/bots/{bot_id}/inbox/send-checkout")
async def inbox_send_checkout_link(
    bot_id: str,
    body: InboxSendCheckoutRequest,
    user: dict[str, Any] = Depends(require_user),
):
    """Human Agent action to generate and dispatch a secure payment link in the conversation."""
    await verify_bot_permission(user, bot_id, required_tab="conversations")

    # Fetch active integration
    def _fetch_integrations():
        q = supabase.table("chatty_payment_integrations").select("*").eq("bot_id", bot_id).eq("is_active", True)
        if body.provider:
            q = q.eq("provider", body.provider.lower())
        return q.execute()

    res = await run_db(_fetch_integrations)
    if not res.data:
        raise HTTPException(
            status_code=400,
            detail="No active payment gateway connected. Please connect Stripe, PayPal, Lemon Squeezy, or Polar in Integrations.",
        )

    integration = res.data[0]
    prov = integration["provider"]
    secret = decrypt_secret(integration.get("secret_key_encrypted") or "")
    extra = integration.get("extra_config") or {}

    success_url = "https://app.chatty.com/payment/success"
    cancel_url = "https://app.chatty.com/payment/cancel"

    # 1. Industrial Pre-Checkout Lead Hydration
    customer_name: Optional[str] = None
    customer_email: Optional[str] = body.customer_email
    customer_phone: Optional[str] = None
    customer_country: Optional[str] = None
    channel: str = "web"

    sid_str = str(body.session_id or "").strip()
    if sid_str:
        if sid_str.startswith("wa:"): channel = "whatsapp"
        elif sid_str.startswith("tg:"): channel = "telegram"
        elif sid_str.startswith("ig:"): channel = "instagram"
        elif sid_str.startswith("fb:"): channel = "messenger"
        elif sid_str.startswith("sms:"): channel = "sms"
        elif sid_str.startswith("tt:"): channel = "tiktok"

        try:
            lead_res = await run_db(lambda: supabase.table("chatty_leads")
                .select("name, email, phone, country")
                .eq("bot_id", bot_id)
                .eq("session_id", sid_str)
                .limit(1)
                .execute())
            if lead_res and lead_res.data:
                lead_row = lead_res.data[0]
                customer_name = lead_row.get("name")
                customer_email = customer_email or lead_row.get("email")
                customer_phone = lead_row.get("phone")
                customer_country = lead_row.get("country")
        except Exception:
            pass

        try:
            sess_res = await run_db(lambda: supabase.table("chatty_sessions")
                .select("visitor_name, visitor_email, channel, country")
                .eq("bot_id", bot_id)
                .eq("session_id", sid_str)
                .limit(1)
                .execute())
            if sess_res and sess_res.data:
                sess_row = sess_res.data[0]
                customer_name = customer_name or sess_row.get("visitor_name")
                customer_email = customer_email or sess_row.get("visitor_email")
                customer_country = customer_country or sess_row.get("country")
                if sess_row.get("channel"):
                    channel = sess_row.get("channel")
        except Exception:
            pass

    metadata = {
        "bot_id": bot_id,
        "session_id": body.session_id,
        "sent_by": user.get("email") or "human_agent",
        "customer_name": customer_name or "",
        "customer_phone": customer_phone or "",
        "channel": channel,
    }

    try:
        if prov == "stripe":
            checkout_res = await PaymentGatewaysService.create_stripe_checkout(
                secret_key=secret,
                amount_cents=body.amount_cents,
                currency=body.currency,
                title=body.title,
                customer_email=customer_email,
                success_url=success_url,
                cancel_url=cancel_url,
                metadata=metadata,
            )
        elif prov == "paypal":
            checkout_res = await PaymentGatewaysService.create_paypal_checkout(
                client_id=integration.get("publishable_key") or "",
                client_secret=secret,
                test_mode=bool(integration.get("test_mode", True)),
                amount_cents=body.amount_cents,
                currency=body.currency,
                title=body.title,
                customer_email=customer_email,
                success_url=success_url,
                cancel_url=cancel_url,
                metadata=metadata,
            )
        elif prov == "lemonsqueezy":
            variant_id = await PaymentGatewaysService.resolve_lemonsqueezy_variant(
                secret, extra.get("store_id"), body.variant_id
            )
            checkout_res = await PaymentGatewaysService.create_lemonsqueezy_checkout(
                variant_id=variant_id,
                api_key=secret,
                store_id=extra.get("store_id") or "",
                amount_cents=body.amount_cents,
                currency=body.currency,
                title=body.title,
                customer_email=customer_email,
                success_url=success_url,
                metadata=metadata,
            )
        elif prov == "polar":
            checkout_res = await PaymentGatewaysService.create_polar_checkout(
                access_token=secret,
                organization_id=extra.get("organization_id") or "",
                amount_cents=body.amount_cents,
                currency=body.currency,
                title=body.title,
                customer_email=customer_email,
                success_url=success_url,
                metadata=metadata,
            )
        else:
            raise HTTPException(status_code=400, detail="Unsupported provider")
    except HTTPException:
        raise
    except (RuntimeError, ValueError) as e:
        logger.warning("Checkout generation rejected for %s: %s", prov, type(e).__name__)
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        logger.exception("Failed to create checkout link for %s", prov)
        raise HTTPException(status_code=500, detail="Checkout generation failed. Please try again.")

    checkout_url = checkout_res["checkout_url"]

    # Construct the structured rich token for widget display
    token_data = {
        "provider": prov,
        "title": body.title,
        "amount_cents": body.amount_cents,
        "currency": body.currency.upper(),
        "url": checkout_url,
    }
    amount_formatted = f"${(body.amount_cents / 100):.2f} {body.currency.upper()}"
    message_text = (
        f"💳 **{body.title}** ({amount_formatted})\n\n"
        f"Please click below to complete your secure payment via {prov.capitalize()}:\n"
        f"[CHECKOUT_LINK:{json.dumps(token_data)}]"
    )

    # Post message into chatty_conversations as assistant message with human sender
    def _insert_msg():
        return (
            supabase.table("chatty_conversations")
            .insert({
                "bot_id": bot_id,
                "session_id": body.session_id,
                "role": "assistant",
                "content": message_text,
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
            .execute()
        )

    await run_db(_insert_msg)

    # 2. Record Transaction in chatty_orders
    order_record = {
        "bot_id": bot_id,
        "session_id": body.session_id,
        "provider": prov,
        "order_type": "product_checkout" if body.variant_id else "custom_checkout",
        "attributed_to": "human_agent",
        "agent_email": user.get("email") or "human_agent",
        "channel": channel,
        "title": body.title,
        "amount_cents": body.amount_cents,
        "currency": body.currency.upper(),
        "customer_name": customer_name,
        "customer_email": customer_email,
        "customer_phone": customer_phone,
        "customer_country": customer_country,
        "checkout_url": checkout_url,
        "gateway_order_id": checkout_res.get("session_id") or checkout_res.get("order_id") or "",
        "status": "pending",
        "metadata": metadata,
    }
    try:
        await run_db(lambda: supabase.table("chatty_orders").insert(order_record).execute())
    except Exception:
        logger.exception("Non-fatal: failed to record order in chatty_orders")

    # 3. Omnichannel Outbound Dispatch (WhatsApp, Telegram, Instagram, SMS)
    if channel in ("whatsapp", "telegram", "messenger", "instagram", "sms", "tiktok") or sid_str.startswith(("wa:", "tg:", "ig:", "fb:", "sms:", "tt:")):
        channel_msg = (
            f"💳 *{body.title}* ({amount_formatted})\n\n"
            f"Please complete your secure payment via {prov.capitalize()}:\n"
            f"{checkout_url}"
        )
        try:
            recipient_id = sid_str.split(":", 1)[1].strip() if ":" in sid_str else sid_str
            if channel == "whatsapp" or sid_str.startswith("wa:"):
                from app.services import whatsapp_service
                to_phone = recipient_id or customer_phone or ""
                bot_wa_res = await run_db(lambda: supabase.table("chatty_bots").select("whatsapp_phone_number_id, whatsapp_access_token").eq("id", bot_id).limit(1).execute())
                b_wa = bot_wa_res.data[0] if (bot_wa_res and bot_wa_res.data) else {}
                p_id = (b_wa.get("whatsapp_phone_number_id") or "").strip() or whatsapp_service.WHATSAPP_PHONE_NUMBER_ID
                tok = decrypt_secret((b_wa.get("whatsapp_access_token") or "").strip()) or whatsapp_service.WHATSAPP_ACCESS_TOKEN
                if p_id and tok and to_phone:
                    await whatsapp_service.send_whatsapp_message(phone_number_id=p_id, to=to_phone, text=channel_msg, access_token=tok)
            elif channel in ("messenger", "instagram", "telegram", "sms", "tiktok") or sid_str.startswith(("ig:", "fb:", "tg:", "sms:", "tt:")):
                from app.services.omnichannel import (
                    send_outbound_instagram,
                    send_outbound_sms,
                    send_outbound_telegram,
                    send_outbound_tiktok,
                    unpack_omnichannel_bot_row,
                )
                bot_omni_res = await run_db(lambda: supabase.table("chatty_bots").select("*").eq("id", bot_id).limit(1).execute())
                bot_omni = unpack_omnichannel_bot_row(bot_omni_res.data[0]) if (bot_omni_res and bot_omni_res.data) else {}
                if sid_str.startswith("tg:") or channel == "telegram":
                    tok = decrypt_secret(str(bot_omni.get("telegram_bot_token") or ""))
                    if tok and recipient_id:
                        await send_outbound_telegram(bot_token=tok, chat_id=recipient_id, text=channel_msg)
                elif sid_str.startswith("sms:") or channel == "sms":
                    sid_tw = str(bot_omni.get("twilio_account_sid") or "")
                    tok_tw = decrypt_secret(str(bot_omni.get("twilio_auth_token") or ""))
                    from_tw = str(bot_omni.get("twilio_phone_number") or "")
                    if sid_tw and tok_tw and from_tw and recipient_id:
                        await send_outbound_sms(account_sid=sid_tw, auth_token=tok_tw, from_number=from_tw, to_number=recipient_id, text=channel_msg)
                elif sid_str.startswith("ig:") or channel == "instagram":
                    tok = decrypt_secret(str(bot_omni.get("instagram_access_token") or ""))
                    if tok and recipient_id:
                        await send_outbound_instagram(page_access_token=tok, recipient_id=recipient_id, text=channel_msg)
        except Exception:
            logger.warning("Non-fatal: failed to dispatch checkout link to channel %s", channel, exc_info=True)

    return {
        "status": "success",
        "provider": prov,
        "checkout_url": checkout_url,
        "amount_formatted": amount_formatted,
        "token_data": token_data,
    }


# --- 6. ORDERS & SALES TRANSACTIONS MANAGEMENT ---
@router.get("/api/bots/{bot_id}/orders")
async def list_bot_orders(
    bot_id: str,
    status: Optional[str] = Query(None, description="succeeded, pending, refunded, failed"),
    provider: Optional[str] = Query(None, description="stripe, paypal, lemonsqueezy, polar"),
    attributed_to: Optional[str] = Query(None, description="ai_agent, human_agent"),
    search: Optional[str] = Query(None, description="Search customer name, email, or title"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user: dict[str, Any] = Depends(require_user),
):
    """Retrieve full audit record of customer transactions, revenue KPIs, and attribution."""
    await verify_bot_permission(user, bot_id, required_tab="conversations")

    status_val = status if isinstance(status, str) else None
    provider_val = provider if isinstance(provider, str) else None
    attributed_val = attributed_to if isinstance(attributed_to, str) else None
    search_val = search if isinstance(search, str) else None
    limit_val = limit if isinstance(limit, int) else 50
    offset_val = offset if isinstance(offset, int) else 0

    def _query():
        q = supabase.table("chatty_orders").select("*", count="exact").eq("bot_id", bot_id)
        if status_val and status_val.lower() != "all":
            q = q.eq("status", status_val.lower())
        if provider_val and provider_val.lower() != "all":
            q = q.eq("provider", provider_val.lower())
        if attributed_val and attributed_val.lower() != "all":
            q = q.eq("attributed_to", attributed_val.lower())
        if search_val and search_val.strip():
            s = search_val.strip()
            q = q.ilike("title", f"%{s}%")
        q = q.order("created_at", desc=True).range(offset_val, offset_val + limit_val - 1)
        return q.execute()

    res = await run_db(_query)
    orders = res.data or []
    total_count = res.count if hasattr(res, "count") and res.count is not None else len(orders)

    def _kpis():
        return supabase.table("chatty_orders").select("amount_cents, status, attributed_to, currency").eq("bot_id", bot_id).execute()

    kpi_res = await run_db(_kpis)
    all_records = kpi_res.data or []

    total_revenue_cents = sum(r.get("amount_cents", 0) for r in all_records if r.get("status") == "succeeded")
    pending_revenue_cents = sum(r.get("amount_cents", 0) for r in all_records if r.get("status") == "pending")
    ai_revenue_cents = sum(r.get("amount_cents", 0) for r in all_records if r.get("status") == "succeeded" and r.get("attributed_to") == "ai_agent")
    human_revenue_cents = sum(r.get("amount_cents", 0) for r in all_records if r.get("status") == "succeeded" and r.get("attributed_to") == "human_agent")
    total_succeeded_count = sum(1 for r in all_records if r.get("status") == "succeeded")

    return {
        "orders": orders,
        "total_count": total_count,
        "kpis": {
            "total_revenue_cents": total_revenue_cents,
            "pending_revenue_cents": pending_revenue_cents,
            "ai_revenue_cents": ai_revenue_cents,
            "human_revenue_cents": human_revenue_cents,
            "total_orders": len(all_records),
            "succeeded_orders": total_succeeded_count,
        },
    }


@router.post("/api/bots/{bot_id}/orders/{order_id}/status")
async def update_order_status(
    bot_id: str,
    order_id: str,
    body: dict[str, Any],
    user: dict[str, Any] = Depends(require_user),
):
    """Manually update or refund order status."""
    await verify_bot_permission(user, bot_id, required_tab="conversations")
    new_status = body.get("status", "").lower()
    if new_status not in {"pending", "succeeded", "failed", "refunded", "cancelled"}:
        raise HTTPException(status_code=400, detail="Invalid status")

    update_payload = {"status": new_status, "updated_at": datetime.now(timezone.utc).isoformat()}
    if new_status == "succeeded":
        update_payload["paid_at"] = datetime.now(timezone.utc).isoformat()

    def _update():
        return supabase.table("chatty_orders").update(update_payload).eq("bot_id", bot_id).eq("id", order_id).execute()

    res = await run_db(_update)
    if not res.data:
        raise HTTPException(status_code=404, detail="Order not found")
    return {"status": "success", "order": res.data[0]}
