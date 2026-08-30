"""Pydantic models for team-member endpoints (/api/team*)."""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel


class TeamInviteRequest(BaseModel):
    bot_id: str
    email: str
    role: Optional[str] = "agent"
    permissions: Optional[list[str]] = None  # defaults to the role's default set when omitted


class TeamUpdateRequest(BaseModel):
    bot_id: str
    role: Optional[str] = None
    permissions: Optional[list[str]] = None
