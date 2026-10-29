"""Booking Domain Models, Enums, and Request/Response DTOs."""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, List, Optional
from pydantic import BaseModel, Field, EmailStr, ConfigDict


class MeetingStatus(str, Enum):
    CONFIRMED = "confirmed"
    PENDING_PAYMENT = "pending_payment"
    RESCHEDULED = "rescheduled"
    CANCELLED = "cancelled"
    NO_SHOW = "no_show"


class PaymentStatus(str, Enum):
    NONE = "none"
    PENDING = "pending"
    PAID = "paid"
    REFUNDED = "refunded"


class BookingChannel(str, Enum):
    WEB = "web"
    WHATSAPP = "whatsapp"
    SMS = "sms"
    VOICE = "voice"
    API = "api"


class EventTypeBase(BaseModel):
    title: str = Field(..., min_length=2, max_length=255, description="Human-readable meeting title")
    slug: str = Field(..., min_length=2, max_length=100, description="URL-friendly identifier")
    description: Optional[str] = Field(None, max_length=2000)
    duration_minutes: int = Field(30, ge=5, le=480, description="Meeting duration in minutes")
    buffer_before_minutes: int = Field(0, ge=0, le=120, description="Buffer before meeting (prep time)")
    buffer_after_minutes: int = Field(10, ge=0, le=120, description="Buffer after meeting (wrap-up time)")
    min_notice_hours: int = Field(2, ge=0, le=720, description="Minimum notice before booking can occur")
    max_bookings_per_day: Optional[int] = Field(None, ge=1, le=100, description="Fatigue protection cap")
    price_cents: int = Field(0, ge=0, description="Price in smallest currency unit (0 = free)")
    currency: str = Field("usd", min_length=3, max_length=10)
    intent_triggers: List[str] = Field(default_factory=list, description="Keywords that AI matches to this event type")
    is_active: bool = Field(True, description="Whether this event type is bookable")


class EventTypeCreate(EventTypeBase):
    pass


class EventTypeUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=2, max_length=255)
    slug: Optional[str] = Field(None, min_length=2, max_length=100)
    description: Optional[str] = Field(None, max_length=2000)
    duration_minutes: Optional[int] = Field(None, ge=5, le=480)
    buffer_before_minutes: Optional[int] = Field(None, ge=0, le=120)
    buffer_after_minutes: Optional[int] = Field(None, ge=0, le=120)
    min_notice_hours: Optional[int] = Field(None, ge=0, le=720)
    max_bookings_per_day: Optional[int] = Field(None, ge=1, le=100)
    price_cents: Optional[int] = Field(None, ge=0)
    currency: Optional[str] = Field(None, min_length=3, max_length=10)
    intent_triggers: Optional[List[str]] = None
    is_active: Optional[bool] = None


class EventTypeResponse(EventTypeBase):
    id: str
    bot_id: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AvailableSlot(BaseModel):
    start: str
    end: str
    time_label: str
    visitor_local_label: str
    owner_local_label: Optional[str] = None
    host_timezone: Optional[str] = None
    event_type_id: Optional[str] = None


class BookingConfirmRequest(BaseModel):
    bot_id: str
    event_type_id: Optional[str] = None
    start: str = Field(..., description="ISO 8601 UTC slot start timestamp")
    end: Optional[str] = Field(None, description="ISO 8601 UTC slot end timestamp")
    visitor_name: str = Field(..., min_length=1, max_length=255)
    visitor_email: EmailStr = Field(...)
    visitor_phone: Optional[str] = Field(None, max_length=50)
    visitor_company: Optional[str] = Field(None, max_length=255)
    visitor_timezone: Optional[str] = Field("UTC", max_length=100)
    session_id: Optional[str] = None
    notes: Optional[str] = Field(None, max_length=2000)
    channel: BookingChannel = BookingChannel.WEB


class BookingRescheduleRequest(BaseModel):
    meeting_id: str
    new_start: str = Field(..., description="ISO 8601 UTC new slot start timestamp")
    new_end: Optional[str] = None
    reason: Optional[str] = Field(None, max_length=1000)
    requested_by: Optional[str] = "visitor"


class BookingCancelRequest(BaseModel):
    meeting_id: str
    cancellation_reason: Optional[str] = Field(None, max_length=1000)
    requested_by: Optional[str] = "visitor"


class GDPRScrubRequest(BaseModel):
    email: EmailStr
    bot_id: str
    reason: Optional[str] = "Right to be forgotten request"
