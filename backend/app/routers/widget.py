"""Widget chat/theme/feedback/polling endpoints (/api/widget/*)."""

from __future__ import annotations

import asyncio
import base64
import json
import logging
import re
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import pytz

from fastapi import APIRouter, BackgroundTasks, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import StreamingResponse

from app.core.clients import supabase
from app.core.config import GEMINI_FALLBACK_MODELS
from app.core.db import run_db
from app.core.uploads import read_upload_capped
from app.services.chatty_quota_service import WHITELABEL_PLANS, chatty_quota_exceeded, plan_for
from app.services.widget_session_service import (
    _detect_sentiment_escalation,
    _log_unanswered_if_needed,
    _needs_human,
    _notify_new_conversation,
    _upsert_session,
    geoip_lookup,
)
from plugins import ai_client
from app.schemas.widget import (
    WidgetBookingConfirmRequest,
    WidgetBookingRescheduleRequest,
    WidgetBookingCancelRequest,
    WidgetChatRequest,
    WidgetChatResponse,
    WidgetCsatRequest,
    WidgetFeedbackRequest,
    WidgetMediaResponse,
    WidgetVerifyOriginRequest,
)
from app.schemas.kb import ArticleFeedbackRequest
from plugins import notifications as notify

# Bridged helpers still living in main.py (Phase 2 leaves these in place to
# avoid a large, risky helper-extraction pass alongside the route split).
from main import (
    WIDGET_MAX_CHARS,
    WIDGET_QUOTA_REPLY,
    _client_ip,
    _mint_widget_token,
    _normalize_host,
    _rate_limited_async,
    _widget_rate_limit_or_429,
)
from plugins.widget_brain import run_widget_assistant

logger = logging.getLogger("chatty")

router = APIRouter()

_ALLOWED_MEDIA_PREFIXES = ("image/", "audio/", "application/pdf", "text/")
_MEDIA_MAX_BYTES = 20 * 1024 * 1024  # 20MB
_TRANSCRIBE_MAX_BYTES = 10 * 1024 * 1024  # 10MB - voice notes, not full files
_TRANSCRIBE_PROMPT = (
    "Transcribe the spoken words in this audio to plain text, as best you "
    "can even if it's unclear or partial. Output ONLY the transcription - "
    "no commentary, no markdown, no quotes, no translation. Only output "
    "nothing if the audio is truly silent with no speech at all."
)


@router.post("/api/widget/verify-origin")
async def widget_verify_origin(body: WidgetVerifyOriginRequest):
    """Exchange the customer page's real Referer (captured server-side by the
    Next.js embed page, the one point in the flow where a browser exposes it
    genuinely) for a short-lived signed token the widget then attaches to
    every chat/media call. Never hard-fails - always returns a token, even
    when unverified, so a missing Referer just falls into the stricter rate
    tier rather than breaking the widget outright."""
    res = await run_db(lambda: supabase.table("chatty_bots").select("allowed_domains").eq("id", body.bot_id).execute())
    if not res.data:
        raise HTTPException(status_code=404, detail="Bot not found")
    bot = res.data[0]
    allowed = bot.get("allowed_domains") or []
    verified = (not allowed) or bool(
        _normalize_host(body.referer or "") and _normalize_host(body.referer or "") in {_normalize_host(a) for a in allowed if a}
    )
    token = _mint_widget_token(body.bot_id, verified)
    return {"token": token, "verified": verified}


@router.post("/api/widget/chat", response_model=WidgetChatResponse)
async def widget_chat(
    body: WidgetChatRequest,
    request: Request,
    background_tasks: BackgroundTasks,
):
    bot_id = body.bot_id
    session_id = body.session_id
    text = body.text
    visitor_timezone = body.visitor_timezone
    visitor_name = (body.visitor_name or "").strip()[:120] or None
    visitor_email = (body.visitor_email or "").strip().lower()[:160] or None
    if visitor_email and not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", visitor_email):
        raise HTTPException(status_code=400, detail="visitor_email must be a valid email address")

    # --- Input validation / abuse caps ---
    if not text or not text.strip():
        raise HTTPException(status_code=400, detail="text required")
    if len(text) > WIDGET_MAX_CHARS:
        raise HTTPException(status_code=400, detail=f"Message too long (max {WIDGET_MAX_CHARS} characters)")

    # 1. Fetch bot
    res = await run_db(lambda: supabase.table("chatty_bots").select("*").eq("id", bot_id).execute())
    if not res.data:
        raise HTTPException(status_code=404, detail="Bot not found")
    bot = res.data[0]

    # --- Rate limit per bot + IP - unverified-origin traffic gets a much
    # tighter tier instead of an outright 403 (see _widget_rate_limit_or_429).
    ip = _client_ip(request)
    await _widget_rate_limit_or_429(bot, bot_id, ip, request.headers.get("x-widget-token"))

    # 2. Fetch owner
    owner_id = bot["user_id"]
    res_user = await run_db(lambda: supabase.table("users").select("*").eq("auth_user_id", owner_id).execute())
    if not res_user.data:
        raise HTTPException(status_code=404, detail="Bot owner not found")
    owner_user = res_user.data[0]

    # 2b. Session tracking + new-conversation email
    session_row, is_new = await _upsert_session(bot_id, session_id, text, visitor_name=visitor_name, visitor_email=visitor_email)
    if is_new:
        await _notify_new_conversation(bot, owner_user, text, session_id)
        background_tasks.add_task(
            notify.enqueue_webhook_event, supabase, bot_id=bot_id, event="session.started",
            session_id=session_id, data={"first_message": text[:500]},
        )

    if body.offline_ticket:
        try:
            offline_update = {
                "needs_attention": True,
                "escalation_reason": "Offline support ticket submitted",
                "priority": "high",
                "ai_paused": True,
            }
            if visitor_name:
                offline_update["visitor_name"] = visitor_name
            if visitor_email:
                offline_update["visitor_email"] = visitor_email
            await run_db(lambda: supabase.table("chatty_sessions").update(offline_update).eq("bot_id", bot_id).eq("session_id", session_id).execute())
        except Exception:
            logger.exception("Failed to mark offline ticket session")

    # Flag conversations where the visitor asks for a human or shows frustration.
    esc = _detect_sentiment_escalation(text)
    if esc:
        try:
            upd = {"needs_attention": True, "escalation_reason": esc}
            if "Negative" in esc:
                upd["priority"] = "urgent"
            else:
                upd["priority"] = "high"
            await run_db(lambda: supabase.table("chatty_sessions").update(upd)
                .eq("bot_id", bot_id).eq("session_id", session_id).execute())
        except Exception:
            pass
        try:
            from app.routers.admin import _dispatch_ticket_to_agent
            background_tasks.add_task(_dispatch_ticket_to_agent, bot_id, session_id)
        except Exception:
            pass
        try:
            from app.services.slack_escalation import send_slack_escalation_alert
            priority_val = "urgent" if "Negative" in esc else "high"
            background_tasks.add_task(send_slack_escalation_alert, bot_id, session_id, esc, priority_val, text)
        except Exception:
            pass

    # 3. Save user message
    try:
        await run_db(lambda: supabase.table("chatty_conversations").insert({
            "bot_id": bot_id, "session_id": session_id, "role": "user",
            "content": text, "sender": "visitor",
        }).execute())
    except Exception:
        logger.exception("Failed to save user conversation message")
    background_tasks.add_task(
        notify.enqueue_webhook_event, supabase, bot_id=bot_id, event="message.user",
        session_id=session_id, data={"content": text, "visitor_name": visitor_name, "visitor_email": visitor_email, "offline_ticket": body.offline_ticket},
    )

    if body.offline_ticket:
        return WidgetChatResponse(reply="", session_id=session_id, ai_paused=True)

    # 2c. If a human agent has taken over, don't run the AI - they'll reply.
    if session_row.get("ai_paused"):
        return WidgetChatResponse(reply="", session_id=session_id, ai_paused=True)

    # 3b. Quota gate - never spend model tokens once the owner is out of quota.
    if await chatty_quota_exceeded(owner_user, owner_id):
        try:
            await run_db(lambda: supabase.table("chatty_sessions").update({
                "needs_attention": True,
                "escalation_reason": "Account quota exceeded",
                "priority": "high",
            }).eq("bot_id", bot_id).eq("session_id", session_id).execute())
        except Exception:
            pass
        try:
            await run_db(lambda: supabase.table("chatty_conversations").insert({
                "bot_id": bot_id, "session_id": session_id, "role": "assistant",
                "content": WIDGET_QUOTA_REPLY, "sender": "ai",
            }).execute())
        except Exception:
            logger.exception("Failed to save quota-exceeded reply")
        return WidgetChatResponse(reply=WIDGET_QUOTA_REPLY, session_id=session_id)

    # 4. Run assistant
    try:
        result = await run_widget_assistant(
            bot_id=bot_id, owner_user=owner_user, bot=bot,
            session_id=session_id, text=text, visitor_timezone=visitor_timezone,
            visitor_geo=await geoip_lookup(ip),
        )
    except Exception:
        logger.exception("Widget assistant run failed")
        raise HTTPException(status_code=502, detail="widget assistant failed")

    reply = result["reply"]

    # 5. Save assistant reply
    try:
        await run_db(lambda: supabase.table("chatty_conversations").insert({
            "bot_id": bot_id, "session_id": session_id, "role": "assistant",
            "content": reply, "sender": "ai",
        }).execute())
    except Exception:
        logger.exception("Failed to save assistant conversation message")
    background_tasks.add_task(
        notify.enqueue_webhook_event, supabase, bot_id=bot_id, event="message.assistant",
        session_id=session_id, data={"content": reply},
    )

    background_tasks.add_task(_log_unanswered_if_needed, bot_id, session_id, text, reply)

    return WidgetChatResponse(reply=reply, session_id=session_id, sources=result.get("sources") or None)


