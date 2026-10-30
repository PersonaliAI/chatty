"""Event Types & Advanced Booking Router (/api/bots/{bot_id}/event-types/* and /api/booking/*)."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import JSONResponse

from app.core.clients import supabase
from app.core.db import run_db
from app.core.deps import require_user
from app.core.permissions import verify_bot_permission
from app.services.booking import (
    EventTypesService,
    AvailabilityService,
    ReservationService,
    BookingGDPRService,
    BookingPaymentService,
    BookingFlowTriggerService,
    EventTypeCreate,
    EventTypeUpdate,
    BookingConfirmRequest,
    BookingRescheduleRequest,
    BookingCancelRequest,
    GDPRScrubRequest,
)

logger = logging.getLogger("chatty.routers.event_types")

router = APIRouter(tags=["Booking & Event Types"])

# Service instances initialized with standard clients
event_service = EventTypesService(supabase, run_db)
availability_service = AvailabilityService(supabase, run_db)
reservation_service = ReservationService(supabase, run_db)
gdpr_service = BookingGDPRService(supabase, run_db)
payment_service = BookingPaymentService(supabase, run_db)
flow_service = BookingFlowTriggerService(supabase)


async def _get_bot_or_404(bot_id: str) -> dict[str, Any]:
    res = await run_db(lambda: supabase.table("chatty_bots").select("*").eq("id", bot_id).execute())
    if not res.data:
        raise HTTPException(status_code=404, detail="Assistant bot not found")
    return res.data[0]


# --- 1. EVENT TYPES CRUD ---

@router.get("/api/bots/{bot_id}/event-types")
async def list_bot_event_types(
    bot_id: str,
    active_only: bool = Query(True, description="Only return active event types"),
    user: Optional[dict[str, Any]] = Depends(require_user),
):
    """List event types for an assistant bot. If unauthenticated, returns active only."""
    await _get_bot_or_404(bot_id)
    # If authenticated owner/editor, allow viewing inactive too
    is_admin = False
    if user:
        try:
            await verify_bot_permission(user, bot_id, required_tab="meetings")
            is_admin = True
        except Exception:
            is_admin = False

    filter_active = active_only if not is_admin else active_only
    items = await event_service.list_event_types(bot_id, active_only=filter_active)
    return {"bot_id": bot_id, "event_types": items}


@router.post("/api/bots/{bot_id}/event-types")
async def create_event_type_endpoint(
    bot_id: str,
    body: EventTypeCreate,
    user: dict[str, Any] = Depends(require_user),
):
    """Create a new event type (e.g. 15m Quick Chat, 45m Product Demo). Requires editor access."""
    await verify_bot_permission(user, bot_id, required_tab="meetings")
    created = await event_service.create_event_type(bot_id, body)
    return {"status": "success", "event_type": created}


@router.get("/api/bots/{bot_id}/event-types/{event_type_id}")
async def get_event_type_endpoint(bot_id: str, event_type_id: str):
    """Fetch event type details by ID or slug."""
    await _get_bot_or_404(bot_id)
    # Try by ID first, then by slug
    item = await event_service.get_event_type(event_type_id, bot_id=bot_id)
    if not item:
        item = await event_service.get_by_slug(bot_id, event_type_id)
    if not item:
        raise HTTPException(status_code=404, detail="Event type not found")
    return {"event_type": item}


@router.patch("/api/bots/{bot_id}/event-types/{event_type_id}")
async def update_event_type_endpoint(
    bot_id: str,
    event_type_id: str,
    body: EventTypeUpdate,
    user: dict[str, Any] = Depends(require_user),
):
    """Update event type duration, buffers, notice rules, or pricing."""
    await verify_bot_permission(user, bot_id, required_tab="meetings")
    updated = await event_service.update_event_type(event_type_id, bot_id, body)
    return {"status": "success", "event_type": updated}


@router.delete("/api/bots/{bot_id}/event-types/{event_type_id}")
async def delete_event_type_endpoint(
    bot_id: str,
    event_type_id: str,
    user: dict[str, Any] = Depends(require_user),
):
    """Soft-delete an event type (deactivates without breaking past meetings)."""
    await verify_bot_permission(user, bot_id, required_tab="meetings")
    await event_service.delete_event_type(event_type_id, bot_id)
    return {"status": "success", "message": "Event type deactivated successfully"}


# --- 2. ADVANCED SLOTS CALCULATION ---

@router.get("/api/bots/{bot_id}/booking/event-slots")
async def get_event_type_slots(
    bot_id: str,
    event_type_id: Optional[str] = Query(None, description="Event type ID or slug"),
    visitor_timezone: Optional[str] = Query("America/New_York"),
    days: int = Query(14, ge=1, le=60),
):
    """Compute available booking slots with buffers, notice periods, and fatigue protection."""
    bot = await _get_bot_or_404(bot_id)
    if not bot.get("calendar_scheduling_enabled", True):
        return {"enabled": False, "message": "Calendar scheduling is disabled for this assistant"}

    # Resolve event type if passed
    event_type = None
    if event_type_id:
        event_type = await event_service.get_event_type(event_type_id, bot_id=bot_id)
        if not event_type:
            event_type = await event_service.get_by_slug(bot_id, event_type_id)

    owner_tz_str = bot.get("bot_timezone") or "America/New_York"
    now_utc = datetime.now(timezone.utc)
    future_utc = now_utc + (days * datetime.resolution * 86400000000)  # timedelta days

    # Fetch busy intervals & daily counts for fatigue control
    busy_intervals = await availability_service.get_busy_intervals(bot_id, now_utc, now_utc.replace(year=now_utc.year + 1))
    daily_counts = await availability_service.get_daily_meeting_counts(bot_id, now_utc, now_utc.replace(year=now_utc.year + 1))

    slot_result = availability_service.compute_slots(
        bot=bot,
        event_type=event_type,
        owner_tz_str=owner_tz_str,
        visitor_tz_str=visitor_timezone or "America/New_York",
        now_utc=now_utc,
        days_ahead=days,
        busy_intervals=busy_intervals,
        daily_counts=daily_counts,
    )

    slot_result["bot_id"] = bot_id
    slot_result["event_type"] = event_type
    return slot_result


# --- 3. RESERVATION CONFIRMATION, RESCHEDULE & CANCEL ---

@router.post("/api/bots/{bot_id}/booking/confirm")
async def confirm_booking_endpoint(bot_id: str, body: BookingConfirmRequest):
    """Confirm a booking reservation with race-condition conflict checking."""
    bot = await _get_bot_or_404(bot_id)
    event_type = None
    if body.event_type_id:
        event_type = await event_service.get_event_type(body.event_type_id, bot_id=bot_id)
        if not event_type:
            event_type = await event_service.get_by_slug(bot_id, body.event_type_id)

    meeting = await reservation_service.confirm_booking(body, bot, event_type=event_type)
    try:
        await flow_service.emit_meeting_booked(bot_id, meeting, session_id=body.session_id)
    except Exception:
        pass
    return {"status": "success", "meeting": meeting}


@router.post("/api/bots/{bot_id}/booking/reschedule")
async def reschedule_booking_endpoint(bot_id: str, body: BookingRescheduleRequest):
    """Reschedule an existing appointment."""
    await _get_bot_or_404(bot_id)
    rescheduled = await reservation_service.reschedule_booking(body, bot_id=bot_id)
    try:
        await flow_service.emit_meeting_rescheduled(bot_id, rescheduled)
    except Exception:
        pass
    return {"status": "success", "meeting": rescheduled}


@router.post("/api/bots/{bot_id}/booking/cancel")
async def cancel_booking_endpoint(bot_id: str, body: BookingCancelRequest):
    """Cancel an appointment with cancellation reason."""
    await _get_bot_or_404(bot_id)
    cancelled = await reservation_service.cancel_booking(body, bot_id=bot_id)
    try:
        await flow_service.emit_meeting_cancelled(bot_id, cancelled)
    except Exception:
        pass
    return {"status": "success", "meeting": cancelled}


# --- 4. GDPR COMPLIANCE ENDPOINTS ---

@router.get("/api/bots/{bot_id}/booking/gdpr-export")
async def gdpr_export_endpoint(
    bot_id: str,
    email: str = Query(..., description="Attendee email address"),
    user: dict[str, Any] = Depends(require_user),
):
    """GDPR Article 15/20: Export all bookings and metadata for an attendee."""
    await verify_bot_permission(user, bot_id, required_tab="meetings")
    export_data = await gdpr_service.export_visitor_data(email=email, bot_id=bot_id)
    return export_data


@router.post("/api/bots/{bot_id}/booking/gdpr-scrub")
async def gdpr_scrub_endpoint(
    bot_id: str,
    body: GDPRScrubRequest,
    user: dict[str, Any] = Depends(require_user),
):
    """GDPR Article 17: Right to Erasure. Scrub attendee PII while preserving metrics."""
    await verify_bot_permission(user, bot_id, required_tab="meetings")
    result = await gdpr_service.scrub_visitor_pii(email=body.email, bot_id=bot_id, reason=body.reason or "GDPR Request")
    return result

# --- 5. PAID BOOKINGS CHECKOUT ---

@router.post("/api/bots/{bot_id}/booking/checkout")
async def create_booking_checkout_endpoint(
    bot_id: str,
    meeting_id: str = Query(...),
    event_type_id: str = Query(...),
    success_url: Optional[str] = Query(None),
    cancel_url: Optional[str] = Query(None),
):
    """Create a Stripe checkout session for a paid booking slot."""
    bot = await _get_bot_or_404(bot_id)
    et = await event_service.get_event_type(event_type_id, bot_id=bot_id)
    if not et:
        et = await event_service.get_by_slug(bot_id, event_type_id)
    if not et:
        raise HTTPException(status_code=404, detail="Event type not found")

    meet_res = await run_db(lambda: supabase.table("chatty_meetings").select("*").eq("id", meeting_id).execute())
    if not meet_res.data:
        raise HTTPException(status_code=404, detail="Meeting not found")
    meeting = meet_res.data[0]

    session = await payment_service.create_checkout_session(
        bot_id=bot_id,
        meeting_id=meeting_id,
        event_type=et,
        attendee_email=meeting["attendee_email"],
        success_url=success_url or "https://app.chatty.com/booking/confirmed",
        cancel_url=cancel_url or "https://app.chatty.com/booking/cancelled",
    )
    return session
