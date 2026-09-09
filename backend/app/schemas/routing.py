"""Pydantic models for Omnichannel Routing, Agent Presence, and Capacity Rules (/api/admin/routing/*)."""

from __future__ import annotations

from typing import Optional
from pydantic import BaseModel


class AgentPresenceUpdateRequest(BaseModel):
    bot_id: str
    status: str  # "online" | "away" | "busy" | "offline"
    max_capacity: Optional[int] = None


class RoutingSettingsUpdateRequest(BaseModel):
    bot_id: str
    routing_enabled: Optional[bool] = None
    algorithm: Optional[str] = None  # "spare_capacity" | "round_robin"
    default_capacity: Optional[int] = None
    offline_fallback: Optional[str] = None  # "unassigned_queue" | "bot_owner" | "ai_pause"
