"""Inbound channel webhooks: WhatsApp, Lemon Squeezy billing (/webhook/*)."""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import logging
import os
import re
import time
from datetime import datetime, timedelta, timezone
from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, BackgroundTasks, HTTPException, Request
from fastapi.responses import PlainTextResponse

from app.core.clients import supabase
from app.core import ssrf
from app.core.config import LEMON_VARIANT_TO_PLAN, LEMON_WEBHOOK_SECRET, RESEND_INBOUND_WEBHOOK_SECRET
from app.core.db import run_db
from app.core.crypto import decrypt_secret
from app.adapters.redis_jobs import RedisJobQueue
from app.services.chatty_quota_service import chatty_quota_exceeded
from app.services.widget_session_service import upsert_session as _upsert_session
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

AFFILIATE_DEFAULT_COMMISSION_RATE_BPS = 3000
AFFILIATE_DEFAULT_PAYOUT_HOLD_DAYS = 30
AFFILIATE_IP_HASH_SALT = os.environ.get("AFFILIATE_IP_HASH_SALT") or LEMON_WEBHOOK_SECRET or ""





def _clean_referral_code(value: object) -> str | None:
    if not isinstance(value, str):
        return None
    code = value.strip().lower()[:80]
    return code if re.match(r"^[a-z0-9][a-z0-9_-]{1,79}$", code) else None


def _lemon_event_id(data: dict, event_name: str) -> str:
    meta = data.get("meta") or {}
    event_id = meta.get("event_id") or meta.get("id")
    if event_id:
        return str(event_id)
    data_id = (data.get("data") or {}).get("id")
    if data_id:
        return f"{event_name}:{data_id}"
    return hashlib.sha256(json.dumps(data, sort_keys=True).encode("utf-8")).hexdigest()


def _amount_cents(attributes: dict) -> int:
    for key in ("total", "subtotal", "amount", "total_usd"):
        value = attributes.get(key)
        if isinstance(value, int):
            return max(value, 0)
        if isinstance(value, float):
            return max(int(round(value)), 0)
        if isinstance(value, str) and value.isdigit():
            return int(value)
    return 0


