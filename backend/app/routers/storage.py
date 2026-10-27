"""Storage Management & Usage Analytics Router.

Provides categorized storage usage metrics (Visitor uploads, Product catalog media,
Knowledge documents, Branding assets), file browsing with sizes and upload dates,
individual file deletion to free up space, and automated retention cleanup.
Supports both account-wide aggregation across all chatbots and bot-specific views.
"""

from __future__ import annotations

import datetime
import logging
import math
import os
import re
from typing import Any, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.core.clients import supabase
from app.core.db import run_db
from app.core.deps import require_user
from app.core.permissions import get_bot_role_and_permissions, verify_bot_permission

logger = logging.getLogger("chatty")

router = APIRouter(tags=["storage"])


class DeleteFilesRequest(BaseModel):
    paths: list[str] = Field(default_factory=list)
    bucket: str = "chatty-uploads"
    files: Optional[list[dict[str, str]]] = None  # optional [{"bucket": "...", "path": "..."}]


class CleanupStorageRequest(BaseModel):
    older_than_days: int = Field(default=30, ge=1, le=3650)
    category: str = "visitor_uploads"


class AccountCleanupStorageRequest(BaseModel):
    older_than_days: int = Field(default=30, ge=1, le=3650)
    bot_id: Optional[str] = None  # None or 'all' = across all bots
    category: str = "visitor_uploads"


def _format_size(size_bytes: int) -> str:
    if size_bytes < 1024:
        return f"{size_bytes} B"
    elif size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.1f} KB"
    elif size_bytes < 1024 * 1024 * 1024:
        return f"{size_bytes / (1024 * 1024):.2f} MB"
    else:
        return f"{size_bytes / (1024 * 1024 * 1024):.2f} GB"


async def _collect_storage_files(bucket: str, prefix: str, max_depth: int = 5) -> list[dict[str, Any]]:
    """Recursively collect storage objects under a prefix with metadata."""
    if max_depth <= 0:
        return []

    collected: list[dict[str, Any]] = []
    try:
        items = await run_db(lambda: supabase.storage.from_(bucket).list(prefix))
    except Exception as exc:
        logger.warning("Failed to list storage path %s in bucket %s: %s", prefix, bucket, exc)
        return []

    if not items:
        return []

    for item in items:
        name = item.get("name") or ""
        if not name or name.startswith("."):
            continue

        subpath = f"{prefix}/{name}".strip("/")
        # Check if item is a folder (folders have id == None in Supabase storage)
        if item.get("id") is None:
            sub_files = await _collect_storage_files(bucket, subpath, max_depth - 1)
            collected.extend(sub_files)
        else:
            meta = item.get("metadata") or {}
            size = meta.get("size") or item.get("size") or 0
            created_at = item.get("created_at") or meta.get("lastModified") or item.get("updated_at")
            collected.append({
                "name": name,
                "path": subpath,
                "bucket": bucket,
                "size_bytes": int(size),
                "created_at": created_at,
                "mimetype": meta.get("mimetype") or "application/octet-stream",
            })

    return collected


