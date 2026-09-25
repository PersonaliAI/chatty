"""Multimodal RAG (MM-RAG) Service for Chatty.

Provides:
- Visual analysis of customer photos/screenshots (apparel, products, diagrams).
- Vector indexing and retrieval for products, images, and video keyframes (768-d).
- Hybrid search combining visual feature decomposition and semantic vector similarity.
- Grounded prompt formatting for interactive product cards and video clips.
"""

from __future__ import annotations

import base64
import asyncio
import hashlib
import json
import logging
import math
import os
import re
from datetime import datetime, timezone
from typing import Any, Optional

import httpx
from google.genai import types

from app.core.clients import genai_client, supabase
from app.core.db import run_db
from app.core.config import GEMINI_FALLBACK_MODELS, MODEL_NAME
from app.core import ssrf
from plugins import ai_client
from plugins import memory as mem

logger = logging.getLogger("chatty.multimodal")

EMBEDDING_SCHEMA_VERSION = "catalog-text-v1"
IMAGE_EMBEDDING_SCHEMA_VERSION = "catalog-image-v1"
IMAGE_EMBEDDING_MODEL = os.environ.get("KIN_IMAGE_EMBED_MODEL", "gemini-embedding-2")
MAX_CATALOG_IMAGE_BYTES = 5 * 1024 * 1024
MAX_CATALOG_IMAGES = 8
MAX_CATALOG_RESULTS = 20
FALLBACK_MIN_SCORE = 0.3
_PRODUCT_CARD_RE = re.compile(r"\[PRODUCT_CARD:(\{.*?\})\]", re.DOTALL)

VISION_ANALYSIS_PROMPT = """Analyze this image in detail for an e-commerce / product catalog search system.
The user is asking a question or looking for this item (e.g. clothing, footwear, accessory, electronics, or product).

Return ONLY a valid JSON object with these keys (no markdown fences, no extra text):
{
  "category": "e.g. clothing, footwear, electronics, accessories, home",
  "item_type": "e.g. floral midi dress, high-top sneakers, oversized hoodie, leather crossbody bag",
  "primary_colors": ["color1", "color2"],
  "pattern": "e.g. floral, solid, striped, plaid, graphic, animal print",
  "material_look": "e.g. cotton, silk, denim, leather, knit, polyester",
  "style_and_cut": "e.g. puff sleeves, square neckline, slim fit, A-line, cropped",
  "brand_or_logos": "any visible brand text or null",
  "search_query": "concise keyword search query capturing the essential visual attributes",
  "detailed_description": "1-2 sentence visual summary of the item"
}
"""


async def analyze_visual_query(
    image_bytes: bytes,
    mime_type: str = "image/jpeg",
    user_text: str = "",
) -> dict[str, Any]:
    """Inspect user-uploaded image via Gemini Vision and extract structured visual attributes."""
    if not image_bytes:
        return {}

    b64_img = base64.b64encode(image_bytes).decode("utf-8")
    data_url = f"data:{mime_type};base64,{b64_img}"

    messages = [
        {
            "role": "user",
            "content": [
                {
                    "type": "text",
                    "text": (
                        f"{VISION_ANALYSIS_PROMPT}\n"
                        f"User's accompanying text (if any): '{user_text}'"
                    ),
                },
                {"type": "image_url", "image_url": {"url": data_url}},
            ],
        }
    ]

    try:
        model = ai_client.resolve_gemini_model(MODEL_NAME)
        response = await ai_client.chat(
            model=model,
            fallback_models=[ai_client.resolve_gemini_model(m) for m in GEMINI_FALLBACK_MODELS],
            messages=messages,
            temperature=0.1,
            max_tokens=500,
            call_type="multimodal_query_analysis",
        )
        content = (response.choices[0].message.content or "").strip()
        # Strip potential markdown code blocks
        if content.startswith("```"):
            lines = content.splitlines()
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].strip() == "```":
                lines = lines[:-1]
            content = "\n".join(lines).strip()

        return json.loads(content)
    except Exception as exc:
        logger.warning("Failed to analyze visual query with VLM: %s", exc)
        return {
            "search_query": user_text or "product item",
            "detailed_description": user_text or "User uploaded an item photo.",
        }


