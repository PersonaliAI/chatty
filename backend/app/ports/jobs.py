"""Durable background-job queue contract."""

from __future__ import annotations

from typing import Any, Mapping, Protocol


class JobQueue(Protocol):
    """Queue work that may outlive an HTTP request."""

    async def enqueue(
        self,
        *,
        name: str,
        payload: Mapping[str, Any],
        idempotency_key: str,
        delay_seconds: int = 0,
    ) -> str:
        """Publish a job and return its durable queue identifier."""
