"""Inbound channel webhooks: WhatsApp, Slack, Lemon Squeezy billing (/webhook/*)."""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import logging
import os
import re
import time
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, BackgroundTasks, HTTPException, Request
from fastapi.responses import PlainTextResponse

from app.core.clients import supabase
from app.core.config import LEMON_VARIANT_TO_PLAN, LEMON_WEBHOOK_SECRET, RESEND_INBOUND_WEBHOOK_SECRET
from app.core.db import run_db
from app.services.chatty_quota_service import chatty_quota_exceeded
from app.services.whatsapp_service import (
    build_whatsapp_booking_url,
    get_bot_whatsapp_secret,
    send_whatsapp_message,
)

# Bridged helpers still living in main.py (Phase 2 leaves these in place to
# avoid a large, risky helper-extraction pass alongside the route split).
from main import WIDGET_QUOTA_REPLY
from plugins.widget_brain import run_widget_assistant

logger = logging.getLogger("chatty")

router = APIRouter()

# ---------------------------------------------------------------------------
# WhatsApp channel (Meta Cloud API).
# Supports per-bot credentials stored on chatty_bots (with server env fallbacks),
# HMAC-SHA256 signature verification, multimodal audio/image/document ingestion,
# and interactive quick-reply buttons.
# ---------------------------------------------------------------------------
WHATSAPP_VERIFY_TOKEN = os.environ.get("WHATSAPP_VERIFY_TOKEN", "")
WHATSAPP_ACCESS_TOKEN = os.environ.get("WHATSAPP_ACCESS_TOKEN", "")
WHATSAPP_APP_SECRET = os.environ.get("WHATSAPP_APP_SECRET", "")
WHATSAPP_API_VERSION = os.environ.get("WHATSAPP_API_VERSION", "v21.0")


def _verify_meta_signature(raw_payload: bytes, signature_header: str, app_secret: str) -> bool:
    """Cryptographically verify Meta's X-Hub-Signature-256 HMAC header."""
    if not (signature_header and app_secret):
        return False
    expected = "sha256=" + hmac.new(
        app_secret.encode("utf-8"),
        raw_payload,
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature_header)


async def _download_whatsapp_media(media_id: str, access_token: str) -> tuple[bytes | None, str | None]:
    """Fetch media metadata from Meta Graph API, then stream the binary content."""
    if not (media_id and access_token):
        return None, None
    meta_url = f"https://graph.facebook.com/{WHATSAPP_API_VERSION}/{media_id}"
    headers = {"Authorization": f"Bearer {access_token}"}
    try:
        async with httpx.AsyncClient(timeout=25) as client:
            res = await client.get(meta_url, headers=headers)
            if res.status_code != 200:
                logger.error("Failed to query WhatsApp media %s: %s", media_id, res.text)
                return None, None
            media_data = res.json()
            download_url = media_data.get("url")
            mime_type = (media_data.get("mime_type") or "").split(";")[0]
            if not download_url:
                return None, None

            dl_res = await client.get(download_url, headers=headers)
            if dl_res.status_code != 200:
                logger.error("Failed to download WhatsApp media binary %s: %s", media_id, dl_res.status_code)
                return None, None
            return dl_res.content, mime_type
    except Exception:
        logger.exception("Exception downloading WhatsApp media %s", media_id)
        return None, None


@router.get("/webhook/whatsapp")
async def whatsapp_verify(request: Request):
    """Meta webhook verification handshake (supports server env and per-bot verify tokens)."""
    p = request.query_params
    mode = p.get("hub.mode")
    token = p.get("hub.verify_token")
    challenge = p.get("hub.challenge")

    if mode != "subscribe" or not token:
        raise HTTPException(status_code=403, detail="Invalid verification request")

    # 1. Server-level fallback token
    if WHATSAPP_VERIFY_TOKEN and token == WHATSAPP_VERIFY_TOKEN:
        return PlainTextResponse(challenge or "")

    # 2. Check per-bot verify token in database
    try:
        res = await run_db(lambda: supabase.table("chatty_bots")
            .select("id")
            .eq("whatsapp_verify_token", token)
            .limit(1)
            .execute())
        if res.data:
            return PlainTextResponse(challenge or "")
    except Exception:
        logger.exception("Error verifying per-bot whatsapp token")

    raise HTTPException(status_code=403, detail="Verification token mismatch")


