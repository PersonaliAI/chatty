from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


class BotCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    welcome_message: Optional[str] = None
    system_instructions: Optional[str] = None
    selected_model: Optional[str] = None
    primary_color: Optional[str] = None
    response_language: Optional[str] = None


class BotUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    welcome_message: Optional[str] = None
    system_instructions: Optional[str] = None
    selected_model: Optional[str] = None
    primary_color: Optional[str] = None
    widget_style: Optional[str] = None
    response_language: Optional[str] = None
    strict_mode: Optional[bool] = None
    lead_capture_enabled: Optional[bool] = None


class KnowledgeTextCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    content: str = Field(..., min_length=1, max_length=100_000)
