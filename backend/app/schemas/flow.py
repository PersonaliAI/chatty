"""Pydantic models for the Visual Flow Architect AI Copilot (/api/flow/*)."""

from __future__ import annotations

from pydantic import BaseModel


class FlowGenerateRequest(BaseModel):
    bot_id: str
    description: str
