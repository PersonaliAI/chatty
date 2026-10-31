"""Inbound channel webhooks: WhatsApp, Lemon Squeezy billing (/webhook/*)."""

from __future__ import annotations

import asyncio
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
from app.services import billing_email_service
from app.services.chatty_quota_service import chatty_quota_exceeded, usage_units_for_message
from app.services.widget_session_service import upsert_session as _upsert_session
from app.services.whatsapp_service import (
    build_whatsapp_booking_url,
    get_bot_whatsapp_secret,
    send_whatsapp_message,
)
from app.services.omnichannel import (
    ChannelType,
    InboundMessage,
    OmnichannelPipeline,
    download_telegram_file,
    extract_telegram_media,
    find_bot_by_omnichannel_field,
    normalize_email_message,
    normalize_instagram_message,
    normalize_sms_webhook,
    normalize_telegram_update,
    normalize_tiktok_message,
    unpack_omnichannel_bot_row,
    verify_email_webhook_secret,
    verify_instagram_signature,
    verify_telegram_secret,
    verify_tiktok_signature,
    verify_twilio_signature,
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
        logger.info("Affiliate conversion skipped: referral code was not found")
        return

    affiliate = affiliate_res.data[0]
    if affiliate.get("status") != "active":
        logger.info("Affiliate conversion skipped: referral code is inactive")
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
        logger.warning("Blocked self-referral attempt")
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
                    logger.info("Affiliate recurring window expired (>365 days)")
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
        logger.info("Voided commission due to order refund")


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


_CLAIMED_IN_FLIGHT_EVENTS: dict[str, float] = {}

def _check_and_mark_in_flight(key: str, ttl_seconds: float = 120.0) -> bool:
    """Returns True if claimed, False if already in flight (duplicate retry)."""
    now = time.time()
    expired = [k for k, exp in _CLAIMED_IN_FLIGHT_EVENTS.items() if exp < now]
    for k in expired:
        _CLAIMED_IN_FLIGHT_EVENTS.pop(k, None)

    if key in _CLAIMED_IN_FLIGHT_EVENTS:
        return False
    _CLAIMED_IN_FLIGHT_EVENTS[key] = now + ttl_seconds
    return True

async def _claim_channel_event(channel: str, bot_id: str, external_event_id: str | None) -> bool:
    """Atomically claim a channel message/update id for idempotent processing.

    Uses in-memory fast-claim to reject concurrent in-flight retries instantly,
    and durable database persistence in chatty_channel_events.
    """
    if not external_event_id:
        return True

    safe_event_id = str(external_event_id).replace("\r", "").replace("\n", "")[:100]
    claim_key = f"{channel}:{bot_id}:{safe_event_id}"
    if not _check_and_mark_in_flight(claim_key, ttl_seconds=120.0):
        logger.info("Skipping in-flight duplicate %s event %s", channel, safe_event_id)
        return False

    try:
        res = await run_db(lambda: supabase.table("chatty_channel_events").insert({
            "channel": channel,
            "external_event_id": str(external_event_id),
            "bot_id": bot_id,
        }).execute())
        if getattr(res, "data", None):
            return True
        logger.info("Skipping duplicate %s event %s", channel, safe_event_id)
        return False
    except Exception as exc:
        text = str(exc).lower()
        if "duplicate" in text or "unique" in text or "23505" in text:
            logger.info("Skipping duplicate %s event %s", channel, safe_event_id)
            return False
        logger.warning("%s idempotency store unavailable", channel, exc_info=True)
        return True

async def _claim_whatsapp_message(bot_id: str, message_id: str | None) -> bool:
    return await _claim_channel_event("whatsapp", bot_id, message_id)


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
                logger.error("Failed to query WhatsApp media")
                return None, None
            media_data = res.json()
            download_url = media_data.get("url")
            mime_type = (media_data.get("mime_type") or "").split(";")[0].lower().strip()
            if not download_url or not any(mime_type.startswith(prefix) for prefix in allowed_prefixes):
                logger.warning("Rejected WhatsApp media with unsupported type")
                return None, None
            try:
                if media_data.get("file_size") is not None and int(media_data["file_size"]) > max_bytes:
                    logger.warning("Rejected oversized WhatsApp media")
                    return None, None
            except (TypeError, ValueError):
                pass
            if not _is_allowed_whatsapp_media_url(download_url):
                logger.warning("Rejected WhatsApp media from untrusted host")
                return None, None
            async with ssrf.stream_async(client, "GET", download_url, headers=headers) as dl_res:
                if dl_res.status_code != 200:
                    logger.error("Failed to download WhatsApp media binary")
                    return None, None
                try:
                    if dl_res.headers.get("content-length") is not None and int(dl_res.headers["content-length"]) > max_bytes:
                        logger.warning("Rejected oversized WhatsApp media response")
                        return None, None
                except (TypeError, ValueError):
                    pass
                chunks: list[bytes] = []
                total = 0
                async for chunk in dl_res.aiter_bytes():
                    total += len(chunk)
                    if total > max_bytes:
                        logger.warning("Rejected WhatsApp media exceeding byte cap")
                        return None, None
                    chunks.append(chunk)
                data = b"".join(chunks)
                response_mime = (dl_res.headers.get("content-type") or "").split(";")[0].lower().strip()
                if response_mime and response_mime not in ("application/octet-stream", "binary/octet-stream", "application/binary", "application/x-binary"):
                    if response_mime != mime_type and response_mime.split("/")[0] != mime_type.split("/")[0]:
                        logger.warning("Rejected WhatsApp media due to MIME mismatch: %s vs %s", response_mime, mime_type)
                        return None, None
                if not _media_signature_matches(data, mime_type):
                    logger.info("WhatsApp media magic bytes mismatch; proceeding with cautious MIME check")
                return data, mime_type
    except Exception:
        logger.exception("Exception downloading WhatsApp media")
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


_PRODUCT_CARD_MARKER = "[PRODUCT_CARD:"
_ORDER_CARD_MARKER = "[ORDER_CARD:"


def _render_whatsapp_order_cards(reply: str) -> str:
    """Turn structured [ORDER_CARD:{...}] tokens into rich WhatsApp text messages."""
    def render_order(card: object) -> str:
        if not isinstance(card, dict) or not (card.get("order_number") or card.get("order_id")):
            return ""

        def clean(value: object, limit: int = 240) -> str:
            return re.sub(r"\s+", " ", str(value or "")).strip()[:limit]

        order_num = clean(card.get("order_number") or card.get("order_id"), 40)
        status_label = clean(card.get("status_label") or card.get("status") or "Processing", 60)
        currency = clean(card.get("currency") or "USD", 12)
        total = clean(card.get("total"), 40)
        lines = [f"📦 *Order #{order_num}* — *{status_label}*"]
        if total:
            lines.append(f"Total: {currency} {total}")

        if card.get("is_split_shipment"):
            lines.append("⚠️ *Split Shipment:* Items are shipping in multiple packages.")
        if card.get("is_partial_refund"):
            refunded = clean(card.get("refunded_total"), 40)
            lines.append(f"⚠️ *Partial Refund Issued:* {currency} {refunded}")

        items = card.get("items")
        if isinstance(items, list) and items:
            item_strs = []
            for it in items[:5]:
                if isinstance(it, dict) and it.get("name"):
                    qty = it.get("quantity") or 1
                    item_strs.append(f"• {qty}× {clean(it.get('name'), 80)}")
            if item_strs:
                lines.append("Items:\n" + "\n".join(item_strs))

        tracking = card.get("tracking")
        if isinstance(tracking, list) and tracking:
            for trk in tracking[:4]:
                if not isinstance(trk, dict):
                    continue
                carrier = clean(trk.get("carrier") or "Carrier", 60)
                tnum = clean(trk.get("tracking_number"), 80)
                turl = clean(trk.get("tracking_url"), 500)
                if tnum:
                    lines.append(f"🚚 *{carrier}:* `{tnum}`")
                if re.match(r"^https://", turl, re.IGNORECASE):
                    lines.append(f"🔗 Track package: {turl}")

        return "\n".join(lines)

    source = reply or ""
    rendered: list[str] = []
    cursor = 0
    decoder = json.JSONDecoder()
    while True:
        marker_start = source.find(_ORDER_CARD_MARKER, cursor)
        if marker_start < 0:
            rendered.append(source[cursor:])
            break
        rendered.append(source[cursor:marker_start])
        json_start = marker_start + len(_ORDER_CARD_MARKER)
        try:
            card, consumed = decoder.raw_decode(source[json_start:])
        except (TypeError, json.JSONDecodeError):
            rendered.append(_ORDER_CARD_MARKER)
            cursor = json_start
            continue
        closing_index = json_start + consumed
        if closing_index >= len(source) or source[closing_index] != "]":
            rendered.append(_ORDER_CARD_MARKER)
            cursor = json_start
            continue
        rendered.append(render_order(card))
        cursor = closing_index + 1
    return "".join(rendered).strip()


def _render_whatsapp_product_cards(reply: str) -> str:
    """Turn structured product cards into useful WhatsApp text messages."""
    def render_card(card: object) -> str:
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

    source = reply or ""
    rendered: list[str] = []
    cursor = 0
    decoder = json.JSONDecoder()
    while True:
        marker_start = source.find(_PRODUCT_CARD_MARKER, cursor)
        if marker_start < 0:
            rendered.append(source[cursor:])
            break
        rendered.append(source[cursor:marker_start])
        json_start = marker_start + len(_PRODUCT_CARD_MARKER)
        try:
            card, consumed = decoder.raw_decode(source[json_start:])
        except (TypeError, json.JSONDecodeError):
            rendered.append(_PRODUCT_CARD_MARKER)
            cursor = json_start
            continue
        closing_index = json_start + consumed
        if closing_index >= len(source) or source[closing_index] != "]":
            rendered.append(_PRODUCT_CARD_MARKER)
            cursor = json_start
            continue
        rendered.append(render_card(card))
        cursor = closing_index + 1
    return "".join(rendered).strip()


_omnichannel_pipeline = OmnichannelPipeline()


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
    inbound = InboundMessage(
        channel=ChannelType.WHATSAPP,
        sender_id=frm,
        recipient_id=phone_number_id,
        session_id=f"wa:{frm}",
        message_id="",
        text=text,
        media_bytes=media_bytes,
        media_mime=media_mime,
        media_filename=media_filename,
    )
    await _omnichannel_pipeline.process_inbound(
        message=inbound,
        bot=bot,
        owner_user=owner_user,
        access_token=access_token,
    )


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
    elif msg_type == "button":
        button_payload = msg.get("button") or {}
        button_text = button_payload.get("text") or button_payload.get("payload") or ""
        if button_text:
            await _handle_whatsapp_message(
                phone_number_id, frm, bot, owner_user, access_token, text=str(button_text)
            )
    elif msg_type == "location":
        loc = msg.get("location") or {}
        lat, lon = loc.get("latitude"), loc.get("longitude")
        name = loc.get("name") or "Shared Location"
        loc_text = f"📍 {name}: https://maps.google.com/?q={lat},{lon}"
        await _handle_whatsapp_message(
            phone_number_id, frm, bot, owner_user, access_token, text=loc_text
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
                logger.debug("No bot linked to WhatsApp phone number")
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
                # Enterprise Outbox: Idempotency & Deduplication
                try:
                    if message_id:
                        from app.services.enterprise.event_log_service import EventLogService
                        is_dup, _ = await EventLogService.record_event(
                            channel="whatsapp",
                            external_id=message_id,
                            bot_id=bot["id"],
                            payload={"phone_number_id": pnid, "from": msg.get("from"), "type": msg.get("type")},
                        )
                        if is_dup:
                            logger.info("WhatsApp duplicate message %s suppressed by enterprise event log", message_id)
                            continue
                except Exception:
                    logger.debug("Enterprise event log recording skipped for whatsapp webhook", exc_info=True)
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

    logger.info("Lemon Squeezy webhook event received")


    try:
        await run_db(lambda: supabase.table("lemon_events").upsert({
            "event_id": event_id,
            "event_name": event_name,
            "raw": data,
            "processed_at": datetime.now(timezone.utc).isoformat()
        }, on_conflict="event_id").execute())
    except Exception:
        logger.exception("Failed to record Lemon Squeezy event")

    if user_id and event_name in ("order_created", "subscription_created", "subscription_updated"):
        try:
            await run_db(lambda: supabase.table("user_subscriptions").upsert({
                "user_id": user_id,
                "plan": plan_name,
                "variant_id": variant_id,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }).execute())
        except Exception:
            logger.exception("Failed to record subscription update")

    # Keep users table subscription status, plan, and renewal timestamps in sync
    if user_id:
        try:
            status_attr = str(attributes.get("status") or "").strip().lower()
            if not status_attr:
                if event_name in ("subscription_cancelled", "subscription_expired"):
                    status_attr = "cancelled"
                elif event_name in ("subscription_paused", "subscription_unpaid"):
                    status_attr = "paused"
                elif event_name in ("subscription_payment_failed",):
                    status_attr = "past_due"
                elif event_name in ("subscription_created", "subscription_updated", "subscription_payment_success", "order_created"):
                    status_attr = "active"

            user_updates: dict[str, Any] = {
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
            if status_attr:
                user_updates["subscription_status"] = status_attr
            if variant_id:
                user_updates["subscription_variant_id"] = variant_id
                user_updates["plan"] = f"chatty_{plan_name}"
            renews = attributes.get("renews_at") or attributes.get("ends_at")
            if renews:
                user_updates["subscription_renews_at"] = renews
            cust_id = str(attributes.get("customer_id") or "")
            if cust_id:
                user_updates["lemon_customer_id"] = cust_id
            sub_id = str(attributes.get("subscription_id") or (data.get("data") or {}).get("id") or "")
            if sub_id:
                user_updates["lemon_subscription_id"] = sub_id

            await run_db(lambda: supabase.table("users").update(user_updates).eq("auth_user_id", user_id).execute())
        except Exception:
            logger.exception("Failed to sync users table on Lemon Squeezy event")

    if user_id and event_name in ("order_created", "subscription_created", "subscription_payment_success"):
        try:
            await _record_affiliate_conversion(data, event_name, user_id, event_id)
        except Exception:
            logger.exception("Failed to record affiliate conversion")

    if event_name == "order_refunded":
        try:
            await _handle_affiliate_refund(data, event_id)
        except Exception:
            logger.exception("Failed to process affiliate refund")

    if user_id and event_name in ("subscription_cancelled", "subscription_expired"):
        try:
            await _handle_affiliate_subscription_ended(user_id, event_name)
        except Exception:
            logger.exception("Failed to update affiliate subscription state")

    # Dispatch professional transactional billing emails for payment/subscription changes
    if user_id:
        try:
            resolved_email = str(attributes.get("user_email") or attributes.get("customer_email") or "").strip().lower()
            resolved_name = str(attributes.get("user_name") or attributes.get("customer_name") or "").strip()
            if not resolved_email:
                u_res = await run_db(lambda: supabase.table("users").select("email,display_name").eq("auth_user_id", user_id).limit(1).execute())
                if u_res.data:
                    resolved_email = str(u_res.data[0].get("email") or "").strip().lower()
                    if not resolved_name:
                        resolved_name = str(u_res.data[0].get("display_name") or "").strip()

            if resolved_email and "@" in resolved_email:
                urls = attributes.get("urls", {}) or {}
                renews_str = str(attributes.get("renews_at") or attributes.get("ends_at") or "")
                ends_str = str(attributes.get("ends_at") or attributes.get("renews_at") or "")
                amount_str = str(attributes.get("total_formatted") or attributes.get("subtotal_formatted") or "")
                receipt_link = str(urls.get("receipt") or attributes.get("receipt_url") or "")
                update_link = str(urls.get("update_payment_method") or attributes.get("update_payment_method_url") or "")

                if event_name in ("subscription_created", "order_created"):
                    asyncio.create_task(billing_email_service.send_subscription_activated_email(
                        user_id=user_id,
                        email=resolved_email,
                        name=resolved_name,
                        plan_name=plan_name,
                        renews_at=renews_str,
                    ))
                elif event_name == "subscription_payment_success":
                    asyncio.create_task(billing_email_service.send_payment_success_email(
                        user_id=user_id,
                        email=resolved_email,
                        name=resolved_name,
                        plan_name=plan_name,
                        amount_formatted=amount_str,
                        renews_at=renews_str,
                        receipt_url=receipt_link,
                    ))
                elif event_name in ("subscription_payment_failed", "subscription_unpaid"):
                    asyncio.create_task(billing_email_service.send_payment_failed_email(
                        user_id=user_id,
                        email=resolved_email,
                        name=resolved_name,
                        plan_name=plan_name,
                        update_url=update_link,
                    ))
                elif event_name in ("subscription_cancelled", "subscription_expired"):
                    asyncio.create_task(billing_email_service.send_subscription_cancelled_email(
                        user_id=user_id,
                        email=resolved_email,
                        name=resolved_name,
                        plan_name=plan_name,
                        ends_at=ends_str,
                    ))
                elif event_name == "subscription_paused":
                    asyncio.create_task(billing_email_service.send_subscription_paused_email(
                        user_id=user_id,
                        email=resolved_email,
                        name=resolved_name,
                        plan_name=plan_name,
                    ))
                elif event_name == "subscription_resumed":
                    asyncio.create_task(billing_email_service.send_subscription_resumed_email(
                        user_id=user_id,
                        email=resolved_email,
                        name=resolved_name,
                        plan_name=plan_name,
                    ))
        except Exception:
            clean_event = str(event_name or "").replace("\r", "").replace("\n", "")[:64]
            logger.exception("Failed to dispatch billing transactional email on %s", clean_event)

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
        logger.warning("resend_inbound: no meeting found")
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
        logger.exception("Failed to record inbound meeting reply")
        raise HTTPException(status_code=500, detail="Failed to record message")

    # Auto-reply using the same scheduling tools the widget uses (real
    # availability, real reschedule) - best-effort, logged not raised, so a
    # broken auto-reply never turns into a failed webhook delivery/retry.
    from plugins.agent_tools import handle_meeting_email_reply
    await handle_meeting_email_reply(supabase, meeting, from_email)

    return {"ok": True, "matched": True}


# ---------------------------------------------------------------------------
# Instagram DM & Facebook Messenger Channel (Meta Graph API)
# ---------------------------------------------------------------------------
INSTAGRAM_VERIFY_TOKEN = os.environ.get("INSTAGRAM_VERIFY_TOKEN", "") or WHATSAPP_VERIFY_TOKEN
INSTAGRAM_APP_SECRET = os.environ.get("INSTAGRAM_APP_SECRET", "") or WHATSAPP_APP_SECRET
MESSENGER_VERIFY_TOKEN = os.environ.get("MESSENGER_VERIFY_TOKEN", "") or INSTAGRAM_VERIFY_TOKEN
MESSENGER_APP_SECRET = os.environ.get("MESSENGER_APP_SECRET", "") or INSTAGRAM_APP_SECRET


@router.get("/webhook/instagram")
@router.get("/webhook/messenger")
async def instagram_or_messenger_verify(request: Request):
    """Meta webhook verification handshake for Instagram DMs and Facebook Messenger."""
    p = request.query_params
    mode = p.get("hub.mode")
    token = p.get("hub.verify_token")
    challenge = p.get("hub.challenge")

    if mode != "subscribe" or not token:
        raise HTTPException(status_code=403, detail="Invalid verification request")

    if token in {t for t in (INSTAGRAM_VERIFY_TOKEN, MESSENGER_VERIFY_TOKEN) if t}:
        return PlainTextResponse(challenge or "")

    try:
        bot_ig = await find_bot_by_omnichannel_field(supabase, "instagram_verify_token", token)
        if bot_ig:
            return PlainTextResponse(challenge or "")
        bot_fb = await find_bot_by_omnichannel_field(supabase, "messenger_verify_token", token)
        if bot_fb:
            return PlainTextResponse(challenge or "")
    except Exception:
        logger.exception("Error verifying per-bot instagram/messenger token")

    raise HTTPException(status_code=403, detail="Verification token mismatch")


@router.post("/webhook/instagram")
@router.post("/webhook/messenger")
async def instagram_receive(request: Request):
    """Inbound Instagram DMs & Facebook Messenger webhook handler."""
    raw_body = await request.body()
    sig_header = request.headers.get("x-hub-signature-256", "")
    is_messenger_route = request.url.path.endswith("/messenger")

    try:
        body = json.loads(raw_body.decode("utf-8")) if raw_body else {}
    except Exception:
        return {"ok": True}

    entries = body.get("entry", [])
    for entry in entries:
        page_id = str(entry.get("id") or "").strip()
        bot = None
        if page_id:
            if is_messenger_route:
                bot = await find_bot_by_omnichannel_field(supabase, "messenger_page_id", page_id)
            if not bot:
                bot = await find_bot_by_omnichannel_field(supabase, "instagram_page_id", page_id)
            if not bot and not is_messenger_route:
                bot = await find_bot_by_omnichannel_field(supabase, "messenger_page_id", page_id)
            if not bot:
                bot = await find_bot_by_omnichannel_field(supabase, "whatsapp_phone_number_id", page_id)

        if not bot:
            res = await run_db(lambda: supabase.table("chatty_bots").select("*").limit(1).execute())
            if not res.data:
                continue
            bot = unpack_omnichannel_bot_row(res.data[0])

        obj_type = str(body.get("object") or "").lower()
        is_instagram = (not is_messenger_route) and (entry.get("messaging") is None or "instagram" in obj_type)

        raw_secret = (
            (bot.get("instagram_app_secret") if is_instagram else (bot.get("messenger_app_secret") or bot.get("instagram_app_secret")))
            or bot.get("whatsapp_app_secret")
            or (INSTAGRAM_APP_SECRET if is_instagram else MESSENGER_APP_SECRET)
        )
        app_secret = decrypt_secret(str(raw_secret or "")) if raw_secret else ""
        if app_secret and not verify_instagram_signature(raw_body, sig_header, app_secret):
            raise HTTPException(status_code=401, detail="Invalid signature")

        raw_token = (
            (bot.get("instagram_access_token") if is_instagram else (bot.get("messenger_access_token") or bot.get("instagram_access_token")))
            or bot.get("whatsapp_access_token")
            or WHATSAPP_ACCESS_TOKEN
        )
        access_token = decrypt_secret(str(raw_token or ""))
        owner_res = await run_db(lambda: supabase.table("users").select("*").eq("auth_user_id", bot["user_id"]).limit(1).execute())
        if not owner_res.data:
            continue
        owner_user = owner_res.data[0]

        for messaging_event in (entry.get("messaging") or entry.get("standby") or []):
            msg = messaging_event.get("message") or {}
            attachments = msg.get("attachments") or []
            media_bytes = None
            media_mime = None
            media_filename = None
            if attachments and isinstance(attachments, list):
                att = attachments[0]
                att_type = str(att.get("type") or "media")
                att_url = (att.get("payload") or {}).get("url")
                if att_url and isinstance(att_url, str) and att_url.startswith(("http://", "https://")):
                    safe_att_url = att_url.replace("\r", "").replace("\n", "")[:200]
                    try:
                        await ssrf.assert_safe_url_async(att_url)
                        async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
                            m_resp = await ssrf.request_async(client, "GET", att_url)
                            if m_resp.status_code == 200 and len(m_resp.content) <= 20 * 1024 * 1024:
                                media_bytes = m_resp.content
                                media_mime = m_resp.headers.get("content-type", "").split(";")[0].strip() or ("image/jpeg" if att_type == "image" else None)
                                media_filename = "photo.jpg" if att_type == "image" else "voice.ogg" if att_type == "audio" else "attachment.bin"
                    except Exception:
                        logger.warning("Failed to download Meta attachment from %s", safe_att_url, exc_info=True)

            inbound = normalize_instagram_message(
                messaging_event,
                is_instagram=is_instagram,
                media_bytes=media_bytes,
                media_mime=media_mime,
                media_filename=media_filename,
            )
            if inbound:
                await _omnichannel_pipeline.process_inbound(
                    message=inbound,
                    bot=bot,
                    owner_user=owner_user,
                    access_token=access_token or "",
                )

    return {"ok": True}


# ---------------------------------------------------------------------------
# TikTok Business Messaging Channel (TikTok Open API v2)
# ---------------------------------------------------------------------------
TIKTOK_VERIFY_TOKEN = os.environ.get("TIKTOK_VERIFY_TOKEN", "")
TIKTOK_CLIENT_SECRET = os.environ.get("TIKTOK_CLIENT_SECRET", "")


@router.get("/webhook/tiktok")
async def tiktok_verify(request: Request):
    """TikTok Developer / Business webhook verification handshake."""
    p = request.query_params
    challenge = p.get("challenge") or p.get("hub.challenge") or p.get("echostr") or ""
    token = p.get("verify_token") or p.get("hub.verify_token") or p.get("token") or ""

    if not token and challenge:
        # TikTok Business webhooks sometimes send only `?challenge=<str>` on GET verification
        return PlainTextResponse(challenge)

    if TIKTOK_VERIFY_TOKEN and token == TIKTOK_VERIFY_TOKEN:
        return PlainTextResponse(challenge)

    try:
        bot = await find_bot_by_omnichannel_field(supabase, "tiktok_verify_token", token)
        if bot:
            return PlainTextResponse(challenge)
    except Exception:
        logger.exception("Error verifying per-bot TikTok token")

    raise HTTPException(status_code=403, detail="TikTok verification token mismatch")


@router.post("/webhook/tiktok")
async def tiktok_receive(request: Request):
    """Inbound TikTok Business Messaging webhook with HMAC-SHA256 verification."""
    raw_body = await request.body()
    sig_header = (
        request.headers.get("tiktok-signature")
        or request.headers.get("x-tiktok-signature")
        or ""
    )

    try:
        payload = json.loads(raw_body.decode("utf-8")) if raw_body else {}
    except Exception:
        return {"ok": True}

    # Respond immediately to TikTok POST URL verification challenges
    if isinstance(payload, dict) and payload.get("challenge") and not payload.get("event") and not payload.get("content") and not payload.get("data"):
        return {"challenge": payload["challenge"]}

    content_obj = {}
    if isinstance(payload.get("content"), str):
        try:
            content_obj = json.loads(payload["content"])
        except Exception:
            pass
    elif isinstance(payload.get("content"), dict):
        content_obj = payload["content"]
    data_obj = payload.get("data") if isinstance(payload.get("data"), dict) else {}
    msg_obj = data_obj.get("message") or content_obj.get("message") or payload.get("message") or {}
    if not isinstance(msg_obj, dict):
        msg_obj = {}
    media_url = str(msg_obj.get("media_url") or msg_obj.get("image_url") or content_obj.get("media_url") or "").strip()
    media_bytes = None
    media_mime = None
    media_filename = None
    if media_url:
        try:
            from app.services.omnichannel.tiktok_adapter import download_tiktok_media
            media_bytes, media_mime = await download_tiktok_media(media_url)
            if media_bytes:
                media_filename = "tiktok_media.jpg"
        except Exception:
            logger.warning("Failed to download TikTok media", exc_info=True)

    inbound = normalize_tiktok_message(
        payload,
        media_bytes=media_bytes,
        media_mime=media_mime,
        media_filename=media_filename,
    )
    if not inbound:
        return {"ok": True}

    bot_id_param = request.query_params.get("bot_id", "").strip()
    bot = None
    if bot_id_param:
        res = await run_db(lambda: supabase.table("chatty_bots").select("*").eq("id", bot_id_param).limit(1).execute())
        if res.data:
            bot = unpack_omnichannel_bot_row(res.data[0])
    if not bot and inbound.recipient_id:
        bot = await find_bot_by_omnichannel_field(supabase, "tiktok_business_id", inbound.recipient_id)
        if not bot:
            bot = await find_bot_by_omnichannel_field(supabase, "tiktok_open_id", inbound.recipient_id)
    if not bot:
        res = await run_db(lambda: supabase.table("chatty_bots").select("*").limit(1).execute())
        if not res.data:
            return {"ok": True}
        bot = unpack_omnichannel_bot_row(res.data[0])

    raw_secret = bot.get("tiktok_client_secret") or TIKTOK_CLIENT_SECRET
    client_secret = decrypt_secret(str(raw_secret or "")) if raw_secret else ""
    if client_secret and not verify_tiktok_signature(raw_body, sig_header, client_secret):
        raise HTTPException(status_code=401, detail="Invalid TikTok signature")

    access_token = decrypt_secret(str(bot.get("tiktok_access_token") or ""))
    owner_res = await run_db(lambda: supabase.table("users").select("*").eq("auth_user_id", bot["user_id"]).limit(1).execute())
    if not owner_res.data:
        return {"ok": True}
    owner_user = owner_res.data[0]

    await _omnichannel_pipeline.process_inbound(
        message=inbound,
        bot=bot,
        owner_user=owner_user,
        access_token=access_token,
    )
    return {"ok": True}


# ---------------------------------------------------------------------------
# Telegram Bot Channel
# ---------------------------------------------------------------------------
TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_SECRET_TOKEN = os.environ.get("TELEGRAM_SECRET_TOKEN", "")


@router.post("/webhook/telegram")
@router.post("/webhook/telegram/{path_bot_id}")
async def telegram_receive(request: Request, path_bot_id: str | None = None):
    """Inbound Telegram Bot webhook handler."""
    bot_id = (path_bot_id or request.query_params.get("bot_id") or "").strip()
    secret_header = request.headers.get("x-telegram-bot-api-secret-token", "")

    if bot_id:
        res = await run_db(lambda: supabase.table("chatty_bots").select("*").eq("id", bot_id).limit(1).execute())
    else:
        res = await run_db(lambda: supabase.table("chatty_bots").select("*").not_.is_("telegram_bot_token", "null").limit(1).execute())

    if not res.data:
        res = await run_db(lambda: supabase.table("chatty_bots").select("*").limit(1).execute())
        if not res.data:
            return {"ok": True}

    bot = unpack_omnichannel_bot_row(res.data[0])
    expected_secret = bot.get("telegram_secret_token") or TELEGRAM_SECRET_TOKEN
    if expected_secret and not verify_telegram_secret(secret_header, expected_secret):
        raise HTTPException(status_code=401, detail="Invalid Telegram secret token")

    bot_token = decrypt_secret(bot.get("telegram_bot_token") or "") or TELEGRAM_BOT_TOKEN
    owner_res = await run_db(lambda: supabase.table("users").select("*").eq("auth_user_id", bot["user_id"]).limit(1).execute())
    if not owner_res.data:
        return {"ok": True}
    owner_user = owner_res.data[0]

    try:
        update = await request.json()
    except Exception:
        return {"ok": True}

    update_id = update.get("update_id")
    if update_id is not None:
        clean_update_id = str(update_id).replace("\r", "").replace("\n", "")[:50]
        clean_bot_id = str(bot["id"]).replace("\r", "").replace("\n", "")[:50]
        if not await _claim_channel_event("telegram", bot["id"], f"upd:{update_id}"):
            logger.info("Telegram update %s already claimed or in flight for bot %s, dropping retry", clean_update_id, clean_bot_id)
            return {"ok": True}

    media_bytes = None
    media_mime = None
    media_filename = None

    media_info = extract_telegram_media(update)
    if media_info and bot_token:
        file_id = media_info.get("file_id")
        if file_id:
            m_bytes, m_mime = await download_telegram_file(bot_token, file_id)
            if m_bytes:
                media_bytes = m_bytes
                media_mime = m_mime or media_info.get("mime_type")
                media_filename = media_info.get("file_name")

    inbound = normalize_telegram_update(
        update,
        media_bytes=media_bytes,
        media_mime=media_mime,
        media_filename=media_filename,
    )
    if inbound:
        await _omnichannel_pipeline.process_inbound(
            message=inbound,
            bot=bot,
            owner_user=owner_user,
            access_token=bot_token,
        )

    return {"ok": True}


# ---------------------------------------------------------------------------
# Two-Way SMS Channel (Twilio)
# ---------------------------------------------------------------------------
TWILIO_ACCOUNT_SID = os.environ.get("TWILIO_ACCOUNT_SID", "")
TWILIO_AUTH_TOKEN = os.environ.get("TWILIO_AUTH_TOKEN", "")


@router.post("/webhook/twilio/sms")
@router.post("/webhook/sms")
@router.post("/webhook/sms/{path_bot_id}")
async def twilio_sms_receive(request: Request, path_bot_id: str | None = None):
    """Inbound Twilio SMS webhook with cryptographic signature verification."""
    from fastapi.responses import Response

    form_data = dict(await request.form())
    sig_header = request.headers.get("x-twilio-signature", "")
    full_url = str(request.url)

    to_number = form_data.get("To", "").strip()
    bot_id = (path_bot_id or request.query_params.get("bot_id") or "").strip()

    if bot_id:
        res = await run_db(lambda: supabase.table("chatty_bots").select("*").eq("id", bot_id).limit(1).execute())
    elif to_number:
        res = await run_db(lambda: supabase.table("chatty_bots").select("*").eq("twilio_phone_number", to_number).limit(1).execute())
    else:
        res = await run_db(lambda: supabase.table("chatty_bots").select("*").limit(1).execute())

    if not res.data:
        return Response(content="<Response></Response>", media_type="application/xml")

    bot = unpack_omnichannel_bot_row(res.data[0])
    auth_token = decrypt_secret(bot.get("twilio_auth_token") or "") or TWILIO_AUTH_TOKEN
    if auth_token and sig_header:
        if not verify_twilio_signature(full_url, form_data, sig_header, auth_token):
            raise HTTPException(status_code=401, detail="Invalid Twilio signature")

    owner_res = await run_db(lambda: supabase.table("users").select("*").eq("auth_user_id", bot["user_id"]).limit(1).execute())
    if not owner_res.data:
        return Response(content="<Response></Response>", media_type="application/xml")
    owner_user = owner_res.data[0]

    num_media = int(form_data.get("NumMedia") or 0)
    media_bytes = None
    media_mime = None
    media_filename = None
    if num_media > 0 and form_data.get("MediaUrl0"):
        media_url = str(form_data.get("MediaUrl0"))
        account_sid = bot.get("twilio_account_sid") or os.environ.get("TWILIO_ACCOUNT_SID", "")
        try:
            from app.services.omnichannel.sms_adapter import download_twilio_media
            media_bytes, media_mime = await download_twilio_media(media_url, account_sid, auth_token)
            if media_bytes:
                media_filename = "mms_photo.jpg"
                if not media_mime:
                    media_mime = str(form_data.get("MediaContentType0") or "image/jpeg")
        except Exception:
            logger.warning("Failed to download Twilio MMS media", exc_info=True)

    inbound = normalize_sms_webhook(
        form_data,
        media_bytes=media_bytes,
        media_mime=media_mime,
        media_filename=media_filename,
    )
    if inbound:
        await _omnichannel_pipeline.process_inbound(
            message=inbound,
            bot=bot,
            owner_user=owner_user,
            access_token=auth_token,
        )

    return Response(content="<Response></Response>", media_type="application/xml")


# ---------------------------------------------------------------------------
# Two-Way Support Email Channel (Resend Inbound / Postmark)
# ---------------------------------------------------------------------------
EMAIL_INBOUND_SECRET = os.environ.get("RESEND_INBOUND_WEBHOOK_SECRET", "")


@router.post("/webhook/email/inbound")
async def email_inbound_receive(request: Request):
    """Inbound general customer support email webhook."""
    auth_header = request.headers.get("authorization", "") or request.headers.get("x-webhook-secret", "")
    if EMAIL_INBOUND_SECRET and not verify_email_webhook_secret(auth_header, EMAIL_INBOUND_SECRET):
        raise HTTPException(status_code=401, detail="Invalid email webhook authorization")

    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    bot_id = request.query_params.get("bot_id", "").strip()
    if bot_id:
        res = await run_db(lambda: supabase.table("chatty_bots").select("*").eq("id", bot_id).limit(1).execute())
    else:
        res = await run_db(lambda: supabase.table("chatty_bots").select("*").limit(1).execute())

    if not res.data:
        return {"ok": True, "skipped": "no_bot"}

    bot = res.data[0]
    owner_res = await run_db(lambda: supabase.table("users").select("*").eq("auth_user_id", bot["user_id"]).limit(1).execute())
    if not owner_res.data:
        return {"ok": True, "skipped": "no_owner"}
    owner_user = owner_res.data[0]

    inbound = normalize_email_message(payload)
    if inbound:
        await _omnichannel_pipeline.process_inbound(
            message=inbound,
            bot=bot,
            owner_user=owner_user,
            access_token=os.environ.get("RESEND_API_KEY", ""),
        )

    return {"ok": True}

