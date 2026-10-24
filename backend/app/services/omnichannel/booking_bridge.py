"""Omnichannel booking bridge: handles booking intent, conversational slot
formatting, and dispatching confirmation, rescheduling, and cancellation notices.
"""

from __future__ import annotations

import logging
import re
import time
from typing import Any, Optional

from app.services import whatsapp_service
from app.services.omnichannel.models import ChannelType

logger = logging.getLogger("chatty.omnichannel.booking")

BOOKING_MARKER = "[BOOKING_WIDGET]"
BOOKING_INTENT_PATTERN = re.compile(
    r"\b(book|booking|schedule|appointment|demo|reserve|slot|slots|calendar|call)\b",
    re.IGNORECASE,
)
MEETING_LINK_HOSTS = ("meet.google.com", "teams.microsoft.com", "zoom.us", "join.zoom.us")


def is_booking_intent(
    text: str,
    reply: str,
    calendar_enabled: bool = True,
) -> bool:
    """Determine whether an inbound or outbound message represents booking intent."""
    if not calendar_enabled:
        return False
    if BOOKING_MARKER in reply:
        return True
    has_booking_link = bool(re.search(r"https?://[^\s)]+/book/[^\s)]+", reply, re.IGNORECASE))
    if has_booking_link:
        return True
    already_booked = any(host in reply for host in MEETING_LINK_HOSTS)
    if not already_booked and BOOKING_INTENT_PATTERN.search(text):
        return True
    return False


def build_whatsapp_booking_cta(
    bot_id: str,
    phone: str,
    secret: str,
    base_url: Optional[str] = None,
) -> tuple[str, str]:
    """Generate signed booking link and WhatsApp call-to-action text.
    Returns (cta_text, booking_url).
    """
    return build_channel_booking_cta(
        channel=ChannelType.WHATSAPP,
        bot_id=bot_id,
        identifier=phone,
        secret=secret,
        base_url=base_url,
    )


def build_channel_booking_cta(
    channel: ChannelType,
    bot_id: str,
    identifier: str,
    secret: str,
    base_url: Optional[str] = None,
) -> tuple[str, str]:
    """Generate signed booking link and call-to-action text tailored to each channel."""
    prefix_map = {
        ChannelType.WHATSAPP: "wa",
        ChannelType.SMS: "sms",
        ChannelType.TELEGRAM: "tg",
        ChannelType.INSTAGRAM: "ig",
        ChannelType.MESSENGER: "fb",
        ChannelType.TIKTOK: "tt",
        ChannelType.EMAIL: "email",
    }
    prefix = prefix_map.get(channel, "wa")
    if channel in (ChannelType.WHATSAPP, ChannelType.SMS):
        clean_id = re.sub(r"[^\d]", "", str(identifier))
    elif channel == ChannelType.EMAIL:
        clean_id = str(identifier).strip().lower()
    else:
        clean_id = re.sub(r"[^\w@.-]", "", str(identifier))
    session_id = f"{prefix}:{clean_id}"

    ts = int(time.time())
    sig = whatsapp_service.generate_whatsapp_booking_signature(bot_id, clean_id, ts, secret)
    app_base = (base_url or whatsapp_service.DEFAULT_APP_URL).rstrip("/")
    booking_url = f"{app_base}/book/{bot_id}?session_id={session_id}&t={ts}&sig={sig}"

    if channel == ChannelType.SMS:
        cta = f"\n\nSchedule your appointment here: {booking_url}"
    elif channel == ChannelType.TELEGRAM:
        cta = f"\n\n📅 *Schedule your appointment:*\n{booking_url}"
    elif channel == ChannelType.EMAIL:
        cta = (
            f"\n\nSchedule your appointment here:\n"
            f"{booking_url}\n\n"
            f"Click the link to choose your preferred date and time slot."
        )
    else:
        cta = (
            f"\n\n📅 *Schedule your appointment here:*\n"
            f"{booking_url}\n\n"
            f"_Tap the link to choose your preferred date & time slot._"
        )

    return cta, booking_url


def format_available_slots_for_whatsapp(
    slots: list[dict[str, Any]],
    timezone_label: str = "UTC",
    max_slots: int = 5,
) -> str:
    """Format raw slot dictionaries into clean, reader-friendly WhatsApp message lines."""
    if not slots:
        return "There are no available time slots found for the requested period. Please select another date."

    lines = ["📅 *Available Appointment Times:*"]
    for s in slots[:max_slots]:
        label = s.get("label") or s.get("start") or s.get("formatted") or ""
        if label:
            lines.append(f"• {label} ({timezone_label})")

    lines.append("\n_Reply with your preferred time, or use the booking link below._")
    return "\n".join(lines)


async def dispatch_whatsapp_booking_confirmation(
    bot: dict[str, Any],
    phone: str,
    formatted_time: str,
    meeting_link: str,
    attendee_email: str,
    attendee_name: Optional[str] = None,
) -> bool:
    """Deliver appointment confirmation via WhatsApp."""
    return await whatsapp_service.dispatch_whatsapp_booking_confirmation(
        bot=bot,
        phone=phone,
        formatted_time=formatted_time,
        meeting_link=meeting_link,
        attendee_email=attendee_email,
        attendee_name=attendee_name,
    )


async def dispatch_whatsapp_booking_rescheduled(
    bot: dict[str, Any],
    phone: str,
    formatted_time: str,
    meeting_link: str,
    attendee_email: str,
    attendee_name: Optional[str] = None,
) -> bool:
    """Deliver appointment rescheduling notice via WhatsApp."""
    return await whatsapp_service.dispatch_whatsapp_booking_rescheduled(
        bot=bot,
        phone=phone,
        formatted_time=formatted_time,
        meeting_link=meeting_link,
        attendee_email=attendee_email,
        attendee_name=attendee_name,
    )


async def dispatch_whatsapp_booking_cancelled(
    bot: dict[str, Any],
    phone: str,
    formatted_time: str,
    attendee_name: Optional[str] = None,
    reason: Optional[str] = None,
) -> bool:
    """Deliver appointment cancellation notice via WhatsApp."""
    return await whatsapp_service.dispatch_whatsapp_booking_cancelled(
        bot=bot,
        phone=phone,
        formatted_time=formatted_time,
        attendee_name=attendee_name,
        reason=reason,
    )
