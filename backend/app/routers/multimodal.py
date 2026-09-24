"""Multimodal RAG & Media Catalog API endpoints (/api/bots/{bot_id}/media-items/*)."""

from __future__ import annotations

import base64
import hashlib
import hmac
import logging
import os
import secrets
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, UploadFile, File, Form
from pydantic import BaseModel, Field

from app.core.clients import supabase
from app.core.crypto import decrypt_secret, encrypt_secret
from app.core.db import run_db
from app.core.deps import require_user
from app.core.permissions import verify_bot_permission
from app.services import multimodal_service

logger = logging.getLogger("chatty.routers.multimodal")

router = APIRouter()


class MediaItemCreateRequest(BaseModel):
    title: str
    media_url: str
    media_type: str = Field(default="product", description="'product' | 'image' | 'video' | 'video_frame'")
    description: Optional[str] = None
    sku: Optional[str] = None
    price: Optional[float] = None
    currency: str = "USD"
    url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    video_url: Optional[str] = None
    video_timestamp_start: Optional[float] = None
    video_timestamp_end: Optional[float] = None
    visual_attributes: Optional[dict[str, Any]] = None
    metadata: Optional[dict[str, Any]] = None


class MediaSearchRequest(BaseModel):
    query_text: str = ""
    media_type: Optional[str] = None
    top_k: int = 6


class MediaItemUpdateRequest(BaseModel):
    title: Optional[str] = None
    media_url: Optional[str] = None
    description: Optional[str] = None
    sku: Optional[str] = None
    price: Optional[float] = None
    currency: Optional[str] = None
    url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    visual_attributes: Optional[dict[str, Any]] = None
    metadata: Optional[dict[str, Any]] = None


def _catalog_signature(secret: str, raw_body: bytes) -> str:
    return hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()


async def _embedding_for_item(item: dict[str, Any]) -> Optional[list[float]]:
    """Refresh semantic retrieval when searchable product fields change."""
    parts = [str(item.get("title") or "")]
    if item.get("description"):
        parts.append(str(item["description"]))
    if item.get("sku"):
        parts.append(f"SKU: {item['sku']}")
    attrs = item.get("visual_attributes") or {}
    if attrs:
        parts.append(", ".join(f"{k}: {v}" for k, v in attrs.items() if v))
    vector = await multimodal_service.embed_multimodal_text(" | ".join(p for p in parts if p))
    return vector or None


@router.post("/api/bots/{bot_id}/media-webhook")
async def provision_catalog_webhook(
    bot_id: str,
    request: Request,
    rotate: bool = False,
    user: dict[str, Any] = Depends(require_user),
):
    """Create/rotate a signing secret for a manual catalog or ERP webhook."""
    await verify_bot_permission(bot_id, user, "sources")
    existing = await run_db(lambda: supabase.table("chatty_catalog_webhooks").select("bot_id").eq("bot_id", bot_id).limit(1).execute())
    if existing.data and not rotate:
        raise HTTPException(status_code=409, detail="Catalog webhook already exists; pass rotate=true to rotate it")
    secret = secrets.token_urlsafe(32)
    now = datetime.now(timezone.utc).isoformat()
    payload = {"bot_id": bot_id, "signing_secret": encrypt_secret(secret), "enabled": True, "updated_at": now}
    if existing.data:
        res = await run_db(lambda: supabase.table("chatty_catalog_webhooks").update(payload).eq("bot_id", bot_id).execute())
    else:
        payload["created_at"] = now
        res = await run_db(lambda: supabase.table("chatty_catalog_webhooks").insert(payload).execute())
    if not getattr(res, "data", None):
        raise HTTPException(status_code=500, detail="Could not provision catalog webhook")
    return {
        "webhook_url": f"{str(request.base_url).rstrip('/')}/api/integrations/catalog/webhook/{bot_id}",
        "signing_secret": secret,
        "enabled": True,
    }


@router.get("/api/bots/{bot_id}/media-webhook")
async def get_catalog_webhook(
    bot_id: str,
    request: Request,
    user: dict[str, Any] = Depends(require_user),
):
    """Return manual catalog webhook status without ever exposing its secret."""
    await verify_bot_permission(bot_id, user, "sources")
    existing = await run_db(
        lambda: supabase.table("chatty_catalog_webhooks")
        .select("enabled,created_at,updated_at")
        .eq("bot_id", bot_id)
        .limit(1)
        .execute()
    )
    configured = bool(existing.data)
    return {
        "configured": configured,
        "enabled": bool(existing.data[0].get("enabled")) if configured else False,
        "created_at": existing.data[0].get("created_at") if configured else None,
        "updated_at": existing.data[0].get("updated_at") if configured else None,
        "webhook_url": (
            f"{str(request.base_url).rstrip('/')}/api/integrations/catalog/webhook/{bot_id}"
            if configured else None
        ),
    }


