"""Payment Integrations Router (/api/bots/{bot_id}/integrations/payments/* & /api/bots/{bot_id}/inbox/send-checkout)."""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any, Optional
import hashlib
import hmac
import html as _html
import os
import uuid
from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field
from app.services.order_email_service import render_order_status_email, send_order_notification_emails

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
    ai_payment_instructions: Optional[str] = Field(None, max_length=5000)
    email_config: Optional[dict[str, Any]] = None


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
    await verify_bot_permission(bot_id, user, "integrations")

    def _fetch():
        return (
            supabase.table("chatty_payment_integrations")
            .select("*")
            .eq("bot_id", bot_id)
            .execute()
        )

    res = await run_db(_fetch)
    rows = {r["provider"]: r for r in (res.data or [])}

    backend_base = os.environ.get("CHATTY_BACKEND_URL", "https://api.chatty.personaliai.com").rstrip("/")
    providers_status = {}
    for p in ["stripe", "lemonsqueezy", "polar", "paypal"]:
        wh_url = f"{backend_base}/api/bots/{bot_id}/webhooks/payments/{p}"
        row = rows.get(p)
        if row:
            ec = row.get("extra_config") or {}
            providers_status[p] = {
                "connected": True,
                "is_active": row.get("is_active", True),
                "test_mode": row.get("test_mode", True),
                "publishable_key": row.get("publishable_key"),
                "secret_key_preview": _mask_key(decrypt_secret(row.get("secret_key_encrypted") or "")),
                "webhook_secret_preview": _mask_key(decrypt_secret(row.get("webhook_secret_encrypted") or "")),
                "webhook_url": wh_url,
                "webhook_auto_configured": bool(ec.get("webhook_auto_configured")),
                "webhook_id": ec.get("webhook_id"),
                "extra_config": ec,
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
                "webhook_url": wh_url,
                "webhook_auto_configured": False,
            }

    # Aggregate AI policy (if any active gateway has ai_payment_allowed = false, global flag is false)
    ai_allowed = all(v.get("ai_payment_allowed", True) for v in providers_status.values() if v.get("connected"))

    # Extract payment directives, max amount limit, and email_config across connected gateways
    ai_instructions = ""
    ai_max_cents = None
    email_config: dict[str, Any] = {
        "email_notifications_enabled": True,
        "send_owner_sale_alert": True,
        "receipt_brand_color": "#f97316",
        "receipt_custom_message": "Thank you for your business! If you need any assistance with your order, reply to this email or message us in chat.",
        "receipt_support_email": user.get("email") or "support@personaliai.com",
    }
    for p, pdata in providers_status.items():
        if pdata.get("connected"):
            ec = pdata.get("extra_config") or {}
            if ec.get("ai_payment_instructions") and not ai_instructions:
                ai_instructions = ec["ai_payment_instructions"]
            if pdata.get("ai_max_amount_cents") and not ai_max_cents:
                ai_max_cents = pdata["ai_max_amount_cents"]
            if isinstance(ec.get("email_config"), dict):
                email_config.update(ec["email_config"])

    return {
        "bot_id": bot_id,
        "providers": providers_status,
        "ai_payment_allowed": ai_allowed,
        "ai_max_amount_cents": ai_max_cents,
        "ai_payment_instructions": ai_instructions,
        "email_config": email_config,
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
        await verify_bot_permission(bot_id, user, "integrations")
    except Exception:
        await verify_bot_permission(bot_id, user, "orders")

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
    await verify_bot_permission(bot_id, user, "integrations")
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
                body.secret_key,
                organization_id=extra.get("organization_id"),
                test_mode=body.test_mode,
            )
            if test_res.get("organization_id"):
                extra["organization_id"] = test_res["organization_id"]
            if test_res.get("detected_environment") == "live" and body.test_mode:
                # Token is live, auto-adjust mode to live so checkouts work seamlessly
                body.test_mode = False
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

    # 2. Auto-Register Webhook on Provider if possible
    backend_base = os.environ.get("CHATTY_BACKEND_URL", "https://api.chatty.personaliai.com").rstrip("/")
    webhook_url = f"{backend_base}/api/bots/{bot_id}/webhooks/payments/{prov}"
    wh_res = await PaymentGatewaysService.auto_register_webhook(
        provider=prov,
        secret_key=body.secret_key.strip(),
        webhook_url=webhook_url,
        test_mode=body.test_mode,
        publishable_key=body.publishable_key.strip() if body.publishable_key else None,
        extra_config=extra,
    )
    resolved_wh_secret = (body.webhook_secret or "").strip() or (wh_res.get("webhook_secret") or "").strip()
    extra["webhook_auto_configured"] = bool(wh_res.get("registered"))
    if wh_res.get("webhook_id"):
        extra["webhook_id"] = wh_res["webhook_id"]
    if wh_res.get("reason") and not wh_res.get("registered"):
        extra["webhook_note"] = wh_res["reason"]

    # 3. Encrypt Secrets at Rest
    encrypted_secret = encrypt_secret(body.secret_key.strip())
    encrypted_webhook = encrypt_secret(resolved_wh_secret) if resolved_wh_secret else None

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
        "webhook_url": webhook_url,
        "webhook_auto_configured": bool(wh_res.get("registered")),
        "webhook_id": wh_res.get("webhook_id"),
        "message": f"{prov.capitalize()} connected! " + (
            "Webhook auto-configured." if wh_res.get("registered") else "You can also copy the Webhook URL below for manual setup."
        ),
    }


