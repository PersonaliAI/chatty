"""HTTP Client adapter for WAHA (WhatsApp HTTP API - NOWEB engine)."""

from __future__ import annotations

import base64
import logging
from typing import Any, Optional
import httpx

from app.services.waha.models import WahaSessionState, WahaSessionStatusResponse

logger = logging.getLogger("chatty.waha.client")


class WahaClient:
    """Async HTTP Client for WAHA API operations."""

    def __init__(self, endpoint: str, api_key: Optional[str] = None, timeout: float = 15.0):
        self.endpoint = endpoint.rstrip("/")
        self.api_key = api_key
        self.timeout = timeout

    def _headers(self) -> dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["X-Api-Key"] = self.api_key
        return headers

    async def get_session_status(self, session_name: str = "default") -> WahaSessionStatusResponse:
        """Fetch live status of a WAHA session."""
        url = f"{self.endpoint}/api/sessions/{session_name}"
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                res = await client.get(url, headers=self._headers())
                if res.status_code == 404:
                    return WahaSessionStatusResponse(
                        status=WahaSessionState.STOPPED,
                        session_name=session_name,
                    )
                res.raise_for_status()
                data = res.json()
                raw_status = str(data.get("status") or "STOPPED").upper()
                me = data.get("me") or {}
                phone = me.get("id", "").split("@")[0] if isinstance(me, dict) else None

                # Map WAHA state to our standardized enum
                status_enum = WahaSessionState.STOPPED
                if "WORKING" in raw_status or "ONLINE" in raw_status:
                    status_enum = WahaSessionState.WORKING
                elif "SCAN_QR" in raw_status or "QR" in raw_status:
                    status_enum = WahaSessionState.SCAN_QR_CODE
                elif "STARTING" in raw_status:
                    status_enum = WahaSessionState.STARTING
                elif "FAILED" in raw_status:
                    status_enum = WahaSessionState.FAILED

                qr_code = None
                if status_enum == WahaSessionState.SCAN_QR_CODE:
                    qr_code = await self.get_qr_code(session_name)

                return WahaSessionStatusResponse(
                    status=status_enum,
                    session_name=session_name,
                    phone_number=phone,
                    qr_code_data_url=qr_code,
                    details=data,
                )
        except Exception as exc:
            logger.warning("Failed to check WAHA session status at %s: %s", url, exc)
            return WahaSessionStatusResponse(
                status=WahaSessionState.STOPPED,
                session_name=session_name,
                details={"error": str(exc)},
            )

    async def get_qr_code(self, session_name: str = "default") -> Optional[str]:
        """Fetch pairing QR code as base64 data URL."""
        url = f"{self.endpoint}/api/sessions/{session_name}/auth/qr"
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                res = await client.get(url, headers=self._headers())
                if res.status_code == 200:
                    ct = res.headers.get("content-type", "")
                    if "image" in ct:
                        b64 = base64.b64encode(res.content).decode("ascii")
                        return f"data:{ct};base64,{b64}"
                    elif "json" in ct:
                        body = res.json()
                        raw_qr = body.get("raw") or body.get("qr")
                        if raw_qr and raw_qr.startswith("data:"):
                            return raw_qr
        except Exception as exc:
            logger.debug("WAHA QR endpoint query failed: %s", exc)
        return None

    async def start_session(self, session_name: str = "default") -> bool:
        """Start or restart a WAHA session (configured for NOWEB engine)."""
        url = f"{self.endpoint}/api/sessions/start"
        payload = {
            "name": session_name,
            "config": {
                "noweb": {
                    "store": {"enabled": True}
                }
            }
        }
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                res = await client.post(url, json=payload, headers=self._headers())
                return res.status_code in (200, 201)
        except Exception as exc:
            logger.error("Failed to start WAHA session: %s", exc)
            return False

    async def stop_session(self, session_name: str = "default") -> bool:
        """Stop/logout a WAHA session."""
        url = f"{self.endpoint}/api/sessions/stop"
        payload = {"name": session_name}
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                res = await client.post(url, json=payload, headers=self._headers())
                return res.status_code == 200
        except Exception as exc:
            logger.error("Failed to stop WAHA session: %s", exc)
            return False

    async def send_presence(self, session_name: str, chat_id: str, presence: str = "composing") -> bool:
        """Simulate typing ('composing') presence on WhatsApp."""
        url = f"{self.endpoint}/api/sendPresence"
        payload = {
            "session": session_name,
            "chatId": chat_id,
            "presence": presence
        }
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                res = await client.post(url, json=payload, headers=self._headers())
                return res.status_code == 200
        except Exception as exc:
            logger.debug("Failed to emit WAHA presence: %s", exc)
            return False

    async def send_text(self, session_name: str, chat_id: str, text: str) -> dict[str, Any]:
        """Send a plain text message via WAHA."""
        url = f"{self.endpoint}/api/sendText"
        payload = {
            "session": session_name,
            "chatId": chat_id,
            "text": text,
        }
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            res = await client.post(url, json=payload, headers=self._headers())
            res.raise_for_status()
            return res.json()