@router.patch("/api/bots/{bot_id}/media-items/{item_id}")
async def update_media_item(
    bot_id: str,
    item_id: str,
    req: MediaItemUpdateRequest,
    user: dict[str, Any] = Depends(require_user),
):
    """Update stock/price/variants or other manual catalog facts."""
    await verify_bot_permission(bot_id, user, "sources")
    updates = {k: v for k, v in req.model_dump(exclude_unset=True).items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="At least one field is required")
    current = None
    if "metadata" in updates or any(k in updates for k in {"title", "description", "sku", "visual_attributes"}):
        current = await run_db(lambda: supabase.table("chatty_media_items").select("*").eq("id", item_id).eq("bot_id", bot_id).single().execute())
    if "metadata" in updates:
        merged = dict((current.data or {}).get("metadata") or {})
        merged.update(updates["metadata"] or {})
        updates["metadata"] = merged
    if any(k in updates for k in {"title", "description", "sku", "visual_attributes"}):
        merged_item = dict(current.data or {})
        merged_item.update(updates)
        updates["embedding"] = await _embedding_for_item(merged_item)
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    res = await run_db(lambda: supabase.table("chatty_media_items").update(updates).eq("id", item_id).eq("bot_id", bot_id).execute())
    if not res.data:
        raise HTTPException(status_code=404, detail="Catalog item not found")
    return {"item": res.data[0], "status": "updated"}


@router.post("/api/bots/{bot_id}/media-items/search-image")
async def search_multimodal_image(
    bot_id: str,
    file: UploadFile = File(...),
    query_text: str = Form(""),
    top_k: int = Form(6),
    user: dict[str, Any] = Depends(require_user),
):
    """Run the same production visual catalog search used by the widget.

    This endpoint is intentionally authenticated and is useful for dashboard
    QA/import tooling; visitor traffic goes through ``run_widget_assistant``.
    """
    await verify_bot_permission(bot_id, user, "sources")
    content_type = (file.content_type or "").split(";")[0].lower()
    if content_type not in {"image/jpeg", "image/png", "image/webp", "image/gif"}:
        raise HTTPException(status_code=415, detail="Only JPEG, PNG, WebP, and GIF images are supported")
    content = await file.read()
    if not content or len(content) > 8 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image must be between 1 byte and 8MB")
    results, visual_attrs = await multimodal_service.search_multimodal_catalog(
        bot_id=bot_id,
        image_bytes=content,
        mime_type=content_type,
        query_text=query_text,
        top_k=max(1, min(int(top_k), 20)),
    )
    return {"results": results, "visual_analysis": visual_attrs}


@router.get("/api/bots/{bot_id}/media-items")
async def list_bot_media_items(
    bot_id: str,
    media_type: Optional[str] = None,
    limit: int = Query(50, le=100),
    offset: int = Query(0, ge=0),
    user: dict[str, Any] = Depends(require_user),
):
    """List all indexed media/product items for a bot."""
    await verify_bot_permission(bot_id, user, "sources")
    q = supabase.table("chatty_media_items").select("*", count="exact").eq("bot_id", bot_id)
    if media_type:
        q = q.eq("media_type", media_type)

    res = await run_db(lambda: q.order("created_at", desc=True).range(offset, offset + limit - 1).execute())
    return {
        "items": res.data or [],
        "total": res.count or 0,
        "limit": limit,
        "offset": offset,
    }


@router.post("/api/bots/{bot_id}/media-items")
async def create_media_item(
    bot_id: str,
    req: MediaItemCreateRequest,
    user: dict[str, Any] = Depends(require_user),
):
    """Add a product or media asset to the bot's multimodal catalog with auto-embedding."""
    await verify_bot_permission(bot_id, user, "sources")
    try:
        item = await multimodal_service.ingest_media_item(
            bot_id=bot_id,
            title=req.title,
            media_url=req.media_url,
            media_type=req.media_type,
            description=req.description or "",
            sku=req.sku,
            price=req.price,
            currency=req.currency,
            url=req.url,
            thumbnail_url=req.thumbnail_url,
            video_url=req.video_url,
            video_timestamp_start=req.video_timestamp_start,
            video_timestamp_end=req.video_timestamp_end,
            visual_attributes=req.visual_attributes,
            metadata=req.metadata,
        )
        return {"item": item, "status": "indexed"}
    except Exception as exc:
        logger.exception("Failed to create media item: %s", exc)
        raise HTTPException(status_code=500, detail=f"Failed to ingest item: {exc}") from exc


