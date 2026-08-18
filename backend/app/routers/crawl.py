"""Website crawler / knowledge-source scheduling endpoints
(/api/crawl/*, /api/sources/*, /cron/execute-scheduled-crawls)."""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any, Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException

from app.core.clients import supabase
from app.core.config import FUNCTION_SECRET
from app.core.deps import require_user
from app.schemas.crawl import CrawlDiscoverRequest, CrawlPagesRequest, SourceScheduleUpdate

# Bridged helpers still living in main.py (shared with app/routers/documents.py
# and the public knowledge-create endpoint still in main.py).
from main import _fetch_url_content, _next_crawl_at

logger = logging.getLogger("chatty")

router = APIRouter()


def _normalize_url(u: str) -> str:
    u = (u or "").strip()
    if u and not u.startswith(("http://", "https://")):
        u = "https://" + u
    return u


@router.post("/api/crawl/discover")
async def crawl_discover(
    req: CrawlDiscoverRequest, user: dict[str, Any] = Depends(require_user)
):
    """Discover all page URLs of a site via sitemap.xml (+ robots.txt), so the
    admin can tick which ones to crawl."""
    import re as _re
    from urllib.parse import urlparse, urljoin

    base = _normalize_url(req.url)
    parsed = urlparse(base)
    if not parsed.netloc:
        raise HTTPException(status_code=400, detail="Invalid URL")
    origin = f"{parsed.scheme}://{parsed.netloc}"
    urls: set[str] = set()
    candidates = [urljoin(origin, "/sitemap.xml"), urljoin(origin, "/sitemap_index.xml")]

    async with httpx.AsyncClient(timeout=12, follow_redirects=True,
                                 headers={"User-Agent": "ChattyCrawler/1.0"}) as client:
        try:
            rob = await client.get(urljoin(origin, "/robots.txt"))
            if rob.status_code < 300:
                for line in rob.text.splitlines():
                    if line.lower().startswith("sitemap:"):
                        candidates.append(line.split(":", 1)[1].strip())
        except Exception:
            pass

        seen_sitemaps: set[str] = set()

        async def fetch_sitemap(sm_url: str, depth: int = 0):
            if depth > 3 or sm_url in seen_sitemaps:
                return
            seen_sitemaps.add(sm_url)
            try:
                r = await client.get(sm_url)
            except Exception:
                return
            if r.status_code >= 300:
                return
            for loc in _re.findall(r"<loc>\s*([^<]+?)\s*</loc>", r.text, _re.I):
                loc = loc.strip()
                if loc.lower().endswith(".xml") and "sitemap" in loc.lower():
                    await fetch_sitemap(loc, depth + 1)
                else:
                    urls.add(loc)

        for sm in candidates:
            await fetch_sitemap(sm)

    same_domain = sorted(
        u for u in urls if urlparse(u).netloc == parsed.netloc
    )[:500]
    if not same_domain:
        same_domain = [base]  # no sitemap — fall back to the single page
        return {"urls": same_domain, "count": 1, "sitemap_found": False}
    return {"urls": same_domain, "count": len(same_domain), "sitemap_found": True}


@router.post("/api/crawl/pages")
async def crawl_pages(
    req: CrawlPagesRequest, user: dict[str, Any] = Depends(require_user)
):
    """Crawl the admin-selected URLs and index each as a knowledge source."""
    res = supabase.table("chatty_bots").select("id").eq("id", req.bot_id).eq(
        "user_id", user["auth_user_id"]).execute()
    if not res.data:
        raise HTTPException(status_code=403, detail="Unauthorized")

    urls = [_normalize_url(u) for u in req.urls if u.strip()][:100]
    if not urls:
        raise HTTPException(status_code=400, detail="No URLs provided")

    sem = asyncio.Semaphore(5)

    async def crawl_one(u: str) -> dict[str, Any]:
        async with sem:
            try:
                content = await _fetch_url_content(u)
                if not content.strip():
                    return {"url": u, "ok": False, "error": "no content or rate limited"}

                # Check for duplicates to update instead of insert
                existing = supabase.table("chatty_sources").select("id").eq("bot_id", req.bot_id).eq("type", "url").eq("name", u).execute()
                if existing.data:
                    # Update existing record
                    supabase.table("chatty_sources").update({
                        "content": content, "status": "trained", "char_count": len(content),
                    }).eq("id", existing.data[0]["id"]).execute()
                else:
                    # Insert new record
                    supabase.table("chatty_sources").insert({
                        "bot_id": req.bot_id, "type": "url", "name": u,
                        "content": content, "status": "trained", "char_count": len(content),
                    }).execute()
                return {"url": u, "ok": True, "chars": len(content)}
            except Exception as exc:
                logger.exception("crawl page failed: %s", u)
                return {"url": u, "ok": False, "error": str(exc)[:120]}

    results = await asyncio.gather(*[crawl_one(u) for u in urls])
    return {"results": results, "indexed": sum(1 for r in results if r.get("ok"))}


