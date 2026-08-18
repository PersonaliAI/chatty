# Contributing to Chatty

Thanks for considering a contribution — this is a young project and there's plenty of room to help.

## Before you start

For anything beyond a small fix (typos, obvious bugs), please open an issue first to discuss the approach. Saves everyone rework on larger changes.

## Development setup

See [README.md](README.md#-local-development-without-docker) for running the frontend/backend locally without Docker.

## Good first areas

- **STT/TTS provider plugins** — the voice agent already supports several providers (`backend/voice_worker.py`); adding another follows the same pattern.
- **Channel integrations** — WhatsApp/Slack/Telegram exist as a reference for adding e.g. Discord or Instagram DM.
- **Docs** — setup edge cases, deployment guides for platforms beyond Docker Compose (Railway, Render, Fly.io).
- **Tests** — `backend/tests/` has room for more coverage.

## Pull requests

- Keep PRs focused — one logical change per PR is easier to review than a bundle of unrelated fixes.
- Make sure `python -m pytest backend/tests/` and `npx tsc --noEmit` (in `frontend/`) both pass.
- Describe *why* the change is needed, not just what it does — the CI workflow checks the *what* for you.

## Reporting bugs / requesting features

Open a [GitHub issue](https://github.com/PersonaliAI/chatty/issues) — include repro steps for bugs, and for features, the use case you're trying to solve (not just the implementation you have in mind).

## Code of conduct

Be respectful. Disagree on technical merits, not personal ones.
