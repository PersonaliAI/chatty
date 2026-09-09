"""Dashboard inbox, human-agent takeover, GDPR export, and admin panel
endpoints (/api/admin/*)."""

from __future__ import annotations

import asyncio
import logging
import time
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from app.core.clients import supabase
from app.core.db import run_db
from app.core.deps import require_user
from app.core.permissions import verify_bot_permission
from app.core.uploads import read_upload_capped
import re
from app.schemas.admin import (
    InboxAIToggle,
    InboxDeleteRequest,
    InboxReplyRequest,
    MessageFeedbackRequest,
    RescheduleMeetingRequest,
    SessionNoteCreateRequest,
    SessionUpdateRequest,
)
from app.schemas.kb import (
    ArticleCreateRequest,
    ArticleUpdateRequest,
    CategoryCreateRequest,
    CategoryUpdateRequest,
)
from app.schemas.routing import (
    AgentPresenceUpdateRequest,
    RoutingSettingsUpdateRequest,
)

def _slugify(text: str) -> str:
    s = text.lower().strip()
    s = re.sub(r"[^\w\s-]", "", s)
    s = re.sub(r"[\s_-]+", "-", s)
    return s.strip("-") or "untitled"

# Bridged helpers still living in main.py (shared across many route groups).
from main import _verify_bot_access, _verify_bot_owner

logger = logging.getLogger("chatty")

router = APIRouter()

_MEDIA_MAX_BYTES = 20 * 1024 * 1024  # 20MB — matches app/routers/widget.py


@router.get("/api/admin/inbox")
async def admin_inbox(bot_id: str, user: dict[str, Any] = Depends(require_user)):
    await _verify_bot_access(bot_id, user)
    rows = (await run_db(lambda: supabase.table("chatty_sessions").select("*").eq("bot_id", bot_id) \
        .order("last_message_at", desc=True).limit(200).execute())).data or []
    # Float conversations that need a human to the top (stable: keeps recency).
    rows.sort(key=lambda r: not r.get("needs_attention"))
    return {"sessions": rows}


@router.get("/api/admin/inbox/messages")
async def admin_inbox_messages(bot_id: str, session_id: str,
                               user: dict[str, Any] = Depends(require_user)):
    await _verify_bot_access(bot_id, user)
    rows = (await run_db(lambda: supabase.table("chatty_conversations").select("id,role,content,sender,created_at,feedback_rating,correction") \
        .eq("bot_id", bot_id).eq("session_id", session_id) \
        .order("created_at", desc=False).limit(500).execute())).data or []
    return {"messages": rows}


@router.patch("/api/admin/inbox/messages/{message_id}/feedback")
async def set_message_feedback(message_id: str, req: MessageFeedbackRequest, user: dict[str, Any] = Depends(require_user)):
    """Thumbs up/down + an optional corrected answer on an assistant message
    ("refine answers"). A saved correction is also added as a searchable
    knowledge source so future replies on the same topic use it."""
    await _verify_bot_access(req.bot_id, user)
    if req.rating not in (None, "up", "down"):
        raise HTTPException(status_code=400, detail="rating must be up, down, or null")

    msg_res = await run_db(lambda: supabase.table("chatty_conversations").select("id, bot_id, content, role").eq("id", message_id).execute())
    if not msg_res.data or msg_res.data[0]["bot_id"] != req.bot_id:
        raise HTTPException(status_code=404, detail="Message not found")
    message = msg_res.data[0]

    await run_db(lambda: supabase.table("chatty_conversations").update({
        "feedback_rating": req.rating,
        "correction": req.correction,
    }).eq("id", message_id).execute())

    if req.correction and req.correction.strip():
        content = f"Original AI answer: {message.get('content', '')}\n\nCorrected answer (use this instead): {req.correction.strip()}"
        source_name = f"Correction #{message_id[:8]}"
        existing = await run_db(lambda: supabase.table("chatty_sources").select("id").eq("bot_id", req.bot_id).eq("type", "text").eq("name", source_name).execute())
        if existing.data:
            existing_id = existing.data[0]["id"]
            await run_db(lambda: supabase.table("chatty_sources").update({"content": content, "char_count": len(content)}).eq("id", existing_id).execute())
        else:
            await run_db(lambda: supabase.table("chatty_sources").insert({
                "bot_id": req.bot_id, "type": "text", "name": source_name,
                "content": content, "status": "trained", "char_count": len(content),
            }).execute())

    return {"success": True}


@router.post("/api/admin/inbox/reply")
async def admin_inbox_reply(req: InboxReplyRequest, user: dict[str, Any] = Depends(require_user)):
    await _verify_bot_access(req.bot_id, user)
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="text required")
    await run_db(lambda: supabase.table("chatty_conversations").insert({
        "bot_id": req.bot_id, "session_id": req.session_id, "role": "assistant",
        "content": req.text, "sender": "human",
    }).execute())
    now_iso = datetime.now(timezone.utc).isoformat()
    # Check if first_responded_at is already set
    sess_res = await run_db(lambda: supabase.table("chatty_sessions").select("first_responded_at").eq("bot_id", req.bot_id).eq("session_id", req.session_id).limit(1).execute())
    upd: dict[str, Any] = {
        "ai_paused": True, "needs_attention": False, "last_message": req.text[:300],
        "last_message_at": now_iso,
    }
    if sess_res.data and not sess_res.data[0].get("first_responded_at"):
        upd["first_responded_at"] = now_iso
    await run_db(lambda: supabase.table("chatty_sessions").update(upd).eq("bot_id", req.bot_id).eq("session_id", req.session_id).execute())
    return {"success": True}


