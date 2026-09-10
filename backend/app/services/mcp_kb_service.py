"""Help Center / Knowledge Base category and article management service
for the Developer API and Model Context Protocol (MCP) server.
"""

from __future__ import annotations

import re
import time
from datetime import datetime, timezone
from typing import Any, Optional, List

from fastapi import HTTPException

from app.core import oauth as _oauth
from app.core.clients import supabase
from app.core.db import run_db


def _slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s_-]+", "-", text)
    return text.strip("-")


# ---------------------------------------------------------------------------
# CATEGORIES
# ---------------------------------------------------------------------------

async def list_kb_categories(principal: dict[str, Any], bot_id: str) -> list[dict[str, Any]]:
    """List all Help Center categories for a bot, including article counts."""
    await _oauth.require_bot_access(principal, bot_id)

    res = await run_db(lambda: supabase.table("chatty_kb_categories")
        .select("id, bot_id, name, slug, description, icon, order_index, created_at, updated_at")
        .eq("bot_id", bot_id)
        .order("order_index")
        .order("created_at")
        .execute())
    categories = res.data or []

    # Count articles per category
    art_res = await run_db(lambda: supabase.table("chatty_kb_articles")
        .select("category_id")
        .eq("bot_id", bot_id)
        .execute())
    counts: dict[str, int] = {}
    for a in (art_res.data or []):
        cat_id = a.get("category_id")
        if cat_id:
            counts[cat_id] = counts.get(cat_id, 0) + 1

    for c in categories:
        c["article_count"] = counts.get(c["id"], 0)

    return categories


