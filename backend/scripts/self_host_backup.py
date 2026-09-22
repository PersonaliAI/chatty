"""Create or restore a self-host PostgreSQL backup through Compose.

Database restore is intentionally an explicit operation. Object storage and
Redis are separate durability domains and must be backed up by the operator's
S3/volume snapshot policy; Redis is a queue/cache, never the source of truth.
"""

from __future__ import annotations

import argparse
import datetime as dt
import subprocess
from pathlib import Path


def compose_args(env_file: str, compose_file: str) -> list[str]:
    return ["docker", "compose", "--env-file", env_file, "-f", compose_file]


def backup(args: argparse.Namespace) -> None:
    output_dir = Path(args.output).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    stamp = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    output = output_dir / f"chatty-postgres-{stamp}.dump"
    command = compose_args(args.env_file, args.compose_file) + [
        "exec", "-T", "postgres", "sh", "-ec",
        "pg_dump --format=custom --no-owner --no-acl -U \"$POSTGRES_USER\" --dbname \"$POSTGRES_DB\"",
    ]
    with output.open("wb") as handle:
        subprocess.run(command, check=True, stdout=handle)
    print(output)


def restore(args: argparse.Namespace) -> None:
    if not args.confirm:
        raise SystemExit("restore is destructive; rerun with --confirm")
    source = Path(args.input).resolve()
    if not source.is_file() or source.stat().st_size == 0:
        raise SystemExit(f"backup not found or empty: {source}")
    command = compose_args(args.env_file, args.compose_file) + [
        "exec", "-T", "postgres", "sh", "-ec",
        "pg_restore --clean --if-exists --no-owner --no-acl -U \"$POSTGRES_USER\" --dbname \"$POSTGRES_DB\"",
    ]
    with source.open("rb") as handle:
        subprocess.run(command, check=True, stdin=handle)
    print(f"restored {source}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--env-file", default=".env.self-host")
    parser.add_argument("--compose-file", default="docker-compose.self-host.yml")
    sub = parser.add_subparsers(dest="action", required=True)
    make = sub.add_parser("backup")
    make.add_argument("--output", default="backups")
    load = sub.add_parser("restore")
    load.add_argument("input")
    load.add_argument("--confirm", action="store_true")
    args = parser.parse_args()
    if args.action == "backup":
        backup(args)
    else:
        restore(args)


if __name__ == "__main__":
    main()
