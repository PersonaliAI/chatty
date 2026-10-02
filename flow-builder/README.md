# Chatty Flow Builder

This is a separate Next.js application for Chatty workflow authoring. It is
designed to deploy as its own Firebase App Hosting backend, for example at
`https://flows.chatty.personaliai.com`.

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
dashboard link. Production work still needs browser SSO, rate limits, audit
events, workflow execution adapters, and a full mobile acceptance pass.
