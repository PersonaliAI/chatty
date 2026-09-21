"""WhatsApp channel service: HMAC security signatures, URL generation,
and Meta Cloud API message dispatch.
"""

from __future__ import annotations

import hashlib
import hmac
import logging
import os
import re
import time
import asyncio
from typing import Any

import httpx

from app.core.crypto import decrypt_secret

logger = logging.getLogger("chatty.whatsapp")

WHATSAPP_API_VERSION = os.environ.get("WHATSAPP_API_VERSION", "v21.0")
WHATSAPP_ACCESS_TOKEN = os.environ.get("WHATSAPP_ACCESS_TOKEN", "")
WHATSAPP_APP_SECRET = os.environ.get("WHATSAPP_APP_SECRET", "")
WHATSAPP_PHONE_NUMBER_ID = os.environ.get("WHATSAPP_PHONE_NUMBER_ID", "")
DEFAULT_APP_URL = os.environ.get("NEXT_PUBLIC_APP_URL") or os.environ.get("FRONTEND_URL") or "https://chatty.personaliai.com"


def get_bot_whatsapp_secret(bot: dict[str, Any]) -> str:
    """Resolve HMAC signing secret for a bot.
    Prefers bot's custom whatsapp_app_secret, falls back to server env, then bot id.
    """
    return (
        (bot.get("whatsapp_app_secret") or "").strip()
        or WHATSAPP_APP_SECRET
        or (bot.get("id") or "").strip()
        or "chatty_wa_booking_secret"
    )


def generate_whatsapp_booking_signature(
    bot_id: str,
    phone: str,
    timestamp: int | str,
    secret: str,
) -> str:
    """Generate a tamper-proof HMAC-SHA256 signature for WhatsApp booking URLs.
    Signs the combination of bot_id, recipient phone number, and timestamp.
    """
    clean_phone = re.sub(r"[^\d]", "", phone)
    message = f"wa_booking:{bot_id}:{clean_phone}:{timestamp}".encode("utf-8")
    return hmac.new(secret.encode("utf-8"), message, hashlib.sha256).hexdigest()[:24]


def verify_whatsapp_booking_signature(
    bot_id: str,
    phone: str,
    timestamp: int | str,
    signature: str,
    secret: str,
    max_age_seconds: int = 72 * 3600,  # 72 hours validity
) -> bool:
    """Verify cryptographic signature and ensure the token has not expired.
    Protects against anti-spam bombing where unauthenticated requests attempt
    to trigger WhatsApp notifications to arbitrary phone numbers.
    """
    if not (bot_id and phone and timestamp and signature and secret):
        return False

    try:
        ts = int(timestamp)
        now = int(time.time())
        # Check token freshness (allow 5-min future tolerance for clock skew)
        if (now - ts) > max_age_seconds or (ts - now) > 300:
            logger.warning(
                "WhatsApp booking token expired: ts=%s, now=%s (skew=%ss)",
                ts,
                now,
                now - ts,
            )
            return False
    except (ValueError, TypeError):
        logger.warning("WhatsApp booking token has invalid timestamp: %s", timestamp)
        return False

    expected = generate_whatsapp_booking_signature(bot_id, phone, str(ts), secret)
    return hmac.compare_digest(expected, signature.strip())


def build_whatsapp_booking_url(
    bot_id: str,
    phone: str,
    secret: str,
    base_url: str | None = None,
    current_time: int | None = None,
) -> tuple[str, int, str]:
    """Build a signed, tamper-proof booking URL for a WhatsApp customer.
    Returns (url, timestamp, signature).
    """
    ts = current_time if current_time is not None else int(time.time())
    sig = generate_whatsapp_booking_signature(bot_id, phone, ts, secret)
    clean_phone = re.sub(r"[^\d]", "", phone)
    app_base = (base_url or DEFAULT_APP_URL).rstrip("/")
    booking_url = f"{app_base}/book/{bot_id}?session_id=wa:{clean_phone}&t={ts}&sig={sig}"
    return booking_url, ts, sig


