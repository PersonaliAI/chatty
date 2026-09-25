"""Durable website crawl job handlers."""

from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone
from typing import Any

from app.core.clients import supabase
from app.core.db import run_db


def _next_crawl_at(schedule: str) -> str | None:
    interval = {"daily": timedelta(days=1), "weekly": timedelta(days=7), "monthly": timedelta(days=30)}.get(schedule)
    return (datetime.now(timezone.utc) + interval).isoformat() if interval else None


async def _crawl_one(bot_id: str, url: str) -> dict[str, Any]:
    from main import _fetch_url_content

    content = await _fetch_url_content(url)
    if not content.strip():
        return {"url": url, "ok": False, "error": "no content or rate limited"}
    existing = await run_db(lambda: supabase.table("chatty_sources").select("id").eq("bot_id", bot_id).eq("type", "url").eq("name", url).execute())
    if existing.data:
        await run_db(lambda: supabase.table("chatty_sources").update({"content": content, "status": "trained", "char_count": len(content)}).eq("id", existing.data[0]["id"]).execute())
    else:
        await run_db(lambda: supabase.table("chatty_sources").insert({"bot_id": bot_id, "type": "url", "name": url, "content": content, "status": "trained", "char_count": len(content)}).execute())
    return {"url": url, "ok": True, "chars": len(content)}


async def process_crawl_job(payload: dict[str, Any]) -> None:
    if payload.get("urls"):
        sem = asyncio.Semaphore(5)
        async def limited(url: str):
            async with sem:
                return await _crawl_one(str(payload["bot_id"]), str(url))
        results = await asyncio.gather(*(limited(url) for url in payload["urls"]))
        if not any(result.get("ok") for result in results):
            raise RuntimeError("all crawl pages failed")
        return
    source_id = str(payload.get("source_id") or "").strip()
    bot_id = str(payload.get("bot_id") or "").strip()
    url = str(payload.get("url") or "").strip()
    if not source_id or not bot_id or not url:
        raise ValueError("scheduled crawl job is missing source fields")
    result = await _crawl_one(bot_id, url)
    if not result.get("ok"):
        raise RuntimeError(result.get("error") or "scheduled crawl failed")
    await run_db(lambda: supabase.table("chatty_sources").update({
        "last_crawled_at": datetime.now(timezone.utc).isoformat(),
        "next_crawl_at": _next_crawl_at(str(payload.get("schedule") or "")),
    }).eq("id", source_id).execute())