@router.post("/api/admin/inbox/reply/media")
async def admin_inbox_reply_media(
    bot_id: str = Form(...),
    session_id: str = Form(...),
    text: str = Form(""),
    file: UploadFile = File(...),
    user: dict[str, Any] = Depends(require_user),
):
    await _verify_bot_access(bot_id, user)
    data = await read_upload_capped(file, _MEDIA_MAX_BYTES, detail="File too large (max 20MB)")
    if not data:
        raise HTTPException(status_code=400, detail="Empty file")
    mime = (file.content_type or "application/octet-stream").split(";")[0]

    # Upload to storage (service-role bypasses RLS)
    import uuid as _uuid
    ext = (file.filename or "file").split(".")[-1][:8] if "." in (file.filename or "") else "bin"
    path = f"{bot_id}/{session_id}/reply-{int(time.time())}-{_uuid.uuid4().hex[:8]}.{ext}"
    try:
        def _upload():
            supabase.storage.from_("chatty-uploads").upload(
                path, data, {"content-type": mime, "upsert": "false"}
            )
            return supabase.storage.from_("chatty-uploads").get_public_url(path)
        file_url = await run_db(_upload)
    except Exception as e:
        logger.exception("Admin reply storage upload failed")
        raise HTTPException(status_code=500, detail="Upload failed") from e

    display = (text.strip() + ("\n" if text.strip() else "")) + f"[attachment: {file.filename or mime}]"
    content = display + (f"\n{file_url}" if file_url else "")

    await run_db(lambda: supabase.table("chatty_conversations").insert({
        "bot_id": bot_id, "session_id": session_id, "role": "assistant",
        "content": content, "sender": "human",
    }).execute())

    now_iso = datetime.now(timezone.utc).isoformat()
    sess_res = await run_db(lambda: supabase.table("chatty_sessions").select("first_responded_at").eq("bot_id", bot_id).eq("session_id", session_id).limit(1).execute())
    upd: dict[str, Any] = {
        "ai_paused": True, "needs_attention": False, "last_message": content[:300],
        "last_message_at": now_iso,
    }
    if sess_res.data and not sess_res.data[0].get("first_responded_at"):
        upd["first_responded_at"] = now_iso
    await run_db(lambda: supabase.table("chatty_sessions").update(upd).eq("bot_id", bot_id).eq("session_id", session_id).execute())

    return {"success": True, "file_url": file_url, "file_type": mime}


@router.patch("/api/admin/inbox/session")
async def update_inbox_session(req: SessionUpdateRequest, user: dict[str, Any] = Depends(require_user)):
    """Update helpdesk session lifecycle state, priority, assignment, tags, and SLA status."""
    await _verify_bot_access(req.bot_id, user)
    upd: dict[str, Any] = {}

    if req.status is not None:
        valid_statuses = ("open", "pending", "resolved", "closed")
        if req.status not in valid_statuses:
            raise HTTPException(status_code=400, detail=f"status must be one of {valid_statuses}")
        upd["status"] = req.status
        now_iso = datetime.now(timezone.utc).isoformat()
        if req.status in ("resolved", "closed"):
            upd["resolved_at"] = now_iso
            sess_res = await run_db(lambda: supabase.table("chatty_sessions").select("resolution_due_at").eq("bot_id", req.bot_id).eq("session_id", req.session_id).limit(1).execute())
            if sess_res.data and sess_res.data[0].get("resolution_due_at"):
                due = sess_res.data[0]["resolution_due_at"]
                upd["sla_status"] = "breached" if now_iso > due else "met"
            else:
                upd["sla_status"] = "met"
        elif req.status == "open":
            upd["resolved_at"] = None
            upd["sla_status"] = "on_track"

    if req.priority is not None:
        valid_priorities = ("urgent", "high", "normal", "low")
        if req.priority not in valid_priorities:
            raise HTTPException(status_code=400, detail=f"priority must be one of {valid_priorities}")
        upd["priority"] = req.priority

    if req.assigned_agent_email is not None:
        email_val = req.assigned_agent_email.strip() if req.assigned_agent_email else None
        upd["assigned_agent_email"] = email_val
        upd["assigned_agent_name"] = req.assigned_agent_name or (email_val.split("@")[0].capitalize() if email_val else None)

    if req.ai_paused is not None:
        upd["ai_paused"] = req.ai_paused

    if req.needs_attention is not None:
        upd["needs_attention"] = req.needs_attention
        if not req.needs_attention:
            upd["escalation_reason"] = None

    if req.tags is not None:
        upd["tags"] = req.tags

    if req.escalation_reason is not None:
        upd["escalation_reason"] = req.escalation_reason

    if not upd:
        return {"success": True, "updated": False}

    res = await run_db(lambda: supabase.table("chatty_sessions").update(upd).eq("bot_id", req.bot_id).eq("session_id", req.session_id).execute())
    return {"success": True, "session": res.data[0] if res.data else None}


@router.get("/api/admin/inbox/notes")
async def list_inbox_notes(bot_id: str, session_id: str, user: dict[str, Any] = Depends(require_user)):
    """Fetch persistent internal staff notes for a conversation."""
    await _verify_bot_access(bot_id, user)
    rows = (await run_db(lambda: supabase.table("chatty_session_notes").select("*") \
        .eq("bot_id", bot_id).eq("session_id", session_id) \
        .order("created_at", desc=False).execute())).data or []
    return {"notes": rows}


@router.post("/api/admin/inbox/notes")
async def create_inbox_note(req: SessionNoteCreateRequest, user: dict[str, Any] = Depends(require_user)):
    """Add a persistent staff note visible across all human agents."""
    await _verify_bot_access(req.bot_id, user)
    note_text = (req.note or "").strip()
    if not note_text:
        raise HTTPException(status_code=400, detail="Note text cannot be empty")
    author_email = (user.get("email") or "").strip()
    author_name = user.get("user_metadata", {}).get("name") if isinstance(user.get("user_metadata"), dict) else None
    if not author_name and author_email:
        author_name = author_email.split("@")[0].capitalize()
    author_id = user.get("auth_user_id")

    row = {
        "bot_id": req.bot_id,
        "session_id": req.session_id,
        "note": note_text,
        "author_name": author_name or "Support Agent",
        "author_email": author_email or None,
        "author_id": author_id or None,
    }
    res = await run_db(lambda: supabase.table("chatty_session_notes").insert(row).execute())
    return {"success": True, "note": res.data[0] if res.data else row}


@router.delete("/api/admin/inbox/notes/{note_id}")
async def delete_inbox_note(note_id: str, bot_id: str, user: dict[str, Any] = Depends(require_user)):
    """Delete a staff note."""
    await _verify_bot_access(bot_id, user)
    await run_db(lambda: supabase.table("chatty_session_notes").delete() \
        .eq("id", note_id).eq("bot_id", bot_id).execute())
    return {"success": True}


