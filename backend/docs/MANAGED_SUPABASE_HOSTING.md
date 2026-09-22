# Managed Supabase hosting

This is the supported self-hosting path for Chatty: run the frontend and API
containers on your own host while keeping Supabase Auth, Postgres, Storage, and
Realtime managed. It replaces only the application hosting layer; it does not
copy or migrate the production Supabase project.

## Required environment

Set `DEPLOYMENT_PROFILE=managed_supabase` in the API environment. At minimum,
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

Railway and Render can each build `Dockerfile` directly. Create one service for
the API and one for the Next.js frontend, set the public frontend/backend URLs,
and inject the same managed-Supabase secrets. Heroku-style platforms can run
the same images; use a separate web service for each container and an external
Supabase project for persistence.

Do not run `backend/docker-compose.self-host.yml` for this profile. That file is
the advanced provider-neutral mode and provisions a separate
Postgres/Redis/object store; it is intentionally not part of the default
managed-Supabase path.
