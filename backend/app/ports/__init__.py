"""Stable application ports.

Ports are intentionally small protocols. Feature code should depend on these
interfaces instead of importing a vendor SDK directly. Supabase remains the
default adapter today; the port lets self-hosted and managed deployments swap
the adapter without rewriting the domain logic.
"""

from app.ports.conversations import ConversationRepository

__all__ = ["ConversationRepository"]
