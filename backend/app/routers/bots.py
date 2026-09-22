"""Bot management endpoints: shared-bot listing, logo/avatar upload, AI business
generation, BYOK config, dashboard webhook management, and capability
discovery (/api/bots/*, /api/bot/*, /api/generate-business, /api/capabilities)."""

from __future__ import annotations

import logging
import secrets
from typing import Any

from fastapi import APIRouter, Body, Depends, File, Form, HTTPException, UploadFile
from psycopg2.extras import Json, RealDictCursor

from app.core.clients import supabase
from app.core.config import DEPLOYMENT_PROFILE, MODEL_NAME
from app.core.db import (
    get_bot,
    get_user,
    run_db,
    update_bot_fields,
    update_team_member_fields,
    update_user_fields,
)
from app.core.deps import require_user
from app.core.object_store import delete_object, put_bytes
from app.core.db_pool import connection
from app.core.permissions import get_bot_role_and_permissions, verify_bot_permission
from app.core.ssrf import UnsafeURLError, assert_safe_url_async
from app.core.uploads import read_upload_capped
from app.schemas.bots import (
    BYOKUpdate,
    DashboardWebhookCreateRequest,
    GenerateBusinessRequest,
    VoiceSettingsUpdate,
)
from plugins import ai_client
from plugins import llm_providers
from plugins import notifications as notify
from plugins.widget_brain import GEMINI_FALLBACK_MODELS

import json

logger = logging.getLogger("chatty")

router = APIRouter()


def _dashboard_bot_columns() -> str:
    """Return the dashboard-safe bot projection.

    The dashboard needs the complete configuration to hydrate its editor, but
    it must never receive database credentials or other server-only fields.
    `chatty_bots` contains only bot configuration, so selecting the table's
    columns here preserves the managed-Supabase behaviour while keeping the
    self-host path provider-neutral.
    """
    return "*"


@router.get("/api/bots")
async def list_dashboard_bots(user: dict[str, Any] = Depends(require_user)):
    """List bots visible to the dashboard's authenticated user.

    This endpoint is intentionally separate from `/api/v1/bots`: the latter
    is the public OAuth API and must keep its OAuth scopes/response contract.
    Dashboard authentication is the browser's OIDC/Supabase session instead.
    """
    if DEPLOYMENT_PROFILE == "self_host":
        email = (user.get("email") or "").strip().lower()

        def _list() -> list[dict[str, Any]]:
            with connection() as conn:
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    if email:
                        cur.execute(
                            """SELECT b.*
                               FROM chatty_bots b
                               WHERE b.user_id = %s
                                  OR EXISTS (
                                      SELECT 1 FROM chatty_team_members tm
                                      WHERE tm.bot_id = b.id AND lower(tm.email) = lower(%s)
                                  )
                               ORDER BY b.updated_at DESC NULLS LAST, b.created_at DESC""",
                            (user["auth_user_id"], email),
                        )
                    else:
                        cur.execute(
                            "SELECT * FROM chatty_bots WHERE user_id = %s "
                            "ORDER BY updated_at DESC NULLS LAST, created_at DESC",
                            (user["auth_user_id"],),
                        )
                    return [dict(row) for row in cur.fetchall()]

        return await run_db(_list)

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
    if DEPLOYMENT_PROFILE == "self_host":
        def _insert() -> dict[str, Any]:
            columns = list(row)
            with connection() as conn:
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    cur.execute(
                        f"INSERT INTO chatty_bots ({', '.join(columns)}) "
                        f"VALUES ({', '.join('%s' for _ in columns)}) RETURNING *",
                        tuple(Json(value) if isinstance(value, (dict, list)) else value for value in row.values()),
                    )
                    created = cur.fetchone()
                    if not created:
                        raise RuntimeError("bot insert returned no row")
                    return dict(created)
        return await run_db(_insert)

    created = await run_db(lambda: supabase.table("chatty_bots").insert(row).execute())
    if not created.data:
        raise HTTPException(status_code=500, detail="Failed to create bot")
    return created.data[0]


