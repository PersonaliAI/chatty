# Chatty Voice Stack — Self-Hosted VPS Deployment

Fully self-hosted **LiveKit Server + Redis + Caddy + Chatty Voice Worker** stack designed to run on a single **Contabo VPS 4** (4 vCPU / 8 GB RAM / €4.40/mo) or any Ubuntu VPS.

Zero LiveKit Cloud dependency — all API keys and JWT signing are self-hosted and self-generated.

---

## Architecture

```
Internet (Browser / Widget)
   │
   ▼ (HTTPS / WSS via Let's Encrypt)
[Caddy :80/:443]
   │
   ▼ (ws://localhost:7880)
[LiveKit Server :7880 / :7881 / :50000-50200 UDP] ◄──► [Redis :6379]
   ▲
   │ (job dispatch via internal Docker network)
   ▼
[Voice Worker (voice_worker.py)]
   │
   ├──► Supabase (conversations, bot settings, owner lookup)
   └──► LLM / STT / TTS APIs (Gemini, Google, Deepgram, Cartesia, ElevenLabs, etc.)
```

---

## 1. Prerequisites

1. **A VPS running Ubuntu 22.04 or 24.04** (e.g., Contabo Cloud VPS 4).
2. **A Domain Name** pointing an `A` record to your VPS Public IP:
   - Example: `livekit.personaliai.com` ──► `123.45.67.89`

---

## 2. Quick Setup (Automated)

SSH into your VPS as `root` and run:

```bash
git clone https://github.com/PersonaliAI/chatty-backend.git /opt/chatty-backend
cd /opt/chatty-backend/voice-agent
chmod +x setup.sh
./setup.sh
```

The script will:
1. Install Docker and Docker Compose plugin
2. Configure UFW Firewall (SSH 22, HTTP 80, HTTPS 443, LiveKit TCP 7881, UDP 50000-50200)
3. Auto-generate a secure `LIVEKIT_API_KEY` and `LIVEKIT_API_SECRET`
4. Detect the public IP and write `.env` and `livekit.yaml`

---

## 3. Configure `.env`

Open `/opt/chatty-backend/voice-agent/.env`:

```bash
nano /opt/chatty-backend/voice-agent/.env
```

Ensure these variables are filled in:

```ini
DOMAIN=livekit.personaliai.com
LIVEKIT_HOST=<YOUR_VPS_PUBLIC_IP>
LIVEKIT_API_KEY=<GENERATED_KEY>
LIVEKIT_API_SECRET=<GENERATED_SECRET>

SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJh...
GEMINI_API_KEY=AIza...
BYOK_ENCRYPTION_KEY=...
```

---

## 4. Start the Stack

```bash
cd /opt/chatty-backend/voice-agent
docker compose up -d --build
```

View live logs:

```bash
docker compose logs -f
```

---

## 5. Connect Chatty API (Cloud Run)

In your main backend API (running on Cloud Run or wherever Chatty API is hosted), update the environment variables:

```ini
LIVEKIT_URL=wss://livekit.personaliai.com
LIVEKIT_API_KEY=<GENERATED_KEY>
LIVEKIT_API_SECRET=<GENERATED_SECRET>
```

Restart or redeploy the API service.

---

## 6. Verification

1. **Caddy & SSL:**
   ```bash
   curl -I https://livekit.personaliai.com
   ```
   Should return `HTTP/2 200` or `404` (LiveKit returns 404 on root HTTP GET, which is expected since it listens for WebSocket upgrades).

2. **LiveKit Connection Tester:**
   Visit https://livekit.io/connection-test and enter `wss://livekit.personaliai.com` with your key and secret.

3. **Check Container Status:**
   ```bash
   docker compose ps
   ```
   All 4 containers (`caddy`, `livekit`, `redis`, `voice-worker`) should be in `Up` state.

---

## Maintenance & Updates

To update the voice worker after making code changes:

```bash
cd /opt/chatty-backend
git pull
cd voice-agent
docker compose up -d --build voice-worker
```
