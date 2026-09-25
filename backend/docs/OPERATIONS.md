# Chatty operations runbook

This runbook describes the supported production path. Chatty keeps the
application portable across Docker hosts while Supabase remains the managed
data service. Realtime voice can use LiveKit Cloud or the optional self-hosted
LiveKit profile documented in `voice-agent/README.md`.

## Environments

| Environment | Frontend | API | Data | Deployment owner |
|---|---|---|---|---|
| Local | Next.js dev server | FastAPI/Uvicorn | Managed Supabase project | Developer |
| Hosted | Firebase App Hosting | Cloud Run | Managed PostgreSQL/Supabase | PersonaliAI |
| Voice worker | Any Ubuntu Docker host | LiveKit worker container | Managed Supabase + LiveKit Cloud, or self-hosted LiveKit + private Redis | Operator |

Never copy production secrets into `.env.example`, a Docker image, a browser
bundle, or a GitHub repository. Use Secret Manager, an equivalent vault, or a
local ignored `.env` file.

## Local verification

```powershell
cd chatty-backend
docker compose up -d postgres redis
$env:PYTHONPATH='.'
pytest -q
uvicorn main:app --reload --port 8000
```

The minimum release gate is the full backend test suite, Python compilation,
`git diff --check`, and a smoke request to `/health` (or the deployment's
configured health endpoint). A release must not be promoted when migrations
are pending or secrets are detected by the repository scanner.

## Cloud Run release checklist

1. Build the immutable image from the commit being released.
2. Run tests and the secret scanner in CI.
3. Apply versioned database migrations before routing traffic.
4. Publish the image to the regional registry.
5. Deploy a new Cloud Run revision with secrets injected from Secret Manager.
6. Verify health, widget configuration, authentication, booking, and webhook
   flows against the revision URL.
7. Shift traffic gradually; keep the previous revision available for rollback.

Cloud Run services must use a bounded request timeout, a minimum instance count
appropriate for latency requirements, and separate worker capacity for long
running crawling, embedding, email, and webhook jobs.

## Data and reliability rules

- PostgreSQL migrations are additive first and destructive only after a release
  has proved the old code path is unused.
- Every tenant query includes its bot/organization scope.
- Webhooks and booking side effects require idempotency keys and retry limits.
- Audit events are append-only and must not contain credentials or raw secrets.
- Queue consumers are safe to restart and can process a message more than once.
- Backups must be restorable in a clean environment, not merely present.

The default job stream is `chatty:jobs`; webhook delivery uses
`chatty:webhooks` when `CHATTY_JOB_QUEUE_URL` is configured. Consumers must claim work with a
consumer group, acknowledge only after the side effect is durable, and move
poison messages to a dead-letter stream after the configured retry limit.

The reference worker implementation is `app/workers/job_worker.py`. For the
built-in webhook stream, run the production entrypoint as a separate service:

```bash
CHATTY_JOB_QUEUE_URL=redis://redis:6379/0 python -m app.workers.webhook_worker
```

The built-in worker handles `webhook.deliver`, `woocommerce.sync`,
`email.ticket_reply`, and `whatsapp.message`. Human replies and WhatsApp
messages therefore remain recoverable across API restarts when the durable
queue is configured; WhatsApp jobs are serialized per bot and sender.

Run one consumer process per worker identity. The entrypoint derives a unique
consumer name from the host and process ID, and supports `CHATTY_WORKER_GROUP`,
`CHATTY_WORKER_MAX_ATTEMPTS`, `CHATTY_WORKER_PENDING_IDLE_MS`,
`CHATTY_WORKER_RECOVER_COUNT`, `CHATTY_WORKER_RETRY_BACKOFF_BASE_SECONDS`,
`CHATTY_WORKER_RETRY_BACKOFF_CAP_SECONDS`, and `CHATTY_WEBHOOK_STREAM` deployment settings.
`CHATTY_WORKER_PENDING_IDLE_MS` controls how long a delivery must be idle before
another consumer reclaims it; `CHATTY_WORKER_RECOVER_COUNT` bounds each recovery
batch so reclaim work cannot starve new deliveries.
Retryable handler failures use bounded exponential backoff between attempts;
the base and cap settings prevent an outage from creating a hot retry loop.
WooCommerce sync jobs include a hashed `concurrency_key`; workers serialize
jobs for the same merchant store through Redis. Configure
`CHATTY_WORKER_CONCURRENCY_LOCK_TTL_SECONDS` longer than the maximum expected
sync duration and `CHATTY_WORKER_CONCURRENCY_LOCK_WAIT_SECONDS` for the bounded
wait before a busy job is requeued without consuming a retry attempt.
Production sync requests fail closed when `CHATTY_JOB_QUEUE_URL` is missing.
Set `CHATTY_ALLOW_EPHEMERAL_JOBS=true` only for local development.

## Incident response

For a secret leak, revoke/rotate the credential first, then remove it from
history and redeploy. For a bad application revision, stop traffic to the
revision, roll back to the last known-good revision, and preserve logs and
audit events before changing data. For a migration failure, do not retry blindly;
inspect the failed migration and restore from a verified backup if data was
partially changed.

## Release evidence

Every release should record the commit SHA, migration version, image digest,
test result, scanner result, deployment revision, and rollback revision. This
evidence belongs in the CI release summary, not in source code.