async def _send_whatsapp(
    phone_number_id: str,
    to: str,
    text: str,
    access_token: str,
    quick_replies: list[str] | None = None,
) -> None:
    """Send an outbound text or interactive quick-reply message via Meta Cloud API."""
    await send_whatsapp_message(
        phone_number_id=phone_number_id,
        to=to,
        text=text,
        access_token=access_token,
        quick_replies=quick_replies,
        api_version=WHATSAPP_API_VERSION,
    )


async def _handle_whatsapp_message(
    phone_number_id: str,
    frm: str,
    bot: dict[str, Any],
    owner_user: dict[str, Any],
    access_token: str,
    text: str = "",
    media_bytes: bytes | None = None,
    media_mime: str | None = None,
    media_filename: str | None = None,
) -> None:
    session_id = f"wa:{frm}"
    bot_id = bot["id"]

    # Quota check
    if await chatty_quota_exceeded(owner_user, bot["user_id"]):
        await _send_whatsapp(phone_number_id, frm, WIDGET_QUOTA_REPLY, access_token)
        return

    # Record visitor message in chatty_conversations
    display_content = text
    if media_bytes and media_mime:
        tag = f"[attachment: {media_filename or media_mime}]"
        display_content = (text + "\n" + tag).strip() if text else tag

    try:
        await run_db(lambda: supabase.table("chatty_conversations").insert({
            "bot_id": bot_id,
            "session_id": session_id,
            "role": "user",
            "content": display_content or "[empty message]",
            "sender": "visitor",
        }).execute())
    except Exception:
        logger.exception("Failed to record inbound WhatsApp message")

    # Run AI assistant (Gemini multimodal)
    try:
        result = await run_widget_assistant(
            bot_id=bot_id,
            owner_user=owner_user,
            bot=bot,
            session_id=session_id,
            text=text,
            visitor_timezone="UTC",
            media_bytes=media_bytes,
            media_mime=media_mime,
        )
        reply = result.get("reply", "")
    except Exception:
        logger.exception("WhatsApp assistant run failed")
        reply = "I apologize, but I encountered an error processing your request. Please try again in a moment."

    if not reply:
        return

    # Intercept booking widget marker or explicit scheduling requests
    booking_marker = "[BOOKING_WIDGET]"
    wants_booking = (
        booking_marker in reply
        or (
            bot.get("calendar_scheduling_enabled")
            and re.search(r"\b(book|booking|schedule|appointment|demo)\b", text, re.IGNORECASE)
            and not any(k in reply for k in ("/book/", "meet.google.com", "teams.microsoft.com"))
        )
    )

    if wants_booking:
        secret = get_bot_whatsapp_secret(bot)
        booking_url, _, _ = build_whatsapp_booking_url(bot_id=bot_id, phone=frm, secret=secret)
        booking_cta = (
            f"\n\n📅 *Schedule your appointment here:*\n"
            f"{booking_url}\n\n"
            f"_Tap the link to choose your preferred date & time slot._"
        )
        if booking_marker in reply:
            reply = reply.replace(booking_marker, "").strip() + booking_cta
        elif not any(x in reply for x in ("/book/", "meet.google.com", "teams.microsoft.com")):
            reply = reply.strip() + booking_cta
    else:
        # Strip booking marker if leftover
        reply = reply.replace(booking_marker, "").strip()

    # Save AI reply
    try:
        await run_db(lambda: supabase.table("chatty_conversations").insert({
            "bot_id": bot_id,
            "session_id": session_id,
            "role": "assistant",
            "content": reply,
            "sender": "ai",
        }).execute())
    except Exception:
        logger.exception("Failed to record WhatsApp AI reply")

    # Quick replies from bot configuration
    quick_replies = bot.get("whatsapp_quick_replies")
    btn_list = quick_replies if isinstance(quick_replies, list) else []

    await _send_whatsapp(phone_number_id, frm, reply, access_token, quick_replies=btn_list)


