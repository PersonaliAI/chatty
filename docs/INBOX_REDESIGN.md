# Inbox reference redesign

The supplied Libredesk screenshots guide the layout, not the product's data or
permissions. Do not introduce fake contacts, team queues, counts, integrations,
or decorative actions into the production Inbox.

## Preservation checklist

The implementation must retain these existing capabilities:

- Lifecycle tabs and counts; priority, assignee, channel, tag and text filtering;
  refresh; session selection and confirmed deletion.
- Agent presence, capacity, team roster, manual/automatic queue assignment.
- Status, priority, ownership, tags, SLA/escalation notices and dismissal;
  active-viewer presence and AI/human handoff.
- Message transcript, markdown, trusted attachments, audio and booking content;
  feedback and answer correction.
- Human replies, email delivery, image/document uploads, location and audio
  recording; canned response variables/management and knowledge article inserts.
- Private persistent notes and note deletion; AI drafts, summaries, summary
  insertion and saving summaries as private notes; automation rules management.
- Signed identity setup/key rotation, visitor provenance and attributes,
  permission-scoped previous conversations, tenant/agent authorization.

## Layout and interaction acceptance

- Compact navigation, independent queue/conversation/contact panes and useful
  queue sorting; collapsible navigation and contact workspace.
- Responsive light/dark appearance, accessible keyboard controls and visible
  focus; mobile list-to-conversation navigation and dismissible details drawer.
- Multiline reply composer with Ctrl/Cmd+Enter send; private-note mode must not
  accidentally expose the public-send composer.
- Nonwrapping action labels, nonshrinking icons and internal horizontal scroll
  for dense toolbars; no document-width overflow.
- Contact sections should be collapsible; preserve informative provenance.
- No browser identity fields treated as authentication; no permission widening,
  customer data merging, new outbound integration calls or client secrets.

## Local validation (2026-10-03)

The component browser harness mounts the actual Inbox component and compiles
the application's Tailwind stylesheet, using isolated API fixtures. The combined
Inbox/identity browser run passed 12 tests:

- Light/dark at 1600, 1024, 768 and 390 pixels: keyboard selection, multiline
  reply transport/clearing, private notes versus public replies, priority,
  ownership, tags, contact drawer, navigation collapse/expansion and no page
  horizontal overflow. Screenshots are saved in Playwright test results.
- Late transcript/private-note responses cannot populate another conversation;
  separate unsent reply drafts survive conversation switching.
- Desktop/mobile: AI draft, summary saved as private note, knowledge snippet,
  attachment menu, canned response creation/visitor substitution, keyboard
  dialog dismissal, and cancel/confirm deletion against fixtures only.
- Widget identify/logout clears the previous visitor's draft/history.

Additional checks: 29 backend contact-identity tests, 5 client identity tests,
TypeScript and production build passed. Targeted lint has zero errors and four
pre-existing warnings (two unused imports, one effect dependency, one `any`).
These checks do not claim every integration or provider is certified; no real
customer conversations were replied to or deleted during acceptance testing.

Reproduce from the canonical checkout:

```powershell
cd D:\Documents\_personaliai\chatty\frontend
$env:NODE_OPTIONS='--max-old-space-size=2048'
npx playwright test e2e/inbox-workspace.deterministic.spec.ts e2e/inbox-identity.deterministic.spec.ts --workers=1
npm run test:visitor-identity
npx tsc --noEmit
npm run build
cd ..
backend/.venv311/Scripts/python.exe -m pytest backend/tests/test_contact_identity.py -q
```

No new SQL migration, credentials or backend deployment is needed for this
layout change. Existing identity APIs and authorization checks are unchanged.

## Deployment and rollback

Deployment/live acceptance is still pending. Record the source commit and
Firebase rollout after verification. To roll back only Inbox changes, revert
the Inbox redesign commit on `main` and roll out the resulting commit; do not
reset or revert the concurrent Flow Builder changes. Alternatively roll out the
last known-good Firebase build while preparing that scoped revert.
