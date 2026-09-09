"""Inbound Email Support & Ticket Gateway Router.
Accepts incoming emails from Resend Inbound, SendGrid, Postmark, and generic mail forwarders,
automatically creating or updating Helpdesk tickets with email threading.
"""

from __future__ import annotations

import json
import logging
import os
import re
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from pydantic import BaseModel

from app.core.clients import supabase
from app.core.db import run_db
from app.core.deps import require_user
from app.routers.admin import _dispatch_ticket_to_agent, _verify_bot_access
from app.services.email_service import extract_email, extract_name
from app.services.slack_escalation import send_slack_escalation_alert

logger = logging.getLogger("chatty.email_inbound")

router = APIRouter()

TICKET_SUBJECT_RE = re.compile(r"\[Ticket\s*#?([a-zA-Z0-9_-]{6,36})\]", re.IGNORECASE)
BOT_ALIAS_RE = re.compile(r"support\+([0-9a-fA-F-]{36})@", re.IGNORECASE)
TICKET_ALIAS_RE = re.compile(r"ticket\+([a-zA-Z0-9_-]+)@", re.IGNORECASE)


class EmailSettingsUpdateRequest(BaseModel):
    bot_id: str
    email_support_address: Optional[str] = None
    slack_escalation_webhook_url: Optional[str] = None


@router.get("/api/admin/email/settings")
async def get_email_settings(bot_id: str, user: dict[str, Any] = Depends(require_user)):
    """Fetch bot email support address and Slack escalation webhook configuration."""
    await _verify_bot_access(bot_id, user)
    res = await run_db(lambda: supabase.table("chatty_bots")
        .select("id, name, email_support_address, slack_escalation_webhook_url")
        .eq("id", bot_id)
        .limit(1)
        .execute())
    if not res.data:
        raise HTTPException(status_code=404, detail="Bot not found")
    b = res.data[0]
    return {
        "email_support_address": b.get("email_support_address") or "",
        "slack_escalation_webhook_url": b.get("slack_escalation_webhook_url") or "",
        "inbound_webhook_url": f"/api/webhooks/inbound-email",
    }


@router.patch("/api/admin/email/settings")
async def update_email_settings(req: EmailSettingsUpdateRequest, user: dict[str, Any] = Depends(require_user)):
    """Update bot email support address and Slack escalation webhook URL."""
    await _verify_bot_access(req.bot_id, user)
    upd: dict[str, Any] = {}
    if req.email_support_address is not None:
        upd["email_support_address"] = req.email_support_address.strip()
    if req.slack_escalation_webhook_url is not None:
        upd["slack_escalation_webhook_url"] = req.slack_escalation_webhook_url.strip()

    if upd:
        await run_db(lambda: supabase.table("chatty_bots").update(upd).eq("id", req.bot_id).execute())

    return {"success": True, "settings": upd}