@router.post("/webhook/whatsapp")
async def whatsapp_receive(request: Request):
    """Inbound WhatsApp webhook handler (Meta Cloud API).
    Validates HMAC signature, routes text, interactive buttons, voice clips, and images to Gemini.
    """
    raw_body = await request.body()
    sig_header = request.headers.get("x-hub-signature-256", "")

    try:
        body = json.loads(raw_body.decode("utf-8")) if raw_body else {}
    except Exception:
        logger.warning("WhatsApp webhook received non-JSON payload")
        return {"ok": True}

    entries = body.get("entry", [])
    for entry in entries:
        for change in entry.get("changes", []):
            val = change.get("value", {})
            pnid = (val.get("metadata") or {}).get("phone_number_id")
            if not pnid:
                continue

            # Look up bot linked to this WhatsApp phone number
            res = await run_db(lambda: supabase.table("chatty_bots")
                .select("*")
                .eq("whatsapp_phone_number_id", pnid)
                .limit(1)
                .execute())
            if not res.data:
                logger.debug("No bot linked to WhatsApp phone_number_id %s", pnid)
                continue

            bot = res.data[0]
            # If bot explicitly disabled whatsapp and no override, skip
            if bot.get("whatsapp_enabled") is False and not os.environ.get("WHATSAPP_FORCE_ENABLED"):
                logger.debug("WhatsApp channel is disabled for bot %s", bot["id"])
                continue

            # HMAC-SHA256 signature verification
            app_secret = bot.get("whatsapp_app_secret") or WHATSAPP_APP_SECRET
            if app_secret:
                if not _verify_meta_signature(raw_body, sig_header, app_secret):
                    logger.warning("WhatsApp webhook invalid HMAC signature for bot %s", bot["id"])
                    raise HTTPException(status_code=401, detail="Invalid signature")

            # Resolve Access Token
            access_token = bot.get("whatsapp_access_token") or WHATSAPP_ACCESS_TOKEN
            if not access_token:
                logger.warning("No WhatsApp access token configured for bot %s or server", bot["id"])
                continue

            # Owner user lookup
            owner_res = await run_db(lambda: supabase.table("users")
                .select("*")
                .eq("auth_user_id", bot["user_id"])
                .limit(1)
                .execute())
            if not owner_res.data:
                logger.error("Owner user not found for bot %s", bot["id"])
                continue
            owner_user = owner_res.data[0]

            # Process each message
            for msg in val.get("messages", []):
                frm = msg.get("from")
                msg_type = msg.get("type")

                if msg_type == "text":
                    user_text = (msg.get("text") or {}).get("body", "")
                    await _handle_whatsapp_message(
                        pnid, frm, bot, owner_user, access_token, text=user_text
                    )

                elif msg_type == "interactive":
                    # Button or list item reply
                    interactive = msg.get("interactive", {})
                    btn_reply = interactive.get("button_reply", {})
                    list_reply = interactive.get("list_reply", {})
                    button_text = btn_reply.get("title") or list_reply.get("title") or ""
                    if button_text:
                        await _handle_whatsapp_message(
                            pnid, frm, bot, owner_user, access_token, text=button_text
                        )

                elif msg_type in ("audio", "voice"):
                    # Voice note / audio message
                    media_obj = msg.get("audio") or msg.get("voice") or {}
                    media_id = media_obj.get("id")
                    if media_id:
                        media_bytes, media_mime = await _download_whatsapp_media(media_id, access_token)
                        if media_bytes:
                            clean_mime = (media_mime or "audio/ogg").split(";")[0]
                            await _handle_whatsapp_message(
                                pnid, frm, bot, owner_user, access_token,
                                text="",
                                media_bytes=media_bytes,
                                media_mime=clean_mime,
                                media_filename="voice_note.ogg"
                            )

                elif msg_type == "image":
                    # Photo / screenshot
                    img_obj = msg.get("image") or {}
                    media_id = img_obj.get("id")
                    caption = img_obj.get("caption") or ""
                    if media_id:
                        media_bytes, media_mime = await _download_whatsapp_media(media_id, access_token)
                        if media_bytes:
                            clean_mime = (media_mime or "image/jpeg").split(";")[0]
                            await _handle_whatsapp_message(
                                pnid, frm, bot, owner_user, access_token,
                                text=caption,
                                media_bytes=media_bytes,
                                media_mime=clean_mime,
                                media_filename="photo.jpg"
                            )

                elif msg_type == "document":
                    # PDF, CSV, etc.
                    doc_obj = msg.get("document") or {}
                    media_id = doc_obj.get("id")
                    filename = doc_obj.get("filename") or "document.pdf"
                    caption = doc_obj.get("caption") or ""
                    if media_id:
                        media_bytes, media_mime = await _download_whatsapp_media(media_id, access_token)
                        if media_bytes:
                            clean_mime = (media_mime or "application/pdf").split(";")[0]
                            await _handle_whatsapp_message(
                                pnid, frm, bot, owner_user, access_token,
                                text=caption,
                                media_bytes=media_bytes,
                                media_mime=clean_mime,
                                media_filename=filename
                            )

    return {"ok": True}


# ---------------------------------------------------------------------------
# Slack channel (slash command). Disabled unless SLACK_SIGNING_SECRET is set.
# Link a bot to a workspace via chatty_bots.slack_team_id.
# ---------------------------------------------------------------------------
SLACK_SIGNING_SECRET = os.environ.get("SLACK_SIGNING_SECRET", "")


