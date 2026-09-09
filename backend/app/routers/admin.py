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
from app.schemas.admin import (
    InboxAIToggle,
    InboxDeleteRequest,
    InboxReplyRequest,
    MessageFeedbackRequest,
    RescheduleMeetingRequest,
    SessionNoteCreateRequest,
    SessionUpdateRequest,
)

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
