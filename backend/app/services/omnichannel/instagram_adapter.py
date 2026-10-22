"""Industrial-grade Meta Instagram DM & Facebook Messenger channel adapter.

Handles Meta Messenger Platform webhook normalization, cryptographic HMAC verification,
multimodal attachments, and outbound delivery with interactive quick-replies.
"""

from __future__ import annotations

import asyncio
import hashlib
import hmac
import logging
import re
from typing import Any, Optional

import httpx

from app.services.omnichannel.models import ChannelType, InboundMessage

logger = logging.getLogger("chatty.omnichannel.instagram")

META_GRAPH_URL = "https://graph.facebook.com"
DEFAULT_META_VERSION = "v21.0"


def verify_instagram_signature(raw_body: bytes, signature_header: str, app_secret: str) -> bool:
    """Validate Meta X-Hub-Signature-256 HMAC header against raw request body."""
    if not signature_header or not signature_header.startswith("sha256=") or not app_secret:
        return False
    expected = hmac.new(app_secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()
    actual = signature_header[7:].strip()
    return hmac.compare_digest(expected, actual)


def normalize_instagram_message(
    messaging_event: dict[str, Any],
    is_instagram: bool = True,
) -> Optional[InboundMessage]:
    """Parse a Meta Messenger / Instagram DM messaging event into InboundMessage."""
    sender = messaging_event.get("sender") or {}
    recipient = messaging_event.get("recipient") or {}
    sender_id = str(sender.get("id") or "").strip()
    recipient_id = str(recipient.get("id") or "").strip()

    if not sender_id or not recipient_id:
        return None

    channel = ChannelType.INSTAGRAM if is_instagram else ChannelType.MESSENGER
    prefix = "ig" if is_instagram else "fb"
    session_id = f"{prefix}:{sender_id}"

    msg = messaging_event.get("message") or {}
    postback = messaging_event.get("postback") or {}
    timestamp = int(messaging_event.get("timestamp") or 0)
    message_id = str(msg.get("mid") or postback.get("mid") or "")

    text = ""
    reply_id = None

    if postback:
        text = str(postback.get("title") or postback.get("payload") or "").strip()
        reply_id = str(postback.get("payload") or "")
    elif msg:
        quick_reply = msg.get("quick_reply") or {}
        if quick_reply:
            text = str(msg.get("text") or quick_reply.get("payload") or "").strip()
            reply_id = str(quick_reply.get("payload") or "")
        else:
            text = str(msg.get("text") or "").strip()

        # Check for media attachments if no text
        attachments = msg.get("attachments") or []
        if not text and attachments:
            att = attachments[0]
            att_type = att.get("type") or "media"
            payload = att.get("payload") or {}
            att_url = payload.get("url") or ""
            text = f"[{att_type} attachment: {att_url}]" if att_url else f"[{att_type} attachment]"

    return InboundMessage(
        channel=channel,
        sender_id=sender_id,
        recipient_id=recipient_id,
        session_id=session_id,
        message_id=message_id,
        text=text,
        interactive_reply_id=reply_id,
        timestamp=timestamp,
        raw=messaging_event,
    )


async def send_outbound_instagram(
    page_access_token: str,
    recipient_id: str,
    text: str,
    quick_replies: Optional[list[str]] = None,
    api_version: str = DEFAULT_META_VERSION,
) -> bool:
    """Send text or interactive quick-reply messages via Meta Graph API."""
    if not (page_access_token and recipient_id and text):
        logger.warning("Missing credentials or recipient for Instagram/Messenger send")
        return False

    url = f"{META_GRAPH_URL}/{api_version}/me/messages"
    headers = {
        "Authorization": f"Bearer {page_access_token}",
        "Content-Type": "application/json",
    }

    # Meta limits message body to 2000 chars for Messenger / Instagram DMs
    chunks = [text[i:i + 1900] for i in range(0, len(text), 1900)] or [text]

    valid_buttons: list[str] = []
    if quick_replies:
        for b in quick_replies:
            if isinstance(b, str) and b.strip():
                valid_buttons.append(b.strip()[:20])
            if len(valid_buttons) >= 10:
                break

    all_sent = True
    for index, chunk in enumerate(chunks):
        is_last = index == len(chunks) - 1
        msg_payload: dict[str, Any] = {"text": chunk}

        if is_last and valid_buttons:
            msg_payload["quick_replies"] = [
                {
                    "content_type": "text",
                    "title": btn,
                    "payload": btn,
                }
                for btn in valid_buttons
            ]

        body = {
            "recipient": {"id": recipient_id},
            "messaging_type": "RESPONSE",
            "message": msg_payload,
        }

        delivered = False
        for attempt in range(3):
            try:
                async with httpx.AsyncClient(timeout=15) as client:
                    res = await client.post(url, headers=headers, json=body)
                if res.status_code < 400:
                    delivered = True
                    break
                if res.status_code not in (408, 425, 429) and res.status_code < 500:
                    logger.error("Meta Instagram/Messenger send rejected (%s): %s", res.status_code, res.text)
                    break
                logger.warning("Meta Instagram transient failure (%s), attempt %s", res.status_code, attempt + 1)
            except Exception:
                logger.exception("Meta Instagram network exception on attempt %s", attempt + 1)

            if attempt < 2:
                await asyncio.sleep(0.25 * (2 ** attempt))

        all_sent = all_sent and delivered

    return all_sent