async def embed_multimodal_text(text: str) -> list[float]:
    """Generate 768-d embedding for catalog indexing or query matching."""
    text = (text or "").strip()
    if not text:
        return []
    try:
        vectors = await mem._embed_with_retry([text], is_query=True)
        return vectors[0] if vectors else []
    except Exception as exc:
        logger.error("Failed to embed text: %s", exc)
        return []


async def embed_image_bytes(image_bytes: bytes, mime_type: str = "image/jpeg") -> list[float]:
    """Embed an image in Gemini's shared text/image embedding space."""
    if not image_bytes or not mime_type.lower().startswith("image/"):
        return []
    if len(image_bytes) > MAX_CATALOG_IMAGE_BYTES:
        logger.warning("Skipping image embedding over %d bytes", MAX_CATALOG_IMAGE_BYTES)
        return []

    def _embed() -> list[float]:
        result = genai_client.models.embed_content(
            model=IMAGE_EMBEDDING_MODEL,
            contents=[types.Part.from_bytes(data=image_bytes, mime_type=mime_type)],
            config=types.EmbedContentConfig(output_dimensionality=mem.EMBED_DIMENSIONS),
        )
        embeddings = getattr(result, "embeddings", None) or []
        values = getattr(embeddings[0], "values", None) if embeddings else None
        if not values and embeddings and isinstance(embeddings[0], dict):
            values = embeddings[0].get("values")
        if not values:
            return []
        return mem._fit_embedding_dimensions(list(values))

    try:
        return await asyncio.to_thread(_embed)
    except Exception as exc:
        logger.warning("Failed to embed catalog image with %s: %s", IMAGE_EMBEDDING_MODEL, exc)
        return []


async def embed_catalog_images(image_urls: list[str]) -> list[float]:
    """Fetch and aggregate bounded gallery-image embeddings for one catalog item."""
    urls = [str(url).strip() for url in image_urls if str(url).strip()][:MAX_CATALOG_IMAGES]
    if not urls:
        return []
    vectors: list[list[float]] = []
    timeout = httpx.Timeout(8.0, connect=3.0)
    async with httpx.AsyncClient(timeout=timeout, follow_redirects=False) as client:
        for url in urls:
            try:
                response = await ssrf.request_async(client, "GET", url)
                if response.status_code != 200 or len(response.content) > MAX_CATALOG_IMAGE_BYTES:
                    continue
                mime_type = response.headers.get("content-type", "").split(";", 1)[0].strip().lower()
                if not mime_type.startswith("image/"):
                    continue
                vector = await embed_image_bytes(response.content, mime_type)
                if vector:
                    vectors.append(vector)
            except Exception as exc:
                logger.info("Catalog image embedding unavailable for %s: %s", url, exc)
    if not vectors:
        return []
    mean = [sum(vector[index] for vector in vectors) / len(vectors) for index in range(len(vectors[0]))]
    norm = math.sqrt(sum(value * value for value in mean))
    return [value / norm for value in mean] if norm else mean


def image_embedding_fingerprint(image_urls: list[str], source_updated_at: Optional[str] = None) -> str:
    payload = json.dumps({"urls": image_urls[:MAX_CATALOG_IMAGES], "updated": source_updated_at}, sort_keys=True)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def _catalog_source_metadata(metadata: Optional[dict[str, Any]]) -> dict[str, Any]:
    return {
        str(key): value
        for key, value in (metadata or {}).items()
        if not str(key).startswith(("_embedding_", "_image_embedding_"))
    }