def _verify_slack_signature(timestamp: str, sig: str, raw_body: str) -> bool:
    if not (SLACK_SIGNING_SECRET and timestamp and sig):
        return False
    try:
        if abs(time.time() - int(timestamp)) > 300:
            return False
    except ValueError:
        return False
    base = f"v0:{timestamp}:{raw_body}".encode()
    mine = "v0=" + hmac.new(SLACK_SIGNING_SECRET.encode(), base, hashlib.sha256).hexdigest()
    return hmac.compare_digest(mine, sig)


async def _slack_answer_and_post(team_id: str, text: str, response_url: str) -> None:
    answer = "This Slack workspace isn't linked to a Chatty bot yet."
    res = await run_db(lambda: supabase.table("chatty_bots").select("*").eq(
        "slack_team_id", team_id).limit(1).execute())
    if res.data:
        bot = res.data[0]
        owner = await run_db(lambda: supabase.table("users").select("*").eq(
            "auth_user_id", bot["user_id"]).limit(1).execute())
        if not owner.data:
            answer = "Bot owner not found."
        elif await chatty_quota_exceeded(owner.data[0], bot["user_id"]):
            answer = WIDGET_QUOTA_REPLY
        else:
            try:
                result = await run_widget_assistant(
                    bot_id=bot["id"], owner_user=owner.data[0], bot=bot,
                    session_id=f"slack:{team_id}", text=text, visitor_timezone="UTC")
                answer = result["reply"]
            except Exception:
                logger.exception("slack assistant failed")
                answer = "Sorry, something went wrong."
    try:
        async with httpx.AsyncClient(timeout=10) as c:
            await c.post(response_url, json={"response_type": "in_channel", "text": answer})
    except Exception:
        logger.exception("slack response post failed")


@router.post("/webhook/slack")
async def slack_command(request: Request, background_tasks: BackgroundTasks):
    """Slack slash command → answer from the linked bot. Acks immediately and
    posts the full answer to response_url (LLM exceeds Slack's 3s limit)."""
    if not SLACK_SIGNING_SECRET:
        return {"text": "Slack channel not configured."}
    raw = (await request.body()).decode()
    if not _verify_slack_signature(
        request.headers.get("x-slack-request-timestamp", ""),
        request.headers.get("x-slack-signature", ""), raw,
    ):
        raise HTTPException(status_code=403, detail="bad signature")
    from urllib.parse import parse_qs
    form = {k: v[0] for k, v in parse_qs(raw).items()}
    text = (form.get("text") or "").strip()
    if not text:
        return {"text": "Ask me something, e.g. `/chatty how do I reset my password?`"}
    background_tasks.add_task(
        _slack_answer_and_post, form.get("team_id", ""), text, form.get("response_url", ""))
    return {"response_type": "ephemeral", "text": "🤔 Thinking…"}


@router.post("/webhook/lemonsqueezy")
async def webhook_lemonsqueezy(request: Request):
    """Lemon Squeezy billing webhook receiver."""
    raw_body = await request.body()
    sig = request.headers.get("x-signature", "")
    if not LEMON_WEBHOOK_SECRET:
        logger.error("LEMON_WEBHOOK_SECRET is not configured; rejecting incoming webhook")
        raise HTTPException(status_code=503, detail="Billing webhook unconfigured")
    mine = hmac.new(LEMON_WEBHOOK_SECRET.encode(), raw_body, hashlib.sha256).hexdigest()
    if not (sig and hmac.compare_digest(mine, sig)):
        raise HTTPException(status_code=403, detail="Invalid signature")
    try:
        data = json.loads(raw_body.decode("utf-8"))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    event_name = data.get("meta", {}).get("event_name", "")
    custom_data = data.get("meta", {}).get("custom_data", {})
    user_id = custom_data.get("user_id")
    variant_id = str(data.get("data", {}).get("attributes", {}).get("variant_id", ""))
    plan_name = LEMON_VARIANT_TO_PLAN.get(variant_id, "hobby")

    logger.info("Lemon Squeezy webhook event %s for user %s, variant %s -> plan %s", event_name, user_id, variant_id, plan_name)
    if user_id and event_name in ("order_created", "subscription_created", "subscription_updated"):
        try:
            await run_db(lambda: supabase.table("user_subscriptions").upsert({
                "user_id": user_id,
                "plan": plan_name,
                "variant_id": variant_id,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }).execute())
        except Exception as e:
            logger.exception("Failed to record subscription update: %s", e)

    return {"status": "success"}


