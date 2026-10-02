"""n8n Automation Endpoints for Chatty Bots."""

from __future__ import annotations

from typing import Any, Dict
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.core.clients import supabase
from app.core.db import run_db
from app.core.deps import require_user
from app.services import n8n_service

router = APIRouter(prefix="/api/bots", tags=["Automations (n8n)"])


class N8nTriggerRequest(BaseModel):
    action: str = Field(..., description="Action or event name (e.g. 'lead_captured', 'booking_requested')")
    payload: Dict[str, Any] = Field(default_factory=dict, description="Arbitrary payload to pass to n8n webhook")


async def _verify_bot_access(bot_id: str, user: dict[str, Any]) -> dict[str, Any]:
    user_id = user.get("auth_user_id") or user.get("sub") or user.get("id")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    res = await run_db(
        lambda: supabase.table("chatty_bots")
        .select("id, name, user_id")
        .eq("id", bot_id)
        .maybe_single()
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bot not found")
    bot = res.data
    if bot.get("user_id") != user_id:
        from app.core.permissions import verify_bot_permission
        await verify_bot_permission(bot_id, user, "webhooks")
    return bot


@router.get("/{bot_id}/n8n/status")
async def get_n8n_status(bot_id: str, user: dict[str, Any] = Depends(require_user)):
    """Check n8n service connectivity."""
    await _verify_bot_access(bot_id, user)
    health = await n8n_service.check_n8n_health()
    return health


@router.get("/{bot_id}/n8n/workflow")
async def get_bot_n8n_workflow(bot_id: str, user: dict[str, Any] = Depends(require_user)):
    """Get or auto-provision an n8n workflow for this bot."""
    bot = await _verify_bot_access(bot_id, user)
    workflow_info = await n8n_service.get_or_create_bot_workflow(bot_id, bot.get("name", "Support Bot"))
    return workflow_info


@router.post("/{bot_id}/n8n/trigger")
async def trigger_n8n_workflow(
    bot_id: str,
    body: N8nTriggerRequest,
    user: dict[str, Any] = Depends(require_user),
):
    """Trigger the bot's n8n workflow webhook."""
    await _verify_bot_access(bot_id, user)
    result = await n8n_service.trigger_bot_workflow(bot_id, body.action, body.payload)
    return result