@router.delete("/api/bots/{bot_id}/media-items/{item_id}")
async def delete_media_item(
    bot_id: str,
    item_id: str,
    user: dict[str, Any] = Depends(require_user),
):
    """Delete a media/product item from the bot's catalog."""
    await verify_bot_permission(bot_id, user, "sources")
    res = await run_db(
        lambda: supabase.table("chatty_media_items")
        .delete()
        .eq("id", item_id)
        .eq("bot_id", bot_id)
        .execute()
    )
    return {"deleted": bool(res.data), "id": item_id}


@router.post("/api/bots/{bot_id}/media-items/import")
async def batch_import_media_items(
    bot_id: str,
    items: list[MediaItemCreateRequest],
    user: dict[str, Any] = Depends(require_user),
):
    """Batch-import a catalog of products or media items."""
    await verify_bot_permission(bot_id, user, "sources")
    if not items:
        return {"indexed_count": 0}

    indexed = []
    for it in items[:100]:  # Cap per batch to avoid timeouts
        try:
            res = await multimodal_service.ingest_media_item(
                bot_id=bot_id,
                title=it.title,
                media_url=it.media_url,
                media_type=it.media_type,
                description=it.description or "",
                sku=it.sku,
                price=it.price,
                currency=it.currency,
                url=it.url,
                thumbnail_url=it.thumbnail_url,
                video_url=it.video_url,
                video_timestamp_start=it.video_timestamp_start,
                video_timestamp_end=it.video_timestamp_end,
                visual_attributes=it.visual_attributes,
                metadata=it.metadata,
            )
            indexed.append(res)
        except Exception:
            logger.exception("Failed to ingest item '%s'", it.title)

    return {"indexed_count": len(indexed)}


@router.post("/api/bots/{bot_id}/media-items/search")
async def test_multimodal_search(
    bot_id: str,
    req: MediaSearchRequest,
    user: dict[str, Any] = Depends(require_user),
):
    """Simulate a multimodal search against the bot's catalog."""
    await verify_bot_permission(bot_id, user, "sources")
    results, visual_attrs = await multimodal_service.search_multimodal_catalog(
        bot_id=bot_id,
        query_text=req.query_text,
        media_type=req.media_type,
        top_k=req.top_k,
    )
    return {"results": results, "visual_analysis": visual_attrs}


@router.post("/api/bots/{bot_id}/media-items/upload")
async def upload_media_image(
    bot_id: str,
    file: UploadFile = File(...),
    user: dict[str, Any] = Depends(require_user),
):
    """Upload a product or media image."""
    await verify_bot_permission(bot_id, user, "sources")
    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 10MB)")

    content_type = (file.content_type or "").split(";")[0].lower()
    if content_type not in {"image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4", "video/webm"}:
        raise HTTPException(status_code=415, detail="Unsupported media type")
    public_url = ""
    file_ext = (file.filename or "image.jpg").split(".")[-1]
    storage_path = f"{bot_id}/{int(time.time())}_{uuid.uuid4().hex[:8]}.{file_ext}"

    try:
        res = await run_db(
            lambda: supabase.storage.from_("chatty_assets").upload(
                storage_path, content, {"content-type": content_type}
            )
        )
        if res:
            public_res = supabase.storage.from_("chatty_assets").get_public_url(storage_path)
            if public_res:
                public_url = public_res
    except Exception as exc:
        logger.error("Media storage upload failed: %s", exc)
        if os.environ.get("ALLOW_DATA_URI_MEDIA_FALLBACK", "false").lower() != "true":
            raise HTTPException(status_code=503, detail="Media storage is unavailable; try again later") from exc
        # Development-only compatibility escape hatch. Never enable this for
        # production: data URIs inflate DB/API payloads and bypass CDN caching.
        public_url = "data:" + content_type + ";base64," + base64.b64encode(content).decode("ascii")

    return {
        "url": public_url,
        "filename": file.filename,
        "size": len(content),
    }