@router.get("/api/admin/inbox/assignees")
async def get_inbox_assignees(bot_id: str, user: dict[str, Any] = Depends(require_user)):
    """Return all team members and agents who can be assigned conversations."""
    await _verify_bot_access(bot_id, user)
    assignees: list[dict[str, Any]] = []
    seen_emails: set[str] = set()

    # Current user
    curr_email = (user.get("email") or "").strip().lower()
    curr_name = (user.get("user_metadata") or {}).get("name") if isinstance(user.get("user_metadata"), dict) else None
    if not curr_name and curr_email:
        curr_name = curr_email.split("@")[0].capitalize()
    if curr_email:
        assignees.append({
            "email": curr_email,
            "name": curr_name or "Me",
            "role": "agent",
        })
        seen_emails.add(curr_email)

    # Team members from chatty_team_members
    try:
        members = (await run_db(lambda: supabase.table("chatty_team_members").select("email, name, role") \
            .eq("bot_id", bot_id).execute())).data or []
        for m in members:
            m_email = (m.get("email") or "").strip().lower()
            if m_email and m_email not in seen_emails:
                assignees.append({
                    "email": m_email,
                    "name": m.get("name") or m_email.split("@")[0].capitalize(),
                    "role": m.get("role") or "agent",
                })
                seen_emails.add(m_email)
    except Exception:
        logger.exception("Failed to fetch team members for assignees")

    return {"assignees": assignees}


@router.post("/api/admin/inbox/ai")
async def admin_inbox_ai(req: InboxAIToggle, user: dict[str, Any] = Depends(require_user)):
    await _verify_bot_access(req.bot_id, user)
    await run_db(lambda: supabase.table("chatty_sessions").update({"ai_paused": req.ai_paused}) \
        .eq("bot_id", req.bot_id).eq("session_id", req.session_id).execute())
    return {"success": True}


@router.post("/api/admin/inbox/delete")
async def admin_inbox_delete(req: InboxDeleteRequest, user: dict[str, Any] = Depends(require_user)):
    """Delete a conversation (its messages + session row). Destructive, so
    (unlike reading/replying) it's owner/admin only — an 'agent' role can
    work the inbox but not erase history from it."""
    role = await _verify_bot_access(req.bot_id, user)
    if role == "agent":
        raise HTTPException(status_code=403, detail="Only an owner or admin can delete conversations")
    await run_db(lambda: supabase.table("chatty_conversations").delete().eq(
        "bot_id", req.bot_id).eq("session_id", req.session_id).execute())
    await run_db(lambda: supabase.table("chatty_sessions").delete().eq(
        "bot_id", req.bot_id).eq("session_id", req.session_id).execute())
    return {"success": True}


@router.get("/api/admin/gdpr/export")
async def gdpr_export(bot_id: str, user: dict[str, Any] = Depends(require_user)):
    """Right to data portability: export all visitor data held for a bot
    (conversations, sessions, leads) as JSON. Owner-authenticated."""
    await _verify_bot_owner(bot_id, user)
    conv_res, sess_res, leads_res = await asyncio.gather(
        run_db(lambda: supabase.table("chatty_conversations").select("*").eq("bot_id", bot_id) \
            .order("created_at", desc=False).limit(50000).execute()),
        run_db(lambda: supabase.table("chatty_sessions").select("*").eq("bot_id", bot_id) \
            .limit(50000).execute()),
        run_db(lambda: supabase.table("chatty_leads").select("*").eq("bot_id", bot_id) \
            .limit(50000).execute()),
    )
    conv = conv_res.data or []
    sess = sess_res.data or []
    leads = leads_res.data or []
    return {
        "bot_id": bot_id,
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "counts": {"conversations": len(conv), "sessions": len(sess), "leads": len(leads)},
        "conversations": conv,
        "sessions": sess,
        "leads": leads,
    }


async def _verify_meeting_access(meeting: dict, user: dict[str, Any]) -> str:
    """Owner/admin get full access to any meeting for the bot; an agent only
    to meetings assigned to them. Returns the caller's role, or raises 403."""
    role = await verify_bot_permission(meeting["bot_id"], user, "meetings")
    if role == "agent":
        caller_email = (user.get("email") or "").strip().lower()
        if (meeting.get("assigned_to_email") or "").strip().lower() != caller_email:
            raise HTTPException(status_code=403, detail="Unauthorized")
    return role


@router.get("/api/admin/meetings")
async def admin_get_meetings(
    bot_id: str,
    user: dict[str, Any] = Depends(require_user),
):
    # Owner/admin see every meeting for the bot; an agent sees only meetings
    # assigned to them (Phase 2's round-robin assignment) — matches the
    # dashboard's per-role calendar view (no member selector for agents).
    role = await verify_bot_permission(bot_id, user, "meetings")

    try:
        if role == "agent":
            caller_email = (user.get("email") or "").strip().lower()
            res = await run_db(lambda: supabase.table("chatty_meetings").select("*").eq(
                "bot_id", bot_id).eq("assigned_to_email", caller_email).order("start_time", desc=True).execute())
        else:
            res = await run_db(lambda: supabase.table("chatty_meetings").select("*").eq(
                "bot_id", bot_id).order("start_time", desc=True).execute())
        return {"meetings": res.data or []}
    except Exception as e:
        logger.exception("Failed to fetch meetings")
        raise HTTPException(status_code=500, detail="Failed to fetch meetings") from e


@router.get("/api/admin/meetings/{meeting_id}/messages")
async def admin_get_meeting_messages(
    meeting_id: str,
    user: dict[str, Any] = Depends(require_user),
):
    """The email thread for one meeting (confirmation/reschedule/cancellation
    emails sent, plus any visitor replies captured via the Resend inbound
    webhook — see app/routers/webhooks.py::resend_inbound)."""
    res_meet = await run_db(lambda: supabase.table("chatty_meetings").select("bot_id, assigned_to_email").eq(
        "id", meeting_id).execute())
    if not res_meet.data:
        raise HTTPException(status_code=404, detail="Meeting not found")
    await _verify_meeting_access(res_meet.data[0], user)

    try:
        res = await run_db(lambda: supabase.table("chatty_meeting_messages").select("*").eq(
            "meeting_id", meeting_id).order("created_at", desc=False).execute())
        return {"messages": res.data or []}
    except Exception as e:
        logger.exception("Failed to fetch meeting messages")
        raise HTTPException(status_code=500, detail="Failed to fetch meeting messages") from e


