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
    # teaser_enabled/teaser_text/sound_enabled/mobile_fullscreen never
    # existed on chatty_bots (see the customize_widget_styling fix) — the
    # `if k in row` guard in _project_bot meant they silently vanished from
    # every response instead of erroring, which is also why real fields
    # like conversation_starters and hide_branding were invisible here even
    # after being written successfully.
    "id", "name", "welcome_message", "primary_color", "selected_model", "system_instructions",
    "widget_style", "response_language", "strict_mode", "lead_capture_enabled",
    "avatar_url", "avatar_icon", "logo_url", "teaser_message", "conversation_starters",
    "custom_css", "hide_branding", "allowed_domains", "created_at", "updated_at",
    # Included so a caller can actually SEE this — it silently overrides
    # primary_color/widget_style per-element wherever it's set (see
    # WidgetStylingUpdateRequest.clear_color_scheme's comment) and was
    # otherwise invisible here, making a real color change look like it
    # didn't take effect with no way to tell why.
    "color_scheme",
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
    if body.avatar_url is not None:
        updates["avatar_url"] = body.avatar_url
    if body.avatar_icon is not None:
        updates["avatar_icon"] = body.avatar_icon
    if body.header_logo_url is not None:
        updates["logo_url"] = body.header_logo_url
    if body.teaser_message is not None:
        updates["teaser_message"] = body.teaser_message
    if body.conversation_starters is not None:
        updates["conversation_starters"] = body.conversation_starters
    if body.custom_css is not None:
        updates["custom_css"] = body.custom_css
    if body.hide_branding is not None:
        updates["hide_branding"] = body.hide_branding
    if body.clear_color_scheme:
        updates["color_scheme"] = None

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


async def upload_knowledge_document(
    principal: dict[str, Any], bot_id: str, file_name: str, file_base64: str, mime_type: str = ""
) -> dict[str, Any]:
    """Indexes a PDF/DOCX/XLSX/PPTX/image/text file as a knowledge source.
    Reuses plugins.doc_rag's real text-extraction (OCR-backed for PDFs and
    images via genai_client) — the same code path POST /api/documents/upload
    uses for the web chat paperclip button — but stores the extracted text
    in chatty_sources like the bot's other knowledge tools, rather than the
    separate account-level drive_documents table, so it works regardless of
    whether the bot has sync_google_drive enabled."""
    await _oauth.require_bot_access(principal, bot_id)

    import base64
    from app.core.clients import genai_client
    from plugins import doc_rag

    file_name = (file_name or "upload").strip()
    try:
        data = base64.b64decode(file_base64, validate=True)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="file_base64 is not valid base64") from exc
    if not data:
        raise HTTPException(status_code=400, detail="file is empty")
    if len(data) > 20 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="file too large (max 20MB)")

    content = (await doc_rag._extract_text_from_blob(
        data, mime_type or "", file_name, genai_client=genai_client
    )).strip()
    if not content:
        raise HTTPException(status_code=422, detail="Could not extract any text from this file")

    res = await run_db(lambda: supabase.table("chatty_sources").insert({
        "bot_id": bot_id,
        "type": "text",
        "name": file_name[:255],
        "content": content,
        "status": "trained",
        "char_count": len(content),
    }).execute())
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to add knowledge source")
    row = res.data[0]
    return {"id": row.get("id"), "name": row.get("name"), "char_count": row.get("char_count")}


def _drive_folder_id_from(s: str) -> str:
    """Accept either a raw folder ID or a Drive folder URL — same parsing
    app/routers/documents.py's dashboard endpoint uses."""
    s = (s or "").strip()
    if "/folders/" in s:
        return s.split("/folders/", 1)[1].split("?")[0].split("/")[0]
    return s


async def sync_cloud_storage(
    principal: dict[str, Any], bot_id: str, provider: str, folder_id_or_url: str, max_files: int = 50
) -> dict[str, Any]:
    """Indexes a Google Drive/OneDrive folder via plugins.doc_rag.index_folder
    — the same pipeline POST /api/documents/index-folder uses. Indexing is
    account-scoped (drive_documents is keyed by user_id, not bot_id): once
    indexed, every bot on this account with sync_google_drive=true draws on
    the same documents, not just this bot_id. Requires the account to have
    already connected Google/Microsoft from the dashboard — there's no
    OAuth-connect flow reachable through this API."""
    await _oauth.require_bot_access(principal, bot_id)
    user = await _oauth.user_dict_for_principal(principal)

    from app.core.clients import genai_client
    from plugins import doc_rag

    provider = (provider or "gdrive").lower()
    if provider not in ("gdrive", "onedrive"):
        raise HTTPException(status_code=400, detail="provider must be 'gdrive' or 'onedrive'")
    if provider == "onedrive":
        if not user.get("microsoft_access_token"):
            raise HTTPException(status_code=400, detail="Microsoft account is not connected — connect it from the dashboard first")
        folder_id = (folder_id_or_url or "").strip()
    else:
        if not user.get("google_access_token"):
            raise HTTPException(status_code=400, detail="Google account is not connected — connect it from the dashboard first")
        folder_id = _drive_folder_id_from(folder_id_or_url)
    if not folder_id:
        raise HTTPException(status_code=400, detail="folder_id_or_url is required")

    max_files = max(min(max_files, 200), 1)
    indexed = await doc_rag.index_folder(
        supabase, genai_client, user=user, folder_id=folder_id, max_files=max_files, source=provider,
    )
    # sync_google_drive is the one real flag plugins/widget_brain.py checks
    # to decide whether a bot's RAG draws on drive_documents at all — it
    # gates both sources despite the name (see that file's search_knowledge).
    await run_db(lambda: supabase.table("chatty_bots").update({"sync_google_drive": True}).eq("id", bot_id).execute())
    return {
        "bot_id": bot_id,
        "provider": provider,
        "folder_id": folder_id,
        "indexed_count": len(indexed),
        "note": "Indexing is account-scoped, not bot-scoped. sync_google_drive was enabled on this bot so it now draws on these documents.",
    }


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
    required_fields = [
        f for f, on in (("name", body.collect_name), ("email", body.collect_email), ("phone", body.collect_phone)) if on
    ]
    updates = {
        "lead_capture_enabled": body.enabled,
        "lead_required_fields": required_fields,
    }
    await run_db(lambda: supabase.table("chatty_bots").update(updates).eq("id", bot_id).execute())
    return {
        "bot_id": bot_id,
        "enabled": body.enabled,
        "lead_required_fields": required_fields,
    }


