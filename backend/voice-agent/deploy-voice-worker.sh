#!/usr/bin/env bash
# The production Chatty voice worker is VPS-only.
#
# This filename is retained as a guard for old operator automation. It must
# never deploy a persistent LiveKit worker to Cloud Run: Cloud Run is the API
# target, while the voice worker needs a long-lived WebSocket and is managed
# by Docker Compose on the VPS.
set -euo pipefail

cat >&2 <<'MSG'
Cloud Run deployment for the Chatty voice worker is disabled.

Deploy the worker to the production VPS with:
  docker compose --profile self-hosted up -d --build voice-worker

See backend/voice-agent/DEPLOY_VPS.md for the supported release and rollback
procedure. Deploy the Chatty API separately to Cloud Run in project
personaliai.
MSG
exit 2
