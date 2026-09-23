#!/usr/bin/env bash
set -euo pipefail

# One-time setup for the worker-only VPS deployment.
# This provisions only the voice worker; data and realtime services remain managed.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "Chatty voice worker setup (managed Supabase + LiveKit Cloud)"

apt-get update -qq
apt-get install -y -qq ca-certificates curl ufw

if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose plugin is required but was not found." >&2
  exit 1
fi

ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment "SSH"
printf 'y\n' | ufw enable >/dev/null

if [[ ! -f .env ]]; then
  cp .env.example .env
  chmod 600 .env
  echo "Created $SCRIPT_DIR/.env. Fill the required values, then rerun this script."
  exit 0
fi

if grep -Eq 'REPLACE_ME|YOUR_PROJECT|YOUR-PROJECT' .env; then
  echo "Replace all placeholder values in .env before starting the worker." >&2
  exit 1
fi

chmod 600 .env
docker compose up -d --build
docker compose ps
