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
import logging
from typing import Callable, TypeVar
import httpx

logger = logging.getLogger(__name__)

T = TypeVar("T")

# Dedicated I/O thread pool for synchronous Supabase REST calls.
# Sized to 64 workers to prevent thread starvation under concurrent visitor traffic
# (Python's default asyncio.to_thread pool allocates only cpu_count+4 = ~5-6 workers on Cloud Run).
_DB_EXECUTOR = ThreadPoolExecutor(max_workers=64, thread_name_prefix="chatty-db-worker")


async def run_db(fn: Callable[[], T]) -> T:
    """Run a synchronous supabase-py call in a dedicated I/O worker thread,
    with automatic retry on transient transport disconnects."""
    loop = asyncio.get_running_loop()
    last_exc = None
    for attempt in range(3):
        try:
            return await loop.run_in_executor(_DB_EXECUTOR, fn)
        except (httpx.TransportError, httpx.RemoteProtocolError, httpx.ReadError) as exc:
            last_exc = exc
            if attempt == 2:
                logger.error("run_db failed after 3 attempts with transport error: %s", exc)
                raise
            await asyncio.sleep(0.05 * (2 ** attempt))
        except Exception as exc:
            status_code = getattr(exc, "code", None) or getattr(exc, "status_code", None)
            if status_code in (502, 503, 504) and attempt < 2:
                last_exc = exc
                await asyncio.sleep(0.05 * (2 ** attempt))
                continue
            raise
    if last_exc:
        raise last_exc
