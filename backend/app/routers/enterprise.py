"""API Router for Enterprise Omnichannel CRM: Kanban Deals, Pipelines, Checkpoints & Audit Log."""

from __future__ import annotations

import logging
from typing import Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel

from app.core.clients import supabase
from app.core.db import run_db
from app.routers.bots import get_bot_role_and_permissions, require_user
from app.services.enterprise import (
    AuditService,
    CheckpointService,
    EventLogService,
    PipelineService,
)

logger = logging.getLogger("chatty.routers.enterprise")

router = APIRouter(prefix="/api/enterprise", tags=["enterprise"])


class CreateDealPayload(BaseModel):
    bot_id: str
    pipeline_id: str
    stage_id: str
    title: str
    value_cents: int = 0
    currency: str = "USD"
    contact_id: Optional[str] = None
    session_id: Optional[str] = None


class MoveDealPayload(BaseModel):
    bot_id: str
    new_stage_id: str
    status: str = "open"
    lost_reason: Optional[str] = None


# ---------------------------------------------------------------------------
# 1. Kanban Pipeline & Deals
# ---------------------------------------------------------------------------
@router.get("/kanban")
async def get_kanban_board(
    bot_id: str = Query(...),
    pipeline_id: Optional[str] = None,
    user: dict[str, Any] = Depends(require_user),
) -> dict[str, Any]:
    """Return complete Kanban board payload with stages and deal cards."""
    await get_bot_role_and_permissions(bot_id, user)
    board = await PipelineService.get_kanban_board(bot_id, pipeline_id)
    return {"ok": True, "board": board}


@router.post("/deals")
async def create_deal(
    payload: CreateDealPayload,
    request: Request,
    user: dict[str, Any] = Depends(require_user),
) -> dict[str, Any]:
    """Create a new deal in a pipeline stage."""
    await get_bot_role_and_permissions(payload.bot_id, user)
    deal = await PipelineService.create_deal(
        bot_id=payload.bot_id,
        pipeline_id=payload.pipeline_id,
        stage_id=payload.stage_id,
        title=payload.title,
        value_cents=payload.value_cents,
        currency=payload.currency,
        contact_id=payload.contact_id,
        session_id=payload.session_id,
    )

    # Record Audit
    await AuditService.record_audit(
        action="deal_created",
        entity_type="chatty_deal",
        entity_id=deal.get("id"),
        bot_id=payload.bot_id,
        user_id=user["auth_user_id"],
        actor_email=user.get("email"),
        diff={"title": payload.title, "value_cents": payload.value_cents},
        ip_address=request.client.host if request.client else None,
    )
    return {"ok": True, "deal": deal}


@router.patch("/deals/{deal_id}/move")
async def move_deal(
    deal_id: str,
    payload: MoveDealPayload,
    request: Request,
    user: dict[str, Any] = Depends(require_user),
) -> dict[str, Any]:
    """Move deal to another Kanban stage."""
    await get_bot_role_and_permissions(payload.bot_id, user)
    moved = await PipelineService.move_deal_stage(
        deal_id=deal_id,
        new_stage_id=payload.new_stage_id,
        status=payload.status,
        lost_reason=payload.lost_reason,
    )
    if not moved:
        raise HTTPException(status_code=404, detail="Deal not found")

    await AuditService.record_audit(
        action="deal_stage_moved",
        entity_type="chatty_deal",
        entity_id=deal_id,
        bot_id=payload.bot_id,
        user_id=user["auth_user_id"],
        actor_email=user.get("email"),
        diff={"new_stage_id": payload.new_stage_id, "status": payload.status, "lost_reason": payload.lost_reason},
        ip_address=request.client.host if request.client else None,
    )
    return {"ok": True, "moved": True}


# ---------------------------------------------------------------------------
# 2. Cognitive Session Checkpoints
# ---------------------------------------------------------------------------
@router.get("/checkpoints/{session_id}")
async def get_session_checkpoint(
    session_id: str,
    bot_id: str = Query(...),
    user: dict[str, Any] = Depends(require_user),
) -> dict[str, Any]:
    """Retrieve structured commitments, objections, and rolling summaries for a session."""
    await get_bot_role_and_permissions(bot_id, user)
    checkpoint = await CheckpointService.get_checkpoint(bot_id, session_id)
    return {"ok": True, "checkpoint": checkpoint or {}}


# ---------------------------------------------------------------------------
# 3. Outbox Event Log & Dead Letter Queue (DLQ)
# ---------------------------------------------------------------------------
@router.get("/event-log")
async def get_event_log(
    bot_id: str = Query(...),
    status: Optional[str] = None,
    limit: int = 50,
    user: dict[str, Any] = Depends(require_user),
) -> dict[str, Any]:
    """Inspect event outbox telemetry, delivery status, and dead letter events."""
    await get_bot_role_and_permissions(bot_id, user)
    query = (
        supabase.table("chatty_event_log")
        .select("*")
        .eq("bot_id", bot_id)
        .order("created_at", desc=True)
        .limit(min(limit, 100))
    )
    if status:
        query = query.eq("status", status)

    res = await run_db(lambda: query.execute())
    return {"ok": True, "events": res.data or []}


@router.post("/event-log/{event_id}/replay")
async def replay_dead_letter_event(
    event_id: str,
    bot_id: str = Query(...),
    user: dict[str, Any] = Depends(require_user),
) -> dict[str, Any]:
    """Replay a failed/dead-lettered event from the outbox."""
    await get_bot_role_and_permissions(bot_id, user)
    replayed = await EventLogService.replay_dead_letter(event_id)
    if not replayed:
        raise HTTPException(status_code=404, detail="Event not found")
    return {"ok": True, "replayed": True}


# ---------------------------------------------------------------------------
# 4. Enterprise Audit Log
# ---------------------------------------------------------------------------
@router.get("/audit-log")
async def get_audit_log(
    bot_id: str = Query(...),
    limit: int = 50,
    user: dict[str, Any] = Depends(require_user),
) -> dict[str, Any]:
    """Fetch immutable audit events for security and compliance monitoring."""
    await get_bot_role_and_permissions(bot_id, user)
    res = await run_db(
        lambda: supabase.table("chatty_enterprise_audit_log")
        .select("*")
        .eq("bot_id", bot_id)
        .order("created_at", desc=True)
        .limit(min(limit, 100))
        .execute()
    )
    return {"ok": True, "audit_events": res.data or []}

@router.get("/deals/by-session/{session_id}")
async def get_deal_by_session(
    session_id: str,
    bot_id: str = Query(...),
    user: dict[str, Any] = Depends(require_user),
) -> dict[str, Any]:
    """Retrieve deal associated with a specific conversation session."""
    await get_bot_role_and_permissions(bot_id, user)
    res = await run_db(
        lambda: supabase.table("chatty_deals")
        .select("*, stage:chatty_pipeline_stages(id, name, color, position)")
        .eq("bot_id", bot_id)
        .eq("session_id", session_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    deal = res.data[0] if res.data else None
    return {"ok": True, "deal": deal}

