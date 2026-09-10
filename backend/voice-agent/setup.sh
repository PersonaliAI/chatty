#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Chatty Voice Stack — One-time VPS Setup Script
# ─────────────────────────────────────────────────────────────────────────────
# Run this once on a fresh Contabo VPS (Ubuntu 22.04/24.04).
# It installs Docker, configures the firewall, generates LiveKit API keys,
# and starts the full stack.
#
# Usage (as root on the VPS):
#   curl -sSL https://raw.githubusercontent.com/PersonaliAI/chatty/main/deploy/vps/setup.sh | bash
#   — or —
#   git clone https://github.com/PersonaliAI/chatty-backend.git
#   cd chatty-backend/voice-agent
#   chmod +x setup.sh && ./setup.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

echo "═══════════════════════════════════════════════════════════════"
echo "  Chatty Voice Stack — VPS Setup"
echo "═══════════════════════════════════════════════════════════════"

# ── 1. System updates ─────────────────────────────────────────────────────
echo ""
echo "▶ Step 1/6: Updating system packages..."
apt-get update -qq && apt-get upgrade -y -qq

# ── 2. Install Docker ─────────────────────────────────────────────────────
echo ""
echo "▶ Step 2/6: Installing Docker..."
if command -v docker &>/dev/null; then
    echo "  Docker already installed: $(docker --version)"
else
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
    echo "  Docker installed: $(docker --version)"
fi

# Ensure docker compose plugin is available
if ! docker compose version &>/dev/null; then
    echo "  Installing Docker Compose plugin..."
    apt-get install -y -qq docker-compose-plugin
fi
echo "  Docker Compose: $(docker compose version --short)"

# ── 3. Firewall (UFW) ────────────────────────────────────────────────────
echo ""
echo "▶ Step 3/6: Configuring firewall (UFW)..."
apt-get install -y -qq ufw

# SSH (always keep this!)
ufw allow 22/tcp comment "SSH"

# Caddy (HTTP + HTTPS for Let's Encrypt + WSS)
ufw allow 80/tcp comment "HTTP (ACME challenge)"
ufw allow 443/tcp comment "HTTPS / WSS (Caddy)"

# LiveKit TURN fallback (TCP) — for clients behind strict UDP firewalls
ufw allow 7881/tcp comment "LiveKit TURN/TCP fallback"

# LiveKit RTP media (UDP) — the actual audio/video packets
ufw allow 50000:50200/udp comment "LiveKit RTP media (UDP)"

# Enable UFW (non-interactive)
echo "y" | ufw enable
ufw status verbose
echo "  ✅ Firewall configured"

# ── 4. Generate LiveKit API keys ──────────────────────────────────────────
echo ""
echo "▶ Step 4/6: Generating LiveKit API keys..."

# Generate a key/secret pair using the official LiveKit server image
KEYS_OUTPUT=$(docker run --rm livekit/livekit-server generate-keys 2>/dev/null || true)

if [ -z "$KEYS_OUTPUT" ]; then
    # Fallback: generate random keys manually
    LIVEKIT_API_KEY="chatty_$(openssl rand -hex 8)"
    LIVEKIT_API_SECRET="$(openssl rand -hex 32)"
    echo "  Generated keys manually (livekit-server generate-keys unavailable)"
else
    # Parse the output (format: "API Key: xxx  Secret: yyy")
    LIVEKIT_API_KEY=$(echo "$KEYS_OUTPUT" | grep -oP 'API Key:\s*\K\S+' || echo "chatty_$(openssl rand -hex 8)")
    LIVEKIT_API_SECRET=$(echo "$KEYS_OUTPUT" | grep -oP 'Secret:\s*\K\S+' || echo "$(openssl rand -hex 32)")
    echo "  Generated keys via livekit-server"
fi

echo ""
echo "  ╔═══════════════════════════════════════════════════════════╗"
echo "  ║  LIVEKIT_API_KEY:    $LIVEKIT_API_KEY"
echo "  ║  LIVEKIT_API_SECRET: $LIVEKIT_API_SECRET"
echo "  ╚═══════════════════════════════════════════════════════════╝"
echo ""
echo "  ⚠️  SAVE THESE — you need them in .env AND in livekit.yaml"
echo "      AND in the Chatty API's Cloud Run env vars."

# ── 5. Detect public IP ──────────────────────────────────────────────────
echo ""
echo "▶ Step 5/6: Detecting public IP..."
PUBLIC_IP=$(curl -s https://api.ipify.org || curl -s https://ifconfig.me || echo "UNKNOWN")
echo "  Public IP: $PUBLIC_IP"

# ── 6. Create .env from template ─────────────────────────────────────────
echo ""
echo "▶ Step 6/6: Setting up configuration..."

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ ! -f "$SCRIPT_DIR/.env" ]; then
    cp "$SCRIPT_DIR/.env.example" "$SCRIPT_DIR/.env"
    # Substitute generated values
    sed -i "s|LIVEKIT_HOST=YOUR_VPS_PUBLIC_IP|LIVEKIT_HOST=$PUBLIC_IP|" "$SCRIPT_DIR/.env"
    sed -i "s|LIVEKIT_API_KEY=CHATTY_VOICE_KEY|LIVEKIT_API_KEY=$LIVEKIT_API_KEY|" "$SCRIPT_DIR/.env"
    sed -i "s|LIVEKIT_API_SECRET=CHATTY_VOICE_SECRET_REPLACE_ME|LIVEKIT_API_SECRET=$LIVEKIT_API_SECRET|" "$SCRIPT_DIR/.env"
    echo "  Created .env with generated keys"
else
    echo "  .env already exists — skipping (delete it to regenerate)"
fi

# Update livekit.yaml with the generated key/secret
sed -i "s|CHATTY_VOICE_KEY: CHATTY_VOICE_SECRET_REPLACE_ME|$LIVEKIT_API_KEY: $LIVEKIT_API_SECRET|" "$SCRIPT_DIR/livekit.yaml"
echo "  Updated livekit.yaml with API keys"

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  ✅ Setup complete!"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "  Next steps:"
echo ""
echo "  1. Point DNS:  $DOMAIN → $PUBLIC_IP  (A record)"
echo ""
echo "  2. Edit .env:  Fill in SUPABASE_URL, SUPABASE_SERVICE_KEY,"
echo "                 GEMINI_API_KEY, and any STT/TTS provider keys."
echo ""
echo "  3. Start:      cd $SCRIPT_DIR && docker compose up -d"
echo ""
echo "  4. Verify:     docker compose logs -f"
echo "                 curl -I https://$DOMAIN"
echo ""
echo "  5. Update Chatty API env vars (Cloud Run):"
echo "     LIVEKIT_URL=wss://$DOMAIN"
echo "     LIVEKIT_API_KEY=$LIVEKIT_API_KEY"
echo "     LIVEKIT_API_SECRET=$LIVEKIT_API_SECRET"
echo ""
echo "═══════════════════════════════════════════════════════════════"