@router.post("/api/integrations/catalog/webhook/{bot_id}")
async def receive_catalog_webhook(
    bot_id: str,
    request: Request,
    x_chatty_signature: Optional[str] = Header(None),
):
    """Receive signed product/stock updates from any store or ERP.

    Payload shape: ``{"event":"product.updated", "external_id":"SKU-1",
    "item": {"title": ..., "price": ..., "metadata": {"in_stock": true}}}``.
    ``product.deleted`` removes the matching manual item.
    """
    raw = await request.body()
    if len(raw) > 512 * 1024:
        raise HTTPException(status_code=413, detail="Catalog webhook payload exceeds the 512KB limit")
    if not x_chatty_signature:
        raise HTTPException(status_code=401, detail="Missing catalog webhook signature")
    cfg = await run_db(lambda: supabase.table("chatty_catalog_webhooks").select("signing_secret,enabled").eq("bot_id", bot_id).limit(1).execute())
    if not cfg.data or not cfg.data[0].get("enabled"):
        raise HTTPException(status_code=404, detail="Catalog webhook is not configured")
    secret = decrypt_secret(cfg.data[0]["signing_secret"])
    supplied = x_chatty_signature.removeprefix("sha256=").strip()
    if not hmac.compare_digest(_catalog_signature(secret, raw), supplied):
        raise HTTPException(status_code=401, detail="Invalid catalog webhook signature")
    try:
        body = await request.json()
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid JSON payload") from exc
    external_id = str(body.get("external_id") or "").strip()
    if len(external_id) > 256:
        raise HTTPException(status_code=400, detail="external_id must be 256 characters or fewer")
    event = str(body.get("event") or "product.updated").lower()
    if not external_id:
        raise HTTPException(status_code=400, detail="external_id is required")
    # The webhook key is scoped by bot_id and must identify exactly one item.
    # Fetch at most two rows so duplicate IDs are detected without allowing an
    # unbounded response from the catalog table.
    found = await run_db(lambda: supabase.table("chatty_media_items").select("*").eq("bot_id", bot_id).contains("metadata", {"external_id": external_id}).limit(2).execute())
    if len(found.data or []) > 1:
        raise HTTPException(
            status_code=409,
            detail="external_id is not unique within this bot; assign a unique value to each catalog item",
        )
    if "deleted" in event:
        if found.data:
            await run_db(lambda: supabase.table("chatty_media_items").delete().eq("id", found.data[0]["id"]).eq("bot_id", bot_id).execute())
        return {"status": "ok", "event": "deleted", "external_id": external_id, "item_id": found.data[0]["id"] if found.data else None}
    item = body.get("item") or {}
    if not isinstance(item, dict):
        raise HTTPException(status_code=400, detail="item must be an object")
    existing_item = found.data[0] if found.data else {}
    metadata = dict(existing_item.get("metadata") or {})
    metadata.update(item.get("metadata") or {})
    metadata.update({"source": metadata.get("source", "manual"), "external_id": external_id})
    if found.data:
        updates = {k: v for k, v in item.items() if k in {"title", "description", "sku", "price", "currency", "url", "media_url", "thumbnail_url", "visual_attributes"} and v is not None}
        updates["metadata"] = metadata
        if any(k in updates for k in {"title", "description", "sku", "visual_attributes"}):
            merged_item = dict(existing_item)
            merged_item.update(updates)
            updates["embedding"] = await _embedding_for_item(merged_item)
        updates["updated_at"] = datetime.now(timezone.utc).isoformat()
        await run_db(lambda: supabase.table("chatty_media_items").update(updates).eq("id", found.data[0]["id"]).eq("bot_id", bot_id).execute())
        return {"status": "ok", "event": "updated", "external_id": external_id, "item_id": found.data[0]["id"]}
    if "created" not in event:
        raise HTTPException(status_code=404, detail="Catalog item not found")
    required = {"title", "media_url"}
    if not required.issubset(item):
        raise HTTPException(status_code=400, detail="Created items require title and media_url")
    created = await multimodal_service.ingest_media_item(bot_id=bot_id, title=item["title"], media_url=item["media_url"], description=item.get("description") or "", sku=item.get("sku"), price=item.get("price"), currency=item.get("currency") or "USD", url=item.get("url"), thumbnail_url=item.get("thumbnail_url"), visual_attributes=item.get("visual_attributes"), metadata=metadata)
    return {"status": "ok", "event": "created", "external_id": external_id, "item_id": created.get("id")}