async def _record_affiliate_conversion(data: dict, event_name: str, user_id: str | None, event_id: str) -> None:
    custom_data = (data.get("meta") or {}).get("custom_data") or {}
    referral_code = _clean_referral_code(custom_data.get("affiliate_ref") or custom_data.get("ref"))
    if not (referral_code and user_id):
        return

    attributes = (data.get("data") or {}).get("attributes") or {}
    gross_amount_cents = _amount_cents(attributes)
    if gross_amount_cents <= 0:
        return

    affiliate_res = await run_db(lambda: supabase.table("affiliate_profiles").select(
        "id,user_id,payout_email,commission_rate_bps,payout_hold_days,status"
    ).eq("referral_code", referral_code).limit(1).execute())
    if not affiliate_res.data:
        logger.info("Affiliate code %s was not found for Lemon event %s", referral_code, event_id)
        return

    affiliate = affiliate_res.data[0]
    if affiliate.get("status") != "active":
        logger.info("Affiliate code %s is not active; skipping commission for %s", referral_code, event_id)
        return

    # 1. Multi-factor Anti-Self-Referral Checks
    buyer_email = (attributes.get("user_email") or "").strip().lower()
    payout_email = (affiliate.get("payout_email") or "").strip().lower()

    is_self_referral = (
        affiliate.get("user_id") == user_id
        or (buyer_email and payout_email and buyer_email == payout_email)
    )
    if not is_self_referral and buyer_email and affiliate.get("user_id"):
        try:
            aff_user_res = await run_db(lambda: supabase.table("users").select("email").eq("auth_user_id", affiliate["user_id"]).limit(1).execute())
            if aff_user_res.data:
                affiliate_user_email = (aff_user_res.data[0].get("email") or "").strip().lower()
                if buyer_email == affiliate_user_email:
                    is_self_referral = True
        except Exception:
            pass

    if is_self_referral:
        logger.warning("Blocked self-referral attempt by affiliate %s on user %s", affiliate["id"], user_id)
        await run_db(lambda: supabase.table("affiliate_fraud_flags").insert({
            "affiliate_id": affiliate["id"],
            "referred_user_id": user_id,
            "severity": "blocked",
            "reason": "Self-referral attempted (matching user ID or email address)",
            "metadata": {"lemon_event_id": event_id, "event_name": event_name, "buyer_email": buyer_email},
        }).execute())
        return

    # 2. Check 12-Month Recurring Commission Limit (365 days max)
    existing_ref = await run_db(lambda: supabase.table("affiliate_referrals").select("id, converted_at, first_seen_at").eq("referred_user_id", user_id).limit(1).execute())
    if existing_ref.data:
        first_conv = existing_ref.data[0].get("converted_at") or existing_ref.data[0].get("first_seen_at")
        if first_conv:
            try:
                conv_dt = datetime.fromisoformat(first_conv.replace("Z", "+00:00"))
                if (datetime.now(timezone.utc) - conv_dt).days > 365:
                    logger.info("Affiliate recurring window expired (>365 days) for user %s on event %s", user_id, event_id)
                    return
            except Exception:
                pass

    referral_payload = {
        "affiliate_id": affiliate["id"],
        "referred_user_id": user_id,
        "referral_code": referral_code,
        "first_landing_page": custom_data.get("landing_page"),
        "utm_source": custom_data.get("utm_source") or "affiliate",
        "utm_medium": custom_data.get("utm_medium"),
        "utm_campaign": custom_data.get("utm_campaign"),
        "status": "paid",
        "converted_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    referral_res = await run_db(lambda: supabase.table("affiliate_referrals").upsert(
        referral_payload,
        on_conflict="referred_user_id",
    ).execute())
    referral_id = referral_res.data[0].get("id") if referral_res.data else None

    rate_bps = int(affiliate.get("commission_rate_bps") or AFFILIATE_DEFAULT_COMMISSION_RATE_BPS)
    hold_days = int(affiliate.get("payout_hold_days") or AFFILIATE_DEFAULT_PAYOUT_HOLD_DAYS)
    commission_amount = round(gross_amount_cents * rate_bps / 10000)
    currency = str(attributes.get("currency") or "USD").upper()
    await run_db(lambda: supabase.table("affiliate_commissions").upsert({
        "affiliate_id": affiliate["id"],
        "referral_id": referral_id,
        "referred_user_id": user_id,
        "lemon_event_id": event_id,
        "lemon_event_name": event_name,
        "lemon_order_id": str(attributes.get("order_id") or (data.get("data") or {}).get("id") or ""),
        "lemon_subscription_id": str(attributes.get("subscription_id") or attributes.get("subscription_item_id") or ""),
        "currency": currency,
        "gross_amount_cents": gross_amount_cents,
        "commission_rate_bps": rate_bps,
        "commission_amount_cents": commission_amount,
        "status": "pending",
        "hold_until": (datetime.now(timezone.utc) + timedelta(days=hold_days)).isoformat(),
    }, on_conflict="lemon_event_id").execute())


async def _handle_affiliate_refund(data: dict, event_id: str) -> None:
    """Claw back and void commissions if an order is refunded via Lemon Squeezy."""
    attributes = (data.get("data") or {}).get("attributes") or {}
    order_id = str(attributes.get("order_id") or (data.get("data") or {}).get("id") or "")
    if not order_id:
        return

    comm_res = await run_db(
        lambda: supabase.table("affiliate_commissions")
        .select("id, affiliate_id, referral_id, status")
        .eq("lemon_order_id", order_id)
        .execute()
    )
    if comm_res.data:
        for comm in comm_res.data:
            await run_db(
                lambda: supabase.table("affiliate_commissions")
                .update({
                    "status": "void",
                    "notes": f"Order {order_id} refunded by Lemon Squeezy (event {event_id})",
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                })
                .eq("id", comm["id"])
                .execute()
            )
            if comm.get("referral_id"):
                await run_db(
                    lambda: supabase.table("affiliate_referrals")
                    .update({
                        "status": "refunded",
                        "updated_at": datetime.now(timezone.utc).isoformat(),
                    })
                    .eq("id", comm["referral_id"])
                    .execute()
                )
            logger.info("Voided commission %s due to order %s refund", comm["id"], order_id)