@router.patch("/api/sources/{source_id}/schedule")
async def update_source_schedule(
    source_id: str, req: SourceScheduleUpdate, user: dict[str, Any] = Depends(require_user)
):
    """Turn recurring auto re-crawl on/off for a single URL knowledge source."""
    if req.schedule not in ("off", "daily", "weekly", "monthly"):
        raise HTTPException(status_code=400, detail="schedule must be off, daily, weekly, or monthly")

    src_res = supabase.table("chatty_sources").select("id, bot_id, type").eq("id", source_id).execute()
    if not src_res.data:
        raise HTTPException(status_code=404, detail="Source not found")
    source = src_res.data[0]
    if source["type"] != "url":
        raise HTTPException(status_code=400, detail="Scheduling is only available for URL sources")

    bot_res = supabase.table("chatty_bots").select("id").eq("id", source["bot_id"]).eq(
        "user_id", user["auth_user_id"]).execute()
    if not bot_res.data:
        raise HTTPException(status_code=403, detail="Unauthorized")

    supabase.table("chatty_sources").update({
        "crawl_schedule": req.schedule,
        "next_crawl_at": _next_crawl_at(req.schedule),
    }).eq("id", source_id).execute()
    return {"success": True, "schedule": req.schedule, "next_crawl_at": _next_crawl_at(req.schedule)}


@router.post("/cron/execute-scheduled-crawls")
async def execute_scheduled_crawls(secret: Optional[str] = None):
    """Re-crawl any URL source whose next_crawl_at has passed. Triggered by an
    external scheduler (e.g. Cloud Scheduler) hitting this endpoint periodically,
    same pattern as /cron/execute-scheduled-tasks."""
    if FUNCTION_SECRET and secret != FUNCTION_SECRET:
        raise HTTPException(status_code=403, detail="invalid secret")

    now = datetime.now(timezone.utc)
    res = supabase.table("chatty_sources").select("id, bot_id, name, crawl_schedule, next_crawl_at") \
        .eq("type", "url").neq("crawl_schedule", "off").lte("next_crawl_at", now.isoformat()).execute()
    due = res.data or []

    sem = asyncio.Semaphore(5)

    async def recrawl_one(src: dict[str, Any]) -> dict[str, Any]:
        async with sem:
            try:
                content = await _fetch_url_content(src["name"])
                if not content.strip():
                    # Don't clear the schedule on a transient fetch failure — try again next cycle.
                    return {"id": src["id"], "ok": False, "error": "no content or rate limited"}
                supabase.table("chatty_sources").update({
                    "content": content,
                    "status": "trained",
                    "char_count": len(content),
                    "last_crawled_at": now.isoformat(),
                    "next_crawl_at": _next_crawl_at(src["crawl_schedule"], now),
                }).eq("id", src["id"]).execute()
                return {"id": src["id"], "ok": True, "chars": len(content)}
            except Exception as exc:
                logger.exception("scheduled re-crawl failed for source %s", src["id"])
                return {"id": src["id"], "ok": False, "error": str(exc)[:120]}

    results = await asyncio.gather(*[recrawl_one(s) for s in due])
    return {"checked": len(due), "recrawled": sum(1 for r in results if r.get("ok")), "results": results}
