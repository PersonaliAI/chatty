"""Industrial-grade Telegram Bot API channel adapter.

Handles Telegram webhook updates, secret token validation, callback queries,
and outbound delivery with rich inline keyboards and Markdown formatting.
"""

from __future__ import annotations

import asyncio
import hmac
import logging
import re
from typing import Any, Optional

import httpx

from app.services.omnichannel.models import ChannelType, InboundMessage

logger = logging.getLogger("chatty.omnichannel.telegram")

TELEGRAM_API_BASE = "https://api.telegram.org"


def verify_telegram_secret(secret_token_header: str, expected_secret: str) -> bool:
    """Validate Telegram X-Telegram-Bot-Api-Secret-Token header."""
    if not secret_token_header or not expected_secret:
        return False
    return hmac.compare_digest(secret_token_header.strip(), expected_secret.strip())


def normalize_telegram_update(update: dict[str, Any]) -> Optional[InboundMessage]:
    """Parse a Telegram Update JSON object into InboundMessage."""
    callback_query = update.get("callback_query")
    message = update.get("message") or update.get("edited_message")

    chat_id = None
    sender_id = None
    msg_id = ""
    text = ""
    reply_id = None
    timestamp = 0

    if callback_query:
        sender = callback_query.get("from") or {}
        chat = (callback_query.get("message") or {}).get("chat") or {}
        chat_id = str(chat.get("id") or sender.get("id") or "").strip()
        sender_id = str(sender.get("id") or chat_id).strip()
        msg_id = str(callback_query.get("id") or "")
        text = str(callback_query.get("data") or "").strip()
        reply_id = text
    elif message:
        chat = message.get("chat") or {}
        sender = message.get("from") or {}
        chat_id = str(chat.get("id") or sender.get("id") or "").strip()
        sender_id = str(sender.get("id") or chat_id).strip()
        msg_id = str(message.get("message_id") or "")
        timestamp = int(message.get("date") or 0)
        text = str(message.get("text") or message.get("caption") or "").strip()

        # Handle location
        if not text and message.get("location"):
            loc = message["location"]
            text = f"📍 Location: https://maps.google.com/?q={loc.get('latitude')},{loc.get('longitude')}"
        elif not text and (message.get("photo") or message.get("document") or message.get("voice")):
            media_type = "voice" if message.get("voice") else "photo" if message.get("photo") else "document"
            text = f"[{media_type} attachment]"

    if not chat_id:
        return None

    session_id = f"tg:{chat_id}"

    return InboundMessage(
        channel=ChannelType.TELEGRAM,
        sender_id=chat_id,
        recipient_id="bot",
        session_id=session_id,
        message_id=msg_id,
        text=text,
        interactive_reply_id=reply_id,
        timestamp=timestamp,
        raw=update,
    )


def format_telegram_markdown(text: str) -> str:
    """Escapes underscores in URLs so Telegram Markdown v1 parser doesn't
    treat them as italic tags (which corrupts 'session_id=' into 'sessionid=')."""
    if not text:
        return ""
    def _escape_url(match):
        return match.group(0).replace("_", r"\_")
    return re.sub(r"https?://[^\s)]+", _escape_url, text)


async def send_outbound_telegram(
    bot_token: str,
    chat_id: str | int,
    text: str,
    inline_buttons: Optional[list[dict[str, str]]] = None,
    quick_replies: Optional[list[str]] = None,
) -> bool:
    """Deliver a text message or inline interactive buttons via Telegram Bot API."""
    if not (bot_token and chat_id and text):
        logger.warning("Missing credentials or chat_id for Telegram outbound dispatch")
        return False

    url = f"{TELEGRAM_API_BASE}/bot{bot_token}/sendMessage"

    formatted_text = format_telegram_markdown(text)
    # Telegram caps messages at 4096 UTF-8 characters
    chunks = [formatted_text[i:i + 4000] for i in range(0, len(formatted_text), 4000)] or [formatted_text]

    reply_markup: dict[str, Any] = {}
    if inline_buttons:
        # Array of button rows: [[{"text": "...", "url": "..."}]]
        buttons = []
        for btn in inline_buttons:
            if btn.get("url"):
                buttons.append([{"text": btn["text"][:30], "url": btn["url"]}])
            elif btn.get("callback_data"):
                buttons.append([{"text": btn["text"][:30], "callback_data": btn["callback_data"][:64]}])
        if buttons:
            reply_markup["inline_keyboard"] = buttons
    elif quick_replies:
        reply_markup["keyboard"] = [[{"text": b[:30]} for b in quick_replies[:3]]]
        reply_markup["resize_keyboard"] = True
        reply_markup["one_time_keyboard"] = True

    all_sent = True
    for index, chunk in enumerate(chunks):
        is_last = index == len(chunks) - 1
        payload: dict[str, Any] = {
            "chat_id": chat_id,
            "text": chunk,
            "parse_mode": "Markdown",
            "disable_web_page_preview": False,
        }
        if is_last and reply_markup:
            payload["reply_markup"] = reply_markup

        delivered = False
        for attempt in range(3):
            try:
                async with httpx.AsyncClient(timeout=15) as client:
                    res = await client.post(url, json=payload)
                if res.status_code < 400:
                    delivered = True
                    break
                # If markdown parsing fails due to unmatched syntax, retry without parse_mode
                if res.status_code == 400 and "parse entities" in res.text.lower():
                    payload.pop("parse_mode", None)
                    async with httpx.AsyncClient(timeout=10) as client:
                        retry_res = await client.post(url, json=payload)
                    if retry_res.status_code < 400:
                        delivered = True
                        break
                if res.status_code not in (408, 425, 429) and res.status_code < 500:
                    logger.error("Telegram send rejected (%s): %s", res.status_code, res.text)
                    break
                logger.warning("Telegram transient send failure (%s), attempt %s", res.status_code, attempt + 1)
            except Exception:
                logger.exception("Telegram network exception on attempt %s", attempt + 1)

            if attempt < 2:
                await asyncio.sleep(0.25 * (2 ** attempt))

        all_sent = all_sent and delivered

    return all_sent
