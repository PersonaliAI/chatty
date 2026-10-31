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
import os
import re
from datetime import datetime, timezone
from html.parser import HTMLParser
from typing import Any, Optional

import httpx

from app.core.clients import supabase
from app.core.crypto import decrypt_secret, encrypt_secret
from app.core.db import run_db
from app.core import ssrf
from app.services import multimodal_service

logger = logging.getLogger("chatty.woocommerce")
COMMERCE_FRESHNESS_SLO_SECONDS = int(os.environ.get("CHATTY_COMMERCE_FRESHNESS_SLO_SECONDS", "900"))


def _protect(value: str) -> str:
    """Encrypt integration credentials before persistence.

    ``decrypt_secret`` intentionally supports legacy plaintext rows, so an
    existing installation can be upgraded without a destructive migration.
    New writes fail closed when the encryption key is missing.
    """
    return encrypt_secret(value) if value else value


class _HTMLTextExtractor(HTMLParser):
    """Extract text without a backtracking regex over untrusted HTML."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=False)
        self.parts: list[str] = []

    def handle_data(self, data: str) -> None:
        self.parts.append(data)

    def handle_entityref(self, name: str) -> None:
        self.parts.append(f"&{name};")

    def handle_charref(self, name: str) -> None:
        self.parts.append(f"&#{name};")


def _clean_html(raw_html: Optional[str]) -> str:
    """Strip HTML tags and unescape entities for clean AI text indexing."""
    if not raw_html:
        return ""
    parser = _HTMLTextExtractor()
    parser.feed(raw_html)
    parser.close()
    text = " ".join(parser.parts)
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


def catalog_freshness(integration: Optional[dict[str, Any]]) -> dict[str, Any]:
    """Return an operator-facing freshness SLO snapshot for one store."""
    integration = integration or {}
    timestamp = integration.get("catalog_freshness_at")
    age_seconds: Optional[int] = None
    if timestamp:
        try:
            parsed = datetime.fromisoformat(str(timestamp).replace("Z", "+00:00"))
            age_seconds = max(0, int((datetime.now(timezone.utc) - parsed).total_seconds()))
        except (TypeError, ValueError):
            age_seconds = None
    sync_status = str(integration.get("sync_status") or "idle")
    if sync_status == "failed":
        status = "failed"
    elif sync_status == "syncing":
        status = "syncing"
    elif age_seconds is None:
        status = "unknown"
    else:
        status = "fresh" if age_seconds <= COMMERCE_FRESHNESS_SLO_SECONDS else "stale"
    return {
        "catalog_freshness_at": timestamp,
        "freshness_age_seconds": age_seconds,
        "freshness_slo_seconds": COMMERCE_FRESHNESS_SLO_SECONDS,
        "freshness_status": status,
        "last_webhook_at": integration.get("last_webhook_at"),
        "last_sync_started_at": integration.get("last_sync_started_at"),
        "last_sync_completed_at": integration.get("last_sync_completed_at"),
    }


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
        for item, _ in woo_items:
            item["metadata"] = {**(item.get("metadata") or {}), "live_check_status": "unavailable"}
        return items
    store_url = _normalize_store_url(str(integration.get("store_url") or ""))
    consumer_key = str(integration.get("consumer_key") or "").strip()
    consumer_secret = str(integration.get("consumer_secret") or "").strip()
    parsed_store = httpx.URL(store_url)
    if parsed_store.scheme != "https" or not parsed_store.host or not consumer_key or not consumer_secret:
        logger.warning("Skipping live WooCommerce refresh: incomplete secure integration")
        for item, _ in woo_items:
            item["metadata"] = {**(item.get("metadata") or {}), "live_check_status": "unavailable"}
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
            if payload.get("type") == "variable":
                await _fetch_product_variations(
                    client,
                    f"{store_url}/wp-json/wc/v3/products",
                    payload,
                    auth,
                )
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
            metadata["live_variant_ids"] = [
                str(variant.get("id")) for variant in live_metadata["variations"]
                if isinstance(variant, dict) and variant.get("id") is not None
            ]
        else:
            metadata["live_variant_ids"] = []
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
    gallery_urls = [
        str(image.get("src")).strip()
        for image in images[:8]
        if isinstance(image, dict) and image.get("src")
    ]

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
        "gallery_urls": gallery_urls,
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
    mapped: dict[str, Any], existing_metadata: Optional[dict[str, Any]] = None, bot_id: Optional[str] = None
) -> tuple[dict[str, Any], list[float] | None, list[float] | None]:
    """Refresh text and gallery-image embeddings when product facts change."""
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
    vector = (
        await multimodal_service.embed_catalog_item(bot_id=bot_id, **embedding_kwargs)
        if needs_reembed
        else None
    )
    image_urls = [
        str(url) for url in ((mapped.get("metadata") or {}).get("gallery_urls") or [mapped.get("media_url")])
        if url and str(url).startswith(("https://", "http://"))
    ][:multimodal_service.MAX_CATALOG_IMAGES]
    image_fingerprint = multimodal_service.image_embedding_fingerprint(
        image_urls, mapped.get("source_updated_at")
    )
    needs_image_reembed = (
        stored.get("_image_embedding_fingerprint") != image_fingerprint
        or stored.get("_image_embedding_schema") != multimodal_service.IMAGE_EMBEDDING_SCHEMA_VERSION
    )
    image_vector = (
        await multimodal_service.embed_catalog_images(image_urls, bot_id=bot_id)
        if needs_image_reembed
        else None
    )
    status = "ready" if vector or not needs_reembed else "stale"
    updated_metadata = multimodal_service.catalog_metadata_with_embedding(
        mapped.get("metadata"), fingerprint, status=status
    )
    updated_metadata.update({
        "_image_embedding_schema": multimodal_service.IMAGE_EMBEDDING_SCHEMA_VERSION,
        "_image_embedding_model": multimodal_service.IMAGE_EMBEDDING_MODEL,
        "_image_embedding_fingerprint": image_fingerprint,
        "_image_embedding_status": "ready" if image_vector else (
            "stale" if needs_image_reembed else stored.get("_image_embedding_status", "stale")
        ),
        "_image_embedding_count": len(image_urls),
    })
    return updated_metadata, vector if vector else None, image_vector if image_vector else None


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
    next_page: Optional[int] = None,
    mark_started: bool = False,
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
    if next_page is not None:
        fields["sync_page"] = max(1, int(next_page))
        fields["sync_checkpoint_at"] = datetime.now(timezone.utc).isoformat()
    if mark_started:
        fields["last_sync_started_at"] = datetime.now(timezone.utc).isoformat()
    if status == "synced":
        completed_at = datetime.now(timezone.utc).isoformat()
        fields["last_synced_at"] = completed_at
        fields["last_sync_completed_at"] = completed_at
        fields["catalog_freshness_at"] = completed_at
        fields["last_error"] = None
        fields["sync_page"] = 1

    try:
        await run_db(
            lambda: supabase.table("chatty_woocommerce_integrations")
            .update(fields)
            .eq("bot_id", bot_id)
            .execute()
        )
    except Exception:
        logger.warning("Failed to update WooCommerce sync progress", exc_info=True)


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

    prior_status = str(integration.get("sync_status") or "idle")
    stored_page = int(integration.get("sync_page") or 1)
    can_resume = prior_status in {"syncing", "failed"} and stored_page >= 1
    page = stored_page if can_resume else 1
    synced_count = int(integration.get("synced_products") or 0) if can_resume else 0
    total_count = int(integration.get("total_products") or 0) if can_resume else 0
    await _update_sync_progress(
        bot_id,
        status="syncing",
        progress=max(5, int((synced_count / max(total_count, 1)) * 95)) if can_resume else 5,
        synced=synced_count,
        total=total_count,
        next_page=page,
        mark_started=True,
    )

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
                        next_page=page,
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
                        existing_metadata = existing.data[0].get("metadata") or {}
                        updated_metadata, embedding, image_embedding = await _prepare_product_embedding(
                            mapped, existing_metadata, bot_id=bot_id
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
                            "search_text": multimodal_service.build_catalog_search_text(
                                title=mapped["title"],
                                description=mapped["description"],
                                sku=mapped.get("sku"),
                                metadata=mapped.get("metadata"),
                            ),
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
                        elif existing_metadata.get("_embedding_schema") != multimodal_service.EMBEDDING_SCHEMA_VERSION:
                            # Never leave an old-model vector queryable after a
                            # schema/model migration fails. The next retry can
                            # repopulate it without serving incompatible data.
                            upd["embedding"] = None
                        if image_embedding is not None:
                            upd["image_embedding"] = image_embedding
                        elif existing_metadata.get("_image_embedding_schema") != multimodal_service.IMAGE_EMBEDDING_SCHEMA_VERSION:
                            upd["image_embedding"] = None
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

                # Advance the durable checkpoint only after every product on
                # this page has been upserted. A crash before this write makes
                # the retry replay one page, which is safe because imports are
                # keyed by the WooCommerce product id.
                next_page = page + 1
                await _update_sync_progress(
                    bot_id,
                    status="syncing",
                    progress=int((synced_count / max(total_count or 1, synced_count)) * 95),
                    synced=synced_count,
                    total=total_count or synced_count,
                    next_page=next_page,
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
            next_page=page,
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

    async def record_freshness() -> None:
        now = datetime.now(timezone.utc).isoformat()
        try:
            await run_db(
                lambda: supabase.table("chatty_woocommerce_integrations")
                .update({
                    "catalog_freshness_at": now,
                    "last_webhook_at": now,
                    "updated_at": now,
                })
                .eq("bot_id", bot_id)
                .execute()
            )
        except Exception:
            logger.warning("Failed to record WooCommerce freshness", exc_info=True)

    if "deleted" in topic_lower:
        # Delete from chatty_media_items
        res = await run_db(
            lambda: supabase.table("chatty_media_items")
            .delete()
            .eq("bot_id", bot_id)
            .contains("metadata", {"woocommerce_id": wc_id})
            .execute()
        )
        logger.info("WooCommerce webhook deleted product")
        await record_freshness()
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
            existing_metadata = existing.data[0].get("metadata") or {}
            updated_metadata, embedding, image_embedding = await _prepare_product_embedding(
                mapped, existing_metadata, bot_id=bot_id
            )
            upd = {
                "title": mapped["title"],
                "description": mapped["description"],
                "sku": mapped["sku"],
                "price": mapped["price"],
                "currency": mapped["currency"],
                "url": mapped["url"],
                "search_text": multimodal_service.build_catalog_search_text(
                    title=mapped["title"],
                    description=mapped["description"],
                    sku=mapped.get("sku"),
                    metadata=mapped.get("metadata"),
                ),
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
            elif existing_metadata.get("_embedding_schema") != multimodal_service.EMBEDDING_SCHEMA_VERSION:
                upd["embedding"] = None
            if image_embedding is not None:
                upd["image_embedding"] = image_embedding
            elif existing_metadata.get("_image_embedding_schema") != multimodal_service.IMAGE_EMBEDDING_SCHEMA_VERSION:
                upd["image_embedding"] = None

            await run_db(
                lambda: supabase.table("chatty_media_items")
                .update(upd)
                .eq("id", item_id)
                .execute()
            )
            logger.info("WooCommerce webhook updated product")
            await record_freshness()
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
            logger.info("WooCommerce webhook created product")
            await record_freshness()
            return {"event": "created", "id": wc_id}

    if topic_lower.startswith("order."):
        await record_freshness()
        mapped_order = _map_wc_order(payload)
        raw_action = topic_lower.split(".", 1)[1] if "." in topic_lower else "updated"
        allowed_actions = {"created": "created", "updated": "updated", "refunded": "refunded", "deleted": "deleted"}
        action = allowed_actions.get(raw_action, "updated")
        logger.info("WooCommerce order webhook processed")
        return {
            "event": f"order.{action}",
            "id": wc_id,
            "order_number": mapped_order.get("order_number"),
            "status": mapped_order.get("status"),
            "is_split_shipment": mapped_order.get("is_split_shipment", False),
            "is_partial_refund": mapped_order.get("is_partial_refund", False),
            "requires_human_review": mapped_order.get("requires_human_review", False),
        }

    return {"ignored": True, "topic": topic}


_CARRIER_URL_TEMPLATES: dict[str, str] = {
    "ups": "https://www.ups.com/track?tracknum={num}",
    "usps": "https://tools.usps.com/go/TrackConfirmAction?tLabels={num}",
    "fedex": "https://www.fedex.com/fedextrack/?trknbr={num}",
    "dhl": "https://www.dhl.com/en/express/tracking.html?AWB={num}",
    "royal mail": "https://www.royalmail.com/track-your-item#/tracking-results/{num}",
    "royalmail": "https://www.royalmail.com/track-your-item#/tracking-results/{num}",
    "canada post": "https://www.canadapost-postescanada.ca/track-reperage/en#/search?searchFor={num}",
    "australia post": "https://auspost.com.au/mypost/track/#/details/{num}",
}

_ORDER_STATUS_LABELS: dict[str, str] = {
    "pending": "Pending Payment",
    "processing": "Processing",
    "on-hold": "On Hold",
    "completed": "Completed / Shipped",
    "shipped": "Shipped",
    "delivered": "Delivered",
    "cancelled": "Cancelled",
    "refunded": "Refunded",
    "failed": "Payment Failed",
    "partial-refund": "Partially Refunded",
    "partially-shipped": "Partially Shipped",
}


def _build_carrier_tracking_url(carrier: str, tracking_number: str, explicit_url: str = "") -> str:
    """Resolve a direct tracking URL from an explicit link or known carrier template."""
    clean_url = (explicit_url or "").strip()
    if clean_url.startswith(("http://", "https://")):
        return clean_url
    clean_num = (tracking_number or "").strip()
    if not clean_num:
        return ""
    carrier_lower = (carrier or "").strip().lower()
    for key, template in _CARRIER_URL_TEMPLATES.items():
        if key in carrier_lower:
            return template.format(num=clean_num)
    return ""


def _extract_order_tracking(order: dict[str, Any]) -> list[dict[str, Any]]:
    """Extract shipment tracking items from WooCommerce order meta_data and line_items."""
    tracking_list: list[dict[str, Any]] = []
    seen_numbers: set[str] = set()

    def _add_item(carrier: Any, number: Any, url: Any = "", date_shipped: Any = "", item_name: str = "") -> None:
        num_str = str(number or "").strip()
        if not num_str:
            return
        dedup_key = f"{num_str.lower()}:{item_name.lower()}"
        if dedup_key in seen_numbers:
            return
        seen_numbers.add(dedup_key)
        carrier_str = str(carrier or "Carrier").strip() or "Carrier"
        resolved_url = _build_carrier_tracking_url(carrier_str, num_str, str(url or ""))
        entry: dict[str, Any] = {
            "carrier": carrier_str,
            "tracking_number": num_str,
            "tracking_url": resolved_url or None,
        }
        if date_shipped:
            entry["date_shipped"] = str(date_shipped)
        if item_name:
            entry["item_name"] = item_name
        tracking_list.append(entry)

    meta_data = order.get("meta_data") or []
    flat_meta: dict[str, Any] = {}
    for meta in meta_data:
        if not isinstance(meta, dict):
            continue
        m_key = str(meta.get("key") or "").strip()
        m_val = meta.get("value")
        flat_meta[m_key] = m_val

        if m_key in ("_wc_shipment_tracking_items", "wc_shipment_tracking_items", "tracking_items") and isinstance(m_val, list):
            for entry in m_val:
                if isinstance(entry, dict):
                    _add_item(
                        carrier=entry.get("tracking_provider") or entry.get("custom_tracking_provider") or entry.get("carrier"),
                        number=entry.get("tracking_number") or entry.get("number"),
                        url=entry.get("custom_tracking_link") or entry.get("tracking_link") or entry.get("tracking_url"),
                        date_shipped=entry.get("date_shipped"),
                    )

    for num_key in ("_tracking_number", "tracking_number", "_aftership_tracking_number"):
        if flat_meta.get(num_key):
            _add_item(
                carrier=flat_meta.get("_tracking_provider") or flat_meta.get("tracking_provider") or flat_meta.get("_aftership_tracking_provider_name") or "Carrier",
                number=flat_meta.get(num_key),
                url=flat_meta.get("_custom_tracking_link") or flat_meta.get("tracking_url") or "",
            )

    # Also check per-line-item tracking metadata (common in split-shipment plugins)
    for li in (order.get("line_items") or []):
        if not isinstance(li, dict):
            continue
        li_name = str(li.get("name") or "").strip()
        for m in (li.get("meta_data") or []):
            if not isinstance(m, dict):
                continue
            mk = str(m.get("key") or "").strip().lower()
            mv = m.get("value")
            if mk in ("_tracking_number", "tracking_number", "shipment_tracking") and mv:
                _add_item("Carrier", mv, "", "", item_name=li_name)
            elif isinstance(mv, list) and "tracking" in mk:
                for sub in mv:
                    if isinstance(sub, dict) and sub.get("tracking_number"):
                        _add_item(
                            sub.get("tracking_provider") or sub.get("carrier") or "Carrier",
                            sub.get("tracking_number"),
                            sub.get("tracking_link") or sub.get("tracking_url") or "",
                            sub.get("date_shipped") or "",
                            item_name=li_name,
                        )

    return tracking_list


def _map_wc_order(order: dict[str, Any]) -> dict[str, Any]:
    """Normalize a WooCommerce order payload and detect edge cases (split shipments, partial refunds)."""
    order_id = str(order.get("id") or "")
    order_number = str(order.get("number") or order_id)
    status = str(order.get("status") or "processing").strip().lower()
    status_label = _ORDER_STATUS_LABELS.get(status, status.replace("-", " ").title())
    currency = str(order.get("currency") or "USD").upper()
    currency_symbol = str(order.get("currency_symbol") or "$")

    try:
        total = round(float(order.get("total") or 0.0), 2)
    except (TypeError, ValueError):
        total = 0.0

    line_items: list[dict[str, Any]] = []
    fulfillment_statuses: set[str] = set()
    for li in (order.get("line_items") or []):
        if not isinstance(li, dict):
            continue
        li_img = ""
        if isinstance(li.get("image"), dict):
            li_img = str(li["image"].get("src") or "")
        try:
            li_total = round(float(li.get("total") or 0.0), 2)
        except (TypeError, ValueError):
            li_total = 0.0
        li_status = str(li.get("fulfillment_status") or "").strip().lower()
        if li_status:
            fulfillment_statuses.add(li_status)
        line_items.append({
            "id": li.get("id"),
            "name": str(li.get("name") or "Item").strip(),
            "quantity": int(li.get("quantity") or 1),
            "total": li_total,
            "sku": str(li.get("sku") or "") or None,
            "image_url": li_img or None,
            "fulfillment_status": li_status or None,
        })

    tracking = _extract_order_tracking(order)
    unique_tracking_numbers = {t["tracking_number"] for t in tracking if t.get("tracking_number")}

    refunds: list[dict[str, Any]] = []
    refunded_total = 0.0
    for ref in (order.get("refunds") or []):
        if not isinstance(ref, dict):
            continue
        try:
            amt = abs(float(ref.get("total") or 0.0))
        except (TypeError, ValueError):
            amt = 0.0
        if amt > 0:
            refunded_total = round(refunded_total + amt, 2)
            refunds.append({
                "id": ref.get("id"),
                "amount": round(amt, 2),
                "reason": str(ref.get("reason") or "").strip() or None,
            })

    try:
        explicit_refund_total = abs(float(order.get("total_refunded") or 0.0))
        if explicit_refund_total > refunded_total:
            refunded_total = round(explicit_refund_total, 2)
    except (TypeError, ValueError):
        pass

    net_total = round(max(0.0, total - refunded_total), 2)

    meta_flags_split = any(
        isinstance(m, dict)
        and (
            "split" in str(m.get("key") or "").lower()
            or "partial_shipment" in str(m.get("key") or "").lower()
            or "partially-shipped" in str(m.get("value") or "").lower()
        )
        for m in (order.get("meta_data") or [])
    )

    is_split_shipment = (
        len(unique_tracking_numbers) > 1
        or len(fulfillment_statuses) > 1
        or status in ("partially-shipped", "partial-shipped")
        or meta_flags_split
    )
    is_partial_refund = bool(
        (refunded_total > 0 and total > 0 and refunded_total < total)
        or (refunded_total > 0 and status not in ("refunded", "cancelled"))
        or status == "partial-refund"
    )

    edge_case_reasons: list[str] = []
    if is_split_shipment:
        edge_case_reasons.append(f"Split shipment ({max(len(unique_tracking_numbers), 2)} separate packages/fulfillments)")
    if is_partial_refund:
        edge_case_reasons.append(f"Partial refund of {currency_symbol}{refunded_total:.2f} out of {currency_symbol}{total:.2f}")
    if status in ("on-hold", "failed"):
        edge_case_reasons.append(f"Order is currently marked '{status_label}'")

    requires_human_review = bool(edge_case_reasons)

    card_payload = {
        "order_id": order_id,
        "order_number": order_number,
        "status": status,
        "status_label": status_label,
        "date_created": order.get("date_created") or "",
        "total": f"{total:.2f}",
        "refunded_total": f"{refunded_total:.2f}" if refunded_total > 0 else None,
        "net_total": f"{net_total:.2f}",
        "currency": currency,
        "currency_symbol": currency_symbol,
        "line_items": line_items[:8],
        "items": line_items[:8],
        "tracking": tracking[:6],
        "refunds": refunds[:5],
        "is_split_shipment": is_split_shipment,
        "is_partial_refund": is_partial_refund,
        "requires_human_review": requires_human_review,
        "edge_case_reasons": edge_case_reasons,
    }
    order_card_token = f"[ORDER_CARD:{json.dumps(card_payload, separators=(',', ':'))}]"

    return {
        **card_payload,
        "order_card_token": order_card_token,
    }


def _verify_order_customer(
    order: dict[str, Any],
    email: Optional[str] = None,
    phone: Optional[str] = None,
) -> bool:
    """Verify caller identity against the order's billing email or phone number."""
    billing = order.get("billing") or {}
    if not isinstance(billing, dict):
        return False

    order_email = str(billing.get("email") or "").strip().lower()
    caller_email = str(email or "").strip().lower()
    if order_email and caller_email and hmac.compare_digest(order_email, caller_email):
        return True

    order_phone_digits = re.sub(r"[^\d]", "", str(billing.get("phone") or ""))
    caller_phone_digits = re.sub(r"[^\d]", "", str(phone or ""))
    if (
        len(order_phone_digits) >= 4
        and len(caller_phone_digits) >= 4
        and order_phone_digits[-6:] == caller_phone_digits[-6:]
    ):
        return True

    return False


