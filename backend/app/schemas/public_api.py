"""Pydantic models for dashboard API-key management and the public v1 REST
API (/api/keys*, /api/v1/*)."""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel


class ApiKeyCreateRequest(BaseModel):
    bot_id: str
    name: Optional[str] = None
    scopes: Optional[list[str]] = None
    allowed_ips: Optional[list[str]] = None


class ApiKeyUpdateRequest(BaseModel):
    name: Optional[str] = None
    scopes: Optional[list[str]] = None
    allowed_ips: Optional[list[str]] = None


class PublicChatRequest(BaseModel):
    text: str
    session_id: Optional[str] = None
    visitor_timezone: Optional[str] = "UTC"


class PublicKnowledgeCreateRequest(BaseModel):
    type: str  # "text" | "url"
    name: str
    content: Optional[str] = None  # required for type=text
    url: Optional[str] = None      # required for type=url (will be crawled)


class WebhookCreateRequest(BaseModel):
    url: str
    events: list[str]
