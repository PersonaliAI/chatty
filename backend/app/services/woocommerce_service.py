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
import json
import logging
import re
from datetime import datetime, timezone
from typing import Any, Optional

import httpx

from app.core.clients import supabase
from app.core.crypto import decrypt_secret, encrypt_secret
from app.core.db import run_db
from app.core import ssrf
from app.services import multimodal_service

logger = logging.getLogger("chatty.woocommerce")


def _protect(value: str) -> str:
    """Encrypt integration credentials before persistence.

    ``decrypt_secret`` intentionally supports legacy plaintext rows, so an
    existing installation can be upgraded without a destructive migration.
    New writes fail closed when the encryption key is missing.
    """
    return encrypt_secret(value) if value else value


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

    # Never disable certificate verification for merchant stores. Operators
    # with a private CA can configure httpx/OS trust instead of weakening all
    # tenants' outbound requests.
    async with httpx.AsyncClient(timeout=timeout) as client:
        # First attempt: system_status
        try:
            resp = await ssrf.request_async(client, "GET", api_url, auth=auth)
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
            resp = await ssrf.request_async(client, "GET", fallback_url, auth=auth, params={"per_page": 1})
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
    if not res or not res.data:
        return None
    row = dict(res.data[0])
    # Decrypt only in the service process; never expose these fields from an
    # API response. Legacy plaintext values remain readable during migration.
    for field in ("consumer_key", "consumer_secret", "webhook_secret"):
        if row.get(field):
            row[field] = decrypt_secret(row[field])
    return row


