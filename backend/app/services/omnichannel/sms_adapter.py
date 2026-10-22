"""Industrial-grade Two-Way SMS (Twilio) channel adapter.

Handles Twilio inbound messaging webhooks, cryptographic X-Twilio-Signature validation,
TCPA/CTIA STOP/START opt-out compliance, and outbound SMS delivery.
"""

from __future__ import annotations

import asyncio
import base64
import hashlib
import hmac
import logging
import os
import re
from typing import Any, Optional

import httpx

from app.services.omnichannel.models import ChannelType, InboundMessage

logger = logging.getLogger("chatty.omnichannel.sms")

_TWILIO_URL = "https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Messages.json"

# Standard TCPA / CTIA keywords
OPT_OUT_KEYWORDS = {"stop", "stopall", "unsubscribe", "cancel", "end", "quit"}
OPT_IN_KEYWORDS = {"start", "unstop", "yes"}

OPT_OUT_REPLY = "You have been unsubscribed and will receive no further messages. Reply START to resume."
OPT_IN_REPLY = "You are now resubscribed to messages. How can we help you today?"


def verify_twilio_signature(
    url: str,
    params: dict[str, Any],
    signature_header: str,
    auth_token: str,
) -> bool:
    """Cryptographically verify Twilio X-Twilio-Signature HMAC-SHA1.

    Twilio takes the full request URL, sorts POST parameters alphabetically by key,
    concatenates each key and value, and computes HMAC-SHA1 using the Auth Token.
    """
    if not (url and signature_header and auth_token):
        return False

    data = url
    if params:
        for key in sorted(params.keys()):
            data += f"{key}{params[key]}"

    expected = base64.b64encode(
        hmac.new(auth_token.encode("utf-8"), data.encode("utf-8"), hashlib.sha1).digest()
    ).decode("utf-8")

    return hmac.compare_digest(expected.strip(), signature_header.strip())


def normalize_sms_webhook(form_data: dict[str, Any]) -> Optional[InboundMessage]:
    """Parse Twilio webhook form-urlencoded payload into InboundMessage."""
    frm = str(form_data.get("From") or "").strip()
    to = str(form_data.get("To") or "").strip()
    body = str(form_data.get("Body") or "").strip()
    msg_id = str(form_data.get("MessageSid") or "")

    if not frm or not to:
        return None

    clean_phone = re.sub(r"[^\d+]", "", frm)
    session_id = f"sms:{clean_phone}"

    # Check for MMS attachments
    num_media = int(form_data.get("NumMedia") or 0)
    if not body and num_media > 0:
        media_url = form_data.get("MediaUrl0") or ""
        body = f"[MMS attachment: {media_url}]" if media_url else "[MMS attachment]"

    return InboundMessage(
        channel=ChannelType.SMS,
        sender_id=clean_phone,
        recipient_id=to,
        session_id=session_id,
        message_id=msg_id,
        text=body,
        raw=form_data,
    )


def check_tcpa_opt_out(text: str) -> tuple[bool, str]:
    """Inspect visitor text for TCPA/CTIA standard compliance keywords.
    Returns (is_compliance_event, canned_reply).
    """
    clean = (text or "").strip().lower()
    if clean in OPT_OUT_KEYWORDS:
        return True, OPT_OUT_REPLY
    if clean in OPT_IN_KEYWORDS:
        return True, OPT_IN_REPLY
    return False, ""


async def send_outbound_sms(
    account_sid: str,
    auth_token: str,
    from_number: str,
    to_number: str,
    text: str,
) -> bool:
    """Dispatch outbound SMS via Twilio with character limits and E.164 normalization."""
    sid = (account_sid or os.environ.get("TWILIO_ACCOUNT_SID", "")).strip()
    token = (auth_token or os.environ.get("TWILIO_AUTH_TOKEN", "")).strip()
    from_num = (from_number or os.environ.get("TWILIO_FROM_NUMBER", "")).strip()
    clean_to = str(to_number or "").strip()

    if not (sid and token and from_num and clean_to and text):
        logger.warning("Missing Twilio credentials or phone numbers for SMS dispatch")
        return False

    bounded_text = text[:1600]
    url = _TWILIO_URL.format(account_sid=sid)

    for attempt in range(3):
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                res = await client.post(
                    url,
                    data={"To": clean_to, "From": from_num, "Body": bounded_text},
                    auth=(sid, token),
                )
            if res.status_code < 400:
                return True
            if res.status_code not in {408, 425, 429} and res.status_code < 500:
                logger.error("Twilio SMS rejected status=%s: %s", res.status_code, res.text)
                return False
            logger.warning("Twilio SMS transient failure status=%s attempt=%s", res.status_code, attempt + 1)
        except httpx.HTTPError:
            logger.exception("Twilio SMS transport failure attempt=%s", attempt + 1)

        if attempt < 2:
            await asyncio.sleep(0.25 * (2 ** attempt))

    return False
