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
        logger.warning("WhatsApp booking token has invalid timestamp")
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
        logger.warning("Missing WhatsApp credentials")
        return False

    version = api_version or WHATSAPP_API_VERSION
    # Keep the request host fixed and allow only Meta's numeric phone-id path
    # component; never interpolate an arbitrary URL supplied by a bot owner.
    phone_id_text = str(phone_number_id)
    if not phone_id_text.isdecimal() or not 5 <= len(phone_id_text) <= 32:
        logger.warning("Invalid WhatsApp phone number id supplied")
        return False
    version_text = str(version)
    version_parts = version_text[1:].split(".") if version_text.startswith("v") else []
    if len(version_parts) not in (1, 2) or not all(part.isdecimal() for part in version_parts):
        logger.warning("Invalid WhatsApp API version supplied")
        return False
    # Numeric reconstruction removes the original string from the request
    # target after validation; the host remains a fixed Meta endpoint.
    safe_phone_id = str(int(phone_id_text))
    safe_version = "v" + ".".join(str(int(part)) for part in version_parts)
    graph_url = httpx.URL("https://graph.facebook.com").join(
        f"/{safe_version}/{safe_phone_id}/messages"
    )
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
                    # The base host is a fixed Meta endpoint; the validated
                    # path is joined to it before the request is issued.
                    res = await client.post(graph_url, headers=headers, json=payload)
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


WHATSAPP_SERVICE_WINDOW_SECONDS = 24 * 3600  # 24 hours per Meta Business Messaging Policy

DEFAULT_APPROVED_TEMPLATES: list[dict[str, Any]] = [
    {
        "name": "customer_support_followup",
        "language": "en_US",
        "status": "APPROVED",
        "category": "UTILITY",
        "body": "Hi {{1}}, our support team has an update regarding your inquiry: {{2}}. Reply to this message anytime to continue chatting with us.",
        "param_labels": ["Customer Name", "Support Update / Message"],
    },
    {
        "name": "order_status_update",
        "language": "en_US",
        "status": "APPROVED",
        "category": "UTILITY",
        "body": "Hi {{1}}, regarding your order #{{2}}: {{3}}. Reply here if you need any further assistance.",
        "param_labels": ["Customer Name", "Order Number", "Status Details"],
    },
    {
        "name": "hello_world",
        "language": "en_US",
        "status": "APPROVED",
        "category": "UTILITY",
        "body": "Welcome and congratulations!! This message demonstrates your ability to send a WhatsApp message notification from the Cloud API, hosted by Meta.",
        "param_labels": [],
    },
]


def compute_service_window(
    last_user_message_at: str | float | int | None,
    now_ts: float | None = None,
) -> dict[str, Any]:
    """Compute the Meta 24-hour customer service window status from the last
    inbound user message timestamp.
    """
    now = float(now_ts) if now_ts is not None else time.time()
    if not last_user_message_at:
        return {
            "window_open": False,
            "requires_template": True,
            "remaining_seconds": 0,
            "expires_at": None,
            "last_user_message_at": None,
            "reason": "no_inbound_user_message",
        }

    from datetime import datetime, timezone

    parsed_ts: float | None = None
    iso_str: str | None = None
    if isinstance(last_user_message_at, (int, float)):
        parsed_ts = float(last_user_message_at)
        iso_str = datetime.fromtimestamp(parsed_ts, tz=timezone.utc).isoformat()
    elif isinstance(last_user_message_at, str):
        raw = last_user_message_at.strip()
        if raw:
            try:
                dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                parsed_ts = dt.timestamp()
                iso_str = dt.astimezone(timezone.utc).isoformat()
            except ValueError:
                parsed_ts = None

    if parsed_ts is None:
        return {
            "window_open": False,
            "requires_template": True,
            "remaining_seconds": 0,
            "expires_at": None,
            "last_user_message_at": None,
            "reason": "invalid_timestamp",
        }

    expires_ts = parsed_ts + WHATSAPP_SERVICE_WINDOW_SECONDS
    remaining = max(0, int(expires_ts - now))
    is_open = remaining > 0
    expires_iso = datetime.fromtimestamp(expires_ts, tz=timezone.utc).isoformat()

    return {
        "window_open": is_open,
        "requires_template": not is_open,
        "remaining_seconds": remaining,
        "expires_at": expires_iso,
        "last_user_message_at": iso_str,
        "reason": "open" if is_open else "expired_24h_window",
    }


