"""Event Types Service - Manages multi-event scheduling configurations per bot."""

from __future__ import annotations

import logging
import re
from datetime import datetime, timezone
from typing import Any, List, Optional
from fastapi import HTTPException

from app.services.booking.models import EventTypeCreate, EventTypeUpdate

logger = logging.getLogger("chatty.booking.event_types")


def slugify(text: str) -> str:
    """Generate clean, URL-safe slug."""
    text = text.lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s_-]+", "-", text)
    return text.strip("-") or "meeting"


class EventTypesService:
    def __init__(self, supabase_client, run_db_func):
        self.supabase = supabase_client
        self.run_db = run_db_func

    async def list_event_types(
        self, bot_id: str, active_only: bool = True
    ) -> List[dict[str, Any]]:
        """List all event types for a given bot."""
        def _query():
            q = self.supabase.table("chatty_event_types").select("*").eq("bot_id", bot_id)
            if active_only:
                q = q.eq("is_active", True)
            return q.order("duration_minutes", desc=False).execute()

        res = await self.run_db(_query)
        return res.data or []

    async def get_event_type(
        self, event_type_id: str, bot_id: Optional[str] = None
    ) -> Optional[dict[str, Any]]:
        """Fetch a specific event type by ID."""
        def _query():
            q = self.supabase.table("chatty_event_types").select("*").eq("id", event_type_id)
            if bot_id:
                q = q.eq("bot_id", bot_id)
            return q.limit(1).execute()

        res = await self.run_db(_query)
        if not res.data:
            return None
        return res.data[0]

    async def get_by_slug(self, bot_id: str, slug: str) -> Optional[dict[str, Any]]:
        """Fetch an active event type by bot and slug."""
        def _query():
            return (
                self.supabase.table("chatty_event_types")
                .select("*")
                .eq("bot_id", bot_id)
                .eq("slug", slug)
                .eq("is_active", True)
                .limit(1)
                .execute()
            )

        res = await self.run_db(_query)
        if not res.data:
            return None
        return res.data[0]

    async def create_event_type(
        self, bot_id: str, data: EventTypeCreate
    ) -> dict[str, Any]:
        """Create a new event type for a bot with slug collision avoidance."""
        base_slug = slugify(data.slug or data.title)
        slug = base_slug

        existing = await self.list_event_types(bot_id, active_only=False)
        existing_slugs = {e["slug"] for e in existing}

        counter = 1
        while slug in existing_slugs:
            slug = f"{base_slug}-{counter}"
            counter += 1

        payload = data.model_dump()
        payload["bot_id"] = bot_id
        payload["slug"] = slug
        payload["created_at"] = datetime.now(timezone.utc).isoformat()
        payload["updated_at"] = payload["created_at"]

        def _insert():
            return self.supabase.table("chatty_event_types").insert(payload).execute()

        res = await self.run_db(_insert)
        if not res.data:
            raise HTTPException(status_code=500, detail="Failed to create event type")
        return res.data[0]

    async def update_event_type(
        self, event_type_id: str, bot_id: str, data: EventTypeUpdate
    ) -> dict[str, Any]:
        """Update an existing event type."""
        current = await self.get_event_type(event_type_id, bot_id=bot_id)
        if not current:
            raise HTTPException(status_code=404, detail="Event type not found")

        update_dict = {k: v for k, v in data.model_dump(exclude_unset=True).items()}
        if "slug" in update_dict and update_dict["slug"] != current["slug"]:
            new_slug = slugify(update_dict["slug"])
            existing = await self.list_event_types(bot_id, active_only=False)
            if any(e["slug"] == new_slug and e["id"] != event_type_id for e in existing):
                raise HTTPException(status_code=400, detail="Slug already in use for this assistant")
            update_dict["slug"] = new_slug

        update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()

        def _update():
            return (
                self.supabase.table("chatty_event_types")
                .update(update_dict)
                .eq("id", event_type_id)
                .eq("bot_id", bot_id)
                .execute()
            )

        res = await self.run_db(_update)
        if not res.data:
            raise HTTPException(status_code=500, detail="Failed to update event type")
        return res.data[0]

    async def delete_event_type(self, event_type_id: str, bot_id: str) -> bool:
        """Soft-delete an event type by setting is_active=False to preserve booking history."""
        current = await self.get_event_type(event_type_id, bot_id=bot_id)
        if not current:
            raise HTTPException(status_code=404, detail="Event type not found")

        def _deactivate():
            return (
                self.supabase.table("chatty_event_types")
                .update({
                    "is_active": False,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                })
                .eq("id", event_type_id)
                .eq("bot_id", bot_id)
                .execute()
            )

        await self.run_db(_deactivate)
        return True
