"""GDPR Compliance Service for Bookings - Right to Access (Export) & Right to Erasure (Scrubbing)."""

from __future__ import annotations

import hashlib
import logging
from datetime import datetime, timezone
from typing import Any, Optional

logger = logging.getLogger("chatty.booking.gdpr")


class BookingGDPRService:
    def __init__(self, supabase_client, run_db_func):
        self.supabase = supabase_client
        self.run_db = run_db_func

    async def export_visitor_data(self, email: str, bot_id: Optional[str] = None) -> dict[str, Any]:
        """GDPR Article 15/20: Export all booking records and personal metadata for a visitor."""
        clean_email = email.strip().lower()

        def _query():
            q = (
                self.supabase.table("chatty_meetings")
                .select("id, bot_id, title, start_time, end_time, timezone, provider, status, attendee_name, attendee_email, created_at, cancellation_reason")
                .eq("attendee_email", clean_email)
            )
            if bot_id:
                q = q.eq("bot_id", bot_id)
            return q.order("created_at", desc=True).execute()

        res = await self.run_db(_query)
        meetings = res.data or []

        return {
            "requested_email": clean_email,
            "export_timestamp": datetime.now(timezone.utc).isoformat(),
            "total_bookings_found": len(meetings),
            "bookings": meetings,
        }

    async def scrub_visitor_pii(
        self, email: str, bot_id: Optional[str] = None, reason: str = "GDPR Article 17 Erasure"
    ) -> dict[str, Any]:
        """GDPR Article 17: Right to Erasure.
        Anonymizes attendee personal data while preserving aggregate metrics for reporting."""
        clean_email = email.strip().lower()
        salt = hashlib.sha256(clean_email.encode("utf-8")).hexdigest()[:12]
        anonymized_email = f"anonymized_{salt}@privacy.invalid"

        def _find():
            q = self.supabase.table("chatty_meetings").select("id").eq("attendee_email", clean_email)
            if bot_id:
                q = q.eq("bot_id", bot_id)
            return q.execute()

        records = await self.run_db(_find)
        target_ids = [r["id"] for r in (records.data or [])]

        if not target_ids:
            return {
                "email": clean_email,
                "records_scrubbed": 0,
                "message": "No booking records found matching the specified email."
            }

        now_iso = datetime.now(timezone.utc).isoformat()
        scrub_payload = {
            "attendee_name": "Anonymized Attendee",
            "attendee_email": anonymized_email,
            "description": f"[Personal information scrubbed per {reason} at {now_iso}]",
            "anonymized_at": now_iso,
        }

        def _update_records():
            return (
                self.supabase.table("chatty_meetings")
                .update(scrub_payload)
                .in_("id", target_ids)
                .execute()
            )

        await self.run_db(_update_records)
        logger.info("Scrubbed %d booking records for GDPR request", len(target_ids))

        return {
            "email": clean_email,
            "records_scrubbed": len(target_ids),
            "anonymized_identifier": anonymized_email,
            "timestamp": now_iso,
            "status": "success"
        }
