"""LiveKit Voice Agent Booking Tool - Allows callers to check slots and book appointments in real time."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Optional
import pytz

from app.services.booking.availability_service import AvailabilityService
from app.services.booking.reservation_service import ReservationService
from app.services.booking.models import BookingConfirmRequest, BookingChannel

logger = logging.getLogger("chatty.booking.voice")


class VoiceBookingTool:
    """Tool exposed to Voice Agents (LiveKit WebRTC) for autonomous voice scheduling."""

    def __init__(self, supabase_client, run_db_func):
        self.supabase = supabase_client
        self.run_db = run_db_func
        self.avail_service = AvailabilityService(supabase_client, run_db_func)
        self.res_service = ReservationService(supabase_client, run_db_func)

    async def get_voice_slots(
        self,
        bot_id: str,
        caller_timezone: str = "America/New_York",
        days_ahead: int = 7,
    ) -> dict[str, Any]:
        """Fetch human-friendly available time slots for the voice agent to read aloud to the caller."""
        # 1. Fetch bot
        res = await self.run_db(lambda: self.supabase.table("chatty_bots").select("*").eq("id", bot_id).execute())
        if not res.data:
            return {"success": False, "message": "Assistant not found"}
        bot = res.data[0]

        now_utc = datetime.now(timezone.utc)
        busy = await self.avail_service.get_busy_intervals(bot_id, now_utc, now_utc.replace(year=now_utc.year + 1))
        counts = await self.avail_service.get_daily_meeting_counts(bot_id, now_utc, now_utc.replace(year=now_utc.year + 1))

        computed = self.avail_service.compute_slots(
            bot=bot,
            event_type=None,
            owner_tz_str=bot.get("bot_timezone") or "America/New_York",
            visitor_tz_str=caller_timezone,
            now_utc=now_utc,
            days_ahead=days_ahead,
            busy_intervals=busy,
            daily_counts=counts,
        )

        # Produce a natural speech summary for the voice agent LLM:
        spoken_options = []
        for date_str in computed.get("available_dates", [])[:3]:
            slots = computed.get("slots_by_date", {}).get(date_str, [])
            if slots:
                labels = [s["time_label"] for s in slots[:3]]
                spoken_options.append(f"{date_str}: at {', '.join(labels)}")

        return {
            "success": True,
            "spoken_summary": "; ".join(spoken_options) if spoken_options else "No available slots this week.",
            "available_dates": computed.get("available_dates", []),
            "slots_by_date": computed.get("slots_by_date", {}),
            "caller_timezone": caller_timezone,
        }

    async def book_from_voice_call(
        self,
        bot_id: str,
        slot_start_iso: str,
        caller_name: str,
        caller_contact: str,
        notes: Optional[str] = "Booked via Voice Agent",
    ) -> dict[str, Any]:
        """Confirm appointment directly from voice call transcript."""
        res = await self.run_db(lambda: self.supabase.table("chatty_bots").select("*").eq("id", bot_id).execute())
        if not res.data:
            return {"success": False, "message": "Assistant not found"}
        bot = res.data[0]

        # Resolve email
        email = caller_contact if "@" in caller_contact else f"caller_{caller_contact.replace('+', '')}@voice.chatty.internal"

        confirm_req = BookingConfirmRequest(
            bot_id=bot_id,
            start=slot_start_iso,
            visitor_name=caller_name,
            visitor_email=email,
            visitor_phone=caller_contact if "@" not in caller_contact else None,
            notes=notes,
            channel=BookingChannel.VOICE,
        )

        try:
            meeting = await self.res_service.confirm_booking(confirm_req, bot)
            return {
                "success": True,
                "meeting_id": meeting["id"],
                "meeting_link": meeting.get("meeting_link"),
                "start_time": meeting["start_time"],
                "summary": meeting["title"],
                "spoken_confirmation": f"Your appointment is confirmed for {meeting['start_time']}."
            }
        except Exception as e:
            logger.exception("Voice booking failed: %s", e)
            return {"success": False, "error": str(e)}
