"""WooCommerce Direct Import & Auto-Sync Service for Chatty Multimodal RAG.

Provides:
- WooCommerce REST API client with Basic Auth and pagination.
- 1-Click bulk product catalog importer (images, prices, stock, categories, SKUs).
- Real-time Webhook receiver with HMAC-SHA256 signature verification.
- Smart upsert matching by WooCommerce Product ID to prevent duplicates.
- Background progress tracking (0-100%) stored in chatty_woocommerce_integrations.
"""

from __future__ import annotations

import asyncio
import base64
import hashlib
import hmac
import html
import logging
import re
from datetime import datetime, timezone
from typing import Any, Optional

import httpx

from app.core.clients import supabase
from app.core.db import run_db
from app.services import multimodal_service

logger = logging.getLogger("chatty.woocommerce")


def _clean_html(raw_html: Optional[str]) -> str:
    """Strip HTML tags and unescape entities for clean AI text indexing."""
    if not raw_html:
        return ""
    text = re.sub(r"<[^>]+>", " ", raw_html)
    text = html.unescape(text)
    return " ".join(text.split())


def _normalize_store_url(url: str) -> str:
    """Normalize store URL with scheme and strip trailing slash."""
    url = (url or "").strip().rstrip("/")
    if url and not url.startswith("http://") and not url.startswith("https://"):
        url = f"https://{url}"
    return url


def verify_webhook_signature(secret: str, raw_body: bytes, header_signature: str) -> bool:
    """Verify WooCommerce webhook signature (HMAC-SHA256 base64 encoded)."""
    if not secret or not header_signature:
        return False
    expected = base64.b64encode(
        hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256).digest()
    ).decode("utf-8")
    return hmac.compare_digest(expected.strip(), header_signature.strip())


async def verify_credentials(
    store_url: str,
    consumer_key: str,
    consumer_secret: str,
) -> dict[str, Any]:
    """Test WooCommerce API credentials and return basic store information."""
    base_url = _normalize_store_url(store_url)
    api_url = f"{base_url}/wp-json/wc/v3/system_status"
    fallback_url = f"{base_url}/wp-json/wc/v3/products"

    auth = (consumer_key.strip(), consumer_secret.strip())
    timeout = httpx.Timeout(15.0, connect=10.0)

    async with httpx.AsyncClient(timeout=timeout, verify=False) as client:
        # First attempt: system_status
        try:
            resp = await client.get(api_url, auth=auth)
            if resp.status_code == 200:
                data = resp.json()
                env = data.get("environment", {})
                return {
                    "valid": True,
                    "store_name": env.get("site_title") or base_url,
                    "currency": env.get("currency") or "USD",
                    "currency_symbol": env.get("currency_symbol") or "$",
                    "wc_version": env.get("version") or "",
                }
        except Exception as exc:
            logger.warning("WooCommerce system_status probe failed: %s; trying products probe", exc)

        # Fallback attempt: GET products?per_page=1
        try:
            resp = await client.get(fallback_url, auth=auth, params={"per_page": 1})
            if resp.status_code == 200:
                total_str = resp.headers.get("x-wp-total", "0")
                try:
                    total_count = int(total_str)
                except ValueError:
                    total_count = len(resp.json()) if isinstance(resp.json(), list) else 0

                return {
                    "valid": True,
                    "store_name": base_url,
                    "currency": "USD",
                    "currency_symbol": "$",
                    "total_products_estimate": total_count,
                }
            else:
                error_msg = f"WooCommerce returned HTTP {resp.status_code}: {resp.text[:200]}"
                return {"valid": False, "error": error_msg}
        except Exception as exc:
            logger.exception("WooCommerce connection failed: %s", exc)
            return {"valid": False, "error": str(exc)}


async def get_integration(bot_id: str) -> Optional[dict[str, Any]]:
    """Fetch stored WooCommerce integration settings for a bot."""
    res = await run_db(
        lambda: supabase.table("chatty_woocommerce_integrations")
        .select("*")
        .eq("bot_id", bot_id)
        .limit(1)
        .execute()
    )
    return res.data[0] if res and res.data else None


