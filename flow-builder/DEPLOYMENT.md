# Chatty Flow Builder deployment

The flow builder is a separate Next.js application. Deploy it as its own Firebase App Hosting backend.

The Firebase project is `personaliai`. A dedicated App Hosting backend now exists:
`chatty-flow-builder` in `us-central1`, with the default URL `https://chatty-flow-builder--personaliai.us-central1.hosted.app`.

1. In Firebase App Hosting, connect the `PersonaliAI/chatty` repository to the `chatty-flow-builder` backend.
2. Set the source root to `/flow-builder` and deploy the branch that contains this directory.
3. Keep `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `NEXT_PUBLIC_CHATTY_API_URL` in the App Hosting environment.
4. Point the custom domain `flows.chatty.personaliai.com` to the App Hosting backend.
5. Set `FLOW_BUILDER_URL=https://flows.chatty.personaliai.com` in the Chatty API environment.
6. Add the same URL to `ALLOWED_ORIGINS` if the deployment uses a custom API allowlist.
7. Apply the Chatty flow migration before opening the builder for users.

The browser never receives the Supabase secret key. Chatty creates a one-minute, bot-bound handoff token when a user opens the builder. The builder uses that token for its first API calls, then uses the normal Supabase session when available.

The builder can run locally with `pnpm dev` from this directory. Open `http://localhost:3000/?bot_id=<bot-id>` after the Chatty API is running.
