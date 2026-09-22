<div align="center">

<img src="https://raw.githubusercontent.com/PersonaliAI/chatty/main/backend/assets/chatty-icon.png" alt="Chatty" width="88" /> <img src="https://raw.githubusercontent.com/PersonaliAI/chatty/main/backend/assets/readme-icon.png" alt="Chatty" width="88" />

# Chatty by PersonaliAI

**Open-source AI customer support: chat widget + real-time voice agent + a full MCP server, grounded in your own knowledge base.**

Run the application containers on your own host while keeping Supabase Auth,
Postgres, Storage, and Realtime managed. The same deployment contract works on
a VPS, Railway, Render, or another Docker host without touching the live
Supabase project.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![CI](https://github.com/PersonaliAI/chatty/actions/workflows/ci.yml/badge.svg)](https://github.com/PersonaliAI/chatty/actions/workflows/ci.yml)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](frontend)
[![FastAPI](https://img.shields.io/badge/FastAPI-Python%203.11-009688?logo=fastapi&logoColor=white)](backend)
[![Supabase](https://img.shields.io/badge/Database-Supabase-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com)
[![LiveKit](https://img.shields.io/badge/Voice-LiveKit-FF6600)](https://livekit.io)
[![MCP](https://img.shields.io/badge/Agent%20Control-MCP-8b5cf6)](#mcp-server--agent-control)
[![Docker](https://img.shields.io/badge/Deploy-Docker%20Compose-2496ED?logo=docker&logoColor=white)](docker-compose.yml)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

[Chatty Cloud (hosted)](https://chatty.personaliai.com) · [Documentation](https://docs.chatty.personaliai.com) · [Quick Start](#-quick-start-docker-compose) · [Self-Hosting Guide](#-self-hosting-step-by-step) · [Platform Runbook](docs/SELF_HOST_MANAGED_SUPABASE.md) · [Features](#-features) · [MCP Server](#mcp-server--agent-control) · [Architecture](#architecture) · [Contributing](#-contributing)

</div>

---

## Table of contents

- [Why Chatty](#why-chatty)
- [Features](#-features)
- [Architecture](#architecture)
- [Requirements](#-requirements)
- [Quick Start (Docker Compose)](#-quick-start-docker-compose)
- [Self-Hosting, Step by Step](#-self-hosting-step-by-step)
  - [1. Create and configure Supabase](#step-1--create-and-configure-supabase)
  - [2. Apply the database schema](#step-2--apply-the-database-schema)
  - [3. Get your LLM key](#step-3--get-your-llm-key-gemini-free-tier)
  - [4. Configure environment variables](#step-4--configure-environment-variables)
  - [5. Run it](#step-5--run-it)
  - [6. Verify the install](#step-6--verify-the-install)
  - [7. Optional features](#step-7--optional-features)
  - [8. Production deployment](#step-8--production-deployment)
  - [9. Updating](#step-9--updating)
  - [Troubleshooting](#troubleshooting)
- [Local Development (without Docker)](#-local-development-without-docker)
- [Managed-Supabase platform runbook](docs/SELF_HOST_MANAGED_SUPABASE.md)
- [MCP Server & Agent Control](#mcp-server--agent-control)
- [Environment Variable Reference](#environment-variable-reference)
- [Testing & CI](#-testing--ci)
- [Security](#-security)
- [Contributing](#-contributing)
- [License](#-license)

## Why Chatty

Every hosted chatbot SaaS charges per-seat or per-message and holds your conversation data. Chatty is open-core: run it yourself for free, or use [Chatty Cloud](https://chatty.personaliai.com) - our own hosted version of this exact repo, if you'd rather skip the ops work. Either way you get the same feature set - streaming chat, a real-time voice agent, RAG over your own documents, meeting booking, lead capture, WhatsApp/Slack channels, and a full [MCP server](#mcp-server--agent-control) so an AI agent can run the whole dashboard for you.

|  | Closed-source SaaS chatbots | **Chatty** |
|---|---|---|
| Your conversation data | Lives on their servers, always | Your Supabase project - whether you self-host or use Chatty Cloud |
| Pricing | Per-seat / per-message, no free tier | Self-host for free, or a straightforward hosted plan on Chatty Cloud |
| LLM | Locked to their model | **Bring your own** - Gemini by default, or BYOK OpenAI/Anthropic/OpenRouter |
| Voice agent | Usually a separate, pricier tier | Included, same knowledge base as chat |
| Agent/automation access | Usually none, or a paid add-on | **Full MCP server included** - 55 tools, OAuth 2.0 secured |
| Source code | Closed | **MIT licensed** - fork it, audit it, extend it, run it anywhere |

## ✨ Features

- 💬 **Embeddable chat widget** - one `<script>` tag, streaming replies, works on any website
- 🎙️ **Real-time voice agent** - phone-call-style conversations via LiveKit, same brain as the chat widget
- 📚 **RAG over your own knowledge base** - upload PDF/DOCX/PPTX/XLSX, crawl URLs, auto-chunked and embedded
- 🛠️ **Tool-calling** - books real meetings (Google Meet/Microsoft Teams/Zoom links), captures leads, checks a calendar
- 🔌 **Omnichannel** - WhatsApp and Slack, in addition to the web widget
- 🔑 **BYOK** - default is Gemini (generous free tier); swap in your own OpenAI/Anthropic/OpenRouter key per bot
- 🤖 **MCP server** - connect Claude, ChatGPT, or any MCP client and run the entire dashboard from a conversation: create bots, edit flows, run campaigns, manage leads, configure voice, and more, all as 55 callable tools secured by OAuth 2.0 + PKCE (see [MCP Server & Agent Control](#mcp-server--agent-control))
- 📊 **Dashboard** - manage bots, inbox/conversations, knowledge sources, booking rules, campaigns, and channel connections
- 🐳 **One-command managed self-host** - `docker compose up`, point it at a Supabase project, done

## Architecture

The public repository has one canonical application layout: `frontend/` contains the Next.js dashboard and widget, while
`backend/` contains the FastAPI API, workers, integrations, and migrations. The managed Supabase profile is the default
and remains unchanged for existing deployments. A fully provider-neutral deployment is opt-in via
`DEPLOYMENT_PROFILE=self_host`; it uses PostgreSQL/pgvector, Redis, SeaweedFS S3-compatible storage, and OIDC.

```mermaid
flowchart TB
    classDef actor fill:#f8fafc,stroke:#64748b,color:#0f172a
    classDef edge fill:#eff6ff,stroke:#2563eb,color:#1e3a8a
    classDef app fill:#ecfdf5,stroke:#059669,color:#064e3b
    classDef data fill:#f0fdfa,stroke:#0f766e,color:#134e4a
    classDef integration fill:#fff7ed,stroke:#ea580c,color:#7c2d12
    classDef deploy fill:#f5f3ff,stroke:#7c3aed,color:#4c1d95

    subgraph clients["Clients and channels"]
        direction LR
        visitor(("Website visitor")):::actor
        operator(("Workspace operator")):::actor
        channels["WhatsApp · Slack · MCP clients"]:::actor
    end

    subgraph edge["Public edge"]
        direction LR
        tls["TLS / custom domain / rate limits"]:::edge
        web["frontend/\nNext.js dashboard + widget"]:::app
    end

    subgraph compute["Chatty application containers"]
        direction LR
        api["backend/\nFastAPI API + workers"]:::app
        voice["Voice worker\nLiveKit Agents"]:::app
    end

    subgraph managed["Managed Supabase — default profile"]
        direction LR
        auth["Auth\n(users + sessions)"]:::data
        postgres["Postgres + pgvector\nRLS + migrations"]:::data
        storage["Storage\nknowledge files"]:::data
        realtime["Realtime\nconversation updates"]:::data
    end

    subgraph integrations["Optional integrations"]
        direction LR
        llm["Gemini / OpenAI / Anthropic"]:::integration
        calendar["Google / Microsoft / Zoom"]:::integration
        meta["Meta WhatsApp / Slack"]:::integration
        livekit["LiveKit Cloud or self-hosted"]:::integration
        billing["Lemon Squeezy / webhooks"]:::integration
    end

    subgraph targets["Run the same two containers anywhere"]
        direction LR
        docker["Docker Compose / VPS"]:::deploy
        railway["Railway"]:::deploy
        render["Render Blueprint"]:::deploy
        heroku["Heroku-style container host"]:::deploy
    end

    visitor --> tls --> web
    operator --> web
    channels --> api
    web -->|HTTPS| api
    api --> auth
    api --> postgres
    api --> storage
    api --> realtime
    api --> llm
    api --> calendar
    api --> meta
    api --> billing
    api --> voice --> livekit
    docker -. deploys .-> web
    docker -. deploys .-> api
    railway -. deploys .-> web
    railway -. deploys .-> api
    render -. deploys .-> web
    render -. deploys .-> api
    heroku -. deploys .-> web
    heroku -. deploys .-> api
    linkStyle default stroke:#64748b,stroke-width:1.5px
```

```
chatty/
├── frontend/         Next.js - dashboard, embeddable widget, widget.js loader
├── backend/          FastAPI - chat/RAG/bookings/channels/OAuth/MCP API
│   ├── app/          Routers, core (auth/security/db helpers), schemas
│   ├── plugins/       Google/Microsoft integrations, RAG, widget orchestration
│   ├── supabase/      Database schema and migrations (67 files, applied in order)
│   ├── scripts/       apply_migrations.py and other one-off ops scripts
│   ├── voice-agent/   LiveKit voice worker agent + self-hosted VPS Docker stack
│   └── tests/          pytest smoke + unit tests
└── docker-compose.yml
```

### Deployment profiles

| Profile | Data and identity services | When to use |
|---|---|---|
| `managed_supabase` (default) | Supabase Auth, Postgres, Storage, pgvector, and RLS | Existing Chatty Cloud or Supabase-backed deployments |
| `self_host` (opt-in) | PostgreSQL/pgvector, Redis, SeaweedFS S3-compatible storage, and an OIDC provider | Fully self-managed deployments with no Supabase dependency |

The self-host stack is isolated from the managed path. Follow [`backend/docs/SELF_HOST_QUICKSTART.md`](backend/docs/SELF_HOST_QUICKSTART.md)
and use [`backend/env.self-host.example`](backend/env.self-host.example); do not point it at a production Supabase database.

### Deployment-platform compatibility

The managed-Supabase deployment contract is two Docker services (API + frontend).
The root `docker-compose.yml` runs both services without provisioning a second
database. The complete platform runbook, including secret handling, domains,
health checks, verification, rollback, and troubleshooting, is in
[docs/SELF_HOST_MANAGED_SUPABASE.md](docs/SELF_HOST_MANAGED_SUPABASE.md).

| Platform | Official deployment guide | Current repository status |
|---|---|---|
| ![Docker](https://img.shields.io/badge/Docker%20%2F%20VPS-2496ED?logo=docker&logoColor=white) | [Managed-Supabase Docker Compose](docker-compose.yml) | **Supported now** for the API + frontend; put TLS in front. |
| ![Railway](https://img.shields.io/badge/Railway-0B0D0E?logo=railway&logoColor=white) | [Railway Docker Compose guide](https://docs.railway.com/guides/docker-compose) | **Supported as two services**; Railway maps the API and frontend Dockerfiles separately. |
| ![Render](https://img.shields.io/badge/Render-46E3B7?logo=render&logoColor=111827) | [`render.yaml`](render.yaml) / [Render Blueprint reference](https://render.com/docs/blueprint-spec) | **Blueprint included**; it creates the API + frontend services and prompts for secrets. |
| ![Heroku](https://img.shields.io/badge/Heroku-430098?logo=heroku&logoColor=white) | [Heroku container runtime](https://devcenter.heroku.com/articles/container-registry-and-runtime) | **Supported as two container apps**; no full-stack Button is claimed. |

For a managed deployment keep `DEPLOYMENT_PROFILE=managed_supabase`. For the provider-neutral stack use
`DEPLOYMENT_PROFILE=self_host` and follow the self-host quickstart. Both profiles are in the same codebase; switching the
profile is an explicit deployment decision and does not migrate or modify the other environment.

## 📋 Requirements

| | Version | Needed for |
|---|---|---|
| [Docker](https://docs.docker.com/get-docker/) + Docker Compose | 24+ | Quick Start (recommended path) |
| [Python](https://www.python.org/downloads/) | 3.11+ | Backend, without Docker |
| [Node.js](https://nodejs.org/) | 20+ | Frontend, without Docker |
| [Supabase](https://supabase.com) account | free tier | Database (Postgres + Auth + Storage) |
| [Google AI Studio](https://aistudio.google.com/apikey) API key | free tier | Default LLM (Gemini) |

Everything else (LiveKit for voice, WhatsApp/Slack tokens, Google/Microsoft OAuth, Lemon Squeezy billing, Sentry, Upstash Redis) is **optional** - each env var you leave blank just disables that one feature; nothing else breaks.

## 🚀 Quick Start (Docker Compose)

The fastest path from clone to a running instance. See [Self-Hosting, Step by Step](#-self-hosting-step-by-step) below if you want the full walkthrough with screenshots-in-words and troubleshooting.

```bash
git clone https://github.com/PersonaliAI/chatty.git
cd chatty

# 1. Apply the database schema to a Supabase project you've already created
cd backend && pip install psycopg2-binary
python scripts/apply_migrations.py "postgresql://postgres:YOUR_PASSWORD@YOUR_HOST:5432/postgres"
cd ..

# 2. Configure environment variables
cp backend/.env.example backend/.env        # fill in Supabase + Gemini keys
cp frontend/.env.example frontend/.env      # fill in Supabase URL + anon key
cp .env.example .env                        # same NEXT_PUBLIC_* values (used at Docker build time)

# 3. Run it
docker compose up --build backend frontend
```

Dashboard: `http://localhost:3000` - sign up, create a bot, and the widget embed snippet is generated for you under bot settings.

## 📖 Self-Hosting, Step by Step

A fuller walkthrough than the Quick Start above - read this if it's your first time, or if something in Quick Start didn't work.

### Step 1 - Create and configure Supabase

1. Go to [supabase.com](https://supabase.com), sign up, and click **New Project**. The free tier is enough to run Chatty (upgrade later if you outgrow it).
2. Pick a region close to where you'll deploy the backend, set a database password, and wait for provisioning (~2 minutes).
3. Once the project is ready, go to **Project Settings → API** and note down:
   - **Project URL** (`https://xxxxx.supabase.co`)
   - **`anon` `public`** key
   - **`service_role`** key (keep this one secret - it bypasses row-level security)
4. Go to **Project Settings → Database → Connection string → URI**. Use the **Session pooler** or **direct connection** string (not the transaction pooler - schema migrations need a persistent session). You'll use this once, in the next step.

### Step 2 - Apply the database schema

Chatty ships 67 SQL migration files under `backend/supabase/migrations/`. Apply them all in order with the included script - it's idempotent (tracks what's already applied in a `_migrations_log` table), so it's always safe to re-run after pulling updates:

```bash
cd backend
pip install psycopg2-binary
python scripts/apply_migrations.py "postgresql://postgres:YOUR_PASSWORD@YOUR_HOST:5432/postgres"
```

You should see output like:

```
67 migration files found
  applied 20260510084430_initial_schema.sql
  applied 20260511120000_slice2_billing_and_integrations.sql
  ...
Done - applied 67 new, skipped 0 already-applied.
```

If a migration fails partway through, the script stops and prints which file failed - fix the reported issue (usually a stale connection or an already-modified table from manual tinkering) and re-run; already-applied files are skipped automatically.

### Step 3 - Get your LLM key (Gemini, free tier)

Chatty defaults to Google's Gemini (generous free tier, no credit card required to start):

1. Go to [aistudio.google.com/apikey](https://aistudio.google.com/apikey).
2. Sign in with a Google account and click **Create API key**.
3. Copy the key - you'll paste it into `GEMINI_API_KEY` in the next step.

Prefer a different model? Every bot supports BYOK (OpenAI, Anthropic, or OpenRouter) configurable per-bot from the dashboard once it's running - you don't need to decide this now.

### Step 4 - Configure environment variables

Three files, one per surface:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
cp .env.example .env
```

Open `backend/.env` and fill in, at minimum:

```bash
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SECRET_KEY=<secret key from Step 1>
SUPABASE_DB_HOST=<from the connection string in Step 1>
SUPABASE_DB_PASSWORD=<your database password from Step 1>

GEMINI_API_KEY=<from Step 3>

# Generate each of these once with the command shown next to it:
FUNCTION_SECRET=<python -c "import secrets; print(secrets.token_urlsafe(32))">
BYOK_ENCRYPTION_KEY=<python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())">
```

Open `frontend/.env` and `.env` (repo root) and fill in the matching `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` (same values as above - the frontend only ever sees the public `anon` key, never `service_role`).

Every other variable in `backend/.env.example` is optional and documented inline - voice, WhatsApp, Slack, Google/Microsoft OAuth, billing, error monitoring, and more. Leave them blank to start; each one unlocks exactly one feature. See the full [Environment Variable Reference](#environment-variable-reference) below for what each does.

**If you're deploying under your own domain** (not just running locally), also set `CHATTY_BACKEND_URL` and `CHATTY_FRONTEND_URL` in `backend/.env` to your real domains - these are the OAuth issuer and MCP resource identifiers; leaving them at the default breaks OAuth/MCP client discovery once you're not running on `localhost`. See [MCP Server & Agent Control](#mcp-server--agent-control).

### Step 5 - Run it

```bash
docker compose up --build backend frontend
```

First build takes a few minutes (installing Python/Node dependencies, compiling the Next.js production bundle). Subsequent runs are fast - Docker caches layers.

- **Dashboard**: `http://localhost:3000`
- **Backend API**: `http://localhost:8000` (interactive docs at `http://localhost:8000/docs`)

### Step 6 - Verify the install

1. Open `http://localhost:8000/docs` - you should see the FastAPI Swagger UI listing every endpoint. If this doesn't load, the backend container failed to start; check `docker compose logs backend`.
2. Open `http://localhost:3000`, click **Sign up**, and create an account (this goes through Supabase Auth against your own project).
3. Create your first bot from the dashboard. Add a knowledge source (paste some text or a URL) and try it in the Playground tab.
4. Copy the embed snippet from the bot's settings and drop it into any HTML page - the widget should load and respond using your knowledge base.

If any of these steps fail, see [Troubleshooting](#troubleshooting) below.

### Step 7 - Optional features

Each of these is opt-in - set the relevant env vars in `backend/.env` and restart (`docker compose up --build backend`):

| Feature | Env vars | Notes |
|---|---|---|
| **Voice agent** | `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` | Free tier at [cloud.livekit.io](https://cloud.livekit.io), or self-host LiveKit. Run the worker from [`backend/voice-agent`](backend/voice-agent) as a separate service; the managed-Supabase compose keeps it opt-in. |
| **WhatsApp channel** | `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_ACCESS_TOKEN` | Meta Cloud API - see [Meta's developer docs](https://developers.facebook.com/docs/whatsapp/cloud-api). |
| **Slack channel** | `SLACK_SIGNING_SECRET` | From your Slack app's **Basic Information** page. |
| **Google Calendar/Gmail booking** | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Create OAuth credentials at [console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials). |
| **Microsoft 365 booking** | `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET` | Register an app in Azure AD. Real Teams online-meeting links, not a placeholder. |
| **Real Zoom meeting links** | `ZOOM_ACCOUNT_ID`, `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET` | Server-to-Server OAuth app in the [Zoom Marketplace](https://marketplace.zoom.us) (`meeting:write:meeting` scope). A single backend-wide credential - no per-user connect flow. Without this, bookings fall back to a placeholder link. |
| **Billing / paid plans** | `LEMONSQUEEZY_API_KEY` + related vars | Only relevant if you're reselling access; skip entirely for internal/free use. |
| **Error monitoring** | `SENTRY_DSN` | Optional - leave blank and errors just go to stdout/logs. |

### Step 8 - Production deployment without Cloud Run or Firebase App Hosting

The supported production shape is two Docker services (API + frontend) backed
by the same managed Supabase project. The full copy/paste runbook for each
platform is [SELF_HOST_MANAGED_SUPABASE.md](docs/SELF_HOST_MANAGED_SUPABASE.md).
It covers `DEPLOYMENT_PROFILE=managed_supabase`, secret-manager setup, domains,
health checks, production verification, rollback, and security boundaries.

The provider-neutral Postgres/Redis/object-store stack remains available only
as an advanced, explicit profile at
[`backend/docker-compose.self-host.yml`](backend/docker-compose.self-host.yml).
It is not started by the default compose file and is not required for the
managed-Supabase deployment.

### Step 9 - Updating

```bash
git pull
cd backend && python scripts/apply_migrations.py "postgresql://..."   # picks up any new migrations, skips old ones
cd .. && docker compose up --build backend frontend
```

### Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| `docker compose up` fails immediately on `backend` with `RuntimeError: ... environment variable is required` | `SUPABASE_URL` or `SUPABASE_SECRET_KEY` is missing from `backend/.env` - these two fail startup on purpose rather than silently falling back to nothing. |
| Backend starts but BYOK/booking/other features error at request time | `GEMINI_API_KEY`, `FUNCTION_SECRET`, or `BYOK_ENCRYPTION_KEY` is blank - these don't crash startup, but the specific feature that needs them fails when you actually use it. Fill them in per [Step 4](#step-4--configure-environment-variables). |
| Migration script hangs or times out | You're using the transaction pooler connection string. Switch to the **Session pooler** or **direct connection** string from Supabase's Connection string page. |
| Dashboard loads but sign-up fails | `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` in `frontend/.env` don't match the project you ran migrations against. |
| Widget embeds but never replies | Check `docker compose logs backend` for a Gemini API error - usually an invalid/missing `GEMINI_API_KEY`, or the free tier's rate limit. |
| MCP/OAuth client can't discover the server once deployed | `CHATTY_BACKEND_URL` is still the default (`https://api.chatty.personaliai.com`) instead of your own domain - set it explicitly once you're not on `localhost`. |
| Voice agent never joins the call | `LIVEKIT_URL`/`LIVEKIT_API_KEY`/`LIVEKIT_API_SECRET` unset, or the `voice-worker` service isn't running (`docker compose up --build` with no service names starts it; `docker compose up backend frontend` doesn't). |

Still stuck? [Open an issue](https://github.com/PersonaliAI/chatty/issues) with your `docker compose logs` output (redact secrets first).

## 💻 Local Development (without Docker)

**Backend:**
```bash
cd backend
python -m venv .venv && .venv\Scripts\activate   # or source .venv/bin/activate on macOS/Linux
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

**Voice worker** (optional):
```bash
cd backend
python voice-agent/voice_worker.py dev
```

## MCP Server & Agent Control

Chatty ships a full [Model Context Protocol](https://modelcontextprotocol.io) server - connect Claude, ChatGPT, or any MCP-compatible client and run the entire dashboard from a conversation instead of clicking through screens.

- **Auth**: OAuth 2.0 authorization-code flow with mandatory PKCE (RFC 7636), dynamic client registration (RFC 7591), and authorization server metadata discovery (RFC 8414) - no API key to paste into a config file.
- **Scopes**: `read`, `write`, `knowledge`, `voice`, `actions`, `admin` - a client only gets what it's granted.
- **55 tools** across 10 categories: bot lifecycle, customizer & design, visual flow builder, proactive campaigns, voice agent, knowledge base & RAG, inbox & human takeover, leads/calendar/meetings, analytics & self-healing, and settings/guardrails/BYOK/team RBAC.
- **Real data only** - every tool reads and writes the exact same tables the dashboard does; nothing simulated.

Connect by pointing an MCP client at:

```json
{
  "mcpServers": {
    "chatty": {
      "url": "https://your-backend-domain/mcp"
    }
  }
}
```

The client opens a normal OAuth consent screen on first connect. **If you're self-hosting under your own domain**, set `CHATTY_BACKEND_URL` (and `CHATTY_FRONTEND_URL`, for the consent screen redirect) in `backend/.env` to your real URLs first - see [Step 4](#step-4--configure-environment-variables).

## Environment Variable Reference

Every environment variable is documented inline in [`backend/.env.example`](backend/.env.example) and [`frontend/.env.example`](frontend/.env.example) - what it's for, where to get it, and what happens if you leave it blank. The tables below are the short version.

**Backend - required to start:**

| Variable | Purpose |
|---|---|
| `SUPABASE_URL`, `SUPABASE_SECRET_KEY` | Database + auth connection; the secret key stays server-side |
| `SUPABASE_DB_HOST`, `SUPABASE_DB_PASSWORD` | Direct Postgres connection for a few operations PostgREST can't do |
| `FUNCTION_SECRET` | Signs widget origin tokens + OAuth state JWTs; gates internal cron/admin endpoints |
| `BYOK_ENCRYPTION_KEY` | Encrypts customer-supplied BYOK API keys at rest |
| `GEMINI_API_KEY` | Default LLM |

**Backend - optional, one per feature:** voice (LiveKit), WhatsApp, Slack, Google/Microsoft OAuth (calendar booking), Zoom (Server-to-Server OAuth), transactional email (OneSignal), web crawl (Jina), billing (Lemon Squeezy), rate limiting (Upstash Redis), error monitoring (Sentry), and `CHATTY_BACKEND_URL`/`CHATTY_FRONTEND_URL` (only needed once you're deployed under your own domain - see [MCP Server & Agent Control](#mcp-server--agent-control)). Full list with setup links: [`backend/.env.example`](backend/.env.example).

**Frontend - required:**

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Must match the backend's Supabase project |
| `NEXT_PUBLIC_BACKEND_URL` | Where the frontend calls the API - `http://localhost:8000` locally, your real backend URL in production |

**Frontend - optional:** billing portal (Lemon Squeezy), Firebase Analytics. Full list: [`frontend/.env.example`](frontend/.env.example).

## 🧪 Testing & CI

`.github/workflows/ci.yml` runs on every push/PR to `main`:

- **Backend**: compile-check (`python -m compileall`), the full pytest suite (`backend/tests/`), and a non-blocking `pip-audit` dependency scan.
- **Frontend**: TypeScript typecheck, ESLint, a widget design-token drift check, and a production build.

Run the backend suite locally:

```bash
cd backend
pip install -r requirements.txt pytest
python -m pytest tests/ -q
```

`.github/dependabot.yml` watches pip/npm/Docker/GitHub Actions dependencies weekly.

## 🔒 Security

Found a security issue? Please **don't** open a public GitHub issue for it. Instead, use GitHub's private reporting: this repo's **Security** tab → **Report a vulnerability**. We'll respond as quickly as we can.

`SUPABASE_SECRET_KEY`, `FUNCTION_SECRET`, `BYOK_ENCRYPTION_KEY`, and every OAuth/API client secret should be treated as production credentials - never commit a filled-in `.env` file (all three `.env.example` templates are already gitignored under their real names).

## 🤝 Contributing

Issues and PRs welcome - this is a young project and there are rough edges. See [CONTRIBUTING.md](CONTRIBUTING.md) for the development setup and good first areas: additional STT/TTS provider plugins, additional channel integrations, deployment guides for platforms beyond Docker Compose, and docs.

## 📄 License

MIT - see [LICENSE](LICENSE). Use it, fork it, ship it commercially - attribution appreciated but not required.

---

<div align="center">

If Chatty is useful to you, **star the repo** ⭐ - it helps other people find it.

</div>
