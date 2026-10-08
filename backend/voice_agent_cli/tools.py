"""LiveKit function tools backed by Chatty's existing business logic."""

from __future__ import annotations

import json
import logging
from importlib import import_module
from typing import Any

from livekit.agents import RunContext
from livekit.agents.llm import function_tool

from .media import VoiceMediaBuffer
from .organization import OrganizationContext
from .rag import KnowledgeService

logger = logging.getLogger("chatty.voice.tools")


class ChattyToolRegistry:
    """Build tenant-scoped LiveKit tools from Chatty declarations."""

    def __init__(
        self,
        organization: OrganizationContext,
        session_id: str,
        visitor_timezone: str = "UTC",
        media_buffer: VoiceMediaBuffer | None = None,
    ) -> None:
        self.organization = organization
        self.session_id = session_id
        self.visitor_timezone = visitor_timezone
        self.media_buffer = media_buffer
        self.knowledge = KnowledgeService(organization)

    def _allowed_business_names(self) -> set[str]:
        widget_brain = self.organization.modules.widget_brain
        return set(
            widget_brain.scheduling_tool_names(
                self.organization.bot, self.organization.owner_user
            )
        )

    def build(self) -> list[Any]:
        """Create the exact tool set enabled for this bot and owner."""
        agent_tools = self.organization.modules.agent_tools
        allowed = self._allowed_business_names()
        tools: list[Any] = []
        for declaration in agent_tools.DECLARATIONS:
            schema = declaration.get("function", declaration)
            name = schema.get("name")
            if name not in allowed:
                continue
            tools.append(self._business_tool(name, schema))
        tools.append(self._knowledge_tool())
        tools.append(self._catalog_tool())
        if (self.organization.bot.get("answer_mode") or "strict").lower() == "web":
            tools.append(self._web_search_tool())
        return tools

    def _business_tool(self, name: str, schema: dict[str, Any]) -> Any:
        async def run(_context: RunContext, arguments: dict[str, Any]) -> str:
            try:
                safe_arguments = dict(arguments or {})
                if name == "create_lead":
                    # These values belong to the signed voice session, not to
                    # model output. Injecting them here preserves tenant
                    # isolation and makes voice leads deduplicate correctly.
                    safe_arguments.update(
                        {
                            "bot_id": self.organization.bot["id"],
                            "session_id": self.session_id,
                        }
                    )
                result = await self.organization.modules.agent_tools.execute(
                    name,
                    safe_arguments,
                    user=self.organization.owner_user,
                    supabase=self.organization.supabase,
                    context={
                        # Keep Chatty's widget guardrails active for booking.
                        "source": "widget",
                        "channel": "voice",
                        "session_id": self.session_id,
                        "bot_id": self.organization.bot["id"],
                        "bot": self.organization.bot,
                        "visitor_timezone": self.visitor_timezone,
                    },
                )
                return json.dumps(result, ensure_ascii=False, default=str)
            except Exception:
                logger.exception("Chatty tool %s failed", name)
                return json.dumps(
                    {"error": "The requested Chatty action could not be completed."}
                )

        parameters = dict(
            schema.get("parameters", {"type": "object", "properties": {}})
        )
        if name == "create_lead":
            properties = dict(parameters.get("properties") or {})
            properties.pop("bot_id", None)
            parameters = {
                **parameters,
                "properties": properties,
                "required": [
                    field
                    for field in parameters.get("required", [])
                    if field not in {"bot_id", "session_id"}
                ],
            }

        return function_tool(
            run,
            raw_schema={
                "name": schema["name"],
                "description": schema.get("description", ""),
                "parameters": parameters,
            },
        )

    def _knowledge_tool(self) -> Any:
        async def run(_context: RunContext, raw_arguments: dict[str, Any]) -> str:
            query = str(raw_arguments.get("query") or "").strip()
            limit = int(raw_arguments.get("limit", 5))
            return await self.knowledge.search_for_tool(query, limit)

        return function_tool(
            run,
            raw_schema={
                "name": "search_knowledge",
                "description": (
                    "Search the selected Chatty bot's website, uploaded documents, "
                    "and connected knowledge sources. Use this before answering "
                    "questions that require business-specific facts."
                ),
                "parameters": {
                    "type": "object",
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": "The search question.",
                        },
                        "limit": {
                            "type": "integer",
                            "description": "Maximum number of sources, from 1 to 10.",
                        },
                    },
                    "required": ["query"],
                },
            },
        )

    def _catalog_tool(self) -> Any:
        async def run(_context: RunContext, raw_arguments: dict[str, Any]) -> str:
            """Search multimodal catalog/index data for spoken product questions."""
            query = str(raw_arguments.get("query") or "").strip()
            limit = int(raw_arguments.get("limit", 3))
            try:
                # Import by fully-qualified name so an injected adapter/test
                # double in ``sys.modules`` is honored even when the parent
                # package has already cached a different attribute.
                multimodal_service = import_module("app.services.multimodal_service")

                image = self.media_buffer.take_image() if self.media_buffer else None
                (
                    items,
                    visual_attrs,
                ) = await multimodal_service.search_multimodal_catalog(
                    bot_id=self.organization.bot["id"],
                    session_id=self.session_id,
                    image_bytes=image.data if image else None,
                    mime_type=image.mime_type if image else None,
                    query_text=query,
                    top_k=max(1, min(int(limit), 3)),
                )
                return json.dumps(
                    {
                        "items": items,
                        "visual_attributes": visual_attrs,
                    },
                    ensure_ascii=False,
                    default=str,
                )
            except Exception:
                logger.exception("Multimodal catalog search failed")
                return json.dumps({"error": "Catalog search is unavailable right now."})

        return function_tool(
            run,
            raw_schema={
                "name": "search_catalog",
                "description": (
                    "Search the Chatty bot's multimodal product, inventory, image, "
                    "and video catalog. Use for product, price, stock, size, or "
                    "show-me questions. Never invent current price or availability."
                ),
                "parameters": {
                    "type": "object",
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": "The product question.",
                        },
                        "limit": {
                            "type": "integer",
                            "description": "Maximum matching products, from 1 to 3.",
                        },
                    },
                    "required": ["query"],
                },
            },
        )

    def _web_search_tool(self) -> Any:
        async def run(_context: RunContext, raw_arguments: dict[str, Any]) -> str:
            query = str(raw_arguments.get("query") or "").strip()
            try:
                return await self.organization.modules.widget_brain._web_search(query)
            except Exception:
                logger.exception("Web search failed")
                return "Web search is unavailable right now."

        return function_tool(
            run,
            raw_schema={
                "name": "web_search",
                "description": (
                    "Search the public web for current factual information when "
                    "the Chatty knowledge base does not cover the question."
                ),
                "parameters": {
                    "type": "object",
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": "The web search query.",
                        }
                    },
                    "required": ["query"],
                },
            },
        )