async def _assemble_storage_data(
    bots: list[dict[str, Any]],
    owner_user: dict[str, Any],
    caller_user: dict[str, Any],
    selected_bot_id: Optional[str] = None,
) -> dict[str, Any]:
    """Assemble unified storage analytics and file list across the provided bots."""
    bot_map = {b["id"]: b.get("name") or "Chatbot" for b in bots}
    bot_ids = list(bot_map.keys())

    is_admin = bool(
        owner_user.get("role") == "admin"
        or caller_user.get("role") == "admin"
        or caller_user.get("is_admin")
    )
    plan = str(owner_user.get("plan") or caller_user.get("plan") or "chatty_hobby").lower()

    storage_limit_mb = None if (is_admin or "enterprise" in plan) else (
        500 if "hobby" in plan else 2048 if "standard" in plan else 10240
    )

    all_files: list[dict[str, Any]] = []
    cat_visitor_bytes = 0
    cat_visitor_count = 0
    cat_catalog_bytes = 0
    cat_catalog_count = 0
    cat_branding_bytes = 0
    cat_branding_count = 0
    cat_knowledge_bytes = 0
    cat_knowledge_count = 0

    # 1. Collect knowledge sources for all target bots
    if bot_ids:
        try:
            sources_res = await run_db(
                lambda: supabase.table("chatty_sources")
                .select("id, bot_id, name, type, char_count, created_at, status")
                .in_("bot_id", bot_ids)
                .execute()
            )
            for src in (sources_res.data or []):
                s_bot_id = src.get("bot_id")
                s_bot_name = bot_map.get(s_bot_id, "Chatbot")
                char_count = int(src.get("char_count") or 0)
                src_bytes = int(char_count * 1.2)
                cat_knowledge_bytes += src_bytes
                cat_knowledge_count += 1
                all_files.append({
                    "id": f"source:{src['id']}",
                    "name": src.get("name") or f"Knowledge Source ({src.get('type')})",
                    "path": f"sources/{src['id']}",
                    "bucket": "database",
                    "category": "knowledge_sources",
                    "category_label": f"Knowledge ({src.get('type', 'doc')})",
                    "size_bytes": src_bytes,
                    "size_formatted": _format_size(src_bytes),
                    "created_at": src.get("created_at"),
                    "url": None,
                    "session_id": None,
                    "mimetype": "text/plain",
                    "status": src.get("status"),
                    "bot_id": s_bot_id,
                    "bot_name": s_bot_name,
                })
        except Exception as exc:
            logger.warning("Failed to collect knowledge sources: %s", exc)

    # 2. Collect storage objects for each bot
    for b in bots:
        b_id = b["id"]
        b_name = b.get("name") or "Chatbot"

        # Visitor uploads
        v_files = await _collect_storage_files("chatty-uploads", b_id)
        for it in v_files:
            size = it["size_bytes"]
            cat_visitor_bytes += size
            cat_visitor_count += 1
            parts = it["path"].split("/")
            sess_id = parts[1] if len(parts) > 2 else None
            public_url = supabase.storage.from_("chatty-uploads").get_public_url(it["path"])
            all_files.append({
                "id": f"upload:{it['path']}",
                "name": it["name"],
                "path": it["path"],
                "bucket": "chatty-uploads",
                "category": "visitor_uploads",
                "category_label": "Visitor Upload",
                "size_bytes": size,
                "size_formatted": _format_size(size),
                "created_at": it["created_at"],
                "url": public_url,
                "session_id": sess_id,
                "mimetype": it["mimetype"],
                "bot_id": b_id,
                "bot_name": b_name,
            })

        # Catalog media
        c_files = await _collect_storage_files("chatty_assets", b_id)
        for it in c_files:
            size = it["size_bytes"]
            cat_catalog_bytes += size
            cat_catalog_count += 1
            public_url = supabase.storage.from_("chatty_assets").get_public_url(it["path"])
            all_files.append({
                "id": f"asset:{it['path']}",
                "name": it["name"],
                "path": it["path"],
                "bucket": "chatty_assets",
                "category": "catalog_media",
                "category_label": "Catalog Media",
                "size_bytes": size,
                "size_formatted": _format_size(size),
                "created_at": it["created_at"],
                "url": public_url,
                "session_id": None,
                "mimetype": it["mimetype"],
                "bot_id": b_id,
                "bot_name": b_name,
            })

        # Branding assets
        for brand_folder in ("logos", "avatars"):
            br_files = await _collect_storage_files("chatty-uploads", f"{brand_folder}/{b_id}")
            for it in br_files:
                size = it["size_bytes"]
                cat_branding_bytes += size
                cat_branding_count += 1
                public_url = supabase.storage.from_("chatty-uploads").get_public_url(it["path"])
                all_files.append({
                    "id": f"brand:{it['path']}",
                    "name": it["name"],
                    "path": it["path"],
                    "bucket": "chatty-uploads",
                    "category": "branding_assets",
                    "category_label": "Branding Asset",
                    "size_bytes": size,
                    "size_formatted": _format_size(size),
                    "created_at": it["created_at"],
                    "url": public_url,
                    "session_id": None,
                    "mimetype": it["mimetype"],
                    "bot_id": b_id,
                    "bot_name": b_name,
                })

    total_bytes = cat_visitor_bytes + cat_catalog_bytes + cat_branding_bytes + cat_knowledge_bytes
    total_mb = round(total_bytes / (1024 * 1024), 2)

    usage_percent = 0.0
    if storage_limit_mb:
        usage_percent = round((total_mb / storage_limit_mb) * 100, 1)

    # Sort newest files first
    all_files.sort(key=lambda x: str(x.get("created_at") or ""), reverse=True)

    return {
        "bot_id": selected_bot_id or ("all" if len(bots) > 1 else (bots[0]["id"] if bots else "all")),
        "account_wide": selected_bot_id is None or selected_bot_id == "all",
        "bots": [{"id": b["id"], "name": b.get("name") or "Chatbot"} for b in bots],
        "total_bytes": total_bytes,
        "total_mb": total_mb,
        "limit_mb": storage_limit_mb,
        "unlimited": storage_limit_mb is None,
        "usage_percent": min(100.0, usage_percent),
        "plan": plan,
        "categories": {
            "visitor_uploads": {
                "name": "Visitor Uploads",
                "bytes": cat_visitor_bytes,
                "mb": round(cat_visitor_bytes / (1024 * 1024), 2),
                "count": cat_visitor_count,
                "percent": round((cat_visitor_bytes / max(1, total_bytes)) * 100, 1),
            },
            "catalog_media": {
                "name": "Product Catalog Media",
                "bytes": cat_catalog_bytes,
                "mb": round(cat_catalog_bytes / (1024 * 1024), 2),
                "count": cat_catalog_count,
                "percent": round((cat_catalog_bytes / max(1, total_bytes)) * 100, 1),
            },
            "branding_assets": {
                "name": "Branding Assets",
                "bytes": cat_branding_bytes,
                "mb": round(cat_branding_bytes / (1024 * 1024), 2),
                "count": cat_branding_count,
                "percent": round((cat_branding_bytes / max(1, total_bytes)) * 100, 1),
            },
            "knowledge_sources": {
                "name": "Knowledge Documents",
                "bytes": cat_knowledge_bytes,
                "mb": round(cat_knowledge_bytes / (1024 * 1024), 2),
                "count": cat_knowledge_count,
                "percent": round((cat_knowledge_bytes / max(1, total_bytes)) * 100, 1),
            },
        },
        "files_count": len(all_files),
        "files": all_files,
    }


