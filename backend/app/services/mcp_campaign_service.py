"""Proactive on-page campaign tools for the Developer API / MCP server.

chatty_campaigns (supabase/migrations/20260902164515_chatty_campaigns.sql)
is a real, newly-created table - see that migration's own comment for why
it's separate from the dashboard's campaign configuration. Telemetry is
recorded in chatty_campaign_events and analytics are recomputed from that
ledger, with legacy counter fallback for older installations.
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
        "audience_rules": body.audience_rules,
        "channels": body.channels,
        "sequence_steps": body.sequence_steps,
        "safety_config": body.safety_config or {"frequency_cap_hours": 24, "require_consent": True},
        "schedule_config": body.schedule_config or {"cadence": "once", "timezone": "UTC"},
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


_UPDATE_FIELD_TO_COLUMN = {"campaign_type": "type", "message_content": "message"}


async def update_campaign(principal: dict[str, Any], bot_id: str, campaign_id: str, body: CampaignUpdateRequest) -> dict[str, Any]:
    """CampaignUpdateRequest field names don't all match chatty_campaigns
    column names (campaign_type/message_content vs. the real type/message
    columns, same mapping create_campaign already applies) - dumping the
    model straight into an update() would silently write to nonexistent
    column names and 400 from PostgREST, or (worse) succeed at renaming a
    campaign's `campaign_type`/`message_content` keys into row data that no
    read path ever looks at."""
    await _oauth.require_bot_access(principal, bot_id)
    updates = {
        _UPDATE_FIELD_TO_COLUMN.get(k, k): v
        for k, v in body.model_dump(exclude_unset=True).items() if v is not None
    }
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
        "id, name, impressions, clicks, conversions").eq("id", campaign_id).eq("bot_id", bot_id).execute())
    if not res.data:
        raise HTTPException(status_code=404, detail="Campaign not found")
    events = await run_db(lambda: supabase.table("chatty_campaign_events").select(
        "event_type").eq("campaign_id", campaign_id).eq("bot_id", bot_id).limit(10000).execute())
    counts = {kind: 0 for kind in ("impression", "click", "conversion")}
    for event in events.data or []:
        if event.get("event_type") in counts:
            counts[event["event_type"]] += 1
    # Preserve compatibility with installations that have not started emitting
    # the ledger yet; legacy snapshots remain a safe read-only fallback.
    if not any(counts.values()):
        row = res.data[0]
        counts = {"impression": int(row.get("impressions") or 0), "click": int(row.get("clicks") or 0), "conversion": int(row.get("conversions") or 0)}
    impressions, clicks, conversions = counts["impression"], counts["click"], counts["conversion"]
    return {
        "campaign_id": campaign_id,
        "bot_id": bot_id,
        "name": res.data[0].get("name"),
        "impressions": impressions,
        "clicks": clicks,
        "conversions": conversions,
        "ctr_percent": round(clicks / impressions * 100, 2) if impressions else None,
        "conversion_rate_percent": round(conversions / clicks * 100, 2) if clicks else None,
        "sample_size": len(events.data or []),
    }