async def create_kb_category(
    principal: dict[str, Any],
    bot_id: str,
    name: str,
    slug: Optional[str] = None,
    description: str = "",
    icon: str = "Folder",
    order_index: int = 0,
) -> dict[str, Any]:
    """Create a new Help Center category."""
    await _oauth.require_bot_access(principal, bot_id)
    cat_slug = _slugify(slug or name)

    # Check for slug collision
    existing = await run_db(lambda: supabase.table("chatty_kb_categories")
        .select("id")
        .eq("bot_id", bot_id)
        .eq("slug", cat_slug)
        .execute())
    if existing.data:
        cat_slug = f"{cat_slug}-{int(time.time())}"

    row = {
        "bot_id": bot_id,
        "name": name.strip(),
        "slug": cat_slug,
        "description": description.strip(),
        "icon": icon.strip() or "Folder",
        "order_index": order_index or 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    res = await run_db(lambda: supabase.table("chatty_kb_categories").insert(row).execute())
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to create category")
    return res.data[0]


async def update_kb_category(
    principal: dict[str, Any],
    bot_id: str,
    category_id: str,
    name: Optional[str] = None,
    slug: Optional[str] = None,
    description: Optional[str] = None,
    icon: Optional[str] = None,
    order_index: Optional[int] = None,
) -> dict[str, Any]:
    """Update an existing Help Center category."""
    await _oauth.require_bot_access(principal, bot_id)

    cat_res = await run_db(lambda: supabase.table("chatty_kb_categories").select("*").eq("id", category_id).eq("bot_id", bot_id).execute())
    if not cat_res.data:
        raise HTTPException(status_code=404, detail="Category not found")
    cat = cat_res.data[0]

    updates: dict[str, Any] = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if name is not None:
        updates["name"] = name.strip()
    if slug is not None:
        updates["slug"] = _slugify(slug)
    if description is not None:
        updates["description"] = description.strip()
    if icon is not None:
        updates["icon"] = icon.strip()
    if order_index is not None:
        updates["order_index"] = order_index

    res = await run_db(lambda: supabase.table("chatty_kb_categories").update(updates).eq("id", category_id).execute())
    return res.data[0] if res.data else cat


async def delete_kb_category(
    principal: dict[str, Any],
    bot_id: str,
    category_id: str,
) -> dict[str, Any]:
    """Delete a Help Center category (associated articles will have category_id set to null)."""
    await _oauth.require_bot_access(principal, bot_id)

    cat_res = await run_db(lambda: supabase.table("chatty_kb_categories").select("id").eq("id", category_id).eq("bot_id", bot_id).execute())
    if not cat_res.data:
        raise HTTPException(status_code=404, detail="Category not found")

    await run_db(lambda: supabase.table("chatty_kb_categories").delete().eq("id", category_id).execute())
    return {"success": True, "deleted_category_id": category_id}


# ---------------------------------------------------------------------------
# ARTICLES
# ---------------------------------------------------------------------------

async def list_kb_articles(
    principal: dict[str, Any],
    bot_id: str,
    category_id: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
) -> list[dict[str, Any]]:
    """List Help Center articles with optional category, status, and search filters."""
    await _oauth.require_bot_access(principal, bot_id)

    q = supabase.table("chatty_kb_articles").select(
        "id, bot_id, category_id, title, slug, subtitle, content, status, visibility, author_name, tags, is_promoted, order_index, view_count, helpful_count, not_helpful_count, created_at, updated_at, category:chatty_kb_categories(name, slug, icon)"
    ).eq("bot_id", bot_id)

    if category_id:
        q = q.eq("category_id", category_id)
    if status:
        q = q.eq("status", status)
    q = q.order("order_index").order("created_at", desc=True)

    res = await run_db(lambda: q.execute())
    articles = res.data or []

    if search:
        s = search.lower().strip()
        articles = [
            a for a in articles
            if s in (a.get("title") or "").lower()
            or s in (a.get("content") or "").lower()
            or any(s in t.lower() for t in (a.get("tags") or []))
        ]

    return articles


async def get_kb_article(
    principal: dict[str, Any],
    bot_id: str,
    article_id: str,
) -> dict[str, Any]:
    """Fetch complete article details including full content, category metadata, and metrics."""
    await _oauth.require_bot_access(principal, bot_id)

    res = await run_db(lambda: supabase.table("chatty_kb_articles")
        .select("*, category:chatty_kb_categories(name, slug, icon)")
        .eq("id", article_id)
        .eq("bot_id", bot_id)
        .execute())
    if not res.data:
        raise HTTPException(status_code=404, detail="Article not found")
    return res.data[0]


async def create_kb_article(
    principal: dict[str, Any],
    bot_id: str,
    title: str,
    content: str,
    category_id: Optional[str] = None,
    subtitle: str = "",
    slug: Optional[str] = None,
    tags: Optional[List[str]] = None,
    is_promoted: bool = False,
    order_index: int = 0,
    status: str = "published",
    visibility: str = "public",
) -> dict[str, Any]:
    """Create a new Help Center article and automatically sync it to the AI assistant's RAG knowledge base."""
    await _oauth.require_bot_access(principal, bot_id)
    art_slug = _slugify(slug or title)

    # Check for slug collision
    existing = await run_db(lambda: supabase.table("chatty_kb_articles")
        .select("id")
        .eq("bot_id", bot_id)
        .eq("slug", art_slug)
        .execute())
    if existing.data:
        art_slug = f"{art_slug}-{int(time.time())}"

    user_email = principal.get("email") or ""
    author_name = principal.get("name") or (user_email.split("@")[0] if user_email else "AI Assistant")
    author_id = principal.get("user_id") or principal.get("id")

    source_id = None
    # Auto-sync to chatty_sources if published & public
    if status == "published" and visibility == "public" and content.strip():
        source_name = f"Article: {title.strip()}"
        src_res = await run_db(lambda: supabase.table("chatty_sources").insert({
            "bot_id": bot_id,
            "type": "text",
            "name": source_name,
            "content": content.strip(),
            "char_count": len(content.strip()),
            "status": "trained",
        }).execute())
        if src_res.data:
            source_id = src_res.data[0]["id"]

    row = {
        "bot_id": bot_id,
        "category_id": category_id or None,
        "title": title.strip(),
        "slug": art_slug,
        "subtitle": subtitle.strip(),
        "content": content.strip(),
        "status": status or "published",
        "visibility": visibility or "public",
        "author_id": author_id,
        "author_name": author_name,
        "author_email": user_email,
        "tags": tags or [],
        "is_promoted": bool(is_promoted),
        "order_index": order_index or 0,
        "source_id": source_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    res = await run_db(lambda: supabase.table("chatty_kb_articles").insert(row).execute())
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to create article")
    return res.data[0]


async def update_kb_article(
    principal: dict[str, Any],
    bot_id: str,
    article_id: str,
    title: Optional[str] = None,
    content: Optional[str] = None,
    subtitle: Optional[str] = None,
    category_id: Optional[str] = None,
    slug: Optional[str] = None,
    tags: Optional[List[str]] = None,
    is_promoted: Optional[bool] = None,
    order_index: Optional[int] = None,
    status: Optional[str] = None,
    visibility: Optional[str] = None,
) -> dict[str, Any]:
    """Update a Help Center article and keep RAG memory in sync."""
    await _oauth.require_bot_access(principal, bot_id)

    art_res = await run_db(lambda: supabase.table("chatty_kb_articles").select("*").eq("id", article_id).eq("bot_id", bot_id).execute())
    if not art_res.data:
        raise HTTPException(status_code=404, detail="Article not found")
    article = art_res.data[0]

    updates: dict[str, Any] = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if title is not None:
        updates["title"] = title.strip()
    if slug is not None:
        updates["slug"] = _slugify(slug)
    if category_id is not None:
        updates["category_id"] = category_id if category_id != "" else None
    if subtitle is not None:
        updates["subtitle"] = subtitle.strip()
    if content is not None:
        updates["content"] = content.strip()
    if tags is not None:
        updates["tags"] = tags
    if is_promoted is not None:
        updates["is_promoted"] = bool(is_promoted)
    if order_index is not None:
        updates["order_index"] = order_index
    if status is not None:
        updates["status"] = status
    if visibility is not None:
        updates["visibility"] = visibility

    # Sync to chatty_sources for RAG memory
    current_status = updates.get("status", article.get("status"))
    current_vis = updates.get("visibility", article.get("visibility"))
    current_title = updates.get("title", article.get("title"))
    current_content = updates.get("content", article.get("content"))
    source_id = article.get("source_id")

    if current_status == "published" and current_vis == "public" and current_content:
        if source_id:
            await run_db(lambda: supabase.table("chatty_sources").update({
                "name": f"Article: {current_title}",
                "content": current_content,
                "char_count": len(current_content),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }).eq("id", source_id).execute())
        else:
            src_res = await run_db(lambda: supabase.table("chatty_sources").insert({
                "bot_id": bot_id,
                "type": "text",
                "name": f"Article: {current_title}",
                "content": current_content,
                "char_count": len(current_content),
                "status": "trained",
            }).execute())
            if src_res.data:
                updates["source_id"] = src_res.data[0]["id"]
    elif source_id and (current_status != "published" or current_vis != "public"):
        await run_db(lambda: supabase.table("chatty_sources").delete().eq("id", source_id).execute())
        updates["source_id"] = None

    res = await run_db(lambda: supabase.table("chatty_kb_articles").update(updates).eq("id", article_id).execute())
    return res.data[0] if res.data else {**article, **updates}


async def delete_kb_article(
    principal: dict[str, Any],
    bot_id: str,
    article_id: str,
) -> dict[str, Any]:
    """Delete a Help Center article and remove its associated vector RAG source."""
    await _oauth.require_bot_access(principal, bot_id)

    art_res = await run_db(lambda: supabase.table("chatty_kb_articles").select("id, source_id").eq("id", article_id).eq("bot_id", bot_id).execute())
    if not art_res.data:
        raise HTTPException(status_code=404, detail="Article not found")
    source_id = art_res.data[0].get("source_id")

    if source_id:
        await run_db(lambda: supabase.table("chatty_sources").delete().eq("id", source_id).execute())

    await run_db(lambda: supabase.table("chatty_kb_articles").delete().eq("id", article_id).execute())
    return {"success": True, "deleted_article_id": article_id}


# ---------------------------------------------------------------------------
# ANALYTICS & DEFLECTION
# ---------------------------------------------------------------------------

async def get_kb_analytics(principal: dict[str, Any], bot_id: str) -> dict[str, Any]:
    """Fetch Help Center metrics: views, CSAT helpfulness ratings, content gaps, and top articles."""
    await _oauth.require_bot_access(principal, bot_id)

    art_res = await run_db(lambda: supabase.table("chatty_kb_articles")
        .select("id, title, slug, view_count, helpful_count, not_helpful_count, status, created_at")
        .eq("bot_id", bot_id)
        .execute())
    articles = art_res.data or []

    total_articles = len(articles)
    published_count = sum(1 for a in articles if a.get("status") == "published")
    draft_count = sum(1 for a in articles if a.get("status") == "draft")
    archived_count = sum(1 for a in articles if a.get("status") == "archived")

    total_views = sum(a.get("view_count") or 0 for a in articles)
    total_helpful = sum(a.get("helpful_count") or 0 for a in articles)
    total_not_helpful = sum(a.get("not_helpful_count") or 0 for a in articles)
    total_votes = total_helpful + total_not_helpful
    csat_percent = round((total_helpful / total_votes * 100), 1) if total_votes > 0 else 100.0

    top_articles = sorted(articles, key=lambda a: a.get("view_count") or 0, reverse=True)[:5]

    search_res = await run_db(lambda: supabase.table("chatty_kb_searches")
        .select("query, created_at")
        .eq("bot_id", bot_id)
        .eq("results_count", 0)
        .order("created_at", desc=True)
        .limit(50)
        .execute())
    searches = search_res.data or []
    query_freq: dict[str, int] = {}
    for s in searches:
        q = (s.get("query") or "").strip().lower()
        if q:
            query_freq[q] = query_freq.get(q, 0) + 1
    content_gaps = [{"query": q, "count": cnt} for q, cnt in sorted(query_freq.items(), key=lambda x: x[1], reverse=True)[:10]]

    cat_res = await run_db(lambda: supabase.table("chatty_kb_categories").select("id", count="exact").eq("bot_id", bot_id).execute())
    total_categories = cat_res.count if cat_res.count is not None else len(cat_res.data or [])

    return {
        "bot_id": bot_id,
        "total_articles": total_articles,
        "published_count": published_count,
        "draft_count": draft_count,
        "archived_count": archived_count,
        "total_categories": total_categories,
        "total_views": total_views,
        "total_helpful": total_helpful,
        "total_not_helpful": total_not_helpful,
        "csat_percent": csat_percent,
        "top_articles": top_articles,
        "content_gaps": content_gaps,
    }