async def list_leads(principal: dict[str, Any], bot_id: str, limit: int = 100) -> list[dict[str, Any]]:
    await _oauth.require_bot_access(principal, bot_id)
    res = await run_db(lambda: supabase.table("chatty_leads").select("*").eq("bot_id", bot_id).order("created_at", desc=True).limit(limit).execute())
    return res.data or []


async def export_leads(principal: dict[str, Any], bot_id: str, limit: int = 100, format: str = "json") -> Any:
    """Same rows as list_leads, as CSV text when format='csv'. Columns are
    whatever chatty_leads actually returns for these rows (not a hardcoded
    list), so the export never claims a field that isn't real."""
    if format not in ("json", "csv"):
        raise HTTPException(status_code=400, detail="format must be 'json' or 'csv'")
    leads = await list_leads(principal, bot_id, limit)
    if format == "json":
        return leads

    import csv
    import io

    if not leads:
        return ""
    columns: list[str] = []
    for lead in leads:
        for key in lead.keys():
            if key not in columns:
                columns.append(key)
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=columns)
    writer.writeheader()
    writer.writerows(leads)
    return buf.getvalue()


async def get_mailbox_logs(principal: dict[str, Any], bot_id: str, limit: int = 50) -> list[dict[str, Any]]:
    """Real outgoing-email/push log — chatty_notifications, already
    populated by plugins/agent_tools.py for every meeting-confirmation
    email/push it sends (client + admin copies). There's no separate
    'mailbox' feature or table; this is that same real log, exposed for the
    Developer API."""
    await _oauth.require_bot_access(principal, bot_id)
    res = await run_db(lambda: supabase.table("chatty_notifications").select(
        "id, meeting_id, recipient, channel, type, subject, status, error_message, created_at"
    ).eq("bot_id", bot_id).order("created_at", desc=True).limit(limit).execute())
    return res.data or []


async def export_visitor_data(principal: dict[str, Any], bot_id: str) -> dict[str, Any]:
    """Right to data portability (GDPR): every visitor record held for a
    bot — conversations, sessions, leads — as one JSON payload. Same query
    shape as GET /api/admin/gdpr/export. require_bot_access already implies
    ownership here: an OAuth principal only passes it for a bot it owns, and
    an API key can only ever have been minted by the bot's owner in the
    first place (see POST /api/keys) — so this needs no extra owner check
    beyond what every other tool in this file already relies on."""
    await _oauth.require_bot_access(principal, bot_id)

    import asyncio
    import datetime

    conv_res, sess_res, leads_res = await asyncio.gather(
        run_db(lambda: supabase.table("chatty_conversations").select("*").eq("bot_id", bot_id)
               .order("created_at", desc=False).limit(50000).execute()),
        run_db(lambda: supabase.table("chatty_sessions").select("*").eq("bot_id", bot_id)
               .limit(50000).execute()),
        run_db(lambda: supabase.table("chatty_leads").select("*").eq("bot_id", bot_id)
               .limit(50000).execute()),
    )
    conv = conv_res.data or []
    sess = sess_res.data or []
    leads = leads_res.data or []
    return {
        "bot_id": bot_id,
        "exported_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "counts": {"conversations": len(conv), "sessions": len(sess), "leads": len(leads)},
        "conversations": conv,
        "sessions": sess,
        "leads": leads,
    }


async def configure_calendar(principal: dict[str, Any], bot_id: str, body: CalendarIntegrationRequest) -> dict[str, Any]:
    await _oauth.require_bot_access(principal, bot_id)
    if body.provider not in ("google_calendar", "microsoft_outlook", "office365"):
        raise HTTPException(status_code=400, detail="provider must be google_calendar, microsoft_outlook, or office365")
    updates: dict[str, Any] = {
        "calendar_scheduling_enabled": body.enabled,
        "scheduling_duration_minutes": body.meeting_duration_minutes,
        "bot_timezone": body.timezone,
        "sync_google_calendar": body.provider == "google_calendar",
        "sync_outlook_calendar": body.provider == "microsoft_outlook",
        "sync_office365_calendar": body.provider == "office365",
    }
    await run_db(lambda: supabase.table("chatty_bots").update(updates).eq("id", bot_id).execute())
    return {"bot_id": bot_id, "provider": body.provider, **updates}


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
