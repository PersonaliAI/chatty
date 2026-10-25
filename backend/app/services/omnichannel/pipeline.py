"""Omnichannel message processing pipeline.

Orchestrates the complete lifecycle of inbound omnichannel messages across:
1. WhatsApp (Meta Cloud API)
2. Instagram DM & Facebook Messenger (Meta Graph API)
3. Telegram (Bot API)
4. Two-Way SMS (Twilio / CTIA compliance)
5. Two-Way Email (Resend / Inbound MX)

Pipeline Steps:
- Compliance check (e.g. TCPA STOP/START on SMS)
- Subscription quota verification
- Conversation & session persistence
- Human agent takeover check (ai_paused suppression)
- Escalation / "Talk to Human" detection, Slack notification & handoff acknowledgement
- Multimodal AI generation (Gemini)
- Booking intent interception and channel-tailored signed CTA injection
- Rich commerce formatting (WooCommerce order cards, product cards)
- Outbound delivery through channel-specific adapters
"""

from __future__ import annotations

import logging
import os
import re
from typing import Any, Optional

from app.core.clients import supabase
from app.core.crypto import decrypt_secret
from app.core.db import run_db
from app.services.omnichannel.booking_bridge import (
    build_channel_booking_cta,
    is_booking_intent,
)
from app.services.omnichannel.config_store import unpack_omnichannel_bot_row
from app.services.omnichannel.email_adapter import send_outbound_email
from app.services.omnichannel.escalation_bridge import (
    apply_human_takeover,
    detect_human_handoff_request,
    get_handoff_acknowledgement,
    is_session_ai_paused,
)
from app.services.omnichannel.instagram_adapter import send_outbound_instagram
from app.services.omnichannel.models import ChannelType, InboundMessage
from app.services.omnichannel.sms_adapter import check_tcpa_opt_out, send_outbound_sms
from app.services.omnichannel.telegram_adapter import send_outbound_telegram
from app.services.omnichannel.tiktok_adapter import send_outbound_tiktok
from app.services.omnichannel.whatsapp_adapter import (
    format_whatsapp_reply,
    send_outbound_whatsapp,
)
from app.services.whatsapp_service import get_bot_whatsapp_secret
from app.services.chatty_quota_service import chatty_quota_exceeded, usage_units_for_message
from app.services.flow_runtime import run_widget_flow
from app.services.pii_service import scrub_pii
from app.services.widget_session_service import upsert_session as _upsert_session
from plugins.widget_brain import run_widget_assistant

DEFAULT_QUOTA_REPLY = (
    "Sorry, the assistant is temporarily unavailable right now. "
    "Please try again later, or leave your contact details and the team will get back to you."
)

logger = logging.getLogger("chatty.omnichannel.pipeline")


