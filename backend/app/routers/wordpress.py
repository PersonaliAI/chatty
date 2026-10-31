"""WordPress Content & Knowledge Base Integration Router (/api/bots/{bot_id}/integrations/wordpress/*)."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel, Field

from app.core.clients import supabase
from app.core.config import CHATTY_BACKEND_URL, CHATTY_FRONTEND_URL
from app.core.db import run_db
from app.core.deps import require_user
from app.core.permissions import verify_bot_permission
from app.services import wordpress_service

logger = logging.getLogger("chatty.routers.wordpress")

router = APIRouter()


class WordPressConnectRequest(BaseModel):
    site_url: str = Field(..., description="WordPress site URL (e.g. https://mysite.com)")
    username: Optional[str] = Field(None, description="Optional WordPress username for Application Password auth")
    app_password: Optional[str] = Field(None, description="Optional WordPress Application Password")
    sync_posts: bool = Field(True, description="Train AI on published WordPress Blog Posts / Articles")
    sync_pages: bool = Field(True, description="Train AI on published WordPress Pages")


class WordPressSyncRequest(BaseModel):
    sync_posts: Optional[bool] = None
    sync_pages: Optional[bool] = None
    max_items_per_type: int = Field(100, ge=1, le=250)


def _resolve_wp_webhook_url(bot_id: str, request: Optional[Request] = None) -> str:
    base_url = (CHATTY_BACKEND_URL or "").strip().rstrip("/")
    if (not base_url or "localhost" in base_url) and request is not None:
        base_url = str(request.base_url).rstrip("/")
    if not base_url:
        base_url = "https://api.chatty.personaliai.com"
    return f"{base_url}/api/integrations/wordpress/webhook/{bot_id}"


@router.get("/api/bots/{bot_id}/integrations/wordpress")
async def get_wordpress_status(
    bot_id: str,
    request: Request,
    user: dict[str, Any] = Depends(require_user),
):
    """Get WordPress integration connection status, synced KB counts, webhook URL, and PHP snippet."""
    await verify_bot_permission(bot_id, user, "integrations")
    cfg = await wordpress_service.get_integration(bot_id)
    webhook_url = _resolve_wp_webhook_url(bot_id, request)
    frontend_url = (CHATTY_FRONTEND_URL or "https://chatty.personaliai.com").rstrip("/")

    if not cfg:
        return {
            "connected": False,
            "webhook_url": webhook_url,
            "synced_pages": 0,
            "synced_posts": 0,
            "synced_total": 0,
        }

    site_url = str(cfg.get("site_url") or "")
    # Count matching URL sources in chatty_sources for this site
    kb_count = cfg.get("synced_total", 0)
    if site_url:
        try:
            src_res = await run_db(
                lambda: supabase.table("chatty_sources")
                .select("id", count="exact", head=True)
                .eq("bot_id", bot_id)
                .eq("type", "url")
                .ilike("name", f"{site_url}%")
                .execute()
            )
            if src_res and src_res.count is not None:
                kb_count = max(int(kb_count or 0), int(src_res.count))
        except Exception:
            pass

    webhook_secret = str(cfg.get("webhook_secret") or "")
    php_snippet = wordpress_service.build_wordpress_php_snippet(
        bot_id=bot_id,
        frontend_url=frontend_url,
        webhook_url=webhook_url,
        webhook_secret=webhook_secret,
    )

    return {
        "connected": True,
        "site_url": site_url,
        "site_name": cfg.get("site_name") or site_url,
        "username": cfg.get("username"),
        "has_app_password": bool(cfg.get("app_password")),
        "sync_posts": bool(cfg.get("sync_posts", True)),
        "sync_pages": bool(cfg.get("sync_pages", True)),
        "sync_status": cfg.get("sync_status", "synced"),
        "synced_pages": int(cfg.get("synced_pages") or 0),
        "synced_posts": int(cfg.get("synced_posts") or 0),
        "synced_total": int(kb_count or 0),
        "last_synced_at": cfg.get("last_synced_at"),
        "last_webhook_at": cfg.get("last_webhook_at"),
        "last_error": cfg.get("last_error"),
        "webhook_url": webhook_url,
        "webhook_secret": webhook_secret,
        "php_snippet": php_snippet,
    }


@router.post("/api/bots/{bot_id}/integrations/wordpress/connect")
async def connect_wordpress(
    bot_id: str,
    req: WordPressConnectRequest,
    request: Request,
    user: dict[str, Any] = Depends(require_user),
):
    """Verify WordPress site, save integration, and immediately train Knowledge Base on published Pages & Posts."""
    await verify_bot_permission(bot_id, user, "integrations")

    verify_res = await wordpress_service.verify_wordpress_site(
        site_url=req.site_url,
        username=req.username,
        app_password=req.app_password,
    )
    if not verify_res.get("valid"):
        raise HTTPException(
            status_code=400,
            detail=verify_res.get("error") or "Could not verify WordPress site.",
        )

    await wordpress_service.save_integration(
        bot_id,
        site_url=verify_res["site_url"],
        site_name=verify_res.get("site_name"),
        username=req.username,
        app_password=req.app_password,
        sync_posts=req.sync_posts,
        sync_pages=req.sync_pages,
        extra_updates={"sync_status": "syncing"},
    )

    sync_res = await wordpress_service.sync_wordpress_content(bot_id)
    status_payload = await get_wordpress_status(bot_id, request, user)

    return {
        "ok": True,
        "site_info": verify_res,
        "sync": sync_res,
        **status_payload,
    }


@router.post("/api/bots/{bot_id}/integrations/wordpress/sync")
async def trigger_wordpress_sync(
    bot_id: str,
    request: Request,
    req: Optional[WordPressSyncRequest] = None,
    user: dict[str, Any] = Depends(require_user),
):
    """Re-sync published WordPress Pages & Posts into the bot's Knowledge Base."""
    await verify_bot_permission(bot_id, user, "integrations")
    cfg = await wordpress_service.get_integration(bot_id)
    if not cfg or not cfg.get("site_url"):
        raise HTTPException(status_code=400, detail="WordPress site is not connected.")

    if req and (req.sync_posts is not None or req.sync_pages is not None):
        await wordpress_service.save_integration(
            bot_id,
            site_url=cfg["site_url"],
            site_name=cfg.get("site_name"),
            username=cfg.get("username"),
            app_password=cfg.get("app_password"),
            sync_posts=req.sync_posts if req.sync_posts is not None else bool(cfg.get("sync_posts", True)),
            sync_pages=req.sync_pages if req.sync_pages is not None else bool(cfg.get("sync_pages", True)),
        )

    sync_res = await wordpress_service.sync_wordpress_content(
        bot_id,
        max_items_per_type=(req.max_items_per_type if req else 100),
    )
    status_payload = await get_wordpress_status(bot_id, request, user)
    return {
        "ok": True,
        "sync": sync_res,
        **status_payload,
    }