async def lookup_order(
    bot_id: str,
    order_identifier: str,
    email: Optional[str] = None,
    phone: Optional[str] = None,
) -> dict[str, Any]:
    """Look up a live WooCommerce order by ID/number with mandatory customer verification."""
    clean_id = re.sub(r"^[#\s]+", "", str(order_identifier or "").strip())
    clean_id = re.sub(r"(?i)^order\s*#?\s*", "", clean_id).strip()
    if not clean_id:
        return {"found": False, "error": "Please provide an order number."}

    integration = await get_integration(bot_id)
    if not integration:
        return {"found": False, "error": "WooCommerce store integration is not connected for this assistant."}

    store_url = _normalize_store_url(str(integration.get("store_url") or ""))
    consumer_key = str(integration.get("consumer_key") or "").strip()
    consumer_secret = str(integration.get("consumer_secret") or "").strip()
    parsed_store = httpx.URL(store_url)
    if parsed_store.scheme != "https" or not parsed_store.host or not consumer_key or not consumer_secret:
        return {"found": False, "error": "WooCommerce store credentials are incomplete."}

    auth = (consumer_key, consumer_secret)
    timeout = httpx.Timeout(8.0, connect=4.0)
    matched_order: Optional[dict[str, Any]] = None

    async with httpx.AsyncClient(timeout=timeout) as client:
        if clean_id.isdigit():
            direct_url = f"{store_url}/wp-json/wc/v3/orders/{clean_id}"
            try:
                resp = await ssrf.request_async(client, "GET", direct_url, auth=auth)
                if resp.status_code == 200 and isinstance(resp.json(), dict):
                    matched_order = resp.json()
            except Exception as exc:
                logger.warning("WooCommerce direct order lookup failed (%s)", type(exc).__name__)

        if matched_order is None:
            search_url = f"{store_url}/wp-json/wc/v3/orders"
            try:
                resp = await ssrf.request_async(
                    client, "GET", search_url, auth=auth, params={"search": clean_id, "per_page": 10}
                )
                if resp.status_code == 200 and isinstance(resp.json(), list):
                    for candidate in resp.json():
                        if not isinstance(candidate, dict):
                            continue
                        c_id = str(candidate.get("id") or "").strip()
                        c_num = str(candidate.get("number") or "").strip()
                        if c_id.lower() == clean_id.lower() or c_num.lower() == clean_id.lower():
                            matched_order = candidate
                            break
            except Exception as exc:
                logger.warning("WooCommerce order search failed (%s)", type(exc).__name__)

    if not matched_order:
        return {
            "found": False,
            "order_number": clean_id,
            "message": f"No order matching #{clean_id} was found in the store.",
        }

    if not _verify_order_customer(matched_order, email=email, phone=phone):
        return {
            "found": True,
            "verified": False,
            "verification_required": True,
            "order_number": str(matched_order.get("number") or clean_id),
            "message": (
                f"Order #{matched_order.get('number') or clean_id} was located, "
                "but billing verification is required before disclosing order details. "
                "Please ask the customer to confirm the billing email address or phone number used on the order."
            ),
        }

    mapped = _map_wc_order(matched_order)
    return {
        "found": True,
        "verified": True,
        "verification_required": False,
        **mapped,
        "order": mapped,
        "order_card": mapped["order_card_token"],
        "order_card_token": mapped["order_card_token"],
        "requires_human_review": mapped["requires_human_review"],
        "edge_case_reasons": mapped["edge_case_reasons"],
    }



