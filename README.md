# Chatty

An AI customer-support widget you can drop into any website — chat + a
real-time voice agent, backed by your own knowledge base (docs, PDFs, URLs),
with tool-calling for meeting booking, lead capture, and live handoff to a
human. Self-hostable, no vendor lock-in.

- **Chat widget** — embeddable `<script>` tag, streaming replies, RAG over
  your own uploaded documents/URLs, WhatsApp/Slack/Telegram channels.
- **Voice agent** — real-time phone-call-style conversations via
  [LiveKit](https://livekit.io), same knowledge base and tools as the chat
  widget. Optional — skip it if you don't need voice.
- **Dashboard** — manage bots, knowledge sources, conversations/inbox,
  booking rules, and channel connections.
- **BYOK** — default LLM is Gemini (free tier friendly); bring your own
  OpenAI/Anthropic/OpenRouter key per bot if you'd rather use those.

## Architecture

```
frontend/   Next.js dashboard + embeddable widget + widget.js loader
backend/    FastAPI API (chat, RAG, bookings, channels, dashboard)
backend/    also contains voice_worker.py — a separate LiveKit Agents
            process for the voice agent (own Dockerfile, own deploy unit)
```

Both services talk to a single [Supabase](https://supabase.com) Postgres
database (schema + RLS policies, no separate ORM). Supabase's free tier is
enough to get started.

## Quick start (Docker Compose)

**1. Create a Supabase project** at [supabase.com](https://supabase.com) —
free tier is fine. Grab these from **Project Settings → API** and
**→ Database**:
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

At minimum you need: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
`GEMINI_API_KEY` (free at [aistudio.google.com/apikey](https://aistudio.google.com/apikey)),
`FUNCTION_SECRET` and `BYOK_ENCRYPTION_KEY` (generate with the commands in
`backend/.env.example`). Everything else in the `.env` files is optional —
each unlocks one feature (voice, WhatsApp, Slack, billing, etc.) and can be
left blank.

**4. Run it:**

```bash
docker compose up --build backend frontend
```

Dashboard: `http://localhost:3000` — sign up, create a bot, and the widget
embed snippet is generated for you under bot settings.

To also run the voice agent: `docker compose up --build` (no service names)
brings up `voice-worker` too. It needs a free [LiveKit Cloud](https://cloud.livekit.io)
project — set `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` in
`backend/.env`.

## Local development (without Docker)

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

## Configuration reference

Every environment variable is documented inline in `backend/.env.example`
and `frontend/.env.example` — what it's for, where to get it, and what
happens if you leave it blank.

## Contributing

Issues and PRs welcome. This is a young project — expect rough edges.

## License

MIT — see [LICENSE](LICENSE).
