# Agent instructions — chatty-backend

## This repo lives in two places. Every real change goes to both.

This backend is pushed to **two separate GitHub repositories**, and neither
is a fork of the other — they have unrelated git histories:

| Remote | Repo | Branch | Layout | Purpose |
|---|---|---|---|---|
| `origin` | `Damayantha/chatty` | `backend-service` | root-level (`main.py`, `app/`, `plugins/` at repo root) | Private. Has secrets in `.env` (gitignored). This is what's actually deployed to production (Cloud Run `chatty-api`, via `gcloud run deploy --source .`). |
| `personaliai` | `PersonaliAI/chatty` | `main` | monorepo (`backend/main.py`, `backend/app/`, `backend/plugins/`, sibling `frontend/`) | Public, open-source. No secrets committed. |

**Both remotes are already configured** in this local checkout — check with
`git remote -v`. Do not assume only one exists; a fix that only reaches one
of the two repos is an incomplete fix.

## Workflow for any backend code change

1. Make the change and commit it on `backend-service` (the branch this repo
   is normally checked out to — root-level layout, matches this file's
   directory structure directly).
2. `git push origin backend-service`
3. Deploy to production if the change should go live now:
   `gcloud run deploy chatty-api --source . --region=us-central1 --project=personaliai --clear-base-image --quiet`
   (`--clear-base-image` is required — omitting it fails with a base-image
   error on this service.)
4. Mirror the same change to `personaliai-main`:
   ```
   git diff <prev-commit> <new-commit> -- <changed files> > /tmp/fix.patch
   sed -i 's|a/app/|a/backend/app/|; s|b/app/|b/backend/app/|; s|a/main.py|a/backend/main.py|; s|b/main.py|b/backend/main.py|' /tmp/fix.patch
   # (adjust the sed for whichever paths actually changed — plugins/, requirements.txt, Dockerfile, etc.)
   git checkout personaliai-main
   git apply --check /tmp/fix.patch   # verify before applying
   git apply /tmp/fix.patch
   # re-run compile-check / tests here, same as step 1
   git add <files> && git commit -m "..." && git push personaliai personaliai-main:main
   git checkout backend-service       # switch back — don't leave the repo on personaliai-main
   ```
   The patch-and-path-rewrite dance is necessary because the two branches
   have genuinely different directory layouts for the same files — a plain
   cherry-pick won't apply cleanly.
5. Before believing the mirror step is done, verify both branches' HEADs
   actually contain the fix (`git log`, or diff the specific file against
   each remote) — don't just assume the sed/patch applied correctly.

**A `.github/dependabot.yml`, CI workflow, LICENSE, etc. change is also a
real change** — mirror those too, not just application code.

## Known gotchas from past sessions

- **Don't leave this checkout on `personaliai-main` after mirroring** — the
  working tree layout changes completely (a `frontend/` folder appears
  alongside `backend/`), which is confusing and has caused an agent to
  mistake it for a duplicate/second frontend repo. Always `git checkout
  backend-service` when done.
- **`personaliai-main`'s `.github/workflows/ci.yml` is a different file**
  from `backend-service`'s — it has `backend`/`frontend` jobs with
  `working-directory` set per job. Don't copy `backend-service`'s ci.yml
  over it; edit each branch's copy separately if CI needs a change on both.
- **`main` on `PersonaliAI/chatty` has branch protection** (required status
  checks: `backend`, `frontend`). Direct pushes still succeed for
  admins/owners (`enforce_admins: false`) but GitHub logs them as a
  "bypassed rule violation" — that's expected, not an error.
- If `npm install`/`pip install` commands run in this environment show
  dependency conflicts mentioning unrelated tools (`crewai`, `browser-use`,
  `fastembed`, `langchain-google-genai`, `onnxruntime`, etc.) — that's
  normal. This local Python environment is shared across many unrelated
  projects on this machine, not a clean venv scoped to this repo. It does
  not reflect what actually happens in the isolated Docker/CI build.
