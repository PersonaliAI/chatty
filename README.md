<div align="center">

<img src="frontend/public/logo.png" alt="Chatty" width="88" />

# Chatty

**Open-source AI customer support: chat widget + real-time voice agent, grounded in your own knowledge base.**

Self-host it in five minutes with Docker. No vendor lock-in, no per-seat pricing, your data stays in your own Supabase project.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![CI](https://github.com/PersonaliAI/chatty/actions/workflows/ci.yml/badge.svg)](https://github.com/PersonaliAI/chatty/actions/workflows/ci.yml)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](frontend)
[![FastAPI](https://img.shields.io/badge/FastAPI-Python%203.11-009688?logo=fastapi&logoColor=white)](backend)
[![Supabase](https://img.shields.io/badge/Database-Supabase-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com)
[![LiveKit](https://img.shields.io/badge/Voice-LiveKit-FF6600)](https://livekit.io)
[![Docker](https://img.shields.io/badge/Deploy-Docker%20Compose-2496ED?logo=docker&logoColor=white)](docker-compose.yml)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

[Quick Start](#-quick-start-docker-compose) · [Features](#-features) · [Architecture](#-architecture) · [Self-Hosting](#-configuration-reference) · [Contributing](#-contributing)

</div>

---

## Why Chatty

Every hosted chatbot SaaS charges per-seat or per-message and holds your conversation data. Chatty is the alternative: the same feature set — streaming chat, a real-time voice agent, RAG over your own documents, meeting booking, lead capture, WhatsApp/Slack/Telegram channels — running entirely on infrastructure you own.

|  | Hosted SaaS chatbots | **Chatty (self-hosted)** |
|---|---|---|
| Your conversation data | Lives on their servers | Stays in **your** Supabase project |
| Pricing | Per-seat / per-message | Free — pay only your own infra (a $5–10/mo VPS covers most teams) |
| LLM | Locked to their model | **Bring your own** — Gemini by default, or BYOK OpenAI/Anthropic/OpenRouter |
| Voice agent | Usually a separate, pricier tier | Included, same knowledge base as chat |
| Source code | Closed | **MIT licensed** — fork it, audit it, extend it |

## ✨ Features

- 💬 **Embeddable chat widget** — one `<script>` tag, streaming replies, works on any website
- 🎙️ **Real-time voice agent** — phone-call-style conversations via LiveKit, same brain as the chat widget
- 📚 **RAG over your own knowledge base** — upload PDFs/DOCX, crawl URLs, auto-chunked and embedded
- 🛠️ **Tool-calling** — books real meetings (Zoom/Google Meet links), captures leads, checks a calendar
- 🔌 **Omnichannel** — WhatsApp, Slack, and Telegram, in addition to the web widget
- 🔑 **BYOK** — default is Gemini (generous free tier); swap in your own OpenAI/Anthropic/OpenRouter key per bot
- 📊 **Dashboard** — manage bots, inbox/conversations, knowledge sources, booking rules, and channel connections
- 🐳 **One-command self-host** — `docker compose up`, point it at a free Supabase project, done

## 🏗️ Architecture

```mermaid
flowchart LR
    visitor(("Website visitor")) -->|chat / voice| widget["Embeddable widget\n(Next.js)"]
    owner(("Bot owner")) --> dashboard["Dashboard\n(Next.js)"]
    widget --> api["chatty-backend\n(FastAPI)"]
    dashboard --> api
    caller(("Phone-call-style\nvoice visitor")) -->|WebRTC| voice["voice_worker.py\n(LiveKit Agents)"]
    voice --> api
    api --> db[("Supabase\nPostgres + pgvector + RLS")]
    api --> llm["Gemini / BYOK LLM"]
    voice --> livekit["LiveKit Cloud\n(WebRTC transport)"]

    style widget fill:#6366f1,color:#fff,stroke:none
    style dashboard fill:#6366f1,color:#fff,stroke:none
    style api fill:#009688,color:#fff,stroke:none
    style voice fill:#ff6600,color:#fff,stroke:none
    style db fill:#3ecf8e,color:#000,stroke:none
```

```
chatty/
├── frontend/     Next.js — dashboard, embeddable widget, widget.js loader
├── backend/      FastAPI — chat/RAG/bookings/channels API
│   └── voice_worker.py   a separate LiveKit Agents process for the voice agent
└── docker-compose.yml
```

Both services talk to a single Supabase Postgres database — schema + row-level security policies, no separate ORM. Supabase's free tier is enough to get started.

## 🚀 Quick Start (Docker Compose)

**1. Create a Supabase project** at [supabase.com](https://supabase.com) — free tier is fine. Grab these from **Project Settings → API** and **→ Database**:
- Project URL, `anon` key, `service_role` key
- Database host/password (for the direct Postgres connection)

**2. Apply the database schema:**

```bash
cd backend
pip install psycopg2-binary
python scripts/apply_migrations.py "postgresql://postgres:YOUR_PASSWORD@YOUR_HOST:5432/postgres"
```

**3. Configure environment variables:**

```bash
cp backend/.env.example backend/.env        # fill in Supabase + Gemini keys
cp frontend/.env.example frontend/.env      # fill in Supabase URL + anon key
cp .env.example .env                        # same NEXT_PUBLIC_* values (used at Docker build time)
```

At minimum you need: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY` (free at [aistudio.google.com/apikey](https://aistudio.google.com/apikey)), `FUNCTION_SECRET` and `BYOK_ENCRYPTION_KEY` (generate with the commands in `backend/.env.example`). Everything else is optional — each unlocks one feature (voice, WhatsApp, Slack, billing, etc.) and can be left blank.

**4. Run it:**

```bash
docker compose up --build backend frontend
```

Dashboard: `http://localhost:3000` — sign up, create a bot, and the widget embed snippet is generated for you under bot settings.

To also run the voice agent: `docker compose up --build` (no service names) brings up `voice-worker` too. It needs a free [LiveKit Cloud](https://cloud.livekit.io) project — set `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` in `backend/.env`.

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
python voice_worker.py dev
```

## ⚙️ Configuration Reference

Every environment variable is documented inline in [`backend/.env.example`](backend/.env.example) and [`frontend/.env.example`](frontend/.env.example) — what it's for, where to get it, and what happens if you leave it blank.

## 🗺️ Roadmap

- [ ] One-click deploy buttons (Railway / Render / Fly.io)
- [ ] Additional channels (Instagram DM, Discord)
- [ ] Multi-language knowledge base auto-translation
- [ ] Admin CLI for bulk bot provisioning

Have an idea? [Open an issue](https://github.com/PersonaliAI/chatty/issues).

## 🤝 Contributing

Issues and PRs welcome — this is a young project and there are rough edges. Good first areas: additional STT/TTS provider plugins, additional channel integrations, docs.

## 📄 License

MIT — see [LICENSE](LICENSE). Use it, fork it, ship it commercially — attribution appreciated but not required.

---

<div align="center">

If Chatty is useful to you, **star the repo** ⭐ — it helps other people find it.

</div>