def _item_matches_structured_filters(
    item: dict[str, Any],
    *,
    query: Optional[str] = None,
    sku: Optional[str] = None,
    category: Optional[str] = None,
    tag: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    on_sale: Optional[bool] = None,
    in_stock_only: bool = True,
    attribute_filter: Optional[str] = None,
) -> bool:
    """Evaluate structured commerce filters against a normalized catalog item."""
    meta = item.get("metadata") or {}
    in_stock = bool(meta.get("in_stock", True))
    if in_stock_only and not in_stock:
        return False

    price_val: Optional[float] = None
    for p_candidate in (meta.get("sale_price"), item.get("price"), meta.get("regular_price")):
        if p_candidate not in (None, ""):
            try:
                price_val = float(p_candidate)
                break
            except (TypeError, ValueError):
                continue

    if min_price is not None and (price_val is None or price_val < float(min_price)):
        return False
    if max_price is not None and (price_val is None or price_val > float(max_price)):
        return False

    if on_sale is True:
        is_sale = bool(meta.get("on_sale")) or (
            meta.get("sale_price") not in (None, "")
            and meta.get("regular_price") not in (None, "")
            and float(meta["sale_price"]) < float(meta["regular_price"])
        )
        if not is_sale:
            return False

    if sku:
        sku_q = sku.strip().lower()
        item_sku = str(item.get("sku") or "").strip().lower()
        variant_skus = [
            str(v.get("sku") or "").strip().lower()
            for v in (meta.get("variations") or [])
            if isinstance(v, dict) and v.get("sku")
        ]
        if sku_q not in item_sku and not any(sku_q in vs for vs in variant_skus):
            return False

    if category:
        cat_q = category.strip().lower()
        cats = [str(c).strip().lower() for c in (meta.get("categories") or []) if c]
        if not any(cat_q in c or c in cat_q for c in cats):
            return False

    if tag:
        tag_q = tag.strip().lower()
        tags = [str(t).strip().lower() for t in (meta.get("tags") or []) if t]
        if not any(tag_q in t or t in tag_q for t in tags):
            return False

    if attribute_filter:
        attr_tokens = [tok for tok in re.findall(r"[a-z0-9]+", attribute_filter.lower()) if tok]
        if attr_tokens:
            haystack_parts = [
                str(item.get("title") or ""),
                str(item.get("description") or ""),
                " ".join(str(s) for s in (meta.get("sizes") or [])),
            ]
            for attr in (meta.get("attributes") or []):
                if isinstance(attr, dict):
                    haystack_parts.append(str(attr.get("name") or ""))
                    haystack_parts.extend(str(o) for o in (attr.get("options") or []))
            for v in (meta.get("variations") or []):
                if isinstance(v, dict):
                    if in_stock_only and not v.get("in_stock", v.get("stock_status") == "instock"):
                        continue
                    for va in (v.get("attributes") or []):
                        if isinstance(va, dict):
                            haystack_parts.append(f"{va.get('name', '')} {va.get('option', '')}")
            haystack = " ".join(haystack_parts).lower()
            if not all(tok in haystack for tok in attr_tokens):
                return False

    if query:
        q_tokens = [
            tok for tok in re.findall(r"[a-z0-9]+", query.lower())
            if len(tok) > 1 and tok not in {"the", "and", "for", "with", "under", "over", "below", "above", "from", "show", "items", "products", "product"}
        ]
        if q_tokens:
            searchable = " ".join([
                str(item.get("title") or ""),
                str(item.get("description") or ""),
                str(item.get("sku") or ""),
                " ".join(str(c) for c in (meta.get("categories") or [])),
                " ".join(str(t) for t in (meta.get("tags") or [])),
            ]).lower()
            if not any(tok in searchable for tok in q_tokens):
                return False

    return True


