"""Pydantic models for website crawling / knowledge source scheduling
endpoints (/api/crawl/*, /api/sources/*)."""

from __future__ import annotations

from pydantic import BaseModel


class CrawlDiscoverRequest(BaseModel):
    url: str


class CrawlPagesRequest(BaseModel):
    bot_id: str
    urls: list[str]


class SourceScheduleUpdate(BaseModel):
    schedule: str  # "off" | "daily" | "weekly" | "monthly"
