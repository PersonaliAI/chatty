"""Multimodal RAG & Media Catalog API endpoints (/api/bots/{bot_id}/media-items/*)."""

from __future__ import annotations

import base64
import logging
import os
import time
import uuid
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
from pydantic import BaseModel, Field

from app.core.clients import supabase
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
    await verify_bot_permission(bot_id, user)
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
    await verify_bot_permission(bot_id, user)
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
    await verify_bot_permission(bot_id, user)
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
    await verify_bot_permission(bot_id, user)
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
    await verify_bot_permission(bot_id, user)
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
    await verify_bot_permission(bot_id, user)
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
    await verify_bot_permission(bot_id, user)
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
