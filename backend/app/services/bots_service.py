"""Bot create/list/get/update/analytics/delete/knowledge/settings — the single
implementation shared by the REST API (app/routers/bots_api.py) and the MCP tools
(app/routers/mcp.py).
"""

from __future__ import annotations

import json
from typing import Any, Optional
from fastapi import HTTPException

from app.core import oauth as _oauth
from app.core.clients import supabase
from app.core.db import run_db
from app.core.permissions import OWNER_ONLY_TABS, default_permissions_for_role, verify_bot_permission
from plugins import llm_providers
from plugins import widget_brain
from app.schemas.bots_api import (
    BotCreateRequest,
    BotUpdateRequest,
    WidgetStylingUpdateRequest,
    LeadCaptureConfigRequest,
    CalendarIntegrationRequest,
    GuardrailsConfigRequest,
    BYOKConfigRequest,
    TeamMemberRequest,
    NotificationsConfigRequest,
)

_BOT_LIST_COLUMNS = "id, name, welcome_message, primary_color, selected_model, created_at"
_BOT_DETAIL_FIELDS = [
    "id", "name", "welcome_message", "primary_color", "selected_model", "system_instructions",
    "widget_style", "response_language", "strict_mode", "lead_capture_enabled", "teaser_enabled",
    "teaser_text", "sound_enabled", "mobile_fullscreen", "allowed_domains", "created_at", "updated_at",
]


def _project_bot(row: dict[str, Any]) -> dict[str, Any]:
    return {k: row.get(k) for k in _BOT_DETAIL_FIELDS if k in row}


async def create_bot(principal: dict[str, Any], body: BotCreateRequest) -> dict[str, Any]:
    if principal["auth_type"] != "oauth":
        raise HTTPException(
            status_code=403,
            detail="Bot creation requires an OAuth2 access token. Authenticate via /oauth/authorize.",
        )
    row = {
        "user_id": principal["user_id"],
        "name": body.name,
        "welcome_message": body.welcome_message or "Hello! How can I help you today?",
        "system_instructions": body.system_instructions,
        "selected_model": body.selected_model or "gemini-2.5-flash",
        "primary_color": body.primary_color or "#f97316",
        "response_language": body.response_language,
    }
    res = await run_db(lambda: supabase.table("chatty_bots").insert(row).execute())
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to create bot")
    return _project_bot(res.data[0])


async def list_bots(principal: dict[str, Any]) -> list[dict[str, Any]]:
    if principal["auth_type"] != "oauth":
        raise HTTPException(
            status_code=403,
            detail="Listing bots requires an OAuth2 access token.",
        )
    res = await run_db(lambda: supabase.table("chatty_bots").select(_BOT_LIST_COLUMNS).eq(
        "user_id", principal["user_id"]).order("created_at", desc=True).execute())
    return res.data or []


async def get_bot(principal: dict[str, Any], bot_id: str) -> dict[str, Any]:
    bot = await _oauth.require_bot_access(principal, bot_id)
    return _project_bot(bot)


