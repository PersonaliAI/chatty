# Chatty voice worker on a VPS

This directory deploys only Chatty's persistent LiveKit agent worker. The
production data plane remains managed:

```text
Chatty API/dashboard ──┬── Supabase (managed Auth, Postgres, Storage, Realtime)
                       └── LiveKit Cloud (managed realtime media)
                                  ▲
                                  │ outbound WebSocket only
                           VPS: Chatty voice worker
```

The VPS does **not** run the database, queue, object storage, proxy, or a LiveKit
server. No public worker port is required.

## Requirements

- Ubuntu 22.04 or 24.04 VPS
- Docker Engine and the Compose plugin
- LiveKit Cloud project credentials
- The same managed Supabase URL/secret used by the Chatty API
- Gemini and BYOK encryption keys used by the production backend

## Install

```bash
git clone https://github.com/PersonaliAI/chatty-backend.git /opt/chatty-backend
cd /opt/chatty-backend/voice-agent
cp .env.example .env
chmod 600 .env
nano .env
```

Fill every `REPLACE_ME` value, then start the worker:

```bash
docker compose up -d --build
docker compose ps
docker compose logs -f voice-worker
```

The worker registers in the LiveKit Cloud agent dashboard and remains in the
`running` state. It makes outbound connections to LiveKit Cloud, Supabase, and
the configured model providers; it does not accept internet requests.

## Updates

```bash
cd /opt/chatty-backend
git pull --ff-only
cd voice-agent
docker compose up -d --build --force-recreate voice-worker
docker compose logs --tail=200 voice-worker
```

Keep the previous image available until the new worker has registered and
handled a test call. Take a provider snapshot before upgrades.

## Security baseline

- Use SSH keys and disable password/root SSH login.
- Allow inbound SSH only; keep worker ports closed.
- Keep `.env` mode `600` and never commit it.
- Pin production image/dependency versions and rotate provider keys regularly.
- Configure Docker restart-on-failure and host security updates.
