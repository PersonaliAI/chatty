"""API Router for WAHA Integration, Session QR Pairing, and Anti-Ban Engine."""

from __future__ import annotations

import logging
from typing import Any, Optional
from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request
from pydantic import BaseModel

from app.core.clients import supabase
from app.core.db import run_db
from app.routers.bots import get_bot_role_and_permissions, require_user
from app.services.omnichannel.config_store import update_bot_omnichannel_safe
from app.services.omnichannel.models import ChannelType, InboundMessage
from app.services.omnichannel.pipeline import OmnichannelPipeline
from app.services.waha import (
    WahaAntiBanService,
    WahaBotConfig,
    WahaClient,
    WahaSessionStatusResponse,
    get_waha_service_for_bot,
)

logger = logging.getLogger("chatty.routers.waha")

router = APIRouter(tags=["waha"])


class WahaConfigPayload(BaseModel):
    bot_id: str
    provider: str = "waha"  # "official" or "waha"
    waha_endpoint: str = "http://localhost:3000"
    waha_api_key: Optional[str] = None
    waha_session_name: Optional[str] = None
    sim_age_days: int = 1
    typing_presence_enabled: bool = True
    opt_out_shield_enabled: bool = True
    daily_cap: Optional[int] = 20
    window_start_hour: int = 8
    window_end_hour: int = 21


@router.get("/api/integrations/waha/status")
async def get_waha_status(
    bot_id: str = Query(...),
    user: dict[str, Any] = Depends(require_user),
) -> dict[str, Any]:
    """Check live status of the bot's WAHA session, including QR code if pending scan."""
    await get_bot_role_and_permissions(bot_id, user)
    bot_res = await run_db(lambda: supabase.table("chatty_bots").select("*").eq("id", bot_id).limit(1).execute())
    if not bot_res.data:
        raise HTTPException(status_code=404, detail="Bot not found")

    bot = bot_res.data[0]
    service = get_waha_service_for_bot(bot)
    session_status = await service.client.get_session_status(service.config.waha_session_name)
    warmup_stats = service.warmup.get_stats()

    return {
        "ok": True,
        "session": session_status.model_dump(),
        "anti_ban": {
            "warmup": warmup_stats,
            "pacing_enabled": service.config.pacing.typing_presence_enabled,
            "spinning_window": service.config.spinning.window_size,
            "opt_out_shield": service.config.opt_out_shield_enabled,
        },
        "provider": service.config.provider,
    }


@router.post("/api/integrations/waha/session/start")
async def start_waha_session(
    payload: dict[str, str],
    user: dict[str, Any] = Depends(require_user),
) -> dict[str, Any]:
    """Start or reboot a WAHA NOWEB session to initiate QR pairing."""
    bot_id = payload.get("bot_id")
    if not bot_id:
        raise HTTPException(status_code=400, detail="bot_id required")

    await get_bot_role_and_permissions(bot_id, user)
    bot_res = await run_db(lambda: supabase.table("chatty_bots").select("*").eq("id", bot_id).limit(1).execute())
    if not bot_res.data:
        raise HTTPException(status_code=404, detail="Bot not found")

    bot = bot_res.data[0]
    service = get_waha_service_for_bot(bot)
    started = await service.client.start_session(service.config.waha_session_name)
    if not started:
        raise HTTPException(status_code=502, detail="Failed to start WAHA session on server")

    # Fetch status immediately after starting
    status = await service.client.get_session_status(service.config.waha_session_name)
    return {"ok": True, "session": status.model_dump()}


@router.post("/api/integrations/waha/session/stop")
async def stop_waha_session(
    payload: dict[str, str],
    user: dict[str, Any] = Depends(require_user),
) -> dict[str, Any]:
    """Stop/disconnect WAHA WhatsApp session."""
    bot_id = payload.get("bot_id")
    if not bot_id:
        raise HTTPException(status_code=400, detail="bot_id required")

    await get_bot_role_and_permissions(bot_id, user)
    bot_res = await run_db(lambda: supabase.table("chatty_bots").select("*").eq("id", bot_id).limit(1).execute())
    if not bot_res.data:
        raise HTTPException(status_code=404, detail="Bot not found")

    bot = bot_res.data[0]
    service = get_waha_service_for_bot(bot)
    stopped = await service.client.stop_session(service.config.waha_session_name)
    return {"ok": stopped}


