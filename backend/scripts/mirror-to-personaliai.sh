#!/usr/bin/env bash
# Mirrors a commit range from backend-service (root-level layout) onto
# personaliai-main (backend/ monorepo layout), verifies it, commits, and
# pushes to PersonaliAI/chatty — replacing the manual diff+sed+apply dance
# documented in AGENTS.md with one command.
#
# Usage:
#   scripts/mirror-to-personaliai.sh [<commit-range>]
#
# <commit-range> defaults to HEAD~1..HEAD (the last commit). Pass an
# explicit range (e.g. abc123..HEAD) to mirror several commits at once —
# they'll land as a single squashed commit on personaliai-main, since the
# two branches' histories are unrelated anyway and don't need a 1:1 commit
# mapping.
#
# Must be run from a clean backend-service checkout (uncommitted changes on
# either branch abort the run rather than risk clobbering them). Leaves the
# repo back on backend-service when done, whether it succeeded or failed.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

RANGE="${1:-HEAD~1..HEAD}"
TMP_DIFF="$(mktemp)"
trap 'rm -f "$TMP_DIFF"' EXIT

if [[ -n "$(git status --porcelain)" ]]; then
  echo "error: working tree is dirty on $(git branch --show-current) — commit or stash first." >&2
  exit 1
fi

CURRENT_BRANCH="$(git branch --show-current)"
if [[ "$CURRENT_BRANCH" != "backend-service" ]]; then
  echo "error: must be run from backend-service (currently on $CURRENT_BRANCH)." >&2
  exit 1
fi

# Captured now, while still on backend-service — resolving this after the
# `git checkout personaliai-main` below would resolve "HEAD" (or any other
# backend-service-relative ref in $RANGE) against personaliai-main instead,
# silently reusing whatever commit message personaliai-main's HEAD already
# had (i.e. the previous mirror commit's message).
COMMIT_MSG="$(git log --format=%B -1 "${RANGE#*..}" 2>/dev/null || echo "Mirror from backend-service")"

echo "==> Diffing $RANGE (excluding files that don't mirror: .github/, README.md, AGENTS.md, CLAUDE.md, LICENSE, CONTRIBUTING.md, check_user_ids.*)"
git diff "$RANGE" -- \
  ':!.github' ':!README.md' ':!AGENTS.md' ':!CLAUDE.md' ':!LICENSE' ':!CONTRIBUTING.md' ':!check_user_ids.*' \
  > "$TMP_DIFF"

if [[ ! -s "$TMP_DIFF" ]]; then
  echo "Nothing to mirror (diff is empty after exclusions)."
  exit 0
fi

# Path rewrite: every top-level dir/file that exists at repo root here moves
# under backend/ on personaliai-main. Add new entries here if the root-level
# layout ever grows a new top-level path. Done in Python, not sed — git's
# "diff --git a/X b/X" line puts both paths on one line, which a
# line-oriented sed substitution can't rewrite independently and correctly.
python - "$TMP_DIFF" <<'PYEOF'
import re, sys
path = sys.argv[1]
MIRRORED_PREFIXES = (
    "main.py", "app/", "plugins/", "tests/", "sql/", "scripts/",
    "requirements.txt", "Dockerfile", "Dockerfile.voice-worker",
    "voice_worker.py", "env.yaml", "env.voice-worker.yaml",
    "supabase/migrations/",
)

def rewrite_path(p):
    for prefix in MIRRORED_PREFIXES:
        if p == prefix or p.startswith(prefix):
            return "backend/" + p
    return p

text = open(path, encoding="utf-8").read()
lines = text.split("\n")
out = []
for line in lines:
    m = re.match(r"^diff --git a/(.+) b/(.+)$", line)
    if m:
        a, b = rewrite_path(m.group(1)), rewrite_path(m.group(2))
        out.append(f"diff --git a/{a} b/{b}")
        continue
    m = re.match(r"^(--- a)/(.+)$", line)
    if m:
        out.append(f"{m.group(1)}/{rewrite_path(m.group(2))}")
        continue
    m = re.match(r"^(\+\+\+ b)/(.+)$", line)
    if m:
        out.append(f"{m.group(1)}/{rewrite_path(m.group(2))}")
        continue
    out.append(line)
open(path, "w", encoding="utf-8").write("\n".join(out))
PYEOF

echo "==> Switching to personaliai-main"
git checkout personaliai-main

# Clean up untracked leftovers from the backend-service layout switch (a
# known gotcha — see AGENTS.md).
git clean -fdx -- app plugins tests __pycache__ frontend >/dev/null 2>&1 || true

if [[ -n "$(git status --porcelain)" ]]; then
  echo "error: personaliai-main working tree is dirty — aborting before it gets touched." >&2
  git checkout backend-service
  exit 1
fi

echo "==> Applying mirrored diff"
if ! git apply --check "$TMP_DIFF" 2>/tmp/mirror_apply_check.log; then
  echo "error: mirrored diff does not apply cleanly. Falling back to manual mirroring for this change." >&2
  cat /tmp/mirror_apply_check.log >&2
  git checkout backend-service
  exit 1
fi
git apply "$TMP_DIFF"

echo "==> Verifying: compile-check + pytest"
python -m compileall -q backend/main.py backend/app backend/plugins
(cd backend && python -m pytest tests/ -q)

echo "==> Committing"
git add -A -- backend/
git commit -m "$COMMIT_MSG"

echo "==> Pushing to PersonaliAI/chatty"
git push personaliai personaliai-main:main

echo "==> Switching back to backend-service"
git checkout backend-service

echo "Done. Don't forget: gcloud run deploy chatty-api --source . --region=us-central1 --project=personaliai --clear-base-image --quiet"
