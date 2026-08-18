"""Inbound channel webhooks: WhatsApp, Slack, Lemon Squeezy billing (/webhook/*)."""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
import os
import time
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, BackgroundTasks, HTTPException, Request
from fastapi.responses import PlainTextResponse

from app.core.clients import supabase
from app.core.config import LEMON_VARIANT_TO_PLAN, LEMON_WEBHOOK_SECRET

# Bridged helpers still living in main.py (Phase 2 leaves these in place to
# avoid a large, risky helper-extraction pass alongside the route split).
from main import WIDGET_QUOTA_REPLY, chatty_quota_exceeded
from plugins.widget_brain import run_widget_assistant

logger = logging.getLogger("chatty")

router = APIRouter()

# ---------------------------------------------------------------------------
# WhatsApp channel (Meta Cloud API). Fully disabled unless WHATSAPP_ACCESS_TOKEN
# is set. A bot is linked to a number via chatty_bots.whatsapp_phone_number_id.
# ---------------------------------------------------------------------------
WHATSAPP_VERIFY_TOKEN = os.environ.get("WHATSAPP_VERIFY_TOKEN", "")
WHATSAPP_ACCESS_TOKEN = os.environ.get("WHATSAPP_ACCESS_TOKEN", "")
WHATSAPP_API_VERSION = os.environ.get("WHATSAPP_API_VERSION", "v21.0")


@router.get("/webhook/whatsapp")
async def whatsapp_verify(request: Request):
    """Meta webhook verification handshake."""
    p = request.query_params
    if (WHATSAPP_VERIFY_TOKEN and p.get("hub.mode") == "subscribe"
            and p.get("hub.verify_token") == WHATSAPP_VERIFY_TOKEN):
        return PlainTextResponse(p.get("hub.challenge") or "")
    raise HTTPException(status_code=403, detail="verification failed")


async def _send_whatsapp(phone_number_id: str, to: str, text: str) -> None:
    url = f"https://graph.facebook.com/{WHATSAPP_API_VERSION}/{phone_number_id}/messages"
    try:
        async with httpx.AsyncClient(timeout=10) as c:
            await c.post(url, headers={"Authorization": f"Bearer {WHATSAPP_ACCESS_TOKEN}"},
                         json={"messaging_product": "whatsapp", "to": to, "type": "text",
                               "text": {"body": text[:4096]}})
    except Exception:
        logger.exception("whatsapp send failed")


async def _handle_whatsapp_message(phone_number_id: str, frm: str, text: str) -> None:
    if not (phone_number_id and frm and text and text.strip()):
        return
    res = supabase.table("chatty_bots").select("*").eq(
        "whatsapp_phone_number_id", phone_number_id).limit(1).execute()
    if not res.data:
        return
    bot = res.data[0]
    owner = supabase.table("users").select("*").eq(
        "auth_user_id", bot["user_id"]).limit(1).execute()
    if not owner.data:
        return
    owner_user = owner.data[0]
    session_id = f"wa:{frm}"
    if chatty_quota_exceeded(owner_user, bot["user_id"]):
        await _send_whatsapp(phone_number_id, frm, WIDGET_QUOTA_REPLY)
        return
    try:
        supabase.table("chatty_conversations").insert({
            "bot_id": bot["id"], "session_id": session_id, "role": "user",
            "content": text, "sender": "visitor"}).execute()
    except Exception:
        logger.exception("wa save inbound failed")
    try:
        result = await run_widget_assistant(
            bot_id=bot["id"], owner_user=owner_user, bot=bot,
            session_id=session_id, text=text, visitor_timezone="UTC")
        reply = result["reply"]
    except Exception:
        logger.exception("wa assistant failed")
        return
    try:
        supabase.table("chatty_conversations").insert({
            "bot_id": bot["id"], "session_id": session_id, "role": "assistant",
            "content": reply, "sender": "ai"}).execute()
    except Exception:
        logger.exception("wa save reply failed")
    await _send_whatsapp(phone_number_id, frm, reply)


@router.post("/webhook/whatsapp")
async def whatsapp_receive(request: Request):
    """Inbound WhatsApp messages → routed to the linked bot. Always returns 200
    so Meta doesn't retry-storm; no-op when the channel is unconfigured."""
    if not WHATSAPP_ACCESS_TOKEN:
        return {"ok": True}
    try:
        body = await request.json()
        for entry in body.get("entry", []):
            for change in entry.get("changes", []):
                val = change.get("value", {})
                pnid = (val.get("metadata") or {}).get("phone_number_id")
                for msg in val.get("messages", []):
                    if msg.get("type") == "text":
                        await _handle_whatsapp_message(
                            pnid, msg.get("from"), (msg.get("text") or {}).get("body", ""))
    except Exception:
        logger.exception("whatsapp receive failed")
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
    res = supabase.table("chatty_bots").select("*").eq(
        "slack_team_id", team_id).limit(1).execute()
    if res.data:
        bot = res.data[0]
        owner = supabase.table("users").select("*").eq(
            "auth_user_id", bot["user_id"]).limit(1).execute()
        if not owner.data:
            answer = "Bot owner not found."
        elif chatty_quota_exceeded(owner.data[0], bot["user_id"]):
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
    if LEMON_WEBHOOK_SECRET:
        mine = hmac.new(LEMON_WEBHOOK_SECRET.encode(), raw_body, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(mine, sig):
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
            supabase.table("user_subscriptions").upsert({
                "user_id": user_id,
                "plan": plan_name,
                "variant_id": variant_id,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }).execute()
        except Exception as e:
            logger.exception("Failed to record subscription update: %s", e)

    return {"status": "success"}
