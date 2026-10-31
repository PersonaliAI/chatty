"""Enterprise Audit Logging Service.
Records immutable mutation trails for security, SOC2/ISO27001 readiness, and GDPR/LGPD compliance.
"""

from __future__ import annotations

import logging
from typing import Any, Optional
from uuid import UUID

from app.core.clients import supabase
from app.core.db import run_db

logger = logging.getLogger("chatty.enterprise.audit")


class AuditService:
    @staticmethod
    async def record_audit(
        action: str,
        entity_type: str,
        entity_id: Optional[str] = None,
        bot_id: Optional[str] = None,
        user_id: Optional[str] = None,
        actor_email: Optional[str] = None,
        diff: Optional[dict[str, Any]] = None,
        ip_address: Optional[str] = None,
        request_id: Optional[str] = None,
    ) -> None:
        """Record an immutable audit event."""
        try:
            bot_uuid = str(UUID(bot_id)) if bot_id else None
        except (ValueError, TypeError):
            bot_uuid = None

        try:
            user_uuid = str(UUID(user_id)) if user_id else None
        except (ValueError, TypeError):
            user_uuid = None

        payload = {
            "action": action,
            "entity_type": entity_type,
            "entity_id": str(entity_id) if entity_id else None,
            "bot_id": bot_uuid,
            "user_id": user_uuid,
            "actor_email": actor_email,
            "diff": diff,
            "ip_address": ip_address,
            "request_id": request_id,
        }

        try:
            await run_db(
                lambda: supabase.table("chatty_enterprise_audit_log")
                .insert(payload)
                .execute()
            )
            logger.debug("Logged enterprise audit event")
        except Exception as exc:
            # Audit logging is fire-and-forget; never raise or block user mutations
            logger.warning("Failed to record enterprise audit log (%s)", type(exc).__name__)
