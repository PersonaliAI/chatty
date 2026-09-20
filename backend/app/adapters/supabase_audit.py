"""Supabase implementation of the audit event port."""

from __future__ import annotations

from typing import Any, Mapping

from app.core.db import run_db
from app.ports.audit import AuditLogRepository


class SupabaseAuditLogRepository(AuditLogRepository):
    """Write audit rows through the existing bounded database executor."""

    def __init__(self, client: Any):
        self._client = client

    async def append(
        self,
        *,
        bot_id: str,
        action: str,
        performed_by: str,
        details: str,
        metadata: Mapping[str, Any] | None = None,
    ) -> Mapping[str, Any]:
        row: dict[str, Any] = {
            "bot_id": bot_id,
            "action": action,
            "performed_by": performed_by,
            "details": details,
        }
        if metadata:
            row["metadata"] = dict(metadata)
        response = await run_db(
            lambda: self._client.table("chatty_audit_logs").insert(row).execute()
        )
        return (response.data or [row])[0]
