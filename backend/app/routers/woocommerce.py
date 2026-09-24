"""WooCommerce Integration Router (/api/bots/{bot_id}/integrations/woocommerce/*)."""

from __future__ import annotations

import asyncio
import base64
import hashlib
import hmac
import json
import logging
import time
import urllib.parse
from typing import Any, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel, Field

from app.core.clients import supabase
from app.core.config import CHATTY_BACKEND_URL, CHATTY_FRONTEND_URL, FUNCTION_SECRET
from app.core.db import run_db
from app.core.deps import require_user
from app.core.permissions import verify_bot_permission
from app.services import woocommerce_service

logger = logging.getLogger("chatty.routers.woocommerce")

router = APIRouter()


def _generate_auth_state(bot_id: str, store_url: str) -> str:
    """Generate an HMAC-signed state token containing bot_id, store_url, and timestamp."""
    payload = {
        "b": bot_id,
        "u": store_url,
        "t": int(time.time()),
    }
    raw_json = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    payload_b64 = base64.urlsafe_b64encode(raw_json).decode("utf-8").rstrip("=")
    secret = (FUNCTION_SECRET or "chatty-wc-secret-key").encode("utf-8")
    sig = base64.urlsafe_b64encode(
        hmac.new(secret, payload_b64.encode("utf-8"), hashlib.sha256).digest()
    ).decode("utf-8").rstrip("=")[:16]
    return f"{payload_b64}.{sig}"


def _verify_auth_state(state: str, max_age_seconds: int = 3600) -> tuple[Optional[str], Optional[str]]:
    """Verify state token signature and expiry. Returns (bot_id, store_url) or (None, None)."""
    if not state or "." not in state:
        return None, None
    parts = state.split(".", 1)
    if len(parts) != 2:
        return None, None
    payload_b64, sig = parts
    secret = (FUNCTION_SECRET or "chatty-wc-secret-key").encode("utf-8")
    expected_sig = base64.urlsafe_b64encode(
        hmac.new(secret, payload_b64.encode("utf-8"), hashlib.sha256).digest()
    ).decode("utf-8").rstrip("=")[:16]

    if not hmac.compare_digest(sig, expected_sig):
        return None, None

    # Add back base64 padding
    rem = len(payload_b64) % 4
    padded = payload_b64 + ("=" * (4 - rem) if rem else "")
    try:
        data = json.loads(base64.urlsafe_b64decode(padded.encode("utf-8")).decode("utf-8"))
        bot_id = data.get("b")
        store_url = data.get("u")
        ts = data.get("t", 0)
        if not bot_id or not store_url:
            return None, None
        if time.time() - ts > max_age_seconds:
            logger.warning("WooCommerce auth state expired for bot %s", bot_id)
            return None, None
        return str(bot_id), str(store_url)
    except Exception:
        logger.warning("Failed to decode WooCommerce auth state payload", exc_info=True)
        return None, None


class WooCommerceConnectRequest(BaseModel):
    store_url: str = Field(..., description="WooCommerce store URL (e.g. https://mystore.com)")
    consumer_key: str = Field(..., description="WooCommerce REST API Consumer Key (ck_...)")
    consumer_secret: str = Field(..., description="WooCommerce REST API Consumer Secret (cs_...)")


class WooCommerceAuthorizeUrlRequest(BaseModel):
    store_url: str = Field(..., description="WooCommerce store URL (e.g. https://mystore.com)")
    return_url: Optional[str] = Field(None, description="Frontend URL to redirect after approval")


class WooCommerceAuthCallbackPayload(BaseModel):
    key_id: Optional[Any] = None
    user_id: str = Field(..., description="Signed state token returned from wc-auth")
    consumer_key: str = Field(..., description="Generated Consumer Key")
    consumer_secret: str = Field(..., description="Generated Consumer Secret")
    key_permissions: Optional[str] = None