@router.delete("/api/bots/{bot_id}")
async def delete_dashboard_bot(bot_id: str, user: dict[str, Any] = Depends(require_user)):
    """Delete an owned dashboard bot; team members can never delete it."""
    if DEPLOYMENT_PROFILE == "self_host":
        def _delete() -> bool:
            with connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "DELETE FROM chatty_bots WHERE id = %s AND user_id = %s",
                        (bot_id, user["auth_user_id"]),
                    )
                    return cur.rowcount > 0
        if not await run_db(_delete):
            raise HTTPException(status_code=404, detail="Bot not found")
        return {"ok": True}

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
    role, _ = await get_bot_role_and_permissions(bot_id, user)
    if role != "owner":
        raise HTTPException(status_code=403, detail="Only the bot owner can update configuration")
    updates = {key: value for key, value in body.items() if key in _DASHBOARD_BOT_UPDATE_FIELDS}
    if not updates:
        raise HTTPException(status_code=400, detail="No supported fields to update")
    if DEPLOYMENT_PROFILE == "self_host":
        def _update() -> dict[str, Any] | None:
            columns = ", ".join(f"{key} = %s" for key in updates)
            values = tuple(Json(value) if isinstance(value, (dict, list)) else value for value in updates.values())
            with connection() as conn:
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    cur.execute(
                        f"UPDATE chatty_bots SET {columns}, updated_at = NOW() WHERE id = %s RETURNING *",
                        (*values, bot_id),
                    )
                    row = cur.fetchone()
                    return dict(row) if row else None
        updated = await run_db(_update)
    else:
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
    if DEPLOYMENT_PROFILE == "self_host":
        bot = await get_bot(bot_id)
        if not bot:
            raise HTTPException(status_code=404, detail="Bot not found")
        return bot
    result = await run_db(lambda: supabase.table("chatty_bots").select("*").eq("id", bot_id).limit(1).execute())
    if not result.data:
        raise HTTPException(status_code=404, detail="Bot not found")
    return result.data[0]


@router.get("/api/bots/{bot_id}/leads")
async def list_dashboard_leads(bot_id: str, user: dict[str, Any] = Depends(require_user)):
    """Return lead rows for the dashboard's owner/team-accessible bot."""
    await get_bot_role_and_permissions(bot_id, user)
    if DEPLOYMENT_PROFILE == "self_host":
        def _list() -> list[dict[str, Any]]:
            with connection() as conn:
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    cur.execute(
                        "SELECT * FROM chatty_leads WHERE bot_id = %s ORDER BY created_at DESC",
                        (bot_id,),
                    )
                    return [dict(row) for row in cur.fetchall()]
        return {"leads": await run_db(_list)}
    result = await run_db(lambda: supabase.table("chatty_leads").select("*").eq(
        "bot_id", bot_id
    ).order("created_at", desc=True).execute())
    return {"leads": result.data or []}


@router.get("/api/bots/{bot_id}/dashboard-analytics")
async def dashboard_analytics(bot_id: str, user: dict[str, Any] = Depends(require_user)):
    """Return the small, aggregate dataset used by the dashboard home tab.

    Raw rows stay server-side in self-host mode; the response contains only
    the bounded fields needed to render the existing cards and charts.
    """
    await get_bot_role_and_permissions(bot_id, user)
    if DEPLOYMENT_PROFILE != "self_host":
        raise HTTPException(status_code=404, detail="Use managed dashboard data path")

    def _read() -> dict[str, Any]:
        with connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    "SELECT role, session_id, created_at FROM chatty_conversations "
                    "WHERE bot_id = %s ORDER BY created_at DESC LIMIT 10000",
                    (bot_id,),
                )
                conversations = [dict(row) for row in cur.fetchall()]
                cur.execute(
                    "SELECT needs_attention FROM chatty_sessions WHERE bot_id = %s LIMIT 10000",
                    (bot_id,),
                )
                sessions = [dict(row) for row in cur.fetchall()]
                cur.execute(
                    "SELECT feedback_rating FROM chatty_conversations "
                    "WHERE bot_id = %s AND feedback_rating IN ('up', 'down') LIMIT 10000",
                    (bot_id,),
                )
                feedback = [dict(row) for row in cur.fetchall()]
                cur.execute(
                    "SELECT id, rating, comment, session_id, created_at FROM chatty_csat_feedback "
                    "WHERE bot_id = %s ORDER BY created_at DESC LIMIT 500",
                    (bot_id,),
                )
                csat = [dict(row) for row in cur.fetchall()]
                cur.execute(
                    "SELECT model, total_tokens, cost_usd, success FROM chatty_ai_usage "
                    "WHERE bot_id = %s AND created_at >= NOW() - INTERVAL '30 days' LIMIT 10000",
                    (bot_id,),
                )
                usage = [dict(row) for row in cur.fetchall()]
                return {
                    "conversations": conversations,
                    "sessions": sessions,
                    "feedback": feedback,
                    "csat_feedback": csat,
                    "usage": usage,
                }
    return await run_db(_read)


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
    if DEPLOYMENT_PROFILE == "self_host":
        def _list() -> list[dict[str, Any]]:
            with connection() as conn:
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    cur.execute(
                        """SELECT id, type, name, content, status, char_count,
                                  crawl_schedule, next_crawl_at, created_at
                           FROM chatty_sources WHERE bot_id = %s ORDER BY created_at ASC""",
                        (bot_id,),
                    )
                    return [dict(row) for row in cur.fetchall()]
        return {"sources": await run_db(_list)}
    res = await run_db(lambda: supabase.table("chatty_sources").select(
        "id, type, name, content, status, char_count, crawl_schedule, next_crawl_at, created_at"
    ).eq("bot_id", bot_id).order("created_at", desc=False).execute())
    return {"sources": res.data or []}