async def list_whatsapp_templates(
    waba_id: str | None,
    access_token: str | None,
    api_version: str | None = None,
) -> list[dict[str, Any]]:
    """Fetch approved WhatsApp message templates (HSM) from Meta Graph API
    when waba_id and access_token are configured; otherwise return standard
    pre-approved utility templates so agents can always see and select templates.
    """
    if not (waba_id and access_token):
        return list(DEFAULT_APPROVED_TEMPLATES)

    waba_text = str(waba_id).strip()
    if not waba_text.isdecimal() or not 5 <= len(waba_text) <= 32:
        return list(DEFAULT_APPROVED_TEMPLATES)

    version = api_version or WHATSAPP_API_VERSION
    version_text = str(version)
    version_parts = version_text[1:].split(".") if version_text.startswith("v") else []
    if len(version_parts) not in (1, 2) or not all(part.isdecimal() for part in version_parts):
        return list(DEFAULT_APPROVED_TEMPLATES)

    safe_waba_id = str(int(waba_text))
    safe_version = "v" + ".".join(str(int(part)) for part in version_parts)
    graph_url = httpx.URL("https://graph.facebook.com").join(
        f"/{safe_version}/{safe_waba_id}/message_templates"
    )
    headers = {"Authorization": f"Bearer {access_token}"}

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            res = await client.get(graph_url, headers=headers, params={"limit": 50})
        if res.status_code < 400:
            payload = res.json() or {}
            items = payload.get("data") or []
            templates: list[dict[str, Any]] = []
            for item in items:
                if not isinstance(item, dict):
                    continue
                status = str(item.get("status") or "").upper()
                if status != "APPROVED":
                    continue
                body_text = ""
                for comp in item.get("components") or []:
                    if isinstance(comp, dict) and str(comp.get("type") or "").upper() == "BODY":
                        body_text = str(comp.get("text") or "")
                        break
                param_matches = re.findall(r"\{\{\s*(\d+)\s*\}\}", body_text)
                param_count = max((int(m) for m in param_matches), default=0)
                templates.append({
                    "name": str(item.get("name") or ""),
                    "language": str(item.get("language") or "en_US"),
                    "status": status,
                    "category": str(item.get("category") or "UTILITY"),
                    "body": body_text,
                    "param_labels": [f"Variable {{{{{i}}}}}" for i in range(1, param_count + 1)],
                })
            if templates:
                return templates
    except Exception:
        logger.warning("Failed to fetch WhatsApp templates from Meta Graph API; using defaults", exc_info=True)

    return list(DEFAULT_APPROVED_TEMPLATES)


async def send_whatsapp_template(
    phone_number_id: str,
    to: str,
    template_name: str,
    language_code: str,
    access_token: str,
    body_params: list[str] | None = None,
    api_version: str | None = None,
) -> bool:
    """Send a pre-approved Meta WhatsApp template (HSM) message to re-open a
    conversation outside the 24-hour customer service window.
    """
    if not (phone_number_id and to and template_name and access_token):
        logger.warning("Missing credentials or template_name for WhatsApp template send")
        return False

    version = api_version or WHATSAPP_API_VERSION
    phone_id_text = str(phone_number_id).strip()
    if not phone_id_text.isdecimal() or not 5 <= len(phone_id_text) <= 32:
        logger.warning("Invalid WhatsApp phone number id supplied for template send")
        return False
    version_text = str(version)
    version_parts = version_text[1:].split(".") if version_text.startswith("v") else []
    if len(version_parts) not in (1, 2) or not all(part.isdecimal() for part in version_parts):
        logger.warning("Invalid WhatsApp API version supplied for template send")
        return False

    safe_phone_id = str(int(phone_id_text))
    safe_version = "v" + ".".join(str(int(part)) for part in version_parts)
    graph_url = httpx.URL("https://graph.facebook.com").join(
        f"/{safe_version}/{safe_phone_id}/messages"
    )
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }

    clean_to = re.sub(r"[^\d]", "", to)
    clean_template = re.sub(r"[^a-zA-Z0-9_]", "", template_name.strip())
    clean_lang = re.sub(r"[^a-zA-Z0-9_\-]", "", (language_code or "en_US").strip()) or "en_US"

    template_obj: dict[str, Any] = {
        "name": clean_template,
        "language": {"code": clean_lang},
    }
    if body_params:
        template_obj["components"] = [
            {
                "type": "body",
                "parameters": [
                    {"type": "text", "text": str(p)[:1024]}
                    for p in body_params
                    if str(p).strip()
                ],
            }
        ]

    payload = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": clean_to,
        "type": "template",
        "template": template_obj,
    }

    for attempt in range(3):
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                res = await client.post(graph_url, headers=headers, json=payload)
            if res.status_code < 400:
                return True
            if res.status_code not in (408, 425, 429) and res.status_code < 500:
                logger.error("Meta WhatsApp template send failed (%s): %s", res.status_code, res.text)
                return False
            logger.warning("Meta WhatsApp transient template send failure (%s), attempt %s", res.status_code, attempt + 1)
        except Exception:
            logger.exception("Meta WhatsApp template send network exception (attempt %s)", attempt + 1)
        if attempt < 2:
            await asyncio.sleep(0.25 * (2 ** attempt))

    return False


