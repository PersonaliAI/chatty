"""WAHA (WhatsApp HTTP API) Integration and Anti-Ban Engine."""

from __future__ import annotations

from typing import Any, Optional
from app.services.waha.anti_ban import WahaAntiBanService
from app.services.waha.client import WahaClient
from app.services.waha.models import (
    PacingConfig,
    SpinningConfig,
    WahaBotConfig,
    WahaSessionState,
    WahaSessionStatusResponse,
    WarmupConfig,
)

__all__ = [
    "WahaClient",
    "WahaAntiBanService",
    "WahaBotConfig",
    "PacingConfig",
    "SpinningConfig",
    "WarmupConfig",
    "WahaSessionState",
    "WahaSessionStatusResponse",
    "get_waha_service_for_bot",
]

# In-memory service cache per bot_id to preserve sliding-window spinning and warmup states
_waha_services_cache: dict[str, WahaAntiBanService] = {}


def get_waha_service_for_bot(bot: dict[str, Any]) -> WahaAntiBanService:
    """Retrieve or construct the WahaAntiBanService for a specific bot."""
    bot_id = str(bot.get("id") or "global")
    if bot_id in _waha_services_cache:
        return _waha_services_cache[bot_id]

    omni_cfg = bot.get("omnichannel_config") or {}
    waha_cfg_raw = omni_cfg.get("waha") or {}

    endpoint = (
        waha_cfg_raw.get("endpoint")
        or bot.get("waha_endpoint")
        or "http://localhost:3000"
    )
    api_key = waha_cfg_raw.get("api_key") or bot.get("waha_api_key")
    session_name = (
        waha_cfg_raw.get("session_name")
        or bot.get("waha_session_name")
        or f"bot_{bot_id[:8]}"
    )
    provider = waha_cfg_raw.get("provider") or bot.get("whatsapp_provider") or "official"

    config = WahaBotConfig(
        provider=provider,
        waha_endpoint=endpoint,
        waha_api_key=api_key,
        waha_session_name=session_name,
        pacing=PacingConfig(**(waha_cfg_raw.get("pacing") or {})),
        spinning=SpinningConfig(**(waha_cfg_raw.get("spinning") or {})),
        warmup=WarmupConfig(**(waha_cfg_raw.get("warmup") or {})),
        opt_out_shield_enabled=waha_cfg_raw.get("opt_out_shield_enabled", True),
    )

    service = WahaAntiBanService(config)
    _waha_services_cache[bot_id] = service
    return service
