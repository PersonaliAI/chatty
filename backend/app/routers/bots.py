"""Bot management endpoints: shared-bot listing, logo/avatar upload, AI business
generation, BYOK config, dashboard webhook management, and capability
discovery (/api/bots/*, /api/bot/*, /api/generate-business, /api/capabilities)."""

from __future__ import annotations

import logging
import re
import secrets
import time
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Body, Depends, File, Form, HTTPException, Query, UploadFile
from app.core.clients import supabase
from app.core.config import MODEL_NAME
from app.core.db import run_db
from app.core.deps import require_user
from app.core.permissions import get_bot_role_and_permissions, verify_bot_permission
from app.core.ssrf import UnsafeURLError, assert_safe_url_async
from app.services.campaign_schedule import next_campaign_run_at
from app.services.campaign_dispatch import build_campaign_dispatch_plan
from app.services.campaign_audience import load_consented_lead_recipients
from app.services.campaign_analytics import aggregate_campaign_deliveries, aggregate_campaign_events
from app.core.uploads import read_upload_capped
from app.schemas.bots import (
    BYOKUpdate,
    DashboardWebhookCreateRequest,
    GenerateBusinessRequest,
    VoiceSettingsUpdate,
)
from app.schemas.bots_api import CampaignCreateRequest, CampaignSuggestRequest, CampaignUpdateRequest, _parse_campaign_datetime
from plugins import ai_client
from plugins import llm_providers
from plugins import notifications as notify
from plugins.widget_brain import GEMINI_FALLBACK_MODELS
try:
    from postgrest.exceptions import APIError as PostgrestAPIError
except ImportError:  # pragma: no cover - dependency is present in production
    PostgrestAPIError = Exception  # type: ignore[misc,assignment]

import json

logger = logging.getLogger("chatty")

router = APIRouter()