# ---------------------------------------------------------------------------
# Resend inbound email - captures a visitor's reply to a meeting
# confirmation/reschedule email (team scheduling Phase 4). Resend signs
# these with Svix, not a plain HMAC hex digest like Lemon Squeezy above -
# svix-id/svix-timestamp/svix-signature headers, secret prefixed "whsec_".
# ---------------------------------------------------------------------------


def _verify_svix_signature(svix_id: str, svix_timestamp: str, raw_body: bytes,
                           svix_signature_header: str, secret: str) -> bool:
    if not secret or not svix_id or not svix_timestamp or not svix_signature_header:
        return False
    try:
        secret_bytes = base64.b64decode(secret.removeprefix("whsec_"))
    except Exception:
        return False
    signed_content = f"{svix_id}.{svix_timestamp}.".encode() + raw_body
    expected = base64.b64encode(hmac.new(secret_bytes, signed_content, hashlib.sha256).digest()).decode()
    # The header can carry multiple space-separated "v1,<sig>" candidates
    # (e.g. during a Svix secret rotation) - any matching one is valid.
    for part in svix_signature_header.split():
        if "," not in part:
            continue
        version, sig = part.split(",", 1)
        if version == "v1" and hmac.compare_digest(sig, expected):
            return True
    return False


_MEETING_REPLY_ADDRESS_RE = re.compile(r"^meeting\+([0-9a-fA-F-]{36})@")


@router.post("/webhook/resend-inbound")
async def resend_inbound(request: Request):
    """Captures a visitor's reply into that meeting's thread
    (chatty_meeting_messages) by matching the "meeting+<uuid>@..." local
    part plugins/agent_tools.py::_meeting_reply_to put in the Reply-To
    header of the original email. Fails closed (rejects unverified
    requests) rather than the softer "skip verification if unconfigured"
    pattern Lemon Squeezy's webhook above uses - this endpoint writes into
    real customer meeting records from a payload anyone can POST, so an
    unconfigured secret should block it, not silently accept anything."""
    raw_body = await request.body()
    if not _verify_svix_signature(
        request.headers.get("svix-id", ""), request.headers.get("svix-timestamp", ""),
        raw_body, request.headers.get("svix-signature", ""), RESEND_INBOUND_WEBHOOK_SECRET,
    ):
        raise HTTPException(status_code=403, detail="Invalid signature")

    try:
        payload = json.loads(raw_body.decode("utf-8"))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    data = payload.get("data") or {}
    to_field = data.get("to")
    if isinstance(to_field, list):
        to_addresses = to_field
    elif isinstance(to_field, str):
        to_addresses = [to_field]
    else:
        to_addresses = []

    meeting_id = None
    for addr in to_addresses:
        addr_str = addr.get("email") if isinstance(addr, dict) else addr
        if not addr_str:
            continue
        m = _MEETING_REPLY_ADDRESS_RE.match(addr_str.strip())
        if m:
            meeting_id = m.group(1)
            break

    if not meeting_id:
        # Not addressed to a meeting-reply alias - nothing to do, but still
        # 200 so Resend doesn't keep retrying a delivery we'll never use.
        return {"ok": True, "matched": False}

    res_meet = await run_db(lambda: supabase.table("chatty_meetings").select("*").eq("id", meeting_id).execute())
    if not res_meet.data:
        logger.warning("resend_inbound: no meeting found for id %s", meeting_id)
        return {"ok": True, "matched": False}
    meeting = res_meet.data[0]

    from_field = data.get("from")
    from_email = (from_field.get("email") if isinstance(from_field, dict) else from_field) or "unknown"
    subject = (data.get("subject") or "")[:500]
    body_text = (data.get("text") or data.get("html") or "")[:20000]

    try:
        await run_db(lambda: supabase.table("chatty_meeting_messages").insert({
            "meeting_id": meeting_id, "direction": "inbound", "from_email": from_email,
            "subject": subject, "body_text": body_text,
        }).execute())
    except Exception:
        logger.exception("Failed to record inbound meeting reply for meeting %s", meeting_id)
        raise HTTPException(status_code=500, detail="Failed to record message")

    # Auto-reply using the same scheduling tools the widget uses (real
    # availability, real reschedule) - best-effort, logged not raised, so a
    # broken auto-reply never turns into a failed webhook delivery/retry.
    from plugins.agent_tools import handle_meeting_email_reply
    await handle_meeting_email_reply(supabase, meeting, from_email)

    return {"ok": True, "matched": True}
