"""WooCommerce Integration Router (/api/bots/{bot_id}/integrations/woocommerce/*)."""

from __future__ import annotations

import asyncio
import logging
from typing import Any, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel, Field

from app.core.clients import supabase
from app.core.db import run_db
from app.core.deps import require_user
from app.core.permissions import verify_bot_permission
from app.services import woocommerce_service

logger = logging.getLogger("chatty.routers.woocommerce")

router = APIRouter()


class WooCommerceConnectRequest(BaseModel):
    store_url: str = Field(..., description="WooCommerce store URL (e.g. https://mystore.com)")
    consumer_key: str = Field(..., description="WooCommerce REST API Consumer Key (ck_...)")
    consumer_secret: str = Field(..., description="WooCommerce REST API Consumer Secret (cs_...)")


@router.get("/api/bots/{bot_id}/integrations/woocommerce")
async def get_woocommerce_status(
    bot_id: str,
    request: Request,
    user: dict[str, Any] = Depends(require_user),
):
    """Get connection status, sync progress, and webhook config for WooCommerce."""
    await verify_bot_permission(bot_id, user)
    integration = await woocommerce_service.get_integration(bot_id)

    # Count total synced WooCommerce products in media table
    items_res = await run_db(
        lambda: supabase.table("chatty_media_items")
        .select("id", count="exact", head=True)
        .eq("bot_id", bot_id)
        .contains("metadata", {"source": "woocommerce"})
        .execute()
    )
    product_count = items_res.count or 0

    base_url = str(request.base_url).rstrip("/")
    webhook_url = f"{base_url}/api/integrations/woocommerce/webhook/{bot_id}"

    if not integration:
        return {
            "connected": False,
            "webhook_url": webhook_url,
            "product_count": product_count,
        }

    return {
        "connected": True,
        "store_url": integration.get("store_url"),
        "sync_status": integration.get("sync_status", "idle"),
        "sync_progress": integration.get("sync_progress", 0),
        "total_products": integration.get("total_products", 0),
        "synced_products": integration.get("synced_products", product_count),
        "last_synced_at": integration.get("last_synced_at"),
        "last_error": integration.get("last_error"),
        "webhook_url": webhook_url,
        "webhook_secret": integration.get("webhook_secret"),
        "product_count": product_count,
    }


@router.post("/api/bots/{bot_id}/integrations/woocommerce/connect")
async def connect_woocommerce(
    bot_id: str,
    req: WooCommerceConnectRequest,
    user: dict[str, Any] = Depends(require_user),
):
    """Test WooCommerce credentials and save the connection."""
    await verify_bot_permission(bot_id, user)

    # Verify credentials with store
    verify_res = await woocommerce_service.verify_credentials(
        store_url=req.store_url,
        consumer_key=req.consumer_key,
        consumer_secret=req.consumer_secret,
    )

    if not verify_res.get("valid"):
        err_detail = verify_res.get("error") or "Could not connect to WooCommerce API. Check your store URL and keys."
        raise HTTPException(status_code=400, detail=err_detail)

    # Save integration
    saved = await woocommerce_service.save_integration(
        bot_id=bot_id,
        store_url=req.store_url,
        consumer_key=req.consumer_key,
        consumer_secret=req.consumer_secret,
    )

    return {
        "connected": True,
        "store_info": verify_res,
        "integration": {
            "store_url": saved.get("store_url"),
            "sync_status": saved.get("sync_status"),
            "webhook_secret": saved.get("webhook_secret"),
        },
    }


@router.post("/api/bots/{bot_id}/integrations/woocommerce/sync")
async def trigger_woocommerce_sync(
    bot_id: str,
    user: dict[str, Any] = Depends(require_user),
):
    """Trigger a 1-click bulk import of all products from WooCommerce."""
    await verify_bot_permission(bot_id, user)
    integration = await woocommerce_service.get_integration(bot_id)

    if not integration:
        raise HTTPException(status_code=400, detail="WooCommerce store is not connected.")

    if integration.get("sync_status") == "syncing":
        return {
            "status": "already_syncing",
            "message": "A product sync is already in progress.",
            "progress": integration.get("sync_progress", 0),
        }

    # Run in background asyncio task
    asyncio.create_task(woocommerce_service.run_woocommerce_sync_task(bot_id))

    return {
        "status": "started",
        "message": "Product import started in background.",
    }


@router.delete("/api/bots/{bot_id}/integrations/woocommerce")
async def disconnect_woocommerce(
    bot_id: str,
    delete_synced_items: bool = False,
    user: dict[str, Any] = Depends(require_user),
):
    """Disconnect WooCommerce store and optionally remove synced products."""
    await verify_bot_permission(bot_id, user)
    success = await woocommerce_service.delete_integration(bot_id)

    deleted_count = 0
    if delete_synced_items:
        del_res = await run_db(
            lambda: supabase.table("chatty_media_items")
            .delete()
            .eq("bot_id", bot_id)
            .contains("metadata", {"source": "woocommerce"})
            .execute()
        )
        deleted_count = len(del_res.data or [])

    return {
        "disconnected": success,
        "deleted_synced_items_count": deleted_count,
    }


@router.post("/api/integrations/woocommerce/webhook/{bot_id}")
async def receive_woocommerce_webhook(
    bot_id: str,
    request: Request,
    x_wc_webhook_topic: Optional[str] = Header(None),
    x_wc_webhook_signature: Optional[str] = Header(None),
):
    """Public webhook receiver for WooCommerce real-time product events."""
    raw_body = await request.body()
    integration = await woocommerce_service.get_integration(bot_id)

    if not integration:
        logger.warning("Received webhook for unknown bot %s", bot_id)
        raise HTTPException(status_code=404, detail="Integration not found")

    secret = integration.get("webhook_secret") or ""
    # Verify HMAC-SHA256 signature if signature header is provided
    if x_wc_webhook_signature:
        is_valid = woocommerce_service.verify_webhook_signature(
            secret=secret,
            raw_body=raw_body,
            header_signature=x_wc_webhook_signature,
        )
        if not is_valid:
            logger.warning("Invalid webhook signature for bot %s", bot_id)
            raise HTTPException(status_code=401, detail="Invalid webhook signature")

    topic = x_wc_webhook_topic or "product.updated"
    try:
        payload = await request.json()
    except Exception:
        payload = {}

    result = await woocommerce_service.process_webhook_payload(bot_id, topic, payload)
    return {"status": "ok", "result": result}
