import asyncio
from unittest.mock import AsyncMock

import main  # noqa: F401
import pytest
from fastapi import HTTPException

from app.routers import documents
from app.workers import document_jobs


def test_document_folder_job_resolves_user_and_indexes(monkeypatch):
    user = {"id": "user-1", "google_access_token": "token"}
    monkeypatch.setattr(document_jobs, "run_db", lambda callback: asyncio.sleep(0, result=type("R", (), {"data": [user]})()))
    index = AsyncMock()
    monkeypatch.setattr(document_jobs.doc_rag, "index_folder", index)
    asyncio.run(document_jobs.process_document_job({
        "user_id": "user-1", "folder_id": "folder-1", "max_files": 25, "source": "gdrive"
    }))
    index.assert_awaited_once_with(
        document_jobs.supabase, document_jobs.genai_client,
        user=user, folder_id="folder-1", max_files=25, source="gdrive"
    )


def test_document_job_rejects_missing_owner(monkeypatch):
    monkeypatch.setattr(document_jobs, "run_db", lambda callback: asyncio.sleep(0, result=type("R", (), {"data": []})()))
    with pytest.raises(ValueError, match="owner"):
        asyncio.run(document_jobs.process_document_job({"user_id": "missing", "file_id": "file-1"}))


def test_document_enqueue_fails_closed_without_queue(monkeypatch):
    monkeypatch.setattr(documents, "_document_job_queue", None)
    monkeypatch.delenv("CHATTY_ALLOW_EPHEMERAL_JOBS", raising=False)
    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(documents._enqueue_document_job(
            name="documents.index_file", payload={"user_id": "user-1"}, idempotency_key="job-1"
        ))
    assert exc_info.value.status_code == 503