@router.post("/api/widget/chat/stream")
async def widget_chat_stream(body: WidgetChatRequest, request: Request, background_tasks: BackgroundTasks):
    """Server-Sent Events variant of /api/widget/chat. Streams the assistant's
    reply token-by-token so the widget can render it live. Event payloads:
      {"type":"token","text":"..."}   - one visible text delta
      {"type":"done","reply":"..."}   - final full reply (also persisted)
      {"type":"paused"}               - a human agent has taken over
      {"type":"error","detail":"..."} - fatal error
    The non-streaming /api/widget/chat remains for SDKs and as a fallback.
    """
    bot_id = body.bot_id
    session_id = body.session_id
    text = body.text
    visitor_timezone = body.visitor_timezone
    visitor_name = (body.visitor_name or "").strip()[:120] or None
    visitor_email = (body.visitor_email or "").strip().lower()[:160] or None
    if visitor_email and not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", visitor_email):
        raise HTTPException(status_code=400, detail="visitor_email must be a valid email address")

    if not text or not text.strip():
        raise HTTPException(status_code=400, detail="text required")
    if len(text) > WIDGET_MAX_CHARS:
        raise HTTPException(status_code=400, detail=f"Message too long (max {WIDGET_MAX_CHARS} characters)")

    res = await run_db(lambda: supabase.table("chatty_bots").select("*").eq("id", bot_id).execute())
    if not res.data:
        raise HTTPException(status_code=404, detail="Bot not found")
    bot = res.data[0]

    ip = _client_ip(request)
    await _widget_rate_limit_or_429(bot, bot_id, ip, request.headers.get("x-widget-token"))

    owner_id = bot["user_id"]
    res_user = await run_db(lambda: supabase.table("users").select("*").eq("auth_user_id", owner_id).execute())
    if not res_user.data:
        raise HTTPException(status_code=404, detail="Bot owner not found")
    owner_user = res_user.data[0]

    session_row, is_new = await _upsert_session(bot_id, session_id, text, visitor_name=visitor_name, visitor_email=visitor_email)
    if is_new:
        await _notify_new_conversation(bot, owner_user, text, session_id)
        background_tasks.add_task(
            notify.enqueue_webhook_event, supabase, bot_id=bot_id, event="session.started",
            session_id=session_id, data={"first_message": text[:500]},
        )

    if body.offline_ticket:
        try:
            offline_update = {
                "needs_attention": True,
                "escalation_reason": "Offline support ticket submitted",
                "priority": "high",
                "ai_paused": True,
            }
            if visitor_name:
                offline_update["visitor_name"] = visitor_name
            if visitor_email:
                offline_update["visitor_email"] = visitor_email
            await run_db(lambda: supabase.table("chatty_sessions").update(offline_update).eq("bot_id", bot_id).eq("session_id", session_id).execute())
        except Exception:
            logger.exception("Failed to mark offline ticket session")

    esc = _detect_sentiment_escalation(text)
    if esc:
        try:
            upd = {"needs_attention": True, "escalation_reason": esc}
            if "Negative" in esc:
                upd["priority"] = "urgent"
            else:
                upd["priority"] = "high"
            await run_db(lambda: supabase.table("chatty_sessions").update(upd)
                .eq("bot_id", bot_id).eq("session_id", session_id).execute())
        except Exception:
            pass
        try:
            from app.routers.admin import _dispatch_ticket_to_agent
            background_tasks.add_task(_dispatch_ticket_to_agent, bot_id, session_id)
        except Exception:
            pass
        try:
            from app.services.slack_escalation import send_slack_escalation_alert
            priority_val = "urgent" if "Negative" in esc else "high"
            background_tasks.add_task(send_slack_escalation_alert, bot_id, session_id, esc, priority_val, text)
        except Exception:
            pass

    try:
        await run_db(lambda: supabase.table("chatty_conversations").insert({
            "bot_id": bot_id, "session_id": session_id, "role": "user",
            "content": text, "sender": "visitor",
        }).execute())
    except Exception:
        logger.exception("Failed to save user conversation message")
    background_tasks.add_task(
        notify.enqueue_webhook_event, supabase, bot_id=bot_id, event="message.user",
        session_id=session_id, data={"content": text, "visitor_name": visitor_name, "visitor_email": visitor_email, "offline_ticket": body.offline_ticket},
    )

    def _sse(obj: dict) -> str:
        return f"data: {json.dumps(obj)}\n\n"

    if body.offline_ticket:
        async def _offline_gen():
            yield _sse({"type": "paused"})
        return StreamingResponse(_offline_gen(), media_type="text/event-stream", background=background_tasks)

    # Human agent took over - nothing to stream.
    if session_row.get("ai_paused"):
        async def _paused_gen():
            yield _sse({"type": "paused"})
        return StreamingResponse(_paused_gen(), media_type="text/event-stream", background=background_tasks)

    # Quota gate - save the graceful reply and stream it as a single message.
    if await chatty_quota_exceeded(owner_user, owner_id):
        try:
            await run_db(lambda: supabase.table("chatty_sessions").update({
                "needs_attention": True,
                "escalation_reason": "Account quota exceeded",
                "priority": "high",
            }).eq("bot_id", bot_id).eq("session_id", session_id).execute())
        except Exception:
            pass
        try:
            await run_db(lambda: supabase.table("chatty_conversations").insert({
                "bot_id": bot_id, "session_id": session_id, "role": "assistant",
                "content": WIDGET_QUOTA_REPLY, "sender": "ai",
            }).execute())
        except Exception:
            logger.exception("Failed to save quota-exceeded reply")

        async def _quota_gen():
            yield _sse({"type": "token", "text": WIDGET_QUOTA_REPLY})
            yield _sse({"type": "done", "reply": WIDGET_QUOTA_REPLY})
        return StreamingResponse(_quota_gen(), media_type="text/event-stream", background=background_tasks)

    visitor_geo = await geoip_lookup(ip)
    queue: asyncio.Queue = asyncio.Queue()
    _DONE = object()

    async def _on_token(delta: str):
        await queue.put(_sse({"type": "token", "text": delta}))

    async def _runner():
        try:
            result = await run_widget_assistant(
                bot_id=bot_id, owner_user=owner_user, bot=bot,
                session_id=session_id, text=text, visitor_timezone=visitor_timezone,
                visitor_geo=visitor_geo, on_token=_on_token,
            )
            reply = result["reply"]
            try:
                await run_db(lambda: supabase.table("chatty_conversations").insert({
                    "bot_id": bot_id, "session_id": session_id, "role": "assistant",
                    "content": reply, "sender": "ai",
                }).execute())
            except Exception:
                logger.exception("Failed to save assistant conversation message")
            await notify.enqueue_webhook_event(
                supabase, bot_id=bot_id, event="message.assistant",
                session_id=session_id, data={"content": reply},
            )
            background_tasks.add_task(_log_unanswered_if_needed, bot_id, session_id, text, reply)
            await queue.put(_sse({"type": "done", "reply": reply, "sources": result.get("sources") or []}))
        except Exception:  # noqa: BLE001
            logger.exception("Widget stream assistant failed")
            await queue.put(_sse({"type": "error", "detail": "An internal error occurred while generating a response."}))
        finally:
            await queue.put(_DONE)

    async def _event_gen():
        task = asyncio.create_task(_runner())
        try:
            while True:
                item = await queue.get()
                if item is _DONE:
                    break
                yield item
        finally:
            if not task.done():
                task.cancel()

    return StreamingResponse(
        _event_gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        background=background_tasks,
    )


@router.post("/api/widget/transcribe")
async def widget_transcribe(
    request: Request,
    bot_id: str = Form(...),
    file: UploadFile = File(...),
):
    """Speech-to-text for the widget's voice-record button. Browser-side
    Web Speech API is unreliable inside cross-origin iframes (the widget
    always runs in one) even with mic permission granted, so transcription
    happens server-side via Gemini instead - works in every browser."""
    data = await read_upload_capped(
        file, _TRANSCRIBE_MAX_BYTES, detail="Recording too large (max 10MB)"
    )
    if not data:
        raise HTTPException(status_code=400, detail="Empty file")
    mime = (file.content_type or "audio/wav").split(";")[0]
    if not mime.startswith("audio/"):
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {mime}")
    if mime in ("audio/webm", "audio/x-matroska"):
        raise HTTPException(status_code=400, detail=f"Unsupported audio format: {mime}. Convert to wav, mp3, ogg, aac, aiff, or flac first.")

    res = await run_db(lambda: supabase.table("chatty_bots").select("allowed_domains").eq("id", bot_id).execute())
    if not res.data:
        raise HTTPException(status_code=404, detail="Bot not found")
    bot = res.data[0]

    ip = _client_ip(request)
    await _widget_rate_limit_or_429(bot, bot_id, ip, request.headers.get("x-widget-token"))

    try:
        resp = await ai_client.chat(
            model=ai_client.resolve_gemini_model("gemini-2.5-flash"),
            fallback_models=[ai_client.resolve_gemini_model(m) for m in GEMINI_FALLBACK_MODELS],
            messages=[{
                "role": "user",
                "content": [
                    {"type": "text", "text": _TRANSCRIBE_PROMPT},
                    {"type": "input_audio", "input_audio": {
                        "data": base64.b64encode(data).decode(),
                        "format": mime.split("/", 1)[1],
                    }},
                ],
            }],
            temperature=0,
            max_tokens=1024,
            bot_id=bot_id,
            call_type="widget_transcribe",
        )
        text = (resp.choices[0].message.content or "").strip()
        if not text:
            # Diagnose why - a mimetype/codec Gemini silently can't parse,
            # or a safety block, look identical from the client (empty
            # string) without this.
            try:
                finish_reason = resp.choices[0].finish_reason
                logger.warning(
                    "Widget transcription returned empty text (bot=%s, bytes=%d, mime=%s, finish_reason=%s)",
                    bot_id, len(data), mime, finish_reason,
                )
            except Exception:  # noqa: BLE001
                logger.warning("Widget transcription returned empty text (bot=%s, bytes=%d, mime=%s)", bot_id, len(data), mime)
    except Exception:
        logger.exception("Widget transcription failed")
        raise HTTPException(status_code=502, detail="transcription failed")

    return {"text": text}


