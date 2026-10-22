"""Industrial-grade Meta WhatsApp Cloud API channel adapter."""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
import re
from typing import Any, Optional

from app.services.omnichannel.models import (
    ChannelType,
    CustomerServiceWindowState,
    InboundMessage,
    OutboundMessage,
)
from app.services.whatsapp_service import (
    compute_service_window,
    list_whatsapp_templates,
    render_whatsapp_order_cards,
    send_whatsapp_message,
    send_whatsapp_template,
)

logger = logging.getLogger("chatty.omnichannel.whatsapp")


def verify_meta_signature(raw_body: bytes, signature_header: str, app_secret: str) -> bool:
    """Validate Meta x-hub-signature-256 header against the raw request body."""
    if not signature_header or not signature_header.startswith("sha256="):
        return False
    expected = hmac.new(app_secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()
    actual = signature_header[7:].strip()
    return hmac.compare_digest(expected, actual)


def normalize_meta_message(
    val_metadata: dict[str, Any],
    msg: dict[str, Any],
    media_bytes: Optional[bytes] = None,
    media_mime: Optional[str] = None,
    media_filename: Optional[str] = None,
) -> Optional[InboundMessage]:
    """Parse a Meta Cloud API message object into a normalized InboundMessage."""
    frm = str(msg.get("from") or "").strip()
    pnid = str((val_metadata or {}).get("phone_number_id") or "").strip()
    msg_id = str(msg.get("id") or "")
    msg_type = str(msg.get("type") or "text")
    ts = int(msg.get("timestamp") or 0)

    if not frm or not pnid:
        return None

    session_id = f"wa:{frm}"
    text = ""
    reply_id = None

    if msg_type == "text":
        text = str((msg.get("text") or {}).get("body") or "").strip()
    elif msg_type == "interactive":
        interactive = msg.get("interactive") or {}
        btn_reply = interactive.get("button_reply") or {}
        list_reply = interactive.get("list_reply") or {}
        text = str(btn_reply.get("title") or list_reply.get("title") or "").strip()
        reply_id = str(btn_reply.get("id") or list_reply.get("id") or "")
    elif msg_type == "location":
        loc = msg.get("location") or {}
        lat, lon = loc.get("latitude"), loc.get("longitude")
        name = loc.get("name") or "Shared Location"
        text = f"📍 {name}: https://maps.google.com/?q={lat},{lon}"
    elif msg_type == "button":
        button_payload = msg.get("button") or {}
        text = str(button_payload.get("text") or "").strip()
        reply_id = str(button_payload.get("payload") or "")
    elif msg_type in ("audio", "voice", "image", "document"):
        media_obj = msg.get("audio") or msg.get("voice") or msg.get("image") or msg.get("document") or {}
        text = str(media_obj.get("caption") or "").strip()

    return InboundMessage(
        channel=ChannelType.WHATSAPP,
        sender_id=frm,
        recipient_id=pnid,
        session_id=session_id,
        message_id=msg_id,
        text=text,
        media_bytes=media_bytes,
        media_mime=media_mime,
        media_filename=media_filename,
        interactive_reply_id=reply_id,
        timestamp=ts,
        raw=msg,
    )


def format_whatsapp_reply(reply: str) -> str:
    """Format rich structured tokens (order cards, product cards) into WhatsApp format."""
    rendered = render_whatsapp_order_cards(reply)
    # Also render any product card tokens
    rendered = _render_whatsapp_product_cards(rendered)
    return rendered.strip()


def _render_whatsapp_product_cards(reply: str) -> str:
    """Turn structured [PRODUCT_CARD:{...}] tokens into readable WhatsApp messages."""
    product_card_marker = "[PRODUCT_CARD:"
    if product_card_marker not in (reply or ""):
        return reply or ""

    def render_card(card: Any) -> str:
        if not isinstance(card, dict) or not card.get("title"):
            return ""
        title = str(card.get("title") or "").strip()[:80]
        price = str(card.get("price") or "").strip()
        currency = str(card.get("currency") or "USD").strip()
        url = str(card.get("url") or "").strip()
        stock = card.get("in_stock")
        lines = [f"🛍️ *{title}*"]
        if price:
            lines.append(f"Price: {currency} {price}")
        if stock is not None:
            lines.append("Status: " + ("In Stock ✅" if stock else "Out of Stock ❌"))
        if url and url.startswith("http"):
            lines.append(f"🔗 View: {url}")
        return "\n".join(lines)

    source = reply or ""
    rendered_parts: list[str] = []
    cursor = 0
    decoder = json.JSONDecoder()
    while True:
        idx = source.find(product_card_marker, cursor)
        if idx < 0:
            rendered_parts.append(source[cursor:])
            break
        rendered_parts.append(source[cursor:idx])
        json_start = idx + len(product_card_marker)
        try:
            card, consumed = decoder.raw_decode(source[json_start:])
        except Exception:
            rendered_parts.append(product_card_marker)
            cursor = json_start
            continue
        close_idx = json_start + consumed
        if close_idx >= len(source) or source[close_idx] != "]":
            rendered_parts.append(product_card_marker)
            cursor = json_start
            continue
        rendered_parts.append(render_card(card))
        cursor = close_idx + 1

    return "".join(rendered_parts).strip()


async def send_outbound_whatsapp(
    phone_number_id: str,
    to: str,
    text: str,
    access_token: str,
    quick_replies: Optional[list[str]] = None,
    template_name: Optional[str] = None,
    template_params: Optional[list[str]] = None,
    language_code: str = "en_US",
) -> bool:
    """Send outbound message or template through Meta WhatsApp Cloud API."""
    if template_name:
        return await send_whatsapp_template(
            phone_number_id=phone_number_id,
            to=to,
            template_name=template_name,
            language_code=language_code,
            access_token=access_token,
            body_params=template_params,
        )

    return await send_whatsapp_message(
        phone_number_id=phone_number_id,
        to=to,
        text=text,
        access_token=access_token,
        quick_replies=quick_replies,
    )
