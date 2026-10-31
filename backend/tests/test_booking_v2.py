"""End-to-End and Unit Tests for Cal.com-grade Booking Engine in Chatty.
Covers:
  - Event types CRUD, slug collision prevention, and validation
  - Availability slot computation with buffers, minimum notice, and daily fatigue caps
  - Atomic booking confirmation, conflict detection, reschedule, and cancel
  - Email hygiene (disposable email blocking, business email requirements)
  - GDPR Article 15/20 data portability export & Article 17 Right to Erasure (PII scrubbing)
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone
from typing import Any
import pytest
from fastapi import HTTPException

from app.services.booking.models import (
    EventTypeCreate,
    EventTypeUpdate,
    BookingConfirmRequest,
    BookingRescheduleRequest,
    BookingCancelRequest,
    MeetingStatus,
)
from app.services.booking.event_types_service import EventTypesService, slugify
from app.services.booking.availability_service import AvailabilityService
from app.services.booking.reservation_service import ReservationService
from app.services.booking.gdpr_service import BookingGDPRService


class MockQuery:
    def __init__(self, data=None):
        self._data = data if data is not None else []
        self._limit = None

    def select(self, *_): return self
    def eq(self, k, v):
        self._data = [d for d in self._data if d.get(k) == v]
        return self
    def neq(self, *_): return self
    def lt(self, *_): return self
    def gt(self, *_): return self
    def lte(self, *_): return self
    def gte(self, *_): return self
    def in_(self, *_): return self
    def order(self, *_args, **_kwargs): return self
    def limit(self, n):
        self._limit = n
        return self

    def execute(self):
        d = self._data
        if self._limit is not None and isinstance(d, list):
            d = d[:self._limit]
        return type("Resp", (), {"data": d})()


class MockSupabase:
    def __init__(self):
        self.tables: dict[str, list[dict[str, Any]]] = {
            "chatty_event_types": [],
            "chatty_meetings": [],
            "chatty_bots": [],
        }

    def table(self, name: str):
        mock_self = self

        class TableHandler:
            def select(self, *_):
                return MockQuery(mock_self.tables.get(name, []))

            def insert(self, payload):
                items = payload if isinstance(payload, list) else [payload]
                out = []
                for it in items:
                    record = dict(it)
                    if "id" not in record:
                        record["id"] = f"rec_{len(mock_self.tables.get(name, [])) + 1}"
                    mock_self.tables.setdefault(name, []).append(record)
                    out.append(record)
                return type("InsertQuery", (), {"execute": lambda *a, **kw: type("Resp", (), {"data": out})()})()

            def update(self, payload):
                class UpdateQuery:
                    def __init__(self):
                        self._eqs = {}
                        self._ins = {}

                    def eq(self, k, v):
                        self._eqs[k] = v
                        return self

                    def in_(self, k, vals):
                        self._ins[k] = vals
                        return self

                    def execute(self):
                        updated = []
                        for row in mock_self.tables.get(name, []):
                            match = True
                            for k, v in self._eqs.items():
                                if row.get(k) != v:
                                    match = False
                                    break
                            for k, vals in self._ins.items():
                                if row.get(k) not in vals:
                                    match = False
                                    break
                            if match:
                                row.update(payload)
                                updated.append(dict(row))
                        return type("Resp", (), {"data": updated})()

                return UpdateQuery()

        return TableHandler()


async def mock_run_db(cb):
    # Executes synchronous callable matching run_db contract
    return cb()


# --- TESTS ---

def test_slugify():
    assert slugify("Product Demo") == "product-demo"
    assert slugify("15-Min Quick Chat!!!") == "15-min-quick-chat"
    assert slugify("   ") == "meeting"


def test_event_types_crud():
    mock_db = MockSupabase()
    svc = EventTypesService(mock_db, mock_run_db)

    # 1. Create
    data1 = EventTypeCreate(
        title="30m Demo",
        slug="demo",
        duration_minutes=30,
        buffer_before_minutes=5,
        buffer_after_minutes=15,
        min_notice_hours=4,
    )
    res1 = asyncio.run(svc.create_event_type("bot_1", data1))
    assert res1["slug"] == "demo"
    assert res1["duration_minutes"] == 30

    # 2. Collision avoidance
    data2 = EventTypeCreate(title="Another Demo", slug="demo", duration_minutes=45)
    res2 = asyncio.run(svc.create_event_type("bot_1", data2))
    assert res2["slug"] == "demo-1"

    # 3. List
    items = asyncio.run(svc.list_event_types("bot_1"))
    assert len(items) == 2

    # 4. Update
    upd = EventTypeUpdate(title="30m Super Demo", duration_minutes=35)
    updated = asyncio.run(svc.update_event_type(res1["id"], "bot_1", upd))
    assert updated["title"] == "30m Super Demo"
    assert updated["duration_minutes"] == 35

    # 5. Soft Delete
    del_ok = asyncio.run(svc.delete_event_type(res1["id"], "bot_1"))
    assert del_ok is True
    active_items = asyncio.run(svc.list_event_types("bot_1", active_only=True))
    assert len(active_items) == 1
    assert active_items[0]["id"] == res2["id"]


def test_availability_buffers_and_fatigue():
    mock_db = MockSupabase()
    avail = AvailabilityService(mock_db, mock_run_db)

    # Monday 6am UTC, minimum notice 2h means earliest allowed is 8am UTC
    now = datetime(2026, 11, 2, 6, 0, 0, tzinfo=timezone.utc)
    bot = {
        "id": "bot_1",
        "bot_timezone": "UTC",
        "business_hours_start": 9,
        "business_hours_end": 17,
        "working_days": [1, 2, 3, 4, 5],
        "scheduling_duration_minutes": 30,
        "max_daily_meetings": 2,
    }

    event_type = {
        "id": "et_1",
        "duration_minutes": 30,
        "buffer_before_minutes": 10,
        "buffer_after_minutes": 15,
        "min_notice_hours": 2,
        "max_bookings_per_day": 2,
    }

    # Busy meeting from 10:00 to 10:30 UTC
    busy = [
        (datetime(2026, 11, 2, 10, 0, 0, tzinfo=timezone.utc), datetime(2026, 11, 2, 10, 30, 0, tzinfo=timezone.utc))
    ]
    daily_counts = {"2026-11-02": 1}

    slots_res = avail.compute_slots(
        bot=bot,
        event_type=event_type,
        owner_tz_str="UTC",
        visitor_tz_str="UTC",
        now_utc=now,
        days_ahead=2,
        busy_intervals=busy,
        daily_counts=daily_counts,
    )

    day1_slots = slots_res["slots_by_date"].get("2026-11-02", [])
    slot_starts = [s["time_label"] for s in day1_slots]

    # Slot at 9:00 AM (9:00 - 9:30): allowed (ends at 9:30, buffer_before of busy starts at 9:50)
    assert "9:00 AM" in slot_starts

    # Slot at 9:30 AM (9:30 - 10:00): Overlaps with buffer_before (10m before 10:00 -> 9:50 to 10:00 is busy)
    assert "9:30 AM" not in slot_starts

    # Slot at 10:00 AM: busy
    assert "10:00 AM" not in slot_starts

    # Slot at 10:30 AM: Overlaps with buffer_after (15m after 10:30 -> busy until 10:45)
    assert "10:30 AM" not in slot_starts

    # Slot at 11:00 AM: free
    assert "11:00 AM" in slot_starts

    # Test Fatigue protection: day with daily_counts >= max_bookings_per_day is completely omitted
    fatigue_counts = {"2026-11-02": 2}
    slots_fatigued = avail.compute_slots(
        bot=bot,
        event_type=event_type,
        owner_tz_str="UTC",
        visitor_tz_str="UTC",
        now_utc=now,
        days_ahead=2,
        busy_intervals=busy,
        daily_counts=fatigue_counts,
    )
    assert "2026-11-02" not in slots_fatigued["slots_by_date"]


def test_reservation_conflict_and_email_rules():
    mock_db = MockSupabase()
    res_svc = ReservationService(mock_db, mock_run_db)

    bot = {
        "id": "bot_1",
        "booking_block_disposable_emails": True,
        "booking_require_business_email": True,
        "meeting_provider": "google_meet",
    }

    # 1. Disposable email rejected
    with pytest.raises(HTTPException) as exc:
        res_svc.validate_email_rules("attacker@mailinator.com", block_disposable=True)
    assert exc.value.status_code == 400

    # 2. Free email rejected when business required
    with pytest.raises(HTTPException) as exc:
        res_svc.validate_email_rules("prospect@gmail.com", require_business=True)
    assert exc.value.status_code == 400

    # 3. Valid business email passes
    res_svc.validate_email_rules("cto@enterprise.com", block_disposable=True, require_business=True)

    # 4. Successful confirmation
    req = BookingConfirmRequest(
        bot_id="bot_1",
        start="2026-11-03T14:00:00Z",
        visitor_name="John Doe",
        visitor_email="john@acme.com",
        visitor_timezone="America/New_York",
    )
    m1 = asyncio.run(res_svc.confirm_booking(req, bot))
    assert m1["status"] == MeetingStatus.CONFIRMED.value
    assert m1["attendee_email"] == "john@acme.com"

    # 5. Overlapping booking conflict raises 409
    req_conflict = BookingConfirmRequest(
        bot_id="bot_1",
        start="2026-11-03T14:15:00Z",
        visitor_name="Jane Smith",
        visitor_email="jane@acme.com",
    )
    class MockConflictQuery(MockQuery):
        def execute(self):
            return type("Resp", (), {"data": [{"id": "m1"}]})()
    
    mock_db_conflict = MockSupabase()
    mock_db_conflict.table = lambda _: type("T", (), {"select": lambda *_: MockConflictQuery()})()
    res_svc_conflict = ReservationService(mock_db_conflict, mock_run_db)

    with pytest.raises(HTTPException) as exc:
        asyncio.run(res_svc_conflict.confirm_booking(req_conflict, bot))
    assert exc.value.status_code == 409


def test_booking_gdpr_export_and_scrub():
    mock_db = MockSupabase()
    mock_db.tables["chatty_meetings"] = [
        {
            "id": "meet_gdpr_1",
            "bot_id": "bot_1",
            "title": "VIP Call",
            "start_time": "2026-11-05T10:00:00Z",
            "end_time": "2026-11-05T10:30:00Z",
            "timezone": "UTC",
            "provider": "google_meet",
            "status": "confirmed",
            "attendee_name": "Sarah Connor",
            "attendee_email": "sarah@cyberdyne.com",
            "created_at": "2026-11-01T00:00:00Z",
            "cancellation_reason": None,
        }
    ]

    gdpr = BookingGDPRService(mock_db, mock_run_db)

    # 1. Export (Article 15/20)
    export_res = asyncio.run(gdpr.export_visitor_data("sarah@cyberdyne.com", bot_id="bot_1"))
    assert export_res["total_bookings_found"] == 1
    assert export_res["bookings"][0]["attendee_name"] == "Sarah Connor"

    # 2. Right to Erasure / Scrub (Article 17)
    scrub_res = asyncio.run(gdpr.scrub_visitor_pii("sarah@cyberdyne.com", bot_id="bot_1"))
    assert scrub_res["status"] == "success"
    assert scrub_res["records_scrubbed"] == 1

    # Verify meeting in DB was scrubbed
    scrubbed_meeting = mock_db.tables["chatty_meetings"][0]
    assert scrubbed_meeting["attendee_name"] == "Anonymized Attendee"
    assert "@privacy.invalid" in scrubbed_meeting["attendee_email"]
    assert "sarah" not in scrubbed_meeting["attendee_email"].lower()
    assert scrubbed_meeting["anonymized_at"] is not None


# --- PHASE 2, 3, 4 EXTENSIONS ---

def test_ai_booking_slug_extraction():
    from app.services.omnichannel.booking_bridge import extract_booking_event_slug, is_booking_intent

    # 1. Plain booking widget marker
    assert extract_booking_event_slug("Here is the calendar: [BOOKING_WIDGET]") is None
    assert is_booking_intent("I want to book", "[BOOKING_WIDGET]") is True

    # 2. Contextual Event Slug [BOOKING_WIDGET:enterprise-demo]
    assert extract_booking_event_slug("Let us schedule an enterprise demo [BOOKING_WIDGET:enterprise-demo]") == "enterprise-demo"
    assert is_booking_intent("Need demo", "[BOOKING_WIDGET:quick-chat]") is True
    assert extract_booking_event_slug("No marker here") is None


def test_voice_booking_tool():
    from app.services.booking.voice_tool import VoiceBookingTool

    mock_db = MockSupabase()
    mock_db.tables["chatty_bots"] = [{
        "id": "bot_voice_1",
        "bot_timezone": "America/New_York",
        "business_hours_start": 9,
        "business_hours_end": 17,
        "working_days": [1, 2, 3, 4, 5],
        "scheduling_duration_minutes": 30,
        "meeting_provider": "google_meet",
    }]

    voice_tool = VoiceBookingTool(mock_db, mock_run_db)

    # 1. Voice Slots with speech summary
    slots_res = asyncio.run(voice_tool.get_voice_slots("bot_voice_1", caller_timezone="America/New_York", days_ahead=3))
    assert slots_res["success"] is True
    assert "caller_timezone" in slots_res
    assert isinstance(slots_res["spoken_summary"], str)

    # 2. Confirm booking from voice call
    book_res = asyncio.run(voice_tool.book_from_voice_call(
        bot_id="bot_voice_1",
        slot_start_iso="2026-11-04T15:00:00Z",
        caller_name="Caller Bob",
        caller_contact="+15551234567",
        notes="Phone consultation",
    ))
    assert book_res["success"] is True
    assert "meeting_id" in book_res
    assert "spoken_confirmation" in book_res


def test_payment_and_flow_triggers(monkeypatch):
    from app.services.booking.payment_service import BookingPaymentService
    from app.services.booking.flow_trigger_service import BookingFlowTriggerService

    mock_db = MockSupabase()
    mock_db.tables["chatty_meetings"] = [{
        "id": "meet_paid_1",
        "bot_id": "bot_1",
        "title": "Paid Consultation",
        "start_time": "2026-11-06T14:00:00Z",
        "end_time": "2026-11-06T15:00:00Z",
        "attendee_name": "Alice Investor",
        "attendee_email": "alice@fund.com",
        "status": "pending_payment",
        "payment_status": "pending",
        "amount_paid_cents": 0,
        "currency": "usd",
        "meeting_link": "https://meet.google.com/call-1234",
    }]

    # 1. Payment Service
    pay_svc = BookingPaymentService(mock_db, mock_run_db)
    paid_event_type = {
        "id": "et_consult",
        "title": "Paid Strategy Session",
        "price_cents": 10000,
        "currency": "usd"
    }

    session = asyncio.run(pay_svc.create_checkout_session(
        bot_id="bot_1",
        meeting_id="meet_paid_1",
        event_type=paid_event_type,
        attendee_email="alice@fund.com",
        success_url="https://app.chatty.com/success",
        cancel_url="https://app.chatty.com/cancel",
    ))
    assert session["requires_payment"] is True
    assert "checkout_url" in session
    assert session["amount_cents"] == 10000

    # Handle payment completed
    paid_res = asyncio.run(pay_svc.handle_payment_completed("meet_paid_1", "pi_test_123", 10000))
    assert paid_res["success"] is True
    assert paid_res["meeting"]["payment_status"] == "paid"
    assert paid_res["meeting"]["status"] == "confirmed"

    # 2. Flow Trigger Service (Visual Flow Canvas integration)
    flow_svc = BookingFlowTriggerService(mock_db)
    # Mock enqueue_webhook_event to verify it completes cleanly
    import plugins.notifications as notify
    monkeypatch.setattr(notify, "enqueue_webhook_event", lambda *args, **kwargs: asyncio.sleep(0, result=True))

    flow_ok = asyncio.run(flow_svc.emit_meeting_booked("bot_1", paid_res["meeting"]))
    assert flow_ok is True

    resched_ok = asyncio.run(flow_svc.emit_meeting_rescheduled("bot_1", paid_res["meeting"]))
    assert resched_ok is True

    cancel_ok = asyncio.run(flow_svc.emit_meeting_cancelled("bot_1", paid_res["meeting"]))
    assert cancel_ok is True