@router.get("/api/admin/notifications")
async def admin_get_notifications(
    bot_id: str,
    user: dict[str, Any] = Depends(require_user),
):
    # Verify auth
    res_bot = await run_db(lambda: supabase.table("chatty_bots").select("id").eq("id", bot_id).eq("user_id", user["auth_user_id"]).execute())
    if not res_bot.data:
        raise HTTPException(status_code=403, detail="Unauthorized")

    try:
        res = await run_db(lambda: supabase.table("chatty_notifications").select("*").eq("bot_id", bot_id).order("created_at", desc=True).execute())
        return {"notifications": res.data or []}
    except Exception as e:
        logger.exception("Failed to fetch notifications")
        raise HTTPException(status_code=500, detail="Failed to fetch notifications") from e


@router.get("/api/admin/audit-logs")
async def admin_get_audit_logs(
    bot_id: str,
    user: dict[str, Any] = Depends(require_user),
):
    # Verify auth
    res_bot = await run_db(lambda: supabase.table("chatty_bots").select("id").eq("id", bot_id).eq("user_id", user["auth_user_id"]).execute())
    if not res_bot.data:
        raise HTTPException(status_code=403, detail="Unauthorized")

    try:
        res = await run_db(lambda: supabase.table("chatty_audit_logs").select("*").eq("bot_id", bot_id).order("created_at", desc=True).execute())
        return {"audit_logs": res.data or []}
    except Exception as e:
        logger.exception("Failed to fetch audit logs")
        raise HTTPException(status_code=500, detail="Failed to fetch audit logs") from e


@router.get("/api/admin/training-sources")
async def admin_get_training_sources(
    bot_id: str,
    user: dict[str, Any] = Depends(require_user),
):
    # Verify auth
    res_bot = await run_db(lambda: supabase.table("chatty_bots").select("id").eq("id", bot_id).eq("user_id", user["auth_user_id"]).execute())
    if not res_bot.data:
        raise HTTPException(status_code=403, detail="Unauthorized")

    try:
        res = await run_db(lambda: supabase.table("chatty_sources").select("*").eq("bot_id", bot_id).order("created_at", desc=True).execute())
        return {"sources": res.data or []}
    except Exception as e:
        logger.exception("Failed to fetch sources")
        raise HTTPException(status_code=500, detail="Failed to fetch sources") from e


@router.post("/api/admin/meetings/{meeting_id}/status")
async def admin_update_meeting_status(
    meeting_id: str,
    status: str,
    user: dict[str, Any] = Depends(require_user),
):
    try:
        # Get meeting details to find bot_id and verify access
        res_meet = await run_db(lambda: supabase.table("chatty_meetings").select("*").eq("id", meeting_id).execute())
        if not res_meet.data:
            raise HTTPException(status_code=404, detail="Meeting not found")
        meeting = res_meet.data[0]
        bot_id = meeting["bot_id"]

        await _verify_meeting_access(meeting, user)

        # Cancelling goes through the shared core (agent_tools.cancel_meeting_core)
        # so the dashboard's Cancel button does the same thing the widget/email
        # cancel_meeting tool does — deletes the real calendar event, not just
        # the DB row — instead of duplicating that logic here.
        if status.lower() in ("cancelled", "canceled"):
            res_bot = await run_db(lambda: supabase.table("chatty_bots").select("*").eq("id", bot_id).execute())
            if not res_bot.data:
                raise HTTPException(status_code=404, detail="Bot not found")
            bot = res_bot.data[0]

            from plugins.agent_tools import cancel_meeting_core
            result = await cancel_meeting_core(meeting, bot, bot_id, user, supabase, performed_by="user")
            if "error" in result:
                raise HTTPException(status_code=400, detail=result["error"])
            return {"success": True, "message": "Meeting status updated successfully"}

        await run_db(lambda: supabase.table("chatty_meetings").update({"status": status}).eq("id", meeting_id).execute())
        await run_db(lambda: supabase.table("chatty_audit_logs").insert({
            "bot_id": bot_id,
            "action": "meeting_status_updated",
            "details": f"Meeting status for {meeting.get('attendee_name')} updated to {status}",
            "performed_by": "user"
        }).execute())

        return {"success": True, "message": "Meeting status updated successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to update meeting status")
        raise HTTPException(status_code=500, detail="Failed to update meeting status") from e


@router.post("/api/admin/meetings/{meeting_id}/reschedule")
async def admin_reschedule_meeting(
    meeting_id: str,
    req: RescheduleMeetingRequest,
    user: dict[str, Any] = Depends(require_user),
):
    """Owner/admin-initiated reschedule from the dashboard — reuses the same
    core logic (agent_tools.reschedule_meeting_core) the widget's
    reschedule_meeting tool uses, just starting from a meeting_id already in
    hand instead of looking one up by visitor email."""
    res_meet = await run_db(lambda: supabase.table("chatty_meetings").select("*").eq("id", meeting_id).execute())
    if not res_meet.data:
        raise HTTPException(status_code=404, detail="Meeting not found")
    meeting = res_meet.data[0]
    bot_id = meeting["bot_id"]

    await _verify_meeting_access(meeting, user)

    res_bot = await run_db(lambda: supabase.table("chatty_bots").select("*").eq("id", bot_id).execute())
    if not res_bot.data:
        raise HTTPException(status_code=404, detail="Bot not found")
    bot = res_bot.data[0]

    from plugins.agent_tools import _parse_iso, reschedule_meeting_core
    try:
        new_start = _parse_iso(req.new_start)
        new_end = _parse_iso(req.new_end)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid new_start/new_end — use ISO 8601 with a timezone offset.")
    if new_start.tzinfo is None:
        new_start = new_start.replace(tzinfo=timezone.utc)
    if new_end.tzinfo is None:
        new_end = new_end.replace(tzinfo=timezone.utc)
    if new_end <= new_start:
        raise HTTPException(status_code=400, detail="new_end must be after new_start.")

    result = await reschedule_meeting_core(meeting, new_start, new_end, bot, bot_id, user, supabase, performed_by="user")
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


# ---------------------------------------------------------------------------
# ENTERPRISE KNOWLEDGE BASE & HELP CENTER (Zendesk Guide Level)
# ---------------------------------------------------------------------------