@router.get("/api/account/storage")
async def get_account_storage_details(
    user: dict[str, Any] = Depends(require_user),
) -> dict[str, Any]:
    """Return categorized storage usage, quota metrics, and all files across all chatbots for the account."""
    auth_id = user["auth_user_id"]
    owner_res = await run_db(
        lambda: supabase.table("users").select("plan, role").eq("auth_user_id", auth_id).limit(1).execute()
    )
    owner_user = owner_res.data[0] if owner_res.data else {}

    bots_res = await run_db(
        lambda: supabase.table("chatty_bots").select("id, name, logo_url, avatar_url").eq("user_id", auth_id).execute()
    )
    user_bots = bots_res.data or []

    return await _assemble_storage_data(
        bots=user_bots,
        owner_user=owner_user,
        caller_user=user,
        selected_bot_id=None,
    )


@router.get("/api/bots/{bot_id}/storage")
async def get_bot_storage_details(
    bot_id: str,
    account_wide: bool = Query(default=False),
    user: dict[str, Any] = Depends(require_user),
) -> dict[str, Any]:
    """Return categorized storage usage, quota metrics, and all files for a bot or account-wide."""
    role, permissions = await get_bot_role_and_permissions(bot_id, user)
    if role not in ("owner", "admin", "editor"):
        raise HTTPException(status_code=403, detail="Insufficient permissions to view storage details")

    # 1. Fetch bot and owner user plan
    bot_res = await run_db(lambda: supabase.table("chatty_bots").select("id, name, user_id, logo_url, avatar_url").eq("id", bot_id).limit(1).execute())
    if not bot_res.data:
        raise HTTPException(status_code=404, detail="Bot not found")
    bot = bot_res.data[0]
    bot_owner_id = bot["user_id"]

    owner_res = await run_db(lambda: supabase.table("users").select("plan, role").eq("auth_user_id", bot_owner_id).limit(1).execute())
    owner_user = owner_res.data[0] if owner_res.data else {}

    if account_wide:
        bots_res = await run_db(
            lambda: supabase.table("chatty_bots").select("id, name, logo_url, avatar_url").eq("user_id", bot_owner_id).execute()
        )
        target_bots = bots_res.data or [bot]
        return await _assemble_storage_data(
            bots=target_bots,
            owner_user=owner_user,
            caller_user=user,
            selected_bot_id="all",
        )

    all_owner_bots_res = await run_db(
        lambda: supabase.table("chatty_bots").select("id, name").eq("user_id", bot_owner_id).execute()
    )
    payload = await _assemble_storage_data(
        bots=[bot],
        owner_user=owner_user,
        caller_user=user,
        selected_bot_id=bot_id,
    )
    if all_owner_bots_res.data:
        payload["bots"] = [{"id": b["id"], "name": b.get("name") or "Chatbot"} for b in all_owner_bots_res.data]
    return payload


