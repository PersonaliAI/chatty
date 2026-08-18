"""Pydantic models for team-member endpoints (/api/team*)."""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel


class TeamInviteRequest(BaseModel):
    bot_id: str
    email: str
    role: Optional[str] = "agent"
