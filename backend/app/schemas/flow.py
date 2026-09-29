"""Pydantic models for the Visual Flow Architect AI Copilot (/api/flow/*)."""

from __future__ import annotations

from pydantic import BaseModel, Field


class FlowGenerateRequest(BaseModel):
    bot_id: str = Field(..., min_length=1, max_length=80)
    description: str = Field(..., min_length=3, max_length=4_000)


class FlowOptimizeRequest(BaseModel):
    bot_id: str = Field(..., min_length=1, max_length=80)
    nodes: list[dict] = Field(..., min_length=1, max_length=200)
    edges: list[dict] = Field(default_factory=list, max_length=500)
    goal: str = Field("Improve clarity, qualification, and conversion while preserving intent.", max_length=500)