async def _handle_affiliate_subscription_ended(user_id: str, event_name: str) -> None:
    """Update referral state to cancelled when customer cancels or lets subscription expire."""
    await run_db(
        lambda: supabase.table("affiliate_referrals")
        .update({
            "status": "cancelled",
            "updated_at": datetime.now(timezone.utc).isoformat(),
        })
        .eq("referred_user_id", user_id)
        .execute()
    )




_click_rate_limit: dict[str, list[float]] = {}

@router.post("/api/affiliate/click")
async def record_affiliate_click(request: Request):
    """Record an affiliate link click with bot filtering and deduplication."""
    # 1. Filter Automated Web Crawlers & Bots
    ua = (request.headers.get("user-agent") or "").lower()
    bot_keywords = ("bot", "spider", "crawl", "slurp", "facebookexternalhit", "whatsapp", "meta-externalagent", "discordbot")
    if any(k in ua for k in bot_keywords):
        return {"ok": True, "filtered": "bot"}

    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    referral_code = _clean_referral_code(payload.get("referral_code"))
    if not referral_code:
        raise HTTPException(status_code=400, detail="Invalid referral code")

    client_ip = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
    if not client_ip and request.client:
        client_ip = request.client.host

    # 2. Rate limiting (max 60 clicks per IP per minute)
    now = time.time()
    if client_ip:
        recent = [t for t in _click_rate_limit.get(client_ip, []) if now - t < 60]
        if len(recent) >= 60:
            return {"ok": True, "filtered": "rate_limited"}
        recent.append(now)
        _click_rate_limit[client_ip] = recent

    ip_hash = hashlib.sha256(f"{AFFILIATE_IP_HASH_SALT}:{client_ip}".encode("utf-8")).hexdigest() if client_ip else None

    def _clean_text(value: object, max_len: int = 500) -> str | None:
        if not isinstance(value, str):
            return None
        text = value.strip()
        return text[:max_len] if text else None



    affiliate_res = await run_db(lambda: supabase.table("affiliate_profiles").select(
        "id,status"
    ).eq("referral_code", referral_code).limit(1).execute())
    affiliate = affiliate_res.data[0] if affiliate_res.data else None
    affiliate_id = affiliate.get("id") if affiliate else None
    if affiliate and affiliate.get("status") not in ("active", "pending"):
        raise HTTPException(status_code=404, detail="Affiliate link unavailable")

    # 3. 1-Hour Deduplication (prevent database bloating from refreshing page)
    if ip_hash:
        one_hour_ago = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
        dup_res = await run_db(
            lambda: supabase.table("affiliate_clicks")
            .select("id")
            .eq("referral_code", referral_code)
            .eq("ip_hash", ip_hash)
            .gte("created_at", one_hour_ago)
            .limit(1)
            .execute()
        )
        if dup_res.data:
            return {"ok": True, "deduplicated": True}

    await run_db(lambda: supabase.table("affiliate_clicks").insert({
        "referral_code": referral_code,
        "affiliate_id": affiliate_id,
        "session_id": _clean_text(payload.get("session_id"), 120),
        "landing_page": _clean_text(payload.get("landing_page"), 500),
        "referrer_url": _clean_text(payload.get("referrer_url"), 500),
        "utm_source": _clean_text(payload.get("utm_source"), 160),
        "utm_medium": _clean_text(payload.get("utm_medium"), 160),
        "utm_campaign": _clean_text(payload.get("utm_campaign"), 160),
        "country": _clean_text(request.headers.get("cf-ipcountry") or request.headers.get("x-vercel-ip-country"), 2),
        "ip_hash": ip_hash,
        "user_agent": _clean_text(request.headers.get("user-agent"), 500),
    }).execute())
    return {"ok": True}

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
_WHATSAPP_JOB_QUEUE_URL = os.environ.get("CHATTY_JOB_QUEUE_URL", "").strip()
_whatsapp_job_queue = (
    RedisJobQueue(_WHATSAPP_JOB_QUEUE_URL, stream="chatty:webhooks")
    if _WHATSAPP_JOB_QUEUE_URL else None
)