@router.post("/api/integrations/waha/config")
async def save_waha_config(
    payload: WahaConfigPayload,
    user: dict[str, Any] = Depends(require_user),
) -> dict[str, Any]:
    """Update WAHA endpoint and anti-ban knobs in bot's configuration."""
    await get_bot_role_and_permissions(payload.bot_id, user)

    session_name = payload.waha_session_name or f"bot_{payload.bot_id[:8]}"
    waha_dict = {
        "provider": payload.provider,
        "endpoint": payload.waha_endpoint.rstrip("/"),
        "api_key": payload.waha_api_key,
        "session_name": session_name,
        "opt_out_shield_enabled": payload.opt_out_shield_enabled,
        "pacing": {
            "typing_presence_enabled": payload.typing_presence_enabled,
            "window_start_hour": payload.window_start_hour,
            "window_end_hour": payload.window_end_hour,
        },
        "warmup": {
            "sim_age_days": payload.sim_age_days,
            "daily_cap": payload.daily_cap,
            "auto_warmup_enabled": True,
        },
    }

    # Fetch existing omnichannel_config
    bot_res = await run_db(lambda: supabase.table("chatty_bots").select("omnichannel_config").eq("id", payload.bot_id).limit(1).execute())
    omni_cfg = (bot_res.data[0].get("omnichannel_config") if bot_res.data else {}) or {}
    omni_cfg["waha"] = waha_dict

    updates = {
        "whatsapp_provider": payload.provider,
        "omnichannel_config": omni_cfg,
    }

    await update_bot_omnichannel_safe(supabase, payload.bot_id, updates, user_id=user["auth_user_id"])
    return {"ok": True, "config": waha_dict}


@router.post("/webhook/waha")
async def waha_inbound_webhook(
    request: Request,
    x_api_key: Optional[str] = Header(None, alias="x-api-key"),
) -> dict[str, Any]:
    """
    Handle inbound message webhooks dispatched from WAHA container.
    Payload specification: https://waha.devlike.pro/docs/how-to/webhooks/
    """
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    event = body.get("event")
    session = body.get("session") or "default"
    payload = body.get("payload") or {}

    # Ignore non-message events (like presence, group updates, ack)
    if event != "message":
        return {"ok": True, "ignored_event": event}

    # Extract sender, text, and chat details
    frm = str(payload.get("from") or "")
    if "@c.us" in frm:
        sender_phone = frm.replace("@c.us", "")
    elif "@s.whatsapp.net" in frm:
        sender_phone = frm.replace("@s.whatsapp.net", "")
    else:
        sender_phone = frm

    text = str(payload.get("body") or "").strip()
    msg_id = str(payload.get("id") or "")
    from_me = bool(payload.get("fromMe"))

    # Ignore messages sent by ourselves
    if from_me or not sender_phone:
        return {"ok": True, "ignored": "from_me"}

    # Resolve corresponding bot by session_name or first active WAHA bot
    bot_res = await run_db(
        lambda: supabase.table("chatty_bots")
        .select("*")
        .eq("whatsapp_provider", "waha")
        .limit(5)
        .execute()
    )
    if not bot_res.data:
        # Fallback to any bot with waha session name
        bot_res = await run_db(lambda: supabase.table("chatty_bots").select("*").limit(1).execute())
        if not bot_res.data:
            return {"ok": True, "warning": "no_bot_found"}

    bot = bot_res.data[0]
    bot_id = bot["id"]
    service = get_waha_service_for_bot(bot)

    # Anti-ban Opt-out / DNC shield check
    if service.is_opt_out_request(text):
        logger.info("Opt-out keyword detected from %s; confirming DNC shield", sender_phone)
        try:
            await service.client.send_text(
                session_name=service.config.waha_session_name,
                chat_id=frm,
                text="You have been unsubscribed from automated messages. Text START to resume anytime.",
            )
        except Exception:
            pass
        return {"ok": True, "opt_out": True}

    # Normalize into InboundMessage contract
    normalized = InboundMessage(
        channel=ChannelType.WHATSAPP,
        sender_id=sender_phone,
        recipient_id=session,
        text=text,
        message_id=msg_id,
        sender_name=str(payload.get("_data", {}).get("notifyName") or sender_phone),
    )

    owner_res = await run_db(lambda: supabase.table("users").select("*").eq("auth_user_id", bot["user_id"]).limit(1).execute())
    owner_user = owner_res.data[0] if owner_res.data else {}

    # Deliver to Chatty Omnichannel Pipeline
    pipeline = OmnichannelPipeline()
    result = await pipeline.process_inbound(
        message=normalized,
        bot=bot,
        owner_user=owner_user,
        access_token=None,
    )

    return {"ok": True, "result": result}
