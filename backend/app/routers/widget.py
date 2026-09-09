"""Widget chat/theme/feedback/polling endpoints (/api/widget/*)."""

from __future__ import annotations

import asyncio
import base64
import json
import logging
import time
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import StreamingResponse

from app.core.clients import supabase
from app.core.config import GEMINI_FALLBACK_MODELS
from app.core.db import run_db
from app.core.uploads import read_upload_capped
from plugins import ai_client
from app.schemas.widget import (
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
    WHITELABEL_PLANS,
    WIDGET_MAX_CHARS,
    WIDGET_QUOTA_REPLY,
    _client_ip,
    _detect_sentiment_escalation,
    _log_unanswered_if_needed,
    _mint_widget_token,
    _needs_human,
    _normalize_host,
    _notify_new_conversation,
    _upsert_session,
    _widget_rate_limit_or_429,
    chatty_quota_exceeded,
    geoip_lookup,
    plan_for,
)
from plugins.widget_brain import run_widget_assistant

logger = logging.getLogger("chatty")

router = APIRouter()

_ALLOWED_MEDIA_PREFIXES = ("image/", "audio/", "application/pdf", "text/")
_MEDIA_MAX_BYTES = 20 * 1024 * 1024  # 20MB
_TRANSCRIBE_MAX_BYTES = 10 * 1024 * 1024  # 10MB — voice notes, not full files
_TRANSCRIBE_PROMPT = (
    "Transcribe the spoken words in this audio to plain text, as best you "
    "can even if it's unclear or partial. Output ONLY the transcription — "
    "no commentary, no markdown, no quotes, no translation. Only output "
    "nothing if the audio is truly silent with no speech at all."
)


@router.post("/api/widget/verify-origin")
async def widget_verify_origin(body: WidgetVerifyOriginRequest):
    """Exchange the customer page's real Referer (captured server-side by the
    Next.js embed page, the one point in the flow where a browser exposes it
    genuinely) for a short-lived signed token the widget then attaches to
    every chat/media call. Never hard-fails — always returns a token, even
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

    # --- Rate limit per bot + IP — unverified-origin traffic gets a much
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
    session_row, is_new = await _upsert_session(bot_id, session_id, text)
    if is_new:
        await _notify_new_conversation(bot, owner_user, text, session_id)
        background_tasks.add_task(
            notify.enqueue_webhook_event, supabase, bot_id=bot_id, event="session.started",
            session_id=session_id, data={"first_message": text[:500]},
        )

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
        session_id=session_id, data={"content": text},
    )

    # 2c. If a human agent has taken over, don't run the AI — they'll reply.
    if session_row.get("ai_paused"):
        return WidgetChatResponse(reply="", session_id=session_id, ai_paused=True)

    # 3b. Quota gate — never spend model tokens once the owner is out of quota.
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
      {"type":"token","text":"..."}   — one visible text delta
      {"type":"done","reply":"..."}   — final full reply (also persisted)
      {"type":"paused"}               — a human agent has taken over
      {"type":"error","detail":"..."} — fatal error
    The non-streaming /api/widget/chat remains for SDKs and as a fallback.
    """
    bot_id = body.bot_id
    session_id = body.session_id
    text = body.text
    visitor_timezone = body.visitor_timezone

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

    session_row, is_new = await _upsert_session(bot_id, session_id, text)
    if is_new:
        await _notify_new_conversation(bot, owner_user, text, session_id)
        background_tasks.add_task(
            notify.enqueue_webhook_event, supabase, bot_id=bot_id, event="session.started",
            session_id=session_id, data={"first_message": text[:500]},
        )

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
        session_id=session_id, data={"content": text},
    )

    def _sse(obj: dict) -> str:
        return f"data: {json.dumps(obj)}\n\n"

    # Human agent took over — nothing to stream.
    if session_row.get("ai_paused"):
        async def _paused_gen():
            yield _sse({"type": "paused"})
        return StreamingResponse(_paused_gen(), media_type="text/event-stream", background=background_tasks)

    # Quota gate — save the graceful reply and stream it as a single message.
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
    happens server-side via Gemini instead — works in every browser."""
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
            # Diagnose why — a mimetype/codec Gemini silently can't parse,
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
    # Gemini's audio understanding only accepts wav/mp3/aiff/aac/ogg/flac — NOT
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

    # Quota gate BEFORE the storage write — an owner who's already out of
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
    "Refine answers" review) — reusing that field for this would collide
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
    """SSE stream of human-agent replies + AI-pause changes for a session —
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
        "color_scheme"
    )
    try:
        res = await run_db(lambda: supabase.table("chatty_bots").select(
            f"{base_columns}, font_family, font_size_percent, voice_message_mode, panel_size").eq("id", bot_id).execute())
    except Exception:
        try:
            # panel_size's migration (20260902070328) may not be applied to
            # this environment yet — retry without it before falling further back.
            res = await run_db(lambda: supabase.table("chatty_bots").select(
                f"{base_columns}, font_family, font_size_percent, voice_message_mode").eq("id", bot_id).execute())
        except Exception:
            try:
                # voice_message_mode's migration (20260829020000) may not be
                # applied yet — retry without it before falling further back.
                res = await run_db(lambda: supabase.table("chatty_bots").select(
                    f"{base_columns}, font_family, font_size_percent").eq("id", bot_id).execute())
            except Exception:
                # font_family/font_size_percent's migration (20260829010000) may
                # not be applied to this environment yet either — PostgREST 400s
                # the whole select on an unknown column, which would otherwise
                # break every bot's widget theme, not just skip the new fields.
                # Falls back to the columns that are guaranteed to exist.
                res = await run_db(lambda: supabase.table("chatty_bots").select(
                    base_columns).eq("id", bot_id).execute())
    if not res.data:
        raise HTTPException(status_code=404, detail="Bot not found")
    b = res.data[0]
    # White-label is a paid-plan feature — enforce server-side so the flag
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
    }


@router.get("/api/widget/kb-sources")
async def widget_kb_sources(bot_id: str):
    """Public, unauthenticated knowledge-base articles for the /kb/[botId]
    help-center portal. Same pattern as widget_theme above — served via the
    backend (service role) rather than a direct anon Supabase read, so this
    always requires an explicit bot_id and never risks an unfiltered query
    returning every bot's sources (which a bare RLS policy on chatty_sources
    can't distinguish from a filtered one)."""
    res = await run_db(lambda: supabase.table("chatty_sources").select(
        "id, name, content, type").eq("bot_id", bot_id).execute())
    return {"sources": res.data or []}


# ---------------------------------------------------------------------------
# PUBLIC KNOWLEDGE BASE & HELP CENTER PORTAL (Zendesk Guide Level)
# ---------------------------------------------------------------------------

@router.get("/api/widget/kb/portal")
async def widget_kb_portal(bot_id: str):
    """Public Help Center portal data: bot branding, categories, promoted and recent articles."""
    # 1. Fetch bot details
    res_bot = await run_db(lambda: supabase.table("chatty_bots").select(
        "id, name, logo_url, avatar_icon, primary_color, color_scheme, bot_role"
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
        .select("id, category_id, title, slug, subtitle, tags, is_promoted, order_index, view_count, helpful_count, not_helpful_count, created_at, updated_at")
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