def _allow_ephemeral_jobs() -> bool:
    return os.environ.get("CHATTY_ALLOW_EPHEMERAL_JOBS", "false").strip().lower() in {
        "1", "true", "yes"
    }


async def _claim_whatsapp_message(bot_id: str, message_id: str | None) -> bool:
    """Atomically-ish claim a Meta message id for idempotent processing.

    Meta retries webhook deliveries aggressively. The unique database key is
    the source of truth; a duplicate insert is treated as an already-claimed
    event and skipped. If an older database has not applied the migration yet,
    processing continues with a warning so upgrades remain backwards-safe.
    """
    if not message_id:
        return True
    try:
        res = await run_db(lambda: supabase.table("chatty_channel_events").insert({
            "channel": "whatsapp",
            "external_event_id": message_id,
            "bot_id": bot_id,
        }).execute())
        if getattr(res, "data", None):
            return True
        logger.info("Skipping duplicate WhatsApp message %s", message_id)
        return False
    except Exception as exc:
        # PostgREST reports the unique conflict as an error. We distinguish it
        # from a missing table so a bad migration cannot silently drop leads.
        text = str(exc).lower()
        if "duplicate" in text or "unique" in text or "23505" in text:
            logger.info("Skipping duplicate WhatsApp message %s", message_id)
            return False
        logger.warning("WhatsApp idempotency store unavailable: %s", exc)
        return True


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


_WHATSAPP_MEDIA_LIMITS = {"image": 5 * 1024 * 1024, "audio": 16 * 1024 * 1024, "document": 25 * 1024 * 1024}
_WHATSAPP_ALLOWED_MIME_PREFIXES = {
    "image": ("image/",),
    "audio": ("audio/",),
    "document": ("application/pdf", "application/msword", "application/vnd.", "text/"),
}


def _is_allowed_whatsapp_media_url(url: str) -> bool:
    parsed = urlparse(url)
    host = (parsed.hostname or "").lower().rstrip(".")
    return parsed.scheme == "https" and (
        host == "graph.facebook.com" or host.endswith(".facebook.com")
        or host.endswith(".fbcdn.net") or host.endswith(".fbsbx.com")
    )


def _media_signature_matches(data: bytes, mime_type: str) -> bool:
    if mime_type == "image/jpeg":
        return data.startswith(b"\xff\xd8\xff")
    if mime_type == "image/png":
        return data.startswith(b"\x89PNG\r\n\x1a\n")
    if mime_type == "image/webp":
        return data[:4] == b"RIFF" and data[8:12] == b"WEBP"
    if mime_type == "application/pdf":
        return data.startswith(b"%PDF-")
    if mime_type in {"audio/ogg", "audio/opus"}:
        return data.startswith(b"OggS")
    if mime_type in {"audio/mpeg", "audio/mp3"}:
        return data.startswith(b"ID3") or data[:2] in (b"\xff\xfb", b"\xff\xf3", b"\xff\xf2")
    if mime_type == "audio/amr":
        return data.startswith(b"#!AMR")
    return True


