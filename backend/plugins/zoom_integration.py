"""Zoom Server-to-Server OAuth — real meeting creation for bots configured
with meeting_provider="zoom".

Unlike Google/Microsoft (per-user OAuth, tokens stored per connected
account), Zoom Server-to-Server OAuth is a single backend-wide credential
set once via ZOOM_ACCOUNT_ID/ZOOM_CLIENT_ID/ZOOM_CLIENT_SECRET — there's no
per-user "connect your Zoom account" flow, matching the dashboard's own
"Zoom has no in-app connect flow (backend-configured credentials)" design.
Meetings are created under the Zoom account those credentials belong to.

Docs: https://developers.zoom.us/docs/internal-apps/s2s-oauth/
"""

from __future__ import annotations

import logging
import os
import time
from typing import Any, Optional

import httpx

logger = logging.getLogger("chatty.zoom")

ZOOM_TOKEN_URL = "https://zoom.us/oauth/token"
ZOOM_API_BASE = "https://api.zoom.us/v2"

# In-process cache for the S2S access token — Zoom's tokens last ~1hr, and
# minting a fresh one on every meeting-creation call would be wasteful and
# adds latency to every booking. Refetched whenever expired or on first use.
_token_cache: dict[str, Any] = {"access_token": None, "expires_at": 0.0}


def zoom_configured() -> bool:
    return bool(
        os.environ.get("ZOOM_ACCOUNT_ID")
        and os.environ.get("ZOOM_CLIENT_ID")
        and os.environ.get("ZOOM_CLIENT_SECRET")
    )


async def _get_access_token() -> str:
    now = time.time()
    if _token_cache["access_token"] and now < _token_cache["expires_at"]:
        return _token_cache["access_token"]

    account_id = os.environ["ZOOM_ACCOUNT_ID"]
    client_id = os.environ["ZOOM_CLIENT_ID"]
    client_secret = os.environ["ZOOM_CLIENT_SECRET"]

    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.post(
            ZOOM_TOKEN_URL,
            params={"grant_type": "account_credentials", "account_id": account_id},
            auth=(client_id, client_secret),
        )
        r.raise_for_status()
        data = r.json()

    token = data["access_token"]
    # Refresh 60s early rather than exactly at expiry, so an in-flight
    # request never gets caught using a token that just went stale.
    _token_cache["access_token"] = token
    _token_cache["expires_at"] = now + max(int(data.get("expires_in", 3600)) - 60, 0)
    return token


async def create_meeting(
    *,
    topic: str,
    start: str,
    duration_minutes: int = 30,
    timezone_str: str = "UTC",
    agenda: Optional[str] = None,
) -> dict[str, Any]:
    """Creates a real scheduled Zoom meeting and returns its join link.

    `start` must be ISO 8601 (e.g. "2026-09-10T15:00:00"). Raises
    RuntimeError if Zoom isn't configured — callers should check
    zoom_configured() first if they want to degrade gracefully instead.
    """
    if not zoom_configured():
        raise RuntimeError("Zoom is not configured (ZOOM_ACCOUNT_ID/ZOOM_CLIENT_ID/ZOOM_CLIENT_SECRET)")

    token = await _get_access_token()
    payload = {
        "topic": topic[:200] or "Meeting",
        "type": 2,  # scheduled meeting
        "start_time": start,
        "duration": max(int(duration_minutes or 30), 1),
        "timezone": timezone_str,
        "agenda": (agenda or "")[:2000],
        "settings": {
            "join_before_host": True,
            "waiting_room": False,
        },
    }
    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.post(
            f"{ZOOM_API_BASE}/users/me/meetings",
            headers={"Authorization": f"Bearer {token}"},
            json=payload,
        )
        r.raise_for_status()
        data = r.json()

    return {
        "meeting_id": data.get("id"),
        "join_url": data.get("join_url"),
        "start_url": data.get("start_url"),
    }
