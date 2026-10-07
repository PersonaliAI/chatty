# Managed Supabase hosting

Chatty uses Supabase Auth, Postgres, Storage, and Realtime as its managed data
layer. The application containers can run on any Docker host without
provisioning a replacement database or object store.

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
docker compose -f docker-compose.managed-supabase.yml up --build -d
curl http://localhost:8000/ready
```

For the complete two-service stack, use the root `docker-compose.yml` in the
public repository. It builds the frontend and API and requires only
`backend/.env`, `frontend/.env`, and the root public build-time variables.

## Platform deployment

Railway and Render can each build `Dockerfile` directly. Create one service for
the API and one for the Next.js frontend, set the public frontend/backend URLs,
and inject the same managed-Supabase secrets. Heroku-style platforms can run
the same images; use a separate web service for each container and the existing
Supabase project for persistence.