async def search_products_live(
    bot_id: str,
    *,
    query: Optional[str] = None,
    product_id: Optional[str] = None,
    sku: Optional[str] = None,
    category: Optional[str] = None,
    tag: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    on_sale: Optional[bool] = None,
    featured: Optional[bool] = None,
    in_stock_only: bool = True,
    attribute_filter: Optional[str] = None,
    sort_by: str = "relevance",
    limit: int = 5,
) -> dict[str, Any]:
    """Read-Only Agentic WooCommerce Product Search & Filter Engine.

    Combines live WooCommerce REST API queries (`/wp-json/wc/v3/products` with
    server-side filters, category resolution, and variation hydration) and
    indexed multimodal catalog filtering so the AI agent can answer any
    product, price-range, sale, SKU, category, or variant question accurately.
    """
    capped_limit = max(1, min(int(limit or 5), 8))
    clean_query = (query or "").strip() or None
    clean_product_id = re.sub(r"[^0-9]", "", str(product_id or "").strip()) or None
    clean_sku = (sku or "").strip() or None
    clean_category = (category or "").strip() or None
    clean_tag = (tag or "").strip() or None
    clean_attr = (attribute_filter or "").strip() or None
    clean_sort = (sort_by or "relevance").strip().lower()

    integration = await get_integration(bot_id)
    currency = "USD"
    live_items: list[dict[str, Any]] = []
    checked_at = datetime.now(timezone.utc).isoformat()

    # ------------------------------------------------------------------
    # Stage 1: Live WooCommerce REST API Filtered Query (Read-Only GET)
    # ------------------------------------------------------------------
    if integration:
        store_url = _normalize_store_url(str(integration.get("store_url") or ""))
        consumer_key = str(integration.get("consumer_key") or "").strip()
        consumer_secret = str(integration.get("consumer_secret") or "").strip()
        parsed_store = httpx.URL(store_url) if store_url else None

        if parsed_store and parsed_store.scheme == "https" and parsed_store.host and consumer_key and consumer_secret:
            auth = (consumer_key, consumer_secret)
            timeout = httpx.Timeout(8.0, connect=3.5)
            products_api = f"{store_url}/wp-json/wc/v3/products"

            async with httpx.AsyncClient(timeout=timeout) as client:
                raw_products: list[dict[str, Any]] = []
                try:
                    if clean_product_id:
                        resp = await ssrf.request_async(
                            client, "GET", f"{products_api}/{clean_product_id}", auth=auth
                        )
                        if resp.status_code == 200 and isinstance(resp.json(), dict):
                            raw_products = [resp.json()]
                    else:
                        params: dict[str, Any] = {
                            "status": "publish",
                            "per_page": min(max(capped_limit * 3, 12), 30),
                        }
                        if clean_query:
                            params["search"] = clean_query
                        if clean_sku:
                            params["sku"] = clean_sku
                        if min_price is not None:
                            params["min_price"] = str(min_price)
                        if max_price is not None:
                            params["max_price"] = str(max_price)
                        if on_sale is True:
                            params["on_sale"] = "true"
                        if featured is True:
                            params["featured"] = "true"
                        if in_stock_only:
                            params["stock_status"] = "instock"

                        if clean_sort == "price_asc":
                            params["orderby"] = "price"
                            params["order"] = "asc"
                        elif clean_sort == "price_desc":
                            params["orderby"] = "price"
                            params["order"] = "desc"
                        elif clean_sort == "popularity":
                            params["orderby"] = "popularity"
                            params["order"] = "desc"
                        elif clean_sort == "rating":
                            params["orderby"] = "rating"
                            params["order"] = "desc"
                        elif clean_sort == "newest":
                            params["orderby"] = "date"
                            params["order"] = "desc"

                        if clean_category:
                            if clean_category.isdigit():
                                params["category"] = clean_category
                            else:
                                try:
                                    cat_resp = await ssrf.request_async(
                                        client,
                                        "GET",
                                        f"{products_api}/categories",
                                        auth=auth,
                                        params={"search": clean_category, "per_page": 10},
                                    )
                                    if cat_resp.status_code == 200 and isinstance(cat_resp.json(), list) and cat_resp.json():
                                        best_cat = cat_resp.json()[0]
                                        if isinstance(best_cat, dict) and best_cat.get("id"):
                                            params["category"] = str(best_cat["id"])
                                except Exception:
                                    pass

                        resp = await ssrf.request_async(client, "GET", products_api, auth=auth, params=params)
                        if resp.status_code == 200 and isinstance(resp.json(), list):
                            raw_products = [p for p in resp.json() if isinstance(p, dict)]

                        if not raw_products and clean_query and any([clean_category, min_price is not None, max_price is not None, on_sale]):
                            fallback_params = {k: v for k, v in params.items() if k != "search"}
                            resp2 = await ssrf.request_async(client, "GET", products_api, auth=auth, params=fallback_params)
                            if resp2.status_code == 200 and isinstance(resp2.json(), list):
                                raw_products = [p for p in resp2.json() if isinstance(p, dict)]

                    hydrated_count = 0
                    for raw_prod in raw_products:
                        if raw_prod.get("type") == "variable" and hydrated_count < capped_limit:
                            await _fetch_product_variations(client, products_api, raw_prod, auth)
                            hydrated_count += 1
                        mapped = _map_wc_product(raw_prod, currency=currency)
                        wc_id = (mapped.get("metadata") or {}).get("woocommerce_id")
                        mapped["id"] = str(wc_id or raw_prod.get("id") or "")
                        meta = dict(mapped.get("metadata") or {})
                        meta["average_rating"] = raw_prod.get("average_rating")
                        meta["rating_count"] = raw_prod.get("rating_count")
                        meta["live_check_status"] = "fresh"
                        meta["live_checked_at"] = checked_at
                        meta["live_variant_ids"] = [
                            str(v.get("id"))
                            for v in (meta.get("variations") or [])
                            if isinstance(v, dict) and v.get("id") is not None
                        ]
                        mapped["metadata"] = meta
                        if _item_matches_structured_filters(
                            mapped,
                            query=None if clean_product_id else clean_query,
                            sku=clean_sku,
                            category=clean_category,
                            tag=clean_tag,
                            min_price=min_price,
                            max_price=max_price,
                            on_sale=on_sale,
                            in_stock_only=in_stock_only,
                            attribute_filter=clean_attr,
                        ):
                            live_items.append(mapped)
                except Exception as exc:
                    logger.warning("WooCommerce live product search fallback triggered (%s)", type(exc).__name__)

    # ------------------------------------------------------------------
    # Stage 2: Indexed Catalog (`chatty_media_items`) Structured Filter
    # ------------------------------------------------------------------
    indexed_items: list[dict[str, Any]] = []
    if len(live_items) < capped_limit:
        try:
            res_db = await run_db(
                lambda: supabase.table("chatty_media_items")
                .select("*")
                .eq("bot_id", bot_id)
                .limit(120)
                .execute()
            )
            candidates = []
            for row in (res_db.data or []):
                if clean_product_id:
                    row_wc_id = str((row.get("metadata") or {}).get("woocommerce_id") or "")
                    if str(row.get("id")) != clean_product_id and row_wc_id != clean_product_id:
                        continue
                if _item_matches_structured_filters(
                    row,
                    query=None if clean_product_id else clean_query,
                    sku=clean_sku,
                    category=clean_category,
                    tag=clean_tag,
                    min_price=min_price,
                    max_price=max_price,
                    on_sale=on_sale,
                    in_stock_only=in_stock_only,
                    attribute_filter=clean_attr,
                ):
                    candidates.append(row)

            if candidates and integration:
                candidates = await refresh_live_product_facts(
                    bot_id, candidates[: capped_limit], max_items=min(capped_limit, 6)
                )
            indexed_items = candidates
        except Exception as exc:
            logger.warning("Indexed catalog structured filter fallback warning (%s)", type(exc).__name__)

    merged: list[dict[str, Any]] = []
    seen_keys: set[str] = set()
    for item in [*live_items, *indexed_items]:
        meta = item.get("metadata") or {}
        dedup_key = str(meta.get("woocommerce_id") or item.get("id") or item.get("title") or "").strip().lower()
        if not dedup_key or dedup_key in seen_keys:
            continue
        seen_keys.add(dedup_key)
        merged.append(item)

    def _effective_price(it: dict[str, Any]) -> float:
        m = it.get("metadata") or {}
        for p in (m.get("sale_price"), it.get("price"), m.get("regular_price")):
            if p not in (None, ""):
                try:
                    return float(p)
                except (TypeError, ValueError):
                    continue
        return 999999.0

    if clean_sort == "price_asc":
        merged.sort(key=_effective_price)
    elif clean_sort == "price_desc":
        merged.sort(key=_effective_price, reverse=True)

    final_items = merged[:capped_limit]
    formatted_products: list[dict[str, Any]] = []

    for item in final_items:
        meta = item.get("metadata") or {}
        wc_id = meta.get("woocommerce_id")
        cat_id = str(item.get("id") or wc_id or "")
        variations = [v for v in (meta.get("variations") or []) if isinstance(v, dict)]

        chosen_variant = None
        if variations:
            chosen_variant = multimodal_service._resolve_variant_from_query(
                variations, f"{clean_query or ''} {clean_attr or ''}".strip()
            )
            if chosen_variant is None and len(variations) == 1:
                chosen_variant = variations[0]

        card_price = (
            (chosen_variant.get("sale_price") or chosen_variant.get("price"))
            if chosen_variant
            else (meta.get("sale_price") or item.get("price"))
        )
        card_url = (chosen_variant.get("url") if chosen_variant else None) or item.get("url") or ""
        card_in_stock = (
            bool(chosen_variant.get("in_stock", chosen_variant.get("stock_status") == "instock"))
            if chosen_variant
            else bool(meta.get("in_stock", True))
        )

        card_payload = {
            "id": cat_id,
            "variant_id": str(chosen_variant.get("id") or "") if chosen_variant else "",
            "variant_sku": str(chosen_variant.get("sku") or "") if chosen_variant else "",
            "title": str(item.get("title") or "Product")[:240],
            "price": card_price,
            "currency": str(item.get("currency") or currency)[:12],
            "url": card_url,
            "image_url": str(item.get("thumbnail_url") or item.get("media_url") or ""),
            "in_stock": card_in_stock,
        }
        product_card_token = (
            f"[PRODUCT_CARD:{json.dumps(card_payload)}]"
            if (not variations or chosen_variant is not None)
            else None
        )

        formatted_products.append({
            "id": cat_id,
            "woocommerce_id": wc_id,
            "title": item.get("title"),
            "sku": item.get("sku"),
            "price": card_price,
            "regular_price": meta.get("regular_price"),
            "sale_price": meta.get("sale_price"),
            "on_sale": bool(meta.get("on_sale")),
            "currency": item.get("currency") or currency,
            "in_stock": card_in_stock,
            "stock_status": meta.get("stock_status", "instock"),
            "categories": meta.get("categories") or [],
            "tags": meta.get("tags") or [],
            "short_description": (item.get("description") or "")[:360],
            "url": card_url,
            "image_url": item.get("thumbnail_url") or item.get("media_url") or "",
            "average_rating": meta.get("average_rating"),
            "rating_count": meta.get("rating_count"),
            "has_variations": bool(variations),
            "variations": [
                {
                    "id": v.get("id"),
                    "sku": v.get("sku"),
                    "price": v.get("sale_price") or v.get("price"),
                    "regular_price": v.get("regular_price"),
                    "in_stock": v.get("in_stock", v.get("stock_status") == "instock"),
                    "attributes": [
                        f"{a.get('name')}: {a.get('option')}"
                        for a in (v.get("attributes") or [])
                        if isinstance(a, dict) and a.get("option")
                    ],
                    "url": v.get("url") or item.get("url"),
                }
                for v in variations[:15]
            ],
            "product_card_token": product_card_token,
        })

    return {
        "found": len(formatted_products) > 0,
        "count": len(formatted_products),
        "applied_filters": {
            k: v
            for k, v in {
                "query": clean_query,
                "product_id": clean_product_id,
                "sku": clean_sku,
                "category": clean_category,
                "tag": clean_tag,
                "min_price": min_price,
                "max_price": max_price,
                "on_sale": on_sale,
                "featured": featured,
                "in_stock_only": in_stock_only,
                "attribute_filter": clean_attr,
                "sort_by": clean_sort,
            }.items()
            if v is not None
        },
        "products": formatted_products,
        "_catalog_items": final_items,
    }