@router.post("/api/webhooks/inbound-email")
@router.post("/webhook/email-inbound")
async def receive_inbound_email(request: Request, background_tasks: BackgroundTasks):
    """Universal Inbound Email Webhook.
    Converts incoming customer support emails into threaded Helpdesk tickets."""
    try:
        content_type = request.headers.get("content-type", "")
        if "application/json" in content_type:
            payload = await request.json()
        else:
            # Handle multipart/form-data or urlencoded (e.g. SendGrid Inbound Parse)
            form = await request.form()
            payload = {k: v for k, v in form.items()}
    except Exception as e:
        logger.warning("Failed to parse inbound email payload: %s", e)
        return {"ok": False, "error": "Invalid request payload"}

    # Resend wraps event in {"data": {...}}
    data = payload.get("data") if isinstance(payload.get("data"), dict) else payload

    # 1. Normalize email fields
    from_field = data.get("from") or data.get("From") or data.get("sender") or ""
    from_email = extract_email(from_field)
    from_name = extract_name(from_field) or from_email.split("@")[0]

    to_field = data.get("to") or data.get("To") or data.get("recipient") or []
    if isinstance(to_field, str):
        to_addresses = [to_field]
    elif isinstance(to_field, list):
        to_addresses = [str(x) for x in to_field]
    else:
        to_addresses = []

    subject = str(data.get("subject") or data.get("Subject") or "Support Request").strip()
    text_body = str(data.get("text") or data.get("TextBody") or data.get("html") or data.get("HtmlBody") or "").strip()

    # Normalize headers
    headers = data.get("headers") or {}
    if isinstance(headers, list):
        headers_dict = {}
        for h in headers:
            if isinstance(h, dict) and "name" in h and "value" in h:
                headers_dict[h["name"].lower()] = h["value"]
        headers = headers_dict

    message_id = (
        data.get("message_id")
        or data.get("MessageID")
        or headers.get("message-id")
        or f"<msg_{uuid.uuid4().hex[:16]}@chatty.inbound>"
    )
    in_reply_to = data.get("in_reply_to") or headers.get("in-reply-to") or ""
    references = data.get("references") or headers.get("references") or ""

    if not from_email:
        logger.warning("Inbound email received without valid sender: %s", from_field)
        return {"ok": True, "matched": False, "reason": "no_from_email"}

    now_utc = datetime.now(timezone.utc)
    now_iso = now_utc.isoformat()

    # 2. Target Bot Resolution
    bot_id = None

    # Check To addresses for aliases (support+<bot_id>@... or ticket+<session_id>@...)
    matched_session_id_from_to = None
    for to_addr in to_addresses:
        m_bot = BOT_ALIAS_RE.search(to_addr)
        if m_bot:
            bot_id = m_bot.group(1)
            break
        m_tick = TICKET_ALIAS_RE.search(to_addr)
        if m_tick:
            matched_session_id_from_to = m_tick.group(1)
            break

    # If bot_id not found via alias, check email_support_address
    if not bot_id and not matched_session_id_from_to:
        for to_addr in to_addresses:
            clean_to = extract_email(to_addr)
            if clean_to:
                res_b = await run_db(lambda: supabase.table("chatty_bots")
                    .select("id")
                    .eq("email_support_address", clean_to)
                    .limit(1)
                    .execute())
                if res_b.data:
                    bot_id = res_b.data[0]["id"]
                    break

    # Fallback to single bot in database if only one exists
    if not bot_id and not matched_session_id_from_to:
        res_any = await run_db(lambda: supabase.table("chatty_bots").select("id").limit(1).execute())
        if res_any.data:
            bot_id = res_any.data[0]["id"]

    # 3. Thread & Session Matching
    existing_session = None

    # A. Direct match from recipient ticket alias
    if matched_session_id_from_to:
        res_s = await run_db(lambda: supabase.table("chatty_sessions")
            .select("*")
            .or_(f"session_id.eq.{matched_session_id_from_to},session_id.ilike.{matched_session_id_from_to}%")
            .limit(1)
            .execute())
        if res_s.data:
            existing_session = res_s.data[0]
            bot_id = existing_session["bot_id"]

    # B. Match [Ticket #<session_id>] in subject line
    if not existing_session:
        m_sub = TICKET_SUBJECT_RE.search(subject)
        if m_sub:
            short_id = m_sub.group(1)
            res_s = await run_db(lambda: supabase.table("chatty_sessions")
                .select("*")
                .or_(f"session_id.eq.{short_id},session_id.ilike.{short_id}%")
                .limit(1)
                .execute())
            if res_s.data:
                existing_session = res_s.data[0]
                bot_id = existing_session["bot_id"]

    # C. Match In-Reply-To or References message id
    if not existing_session and in_reply_to:
        clean_in_reply = in_reply_to.strip().strip("<>")
        res_s = await run_db(lambda: supabase.table("chatty_sessions")
            .select("*")
            .or_(f"last_inbound_message_id.ilike.%{clean_in_reply}%,email_thread_id.ilike.%{clean_in_reply}%")
            .limit(1)
            .execute())
        if res_s.data:
            existing_session = res_s.data[0]
            bot_id = existing_session["bot_id"]

    if not bot_id:
        logger.warning("Could not match inbound email to any bot: from=%s, to=%s", from_email, to_addresses)
        return {"ok": True, "matched": False, "reason": "no_matching_bot"}

    # 4. Handle Existing Ticket vs New Ticket
    if existing_session:
        session_id = existing_session["session_id"]
        logger.info("Inbound email matched existing ticket: %s", session_id)

        # Append incoming email message
        try:
            await run_db(lambda: supabase.table("chatty_conversations").insert({
                "bot_id": bot_id,
                "session_id": session_id,
                "role": "user",
                "content": text_body or "[Empty Email Body]",
                "sender": "visitor",
            }).execute())
        except Exception as e:
            logger.exception("Failed to insert email conversation message: %s", e)

        # Update session status back to open and stamp last_message
        upd: dict[str, Any] = {
            "status": "open",
            "last_message": text_body[:500] if text_body else "[Email Message]",
            "last_message_at": now_iso,
            "last_inbound_message_id": message_id,
        }
        # Check negative sentiment
        is_urgent = any(w in text_body.lower() for w in ["unacceptable", "broken", "angry", "frustrated", "refund", "lawyer", "terrible", "emergency"])
        if is_urgent:
            upd["priority"] = "urgent"
            upd["needs_attention"] = True
            background_tasks.add_task(send_slack_escalation_alert, bot_id, session_id, "Inbound Email Frustration Detected", "urgent", text_body)

        try:
            await run_db(lambda: supabase.table("chatty_sessions").update(upd).eq("session_id", session_id).eq("bot_id", bot_id).execute())
        except Exception as e:
            logger.warning("Failed to update session for inbound email: %s", e)

        return {"ok": True, "action": "appended_to_ticket", "session_id": session_id}

    else:
        # 5. Create Brand New Email Ticket
        session_id = f"email_{uuid.uuid4().hex[:12]}"
        logger.info("Creating new inbound email ticket: %s for %s", session_id, from_email)

        # Sentiment check for initial priority
        is_urgent = any(w in (subject + " " + text_body).lower() for w in ["unacceptable", "broken", "angry", "frustrated", "refund", "lawyer", "terrible", "emergency", "urgent", "asap"])
        priority_val = "urgent" if is_urgent else "normal"

        first_resp_due = (now_utc + timedelta(minutes=15)).isoformat()
        res_due = (now_utc + timedelta(hours=4)).isoformat()

        session_row = {
            "session_id": session_id,
            "bot_id": bot_id,
            "channel": "email",
            "subject": subject,
            "visitor_name": from_name,
            "visitor_email": from_email,
            "last_inbound_message_id": message_id,
            "email_thread_id": message_id,
            "status": "open",
            "priority": priority_val,
            "first_response_due_at": first_resp_due,
            "resolution_due_at": res_due,
            "sla_status": "on_track",
            "last_message": text_body[:500] if text_body else "[Email Message]",
            "last_message_at": now_iso,
            "created_at": now_iso,
            "needs_attention": is_urgent,
        }

        try:
            await run_db(lambda: supabase.table("chatty_sessions").insert(session_row).execute())
        except Exception as e:
            logger.exception("Failed to create email ticket session: %s", e)
            # Fallback without extra columns if migration pending
            try:
                minimal_row = {
                    "session_id": session_id,
                    "bot_id": bot_id,
                    "visitor_name": from_name,
                    "last_message": text_body[:500] if text_body else "[Email Message]",
                    "last_message_at": now_iso,
                    "created_at": now_iso,
                }
                await run_db(lambda: supabase.table("chatty_sessions").insert(minimal_row).execute())
            except Exception as e2:
                logger.exception("Fallback session creation also failed: %s", e2)

        # Insert first conversation message
        try:
            await run_db(lambda: supabase.table("chatty_conversations").insert({
                "bot_id": bot_id,
                "session_id": session_id,
                "role": "user",
                "content": f"Subject: {subject}\n\n{text_body}",
                "sender": "visitor",
            }).execute())
        except Exception as e:
            logger.exception("Failed to insert initial conversation message: %s", e)

        # Auto-dispatch to online agent with capacity
        background_tasks.add_task(_dispatch_ticket_to_agent, bot_id, session_id)

        # If urgent, trigger Slack alert immediately
        if is_urgent:
            background_tasks.add_task(send_slack_escalation_alert, bot_id, session_id, "Inbound Email Marked Urgent", "urgent", f"{subject}: {text_body}")

        return {"ok": True, "action": "created_ticket", "session_id": session_id, "channel": "email"}
