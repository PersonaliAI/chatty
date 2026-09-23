"""Stable application ports.

Ports are intentionally small protocols. Feature code should depend on these
interfaces instead of importing a vendor SDK directly. Supabase remains the
managed persistence adapter, so vendor details stay out of domain logic.
"""

from app.ports.conversations import ConversationRepository
from app.ports.audit import AuditLogRepository
from app.ports.jobs import JobQueue

__all__ = ["AuditLogRepository", "ConversationRepository", "JobQueue"]
