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
from app.schemas.admin import (
    InboxAIToggle,
    InboxDeleteRequest,
    InboxReplyRequest,
    MessageFeedbackRequest,
    RescheduleMeetingRequest,
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
    # Taking over pauses the AI and clears the needs-attention flag.
    await run_db(lambda: supabase.table("chatty_sessions").update({
        "ai_paused": True, "needs_attention": False, "last_message": req.text[:300],
        "last_message_at": datetime.now(timezone.utc).isoformat(),
    }).eq("bot_id", req.bot_id).eq("session_id", req.session_id).execute())
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
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty file")
    if len(data) > _MEDIA_MAX_BYTES:
        raise HTTPException(status_code=400, detail="File too large (max 20MB)")
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
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

    display = (text.strip() + ("\n" if text.strip() else "")) + f"[attachment: {file.filename or mime}]"
    content = display + (f"\n{file_url}" if file_url else "")

    await run_db(lambda: supabase.table("chatty_conversations").insert({
        "bot_id": bot_id, "session_id": session_id, "role": "assistant",
        "content": content, "sender": "human",
    }).execute())

    await run_db(lambda: supabase.table("chatty_sessions").update({
        "ai_paused": True, "needs_attention": False, "last_message": content[:300],
        "last_message_at": datetime.now(timezone.utc).isoformat(),
    }).eq("bot_id", bot_id).eq("session_id", session_id).execute())

    return {"success": True, "file_url": file_url, "file_type": mime}


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
