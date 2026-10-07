"""Bounded in-memory media handoff for voice catalog queries."""

from __future__ import annotations

import base64
import binascii
import json
from dataclasses import dataclass
from typing import Any

MAX_IMAGE_BYTES = 5 * 1024 * 1024
MEDIA_TOPIC = "chatty.voice.media"


@dataclass(frozen=True, slots=True)
class ImageQuery:
    """One visitor image retained only for the next catalog lookup."""

    data: bytes
    mime_type: str


class VoiceMediaBuffer:
    """Keep one bounded image in memory; never write visitor media to disk."""

    def __init__(self) -> None:
        self._image: ImageQuery | None = None
        self._active_image: ImageQuery | None = None

    def accept_packet(self, packet_data: bytes | bytearray | memoryview | str) -> bool:
        """Accept the documented JSON data-channel payload if it is safe."""
        try:
            raw = (
                bytes(packet_data).decode("utf-8")
                if isinstance(packet_data, (bytes, bytearray, memoryview))
                else packet_data
            )
            payload: Any = json.loads(raw)
            if not isinstance(payload, dict):
                return False
            mime_type = str(payload.get("mime_type") or "").strip().lower()
            encoded = payload.get("data")
            if not mime_type.startswith("image/") or not isinstance(encoded, str):
                return False
            max_encoded_length = ((MAX_IMAGE_BYTES + 2) // 3) * 4
            if len(encoded) > max_encoded_length:
                return False
            data = base64.b64decode(encoded, validate=True)
        except (UnicodeDecodeError, TypeError, ValueError, binascii.Error):
            return False
        if not data or len(data) > MAX_IMAGE_BYTES:
            return False
        self._image = ImageQuery(data=data, mime_type=mime_type)
        return True

    def begin_turn(self) -> ImageQuery | None:
        """Move the newest image into the current turn and retire the prior one."""
        self._active_image = self._image
        self._image = None
        return self._active_image

    def take_image(self) -> ImageQuery | None:
        """Return and clear the pending image so it cannot leak across turns."""
        image = self._active_image or self._image
        self._active_image = None
        self._image = None
        return image
