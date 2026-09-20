"""Audit event persistence contract."""

from __future__ import annotations

from typing import Any, Mapping, Protocol


class AuditLogRepository(Protocol):
    """Append-only audit boundary for security and operational events."""

    async def append(
        self,
        *,
        bot_id: str,
        action: str,
        performed_by: str,
        details: str,
        metadata: Mapping[str, Any] | None = None,
    ) -> Mapping[str, Any]:
        """Persist one immutable, tenant-scoped event."""
