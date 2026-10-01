# Flow Builder and Campaigns acceptance gates

The industrial automation goal is **not complete**. This checklist preserves
the full scope; passing a unit test or pushing a commit does not prove deployment
or production readiness. Every gate needs evidence for the release commit.

Latest fully validated public release evidence: commit `28f969a` passed
canonical CI workflow `36907414491` (backend compile/tests/audit plus frontend
typecheck, lint, browser checks, and production build), CodeQL `36907414422`,
secret scan `36907414590`, code quality `36907411380`, and managed Supabase
compose smoke `36907414380`. The dependency security patch is also covered by
the backend audit and local `npm audit --omit=dev` (0 vulnerabilities).
Production E2E run `36758263161` remains the last recorded run
(5 passed, 3 authenticated owner tests skipped). The owner tests are gated by
`E2E_OWNER_EMAIL` and `E2E_OWNER_PASSWORD`; no such Actions secrets are
currently configured, so authenticated editor acceptance is not proven.

## 1. Workflow correctness

- Validate triggers, actions, branching, loops, retries, timeouts, scheduling,
  webhooks, integrations and typed mapping in both simulation and live execution.
- Test graph validation, malformed inputs, cycles, missing mappings, error paths,
  cancellation, bounded execution and retry exhaustion.
- Verify immutable execution snapshots, history filters, logs and replay.
- Verify tenant authorization on reading, executing, publishing and rolling back.
- Verify version concurrency, atomic publication, draft isolation and rollback.
- Verify templates, import/export and AI generation/optimization round trips.

Current evidence: backend Flow contract/runtime/router tests exist, including
typed webhook mapping coercion and fail-closed type errors. Live widget
webhook tests cover published URLs, mapping and transient retries. These do not
yet prove full live/simulator parity or atomic version publication.

## 2. Operator experience

- Authenticated browser tests must create/edit/test/publish/replay/rollback a
  disposable workflow and verify its behavior, not just button visibility.
- Verify hidden/collapsed sidebars, keyboard navigation, focus management,
  screen-reader names and desktop/mobile canvas usability.
- Verify malformed import and failed save recovery without losing drafts.

Current evidence: deterministic landing browser checks pass in CI and the
production launcher/embed smoke suite is green. Authenticated golden-path tests
remain skipped without owner credentials and currently cover only basic
automation surface controls. Full editor accessibility acceptance is unverified.

## 3. Campaign orchestration

- Verify audience rules, consent changes, AI content/sequences, multichannel
  dispatch, scheduling, date windows, quiet hours and frequency caps.
- Verify large audiences/campaign pagination, delayed steps, duplicate ticks,
  provider retries, worker recovery, dead letters and replay without duplicate sends.
- Verify pause/delete effects on queued deliveries and accurate analytics/logs.

Current evidence: campaign unit tests cover schedule planning, consent, retries,
bounded tag/locale audience predicates, normalized audience rules, and editing
existing campaigns while preserving cadence, quiet-hours, and frequency-cap
safeguards; a real Redis scheduling CI test exists.
Actual provider delivery, large-audience fairness, consent revocation and queued
campaign pause semantics still require acceptance evidence.

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