def build_catalog_embedding_text(
    *,
    title: str,
    description: str = "",
    sku: Optional[str] = None,
    visual_attributes: Optional[dict[str, Any]] = None,
    metadata: Optional[dict[str, Any]] = None,
) -> str:
    """Build the stable source text used for catalog document embeddings."""
    parts = [title]
    if description:
        parts.append(description)
    if sku:
        parts.append(f"SKU: {sku}")
    if visual_attributes:
        attrs = ", ".join(f"{key}: {value}" for key, value in visual_attributes.items() if value)
        if attrs:
            parts.append(attrs)
    source_metadata = _catalog_source_metadata(metadata)
    if source_metadata:
        parts.append(json.dumps(source_metadata, sort_keys=True, default=str, separators=(",", ":")))
    return " | ".join(str(part) for part in parts if part).strip()


def catalog_embedding_fingerprint(**kwargs: Any) -> str:
    source = build_catalog_embedding_text(**kwargs)
    return hashlib.sha256(source.encode("utf-8")).hexdigest()


def catalog_metadata_with_embedding(
    metadata: Optional[dict[str, Any]],
    fingerprint: str,
    *,
    status: str,
) -> dict[str, Any]:
    enriched = dict(metadata or {})
    enriched.update({
        "_embedding_schema": EMBEDDING_SCHEMA_VERSION,
        "_embedding_model": mem.EMBED_MODEL,
        "_embedding_dimensions": mem.EMBED_DIMENSIONS,
        "_embedding_fingerprint": fingerprint,
        "_embedding_status": status,
    })
    return enriched


async def embed_catalog_item(**kwargs: Any) -> list[float]:
    """Embed catalog source fields using the same document pipeline as ingest."""
    text = build_catalog_embedding_text(**kwargs)
    if not text:
        return []
    try:
        vectors = await mem._embed_with_retry(
            [text], is_query=False, titles=[kwargs.get("title")]
        )
        return vectors[0] if vectors else []
    except Exception as exc:
        logger.error("Failed to embed catalog item: %s", exc)
        return []


def catalog_item_is_recommendable(item: dict[str, Any], *, in_stock_only: bool = True) -> bool:
    """Apply the safety policy shared by vector and lexical catalog retrieval."""
    metadata = item.get("metadata") or {}
    status = str(metadata.get("status") or "publish").strip().lower()
    if status not in {"publish", "published", "active"}:
        return False
    if not in_stock_only:
        return True
    stock_status = str(metadata.get("stock_status") or "").strip().lower()
    in_stock = metadata.get("in_stock")
    if in_stock is None and stock_status:
        in_stock = stock_status == "instock"
    return bool(True if in_stock is None else in_stock)


def catalog_similarity_meets_threshold(item: dict[str, Any], threshold: float) -> bool:
    try:
        return float(item.get("similarity") or 0.0) >= threshold
    except (TypeError, ValueError):
        return False