async def refresh_live_product_facts(
    bot_id: str,
    items: list[dict[str, Any]],
    *,
    max_items: int = 3,
) -> list[dict[str, Any]]:
    """Refresh bounded WooCommerce facts for matched catalog items.

    The durable catalog remains the fallback source: a failed or timed-out
    store request never removes or overwrites its snapshot facts.  Only
    products already matched from the bot's own indexed catalog are queried.
    """
    woo_items = []
    for item in items:
        metadata = item.get("metadata") or {}
        wc_id = metadata.get("woocommerce_id")
        if metadata.get("source") == "woocommerce" and wc_id is not None:
            woo_items.append((item, str(wc_id)))
        if len(woo_items) >= max(1, min(int(max_items), 6)):
            break
    if not woo_items:
        return items

    integration = await get_integration(bot_id)
    if not integration:
        return items
    store_url = _normalize_store_url(str(integration.get("store_url") or ""))
    consumer_key = str(integration.get("consumer_key") or "").strip()
    consumer_secret = str(integration.get("consumer_secret") or "").strip()
    parsed_store = httpx.URL(store_url)
    if parsed_store.scheme != "https" or not parsed_store.host or not consumer_key or not consumer_secret:
        logger.warning("Skipping live WooCommerce refresh for bot %s: incomplete secure integration", bot_id)
        return items

    auth = (consumer_key, consumer_secret)
    timeout = httpx.Timeout(4.0, connect=2.0)

    async def fetch(
        client: httpx.AsyncClient, item: dict[str, Any], wc_id: str
    ) -> tuple[dict[str, Any], Optional[dict[str, Any]]]:
        url = f"{store_url}/wp-json/wc/v3/products/{wc_id}"
        try:
            response = await asyncio.wait_for(
                ssrf.request_async(client, "GET", url, auth=auth),
                timeout=5.0,
            )
            if response.status_code != 200:
                return item, None
            payload = response.json()
            if not isinstance(payload, dict):
                return item, None
            return item, _map_wc_product(payload, currency=item.get("currency") or "USD")
        except Exception as exc:
            logger.info("Live WooCommerce facts unavailable for product %s: %s", wc_id, exc)
            return item, None

    async with httpx.AsyncClient(timeout=timeout) as client:
        results = await asyncio.gather(*(fetch(client, item, wc_id) for item, wc_id in woo_items))
    checked_at = datetime.now(timezone.utc).isoformat()
    for original, mapped in results:
        if mapped is None:
            original["metadata"] = {**(original.get("metadata") or {}), "live_check_status": "unavailable"}
            continue
        metadata = dict(original.get("metadata") or {})
        live_metadata = mapped.get("metadata") or {}
        for key in ("stock_status", "in_stock", "regular_price", "sale_price", "on_sale"):
            if key in live_metadata:
                metadata[key] = live_metadata[key]
        if live_metadata.get("variations"):
            metadata["variations"] = live_metadata["variations"]
        metadata.update({
            "live_check_status": "fresh",
            "live_checked_at": checked_at,
            "live_source_updated_at": mapped.get("source_updated_at"),
        })
        original["metadata"] = metadata
        for key in ("price", "currency", "url"):
            if mapped.get(key) not in (None, ""):
                original[key] = mapped[key]
    return items


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
        "consumer_key": _protect(consumer_key.strip()),
        "consumer_secret": _protect(consumer_secret.strip()),
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
        payload["webhook_secret"] = _protect(hashlib.sha256(f"{bot_id}:{base_url}:{datetime.now()}".encode()).hexdigest())
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

    # Preserve commerce facts in structured metadata so the assistant can
    # answer variant, sale-price, and availability questions without guessing.
    def _number(value: Any) -> float | None:
        try:
            return float(value) if value not in (None, "") else None
        except (TypeError, ValueError):
            return None

    regular_price = _number(product.get("regular_price"))
    sale_price = _number(product.get("sale_price"))
    variations = []
    for variation in product.get("variations") or []:
        if isinstance(variation, dict):
            variation_attributes = variation.get("attributes") or []
            variations.append({
                "id": variation.get("id"),
                "sku": variation.get("sku") or None,
                "price": _number(variation.get("price")),
                "regular_price": _number(variation.get("regular_price")),
                "sale_price": _number(variation.get("sale_price")),
                "stock_status": variation.get("stock_status"),
                "in_stock": variation.get("stock_status") == "instock",
                "stock_quantity": variation.get("stock_quantity"),
                "attributes": variation_attributes,
                "url": variation.get("permalink") or None,
            })

    metadata = {
        "source": "woocommerce",
        "woocommerce_id": wc_id,
        "stock_status": stock_status,
        "in_stock": in_stock,
        "categories": categories,
        "tags": tags,
        "type": product.get("type"),
        "status": product.get("status"),
        "regular_price": regular_price,
        "sale_price": sale_price,
        "on_sale": bool(product.get("on_sale")) or sale_price is not None,
        "variations": variations,
        "has_variants": bool(variations),
        "attributes": product.get("attributes") or [],
        "shipping_required": product.get("virtual") is not True,
    }
    source_updated_at = product.get("date_modified_gmt") or product.get("date_modified") or None
    catalog_version = f"woocommerce:{wc_id}:{hashlib.sha256(json.dumps(product, sort_keys=True, default=str).encode('utf-8')).hexdigest()}"

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
        "source_updated_at": source_updated_at,
        "catalog_version": catalog_version,
    }


async def _prepare_product_embedding(
    mapped: dict[str, Any], existing_metadata: Optional[dict[str, Any]] = None
) -> tuple[dict[str, Any], list[float] | None]:
    """Refresh a product embedding only when its searchable source changed."""
    embedding_kwargs = {
        "title": mapped["title"],
        "description": mapped["description"],
        "sku": mapped.get("sku"),
        "metadata": mapped.get("metadata") or {},
    }
    fingerprint = multimodal_service.catalog_embedding_fingerprint(**embedding_kwargs)
    stored = existing_metadata or {}
    needs_reembed = (
        stored.get("_embedding_fingerprint") != fingerprint
        or stored.get("_embedding_schema") != multimodal_service.EMBEDDING_SCHEMA_VERSION
    )
    vector = await multimodal_service.embed_catalog_item(**embedding_kwargs) if needs_reembed else None
    status = "ready" if vector or not needs_reembed else "stale"
    return (
        multimodal_service.catalog_metadata_with_embedding(
            mapped.get("metadata"), fingerprint, status=status
        ),
        vector if vector else None,
    )


