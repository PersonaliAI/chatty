# Chatty Flow Builder deployment

The flow builder is part of the main Chatty frontend. Deploy one Firebase App
Hosting backend for `frontend`.

The production editor URL is `https://chatty.personaliai.com/flow`.

The Firebase project is `personaliai`. Keep the existing Chatty App Hosting
backend and serve the editor from its `/flow` route.

1. In Firebase App Hosting, connect the `PersonaliAI/chatty` repository to the existing Chatty backend.
2. Keep the source root at `/frontend` and deploy the branch that contains the `/flow` route.
3. Keep `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `NEXT_PUBLIC_CHATTY_API_URL` in the frontend environment.
4. Do not configure a separate `flow.personaliai.com` backend or `NEXT_PUBLIC_FLOW_BUILDER_URL`.
5. Add the `/flow` route to the normal frontend smoke test and apply the Chatty flow migration before opening the builder for users.

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

The browser never receives the Supabase secret key. The dashboard and editor now
run on the same origin, so they use the same Supabase browser session without a
handoff redirect. The API still accepts a one-minute, bot-bound handoff token
for standalone development and older links.

The builder can run locally with `pnpm dev` from this directory. Open `http://localhost:3000/?bot_id=<bot-id>` after the Chatty API is running.