async def _resolve_omnichannel_visitor_timezone(
    supabase,
    bot_id: str,
    bot: dict[str, Any],
    owner_user: dict[str, Any],
    session_id: str,
    sender_id: str,
) -> str:
    """Resolve the visitor's local timezone for omnichannel sessions.
    1. Checks chatty_leads for this session or sender ID (custom_fields.visitor_timezone).
    2. Checks chatty_meetings for any active/scheduled appointment for this lead.
    3. Falls back to bot_timezone -> owner_user timezone -> UTC.
    """
    import pytz
    try:
        lead_res = await run_db(
            lambda: supabase.table("chatty_leads")
            .select("id, email, phone, custom_fields")
            .eq("bot_id", bot_id)
            .eq("session_id", session_id)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        if not (lead_res and lead_res.data) and session_id.startswith("wa:"):
            wa_phone = sender_id.replace("+", "").strip()
            lead_res = await run_db(
                lambda: supabase.table("chatty_leads")
                .select("id, email, phone, custom_fields")
                .eq("bot_id", bot_id)
                .ilike("phone", f"%{wa_phone[-10:]}%")
                .order("created_at", desc=True)
                .limit(1)
                .execute()
            )

        if lead_res and lead_res.data:
            lead = lead_res.data[0]
            cf = lead.get("custom_fields") or {}
            if isinstance(cf, dict) and cf.get("visitor_timezone"):
                candidate = str(cf["visitor_timezone"]).strip()
                try:
                    pytz.timezone(candidate)
                    return candidate
                except Exception:
                    pass

            lead_id = lead.get("id")
            lead_email = (lead.get("email") or "").strip().lower()
            filters: list[str] = []
            if lead_id:
                filters.append(f"lead_id.eq.{lead_id}")
            if lead_email:
                filters.append(f"attendee_email.eq.{lead_email}")
            if filters:
                meet_res = await run_db(
                    lambda: supabase.table("chatty_meetings")
                    .select("timezone")
                    .eq("bot_id", bot_id)
                    .neq("status", "cancelled")
                    .or_(",".join(filters))
                    .order("created_at", desc=True)
                    .limit(1)
                    .execute()
                )
                if meet_res and meet_res.data:
                    m_tz = (meet_res.data[0].get("timezone") or "").strip()
                    if m_tz:
                        try:
                            pytz.timezone(m_tz)
                            return m_tz
                        except Exception:
                            pass
    except Exception:
        logger.exception("Failed resolving visitor timezone for omnichannel session %s", session_id)

    from plugins.availability_engine import resolve_owner_timezone
    return resolve_owner_timezone(bot, owner_user)


class OmnichannelPipeline:
    """Industrial-grade orchestrator for omnichannel customer communications."""

    async def _dispatch_to_channel(
        self,
        message: InboundMessage,
        text: str,
        bot: dict[str, Any],
        access_token: str,
        quick_replies: Optional[list[str]] = None,
        booking_url: Optional[str] = None,
    ) -> bool:
        """Route outbound message through the appropriate channel adapter."""
        ch = message.channel

        if ch == ChannelType.WHATSAPP:
            return await send_outbound_whatsapp(
                phone_number_id=message.recipient_id,
                to=message.sender_id,
                text=text,
                access_token=decrypt_secret(access_token or bot.get("whatsapp_access_token") or ""),
                quick_replies=quick_replies,
            )

        if ch == ChannelType.MESSENGER:
            raw_tok = bot.get("messenger_access_token") or bot.get("instagram_access_token") or access_token or ""
            token = decrypt_secret(str(raw_tok))
            return await send_outbound_instagram(
                page_access_token=token,
                recipient_id=message.sender_id,
                text=text,
                quick_replies=quick_replies,
            )

        if ch == ChannelType.INSTAGRAM:
            raw_tok = bot.get("instagram_access_token") or access_token or ""
            token = decrypt_secret(str(raw_tok))
            return await send_outbound_instagram(
                page_access_token=token,
                recipient_id=message.sender_id,
                text=text,
                quick_replies=quick_replies,
            )

        if ch == ChannelType.TIKTOK:
            raw_tok = bot.get("tiktok_access_token") or access_token or ""
            token = decrypt_secret(str(raw_tok))
            biz_id = str(bot.get("tiktok_business_id") or bot.get("tiktok_open_id") or message.recipient_id or "").strip()
            return await send_outbound_tiktok(
                access_token=token,
                business_id=biz_id,
                recipient_id=message.sender_id,
                text=text,
                quick_replies=quick_replies,
            )

        if ch == ChannelType.TELEGRAM:
            raw_tok = bot.get("telegram_bot_token") or access_token or ""
            token = decrypt_secret(str(raw_tok))
            inline_buttons = None
            if booking_url:
                inline_buttons = [{"text": "📅 Book Appointment", "url": booking_url}]
            return await send_outbound_telegram(
                bot_token=token,
                chat_id=message.sender_id,
                text=text,
                inline_buttons=inline_buttons,
                quick_replies=quick_replies,
            )

        if ch == ChannelType.SMS:
            account_sid = bot.get("twilio_account_sid") or os.environ.get("TWILIO_ACCOUNT_SID", "")
            raw_tok = bot.get("twilio_auth_token") or access_token or os.environ.get("TWILIO_AUTH_TOKEN", "")
            auth_token = decrypt_secret(str(raw_tok))
            from_num = message.recipient_id or bot.get("twilio_phone_number") or os.environ.get("TWILIO_FROM_NUMBER", "")
            return await send_outbound_sms(
                account_sid=account_sid,
                auth_token=auth_token,
                from_number=from_num,
                to_number=message.sender_id,
                text=text,
            )

        if ch == ChannelType.EMAIL:
            api_key = bot.get("resend_api_key") or access_token or os.environ.get("RESEND_API_KEY", "")
            from_addr = message.recipient_id or bot.get("support_email") or os.environ.get("SUPPORT_FROM_EMAIL", "support@personaliai.com")
            subject = (message.raw or {}).get("subject") or "Support Request"
            in_reply_to = (message.raw or {}).get("message_id")
            return await send_outbound_email(
                api_key=api_key,
                from_address=from_addr,
                to_address=message.sender_id,
                subject=subject,
                text_content=text,
                in_reply_to=in_reply_to,
            )

        return False

    async def process_inbound(
        self,
        message: InboundMessage,
        bot: dict[str, Any],
        owner_user: dict[str, Any],
        access_token: str,
        app_secret: Optional[str] = None,
    ) -> dict[str, Any]:
        """Process an inbound message across any supported channel."""
        bot = unpack_omnichannel_bot_row(bot)
        bot_id = bot["id"]
        session_id = message.session_id
        bot_model = bot.get("selected_model")
        usage_units = usage_units_for_message(message.text, has_media=message.has_media, model=bot_model)

        # 1. Channel Compliance (e.g., SMS TCPA STOP/START Opt-Out)
        if message.channel == ChannelType.SMS:
            is_compliance, compliance_reply = check_tcpa_opt_out(message.text)
            if is_compliance:
                await self._dispatch_to_channel(
                    message=message,
                    text=compliance_reply,
                    bot=bot,
                    access_token=access_token,
                )
                return {"status": "tcpa_compliance", "reply": compliance_reply}

        # 2. Quota Verification
        if await chatty_quota_exceeded(owner_user, bot["user_id"], additional_units=usage_units):
            logger.info("Owner quota exceeded for bot %s, sending quota notice", bot_id)
            await self._dispatch_to_channel(
                message=message,
                text=DEFAULT_QUOTA_REPLY,
                bot=bot,
                access_token=access_token,
            )
            return {"status": "quota_exceeded", "delivered": False}

        # 3. Format inbound display content & scrub PII (GDPR Art. 5(1)(c) & Art. 25 Data Minimisation)
        display_content = scrub_pii(message.text)
        if message.has_media:
            tag = f"[attachment: {message.media_filename or message.media_mime}]"
            display_content = (display_content + "\n" + tag).strip() if display_content else tag
        display_content = display_content or "[empty message]"
        message.text = display_content

        # 4. Maintain session row (for dashboard inbox, SLA tracking, and analytics)
        await _upsert_session(
            bot_id=bot_id,
            session_id=session_id,
            last_message=display_content,
            channel=message.channel.value,
        )

        # 5. Record visitor message in chatty_conversations
        try:
            await run_db(
                lambda: supabase.table("chatty_conversations").insert({
                    "bot_id": bot_id,
                    "session_id": session_id,
                    "role": "user",
                    "content": display_content,
                    "sender": "visitor",
                    "usage_units": usage_units,
                }).execute()
            )
        except Exception:
            logger.exception("Failed to record inbound omnichannel conversation message")

        # 6. Check if Human Agent Takeover is active (ai_paused)
        try:
            sess_res = await run_db(
                lambda: supabase.table("chatty_sessions")
                .select("ai_paused, needs_attention, status")
                .eq("bot_id", bot_id)
                .eq("session_id", session_id)
                .limit(1)
                .execute()
            )
            session_row = sess_res.data[0] if (sess_res and sess_res.data) else None
        except Exception:
            logger.exception("Failed to query session ai_paused status")
            session_row = None

        if is_session_ai_paused(session_row):
            logger.info(
                "Human takeover active on session %s for bot %s; suppressing automated AI response",
                session_id,
                bot_id,
            )
            return {"status": "ai_paused", "handled_by": "human_agent"}

        # 7. Check for human handoff request / escalation
        is_escalation, reason, priority = detect_human_handoff_request(message.text)
        if is_escalation:
            logger.info(
                "Escalation requested on session %s (reason: %s, priority: %s)",
                session_id,
                reason,
                priority,
            )
            await apply_human_takeover(
                bot_id=bot_id,
                session_id=session_id,
                reason=reason,
                text=message.text,
                priority=priority,
                owner_user=owner_user,
            )
            ack_text = get_handoff_acknowledgement()

            try:
                await run_db(
                    lambda: supabase.table("chatty_conversations").insert({
                        "bot_id": bot_id,
                        "session_id": session_id,
                        "role": "assistant",
                        "content": ack_text,
                        "sender": "system",
                    }).execute()
                )
            except Exception:
                logger.exception("Failed to record handoff acknowledgement message")

            await self._dispatch_to_channel(
                message=message,
                text=ack_text,
                bot=bot,
                access_token=access_token,
            )

            return {"status": "escalated", "reason": reason, "reply": ack_text}

        # 7b. Execute Published Flow Builder Workflows (e.g., WhatsApp time-based offer campaigns)
        flow_reply = ""
        visitor_tz = await _resolve_omnichannel_visitor_timezone(
            supabase=supabase,
            bot_id=bot_id,
            bot=bot,
            owner_user=owner_user,
            session_id=session_id,
            sender_id=message.sender_id,
        )
        try:
            flow_res = await run_widget_flow(
                supabase,
                bot_id=bot_id,
                event="message.user",
                session_id=session_id,
                data={
                    "content": message.text,
                    "channel": message.channel.value,
                    "platform": message.channel.value,
                    "sender_id": message.sender_id,
                    "visitor_name": getattr(message, "sender_name", None) or message.sender_id,
                    "timezone": visitor_tz,
                },
            )
            flow_reply = str(flow_res.get("reply") or "").strip()
        except Exception:
            logger.exception("Omnichannel flow runtime execution failed for bot %s; continuing with AI assistant", bot_id)

        # 8. Execute AI generation (when no Flow Builder workflow produced a reply)
        if flow_reply:
            reply = flow_reply
        else:
            try:
                result = await run_widget_assistant(
                    bot_id=bot_id,
                    owner_user=owner_user,
                    bot=bot,
                    session_id=session_id,
                    text=message.text,
                    visitor_timezone=visitor_tz,
                    media_bytes=message.media_bytes,
                    media_mime=message.media_mime,
                )
                reply = str(result.get("reply") or "").strip()
            except Exception:
                logger.exception("Omnichannel assistant run failed for bot %s", bot_id)
                reply = "I apologize, but I encountered an error processing your request. Please try again in a moment."

        if not reply:
            return {"status": "empty_reply", "delivered": False}

        # 9. Conversational Booking Intent & CTA Injection
        calendar_enabled = bool(bot.get("calendar_scheduling_enabled"))
        booking_url = None
        should_inject_booking = is_booking_intent(message.text, reply, calendar_enabled=calendar_enabled)

        # Always strip any echoed booking CTA blocks or raw /book/<bot_id> URLs from LLM output first
        reply = re.sub(
            r"(?:📅\s*)?(?:\*{0,2})schedule your appointment(?:\s+here)?:(?:\*{0,2})\s*"
            r"https?://[^\s)]+/book/[^\s)]+"
            r"(?:\s*(?:_?tap|click) the link to choose your preferred date (?:&|and) time slot\.?_?)?",
            "",
            reply,
            flags=re.IGNORECASE,
        ).strip()
        reply = re.sub(
            r"https?://[^\s)]+/book/[0-9a-fA-F-]{36}[^\s)]*",
            "",
            reply,
        ).strip()
        reply = re.sub(
            r"(?:📅\s*)?(?:\*{0,2})schedule your appointment(?:\s+here)?:?(?:\*{0,2})\s*$",
            "",
            reply,
            flags=re.IGNORECASE,
        ).strip()

        if should_inject_booking:
            secret = get_bot_whatsapp_secret(bot)
            booking_cta, booking_url = build_channel_booking_cta(
                channel=message.channel,
                bot_id=bot_id,
                identifier=message.sender_id,
                secret=secret,
            )
            reply = reply.replace("[BOOKING_WIDGET]", "").strip() + booking_cta
        else:
            reply = reply.replace("[BOOKING_WIDGET]", "").strip()

        # 10. Format response for channel (order cards, product cards, etc.)
        has_handoff_marker = "[HANDOFF_ACTIONS]" in reply
        reply = reply.replace("[HANDOFF_ACTIONS]", "").strip()

        if message.channel in (ChannelType.WHATSAPP, ChannelType.TELEGRAM, ChannelType.INSTAGRAM, ChannelType.MESSENGER, ChannelType.TIKTOK):
            reply = format_whatsapp_reply(reply)

        # 11. Record outbound AI message in chat history
        try:
            await run_db(
                lambda: supabase.table("chatty_conversations").insert({
                    "bot_id": bot_id,
                    "session_id": session_id,
                    "role": "assistant",
                    "content": reply,
                    "sender": "ai",
                }).execute()
            )
        except Exception:
            logger.exception("Failed to record outbound omnichannel assistant reply")

        # 12. Channel-specific Quick Replies
        if message.channel == ChannelType.MESSENGER:
            quick_replies = bot.get("messenger_quick_replies") or bot.get("whatsapp_quick_replies")
        elif message.channel == ChannelType.INSTAGRAM:
            quick_replies = bot.get("instagram_quick_replies") or bot.get("whatsapp_quick_replies")
        elif message.channel == ChannelType.TIKTOK:
            quick_replies = bot.get("tiktok_quick_replies") or bot.get("whatsapp_quick_replies")
        else:
            quick_replies = bot.get("whatsapp_quick_replies")
        btn_list = list(quick_replies) if isinstance(quick_replies, list) else []
        if has_handoff_marker and not any("human" in str(b).lower() or "agent" in str(b).lower() for b in btn_list):
            btn_list = (["Talk to Human"] + btn_list)[:3]

        # 13. Dispatch outbound delivery through appropriate channel
        await self._dispatch_to_channel(
            message=message,
            text=reply,
            bot=bot,
            access_token=access_token,
            quick_replies=btn_list,
            booking_url=booking_url,
        )

        return {"status": "delivered", "reply": reply}
