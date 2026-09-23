# Managed Supabase hosting

Chatty uses Supabase Auth, Postgres, Storage, and Realtime as its managed data
layer. The application containers and the voice worker can run on any Docker
host without provisioning a replacement database or object store.

## Required environment

The API uses the managed Supabase profile by default. At minimum,
configure the Supabase URL and secret key, `SUPABASE_DB_HOST` and
`SUPABASE_DB_PASSWORD`, `FUNCTION_SECRET`, `BYOK_ENCRYPTION_KEY`, and
`GEMINI_API_KEY`. Keep all secret values in the platform's secret manager or an
untracked `.env` file. Never put them in a Dockerfile, frontend build argument,
or `NEXT_PUBLIC_*` variable.

## Run the API container

```bash
# Create an untracked .env from your secret manager or platform environment.
# It must use KEY=VALUE syntax and contain the required managed-Supabase keys.
docker compose -f backend/docker-compose.managed-supabase.yml up --build -d
curl http://localhost:8000/readyz
```

For the complete two-service stack, use the root `docker-compose.yml`. It
builds the frontend and API and requires only `backend/.env`, `frontend/.env`,
and the root public build-time variables.

## Platform deployment

For the full step-by-step production runbook, including Docker/VPS, Railway,
Render Blueprint, Heroku container commands, health checks, custom domains,
verification, rollback, and incident response, see the repository-level
[`docs/SELF_HOST_MANAGED_SUPABASE.md`](../../docs/SELF_HOST_MANAGED_SUPABASE.md).

Railway and Render can each build `Dockerfile` directly. Create one service for
the API and one for the Next.js frontend, set the public frontend/backend URLs,
and inject the same managed-Supabase secrets. Heroku-style platforms can run
the same images; use a separate web service for each container and the existing
Supabase project for persistence.

For voice, deploy only `voice-agent/` as a persistent worker. It connects
outbound to LiveKit Cloud and Supabase; it does not need database, queue,
object-storage, proxy, or LiveKit server containers.
