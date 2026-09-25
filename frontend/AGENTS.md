# Agent instructions - chatty (frontend)

## Single canonical repository

This frontend is maintained directly in the `PersonaliAI/chatty` repository
under `frontend/`. Make changes here, run the relevant checks, and push to the
`main` branch. There is no private-source mirror or second checkout to keep in
sync.

## Workflow for any frontend code change

1. Make the change in this checkout.
2. Run the relevant lint, unit, browser, and build checks.
3. Commit and push to `PersonaliAI/chatty` `main`.

## Known gotchas

- Keep environment files and credentials out of git; configure them in the
  deployment provider’s environment settings.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
