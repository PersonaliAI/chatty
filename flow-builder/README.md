# Chatty Flow Builder

This is the visual development application for Chatty workflow authoring.
Production runs the editor inside the main Chatty frontend at
`https://chatty.personaliai.com/flow`.

## Local development

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000/?bot_id=<chatty-bot-id>` for standalone visual
development. The production editor uses the signed-in Chatty session at
`/flow?bot_id=<chatty-bot-id>`.

## Firebase App Hosting

Deploy the `frontend` directory as the single Chatty Firebase App Hosting
backend. The `/flow` route is part of that frontend deployment. Keep this
directory as a standalone local visual-development target only.

The builder never receives a service-role key. It sends the signed-in user's
Supabase access token to Chatty. Chatty checks the bot's existing `design`
permission before reading, saving, or publishing a flow version.

The API route and the database migration must be deployed before enabling the
dashboard link. The production editor uses the same-origin Chatty Supabase
session. Every API operation checks the user's design permission for the
selected bot. A short-lived handoff token remains supported for standalone
development and older links.

Published flows execute from Chatty events. The native Reply in chat node
returns a configured response in the same widget request. Other action nodes
call an explicitly configured HTTPS adapter endpoint. Chatty applies SSRF
protection, three attempts with backoff, durable run records, idempotency
keys, and failure traces. The node catalog provides portable Chatty, HTTP,
webhook, and provider adapter definitions. n8n JSON import preserves each
node type, version, and parameters and sends them to the configured adapter.
It does not embed the n8n runtime or claim native execution of n8n nodes.

For the authenticated acceptance test, set `E2E_OWNER_EMAIL`,
`E2E_OWNER_PASSWORD`, and `E2E_OWNER_BOT_ID`, then run:

```bash
pnpm --dir frontend exec playwright test e2e/flow-builder.spec.ts
```

The test creates a real workflow, publishes it, pauses it, resumes it, and
deletes it at the end of the run.
