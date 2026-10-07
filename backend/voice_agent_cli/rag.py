"""Voice-facing adapter for Chatty's existing knowledge search pipeline."""

from __future__ import annotations

import json
from typing import Any

from .organization import OrganizationContext


class KnowledgeService:
    """Use the widget RAG implementation without duplicating indexing logic."""

    def __init__(self, organization: OrganizationContext) -> None:
        self.organization = organization

    async def search(self, query: str, limit: int = 5) -> dict[str, Any]:
        query = query.strip()
        if not query:
            return {"context": "", "sources": []}

        widget_brain = self.organization.modules.widget_brain
        context, sources = await widget_brain.search_knowledge(
            self.organization.bot["id"],
            self.organization.owner_user,
            self.organization.bot,
            query,
            translate_query=True,
        )
        return {
            "context": context,
            "sources": (sources or [])[: max(1, min(limit, 10))],
        }

    async def search_for_tool(self, query: str, limit: int = 5) -> str:
        """Return a compact JSON result for LiveKit's function-tool protocol."""
        result = await self.search(query, limit)
        if not result["context"]:
            return json.dumps({"message": "No matching Chatty knowledge was found."})
        return json.dumps(result, ensure_ascii=False, default=str)
