"""WordPress Content & Knowledge Base Integration Service for Chatty AI.

Provides:
- Zero-config public WordPress REST API (/wp-json/wp/v2/posts & /wp-json/wp/v2/pages) discovery
  with optional WordPress Application Password Basic Auth for private/protected sites.
- Sitemap XML fallback when WP REST API is restricted by a security plugin.
- 1-Click bulk training of WordPress Pages & Posts directly into `chatty_sources`
  (`type="url"`, `status="trained"`) so the AI agent answers with clickable source citations.
- Real-time HMAC-SHA256 webhook receiver for instant `save_post` / `trashed_post` updates.
- Ready-to-paste WordPress PHP snippet (WPCode / functions.php) that both embeds the Chatty
  widget and pushes real-time content updates to the Knowledge Base.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import html
import logging
import re
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from html.parser import HTMLParser
from typing import Any, Optional

import httpx

from app.core import ssrf
from app.core.clients import supabase
from app.core.crypto import decrypt_secret, encrypt_secret
from app.core.db import run_db

logger = logging.getLogger("chatty.wordpress")


class _WPHTMLCleaner(HTMLParser):
    """Convert WordPress rendered HTML into clean, readable text with paragraph breaks."""

    BLOCK_TAGS = frozenset({
        "p", "div", "section", "article", "header", "footer",
        "h1", "h2", "h3", "h4", "h5", "h6", "li", "tr", "br", "blockquote",
    })

    def __init__(self) -> None:
        super().__init__(convert_charrefs=False)
        self.parts: list[str] = []
        self._skip_depth = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, Optional[str]]]) -> None:
        t = tag.lower()
        if t in ("script", "style", "noscript", "svg"):
            self._skip_depth += 1
            return
        if self._skip_depth == 0:
            if t in ("h1", "h2", "h3", "h4"):
                self.parts.append("\n\n### ")
            elif t == "li":
                self.parts.append("\n- ")
            elif t in self.BLOCK_TAGS:
                self.parts.append("\n")

    def handle_endtag(self, tag: str) -> None:
        t = tag.lower()
        if t in ("script", "style", "noscript", "svg") and self._skip_depth > 0:
            self._skip_depth -= 1
            return
        if self._skip_depth == 0 and t in self.BLOCK_TAGS:
            self.parts.append("\n")

    def handle_data(self, data: str) -> None:
        if self._skip_depth == 0:
            self.parts.append(data)

    def handle_entityref(self, name: str) -> None:
        if self._skip_depth == 0:
            self.parts.append(f"&{name};")

    def handle_charref(self, name: str) -> None:
        if self._skip_depth == 0:
            self.parts.append(f"&#{name};")


def clean_wp_html(raw_html: Optional[str]) -> str:
    """Strip WordPress HTML/Gutenberg blocks into clean, structured plain text."""
    if not raw_html:
        return ""
    parser = _WPHTMLCleaner()
    parser.feed(str(raw_html))
    parser.close()
    text = html.unescape("".join(parser.parts))
    lines = [re.sub(r"[ \t]+", " ", line).strip() for line in text.splitlines()]
    cleaned = "\n".join(line for line in lines if line)
    return re.sub(r"\n{3,}", "\n\n", cleaned).strip()


def normalize_site_url(url: str) -> str:
    """Normalize WordPress site URL with https scheme and no trailing slash."""
    clean = (url or "").strip().rstrip("/")
    if clean and not clean.startswith(("http://", "https://")):
        clean = f"https://{clean}"
    # Strip trailing /wp-admin or /wp-json if user pasted admin URL
    for suffix in ("/wp-admin", "/wp-login.php", "/wp-json"):
        if clean.lower().endswith(suffix):
            clean = clean[: -len(suffix)].rstrip("/")
    return clean


def _protect(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    clean = str(value).strip()
    if not clean:
        return None
    if clean.startswith("gAAAA") and len(clean) > 60:
        return clean
    return encrypt_secret(clean)


def _unprotect(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    try:
        return decrypt_secret(str(value))
    except Exception:
        return str(value)


def verify_webhook_signature(secret: str, raw_body: bytes, signature_header: str) -> bool:
    """Verify HMAC-SHA256 signature (supports hex or base64 encoding)."""
    if not secret or not signature_header:
        return False
    sig = signature_header.strip()
    if sig.startswith("sha256="):
        sig = sig.split("=", 1)[1].strip()
    digest = hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256).digest()
    expected_hex = digest.hex()
    expected_b64 = base64.b64encode(digest).decode("utf-8")
    return hmac.compare_digest(sig.lower(), expected_hex.lower()) or hmac.compare_digest(sig, expected_b64)


async def get_integration(bot_id: str) -> Optional[dict[str, Any]]:
    """Read WordPress integration config stored in `chatty_bots.whatsapp_quick_replies._omnichannel._wordpress`."""
    res = await run_db(
        lambda: supabase.table("chatty_bots")
        .select("id,name,whatsapp_quick_replies")
        .eq("id", bot_id)
        .limit(1)
        .execute()
    )
    if not res or not res.data:
        return None
    raw_wqr = res.data[0].get("whatsapp_quick_replies")
    wp_cfg: Optional[dict[str, Any]] = None
    if isinstance(raw_wqr, dict):
        if isinstance(raw_wqr.get("_wordpress"), dict):
            wp_cfg = dict(raw_wqr["_wordpress"])
        elif isinstance(raw_wqr.get("_omnichannel"), dict) and isinstance(raw_wqr["_omnichannel"].get("_wordpress"), dict):
            wp_cfg = dict(raw_wqr["_omnichannel"]["_wordpress"])
    if not wp_cfg or not wp_cfg.get("site_url"):
        return None
    if wp_cfg.get("app_password"):
        wp_cfg["app_password"] = _unprotect(wp_cfg.get("app_password"))
    if wp_cfg.get("webhook_secret"):
        wp_cfg["webhook_secret"] = _unprotect(wp_cfg.get("webhook_secret"))
    return wp_cfg


async def save_integration(
    bot_id: str,
    *,
    site_url: str,
    site_name: Optional[str] = None,
    username: Optional[str] = None,
    app_password: Optional[str] = None,
    sync_posts: bool = True,
    sync_pages: bool = True,
    extra_updates: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    """Persist WordPress integration settings inside `chatty_bots.whatsapp_quick_replies` JSONB envelope."""
    base_url = normalize_site_url(site_url)
    res = await run_db(
        lambda: supabase.table("chatty_bots")
        .select("id,whatsapp_quick_replies")
        .eq("id", bot_id)
        .limit(1)
        .execute()
    )
    if not res or not res.data:
        raise ValueError("Bot not found")

    raw_wqr = res.data[0].get("whatsapp_quick_replies")
    if isinstance(raw_wqr, dict):
        items = raw_wqr.get("items") if isinstance(raw_wqr.get("items"), list) else []
        omni = dict(raw_wqr.get("_omnichannel") or {}) if isinstance(raw_wqr.get("_omnichannel"), dict) else {}
        existing_wp = dict(omni.get("_wordpress") or raw_wqr.get("_wordpress") or {})
    elif isinstance(raw_wqr, list):
        items = list(raw_wqr)
        omni = {}
        existing_wp = {}
    else:
        items = []
        omni = {}
        existing_wp = {}

    now_iso = datetime.now(timezone.utc).isoformat()
    webhook_secret_plain = _unprotect(existing_wp.get("webhook_secret"))
    if not webhook_secret_plain:
        webhook_secret_plain = hashlib.sha256(f"wp:{bot_id}:{base_url}:{now_iso}".encode("utf-8")).hexdigest()[:32]

    app_pass_to_store = existing_wp.get("app_password")
    if app_password is not None and str(app_password).strip():
        app_pass_to_store = _protect(str(app_password).strip())

    wp_record: dict[str, Any] = {
        **existing_wp,
        "site_url": base_url,
        "site_name": site_name or existing_wp.get("site_name") or base_url,
        "username": (username.strip() if username is not None else existing_wp.get("username")) or None,
        "app_password": app_pass_to_store,
        "sync_posts": bool(sync_posts),
        "sync_pages": bool(sync_pages),
        "webhook_secret": _protect(webhook_secret_plain),
        "updated_at": now_iso,
        "created_at": existing_wp.get("created_at") or now_iso,
    }
    if extra_updates:
        wp_record.update(extra_updates)

    omni["_wordpress"] = wp_record
    new_wqr = {
        **(raw_wqr if isinstance(raw_wqr, dict) else {}),
        "items": items,
        "_omnichannel": omni,
        "_wordpress": wp_record,
    }

    await run_db(
        lambda: supabase.table("chatty_bots")
        .update({"whatsapp_quick_replies": new_wqr})
        .eq("id", bot_id)
        .execute()
    )

    out = dict(wp_record)
    out["webhook_secret"] = webhook_secret_plain
    out["has_app_password"] = bool(app_pass_to_store)
    out.pop("app_password", None)
    return out


async def delete_integration(bot_id: str) -> bool:
    """Remove WordPress integration state from the bot."""
    res = await run_db(
        lambda: supabase.table("chatty_bots")
        .select("id,whatsapp_quick_replies")
        .eq("id", bot_id)
        .limit(1)
        .execute()
    )
    if not res or not res.data:
        return False
    raw_wqr = res.data[0].get("whatsapp_quick_replies")
    if not isinstance(raw_wqr, dict):
        return True
    new_wqr = dict(raw_wqr)
    new_wqr.pop("_wordpress", None)
    if isinstance(new_wqr.get("_omnichannel"), dict):
        omni = dict(new_wqr["_omnichannel"])
        omni.pop("_wordpress", None)
        new_wqr["_omnichannel"] = omni
    await run_db(
        lambda: supabase.table("chatty_bots")
        .update({"whatsapp_quick_replies": new_wqr})
        .eq("id", bot_id)
        .execute()
    )
    return True


async def verify_wordpress_site(
    site_url: str,
    username: Optional[str] = None,
    app_password: Optional[str] = None,
) -> dict[str, Any]:
    """Probe a WordPress site via `/wp-json` and `/wp-json/wp/v2/{posts,pages}` (or Sitemap XML fallback)."""
    base_url = normalize_site_url(site_url)
    if not base_url.startswith(("https://", "http://")):
        return {"valid": False, "error": "Please enter a valid WordPress URL (e.g. https://mysite.com)."}

    auth = (username.strip(), app_password.strip()) if (username and app_password) else None
    timeout = httpx.Timeout(15.0, connect=8.0)
    headers = {"User-Agent": "ChattyAI-WordPress-Connector/1.0"}

    site_name = base_url
    posts_count = 0
    pages_count = 0
    rest_api_available = False

    try:
        async with httpx.AsyncClient(timeout=timeout, headers=headers, follow_redirects=True) as client:
            # 1. Probe root /wp-json for site metadata
            try:
                root_resp = await ssrf.request_async(client, "GET", f"{base_url}/wp-json", auth=auth)
                if root_resp.status_code == 200 and isinstance(root_resp.json(), dict):
                    data = root_resp.json()
                    site_name = str(data.get("name") or base_url).strip()
                    rest_api_available = True
            except Exception as exc:
                logger.info("WordPress /wp-json root probe warning: %s", exc)

            # 2. Probe posts count
            try:
                posts_resp = await ssrf.request_async(
                    client,
                    "GET",
                    f"{base_url}/wp-json/wp/v2/posts",
                    auth=auth,
                    params={"per_page": 1, "_fields": "id,title,link"},
                )
                if posts_resp.status_code == 200:
                    rest_api_available = True
                    posts_count = int(posts_resp.headers.get("x-wp-total") or len(posts_resp.json() or []))
                elif posts_resp.status_code in (401, 403) and auth:
                    return {
                        "valid": False,
                        "error": f"WordPress rejected the Application Password (HTTP {posts_resp.status_code}). Check your username and Application Password.",
                    }
            except Exception as exc:
                logger.info("WordPress posts probe warning: %s", exc)

            # 3. Probe pages count
            try:
                pages_resp = await ssrf.request_async(
                    client,
                    "GET",
                    f"{base_url}/wp-json/wp/v2/pages",
                    auth=auth,
                    params={"per_page": 1, "_fields": "id,title,link"},
                )
                if pages_resp.status_code == 200:
                    rest_api_available = True
                    pages_count = int(pages_resp.headers.get("x-wp-total") or len(pages_resp.json() or []))
            except Exception as exc:
                logger.info("WordPress pages probe warning: %s", exc)

            if rest_api_available:
                return {
                    "valid": True,
                    "mode": "wp_rest_api",
                    "site_url": base_url,
                    "site_name": site_name,
                    "posts_estimate": posts_count,
                    "pages_estimate": pages_count,
                    "total_estimate": posts_count + pages_count,
                }

            # 4. Fallback: probe WordPress Sitemap (/wp-sitemap.xml or /sitemap.xml)
            for sm_path in ("/wp-sitemap.xml", "/sitemap_index.xml", "/sitemap.xml"):
                try:
                    sm_resp = await ssrf.request_async(client, "GET", f"{base_url}{sm_path}", auth=auth)
                    if sm_resp.status_code == 200 and "<loc>" in sm_resp.text:
                        locs = re.findall(r"<loc>\s*(https?://[^<\s]+)\s*</loc>", sm_resp.text)
                        return {
                            "valid": True,
                            "mode": "sitemap_fallback",
                            "site_url": base_url,
                            "site_name": site_name,
                            "posts_estimate": len(locs),
                            "pages_estimate": 0,
                            "total_estimate": len(locs),
                        }
                except Exception:
                    continue

            return {
                "valid": False,
                "error": (
                    f"Could not reach WordPress REST API ({base_url}/wp-json/wp/v2) or Sitemap. "
                    "Verify the URL is a live HTTPS WordPress site and not blocked by a firewall."
                ),
            }
    except Exception as exc:
        logger.warning("verify_wordpress_site failed for %s: %s", base_url, exc)
        return {"valid": False, "error": str(exc)}


def format_wp_item_for_kb(item: dict[str, Any], kind: str = "page") -> Optional[dict[str, Any]]:
    """Convert a WordPress REST API post/page JSON object into a `chatty_sources` payload."""
    link = str(item.get("link") or item.get("url") or "").strip()
    if not link:
        return None

    raw_title = item.get("title")
    if isinstance(raw_title, dict):
        title = clean_wp_html(raw_title.get("rendered") or "")
    else:
        title = clean_wp_html(str(raw_title or ""))
    title = title or link

    raw_content = item.get("content")
    if isinstance(raw_content, dict):
        body_text = clean_wp_html(raw_content.get("rendered") or "")
    else:
        body_text = clean_wp_html(str(raw_content or ""))

    raw_excerpt = item.get("excerpt")
    if isinstance(raw_excerpt, dict):
        excerpt_text = clean_wp_html(raw_excerpt.get("rendered") or "")
    else:
        excerpt_text = clean_wp_html(str(raw_excerpt or ""))

    modified = str(item.get("modified_gmt") or item.get("modified") or item.get("date") or "").strip()
    wp_id = item.get("id")
    label = "WordPress Page" if kind == "page" else "WordPress Article / Post"

    sections = [
        f"Title: {title}",
        f"# {title}",
        f"Source Type: {label}",
        f"Canonical URL: {link}",
    ]
    if wp_id:
        sections.append(f"WordPress ID: {wp_id}")
    if modified:
        sections.append(f"Last Updated: {modified}")
    if excerpt_text and excerpt_text not in body_text[:500]:
        sections.append(f"\nSummary:\n{excerpt_text}")
    if body_text:
        sections.append(f"\nContent:\n{body_text}")

    full_content = "\n".join(sections).strip()
    if len(full_content) < 30:
        return None

    return {
        "name": link,
        "title": title,
        "content": full_content[:150000],
        "char_count": len(full_content[:150000]),
        "wp_id": wp_id,
        "kind": kind,
    }


async def upsert_kb_source(bot_id: str, formatted: dict[str, Any]) -> str:
    """Insert or update a trained URL source in `chatty_sources`."""
    url = formatted["name"]
    content = formatted["content"]
    char_count = formatted["char_count"]

    existing = await run_db(
        lambda: supabase.table("chatty_sources")
        .select("id")
        .eq("bot_id", bot_id)
        .eq("name", url)
        .limit(1)
        .execute()
    )
    if existing and existing.data:
        source_id = existing.data[0]["id"]
        await run_db(
            lambda: supabase.table("chatty_sources")
            .update({
                "type": "url",
                "content": content,
                "char_count": char_count,
                "status": "trained",
            })
            .eq("id", source_id)
            .execute()
        )
        return "updated"
    else:
        await run_db(
            lambda: supabase.table("chatty_sources")
            .insert({
                "bot_id": bot_id,
                "type": "url",
                "name": url,
                "content": content,
                "char_count": char_count,
                "status": "trained",
            })
            .execute()
        )
        return "created"


async def sync_wordpress_content(
    bot_id: str,
    *,
    max_items_per_type: int = 100,
) -> dict[str, Any]:
    """Fetch published WordPress Pages and Posts and index them into `chatty_sources`."""
    cfg = await get_integration(bot_id)
    if not cfg or not cfg.get("site_url"):
        return {"ok": False, "error": "WordPress site is not connected."}

    base_url = normalize_site_url(cfg["site_url"])
    username = cfg.get("username")
    app_password = cfg.get("app_password")
    sync_posts = bool(cfg.get("sync_posts", True))
    sync_pages = bool(cfg.get("sync_pages", True))

    auth = (str(username).strip(), str(app_password).strip()) if (username and app_password) else None
    timeout = httpx.Timeout(25.0, connect=10.0)
    headers = {"User-Agent": "ChattyAI-WordPress-Sync/1.0"}

    synced_pages = 0
    synced_posts = 0
    updated_count = 0
    created_count = 0
    errors: list[str] = []

    endpoints: list[tuple[str, str]] = []
    if sync_pages:
        endpoints.append(("page", f"{base_url}/wp-json/wp/v2/pages"))
    if sync_posts:
        endpoints.append(("post", f"{base_url}/wp-json/wp/v2/posts"))

    async with httpx.AsyncClient(timeout=timeout, headers=headers, follow_redirects=True) as client:
        for kind, endpoint in endpoints:
            page_num = 1
            per_page = 50
            fetched_for_kind = 0

            while fetched_for_kind < max_items_per_type:
                try:
                    resp = await ssrf.request_async(
                        client,
                        "GET",
                        endpoint,
                        auth=auth,
                        params={
                            "per_page": min(per_page, max_items_per_type - fetched_for_kind),
                            "page": page_num,
                            "status": "publish",
                            "_fields": "id,date,modified,modified_gmt,slug,status,type,link,title,content,excerpt",
                        },
                    )
                    if resp.status_code != 200:
                        if page_num == 1:
                            errors.append(f"HTTP {resp.status_code} fetching {kind}s")
                        break
                    items = resp.json()
                    if not isinstance(items, list) or not items:
                        break

                    for raw_item in items:
                        if not isinstance(raw_item, dict):
                            continue
                        formatted = format_wp_item_for_kb(raw_item, kind=kind)
                        if not formatted:
                            continue
                        action = await upsert_kb_source(bot_id, formatted)
                        if action == "created":
                            created_count += 1
                        else:
                            updated_count += 1
                        if kind == "page":
                            synced_pages += 1
                        else:
                            synced_posts += 1
                        fetched_for_kind += 1

                    total_pages = int(resp.headers.get("x-wp-totalpages") or 1)
                    if page_num >= total_pages or len(items) < per_page:
                        break
                    page_num += 1
                except Exception as exc:
                    logger.warning("WordPress sync error on %s page %s: %s", kind, page_num, exc)
                    errors.append(str(exc))
                    break

        # Sitemap XML + HTML extraction fallback when WP REST API is restricted by a security plugin
        if synced_pages + synced_posts == 0:
            candidate_urls: list[str] = []
            for sm_path in ("/wp-sitemap.xml", "/sitemap_index.xml", "/sitemap.xml"):
                try:
                    sm_resp = await ssrf.request_async(client, "GET", f"{base_url}{sm_path}", auth=auth)
                    if sm_resp.status_code == 200 and "<loc>" in sm_resp.text:
                        locs = re.findall(r"<loc>\s*(https?://[^<\s]+)\s*</loc>", sm_resp.text)
                        for loc in locs:
                            if loc.endswith(".xml") and len(candidate_urls) < 40:
                                try:
                                    sub_resp = await ssrf.request_async(client, "GET", loc, auth=auth)
                                    if sub_resp.status_code == 200:
                                        sub_locs = re.findall(r"<loc>\s*(https?://[^<\s]+)\s*</loc>", sub_resp.text)
                                        candidate_urls.extend([u for u in sub_locs if not u.endswith(".xml")])
                                except Exception:
                                    continue
                            elif not loc.endswith(".xml"):
                                candidate_urls.append(loc)
                        if candidate_urls:
                            break
                except Exception:
                    continue

            for page_url in candidate_urls[:35]:
                try:
                    p_resp = await ssrf.request_async(client, "GET", page_url, auth=auth)
                    if p_resp.status_code != 200 or not p_resp.text:
                        continue
                    raw_html = p_resp.text
                    title_m = re.search(r"<title[^>]*>(.*?)</title>", raw_html, re.IGNORECASE | re.DOTALL)
                    page_title = clean_wp_html(title_m.group(1)) if title_m else page_url
                    body_m = (
                        re.search(r"<main[^>]*>(.*?)</main>", raw_html, re.IGNORECASE | re.DOTALL)
                        or re.search(r"<article[^>]*>(.*?)</article>", raw_html, re.IGNORECASE | re.DOTALL)
                        or re.search(r"<body[^>]*>(.*?)</body>", raw_html, re.IGNORECASE | re.DOTALL)
                    )
                    body_html = body_m.group(1) if body_m else raw_html
                    formatted = format_wp_item_for_kb(
                        {"link": page_url, "title": page_title, "content": body_html},
                        kind="page",
                    )
                    if not formatted:
                        continue
                    action = await upsert_kb_source(bot_id, formatted)
                    if action == "created":
                        created_count += 1
                    else:
                        updated_count += 1
                    synced_pages += 1
                except Exception:
                    continue

    total_synced = synced_pages + synced_posts
    now_iso = datetime.now(timezone.utc).isoformat()
    await save_integration(
        bot_id,
        site_url=base_url,
        site_name=cfg.get("site_name"),
        username=username,
        app_password=app_password,
        sync_posts=sync_posts,
        sync_pages=sync_pages,
        extra_updates={
            "sync_status": "synced" if total_synced > 0 or not errors else "failed",
            "synced_pages": synced_pages,
            "synced_posts": synced_posts,
            "synced_total": total_synced,
            "last_synced_at": now_iso,
            "last_error": "; ".join(errors[:2]) if errors and total_synced == 0 else None,
        },
    )

    return {
        "ok": True,
        "synced_pages": synced_pages,
        "synced_posts": synced_posts,
        "synced_total": total_synced,
        "created_sources": created_count,
        "updated_sources": updated_count,
        "last_synced_at": now_iso,
        "errors": errors,
    }


async def process_wordpress_webhook(
    bot_id: str,
    payload: dict[str, Any],
) -> dict[str, Any]:
    """Process real-time WordPress `save_post` / `trashed_post` webhook event."""
    action = str(payload.get("action") or payload.get("event") or "updated").strip().lower()
    link = str(payload.get("link") or payload.get("url") or payload.get("permalink") or "").strip()
    post_type = str(payload.get("post_type") or payload.get("type") or "post").strip().lower()
    post_status = str(payload.get("post_status") or payload.get("status") or "publish").strip().lower()

    if ("delete" in action or "trash" in action or post_status in ("trash", "draft", "private")) and link:
        await run_db(
            lambda: supabase.table("chatty_sources")
            .delete()
            .eq("bot_id", bot_id)
            .eq("name", link)
            .execute()
        )
        return {"event": "deleted", "url": link}

    kind = "page" if post_type == "page" else "post"
    formatted = format_wp_item_for_kb(payload, kind=kind)
    if not formatted:
        return {"ignored": True, "reason": "Insufficient content or missing link"}

    result_action = await upsert_kb_source(bot_id, formatted)
    return {
        "event": result_action,
        "url": formatted["name"],
        "title": formatted["title"],
        "char_count": formatted["char_count"],
    }


def build_wordpress_php_snippet(
    *,
    bot_id: str,
    frontend_url: str,
    webhook_url: str,
    webhook_secret: str,
) -> str:
    """Return a ready-to-paste WordPress PHP snippet for WPCode or functions.php
    that both embeds the Chatty widget and pushes real-time save_post / trashed_post updates.
    """
    clean_frontend = (frontend_url or "https://chatty.personaliai.com").rstrip("/")
    return f"""<?php
