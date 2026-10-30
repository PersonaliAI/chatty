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
    provider: Optional[str] = None  # stripe, lemonsqueezy, polar (or default active)


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
    for p in ["stripe", "lemonsqueezy", "polar"]:
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
    if prov not in {"stripe", "lemonsqueezy", "polar"}:
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
        elif prov == "polar":
            test_res = await PaymentGatewaysService.verify_polar(
                body.secret_key, organization_id=extra.get("organization_id")
            )
            if test_res.get("organization_id"):
                extra["organization_id"] = test_res["organization_id"]
    except Exception as e:
        logger.exception("Verification call failed for %s: %s", prov, e)
        raise HTTPException(status_code=400, detail=f"Failed to connect {prov}: {str(e)}")

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
            detail="No active payment gateway connected. Please connect Stripe, Lemon Squeezy, or Polar in Integrations.",
        )

    integration = res.data[0]
    prov = integration["provider"]
    secret = decrypt_secret(integration.get("secret_key_encrypted") or "")
    extra = integration.get("extra_config") or {}

    success_url = "https://app.chatty.com/payment/success"
    cancel_url = "https://app.chatty.com/payment/cancel"
    metadata = {
        "bot_id": bot_id,
        "session_id": body.session_id,
        "sent_by": user.get("email") or "human_agent",
    }

    try:
        if prov == "stripe":
            checkout_res = await PaymentGatewaysService.create_stripe_checkout(
                secret_key=secret,
                amount_cents=body.amount_cents,
                currency=body.currency,
                title=body.title,
                customer_email=body.customer_email,
                success_url=success_url,
                cancel_url=cancel_url,
                metadata=metadata,
            )
        elif prov == "lemonsqueezy":
            checkout_res = await PaymentGatewaysService.create_lemonsqueezy_checkout(
                api_key=secret,
                store_id=extra.get("store_id") or "",
                amount_cents=body.amount_cents,
                currency=body.currency,
                title=body.title,
                customer_email=body.customer_email,
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
                customer_email=body.customer_email,
                success_url=success_url,
                metadata=metadata,
            )
        else:
            raise HTTPException(status_code=400, detail="Unsupported provider")
    except Exception as e:
        logger.exception("Failed to create checkout link: %s", e)
        raise HTTPException(status_code=500, detail=f"Checkout generation failed: {str(e)}")

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

    return {
        "status": "success",
        "provider": prov,
        "checkout_url": checkout_url,
        "amount_formatted": amount_formatted,
        "token_data": token_data,
    }
