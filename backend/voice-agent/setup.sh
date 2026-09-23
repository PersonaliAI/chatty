#!/usr/bin/env bash
set -euo pipefail

# Provision only the optional self-hosted LiveKit media plane. Supabase Auth,
# Postgres, Storage, the Chatty API, and the model provider remain managed.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run this script as root (for example: sudo ./setup.sh)." >&2
  exit 1
fi

echo "Chatty self-hosted LiveKit setup"
echo "This installs LiveKit + Redis + Caddy only; Supabase remains managed."

apt-get update -qq
apt-get install -y -qq ca-certificates curl openssl ufw

if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose plugin is required but was not found." >&2
  exit 1
fi

if [[ ! -f .env ]]; then
  cp .env.example .env
  chmod 600 .env
  echo "Created $SCRIPT_DIR/.env. Fill SUPABASE_URL, SUPABASE_SECRET_KEY,"
  echo "GEMINI_API_KEY, and BYOK_ENCRYPTION_KEY, then run this script again."
  exit 0
fi

read_env() {
  local name="$1"
  grep -E "^${name}=" .env | tail -n 1 | cut -d= -f2- || true
}

set_env() {
  local name="$1" value="$2"
  local escaped
  escaped="$(printf '%s' "$value" | sed 's/[\\&|]/\\&/g')"
  if grep -qE "^${name}=" .env; then
    sed -i "s|^${name}=.*|${name}=${escaped}|" .env
  else
    printf '\n%s=%s\n' "$name" "$value" >> .env
  fi
}

DOMAIN="${DOMAIN:-$(read_env DOMAIN)}"
if [[ -z "$DOMAIN" || "$DOMAIN" == "livekit.example.com" ]]; then
  read -r -p "DNS hostname for LiveKit (for example livekit.example.com): " DOMAIN
fi
if [[ ! "$DOMAIN" =~ ^[A-Za-z0-9.-]+$ ]]; then
  echo "DOMAIN must be a hostname, not a URL or path." >&2
  exit 1
fi

LIVEKIT_HOST="${LIVEKIT_HOST:-$(read_env LIVEKIT_HOST)}"
if [[ -z "$LIVEKIT_HOST" || "$LIVEKIT_HOST" == "203.0.113.10" ]]; then
  LIVEKIT_HOST="$(curl -4 -fsSL --max-time 10 https://api.ipify.org || true)"
fi
if [[ -z "$LIVEKIT_HOST" ]]; then
  read -r -p "Public IPv4 address of this VPS: " LIVEKIT_HOST
fi

API_KEY="$(read_env LIVEKIT_API_KEY)"
API_SECRET="$(read_env LIVEKIT_API_SECRET)"
if [[ -z "$API_KEY" || "$API_KEY" == "REPLACE_ME" ]]; then
  API_KEY="CHATTY_$(openssl rand -hex 8)"
fi
if [[ -z "$API_SECRET" || "$API_SECRET" == "REPLACE_ME" ]]; then
  API_SECRET="$(openssl rand -hex 32)"
fi

set_env DOMAIN "$DOMAIN"
set_env LIVEKIT_HOST "$LIVEKIT_HOST"
set_env LIVEKIT_URL "wss://${DOMAIN}"
# The LiveKit service uses host networking so Docker does not create a proxy
# process for every UDP media port. The worker stays isolated in the Compose
# bridge network and reaches the host endpoint through Docker's gateway alias.
set_env LIVEKIT_WORKER_URL "ws://host.docker.internal:7880"
set_env LIVEKIT_API_KEY "$API_KEY"
set_env LIVEKIT_API_SECRET "$API_SECRET"
chmod 600 .env

# LiveKit's static YAML must use the same key pair the API uses to mint tokens.
sed -i "s|^  CHATTY_VOICE_KEY:.*|  ${API_KEY}: ${API_SECRET}|" livekit.yaml

# Caddy needs the hostname to be resolvable before it can obtain a certificate.
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment "SSH"
ufw allow 80/tcp comment "ACME HTTP"
ufw allow 443/tcp comment "LiveKit WSS"
ufw allow 7881/tcp comment "LiveKit ICE TCP"
ufw allow 50000:60000/udp comment "LiveKit WebRTC UDP"
printf 'y\n' | ufw enable >/dev/null

if grep -Eq 'REPLACE_ME|YOUR_PROJECT|YOUR-PROJECT|example\.com|203\.0\.113\.10' .env; then
  echo "Replace remaining placeholders in .env before starting the stack." >&2
  exit 1
fi

docker compose --profile self-hosted config >/dev/null
docker compose --profile self-hosted up -d --build
docker compose --profile self-hosted ps

echo
echo "LiveKit is running at wss://${DOMAIN}"
echo "Set the same LIVEKIT_URL/API_KEY/API_SECRET in the Chatty API environment."
echo "The worker uses ws://livekit:7880 inside Docker; do not expose port 7880."
