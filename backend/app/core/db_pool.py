"""Lazy, bounded PostgreSQL pool for the self-host adapter.

No connection is opened unless the self-host profile explicitly supplies a
DATABASE_URL and a caller asks for the pool. The managed Supabase path is
therefore unaffected.
"""

from __future__ import annotations

from contextlib import contextmanager
from typing import Iterator

from psycopg2.pool import ThreadedConnectionPool

from app.core.config import DATABASE_URL, DEPLOYMENT_PROFILE

_pool: ThreadedConnectionPool | None = None


def get_pool() -> ThreadedConnectionPool:
    global _pool
    if DEPLOYMENT_PROFILE != "self_host" or not DATABASE_URL:
        raise RuntimeError("self-host PostgreSQL is not enabled")
    if _pool is None:
        _pool = ThreadedConnectionPool(minconn=1, maxconn=10, dsn=DATABASE_URL)
    return _pool


@contextmanager
def connection() -> Iterator[object]:
    pool = get_pool()
    conn = pool.getconn()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        pool.putconn(conn)
