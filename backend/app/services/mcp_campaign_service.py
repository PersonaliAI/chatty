"""Proactive on-page campaign tools for the Developer API / MCP server.

chatty_campaigns (supabase/migrations/20260902164515_chatty_campaigns.sql)
is a real, newly-created table — see that migration's own comment for why
it's separate from the dashboard's existing client-side-only campaigns
feature. impressions/clicks/conversions are real, persisted counters that
currently only ever read 0: there is no event-recording pipeline yet (the
widget doesn't call any endpoint to report an impression/click/conversion),
so get_campaign_analytics reports that honestly rather than returning
plausible-looking fabricated numbers.
"""

from __future__ import annotations

from typing import Any

from fastapi import HTTPException

from app.core import oauth as _oauth
from app.core.clients import supabase
from app.core.db import run_db
from app.schemas.bots_api import CampaignCreateRequest, CampaignUpdateRequest


async def create_campaign(principal: dict[str, Any], bot_id: str, body: CampaignCreateRequest) -> dict[str, Any]:
    await _oauth.require_bot_access(principal, bot_id)
    row = {
        "bot_id": bot_id,
        "name": body.name,
        "type": body.campaign_type,
        "message": body.message_content,
        "url_patterns": body.url_patterns,
        "trigger_type": body.trigger_type,
        "trigger_value": body.trigger_value,
        "target_devices": body.target_devices,
        "start_date": body.start_date,
        "end_date": body.end_date,
        "is_active": body.is_active,
    }
    res = await run_db(lambda: supabase.table("chatty_campaigns").insert(row).execute())
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to create campaign")
    return res.data[0]


async def list_campaigns(principal: dict[str, Any], bot_id: str) -> list[dict[str, Any]]:
    await _oauth.require_bot_access(principal, bot_id)
    res = await run_db(lambda: supabase.table("chatty_campaigns").select("*").eq(
        "bot_id", bot_id).order("created_at", desc=True).execute())
    return res.data or []


async def update_campaign(principal: dict[str, Any], bot_id: str, campaign_id: str, body: CampaignUpdateRequest) -> dict[str, Any]:
    await _oauth.require_bot_access(principal, bot_id)
    updates = {k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    res = await run_db(lambda: supabase.table("chatty_campaigns").update(updates).eq(
        "id", campaign_id).eq("bot_id", bot_id).execute())
    if not res.data:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return res.data[0]


async def delete_campaign(principal: dict[str, Any], bot_id: str, campaign_id: str) -> dict[str, Any]:
    await _oauth.require_bot_access(principal, bot_id)
    await run_db(lambda: supabase.table("chatty_campaigns").delete().eq(
        "id", campaign_id).eq("bot_id", bot_id).execute())
    return {"deleted": True, "campaign_id": campaign_id}


async def get_campaign_analytics(principal: dict[str, Any], bot_id: str, campaign_id: str) -> dict[str, Any]:
    await _oauth.require_bot_access(principal, bot_id)
    res = await run_db(lambda: supabase.table("chatty_campaigns").select(
        "id, impressions, clicks, conversions").eq("id", campaign_id).eq("bot_id", bot_id).execute())
    if not res.data:
        raise HTTPException(status_code=404, detail="Campaign not found")
    row = res.data[0]
    impressions, clicks, conversions = row.get("impressions", 0), row.get("clicks", 0), row.get("conversions", 0)
    return {
        "campaign_id": campaign_id,
        "bot_id": bot_id,
        "impressions": impressions,
        "clicks": clicks,
        "conversions": conversions,
        "ctr_percent": round(clicks / impressions * 100, 2) if impressions else None,
        "conversion_rate_percent": round(conversions / clicks * 100, 2) if clicks else None,
        "note": "Tracking pipeline not wired up yet — these are real, persisted counters, currently 0 until widget-side impression/click/conversion reporting is built.",
    }
