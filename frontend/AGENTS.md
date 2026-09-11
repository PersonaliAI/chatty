# Agent instructions - chatty (frontend)

## This frontend lives in two places. Every real change goes to both.

This directory is `Damayantha/chatty` on branch `main` - the private,
standalone frontend repo. The same frontend code is also embedded inside the
`chatty-backend` monorepo checkout, on branch `personaliai-main`, which
pushes to `PersonaliAI/chatty` (public) as `frontend/`.

| Location | Repo | Branch | Layout | Purpose |
|---|---|---|---|---|
| This directory (`chatty/`) | `Damayantha/chatty` | `main` | root-level (`src/`, `public/` at repo root) | Private. Canonical source for frontend development - this is where new frontend work should land first. |
| `../chatty-backend` checked out on `personaliai-main` | `PersonaliAI/chatty` | `main` | monorepo (`frontend/src/`, sibling `backend/`) | Public, open-source mirror. |

These are **not** the same repo and not forks of each other - unrelated git
histories, kept in sync by manually mirroring changes. See
`../chatty-backend/AGENTS.md` for the equivalent backend workflow; frontend
follows the same pattern.

## Workflow for any frontend code change

1. Make the change and commit it here, in `chatty/` (this directory), on
   `main`.
2. `git push origin main`
3. Mirror the same change into `../chatty-backend`'s `frontend/`:
   ```
   git show <commit> -- <changed files> > /tmp/fix.diff
   sed -i 's|a/src/|a/frontend/src/|; s|b/src/|b/frontend/src/|; s|a/public/|a/frontend/public/|; s|b/public/|b/frontend/public/|; s|a/\.env\.example|a/frontend/.env.example|; s|b/\.env\.example|b/frontend/.env.example|' /tmp/fix.diff
   cd ../chatty-backend
   git checkout personaliai-main
   git apply --check /tmp/fix.diff   # verify before applying
   git apply /tmp/fix.diff
   # re-run npm install / lint / build here if package.json changed
   git add frontend/<files> && git commit -m "..." && git push personaliai personaliai-main:main
   git checkout backend-service       # switch back - don't leave the repo on personaliai-main
   ```
   `.env.example` and `package.json`/`package-lock.json` have already
   drifted structurally between the two copies in places - a plain patch
   won't always apply cleanly (e.g. differing surrounding context). When
   `git apply` fails, make the equivalent edit by hand instead of forcing it,
   and re-diff afterward to confirm both copies agree on the meaningful
   content (not necessarily byte-identical formatting).
4. Before believing the mirror step is done, diff the specific file against
   both remotes to confirm the change actually landed in both places.

## Known gotchas

- **This drifted once already**: the "Add Firebase Analytics" commit
  (`f536cb8`) landed here but was never mirrored to `personaliai-main`'s
  `frontend/`, so the public mirror silently lacked analytics until a later
  session caught and fixed the drift. Don't repeat this - mirror every
  frontend change, not just the ones that feel significant.
- `package-lock.json` in the two copies is not expected to be byte-identical
  (different npm/lockfile-version churn across install runs) - what matters
  is that `package.json`'s dependency list agrees.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
