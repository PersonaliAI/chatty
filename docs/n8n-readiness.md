# n8n integration checkpoint — 2026-10-02

The integration is not yet production-acceptance complete. The supplied status
report is a checkpoint, not evidence that every tenant boundary was verified.

## Verified in this checkpoint

- VPS custom image: `chatty-n8n:auth-20261002`.
- Previous image retained as `chatty-n8n:rollback-20261002`.
- Supabase ES256 signatures and authenticated claims are checked before SSO.
- Preview-mode authentication bypass is disabled.
- Genuine Supabase session: `/rest/workflows` HTTP 200.
- Modified token: `/rest/workflows` HTTP 401.
- n8n `/healthz`: HTTP 200.
- Local verification: 25 backend MCP/n8n tests and 5 Node auth-overlay tests passed.
- Backend n8n routes now require bot ownership or explicit webhook permission.
- Cloud Run `chatty-api-00150-p6p` serves the backend fix at 100% traffic;
  another account's bot status request returned HTTP 403 and `/ready` is ready.
- Starter lookup uses its exact bot webhook path rather than its editable name;
  trigger payloads cannot replace the server-selected bot ID or action.

Deployment and rollback commands are in
`backend/voice-agent/custom-n8n/README.md`. The overlay does not replace the
complete custom fork's build process.

## Compose profiles

Default root Compose remains `backend` and `frontend`. Start generic standalone
n8n explicitly with `docker compose --profile n8n up -d n8n`. This upstream image
does **not** include Chatty SSO. The existing VPS uses the branded custom image
and the separate voice-agent Compose project; do not start a duplicate root
n8n instance on that VPS.

## Remaining acceptance work

1. Bind provisioning to the authenticated tenant's n8n project and enforce this
   on every workflow API operation; the global API key is not a tenant boundary.
2. Verify real-browser iframe login, cookie behavior, expiry, logout, and two
   distinct authenticated tenants' workflow and credential isolation.
3. Provision and activate a default voice workflow through tenant-scoped APIs.
4. Implement Chatty voice-event nodes and credential handling with delivery,
   retry, deduplication, and authorization tests.
5. Add member-focused canvas navigation and mobile end-to-end verification.
6. Build the complete fork reproducibly in CI, publish immutable image tags,
   and test restore/rollback, external task runners, and execution limits.
7. Remove the remaining legacy `/api/widget/flow/webhook` call from the embed
   client and explicitly migrate or retire existing saved widget flows.

Local `.env.local` used a disabled legacy Supabase public key during the
first smoke attempt. The successful check used the current publishable key
from `frontend/apphosting.yaml`; the ignored local configuration is now aligned
with it. No Supabase settings were weakened.