@router.delete("/api/account/storage/files")
async def delete_account_storage_files(
    req: DeleteFilesRequest,
    user: dict[str, Any] = Depends(require_user),
) -> dict[str, Any]:
    """Delete selected files across any chatbots owned by the user to free up account storage."""
    auth_id = user["auth_user_id"]
    is_admin = bool(user.get("role") == "admin" or user.get("is_admin"))

    bots_res = await run_db(lambda: supabase.table("chatty_bots").select("id").eq("user_id", auth_id).execute())
    owned_bot_ids = {b["id"] for b in (bots_res.data or [])}

    file_items = req.files or [{"bucket": req.bucket, "path": p} for p in req.paths]
    deletions_by_bucket: dict[str, list[str]] = {}
    sources_to_delete: list[str] = []

    for item in file_items:
        bucket = item.get("bucket", "chatty-uploads")
        path = (item.get("path") or "").strip()
        if not path:
            continue

        if bucket == "database" and path.startswith("sources/"):
            source_id = path.replace("sources/", "")
            sources_to_delete.append(source_id)
            continue

        path_bot_id = path.split("/")[0]
        if path.startswith("logos/") or path.startswith("avatars/"):
            parts = path.split("/")
            path_bot_id = parts[1] if len(parts) > 1 else ""

        if not is_admin and path_bot_id not in owned_bot_ids:
            raise HTTPException(
                status_code=403,
                detail=f"Security violation: path '{path}' does not belong to any bot owned by your account"
            )

        if bucket not in deletions_by_bucket:
            deletions_by_bucket[bucket] = []
        deletions_by_bucket[bucket].append(path)

    deleted_count = 0
    for bucket, paths in deletions_by_bucket.items():
        if not paths:
            continue
        try:
            res = await run_db(lambda b=bucket, p=paths: supabase.storage.from_(b).remove(p))
            if res:
                deleted_count += len(paths)
        except Exception as exc:
            logger.exception("Failed to delete files from bucket %s: %s", bucket, exc)

    if sources_to_delete:
        try:
            query = supabase.table("chatty_sources").delete().in_("id", sources_to_delete)
            if not is_admin:
                query = query.in_("bot_id", list(owned_bot_ids))
            await run_db(lambda: query.execute())
            deleted_count += len(sources_to_delete)
        except Exception:
            logger.exception("Failed to delete account sources")

    return {
        "success": True,
        "deleted_count": deleted_count,
        "message": f"Successfully deleted {deleted_count} file(s) and reclaimed account storage.",
    }


