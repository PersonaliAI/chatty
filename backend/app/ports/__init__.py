"""Stable application ports.

Ports are intentionally small protocols. Feature code should depend on these
interfaces instead of importing a vendor SDK directly. Supabase remains the
default adapter today; the port lets self-hosted and managed deployments swap
the adapter without rewriting the domain logic.
"""

from app.ports.conversations import ConversationRepository
from app.ports.audit import AuditLogRepository
from app.ports.jobs import JobQueue

__all__ = ["AuditLogRepository", "ConversationRepository", "JobQueue"]
