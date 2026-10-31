"""Progressive number warm-up ladder and daily limits quota ledger."""

from __future__ import annotations

from datetime import date
import logging
from typing import Any, Optional

from app.services.waha.models import WARMUP_LADDER, WarmupConfig, WarmupStage

logger = logging.getLogger("chatty.waha.warmup")


class WarmupLedger:
    """Manages progressive daily outbound messaging caps based on SIM card age."""

    def __init__(self, config: Optional[WarmupConfig] = None):
        self.config = config or WarmupConfig()
        self._last_date: date = date.today()
        self._sent_today: int = self.config.current_daily_sent

    def _sync_date(self) -> None:
        """Reset sent counter if calendar day rolled over."""
        today = date.today()
        if today != self._last_date:
            self._last_date = today
            self._sent_today = 0
            self.config.current_daily_sent = 0

    def get_current_stage(self) -> WarmupStage:
        """Resolve active stage from the warm-up ladder based on SIM age."""
        age = self.config.sim_age_days
        active = WARMUP_LADDER[0]
        for stage in WARMUP_LADDER:
            if age >= stage.min_age_days:
                active = stage
        return active

    def get_effective_cap(self) -> Optional[int]:
        """Get max messages allowed per day."""
        if not self.config.auto_warmup_enabled and self.config.daily_cap is not None:
            return self.config.daily_cap
        return self.get_current_stage().daily_cap

    def can_send(self) -> tuple[bool, int, Optional[int]]:
        """
        Check if quota allows sending another message.
        Returns (allowed: bool, sent_today: int, cap: Optional[int]).
        """
        self._sync_date()
        cap = self.get_effective_cap()
        if cap is None:
            return True, self._sent_today, None
        allowed = self._sent_today < cap
        return allowed, self._sent_today, cap

    def record_sent(self) -> None:
        """Record an outbound dispatch against today's quota."""
        self._sync_date()
        self._sent_today += 1
        self.config.current_daily_sent = self._sent_today

    def get_stats(self) -> dict[str, Any]:
        """Return structured stats for dashboard telemetry."""
        self._sync_date()
        stage = self.get_current_stage()
        cap = self.get_effective_cap()
        remaining = max(0, cap - self._sent_today) if cap is not None else None
        return {
            "sim_age_days": self.config.sim_age_days,
            "stage_label": stage.label,
            "daily_cap": cap,
            "current_daily_sent": self._sent_today,
            "remaining_today": remaining,
            "auto_warmup_enabled": self.config.auto_warmup_enabled,
        }
