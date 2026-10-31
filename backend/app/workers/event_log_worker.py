"""Enterprise Outbox & Event-Log Queue Worker.

Drains inbound and outbound events from chatty_event_log table, ensuring
reliable at-least-once processing, deduplication, and exponential backoff retry.
Can be executed as a background process or periodically triggered via /cron/drain-event-log.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
import logging
import os
import sys
from typing import Any

from app.core.clients import supabase
from app.core.db import run_db
from app.services.enterprise.event_log_service import EventLogService

logger = logging.getLogger("chatty.workers.event_log")


async def process_single_event(event: dict[str, Any]) -> bool:
    """Process a single event log entry according to its channel and payload."""
    event_id = event["id"]
    channel = event.get("channel", "").lower()
    payload = event.get("payload") or {}
    bot_id = event.get("bot_id")

    logger.debug("Processing outbox event %s for channel %s", event_id, channel)
    await EventLogService.mark_processing(event_id)

    try:
        # If payload contains an inbound message to be processed via OmnichannelPipeline
        if "inbound_message" in payload and bot_id:
            from app.services.omnichannel import InboundMessage, OmnichannelPipeline
            from app.services.omnichannel.bot_helpers import unpack_omnichannel_bot_row

            # Fetch bot and owner
            bot_res = await run_db(
                lambda: supabase.table("chatty_bots")
                .select("*")
                .eq("id", bot_id)
                .limit(1)
                .execute()
            )
            if not bot_res.data:
                raise ValueError(f"Bot {bot_id} not found for event {event_id}")

            bot = unpack_omnichannel_bot_row(bot_res.data[0])
            owner_res = await run_db(
                lambda: supabase.table("users")
                .select("*")
                .eq("auth_user_id", bot["user_id"])
                .limit(1)
                .execute()
            )
            if not owner_res.data:
                raise ValueError(f"Owner not found for bot {bot_id}")
            owner_user = owner_res.data[0]

            msg_data = payload["inbound_message"]
            msg = InboundMessage(**msg_data)
            pipeline = OmnichannelPipeline()
            await pipeline.process_inbound(
                message=msg,
                bot=bot,
                owner_user=owner_user,
                access_token=payload.get("access_token"),
            )

        # Mark successfully completed
        await EventLogService.mark_completed(event_id)
        logger.info("Successfully processed outbox event %s [%s]", event_id, channel)
        return True

    except Exception as exc:
        err_msg = str(exc)
        logger.exception("Error processing outbox event %s: %s", event_id, err_msg)
        await EventLogService.mark_failed(event_id, err_msg)
        return False


async def drain_event_log(limit: int = 50) -> dict[str, Any]:
    """Drain pending and retryable failed events from chatty_event_log."""
    now_iso = datetime.now(timezone.utc).isoformat()

    # Query pending events or failed events ready for retry
    def _query():
        return (
            supabase.table("chatty_event_log")
            .select("*")
            .in_("status", ["pending", "failed"])
            .or_(f"next_attempt_at.is.null,next_attempt_at.lte.{now_iso}")
            .order("created_at")
            .limit(limit)
            .execute()
        )

    try:
        res = await run_db(_query)
        events = res.data or []
    except Exception as exc:
        logger.exception("Failed to query pending event log rows: %s", exc)
        return {"processed": 0, "succeeded": 0, "failed": 0, "error": str(exc)}

    if not events:
        return {"processed": 0, "succeeded": 0, "failed": 0}

    succeeded = 0
    failed = 0

    for event in events:
        ok = await process_single_event(event)
        if ok:
            succeeded += 1
        else:
            failed += 1

    return {
        "processed": len(events),
        "succeeded": succeeded,
        "failed": failed,
    }


async def run_worker_loop(interval_sec: float = 3.0) -> None:
    """Continuous polling loop for running as a standalone worker container/service."""
    logger.info("Starting Chatty Enterprise Event Log Worker (poll interval: %.1fs)...", interval_sec)
    while True:
        try:
            stats = await drain_event_log(limit=50)
            if stats["processed"] > 0:
                logger.info(
                    "Drained event batch: %d processed (%d succeeded, %d failed)",
                    stats["processed"],
                    stats["succeeded"],
                    stats["failed"],
                )
        except asyncio.CancelledError:
            logger.info("Event log worker received cancellation; shutting down cleanly.")
            break
        except Exception as exc:
            logger.exception("Unexpected error in event log worker loop: %s", exc)

        await asyncio.sleep(interval_sec)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
    try:
        asyncio.run(run_worker_loop())
    except KeyboardInterrupt:
        logger.info("Terminated by user.")
        sys.exit(0)
