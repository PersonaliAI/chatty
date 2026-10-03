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
  Presence/roster menus are rendered outside the scrollable routing bar so
  status/capacity controls remain usable on narrow screens.
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

Initial source `c214223d5c464b6a1419714d724857c17ad2890d` passed CI (frontend and
backend), compose smoke, CodeQL and secret scan. Firebase
`rollout-2026-10-03-024` / `build-2026-10-03-028` succeeded. Authenticated live
desktop inspection confirmed the new navigation, queue, transcript and contact
workspace, with no document-width overflow.

Final application source `ab6789c6062a041929043f51bab8a38a4d9b0158` includes
the routing-popover fix (`0efd04fc`) and mobile Back-button alignment fix. CI
run `37140665834` passed frontend/backend checks, deterministic browser tests
and production build; compose smoke `37140665876`, CodeQL `37140665868` and
secret scan also passed. Firebase `rollout-2026-10-03-026` /
`build-2026-10-03-030` succeeded with that exact application source.

Authenticated live acceptance at 1600 and 390 pixels confirmed independent
panes, loaded transcripts/contact details, mobile queue-to-chat/back navigation,
private-note mode hiding the public composer, identity setup, loaded automation
rules, unclipped presence/capacity and team-roster menus, and document width
equal to viewport width. No real customer reply, deletion, key rotation or rule
change was made. Light/dark and intermediate widths were validated with isolated
browser fixtures. Existing provider integrations are preserved, not newly
certified by this layout release; the repository's existing dependency advisory
is a separate platform maintenance item.

To roll back only Inbox changes, revert
the three Inbox implementation commits (`c214223d`, `0efd04fc`, `ab6789c6`) on
`main` and roll out the resulting commit; do not
reset or revert the concurrent Flow Builder changes. Alternatively roll out the
last known-good Firebase build while preparing that scoped revert.
