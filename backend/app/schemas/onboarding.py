"""Pydantic models for the bot onboarding wizard endpoint (/api/onboarding/*)."""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel


class OnboardingUpdateRequest(BaseModel):
    bot_id: str
    step: int
    completed: bool
    custom_instructions: Optional[str] = None
    lead_fields: Optional[list[str]] = None
    lead_capture_enabled: Optional[bool] = None
    lead_required_fields: Optional[list[str]] = None
    bot_country: Optional[str] = None
    bot_timezone: Optional[str] = None
    sync_google_drive: Optional[bool] = None
    sync_google_calendar: Optional[bool] = None
    sync_outlook_calendar: Optional[bool] = None
    sync_office365_calendar: Optional[bool] = None
    meeting_provider: Optional[str] = None
    calendar_scheduling_enabled: Optional[bool] = None
