"""Apply subscription and trial enforcement migration to Supabase PostgreSQL."""

import hashlib
import sys
from pathlib import Path
import psycopg2

ADVISORY_LOCK_KEY = "chatty:migrations"

def main() -> int:
    dsn = sys.argv[1] if len(sys.argv) > 1 else None
    if not dsn:
        print("Usage: python apply_subscription_migration.py <postgres_dsn>", file=sys.stderr)
        return 1

    migration_file = Path(__file__).resolve().parents[1] / "supabase" / "migrations" / "20261018140000_subscription_and_trial_enforcement.sql"
    sql = migration_file.read_text(encoding="utf-8")
    digest = hashlib.sha256(sql.encode("utf-8")).hexdigest()

    print(f"Connecting to Postgres to apply {migration_file.name}...")
    conn = psycopg2.connect(dsn)
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute("SELECT pg_advisory_xact_lock(hashtext(%s))", (ADVISORY_LOCK_KEY,))
                print("Acquired advisory lock. Executing migration SQL...")
                cur.execute(sql)
                
                # Record in _migrations_log
                cur.execute(
                    """
                    INSERT INTO _migrations_log (name, checksum, applied_at)
                    VALUES (%s, %s, NOW())
                    ON CONFLICT (name) DO UPDATE SET checksum = EXCLUDED.checksum, applied_at = NOW();
                    """,
                    (migration_file.name, digest),
                )
                
                # Record in _manual_migrations_log
                cur.execute(
                    """
                    INSERT INTO _manual_migrations_log (filename, applied_at)
                    VALUES (%s, NOW())
                    ON CONFLICT (filename) DO UPDATE SET applied_at = NOW();
                    """,
                    (migration_file.name,),
                )
        print(f"Migration {migration_file.name} applied and logged successfully!")
        return 0
    except Exception as e:
        print(f"Failed to apply migration: {e}", file=sys.stderr)
        return 1
    finally:
        conn.close()

if __name__ == "__main__":
    raise SystemExit(main())