@router.get("/api/bots/{bot_id}/integrations/woocommerce")
async def get_woocommerce_status(
    bot_id: str,
    request: Request,
    user: dict[str, Any] = Depends(require_user),
):
    """Get connection status, sync progress, and webhook config for WooCommerce."""
    await verify_bot_permission(bot_id, user, "sources")
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
    await verify_bot_permission(bot_id, user, "sources")

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
    await verify_bot_permission(bot_id, user, "sources")
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
    await verify_bot_permission(bot_id, user, "sources")
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


@router.post("/api/bots/{bot_id}/integrations/woocommerce/authorize-url")
async def get_woocommerce_authorize_url(
    bot_id: str,
    req: WooCommerceAuthorizeUrlRequest,
    user: dict[str, Any] = Depends(require_user),
):
    """Generate a 1-click WooCommerce authorization URL (wc-auth/v1/authorize flow)."""
    await verify_bot_permission(bot_id, user, "sources")

    base_url = woocommerce_service._normalize_store_url(req.store_url)
    parsed = urllib.parse.urlparse(base_url)
    if not parsed.netloc or parsed.scheme not in ("http", "https"):
        raise HTTPException(status_code=400, detail="Invalid store URL. Please provide a valid domain (e.g. https://mystore.com).")

    state = _generate_auth_state(bot_id, base_url)
    backend_base = (CHATTY_BACKEND_URL or "").rstrip("/")
    callback_url = f"{backend_base}/api/integrations/woocommerce/auth-callback"

    frontend_base = (CHATTY_FRONTEND_URL or "").rstrip("/")
    return_url = req.return_url
    if not return_url:
        return_url = f"{frontend_base}/dashboard?tab=catalog&bot_id={bot_id}&wc_auth=success"
    elif return_url.startswith("/"):
        return_url = f"{frontend_base}{return_url}"

    params = {
        "app_name": "Chatty AI",
        "scope": "read_write",
        "user_id": state,
        "return_url": return_url,
        "callback_url": callback_url,
    }
    authorize_url = f"{base_url}/wc-auth/v1/authorize?{urllib.parse.urlencode(params)}"

    return {
        "authorize_url": authorize_url,
        "store_url": base_url,
        "state": state,
    }


@router.post("/api/integrations/woocommerce/auth-callback")
async def receive_woocommerce_auth_callback(
    request: Request,
):
    """Public callback endpoint for WooCommerce 1-click authorization flow."""
    try:
        payload = await request.json()
    except Exception:
        logger.warning("WooCommerce auth callback received invalid JSON")
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    user_id = str(payload.get("user_id") or "").strip()
    consumer_key = str(payload.get("consumer_key") or "").strip()
    consumer_secret = str(payload.get("consumer_secret") or "").strip()

    if not user_id or not consumer_key or not consumer_secret:
        logger.warning("WooCommerce auth callback missing required fields")
        raise HTTPException(status_code=400, detail="Missing required parameters: user_id, consumer_key, consumer_secret")

    bot_id, store_url = _verify_auth_state(user_id)
    if not bot_id or not store_url:
        logger.warning("WooCommerce auth callback invalid or expired state token: %s", user_id[:25] if user_id else "")
        raise HTTPException(status_code=400, detail="Invalid or expired authorization state")

    bot_res = await run_db(
        lambda: supabase.table("chatty_bots")
        .select("id")
        .eq("id", bot_id)
        .execute()
    )
    if not bot_res.data:
        logger.warning("WooCommerce auth callback for non-existent bot %s", bot_id)
        raise HTTPException(status_code=404, detail="Bot not found")

    # Save credentials into database
    saved = await woocommerce_service.save_integration(
        bot_id=bot_id,
        store_url=store_url,
        consumer_key=consumer_key,
        consumer_secret=consumer_secret,
    )

    # Automatically trigger initial background product sync
    asyncio.create_task(woocommerce_service.run_woocommerce_sync_task(bot_id))
    logger.info("WooCommerce 1-click authorization completed successfully for bot %s on store %s", bot_id, store_url)

    return {
        "status": "ok",
        "bot_id": bot_id,
        "store_url": store_url,
    }
