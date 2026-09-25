#!/usr/bin/env python3
"""Apply ordered Chatty PostgreSQL migrations exactly once.

The runner is intentionally small and dependency-light: psycopg2 is the only
runtime dependency. Each migration and its log row commit atomically, while a
PostgreSQL advisory lock prevents two release processes from applying the
schema concurrently. A changed file with an existing migration name is a hard
failure so migration history cannot silently drift.
"""

from __future__ import annotations

import argparse
import hashlib
import sys
from pathlib import Path
from typing import Any


MIGRATION_LOG_TABLE = "_migrations_log"
ADVISORY_LOCK_KEY = "chatty:migrations"


def migration_files(directory: Path) -> list[Path]:
    return sorted(path for path in directory.glob("*.sql") if path.is_file())


def checksum(contents: str) -> str:
    return hashlib.sha256(contents.encode("utf-8")).hexdigest()


def _ensure_log_table(cursor: Any) -> None:
    cursor.execute(
        f"""
        CREATE TABLE IF NOT EXISTS {MIGRATION_LOG_TABLE} (
          name TEXT PRIMARY KEY,
          checksum TEXT NOT NULL,
          applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )


def apply_migrations(connection: Any, directory: Path, *, dry_run: bool = False) -> tuple[int, int]:
    files = migration_files(directory)
    applied = 0
    skipped = 0
    with connection.cursor() as cursor:
        cursor.execute("SELECT pg_advisory_lock(hashtext(%s))", (ADVISORY_LOCK_KEY,))
        try:
            _ensure_log_table(cursor)
            connection.commit()
            for path in files:
                contents = path.read_text(encoding="utf-8")
                digest = checksum(contents)
                cursor.execute(
                    f"SELECT checksum FROM {MIGRATION_LOG_TABLE} WHERE name = %s",
                    (path.name,),
                )
                row = cursor.fetchone()
                if row:
                    if row[0] != digest:
                        raise RuntimeError(
                            f"migration checksum drift detected for {path.name}; "
                            "restore the original file or create a new migration"
                        )
                    skipped += 1
                    continue
                if dry_run:
                    print(f"  pending {path.name}")
                    applied += 1
                    continue
                print(f"  applying {path.name}")
                cursor.execute(contents)
                cursor.execute(
                    f"INSERT INTO {MIGRATION_LOG_TABLE} (name, checksum) VALUES (%s, %s)",
                    (path.name, digest),
                )
                connection.commit()
                applied += 1
        except Exception:
            connection.rollback()
            raise
        finally:
            cursor.execute("SELECT pg_advisory_unlock(hashtext(%s))", (ADVISORY_LOCK_KEY,))
            connection.commit()
    return applied, skipped


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("dsn", help="PostgreSQL connection URI")
    parser.add_argument("--dry-run", action="store_true", help="List pending migrations without applying them")
    args = parser.parse_args(argv)

    try:
        import psycopg2
    except ImportError:
        print("psycopg2-binary is required; install it with: pip install psycopg2-binary", file=sys.stderr)
        return 2

    directory = Path(__file__).resolve().parents[1] / "supabase" / "migrations"
    files = migration_files(directory)
    print(f"{len(files)} migration files found")
    connection = None
    try:
        connection = psycopg2.connect(args.dsn)
        applied, skipped = apply_migrations(connection, directory, dry_run=args.dry_run)
        verb = "would apply" if args.dry_run else "applied"
        print(f"Done - {verb} {applied} new, skipped {skipped} already-applied.")
        return 0
    except Exception as exc:
        print(f"Migration failed: {exc}", file=sys.stderr)
        return 1
    finally:
        if connection is not None:
            connection.close()


if __name__ == "__main__":
    raise SystemExit(main())
