"""Industrial-grade Two-Way Email Support channel adapter.

Handles inbound email webhooks (Resend Inbound, Postmark, SendGrid), RFC-822 threading,
quoted text stripping, and outbound transactional AI responses with In-Reply-To headers.
"""

from __future__ import annotations

import asyncio
import email.utils
import hmac
import logging
from html.parser import HTMLParser
from typing import Any, Optional

import httpx

from app.services.omnichannel.models import ChannelType, InboundMessage

logger = logging.getLogger("chatty.omnichannel.email")

RESEND_EMAILS_URL = "https://api.resend.com/emails"


class _HTMLTextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.parts: list[str] = []

    def handle_data(self, data: str) -> None:
        self.parts.append(data)


def _strip_html(html_str: str) -> str:
    try:
        parser = _HTMLTextExtractor()
        parser.feed(html_str)
        return " ".join("".join(parser.parts).split()).strip()
    except Exception:
        return html_str


def verify_email_webhook_secret(token_header: str, expected_secret: str) -> bool:
    """Validate webhook secret authorization header."""
    if not (token_header and expected_secret):
        return False
    clean_token = token_header.replace("Bearer ", "").strip()
    return hmac.compare_digest(clean_token, expected_secret.strip())


def clean_email_body(text: str) -> str:
    """Strip quoted reply text and signature dividers from inbound email body."""
    if not text:
        return ""

    lines = text.splitlines()
    clean_lines = []
    for line in lines:
        stripped = line.strip()
        # Common email quote indicators
        if stripped.startswith(">"):
            continue
        lower_line = stripped.lower()
        if lower_line.startswith("on ") and lower_line.endswith("wrote:"):
            break
        if stripped in ("--", "---", "________________________________"):
            break
        clean_lines.append(line)

    return "\n".join(clean_lines).strip()


def extract_email_media(payload: dict[str, Any]) -> tuple[Optional[bytes], Optional[str], Optional[str]]:
    """Extract image attachment from Resend Inbound, Postmark, or SendGrid payload."""
    import base64
    attachments = (
        payload.get("attachments")
        or payload.get("Attachments")
        or []
    )
    if not isinstance(attachments, list):
        return None, None, None

    for att in attachments:
        if not isinstance(att, dict):
            continue
        filename = str(att.get("filename") or att.get("Name") or att.get("name") or "attachment.jpg")
        mime = str(att.get("content_type") or att.get("ContentType") or att.get("type") or "").split(";")[0].strip().lower()
        if not mime and filename:
            ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
            if ext in ("jpg", "jpeg"):
                mime = "image/jpeg"
            elif ext == "png":
                mime = "image/png"
            elif ext == "webp":
                mime = "image/webp"

        if mime and not mime.startswith("image/"):
            continue

        # Check for base64 content
        content_raw = att.get("content") or att.get("Content") or att.get("data")
        if isinstance(content_raw, str) and content_raw.strip():
            try:
                data = base64.b64decode(content_raw.strip())
                if len(data) <= 20 * 1024 * 1024:
                    return data, mime or "image/jpeg", filename
            except Exception:
                pass

        # Check for download URL
        att_url = att.get("url") or att.get("download_url") or att.get("Path")
        if isinstance(att_url, str) and att_url.startswith(("http://", "https://")):
            try:
                with httpx.Client(timeout=10, follow_redirects=True) as client:
                    resp = client.get(att_url)
                    if resp.status_code == 200 and len(resp.content) <= 20 * 1024 * 1024:
                        return resp.content, mime or resp.headers.get("content-type", "image/jpeg"), filename
            except Exception:
                pass

    return None, None, None


def normalize_email_message(
    payload: dict[str, Any],
    media_bytes: Optional[bytes] = None,
    media_mime: Optional[str] = None,
    media_filename: Optional[str] = None,
) -> Optional[InboundMessage]:
    """Parse an inbound email webhook payload into InboundMessage."""
    raw_from = str(payload.get("from") or payload.get("sender") or "").strip()
    raw_to = payload.get("to") or payload.get("recipient") or ""
    to_str = str(raw_to[0] if isinstance(raw_to, list) and raw_to else raw_to).strip()

    # Parse address: "First Last <user@example.com>" -> "user@example.com"
    _, sender_email = email.utils.parseaddr(raw_from)
    sender_email = sender_email.strip().lower()
    _, recipient_email = email.utils.parseaddr(to_str)
    recipient_email = recipient_email.strip().lower()

    if not sender_email:
        return None

    subject = str(payload.get("subject") or "Support Request").strip()
    raw_text = str(payload.get("text") or payload.get("plain") or "").strip()

    # If no plain text, fall back to safe html tag strip
    if not raw_text and payload.get("html"):
        raw_text = _strip_html(str(payload["html"]))

    body_text = clean_email_body(raw_text)
    full_text = f"Subject: {subject}\n\n{body_text}" if subject else body_text

    msg_id = str(payload.get("message_id") or payload.get("id") or "")
    in_reply_to = str(payload.get("in_reply_to") or "")

    session_id = f"email:{sender_email}"

    if media_bytes is None:
        mb, mm, mf = extract_email_media(payload)
        media_bytes, media_mime, media_filename = mb, mm, mf

    return InboundMessage(
        channel=ChannelType.EMAIL,
        sender_id=sender_email,
        recipient_id=recipient_email or "support",
        session_id=session_id,
        message_id=msg_id,
        text=full_text,
        media_bytes=media_bytes,
        media_mime=media_mime,
        media_filename=media_filename,
        raw={
            "subject": subject,
            "message_id": msg_id,
            "in_reply_to": in_reply_to,
            "original_from": raw_from,
        },
    )


async def send_outbound_email(
    api_key: str,
    from_address: str,
    to_address: str,
    subject: str,
    text_content: str,
    html_content: Optional[str] = None,
    in_reply_to: Optional[str] = None,
) -> bool:
    """Dispatch an email reply via Resend API with proper threading headers."""
    if not (api_key and from_address and to_address and text_content):
        logger.warning("Missing required fields for outbound email dispatch")
        return False

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    clean_subject = subject if subject.lower().startswith("re:") else f"Re: {subject}"

    payload: dict[str, Any] = {
        "from": from_address,
        "to": [to_address],
        "subject": clean_subject,
        "text": text_content,
    }

    if html_content:
        payload["html"] = html_content

    if in_reply_to:
        payload["headers"] = {
            "In-Reply-To": in_reply_to,
            "References": in_reply_to,
        }

    for attempt in range(3):
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                res = await client.post(RESEND_EMAILS_URL, headers=headers, json=payload)
            if res.status_code < 400:
                return True
            if res.status_code not in (408, 425, 429) and res.status_code < 500:
                logger.error("Resend email dispatch rejected (%s): %s", res.status_code, res.text)
                return False
            logger.warning("Resend email dispatch transient failure (%s), attempt %s", res.status_code, attempt + 1)
        except Exception:
            logger.exception("Resend email network exception on attempt %s", attempt + 1)

        if attempt < 2:
            await asyncio.sleep(0.25 * (2 ** attempt))

    return False