@router.get("/api/admin/kb/categories")
async def admin_get_kb_categories(bot_id: str, user: dict[str, Any] = Depends(require_user)):
    """Fetch all knowledge base categories for a bot, with article counts."""
    await _verify_bot_access(bot_id, user)
    res = await run_db(lambda: supabase.table("chatty_kb_categories")
        .select("*")
        .eq("bot_id", bot_id)
        .order("order_index")
        .order("created_at")
        .execute())
    categories = res.data or []

    # Fetch article counts per category
    art_res = await run_db(lambda: supabase.table("chatty_kb_articles")
        .select("category_id")
        .eq("bot_id", bot_id)
        .execute())
    counts: dict[str, int] = {}
    for a in (art_res.data or []):
        cat_id = a.get("category_id")
        if cat_id:
            counts[cat_id] = counts.get(cat_id, 0) + 1

    for c in categories:
        c["article_count"] = counts.get(c["id"], 0)

    return {"categories": categories}


@router.post("/api/admin/kb/categories")
async def admin_create_kb_category(req: CategoryCreateRequest, user: dict[str, Any] = Depends(require_user)):
    """Create a new knowledge base category."""
    await _verify_bot_access(req.bot_id, user)
    slug = _slugify(req.slug or req.name)

    # Ensure unique slug
    existing = await run_db(lambda: supabase.table("chatty_kb_categories")
        .select("id")
        .eq("bot_id", req.bot_id)
        .eq("slug", slug)
        .execute())
    if existing.data:
        slug = f"{slug}-{int(time.time())}"

    row = {
        "bot_id": req.bot_id,
        "name": req.name.strip(),
        "slug": slug,
        "description": (req.description or "").strip(),
        "icon": (req.icon or "Folder").strip(),
        "order_index": req.order_index or 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    res = await run_db(lambda: supabase.table("chatty_kb_categories").insert(row).execute())
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to create category")
    return {"category": res.data[0]}


@router.patch("/api/admin/kb/categories/{cat_id}")
async def admin_update_kb_category(cat_id: str, req: CategoryUpdateRequest, user: dict[str, Any] = Depends(require_user)):
    """Update an existing knowledge base category."""
    cat_res = await run_db(lambda: supabase.table("chatty_kb_categories").select("*").eq("id", cat_id).execute())
    if not cat_res.data:
        raise HTTPException(status_code=404, detail="Category not found")
    cat = cat_res.data[0]
    await _verify_bot_access(cat["bot_id"], user)

    updates: dict[str, Any] = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if req.name is not None:
        updates["name"] = req.name.strip()
    if req.slug is not None:
        updates["slug"] = _slugify(req.slug)
    if req.description is not None:
        updates["description"] = req.description.strip()
    if req.icon is not None:
        updates["icon"] = req.icon.strip()
    if req.order_index is not None:
        updates["order_index"] = req.order_index

    res = await run_db(lambda: supabase.table("chatty_kb_categories").update(updates).eq("id", cat_id).execute())
    return {"category": res.data[0] if res.data else cat}


@router.delete("/api/admin/kb/categories/{cat_id}")
async def admin_delete_kb_category(cat_id: str, user: dict[str, Any] = Depends(require_user)):
    """Delete a category (articles inside have their category_id set to NULL)."""
    cat_res = await run_db(lambda: supabase.table("chatty_kb_categories").select("id, bot_id").eq("id", cat_id).execute())
    if not cat_res.data:
        raise HTTPException(status_code=404, detail="Category not found")
    await _verify_bot_access(cat_res.data[0]["bot_id"], user)

    await run_db(lambda: supabase.table("chatty_kb_categories").delete().eq("id", cat_id).execute())
    return {"success": True}


@router.get("/api/admin/kb/articles")
async def admin_get_kb_articles(
    bot_id: str,
    category_id: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    user: dict[str, Any] = Depends(require_user),
):
    """List all knowledge base articles with optional filters."""
    await _verify_bot_access(bot_id, user)
    q = supabase.table("chatty_kb_articles").select("*, category:chatty_kb_categories(name, slug, icon)").eq("bot_id", bot_id)
    if category_id:
        q = q.eq("category_id", category_id)
    if status:
        q = q.eq("status", status)
    q = q.order("order_index").order("created_at", desc=True)

    res = await run_db(lambda: q.execute())
    articles = res.data or []

    if search:
        s = search.lower().strip()
        articles = [a for a in articles if s in (a.get("title") or "").lower() or s in (a.get("content") or "").lower() or any(s in t.lower() for t in (a.get("tags") or []))]

    return {"articles": articles}


@router.get("/api/admin/kb/articles/{article_id}")
async def admin_get_kb_article(article_id: str, user: dict[str, Any] = Depends(require_user)):
    """Fetch single knowledge base article."""
    res = await run_db(lambda: supabase.table("chatty_kb_articles")
        .select("*, category:chatty_kb_categories(name, slug, icon)")
        .eq("id", article_id)
        .execute())
    if not res.data:
        raise HTTPException(status_code=404, detail="Article not found")
    article = res.data[0]
    await _verify_bot_access(article["bot_id"], user)
    return {"article": article}


@router.post("/api/admin/kb/articles")
async def admin_create_kb_article(req: ArticleCreateRequest, user: dict[str, Any] = Depends(require_user)):
    """Create a new knowledge base article, automatically syncing to chatty_sources for AI RAG memory."""
    await _verify_bot_access(req.bot_id, user)
    slug = _slugify(req.slug or req.title)

    # Check slug collision for this bot
    existing = await run_db(lambda: supabase.table("chatty_kb_articles")
        .select("id")
        .eq("bot_id", req.bot_id)
        .eq("slug", slug)
        .execute())
    if existing.data:
        slug = f"{slug}-{int(time.time())}"

    author_email = user.get("email") or ""
    author_name = (user.get("user_metadata") or {}).get("name") or (author_email.split("@")[0] if author_email else "Staff")
    author_id = user.get("id")

    source_id = None
    # Auto-sync to chatty_sources if published & public
    if req.status == "published" and req.visibility == "public" and req.content.strip():
        source_name = f"Article: {req.title.strip()}"
        src_res = await run_db(lambda: supabase.table("chatty_sources").insert({
            "bot_id": req.bot_id,
            "type": "text",
            "name": source_name,
            "content": req.content.strip(),
            "char_count": len(req.content.strip()),
            "status": "trained",
        }).execute())
        if src_res.data:
            source_id = src_res.data[0]["id"]

    row = {
        "bot_id": req.bot_id,
        "category_id": req.category_id or None,
        "title": req.title.strip(),
        "slug": slug,
        "subtitle": (req.subtitle or "").strip(),
        "content": req.content.strip(),
        "status": req.status or "published",
        "visibility": req.visibility or "public",
        "author_id": author_id,
        "author_name": author_name,
        "author_email": author_email,
        "tags": req.tags or [],
        "is_promoted": bool(req.is_promoted),
        "order_index": req.order_index or 0,
        "source_id": source_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    res = await run_db(lambda: supabase.table("chatty_kb_articles").insert(row).execute())
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to create article")
    return {"article": res.data[0]}


@router.patch("/api/admin/kb/articles/{article_id}")
async def admin_update_kb_article(article_id: str, req: ArticleUpdateRequest, user: dict[str, Any] = Depends(require_user)):
    """Update a knowledge base article, keeping chatty_sources RAG memory in sync."""
    art_res = await run_db(lambda: supabase.table("chatty_kb_articles").select("*").eq("id", article_id).execute())
    if not art_res.data:
        raise HTTPException(status_code=404, detail="Article not found")
    article = art_res.data[0]
    bot_id = article["bot_id"]
    await _verify_bot_access(bot_id, user)

    updates: dict[str, Any] = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if req.title is not None:
        updates["title"] = req.title.strip()
    if req.slug is not None:
        updates["slug"] = _slugify(req.slug)
    if req.category_id is not None:
        updates["category_id"] = req.category_id if req.category_id != "" else None
    if req.subtitle is not None:
        updates["subtitle"] = req.subtitle.strip()
    if req.content is not None:
        updates["content"] = req.content.strip()
    if req.status is not None:
        updates["status"] = req.status
    if req.visibility is not None:
        updates["visibility"] = req.visibility
    if req.tags is not None:
        updates["tags"] = req.tags
    if req.is_promoted is not None:
        updates["is_promoted"] = req.is_promoted
    if req.order_index is not None:
        updates["order_index"] = req.order_index

    # Resolve resulting state for RAG sync
    eff_status = updates.get("status", article.get("status"))
    eff_visibility = updates.get("visibility", article.get("visibility"))
    eff_title = updates.get("title", article.get("title"))
    eff_content = updates.get("content", article.get("content"))
    source_id = article.get("source_id")

    if eff_status == "published" and eff_visibility == "public" and eff_content:
        source_name = f"Article: {eff_title}"
        if source_id:
            await run_db(lambda: supabase.table("chatty_sources").update({
                "name": source_name,
                "content": eff_content,
                "char_count": len(eff_content),
                "status": "trained",
            }).eq("id", source_id).execute())
        else:
            src_res = await run_db(lambda: supabase.table("chatty_sources").insert({
                "bot_id": bot_id,
                "type": "text",
                "name": source_name,
                "content": eff_content,
                "char_count": len(eff_content),
                "status": "trained",
            }).execute())
            if src_res.data:
                updates["source_id"] = src_res.data[0]["id"]
    else:
        # Article is unpublished/internal/empty — unlink from RAG sources so bot doesn't expose it
        if source_id:
            await run_db(lambda: supabase.table("chatty_sources").delete().eq("id", source_id).execute())
            updates["source_id"] = None

    res = await run_db(lambda: supabase.table("chatty_kb_articles").update(updates).eq("id", article_id).execute())
    return {"article": res.data[0] if res.data else article}


@router.delete("/api/admin/kb/articles/{article_id}")
async def admin_delete_kb_article(article_id: str, user: dict[str, Any] = Depends(require_user)):
    """Delete an article and its linked RAG memory."""
    art_res = await run_db(lambda: supabase.table("chatty_kb_articles").select("id, bot_id, source_id").eq("id", article_id).execute())
    if not art_res.data:
        raise HTTPException(status_code=404, detail="Article not found")
    article = art_res.data[0]
    await _verify_bot_access(article["bot_id"], user)

    source_id = article.get("source_id")
    if source_id:
        await run_db(lambda: supabase.table("chatty_sources").delete().eq("id", source_id).execute())

    await run_db(lambda: supabase.table("chatty_kb_articles").delete().eq("id", article_id).execute())
    return {"success": True}


@router.get("/api/admin/kb/analytics")
async def admin_get_kb_analytics(bot_id: str, user: dict[str, Any] = Depends(require_user)):
    """Zendesk-grade Knowledge Base Analytics & Content Gap Detection."""
    await _verify_bot_access(bot_id, user)

    # 1. Articles stats
    art_res = await run_db(lambda: supabase.table("chatty_kb_articles")
        .select("id, title, slug, status, view_count, helpful_count, not_helpful_count")
        .eq("bot_id", bot_id)
        .execute())
    articles = art_res.data or []

    total_articles = len(articles)
    published_count = sum(1 for a in articles if a.get("status") == "published")
    draft_count = sum(1 for a in articles if a.get("status") == "draft")
    archived_count = sum(1 for a in articles if a.get("status") == "archived")

    total_views = sum(a.get("view_count") or 0 for a in articles)
    total_helpful = sum(a.get("helpful_count") or 0 for a in articles)
    total_not_helpful = sum(a.get("not_helpful_count") or 0 for a in articles)
    total_votes = total_helpful + total_not_helpful
    csat_percent = round((total_helpful / total_votes * 100), 1) if total_votes > 0 else 100.0

    # Sort top articles by view_count
    top_articles = sorted(articles, key=lambda a: a.get("view_count") or 0, reverse=True)[:5]

    # 2. Content Gaps: searches where results_count == 0
    search_res = await run_db(lambda: supabase.table("chatty_kb_searches")
        .select("query, created_at")
        .eq("bot_id", bot_id)
        .eq("results_count", 0)
        .order("created_at", desc=True)
        .limit(50)
        .execute())
    searches = search_res.data or []
    # Deduplicate / group frequency of search terms
    query_freq: dict[str, int] = {}
    for s in searches:
        q = (s.get("query") or "").strip().lower()
        if q:
            query_freq[q] = query_freq.get(q, 0) + 1
    content_gaps = [{"query": q, "count": cnt} for q, cnt in sorted(query_freq.items(), key=lambda x: x[1], reverse=True)[:10]]

    # 3. Categories count
    cat_res = await run_db(lambda: supabase.table("chatty_kb_categories").select("id", count="exact").eq("bot_id", bot_id).execute())
    total_categories = cat_res.count if cat_res.count is not None else len(cat_res.data or [])

    return {
        "total_articles": total_articles,
        "published_count": published_count,
        "draft_count": draft_count,
        "archived_count": archived_count,
        "total_categories": total_categories,
        "total_views": total_views,
        "total_helpful": total_helpful,
        "total_not_helpful": total_not_helpful,
        "csat_percent": csat_percent,
        "top_articles": top_articles,
        "content_gaps": content_gaps,
    }


# ---------------------------------------------------------------------------
# PILLAR 3: OMNICHANNEL ROUTING, AGENT PRESENCE & LIVE QUEUE (Zendesk Level)
# ---------------------------------------------------------------------------

async def _dispatch_ticket_to_agent(bot_id: str, session_id: str) -> dict[str, Any]:
    """Auto-dispatch an unassigned or escalated ticket to an online agent
    respecting capacity rules and routing algorithms (spare_capacity or round_robin)."""
    try:
        # 1. Fetch routing settings
        try:
            set_res = await run_db(lambda: supabase.table("chatty_routing_settings").select("*").eq("bot_id", bot_id).execute())
            settings = set_res.data[0] if set_res.data else {
                "routing_enabled": True,
                "algorithm": "spare_capacity",
                "default_capacity": 5,
                "offline_fallback": "unassigned_queue",
            }
        except Exception:
            settings = {
                "routing_enabled": True,
                "algorithm": "spare_capacity",
                "default_capacity": 5,
                "offline_fallback": "unassigned_queue",
            }

        if not settings.get("routing_enabled", True):
            return {"dispatched": False, "reason": "routing_disabled"}

        algorithm = settings.get("algorithm") or "spare_capacity"
        offline_fallback = settings.get("offline_fallback") or "unassigned_queue"

        # 2. Fetch online agents
        pres_res = await run_db(lambda: supabase.table("chatty_agent_presence")
            .select("*")
            .eq("bot_id", bot_id)
            .eq("status", "online")
            .execute())
        online_agents = pres_res.data or []

        if not online_agents:
            return {"dispatched": False, "reason": "no_online_agents", "fallback": offline_fallback}

        # 3. Calculate current workload for each online agent
        open_tickets_res = await run_db(lambda: supabase.table("chatty_sessions")
            .select("assigned_agent_email")
            .eq("bot_id", bot_id)
            .in_("status", ["open", "pending"])
            .execute())

        agent_workload: dict[str, int] = {}
        for s in (open_tickets_res.data or []):
            em = s.get("assigned_agent_email")
            if em:
                agent_workload[em.lower()] = agent_workload.get(em.lower(), 0) + 1

        # Filter agents with spare capacity
        eligible: list[dict[str, Any]] = []
        for ag in online_agents:
            email = (ag.get("agent_email") or "").lower()
            active = agent_workload.get(email, 0)
            cap = ag.get("max_capacity") or settings.get("default_capacity", 5)
            spare = cap - active
            if spare > 0:
                eligible.append({
                    **ag,
                    "active_count": active,
                    "spare_capacity": spare,
                })

        if not eligible:
            return {"dispatched": False, "reason": "all_agents_at_capacity", "fallback": offline_fallback}

        # 4. Pick best agent according to algorithm
        if algorithm == "round_robin":
            # Sort by last_assigned_at ASC (oldest assignment first)
            eligible.sort(key=lambda a: a.get("last_assigned_at") or "1970-01-01")
        else:
            # Highest spare capacity first
            eligible.sort(key=lambda a: a.get("spare_capacity", 0), reverse=True)

        chosen = eligible[0]
        now_iso = datetime.now(timezone.utc).isoformat()

        # 5. Assign ticket and stamp last_assigned_at
        await run_db(lambda: supabase.table("chatty_sessions").update({
            "assigned_agent_email": chosen["agent_email"],
            "assigned_agent_name": chosen["agent_name"],
        }).eq("session_id", session_id).eq("bot_id", bot_id).execute())

        try:
            await run_db(lambda: supabase.table("chatty_agent_presence").update({
                "last_assigned_at": now_iso,
            }).eq("id", chosen["id"]).execute())
        except Exception:
            pass

        return {
            "dispatched": True,
            "assigned_agent_email": chosen["agent_email"],
            "assigned_agent_name": chosen["agent_name"],
            "algorithm": algorithm,
        }
    except Exception as e:
        logger.warning("Ticket auto-dispatch failed: %s", e)
        return {"dispatched": False, "reason": str(e)}


@router.get("/api/admin/routing/presence")
async def admin_get_routing_presence(bot_id: str, user: dict[str, Any] = Depends(require_user)):
    """Fetch live presence, active workloads, and capacity for all team agents."""
    await _verify_bot_access(bot_id, user)

    user_id = user.get("id")
    email = user.get("email") or ""
    name = (user.get("user_metadata") or {}).get("name") or (email.split("@")[0] if email else "Agent")
    default_my_presence = {
        "bot_id": bot_id,
        "user_id": user_id,
        "agent_email": email,
        "agent_name": name,
        "status": "online",
        "max_capacity": 5,
        "active_tickets_count": 0,
    }

    try:
        # 1. Fetch presence records
        pres_res = await run_db(lambda: supabase.table("chatty_agent_presence")
            .select("*")
            .eq("bot_id", bot_id)
            .order("status")
            .order("agent_name")
            .execute())
        presence_list = pres_res.data or []

        # 2. Fetch active workloads
        open_tickets_res = await run_db(lambda: supabase.table("chatty_sessions")
            .select("assigned_agent_email")
            .eq("bot_id", bot_id)
            .in_("status", ["open", "pending"])
            .execute())
        workload: dict[str, int] = {}
        for s in (open_tickets_res.data or []):
            em = s.get("assigned_agent_email")
            if em:
                workload[em.lower()] = workload.get(em.lower(), 0) + 1

        for p in presence_list:
            p_email = (p.get("agent_email") or "").lower()
            p["active_tickets_count"] = workload.get(p_email, 0)

        # 3. Find current user's presence
        my_presence = next((p for p in presence_list if p.get("user_id") == user_id), None)

        if not my_presence and user_id:
            now_iso = datetime.now(timezone.utc).isoformat()
            init_row = {
                "bot_id": bot_id,
                "user_id": user_id,
                "agent_email": email,
                "agent_name": name,
                "status": "online",
                "max_capacity": 5,
                "last_assigned_at": now_iso,
                "last_seen_at": now_iso,
                "updated_at": now_iso,
            }
            try:
                res_init = await run_db(lambda: supabase.table("chatty_agent_presence").insert(init_row).execute())
                if res_init.data:
                    my_presence = {**res_init.data[0], "active_tickets_count": workload.get(email.lower(), 0)}
                    presence_list.append(my_presence)
            except Exception:
                my_presence = default_my_presence
                presence_list.append(my_presence)

        return {
            "agents": presence_list if presence_list else [default_my_presence],
            "my_presence": my_presence or default_my_presence,
        }
    except Exception as e:
        logger.warning("Failed to fetch routing presence (migration may be pending): %s", e)
        return {
            "agents": [default_my_presence],
            "my_presence": default_my_presence,
        }


@router.post("/api/admin/routing/status")
async def admin_set_routing_status(req: AgentPresenceUpdateRequest, user: dict[str, Any] = Depends(require_user)):
    """Set current user's live presence status (online, away, busy, offline)."""
    await _verify_bot_access(req.bot_id, user)
    user_id = user.get("id")
    if not user_id:
        raise HTTPException(status_code=400, detail="Missing user id")

    email = user.get("email") or ""
    name = (user.get("user_metadata") or {}).get("name") or (email.split("@")[0] if email else "Agent")
    now_iso = datetime.now(timezone.utc).isoformat()

    updates: dict[str, Any] = {
        "status": req.status,
        "last_seen_at": now_iso,
        "updated_at": now_iso,
    }
    if req.max_capacity is not None and req.max_capacity > 0:
        updates["max_capacity"] = req.max_capacity

    try:
        existing = await run_db(lambda: supabase.table("chatty_agent_presence")
            .select("id")
            .eq("bot_id", req.bot_id)
            .eq("user_id", user_id)
            .execute())

        if existing.data:
            res = await run_db(lambda: supabase.table("chatty_agent_presence")
                .update(updates)
                .eq("id", existing.data[0]["id"])
                .execute())
        else:
            row = {
                "bot_id": req.bot_id,
                "user_id": user_id,
                "agent_email": email,
                "agent_name": name,
                "status": req.status,
                "max_capacity": req.max_capacity or 5,
                "last_assigned_at": now_iso,
                "last_seen_at": now_iso,
                "updated_at": now_iso,
            }
            res = await run_db(lambda: supabase.table("chatty_agent_presence").insert(row).execute())

        return {"success": True, "presence": res.data[0] if res.data else updates}
    except Exception as e:
        logger.warning("Failed to update routing status (migration may be pending): %s", e)
        return {"success": True, "presence": {**updates, "agent_email": email, "agent_name": name}}




@router.get("/api/admin/routing/settings")
async def admin_get_routing_settings(bot_id: str, user: dict[str, Any] = Depends(require_user)):
    """Get bot omnichannel routing configuration."""
    await _verify_bot_access(bot_id, user)
    default_settings = {
        "bot_id": bot_id,
        "routing_enabled": True,
        "algorithm": "spare_capacity",
        "default_capacity": 5,
        "offline_fallback": "unassigned_queue",
    }
    try:
        res = await run_db(lambda: supabase.table("chatty_routing_settings").select("*").eq("bot_id", bot_id).execute())
        if res.data:
            return {"settings": res.data[0]}
        return {"settings": default_settings}
    except Exception as e:
        logger.warning("Failed to get routing settings (migration may be pending): %s", e)
        return {"settings": default_settings}


@router.patch("/api/admin/routing/settings")
async def admin_update_routing_settings(req: RoutingSettingsUpdateRequest, user: dict[str, Any] = Depends(require_user)):
    """Update bot omnichannel routing configuration."""
    await _verify_bot_access(req.bot_id, user)
    now_iso = datetime.now(timezone.utc).isoformat()

    updates: dict[str, Any] = {"updated_at": now_iso}
    if req.routing_enabled is not None:
        updates["routing_enabled"] = req.routing_enabled
    if req.algorithm is not None:
        updates["algorithm"] = req.algorithm
    if req.default_capacity is not None and req.default_capacity > 0:
        updates["default_capacity"] = req.default_capacity
    if req.offline_fallback is not None:
        updates["offline_fallback"] = req.offline_fallback

    try:
        existing = await run_db(lambda: supabase.table("chatty_routing_settings").select("id").eq("bot_id", req.bot_id).execute())
        if existing.data:
            res = await run_db(lambda: supabase.table("chatty_routing_settings").update(updates).eq("id", existing.data[0]["id"]).execute())
        else:
            row = {
                "bot_id": req.bot_id,
                "routing_enabled": req.routing_enabled if req.routing_enabled is not None else True,
                "algorithm": req.algorithm or "spare_capacity",
                "default_capacity": req.default_capacity or 5,
                "offline_fallback": req.offline_fallback or "unassigned_queue",
                "created_at": now_iso,
                "updated_at": now_iso,
            }
            res = await run_db(lambda: supabase.table("chatty_routing_settings").insert(row).execute())

        return {"settings": res.data[0] if res.data else updates}
    except Exception as e:
        logger.warning("Failed to update routing settings (migration may be pending): %s", e)
        return {"settings": updates}


@router.post("/api/admin/routing/dispatch-queue")
async def admin_dispatch_routing_queue(bot_id: str, user: dict[str, Any] = Depends(require_user)):
    """Dispatch all unassigned open/pending tickets in the queue to online agents with capacity."""
    await _verify_bot_access(bot_id, user)

    try:
        # Find unassigned sessions
        res_sessions = await run_db(lambda: supabase.table("chatty_sessions")
            .select("session_id")
            .eq("bot_id", bot_id)
            .in_("status", ["open", "pending"])
            .is_("assigned_agent_email", "null")
            .order("created_at")
            .limit(20)
            .execute())

        sessions = res_sessions.data or []
        dispatched_count = 0
        results = []

        for s in sessions:
            sid = s["session_id"]
            res = await _dispatch_ticket_to_agent(bot_id, sid)
            if res.get("dispatched"):
                dispatched_count += 1
                results.append({"session_id": sid, "assigned_to": res.get("assigned_agent_email")})

        return {
            "unassigned_found": len(sessions),
            "dispatched_count": dispatched_count,
            "results": results,
        }
    except Exception as e:
        logger.warning("Failed to dispatch routing queue: %s", e)
        return {
            "unassigned_found": 0,
            "dispatched_count": 0,
            "results": [],
            "error": str(e)
        }