async def _download_whatsapp_media(media_id: str, access_token: str, media_kind: str) -> tuple[bytes | None, str | None]:
    """Fetch Meta media with host, type, and streaming byte-limit enforcement."""
    if not (media_id and access_token):
        return None, None
    max_bytes = _WHATSAPP_MEDIA_LIMITS.get(media_kind)
    allowed_prefixes = _WHATSAPP_ALLOWED_MIME_PREFIXES.get(media_kind)
    if not max_bytes or not allowed_prefixes:
        return None, None
    meta_url = f"https://graph.facebook.com/{WHATSAPP_API_VERSION}/{media_id}"
    headers = {"Authorization": f"Bearer {access_token}"}
    try:
        async with httpx.AsyncClient(timeout=25) as client:
            res = await ssrf.request_async(client, "GET", meta_url, headers=headers)
            if res.status_code != 200:
                logger.error("Failed to query WhatsApp media %s: %s", media_id, res.text)
                return None, None
            media_data = res.json()
            download_url = media_data.get("url")
            mime_type = (media_data.get("mime_type") or "").split(";")[0].lower().strip()
            if not download_url or not any(mime_type.startswith(prefix) for prefix in allowed_prefixes):
                logger.warning("Rejected WhatsApp media %s with unsupported type %s", media_id, mime_type)
                return None, None
            try:
                if media_data.get("file_size") is not None and int(media_data["file_size"]) > max_bytes:
                    logger.warning("Rejected oversized WhatsApp media %s", media_id)
                    return None, None
            except (TypeError, ValueError):
                pass
            if not _is_allowed_whatsapp_media_url(download_url):
                logger.warning("Rejected WhatsApp media %s from untrusted host", media_id)
                return None, None
            async with ssrf.stream_async(client, "GET", download_url, headers=headers) as dl_res:
                if dl_res.status_code != 200:
                    logger.error("Failed to download WhatsApp media binary %s: %s", media_id, dl_res.status_code)
                    return None, None
                try:
                    if dl_res.headers.get("content-length") is not None and int(dl_res.headers["content-length"]) > max_bytes:
                        logger.warning("Rejected oversized WhatsApp media response %s", media_id)
                        return None, None
                except (TypeError, ValueError):
                    pass
                chunks: list[bytes] = []
                total = 0
                async for chunk in dl_res.aiter_bytes():
                    total += len(chunk)
                    if total > max_bytes:
                        logger.warning("Rejected WhatsApp media exceeding byte cap %s", media_id)
                        return None, None
                    chunks.append(chunk)
                data = b"".join(chunks)
                response_mime = (dl_res.headers.get("content-type") or "").split(";")[0].lower().strip()
                if response_mime and response_mime != "application/octet-stream" and response_mime != mime_type:
                    logger.warning("Rejected WhatsApp media %s due to MIME mismatch", media_id)
                    return None, None
                if not _media_signature_matches(data, mime_type):
                    logger.warning("Rejected WhatsApp media %s due to content signature mismatch", media_id)
                    return None, None
                return data, mime_type
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


_PRODUCT_CARD_RE = re.compile(r"\[PRODUCT_CARD:(\{.*?\})\]", re.DOTALL)


def _render_whatsapp_product_cards(reply: str) -> str:
    """Turn structured product cards into useful WhatsApp text messages."""
    def replace(match: re.Match[str]) -> str:
        try:
            card = json.loads(match.group(1))
        except (TypeError, json.JSONDecodeError):
            return ""
        if not isinstance(card, dict) or not str(card.get("title") or "").strip():
            return ""

        def clean(value: object, limit: int = 240) -> str:
            return re.sub(r"\s+", " ", str(value or "")).strip()[:limit]

        title = clean(card.get("title"))
        currency = clean(card.get("currency") or "USD", 12)
        price = clean(card.get("price"), 40)
        variant = clean(card.get("variant_sku") or card.get("variant_id"), 80)
        in_stock = card.get("in_stock")
        if in_stock is None:
            in_stock = str(card.get("stock_status") or "instock").lower() == "instock"
        lines = [f"🛍️ *{title}*"]
        if variant:
            lines.append(f"Variant: {variant}")
        if price:
            lines.append(f"Price: {currency} {price}")
        lines.append("✅ In stock" if bool(in_stock) else "❌ Out of stock")
        url = clean(card.get("url"), 500)
        if re.match(r"^https://", url, re.IGNORECASE):
            lines.append(f"🔗 {url}")
        return "\n".join(lines)

    rendered = _PRODUCT_CARD_RE.sub(replace, reply or "")
    return rendered.strip()


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

    # WhatsApp bypasses the browser widget routes, so explicitly maintain the
    # session row used by inbox, SLA, and analytics.
    await _upsert_session(
        bot_id,
        session_id,
        display_content or "[empty message]",
        channel="whatsapp",
    )

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

    # Intercept booking widget marker or explicit scheduling requests. Any URL
    # generated by the model is treated as stale: it may use a legacy host or
    # lack the phone-bound HMAC, so the webhook always replaces it with the
    # canonical, signed Chatty booking URL below.
    booking_marker = "[BOOKING_WIDGET]"
    has_booking_link = bool(re.search(r"https?://[^\s)]+/book/[^\s)]+", reply, re.IGNORECASE))
    wants_booking = (
        booking_marker in reply
        or has_booking_link
        or (
            bot.get("calendar_scheduling_enabled")
            and re.search(r"\b(book|booking|schedule|appointment|demo)\b", text, re.IGNORECASE)
            and not has_booking_link
            and not any(k in reply for k in ("meet.google.com", "teams.microsoft.com"))
        )
    )

    if wants_booking:
        secret = get_bot_whatsapp_secret(bot)
        booking_url, _, _ = build_whatsapp_booking_url(bot_id=bot_id, phone=frm, secret=secret)
        # Remove a model-supplied booking CTA before adding the signed one.
        reply = re.sub(
            r"(?:📅\s*)?(?:\*{0,2})schedule your appointment here:(?:\*{0,2})\s*"
            r"https?://[^\s)]+/book/[^\s)]+"
            r"(?:\s*_?tap the link to choose your preferred date & time slot\.?_?)?",
            "",
            reply,
            flags=re.IGNORECASE,
        ).strip()
        booking_cta = (
            f"\n\n📅 *Schedule your appointment here:*\n"
            f"{booking_url}\n\n"
            f"_Tap the link to choose your preferred date & time slot._"
        )
        if booking_marker in reply:
            reply = reply.replace(booking_marker, "").strip() + booking_cta
        elif not any(x in reply for x in ("meet.google.com", "teams.microsoft.com")):
            reply = reply.strip() + booking_cta
    else:
        # Strip booking marker if leftover
        reply = reply.replace(booking_marker, "").strip()

    reply = _render_whatsapp_product_cards(reply)

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


