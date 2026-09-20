# Portability and self-hosting contract

Supabase is the default hosted adapter, not a hard requirement of Chatty.

## Required self-hosted dependencies

- PostgreSQL 15+
- Redis 7+ (queue, rate limiting, and ephemeral presence)
- S3-compatible object storage (or local storage for development)
- SMTP-compatible email provider
- At least one supported LLM provider

## Adapter matrix

| Capability | Hosted default | Self-hosted contract |
|---|---|---|
| Relational data | Supabase PostgreSQL | PostgreSQL |
| Auth | Supabase Auth | OIDC/OAuth or local auth adapter |
| Files | Supabase Storage | S3-compatible storage |
| Realtime | Supabase channels | WebSocket/SSE service |
| Jobs | Cloud Run/background tasks | Redis-backed worker |
| Calendar | Google/Microsoft | Same provider adapters |
| Billing | Lemon Squeezy/Stripe | Stripe, disabled, or custom adapter |

## Compatibility rules

New product code must not import `supabase` directly unless it is inside an
adapter or an explicitly documented migration shim. Add a port first when a
new capability will eventually need self-hosting.

The first enforced boundaries are conversation persistence and append-only
audit events. Booking uses the audit adapter so a PostgreSQL implementation can
be added without changing booking behavior.

The default Docker profile should run without Supabase credentials. Hosted-only
features must fail clearly with a capability error, not crash at import time.

## Definition of done for a new adapter

1. Implements the corresponding `app.ports` protocol.
2. Passes the shared contract test suite.
3. Has timeout, retry, and idempotency behavior documented.
4. Emits structured logs and metrics without secrets.
5. Is covered by a local Docker integration test.
