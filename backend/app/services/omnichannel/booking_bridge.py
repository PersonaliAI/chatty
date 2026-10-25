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
from app.services.omnichannel.telegram_adapter import send_outbound_telegram
from app.services.omnichannel.sms_adapter import send_outbound_sms
from app.services.omnichannel.instagram_adapter import send_outbound_instagram
from app.services.omnichannel.tiktok_adapter import send_outbound_tiktok
from app.services.omnichannel.config_store import unpack_omnichannel_bot_row
from app.core.crypto import decrypt_secret

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


async def dispatch_channel_booking_notification(
    bot: dict[str, Any],
    session_id: str,
    event_type: str,  # "confirmed" | "rescheduled" | "cancelled"
    formatted_time: str,
    meeting_link: str = "",
    attendee_email: str = "",
    attendee_name: Optional[str] = None,
    reason: Optional[str] = None,
) -> bool:
    """Deliver appointment notification (confirmed, rescheduled, cancelled) across all
    supported channels: Telegram, WhatsApp, SMS, Messenger, Instagram, TikTok."""
    if not (bot and session_id):
        return False

    bot_omni = unpack_omnichannel_bot_row(bot)

    # 1. Telegram Bot
    if session_id.startswith("tg:"):
        chat_id = session_id[3:].strip()
        raw_tg_token = (
            bot_omni.get("telegram_bot_token")
            or bot.get("telegram_bot_token")
            or (bot.get("omnichannel_config") or {}).get("telegram_bot_token")
            or ""
        )
        tok = decrypt_secret(str(raw_tg_token))
        if not (tok and chat_id):
            logger.warning("Telegram booking dispatch skipped: missing bot token or chat_id")
            return False

        if event_type == "confirmed":
            text = (
                f"🎉 *Your appointment has been confirmed!*\n\n"
                f"📅 *Time:* {formatted_time}\n"
                f"🔗 *Meeting Link:* {meeting_link}\n\n"
                f"A calendar invitation has been sent to `{attendee_email}`. See you there!"
            )
            buttons = [{"text": "🔗 Join Meeting", "url": meeting_link}] if meeting_link and meeting_link.startswith("http") else None
        elif event_type == "rescheduled":
            text = (
                f"📅 *Your appointment has been rescheduled!*\n\n"
                f"🕒 *New Time:* {formatted_time}\n"
                f"🔗 *Meeting Link:* {meeting_link}\n\n"
                f"An updated calendar invitation has been sent to `{attendee_email}`."
            )
            buttons = [{"text": "🔗 Join Meeting", "url": meeting_link}] if meeting_link and meeting_link.startswith("http") else None
        else:  # cancelled
            reason_suffix = f"\n*Reason:* {reason}" if reason else ""
            text = (
                f"❌ *Your appointment for {formatted_time} has been cancelled.*{reason_suffix}\n\n"
                f"Feel free to schedule another time whenever you are ready!"
            )
            buttons = None

        return await send_outbound_telegram(
            bot_token=tok,
            chat_id=chat_id,
            text=text,
            inline_buttons=buttons,
        )

    # 2. WhatsApp
    if session_id.startswith("wa:"):
        wa_phone = session_id[3:].strip()
        if event_type == "confirmed":
            return await dispatch_whatsapp_booking_confirmation(
                bot=bot,
                phone=wa_phone,
                formatted_time=formatted_time,
                meeting_link=meeting_link,
                attendee_email=attendee_email,
                attendee_name=attendee_name,
            )
        elif event_type == "rescheduled":
            return await dispatch_whatsapp_booking_rescheduled(
                bot=bot,
                phone=wa_phone,
                formatted_time=formatted_time,
                meeting_link=meeting_link,
                attendee_email=attendee_email,
                attendee_name=attendee_name,
            )
        else:
            return await dispatch_whatsapp_booking_cancelled(
                bot=bot,
                phone=wa_phone,
                formatted_time=formatted_time,
                attendee_name=attendee_name,
                reason=reason,
            )

    # 3. Two-Way SMS (Twilio)
    if session_id.startswith("sms:"):
        to_number = session_id[4:].strip()
        sid_tw = str(bot_omni.get("twilio_account_sid") or "")
        tok_tw = decrypt_secret(str(bot_omni.get("twilio_auth_token") or ""))
        from_tw = str(bot_omni.get("twilio_phone_number") or "")
        if not (sid_tw and tok_tw and from_tw and to_number):
            logger.warning("SMS booking dispatch skipped: missing Twilio credentials")
            return False

        if event_type == "confirmed":
            msg = f"Your appointment is confirmed for {formatted_time}. Join link: {meeting_link}. An invite was sent to {attendee_email}."
        elif event_type == "rescheduled":
            msg = f"Your appointment was rescheduled to {formatted_time}. Join link: {meeting_link}."
        else:
            msg = f"Your appointment for {formatted_time} has been cancelled."

        return await send_outbound_sms(
            account_sid=sid_tw,
            auth_token=tok_tw,
            from_number=from_tw,
            to_number=to_number,
            text=msg,
        )

    # 4. Messenger / Instagram
    if session_id.startswith("fb:") or session_id.startswith("ig:"):
        recipient_id = session_id[3:].strip()
        tok = decrypt_secret(str(bot_omni.get("messenger_access_token") or bot_omni.get("instagram_access_token") or ""))
        if not (tok and recipient_id):
            return False

        if event_type == "confirmed":
            msg = f"🎉 Your appointment has been confirmed for {formatted_time}.\nMeeting Link: {meeting_link}\nA calendar invite was sent to {attendee_email}."
        elif event_type == "rescheduled":
            msg = f"📅 Your appointment has been rescheduled to {formatted_time}.\nMeeting Link: {meeting_link}."
        else:
            msg = f"❌ Your appointment for {formatted_time} has been cancelled."

        return await send_outbound_instagram(page_access_token=tok, recipient_id=recipient_id, text=msg)

    # 5. TikTok
    if session_id.startswith("tt:"):
        recipient_id = session_id[3:].strip()
        tok = decrypt_secret(str(bot_omni.get("tiktok_access_token") or ""))
        biz_id = str(bot_omni.get("tiktok_business_id") or bot_omni.get("tiktok_open_id") or "me")
        if not (tok and recipient_id):
            return False

        if event_type == "confirmed":
            msg = f"Your appointment is confirmed for {formatted_time}. Meeting Link: {meeting_link}"
        elif event_type == "rescheduled":
            msg = f"Your appointment was rescheduled to {formatted_time}. Meeting Link: {meeting_link}"
        else:
            msg = f"Your appointment for {formatted_time} was cancelled."

        return await send_outbound_tiktok(access_token=tok, business_id=biz_id, recipient_id=recipient_id, text=msg)

    return False