async def search_multimodal_catalog(
    *,
    bot_id: str,
    image_bytes: Optional[bytes] = None,
    mime_type: Optional[str] = None,
    query_text: str = "",
    media_type: Optional[str] = None,
    top_k: int = 6,
    match_threshold: float = 0.35,
    in_stock_only: bool = True,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """Search the bot's indexed product catalog, images, and video frames.

    Returns:
      (matched_items, visual_analysis_result)
    """
    top_k = max(1, min(int(top_k), MAX_CATALOG_RESULTS))
    match_threshold = max(0.0, min(float(match_threshold), 1.0))
    visual_attrs: dict[str, Any] = {}
    search_keywords = (query_text or "").strip()

    image_vector: list[float] = []
    if image_bytes and mime_type and mime_type.startswith("image/"):
        image_vector = await embed_image_bytes(image_bytes, mime_type)
        visual_attrs = await analyze_visual_query(image_bytes, mime_type, query_text)
        extracted_query = visual_attrs.get("search_query") or ""
        if extracted_query:
            search_keywords = f"{extracted_query} {query_text}".strip()

    if not search_keywords and not visual_attrs:
        return [], {}

    # 1. Generate dense query embedding
    query_vector = await embed_multimodal_text(search_keywords)

    results: list[dict[str, Any]] = []

    # 2. Try Vector Search via RPC match_media_items
    if query_vector or image_vector:
        try:
            rpc_name = "match_media_items_multimodal" if image_vector else "match_media_items"
            rpc_params: dict[str, Any] = {
                "query_embedding": query_vector or None,
                "match_bot_id": bot_id,
                "match_threshold": match_threshold,
                "match_count": top_k,
            }
            if image_vector:
                rpc_params["query_image_embedding"] = image_vector
            if media_type:
                rpc_params["filter_media_type"] = media_type

            res = await run_db(lambda: supabase.rpc(rpc_name, rpc_params).execute())
            if res and res.data:
                results = [
                    item for item in res.data
                    if catalog_item_is_recommendable(item, in_stock_only=in_stock_only)
                    and catalog_similarity_meets_threshold(item, match_threshold)
                ]
        except Exception as exc:
            logger.warning("match_media_items RPC failed, falling back to keyword filter: %s", exc)

    # 3. Fallback / Hybrid text search if vector returned few results
    if len(results) < top_k:
        try:
            tokens = [t.lower() for t in search_keywords.split() if len(t) > 2][:4]
            q = supabase.table("chatty_media_items").select("*").eq("bot_id", bot_id)
            if media_type:
                q = q.eq("media_type", media_type)
            
            # Simple keyword match
            existing_ids = {r["id"] for r in results if "id" in r}
            res_all = await run_db(lambda: q.limit(20).execute())
            for item in (res_all.data or []):
                if item["id"] in existing_ids:
                    continue
                if not catalog_item_is_recommendable(item, in_stock_only=in_stock_only):
                    continue
                score = 0
                title = (item.get("title") or "").lower()
                desc = (item.get("description") or "").lower()
                sku = (item.get("sku") or "").lower()
                for token in tokens:
                    if token in title:
                        score += 0.3
                    if token in desc:
                        score += 0.15
                    if token in sku:
                        score += 0.4
                if score >= FALLBACK_MIN_SCORE:
                    item["similarity"] = score
                    results.append(item)
                    if len(results) >= top_k:
                        break
        except Exception as exc:
            logger.exception("Fallback media search failed: %s", exc)

    # WooCommerce is authoritative for fast-changing price/stock facts, but
    # the durable indexed snapshot remains the safe fallback on any failure.
    if results:
        try:
            from app.services import woocommerce_service
            results = await woocommerce_service.refresh_live_product_facts(bot_id, results)
            results = [
                item for item in results
                if catalog_item_is_recommendable(item, in_stock_only=in_stock_only)
            ]
        except Exception:
            logger.exception("Live WooCommerce fact refresh failed; using catalog snapshot")

    return results[:top_k], visual_attrs


def format_multimodal_context_for_prompt(
    items: list[dict[str, Any]],
    visual_attrs: Optional[dict[str, Any]] = None,
) -> str:
    """Format retrieved catalog items and visual insights into context for the assistant."""
    if not items and not visual_attrs:
        return ""

    lines = ["\n--- MULTIMODAL CATALOG & INVENTORY SEARCH RESULTS ---"]

    if visual_attrs and visual_attrs.get("detailed_description"):
        lines.append(f"Visual analysis of visitor's uploaded photo:")
        lines.append(f"  • Detected Item: {visual_attrs.get('item_type') or 'Unknown'}")
        lines.append(f"  • Colors: {', '.join(visual_attrs.get('primary_colors') or []) or 'N/A'}")
        lines.append(f"  • Pattern/Style: {visual_attrs.get('pattern') or 'N/A'}, {visual_attrs.get('style_and_cut') or 'N/A'}")
        lines.append(f"  • Visual Summary: {visual_attrs.get('detailed_description')}")
        lines.append("")

    if items:
        lines.append(f"Found {len(items)} matching item(s) in catalog:")
        for idx, item in enumerate(items, 1):
            m_type = item.get("media_type", "product")
            title = item.get("title") or "Unnamed Item"
            sku = item.get("sku") or "N/A"
            price = item.get("price")
            currency = item.get("currency") or "USD"
            url = item.get("url") or item.get("media_url") or ""
            img = item.get("thumbnail_url") or item.get("media_url") or ""
            video_url = item.get("video_url") or ""
            t_start = item.get("video_timestamp_start")
            meta = item.get("metadata") or {}
            in_stock = meta.get("in_stock", True)
            sizes = meta.get("sizes") or []
            variations = meta.get("variations") or []

            lines.append(f"[{idx}] {title}")
            lines.append(f"    • Type: {m_type}")
            lines.append(f"    • SKU: {sku}")
            if item.get("id"):
                lines.append(f"    • Catalog ID (use in PRODUCT_CARD): {item.get('id')}")
            if meta.get("woocommerce_id") is not None:
                lines.append(f"    • WooCommerce Product ID: {meta.get('woocommerce_id')}")
            if meta.get("live_check_status") == "unavailable":
                lines.append("    • Live store check: unavailable; do not claim current price or stock")
            if price is not None:
                lines.append(f"    • Price: {currency} {price}")
            lines.append(f"    • Availability: {'In Stock' if in_stock else 'Out of Stock'}")
            if sizes:
                lines.append(f"    • Available Sizes: {', '.join(sizes)}")
            if variations:
                lines.append("    • Concrete variants:")
                for variant in variations[:20]:
                    attrs = variant.get("attributes") or []
                    attr_text = ", ".join(
                        f"{a.get('name')}: {a.get('option')}"
                        for a in attrs if isinstance(a, dict) and a.get("option")
                    )
                    variant_price = variant.get("sale_price") or variant.get("price")
                    variant_stock = variant.get("in_stock", variant.get("stock_status") == "instock")
                    variant_id = variant.get("id") or "N/A"
                    variant_sku = variant.get("sku") or "N/A"
                    lines.append(
                        f"      - id={variant_id}; sku={variant_sku}; "
                        f"attributes={attr_text or 'N/A'}; price={variant_price if variant_price is not None else 'N/A'}; "
                        f"in_stock={bool(variant_stock)}; url={variant.get('url') or url}"
                    )
            if url:
                lines.append(f"    • Product Link: {url}")
            if img:
                lines.append(f"    • Image: {img}")
            if video_url:
                time_tag = f" at {int(t_start)}s" if t_start is not None else ""
                lines.append(f"    • Video Demo: {video_url}{time_tag}")
            lines.append("")

        lines.append("INSTRUCTIONS FOR RETURNING MULTIMEDIA TO VISITOR:")
        lines.append("1. Answer the visitor warmly and directly based on whether the matching product is available.")
        lines.append("2. Include pricing, size/variant details, and direct links.")
        lines.append("3. Whenever recommending or answering about a specific catalog product, append a structured card token:")
        lines.append('   [PRODUCT_CARD:{"id": "...", "variant_id": "...", "variant_sku": "...", "title": "...", "price": "...", "currency": "...", "url": "...", "image_url": "...", "in_stock": true}]')
        lines.append("5. For variable products, select a concrete in-stock variant matching the visitor's requested attributes; use that variant's id, SKU, price, availability, and URL in PRODUCT_CARD. Never present the parent price as a confirmed variant price.")
        lines.append("6. If a video demonstration or clip is relevant, append:")
        lines.append('   [VIDEO_CLIP:{"title": "...", "video_url": "...", "timestamp": 12, "thumbnail_url": "..."}]')
    else:
        lines.append("No exact matching products found in the catalog for this visual query.")
        lines.append("Advise the visitor politely that we could not find an exact match in our inventory, and offer to help them find similar styles or alternative products.")

    lines.append("--- END OF MULTIMODAL SEARCH RESULTS ---\n")
    return "\n".join(lines)


def _resolve_variant_from_query(
    variants: list[dict[str, Any]], query_text: str,
) -> dict[str, Any] | None:
    """Choose a concrete variant only when the shopper query is unambiguous."""
    available = [variant for variant in variants if variant.get("in_stock", variant.get("stock_status") == "instock")]
    query_tokens = set(re.findall(r"[a-z0-9]+", (query_text or "").lower()))
    if len(available) == 1 and not query_tokens:
        return available[0]
    if not query_tokens:
        return None
    scored: list[tuple[int, dict[str, Any]]] = []
    for variant in available:
        searchable = [str(variant.get("sku") or "")]
        searchable.extend(
            f"{attribute.get('name', '')} {attribute.get('option', '')}"
            for attribute in (variant.get("attributes") or [])
            if isinstance(attribute, dict)
        )
        variant_tokens = set(re.findall(r"[a-z0-9]+", " ".join(searchable).lower()))
        score = len(query_tokens & variant_tokens)
        if score:
            scored.append((score, variant))
    if not scored:
        return None
    if len(available) == 1:
        return available[0]
    scored.sort(key=lambda pair: pair[0], reverse=True)
    if len(scored) > 1 and scored[0][0] == scored[1][0]:
        return None
    return scored[0][1]


def sanitize_product_cards(
    reply: str, items: list[dict[str, Any]], query_text: str = "",
) -> str:
    """Replace model-authored product cards with canonical retrieved facts.

    A model may choose a candidate, but it may not invent the ID, price,
    stock, image, or checkout URL. Unknown or malformed cards are removed.
    """
    if not reply or not items:
        return _PRODUCT_CARD_RE.sub("", reply or "").strip()

    def replace(match: re.Match[str]) -> str:
        try:
            requested = json.loads(match.group(1))
        except (TypeError, json.JSONDecodeError):
            return ""
        if not isinstance(requested, dict):
            return ""
        requested_id = str(requested.get("id") or requested.get("product_id") or "").strip()
        requested_variant_id = str(requested.get("variant_id") or "").strip()
        requested_variant_sku = str(requested.get("variant_sku") or "").strip().lower()
        candidate = None
        candidate_variant = None
        for item in items:
            metadata = item.get("metadata") or {}
            ids = {str(value) for value in (item.get("id"), metadata.get("woocommerce_id")) if value is not None}
            variants = metadata.get("variations") or []
            if requested_id and requested_id not in ids:
                matching_parent_variant = next((
                    variant for variant in variants if isinstance(variant, dict) and (
                        requested_id == str(variant.get("id")) or
                        requested_id.lower() == str(variant.get("sku") or "").lower()
                    )
                ), None)
                if matching_parent_variant is None:
                    continue
                candidate_variant = matching_parent_variant
            elif not requested_id and len(items) != 1:
                continue
            if requested_variant_id or requested_variant_sku:
                matching = [
                    variant for variant in variants
                    if isinstance(variant, dict) and (
                        (requested_variant_id and requested_variant_id == str(variant.get("id"))) or
                        (requested_variant_sku and requested_variant_sku == str(variant.get("sku") or "").lower())
                    )
                ]
                if not matching:
                    continue
                candidate_variant = matching[0]
            candidate = item
            break
        if candidate is None:
            return ""

        metadata = candidate.get("metadata") or {}
        if metadata.get("source") == "woocommerce" and metadata.get("live_check_status") != "fresh":
            return ""
        variants = [variant for variant in (metadata.get("variations") or []) if isinstance(variant, dict)]
        if metadata.get("source") == "woocommerce" and variants and candidate_variant is None:
            candidate_variant = _resolve_variant_from_query(variants, query_text)
            if candidate_variant is None:
                # Never turn a variable product into a parent-price card. The
                # caller gets no card rather than an ungrounded price/stock
                # claim when the requested variant is ambiguous.
                return ""
        variant = candidate_variant or {}
        if variant and metadata.get("source") == "woocommerce":
            live_variant_ids = {str(value) for value in (metadata.get("live_variant_ids") or [])}
            if str(variant.get("id") or "") not in live_variant_ids:
                return ""
        price = variant.get("sale_price") or variant.get("price")
        if price is None:
            price = candidate.get("price")
        url = variant.get("url") or candidate.get("url") or ""
        if not isinstance(url, str) or not url.lower().startswith("https://"):
            url = ""
        canonical = {
            "id": str(candidate.get("id") or metadata.get("woocommerce_id") or ""),
            "variant_id": str(variant.get("id") or "") if variant else "",
            "variant_sku": str(variant.get("sku") or "") if variant else "",
            "title": str(candidate.get("title") or "Unnamed Item")[:240],
            "price": price,
            "currency": str(candidate.get("currency") or "USD")[:12],
            "url": url,
            "image_url": str(candidate.get("thumbnail_url") or candidate.get("media_url") or ""),
            "in_stock": bool(variant.get("in_stock", metadata.get("in_stock", True))) if variant else bool(metadata.get("in_stock", True)),
        }
        return f"[PRODUCT_CARD:{json.dumps(canonical, separators=(',', ':'))}]"

    return _PRODUCT_CARD_RE.sub(replace, reply).strip()


async def ingest_media_item(
    *,
    bot_id: str,
    title: str,
    media_url: str,
    media_type: str = "product",
    description: str = "",
    sku: Optional[str] = None,
    price: Optional[float] = None,
    currency: str = "USD",
    url: Optional[str] = None,
    thumbnail_url: Optional[str] = None,
    video_url: Optional[str] = None,
    video_timestamp_start: Optional[float] = None,
    video_timestamp_end: Optional[float] = None,
    visual_attributes: Optional[dict[str, Any]] = None,
    metadata: Optional[dict[str, Any]] = None,
    source_updated_at: Optional[str] = None,
    catalog_version: Optional[str] = None,
) -> dict[str, Any]:
    """Ingest and embed a product, image, or video keyframe into chatty_media_items."""
    embedding_kwargs = {
        "title": title,
        "description": description,
        "sku": sku,
        "visual_attributes": visual_attributes,
        "metadata": metadata,
    }
    fingerprint = catalog_embedding_fingerprint(**embedding_kwargs)
    vector = await embed_catalog_item(**embedding_kwargs)
    image_urls = [
        str(url) for url in ((metadata or {}).get("gallery_urls") or [media_url, thumbnail_url])
        if url and str(url).startswith(("https://", "http://"))
    ][:MAX_CATALOG_IMAGES]
    image_vector = await embed_catalog_images(image_urls)
    image_fingerprint = image_embedding_fingerprint(image_urls, source_updated_at)
    metadata_with_embedding = catalog_metadata_with_embedding(
        metadata, fingerprint, status="ready" if vector else "stale"
    )
    metadata_with_embedding.update({
        "_image_embedding_schema": IMAGE_EMBEDDING_SCHEMA_VERSION,
        "_image_embedding_model": IMAGE_EMBEDDING_MODEL,
        "_image_embedding_fingerprint": image_fingerprint,
        "_image_embedding_status": "ready" if image_vector else "stale",
        "_image_embedding_count": len(image_urls),
    })

    row = {
        "bot_id": bot_id,
        "media_type": media_type,
        "title": title,
        "description": description,
        "sku": sku,
        "price": price,
        "currency": currency,
        "url": url or media_url,
        "media_url": media_url,
        "thumbnail_url": thumbnail_url or media_url,
        "video_url": video_url,
        "video_timestamp_start": video_timestamp_start,
        "video_timestamp_end": video_timestamp_end,
        "visual_attributes": visual_attributes or {},
        "metadata": metadata_with_embedding,
        "embedding": vector if vector else None,
        "image_embedding": image_vector if image_vector else None,
        "source_updated_at": source_updated_at,
        "synced_at": datetime.now(timezone.utc).isoformat(),
        "catalog_version": catalog_version,
        "ingestion_status": "ready" if vector else "stale",
        "last_ingestion_error": None if vector else "Embedding generation failed",
    }

    res = await run_db(lambda: supabase.table("chatty_media_items").insert(row).execute())
    return res.data[0] if res and res.data else row
