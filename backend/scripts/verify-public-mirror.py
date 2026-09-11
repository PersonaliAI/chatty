"""Verify changed backend files are present in the public monorepo mirror."""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

MIRRORED_PREFIXES = (
    "main.py",
    "app/",
    "plugins/",
    "tests/",
    "sql/",
    "scripts/",
    "requirements.txt",
    "Dockerfile",
    "voice-agent/",
    "env.yaml",
    "env.yaml.example",
    "supabase/migrations/",
)


def is_mirrored(path: str) -> bool:
    return any(path == prefix or path.startswith(prefix) for prefix in MIRRORED_PREFIXES)


def main() -> int:
    mirror_root = os.environ.get("PUBLIC_MIRROR_DIR")
    if not mirror_root:
        raise RuntimeError("PUBLIC_MIRROR_DIR must point to a PersonaliAI/chatty checkout.")

    changed = subprocess.check_output(
        ["git", "diff", "--name-only", "HEAD^", "HEAD"],
        text=True,
    ).splitlines()

    failures: list[str] = []
    for rel in filter(is_mirrored, changed):
        private_file = Path(rel)
        public_file = Path(mirror_root) / "backend" / rel
        if not public_file.exists():
            failures.append(f"{rel}: missing from public mirror")
            continue
        if private_file.read_bytes() != public_file.read_bytes():
            failures.append(f"{rel}: contents differ from public mirror")

    if failures:
        print("Public backend mirror verification failed:", file=sys.stderr)
        for failure in failures:
            print(f"  - {failure}", file=sys.stderr)
        return 1

    print(f"Public backend mirror verified for {sum(1 for rel in changed if is_mirrored(rel))} changed file(s).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
