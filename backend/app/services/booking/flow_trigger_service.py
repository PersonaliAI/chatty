"""Flow Trigger Service - Connects Booking Lifecycle to Visual Flow Builder and Webhooks."""

from __future__ import annotations

import logging
from typing import Any, Optional
from datetime import datetime, timezone

from plugins import notifications as notify

logger = logging.getLogger("chatty.booking.flows")


class BookingFlowTriggerService:
    def __init__(self, supabase_client):
        self.supabase = supabase_client

    async def emit_meeting_booked(
        self, bot_id: str, meeting: dict[str, Any], session_id: Optional[str] = None
    ) -> bool:
        """Trigger 'meeting.booked' workflow event in Visual Flow Canvas & Webhooks."""
        event_data = {
            "id": meeting.get("id"),
            "booking_id": meeting.get("id"),
            "meeting_id": meeting.get("id"),
            "title": meeting.get("title", "Appointment"),
            "attendee_name": meeting.get("attendee_name", "Guest"),
            "attendee_email": meeting.get("attendee_email", ""),
            "start_time": meeting.get("start_time"),
            "end_time": meeting.get("end_time"),
            "meeting_link": meeting.get("meeting_link"),
            "event_type_id": meeting.get("event_type_id"),
            "status": meeting.get("status", "confirmed"),
            "amount_paid_cents": meeting.get("amount_paid_cents", 0),
        }

        try:
            await notify.enqueue_webhook_event(
                self.supabase,
                bot_id=bot_id,
                event="meeting.booked",
                session_id=session_id or "",
                data=event_data,
            )
            logger.info("Successfully enqueued 'meeting.booked' event for meeting %s", meeting["id"])
            return True
        except Exception as e:
            logger.exception("Failed to enqueue 'meeting.booked' event: %s", e)
            return False

    async def emit_meeting_rescheduled(
        self, bot_id: str, meeting: dict[str, Any], session_id: Optional[str] = None
    ) -> bool:
        """Trigger 'meeting.rescheduled' workflow event."""
        event_data = {
            "id": meeting["id"],
            "booking_id": meeting["id"],
            "meeting_id": meeting["id"],
            "title": meeting["title"],
            "attendee_name": meeting["attendee_name"],
            "attendee_email": meeting["attendee_email"],
            "new_start_time": meeting["start_time"],
            "new_end_time": meeting["end_time"],
            "meeting_link": meeting.get("meeting_link"),
            "rescheduled_from_id": meeting.get("rescheduled_from_id"),
        }

        try:
            await notify.enqueue_webhook_event(
                self.supabase,
                bot_id=bot_id,
                event="meeting.rescheduled",
                session_id=session_id or "",
                data=event_data,
            )
            return True
        except Exception as e:
            logger.exception("Failed to enqueue 'meeting.rescheduled' event: %s", e)
            return False

    async def emit_meeting_cancelled(
        self, bot_id: str, meeting: dict[str, Any], session_id: Optional[str] = None
    ) -> bool:
        """Trigger 'meeting.cancelled' workflow event."""
        event_data = {
            "id": meeting["id"],
            "meeting_id": meeting["id"],
            "title": meeting["title"],
            "attendee_name": meeting["attendee_name"],
            "attendee_email": meeting["attendee_email"],
            "start_time": meeting["start_time"],
            "cancellation_reason": meeting.get("cancellation_reason"),
        }

        try:
            await notify.enqueue_webhook_event(
                self.supabase,
                bot_id=bot_id,
                event="meeting.cancelled",
                session_id=session_id or "",
                data=event_data,
            )
            return True
        except Exception as e:
            logger.exception("Failed to enqueue 'meeting.cancelled' event: %s", e)
            return False