@router.post("/api/bot/logo")
async def upload_bot_logo(
    bot_id: str = Form(...),
    file: UploadFile = File(...),
    user: dict[str, Any] = Depends(require_user),
):
    if DEPLOYMENT_PROFILE == "self_host":
        bot = await get_bot(bot_id)
        authorized = bool(bot and bot.get("user_id") == user["auth_user_id"])
    else:
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
        if DEPLOYMENT_PROFILE == "self_host":
            url = await run_db(lambda: put_bytes(path, data, mime))
            try:
                if not await update_bot_fields(bot_id, {"logo_url": url}):
                    raise RuntimeError("bot metadata row was not updated")
            except Exception:
                try:
                    await run_db(lambda: delete_object(path))
                except Exception:
                    logger.exception("Failed to compensate orphaned logo object")
                raise
        else:
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
    if DEPLOYMENT_PROFILE == "self_host":
        bot = await get_bot(bot_id)
        authorized = bool(bot and bot.get("user_id") == user["auth_user_id"])
    else:
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
        if DEPLOYMENT_PROFILE == "self_host":
            url = await run_db(lambda: put_bytes(path, data, mime))
            try:
                if not await update_bot_fields(bot_id, {"avatar_url": url, "avatar_icon": "custom"}):
                    raise RuntimeError("bot metadata row was not updated")
            except Exception:
                try:
                    await run_db(lambda: delete_object(path))
                except Exception:
                    logger.exception("Failed to compensate orphaned avatar object")
                raise
        else:
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
        if DEPLOYMENT_PROFILE == "self_host":
            row = await get_user(user_id)
        else:
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
            if DEPLOYMENT_PROFILE == "self_host":
                await update_user_fields(user_id, updates)
            else:
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
                    if DEPLOYMENT_PROFILE == "self_host":
                        await update_team_member_fields(email, tm_updates)
                    else:
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
        if DEPLOYMENT_PROFILE == "self_host":
            url = await run_db(lambda: put_bytes(path, data, mime))
            try:
                upd: dict[str, Any] = {"avatar_url": url}
                if display_name:
                    upd["display_name"] = display_name
                if not await update_user_fields(user_id, upd):
                    raise RuntimeError("user metadata row was not updated")
                if email:
                    tm_upd: dict[str, Any] = {"avatar_url": url}
                    if display_name:
                        tm_upd["name"] = display_name
                    await update_team_member_fields(email, tm_upd)
            except Exception:
                try:
                    await run_db(lambda: delete_object(path))
                except Exception:
                    logger.exception("Failed to compensate orphaned user avatar object")
                raise
        else:
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
        await run_db(lambda: supabase.table("chatty_bots").update(update).eq("id", bot_id).execute())
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
    from app.core.providers import provider_status

    providers = provider_status()
    return {
        "onesignal_configured": _notify.onesignal_configured(),
        "zoom_configured": _zoom.zoom_configured(),
        "deployment_profile": providers.profile,
        "self_host_ready": providers.ready_for_self_host,
        "self_host_providers": {
            "database": providers.database_configured,
            "queue": providers.queue_configured,
            "object_store": providers.object_store_configured,
        },
    }
