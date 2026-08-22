"""Async wrapper around the (synchronous) supabase-py client.

supabase-py's client makes blocking HTTP calls under the hood — there is no
`await` anywhere in its call chain. Calling it directly from an `async def`
FastAPI route handler blocks the single, shared asyncio event loop for the
full duration of that call. Under concurrent visitor traffic, one slow DB
call serializes every other in-flight request behind it on the same worker.

`run_db` offloads the call to a worker thread so the event loop stays free
to keep servicing other requests while this one waits on I/O. It changes
nothing about *what* runs — same client, same query — only *where* it runs.

    res = await run_db(lambda: supabase.table("chatty_bots").select("*").eq("id", bot_id).execute())

This is an incremental fix applied to the highest-traffic paths first
(the widget chat endpoints), not yet a full sweep of every supabase call in
the codebase — see the async supabase client (`supabase.AsyncClient` /
`create_async_client`, already available in the installed supabase-py
version) as the more complete long-term direction, which removes the need
for this wrapper entirely but requires converting every call site's client
to the async variant rather than just this thread-offload shim.
"""

from __future__ import annotations

import asyncio
from typing import Callable, TypeVar

T = TypeVar("T")


async def run_db(fn: Callable[[], T]) -> T:
    """Run a synchronous supabase-py call in a worker thread."""
    return await asyncio.to_thread(fn)