/**
 * Chatty AI — WordPress Widget Embed + Automatic Knowledge Base Sync
 * Paste into WPCode (Code Snippets plugin) or your active theme's functions.php
 */

// 1. Embed the Chatty AI Assistant Widget on your WordPress site
add_action('wp_footer', function () {{
    if (is_admin()) return;
    ?>
    <script
      src="{clean_frontend}/widget.js"
      data-bot-id="{bot_id}"
      defer
    ></script>
    <?php
}});

// 2. Automatically sync published Pages & Posts to Chatty Knowledge Base in real time
add_action('save_post', function ($post_id, $post, $update) {{
    if (wp_is_post_revision($post_id) || wp_is_post_autosave($post_id)) return;
    if (!in_array($post->post_type, array('post', 'page'), true)) return;

    $payload = wp_json_encode(array(
        'action'      => $post->post_status === 'publish' ? 'updated' : 'deleted',
        'id'          => $post_id,
        'post_type'   => $post->post_type,
        'post_status' => $post->post_status,
        'title'       => get_the_title($post_id),
        'link'        => get_permalink($post_id),
        'content'     => apply_filters('the_content', $post->post_content),
        'excerpt'     => get_the_excerpt($post_id),
        'modified'    => $post->post_modified_gmt,
    ));

    $signature = hash_hmac('sha256', $payload, '{webhook_secret}');

    wp_remote_post('{webhook_url}', array(
        'method'   => 'POST',
        'timeout'  => 5,
        'blocking' => false,
        'headers'  => array(
            'Content-Type'          => 'application/json',
            'X-WP-Chatty-Signature' => $signature,
        ),
        'body'     => $payload,
    ));
}}, 10, 3);
"""
