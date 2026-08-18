"""Pydantic models for the Drive/OneDrive document-RAG endpoints
(/api/documents*)."""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel


class IndexFolderBody(BaseModel):
    folder_id_or_url: str
    max_files: int = 50
    source: Optional[str] = "gdrive"  # "gdrive" | "onedrive"


class IndexFilesBody(BaseModel):
    file_ids: list[str]


class DriveScheduleUpdate(BaseModel):
    source: str  # "gdrive" | "onedrive"
    schedule: str  # "off" | "daily" | "weekly" | "monthly"
