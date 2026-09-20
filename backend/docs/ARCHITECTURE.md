# Chatty architecture

## Goal

Chatty is a multi-tenant customer-support platform with two supported modes:

1. **Hosted Chatty** — managed infrastructure operated by PersonaliAI.
2. **Self-hosted Chatty** — Docker/PostgreSQL/Redis-compatible deployment with
   no mandatory Supabase account.

The hosted deployment may use Supabase, Cloud Run, and managed providers. Those
are infrastructure choices, not product-domain dependencies.

## Runtime boundaries

```text
Browser widget / dashboard / MCP
              |
              v
       FastAPI application
              |
       domain services + ports
        /       |        \
 persistence  providers   events
      /             \        \
 PostgreSQL       calendars  workers
```

Feature code belongs in `app/services` and should depend on small interfaces in
`app/ports`. Vendor SDKs and REST query details belong in `app/adapters` or the
existing provider modules. This keeps the public repository runnable with
standard infrastructure while allowing the hosted product to use managed
services.

## Current migration strategy

This is an incremental strangler migration, not a rewrite:

1. Add a port for a high-traffic capability.
2. Wrap the existing Supabase implementation in an adapter.
3. Move one call site behind the port without changing its API response.
4. Add contract tests that every adapter must satisfy.
5. Add a PostgreSQL/Redis/self-hosted adapter when the port is stable.

The first migrated boundaries are conversation history (`app/ports/conversations.py`)
and audit events (`app/ports/audit.py`), with Supabase adapters in
`app/adapters/`. Widget booking now writes its audit event through the audit
port; the legacy direct-write fallback remains only for older callers during
the migration window.

## Non-negotiable production rules

- Tenant scope (`bot_id`, organization, and authenticated principal) is checked
  before every read or mutation.
- Frontend code must not perform sensitive mutations directly against a vendor
  database API.
- Provider credentials are encrypted at rest and never returned to clients.
- Every external side effect is idempotent and records an audit event.
- Long-running work runs in workers, not in the request process.
- Database migrations are versioned, reversible where practical, and tested on
  a clean PostgreSQL database in CI.
- Public and private repository mirrors are verified automatically.

## Planned service boundaries

- `ConversationService`: sessions, messages, handoff, unread state.
- `KnowledgeService`: crawling, parsing, chunking, retrieval, citations.
- `AgentService`: model selection, tool loop, guardrails, language continuity.
- `BookingService`: availability, timezone conversion, booking lifecycle.
- `LeadService`: identity resolution, enrichment, consent, exports.
- `BillingService`: plans, quota, metering, webhook reconciliation.
- `TeamService`: organizations, RBAC, presence, assignments.
- `EventService`: outbox, webhooks, retries, audit logs.

Each service should expose typed application methods and hide persistence and
provider details behind ports.
