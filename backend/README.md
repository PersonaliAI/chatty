<div align="center">

<img src="assets/chatty-icon.png" alt="Chatty" width="88" /> <img src="assets/readme-icon.png" alt="Chatty" width="88" />

# Chatty by PersonaliAI - Backend

**FastAPI backend for Chatty - chat/RAG/bookings/channels, LiveKit Voice Agent, and MCP Server.**

</div>

---

This is the backend service powering Chatty. The public, open-source repository lives at [PersonaliAI/chatty](https://github.com/PersonaliAI/chatty).

## Architecture & Directory Structure

```
main.py             FastAPI application entrypoint & ASGI mounting
app/
├── routers/        FastAPI routers: chat, bots, voice, mcp, oauth, analytics, etc.
│   ├── voice.py    LiveKit token minting, room isolation, voice config, & session reset
│   └── mcp.py      Model Context Protocol server (58+ tools, resources, prompts)
├── services/       Core business logic & MCP services:
│   ├── mcp_voice_service.py   Voice agent configuration, status audit, & embed generation
│   ├── bots_service.py        Bot CRUD, settings, and design
│   └── multimodal_service.py  Product catalog & visual search
├── schemas/        Pydantic data contracts (voice, bots, widget, campaigns)
└── core/           Auth, OAuth 2.0 PKCE, Supabase DB pool, AES-128 secret encryption
plugins/            Google/Microsoft calendar integrations, RAG pgvector, widget orchestration
voice_agent_cli/    LiveKit voice agent worker & local development runtime CLI
tests/              pytest test suite
supabase/           Database schema and migrations
```

---

## 🎙️ LiveKit Voice Agent Integration

Chatty features an enterprise-grade, low-latency voice agent built on [LiveKit WebRTC](https://livekit.io):

### Endpoints (`app/routers/voice.py`)

- `POST /api/widget/voice/token`: Mints a short-lived, tenant-isolated LiveKit participant JWT. Never exposes LiveKit API keys or provider BYOK secrets.
- `GET /api/bots/{bot_id}/voice`: Retrieves bot voice studio configuration (pipeline vs. realtime mode, STT/LLM/TTS models, visualizers, and BYOK key status).
- `PUT /api/bots/{bot_id}/voice`: Updates voice configuration, provider models, and encrypts API keys at rest with AES-128.
- `POST /api/widget/voice/reset`: Clears conversation memory in the database and updates session nonces for clean reconnects without echo or historical context carry-over.

### Voice Modes

1. **Modular Pipeline Mode**:
   - **STT**: Google Chirp, Deepgram Nova-3, OpenAI Whisper, Cartesia, Soniox, AssemblyAI.
   - **LLM**: Gemini 2.5 Flash, Claude 3.5 Sonnet, GPT-4o-mini, OpenRouter.
   - **TTS**: Google Gemini TTS, Cartesia Sonic, Deepgram Aura, ElevenLabs, OpenAI Audio, Fish Audio.
2. **Multimodal Realtime Mode**:
   - End-to-end low-latency direct audio with Gemini Live 2.5 Flash Native Audio, OpenAI Realtime (GPT-4o Realtime), Azure OpenAI, and Ultravox.

### 5 Reactive Audio Visualizers

The frontend and embedded widget support 5 distinct visual audio representations:
- `wave`: Classic fluid frequency wave.
- `bar`: Dynamic frequency spectrum bars.
- `grid`: Matrix dot grid reacting to voice energy.
- `radial`: Expanding circular pulse.
- `aura`: Glowing atmospheric aura with expression pitch reactivity.

---

## 🤖 MCP (Model Context Protocol) Server

Chatty mounts a full MCP server at `/mcp` supporting OAuth 2.0 PKCE authentication.

### Voice Agent MCP Tools (`app/services/mcp_voice_service.py`)

- `get_voice_agent_config(bot_id: str)`: Inspect current voice configuration, active models, visualizers, and provider key readiness.
- `configure_voice_agent(...)`: Enable/disable voice, set voice modes, update welcome message, change audio visualizers, and configure BYOK provider keys.
- `get_voice_agent_embed_code(bot_id: str, framework: str, display: str)`: Generate embed snippets for HTML `<script>`, React SDK, iOS, Android, Flutter, and React Native.
- **Resource** `chatty://bots/{bot_id}/voice-config`: Real-time configuration snapshot for AI assistants.
- **Prompt** `setup-voice-agent`: Pre-configured autonomous workflow for configuring and deploying voice agents.

---

## Ecommerce and omnichannel RAG

Chatty includes a provider-neutral multimodal catalog layer. Product text and images are indexed in pgvector; an uploaded product photo is analyzed by the vision model and matched against the bot's catalog. Grounded responses can include price, stock, variants, product images, and direct checkout links.

WooCommerce connects through its scoped REST API keys or the official `wc-auth/v1/authorize` flow, performs an initial paginated sync, and stays fresh through signed product webhooks. The same assistant path is available through Meta WhatsApp Cloud API for text, images, documents, and voice notes.

---

## Local Development

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

---

## Testing & CI

```bash
pytest tests/ -v
```
