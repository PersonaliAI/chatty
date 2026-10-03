# Chatty Flow Builder

This is a separate Next.js application for Chatty workflow authoring. It is
designed to deploy as its own Firebase App Hosting backend at
`https://flow.personaliai.com`.

## Local development

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000/?bot_id=<chatty-bot-id>` after signing in to the
Chatty Supabase project in the same browser. Without a bot ID the editor keeps a
local draft for visual development.

## Firebase App Hosting

Create a separate App Hosting backend with this directory as its source root.
Use `apphosting.yaml` for the public Chatty API URL and Supabase browser values.
Set the builder URL in Chatty's frontend App Hosting configuration through
`NEXT_PUBLIC_FLOW_BUILDER_URL`.

The builder never receives a service-role key. It sends the signed-in user's
Supabase access token to Chatty. Chatty checks the bot's existing `design`
permission before reading, saving, or publishing a flow version.

The API route and the database migration must be deployed before enabling the
dashboard link. The builder uses the Chatty Supabase session or a short-lived,
bot-bound handoff token. Every API operation checks the user's design
permission for the selected bot.

Published flows execute from Chatty events. Action nodes call an explicitly
configured HTTPS adapter endpoint. Chatty applies SSRF protection, three
attempts with backoff, durable run records, idempotency keys, and failure
traces. The node catalog provides portable Chatty, HTTP, webhook, and provider
adapter definitions. n8n JSON import preserves each node type, version, and
parameters and sends them to the configured adapter. It does not embed the n8n
runtime or claim native execution of n8n nodes.

For the authenticated acceptance test, set `E2E_OWNER_EMAIL`,
`E2E_OWNER_PASSWORD`, and `E2E_OWNER_BOT_ID`, then run:

```bash
pnpm --dir frontend exec playwright test e2e/flow-builder.spec.ts
```

The test creates a real workflow, publishes it, pauses it, resumes it, and
deletes it at the end of the run.