@router.post("/api/account/storage/cleanup")
async def cleanup_account_storage(
    req: AccountCleanupStorageRequest,
    user: dict[str, Any] = Depends(require_user),
) -> dict[str, Any]:
    """Automated retention purge for visitor uploads across account chatbots."""
    auth_id = user["auth_user_id"]
    bots_res = await run_db(lambda: supabase.table("chatty_bots").select("id").eq("user_id", auth_id).execute())
    owned_bots = [b["id"] for b in (bots_res.data or [])]
    if req.bot_id and req.bot_id != "all":
        if req.bot_id not in owned_bots:
            raise HTTPException(status_code=403, detail="Bot not owned by your account")
        target_bot_ids = [req.bot_id]
    else:
        target_bot_ids = owned_bots

    cutoff_date = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=req.older_than_days)
    cutoff_iso = cutoff_date.isoformat()

    files_to_remove: list[str] = []
    freed_bytes = 0

    for b_id in target_bot_ids:
        visitor_files = await _collect_storage_files("chatty-uploads", b_id)
        for f in visitor_files:
            created_str = str(f.get("created_at") or "")
            if created_str and created_str < cutoff_iso:
                files_to_remove.append(f["path"])
                freed_bytes += f.get("size_bytes", 0)

    if not files_to_remove:
        return {
            "success": True,
            "deleted_count": 0,
            "freed_bytes": 0,
            "freed_mb": 0.0,
            "message": f"No visitor files older than {req.older_than_days} days were found.",
        }

    try:
        await run_db(lambda: supabase.storage.from_("chatty-uploads").remove(files_to_remove))
        logger.info("Purged %d visitor files older than %d days across account (%s freed)", len(files_to_remove), req.older_than_days, _format_size(freed_bytes))
    except Exception as exc:
        logger.exception("Failed to purge visitor files across account: %s", exc)
        raise HTTPException(status_code=500, detail="Account storage cleanup failed") from exc

    return {
        "success": True,
        "deleted_count": len(files_to_remove),
        "freed_bytes": freed_bytes,
        "freed_mb": round(freed_bytes / (1024 * 1024), 2),
        "freed_formatted": _format_size(freed_bytes),
        "message": f"Successfully purged {len(files_to_remove)} file(s) and reclaimed {_format_size(freed_bytes)} of storage.",
    }


