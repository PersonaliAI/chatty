#!/usr/bin/env python3
"""Apply every file in supabase/migrations/ (in order) to your Supabase
project's Postgres database. Safe to re-run — already-applied migrations
are tracked in a `_migrations_log` table and skipped.

Usage:
    python scripts/apply_migrations.py "postgresql://postgres:PASSWORD@HOST:5432/postgres"

Find your connection string in Supabase → Project Settings → Database →
Connection string → URI (use the "Session pooler" or direct connection,
not the transaction pooler — migrations need a persistent session).
"""
import os
import sys

import psycopg2

MIGRATIONS_DIR = os.path.join(os.path.dirname(__file__), "..", "supabase", "migrations")


def main() -> None:
    if len(sys.argv) != 2:
        print(__doc__)
        sys.exit(1)
    direct_url = sys.argv[1]

    files = sorted(f for f in os.listdir(MIGRATIONS_DIR) if f.endswith(".sql"))
    print(f"{len(files)} migration files found")

    conn = psycopg2.connect(direct_url)
    conn.autocommit = False
    cur = conn.cursor()
    cur.execute(
        "CREATE TABLE IF NOT EXISTS _migrations_log "
        "(filename text primary key, applied_at timestamptz default now())"
    )
    conn.commit()
    cur.execute("SELECT filename FROM _migrations_log")
    already = {r[0] for r in cur.fetchall()}

    applied = skipped = 0
    for fname in files:
        if fname in already:
            skipped += 1
            continue
        sql = open(os.path.join(MIGRATIONS_DIR, fname), encoding="utf-8").read()
        if not sql.strip():
            continue
        try:
            cur.execute(sql)
            cur.execute("INSERT INTO _migrations_log (filename) VALUES (%s)", (fname,))
            conn.commit()
            applied += 1
            print(f"  applied {fname}")
        except Exception as e:
            conn.rollback()
            print(f"FAILED at {fname}: {e}")
            sys.exit(1)

    cur.close()
    conn.close()
    print(f"\nDone — applied {applied} new, skipped {skipped} already-applied.")


if __name__ == "__main__":
    main()