def _campaign_row(body: CampaignCreateRequest) -> dict[str, Any]:
    """Map the dashboard/API model to the canonical campaign table columns."""
    return {
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


@router.get("/api/bots/{bot_id}/campaigns")
async def list_dashboard_campaigns(bot_id: str, user: dict[str, Any] = Depends(require_user)):
    """List persisted campaigns for the dashboard (not browser localStorage)."""
    await verify_bot_permission(bot_id, user, "settings")
    result = await run_db(lambda: supabase.table("chatty_campaigns").select("*").eq(
        "bot_id", bot_id).order("created_at", desc=True).execute())
    return result.data or []


@router.post("/api/bots/{bot_id}/campaigns", status_code=201)
async def create_dashboard_campaign(
    bot_id: str,
    body: CampaignCreateRequest,
    user: dict[str, Any] = Depends(require_user),
):
    await verify_bot_permission(bot_id, user, "settings")
    result = await run_db(lambda: supabase.table("chatty_campaigns").insert({
        "bot_id": bot_id, **_campaign_row(body)
    }).execute())
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create campaign")
    return result.data[0]


@router.post("/api/bots/{bot_id}/campaigns/suggest")
async def suggest_dashboard_campaign(
    bot_id: str,
    body: CampaignSuggestRequest,
    user: dict[str, Any] = Depends(require_user),
):
    """Generate a validated campaign draft; saving remains an explicit action."""
    await verify_bot_permission(bot_id, user, "settings")
    prompt = (
        "Design one high-converting website campaign for an AI support widget. "
        "Return ONLY JSON with keys name, campaign_type, message_content, trigger_type, "
        "trigger_value, url_patterns, sequence_steps. campaign_type must be chat_bubble, popup_modal, "
        "top_banner, or slide_in. trigger_type must be time_on_page, scroll_percentage, "
        "exit_intent, or url_match. Keep the message under 180 characters.\n"
        f"Business goal: {body.goal}\nAudience: {body.audience or 'website visitors'}"
    )
    try:
        response = await ai_client.chat(
            model=ai_client.resolve_gemini_model(MODEL_NAME),
            messages=[{"role": "user", "content": prompt}],
            fallback_models=[ai_client.resolve_gemini_model(m) for m in GEMINI_FALLBACK_MODELS],
            temperature=0.4,
            max_tokens=512,
            bot_id=bot_id,
            call_type="campaign_suggest",
        )
        raw = (response.choices[0].message.content or "").strip()
        if raw.startswith("```"):
            raw = raw.split("```", 2)[1].strip()
            raw = raw[4:].strip() if raw.lower().startswith("json") else raw
        data = json.loads(raw)
        trigger_type = str(data.get("trigger_type") or "time_on_page")
        campaign_type = str(data.get("campaign_type") or "chat_bubble")
        raw_steps = data.get("sequence_steps") if isinstance(data.get("sequence_steps"), list) else []
        # Reuse the public campaign contract for AI output. This keeps a draft
        # saveable even when a provider returns duplicate channels, string
        # delays, or an otherwise slightly malformed JSON shape.
        draft = CampaignCreateRequest(
            name=str(data.get("name") or "AI campaign")[:255],
            campaign_type=campaign_type,
            message_content=str(data.get("message_content") or "How can we help?")[:180],
            trigger_type=trigger_type,
            trigger_value=max(0, min(int(data.get("trigger_value") or 5), 86_400)),
            url_patterns=data.get("url_patterns") if isinstance(data.get("url_patterns"), list) else ["*"],
            sequence_steps=raw_steps,
        )
        return {
            "name": draft.name,
            "campaign_type": draft.campaign_type,
            "message_content": draft.message_content,
            "trigger_type": draft.trigger_type,
            "trigger_value": draft.trigger_value,
            "url_patterns": draft.url_patterns,
            "channels": draft.channels,
            "sequence_steps": draft.sequence_steps,
        }
    except Exception as exc:
        logger.exception("campaign suggestion failed: %s", exc)
        raise HTTPException(status_code=502, detail="Could not generate campaign suggestion") from exc


@router.post("/api/bots/{bot_id}/campaigns/audience-suggest")
async def suggest_campaign_audience(
    bot_id: str,
    body: CampaignSuggestRequest,
    user: dict[str, Any] = Depends(require_user),
):
    """Generate a conservative, explainable audience rule draft."""
    await verify_bot_permission(bot_id, user, "settings")
    prompt = (
        "Design one safe audience segment for a website campaign. Return ONLY JSON "
        "with keys segment, min_intent_score, returning_only, rationale. segment must "
        "be all, returning, or high_intent; min_intent_score must be 0-100; rationale "
        "must be under 240 characters.\n"
        f"Goal: {body.goal}\nCurrent audience context: {body.audience or 'all visitors'}"
    )
    try:
        response = await ai_client.chat(
            model=ai_client.resolve_gemini_model(MODEL_NAME),
            messages=[{"role": "user", "content": prompt}],
            fallback_models=[ai_client.resolve_gemini_model(m) for m in GEMINI_FALLBACK_MODELS],
            temperature=0.2,
            max_tokens=256,
            bot_id=bot_id,
            call_type="campaign_audience_suggest",
        )
        raw = (response.choices[0].message.content or "").strip()
        if raw.startswith("```"):
            raw = raw.split("```", 2)[1].strip()
            raw = raw[4:].strip() if raw.lower().startswith("json") else raw
        data = json.loads(raw)
        segment = str(data.get("segment") or "all").lower()
        if segment not in {"all", "returning", "high_intent"}:
            segment = "all"
        score = max(0, min(int(data.get("min_intent_score") or 0), 100))
        return {
            "audience_rules": {
                "segment": segment,
                "min_intent_score": score,
                "returning_only": bool(data.get("returning_only", segment == "returning")),
            },
            "rationale": str(data.get("rationale") or "Targets visitors most likely to engage.")[:240],
        }
    except Exception as exc:
        logger.exception("campaign audience suggestion failed: %s", exc)
        raise HTTPException(status_code=502, detail="Could not generate audience suggestion") from exc


@router.get("/api/bots/{bot_id}/campaigns/{campaign_id}/analytics")
async def campaign_analytics(bot_id: str, campaign_id: str, user: dict[str, Any] = Depends(require_user)):
    """Return recomputable campaign telemetry and conversion rates."""
    await verify_bot_permission(bot_id, user, "settings")
    campaign = await run_db(lambda: supabase.table("chatty_campaigns").select("id, name").eq(
        "id", campaign_id).eq("bot_id", bot_id).maybe_single().execute())
    if not campaign.data:
        raise HTTPException(status_code=404, detail="Campaign not found")
    events = await run_db(lambda: supabase.table("chatty_campaign_events").select(
        "event_type, metadata, created_at"
    ).eq("campaign_id", campaign_id).order("created_at", desc=True).limit(10000).execute())
    counts = aggregate_campaign_events(events.data or [])
    # Delivery analytics roll out independently from the existing telemetry
    # table; keep campaign analytics readable during a staged migration.
    try:
        deliveries = await run_db(lambda: supabase.table("chatty_campaign_deliveries").select(
            "status, channel, error, updated_at"
        ).eq("campaign_id", campaign_id).order("updated_at", desc=True).limit(10000).execute())
        counts.update(aggregate_campaign_deliveries(deliveries.data or []))
    except Exception as exc:
        logger.warning("campaign delivery ledger unavailable: %s", exc)
        counts.update(aggregate_campaign_deliveries([]))
    return {
        "campaign_id": campaign_id,
        "name": campaign.data.get("name"),
        **counts,
    }


@router.get("/api/bots/{bot_id}/campaigns/{campaign_id}/schedule-preview")
async def campaign_schedule_preview(bot_id: str, campaign_id: str, user: dict[str, Any] = Depends(require_user)):
    """Return the next deterministic cadence occurrence for operators/workers."""
    await verify_bot_permission(bot_id, user, "settings")
    campaign = await run_db(lambda: supabase.table("chatty_campaigns").select(
        "id, name, is_active, start_date, end_date, created_at, schedule_config"
    ).eq("id", campaign_id).eq("bot_id", bot_id).maybe_single().execute())
    if not campaign.data:
        raise HTTPException(status_code=404, detail="Campaign not found")
    next_run = next_campaign_run_at(campaign.data) if campaign.data.get("is_active") is not False else None
    return {
        "campaign_id": campaign_id,
        "name": campaign.data.get("name"),
        "is_active": campaign.data.get("is_active") is not False,
        "schedule_config": campaign.data.get("schedule_config") or {},
        "next_run_at": next_run.isoformat() if next_run else None,
    }


@router.get("/api/bots/{bot_id}/campaigns/{campaign_id}/deliveries")
async def campaign_delivery_history(
    bot_id: str,
    campaign_id: str,
    limit: int = Query(100, ge=1, le=200),
    user: dict[str, Any] = Depends(require_user),
    status: str | None = Query(None, pattern="^(queued|sent|failed|suppressed)$"),
):
    """Return sanitized provider delivery attempts for operator troubleshooting."""
    await verify_bot_permission(bot_id, user, "settings")
    campaign = await run_db(lambda: supabase.table("chatty_campaigns").select("id").eq(
        "id", campaign_id).eq("bot_id", bot_id).maybe_single().execute())
    if not campaign.data:
        raise HTTPException(status_code=404, detail="Campaign not found")
    try:
        def query_deliveries():
            query = supabase.table("chatty_campaign_deliveries").select(
                "id, idempotency_key, status, channel, recipient_id, error, queued_at, sent_at, updated_at"
            ).eq("campaign_id", campaign_id).eq("bot_id", bot_id)
            if status:
                query = query.eq("status", status)
            return query.order("updated_at", desc=True).limit(limit).execute()

        result = await run_db(query_deliveries)
    except Exception as exc:
        logger.warning("campaign delivery history unavailable: %s", exc)
        return {"campaign_id": campaign_id, "available": False, "deliveries": []}
    return {"campaign_id": campaign_id, "available": True, "deliveries": result.data or []}


@router.get("/api/bots/{bot_id}/campaigns/{campaign_id}/dispatch-plan")
async def campaign_dispatch_plan(bot_id: str, campaign_id: str, user: dict[str, Any] = Depends(require_user)):
    """Return the bounded, idempotent channel jobs for the current occurrence.

    This is an operator/worker contract: it does not send messages. A
    scheduler can enqueue the returned jobs on the durable Redis stream after
    applying its own recipient and consent lookup.
    """
    await verify_bot_permission(bot_id, user, "settings")
    campaign = await run_db(lambda: supabase.table("chatty_campaigns").select("*").eq(
        "id", campaign_id).eq("bot_id", bot_id).maybe_single().execute())
    if not campaign.data:
        raise HTTPException(status_code=404, detail="Campaign not found")
    try:
        jobs = build_campaign_dispatch_plan(campaign.data)
        provider_jobs = [job for job in jobs if str((job.get("payload") or {}).get("channel") or "web").lower() != "web"]
        rules = campaign.data.get("audience_rules") if isinstance(campaign.data.get("audience_rules"), dict) else {}
        if provider_jobs and str(rules.get("recipient_source") or "widget").strip().lower() == "consented_leads":
            recipients = await load_consented_lead_recipients(
                supabase, bot_id, audience_rules=rules, limit=100
            )
            jobs = []
            for recipient in recipients:
                jobs.extend(build_campaign_dispatch_plan(campaign.data, recipient=recipient))
            # Never expose contact details in an operator preview response.
            for job in jobs:
                payload = job.get("payload") if isinstance(job.get("payload"), dict) else {}
                recipient = payload.get("recipient") if isinstance(payload.get("recipient"), dict) else {}
                payload["recipient"] = {
                    "id": str(recipient.get("id") or ""),
                    "consent": bool(recipient.get("consent")),
                    "has_email": bool(str(recipient.get("email") or "").strip()),
                    "has_phone": bool(str(recipient.get("phone") or "").strip()),
                }
        elif provider_jobs:
            return {"campaign_id": campaign_id, "jobs": jobs, "deferred": True, "deferred_reason": "provider delivery requires consented_leads recipient source"}
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return {"campaign_id": campaign_id, "jobs": jobs}


@router.patch("/api/bots/{bot_id}/campaigns/{campaign_id}")
async def update_dashboard_campaign(
    bot_id: str,
    campaign_id: str,
    body: CampaignUpdateRequest,
    user: dict[str, Any] = Depends(require_user),
):
    await verify_bot_permission(bot_id, user, "settings")
    existing = await run_db(lambda: supabase.table("chatty_campaigns").select(
        "start_date, end_date, channels, sequence_steps"
    ).eq(
        "id", campaign_id).eq("bot_id", bot_id).maybe_single().execute())
    if not existing.data:
        raise HTTPException(status_code=404, detail="Campaign not found")
    column_map = {"campaign_type": "type", "message_content": "message"}
    updates = {
        column_map.get(key, key): value
        for key, value in body.model_dump(exclude_unset=True).items()
        if value is not None
    }
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    # Keep the persisted channel list authoritative when an operator edits
    # only the sequence. Otherwise a newly added email/SMS step can be saved
    # but never scheduled because the campaign's top-level channels remain
    # stale. Merge both sources and fail closed at the same four-channel
    # contract used by CampaignCreateRequest.
    if "sequence_steps" in updates or "channels" in updates:
        raw_channels = updates.get("channels", existing.data.get("channels") or [])
        raw_steps = updates.get("sequence_steps", existing.data.get("sequence_steps") or [])
        step_channels = [
            str(step.get("channel") or "").strip().lower()
            for step in raw_steps
            if isinstance(step, dict) and str(step.get("channel") or "").strip()
        ]
        merged_channels = list(dict.fromkeys([
            *(str(channel).strip().lower() for channel in raw_channels),
            *step_channels,
        ]))
        if len(merged_channels) > 4:
            raise HTTPException(status_code=422, detail="a campaign may use at most four channels")
        updates["channels"] = merged_channels
    merged_start = updates.get("start_date", existing.data.get("start_date"))
    merged_end = updates.get("end_date", existing.data.get("end_date"))
    start = _parse_campaign_datetime(merged_start, "start_date")
    end = _parse_campaign_datetime(merged_end, "end_date")
    if start and end and start >= end:
        raise HTTPException(status_code=422, detail="start_date must be earlier than end_date")
    result = await run_db(lambda: supabase.table("chatty_campaigns").update(updates).eq(
        "id", campaign_id).eq("bot_id", bot_id).execute())
    if not result.data:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return result.data[0]


@router.delete("/api/bots/{bot_id}/campaigns/{campaign_id}")
async def delete_dashboard_campaign(
    bot_id: str,
    campaign_id: str,
    user: dict[str, Any] = Depends(require_user),
):
    await verify_bot_permission(bot_id, user, "settings")
    result = await run_db(lambda: supabase.table("chatty_campaigns").delete().eq(
        "id", campaign_id).eq("bot_id", bot_id).execute())
    if not result.data:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return {"deleted": True, "campaign_id": campaign_id}


def _dashboard_bot_columns() -> str:
    """Return the dashboard-safe bot projection."""
    return "*"


@router.get("/api/bots")
async def list_dashboard_bots(user: dict[str, Any] = Depends(require_user)):
    """List bots visible to the dashboard's authenticated user.

    This endpoint is intentionally separate from `/api/v1/bots`: the latter
    is the public OAuth API and must keep its OAuth scopes/response contract.
    Dashboard authentication is the browser's OIDC/Supabase session instead.
    """

    result = await run_db(lambda: supabase.table("chatty_bots").select(_dashboard_bot_columns()).order(
        "updated_at", desc=True
    ).execute())
    return result.data or []


@router.post("/api/bots", status_code=201)
async def create_dashboard_bot(
    body: dict[str, Any] = Body(...),
    user: dict[str, Any] = Depends(require_user),
):
    """Create a dashboard bot without exposing the public OAuth API."""
    name = str(body.get("name") or "").strip()
    if not name or len(name) > 100:
        raise HTTPException(status_code=422, detail="name must be between 1 and 100 characters")
    allowed_domains = body.get("allowed_domains") or []
    if not isinstance(allowed_domains, list) or len(allowed_domains) > 100:
        raise HTTPException(status_code=422, detail="allowed_domains must be a list")
    row = {
        "user_id": user["auth_user_id"],
        "name": name,
        "welcome_message": "Hello! How can I help you today?",
        "primary_color": "#f97316",
        "widget_style": "minimal",
        "send_button_style": "plane",
        "selected_model": "gemini",
        "system_instructions": "You are a helpful customer support agent for my business. You must only answer questions based on the provided knowledge. Be concise and polite.",
        "strict_mode": True,
        "email_notify": True,
        "allowed_domains": allowed_domains,
        "onboarding_step": 9,
        "onboarding_completed": True,
    }

    created = await run_db(lambda: supabase.table("chatty_bots").insert(row).execute())
    if not created.data:
        raise HTTPException(status_code=500, detail="Failed to create bot")
    return created.data[0]


@router.delete("/api/bots/{bot_id}")
async def delete_dashboard_bot(bot_id: str, user: dict[str, Any] = Depends(require_user)):
    """Delete an owned dashboard bot; team members can never delete it."""

    result = await run_db(lambda: supabase.table("chatty_bots").delete().eq(
        "id", bot_id
    ).eq("user_id", user["auth_user_id"]).execute())
    if not result.data:
        raise HTTPException(status_code=404, detail="Bot not found")
    return {"ok": True}


_DASHBOARD_BOT_UPDATE_FIELDS = frozenset({
    "name", "welcome_message", "conversation_starters", "teaser_message", "primary_color",
    "color_scheme", "widget_style", "font_family", "font_size_percent", "panel_size",
    "send_button_style", "avatar_icon", "avatar_url", "logo_url", "selected_model",
    "system_instructions", "strict_mode", "answer_mode", "email_notify", "hide_branding",
    "show_sender_tag", "csat_enabled", "voice_message_mode", "webhook_url", "notification_emails",
    "custom_css", "custom_js", "response_language", "guardrail_topics", "guardrail_block_profanity",
    "guardrail_refusal_message", "sync_google_drive", "sync_google_calendar", "google_connected_account_id",
    "google_calendar_id", "google_calendar_name", "google_calendar_color", "google_drive_folder_id",
    "google_drive_folder_name", "sync_outlook_calendar", "sync_office365_calendar",
    "calendar_scheduling_enabled", "scheduling_duration_minutes", "bot_timezone", "bot_country",
    "meeting_provider", "business_hours_start", "business_hours_end", "working_days", "buffer_minutes",
    "advance_notice_hours", "max_daily_meetings", "max_weekly_meetings", "booking_email_verification",
    "booking_block_disposable_emails", "booking_limit_one_active", "booking_require_business_email",
    "allowed_domains", "voice_enabled", "voice_stt_provider", "voice_tts_provider", "voice_tts_voice",
    "whatsapp_enabled", "whatsapp_phone_number_id", "whatsapp_waba_id", "whatsapp_access_token",
    "whatsapp_verify_token", "whatsapp_app_secret", "whatsapp_quick_replies", "onboarding_step",
    "onboarding_completed", "lead_fields", "lead_capture_enabled", "lead_required_fields",
})


@router.patch("/api/bots/{bot_id}")
async def update_dashboard_bot(
    bot_id: str,
    body: dict[str, Any] = Body(...),
    user: dict[str, Any] = Depends(require_user),
):
    """Update dashboard configuration using a strict column allow-list."""
    # Match the dashboard's team-access model: owners and members explicitly
    # authorized for either the design or settings surface may edit widget
    # configuration; read-only/agent members may not.
    role, permissions = await get_bot_role_and_permissions(bot_id, user)
    if role != "owner" and not ({"design", "settings"} & set(permissions)):
        raise HTTPException(status_code=403, detail="You don't have access to widget settings for this bot")
    updates = {key: value for key, value in body.items() if key in _DASHBOARD_BOT_UPDATE_FIELDS}
    if not updates:
        raise HTTPException(status_code=400, detail="No supported fields to update")
    result = await run_db(lambda: supabase.table("chatty_bots").update(updates).eq(
        "id", bot_id
    ).eq("user_id", user["auth_user_id"]).execute())
    updated = result.data[0] if result.data else None
    if not updated:
        raise HTTPException(status_code=404, detail="Bot not found")
    return updated


@router.get("/api/bots/{bot_id}")
async def get_dashboard_bot(bot_id: str, user: dict[str, Any] = Depends(require_user)):
    """Return one complete dashboard bot configuration after access checks."""
    await get_bot_role_and_permissions(bot_id, user)
    result = await run_db(lambda: supabase.table("chatty_bots").select("*").eq("id", bot_id).limit(1).execute())
    if not result.data:
        raise HTTPException(status_code=404, detail="Bot not found")
    return result.data[0]


@router.get("/api/bots/{bot_id}/leads")
async def list_dashboard_leads(bot_id: str, user: dict[str, Any] = Depends(require_user)):
    """Return lead rows for the dashboard's owner/team-accessible bot."""
    await get_bot_role_and_permissions(bot_id, user)
    result = await run_db(lambda: supabase.table("chatty_leads").select("*").eq(
        "bot_id", bot_id
    ).order("created_at", desc=True).execute())
    return {"leads": result.data or []}


@router.get("/api/bots/{bot_id}/dashboard-analytics")
async def dashboard_analytics(bot_id: str, user: dict[str, Any] = Depends(require_user)):
    """Return the small, aggregate dataset used by the dashboard home tab."""
    await get_bot_role_and_permissions(bot_id, user)
    raise HTTPException(status_code=404, detail="Use managed dashboard data path")



@router.patch("/api/bots/{bot_id}/leads/{lead_id}")
async def update_dashboard_lead(
    bot_id: str,
    lead_id: str,
    body: dict[str, Any] = Body(...),
    user: dict[str, Any] = Depends(require_user),
):
    await get_bot_role_and_permissions(bot_id, user)
    result = await run_db(lambda: supabase.table("chatty_leads").update(body).eq(
        "id", lead_id
    ).eq("bot_id", bot_id).execute())
    if not result.data:
        raise HTTPException(status_code=404, detail="Lead not found")
    return result.data[0]


@router.delete("/api/bots/{bot_id}/leads/{lead_id}")
async def delete_dashboard_lead(bot_id: str, lead_id: str, user: dict[str, Any] = Depends(require_user)):
    await get_bot_role_and_permissions(bot_id, user)
    result = await run_db(lambda: supabase.table("chatty_leads").delete().eq(
        "id", lead_id
    ).eq("bot_id", bot_id).execute())
    if not result.data:
        raise HTTPException(status_code=404, detail="Lead not found")
    return {"ok": True}


@router.get("/api/bots/{bot_id}/unanswered")
async def list_dashboard_unanswered(bot_id: str, user: dict[str, Any] = Depends(require_user)):
    await get_bot_role_and_permissions(bot_id, user)
    result = await run_db(lambda: supabase.table("chatty_unanswered").select(
        "id, question, created_at"
    ).eq("bot_id", bot_id).eq("status", "open").order("created_at", desc=True).limit(50).execute())
    return {"items": result.data or []}


@router.patch("/api/bots/{bot_id}/unanswered/{item_id}")
async def update_dashboard_unanswered(
    bot_id: str,
    item_id: str,
    body: dict[str, Any] = Body(...),
    user: dict[str, Any] = Depends(require_user),
):
    await get_bot_role_and_permissions(bot_id, user)
    status = body.get("status")
    if status not in {"open", "dismissed", "resolved"}:
        raise HTTPException(status_code=422, detail="Invalid unanswered status")
    result = await run_db(lambda: supabase.table("chatty_unanswered").update({"status": status}).eq(
        "id", item_id
    ).eq("bot_id", bot_id).execute())
    return {"ok": bool(result.data)}


@router.get("/api/bots/shared")
async def list_shared_bots(user: dict[str, Any] = Depends(require_user)):
    """Bots the caller can access as a team member (not owner). Sensitive fields
    (e.g. BYOK keys) are stripped."""
    email = (user.get("email") or "").strip().lower()
    if not email:
        return {"bots": []}
    memberships = (await run_db(lambda: supabase.table("chatty_team_members").select(
        "bot_id, role").eq("email", email).execute())).data or []
    if not memberships:
        return {"bots": []}
    role_by_bot = {m["bot_id"]: m["role"] for m in memberships}
    bots = (await run_db(lambda: supabase.table("chatty_bots").select(
        "id, name, primary_color, widget_style, welcome_message, avatar_icon, avatar_url"
    ).in_("id", list(role_by_bot.keys())).execute())).data or []
    for b in bots:
        b["_role"] = role_by_bot.get(b["id"], "agent")
    return {"bots": bots}


@router.get("/api/bots/{bot_id}/sources")
async def get_bot_sources(bot_id: str, user: dict[str, Any] = Depends(require_user)):
    """Return knowledge sources for a bot if the caller is the owner or an authorized team member.
    Allows all team members with bot access to view sources for dashboard stats & playground,
    bypassing direct Supabase RLS which gates writes on the 'sources' tab permission."""
    from app.core.permissions import get_bot_role_and_permissions
    await get_bot_role_and_permissions(bot_id, user)
    res = await run_db(lambda: supabase.table("chatty_sources").select(
        "id, type, name, content, status, char_count, crawl_schedule, next_crawl_at, created_at"
    ).eq("bot_id", bot_id).order("created_at", desc=False).execute())
    return {"sources": res.data or []}


@router.post("/api/bots/{bot_id}/sources", status_code=201)
async def create_bot_source(
    bot_id: str,
    body: dict[str, Any] = Body(...),
    user: dict[str, Any] = Depends(require_user),
):
    await get_bot_role_and_permissions(bot_id, user)
    source = {
        "bot_id": bot_id,
        "type": str(body.get("type") or "text"),
        "name": str(body.get("name") or "Untitled")[:255],
        "content": str(body.get("content") or ""),
        "status": str(body.get("status") or "trained"),
        "char_count": int(body.get("char_count") or len(str(body.get("content") or ""))),
    }
    if not source["content"]:
        raise HTTPException(status_code=422, detail="content is required")
    result = await run_db(lambda: supabase.table("chatty_sources").insert(source).execute())
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create source")
    return result.data[0]


@router.post("/api/bot/logo")
async def upload_bot_logo(
    bot_id: str = Form(...),
    file: UploadFile = File(...),
    user: dict[str, Any] = Depends(require_user),
):
    res = await run_db(lambda: supabase.table("chatty_bots").select("id").eq("id", bot_id).eq(
        "user_id", user["auth_user_id"]).execute())
    authorized = bool(res.data)
    if not authorized:
        raise HTTPException(status_code=403, detail="Unauthorized")
    data = await read_upload_capped(file, 10 * 1024 * 1024, detail="Logo must be under 10MB")
    if not data:
        raise HTTPException(status_code=400, detail="Logo must be a non-empty image under 10MB")
    mime = (file.content_type or "image/png").split(";")[0]
    if not mime.startswith("image/"):
        raise HTTPException(status_code=400, detail="Logo must be an image")
    import uuid as _uuid
    ext = (file.filename or "logo.png").split(".")[-1][:8]
    path = f"logos/{bot_id}/{_uuid.uuid4().hex[:8]}.{ext}"
    try:
        def _upload():
            supabase.storage.from_("chatty-uploads").upload(path, data, {"content-type": mime})
            url = supabase.storage.from_("chatty-uploads").get_public_url(path)
            supabase.table("chatty_bots").update({"logo_url": url}).eq("id", bot_id).execute()
            return url
        url = await run_db(_upload)
        return {"logo_url": url}
    except Exception as e:
        logger.exception("Logo upload failed")
        raise HTTPException(status_code=500, detail="Logo upload failed") from e


@router.post("/api/bot/avatar")
async def upload_bot_avatar(
    bot_id: str = Form(...),
    file: UploadFile = File(...),
    user: dict[str, Any] = Depends(require_user),
):
    """Upload a custom assistant avatar image (separate from the header logo)."""
    res = await run_db(lambda: supabase.table("chatty_bots").select("id").eq("id", bot_id).eq(
        "user_id", user["auth_user_id"]).execute())
    authorized = bool(res.data)
    if not authorized:
        raise HTTPException(status_code=403, detail="Unauthorized")
    data = await read_upload_capped(file, 10 * 1024 * 1024, detail="Avatar must be under 10MB")
    if not data:
        raise HTTPException(status_code=400, detail="Avatar must be a non-empty image under 10MB")
    mime = (file.content_type or "image/png").split(";")[0]
    if not mime.startswith("image/"):
        raise HTTPException(status_code=400, detail="Avatar must be an image")
    import uuid as _uuid
    ext = (file.filename or "avatar.png").split(".")[-1][:8]
    path = f"avatars/{bot_id}/{_uuid.uuid4().hex[:8]}.{ext}"
    try:
        def _upload():
            supabase.storage.from_("chatty-uploads").upload(path, data, {"content-type": mime})
            url = supabase.storage.from_("chatty-uploads").get_public_url(path)
            supabase.table("chatty_bots").update({"avatar_url": url, "avatar_icon": "custom"}).eq("id", bot_id).execute()
            return url
        url = await run_db(_upload)
        return {"avatar_url": url}
    except Exception as e:
        logger.exception("Avatar upload failed")
        raise HTTPException(status_code=500, detail="Avatar upload failed") from e


@router.get("/api/user/profile")
@router.get("/api/agent/profile")
async def get_user_profile(user: dict[str, Any] = Depends(require_user)):
    """Get current user's profile (photo, name, email)."""
    user_id = user["auth_user_id"]
    email = user.get("email", "")
    display_name = user.get("display_name")
    avatar_url = user.get("avatar_url")
    row: dict[str, Any] | None = None

    try:
        res = await run_db(lambda: supabase.table("users").select(
            "display_name, avatar_url, email, plan, subscription_status, subscription_renews_at, role"
        ).eq("auth_user_id", user_id).limit(1).execute())
        row = res.data[0] if res.data else None
        if row:
            display_name = row.get("display_name") or display_name
            avatar_url = row.get("avatar_url") or avatar_url
    except Exception as e:
        logger.warning("Could not read users table for profile: %s", e)

    if not display_name and email:
        display_name = email.split("@")[0].capitalize()

    return {
        "user_id": user_id,
        "email": email,
        "display_name": display_name or "User",
        "avatar_url": avatar_url,
        "role": (row or {}).get("role") or user.get("role") or "user",
        "role_title": "Team Member",
        "plan": (row or {}).get("plan") or "free",
        "subscription_status": (row or {}).get("subscription_status"),
        "subscription_renews_at": (row or {}).get("subscription_renews_at"),
    }


@router.post("/api/user/profile")
@router.post("/api/agent/profile")
async def update_user_profile(
    body: dict[str, Any],
    user: dict[str, Any] = Depends(require_user),
):
    """Update user profile (display name, avatar url) in users and team members tables."""
    user_id = user["auth_user_id"]
    email = user.get("email") or ""
    display_name = (body.get("display_name") or "").strip()
    avatar_url = body.get("avatar_url")

    updates: dict[str, Any] = {}
    if display_name:
        updates["display_name"] = display_name
    if "avatar_url" in body:
        updates["avatar_url"] = avatar_url

    if updates:
        try:
            await run_db(lambda: supabase.table("users").update(updates).eq("auth_user_id", user_id).execute())
        except Exception as e:
            logger.warning("Failed to update users table: %s", e)

        if email:
            try:
                tm_updates: dict[str, Any] = {}
                if display_name:
                    tm_updates["name"] = display_name
                if "avatar_url" in body:
                    tm_updates["avatar_url"] = avatar_url
                if tm_updates:
                    await run_db(lambda: supabase.table("chatty_team_members").update(tm_updates).eq("email", email).execute())
            except Exception as e:
                logger.warning("Failed to sync team member profile: %s", e)

    return {
        "user_id": user_id,
        "email": email,
        "display_name": display_name or user.get("display_name") or (email.split("@")[0].capitalize() if email else "User"),
        "avatar_url": avatar_url,
        "role_title": "Team Member",
    }


@router.post("/api/user/avatar")
@router.post("/api/agent/avatar")
async def upload_user_avatar(
    file: UploadFile = File(...),
    display_name: str = Form(""),
    role_title: str = Form(""),
    user: dict[str, Any] = Depends(require_user),
):
    """Upload user profile photo and store in Supabase storage & users table."""
    user_id = user["auth_user_id"]
    email = user.get("email") or ""
    data = await read_upload_capped(file, 10 * 1024 * 1024, detail="Photo must be under 10MB")
    if not data:
        raise HTTPException(status_code=400, detail="Photo must be a non-empty image under 10MB")
    mime = (file.content_type or "image/png").split(";")[0]
    if not mime.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")
    import uuid as _uuid
    ext = (file.filename or "avatar.png").split(".")[-1][:8]
    path = f"avatars/users/{user_id}/{_uuid.uuid4().hex[:8]}.{ext}"

    try:
        def _upload():
            # Try chatty-uploads bucket, fallback to chatty_assets if needed
            try:
                supabase.storage.from_("chatty-uploads").upload(path, data, {"content-type": mime})
                url = supabase.storage.from_("chatty-uploads").get_public_url(path)
            except Exception as bucket_err:
                logger.warning("chatty-uploads upload error: %s, falling back to chatty_assets", bucket_err)
                supabase.storage.from_("chatty_assets").upload(path, data, {"content-type": mime})
                url = supabase.storage.from_("chatty_assets").get_public_url(path)

            upd: dict[str, Any] = {"avatar_url": url}
            if display_name:
                upd["display_name"] = display_name
            supabase.table("users").update(upd).eq("auth_user_id", user_id).execute()

            if email:
                tm_upd: dict[str, Any] = {"avatar_url": url}
                if display_name:
                    tm_upd["name"] = display_name
                try:
                    supabase.table("chatty_team_members").update(tm_upd).eq("email", email).execute()
                except Exception:
                    pass

            return url

        url = await run_db(_upload)
        return {"avatar_url": url}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("User photo upload failed: %s", e)
        raise HTTPException(status_code=500, detail="User photo upload failed") from e


@router.post("/api/generate-business")
async def generate_business(
    req: GenerateBusinessRequest,
    user: dict[str, Any] = Depends(require_user),
):
    """AI-generate a business description, support persona instructions, and a
    welcome message from a short hint (business name / URL / one-liner)."""
    res = await run_db(lambda: supabase.table("chatty_bots").select("id").eq("id", req.bot_id).eq(
        "user_id", user["auth_user_id"]).execute())
    if not res.data:
        raise HTTPException(status_code=403, detail="Unauthorized")

    prompt = (
        "You are helping configure an AI customer-support assistant. Based on the hint below, "
        "produce a JSON object with EXACTLY these keys:\n"
        '  "description": a concise 2-3 sentence description of the business, what it sells, and who its customers are.\n'
        '  "system_instructions": clear support-agent guidelines for this specific business (tone, what to help with, what to avoid).\n'
        '  "welcome_message": a short friendly first message the chat assistant shows visitors.\n'
        "Return ONLY raw JSON, no markdown, no commentary.\n\n"
        f"Hint: {req.hint or 'A small business that wants a helpful website support assistant.'}"
    )
    try:
        response = await ai_client.chat(
            model=ai_client.resolve_gemini_model(MODEL_NAME),
            messages=[{"role": "user", "content": prompt}],
            fallback_models=[ai_client.resolve_gemini_model(m) for m in GEMINI_FALLBACK_MODELS],
            temperature=0.6,
            max_tokens=1024,
            bot_id=req.bot_id,
            call_type="generate_business",
        )
        raw = (response.choices[0].message.content or "").strip()
        if raw.startswith("```"):
            raw = raw.split("```", 2)[1] if "```" in raw else raw
            raw = raw.replace("json", "", 1).strip() if raw.lower().startswith("json") else raw
        data = json.loads(raw)
        return {
            "description": str(data.get("description", ""))[:2000],
            "system_instructions": str(data.get("system_instructions", ""))[:2000],
            "welcome_message": str(data.get("welcome_message", ""))[:300],
        }
    except Exception:
        logger.exception("generate-business failed")
        raise HTTPException(status_code=502, detail="Could not generate. Please try again.")


@router.post("/api/bots/{bot_id}/generate-voice-welcome")
async def generate_voice_welcome(
    bot_id: str,
    user: dict[str, Any] = Depends(require_user),
):
    """Generate a short voice greeting from the bot's current profile and KB."""
    await verify_bot_permission(bot_id, user, "settings")
    # Keep this endpoint compatible with installations that predate the optional
    # profile-description column.  The welcome prompt already works without it,
    # and selecting a missing column would fail before generation starts.
    bot_res = await run_db(lambda: supabase.table("chatty_bots").select(
        "name, system_instructions, welcome_message"
    ).eq("id", bot_id).limit(1).execute())
    if not bot_res.data:
        raise HTTPException(status_code=404, detail="Bot not found")
    bot = bot_res.data[0]
    source_res = await run_db(lambda: supabase.table("chatty_sources").select(
        "name, content"
    ).eq("bot_id", bot_id).eq("status", "trained").order("created_at", desc=False).limit(20).execute())
    sources = source_res.data or []
    knowledge = "\n\n".join(
        f"[{s.get('name', 'Knowledge source')}]\n{str(s.get('content') or '')[:5000]}"
        for s in sources
    )[:30000]
    prompt = (
        "Write one concise, natural welcome message for a website voice assistant. "
        "Use the business profile and knowledge below. It must sound good when spoken aloud, "
        "be no more than two short sentences, invite the visitor to ask a question, and never "
        "claim capabilities that are not supported. Return only the message text.\n\n"
        f"Business: {bot.get('name') or 'the business'}\n"
        f"Description: {bot.get('description') or ''}\n"
        f"Instructions: {bot.get('system_instructions') or ''}\n"
        f"Knowledge base:\n{knowledge or '(no trained sources yet)'}"
    )
    try:
        response = await ai_client.chat(
            model=ai_client.resolve_gemini_model(MODEL_NAME),
            messages=[{"role": "user", "content": prompt}],
            fallback_models=[ai_client.resolve_gemini_model(m) for m in GEMINI_FALLBACK_MODELS],
            temperature=0.5,
            max_tokens=180,
            bot_id=bot_id,
            call_type="generate_voice_welcome",
        )
        message = (response.choices[0].message.content or "").strip().strip('"')[:300]
        if not message:
            raise ValueError("empty generated welcome")
        return {"welcome_message": message}
    except Exception as exc:
        logger.exception("generate voice welcome failed")
        raise HTTPException(status_code=502, detail="Could not generate a voice welcome right now.") from exc


@router.get("/api/bots/{bot_id}/byok")
async def get_byok_status(bot_id: str, user: dict[str, Any] = Depends(require_user)):
    """Never returns the decrypted key - only whether one is configured.
    Owner-only by default; a team member needs the 'byok' permission, which
    (unlike most tabs) only the owner can grant - see app.core.permissions."""
    await verify_bot_permission(bot_id, user, "byok")
    res = await run_db(lambda: supabase.table("chatty_bots").select("byok_provider, byok_model, byok_api_key_encrypted, user_id") \
        .eq("id", bot_id).execute())
    if not res.data:
        raise HTTPException(status_code=404, detail="Bot not found")
    row = res.data[0]
    return {
        "provider": row.get("byok_provider"),
        "model": row.get("byok_model"),
        "configured": bool(row.get("byok_api_key_encrypted")),
    }


@router.post("/api/bots/{bot_id}/byok")
async def set_byok(bot_id: str, req: BYOKUpdate, user: dict[str, Any] = Depends(require_user)):
    await verify_bot_permission(bot_id, user, "byok")

    if req.provider and req.provider not in ("openai", "anthropic", "openrouter"):
        raise HTTPException(status_code=400, detail="provider must be openai, anthropic, or openrouter")

    update: dict[str, Any] = {"byok_provider": req.provider or None, "byok_model": (req.model or None)}
    if req.api_key:
        update["byok_api_key_encrypted"] = llm_providers.encrypt_api_key(req.api_key)
    elif not req.provider:
        update["byok_api_key_encrypted"] = None  # clearing BYOK entirely

    await run_db(lambda: supabase.table("chatty_bots").update(update).eq("id", bot_id).execute())
    return {"success": True}


@router.get("/api/bots/{bot_id}/voice-settings")
async def get_voice_settings(bot_id: str, user: dict[str, Any] = Depends(require_user)):
    """Never returns decrypted BYOK keys - only whether one is configured."""
    await verify_bot_permission(bot_id, user, "voice")
    try:
        res = await run_db(lambda: supabase.table("chatty_bots").select(
            "voice_enabled, voice_mode, voice_stt_provider, voice_stt_byok_key_encrypted, "
            "voice_tts_provider, voice_tts_byok_key_encrypted, voice_tts_voice, "
            "voice_agent_role, voice_max_duration_minutes, "
            "voice_realtime_provider, voice_realtime_model, voice_realtime_byok_key_encrypted, "
            "user_id"
        ).eq("id", bot_id).execute())
    except Exception:
        # voice_mode/voice_realtime_*'s migration (20260829030000) may not be
        # applied to this environment yet - fall back to the columns that
        # are guaranteed to exist rather than 400ing the whole request.
        res = await run_db(lambda: supabase.table("chatty_bots").select(
            "voice_enabled, voice_stt_provider, voice_stt_byok_key_encrypted, "
            "voice_tts_provider, voice_tts_byok_key_encrypted, voice_tts_voice, "
            "voice_agent_role, voice_max_duration_minutes, user_id"
        ).eq("id", bot_id).execute())
    if not res.data:
        raise HTTPException(status_code=404, detail="Bot not found")
    row = res.data[0]
    return {
        "voice_enabled": bool(row.get("voice_enabled")),
        "voice_mode": row.get("voice_mode") or "pipeline",
        "voice_stt_provider": row.get("voice_stt_provider") or "google",
        "voice_tts_provider": row.get("voice_tts_provider") or "google",
        "voice_tts_voice": row.get("voice_tts_voice"),
        "voice_stt_configured": bool(row.get("voice_stt_byok_key_encrypted")),
        "voice_tts_configured": bool(row.get("voice_tts_byok_key_encrypted")),
        "voice_agent_role": row.get("voice_agent_role") or "general",
        "voice_max_duration_minutes": row.get("voice_max_duration_minutes") or 15,
        "voice_realtime_provider": row.get("voice_realtime_provider") or "google",
        "voice_realtime_model": row.get("voice_realtime_model"),
        "voice_realtime_configured": bool(row.get("voice_realtime_byok_key_encrypted")),
    }


@router.post("/api/bots/{bot_id}/voice-settings")
async def set_voice_settings(
    bot_id: str, req: VoiceSettingsUpdate, user: dict[str, Any] = Depends(require_user)
):
    await verify_bot_permission(bot_id, user, "voice")

    update: dict[str, Any] = {}
    if req.voice_enabled is not None:
        update["voice_enabled"] = req.voice_enabled
    if req.voice_mode is not None:
        if req.voice_mode not in ("pipeline", "realtime"):
            raise HTTPException(status_code=400, detail="voice_mode must be 'pipeline' or 'realtime'")
        update["voice_mode"] = req.voice_mode
    if req.voice_realtime_provider is not None:
        if req.voice_realtime_provider not in ("google", "openai"):
            raise HTTPException(status_code=400, detail="voice_realtime_provider must be 'google' or 'openai'")
        update["voice_realtime_provider"] = req.voice_realtime_provider
        if req.voice_realtime_provider == "google":
            update["voice_realtime_byok_key_encrypted"] = None  # no key needed for the default
    if req.voice_realtime_model is not None:
        update["voice_realtime_model"] = req.voice_realtime_model or None
    if req.voice_realtime_api_key is not None:
        update["voice_realtime_byok_key_encrypted"] = (
            llm_providers.encrypt_api_key(req.voice_realtime_api_key) if req.voice_realtime_api_key else None
        )
    if req.voice_stt_provider is not None:
        update["voice_stt_provider"] = req.voice_stt_provider
        if req.voice_stt_provider == "google":
            update["voice_stt_byok_key_encrypted"] = None  # no key needed for the default
    if req.voice_tts_provider is not None:
        update["voice_tts_provider"] = req.voice_tts_provider
        if req.voice_tts_provider == "google":
            update["voice_tts_byok_key_encrypted"] = None
    if req.voice_tts_voice is not None:
        update["voice_tts_voice"] = req.voice_tts_voice or None
    if req.voice_stt_api_key is not None:
        update["voice_stt_byok_key_encrypted"] = (
            llm_providers.encrypt_api_key(req.voice_stt_api_key) if req.voice_stt_api_key else None
        )
    if req.voice_tts_api_key is not None:
        update["voice_tts_byok_key_encrypted"] = (
            llm_providers.encrypt_api_key(req.voice_tts_api_key) if req.voice_tts_api_key else None
        )
    if req.voice_agent_role is not None:
        update["voice_agent_role"] = req.voice_agent_role
    if req.voice_max_duration_minutes is not None:
        update["voice_max_duration_minutes"] = max(1, min(60, req.voice_max_duration_minutes))

    if update:
        try:
            await run_db(lambda: supabase.table("chatty_bots").update(update).eq("id", bot_id).execute())
        except Exception as e:
            logger.exception("Failed to update voice settings for bot %s: %s", bot_id, e)
            raise HTTPException(status_code=500, detail=f"Database update failed: {str(e)}")
    return {"success": True}


@router.get("/api/bots/{bot_id}/webhooks")
async def dashboard_list_webhooks(bot_id: str, user: dict[str, Any] = Depends(require_user)):
    await verify_bot_permission(bot_id, user, "webhooks")
    res = await run_db(lambda: supabase.table("chatty_webhooks").select(
        "id, url, events, active, created_at"
    ).eq("bot_id", bot_id).order("created_at", desc=True).execute())
    return {"webhooks": res.data or []}


@router.post("/api/bots/{bot_id}/webhooks")
async def dashboard_create_webhook(
    bot_id: str, req: DashboardWebhookCreateRequest, user: dict[str, Any] = Depends(require_user)
):
    await verify_bot_permission(bot_id, user, "webhooks")
    url = (req.url or "").strip()
    if not url.startswith(("http://", "https://")):
        raise HTTPException(status_code=400, detail="url must be a valid http(s) URL")
    try:
        await assert_safe_url_async(url)
    except UnsafeURLError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid url: {exc}") from exc
    events = [e for e in (req.events or []) if e in notify.WEBHOOK_EVENTS]
    if not events:
        raise HTTPException(
            status_code=400,
            detail=f"events must include at least one of: {', '.join(notify.WEBHOOK_EVENTS)}",
        )
    secret = f"whsec_{secrets.token_hex(24)}"
    row = await run_db(lambda: supabase.table("chatty_webhooks").insert({
        "bot_id": bot_id, "url": url, "events": events, "secret": secret, "active": True,
    }).execute())
    return row.data[0] if row.data else {"url": url, "events": events, "secret": secret}


@router.delete("/api/bots/{bot_id}/webhooks/{webhook_id}")
async def dashboard_delete_webhook(
    bot_id: str, webhook_id: str, user: dict[str, Any] = Depends(require_user)
):
    await verify_bot_permission(bot_id, user, "webhooks")
    res = await run_db(lambda: supabase.table("chatty_webhooks").select("id").eq("id", webhook_id).eq("bot_id", bot_id).execute())
    if not res.data:
        raise HTTPException(status_code=404, detail="Webhook not found")
    await run_db(lambda: supabase.table("chatty_webhooks").delete().eq("id", webhook_id).execute())
    return {"success": True, "deleted_id": webhook_id}


@router.get("/api/capabilities")
async def get_capabilities(user: dict[str, Any] = Depends(require_user)):
    """Report which optional integrations are configured on the backend so the
    UI can gate provider choices."""
    from plugins import notifications as _notify
    from plugins import zoom_integration as _zoom
    return {
        "onesignal_configured": _notify.onesignal_configured(),
        "zoom_configured": _zoom.zoom_configured(),
        "deployment_profile": "managed_supabase",
    }