_ORDER_CARD_MARKER = "[ORDER_CARD:"


def render_whatsapp_order_cards(reply: str) -> str:
    """Turn structured [ORDER_CARD:{...}] tokens into rich WhatsApp text messages."""
    import json as _json

    def render_order(card: object) -> str:
        if not isinstance(card, dict) or not (card.get("order_number") or card.get("order_id")):
            return ""

        def clean(value: object, limit: int = 240) -> str:
            return re.sub(r"\s+", " ", str(value or "")).strip()[:limit]

        order_num = clean(card.get("order_number") or card.get("order_id"), 40)
        status_label = clean(card.get("status_label") or card.get("status") or "Processing", 60)
        currency = clean(card.get("currency") or "USD", 12)
        total = clean(card.get("total"), 40)
        lines = [f"📦 *Order #{order_num}* — *{status_label}*"]
        if total:
            lines.append(f"Total: {currency} {total}")

        if card.get("is_split_shipment"):
            lines.append("⚠️ *Split Shipment:* Items are shipping in multiple packages.")
        if card.get("is_partial_refund"):
            refunded = clean(card.get("refunded_total"), 40)
            lines.append(f"⚠️ *Partial Refund Issued:* {currency} {refunded}")

        items = card.get("items")
        if isinstance(items, list) and items:
            item_strs = []
            for it in items[:5]:
                if isinstance(it, dict) and it.get("name"):
                    qty = it.get("quantity") or 1
                    item_strs.append(f"• {qty}× {clean(it.get('name'), 80)}")
            if item_strs:
                lines.append("Items:\n" + "\n".join(item_strs))

        tracking = card.get("tracking")
        if isinstance(tracking, list) and tracking:
            for trk in tracking[:4]:
                if not isinstance(trk, dict):
                    continue
                carrier = clean(trk.get("carrier") or "Carrier", 60)
                tnum = clean(trk.get("tracking_number"), 80)
                turl = clean(trk.get("tracking_url"), 500)
                if tnum:
                    lines.append(f"🚚 *{carrier}:* `{tnum}`")
                if re.match(r"^https://", turl, re.IGNORECASE):
                    lines.append(f"🔗 Track package: {turl}")

        return "\n".join(lines)

    source = reply or ""
    rendered: list[str] = []
    cursor = 0
    decoder = _json.JSONDecoder()
    while True:
        marker_start = source.find(_ORDER_CARD_MARKER, cursor)
        if marker_start < 0:
            rendered.append(source[cursor:])
            break
        rendered.append(source[cursor:marker_start])
        json_start = marker_start + len(_ORDER_CARD_MARKER)
        try:
            card, consumed = decoder.raw_decode(source[json_start:])
        except (TypeError, _json.JSONDecodeError):
            rendered.append(_ORDER_CARD_MARKER)
            cursor = json_start
            continue
        closing_index = json_start + consumed
        if closing_index >= len(source) or source[closing_index] != "]":
            rendered.append(_ORDER_CARD_MARKER)
            cursor = json_start
            continue
        rendered.append(render_order(card))
        cursor = closing_index + 1
    return "".join(rendered).strip()

