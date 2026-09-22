# Secure self-host migration contract

This migration must not interrupt the current Supabase-backed production
deployment. Supabase remains the active system of record until a separately
approved cutover has passed the rollback checks below.

## Non-negotiable safety rules

1. Never run destructive SQL against the live Supabase project from a
   self-host installer. Self-host databases are provisioned empty and use
   versioned migrations.
2. Never copy production secrets into a repository, Docker image, issue, or
   developer machine. Use the deployment platform's secret manager.
3. Every new self-host path is disabled unless `DEPLOYMENT_PROFILE=self_host`
   is explicitly set. The default remains `managed_supabase`.
4. Webhook endpoints remain backward compatible and verify signatures before
   enqueueing work. During dual-run, the existing endpoint remains the only
   response authority; shadow consumers are asynchronous and isolated.
5. A release is reversible by changing the deployment profile and traffic
   routing back to the existing Supabase service. No schema drop or in-place
   database replacement is permitted during rollout.

## Rollout phases

### Phase 0 — package and observe

Provision PostgreSQL/pgvector, Redis, and S3-compatible object storage in an
isolated environment. Run health checks, dependency checks, backup/restore
drills, and security scans. Do not point production traffic at it.

### Phase 1 — compatibility adapters

Introduce provider interfaces for database, object storage, queues, and
identity. Keep the Supabase adapters as the default implementation. Add the
self-host adapters behind the profile flag and run contract tests against both
implementations.

### Phase 2 — shadow verification

Replay sanitized events and read-only workloads into the self-host stack.
Compare response shape, authorization decisions, webhook idempotency, and
latency. Do not send self-host writes to customers or external providers.

### Phase 3 — controlled canary

Use an explicit allowlist of internal accounts. Monitor error rate, queue lag,
database saturation, signature failures, and audit events. Keep Supabase as
the rollback target.

### Phase 4 — approved cutover

Only after backup restore and rollback drills succeed: freeze writes briefly,
perform the versioned migration, verify counts/checksums, route traffic, and
keep the old Supabase path available for the agreed rollback window.

## Required security controls

- TLS at the edge and private network access for Postgres, Redis, and object
  storage; no database ports exposed publicly.
- Per-service credentials, least-privilege database roles, and rotated secrets.
- Encrypted backups with a tested restore procedure.
- Strict CORS allowlist, secure/httpOnly cookies, CSRF protection for browser
  mutations, and constant-time webhook signature comparison.
- Audit logging for authentication, token issuance/revocation, admin actions,
  configuration changes, and webhook failures.
- Rate limits and bounded payload sizes on public and webhook endpoints.
- Dependency, image, secret, and static-analysis scans in CI before release.
- A documented incident rollback procedure and a staging smoke test using
  production-like configuration without production data.

## Definition of done

Self-host is not considered production-ready until both providers pass the
same contract/security test suite, backups restore successfully, the canary
has no unexplained data divergence, and rollback completes within the agreed
recovery objective. Until then, the live Supabase setup remains unchanged.
