"""Omnichannel messaging data contracts and domain models."""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Optional


class ChannelType(str, Enum):
    WHATSAPP = "whatsapp"
    WEB = "web"
    EMAIL = "email"
    SLACK = "slack"
    SMS = "sms"
    INSTAGRAM = "instagram"
    MESSENGER = "messenger"
    TIKTOK = "tiktok"
    TELEGRAM = "telegram"


@dataclass
class InboundMessage:
    """Normalized inbound message from any customer-facing channel."""
    channel: ChannelType
    sender_id: str
    recipient_id: str
    session_id: str
    message_id: str
    text: str = ""
    media_bytes: Optional[bytes] = None
    media_mime: Optional[str] = None
    media_filename: Optional[str] = None
    interactive_reply_id: Optional[str] = None
    timestamp: Optional[int] = None
    raw: dict[str, Any] = field(default_factory=dict)

    @property
    def has_media(self) -> bool:
        return bool(self.media_bytes and self.media_mime)


@dataclass
class OutboundMessage:
    """Normalized outbound message dispatched to any customer-facing channel."""
    channel: ChannelType
    recipient_id: str
    sender_id: str
    text: str = ""
    quick_replies: list[str] = field(default_factory=list)
    template_name: Optional[str] = None
    template_params: list[str] = field(default_factory=list)
    language_code: str = "en_US"
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class CustomerServiceWindowState:
    """Status of the 24-hour customer service window for messaging channels."""
    window_open: bool
    requires_template: bool
    remaining_seconds: int
    expires_at: Optional[str]
    last_user_message_at: Optional[str] = None
    reason: str = "open"
