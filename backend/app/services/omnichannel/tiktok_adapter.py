"""Industrial-grade TikTok Business Messaging channel adapter.

Handles TikTok Developer / Business Messaging webhooks, cryptographic HMAC-SHA256
signature verification (`TikTok-Signature` / `X-TikTok-Signature`), inbound DM
& interactive postback normalization, and outbound delivery with quick replies
and exponential-backoff retry.
"""

from __future__ import annotations

import asyncio
import hashlib
import hmac
import json
import logging
from typing import Any, Optional

import httpx

from app.core import ssrf
from app.services.omnichannel.models import ChannelType, InboundMessage

logger = logging.getLogger("chatty.omnichannel.tiktok")

TIKTOK_OPEN_API_SEND_URL = "https://open.tiktokapis.com/v2/business/message/send/"
TIKTOK_BUSINESS_API_SEND_URL = "https://business-api.tiktok.com/open_api/v1.3/business/message/send/"


def verify_tiktok_signature(raw_body: bytes, signature_header: str, client_secret: str) -> bool:
    """Validate TikTok webhook HMAC-SHA256 signature (`TikTok-Signature` or `X-TikTok-Signature`).

    Supports both TikTok v2 timestamped format (`t=<timestamp>,s=<hex_digest>`)
    where the signed string is `<timestamp>.<raw_body>`, and standard `sha256=<hex>`
    or raw hex HMAC-SHA256 over `raw_body`.
    """
    if not signature_header or not client_secret:
        return False

    secret_bytes = client_secret.strip().encode("utf-8")
    sig_raw = signature_header.strip()

    # Format 1: TikTok v2 "t=1698150000,s=abcdef..."
    if "t=" in sig_raw and "s=" in sig_raw:
        parts: dict[str, str] = {}
        for item in sig_raw.split(","):
            if "=" in item:
                k, v = item.split("=", 1)
                parts[k.strip()] = v.strip()
        ts = parts.get("t", "")
        sig_val = parts.get("s", "")
        if ts and sig_val:
            signed_payload = f"{ts}.".encode("utf-8") + raw_body
            expected_ts = hmac.new(secret_bytes, signed_payload, hashlib.sha256).hexdigest()
            if hmac.compare_digest(expected_ts.lower(), sig_val.lower()):
                return True
            # Also check raw body without dot separator (`f"{ts}{raw_body}"`) used by some TikTok Business webhooks
            signed_payload_nodot = ts.encode("utf-8") + raw_body
            expected_nodot = hmac.new(secret_bytes, signed_payload_nodot, hashlib.sha256).hexdigest()
            if hmac.compare_digest(expected_nodot.lower(), sig_val.lower()):
                return True

    # Format 2: "sha256=<hex>" or raw "<hex>"
    clean_sig = sig_raw[7:].strip() if sig_raw.lower().startswith("sha256=") else sig_raw
    expected_raw = hmac.new(secret_bytes, raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected_raw.lower(), clean_sig.lower())


async def download_tiktok_media(
    media_url: str,
    access_token: str = "",
    max_bytes: int = 20 * 1024 * 1024,
) -> tuple[Optional[bytes], Optional[str]]:
    """Download TikTok media binary (e.g. user DM image)."""
    if not media_url or not media_url.startswith(("http://", "https://")):
        return None, None
    safe_media_url = media_url.replace("\r", "").replace("\n", "")[:200]
    try:
        await ssrf.assert_safe_url_async(media_url)
    except Exception:
        logger.warning("Blocked unsafe TikTok media URL: %s", safe_media_url)
        return None, None
    headers = {"Authorization": f"Bearer {access_token}"} if access_token else {}
    try:
        async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
            resp = await ssrf.request_async(client, "GET", media_url, headers=headers)
            if resp.status_code in (401, 403) and headers:
                resp = await ssrf.request_async(client, "GET", media_url)
            if resp.status_code == 200 and len(resp.content) <= max_bytes:
                mime = resp.headers.get("content-type", "").split(";")[0].strip().lower()
                return resp.content, mime or "image/jpeg"
    except Exception:
        logger.warning("Failed to download TikTok media from %s", safe_media_url, exc_info=True)
    return None, None