async def save_integration(
    bot_id: str,
    store_url: str,
    consumer_key: str,
    consumer_secret: str,
) -> dict[str, Any]:
    """Create or update WooCommerce integration settings for a bot."""
    base_url = _normalize_store_url(store_url)
    existing = await get_integration(bot_id)

    payload = {
        "bot_id": bot_id,
        "store_url": base_url,
        "consumer_key": consumer_key.strip(),
        "consumer_secret": consumer_secret.strip(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    if existing:
        res = await run_db(
            lambda: supabase.table("chatty_woocommerce_integrations")
            .update(payload)
            .eq("bot_id", bot_id)
            .execute()
        )
        return res.data[0] if res and res.data else existing
    else:
        # Generate clean 32-byte hex webhook secret
        payload["webhook_secret"] = hashlib.sha256(f"{bot_id}:{base_url}:{datetime.now()}".encode()).hexdigest()
        payload["sync_status"] = "idle"
        payload["sync_progress"] = 0
        payload["created_at"] = datetime.now(timezone.utc).isoformat()
        res = await run_db(
            lambda: supabase.table("chatty_woocommerce_integrations")
            .insert(payload)
            .execute()
        )
        return res.data[0] if res and res.data else payload


async def delete_integration(bot_id: str) -> bool:
    """Disconnect and remove WooCommerce integration for a bot."""
    res = await run_db(
        lambda: supabase.table("chatty_woocommerce_integrations")
        .delete()
        .eq("bot_id", bot_id)
        .execute()
    )
    return bool(res.data)


def _map_wc_product(product: dict[str, Any], currency: str = "USD") -> dict[str, Any]:
    """Extract standard media item fields from a WooCommerce product payload."""
    wc_id = product.get("id")
    title = (product.get("name") or "").strip() or "Untitled Product"
    short_desc = _clean_html(product.get("short_description"))
    full_desc = _clean_html(product.get("description"))
    description = short_desc if len(short_desc) > 20 else full_desc

    sku = product.get("sku") or None
    price_val = None
    for p_key in ("price", "regular_price", "sale_price"):
        raw_p = product.get(p_key)
        if raw_p:
            try:
                price_val = float(raw_p)
                break
            except (ValueError, TypeError):
                continue

    url = product.get("permalink") or ""
    images = product.get("images") or []
    media_url = images[0].get("src") if images and isinstance(images, list) else ""
    thumbnail_url = media_url

    stock_status = product.get("stock_status", "instock")
    in_stock = stock_status == "instock"

    categories = [
        c.get("name") for c in product.get("categories", []) if isinstance(c, dict) and c.get("name")
    ]
    tags = [
        t.get("name") for t in product.get("tags", []) if isinstance(t, dict) and t.get("name")
    ]

    metadata = {
        "source": "woocommerce",
        "woocommerce_id": wc_id,
        "stock_status": stock_status,
        "in_stock": in_stock,
        "categories": categories,
        "tags": tags,
    }

    return {
        "title": title,
        "description": description[:1000],
        "sku": sku,
        "price": price_val,
        "currency": currency,
        "url": url,
        "media_url": media_url,
        "thumbnail_url": thumbnail_url,
        "metadata": metadata,
    }


async def _update_sync_progress(
    bot_id: str,
    *,
    status: str,
    progress: int,
    synced: int,
    total: int,
    error: Optional[str] = None,
):
    """Update progress tracking columns in chatty_woocommerce_integrations."""
    fields: dict[str, Any] = {
        "sync_status": status,
        "sync_progress": max(0, min(100, progress)),
        "synced_products": synced,
        "total_products": total,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    if error is not None:
        fields["last_error"] = error
    if status == "synced":
        fields["last_synced_at"] = datetime.now(timezone.utc).isoformat()
        fields["last_error"] = None

    try:
        await run_db(
            lambda: supabase.table("chatty_woocommerce_integrations")
            .update(fields)
            .eq("bot_id", bot_id)
            .execute()
        )
    except Exception as exc:
        logger.warning("Failed to update sync progress for bot %s: %s", bot_id, exc)


async def run_woocommerce_sync_task(bot_id: str) -> dict[str, Any]:
    """Background task: Paginate and import all WooCommerce products into chatty_media_items."""
    integration = await get_integration(bot_id)
    if not integration:
        return {"error": "WooCommerce integration not configured"}

    store_url = integration["store_url"]
    consumer_key = integration["consumer_key"]
    consumer_secret = integration["consumer_secret"]

    auth = (consumer_key, consumer_secret)
    api_url = f"{_normalize_store_url(store_url)}/wp-json/wc/v3/products"
    timeout = httpx.Timeout(30.0, connect=15.0)

    await _update_sync_progress(bot_id, status="syncing", progress=5, synced=0, total=0)

    synced_count = 0
    total_count = 0
    page = 1
    per_page = 100

    try:
        async with httpx.AsyncClient(timeout=timeout, verify=False) as client:
            while True:
                resp = await client.get(
                    api_url,
                    auth=auth,
                    params={
                        "per_page": per_page,
                        "page": page,
                        "status": "publish",
                    },
                )

                if resp.status_code != 200:
                    err = f"Failed to fetch products page {page}: HTTP {resp.status_code}"
                    logger.error("WooCommerce sync error: %s", err)
                    await _update_sync_progress(
                        bot_id,
                        status="failed",
                        progress=0,
                        synced=synced_count,
                        total=total_count,
                        error=err,
                    )
                    return {"success": False, "error": err}

                # Parse total count from header
                total_header = resp.headers.get("x-wp-total")
                if total_header and total_count == 0:
                    try:
                        total_count = int(total_header)
                    except ValueError:
                        total_count = 0

                products = resp.json()
                if not products or not isinstance(products, list):
                    break

                # Process products on this page
                for p in products:
                    mapped = _map_wc_product(p)
                    wc_id = mapped["metadata"]["woocommerce_id"]

                    # Check if already exists by woocommerce_id
                    existing = await run_db(
                        lambda: supabase.table("chatty_media_items")
                        .select("id")
                        .eq("bot_id", bot_id)
                        .contains("metadata", {"woocommerce_id": wc_id})
                        .limit(1)
                        .execute()
                    )

                    if existing and existing.data:
                        # Update price, stock, description, url
                        item_id = existing.data[0]["id"]
                        upd = {
                            "title": mapped["title"],
                            "description": mapped["description"],
                            "sku": mapped["sku"],
                            "price": mapped["price"],
                            "currency": mapped["currency"],
                            "url": mapped["url"],
                            "media_url": mapped["media_url"] or existing.data[0].get("media_url", ""),
                            "thumbnail_url": mapped["thumbnail_url"] or existing.data[0].get("thumbnail_url", ""),
                            "metadata": mapped["metadata"],
                            "updated_at": datetime.now(timezone.utc).isoformat(),
                        }
                        await run_db(
                            lambda: supabase.table("chatty_media_items")
                            .update(upd)
                            .eq("id", item_id)
                            .execute()
                        )
                    else:
                        # Ingest new item with vector embeddings
                        try:
                            await multimodal_service.ingest_media_item(
                                bot_id=bot_id,
                                title=mapped["title"],
                                media_url=mapped["media_url"] or "https://placehold.co/400x400?text=Product",
                                media_type="product",
                                description=mapped["description"],
                                sku=mapped["sku"],
                                price=mapped["price"],
                                currency=mapped["currency"],
                                url=mapped["url"],
                                thumbnail_url=mapped["thumbnail_url"],
                                metadata=mapped["metadata"],
                            )
                        except Exception as exc:
                            logger.warning("Failed to ingest WC product '%s': %s", mapped["title"], exc)

                    synced_count += 1
                    pct = int((synced_count / max(total_count or 1, synced_count)) * 95)
                    # Periodic heartbeat progress update
                    if synced_count % 10 == 0:
                        await _update_sync_progress(
                            bot_id,
                            status="syncing",
                            progress=pct,
                            synced=synced_count,
                            total=total_count or synced_count,
                        )

                # Check if last page
                total_pages_hdr = resp.headers.get("x-wp-totalpages")
                if total_pages_hdr:
                    try:
                        total_pages = int(total_pages_hdr)
                        if page >= total_pages:
                            break
                    except ValueError:
                        pass

                if len(products) < per_page:
                    break

                page += 1

        # Finished sync successfully
        await _update_sync_progress(
            bot_id,
            status="synced",
            progress=100,
            synced=synced_count,
            total=total_count or synced_count,
        )
        return {
            "success": True,
            "synced_count": synced_count,
            "total_count": total_count or synced_count,
        }

    except Exception as exc:
        logger.exception("WooCommerce bulk sync failed: %s", exc)
        await _update_sync_progress(
            bot_id,
            status="failed",
            progress=0,
            synced=synced_count,
            total=total_count,
            error=str(exc),
        )
        return {"success": False, "error": str(exc)}


async def process_webhook_payload(
    bot_id: str,
    topic: str,
    payload: dict[str, Any],
) -> dict[str, Any]:
    """Handle incoming WooCommerce webhook event (product.created/updated/deleted)."""
    wc_id = payload.get("id")
    if not wc_id:
        return {"ignored": True, "reason": "No product id in payload"}

    topic_lower = topic.lower()

    if "deleted" in topic_lower:
        # Delete from chatty_media_items
        res = await run_db(
            lambda: supabase.table("chatty_media_items")
            .delete()
            .eq("bot_id", bot_id)
            .contains("metadata", {"woocommerce_id": wc_id})
            .execute()
        )
        logger.info("WooCommerce webhook deleted product %s (count: %d)", wc_id, len(res.data or []))
        return {"event": "deleted", "id": wc_id}

    if "created" in topic_lower or "updated" in topic_lower:
        mapped = _map_wc_product(payload)

        # Check if exists
        existing = await run_db(
            lambda: supabase.table("chatty_media_items")
            .select("id")
            .eq("bot_id", bot_id)
            .contains("metadata", {"woocommerce_id": wc_id})
            .limit(1)
            .execute()
        )

        if existing and existing.data:
            item_id = existing.data[0]["id"]
            upd = {
                "title": mapped["title"],
                "description": mapped["description"],
                "sku": mapped["sku"],
                "price": mapped["price"],
                "currency": mapped["currency"],
                "url": mapped["url"],
                "metadata": mapped["metadata"],
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
            if mapped["media_url"]:
                upd["media_url"] = mapped["media_url"]
                upd["thumbnail_url"] = mapped["thumbnail_url"]

            await run_db(
                lambda: supabase.table("chatty_media_items")
                .update(upd)
                .eq("id", item_id)
                .execute()
            )
            logger.info("WooCommerce webhook updated product %s (%s)", wc_id, mapped["title"])
            return {"event": "updated", "id": wc_id}
        else:
            await multimodal_service.ingest_media_item(
                bot_id=bot_id,
                title=mapped["title"],
                media_url=mapped["media_url"] or "https://placehold.co/400x400?text=Product",
                media_type="product",
                description=mapped["description"],
                sku=mapped["sku"],
                price=mapped["price"],
                currency=mapped["currency"],
                url=mapped["url"],
                thumbnail_url=mapped["thumbnail_url"],
                metadata=mapped["metadata"],
            )
            logger.info("WooCommerce webhook created product %s (%s)", wc_id, mapped["title"])
            return {"event": "created", "id": wc_id}

    return {"ignored": True, "topic": topic}