@router.post("/api/widget/chat/media", response_model=WidgetMediaResponse)
async def widget_chat_media(
    request: Request,
    background_tasks: BackgroundTasks,
    bot_id: str = Form(...),
    session_id: str = Form(...),
    text: str = Form(""),
    visitor_timezone: str = Form("UTC"),
    host: str = Form(""),
    file: UploadFile = File(...),
):
    """Multimodal widget message: upload an image/audio/file, store it, and let
    the assistant (Gemini) actually see/hear it."""
    data = await read_upload_capped(
        file, _MEDIA_MAX_BYTES, detail="File too large (max 20MB)"
    )
    if not data:
        raise HTTPException(status_code=400, detail="Empty file")
    mime = (file.content_type or "application/octet-stream").split(";")[0]
    if not mime.startswith(_ALLOWED_MEDIA_PREFIXES):
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {mime}")
    # Gemini's audio understanding only accepts wav/mp3/aiff/aac/ogg/flac - NOT
    # webm/mkv, which is what browsers record by default. Reject these up front
    # instead of silently uploading audio the model can never actually hear,
    # which used to surface to visitors as their voice message going "empty".
    if mime in ("audio/webm", "audio/x-matroska"):
        raise HTTPException(status_code=400, detail=f"Unsupported audio format: {mime}. Convert to wav, mp3, ogg, aac, aiff, or flac first.")

    res = await run_db(lambda: supabase.table("chatty_bots").select("*").eq("id", bot_id).execute())
    if not res.data:
        raise HTTPException(status_code=404, detail="Bot not found")
    bot = res.data[0]

    ip = _client_ip(request)
    await _widget_rate_limit_or_429(bot, bot_id, ip, request.headers.get("x-widget-token"))

    res_user = await run_db(lambda: supabase.table("users").select("*").eq("auth_user_id", bot["user_id"]).execute())
    if not res_user.data:
        raise HTTPException(status_code=404, detail="Bot owner not found")
    owner_user = res_user.data[0]

    # Quota gate BEFORE the storage write - an owner who's already out of
    # quota shouldn't also pay for storage on an upload the model will never
    # even look at.
    if await chatty_quota_exceeded(owner_user, bot["user_id"]):
        try:
            await run_db(lambda: supabase.table("chatty_sessions").update({"needs_attention": True})
                .eq("bot_id", bot_id).eq("session_id", session_id).execute())
        except Exception:
            pass
        try:
            await run_db(lambda: supabase.table("chatty_conversations").insert({
                "bot_id": bot_id, "session_id": session_id, "role": "assistant",
                "content": WIDGET_QUOTA_REPLY,
            }).execute())
        except Exception:
            logger.exception("Failed to save quota-exceeded reply")
        return WidgetMediaResponse(reply=WIDGET_QUOTA_REPLY, session_id=session_id)

    # Upload to storage (service-role bypasses RLS); bucket is public for reads.
    import uuid as _uuid
    ext = (file.filename or "file").split(".")[-1][:8] if "." in (file.filename or "") else "bin"
    path = f"{bot_id}/{session_id}/{int(time.time())}-{_uuid.uuid4().hex[:8]}.{ext}"
    file_url = None
    try:
        await run_db(lambda: supabase.storage.from_("chatty-uploads").upload(
            path, data, {"content-type": mime, "upsert": "false"}
        ))
        file_url = await run_db(lambda: supabase.storage.from_("chatty-uploads").get_public_url(path))
    except Exception:
        logger.exception("Storage upload failed")

    # Record the visitor's message (with file reference) in history
    display = (text.strip() + ("\n" if text.strip() else "")) + f"[attachment: {file.filename or mime}]"
    try:
        await run_db(lambda: supabase.table("chatty_conversations").insert({
            "bot_id": bot_id, "session_id": session_id, "role": "user",
            "content": display + (f"\n{file_url}" if file_url else ""),
        }).execute())
    except Exception:
        logger.exception("Failed to save media message")
    background_tasks.add_task(
        notify.enqueue_webhook_event, supabase, bot_id=bot_id, event="message.user",
        session_id=session_id, data={"content": display},
    )

    try:
        result = await run_widget_assistant(
            bot_id=bot_id, owner_user=owner_user, bot=bot, session_id=session_id,
            text=text or "", visitor_timezone=visitor_timezone,
            media_bytes=data, media_mime=mime,
            visitor_geo=await geoip_lookup(ip),
        )
    except Exception:
        logger.exception("Widget media assistant run failed")
        raise HTTPException(status_code=502, detail="assistant failed")

    reply = result["reply"]
    try:
        await run_db(lambda: supabase.table("chatty_conversations").insert({
            "bot_id": bot_id, "session_id": session_id, "role": "assistant", "content": reply,
        }).execute())
    except Exception:
        logger.exception("Failed to save assistant reply")
    background_tasks.add_task(
        notify.enqueue_webhook_event, supabase, bot_id=bot_id, event="message.assistant",
        session_id=session_id, data={"content": reply},
    )

    background_tasks.add_task(_log_unanswered_if_needed, bot_id, session_id, text, reply)

    return WidgetMediaResponse(reply=reply, session_id=session_id, file_url=file_url, file_type=mime)


@router.post("/api/widget/feedback")
async def widget_feedback(body: WidgetFeedbackRequest, request: Request):
    """Visitor rates the most recent AI answer in their session (CSAT)."""
    rating = body.rating if body.rating in ("up", "down") else None
    if not rating:
        raise HTTPException(status_code=400, detail="rating must be 'up' or 'down'")
    try:
        latest = await run_db(lambda: supabase.table("chatty_conversations").select("id")
            .eq("bot_id", body.bot_id).eq("session_id", body.session_id)
            .eq("role", "assistant").order("created_at", desc=True).limit(1).execute())
        if latest.data:
            await run_db(lambda: supabase.table("chatty_conversations").update({"feedback_rating": rating})
                .eq("id", latest.data[0]["id"]).execute())
    except Exception:
        logger.exception("widget feedback failed")
    return {"ok": True}


@router.post("/api/widget/csat")
async def widget_csat(body: WidgetCsatRequest, request: Request):
    """Visitor submits the post-chat 1-5 star rating + optional comment.

    Kept separate from /api/widget/feedback (per-message thumbs up/down,
    stored on chatty_conversations.feedback_rating for the Inbox tab's
    "Refine answers" review) - reusing that field for this would collide
    two different features on the same column and the same value range.
    """
    if not 1 <= body.rating <= 5:
        raise HTTPException(status_code=400, detail="rating must be between 1 and 5")
    try:
        await run_db(lambda: supabase.table("chatty_csat_feedback").insert({
            "bot_id": body.bot_id,
            "session_id": body.session_id,
            "rating": body.rating,
            "comment": (body.comment or "").strip() or None,
        }).execute())
    except Exception:
        logger.exception("widget csat failed")
        raise HTTPException(status_code=502, detail="failed to save feedback")
    return {"ok": True}


@router.get("/api/widget/poll")
async def widget_poll(bot_id: str, session_id: str, after: str = ""):
    """Visitor's widget polls for human-agent replies + AI-pause state.
    Retained as a fallback for clients that can't use the SSE /live stream."""
    try:
        q = supabase.table("chatty_conversations").select("content,created_at,sender") \
            .eq("bot_id", bot_id).eq("session_id", session_id).eq("sender", "human") \
            .order("created_at", desc=False)
        if after:
            q = q.gt("created_at", after)
        res = await run_db(q.execute)
        msgs = res.data or []
        sess = await run_db(lambda: supabase.table("chatty_sessions").select("ai_paused").eq(
            "bot_id", bot_id).eq("session_id", session_id).execute())
        ai_paused = bool(sess.data[0]["ai_paused"]) if sess.data else False
        return {"messages": msgs, "ai_paused": ai_paused}
    except Exception:
        logger.exception("widget poll failed")
        return {"messages": [], "ai_paused": False}


