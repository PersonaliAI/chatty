#!/usr/bin/env bash
# Deploy the LiveKit voice worker as its own Cloud Run service, separate from
# the main API (see Dockerfile.voice-worker for why). Run from the repo root.
#
# min-instances=1 is required (not optional): unlike the API, this worker
# holds a persistent WebSocket connection to LiveKit Cloud to receive job
# dispatch — it cannot scale to zero the way a request/response service can.
# That means it's billed continuously, not just per-request.
#
# `gcloud run deploy --source` only auto-detects a file literally named
# `Dockerfile` — there's no `--dockerfile` flag to point it at an
# alternately-named one, so this builds+pushes the image explicitly instead.
#
# Resource sizing (1Gi/1cpu, no --no-cpu-throttling, 300s timeout) mirrors
# the already-running `kin-voice-worker` Cloud Run service on this same
# project — a proven config for the exact same kind of workload, not a guess.
set -euo pipefail

PROJECT_ID="${GOOGLE_CLOUD_PROJECT:-playvoid-280b1}"
REGION="${GOOGLE_CLOUD_DEPLOY_REGION:-us-central1}"
SERVICE_NAME="chatty-voice-worker"
IMAGE="us-central1-docker.pkg.dev/${PROJECT_ID}/cloud-run-source-deploy/${SERVICE_NAME}"

if [ ! -f voice-agent/env.voice-worker.yaml ]; then
  echo "voice-agent/env.voice-worker.yaml not found — copy/fill it in first (see the LIVEKIT_* TODOs)." >&2
  exit 1
fi
if grep -q '"TODO"' voice-agent/env.voice-worker.yaml; then
  echo "voice-agent/env.voice-worker.yaml still has TODO placeholders for LIVEKIT_URL/API_KEY/API_SECRET — fill those in from your LiveKit Cloud project before deploying." >&2
  exit 1
fi

# `gcloud builds submit --tag` only builds a file literally named
# `Dockerfile` (the repo root already has one — the main API's — so that
# flag would silently build the WRONG image). Use an explicit Cloud Build
# config that points docker build at voice-agent/Dockerfile instead.
gcloud builds submit \
  --project "$PROJECT_ID" \
  --config voice-agent/cloudbuild.voice-worker.yaml \
  --substitutions "_IMAGE=${IMAGE}" \
  .

gcloud run deploy "$SERVICE_NAME" \
  --image "$IMAGE" \
  --project "$PROJECT_ID" \
  --region "$REGION" \
  --env-vars-file voice-agent/env.voice-worker.yaml \
  --min-instances=1 \
  --max-instances=3 \
  --memory=4Gi \
  --cpu=4 \
  --no-cpu-throttling \
  --timeout=300 \
  --no-allow-unauthenticated
# 4Gi/4cpu — sized so num_idle_processes=2 (voice_worker.py) each get real
# headroom for realtime STT/TTS streaming, not just enough to load without
# crashing. 2cpu total (1 per idle process) wasn't enough: verified live —
# a real call got a real response, but Google TTS streaming timed out mid-
# reply ("TTS failed after partial audio was already sent", "inference is
# slower than realtime") under CPU contention between the two warm
# processes. docling/torch were dropped from requirements.txt (this worker
# never used them), which is what makes this size affordable at all.
# --no-cpu-throttling is NOT optional here (unlike a normal HTTP service):
# Cloud Run throttles CPU to near-zero outside of active request handling
# by default, but this worker's real work — the persistent WebSocket to
# LiveKit Cloud, job dispatch handling, and the STT/LLM/TTS pipeline itself
# — all happens *outside* any inbound HTTP request (the only inbound HTTP
# is the trivial health-check port). Without this flag the worker's event
# loop gets starved between health checks, which is what caused dispatched
# jobs to sit at JS_PENDING indefinitely / the instance to look "stuck".
# --no-allow-unauthenticated: this service never receives inbound HTTP
# traffic (it only makes outbound connections to LiveKit Cloud + Supabase),
# so there's no reason to expose a public Cloud Run URL for it at all.
