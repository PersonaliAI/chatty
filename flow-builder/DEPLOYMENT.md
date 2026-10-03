# Chatty Flow Builder deployment

The flow builder is a separate Next.js application. Deploy it as its own Firebase App Hosting backend.

The production URL is `https://flow.personaliai.com`.

The Firebase project is `personaliai`. The App Hosting backend is `flow` in
`us-central1`, with `https://flow.personaliai.com` as its production URL.

1. In Firebase App Hosting, connect the `PersonaliAI/chatty` repository to the `flow` backend.
2. Set the source root to `/flow-builder` and deploy the branch that contains this directory.
3. Keep `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `NEXT_PUBLIC_CHATTY_API_URL` in the App Hosting environment.
4. Point the custom domain `flow.personaliai.com` to the App Hosting backend.
5. Set `FLOW_BUILDER_URL=https://flow.personaliai.com` in the Chatty API environment.
6. Add the same URL to `ALLOWED_ORIGINS` if the deployment uses a custom API allowlist.
7. Apply the Chatty flow migration before opening the builder for users.

Run the migrations from a trusted deployment environment that has the linked
Supabase project and its database credentials:

```bash
supabase db push --db-url "$SUPABASE_DB_URL"
```

The migration set includes the prerequisite version and run tables. It then
creates workflow identities, enable state, and idempotent run fields. Verify
that `chatty_flows`, `chatty_flow_versions`, and `chatty_flow_runs` exist
before enabling customer access.

Run `python scripts/verify_flow_schema.py` with `SUPABASE_URL` and
`SUPABASE_PUBLISHABLE_KEY` to check REST visibility.

For Cloud Run deployments, use the bundled
`backend/scripts/apply_flow_migrations.py` runner as a one-off job. The job
must receive `SUPABASE_DB_PASSWORD` from Secret Manager.

The browser never receives the Supabase secret key. Chatty creates a one-minute, bot-bound handoff token when a user opens the builder. The builder uses that token for its first API calls, then uses the normal Supabase session when available.

The builder can run locally with `pnpm dev` from this directory. Open `http://localhost:3000/?bot_id=<bot-id>` after the Chatty API is running.
