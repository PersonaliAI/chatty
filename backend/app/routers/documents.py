"""Drive/OneDrive document-RAG endpoints (/api/documents*,
/cron/execute-scheduled-drive-syncs)."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, File, Header, HTTPException, UploadFile

from app.core.clients import genai_client, supabase
from app.core.config import FUNCTION_SECRET
from app.core.db import run_db
from app.core.deps import require_user
from app.core.security import verify_function_secret
from app.schemas.documents import DriveScheduleUpdate, IndexFilesBody, IndexFolderBody
from plugins import doc_rag
from plugins import google_integrations as g

# Bridged helper still living in main.py (shared with app/routers/crawl.py).
from main import _next_crawl_at

logger = logging.getLogger("chatty")

router = APIRouter()

MAX_UPLOAD_BYTES = 20 * 1024 * 1024  # 20 MB hard cap per file


def _drive_folder_id_from(s: str) -> str:
    """Accept either a raw folder ID or a Drive folder URL."""
    s = (s or "").strip()
    if "/folders/" in s:
        return s.split("/folders/", 1)[1].split("?")[0].split("/")[0]
    return s


@router.get("/api/documents")
async def documents_list(user: dict[str, Any] = Depends(require_user)):
    res = await run_db(lambda: (
        supabase.table("drive_documents")
        .select(
            "id, drive_file_id, file_name, mime_type, web_view_link, parent_folder_id, "
            "size_bytes, modified_at, indexed_at, chunk_count, status, error"
        )
        .eq("user_id", user["id"])
        .order("indexed_at", desc=True)
        .limit(500)
        .execute()
    ))
    return {"documents": res.data or []}


@router.post("/api/documents/index-folder")
async def documents_index_folder(
    body: IndexFolderBody,
    background_tasks: BackgroundTasks,
    user: dict[str, Any] = Depends(require_user),
):
    source = (getattr(body, "source", None) or "gdrive").lower()
    if source == "onedrive":
        if not user.get("microsoft_access_token"):
            raise HTTPException(status_code=400, detail="Microsoft not connected")
        folder_id = body.folder_id_or_url.strip()
    else:
        if not user.get("google_access_token"):
            raise HTTPException(status_code=400, detail="Google not connected")
        folder_id = _drive_folder_id_from(body.folder_id_or_url)
    if not folder_id:
        raise HTTPException(status_code=400, detail="folder_id required")

    max_files = max(min(body.max_files, 200), 1)

    # Remember the last-indexed folder so a recurring schedule (if turned on
    # later) knows what to re-index, without resetting an existing schedule.
    field_prefix = "onedrive" if source == "onedrive" else "drive"
    await run_db(lambda: supabase.table("users").update({
        f"{field_prefix}_folder_id": folder_id,
        f"{field_prefix}_max_files": max_files,
    }).eq("id", user["id"]).execute())

    background_tasks.add_task(
        _index_folder_task,
        user,
        folder_id,
        max_files,
        source,
    )
    return {"status": "started", "folder_id": folder_id, "source": source}


@router.get("/api/documents/sync-schedule")
async def get_drive_sync_schedule(user: dict[str, Any] = Depends(require_user)):
    res = await run_db(lambda: supabase.table("users").select(
        "drive_folder_id, drive_sync_schedule, drive_next_sync_at, "
        "onedrive_folder_id, onedrive_sync_schedule, onedrive_next_sync_at"
    ).eq("id", user["id"]).execute())
    row = (res.data or [{}])[0]
    return {
        "gdrive": {
            "folder_indexed": bool(row.get("drive_folder_id")),
            "schedule": row.get("drive_sync_schedule") or "off",
            "next_sync_at": row.get("drive_next_sync_at"),
        },
        "onedrive": {
            "folder_indexed": bool(row.get("onedrive_folder_id")),
            "schedule": row.get("onedrive_sync_schedule") or "off",
            "next_sync_at": row.get("onedrive_next_sync_at"),
        },
    }


@router.patch("/api/documents/sync-schedule")
async def update_drive_sync_schedule(req: DriveScheduleUpdate, user: dict[str, Any] = Depends(require_user)):
    """Turn recurring auto re-index on/off for the user's last-indexed Drive/OneDrive folder."""
    if req.schedule not in ("off", "daily", "weekly", "monthly"):
        raise HTTPException(status_code=400, detail="schedule must be off, daily, weekly, or monthly")
    field_prefix = "onedrive" if req.source == "onedrive" else "drive"
    folder_field = f"{field_prefix}_folder_id"
    existing = await run_db(lambda: supabase.table("users").select(folder_field).eq("id", user["id"]).execute())
    if req.schedule != "off" and not (existing.data and existing.data[0].get(folder_field)):
        raise HTTPException(status_code=400, detail="Index a folder at least once before scheduling auto re-sync")

    await run_db(lambda: supabase.table("users").update({
        f"{field_prefix}_sync_schedule": req.schedule,
        f"{field_prefix}_next_sync_at": _next_crawl_at(req.schedule),
    }).eq("id", user["id"]).execute())
    return {"success": True, "schedule": req.schedule, "next_sync_at": _next_crawl_at(req.schedule)}