async def send_whatsapp_message(
    phone_number_id: str,
    to: str,
    text: str,
    access_token: str,
    quick_replies: list[str] | None = None,
    api_version: str | None = None,
) -> bool:
    """Send an outbound text or interactive quick-reply message via Meta Cloud API."""
    if not (phone_number_id and to and access_token):
        logger.warning("Missing WhatsApp credentials (phone_id=%s, to=%s)", phone_number_id, to)
        return False

    version = api_version or WHATSAPP_API_VERSION
    url = f"https://graph.facebook.com/{version}/{phone_number_id}/messages"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }

    clean_to = re.sub(r"[^\d]", "", to)

    valid_buttons: list[str] = []
    if quick_replies and isinstance(quick_replies, list):
        for b in quick_replies:
            if isinstance(b, str) and b.strip():
                valid_buttons.append(b.strip()[:20])
            if len(valid_buttons) >= 3:
                break

    # Meta caps text bodies at 4096 UTF-8 characters. Split long grounded
    # product answers instead of silently truncating prices/links.
    chunks = [text[i:i + 4000] for i in range(0, len(text or ""), 4000)] or [""]
    all_sent = True
    for chunk_index, chunk in enumerate(chunks):
        use_buttons = bool(valid_buttons and chunk_index == len(chunks) - 1 and len(chunk) <= 1024)
        if use_buttons:
            payload: dict[str, Any] = {
                "messaging_product": "whatsapp",
                "recipient_type": "individual",
                "to": clean_to,
                "type": "interactive",
                "interactive": {
                    "type": "button",
                    "body": {"text": chunk},
                    "action": {
                        "buttons": [
                            {
                                "type": "reply",
                                "reply": {
                                    "id": f"btn_{i+1}",
                                    "title": btn_title,
                                },
                            }
                            for i, btn_title in enumerate(valid_buttons)
                        ]
                    },
                },
            }
        else:
            payload = {
                "messaging_product": "whatsapp",
                "recipient_type": "individual",
                "to": clean_to,
                "type": "text",
                "text": {"body": chunk},
            }

        delivered = False
        for attempt in range(3):
            try:
                async with httpx.AsyncClient(timeout=15) as client:
                    res = await client.post(url, headers=headers, json=payload)
                if res.status_code < 400:
                    delivered = True
                    break
                # Retry rate limits and transient Meta failures only.
                if res.status_code not in (408, 425, 429) and res.status_code < 500:
                    logger.error("Meta WhatsApp send failed (%s): %s", res.status_code, res.text)
                    break
                logger.warning("Meta WhatsApp transient send failure (%s), attempt %s", res.status_code, attempt + 1)
            except Exception:
                logger.exception("Meta WhatsApp send message network exception (attempt %s)", attempt + 1)
            if attempt < 2:
                await asyncio.sleep(0.25 * (2 ** attempt))
        all_sent = all_sent and delivered

    return all_sent


async def dispatch_whatsapp_booking_confirmation(
    bot: dict[str, Any],
    phone: str,
    formatted_time: str,
    meeting_link: str,
    attendee_email: str,
    attendee_name: str | None = None,
) -> bool:
    """Format and deliver an instant appointment confirmation message via WhatsApp."""
    phone_number_id = (
        (bot.get("whatsapp_phone_number_id") or "").strip()
        or WHATSAPP_PHONE_NUMBER_ID
    )
    access_token = (
        decrypt_secret((bot.get("whatsapp_access_token") or "").strip())
        or WHATSAPP_ACCESS_TOKEN
    )

    if not (phone_number_id and access_token):
        logger.warning(
            "Cannot send WhatsApp booking confirmation: missing phone_number_id or access_token for bot %s",
            bot.get("id"),
        )
        return False

    name_greeting = f"Hi {attendee_name.strip()},\n\n" if attendee_name and attendee_name.strip() else ""

    text = (
        f"✅ *Booking Confirmed!*\n\n"
        f"{name_greeting}"
        f"Your demo appointment is confirmed for:\n"
        f"📅 *{formatted_time}*\n\n"
        f"🔗 *Meeting Link:* {meeting_link}\n\n"
        f"A calendar invitation has been sent to *{attendee_email}*.\n"
        f"We look forward to speaking with you!"
    )

    return await send_whatsapp_message(
        phone_number_id=phone_number_id,
        to=phone,
        text=text,
        access_token=access_token,
    )