@router.post("/api/bots/{bot_id}/integrations/payments/{provider}/register-webhook")
async def register_payment_webhook_endpoint(
    bot_id: str,
    provider: str,
    user: dict[str, Any] = Depends(require_user),
):
    """Trigger automatic webhook registration for an already-connected payment gateway."""
    await verify_bot_permission(bot_id, user, "integrations")
    prov = provider.lower().strip()

    res = await run_db(
        lambda: supabase.table("chatty_payment_integrations")
        .select("*")
        .eq("bot_id", bot_id)
        .eq("provider", prov)
        .limit(1)
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail=f"{prov.capitalize()} is not connected.")

    row = res.data[0]
    secret_key = decrypt_secret(row.get("secret_key_encrypted") or "")
    extra = row.get("extra_config") or {}
    backend_base = os.environ.get("CHATTY_BACKEND_URL", "https://api.chatty.personaliai.com").rstrip("/")
    webhook_url = f"{backend_base}/api/bots/{bot_id}/webhooks/payments/{prov}"

    wh_res = await PaymentGatewaysService.auto_register_webhook(
        provider=prov,
        secret_key=secret_key,
        webhook_url=webhook_url,
        test_mode=bool(row.get("test_mode", True)),
        publishable_key=row.get("publishable_key"),
        extra_config=extra,
    )
    extra["webhook_auto_configured"] = bool(wh_res.get("registered"))
    if wh_res.get("webhook_id"):
        extra["webhook_id"] = wh_res["webhook_id"]

    upd: dict[str, Any] = {
        "extra_config": extra,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    if wh_res.get("webhook_secret"):
        upd["webhook_secret_encrypted"] = encrypt_secret(wh_res["webhook_secret"])

    await run_db(lambda: supabase.table("chatty_payment_integrations").update(upd).eq("id", row["id"]).execute())

    return {
        "status": "success" if wh_res.get("registered") else "manual_required",
        "registered": bool(wh_res.get("registered")),
        "webhook_url": webhook_url,
        "webhook_id": wh_res.get("webhook_id"),
        "reason": wh_res.get("reason"),
    }


# --- 3. DISCONNECT PAYMENT GATEWAY ---
@router.delete("/api/bots/{bot_id}/integrations/payments/{provider}")
async def disconnect_payment_gateway(
    bot_id: str,
    provider: str,
    user: dict[str, Any] = Depends(require_user),
):
    """Disconnect and remove payment provider credentials for this bot."""
    await verify_bot_permission(bot_id, user, "integrations")
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


# --- 4. UPDATE AI AGENT RESTRICTION POLICY & DIRECTIVES ---
@router.patch("/api/bots/{bot_id}/integrations/payments/policy")
async def update_ai_payment_policy(
    bot_id: str,
    body: PaymentPolicyUpdate,
    user: dict[str, Any] = Depends(require_user),
):
    """Configure whether AI agent is permitted to autonomously generate payment checkouts and set checkout directives."""
    await verify_bot_permission(bot_id, user, "integrations")

    def _fetch():
        return (
            supabase.table("chatty_payment_integrations")
            .select("id, extra_config")
            .eq("bot_id", bot_id)
            .execute()
        )

    res = await run_db(_fetch)
    rows = res.data or []
    for r in rows:
        ec = r.get("extra_config") or {}
        if body.ai_payment_instructions is not None:
            ec["ai_payment_instructions"] = body.ai_payment_instructions.strip()
        if body.email_config is not None:
            curr_ec_mail = ec.get("email_config") if isinstance(ec.get("email_config"), dict) else {}
            curr_ec_mail.update(body.email_config)
            ec["email_config"] = curr_ec_mail

        await run_db(
            lambda r_id=r["id"], r_ec=ec: supabase.table("chatty_payment_integrations")
            .update({
                "ai_payment_allowed": body.ai_payment_allowed,
                "ai_max_amount_cents": body.ai_max_amount_cents,
                "extra_config": r_ec,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            })
            .eq("id", r_id)
            .execute()
        )

    return {
        "status": "success",
        "ai_payment_allowed": body.ai_payment_allowed,
        "ai_max_amount_cents": body.ai_max_amount_cents,
        "ai_payment_instructions": body.ai_payment_instructions,
    }


# --- 5. HUMAN AGENT INBOX: SEND CUSTOM CHECKOUT LINK ---
@router.post("/api/bots/{bot_id}/inbox/send-checkout")
async def inbox_send_checkout_link(
    bot_id: str,
    body: InboxSendCheckoutRequest,
    user: dict[str, Any] = Depends(require_user),
):
    """Human Agent action to generate and dispatch a secure payment link in the conversation."""
    await verify_bot_permission(bot_id, user, "orders")

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

    order_id = str(uuid.uuid4())
    backend_base = os.environ.get("CHATTY_BACKEND_URL", "https://api.chatty.personaliai.com").rstrip("/")
    success_url = f"{backend_base}/api/bots/{bot_id}/payments/return?status=success&order_id={order_id}&provider={prov}"
    cancel_url = f"{backend_base}/api/bots/{bot_id}/payments/return?status=cancel&order_id={order_id}&provider={prov}"

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
        "order_id": order_id,
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
                product_id=body.variant_id,
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
        "id": order_id,
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
    await verify_bot_permission(bot_id, user, "orders")

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
            s = search_val.strip().replace(",", " ")
            if hasattr(q, "or_"):
                q = q.or_(
                    f"title.ilike.%{s}%,customer_name.ilike.%{s}%,customer_email.ilike.%{s}%,gateway_order_id.ilike.%{s}%"
                )
            else:
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


async def _get_bot_email_context(bot_id: str) -> tuple[str, dict[str, Any], Optional[str]]:
    """Load bot name, email_config from payment integrations, and owner email."""
    bot_name = "Chatty Store"
    owner_email = None
    email_config: dict[str, Any] = {"email_notifications_enabled": True, "send_owner_sale_alert": True}
    try:
        b_res = await run_db(lambda: supabase.table("chatty_bots").select("name, user_id").eq("id", bot_id).limit(1).execute())
        if b_res and b_res.data:
            bot_name = b_res.data[0].get("name") or bot_name
            uid = b_res.data[0].get("user_id")
            if uid:
                u_res = await run_db(lambda: supabase.table("users").select("email").eq("auth_user_id", uid).limit(1).execute())
                if u_res and u_res.data:
                    owner_email = u_res.data[0].get("email")
        pi_res = await run_db(lambda: supabase.table("chatty_payment_integrations").select("extra_config").eq("bot_id", bot_id).execute())
        for r in (pi_res.data or []):
            ec = r.get("extra_config") or {}
            if isinstance(ec.get("email_config"), dict):
                email_config.update(ec["email_config"])
    except Exception:
        logger.warning("Non-fatal: failed to load bot email context for %s", bot_id)
    return bot_name, email_config, owner_email


@router.post("/api/bots/{bot_id}/orders/{order_id}/status")
async def update_order_status(
    bot_id: str,
    order_id: str,
    body: dict[str, Any],
    user: dict[str, Any] = Depends(require_user),
):
    """Manually update or refund order status and automatically send customer notification email."""
    await verify_bot_permission(bot_id, user, "orders")
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

    order_row = res.data[0]
    email_res = {"customer_email_sent": False}
    if body.get("send_email", True):
        bot_name, email_cfg, owner_email = await _get_bot_email_context(bot_id)
        email_res = await send_order_notification_emails(
            order=order_row,
            bot_name=bot_name,
            email_config=email_cfg,
            owner_email=owner_email,
        )

    return {"status": "success", "order": order_row, "email_delivery": email_res}


@router.post("/api/bots/{bot_id}/orders/{order_id}/send-email")
async def send_order_email_manual(
    bot_id: str,
    order_id: str,
    body: Optional[dict[str, Any]] = None,
    user: dict[str, Any] = Depends(require_user),
):
    """Manually send or resend the receipt / status update email to the customer."""
    await verify_bot_permission(bot_id, user, "orders")
    res = await run_db(
        lambda: supabase.table("chatty_orders").select("*").eq("bot_id", bot_id).eq("id", order_id).limit(1).execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="Order not found")

    order_row = dict(res.data[0])
    override_email = (body or {}).get("customer_email")
    if override_email:
        order_row["customer_email"] = str(override_email).strip()

    if not order_row.get("customer_email"):
        raise HTTPException(status_code=400, detail="Order does not have a customer email address.")

    bot_name, email_cfg, owner_email = await _get_bot_email_context(bot_id)
    email_res = await send_order_notification_emails(
        order=order_row,
        bot_name=bot_name,
        email_config=email_cfg,
        owner_email=None,
        force_send=True,
    )
    return {
        "status": "success",
        "sent": email_res.get("customer_email_sent", False),
        "recipient": order_row.get("customer_email"),
        "delivery": email_res,
    }


@router.post("/api/bots/{bot_id}/orders/preview-email")
async def preview_order_email_template(
    bot_id: str,
    body: dict[str, Any],
    user: dict[str, Any] = Depends(require_user),
):
    """Render live HTML preview of the customer order receipt/status email template."""
    await verify_bot_permission(bot_id, user, "orders")
    bot_name, saved_cfg, _ = await _get_bot_email_context(bot_id)
    merged_cfg = {**saved_cfg, **(body.get("email_config") or {})}
    sample_order = {
        "id": "ord_preview_98412",
        "gateway_order_id": "ch_3Q9xLm2eZvKYlo2C0192",
        "title": body.get("title") or "Enterprise AI Strategy Session & Pro Plan",
        "amount_cents": int(body.get("amount_cents") or 14900),
        "currency": body.get("currency") or "USD",
        "provider": body.get("provider") or "polar",
        "status": body.get("status") or "succeeded",
        "customer_name": body.get("customer_name") or "Alex Rivera",
        "customer_email": body.get("customer_email") or "alex.rivera@acme.io",
        "checkout_url": "https://chatty.personaliai.com",
    }
    subject, html_body = render_order_status_email(sample_order, bot_name=bot_name, email_config=merged_cfg)
    return {"subject": subject, "html": html_body}


# --- 7. PUBLIC INBOUND PAYMENT GATEWAY WEBHOOK RECEIVER ---
@router.post("/api/bots/{bot_id}/webhooks/payments/{provider}")
async def receive_payment_gateway_webhook(
    bot_id: str,
    provider: str,
    request: Request,
):
    """Receive real-time payment events from Stripe, Polar.sh, Lemon Squeezy, and PayPal.
    Updates chatty_orders, confirms paid bookings, posts chat confirmation, and dispatches receipt emails."""
    prov = provider.lower().strip()
    raw_body = await request.body()

    try:
        payload = json.loads(raw_body.decode("utf-8")) if raw_body else {}
    except Exception:
        payload = {}

    # Fetch integration to check webhook secret if configured
    pi_res = await run_db(
        lambda: supabase.table("chatty_payment_integrations")
        .select("*")
        .eq("bot_id", bot_id)
        .eq("provider", prov)
        .limit(1)
        .execute()
    )
    integration = pi_res.data[0] if (pi_res and pi_res.data) else {}
    wh_secret = decrypt_secret(integration.get("webhook_secret_encrypted") or "") if integration else ""

    # Verify HMAC signature when secret is present
    if wh_secret:
        if prov == "lemonsqueezy":
            sig = request.headers.get("x-signature", "")
            if sig:
                expected = hmac.new(wh_secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()
                if not hmac.compare_digest(expected, sig):
                    raise HTTPException(status_code=401, detail="Invalid Lemon Squeezy webhook signature")
        elif prov == "stripe":
            sig_header = request.headers.get("stripe-signature", "")
            if sig_header and "v1=" in sig_header:
                parts = dict(item.split("=", 1) for item in sig_header.split(",") if "=" in item)
                ts = parts.get("t", "")
                v1 = parts.get("v1", "")
                signed_payload = f"{ts}.{raw_body.decode('utf-8', errors='replace')}".encode("utf-8")
                expected = hmac.new(wh_secret.encode("utf-8"), signed_payload, hashlib.sha256).hexdigest()
                if v1 and not hmac.compare_digest(expected, v1):
                    raise HTTPException(status_code=401, detail="Invalid Stripe webhook signature")

    # Normalize event across Stripe, Polar.sh, Lemon Squeezy, PayPal
    event_type = ""
    target_status: Optional[str] = None
    gateway_order_id = ""
    customer_email = ""
    customer_name = ""
    amount_cents = 0
    currency = "USD"
    title = "Order Payment"
    meta: dict[str, Any] = {}

    if prov == "stripe":
        event_type = str(payload.get("type") or "")
        obj = (payload.get("data") or {}).get("object") or {}
        gateway_order_id = str(obj.get("id") or obj.get("payment_intent") or "")
        meta = obj.get("metadata") or {}
        customer_email = str(obj.get("customer_email") or (obj.get("customer_details") or {}).get("email") or meta.get("customer_email") or "")
        customer_name = str((obj.get("customer_details") or {}).get("name") or meta.get("customer_name") or "")
        amount_cents = int(obj.get("amount_total") or obj.get("amount") or 0)
        currency = str(obj.get("currency") or "USD").upper()
        if event_type in ("checkout.session.completed", "payment_intent.succeeded", "charge.succeeded"):
            target_status = "succeeded"
        elif event_type in ("charge.refunded", "charge.dispute.created"):
            target_status = "refunded"
        elif event_type in ("payment_intent.payment_failed", "checkout.session.expired"):
            target_status = "failed"

    elif prov == "polar":
        event_type = str(payload.get("type") or "")
        obj = payload.get("data") or {}
        gateway_order_id = str(obj.get("id") or obj.get("checkout_id") or "")
        meta = obj.get("metadata") or {}
        customer_email = str(obj.get("customer_email") or (obj.get("customer") or {}).get("email") or (obj.get("user") or {}).get("email") or "")
        customer_name = str(obj.get("customer_name") or (obj.get("customer") or {}).get("name") or meta.get("customer_name") or "")
        amount_cents = int(obj.get("amount") or obj.get("total_amount") or 0)
        currency = str(obj.get("currency") or "USD").upper()
        title = str((obj.get("product") or {}).get("name") or obj.get("product_name") or title)
        polar_status = str(obj.get("status") or "").lower()
        if event_type in ("order.created", "order.paid", "subscription.created", "subscription.active") or (
            event_type == "checkout.updated" and polar_status in ("succeeded", "confirmed")
        ):
            target_status = "succeeded"
        elif event_type in ("refund.created", "order.refunded") or polar_status == "refunded":
            target_status = "refunded"
        elif polar_status in ("failed", "expired"):
            target_status = "failed"

    elif prov == "lemonsqueezy":
        meta_root = payload.get("meta") or {}
        event_type = str(meta_root.get("event_name") or "")
        meta = meta_root.get("custom_data") or {}
        data_obj = payload.get("data") or {}
        gateway_order_id = str(data_obj.get("id") or "")
        attrs = data_obj.get("attributes") or {}
        customer_email = str(attrs.get("user_email") or "")
        customer_name = str(attrs.get("user_name") or meta.get("customer_name") or "")
        amount_cents = int(attrs.get("total") or attrs.get("subtotal") or 0)
        currency = str(attrs.get("currency") or "USD").upper()
        title = str((attrs.get("first_order_item") or {}).get("product_name") or title)
        if event_type in ("order_created", "subscription_payment_success"):
            target_status = "succeeded"
        elif event_type == "order_refunded":
            target_status = "refunded"

    elif prov == "paypal":
        event_type = str(payload.get("event_type") or "")
        res_obj = payload.get("resource") or {}
        gateway_order_id = str(res_obj.get("id") or "")
        payer = res_obj.get("payer") or {}
        customer_email = str(payer.get("email_address") or "")
        payer_name = payer.get("name") or {}
        customer_name = f"{payer_name.get('given_name', '')} {payer_name.get('surname', '')}".strip()
        pu_list = res_obj.get("purchase_units") or []
        if pu_list:
            amt_obj = pu_list[0].get("amount") or {}
            try:
                amount_cents = int(round(float(amt_obj.get("value") or 0) * 100))
            except Exception:
                amount_cents = 0
            currency = str(amt_obj.get("currency_code") or "USD").upper()
            title = str(pu_list[0].get("description") or title)
            if pu_list[0].get("custom_id"):
                meta["session_id"] = pu_list[0]["custom_id"]
        if event_type in ("CHECKOUT.ORDER.APPROVED", "PAYMENT.CAPTURE.COMPLETED"):
            target_status = "succeeded"
        elif event_type == "PAYMENT.CAPTURE.REFUNDED":
            target_status = "refunded"
        elif event_type in ("PAYMENT.CAPTURE.DENIED", "PAYMENT.CAPTURE.DECLINED"):
            target_status = "failed"

    if not target_status:
        return {"status": "ignored", "event_type": event_type}

    # Find matching order in chatty_orders by order_id, gateway_order_id, or session_id
    matched_order = None
    meta_order_id = str(meta.get("order_id") or "").strip()
    if meta_order_id:
        o_res = await run_db(
            lambda: supabase.table("chatty_orders")
            .select("*")
            .eq("bot_id", bot_id)
            .eq("id", meta_order_id)
            .limit(1)
            .execute()
        )
        if o_res and o_res.data:
            matched_order = o_res.data[0]

    if not matched_order and gateway_order_id:
        o_res = await run_db(
            lambda: supabase.table("chatty_orders")
            .select("*")
            .eq("bot_id", bot_id)
            .eq("gateway_order_id", gateway_order_id)
            .limit(1)
            .execute()
        )
        if o_res and o_res.data:
            matched_order = o_res.data[0]

    session_id = str(meta.get("session_id") or "")
    if not matched_order and session_id:
        o_res = await run_db(
            lambda: supabase.table("chatty_orders")
            .select("*")
            .eq("bot_id", bot_id)
            .eq("session_id", session_id)
            .eq("status", "pending")
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        if o_res and o_res.data:
            matched_order = o_res.data[0]

    # Idempotency guard: if order was already processed & notified for this exact status, skip duplicate emails/messages
    existing_meta = dict((matched_order or {}).get("metadata") or {})
    if (
        matched_order is not None
        and matched_order.get("status") == target_status
        and existing_meta.get("notified_status") == target_status
    ):
        return {
            "status": "ok",
            "order_status": target_status,
            "order_id": matched_order.get("id"),
            "deduplicated": True,
        }

    now_iso = datetime.now(timezone.utc).isoformat()
    merged_meta = {**existing_meta, **meta, "notified_status": target_status}
    if matched_order:
        upd_fields: dict[str, Any] = {
            "status": target_status,
            "updated_at": now_iso,
            "metadata": merged_meta,
        }
        if target_status == "succeeded":
            upd_fields["paid_at"] = now_iso
        if gateway_order_id and not matched_order.get("gateway_order_id"):
            upd_fields["gateway_order_id"] = gateway_order_id
        if customer_email and not matched_order.get("customer_email"):
            upd_fields["customer_email"] = customer_email
        if customer_name and not matched_order.get("customer_name"):
            upd_fields["customer_name"] = customer_name

        u_res = await run_db(
            lambda: supabase.table("chatty_orders")
            .update(upd_fields)
            .eq("id", matched_order["id"])
            .execute()
        )
        order_record = u_res.data[0] if (u_res and u_res.data) else {**matched_order, **upd_fields}
    else:
        new_order = {
            "bot_id": bot_id,
            "session_id": session_id or None,
            "provider": prov,
            "order_type": "booking_deposit" if meta.get("meeting_id") else "product_checkout",
            "attributed_to": "ai_agent" if meta.get("caller") == "ai" or not meta.get("sent_by") else "human_agent",
            "channel": meta.get("channel") or "web",
            "title": title,
            "amount_cents": amount_cents,
            "currency": currency,
            "customer_name": customer_name or None,
            "customer_email": customer_email or None,
            "gateway_order_id": gateway_order_id,
            "status": target_status,
            "paid_at": now_iso if target_status == "succeeded" else None,
            "metadata": merged_meta,
        }
        ins_res = await run_db(lambda: supabase.table("chatty_orders").insert(new_order).execute())
        order_record = ins_res.data[0] if (ins_res and ins_res.data) else new_order

    # Confirm paid appointment booking if meeting_id is present
    meeting_id = merged_meta.get("meeting_id") or (order_record.get("metadata") or {}).get("meeting_id")
    if meeting_id and target_status == "succeeded":
        try:
            from app.services.booking.payment_service import BookingPaymentService
            pay_svc = BookingPaymentService(supabase, run_db)
            await pay_svc.handle_payment_completed(
                meeting_id=str(meeting_id),
                payment_intent_id=gateway_order_id or str(order_record.get("id")),
                amount_cents=int(order_record.get("amount_cents") or amount_cents),
            )
        except Exception:
            logger.exception("Failed to confirm meeting %s on payment webhook", meeting_id)

    # Post confirmation message in conversation thread if session_id is known
    eff_session_id = str(order_record.get("session_id") or session_id or "").strip()
    if eff_session_id and target_status in ("succeeded", "refunded"):
        amt_str = f"${(int(order_record.get('amount_cents') or 0) / 100):.2f} {order_record.get('currency', 'USD')}"
        if target_status == "succeeded":
            chat_msg = (
                f"✅ **Payment Confirmed!** Thank you for your purchase of **{order_record.get('title', 'Order')}** "
                f"({amt_str}) via {prov.capitalize()}. A confirmation receipt has been sent to your email."
            )
        else:
            chat_msg = (
                f"🔄 **Refund Processed:** Your refund of {amt_str} for **{order_record.get('title', 'Order')}** "
                f"has been initiated via {prov.capitalize()}."
            )
        try:
            await run_db(
                lambda: supabase.table("chatty_conversations")
                .insert({
                    "bot_id": bot_id,
                    "session_id": eff_session_id,
                    "role": "assistant",
                    "content": chat_msg,
                    "created_at": now_iso,
                })
                .execute()
            )
        except Exception:
            logger.warning("Non-fatal: failed to insert payment confirmation chat message")

    # Send Customer Receipt / Status Update Email & Owner Sale Alert
    bot_name, email_cfg, owner_email = await _get_bot_email_context(bot_id)
    email_res = await send_order_notification_emails(
        order=order_record,
        bot_name=bot_name,
        email_config=email_cfg,
        owner_email=owner_email,
    )

    return {
        "status": "ok",
        "order_status": target_status,
        "order_id": order_record.get("id"),
        "email_delivery": email_res,
    }


# --- 8. PUBLIC CUSTOMER CHECKOUT RETURN / RECEIPT LANDING ENDPOINT ---
@router.get("/api/bots/{bot_id}/payments/return", response_class=HTMLResponse)
async def handle_payment_return_redirect(
    bot_id: str,
    status: str = Query("success"),
    order_id: Optional[str] = Query(None),
    provider: Optional[str] = Query(None),
    token: Optional[str] = Query(None),  # PayPal order ID query param on return
    session_id: Optional[str] = Query(None),
    checkout_id: Optional[str] = Query(None),
):
    """Customer-facing return endpoint after completing or cancelling hosted checkout.
    Captures PayPal orders if needed, confirms pending orders & bookings idempotently,
    sends customer receipt email, and renders a mobile-responsive receipt page."""
    prov = (provider or "stripe").lower().strip()
    is_cancel = status.lower().strip() in ("cancel", "cancelled", "failed")

    matched_order = None
    if order_id:
        o_res = await run_db(
            lambda: supabase.table("chatty_orders")
            .select("*")
            .eq("bot_id", bot_id)
            .eq("id", order_id)
            .limit(1)
            .execute()
        )
        if o_res and o_res.data:
            matched_order = o_res.data[0]

    gw_lookup = token or checkout_id or session_id
    if not matched_order and gw_lookup:
        o_res = await run_db(
            lambda: supabase.table("chatty_orders")
            .select("*")
            .eq("bot_id", bot_id)
            .eq("gateway_order_id", str(gw_lookup))
            .limit(1)
            .execute()
        )
        if o_res and o_res.data:
            matched_order = o_res.data[0]

    bot_name, email_cfg, owner_email = await _get_bot_email_context(bot_id)
    brand_color = str(email_cfg.get("receipt_brand_color") or "#f97316").strip()

    if is_cancel:
        retry_url = (matched_order or {}).get("checkout_url") or "https://chatty.personaliai.com"
        item_title = _html.escape(str((matched_order or {}).get("title") or "Your Order"))
        cancel_html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Checkout Cancelled — {_html.escape(bot_name)}</title>
</head>
<body style="margin:0;padding:32px 16px;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;">
  <div style="max-width:480px;margin:40px auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:32px;text-align:center;box-shadow:0 4px 20px rgba(15,23,42,0.06);">
    <div style="width:48px;height:48px;border-radius:12px;background:#fef2f2;color:#ef4444;display:inline-flex;align-items:center;justify-content:center;font-size:22px;font-weight:700;margin-bottom:16px;">✕</div>
    <h1 style="margin:0 0 8px 0;font-size:20px;font-weight:800;">Payment Not Completed</h1>
    <p style="margin:0 0 24px 0;font-size:14px;line-height:1.6;color:#475569;">
      No charge was made for <strong>{item_title}</strong>. You can return to the chat window or retry your secure checkout anytime.
    </p>
    <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;">
      <a href="{_html.escape(retry_url)}" style="display:inline-block;padding:12px 22px;background:{_html.escape(brand_color)};color:#ffffff;text-decoration:none;border-radius:10px;font-size:14px;font-weight:700;">Retry Checkout</a>
      <button onclick="window.close()" style="padding:12px 22px;background:#f1f5f9;color:#334155;border:1px solid #cbd5e1;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;">Close Window</button>
    </div>
  </div>
</body>
</html>"""
        return HTMLResponse(content=cancel_html, status_code=200)

    # If PayPal order return, capture the approved order automatically
    if prov == "paypal" and (token or (matched_order and matched_order.get("gateway_order_id"))):
        pp_order_id = token or matched_order.get("gateway_order_id")
        try:
            pi_res = await run_db(
                lambda: supabase.table("chatty_payment_integrations")
                .select("*")
                .eq("bot_id", bot_id)
                .eq("provider", "paypal")
                .limit(1)
                .execute()
            )
            if pi_res and pi_res.data:
                pi_row = pi_res.data[0]
                pp_secret = decrypt_secret(pi_row.get("secret_key_encrypted") or "")
                await PaymentGatewaysService.capture_paypal_order(
                    client_id=pi_row.get("publishable_key") or "",
                    client_secret=pp_secret,
                    test_mode=bool(pi_row.get("test_mode", True)),
                    order_id=str(pp_order_id),
                )
        except Exception:
            logger.warning("Non-fatal: PayPal capture on return encountered an issue", exc_info=True)

    now_iso = datetime.now(timezone.utc).isoformat()
    if matched_order:
        existing_meta = dict(matched_order.get("metadata") or {})
        already_notified = (
            matched_order.get("status") == "succeeded"
            and existing_meta.get("notified_status") == "succeeded"
        )
        if not already_notified:
            existing_meta["notified_status"] = "succeeded"
            upd_fields = {
                "status": "succeeded",
                "paid_at": now_iso,
                "updated_at": now_iso,
                "metadata": existing_meta,
            }
            u_res = await run_db(
                lambda: supabase.table("chatty_orders")
                .update(upd_fields)
                .eq("id", matched_order["id"])
                .execute()
            )
            matched_order = u_res.data[0] if (u_res and u_res.data) else {**matched_order, **upd_fields}

            meeting_id = existing_meta.get("meeting_id")
            if meeting_id:
                try:
                    from app.services.booking.payment_service import BookingPaymentService
                    pay_svc = BookingPaymentService(supabase, run_db)
                    await pay_svc.handle_payment_completed(
                        meeting_id=str(meeting_id),
                        payment_intent_id=str(matched_order.get("gateway_order_id") or matched_order.get("id")),
                        amount_cents=int(matched_order.get("amount_cents") or 0),
                    )
                except Exception:
                    logger.warning("Non-fatal: failed to confirm meeting on payment return", exc_info=True)

            eff_sid = str(matched_order.get("session_id") or existing_meta.get("session_id") or "").strip()
            if eff_sid:
                amt_str = f"${(int(matched_order.get('amount_cents') or 0) / 100):.2f} {matched_order.get('currency', 'USD')}"
                chat_msg = (
                    f"✅ **Payment Confirmed!** Thank you for your purchase of **{matched_order.get('title', 'Order')}** "
                    f"({amt_str}) via {str(matched_order.get('provider') or prov).capitalize()}. "
                    "A confirmation receipt has been sent to your email."
                )
                try:
                    await run_db(
                        lambda: supabase.table("chatty_conversations")
                        .insert({
                            "bot_id": bot_id,
                            "session_id": eff_sid,
                            "role": "assistant",
                            "content": chat_msg,
                            "created_at": now_iso,
                        })
                        .execute()
                    )
                except Exception:
                    pass

            try:
                await send_order_notification_emails(
                    order=matched_order,
                    bot_name=bot_name,
                    email_config=email_cfg,
                    owner_email=owner_email,
                )
            except Exception:
                logger.warning("Non-fatal: failed to send receipt email on payment return", exc_info=True)

    display_order = matched_order or {
        "id": order_id or "confirmed",
        "title": "Completed Order",
        "amount_cents": 0,
        "currency": "USD",
        "provider": prov,
        "status": "succeeded",
        "customer_name": "Valued Customer",
        "checkout_url": "https://chatty.personaliai.com",
    }
    _, receipt_html = render_order_status_email(
        {**display_order, "status": "succeeded"},
        bot_name=bot_name,
        email_config=email_cfg,
    )
    top_bar = (
        '<div style="background:#0f172a;color:#ffffff;padding:12px 20px;text-align:center;'
        'font-family:-apple-system,BlinkMacSystemFont,sans-serif;font-size:13px;display:flex;'
        'align-items:center;justify-content:center;gap:16px;">'
        '<span>✅ Payment verified &amp; confirmed. You may now return to the chat conversation.</span>'
        '<button onclick="window.close()" style="background:#10b981;color:#ffffff;border:none;'
        'padding:6px 14px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;">'
        'Close Tab &amp; Return to Chat</button></div>'
    )
    full_page = receipt_html.replace("<body>", f"<body>{top_bar}", 1) if "<body>" in receipt_html else (top_bar + receipt_html)
    return HTMLResponse(content=full_page, status_code=200)