async def update_bot(principal: dict[str, Any], bot_id: str, body: BotUpdateRequest) -> dict[str, Any]:
    await _oauth.require_bot_access(principal, bot_id)
    updates = {k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    res = await run_db(lambda: supabase.table("chatty_bots").update(updates).eq("id", bot_id).execute())
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to update bot")
    return _project_bot(res.data[0])


async def delete_bot(principal: dict[str, Any], bot_id: str) -> dict[str, Any]:
    bot = await _oauth.require_bot_access(principal, bot_id)
    await run_db(lambda: supabase.table("chatty_bots").delete().eq("id", bot_id).execute())
    return {"deleted": True, "bot_id": bot_id, "name": bot.get("name")}


async def clone_bot(principal: dict[str, Any], bot_id: str, new_name: str) -> dict[str, Any]:
    bot = await _oauth.require_bot_access(principal, bot_id)
    clone_row = {
        "user_id": principal["user_id"],
        "name": new_name,
        "welcome_message": bot.get("welcome_message"),
        "system_instructions": bot.get("system_instructions"),
        "selected_model": bot.get("selected_model"),
        "primary_color": bot.get("primary_color"),
        "widget_style": bot.get("widget_style"),
        "response_language": bot.get("response_language"),
        "strict_mode": bot.get("strict_mode", False),
        "lead_capture_enabled": bot.get("lead_capture_enabled", True),
    }
    res = await run_db(lambda: supabase.table("chatty_bots").insert(clone_row).execute())
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to clone bot")
    return _project_bot(res.data[0])


async def update_widget_styling(principal: dict[str, Any], bot_id: str, body: WidgetStylingUpdateRequest) -> dict[str, Any]:
    await _oauth.require_bot_access(principal, bot_id)
    updates: dict[str, Any] = {}
    if body.primary_color is not None:
        updates["primary_color"] = body.primary_color
    if body.widget_style is not None:
        updates["widget_style"] = body.widget_style
    if body.position is not None:
        updates["position"] = body.position
    if body.avatar_url is not None:
        updates["avatar_url"] = body.avatar_url
    if body.avatar_icon is not None:
        updates["avatar_icon"] = body.avatar_icon
    if body.header_logo_url is not None:
        updates["logo_url"] = body.header_logo_url
    if body.teaser_enabled is not None:
        updates["teaser_enabled"] = body.teaser_enabled
    if body.teaser_message is not None:
        updates["teaser_text"] = body.teaser_message
    if body.sound_enabled is not None:
        updates["sound_enabled"] = body.sound_enabled
    if body.mobile_fullscreen is not None:
        updates["mobile_fullscreen"] = body.mobile_fullscreen
    if body.starter_questions is not None:
        updates["starter_questions"] = body.starter_questions
    if body.custom_css is not None:
        updates["custom_css"] = body.custom_css
    if body.remove_branding is not None:
        updates["remove_branding"] = body.remove_branding

    if updates:
        res = await run_db(lambda: supabase.table("chatty_bots").update(updates).eq("id", bot_id).execute())
        if res.data:
            return _project_bot(res.data[0])
    return await get_bot(principal, bot_id)


async def add_knowledge_text(principal: dict[str, Any], bot_id: str, name: str, content: str) -> dict[str, Any]:
    await _oauth.require_bot_access(principal, bot_id)
    name = (name or "").strip()
    content = (content or "").strip()
    if not name or not content:
        raise HTTPException(status_code=400, detail="name and content are required")
    if len(content) > 100_000:
        raise HTTPException(status_code=400, detail="content exceeds 100 KB limit")
    res = await run_db(lambda: supabase.table("chatty_sources").insert({
        "bot_id": bot_id,
        "type": "text",
        "name": name[:255],
        "content": content,
        "status": "trained",
        "char_count": len(content),
    }).execute())
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to add knowledge source")
    row = res.data[0]
    return {"id": row.get("id"), "name": row.get("name"), "char_count": row.get("char_count")}


async def crawl_website_knowledge(principal: dict[str, Any], bot_id: str, url: str) -> dict[str, Any]:
    """Fetches and indexes a URL as a knowledge source — the same
    Jina-powered fetch used by the dashboard's URL-crawl flow and the
    per-key Developer API's POST /api/v1/knowledge (type=url)."""
    await _oauth.require_bot_access(principal, bot_id)
    url = (url or "").strip()
    if not url:
        raise HTTPException(status_code=400, detail="url is required")

    from main import _fetch_url_content

    try:
        content = await _fetch_url_content(url)
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Failed to fetch URL") from exc
    if not content.strip():
        raise HTTPException(status_code=422, detail="URL returned no usable content")

    res = await run_db(lambda: supabase.table("chatty_sources").insert({
        "bot_id": bot_id,
        "type": "url",
        "name": url,
        "content": content,
        "status": "trained",
        "char_count": len(content),
    }).execute())
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to add knowledge source")
    row = res.data[0]
    return {"id": row.get("id"), "name": row.get("name"), "char_count": row.get("char_count")}


async def list_knowledge_sources(principal: dict[str, Any], bot_id: str) -> list[dict[str, Any]]:
    await _oauth.require_bot_access(principal, bot_id)
    res = await run_db(lambda: supabase.table("chatty_sources").select(
        "id, bot_id, type, name, status, char_count, created_at"
    ).eq("bot_id", bot_id).order("created_at", desc=True).execute())
    return res.data or []


async def delete_knowledge_source(principal: dict[str, Any], bot_id: str, source_id: str) -> dict[str, Any]:
    await _oauth.require_bot_access(principal, bot_id)
    await run_db(lambda: supabase.table("chatty_sources").delete().eq("id", source_id).eq("bot_id", bot_id).execute())
    return {"deleted": True, "source_id": source_id}


async def test_rag_retrieval(principal: dict[str, Any], bot_id: str, query: str, top_k: int = 4) -> dict[str, Any]:
    """Runs the bot's *actual* knowledge-source ranking (widget_brain's
    _ranked_source_refs — real keyword-overlap scoring against chatty_sources,
    the same function run_widget_assistant calls on every real chat turn),
    not fabricated similarity scores. The original version of this function
    made up decreasing scores (0.92, 0.87, 0.82...) regardless of the query
    or the bot's actual knowledge base — this now reflects genuinely what
    the bot would retrieve and cite for this query."""
    bot = await _oauth.require_bot_access(principal, bot_id)
    res_sources = await run_db(lambda: supabase.table("chatty_sources").select("*").eq(
        "bot_id", bot_id).eq("status", "trained").execute())
    sources = res_sources.data or []
    refs = widget_brain._ranked_source_refs(query, sources, limit=top_k)
    return {
        "bot_id": bot_id,
        "query": query,
        "matched": len(refs) > 0,
        "retrieved_sources": refs,
        "total_knowledge_sources": len(sources),
    }


async def configure_lead_capture(principal: dict[str, Any], bot_id: str, body: LeadCaptureConfigRequest) -> dict[str, Any]:
    await _oauth.require_bot_access(principal, bot_id)
    updates = {
        "lead_capture_enabled": body.enabled,
        "lead_capture_timing": body.trigger_timing,
        "lead_collect_name": body.collect_name,
        "lead_collect_email": body.collect_email,
        "lead_collect_phone": body.collect_phone,
    }
    await run_db(lambda: supabase.table("chatty_bots").update(updates).eq("id", bot_id).execute())
    return {"bot_id": bot_id, **updates}


async def list_leads(principal: dict[str, Any], bot_id: str, limit: int = 100) -> list[dict[str, Any]]:
    await _oauth.require_bot_access(principal, bot_id)
    res = await run_db(lambda: supabase.table("chatty_leads").select("*").eq("bot_id", bot_id).order("created_at", desc=True).limit(limit).execute())
    return res.data or []


async def configure_calendar(principal: dict[str, Any], bot_id: str, body: CalendarIntegrationRequest) -> dict[str, Any]:
    await _oauth.require_bot_access(principal, bot_id)
    updates = {
        "calendar_provider": body.provider,
        "meeting_duration": body.meeting_duration_minutes,
        "calendar_timezone": body.timezone,
        "calendar_available_days": body.available_days,
        "calendar_hours_start": body.working_hours_start,
        "calendar_hours_end": body.working_hours_end,
    }
    await run_db(lambda: supabase.table("chatty_bots").update(updates).eq("id", bot_id).execute())
    return {"bot_id": bot_id, **updates}


async def list_meetings(principal: dict[str, Any], bot_id: str) -> list[dict[str, Any]]:
    await _oauth.require_bot_access(principal, bot_id)
    res = await run_db(lambda: supabase.table("chatty_meetings").select("*").eq("bot_id", bot_id).execute())
    return res.data or []


async def configure_guardrails(principal: dict[str, Any], bot_id: str, body: GuardrailsConfigRequest) -> dict[str, Any]:
    await _oauth.require_bot_access(principal, bot_id)
    updates = {
        "strict_mode": body.strict_mode,
        "blocked_topics": body.blocked_topics or [],
        "blocked_keywords": body.blocked_keywords or [],
        "fallback_message": body.fallback_message or "I'm sorry, I can only answer questions related to our services.",
    }
    await run_db(lambda: supabase.table("chatty_bots").update(updates).eq("id", bot_id).execute())
    return {"bot_id": bot_id, **updates}


async def configure_byok(principal: dict[str, Any], bot_id: str, body: BYOKConfigRequest) -> dict[str, Any]:
    # The original version of this function wrote body.api_key straight into
    # a plaintext column (byok_openai_key/byok_key — neither of which even
    # exists on chatty_bots). The real column is byok_api_key_encrypted,
    # written through llm_providers.encrypt_api_key() and never read back —
    # see app/routers/bots.py's set_byok/get_byok_status, which this now
    # matches exactly. BYOK is also owner-only (app.core.permissions.
    # OWNER_ONLY_TABS), same as team.py's dashboard endpoint enforces —
    # require_bot_access alone doesn't check that, verify_bot_permission does.
    await _oauth.require_bot_access(principal, bot_id)
    user = await _oauth.user_dict_for_principal(principal)
    await verify_bot_permission(bot_id, user, "byok")

    if body.provider not in ("openai", "anthropic", "openrouter"):
        raise HTTPException(status_code=400, detail="provider must be openai, anthropic, or openrouter")

    update: dict[str, Any] = {"byok_provider": body.provider, "byok_model": body.model}
    if body.api_key:
        update["byok_api_key_encrypted"] = llm_providers.encrypt_api_key(body.api_key)
    await run_db(lambda: supabase.table("chatty_bots").update(update).eq("id", bot_id).execute())
    # Never return the key (raw or encrypted) — same contract as
    # GET /api/bots/{bot_id}/byok: only confirm it's configured.
    return {"bot_id": bot_id, "provider": body.provider, "model": body.model, "byok_configured": True}


async def manage_team_members(principal: dict[str, Any], bot_id: str, action: str, body: TeamMemberRequest) -> dict[str, Any]:
    # require_bot_access alone isn't enough here: it only proves the caller
    # owns (or holds an API key for) this bot, not that they're allowed to
    # manage its team — that's a separate, real RBAC check (verify_bot_permission,
    # the same one app/routers/team.py's dashboard endpoints use), and
    # _sanitize_permissions below is what stops a non-owner admin from
    # granting themselves/others owner-only tabs (billing/byok/webhooks)
    # through this path. The original version of this function skipped both
    # checks entirely — any caller with bot access could upsert any role.
    await _oauth.require_bot_access(principal, bot_id)
    user = await _oauth.user_dict_for_principal(principal)
    caller_role = await verify_bot_permission(bot_id, user, "team")

    email = body.email.strip().lower()
    if "@" not in email or "." not in email:
        raise HTTPException(status_code=400, detail="A valid email is required")

    if action == "remove":
        await run_db(lambda: supabase.table("chatty_team_members").delete().eq("bot_id", bot_id).eq("email", email).execute())
        return {"action": "remove", "email": email, "bot_id": bot_id}

    # Same two rules as team.py's invite/update endpoints: role can only ever
    # be "admin" or "agent" via this path (never "owner" — no self/other
    # escalation to ownership), and a non-owner caller can never grant an
    # owner-only tab (billing/byok/webhooks) to anyone, including themselves.
    role = body.role if body.role in ("admin", "agent") else "agent"
    permissions = default_permissions_for_role(role)
    if caller_role != "owner":
        permissions = [p for p in permissions if p not in OWNER_ONLY_TABS]

    await run_db(lambda: supabase.table("chatty_team_members").upsert(
        {"bot_id": bot_id, "email": email, "role": role, "permissions": permissions},
        on_conflict="bot_id,email",
    ).execute())
    return {"action": action, "email": email, "role": role, "permissions": permissions, "bot_id": bot_id}


async def configure_domain_allowlist(principal: dict[str, Any], bot_id: str, domains: list[str]) -> dict[str, Any]:
    await _oauth.require_bot_access(principal, bot_id)
    await run_db(lambda: supabase.table("chatty_bots").update({"allowed_domains": domains}).eq("id", bot_id).execute())
    return {"bot_id": bot_id, "allowed_domains": domains}


async def configure_notifications(principal: dict[str, Any], bot_id: str, body: NotificationsConfigRequest) -> dict[str, Any]:
    """chatty_bots only has a real notification_emails column — there's no
    per-bot slack_webhook_url/discord_webhook_url/notify_on_lead/
    notify_on_escalation (the earlier version of this function wrote those
    four straight to a table that doesn't have them). Slack/Discord/custom
    alerting is the real chatty_webhooks subscription system instead (see
    create_webhook_subscription/list_webhook_subscriptions below) — the
    same table/permission-gated tab app/routers/bots.py's dashboard
    Webhooks settings already use."""
    await _oauth.require_bot_access(principal, bot_id)
    updates = {"notification_emails": body.admin_emails}
    await run_db(lambda: supabase.table("chatty_bots").update(updates).eq("id", bot_id).execute())
    return {"bot_id": bot_id, **updates}


async def create_webhook_subscription(principal: dict[str, Any], bot_id: str, url: str, events: list[str]) -> dict[str, Any]:
    """Real event-webhook subscription (chatty_webhooks) — same table and
    validation the dashboard's owner-only Webhooks tab uses. Covers Slack/
    Discord/custom alerting: point `url` at a Slack/Discord incoming
    webhook (or any HTTPS endpoint) and pick from plugins.notifications.
    WEBHOOK_EVENTS (e.g. "lead_captured", "human_escalation")."""
    import secrets as _secrets
    from app.core.ssrf import UnsafeURLError, assert_safe_url_async
    from plugins import notifications as notify

    user = await _oauth.user_dict_for_principal(principal)
    await verify_bot_permission(bot_id, user, "webhooks")

    url = (url or "").strip()
    if not url.startswith(("http://", "https://")):
        raise HTTPException(status_code=400, detail="url must be a valid http(s) URL")
    try:
        await assert_safe_url_async(url)
    except UnsafeURLError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid url: {exc}") from exc
    valid_events = [e for e in (events or []) if e in notify.WEBHOOK_EVENTS]
    if not valid_events:
        raise HTTPException(status_code=400, detail=f"events must include at least one of: {', '.join(notify.WEBHOOK_EVENTS)}")

    secret = f"whsec_{_secrets.token_hex(24)}"
    row = await run_db(lambda: supabase.table("chatty_webhooks").insert({
        "bot_id": bot_id, "url": url, "events": valid_events, "secret": secret, "active": True,
    }).execute())
    return row.data[0] if row.data else {"url": url, "events": valid_events}


async def list_webhook_subscriptions(principal: dict[str, Any], bot_id: str) -> list[dict[str, Any]]:
    user = await _oauth.user_dict_for_principal(principal)
    await verify_bot_permission(bot_id, user, "webhooks")
    res = await run_db(lambda: supabase.table("chatty_webhooks").select(
        "id, url, events, active, created_at"
    ).eq("bot_id", bot_id).order("created_at", desc=True).execute())
    return res.data or []


async def delete_webhook_subscription(principal: dict[str, Any], bot_id: str, webhook_id: str) -> dict[str, Any]:
    user = await _oauth.user_dict_for_principal(principal)
    await verify_bot_permission(bot_id, user, "webhooks")
    res = await run_db(lambda: supabase.table("chatty_webhooks").select("id").eq("id", webhook_id).eq("bot_id", bot_id).execute())
    if not res.data:
        raise HTTPException(status_code=404, detail="Webhook not found")
    await run_db(lambda: supabase.table("chatty_webhooks").delete().eq("id", webhook_id).execute())
    return {"success": True, "deleted_id": webhook_id}


async def get_audit_logs(principal: dict[str, Any], bot_id: str, limit: int = 50) -> list[dict[str, Any]]:
    """chatty_audit_logs is a real table (see supabase/migrations/
    20260620000000_wizard_tables.sql), but the original version of this
    function fabricated a fake "audit-1 / bot_updated" row whenever the
    real query came back empty — a genuinely empty audit log (nothing has
    happened yet) is a legitimate, honest answer and must not be
    disguised as a fake past event."""
    await _oauth.require_bot_access(principal, bot_id)
    res = await run_db(lambda: supabase.table("chatty_audit_logs").select("*").eq(
        "bot_id", bot_id).order("created_at", desc=True).limit(limit).execute())
    return res.data or []


async def get_feedback_summary(principal: dict[str, Any], bot_id: str) -> dict[str, Any]:
    """Real numbers from the two actual feedback mechanisms — the original
    version of this function was entirely hardcoded (86/78/8/90.7%, fixed
    regardless of bot_id) and never touched a table.
    - Per-message thumbs: chatty_conversations.feedback_rating ("up"/"down").
    - Post-chat CSAT: chatty_csat_feedback (1-5 stars + optional comment)."""
    await _oauth.require_bot_access(principal, bot_id)

    thumbs_res = await run_db(lambda: supabase.table("chatty_conversations").select(
        "feedback_rating").eq("bot_id", bot_id).in_("feedback_rating", ["up", "down"]).execute())
    thumbs = thumbs_res.data or []
    thumbs_up = sum(1 for r in thumbs if r.get("feedback_rating") == "up")
    thumbs_down = sum(1 for r in thumbs if r.get("feedback_rating") == "down")

    csat_res = await run_db(lambda: supabase.table("chatty_csat_feedback").select(
        "rating, comment, created_at").eq("bot_id", bot_id).order("created_at", desc=True).execute())
    csat_rows = csat_res.data or []
    avg_rating = (sum(r["rating"] for r in csat_rows) / len(csat_rows)) if csat_rows else None

    return {
        "bot_id": bot_id,
        "thumbs_up": thumbs_up,
        "thumbs_down": thumbs_down,
        "csat_response_count": len(csat_rows),
        "csat_average_rating": round(avg_rating, 2) if avg_rating is not None else None,
        "csat_score_percent": round(avg_rating / 5 * 100, 1) if avg_rating is not None else None,
        "recent_comments": [
            {"rating": r["rating"], "comment": r["comment"]}
            for r in csat_rows if r.get("comment")
        ][:10],
    }


async def get_account_billing(principal: dict[str, Any]) -> dict[str, Any]:
    """Real plan/usage/quota numbers from main.py's own billing logic (the
    same functions the widget's quota gate uses) — the original version of
    this function was entirely hardcoded ("Standard", 10000/1420/8580,
    byok_active always True) regardless of the account's real plan or usage."""
    # Lazy import: main.py imports every router at the bottom of the file
    # specifically to avoid this cycle (see main.py's own comment on that).
    from main import PLAN_QUOTAS, get_chatty_monthly_usage, plan_for

    user = await _oauth.user_dict_for_principal(principal)
    bots = await list_bots(principal)
    plan = plan_for(user)
    limit = PLAN_QUOTAS.get(plan, PLAN_QUOTAS["free"])
    used = await get_chatty_monthly_usage(principal["user_id"])
    return {
        "user_id": principal.get("user_id"),
        "plan": plan,
        "monthly_message_quota": limit,
        "messages_used_this_month": used,
        "messages_remaining": max(limit - used, 0) if limit > 0 else None,
        "active_bots_count": len(bots),
    }


async def bot_analytics(principal: dict[str, Any], bot_id: str, since: Optional[str] = None) -> dict[str, Any]:
    """`since` (ISO 8601 datetime) filters to messages/leads created at or
    after that time — same param and semantics as the per-key Developer
    API's GET /api/v1/analytics."""
    await _oauth.require_bot_access(principal, bot_id)
    q_conv = supabase.table("chatty_conversations").select("id, role, session_id", count="exact").eq("bot_id", bot_id)
    q_lead = supabase.table("chatty_leads").select("id", count="exact").eq("bot_id", bot_id)
    if since:
        q_conv = q_conv.gte("created_at", since)
        q_lead = q_lead.gte("created_at", since)

    conv_res = await run_db(q_conv.execute)
    leads_res = await run_db(q_lead.execute)

    messages = conv_res.data or []
    return {
        "bot_id": bot_id,
        "since": since,
        "total_messages": conv_res.count or len(messages),
        "user_messages": sum(1 for m in messages if m.get("role") == "user"),
        "bot_messages": sum(1 for m in messages if m.get("role") == "assistant"),
        "unique_sessions": len({m["session_id"] for m in messages if m.get("session_id")}),
        "total_leads": leads_res.count or 0,
    }
