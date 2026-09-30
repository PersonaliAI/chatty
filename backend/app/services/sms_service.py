"""Fail-closed Twilio SMS delivery for consented campaign jobs."""

from __future__ import annotations

import asyncio
import logging
import os
import re

import httpx

logger = logging.getLogger("chatty.sms")

_E164 = re.compile(r"^\+[1-9]\d{7,14}$")
_TWILIO_URL = "https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Messages.json"


def _settings() -> tuple[str, str, str]:
    """Read settings at delivery time to support rotated runtime secrets."""
    return (
        os.environ.get("TWILIO_ACCOUNT_SID", "").strip(),
        os.environ.get("TWILIO_AUTH_TOKEN", "").strip(),
        os.environ.get("TWILIO_FROM_NUMBER", "").strip(),
    )


async def send_campaign_sms(*, to: str, body: str) -> bool:
    """Send one bounded, E.164 SMS message through Twilio.

    Caller-owned consent, recipient identity, quiet-hours, frequency-cap, and
    retry/DLQ policies are enforced in the job worker. This boundary verifies
    only provider readiness and transport outcome, never logs credentials or
    message content.
    """
    account_sid, auth_token, from_number = _settings()
    if not (account_sid and auth_token and from_number):
        raise RuntimeError("sms_provider_not_configured")
    clean_to = str(to or "").strip()
    if not _E164.fullmatch(clean_to) or not _E164.fullmatch(from_number):
        raise ValueError("sms campaign requires E.164 recipient and sender numbers")
    text = str(body or "").strip()
    if not text:
        raise ValueError("sms campaign message is required")
    # Twilio supports longer multipart messages, but bound one job to keep
    # retries, accounting, and operator previews deterministic.
    if len(text) > 1_600:
        raise ValueError("sms campaign message exceeds 1600 characters")

    url = _TWILIO_URL.format(account_sid=account_sid)
    for attempt in range(3):
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                response = await client.post(
                    url,
                    data={"To": clean_to, "From": from_number, "Body": text},
                    auth=(account_sid, auth_token),
                )
            if response.status_code < 400:
                return True
            if response.status_code not in {408, 425, 429} and response.status_code < 500:
                logger.error("Twilio SMS rejected status=%s", response.status_code)
                return False
            logger.warning("Twilio SMS transient failure status=%s attempt=%s", response.status_code, attempt + 1)
        except httpx.HTTPError:
            logger.exception("Twilio SMS transport failure attempt=%s", attempt + 1)
        if attempt < 2:
            await asyncio.sleep(0.25 * (2 ** attempt))
    return False