@router.get("/api/widget/live")
async def widget_live(bot_id: str, session_id: str, after: str = ""):
    """SSE stream of human-agent replies + AI-pause changes for a session -
    one persistent connection instead of repeated client polling. Emits only
    new events, then closes after ~4 min so the client reconnects (keeps
    Cloud Run request durations bounded)."""
    def _sse(obj: dict) -> str:
        return f"data: {json.dumps(obj)}\n\n"

    async def _gen():
        cursor = after
        last_paused: Optional[bool] = None
        deadline = time.time() + 240
        yield ": connected\n\n"
        while time.time() < deadline:
            try:
                q = supabase.table("chatty_conversations").select("content,created_at,sender") \
                    .eq("bot_id", bot_id).eq("session_id", session_id).eq("sender", "human") \
                    .order("created_at", desc=False)
                if cursor:
                    q = q.gt("created_at", cursor)
                res = await run_db(q.execute)
                for m in (res.data or []):
                    cursor = m["created_at"]
                    yield _sse({"type": "message", "content": m["content"], "created_at": m["created_at"]})
                sess = await run_db(lambda: supabase.table("chatty_sessions").select("ai_paused").eq(
                    "bot_id", bot_id).eq("session_id", session_id).execute())
                paused = bool(sess.data[0]["ai_paused"]) if sess.data else False
                if paused != last_paused:
                    last_paused = paused
                    yield _sse({"type": "ai_paused", "value": paused})
            except Exception:
                logger.exception("widget live check failed")
            await asyncio.sleep(2)
        yield _sse({"type": "reconnect"})

    return StreamingResponse(
        _gen(), media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/api/widget/theme")
async def widget_theme(bot_id: str):
    """Public, unauthenticated bot config for the embed widget + launcher.
    Served from the backend (service role) so it works inside third-party
    iframes where the browser Supabase client is blocked by storage
    partitioning."""
    base_columns = (
        "user_id, name, primary_color, widget_style, logo_url, welcome_message, "
        "send_button_style, conversation_starters, teaser_message, avatar_icon, avatar_url, "
        "hide_branding, custom_css, custom_js, voice_enabled, show_sender_tag, csat_enabled, "
        "color_scheme, calendar_scheduling_enabled, meeting_provider"
    )
    try:
        res = await run_db(lambda: supabase.table("chatty_bots").select(
            f"{base_columns}, font_family, font_size_percent, voice_message_mode, panel_size").eq("id", bot_id).execute())
    except Exception:
        try:
            # panel_size's migration (20260902070328) may not be applied to
            # this environment yet - retry without it before falling further back.
            res = await run_db(lambda: supabase.table("chatty_bots").select(
                f"{base_columns}, font_family, font_size_percent, voice_message_mode").eq("id", bot_id).execute())
        except Exception:
            try:
                # voice_message_mode's migration (20260829020000) may not be
                # applied yet - retry without it before falling further back.
                res = await run_db(lambda: supabase.table("chatty_bots").select(
                    f"{base_columns}, font_family, font_size_percent").eq("id", bot_id).execute())
            except Exception:
                # font_family/font_size_percent's migration (20260829010000) may
                # not be applied to this environment yet either - PostgREST 400s
                # the whole select on an unknown column, which would otherwise
                # break every bot's widget theme, not just skip the new fields.
                # Falls back to the columns that are guaranteed to exist.
                res = await run_db(lambda: supabase.table("chatty_bots").select(
                    base_columns).eq("id", bot_id).execute())
    if not res.data:
        raise HTTPException(status_code=404, detail="Bot not found")
    b = res.data[0]
    # White-label is a paid-plan feature - enforce server-side so the flag
    # can't be flipped client-side on a free plan.
    hide_branding = bool(b.get("hide_branding"))
    if hide_branding:
        try:
            owner = await run_db(lambda: supabase.table("users").select("email, plan").eq(
                "auth_user_id", b.get("user_id")).limit(1).execute())
            plan = plan_for(owner.data[0]) if (owner.data and len(owner.data) > 0) else "free"
            if plan not in WHITELABEL_PLANS:
                hide_branding = False
        except Exception:
            hide_branding = False
    return {
        "name": b.get("name") or "Chatty Assistant",
        "primary_color": b.get("primary_color") or "#f97316",
        "widget_style": b.get("widget_style") or "minimalist",
        "logo_url": b.get("logo_url"),
        "welcome_message": b.get("welcome_message") or "Hello! How can I help you today?",
        "send_button_style": b.get("send_button_style") or "plane",
        "conversation_starters": b.get("conversation_starters") or [],
        "teaser_message": b.get("teaser_message") or "👋 Need help? Chat with us.",
        "avatar_icon": b.get("avatar_icon") or "logo",
        "avatar_url": b.get("avatar_url"),
        "hide_branding": hide_branding,
        "custom_css": b.get("custom_css") or "",
        "custom_js": b.get("custom_js") or "",
        "voice_enabled": bool(b.get("voice_enabled")),
        "show_sender_tag": bool(b.get("show_sender_tag")),
        "csat_enabled": bool(b.get("csat_enabled", True)),
        "color_scheme": b.get("color_scheme"),
        "font_family": b.get("font_family"),
        "font_size_percent": b.get("font_size_percent") or 100,
        "voice_message_mode": b.get("voice_message_mode") or "transcribe",
        "panel_size": b.get("panel_size") or "default",
        "calendar_scheduling_enabled": bool(b.get("calendar_scheduling_enabled")),
        "meeting_provider": b.get("meeting_provider") or "google_meet",
    }


@router.get("/api/widget/kb-sources")
async def widget_kb_sources(bot_id: str):
    """Public, unauthenticated knowledge-base articles for the /kb/[botId]
    help-center portal. Same pattern as widget_theme above - served via the
    backend (service role) rather than a direct anon Supabase read, so this
    always requires an explicit bot_id and never risks an unfiltered query
    returning every bot's sources (which a bare RLS policy on chatty_sources
    can't distinguish from a filtered one)."""
    res = await run_db(lambda: supabase.table("chatty_sources").select(
        "id, name, content, type").eq("bot_id", bot_id).execute())
    return {"sources": res.data or []}


# ---------------------------------------------------------------------------
# PUBLIC KNOWLEDGE BASE & HELP CENTER PORTAL
# ---------------------------------------------------------------------------

@router.get("/api/widget/kb/portal")
async def widget_kb_portal(bot_id: str):
    """Public Help Center portal data: bot branding, categories, promoted and recent articles."""
    # 1. Fetch bot details
    res_bot = await run_db(lambda: supabase.table("chatty_bots").select(
        "id, name, logo_url, avatar_icon, primary_color, color_scheme"
    ).eq("id", bot_id).execute())
    if not res_bot.data:
        raise HTTPException(status_code=404, detail="Bot not found")
    bot_info = res_bot.data[0]

    # 2. Fetch categories
    res_cat = await run_db(lambda: supabase.table("chatty_kb_categories")
        .select("id, name, slug, description, icon, order_index")
        .eq("bot_id", bot_id)
        .order("order_index")
        .order("created_at")
        .execute())
    categories = res_cat.data or []

    # 3. Fetch published public articles
    res_art = await run_db(lambda: supabase.table("chatty_kb_articles")
        .select("id, category_id, title, slug, subtitle, content, tags, is_promoted, order_index, view_count, helpful_count, not_helpful_count, created_at, updated_at")
        .eq("bot_id", bot_id)
        .eq("status", "published")
        .eq("visibility", "public")
        .order("order_index")
        .order("created_at", desc=True)
        .execute())
    articles = res_art.data or []

    # Map category article counts
    cat_counts: dict[str, int] = {}
    for a in articles:
        cid = a.get("category_id")
        if cid:
            cat_counts[cid] = cat_counts.get(cid, 0) + 1
    for c in categories:
        c["article_count"] = cat_counts.get(c["id"], 0)

    # Promoted & recent articles
    promoted_articles = [a for a in articles if a.get("is_promoted")]
    recent_articles = articles[:6]

    return {
        "bot": bot_info,
        "categories": categories,
        "promoted_articles": promoted_articles,
        "recent_articles": recent_articles,
        "articles": articles,
        "total_articles": len(articles),
    }


@router.get("/api/widget/kb/categories/{slug}")
async def widget_kb_category_detail(slug: str, bot_id: str):
    """Fetch public category details and its published articles."""
    res_cat = await run_db(lambda: supabase.table("chatty_kb_categories")
        .select("*")
        .eq("bot_id", bot_id)
        .eq("slug", slug)
        .execute())
    if not res_cat.data:
        raise HTTPException(status_code=404, detail="Category not found")
    category = res_cat.data[0]

    res_art = await run_db(lambda: supabase.table("chatty_kb_articles")
        .select("id, category_id, title, slug, subtitle, tags, is_promoted, order_index, view_count, helpful_count, not_helpful_count, created_at, updated_at")
        .eq("bot_id", bot_id)
        .eq("category_id", category["id"])
        .eq("status", "published")
        .eq("visibility", "public")
        .order("order_index")
        .order("created_at", desc=True)
        .execute())

    return {
        "category": category,
        "articles": res_art.data or [],
    }


@router.get("/api/widget/kb/articles/{slug}")
async def widget_kb_article_detail(slug: str, bot_id: str):
    """Fetch published public article detail, increment view count, and get related articles."""
    res_art = await run_db(lambda: supabase.table("chatty_kb_articles")
        .select("*, category:chatty_kb_categories(id, name, slug, icon)")
        .eq("bot_id", bot_id)
        .eq("slug", slug)
        .eq("status", "published")
        .eq("visibility", "public")
        .execute())
    if not res_art.data:
        raise HTTPException(status_code=404, detail="Article not found")
    article = res_art.data[0]

    # Increment view count
    current_views = article.get("view_count") or 0
    try:
        await run_db(lambda: supabase.table("chatty_kb_articles")
            .update({"view_count": current_views + 1})
            .eq("id", article["id"])
            .execute())
        article["view_count"] = current_views + 1
    except Exception:
        logger.exception("Failed to increment article view count")

    # Related articles in same category
    related = []
    if article.get("category_id"):
        res_rel = await run_db(lambda: supabase.table("chatty_kb_articles")
            .select("id, title, slug, subtitle, view_count")
            .eq("bot_id", bot_id)
            .eq("category_id", article["category_id"])
            .eq("status", "published")
            .eq("visibility", "public")
            .neq("id", article["id"])
            .limit(4)
            .execute())
        related = res_rel.data or []

    return {
        "article": article,
        "related": related,
    }


@router.post("/api/widget/kb/articles/{article_id}/feedback")
async def widget_kb_article_feedback(article_id: str, req: ArticleFeedbackRequest, request: Request):
    """Submit helpful/not helpful CSAT feedback on a knowledge base article."""
    res_art = await run_db(lambda: supabase.table("chatty_kb_articles")
        .select("id, helpful_count, not_helpful_count")
        .eq("id", article_id)
        .eq("bot_id", req.bot_id)
        .execute())
    if not res_art.data:
        raise HTTPException(status_code=404, detail="Article not found")
    article = res_art.data[0]

    ip = _client_ip(request)
    await run_db(lambda: supabase.table("chatty_kb_feedback").insert({
        "bot_id": req.bot_id,
        "article_id": article_id,
        "is_helpful": req.is_helpful,
        "comment": (req.comment or "").strip()[:1000],
        "user_ip": ip,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }).execute())

    field = "helpful_count" if req.is_helpful else "not_helpful_count"
    new_count = (article.get(field) or 0) + 1
    await run_db(lambda: supabase.table("chatty_kb_articles").update({field: new_count}).eq("id", article_id).execute())

    return {"success": True}


@router.get("/api/widget/kb/search")
async def widget_kb_search(bot_id: str, q: str = ""):
    """Instant search across published public articles, logging search queries for content gap analytics."""
    query = q.strip().lower()
    if not query:
        return {"articles": []}

    res = await run_db(lambda: supabase.table("chatty_kb_articles")
        .select("id, category_id, title, slug, subtitle, content, tags, category:chatty_kb_categories(name, slug)")
        .eq("bot_id", bot_id)
        .eq("status", "published")
        .eq("visibility", "public")
        .execute())
    articles = res.data or []

    matched = []
    for a in articles:
        title = (a.get("title") or "").lower()
        subtitle = (a.get("subtitle") or "").lower()
        content = (a.get("content") or "").lower()
        tags = [t.lower() for t in (a.get("tags") or [])]

        score = 0
        if query in title:
            score += 10
        if any(query in t for t in tags):
            score += 5
        if query in subtitle:
            score += 3
        if query in content:
            score += 1

        if score > 0:
            # Generate snippet
            snippet = ""
            if query in content:
                idx = content.find(query)
                start = max(0, idx - 40)
                end = min(len(content), idx + len(query) + 80)
                snippet = "…" + content[start:end].strip() + "…"
            elif a.get("subtitle"):
                snippet = a.get("subtitle")
            else:
                snippet = (a.get("content") or "")[:120]

            matched.append({
                "id": a["id"],
                "title": a["title"],
                "slug": a["slug"],
                "subtitle": a.get("subtitle") or "",
                "snippet": snippet,
                "category": a.get("category"),
                "score": score,
            })

    matched.sort(key=lambda x: x["score"], reverse=True)

    # Log search query for content gap analytics
    try:
        await run_db(lambda: supabase.table("chatty_kb_searches").insert({
            "bot_id": bot_id,
            "query": query[:200],
            "results_count": len(matched),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }).execute())
    except Exception:
        logger.exception("Failed to log KB search query")

    return {"articles": matched[:20]}


# ---------------------------------------------------------------------------
# INTERACTIVE CALENDAR BOOKING ENDPOINTS (SELF-HOSTED)
# ---------------------------------------------------------------------------


def _sanitize_booking_field(text: Optional[str], max_len: int = 100) -> str:
    if not text:
        return ""
    # Strip script and style blocks completely including inner text
    clean = re.sub(r"<(script|style)[^>]*>.*?</\1>", "", str(text), flags=re.IGNORECASE | re.DOTALL)
    # Strip any remaining HTML tags
    clean = re.sub(r"<[^>]*>", "", clean).strip()
    # Strip control characters
    clean = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", clean)
    return clean[:max_len].strip()


@router.get("/api/widget/booking/slots")
async def widget_booking_slots(
    bot_id: str,
    visitor_timezone: Optional[str] = None,
    visitor_country: Optional[str] = None,
    days: int = 14,
    session_id: Optional[str] = None,
    request: Request = None,
):
    """Fetches real guaranteed available booking slots for the widget's inline
    calendar view, grouped by date in the visitor's local timezone.
    Self-hosted, deterministic, zero third-party subscription cost."""
    res = await run_db(lambda: supabase.table("chatty_bots").select("*").eq("id", bot_id).execute())
    if not res.data:
        raise HTTPException(status_code=404, detail="Bot not found")
    bot = res.data[0]

    # Domain origin check and baseline rate limiting (when called via HTTP)
    if request:
        ip = _client_ip(request)
        await _widget_rate_limit_or_429(bot, bot_id, ip, request.headers.get("x-widget-token"))
        if await _rate_limited_async(f"booking_slots:{bot_id}:{ip}", limit=40, window=60):
            raise HTTPException(status_code=429, detail="Too many slot inquiries. Please slow down.")

    if not bot.get("calendar_scheduling_enabled"):
        return {
            "enabled": False,
            "message": "Scheduling is not enabled for this assistant.",
        }

    owner_res = await run_db(lambda: supabase.table("users").select("*").eq("auth_user_id", bot.get("user_id")).execute())
    if not owner_res.data:
        raise HTTPException(status_code=404, detail="Bot owner not found")
    owner_user = owner_res.data[0]

    from plugins import availability_engine as avail

    owner_tz_str = avail.resolve_owner_timezone(bot, owner_user)
    visitor_tz_str = visitor_timezone or "America/New_York"
    if visitor_tz_str == "UTC":
        visitor_tz_str = "America/New_York"
    try:
        pytz.timezone(visitor_tz_str)
    except Exception:
        visitor_tz_str = "America/New_York"

    now_utc = datetime.now(timezone.utc)
    members = await avail.get_bookable_members(supabase, bot_id, bot, owner_user)
    if not members:
        return {
            "enabled": False,
            "message": "No calendar connected for booking.",
        }

    slots = await avail.get_team_available_slots(
        supabase,
        bot_id=bot_id,
        bot=bot,
        members=members,
        owner_tz_str=owner_tz_str,
        now_utc=now_utc,
        visitor_tz_str=visitor_tz_str,
        near_utc=None,
        max_results=None,
        search_days=max(min(days, 30), 7),
    )

    slots_by_date: dict[str, list[dict[str, Any]]] = {}
    v_tz = pytz.timezone(visitor_tz_str)

    for s in slots:
        start_iso = s.get("start")
        if not start_iso:
            continue
        try:
            dt_utc = datetime.fromisoformat(start_iso.replace("Z", "+00:00"))
            dt_visitor = dt_utc.astimezone(v_tz)
            date_key = dt_visitor.strftime("%Y-%m-%d")
            time_label = dt_visitor.strftime("%I:%M %p").lstrip("0")

            slots_by_date.setdefault(date_key, []).append({
                "start": s["start"],
                "end": s["end"],
                "time_label": time_label,
                "visitor_local_label": s.get("visitor_local_label") or f"{date_key} at {time_label}",
                "owner_local_label": s.get("owner_local_label"),
                "host_timezone": s.get("host_timezone"),
                "eligible_hosts": s.get("eligible_hosts") or [],
            })
        except Exception:
            continue

    lead_fields = bot.get("lead_fields") or ["name", "email", "phone"]
    lead_required_fields = bot.get("lead_required_fields") or ["name", "email"]

    # Pre-populate visitor contact details if already known or captured in this session
    prefilled_lead: dict[str, Optional[str]] = {
        "name": None,
        "email": None,
        "phone": None,
        "company": None,
    }
    if session_id:
        try:
            # 1. Lookup in chatty_leads (saved via create_lead tool or earlier captures)
            lead_res = await run_db(
                lambda: supabase.table("chatty_leads")
                .select("name, email, phone, company, custom_fields")
                .eq("bot_id", bot_id)
                .eq("session_id", session_id)
                .order("created_at", desc=True)
                .limit(1)
                .execute()
            )
            if lead_res.data:
                row = lead_res.data[0]
                if row.get("name"):
                    prefilled_lead["name"] = str(row["name"]).strip()
                if row.get("email"):
                    prefilled_lead["email"] = str(row["email"]).strip().lower()
                if row.get("phone"):
                    prefilled_lead["phone"] = str(row["phone"]).strip()
                c_val = row.get("company") or (row.get("custom_fields") or {}).get("company")
                if c_val:
                    prefilled_lead["company"] = str(c_val).strip()

            # 2. Lookup in chatty_sessions for visitor_name / visitor_email fallback
            if not prefilled_lead["name"] or not prefilled_lead["email"]:
                sess_res = await run_db(
                    lambda: supabase.table("chatty_sessions")
                    .select("visitor_name, visitor_email")
                    .eq("bot_id", bot_id)
                    .eq("session_id", session_id)
                    .limit(1)
                    .execute()
                )
                if sess_res.data:
                    s_row = sess_res.data[0]
                    if not prefilled_lead["name"] and s_row.get("visitor_name"):
                        prefilled_lead["name"] = str(s_row["visitor_name"]).strip()
                    if not prefilled_lead["email"] and s_row.get("visitor_email"):
                        prefilled_lead["email"] = str(s_row["visitor_email"]).strip().lower()

            # 3. Fallback scan on recent visitor conversation turns if any fields remain missing
            if not (prefilled_lead["name"] and prefilled_lead["email"] and prefilled_lead["phone"]):
                conv_res = await run_db(
                    lambda: supabase.table("chatty_conversations")
                    .select("content, sender")
                    .eq("bot_id", bot_id)
                    .eq("session_id", session_id)
                    .eq("sender", "visitor")
                    .order("created_at", desc=True)
                    .limit(10)
                    .execute()
                )
                if conv_res.data:
                    for row in conv_res.data:
                        text_item = str(row.get("content") or "")
                        if not prefilled_lead["email"]:
                            email_match = re.search(r"\b([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})\b", text_item)
                            if email_match:
                                prefilled_lead["email"] = email_match.group(1).strip().lower()
                        if not prefilled_lead["phone"]:
                            phone_match = re.search(r"(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}", text_item)
                            if phone_match and len(re.sub(r"\D", "", phone_match.group(0))) >= 7:
                                prefilled_lead["phone"] = phone_match.group(0).strip()
                        if not prefilled_lead["name"]:
                            name_match = re.search(r"(?:my name is|i am|i'm|this is)\s+([A-Za-z]+(?:\s+[A-Za-z]+){1,2})", text_item, re.IGNORECASE)
                            if name_match:
                                cand = name_match.group(1).strip()
                                if cand.lower() not in ("interested", "looking", "trying", "here", "ready", "fine", "good"):
                                    prefilled_lead["name"] = cand
        except Exception:
            logger.exception("Failed to look up prefilled lead details for booking slots")

    return {
        "enabled": True,
        "bot_id": bot_id,
        "duration_minutes": int(bot.get("scheduling_duration_minutes") or 30),
        "visitor_timezone": visitor_tz_str,
        "visitor_country": (visitor_country or "").strip().upper()[:2] or None,
        "owner_timezone": owner_tz_str,
        "provider": bot.get("meeting_provider") or "google_meet",
        "available_dates": sorted(slots_by_date.keys()),
        "slots_by_date": slots_by_date,
        "lead_fields": lead_fields,
        "lead_required_fields": lead_required_fields,
        "booking_require_business_email": bool(bot.get("booking_require_business_email")),
        "booking_block_disposable_emails": bool(bot.get("booking_block_disposable_emails")),
        "booking_email_verification": bool(bot.get("booking_email_verification")),
        "prefilled_lead": prefilled_lead,
    }


@router.post("/api/widget/booking/confirm")
async def widget_booking_confirm(
    body: WidgetBookingConfirmRequest,
    request: Request = None,
):
    """Direct booking confirmation from the widget's interactive calendar UI.
    Validates attendee inputs, invokes server-side scheduling tools, creates/updates
    lead in chatty_leads, and stores the confirmed meeting in chatty_meetings."""
    res = await run_db(lambda: supabase.table("chatty_bots").select("*").eq("id", body.bot_id).execute())
    if not res.data:
        raise HTTPException(status_code=404, detail="Bot not found")
    bot = res.data[0]

    if not bot.get("calendar_scheduling_enabled"):
        raise HTTPException(status_code=400, detail="Scheduling is disabled for this assistant.")

    # 1. Origin verification and rate limiting (per bot + IP, when called via HTTP)
    if request:
        ip = _client_ip(request)
        await _widget_rate_limit_or_429(bot, body.bot_id, ip, request.headers.get("x-widget-token"))

        # Dedicated booking attempts rate limit per IP: max 5 bookings per 5 minutes
        if await _rate_limited_async(f"booking_confirm:{body.bot_id}:{ip}", limit=5, window=300):
            raise HTTPException(status_code=429, detail="Too many booking attempts. Please wait a few minutes before trying again.")

    owner_res = await run_db(lambda: supabase.table("users").select("*").eq("auth_user_id", bot.get("user_id")).execute())
    if not owner_res.data:
        raise HTTPException(status_code=404, detail="Bot owner not found")
    owner_user = owner_res.data[0]

    # 2. Input Sanitization & Validation
    visitor_name = _sanitize_booking_field(body.name, max_len=80)
    invalid_names = {"guest", "visitor", "user", "attendee", "none", "null", "ues", "uesues", "yes", "test", "asdf", "admin", "bot"}
    if len(visitor_name) < 2 or visitor_name.lower() in invalid_names or "@" in visitor_name:
        raise HTTPException(status_code=400, detail="Please enter your full name.")

    visitor_email = (body.email or "").strip().lower()
    if len(visitor_email) > 100 or not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", visitor_email):
        raise HTTPException(status_code=400, detail="Please enter a valid email address.")

    # Dedicated booking attempts rate limit per email: max 3 bookings per 10 minutes
    if await _rate_limited_async(f"booking_confirm_email:{body.bot_id}:{visitor_email}", limit=3, window=600):
        raise HTTPException(status_code=429, detail="Too many booking attempts for this email address. Please wait a few minutes.")

    # 3. Abuse Protection Defenses: Disposable / Business Email Checks
    from plugins.agent_tools import CONSUMER_EMAIL_DOMAINS, DISPOSABLE_EMAIL_DOMAINS
    domain = visitor_email.split("@")[-1].lower() if "@" in visitor_email else ""

    if bot.get("booking_block_disposable_emails") and domain in DISPOSABLE_EMAIL_DOMAINS:
        raise HTTPException(status_code=400, detail=f"Disposable email addresses (@{domain}) are not accepted. Please use a permanent email address.")

    if bot.get("booking_require_business_email") and domain in CONSUMER_EMAIL_DOMAINS:
        raise HTTPException(status_code=400, detail=f"Personal email addresses (@{domain}) are not accepted. Please use a corporate or business email.")

    # 4. Optional / Lead Fields Sanitization & Required Checks
    visitor_phone = _sanitize_booking_field(body.phone, max_len=35) if body.phone else None
    visitor_company = _sanitize_booking_field(body.company, max_len=100) if body.company else None
    visitor_notes = _sanitize_booking_field(body.notes, max_len=500) if body.notes else None

    lead_required = bot.get("lead_required_fields") or ["name", "email"]
    if "phone" in lead_required and not visitor_phone:
        raise HTTPException(status_code=400, detail="Phone number is required.")
    if "company" in lead_required and not visitor_company:
        raise HTTPException(status_code=400, detail="Company name is required.")

    # 5. Booking Limit: 1 Active Booking Per Email
    if bot.get("booking_limit_one_active"):
        try:
            active_res = await run_db(
                lambda: supabase.table("chatty_meetings")
                .select("id, start_time, status")
                .eq("bot_id", body.bot_id)
                .eq("attendee_email", visitor_email)
                .gte("start_time", datetime.now(timezone.utc).isoformat())
                .neq("status", "cancelled")
                .limit(1)
                .execute()
            )
            if active_res.data:
                raise HTTPException(
                    status_code=400,
                    detail="You already have an upcoming scheduled meeting. Please reschedule or cancel your existing meeting first.",
                )
        except HTTPException:
            raise
        except Exception:
            logger.exception("Failed checking active booking limit for %s", visitor_email)

    # 6. Slot Timing & Integrity Validation
    try:
        dt_start = datetime.fromisoformat(body.start_time.replace("Z", "+00:00"))
        dt_end = datetime.fromisoformat(body.end_time.replace("Z", "+00:00"))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid start or end time format. Expected ISO-8601 timestamps.")

    if dt_end <= dt_start:
        raise HTTPException(status_code=400, detail="Invalid meeting slot: end time must be after start time.")

    now_utc = datetime.now(timezone.utc)
    if dt_start.tzinfo is None:
        dt_start = dt_start.replace(tzinfo=timezone.utc)
    if dt_end.tzinfo is None:
        dt_end = dt_end.replace(tzinfo=timezone.utc)

    if dt_start < (now_utc - timedelta(minutes=5)):
        raise HTTPException(status_code=400, detail="Cannot schedule meetings in the past. Please select an upcoming slot.")

    if dt_start > (now_utc + timedelta(days=90)):
        raise HTTPException(status_code=400, detail="Cannot schedule meetings more than 90 days in advance.")

    duration_mins = (dt_end - dt_start).total_seconds() / 60
    if duration_mins < 10 or duration_mins > 240:
        raise HTTPException(status_code=400, detail="Invalid meeting duration.")

    provider = bot.get("meeting_provider") or "google_meet"
    use_ms = provider == "teams"
    tool_name = "create_outlook_event" if use_ms else "create_calendar_event"

    summary = f"Demo Meeting with {visitor_name}"
    desc_lines = [
        f"Attendee: {visitor_name} ({visitor_email})",
        f"Timezone: {body.visitor_timezone or 'UTC'}",
    ]
    if body.visitor_country:
        desc_lines.append(f"Country: {body.visitor_country.strip().upper()[:2]}")
    if visitor_phone:
        desc_lines.append(f"Phone: {visitor_phone}")
    if visitor_company:
        desc_lines.append(f"Company: {visitor_company}")
    if visitor_notes:
        desc_lines.append(f"Notes: {visitor_notes}")
    description = "\n".join(desc_lines)

    tool_args: dict[str, Any] = {
        "summary": summary,
        "subject": summary,
        "start": body.start_time,
        "end": body.end_time,
        "attendees": [visitor_email],
        "description": description,
        "body": description,
        "online_meeting": True,
    }
    if body.verification_code:
        tool_args["verification_code"] = body.verification_code.strip()

    context = {
        "bot_id": body.bot_id,
        "bot": bot,
        "session_id": body.session_id,
        "visitor_timezone": body.visitor_timezone,
        "visitor_country": body.visitor_country,
        "source": "widget",
    }

    from plugins import agent_tools
    exec_res = await agent_tools.execute(
        tool_name,
        tool_args,
        user=owner_user,
        supabase=supabase,
        context=context,
    )

    if "error" in exec_res:
        return {
            "success": False,
            "error": exec_res["error"],
            "otp_sent": bool(exec_res.get("otp_sent")),
        }

    # Update phone / company / notes in chatty_leads if provided
    try:
        lead_update: dict[str, Any] = {}
        if visitor_phone:
            lead_update["phone"] = visitor_phone
        custom_fields: dict[str, Any] = {}
        if visitor_company:
            custom_fields["company"] = visitor_company
        if visitor_notes:
            custom_fields["notes"] = visitor_notes
        if custom_fields:
            lead_update["custom_fields"] = custom_fields

        if lead_update:
            await run_db(lambda: supabase.table("chatty_leads").update(lead_update).eq("bot_id", body.bot_id).eq("email", visitor_email).execute())
    except Exception:
        logger.exception("Failed to update extra lead details after booking")

    formatted_time = agent_tools._format_invitation_time(body.start_time, body.visitor_timezone)
    meeting_link = (
        exec_res.get("hangout_link")
        or exec_res.get("online_meeting_url")
        or exec_res.get("meeting_link")
        or exec_res.get("html_link")
        or "https://meet.google.com/"
    )

    # Append confirmation to chatty_conversations so the chat history records the scheduled event
    confirmation_msg = (
        f"Your demo is scheduled for {formatted_time}.\n\n"
        f"Meeting Link: {meeting_link}\n\n"
        f"A calendar invitation has been sent to {visitor_email}. See you there!"
    )
    if body.session_id:
        try:
            await run_db(lambda: supabase.table("chatty_conversations").insert({
                "bot_id": body.bot_id,
                "session_id": body.session_id,
                "role": "assistant",
                "content": confirmation_msg,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }).execute())
        except Exception:
            logger.exception("Failed to record booking confirmation in chatty_conversations")

    assigned_email = exec_res.get("assigned_to_email") or (owner_user.get("email") or "").strip().lower()

    return {
        "success": True,
        "meeting_id": exec_res.get("id"),
        "meeting_link": meeting_link,
        "formatted_time": formatted_time,
        "summary": summary,
        "start_time": body.start_time,
        "end_time": body.end_time,
        "attendee_name": visitor_name,
        "attendee_email": visitor_email,
        "assigned_to_email": assigned_email,
    }


@router.post("/api/widget/booking/reschedule")
async def widget_booking_reschedule(
    body: WidgetBookingRescheduleRequest,
    request: Request = None,
):
    """Direct meeting reschedule from the widget's interactive calendar UI.
    Validates attendee ownership/session, verifies slot schedule and availability,
    updates Google/Outlook calendar events, updates chatty_meetings, and sends
    updated notifications."""
    res = await run_db(lambda: supabase.table("chatty_bots").select("*").eq("id", body.bot_id).execute())
    if not res.data:
        raise HTTPException(status_code=404, detail="Bot not found")
    bot = res.data[0]

    if not bot.get("calendar_scheduling_enabled"):
        raise HTTPException(status_code=400, detail="Scheduling is disabled for this assistant.")

    # 1. Origin verification and rate limiting (per bot + IP, when called via HTTP)
    visitor_email = (body.attendee_email or "").strip().lower()
    if request:
        ip = _client_ip(request)
        await _widget_rate_limit_or_429(bot, body.bot_id, ip, request.headers.get("x-widget-token"))

        # Dedicated rate limit per IP: max 5 reschedules per 5 minutes
        if await _rate_limited_async(f"booking_resched:{body.bot_id}:{ip}", limit=5, window=300):
            raise HTTPException(status_code=429, detail="Too many reschedule attempts. Please wait a few minutes before trying again.")

    # Dedicated rate limit per email: max 5 reschedules per 5 minutes
    if visitor_email and await _rate_limited_async(f"booking_resched_email:{body.bot_id}:{visitor_email}", limit=5, window=300):
        raise HTTPException(status_code=429, detail="Too many reschedule attempts for this email address. Please wait a few minutes.")

    # 2. Meeting lookup and status verification
    meeting_res = await run_db(
        lambda: supabase.table("chatty_meetings")
        .select("*")
        .eq("id", body.meeting_id)
        .eq("bot_id", body.bot_id)
        .execute()
    )
    if not meeting_res.data:
        raise HTTPException(status_code=404, detail="Meeting not found.")
    meeting = meeting_res.data[0]

    if meeting.get("status") == "cancelled":
        raise HTTPException(status_code=400, detail="This meeting has already been cancelled. Please book a new meeting instead.")

    if meeting.get("attendee_email", "").strip().lower() != visitor_email:
        raise HTTPException(status_code=403, detail="The email address provided does not match this booking.")

    # 3. Session / Ownership verification to prevent IDOR
    if body.session_id:
        try:
            leads_res = await run_db(
                lambda: supabase.table("chatty_leads")
                .select("id, email")
                .eq("bot_id", body.bot_id)
                .eq("session_id", body.session_id)
                .execute()
            )
            session_leads = leads_res.data or []
            session_lead_ids = {row["id"] for row in session_leads if row.get("id")}
            session_emails = {row["email"].strip().lower() for row in session_leads if row.get("email")}

            is_authorized = bool(
                (meeting.get("lead_id") and meeting.get("lead_id") in session_lead_ids)
                or (visitor_email in session_emails)
            )
            if not is_authorized and not (body.session_id == meeting.get("session_id")):
                from plugins.agent_tools import _get_booking_otp_state
                otp_state = await _get_booking_otp_state(body.bot_id, body.session_id, visitor_email)
                if not (otp_state and otp_state.get("verified")):
                    raise HTTPException(
                        status_code=403,
                        detail="For security, bookings from previous sessions can only be rescheduled using the link in your confirmation email.",
                    )
        except HTTPException:
            raise
        except Exception:
            logger.exception("Failed session ownership check on reschedule")

    # 4. Slot Timing & Integrity Validation
    try:
        dt_start = datetime.fromisoformat(body.new_start_time.replace("Z", "+00:00"))
        dt_end = datetime.fromisoformat(body.new_end_time.replace("Z", "+00:00"))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid start or end time format. Expected ISO-8601 timestamps.")

    if dt_end <= dt_start:
        raise HTTPException(status_code=400, detail="Invalid meeting slot: end time must be after start time.")

    now_utc = datetime.now(timezone.utc)
    if dt_start.tzinfo is None:
        dt_start = dt_start.replace(tzinfo=timezone.utc)
    if dt_end.tzinfo is None:
        dt_end = dt_end.replace(tzinfo=timezone.utc)

    if dt_start < (now_utc - timedelta(minutes=5)):
        raise HTTPException(status_code=400, detail="Cannot reschedule to a past time. Please select an upcoming slot.")

    if dt_start > (now_utc + timedelta(days=90)):
        raise HTTPException(status_code=400, detail="Cannot schedule meetings more than 90 days in advance.")

    duration_mins = (dt_end - dt_start).total_seconds() / 60
    if duration_mins < 10 or duration_mins > 240:
        raise HTTPException(status_code=400, detail="Invalid meeting duration.")

    # 5. Resolve bot owner & host user
    owner_res = await run_db(lambda: supabase.table("users").select("*").eq("auth_user_id", bot.get("user_id")).execute())
    if not owner_res.data:
        raise HTTPException(status_code=404, detail="Bot owner not found")
    owner_user = owner_res.data[0]

    from plugins.agent_tools import _resolve_meeting_host, reschedule_meeting_core, _format_invitation_time
    from plugins import availability_engine as avail

    host_user = await _resolve_meeting_host(supabase, meeting, owner_user)
    owner_tz_str = avail.resolve_owner_timezone(bot, host_user)
    visitor_tz_str = body.visitor_timezone or meeting.get("timezone") or owner_tz_str

    slot_start_utc = dt_start.astimezone(timezone.utc)
    slot_end_utc = dt_end.astimezone(timezone.utc)

    # 6. Industrial-standard cross-timezone business schedule validation
    bh_start = int(bot.get("business_hours_start") if bot.get("business_hours_start") is not None else 9)
    bh_end = int(bot.get("business_hours_end") if bot.get("business_hours_end") is not None else 17)
    work_days = bot.get("working_days") or ["mon", "tue", "wed", "thu", "fri"]
    adv_hours = int(bot.get("advance_notice_hours") or 0)

    sched_err = avail.validate_slot_against_business_schedule(
        slot_start_utc=slot_start_utc,
        slot_end_utc=slot_end_utc,
        owner_tz_str=owner_tz_str,
        business_hours_start=bh_start,
        business_hours_end=bh_end,
        working_days=work_days,
        advance_notice_hours=adv_hours,
        visitor_tz_str=visitor_tz_str,
    )
    if sched_err:
        raise HTTPException(status_code=400, detail=sched_err)

    # 7. Availability conflict check
    buffer_minutes = int(bot.get("buffer_minutes") or 0)
    use_ms = (bot.get("meeting_provider") or "google_meet") == "teams"
    try:
        available = await avail.is_slot_available(
            supabase, host_user, bot=bot, use_ms_calendar=use_ms,
            start_utc=slot_start_utc, end_utc=slot_end_utc,
            buffer_minutes=buffer_minutes,
        )
    except Exception:
        logger.exception("Reschedule availability check failed; falling open")
        available = True

    if not available:
        raise HTTPException(status_code=400, detail="That new time slot is no longer available. Please choose another time.")

    # 8. Execute reschedule core
    core_res = await reschedule_meeting_core(
        meeting, slot_start_utc, slot_end_utc, bot, body.bot_id, host_user, supabase,
        performed_by="visitor_widget",
    )
    if "error" in core_res:
        raise HTTPException(status_code=400, detail=core_res["error"])

    formatted_time = _format_invitation_time(body.new_start_time, visitor_tz_str)
    meeting_link = meeting.get("meeting_link") or "https://meet.google.com/"

    # 9. Record confirmation message in chatty_conversations
    if body.session_id:
        try:
            confirmation_msg = (
                f"Your meeting has been rescheduled to {formatted_time}.\n\n"
                f"Meeting Link: {meeting_link}\n\n"
                f"A calendar invitation update has been sent to {visitor_email}."
            )
            await run_db(lambda: supabase.table("chatty_conversations").insert({
                "bot_id": body.bot_id,
                "session_id": body.session_id,
                "role": "assistant",
                "content": confirmation_msg,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }).execute())
        except Exception:
            logger.exception("Failed to record reschedule in chatty_conversations")

    return {
        "success": True,
        "meeting_id": meeting["id"],
        "meeting_link": meeting_link,
        "formatted_time": formatted_time,
        "start_time": body.new_start_time,
        "end_time": body.new_end_time,
        "attendee_name": meeting.get("attendee_name") or "Guest",
        "attendee_email": visitor_email,
        "assigned_to_email": meeting.get("assigned_to_email") or host_user.get("email"),
    }


@router.post("/api/widget/booking/cancel")
async def widget_booking_cancel(
    body: WidgetBookingCancelRequest,
    request: Request = None,
):
    """Direct meeting cancellation from the widget UI.
    Validates attendee ownership/session, deletes calendar provider event,
    updates chatty_meetings row to 'cancelled', and emails confirmations."""
    res = await run_db(lambda: supabase.table("chatty_bots").select("*").eq("id", body.bot_id).execute())
    if not res.data:
        raise HTTPException(status_code=404, detail="Bot not found")
    bot = res.data[0]

    visitor_email = (body.attendee_email or "").strip().lower()
    if request:
        ip = _client_ip(request)
        await _widget_rate_limit_or_429(bot, body.bot_id, ip, request.headers.get("x-widget-token"))

        if await _rate_limited_async(f"booking_cancel:{body.bot_id}:{ip}", limit=5, window=300):
            raise HTTPException(status_code=429, detail="Too many cancellation attempts. Please wait a few minutes.")

    # Meeting lookup
    meeting_res = await run_db(
        lambda: supabase.table("chatty_meetings")
        .select("*")
        .eq("id", body.meeting_id)
        .eq("bot_id", body.bot_id)
        .execute()
    )
    if not meeting_res.data:
        raise HTTPException(status_code=404, detail="Meeting not found.")
    meeting = meeting_res.data[0]

    if meeting.get("status") == "cancelled":
        return {"success": True, "meeting_id": body.meeting_id, "status": "cancelled", "message": "Meeting is already cancelled."}

    if meeting.get("attendee_email", "").strip().lower() != visitor_email:
        raise HTTPException(status_code=403, detail="The email address provided does not match this booking.")

    # Session ownership verification
    if body.session_id:
        try:
            leads_res = await run_db(
                lambda: supabase.table("chatty_leads")
                .select("id, email")
                .eq("bot_id", body.bot_id)
                .eq("session_id", body.session_id)
                .execute()
            )
            session_leads = leads_res.data or []
            session_lead_ids = {row["id"] for row in session_leads if row.get("id")}
            session_emails = {row["email"].strip().lower() for row in session_leads if row.get("email")}

            is_authorized = bool(
                (meeting.get("lead_id") and meeting.get("lead_id") in session_lead_ids)
                or (visitor_email in session_emails)
            )
            if not is_authorized and not (body.session_id == meeting.get("session_id")):
                from plugins.agent_tools import _get_booking_otp_state
                otp_state = await _get_booking_otp_state(body.bot_id, body.session_id, visitor_email)
                if not (otp_state and otp_state.get("verified")):
                    raise HTTPException(
                        status_code=403,
                        detail="For security, bookings from previous sessions can only be cancelled using the link in your confirmation email.",
                    )
        except HTTPException:
            raise
        except Exception:
            logger.exception("Failed session ownership check on cancellation")

    owner_res = await run_db(lambda: supabase.table("users").select("*").eq("auth_user_id", bot.get("user_id")).execute())
    if not owner_res.data:
        raise HTTPException(status_code=404, detail="Bot owner not found")
    owner_user = owner_res.data[0]

    from plugins.agent_tools import cancel_meeting_core, _format_invitation_time
    cancel_res = await cancel_meeting_core(
        meeting, bot, body.bot_id, owner_user, supabase, performed_by="visitor_widget",
    )
    if "error" in cancel_res:
        raise HTTPException(status_code=400, detail=cancel_res["error"])

    formatted_time = _format_invitation_time(meeting.get("start_time", ""), meeting.get("timezone"))

    if body.session_id:
        try:
            cancellation_msg = f"Your appointment originally scheduled for {formatted_time} has been cancelled."
            await run_db(lambda: supabase.table("chatty_conversations").insert({
                "bot_id": body.bot_id,
                "session_id": body.session_id,
                "role": "assistant",
                "content": cancellation_msg,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }).execute())
        except Exception:
            logger.exception("Failed to record cancellation in chatty_conversations")

    return {
        "success": True,
        "meeting_id": body.meeting_id,
        "status": "cancelled",
        "message": "Meeting has been cancelled.",
    }


@router.get("/api/widget/booking/active")
async def widget_booking_active(
    bot_id: str,
    session_id: Optional[str] = None,
    email: Optional[str] = None,
):
    """Retrieve any currently scheduled upcoming meeting for this session/visitor."""
    now_iso = datetime.now(timezone.utc).isoformat()
    clean_email = (email or "").strip().lower()

    # 1. Search by attendee email if provided
    if clean_email:
        res = await run_db(
            lambda: supabase.table("chatty_meetings")
            .select("id, bot_id, attendee_name, attendee_email, start_time, end_time, title, status, meeting_link, assigned_to_email, timezone")
            .eq("bot_id", bot_id)
            .eq("attendee_email", clean_email)
            .eq("status", "scheduled")
            .gte("end_time", now_iso)
            .order("start_time", desc=False)
            .limit(1)
            .execute()
        )
        if res.data:
            m = res.data[0]
            from plugins.agent_tools import _format_invitation_time
            return {
                "has_active": True,
                "meeting": {
                    "id": m["id"],
                    "formatted_time": _format_invitation_time(m["start_time"], m.get("timezone")),
                    "start_time": m["start_time"],
                    "end_time": m["end_time"],
                    "attendee_name": m.get("attendee_name") or "Guest",
                    "attendee_email": m["attendee_email"],
                    "meeting_link": m.get("meeting_link") or "https://meet.google.com/",
                    "assigned_to_email": m.get("assigned_to_email"),
                },
            }

    # 2. Search by session leads
    if session_id:
        try:
            leads_res = await run_db(
                lambda: supabase.table("chatty_leads")
                .select("id, email")
                .eq("bot_id", bot_id)
                .eq("session_id", session_id)
                .execute()
            )
            lead_ids = [r["id"] for r in (leads_res.data or []) if r.get("id")]
            lead_emails = [r["email"].strip().lower() for r in (leads_res.data or []) if r.get("email")]

            if lead_ids or lead_emails:
                query = supabase.table("chatty_meetings").select("id, bot_id, attendee_name, attendee_email, start_time, end_time, title, status, meeting_link, assigned_to_email, timezone").eq("bot_id", bot_id).eq("status", "scheduled").gte("end_time", now_iso).order("start_time", desc=False)
                if lead_ids:
                    query = query.in_("lead_id", lead_ids)
                elif lead_emails:
                    query = query.in_("attendee_email", lead_emails)
                res = await run_db(lambda: query.limit(1).execute())
                if res.data:
                    m = res.data[0]
                    from plugins.agent_tools import _format_invitation_time
                    return {
                        "has_active": True,
                        "meeting": {
                            "id": m["id"],
                            "formatted_time": _format_invitation_time(m["start_time"], m.get("timezone")),
                            "start_time": m["start_time"],
                            "end_time": m["end_time"],
                            "attendee_name": m.get("attendee_name") or "Guest",
                            "attendee_email": m["attendee_email"],
                            "meeting_link": m.get("meeting_link") or "https://meet.google.com/",
                            "assigned_to_email": m.get("assigned_to_email"),
                        },
                    }
        except Exception:
            logger.exception("Failed looking up active meeting by session")

    return {"has_active": False, "meeting": None}