async def _dispatch_whatsapp_message(
    phone_number_id: str,
    msg: dict[str, object],
    bot: dict[str, object],
    owner_user: dict[str, object],
    access_token: str,
) -> None:
    """Decode one Meta message and run the existing multimodal handler."""
    frm = str(msg.get("from") or "")
    msg_type = msg.get("type")
    if msg_type == "text":
        await _handle_whatsapp_message(
            phone_number_id, frm, bot, owner_user, access_token,
            text=str((msg.get("text") or {}).get("body") or ""),
        )
    elif msg_type == "interactive":
        interactive = msg.get("interactive") or {}
        btn_reply = interactive.get("button_reply") or {}
        list_reply = interactive.get("list_reply") or {}
        button_text = btn_reply.get("title") or list_reply.get("title") or ""
        if button_text:
            await _handle_whatsapp_message(
                phone_number_id, frm, bot, owner_user, access_token, text=str(button_text)
            )
    elif msg_type in ("audio", "voice", "image", "document"):
        media_obj = msg.get("audio") or msg.get("voice") or msg.get("image") or msg.get("document") or {}
        media_id = media_obj.get("id")
        if not media_id:
            return
        media_kind = "audio" if msg_type in ("audio", "voice") else str(msg_type)
        media_bytes, media_mime = await _download_whatsapp_media(str(media_id), access_token, media_kind)
        if not media_bytes:
            return
        clean_mime = (media_mime or ("audio/ogg" if media_kind == "audio" else "application/pdf")).split(";")[0]
        await _handle_whatsapp_message(
            phone_number_id,
            frm,
            bot,
            owner_user,
            access_token,
            text=str(media_obj.get("caption") or ""),
            media_bytes=media_bytes,
            media_mime=clean_mime,
            media_filename=(
                "voice_note.ogg" if media_kind == "audio"
                else "photo.jpg" if media_kind == "image"
                else str(media_obj.get("filename") or "document.pdf")
            ),
        )


