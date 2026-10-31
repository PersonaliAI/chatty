"""Simulated human cognitive pacing and presence emission (DeskcommCRM anti-ban architecture)."""

from __future__ import annotations

import asyncio
from datetime import datetime
import logging
import random
from typing import Optional

from app.services.waha.client import WahaClient
from app.services.waha.models import PacingConfig

logger = logging.getLogger("chatty.waha.pacing")


class PacingEngine:
    """Calculates human-like typing delays and delivers presence cues to evade bot detection."""

    def __init__(self, config: Optional[PacingConfig] = None):
        self.config = config or PacingConfig()

    def is_within_business_window(self, current_hour: Optional[int] = None) -> bool:
        """Check if current time falls within allowed outbound messaging hours."""
        hour = current_hour if current_hour is not None else datetime.now().hour
        start = self.config.window_start_hour
        end = self.config.window_end_hour
        if start <= end:
            return start <= hour < end
        else:
            # Over midnight window
            return hour >= start or hour < end

    def calculate_delay(self, text: str) -> tuple[float, float]:
        """
        Calculate (reading_delay_seconds, typing_delay_seconds) based on text length and jitter.
        """
        # Baseline attention/reading latency + jitter
        reading_jitter = random.randint(0, self.config.jitter_max_ms) / 1000.0
        reading_sec = (self.config.reading_delay_ms / 1000.0) + reading_jitter

        # Dynamic typing duration based on character count (mimicking ~45 chars/sec)
        char_count = len(text.strip())
        raw_typing_ms = char_count * self.config.typing_ms_per_char

        # Realistic human boundaries: minimum 1.2s, maximum 7.5s (or chunked)
        bounded_typing_ms = max(1200, min(raw_typing_ms, 7500))
        typing_jitter = random.randint(0, self.config.jitter_max_ms) / 1000.0
        typing_sec = (bounded_typing_ms / 1000.0) + typing_jitter

        return reading_sec, typing_sec

    async def execute_pacing(
        self,
        client: WahaClient,
        session_name: str,
        chat_id: str,
        text: str,
    ) -> float:
        """
        Executes human pacing sequence:
        1. Sleeps cognitive reading delay.
        2. Emits WAHA 'composing' (typing...) presence indicator.
        3. Sleeps typing duration.
        Returns total sleep duration in seconds.
        """
        reading_sec, typing_sec = self.calculate_delay(text)

        # 1. Attention delay
        await asyncio.sleep(reading_sec)

        # 2. Emit typing presence on WhatsApp
        if self.config.typing_presence_enabled:
            await client.send_presence(session_name, chat_id, presence="composing")

        # 3. Typing duration
        await asyncio.sleep(typing_sec)

        total_delay = reading_sec + typing_sec
        logger.debug(
            "Executed anti-ban pacing: %.2fs (reading: %.2fs, typing: %.2fs) for chat %s",
            total_delay,
            reading_sec,
            typing_sec,
            chat_id,
        )
        return total_delay
