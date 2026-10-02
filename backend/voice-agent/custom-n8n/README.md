# Custom n8n authentication overlay

This transitional overlay preserves the existing branded n8n image while
validating Supabase access-token signatures and claims before SSO provisioning.
ES256 and RS256 use the configured project's HTTPS JWKS endpoint. HS256 requires
an explicitly supplied legacy signing secret; it is not enabled automatically.
Never place credentials in the image or repository.

Run the focused checks:

```sh
node --test backend/voice-agent/custom-n8n/*.test.cjs
cd backend && python -m pytest tests/test_n8n_integration.py -q
```

Build from a known, immutable custom image (not an upstream image lacking the
SSO implementation). The patch stops the build if the expected source differs:

```sh
docker build --build-arg N8N_BASE_IMAGE=<existing-image-id-or-digest> \
  -f custom-n8n/Dockerfile.auth -t chatty-n8n:auth-<release> custom-n8n
```

From the voice-agent deployment directory, preserve the current image under a
rollback tag. Set `CHATTY_N8N_IMAGE` to the new release and use the existing
Compose project and environment file:

```sh
CHATTY_N8N_IMAGE=chatty-n8n:auth-<release> docker compose \
  -f docker-compose.yml -f custom-n8n/compose.auth.yml up -d --no-deps n8n
```

The override disables preview authentication bypass. Verify `/healthz`, a real
Supabase session's SSO login, and unauthenticated rejection of `/rest/workflows`.
Keep the existing `n8n_data` volume: do not run `down -v`.
Rollback uses the same command with the saved previous image tag. It restores
the prior image but retains the stricter authentication configuration.

This overlay is not yet a reproducible build of the complete n8n fork. A full
source image pipeline and tenant-scoped starter provisioning remain required.