async def _fetch_product_variations(
    client: httpx.AsyncClient,
    api_root: str,
    product: dict[str, Any],
    auth: tuple[str, str],
) -> None:
    """Expand variable-product variation ids into price/stock/attribute facts.

    WooCommerce's list endpoint commonly returns variation ids only. Fetching
    the bounded variation pages here prevents the assistant from presenting a
    parent product price when the shopper asked for a size or colour variant.
    """
    if product.get("type") != "variable" or not product.get("id"):
        return
    try:
        response = await ssrf.request_async(
            client,
            "GET",
            f"{api_root}/{product['id']}/variations",
            auth=auth,
            params={"per_page": 100, "status": "publish"},
        )
        if response.status_code == 200 and isinstance(response.json(), list):
            product["variations"] = response.json()
    except Exception as exc:
        logger.warning("Failed to fetch variations for WooCommerce product %s: %s", product.get("id"), exc)


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
        async with httpx.AsyncClient(timeout=timeout) as client:
            while True:
                resp = await ssrf.request_async(
                    client,
                    "GET",
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
                    await _fetch_product_variations(client, api_url, p, auth)
                    mapped = _map_wc_product(p)
                    wc_id = mapped["metadata"]["woocommerce_id"]

                    # Check if already exists by woocommerce_id
                    existing = await run_db(
                        lambda: supabase.table("chatty_media_items")
                        .select("id,metadata")
                        .eq("bot_id", bot_id)
                        .contains("metadata", {"woocommerce_id": wc_id})
                        .limit(1)
                        .execute()
                    )

                    if existing and existing.data:
                        # Update price, stock, description, url
                        item_id = existing.data[0]["id"]
                        updated_metadata, embedding = await _prepare_product_embedding(
                            mapped, existing.data[0].get("metadata")
                        )
                        upd = {
                            "title": mapped["title"],
                            "description": mapped["description"],
                            "sku": mapped["sku"],
                            "price": mapped["price"],
                            "currency": mapped["currency"],
                            "url": mapped["url"],
                            "media_url": mapped["media_url"] or existing.data[0].get("media_url", ""),
                            "thumbnail_url": mapped["thumbnail_url"] or existing.data[0].get("thumbnail_url", ""),
                            "metadata": updated_metadata,
                            "updated_at": datetime.now(timezone.utc).isoformat(),
                            "source_updated_at": mapped.get("source_updated_at"),
                            "synced_at": datetime.now(timezone.utc).isoformat(),
                            "catalog_version": mapped.get("catalog_version"),
                            "ingestion_status": updated_metadata.get("_embedding_status", "stale"),
                            "last_ingestion_error": None if updated_metadata.get("_embedding_status") == "ready" else "Embedding generation failed",
                        }
                        if embedding is not None:
                            upd["embedding"] = embedding
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
                                source_updated_at=mapped.get("source_updated_at"),
                                catalog_version=mapped.get("catalog_version"),
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
            .select("id,metadata")
            .eq("bot_id", bot_id)
            .contains("metadata", {"woocommerce_id": wc_id})
            .limit(1)
            .execute()
        )

        if existing and existing.data:
            item_id = existing.data[0]["id"]
            updated_metadata, embedding = await _prepare_product_embedding(
                mapped, existing.data[0].get("metadata")
            )
            upd = {
                "title": mapped["title"],
                "description": mapped["description"],
                "sku": mapped["sku"],
                "price": mapped["price"],
                "currency": mapped["currency"],
                "url": mapped["url"],
                "metadata": updated_metadata,
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "source_updated_at": mapped.get("source_updated_at"),
                "synced_at": datetime.now(timezone.utc).isoformat(),
                "catalog_version": mapped.get("catalog_version"),
                "ingestion_status": updated_metadata.get("_embedding_status", "stale"),
                "last_ingestion_error": None if updated_metadata.get("_embedding_status") == "ready" else "Embedding generation failed",
            }
            if mapped["media_url"]:
                upd["media_url"] = mapped["media_url"]
                upd["thumbnail_url"] = mapped["thumbnail_url"]
            if embedding is not None:
                upd["embedding"] = embedding

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
                source_updated_at=mapped.get("source_updated_at"),
                catalog_version=mapped.get("catalog_version"),
            )
            logger.info("WooCommerce webhook created product %s (%s)", wc_id, mapped["title"])
            return {"event": "created", "id": wc_id}

    return {"ignored": True, "topic": topic}
