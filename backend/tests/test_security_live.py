"""Standing security checks against the real database — the exact class of
check that would have caught the last documented incident (git history:
"Fix RLS gap: 5 tables exposed to PostgREST with no Row Level Security")
before it shipped, instead of relying on someone noticing by hand.

Skipped automatically unless real Supabase credentials are present — see
test_integration_live.py's module docstring for how to run these locally.
These use a direct Postgres connection (via SUPABASE_DB_PASSWORD), not the
PostgREST REST API, since RLS/policy state lives in pg_catalog, which
PostgREST doesn't expose.
"""
from __future__ import annotations

import os

import psycopg2
import pytest

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
_LIVE = bool(SUPABASE_URL) and "example.supabase.co" not in SUPABASE_URL

# Same pooler connection used for applying migrations elsewhere in this
# project (see the "run_migrations.py" pattern) — SUPABASE_DB_PASSWORD is
# the direct-Postgres credential, separate from the REST API service role key.
_DB_HOST = os.environ.get("SUPABASE_DB_HOST", "aws-0-ap-southeast-2.pooler.supabase.com")
_DB_USER = os.environ.get("SUPABASE_DB_USER", "postgres.dckjbkcormifiuwfpahj")
_DB_PASSWORD = os.environ.get("SUPABASE_DB_PASSWORD", "")
_DB_PORT = int(os.environ.get("SUPABASE_DB_PORT", "6543"))

pytestmark = [
    pytest.mark.skipif(not _LIVE, reason="requires real Supabase credentials (conftest.py stubs a fake host by default)"),
    pytest.mark.skipif(not _DB_PASSWORD, reason="requires SUPABASE_DB_PASSWORD (direct Postgres connection)"),
]


def _connect():
    return psycopg2.connect(
        host=_DB_HOST, user=_DB_USER, password=_DB_PASSWORD,
        dbname="postgres", port=_DB_PORT, connect_timeout=10,
    )


def test_every_public_table_has_row_level_security_enabled():
    """The historical incident, as a standing check: any table in the public
    schema — reachable via PostgREST with the anon/authenticated key —
    without RLS enabled is an open door regardless of what policies exist."""
    conn = _connect()
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT c.relname, c.relrowsecurity
            FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public' AND c.relkind = 'r'
            ORDER BY c.relname;
        """)
        rows = cur.fetchall()
    finally:
        conn.close()

    assert rows, "expected at least one table in the public schema — check the connection, not just the assertion"
    without_rls = [name for name, enabled in rows if not enabled]
    assert not without_rls, (
        f"{len(without_rls)} table(s) exposed to PostgREST with no Row Level Security: {without_rls}"
    )