async def process_whatsapp_job(payload: dict[str, object]) -> None:
    """Resolve credentials and process one queue-backed WhatsApp message."""
    bot_id = str(payload.get("bot_id") or "").strip()
    phone_number_id = str(payload.get("phone_number_id") or "").strip()
    message = payload.get("message")
    if not bot_id or not phone_number_id or not isinstance(message, dict):
        raise ValueError("WhatsApp job is missing bot, phone number, or message")
    bot_res = await run_db(lambda: supabase.table("chatty_bots").select("*").eq("id", bot_id).limit(1).execute())
    if not bot_res.data:
        raise ValueError("WhatsApp bot no longer exists")
    bot = bot_res.data[0]
    access_token = decrypt_secret(bot.get("whatsapp_access_token") or "") or WHATSAPP_ACCESS_TOKEN
    if not access_token:
        raise RuntimeError("WhatsApp access token is not configured")
    owner_res = await run_db(lambda: supabase.table("users").select("*").eq("auth_user_id", bot["user_id"]).limit(1).execute())
    if not owner_res.data:
        raise ValueError("WhatsApp bot owner no longer exists")
    await _dispatch_whatsapp_message(phone_number_id, message, bot, owner_res.data[0], access_token)


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
            if not app_secret:
                logger.error("WhatsApp webhook signature verification is not configured for bot %s", bot["id"])
                raise HTTPException(status_code=503, detail="WhatsApp webhook signature verification is not configured")
            if not _verify_meta_signature(raw_body, sig_header, app_secret):
                logger.warning("WhatsApp webhook invalid HMAC signature for bot %s", bot["id"])
                raise HTTPException(status_code=401, detail="Invalid signature")

            # Resolve Access Token
            access_token = decrypt_secret(bot.get("whatsapp_access_token") or "") or WHATSAPP_ACCESS_TOKEN
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

            # Process each message. Queue publication precedes claiming so a
            # transient Redis failure remains retryable by Meta.
            for msg in val.get("messages", []):
                message_id = str(msg.get("id") or "")
                if _whatsapp_job_queue:
                    if not message_id:
                        message_id = hashlib.sha256(json.dumps(msg, sort_keys=True).encode("utf-8")).hexdigest()
                    await _whatsapp_job_queue.enqueue(
                        name="whatsapp.message",
                        payload={
                            "bot_id": bot["id"],
                            "phone_number_id": pnid,
                            "message": msg,
                            "concurrency_key": f"whatsapp:{bot['id']}:{msg.get('from') or 'unknown'}",
                        },
                        idempotency_key=f"whatsapp.message:{bot['id']}:{message_id}",
                    )
                    if not await _claim_whatsapp_message(bot["id"], msg.get("id")):
                        continue
                else:
                    if not _allow_ephemeral_jobs():
                        raise HTTPException(status_code=503, detail="Durable job queue is required for WhatsApp webhooks")
                    if not await _claim_whatsapp_message(bot["id"], msg.get("id")):
                        continue
                    await _dispatch_whatsapp_message(pnid, msg, bot, owner_user, access_token)

    return {"ok": True}



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
    user_id = custom_data.get("user_id") or custom_data.get("auth_user_id")
    event_id = _lemon_event_id(data, event_name)
    attributes = data.get("data", {}).get("attributes", {})
    variant_id = str(attributes.get("variant_id", ""))
    plan_name = LEMON_VARIANT_TO_PLAN.get(variant_id, "hobby")

    logger.info("Lemon Squeezy webhook event %s for user %s, variant %s -> plan %s", event_name, user_id, variant_id, plan_name)


    try:
        await run_db(lambda: supabase.table("lemon_events").upsert({
            "event_id": event_id,
            "event_name": event_name,
            "raw": data,
            "processed_at": datetime.now(timezone.utc).isoformat()
        }, on_conflict="event_id").execute())
    except Exception:
        logger.exception("Failed to record Lemon Squeezy event %s", event_id)

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

    if user_id and event_name in ("order_created", "subscription_created", "subscription_payment_success"):
        try:
            await _record_affiliate_conversion(data, event_name, user_id, event_id)
        except Exception as e:
            logger.exception("Failed to record affiliate conversion for event %s: %s", event_id, e)

    if event_name == "order_refunded":
        try:
            await _handle_affiliate_refund(data, event_id)
        except Exception as e:
            logger.exception("Failed to process affiliate refund for event %s: %s", event_id, e)

    if user_id and event_name in ("subscription_cancelled", "subscription_expired"):
        try:
            await _handle_affiliate_subscription_ended(user_id, event_name)
        except Exception as e:
            logger.exception("Failed to update affiliate subscription state for %s: %s", user_id, e)

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