async def get_store_info_live(
    bot_id: str,
    *,
    info_type: str = "categories",
    coupon_code: Optional[str] = None,
    product_id: Optional[str] = None,
) -> dict[str, Any]:
    """Read-Only Live WooCommerce Store Metadata Inspector.

    Supports:
    - `info_type='categories'`: List active store product categories & counts.
    - `info_type='coupon'`: Validate a specific customer-supplied `coupon_code` (discount, expiry, min spend).
    - `info_type='reviews'`: Fetch approved customer reviews for a `product_id`.
    - `info_type='shipping'`: Fetch active shipping zones, locations, and shipping methods/rates.
    """
    integration = await get_integration(bot_id)
    if not integration:
        return {"found": False, "error": "WooCommerce store integration is not connected for this assistant."}

    store_url = _normalize_store_url(str(integration.get("store_url") or ""))
    consumer_key = str(integration.get("consumer_key") or "").strip()
    consumer_secret = str(integration.get("consumer_secret") or "").strip()
    parsed_store = httpx.URL(store_url) if store_url else None
    if not parsed_store or parsed_store.scheme != "https" or not parsed_store.host or not consumer_key or not consumer_secret:
        return {"found": False, "error": "WooCommerce store credentials are incomplete."}

    auth = (consumer_key, consumer_secret)
    timeout = httpx.Timeout(8.0, connect=4.0)
    clean_type = (info_type or "categories").strip().lower()

    async with httpx.AsyncClient(timeout=timeout) as client:
        if clean_type == "categories":
            try:
                resp = await ssrf.request_async(
                    client,
                    "GET",
                    f"{store_url}/wp-json/wc/v3/products/categories",
                    auth=auth,
                    params={"per_page": 50, "hide_empty": "true"},
                )
                if resp.status_code == 200 and isinstance(resp.json(), list):
                    categories = [
                        {
                            "id": c.get("id"),
                            "name": _clean_html(c.get("name")),
                            "slug": c.get("slug"),
                            "count": c.get("count", 0),
                            "description": _clean_html(c.get("description"))[:240],
                        }
                        for c in resp.json()
                        if isinstance(c, dict) and c.get("name")
                    ]
                    return {"found": True, "info_type": "categories", "count": len(categories), "categories": categories}
            except Exception as exc:
                logger.warning("WooCommerce categories lookup failed (%s)", type(exc).__name__)
            return {"found": False, "info_type": "categories", "error": "Unable to fetch store categories right now."}

        if clean_type == "coupon":
            code_clean = (coupon_code or "").strip()
            if not code_clean:
                return {
                    "found": False,
                    "info_type": "coupon",
                    "error": "Please ask the customer for the specific coupon or promo code they want to check.",
                }
            try:
                resp = await ssrf.request_async(
                    client,
                    "GET",
                    f"{store_url}/wp-json/wc/v3/coupons",
                    auth=auth,
                    params={"code": code_clean},
                )
                if resp.status_code == 200 and isinstance(resp.json(), list) and resp.json():
                    c = resp.json()[0]
                    if isinstance(c, dict):
                        expires = c.get("date_expires_gmt") or c.get("date_expires")
                        is_expired = False
                        if expires:
                            try:
                                exp_dt = datetime.fromisoformat(str(expires).replace("Z", "+00:00"))
                                if exp_dt.tzinfo is None:
                                    exp_dt = exp_dt.replace(tzinfo=timezone.utc)
                                is_expired = exp_dt < datetime.now(timezone.utc)
                            except ValueError:
                                pass
                        usage_limit = c.get("usage_limit")
                        usage_count = int(c.get("usage_count") or 0)
                        limit_reached = bool(usage_limit is not None and usage_count >= int(usage_limit))
                        is_valid = not is_expired and not limit_reached
                        return {
                            "found": True,
                            "info_type": "coupon",
                            "code": c.get("code"),
                            "valid": is_valid,
                            "is_expired": is_expired,
                            "usage_limit_reached": limit_reached,
                            "discount_type": c.get("discount_type"),
                            "amount": c.get("amount"),
                            "description": _clean_html(c.get("description")),
                            "minimum_amount": c.get("minimum_amount"),
                            "maximum_amount": c.get("maximum_amount"),
                            "free_shipping": bool(c.get("free_shipping")),
                            "individual_use": bool(c.get("individual_use")),
                            "exclude_sale_items": bool(c.get("exclude_sale_items")),
                            "date_expires": expires,
                        }
                return {
                    "found": False,
                    "info_type": "coupon",
                    "code": code_clean,
                    "valid": False,
                    "message": f"Coupon code '{code_clean}' was not found or is not active.",
                }
            except Exception as exc:
                logger.warning("WooCommerce coupon lookup failed (%s)", type(exc).__name__)
                return {"found": False, "info_type": "coupon", "error": "Unable to verify coupon code right now."}

        if clean_type == "reviews":
            clean_pid = re.sub(r"[^0-9]", "", str(product_id or "").strip())
            params_rev: dict[str, Any] = {"per_page": 10, "status": "approved"}
            if clean_pid:
                params_rev["product"] = clean_pid
            try:
                resp = await ssrf.request_async(
                    client,
                    "GET",
                    f"{store_url}/wp-json/wc/v3/products/reviews",
                    auth=auth,
                    params=params_rev,
                )
                if resp.status_code == 200 and isinstance(resp.json(), list):
                    reviews = [
                        {
                            "id": r.get("id"),
                            "product_id": r.get("product_id"),
                            "product_name": _clean_html(r.get("product_name")),
                            "reviewer": r.get("reviewer"),
                            "rating": r.get("rating"),
                            "verified": bool(r.get("verified")),
                            "review": _clean_html(r.get("review"))[:400],
                            "date_created": r.get("date_created"),
                        }
                        for r in resp.json()
                        if isinstance(r, dict)
                    ]
                    return {"found": True, "info_type": "reviews", "count": len(reviews), "reviews": reviews}
            except Exception as exc:
                logger.warning("WooCommerce reviews lookup failed (%s)", type(exc).__name__)
            return {"found": False, "info_type": "reviews", "error": "Unable to fetch product reviews right now."}

        if clean_type == "shipping":
            try:
                zones_resp = await ssrf.request_async(
                    client, "GET", f"{store_url}/wp-json/wc/v3/shipping/zones", auth=auth
                )
                if zones_resp.status_code == 200 and isinstance(zones_resp.json(), list):
                    zones_out = []
                    for z in zones_resp.json()[:8]:
                        if not isinstance(z, dict) or z.get("id") is None:
                            continue
                        zid = z["id"]
                        methods_resp = await ssrf.request_async(
                            client, "GET", f"{store_url}/wp-json/wc/v3/shipping/zones/{zid}/methods", auth=auth
                        )
                        methods_list = []
                        if methods_resp.status_code == 200 and isinstance(methods_resp.json(), list):
                            for m in methods_resp.json():
                                if not isinstance(m, dict) or not m.get("enabled"):
                                    continue
                                settings = m.get("settings") or {}
                                cost = (settings.get("cost") or {}).get("value") if isinstance(settings.get("cost"), dict) else None
                                min_amount = (settings.get("min_amount") or {}).get("value") if isinstance(settings.get("min_amount"), dict) else None
                                methods_list.append({
                                    "title": m.get("title") or m.get("method_title"),
                                    "method_id": m.get("method_id"),
                                    "cost": cost,
                                    "min_amount_for_free_shipping": min_amount,
                                })
                        zones_out.append({
                            "zone_id": zid,
                            "zone_name": z.get("name"),
                            "methods": methods_list,
                        })
                    return {"found": True, "info_type": "shipping", "zones": zones_out}
            except Exception as exc:
                logger.warning("WooCommerce shipping lookup failed (%s)", type(exc).__name__)
            return {"found": False, "info_type": "shipping", "error": "Unable to fetch live shipping zones right now."}

    return {"found": False, "error": f"Unsupported info_type: {clean_type}"}


