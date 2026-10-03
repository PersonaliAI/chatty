"""Rollback-only database acceptance test; requires DB environment variables."""
import hashlib
import os
import uuid
from datetime import datetime, timedelta, timezone

import psycopg2


def main():
    connection = psycopg2.connect(host=os.environ["SUPABASE_DB_HOST"], user=os.environ["SUPABASE_DB_USER"],
        password=os.environ["SUPABASE_DB_PASSWORD"], dbname="postgres", port=os.environ.get("SUPABASE_DB_PORT", "5432"),
        sslmode="require", connect_timeout=10)
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT id FROM public.chatty_bots LIMIT 1")
            bot = cursor.fetchone()[0]
            external = f"acceptance-{uuid.uuid4()}"
            contacts = []
            for _ in range(2):
                cursor.execute("SELECT public.chatty_create_visitor(%s,%s,%s,%s,%s,%s)",
                    (bot, external, '{"name":"Rollback-only test"}', hashlib.sha256(uuid.uuid4().bytes).hexdigest(),
                     f"ci-{uuid.uuid4()}", datetime.now(timezone.utc) + timedelta(minutes=5)))
                contacts.append(cursor.fetchone()[0])
            assert contacts[0] == contacts[1], "Verified identities duplicated"
            for role in ("anon", "authenticated"):
                cursor.execute("SAVEPOINT permission_check")
                cursor.execute(f"SET LOCAL ROLE {role}")
                try:
                    cursor.execute("SELECT * FROM public.chatty_contacts")
                except psycopg2.errors.InsufficientPrivilege:
                    cursor.execute("ROLLBACK TO SAVEPOINT permission_check")
                else:
                    raise AssertionError(f"{role} can read private contacts")
            print("PASS: same-user atomic deduplication; anonymous/authenticated direct reads denied")
    finally:
        connection.rollback()
        connection.close()
        print("Acceptance fixtures rolled back")


if __name__ == "__main__":
    main()
