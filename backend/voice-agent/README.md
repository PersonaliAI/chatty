# Chatty voice worker and optional self-hosted LiveKit

The voice deployment has two interchangeable media transports:

```text
                         ┌── LiveKit Cloud ─────────┐
Chatty API ── Supabase ──┤                           ├── browser voice call
                         └── VPS: LiveKit + Redis ───┘
                                     │
                              Chatty voice worker
```

Supabase remains the source of truth for Auth, Postgres, Storage, and
Realtime. Self-hosting here replaces only the LiveKit media/signaling layer;
it does not bring back a second database, object store, auth server, or API.

## Option A: LiveKit Cloud

Use this when you do not want to operate a media server:

```bash
cd voice-agent
cp .env.example .env
chmod 600 .env
# Set LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET,
# SUPABASE_URL, SUPABASE_SECRET_KEY, GEMINI_API_KEY, and BYOK_ENCRYPTION_KEY.
docker compose up -d --build
docker compose logs -f voice-worker
```

The worker makes outbound connections to LiveKit Cloud, Supabase, and the
configured model providers. It does not accept internet requests.

## Option B: self-host LiveKit on an Ubuntu VPS

### 1. DNS and firewall prerequisites

Create an A record such as `livekit.example.com` pointing to the VPS public
IPv4 address. Do not put the Chatty API or Supabase credentials in DNS or in a
browser bundle. The setup script opens only SSH, ACME/TLS, LiveKit ICE TCP, and
the LiveKit WebRTC UDP range.

### 2. Install the stack

```bash
git clone https://github.com/PersonaliAI/chatty.git /opt/chatty
cd /opt/chatty/backend/voice-agent
cp .env.example .env
chmod 600 .env
nano .env
sudo ./setup.sh
```

On its first run the script installs Docker and UFW, creates the configuration,
and tells you which managed Supabase/model values are still required. On the
next run it generates a LiveKit key pair, writes the matching `livekit.yaml`,
validates Compose, and starts LiveKit, Redis, Caddy, and the worker:

```bash
docker compose --profile self-hosted ps
docker compose --profile self-hosted logs -f livekit voice-worker
```

Caddy obtains the TLS certificate for `DOMAIN`. The public endpoint is
`wss://DOMAIN`; the worker uses the private Docker gateway path
`ws://host.docker.internal:7880`. LiveKit and Caddy use host networking so
the 50,000-port UDP media range is bound directly without creating one
Docker proxy process per port. Redis remains bound to `127.0.0.1:6379` only.
Set `LIVEKIT_URL`, `LIVEKIT_API_KEY`, and `LIVEKIT_API_SECRET` to the same
values in the Chatty API deployment. Never publish port 7880 or Redis port
6379.

### 3. VPS sizing and ports

A 4 vCPU / 8 GB VPS is a sensible starting point for the LiveKit server plus a
small voice worker. Capacity depends on concurrent calls and STT/TTS provider
latency; monitor CPU, memory, packet loss, and UDP saturation before adding
users. The Compose stack exposes:

| Port | Purpose | Public? |
| --- | --- | --- |
| 80/tcp | ACME certificate validation | Yes |
| 443/tcp | LiveKit signaling over WSS | Yes |
| 7881/tcp | ICE/TCP fallback | Yes |
| 50000–60000/udp | WebRTC media | Yes |
| 6379/tcp | Redis coordination | No |
| 7880/tcp | LiveKit HTTP/signaling upstream | No |

The base config uses UDP/TCP ICE. If users must connect from networks that
block UDP, add and secure a LiveKit TURN/TLS endpoint separately; do not expose
Redis or the internal 7880 endpoint as a workaround.

## Operations

```bash
# Update deliberately; keep the previous image available for rollback.
git pull --ff-only
docker compose --profile self-hosted pull
docker compose --profile self-hosted up -d --build
docker compose --profile self-hosted ps

# Stop only the optional self-hosted media plane.
docker compose --profile self-hosted down
```

Pin `LIVEKIT_SERVER_IMAGE`, `REDIS_IMAGE`, and `CADDY_IMAGE` to reviewed
versions in `.env` before production upgrades. Back up the `caddy_data` and
`redis_data` volumes, rotate LiveKit/API keys, and keep the VPS kernel and
Docker packages patched. Use SSH keys, disable password/root SSH login, and
keep `.env` mode `600`.

The worker bounds every knowledge-base, catalog, and booking tool call with
`VOICE_TOOL_TIMEOUT_SECONDS` (default `20`, accepted range `5`–`120`). Keep
the default unless provider latency measurements justify a change. Each call
also records duration, first-response latency, turns, nudges, errors, CPU time,
and peak RSS for capacity planning; the shutdown path is idempotent so a call
is never recorded twice.

## Provider requirements

The worker still requires the same managed Supabase and model-provider secrets
as the Cloud Run deployment. LiveKit self-hosting does not remove the need for
STT, LLM, or TTS credentials; it only changes where realtime media rooms run.
