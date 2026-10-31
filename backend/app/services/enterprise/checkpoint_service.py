"""Cognitive Session Checkpoint Service (DeskcommCRM Dual-Pass Architecture).
Maintains structured persistent memory across conversational turns: rolling summaries,
active commitments, unresolved objections, customer sentiment, and intent.
"""

from __future__ import annotations

from datetime import datetime, timezone
import json
import logging
from typing import Any, Optional
from uuid import UUID

from app.core.clients import supabase
from app.core.db import run_db

logger = logging.getLogger("chatty.enterprise.checkpoint")

SALES_KEYWORDS = ("buy", "order", "purchase", "pricing", "price", "how much", "checkout", "quote", "cost", "proposal", "rates", "package")
SUPPORT_KEYWORDS = ("broken", "refund", "return", "error", "failed", "bug", "damaged", "issue", "problem", "fault")
READY_TO_BUY_KEYWORDS = ("ready to buy", "sign up now", "send invoice", "take my money", "send contract", "let's proceed", "lets proceed")
COMPLAINT_KEYWORDS = ("terrible", "awful", "scam", "angry", "manager", "unacceptable", "worst")


class CheckpointService:
    @staticmethod
    async def get_checkpoint(bot_id: str, session_id: str) -> Optional[dict[str, Any]]:
        """Retrieve the latest structured cognitive checkpoint for a conversation session."""
        try:
            bot_uuid = str(UUID(bot_id))
        except (ValueError, TypeError):
            bot_uuid = bot_id

        res = await run_db(
            lambda: supabase.table("chatty_session_checkpoints")
            .select("*")
            .eq("bot_id", bot_uuid)
            .eq("session_id", session_id)
            .limit(1)
            .execute()
        )
        return res.data[0] if (res and res.data) else None

    @staticmethod
    async def extract_and_save_turn_checkpoint(
        bot_id: str,
        session_id: str,
        customer_message: str,
        assistant_reply: str,
        previous_checkpoint: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        """
        Executes lightweight structured extraction of turn outcomes and persists checkpoint.
        Uses deterministic pattern extraction with fallback to ensure sub-millisecond execution.
        """
        try:
            bot_uuid = str(UUID(bot_id))
        except (ValueError, TypeError):
            bot_uuid = bot_id

        prev = previous_checkpoint or await CheckpointService.get_checkpoint(bot_id, session_id) or {}
        prev_commitments = list(prev.get("active_commitments") or [])
        prev_objections = list(prev.get("unresolved_objections") or [])
        turn_num = (prev.get("turn_number") or 0) + 1

        cust_lower = customer_message.lower()
        reply_lower = assistant_reply.lower()

        # 1. Intent Detection
        intent = "inquiry"
        if any(w in cust_lower for w in READY_TO_BUY_KEYWORDS):
            intent = "ready_to_buy"
        elif any(w in cust_lower for w in SALES_KEYWORDS):
            intent = "sales"
        elif any(w in cust_lower for w in SUPPORT_KEYWORDS):
            intent = "support"
        elif any(w in cust_lower for w in COMPLAINT_KEYWORDS):
            intent = "complaint"

        # 2. Sentiment Detection
        sentiment = "neutral"
        if any(w in cust_lower for w in ("thanks", "great", "awesome", "love", "perfect", "good")):
            sentiment = "positive"
        elif any(w in cust_lower for w in ("expensive", "hesitant", "not sure", "maybe", "competitor")):
            sentiment = "hesitant"
        elif any(w in cust_lower for w in ("bad", "hate", "slow", "horrible", "upset")):
            sentiment = "frustrated"

        # 3. Objection Tracking
        new_objections = list(prev_objections)
        if any(w in cust_lower for w in ("too expensive", "steep", "high price", "budget", "expensive")):
            if "Price / Budget concern" not in new_objections:
                new_objections.append("Price / Budget concern")
        if any(w in cust_lower for w in ("timing", "next month", "later", "busy")):
            if "Timeline / Urgency delay" not in new_objections:
                new_objections.append("Timeline / Urgency delay")
        if any(w in cust_lower for w in ("competitor", "alternative", "cheaper elsewhere")):
            if "Evaluating competitors" not in new_objections:
                new_objections.append("Evaluating competitors")

        # 4. Commitment Detection (Promises made by AI or user)
        new_commitments = list(prev_commitments)
        if "will follow up" in reply_lower or "will send" in reply_lower:
            new_commitments.append("Follow up with requested details")
        if "meeting" in reply_lower or "appointment" in reply_lower or "calendar" in reply_lower:
            new_commitments.append("Prepare consultation agenda")

        # Dedup commitments & objections
        active_commitments = list(dict.fromkeys(new_commitments))[-5:]
        unresolved_objections = list(dict.fromkeys(new_objections))[-5:]

        # 5. Rolling summary update
        summary_delta = f"Turn {turn_num}: Customer inquired about '{customer_message[:60]}...'; Assistant provided guidance."
        prev_summary = prev.get("rolling_summary") or ""
        rolling_summary = (prev_summary + f" | Turn {turn_num}: {customer_message[:45]} -> {assistant_reply[:45]}")[-500:].strip(" |")

        # 6. Next Action Recommendation
        next_action = "Continue conversation"
        if intent == "ready_to_buy":
            next_action = "Deliver payment/checkout link immediately"
        elif intent == "sales":
            next_action = "Offer meeting booking or product demonstration"
        elif sentiment == "frustrated":
            next_action = "Prioritize human agent escalation"

        checkpoint_data = {
            "bot_id": bot_uuid,
            "session_id": session_id,
            "summary_delta": summary_delta,
            "rolling_summary": rolling_summary,
            "active_commitments": active_commitments,
            "unresolved_objections": unresolved_objections,
            "next_action": next_action,
            "customer_sentiment": sentiment,
            "lead_intent": intent,
            "turn_number": turn_num,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }

        try:
            await run_db(
                lambda: supabase.table("chatty_session_checkpoints")
                .upsert(checkpoint_data, on_conflict="bot_id,session_id")
                .execute()
            )
            logger.debug("Persisted session checkpoint for bot %s session %s", bot_id, session_id)
        except Exception as exc:
            logger.warning("Failed to persist session checkpoint: %s", exc)

        return checkpoint_data
