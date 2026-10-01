# Flow Builder and Campaigns acceptance gates

The industrial automation goal is **not complete**. This checklist preserves
the full scope; passing a unit test or pushing a commit does not prove deployment
or production readiness. Every gate needs evidence for the release commit.

Latest fully validated public release evidence: commit `3b56b53` passed
canonical CI workflow `36921808458` (backend compile/tests/audit plus frontend
typecheck, lint, browser checks, and production build), CodeQL `36913345786`,
secret scan `36921808381`, code quality `36921808208`, and managed Supabase
compose smoke `36921808657`. The dependency security patch is also covered by
the backend audit and local `npm audit --omit=dev` (0 vulnerabilities). The
local backend regression suite now passes `837 passed, 6 skipped, 2 warnings`.
Production authenticated E2E run `36927088166` completed with 8 passed and 1
skipped. Flow Builder, Campaigns, sidebar, mobile and execution-filter checks
are green. The Customizer owner round-trip is explicitly skipped because the
configured production account has no bot with owner/design/settings
permission; the earlier 403 diagnostic confirmed this is an unprovisioned
fixture rather than a save failure. The preset save race is fixed in
`3b56b53`, and the hosted revision is serving the updated frontend. A true
owner fixture is still required before claiming the Customizer acceptance gate.
The production Playwright job accepts `E2E_OWNER_BOT_ID` as an optional secret;
when set, it targets that explicitly provisioned owner/design-capable bot rather
than relying on the shared public widget bot. This avoids false negatives from
team bots that are visible but intentionally read-only.

The focused Flow Builder/Campaigns backend contract, runtime, router, audience,
schedule, and dispatch regression set is currently green: **62 passed** locally.

The deterministic landing/browser accessibility-adjacent checks are also green:
**3 passed**, including help-center navigation and a 390px horizontal-overflow
guard. Static widget contrast verification covers **75 WCAG AA pairs**, and all
10 design snapshots match.

Resilience-focused worker, queue, dead-letter, booking-security, and widget-job
regressions are green locally: **50 passed, 1 intentionally skipped**. This
includes retry/idempotency, concurrency-lock release, provider-failure recovery,
and fail-closed security paths.
For a reproducible isolated runtime load signal, run
`python backend/scripts/benchmark_flow_runtime.py --iterations 10000`; the
benchmark uses synthetic contexts only and fails if credential redaction regresses.

## 1. Workflow correctness

- Validate triggers, actions, branching, loops, retries, timeouts, scheduling,
  webhooks, integrations and typed mapping in both simulation and live execution.
- Test graph validation, malformed inputs, cycles, missing mappings, error paths,
  cancellation, bounded execution and retry exhaustion.
- Verify immutable execution snapshots, history filters, logs and replay.
- Verify tenant authorization on reading, executing, publishing and rolling back.
- Verify version concurrency, atomic publication, draft isolation and rollback.
- Verify templates, import/export and AI generation/optimization round trips.

Current evidence: backend Flow contract/runtime/router tests pass (63 focused
tests in the latest local run), including immutable run-snapshot replay,
typed webhook mapping coercion and fail-closed type errors. Live widget
webhook tests cover published URLs, mapping and transient retries. These do
not yet prove full live/simulator parity or atomic version publication. The
runtime suite also exercises a bounded 1,000-context mapping batch to catch
cross-run state leaks and credential exposure.

## 2. Operator experience

- Authenticated browser tests must create/edit/test/publish/replay/rollback a
  disposable workflow and verify its behavior, not just button visibility.
- Verify hidden/collapsed sidebars, keyboard navigation, focus management,
  screen-reader names and desktop/mobile canvas usability.
- Verify malformed import and failed save recovery without losing drafts.