@router.delete("/api/bots/{bot_id}/integrations/wordpress")
async def disconnect_wordpress(
    bot_id: str,
    delete_synced_sources: bool = False,
    user: dict[str, Any] = Depends(require_user),
):
    """Disconnect WordPress integration and optionally remove synced URLs from `chatty_sources`."""
    await verify_bot_permission(bot_id, user, "integrations")
    cfg = await wordpress_service.get_integration(bot_id)
    site_url = str((cfg or {}).get("site_url") or "")

    await wordpress_service.delete_integration(bot_id)

    deleted_count = 0
    if delete_synced_sources and site_url:
        try:
            del_res = await run_db(
                lambda: supabase.table("chatty_sources")
                .delete()
                .eq("bot_id", bot_id)
                .eq("type", "url")
                .ilike("name", f"{site_url}%")
                .execute()
            )
            deleted_count = len(del_res.data or [])
        except Exception as exc:
            logger.warning("Failed to delete synced WordPress sources: %s", exc)

    return {
        "ok": True,
        "disconnected": True,
        "deleted_sources_count": deleted_count,
    }


@router.post("/api/integrations/wordpress/webhook/{bot_id}")
async def receive_wordpress_webhook(
    bot_id: str,
    request: Request,
    x_wp_chatty_signature: Optional[str] = Header(None),
    x_wc_webhook_signature: Optional[str] = Header(None),
):
    """Public HMAC-verified webhook receiver for real-time WordPress content updates."""
    raw_body = await request.body()
    cfg = await wordpress_service.get_integration(bot_id)
    if not cfg:
        raise HTTPException(status_code=404, detail="WordPress integration not configured for this bot")

    secret = str(cfg.get("webhook_secret") or "")
    sig = x_wp_chatty_signature or x_wc_webhook_signature or ""
    if not sig:
        raise HTTPException(status_code=401, detail="Missing webhook signature")

    if not wordpress_service.verify_webhook_signature(secret, raw_body, sig):
        raise HTTPException(status_code=401, detail="Invalid webhook signature")

    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    result = await wordpress_service.process_wordpress_webhook(bot_id, payload)
    now_iso = datetime.now(timezone.utc).isoformat()
    await wordpress_service.save_integration(
        bot_id,
        site_url=cfg["site_url"],
        site_name=cfg.get("site_name"),
        username=cfg.get("username"),
        app_password=cfg.get("app_password"),
        sync_posts=bool(cfg.get("sync_posts", True)),
        sync_pages=bool(cfg.get("sync_pages", True)),
        extra_updates={"last_webhook_at": now_iso},
    )

    return {"status": "ok", "result": result}
