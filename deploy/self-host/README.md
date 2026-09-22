# Chatty self-host

This is the canonical, provider-neutral deployment contract for Chatty. It
runs the application with PostgreSQL + pgvector, Redis, and S3-compatible
object storage (MinIO by default). The same environment variables can be
mapped to managed PostgreSQL/Redis/S3 services on Coolify, Railway, Render,
DigitalOcean, Heroku-compatible platforms, or Kubernetes.

## One-click local install

From the repository root:

```powershell
.\deploy\self-host\install.ps1
```

The script creates local environment files from the examples, generates safe
development secrets, and starts the stack with Docker Compose. Open
`http://localhost:3000` when it finishes.

## Current migration boundary

The deployment layer is ready for provider-neutral storage, but the current
application release still contains Supabase auth/PostgREST adapters. Keep the
Supabase values in `backend/.env` and `frontend/.env` until the data/auth
migration is completed. PostgreSQL, Redis, and MinIO are provisioned now so
the migration can be rolled out without changing the hosting contract.

Do not put production secrets in the repository. Use the platform's secret
store for `FUNCTION_SECRET`, `BYOK_ENCRYPTION_KEY`, provider API keys, and
database credentials.

## Managed providers

Use `docker-compose.selfhost.yml` as the source of truth. For managed
platforms, supply the same variables and point `DATABASE_URL`, `REDIS_URL`,
and `S3_*` at the provider-managed services. No provider-specific SDK is
required by the deployment contract.