@router.post("/cron/execute-scheduled-drive-syncs")
async def execute_scheduled_drive_syncs(x_function_secret: Optional[str] = Header(default=None)):
    """Re-index any user's Drive/OneDrive folder whose next_sync_at has passed."""
    verify_function_secret(x_function_secret, FUNCTION_SECRET)

    now = datetime.now(timezone.utc)
    results = []
    for prefix, source in (("drive", "gdrive"), ("onedrive", "onedrive")):
        res = await run_db(lambda prefix=prefix: supabase.table("users").select("*")
            .neq(f"{prefix}_sync_schedule", "off").lte(f"{prefix}_next_sync_at", now.isoformat()).execute())
        for u in (res.data or []):
            folder_id = u.get(f"{prefix}_folder_id")
            if not folder_id:
                continue
            try:
                await doc_rag.index_folder(
                    supabase, genai_client, user=u, folder_id=folder_id,
                    max_files=u.get(f"{prefix}_max_files") or 50, source=source,
                )
                next_sync_at = _next_crawl_at(u.get(f"{prefix}_sync_schedule"), now)
                await run_db(lambda prefix=prefix, u=u, next_sync_at=next_sync_at: supabase.table("users").update({
                    f"{prefix}_next_sync_at": next_sync_at,
                }).eq("id", u["id"]).execute())
                results.append({"user_id": u["id"], "source": source, "ok": True})
            except Exception:
                logger.exception("scheduled %s re-sync failed for user %s", source, u["id"])
                results.append({"user_id": u["id"], "source": source, "ok": False})

    return {"checked": len(results), "resynced": sum(1 for r in results if r["ok"]), "results": results}


@router.post("/api/documents/index-files")
async def documents_index_files(
    body: IndexFilesBody,
    background_tasks: BackgroundTasks,
    user: dict[str, Any] = Depends(require_user),
):
    if not user.get("google_access_token"):
        raise HTTPException(status_code=400, detail="Google not connected")
    if not body.file_ids:
        raise HTTPException(status_code=400, detail="file_ids required")
    for fid in body.file_ids[:50]:
        background_tasks.add_task(_index_file_task, user, fid)
    return {"status": "started", "count": min(len(body.file_ids), 50)}


@router.post("/api/documents/upload")
async def documents_upload(
    file: UploadFile = File(...),
    user: dict[str, Any] = Depends(require_user),
):
    """Index a file uploaded directly through web chat (PDF/DOCX/TXT/MD).

    Returns the indexed document row with chunk_count. Use this from the
    chat composer's paperclip button — no Drive/OneDrive connection needed.
    """
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="empty file")
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"file too large (max {MAX_UPLOAD_BYTES // (1024 * 1024)} MB)",
        )
    try:
        result = await doc_rag.index_blob(
            supabase,
            genai_client,
            user=user,
            filename=file.filename or "upload",
            data=data,
            mime_type=file.content_type or "application/octet-stream",
            source="upload",
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("upload indexing failed")
        raise HTTPException(status_code=500, detail=f"indexing failed: {exc}") from exc
    return {
        "status": result.get("status"),
        "file_name": result.get("file_name"),
        "chunk_count": result.get("chunk_count", 0),
        "document_id": result.get("id"),
        "error": result.get("error"),
    }


@router.delete("/api/documents/{document_id}")
async def documents_delete(
    document_id: str, user: dict[str, Any] = Depends(require_user)
):
    # Chunks cascade via FK ON DELETE CASCADE.
    await run_db(lambda: supabase.table("drive_documents").delete().eq("id", document_id).eq(
        "user_id", user["id"]
    ).execute())
    return {"status": "deleted"}


@router.delete("/api/documents")
async def documents_wipe(
    user: dict[str, Any] = Depends(require_user),
    status: Optional[str] = None,
):
    """Delete all (or just failed) indexed documents for this user."""
    q = supabase.table("drive_documents").delete().eq("user_id", user["id"])
    if status:
        if status not in ("indexed", "failed", "pending"):
            raise HTTPException(status_code=400, detail="invalid status")
        q = q.eq("status", status)
    await run_db(q.execute)
    return {"status": "deleted", "filter": status or "all"}


@router.get("/api/documents/browse")
async def documents_browse(
    user: dict[str, Any] = Depends(require_user),
    folder_id: Optional[str] = None,
    query: Optional[str] = None,
):
    """Browse the user's Drive (for the 'pick a folder/file' UI)."""
    if not user.get("google_access_token"):
        raise HTTPException(status_code=400, detail="Google not connected")
    res = await g.list_drive_files(
        supabase, user, folder_id=folder_id, query=query, page_size=100
    )
    return res


async def _index_folder_task(
    user: dict[str, Any], folder_id: str, max_files: int, source: str = "gdrive"
):
    try:
        await doc_rag.index_folder(
            supabase,
            genai_client,
            user=user,
            folder_id=folder_id,
            max_files=max_files,
            source=source,
        )
    except Exception:  # noqa: BLE001
        logger.exception("index_folder background task failed")


async def _index_file_task(user: dict[str, Any], file_id: str):
    try:
        await doc_rag.index_file(
            supabase, genai_client, user=user, file_id=file_id
        )
    except Exception:  # noqa: BLE001
        logger.exception("index_file background task failed")
