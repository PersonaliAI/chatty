"""Async wrapper around the (synchronous) supabase-py client.

supabase-py's client makes blocking HTTP calls under the hood - there is no
`await` anywhere in its call chain. Calling it directly from an `async def`
FastAPI route handler blocks the single, shared asyncio event loop for the
full duration of that call. Under concurrent visitor traffic, one slow DB
call serializes every other in-flight request behind it on the same worker.

`run_db` offloads the call to a worker thread so the event loop stays free
to keep servicing other requests while this one waits on I/O. It changes
nothing about *what* runs - same client, same query - only *where* it runs.

    res = await run_db(lambda: supabase.table("chatty_bots").select("*").eq("id", bot_id).execute())

This is an incremental fix applied to the highest-traffic paths first
(the widget chat endpoints), not yet a full sweep of every supabase call in
the codebase - see the async supabase client (`supabase.AsyncClient` /
`create_async_client`, already available in the installed supabase-py
version) as the more complete long-term direction, which removes the need
for this wrapper entirely but requires converting every call site's client
to the async variant rather than just this thread-offload shim.
"""

from __future__ import annotations

import asyncio
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Callable, TypeVar

from psycopg2.extras import RealDictCursor

from app.core.config import DEPLOYMENT_PROFILE
from app.core.db_pool import connection

T = TypeVar("T")

# Dedicated I/O thread pool for synchronous Supabase REST calls.
# Sized to 64 workers to prevent thread starvation under concurrent visitor traffic
# (Python's default asyncio.to_thread pool allocates only cpu_count+4 = ~5-6 workers on Cloud Run).
_DB_EXECUTOR = ThreadPoolExecutor(max_workers=64, thread_name_prefix="chatty-db-worker")


async def run_db(fn: Callable[[], T]) -> T:
    """Run a synchronous supabase-py call in a dedicated I/O worker thread."""
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(_DB_EXECUTOR, fn)


async def get_bot(bot_id: str) -> dict | None:
    if DEPLOYMENT_PROFILE != "self_host":
        return None
    def _fetch() -> dict | None:
        with connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("SELECT * FROM chatty_bots WHERE id = %s LIMIT 1", (bot_id,))
                row = cur.fetchone()
                return dict(row) if row else None
    return await run_db(_fetch)


async def get_user(auth_user_id: str) -> dict | None:
    if DEPLOYMENT_PROFILE != "self_host":
        return None
    def _fetch() -> dict | None:
        with connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("SELECT * FROM users WHERE auth_user_id = %s LIMIT 1", (auth_user_id,))
                row = cur.fetchone()
                return dict(row) if row else None
    return await run_db(_fetch)


def _validated_updates(updates: dict[str, Any], allowed: frozenset[str]) -> dict[str, Any]:
    """Validate dynamic column names before constructing a parameterized UPDATE."""
    unknown = set(updates) - allowed
    if unknown:
        raise ValueError("unsupported update field")
    return {key: value for key, value in updates.items() if key in allowed}


async def update_bot_fields(bot_id: str, updates: dict[str, Any]) -> dict | None:
    """Update a small, explicitly allow-listed bot field set in self-host mode."""
    if DEPLOYMENT_PROFILE != "self_host":
        return None
    safe_updates = _validated_updates(updates, frozenset({"logo_url", "avatar_url", "avatar_icon"}))
    if not safe_updates:
        return None

    def _update() -> dict | None:
        columns = ", ".join(f"{column} = %s" for column in safe_updates)
        values = [safe_updates[column] for column in safe_updates]
        with connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    f"UPDATE chatty_bots SET {columns} WHERE id = %s RETURNING *",
                    (*values, bot_id),
                )
                row = cur.fetchone()
                return dict(row) if row else None

    return await run_db(_update)


async def update_user_fields(auth_user_id: str, updates: dict[str, Any]) -> dict | None:
    """Update a small, explicitly allow-listed user field set in self-host mode."""
    if DEPLOYMENT_PROFILE != "self_host":
        return None
    safe_updates = _validated_updates(updates, frozenset({"display_name", "avatar_url"}))
    if not safe_updates:
        return None

    def _update() -> dict | None:
        columns = ", ".join(f"{column} = %s" for column in safe_updates)
        values = [safe_updates[column] for column in safe_updates]
        with connection() as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    f"UPDATE users SET {columns} WHERE auth_user_id = %s RETURNING *",
                    (*values, auth_user_id),
                )
                row = cur.fetchone()
                return dict(row) if row else None

    return await run_db(_update)


async def update_team_member_fields(email: str, updates: dict[str, Any]) -> int:
    """Update profile fields for matching team members in self-host mode."""
    if DEPLOYMENT_PROFILE != "self_host" or not email:
        return 0
    safe_updates = _validated_updates(updates, frozenset({"name", "avatar_url"}))
    if not safe_updates:
        return 0

    def _update() -> int:
        columns = ", ".join(f"{column} = %s" for column in safe_updates)
        values = [safe_updates[column] for column in safe_updates]
        with connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    f"UPDATE chatty_team_members SET {columns} WHERE email = %s",
                    (*values, email),
                )
                return cur.rowcount

    return await run_db(_update)
