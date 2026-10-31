"""Omnichannel Sales Pipeline & Kanban Deal Management Service.
Transforms Chatty into an end-to-end sales engine with deal stage tracking,
win probabilities, lost reasons, and intent-driven automated stage advancement.
"""

from __future__ import annotations

from datetime import datetime, timezone
import logging
from typing import Any, Optional
from uuid import UUID

from app.core.clients import supabase
from app.core.db import run_db

logger = logging.getLogger("chatty.enterprise.pipeline")


class PipelineService:
    @staticmethod
    async def get_or_create_default_pipeline(bot_id: str) -> dict[str, Any]:
        """Ensure bot has at least one default sales pipeline and return it."""
        try:
            bot_uuid = str(UUID(bot_id))
        except (ValueError, TypeError):
            bot_uuid = bot_id

        res = await run_db(
            lambda: supabase.table("chatty_pipelines")
            .select("*")
            .eq("bot_id", bot_uuid)
            .order("created_at")
            .limit(1)
            .execute()
        )
        if res.data:
            return res.data[0]

        # Create default pipeline (trigger will auto-populate the 6 default stages)
        new_pipe = {
            "bot_id": bot_uuid,
            "name": "Standard Sales Pipeline",
            "is_default": True,
        }
        create_res = await run_db(
            lambda: supabase.table("chatty_pipelines")
            .insert(new_pipe)
            .execute()
        )
        return create_res.data[0] if create_res.data else new_pipe

    @staticmethod
    async def list_stages(pipeline_id: str) -> list[dict[str, Any]]:
        """List ordered stages for a sales pipeline."""
        res = await run_db(
            lambda: supabase.table("chatty_pipeline_stages")
            .select("*")
            .eq("pipeline_id", pipeline_id)
            .order("stage_order")
            .execute()
        )
        return res.data or []

    @staticmethod
    async def get_kanban_board(bot_id: str, pipeline_id: Optional[str] = None) -> dict[str, Any]:
        """
        Return complete Kanban board payload:
        Ordered stages with deals nested under each stage, including total stage value.
        """
        try:
            bot_uuid = str(UUID(bot_id))
        except (ValueError, TypeError):
            bot_uuid = bot_id

        pipeline = (
            await PipelineService.get_or_create_default_pipeline(bot_uuid)
            if not pipeline_id
            else {"id": pipeline_id}
        )
        pipe_id = pipeline["id"]
        stages = await PipelineService.list_stages(pipe_id)

        deals_res = await run_db(
            lambda: supabase.table("chatty_deals")
            .select("*")
            .eq("bot_id", bot_uuid)
            .eq("pipeline_id", pipe_id)
            .order("created_at", desc=True)
            .execute()
        )
        all_deals = deals_res.data or []

        # Group deals by stage_id
        stages_with_deals = []
        for stage in stages:
            stage_deals = [d for d in all_deals if d.get("stage_id") == stage["id"]]
            total_cents = sum(d.get("value_cents") or 0 for d in stage_deals)
            stages_with_deals.append({
                **stage,
                "deals": stage_deals,
                "deal_count": len(stage_deals),
                "total_value_cents": total_cents,
            })

        return {
            "pipeline": pipeline,
            "stages": stages_with_deals,
            "total_deals": len(all_deals),
            "total_pipeline_value_cents": sum(d.get("value_cents") or 0 for d in all_deals),
        }

    @staticmethod
    async def create_deal(
        bot_id: str,
        pipeline_id: str,
        stage_id: str,
        title: str,
        value_cents: int = 0,
        currency: str = "USD",
        contact_id: Optional[str] = None,
        session_id: Optional[str] = None,
    ) -> dict[str, Any]:
        """Create a new deal card in a pipeline stage."""
        try:
            bot_uuid = str(UUID(bot_id))
        except (ValueError, TypeError):
            bot_uuid = bot_id

        deal_data = {
            "bot_id": bot_uuid,
            "pipeline_id": pipeline_id,
            "stage_id": stage_id,
            "title": title,
            "value_cents": value_cents,
            "currency": currency,
            "contact_id": contact_id,
            "session_id": session_id,
            "status": "open",
        }
        res = await run_db(
            lambda: supabase.table("chatty_deals")
            .insert(deal_data)
            .execute()
        )
        return res.data[0] if (res and res.data) else deal_data

    @staticmethod
    async def move_deal_stage(
        deal_id: str,
        new_stage_id: str,
        status: str = "open",
        lost_reason: Optional[str] = None,
    ) -> bool:
        """Move deal to a new Kanban stage, updating status and timestamps."""
        updates: dict[str, Any] = {
            "stage_id": new_stage_id,
            "status": status,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        if lost_reason:
            updates["lost_reason"] = lost_reason

        res = await run_db(
            lambda: supabase.table("chatty_deals")
            .update(updates)
            .eq("id", deal_id)
            .execute()
        )
        return bool(res.data)

    @staticmethod
    async def auto_progress_deal_from_intent(
        bot_id: str,
        session_id: str,
        intent: str,
        contact_id: Optional[str] = None,
        deal_title: Optional[str] = None,
    ) -> Optional[dict[str, Any]]:
        """
        DeskcommCRM state machine automation:
        Automatically creates or advances a deal when customer intent indicates progression.
        """
        if intent not in ("sales", "ready_to_buy"):
            return None

        pipe = await PipelineService.get_or_create_default_pipeline(bot_id)
        stages = await PipelineService.list_stages(pipe["id"])
        if not stages:
            return None

        # Check if deal already exists for this session
        existing_res = await run_db(
            lambda: supabase.table("chatty_deals")
            .select("*")
            .eq("bot_id", bot_id)
            .eq("session_id", session_id)
            .limit(1)
            .execute()
        )
        if existing_res.data:
            # Advance existing deal if ready to buy
            deal = existing_res.data[0]
            if intent == "ready_to_buy":
                # Find proposal or won stage
                proposal_stage = next((s for s in stages if "Proposal" in s["name"] or "Qualified" in s["name"]), stages[-1])
                await PipelineService.move_deal_stage(deal["id"], proposal_stage["id"])
            return deal

        # Create new deal in stage 0 (New Lead) or stage 1 (Qualified)
        target_stage = stages[1] if intent == "sales" and len(stages) > 1 else stages[0]
        title = deal_title or f"Inquiry Deal ({session_id[:8]})"
        return await PipelineService.create_deal(
            bot_id=bot_id,
            pipeline_id=pipe["id"],
            stage_id=target_stage["id"],
            title=title,
            contact_id=contact_id,
            session_id=session_id,
        )