def normalize_tiktok_message(
    payload: dict[str, Any],
    media_bytes: Optional[bytes] = None,
    media_mime: Optional[str] = None,
    media_filename: Optional[str] = None,
) -> Optional[InboundMessage]:
    """Parse a TikTok Business Messaging webhook payload into an InboundMessage."""
    if not isinstance(payload, dict):
        return None

    # Ignore echo or outbound delivery receipts
    event_name = str(
        payload.get("event")
        or payload.get("event_type")
        or (payload.get("data") or {}).get("event_type")
        or "im.message.receive"
    ).strip().lower()
    if any(ignore in event_name for ignore in ("read", "delivery", "echo", "status")):
        return None

    content_obj: dict[str, Any] = {}
    raw_content = payload.get("content")
    if isinstance(raw_content, str) and raw_content.strip():
        try:
            parsed = json.loads(raw_content)
            if isinstance(parsed, dict):
                content_obj = parsed
        except Exception:
            content_obj = {"text": raw_content.strip()}
    elif isinstance(raw_content, dict):
        content_obj = raw_content

    data_obj = payload.get("data") if isinstance(payload.get("data"), dict) else {}
    msg_obj = (
        data_obj.get("message")
        or content_obj.get("message")
        or payload.get("message")
        or {}
    )
    if not isinstance(msg_obj, dict):
        msg_obj = {"text": str(msg_obj)}

    # Check if echoes are flagged
    if msg_obj.get("is_echo") or data_obj.get("is_echo") or content_obj.get("is_echo"):
        return None

    from_user = (
        data_obj.get("from_user")
        or content_obj.get("from_user")
        or payload.get("from_user")
        or payload.get("sender")
        or {}
    )
    to_user = (
        data_obj.get("to_user")
        or content_obj.get("to_user")
        or payload.get("to_user")
        or payload.get("recipient")
        or {}
    )

    sender_id = str(
        (from_user.get("open_id") if isinstance(from_user, dict) else "")
        or (from_user.get("id") if isinstance(from_user, dict) else "")
        or content_obj.get("from_openid")
        or content_obj.get("sender_open_id")
        or data_obj.get("from_openid")
        or data_obj.get("sender_open_id")
        or data_obj.get("open_id")
        or payload.get("open_id")
        or payload.get("from_openid")
        or payload.get("sender_id")
        or ""
    ).strip()

    recipient_id = str(
        (to_user.get("open_id") if isinstance(to_user, dict) else "")
        or (to_user.get("id") if isinstance(to_user, dict) else "")
        or payload.get("business_id")
        or payload.get("user_openid")
        or content_obj.get("to_openid")
        or content_obj.get("business_id")
        or data_obj.get("to_openid")
        or data_obj.get("business_id")
        or ""
    ).strip()

    if not sender_id:
        return None

    msg_id = str(
        msg_obj.get("msg_id")
        or msg_obj.get("message_id")
        or msg_obj.get("id")
        or content_obj.get("msg_id")
        or data_obj.get("msg_id")
        or payload.get("msg_id")
        or payload.get("log_id")
        or ""
    ).strip()

    text = ""
    reply_id = None

    # Extract text or quick reply postback
    postback = (
        msg_obj.get("postback")
        or content_obj.get("postback")
        or data_obj.get("postback")
        or payload.get("postback")
    )
    if isinstance(postback, dict):
        text = str(postback.get("title") or postback.get("payload") or "").strip()
        reply_id = str(postback.get("payload") or text).strip()

    if not text:
        raw_text = msg_obj.get("text") or content_obj.get("text") or data_obj.get("text") or payload.get("text")
        if isinstance(raw_text, dict):
            text = str(raw_text.get("body") or raw_text.get("text") or "").strip()
        elif raw_text is not None:
            text = str(raw_text).strip()

    if not reply_id and isinstance(msg_obj.get("quick_reply"), dict):
        reply_id = str(msg_obj["quick_reply"].get("payload") or "").strip() or None

    # Media attachments fallback
    media_urls: list[str] = []
    media_url = str(
        msg_obj.get("media_url")
        or msg_obj.get("image_url")
        or msg_obj.get("video_url")
        or content_obj.get("media_url")
        or ""
    ).strip()
    if media_url:
        media_urls.append(media_url)

    msg_type = str(msg_obj.get("type") or content_obj.get("msg_type") or data_obj.get("msg_type") or "text").lower()
    if not text and (media_urls or msg_type in ("image", "video", "sticker", "share_video")):
        text = f"[TikTok {msg_type} attachment]"

    if not text:
        return None

    timestamp = int(
        payload.get("create_time")
        or data_obj.get("create_time")
        or content_obj.get("create_time")
        or payload.get("timestamp")
        or 0
    )

    return InboundMessage(
        channel=ChannelType.TIKTOK,
        sender_id=sender_id,
        recipient_id=recipient_id or "tiktok_business",
        session_id=f"tt:{sender_id}",
        message_id=msg_id,
        text=text,
        media_bytes=media_bytes,
        media_mime=media_mime,
        media_filename=media_filename,
        interactive_reply_id=reply_id,
        timestamp=timestamp,
        raw=payload,
    )