@router.delete("/api/bots/{bot_id}/storage/files")
async def delete_bot_storage_files(
    bot_id: str,
    req: DeleteFilesRequest,
    user: dict[str, Any] = Depends(require_user),
) -> dict[str, Any]:
    """Delete selected files from storage and clean up references to free up space."""
    role, permissions = await get_bot_role_and_permissions(bot_id, user)
    if role not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Only bot owners and admins can delete stored files")

    deletions_by_bucket: dict[str, list[str]] = {}
    sources_to_delete: list[str] = []

    file_items = req.files or [{"bucket": req.bucket, "path": p} for p in req.paths]

    for item in file_items:
        bucket = item.get("bucket", "chatty-uploads")
        path = (item.get("path") or "").strip()
        if not path:
            continue

        if bucket == "database" and path.startswith("sources/"):
            source_id = path.replace("sources/", "")
            sources_to_delete.append(source_id)
            continue

        is_bot_file = (
            path.startswith(f"{bot_id}/")
            or path.startswith(f"logos/{bot_id}")
            or path.startswith(f"avatars/{bot_id}")
        )
        if not is_bot_file:
            raise HTTPException(
                status_code=403,
                detail=f"Security violation: path '{path}' does not belong to bot {bot_id}"
            )

        if bucket not in deletions_by_bucket:
            deletions_by_bucket[bucket] = []
        deletions_by_bucket[bucket].append(path)

    deleted_count = 0

    for bucket, paths in deletions_by_bucket.items():
        if not paths:
            continue
        try:
            res = await run_db(lambda b=bucket, p=paths: supabase.storage.from_(b).remove(p))
            if res:
                deleted_count += len(paths)
                logger.info("Successfully deleted %d files from bucket %s for bot %s", len(paths), bucket, bot_id)
        except Exception as exc:
            logger.exception("Failed to delete files from bucket %s: %s", bucket, exc)

    if sources_to_delete:
        try:
            await run_db(
                lambda: supabase.table("chatty_sources")
                .delete()
                .eq("bot_id", bot_id)
                .in_("id", sources_to_delete)
                .execute()
            )
            deleted_count += len(sources_to_delete)
        except Exception:
            logger.exception("Failed to delete sources for bot %s", bot_id)

    if "chatty_assets" in deletions_by_bucket:
        for path in deletions_by_bucket["chatty_assets"]:
            try:
                public_url = supabase.storage.from_("chatty_assets").get_public_url(path)
                await run_db(
                    lambda: supabase.table("chatty_media_items")
                    .delete()
                    .eq("bot_id", bot_id)
                    .or_(f"media_url.eq.{public_url},thumbnail_url.eq.{public_url}")
                    .execute()
                )
            except Exception:
                pass

    return {
        "success": True,
        "deleted_count": deleted_count,
        "message": f"Successfully deleted {deleted_count} file(s) and reclaimed storage space.",
    }


@router.post("/api/bots/{bot_id}/storage/cleanup")
async def cleanup_old_storage(
    bot_id: str,
    req: CleanupStorageRequest,
    user: dict[str, Any] = Depends(require_user),
) -> dict[str, Any]:
    """Automated retention purge for old visitor chat uploads for a specific chatbot."""
    role, permissions = await get_bot_role_and_permissions(bot_id, user)
    if role not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Only bot owners and admins can perform storage cleanup")

    cutoff_date = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=req.older_than_days)
    cutoff_iso = cutoff_date.isoformat()

    visitor_files = await _collect_storage_files("chatty-uploads", bot_id)

    files_to_remove: list[str] = []
    freed_bytes = 0

    for f in visitor_files:
        created_str = str(f.get("created_at") or "")
        if created_str and created_str < cutoff_iso:
            files_to_remove.append(f["path"])
            freed_bytes += f.get("size_bytes", 0)

    if not files_to_remove:
        return {
            "success": True,
            "deleted_count": 0,
            "freed_bytes": 0,
            "freed_mb": 0.0,
            "message": f"No visitor files older than {req.older_than_days} days were found.",
        }

    try:
        await run_db(lambda: supabase.storage.from_("chatty-uploads").remove(files_to_remove))
        logger.info("Purged %d visitor files older than %d days for bot %s (%s freed)", len(files_to_remove), req.older_than_days, bot_id, _format_size(freed_bytes))
    except Exception as exc:
        logger.exception("Failed to purge visitor files for bot %s: %s", bot_id, exc)
        raise HTTPException(status_code=500, detail="Storage cleanup operation failed") from exc

    return {
        "success": True,
        "deleted_count": len(files_to_remove),
        "freed_bytes": freed_bytes,
        "freed_mb": round(freed_bytes / (1024 * 1024), 2),
        "freed_formatted": _format_size(freed_bytes),
        "message": f"Successfully purged {len(files_to_remove)} file(s) and reclaimed {_format_size(freed_bytes)} of storage.",
    }
