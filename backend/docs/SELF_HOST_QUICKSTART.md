# Self-host Chatty (opt-in)

The managed Supabase deployment remains the default. This stack is an
isolated, opt-in deployment and does not migrate or modify the live Supabase
project.

## Start

```bash
cp env.self-host.example .env.self-host
# Replace every `replace-with-*` value, especially passwords and OIDC_AUDIENCE.
docker compose --env-file .env.self-host -f docker-compose.self-host.yml up -d --build
docker compose --env-file .env.self-host -f docker-compose.self-host.yml ps
curl http://localhost:8080/
```

The first run starts PostgreSQL 15/pgvector, Redis 7, private MinIO object
storage, the versioned schema runner, the API, and the Redis webhook worker.
The migration runner applies the additive files in
the canonical `supabase/migrations/` directory and records them in
`_chatty_schema_migrations`. The Supabase-only `pg_cron`/`pg_net` migration is
skipped; schedule the worker/cron endpoint with the host's scheduler instead.

For Windows, use PowerShell's equivalent copy command:

```powershell
Copy-Item env.self-host.example .env.self-host
docker compose --env-file .env.self-host -f docker-compose.self-host.yml up -d --build
```

## Identity and browser access

Self-host authentication uses OIDC JWTs (Google is supported with issuer
`https://accounts.google.com`; use the client ID as `OIDC_AUDIENCE`). Configure
the OIDC redirect/origin in the frontend deployment and keep
`ALLOWED_ORIGINS` exact. Do not use a Supabase service key in this profile.

## Backups and rollback

```bash
python scripts/self_host_backup.py backup --output backups
python scripts/self_host_backup.py restore backups/chatty-postgres-<timestamp>.dump --confirm
```

Run a restore drill in an isolated database before every production cutover.
Back up MinIO/S3 objects with the storage provider's encrypted snapshot/version
policy. Redis is a queue/cache and is not a database backup. Rollback remains a
traffic/configuration change back to the managed Supabase service; never point
the installer at the production Supabase database or run destructive SQL there.

## Production hardening

- Terminate TLS at a reverse proxy and keep PostgreSQL, Redis, and MinIO on the
  internal network; expose only the API/frontend.
- Use unique per-service credentials from a secret manager and rotate them.
- Keep the object bucket private; expose object reads through signed URLs or an
  authenticated TLS gateway, not a public MinIO policy.
- Run dependency, image, secret, migration, backup-restore, and smoke checks
  in CI before canary traffic.

