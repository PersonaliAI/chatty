"""Apply the additive Chatty flow migrations in order."""

import os
from pathlib import Path

import psycopg2


MIGRATIONS = (
    "20261003000000_flow_enable_state.sql",
    "20261003010000_chatty_flows.sql",
    "20261003020000_flow_run_identity.sql",
)


def main() -> None:
    connection = psycopg2.connect(
        host=os.environ.get("SUPABASE_DB_HOST", "db.dckjbkcormifiuwfpahj.supabase.co"),
        port=os.environ.get("SUPABASE_DB_PORT", "5432"),
        dbname=os.environ.get("SUPABASE_DB_NAME", "postgres"),
        user=os.environ.get("SUPABASE_DB_USER", "postgres"),
        password=os.environ["SUPABASE_DB_PASSWORD"],
        sslmode="require",
    )
    try:
        for migration in MIGRATIONS:
            sql = (Path(__file__).parents[1] / "supabase" / "migrations" / migration).read_text(encoding="utf-8")
            with connection:
                with connection.cursor() as cursor:
                    cursor.execute(sql)
            print(f"Applied {migration}")
    finally:
        connection.close()


if __name__ == "__main__":
    main()