async def auto_register_webhooks(
    store_url: str,
    consumer_key: str,
    consumer_secret: str,
    webhook_url: str,
    webhook_secret: str,
) -> dict[str, Any]:
    """Attempt to automatically register product.created, product.updated, and product.deleted
    webhooks on the WooCommerce store via REST API (/wp-json/wc/v3/webhooks).
    Requires Read/Write REST API keys; gracefully reports manual fallback if keys are Read-Only.
    """
    base_url = _normalize_store_url(store_url)
    webhooks_api = f"{base_url}/wp-json/wc/v3/webhooks"
    auth = (consumer_key.strip(), consumer_secret.strip())
    timeout = httpx.Timeout(15.0, connect=10.0)
    topics = ["product.created", "product.updated", "product.deleted"]
    registered_topics: list[str] = []

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            list_resp = await ssrf.request_async(
                client, "GET", webhooks_api, auth=auth, params={"per_page": 50}
            )
            existing_by_topic: dict[str, str] = {}
            if list_resp.status_code == 200 and isinstance(list_resp.json(), list):
                for hook in list_resp.json():
                    if not isinstance(hook, dict):
                        continue
                    delivery = str(hook.get("delivery_url") or "").strip().rstrip("/")
                    topic = str(hook.get("topic") or "").strip()
                    status = str(hook.get("status") or "").strip()
                    if delivery == webhook_url.rstrip("/") and topic in topics and status == "active":
                        existing_by_topic[topic] = str(hook.get("id") or "")

            for topic in topics:
                if topic in existing_by_topic:
                    registered_topics.append(topic)
                    continue
                create_resp = await ssrf.request_async(
                    client,
                    "POST",
                    webhooks_api,
                    auth=auth,
                    json={
                        "name": f"Chatty AI Sync ({topic})",
                        "topic": topic,
                        "delivery_url": webhook_url,
                        "secret": webhook_secret,
                        "status": "active",
                    },
                )
                if create_resp.status_code in (200, 201):
                    registered_topics.append(topic)
                elif create_resp.status_code in (401, 403):
                    return {
                        "auto_configured": False,
                        "registered_topics": registered_topics,
                        "reason": (
                            "WooCommerce REST API key has Read-Only permissions. "
                            "To auto-register webhooks with 1 click, set key permissions to Read/Write in WooCommerce, "
                            "or add the Webhook URL manually in WooCommerce -> Settings -> Advanced -> Webhooks."
                        ),
                    }
                else:
                    return {
                        "auto_configured": False,
                        "registered_topics": registered_topics,
                        "reason": f"WooCommerce returned HTTP {create_resp.status_code} when registering {topic}.",
                    }

            return {
                "auto_configured": len(registered_topics) == len(topics),
                "registered_topics": registered_topics,
                "reason": None,
            }
    except Exception as exc:
        logger.warning("WooCommerce auto_register_webhooks failed (%s)", type(exc).__name__)
        return {
            "auto_configured": False,
            "registered_topics": registered_topics,
            "reason": str(exc),
        }
