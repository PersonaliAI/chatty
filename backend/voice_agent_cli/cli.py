"""Command-line interface for the local Chatty voice backend."""

from __future__ import annotations

import argparse
import asyncio
import sys
from collections.abc import Coroutine
from datetime import timedelta
from typing import Any

from .config import VoiceSettings

SCHEMA_TABLES = (
    "users",
    "chatty_bots",
    "chatty_sources",
    "chatty_leads",
    "chatty_meetings",
    "chatty_sessions",
    "chatty_conversations",
    "chatty_unanswered",
    "chatty_media_items",
    "chatty_flows",
    "chatty_flow_versions",
    "chatty_flow_runs",
    "chatty_flow_connections",
    "drive_documents",
    "document_chunks",
)


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="chatty-voice", description="Local Chatty voice agent"
    )
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser(
        "doctor", help="Validate local provider configuration without connecting"
    )
    sub.add_parser("account", help="Verify the fixed Chatty organization and bot")
    sub.add_parser("schema", help="Read-only check of required Chatty tables")
    sub.add_parser(
        "list-tools", help="Resolve the account and list enabled business tools"
    )
    connect = sub.add_parser("connect", help="Connect to an existing LiveKit room")
    connect.add_argument("--room", required=True, help="LiveKit room name")
    connect.add_argument("--identity", help="Participant identity")
    token = sub.add_parser("token", help="Mint a short-lived local LiveKit room token")
    token.add_argument("--room", required=True, help="LiveKit room name")
    token.add_argument("--identity", required=True, help="Participant identity")
    token.add_argument(
        "--ttl", type=int, default=3600, help="Token lifetime in seconds"
    )
    for command in ("console", "dev", "start"):
        sub.add_parser(command, help=f"Run the LiveKit Agents {command} mode")
    return parser


def _doctor(settings: VoiceSettings) -> int:
    missing = settings.missing_for_doctor()
    path_errors = settings.validate_paths()
    print(f"organization: {settings.organization_email}")
    print(
        f"vertex_adc: {'configured' if settings.google_application_credentials else 'missing'}"
    )
    print(f"vertex_project: {settings.google_cloud_project or 'missing'}")
    print(f"livekit: {'configured' if settings.livekit_url else 'missing'}")
    print(f"google_stt: {settings.stt_model}")
    print(f"google_tts: {settings.tts_model} ({settings.tts_voice})")
    provider_errors = _validate_provider_construction(settings)
    print(f"provider_runtime: {'ready' if not provider_errors else 'error'}")
    if missing:
        print("missing: " + ", ".join(missing))
    for error in path_errors:
        print(f"error: {error}")
    for error in provider_errors:
        print(f"error: {error}")
    return 1 if missing or path_errors or provider_errors else 0


def _token(settings: VoiceSettings, room: str, identity: str, ttl: int) -> int:
    """Mint a participant token; only explicit token commands print credentials."""
    missing = [
        name
        for name, value in {
            "LIVEKIT_URL": settings.livekit_url,
            "LIVEKIT_API_KEY": settings.livekit_api_key,
            "LIVEKIT_API_SECRET": settings.livekit_api_secret,
        }.items()
        if not value
    ]
    if missing:
        print("missing: " + ", ".join(missing), file=sys.stderr)
        return 1
    if ttl <= 0:
        print("error: --ttl must be positive", file=sys.stderr)
        return 1
    from livekit import api

    token = (
        api.AccessToken(settings.livekit_api_key, settings.livekit_api_secret)
        .with_identity(identity)
        .with_ttl(timedelta(seconds=ttl))
        .with_grants(api.VideoGrants(room_join=True, room=room))
        .to_jwt()
    )
    print(token)
    return 0


def _validate_provider_construction(settings: VoiceSettings) -> list[str]:
    """Instantiate configured providers without making network requests."""
    if settings.missing_for_doctor() or settings.validate_paths():
        return []
    try:
        settings.apply_provider_environment()
        from livekit.plugins import google

        llm_kwargs = {
            "model": settings.llm_model,
            "vertexai": True,
            "location": settings.google_cloud_location,
        }
        if settings.google_cloud_project:
            llm_kwargs["project"] = settings.google_cloud_project
        google.LLM(**llm_kwargs)
        google.STT(
            model=settings.stt_model,
            languages=settings.stt_language,
            project=settings.google_cloud_project,
            location=settings.stt_location,
        )
        google.beta.GeminiTTS(
            model=settings.tts_model,
            voice_name=settings.tts_voice,
            vertexai=True,
            project=settings.google_cloud_project,
            location=settings.tts_location,
        )
    except Exception as exc:
        return [f"provider construction failed ({type(exc).__name__})"]
    return []


async def _list_tools(settings: VoiceSettings) -> int:
    from .organization import OrganizationRepository  # noqa: PLC0415

    organization = await OrganizationRepository(settings).resolve()
    modules = organization.modules
    names = modules.widget_brain.scheduling_tool_names(
        organization.bot, organization.owner_user
    )
    print(
        f"organization: {organization.owner_user.get('email', settings.organization_email)}"
    )
    print(f"bot: {organization.bot.get('name', organization.bot.get('id', 'unknown'))}")
    extra = ["search_knowledge", "search_catalog"]
    if (organization.bot.get("answer_mode") or "strict").lower() == "web":
        extra.append("web_search")
    print("tools: " + ", ".join([*names, *extra]))
    return 0


async def _account(settings: VoiceSettings) -> int:
    from .organization import OrganizationRepository  # noqa: PLC0415

    organization = await OrganizationRepository(settings, load_plugins=False).resolve()
    print(
        f"organization: {organization.owner_user.get('email', settings.organization_email)}"
    )
    print(f"bot: {organization.bot.get('name', organization.bot.get('id', 'unknown'))}")
    print("ownership: verified")
    return 0


async def _schema(settings: VoiceSettings) -> int:
    """Check table visibility without reading rows or changing the database."""
    from .bootstrap import load_chatty_core  # noqa: PLC0415

    modules = load_chatty_core(settings)
    missing = 0
    for table_name in SCHEMA_TABLES:
        try:
            await modules.run_db(
                lambda table_name=table_name: (
                    modules.supabase.table(table_name).select("*").limit(0).execute()
                )
            )
        except Exception as exc:
            missing += 1
            detail = str(exc).lower()
            state = (
                "missing"
                if "pgrst205" in detail or "schema cache" in detail
                else "error"
            )
            print(f"{table_name}: {state}")
        else:
            print(f"{table_name}: present")
    return 1 if missing else 0


def main(argv: list[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    settings = VoiceSettings.from_env()
    if args.command == "doctor":
        return _doctor(settings)
    if args.command == "account":
        return _run_async(_account(settings))
    if args.command == "schema":
        return _run_async(_schema(settings))
    if args.command == "token":
        return _token(settings, args.room, args.identity, args.ttl)
    if args.command == "list-tools":
        return _run_async(_list_tools(settings))

    # Import LiveKit only for runtime commands, after settings have been loaded.
    from .runtime import run_livekit_cli  # noqa: PLC0415

    sys.argv = [sys.argv[0], args.command]
    if args.command == "connect":
        sys.argv.extend(["--room", args.room])
        if args.identity:
            sys.argv.extend(["--participant-identity", args.identity])
    run_livekit_cli([args.command])
    return 0


def _run_async(coro: Coroutine[Any, Any, int]) -> int:
    """Run a diagnostic coroutine and keep setup errors user-readable."""
    from .organization import OrganizationError

    try:
        return asyncio.run(coro)
    except OrganizationError as exc:
        print(f"account_error: {exc}", file=sys.stderr)
        return 1