Current evidence: deterministic landing browser checks pass in CI and a local
Playwright run independently passed all three deterministic checks (3/3); the
production launcher/embed smoke suite is green. Authenticated golden-path
coverage is now enabled by repository owner credentials and the latest
production smoke run `36933216448` completed with 8 passed and 1 explicitly
skipped owner-persistence test because the shared account had no editable bot.
Full editor accessibility acceptance remains unverified until a dedicated owner
fixture is provisioned and the authenticated editor checks complete.
The repository currently has `E2E_OWNER_EMAIL` and `E2E_OWNER_PASSWORD` secrets,
but no `E2E_OWNER_BOT_ID` secret, so that fixture provisioning is the remaining
external acceptance prerequisite.

## 3. Campaign orchestration

- Verify audience rules, consent changes, AI content/sequences, multichannel
  dispatch, scheduling, date windows, quiet hours and frequency caps.
- Verify large audiences/campaign pagination, delayed steps, duplicate ticks,
  provider retries, worker recovery, dead letters and replay without duplicate sends.
- Verify pause/delete effects on queued deliveries and accurate analytics/logs.

Current evidence: the full backend suite passes with 838 tests and 6 explicit
skips; campaign unit tests cover schedule planning, consent, retries,
bounded tag/locale audience predicates, normalized audience rules, and editing
existing campaigns while preserving cadence, quiet-hours, and frequency-cap
safeguards; a real Redis scheduling CI test exists.
Actual provider delivery, large-audience fairness, and consent revocation still
require acceptance evidence. Queued campaign pause/delete semantics now have a
worker regression test that verifies an inactive campaign is suppressed before
the provider is called; production acceptance is still pending.

## 4. Release verification

- Run unit, integration, browser, smoke, resilience, security and accessibility
  gates against the release commit; record skips and limitations explicitly.
- Measure sustained throughput, latency and recovery on isolated infrastructure.
- Resolve actionable dependency/security findings; the current frontend
  `npm audit` reports zero vulnerabilities and the canonical CI backend
  `pip-audit` gate passes. These dependency checks still do not replace the
  broader security acceptance gate below.
- Verify migrations, deployment configuration, health/readiness and rollback.
- Deploy through documented providers with secret bindings preserved; verify
  authenticated critical flows after deployment and retain rollback evidence.

Do not run load tests or provider-send acceptance against real customer contacts.
Use isolated test tenants, explicit disposable recipients and bounded workloads.
Source synchronization, a Git push and green build checks are not deployment proof.

### Reproducible deployment and rollback runbook

1. Record the exact release SHA and migration set before rollout:

   ```bash
   git fetch origin main --tags
   git rev-parse origin/main
   find supabase/migrations -maxdepth 1 -type f -name '*.sql' | sort
   ```

2. Build and tag immutable artifacts from that SHA. Never deploy a mutable
   branch checkout or an unpinned `latest` image:

   ```bash
   export RELEASE_SHA="$(git rev-parse origin/main)"
   docker build --file backend/Dockerfile --tag "chatty-api:${RELEASE_SHA}" .
   docker build --file frontend/Dockerfile --tag "chatty-frontend:${RELEASE_SHA}" .
   ```

3. Apply migrations using the managed database connection for the target
   environment, then deploy the API, worker, and frontend with secrets bound
   by the hosting provider. Keep the previous image/tag available until the
   smoke and authenticated acceptance checks pass.

4. Verify health/readiness and critical automation paths before serving
   traffic: API health, dashboard login, flow dry-run/history/replay, campaign
   pause suppression, and widget message round-trip. Record URLs, SHA, test
   run IDs, and timestamps in the release ticket.

5. Roll back by selecting the previous immutable SHA/image, not by reverting
   live database state. If a migration is backward-incompatible, stop traffic,
   use the migration's documented down/forward repair procedure, and restore
   the prior application image only after schema compatibility is confirmed.
   Re-run the same health and smoke checks and retain the failed-release logs.

These commands are a provider-neutral checklist; the provider-specific secret,
image, and rollout commands must be captured in the deployment environment's
runbook without committing credentials to the public repository.
