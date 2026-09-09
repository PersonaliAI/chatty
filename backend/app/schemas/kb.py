"""Pydantic models for Enterprise Knowledge Base & Help Center endpoints (/api/admin/kb/* and /api/widget/kb/*)."""

from __future__ import annotations

from typing import Optional, List
from pydantic import BaseModel


class CategoryCreateRequest(BaseModel):
    bot_id: str
    name: str
    slug: Optional[str] = None
    description: Optional[str] = ""
    icon: Optional[str] = "Folder"
    order_index: Optional[int] = 0


class CategoryUpdateRequest(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None
    order_index: Optional[int] = None


class ArticleCreateRequest(BaseModel):
    bot_id: str
    title: str
    content: str
    slug: Optional[str] = None
    category_id: Optional[str] = None
    subtitle: Optional[str] = ""
    status: Optional[str] = "published"  # "draft" | "published" | "archived"
    visibility: Optional[str] = "public"  # "public" | "internal_only"
    tags: Optional[List[str]] = []
    is_promoted: Optional[bool] = False
    order_index: Optional[int] = 0


class ArticleUpdateRequest(BaseModel):
    title: Optional[str] = None
    slug: Optional[str] = None
    category_id: Optional[str] = None
    subtitle: Optional[str] = None
    content: Optional[str] = None
    status: Optional[str] = None
    visibility: Optional[str] = None
    tags: Optional[List[str]] = None
    is_promoted: Optional[bool] = None
    order_index: Optional[int] = None


class ArticleFeedbackRequest(BaseModel):
    bot_id: str
    is_helpful: bool
    comment: Optional[str] = ""


class KBSearchLogRequest(BaseModel):
    bot_id: str
    query: str
    results_count: int = 0
