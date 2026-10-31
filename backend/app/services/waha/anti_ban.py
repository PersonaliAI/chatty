"""Central Anti-Ban Orchestrator combining Pacing, Spinning, Warm-Up, and Opt-Out Shields."""

from __future__ import annotations

import logging
import re
from typing import Any, Optional

from app.services.waha.client import WahaClient
from app.services.waha.models import WahaBotConfig
from app.services.waha.pacing import PacingEngine
from app.services.waha.spinning import SpinningGate
from app.services.waha.warmup import WarmupLedger

logger = logging.getLogger("chatty.waha.anti_ban")

OPT_OUT_PATTERNS = re.compile(
    r"\b(stop|sair|parar|cancelar|unsubscribe|descadastrar|nao quero|não quero|remover|bloquear)\b",
    re.IGNORECASE,
)


class WahaAntiBanService:
    """Orchestrates anti-ban safeguards before delivering messages through WAHA."""

    def __init__(self, config: Optional[WahaBotConfig] = None):
        self.config = config or WahaBotConfig()
        self.client = WahaClient(
            endpoint=self.config.waha_endpoint,
            api_key=self.config.waha_api_key,
        )
        self.pacing = PacingEngine(self.config.pacing)
        self.spinning = SpinningGate(self.config.spinning)
        self.warmup = WarmupLedger(self.config.warmup)

    def is_opt_out_request(self, inbound_text: str) -> bool:
        """Check if incoming message matches user opt-out / DNC intent."""
        if not self.config.opt_out_shield_enabled:
            return False
        clean = inbound_text.strip().lower()
        return bool(OPT_OUT_PATTERNS.search(clean))

    async def dispatch_outbound(
        self,
        chat_id: str,
        text: str,
        is_inbound_reply: bool = True,
    ) -> dict[str, Any]:
        """
        Deliver message to WhatsApp recipient through anti-ban verification funnel:
        1. Quota check (Warm-up ladder)
        2. Business window check (if unsolicited outbound)
        3. Spinning gate (Jaccard similarity duplicate copy check)
        4. Cognitive delay & Typing presence simulation
        5. WAHA delivery
        6. Metric update
        """
        # 1. Warm-up Quota Check
        can_send, sent_today, cap = self.warmup.can_send()
        if not can_send and not is_inbound_reply:
            msg = f"Outbound suppressed: Daily warm-up cap reached ({sent_today}/{cap} msgs)"
            logger.warning("[ANTI-BAN VETO] %s for chat %s", msg, chat_id)
            return {"status": "vetoed", "reason": "warmup_cap_reached", "delivered": False}

        # 2. Business Window Check (for proactive outbound campaigns/retargeting)
        if not is_inbound_reply and not self.pacing.is_within_business_window():
            msg = "Outbound suppressed: Outside allowed business hours"
            logger.warning("[ANTI-BAN VETO] %s for chat %s", msg, chat_id)
            return {"status": "vetoed", "reason": "outside_business_window", "delivered": False}

        # 3. Spinning Gate (Check for duplicate text hash broadcast)
        is_vetoed, dup_count, sim = self.spinning.check_duplicate(text)
        final_text = text
        if is_vetoed:
            logger.info(
                "[ANTI-BAN SPINNING] Candidate text similarity %.2f with %d recent messages; applying dynamic variation",
                sim,
                dup_count,
            )
            final_text = self.spinning.apply_spinning_variation(text)

        # 4. Cognitive Reading Delay & Simulated Typing Presence
        session_name = self.config.waha_session_name or "default"
        try:
            await self.pacing.execute_pacing(
                client=self.client,
                session_name=session_name,
                chat_id=chat_id,
                text=final_text,
            )
        except Exception as exc:
            logger.debug("Pacing presence error (continuing delivery): %s", exc)

        # 5. Dispatch message via WAHA
        result = await self.client.send_text(
            session_name=session_name,
            chat_id=chat_id,
            text=final_text,
        )

        # 6. Record metrics
        self.warmup.record_sent()
        self.spinning.record_outbound(final_text)

        return {
            "status": "delivered",
            "delivered": True,
            "result": result,
            "spun": is_vetoed,
            "warmup_stats": self.warmup.get_stats(),
        }
