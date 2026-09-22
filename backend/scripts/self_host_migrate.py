"""Apply Chatty's canonical PostgreSQL schema exactly once per migration.

The runner applies the canonical ``supabase/migrations`` directory, not a
second hand-maintained subset. It supplies the small ``auth`` compatibility
prelude required by the non-Supabase deployment. The Supabase cron/net
migration is intentionally skipped because those extensions are
provider-specific; operators should run the documented scheduler/worker
service instead.

Usage:
    DATABASE_URL=postgresql://... python scripts/self_host_migrate.py
"""

from __future__ import annotations

import os
from pathlib import Path

import psycopg2


ROOT = Path(__file__).resolve().parents[1]
PRELUDE = ROOT / "sql" / "self_host_prelude.sql"
MIGRATIONS = ROOT / "supabase" / "migrations"
SKIP = {"20260510090611_setup_cron.sql"}


def main() -> None:
    dsn = os.environ.get("DATABASE_URL", "").strip()
    if not dsn:
        raise SystemExit("DATABASE_URL is required")

    with psycopg2.connect(dsn) as conn:
        with conn.cursor() as cur:
            cur.execute(PRELUDE.read_text(encoding="utf-8"))
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS _chatty_schema_migrations (
                    version TEXT PRIMARY KEY,
                    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
                """
            )
            for path in sorted(MIGRATIONS.glob("*.sql")):
                if path.name in SKIP:
                    continue
                cur.execute(
                    "SELECT 1 FROM _chatty_schema_migrations WHERE version = %s",
                    (path.name,),
                )
                if cur.fetchone():
                    continue
                sql = path.read_text(encoding="utf-8")
                try:
                    cur.execute(sql)
                except Exception:
                    conn.rollback()
                    raise RuntimeError(f"self-host migration failed: {path.name}") from None
                cur.execute(
                    "INSERT INTO _chatty_schema_migrations(version) VALUES (%s)",
                    (path.name,),
                )
    print("Chatty self-host migrations are up to date")


if __name__ == "__main__":
    main()
