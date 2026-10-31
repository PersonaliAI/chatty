"""Data models and anti-ban configuration contracts for WAHA (WhatsApp HTTP API)."""

from __future__ import annotations

from enum import Enum
from typing import Any, List, Optional
from pydantic import BaseModel, Field


class WahaSessionState(str, Enum):
    STOPPED = "STOPPED"
    STARTING = "STARTING"
    SCAN_QR_CODE = "SCAN_QR_CODE"
    WORKING = "WORKING"
    FAILED = "FAILED"


class PacingConfig(BaseModel):
    """Simulated human typing latency and cognitive pacing (inspired by DeskcommCRM pacing engine)."""
    throttle_ms: int = Field(default=1500, description="Minimum interval between consecutive messages (ms)")
    jitter_max_ms: int = Field(default=800, description="Random jitter ceiling added to delays to break bot signatures (ms)")
    reading_delay_ms: int = Field(default=1200, description="Baseline cognitive delay for opening & reading message (ms)")
    typing_ms_per_char: int = Field(default=22, description="Typing duration per character (~45 chars/sec) (ms)")
    typing_presence_enabled: bool = Field(default=True, description="Emit 'composing' presence in WAHA during typing duration")
    window_start_hour: int = Field(default=8, description="Outbound sending window start hour (local tenant time)")
    window_end_hour: int = Field(default=21, description="Outbound sending window end hour (local tenant time)")


class SpinningConfig(BaseModel):
    """Jaccard similarity sliding window gate to prevent duplicate copy hash bans (inspired by DeskcommCRM spinning gate)."""
    window_size: int = Field(default=20, description="Number of recent outbound messages compared in sliding window")
    similarity_threshold: float = Field(default=0.80, description="Jaccard word-similarity threshold that counts as near-identical")
    repetition_threshold: int = Field(default=2, description="Max allowed identical/near-identical messages before hard-veto")
    allowlist_patterns: List[str] = Field(
        default_factory=lambda: [r"https?://\S*(checkout|book|pay|order|pix|stripe)"],
        description="Regexes for transactional URLs exempt from similarity gate"
    )


class WarmupStage(BaseModel):
    min_age_days: int
    daily_cap: Optional[int]
    label: str


WARMUP_LADDER: list[WarmupStage] = [
    WarmupStage(min_age_days=1, daily_cap=20, label="Stage 1 (Acclimatization: 20 msgs/day)"),
    WarmupStage(min_age_days=4, daily_cap=50, label="Stage 2 (Gentle Ramp: 50 msgs/day)"),
    WarmupStage(min_age_days=8, daily_cap=120, label="Stage 3 (Active Nurturing: 120 msgs/day)"),
    WarmupStage(min_age_days=15, daily_cap=250, label="Stage 4 (High Volume: 250 msgs/day)"),
    WarmupStage(min_age_days=30, daily_cap=None, label="Stage 5 (Formed / Mature: Unlimited)"),
]


class WarmupConfig(BaseModel):
    """Progressive number warm-up ladder to avoid Meta SIM burn."""
    sim_age_days: int = Field(default=1, description="Number of days this WhatsApp SIM/session has been operating")
    daily_cap: Optional[int] = Field(default=20, description="Explicit daily message cap, or derived from ladder")
    current_daily_sent: int = Field(default=0, description="Number of outbound messages sent today (resets at midnight)")
    auto_warmup_enabled: bool = Field(default=True, description="Automatically calculate progressive daily cap from SIM age")


class WahaBotConfig(BaseModel):
    """Full WAHA configuration for a Chatty bot."""
    provider: str = Field(default="official", description="'official' (Meta Cloud API) or 'waha' (Self-hosted WAHA NOWEB)")
    waha_endpoint: str = Field(default="http://localhost:3000", description="Base URL of the WAHA container")
    waha_api_key: Optional[str] = Field(default=None, description="Optional WAHA X-Api-Key header")
    waha_session_name: str = Field(default="default", description="WAHA session identifier")
    pacing: PacingConfig = Field(default_factory=PacingConfig)
    spinning: SpinningConfig = Field(default_factory=SpinningConfig)
    warmup: WarmupConfig = Field(default_factory=WarmupConfig)
    opt_out_shield_enabled: bool = Field(default=True, description="Auto-detect STOP/SAIR phrases and flag DNC to prevent spam reports")


class WahaSessionStatusResponse(BaseModel):
    status: WahaSessionState
    session_name: str
    phone_number: Optional[str] = None
    qr_code_data_url: Optional[str] = None
    uptime_seconds: Optional[int] = None
    details: Optional[dict[str, Any]] = None
