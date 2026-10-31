"""Enterprise Outbox & Event-Log Queue Service.
Guarantees at-least-once delivery, strict idempotency key deduplication (code 23505),
and dead-letter queue isolation for all inbound channels.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
import logging
from typing import Any, Optional
from uuid import UUID

from app.core.clients import supabase
from app.core.db import run_db

logger = logging.getLogger("chatty.enterprise.event_log")


class EventLogService:
    @staticmethod
    async def record_event(
        channel: str,
        external_id: str,
        bot_id: Optional[str],
        payload: dict[str, Any],
    ) -> tuple[bool, dict[str, Any]]:
        """
        Atomically records an inbound event into the event_log outbox table.
        Returns:
            (is_duplicate: bool, event_record: dict)
        """
        try:
            bot_uuid = str(UUID(bot_id)) if bot_id else None
        except (ValueError, TypeError):
            bot_uuid = None

        record = {
            "channel": channel.lower(),
            "external_id": str(external_id),
            "bot_id": bot_uuid,
            "payload": payload,
            "status": "pending",
            "attempts": 0,
            "max_attempts": 5,
        }

        try:
            res = await run_db(
                lambda: supabase.table("chatty_event_log")
                .insert(record)
                .execute()
            )
            if res.data:
                logger.debug("Enqueued new event %s [%s:%s]", res.data[0]["id"], channel, external_id)
                return False, res.data[0]
        except Exception as exc:
            # Check for PostgreSQL unique constraint violation 23505
            err_str = str(exc)
            if "23505" in err_str or "uq_event_log_channel_external_id" in err_str or "duplicate key" in err_str:
                logger.info("Idempotent deduplication caught duplicate event [%s:%s]", channel, external_id)
                existing = await run_db(
                    lambda: supabase.table("chatty_event_log")
                    .select("*")
                    .eq("channel", channel.lower())
                    .eq("external_id", str(external_id))
                    .limit(1)
                    .execute()
                )
                return True, (existing.data[0] if existing.data else {"external_id": external_id, "status": "duplicate"})
            logger.exception("Failed to insert event log record: %s", exc)
            raise

        return False, record

    @staticmethod
    async def mark_processing(event_id: str) -> None:
        """Mark an event as currently processing."""
        await run_db(
            lambda: supabase.table("chatty_event_log")
            .update({"status": "processing"})
            .eq("id", event_id)
            .execute()
        )

    @staticmethod
    async def mark_completed(event_id: str) -> None:
        """Mark an event as successfully delivered and completed."""
        await run_db(
            lambda: supabase.table("chatty_event_log")
            .update({
                "status": "completed",
                "processed_at": datetime.now(timezone.utc).isoformat(),
            })
            .eq("id", event_id)
            .execute()
        )

    @staticmethod
    async def mark_failed(event_id: str, error_message: str) -> None:
        """Handle failure with exponential backoff or dead-letter quarantine."""
        res = await run_db(
            lambda: supabase.table("chatty_event_log")
            .select("attempts, max_attempts")
            .eq("id", event_id)
            .limit(1)
            .execute()
        )
        if not res.data:
            return

        attempts = (res.data[0].get("attempts") or 0) + 1
        max_attempts = res.data[0].get("max_attempts") or 5

        if attempts >= max_attempts:
            status = "dead_letter"
            next_at = None
            logger.error("Event %s exhausted %d attempts -> DEAD_LETTER. Error: %s", event_id, attempts, error_message)
        else:
            status = "failed"
            # Exponential backoff: 5s, 10s, 20s, 40s...
            delay_sec = 5 * (2 ** (attempts - 1))
            next_at = (datetime.now(timezone.utc) + timedelta(seconds=delay_sec)).isoformat()
            logger.warning("Event %s attempt %d failed; retrying in %ds: %s", event_id, attempts, delay_sec, error_message)

        updates: dict[str, Any] = {
            "attempts": attempts,
            "status": status,
            "last_error": error_message[:1000],
        }
        if next_at:
            updates["next_attempt_at"] = next_at

        await run_db(
            lambda: supabase.table("chatty_event_log")
            .update(updates)
            .eq("id", event_id)
            .execute()
        )

    @staticmethod
    async def replay_dead_letter(event_id: str) -> bool:
        """Reset a dead-letter event to pending for immediate retry."""
        res = await run_db(
            lambda: supabase.table("chatty_event_log")
            .update({
                "status": "pending",
                "attempts": 0,
                "next_attempt_at": datetime.now(timezone.utc).isoformat(),
                "last_error": None,
            })
            .eq("id", event_id)
            .execute()
        )
        return bool(res.data)
