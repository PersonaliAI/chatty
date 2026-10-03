"""Apply only the additive contact migration, not unrelated pending migrations.

Use SUPABASE_DB_HOST/USER/PASSWORD environment variables. Never prints a DSN.
The transaction and migration log share the existing runner's advisory lock.
"""
import os
from pathlib import Path

import psycopg2
from apply_migrations import _ensure_log_table, checksum, ADVISORY_LOCK_KEY


def main():
    path = Path(__file__).resolve().parents[1] / "supabase/migrations/20261003140000_inbox_contact_identity.sql"
    sql = path.read_text(encoding="utf-8")
    connection = psycopg2.connect(host=os.environ["SUPABASE_DB_HOST"], user=os.environ["SUPABASE_DB_USER"],
        password=os.environ["SUPABASE_DB_PASSWORD"], dbname="postgres", port=os.environ.get("SUPABASE_DB_PORT", "5432"),
        sslmode="require", connect_timeout=10)
    try:
        with connection:
            with connection.cursor() as cursor:
                cursor.execute("SELECT pg_advisory_xact_lock(hashtext(%s))", (ADVISORY_LOCK_KEY,))
                _ensure_log_table(cursor)
                cursor.execute("SELECT checksum FROM _migrations_log WHERE name=%s", (path.name,))
                row = cursor.fetchone()
                if row:
                    if row[0] != checksum(sql):
                        raise RuntimeError("Contact migration checksum drift")
                    print("Contact migration already applied")
                    return
                cursor.execute(sql)
                cursor.execute("INSERT INTO _migrations_log(name,checksum) VALUES(%s,%s)", (path.name, checksum(sql)))
        print("Contact identity migration applied")
    finally:
        connection.close()


if __name__ == "__main__":
    main()
