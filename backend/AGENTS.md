# Agent instructions - Chatty backend

## Single canonical repository

`PersonaliAI/chatty` is the single canonical repository. The frontend,
backend, voice worker, deployment configuration, tests, and docs live in this
checkout. Do not mirror changes to a private repository or maintain a second
source checkout.

## Backend workflow

1. Make changes under `backend/`.
2. Run focused tests, lint/type checks, and relevant smoke tests.
3. Commit and push directly to `main`.
4. Deploy only through the documented provider workflow, preserving secrets in
   the provider environment rather than committing `.env` files.
5. Verify health/readiness endpoints and record rollback information for any
   production deployment.

For Cloud Run API deployments, use the configured project and region and keep
the existing service identity and secret bindings intact. For the self-hosted
voice path, use the VPS Compose profile documented in the voice self-hosting
guide. These are deployment targets, not separate source repositories.

## Safety and quality

- Never commit credentials, tokens, private keys, or local `.env` files.
- Keep tenant boundaries and authorization checks intact for every API route.
- Add or update unit, integration, smoke, and regression coverage with each
  behavior change.
- Run the smallest relevant test set locally before pushing, then confirm the
  required GitHub checks and production smoke checks.
- Prefer reversible deploys and document the previous image/commit for
  rollback.

## Frontend and backend layout

The frontend and backend live together under `frontend/` and `backend/`.
