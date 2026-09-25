"""Durable Drive/OneDrive document-indexing job handlers."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from app.core.clients import genai_client, supabase
from app.core.db import run_db
from plugins import doc_rag


async def process_document_job(payload: dict[str, Any]) -> None:
    user_id = str(payload.get("user_id") or "").strip()
    if not user_id:
        raise ValueError("document job is missing user_id")
    user_res = await run_db(lambda: supabase.table("users").select("*").eq("id", user_id).limit(1).execute())
    if not user_res.data:
        raise ValueError("document owner no longer exists")
    user = user_res.data[0]
    source = str(payload.get("source") or "gdrive").lower()
    if source not in {"gdrive", "onedrive"}:
        raise ValueError("unsupported document source")
    if payload.get("folder_id"):
        await doc_rag.index_folder(
            supabase, genai_client, user=user,
            folder_id=str(payload["folder_id"]),
            max_files=max(1, min(int(payload.get("max_files") or 50), 200)),
            source=source,
        )
        schedule_field = str(payload.get("schedule_field") or "").strip()
        schedule = str(payload.get("schedule") or "").strip().lower()
        interval = {"daily": timedelta(days=1), "weekly": timedelta(days=7), "monthly": timedelta(days=30)}.get(schedule)
        if schedule_field and interval:
            await run_db(lambda: supabase.table("users").update({
                schedule_field: (datetime.now(timezone.utc) + interval).isoformat(),
            }).eq("id", user_id).execute())
        return
    file_id = str(payload.get("file_id") or "").strip()
    if not file_id:
        raise ValueError("document job is missing folder_id or file_id")
    await doc_rag.index_file(supabase, genai_client, user=user, file_id=file_id, source=source)
