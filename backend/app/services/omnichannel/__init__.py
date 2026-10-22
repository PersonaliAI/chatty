"""Omnichannel messaging package for Chatty.

Provides unified abstractions, adapters, and pipelines across customer
communication channels:
- WhatsApp Business (Meta Cloud API)
- Instagram DM & Facebook Messenger (Meta Graph API)
- Telegram (Bot API)
- Two-Way SMS (Twilio REST API)
- Two-Way Email (Resend Inbound)
"""

from __future__ import annotations

from app.services.omnichannel.booking_bridge import (
    build_channel_booking_cta,
    build_whatsapp_booking_cta,
    dispatch_whatsapp_booking_cancelled,
    dispatch_whatsapp_booking_confirmation,
    dispatch_whatsapp_booking_rescheduled,
    format_available_slots_for_whatsapp,
    is_booking_intent,
)
from app.services.omnichannel.email_adapter import (
    clean_email_body,
    normalize_email_message,
    send_outbound_email,
    verify_email_webhook_secret,
)
from app.services.omnichannel.escalation_bridge import (
    apply_human_takeover,
    detect_human_handoff_request,
    get_handoff_acknowledgement,
    is_session_ai_paused,
)
from app.services.omnichannel.instagram_adapter import (
    normalize_instagram_message,
    send_outbound_instagram,
    verify_instagram_signature,
)
from app.services.omnichannel.models import (
    ChannelType,
    CustomerServiceWindowState,
    InboundMessage,
    OutboundMessage,
)
from app.services.omnichannel.pipeline import OmnichannelPipeline
from app.services.omnichannel.sms_adapter import (
    check_tcpa_opt_out,
    normalize_sms_webhook,
    send_outbound_sms,
    verify_twilio_signature,
)
from app.services.omnichannel.telegram_adapter import (
    normalize_telegram_update,
    send_outbound_telegram,
    verify_telegram_secret,
)
from app.services.omnichannel.whatsapp_adapter import (
    format_whatsapp_reply,
    normalize_meta_message,
    send_outbound_whatsapp,
    verify_meta_signature,
)

__all__ = [
    "ChannelType",
    "CustomerServiceWindowState",
    "InboundMessage",
    "OutboundMessage",
    "OmnichannelPipeline",
    "apply_human_takeover",
    "build_channel_booking_cta",
    "build_whatsapp_booking_cta",
    "check_tcpa_opt_out",
    "clean_email_body",
    "detect_human_handoff_request",
    "dispatch_whatsapp_booking_cancelled",
    "dispatch_whatsapp_booking_confirmation",
    "dispatch_whatsapp_booking_rescheduled",
    "format_available_slots_for_whatsapp",
    "format_whatsapp_reply",
    "get_handoff_acknowledgement",
    "is_booking_intent",
    "is_session_ai_paused",
    "normalize_email_message",
    "normalize_instagram_message",
    "normalize_meta_message",
    "normalize_sms_webhook",
    "normalize_telegram_update",
    "send_outbound_email",
    "send_outbound_instagram",
    "send_outbound_sms",
    "send_outbound_telegram",
    "send_outbound_whatsapp",
    "verify_email_webhook_secret",
    "verify_instagram_signature",
    "verify_meta_signature",
    "verify_telegram_secret",
    "verify_twilio_signature",
]
