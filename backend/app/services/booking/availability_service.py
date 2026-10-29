"""Availability Service - Cal.com-grade slot calculation with buffers, notice periods, and fatigue protection."""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any, List, Optional, Set
import pytz

logger = logging.getLogger("chatty.booking.availability")


class AvailabilityService:
    def __init__(self, supabase_client, run_db_func):
        self.supabase = supabase_client
        self.run_db = run_db_func

    async def get_daily_meeting_counts(
        self, bot_id: str, start_dt: datetime, end_dt: datetime
    ) -> dict[str, int]:
        """Return count of active meetings per date (YYYY-MM-DD) for max_bookings_per_day protection."""
        def _query():
            return (
                self.supabase.table("chatty_meetings")
                .select("start_time, status")
                .eq("bot_id", bot_id)
                .neq("status", "cancelled")
                .gte("start_time", start_dt.isoformat())
                .lte("start_time", end_dt.isoformat())
                .execute()
            )

        res = await self.run_db(_query)
        counts: dict[str, int] = {}
        for m in res.data or []:
            try:
                st = datetime.fromisoformat(m["start_time"].replace("Z", "+00:00"))
                d_str = st.strftime("%Y-%m-%d")
                counts[d_str] = counts.get(d_str, 0) + 1
            except Exception:
                pass
        return counts

    async def get_busy_intervals(
        self, bot_id: str, start_dt: datetime, end_dt: datetime
    ) -> List[tuple[datetime, datetime]]:
        """Fetch all existing confirmed/pending meetings as busy intervals."""
        def _query():
            return (
                self.supabase.table("chatty_meetings")
                .select("start_time, end_time, status")
                .eq("bot_id", bot_id)
                .neq("status", "cancelled")
                .gte("end_time", start_dt.isoformat())
                .lte("start_time", end_dt.isoformat())
                .execute()
            )

        res = await self.run_db(_query)
        intervals: List[tuple[datetime, datetime]] = []
        for m in res.data or []:
            try:
                st = datetime.fromisoformat(m["start_time"].replace("Z", "+00:00"))
                et = datetime.fromisoformat(m["end_time"].replace("Z", "+00:00"))
                intervals.append((st, et))
            except Exception:
                pass
        return intervals

    def compute_slots(
        self,
        *,
        bot: dict[str, Any],
        event_type: Optional[dict[str, Any]],
        owner_tz_str: str,
        visitor_tz_str: str,
        now_utc: datetime,
        days_ahead: int = 14,
        busy_intervals: List[tuple[datetime, datetime]],
        daily_counts: dict[str, int],
    ) -> dict[str, Any]:
        """Compute guaranteed available slots incorporating buffers, minimum notice, and daily fatigue caps."""
        duration = (event_type or {}).get("duration_minutes") or bot.get("scheduling_duration_minutes") or 30
        buffer_before = (event_type or {}).get("buffer_before_minutes") or bot.get("buffer_minutes") or 0
        buffer_after = (event_type or {}).get("buffer_after_minutes") or 10
        min_notice_hrs = (event_type or {}).get("min_notice_hours") or bot.get("advance_notice_hours") or 2
        max_per_day = (event_type or {}).get("max_bookings_per_day") or bot.get("max_daily_meetings")

        earliest_allowed_utc = now_utc + timedelta(hours=min_notice_hrs)

        try:
            owner_tz = pytz.timezone(owner_tz_str)
        except Exception:
            owner_tz = pytz.UTC
        try:
            visitor_tz = pytz.timezone(visitor_tz_str)
        except Exception:
            visitor_tz = pytz.UTC

        start_hour = bot.get("business_hours_start") if bot.get("business_hours_start") is not None else 9
        end_hour = bot.get("business_hours_end") if bot.get("business_hours_end") is not None else 17
        working_days: Set[int] = set(bot.get("working_days") or [1, 2, 3, 4, 5])

        padded_busy: List[tuple[datetime, datetime]] = []
        for b_start, b_end in busy_intervals:
            padded_busy.append((
                b_start - timedelta(minutes=buffer_before),
                b_end + timedelta(minutes=buffer_after)
            ))

        available_dates: List[str] = []
        slots_by_date: dict[str, List[dict[str, Any]]] = {}

        owner_now = now_utc.astimezone(owner_tz)
        step_minutes = 30 if duration >= 30 else 15

        for d_offset in range(days_ahead):
            current_day = (owner_now + timedelta(days=d_offset)).date()
            iso_weekday = current_day.isoweekday()
            if iso_weekday not in working_days:
                continue

            day_key = current_day.strftime("%Y-%m-%d")
            if max_per_day and daily_counts.get(day_key, 0) >= max_per_day:
                continue

            day_start = owner_tz.localize(datetime(current_day.year, current_day.month, current_day.day, start_hour, 0))
            day_end = owner_tz.localize(datetime(current_day.year, current_day.month, current_day.day, end_hour, 0))

            slot_start = day_start

            while slot_start + timedelta(minutes=duration) <= day_end:
                slot_end = slot_start + timedelta(minutes=duration)
                slot_start_utc = slot_start.astimezone(timezone.utc)
                slot_end_utc = slot_end.astimezone(timezone.utc)

                if slot_start_utc >= earliest_allowed_utc:
                    conflict = False
                    for b_st, b_et in padded_busy:
                        if slot_start_utc < b_et and slot_end_utc > b_st:
                            conflict = True
                            break

                    if not conflict:
                        vis_start = slot_start_utc.astimezone(visitor_tz)
                        vis_end = slot_end_utc.astimezone(visitor_tz)
                        vis_date_str = vis_start.strftime("%Y-%m-%d")

                        slot_obj = {
                            "start": slot_start_utc.isoformat(),
                            "end": slot_end_utc.isoformat(),
                            "time_label": vis_start.strftime("%I:%M %p").lstrip("0"),
                            "visitor_local_label": f"{vis_start.strftime('%I:%M %p')} - {vis_end.strftime('%I:%M %p')} ({vis_start.strftime('%Z')})",
                            "owner_local_label": f"{slot_start.strftime('%I:%M %p')} ({slot_start.strftime('%Z')})",
                            "host_timezone": owner_tz_str,
                            "event_type_id": (event_type or {}).get("id")
                        }

                        if vis_date_str not in slots_by_date:
                            slots_by_date[vis_date_str] = []
                            available_dates.append(vis_date_str)
                        slots_by_date[vis_date_str].append(slot_obj)

                slot_start += timedelta(minutes=step_minutes)

        return {
            "enabled": True,
            "duration_minutes": duration,
            "buffer_before_minutes": buffer_before,
            "buffer_after_minutes": buffer_after,
            "min_notice_hours": min_notice_hrs,
            "visitor_timezone": visitor_tz_str,
            "owner_timezone": owner_tz_str,
            "available_dates": sorted(list(set(available_dates))),
            "slots_by_date": slots_by_date
        }
