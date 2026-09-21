<div align="center">

<img src="assets/chatty-icon.png" alt="Chatty" width="88" /> <img src="assets/readme-icon.png" alt="Chatty" width="88" />

# Chatty by PersonaliAI - Backend (private)

**FastAPI backend for Chatty - chat/RAG/bookings/channels API, deployed to Cloud Run.**

</div>

---

This is the **private** working copy of the Chatty backend. The public,
open-source mirror lives at [PersonaliAI/chatty](https://github.com/PersonaliAI/chatty)
(monorepo, `backend/` + `frontend/`) - same code, different repo layout.
See [AGENTS.md](AGENTS.md) for exactly how changes get pushed to both.

## What's here

```
main.py             FastAPI app entrypoint
app/                Routers, core (auth/security/db helpers), schemas
plugins/            Google/Microsoft integrations, RAG, the widget assistant
                     orchestration (widget_brain.py), notifications, agent tools
voice-agent/        LiveKit voice worker agent + self-hosted VPS Docker Compose stack
tests/               pytest smoke + unit tests
sql/, supabase/      Database schema and migrations
```

## Ecommerce and omnichannel RAG

Chatty includes a provider-neutral multimodal catalog layer. Product text and
images are indexed in pgvector; an uploaded product photo is analyzed by the
vision model and matched against the bot's catalog. Grounded responses can
include price, stock, variants, product images, and direct checkout links.

WooCommerce connects through its scoped REST API keys or the official
`wc-auth/v1/authorize` flow, performs an initial paginated sync, and stays fresh
through signed product webhooks. The same assistant path is available through
Meta WhatsApp Cloud API for text, images, documents, and voice notes. See
[`docs/COMMERCE.md`](docs/COMMERCE.md) for setup, security, endpoints, and the
production checklist.

## Local development

```bash
python -m venv .venv && .venv\Scripts\activate   # or source .venv/bin/activate on macOS/Linux
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Voice worker (optional):
```bash
python voice-agent/voice_worker.py dev
```

## Deployment

Manual, via Cloud Build from local source - there's no CI/CD auto-deploy trigger:

```bash
gcloud run deploy chatty-api --source . --region=us-central1 --project=personaliai --clear-base-image --quiet
```

`--clear-base-image` is required; omitting it fails with a base-image mismatch error on this service.

## CI

`.github/workflows/ci.yml` runs on push to `backend-service`: compile-check,
the pytest suite, and a non-blocking `pip-audit` pass. `.github/dependabot.yml`
watches pip/Docker/GitHub Actions dependencies weekly.
