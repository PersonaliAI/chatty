"""Pydantic models for the Visual Flow Architect AI Copilot (/api/flow/*)."""

from __future__ import annotations

from pydantic import BaseModel, Field


class FlowGenerateRequest(BaseModel):
    bot_id: str = Field(..., min_length=1, max_length=80)
    description: str = Field(..., min_length=3, max_length=4_000)
