"""Resolve the single permitted Chatty organization account and its bot."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from .bootstrap import ChattyModules, load_chatty_core, load_chatty_modules
from .config import VoiceSettings


class OrganizationError(RuntimeError):
    """Raised when the configured account cannot be resolved safely."""


@dataclass(frozen=True, slots=True)
class OrganizationContext:
    """Tenant-scoped data passed to tools and RAG."""

    owner_user: dict[str, Any]
    bot: dict[str, Any]
    modules: ChattyModules

    @property
    def supabase(self) -> Any:
        return self.modules.supabase


class OrganizationRepository:
    """Account resolver with an explicit email boundary."""

    def __init__(self, settings: VoiceSettings, *, load_plugins: bool = True) -> None:
        self.settings = settings
        self.modules = (
            load_chatty_modules(settings)
            if load_plugins
            else load_chatty_core(settings)
        )

    async def resolve(self, bot_id_override: str | None = None) -> OrganizationContext:
        """Resolve the configured owner and one of that owner's bots.

        ``bot_id_override`` is supplied by the signed LiveKit room dispatch
        metadata. It is still filtered through the fixed organization owner,
        so a room can never switch this worker to another account.
        """
        email = self.settings.organization_email
        try:
            user_result = await self.modules.run_db(
                lambda: (
                    self.modules.supabase.table("users")
                    .select("*")
                    .ilike("email", email)
                    .limit(1)
                    .execute()
                )
            )
        except Exception as exc:
            raise OrganizationError(
                f"Could not query the Chatty users table for {email} "
                f"({type(exc).__name__})."
            ) from exc
        users = user_result.data or []
        if not users:
            raise OrganizationError(
                f"No Chatty user found for {email}. Check SUPABASE_URL, "
                "SUPABASE_SECRET_KEY, and the account email."
            )

        owner = users[0]
        # Chatty stores the internal profile id in ``users.id`` but stores the
        # Supabase Auth subject in ``chatty_bots.user_id``. Older local test
        # fixtures only have ``id``, so retain that as a compatibility
        # fallback while preferring the real auth id in production.
        owner_auth_id = owner.get("auth_user_id") or owner.get("id")
        if not owner_auth_id:
            raise OrganizationError(f"Chatty user {email} has no database id.")

        bots_query = (
            self.modules.supabase.table("chatty_bots")
            .select("*")
            .eq("user_id", owner_auth_id)
        )
        try:
            bot_result = await self.modules.run_db(
                lambda: bots_query.order("created_at", desc=True).execute()
            )
        except Exception as exc:
            error_text = str(exc).lower()
            if "chatty_bots" in error_text and (
                "schema cache" in error_text or "pgrst205" in error_text
            ):
                raise OrganizationError(
                    "The connected Supabase project is missing public.chatty_bots. "
                    "Apply the Chatty Supabase migrations to the intended local "
                    "project, then rerun the account check."
                ) from exc
            raise OrganizationError(
                f"Could not query Chatty bots for {email} ({type(exc).__name__})."
            ) from exc
        bots = bot_result.data or []
        selected_bot_id = bot_id_override or self.settings.chatty_bot_id
        if selected_bot_id:
            # Keep the explicit selector scoped to the already ownership-
            # filtered result. This avoids relying on a PostgREST UUID filter
            # that is inconsistent with the project's current Secret Key
            # gateway while preserving the ownership boundary.
            bots = [
                bot
                for bot in bots
                if bot.get("id") == selected_bot_id
            ]
        if not bots:
            selector = selected_bot_id or "any bot"
            raise OrganizationError(
                f"No {selector} belonging to {email} was found in Chatty."
            )
        if not self.settings.chatty_bot_id and len(bots) > 1:
            raise OrganizationError(
                f"{email} owns {len(bots)} Chatty bots. Set CHATTY_BOT_ID "
                "to select one explicitly; refusing ambiguous account resolution."
            )

        bot = bots[0]
        if bot.get("user_id") != owner_auth_id:
            raise OrganizationError(
                "Resolved bot failed the organization ownership check."
            )
        return OrganizationContext(owner_user=owner, bot=bot, modules=self.modules)
