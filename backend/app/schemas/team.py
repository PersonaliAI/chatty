"""Pydantic models for team-member endpoints (/api/team*)."""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel


class TeamInviteRequest(BaseModel):
    bot_id: str
    email: str
    name: str
    phone: Optional[str] = None
    role: Optional[str] = "agent"
    permissions: Optional[list[str]] = None  # defaults to the role's default set when omitted


class TeamUpdateRequest(BaseModel):
    bot_id: str
    name: Optional[str] = None
    phone: Optional[str] = None
    role: Optional[str] = None
    permissions: Optional[list[str]] = None
    bookable: Optional[bool] = None
    # Admin preference: True (default) books this member's own connected
    # calendar for round-robin meetings; False books the bot owner's
    # calendar instead (for a member who hasn't/can't connect their own) -
    # they're still who the meeting is *assigned to* for fairness/notifications.
    book_on_own_calendar: Optional[bool] = None
    zoom_meeting_link: Optional[str] = None
    google_email: Optional[str] = None
    microsoft_email: Optional[str] = None


class OutOfOfficeRequest(BaseModel):
    bot_id: str
    ooo_start: Optional[str] = None  # ISO-8601; omitted = away from now
    ooo_end: Optional[str] = None    # ISO-8601; omitted = until cleared
    ooo_backup_email: Optional[str] = None
    ooo_reason: Optional[str] = None
    clear: bool = False


class AvailabilityRule(BaseModel):
    day_of_week: int  # 0=Mon .. 6=Sun, matches availability_engine._DAY_NUM
    start_minute: int
    end_minute: int


class AvailabilityRulesRequest(BaseModel):
    bot_id: str
    rules: list[AvailabilityRule]
