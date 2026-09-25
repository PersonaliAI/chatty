# Agent instructions - chatty-backend

## Single canonical repository

The backend is maintained directly in `PersonaliAI/chatty` under `backend/`.
There is no private source repository or second checkout to mirror.

| Remote | Repo | Branch | Layout | Purpose |
|---|---|---|---|---|
The repository contains the frontend, backend, voice worker, deployment
configuration, tests, and docs in one checkout.

Push changes directly to the `main` branch after validation.

## Workflow for any backend code change

1. Make the change and commit it on `main`.
2. Push to `PersonaliAI/chatty` `main`.
3. Deploy to production if the change should go live now:
   `gcloud run deploy chatty-api --source . --region=us-central1 --project=personaliai --clear-base-image --quiet`
   (`--clear-base-image` is required - omitting it fails with a base-image
   error on this service.)
4. Verify CI and the deployed health/readiness checks.
<!-- The old private-repository mirroring procedure was retired. -->
<!--
   ```
   git diff <prev-commit> <new-commit> -- <changed files> > /tmp/fix.patch
   sed -i 's|a/app/|a/backend/app/|; s|b/app/|b/backend/app/|; s|a/main.py|a/backend/main.py|; s|b/main.py|b/backend/main.py|' /tmp/fix.patch
   # (adjust the sed for whichever paths actually changed - plugins/, requirements.txt, Dockerfile, etc.)
   git checkout personaliai-main
   git apply --check /tmp/fix.patch   # verify before applying
   git apply /tmp/fix.patch
   # re-run compile-check / tests here, same as step 1
   git add <files> && git commit -m "..." && git push personaliai personaliai-main:main
   git checkout backend-service       # switch back - don't leave the repo on personaliai-main
   ```
   The patch-and-path-rewrite dance is necessary because the two branches
   have genuinely different directory layouts for the same files - a plain
   cherry-pick won't apply cleanly.
5. Before believing the mirror step is done, verify both branches' HEADs
actually contain the fix (`git log`, or diff the specific file against
each remote) - don't just assume the sed/patch applied correctly.
-->

**A `.github/dependabot.yml`, CI workflow, LICENSE, etc. change is also a
real change** - mirror those too, not just application code.

## Known gotchas from past sessions

- **Don't leave this checkout on `personaliai-main` after mirroring** - the
  working tree layout changes completely (a `frontend/` folder appears
  alongside `backend/`), which is confusing and has caused an agent to
  mistake it for a duplicate/second frontend repo. Always `git checkout
  backend-service` when done.
- **`personaliai-main`'s `.github/workflows/ci.yml` is a different file**
  from `backend-service`'s - it has `backend`/`frontend` jobs with
  `working-directory` set per job. Don't copy `backend-service`'s ci.yml
  over it; edit each branch's copy separately if CI needs a change on both.
- **`main` on `PersonaliAI/chatty` has branch protection** (required status
  checks: `backend`, `frontend`). Direct pushes still succeed for
  admins/owners (`enforce_admins: false`) but GitHub logs them as a
  "bypassed rule violation" - that's expected, not an error.
- **`scripts/mirror-to-personaliai.sh`'s `MIRRORED_PREFIXES` list must cover
  every top-level path you commit** - a path not listed there is left
  unrewritten by the diff and lands as an untracked file at the wrong
  (root-level) location on `personaliai-main`, silently missing the commit
  entirely (caught once already: `supabase/migrations/` was missing).
  `supabase/migrations_chatty_standalone/` is deliberately NOT in the list -
  that directory isn't tracked on `personaliai-main` at all.
- If `npm install`/`pip install` commands run in this environment show
  dependency conflicts mentioning unrelated tools (`crewai`, `browser-use`,
  `fastembed`, `langchain-google-genai`, `onnxruntime`, etc.) - that's
  normal. This local Python environment is shared across many unrelated
  projects on this machine, not a clean venv scoped to this repo. It does
  not reflect what actually happens in the isolated Docker/CI build.

## The frontend is a separate, equally-duplicated repo

This branch (`backend-service`) is backend-only and has no `frontend/`
directory - don't be surprised by that. The frontend lives in its own
sibling checkout, `../chatty` (`Damayantha/chatty:main`), and is mirrored
into `personaliai-main`'s `frontend/` the same way this repo's backend is
mirrored into `personaliai-main`'s `backend/`. See `../chatty/AGENTS.md` for
that workflow - it follows this file's pattern exactly. A frontend change
that only lands in `../chatty` (not mirrored to `personaliai-main`) is an
incomplete fix, same as a backend-only fix here would be.