async def send_outbound_tiktok(
    access_token: str,
    business_id: str,
    recipient_id: str,
    text: str,
    quick_replies: Optional[list[str]] = None,
) -> bool:
    """Deliver an outbound direct message via TikTok Business Messaging API."""
    if not (access_token and recipient_id and text):
        logger.warning("Missing credentials or recipient_id for TikTok outbound dispatch")
        return False

    headers = {
        "Authorization": f"Bearer {access_token}",
        "Access-Token": access_token,
        "Content-Type": "application/json",
    }

    # TikTok Business DM caps single messages at 1,000 UTF-8 characters
    chunks = [text[i:i + 950] for i in range(0, len(text), 950)] or [text]
    clean_buttons = [b.strip()[:20] for b in (quick_replies or []) if b and b.strip()][:3]

    all_sent = True
    for index, chunk in enumerate(chunks):
        is_last = index == len(chunks) - 1
        payload: dict[str, Any] = {
            "business_id": business_id or "me",
            "recipient": {"open_id": recipient_id},
            "recipient_open_id": recipient_id,
            "message_type": "TEXT",
            "text": {"body": chunk},
            "message": {"text": chunk},
        }
        if is_last and clean_buttons:
            payload["quick_replies"] = [
                {
                    "content_type": "text",
                    "title": label,
                    "payload": f"TIKTOK_QR_{idx + 1}_{label.upper().replace(' ', '_')}",
                }
                for idx, label in enumerate(clean_buttons)
            ]

        sent = False
        for attempt in range(3):
            try:
                async with httpx.AsyncClient(timeout=15.0) as client:
                    resp = await client.post(TIKTOK_OPEN_API_SEND_URL, headers=headers, json=payload)
                if resp.status_code < 300:
                    sent = True
                    break
                if resp.status_code in (429, 500, 502, 503, 504) and attempt < 2:
                    await asyncio.sleep(0.6 * (2 ** attempt))
                    continue
                logger.warning("TikTok send failed (%d): %s", resp.status_code, resp.text[:300])
                break
            except httpx.HTTPError as exc:
                logger.warning("TikTok network error (attempt %d): %s", attempt + 1, exc)
                if attempt < 2:
                    await asyncio.sleep(0.6 * (2 ** attempt))

        if not sent:
            all_sent = False

    return all_sent
