"""Reservation Service - Handles atomic confirmation, conflict checks, rescheduling, and cancellation."""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Optional
from fastapi import HTTPException

from app.services.booking.models import (
    BookingConfirmRequest,
    BookingRescheduleRequest,
    BookingCancelRequest,
    MeetingStatus,
    PaymentStatus,
)

logger = logging.getLogger("chatty.booking.reservation")

DISPOSABLE_EMAIL_DOMAINS = {
    "mailinator.com", "guerrillamail.com", "tempmail.com", "10minutemail.com",
    "sharklasers.com", "yopmail.com", "trashmail.com", "dispostable.com"
}

FREE_EMAIL_PROVIDERS = {
    "gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "icloud.com", "aol.com", "proton.me", "protonmail.com"
}


class ReservationService:
    def __init__(self, supabase_client, run_db_func):
        self.supabase = supabase_client
        self.run_db = run_db_func

    def validate_email_rules(
        self,
        email: str,
        block_disposable: bool = True,
        require_business: bool = False,
    ) -> None:
        """Enforce email hygiene and lead qualification standards."""
        domain = email.lower().split("@")[-1].strip()
        if block_disposable and domain in DISPOSABLE_EMAIL_DOMAINS:
            raise HTTPException(
                status_code=400,
                detail="Disposable email addresses are not accepted for appointment booking."
            )
        if require_business and domain in FREE_EMAIL_PROVIDERS:
            raise HTTPException(
                status_code=400,
                detail="A work/business email address is required for this booking."
            )

    async def confirm_booking(
        self,
        req: BookingConfirmRequest,
        bot: dict[str, Any],
        event_type: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        """Confirm a new booking with strict conflict detection."""
        self.validate_email_rules(
            str(req.visitor_email),
            block_disposable=bot.get("booking_block_disposable_emails", True),
            require_business=bot.get("booking_require_business_email", False),
        )

        try:
            start_dt = datetime.fromisoformat(req.start.replace("Z", "+00:00"))
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid start timestamp format (must be ISO 8601)")

        duration = (event_type or {}).get("duration_minutes") or bot.get("scheduling_duration_minutes") or 30
        end_dt = start_dt + timedelta(minutes=duration)
        if req.end:
            try:
                end_dt = datetime.fromisoformat(req.end.replace("Z", "+00:00"))
            except Exception:
                pass

        def _check_conflict():
            return (
                self.supabase.table("chatty_meetings")
                .select("id")
                .eq("bot_id", req.bot_id)
                .neq("status", "cancelled")
                .lt("start_time", end_dt.isoformat())
                .gt("end_time", start_dt.isoformat())
                .limit(1)
                .execute()
            )

        conflict_res = await self.run_db(_check_conflict)
        if conflict_res.data:
            raise HTTPException(
                status_code=409,
                detail="This time slot was just booked by another attendee. Please select a different time."
            )

        event_title = (event_type or {}).get("title") or "Meeting"
        summary = f"{event_title} with {req.visitor_name.strip()}"
        price_cents = (event_type or {}).get("price_cents", 0)
        initial_status = MeetingStatus.CONFIRMED.value if price_cents == 0 else MeetingStatus.PENDING_PAYMENT.value
        initial_payment = PaymentStatus.NONE.value if price_cents == 0 else PaymentStatus.PENDING.value

        provider = bot.get("meeting_provider") or "google_meet"
        meeting_link = bot.get("custom_meeting_link") or f"https://meet.google.com/call-{bot['id'][:8]}"

        meeting_payload = {
            "bot_id": req.bot_id,
            "event_type_id": (event_type or {}).get("id"),
            "title": summary,
            "description": req.notes or f"Booked via Chatty {req.channel.value.upper()}",
            "start_time": start_dt.isoformat(),
            "end_time": end_dt.isoformat(),
            "timezone": req.visitor_timezone or "UTC",
            "meeting_link": meeting_link,
            "provider": provider,
            "status": initial_status,
            "attendee_name": req.visitor_name.strip(),
            "attendee_email": str(req.visitor_email).strip().lower(),
            "payment_status": initial_payment,
            "amount_paid_cents": price_cents,
            "currency": (event_type or {}).get("currency", "usd"),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

        def _insert_meeting():
            return self.supabase.table("chatty_meetings").insert(meeting_payload).execute()

        res = await self.run_db(_insert_meeting)
        if not res.data:
            raise HTTPException(status_code=500, detail="Failed to persist booking reservation")

        created = res.data[0]
        logger.info("Successfully created meeting: %s for %s", created["id"], req.visitor_email)
        return created

    async def reschedule_booking(
        self, req: BookingRescheduleRequest, bot_id: Optional[str] = None
    ) -> dict[str, Any]:
        """Reschedule an existing meeting to a new slot."""
        def _get_current():
            q = self.supabase.table("chatty_meetings").select("*").eq("id", req.meeting_id)
            if bot_id:
                q = q.eq("bot_id", bot_id)
            return q.limit(1).execute()

        curr_res = await self.run_db(_get_current)
        if not curr_res.data:
            raise HTTPException(status_code=404, detail="Meeting not found")

        current = curr_res.data[0]
        if current.get("status") == "cancelled":
            raise HTTPException(status_code=400, detail="Cannot reschedule a cancelled meeting")

        try:
            new_start_dt = datetime.fromisoformat(req.new_start.replace("Z", "+00:00"))
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid new_start timestamp format")

        orig_start = datetime.fromisoformat(current["start_time"].replace("Z", "+00:00"))
        orig_end = datetime.fromisoformat(current["end_time"].replace("Z", "+00:00"))
        duration = int((orig_end - orig_start).total_seconds() // 60)
        new_end_dt = new_start_dt + timedelta(minutes=duration)

        def _check_conflict():
            return (
                self.supabase.table("chatty_meetings")
                .select("id")
                .eq("bot_id", current["bot_id"])
                .neq("id", current["id"])
                .neq("status", "cancelled")
                .lt("start_time", new_end_dt.isoformat())
                .gt("end_time", new_start_dt.isoformat())
                .limit(1)
                .execute()
            )

        conflict = await self.run_db(_check_conflict)
        if conflict.data:
            raise HTTPException(status_code=409, detail="Selected reschedule slot is no longer available")

        update_payload = {
            "start_time": new_start_dt.isoformat(),
            "end_time": new_end_dt.isoformat(),
            "status": MeetingStatus.CONFIRMED.value,
            "description": f"{current.get('description') or ''}\n[Rescheduled at {datetime.now(timezone.utc).isoformat()}: {req.reason or 'User requested'}]".strip(),
        }

        def _update():
            return (
                self.supabase.table("chatty_meetings")
                .update(update_payload)
                .eq("id", req.meeting_id)
                .execute()
            )

        upd_res = await self.run_db(_update)
        return upd_res.data[0]

    async def cancel_booking(
        self, req: BookingCancelRequest, bot_id: Optional[str] = None
    ) -> dict[str, Any]:
        """Cancel a confirmed booking with cancellation reason logging."""
        def _get_current():
            q = self.supabase.table("chatty_meetings").select("*").eq("id", req.meeting_id)
            if bot_id:
                q = q.eq("bot_id", bot_id)
            return q.limit(1).execute()

        curr_res = await self.run_db(_get_current)
        if not curr_res.data:
            raise HTTPException(status_code=404, detail="Meeting not found")

        current = curr_res.data[0]
        if current.get("status") == "cancelled":
            return current

        update_payload = {
            "status": MeetingStatus.CANCELLED.value,
            "cancellation_reason": req.cancellation_reason or "Cancelled by user",
        }

        def _cancel():
            return (
                self.supabase.table("chatty_meetings")
                .update(update_payload)
                .eq("id", req.meeting_id)
                .execute()
            )

        res = await self.run_db(_cancel)
        return res.data[0]
