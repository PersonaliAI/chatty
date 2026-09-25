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
`git diff --check`, and smoke requests to `/` and `/readyz`. A release must
not be promoted when migrations are pending or secrets are detected by the
repository scanner.

## Cloud Run release checklist

The production services are `chatty-api` and `chatty-voice-worker` in project
`personaliai`, region `us-central1`. Capture the current revisions before every
release; those names are the rollback handles, not a mutable image tag.

```powershell
$project = "personaliai"
$region = "us-central1"
$apiPrevious = gcloud run services describe chatty-api --project $project --region $region --format="value(status.latestReadyRevisionName)"
$voicePrevious = gcloud run services describe chatty-voice-worker --project $project --region $region --format="value(status.latestReadyRevisionName)"
git rev-parse HEAD
python -m compileall -q .
pytest -q
git diff --check
```

1. Apply versioned database migrations and verify the migration history before
   routing traffic. Never run a destructive migration as an unreviewed hotfix.
2. Deploy the API from the exact checked-out commit. `--clear-base-image` is
   required by this service:

   ```powershell
   gcloud run deploy chatty-api --source . --region $region --project $project --clear-base-image --quiet
   ```

3. Deploy the voice worker from an immutable Artifact Registry digest. Keep
   `LIVEKIT_NUM_IDLE_PROCESSES=2` for the production 4-vCPU/4-GiB worker:

   ```powershell
   gcloud run deploy chatty-voice-worker `
     --image us-central1-docker.pkg.dev/personaliai/cloud-run-source-deploy/chatty-voice-worker@sha256:<digest> `
     --project $project --region $region --update-env-vars LIVEKIT_NUM_IDLE_PROCESSES=2 `
     --min-instances=1 --max-instances=3 --memory=4Gi --cpu=4 `
     --no-cpu-throttling --timeout=300 --no-allow-unauthenticated --quiet
   ```

4. Verify readiness and traffic before considering the release successful:

   ```powershell
   Invoke-WebRequest "https://api.chatty.personaliai.com/readyz" -UseBasicParsing
   gcloud run services describe chatty-api --project $project --region $region --format="value(status.latestReadyRevisionName,status.traffic)"
   gcloud run services describe chatty-voice-worker --project $project --region $region --format="value(status.latestReadyRevisionName,status.traffic)"
   ```

   The API smoke should return HTTP 200 with `status=ready`; protected catalog
   routes should return 401 without a session rather than 500. For an
   authenticated staging smoke, verify widget theme, text streaming, booking,
   catalog creation/update, signed catalog webhook, and voice connect/greeting.
5. Keep the previous revision serving until the smoke checks and startup logs
   are clean. Record both new revision names, image digests, migration version,
   test output, and the captured rollback names.

### Rollback

Rollback is a traffic change and does not delete the failed revision or data.
Use the revision names captured before deployment:

```powershell
gcloud run services update-traffic chatty-api `
  --to-revisions ${apiPrevious}=100 --project $project --region $region --quiet
gcloud run services update-traffic chatty-voice-worker `
  --to-revisions ${voicePrevious}=100 --project $project --region $region --quiet
```

Re-run `/readyz`, the voice connect smoke, and the relevant authenticated flow
after rollback. Preserve the failed revision's logs and request IDs before
redeploying a fix. A database migration is not rolled back by changing Cloud
Run traffic; use an additive forward migration or a verified backup restore
plan after reviewing the migration's data impact.

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

Run one consumer process per worker identity. The entrypoint derives a unique
consumer name from the host and process ID, and supports `CHATTY_WORKER_GROUP`,
`CHATTY_WORKER_MAX_ATTEMPTS`, and `CHATTY_WEBHOOK_STREAM` deployment settings.

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
