# Chatty AI Voice Worker VPS Deployment Guide

This guide details how to deploy the LiveKit media plane (LiveKit Server + Redis + Caddy TLS) and the persistent **Chatty Voice Worker** container to a standalone Virtual Private Server (VPS).

---

## 1. Architecture Overview

```
+--------------------------------------------------------------+
|                          VPS Host                            |
|                                                              |
|   +-------------+       +-------------------+                |
|   |    Caddy    | ----> |  LiveKit Server   | <---> [Redis]  |
|   |  (TLS / 443)| (WSS) |  (host net: 7880) |                |
|   +-------------+       +-------------------+                |
|          ^                        ^                          |
|          | (WSS Token)            | (Internal WS)            |
|          |                        |                          |
|  [Browser Clients]      +-------------------+                |
|                         |   Voice Worker    |                |
|                         | (Docker container)|                |
|                         +-------------------+                |
|                                   |                          |
|                                   v                          |
|                    [Managed Supabase + Gemini API]           |
+--------------------------------------------------------------+
```

- **Voice Worker**: Runs in Docker with Python 3.11, connects directly to LiveKit at `ws://host.docker.internal:7880` via internal Docker networking, and executes real-time AI voice conversations.
- **Backend API**: Runs on Google Cloud Run (`api.chatty.personaliai.com`), generating signed LiveKit access tokens for incoming calls pointing to `wss://<YOUR_VPS_DOMAIN>`.
- **Frontend Widget & Dashboard**: Hosted on Firebase App Hosting (`chatty.personaliai.com`).

---

## 2. Server Requirements

- **OS**: Ubuntu 22.04 LTS or Ubuntu 24.04 LTS
- **Hardware**: Minimum 2 vCPU / 4 GB RAM (Recommended: 4 vCPU / 8 GB RAM for high concurrency)
- **Networking**: Public static IPv4 address
- **DNS**: An `A` record pointing your domain or subdomain to the VPS IPv4 address:
  - Example: `livekit.chatty.personaliai.com` $\rightarrow$ `YOUR_VPS_IP`

---

## 3. Deployment Steps on VPS

### Step 1: Clone Repository onto VPS
```bash
git clone https://github.com/PersonaliAI/chatty.git
cd chatty/backend/voice-agent
```

### Step 2: Configure Environment
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
chmod 600 .env
```

Edit `.env` with your editor:
```bash
nano .env
```
Fill in the following values:
```env
# 1. Host & Domain Settings
DOMAIN=livekit.chatty.personaliai.com
LIVEKIT_HOST=<YOUR_VPS_PUBLIC_IPV4>

# 2. Managed Supabase Project
SUPABASE_URL=https://<YOUR_PROJECT_ID>.supabase.co
SUPABASE_SECRET_KEY=sb_secret_<YOUR_SERVICE_ROLE_KEY>

# 3. AI Providers
GEMINI_API_KEY=<YOUR_GEMINI_API_KEY>
BYOK_ENCRYPTION_KEY=<YOUR_BACKEND_ENCRYPTION_KEY>

# 4. (Optional) Alternative STT/TTS Providers
OPENAI_API_KEY=
DEEPGRAM_API_KEY=
ELEVENLABS_API_KEY=
CARTESIA_API_KEY=
```

### Step 3: Run Automated Setup Script
Run the automated provisioner as `root` (or with `sudo`):
```bash
sudo ./setup.sh
```

**What `setup.sh` does automatically**:
1. Installs Docker and Docker Compose plugin if missing.
2. Configures the `ufw` firewall:
   - Port `22/tcp`: SSH
   - Port `80/tcp`: ACME HTTP TLS Challenge
   - Port `443/tcp`: Caddy HTTPS & WSS Proxy
   - Port `7881/tcp`: LiveKit WebRTC TCP Fallback
   - Ports `50000-60000/udp`: LiveKit WebRTC UDP Audio Media
   - Port `7880/tcp`: Restricted to Docker internal bridge network (`172.16.0.0/12`)
3. Automatically generates secure `LIVEKIT_API_KEY` and `LIVEKIT_API_SECRET`.
4. Updates `livekit.yaml` and `.env` with matching credentials.
5. Obtains Let's Encrypt SSL/TLS certificates via Caddy.
6. Boots LiveKit, Redis, Caddy, and `voice-worker` via `docker compose --profile self-hosted up -d --build`.

---

## 4. Connect Cloud Run Backend to the VPS Voice Worker

After running `setup.sh`, inspect the generated keys in `.env`:
```bash
grep -E "LIVEKIT_URL|LIVEKIT_API_KEY|LIVEKIT_API_SECRET" .env
```
Copy these 3 values to your Cloud Run Backend API configuration (`chatty/backend/env.yaml`):
```yaml
LIVEKIT_URL: "wss://livekit.chatty.personaliai.com"
LIVEKIT_API_KEY: "CHATTY_..."
LIVEKIT_API_SECRET: "..."
```

Deploy the Backend API to Google Cloud Run so it issues tokens matching this LiveKit instance.

---

## 5. Maintenance & Useful Commands

- **Check Service Status**:
  ```bash
  docker compose --profile self-hosted ps
  ```
- **View Live Worker Logs**:
  ```bash
  docker compose logs -f voice-worker
  ```
- **Restart Voice Stack**:
  ```bash
  docker compose --profile self-hosted restart
  ```
- **Update to Latest Code**:
  ```bash
  git pull origin main
  docker compose --profile self-hosted up -d --build voice-worker
  ```
