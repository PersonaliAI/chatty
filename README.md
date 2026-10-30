<div align="center">

<img src="https://raw.githubusercontent.com/PersonaliAI/chatty/main/backend/assets/chatty-icon.png" alt="Chatty" width="88" /> <img src="https://raw.githubusercontent.com/PersonaliAI/chatty/main/backend/assets/readme-icon.png" alt="Chatty" width="88" />

# Chatty by PersonaliAI

<p>
  <a href="README.md">English</a> ·
  <a href="README.zh-CN.md">简体中文</a> ·
  <a href="README.ja.md">日本語</a> ·
  <a href="README.es.md">Español</a>
</p>

### Open-source AI agent trained on your store and content.<br />Answers customer questions, captures leads, and books meetings on website, WhatsApp & Slack.

<p align="center">
  <a href="https://chatty.personaliai.com"><b>🚀 Live Demo</b></a> &nbsp;·&nbsp;
  <a href="https://chatty.personaliai.com/signup"><b>☁️ Chatty Cloud (Free 14-day trial)</b></a> &nbsp;·&nbsp;
  <a href="#-quick-start-docker-compose"><b>⚡ Quickstart (5 min)</b></a> &nbsp;·&nbsp;
  <a href="https://docs.chatty.personaliai.com"><b>📖 Documentation</b></a>
</p>

<p align="center">
  <a href="https://render.com/deploy?repo=https://github.com/PersonaliAI/chatty"><img src="https://render.com/images/deploy-to-render-button.svg" alt="Deploy to Render" /></a>
  &nbsp;
  <a href="https://railway.com/new/template?template=https://github.com/PersonaliAI/chatty"><img src="https://railway.com/button.svg" alt="Deploy on Railway" /></a>
</p>

Chatty is an open-source, self-hostable **Zendesk and Intercom alternative** for stores and modern businesses that need autonomous AI customer support with human takeover, WooCommerce sync, and calendar scheduling.

Run the application containers on your own host while keeping Supabase Auth,
Postgres, Storage, and Realtime managed. The same deployment contract works on
a VPS, Railway, Render, or another Docker host without touching the live
Supabase project.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![CI](https://github.com/PersonaliAI/chatty/actions/workflows/ci.yml/badge.svg)](https://github.com/PersonaliAI/chatty/actions/workflows/ci.yml)
[![GDPR Compliant](https://img.shields.io/badge/GDPR-100%25%20Compliant-003399?logo=shield&logoColor=ffcc00)](#-gdpr--enterprise-data-privacy)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](frontend)
[![FastAPI](https://img.shields.io/badge/FastAPI-Python%203.11-009688?logo=fastapi&logoColor=white)](backend)
[![Supabase](https://img.shields.io/badge/Database-Supabase-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com)
[![MCP](https://img.shields.io/badge/FastMCP-81%20Tools-8b5cf6)](#mcp-server--agent-control)
[![Docker](https://img.shields.io/badge/Deploy-Docker%20Compose-2496ED?logo=docker&logoColor=white)](docker-compose.yml)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

[Chatty Cloud (hosted)](https://chatty.personaliai.com) · [Documentation](https://docs.chatty.personaliai.com) · [Data Processing (DPA)](frontend/src/app/(legal)/dpa/page.tsx) · [Sub-processors](frontend/src/app/(legal)/subprocessors/page.tsx) · [Performance Scorecard](https://docs.chatty.personaliai.com/guides/scorecard) · [Flow Builder](https://docs.chatty.personaliai.com/guides/flow-architect) · [Widget Embed](https://docs.chatty.personaliai.com/guides/embed-widget) · [Secure customer identity](https://docs.chatty.personaliai.com/guides/human-takeover) · [Quick Start](#-quick-start-docker-compose) · [Platform Runbook](https://docs.chatty.personaliai.com/guides/self-hosting) · [MCP Server](#mcp-server--agent-control) · [AI Plugins](https://docs.chatty.personaliai.com/guides/ai-coding-plugins) · [Omnichannel](https://docs.chatty.personaliai.com/guides/omnichannel) · [WooCommerce](https://docs.chatty.personaliai.com/guides/woocommerce)

<br />
<br />

<p align="center">
  <a href="screenshots/real-01-overview.png"><img src="screenshots/real-01-overview.png" alt="Chatty Executive Overview & Live Telemetry" width="100%" style="border-radius: 8px;" /></a>
</p>

</div>

---

## Table of contents

- [Why Chatty](#why-chatty)
- [Live Dashboard Showcase (4K Retina)](#-live-dashboard-showcase-4k-retina)
- [Performance Scorecard (A-F Auditing)](https://docs.chatty.personaliai.com/guides/scorecard)
- [Flow Builder & Integrations](https://docs.chatty.personaliai.com/guides/flow-architect)
- [Widget Integration (3-Line Embed)](https://docs.chatty.personaliai.com/guides/embed-widget)
- [Features](#-features)
- [7-Channel Omnichannel Hub](#-7-channel-omnichannel-hub)
- [Visual Flow Builder Engine & Conditional Runtime](#️-visual-flow-builder-engine--conditional-runtime)
- [WooCommerce Store Integration & Multimodal RAG](#-woocommerce-store-integration--multimodal-rag)
- [LiveKit Voice Agent & SDKs](#-livekit-voice-agent--sdks)
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
- [Managed-Supabase platform runbook](https://docs.chatty.personaliai.com/guides/self-hosting)
- [MCP Server & AI Coding Plugins (Claude, Cursor, Codex)](https://docs.chatty.personaliai.com/guides/ai-coding-plugins)
- [Environment Variable Reference](#environment-variable-reference)
- [Testing & CI](#-testing--ci)
- [GDPR & Enterprise Data Privacy](#-gdpr--enterprise-data-privacy)
- [Security](#-security)
- [Contributing](#-contributing)
- [License](#-license)

## Why Chatty

Every hosted chatbot SaaS charges per-seat or per-message and holds your conversation data. Chatty is open-core: run it yourself for free, or use [Chatty Cloud](https://chatty.personaliai.com) - our own hosted version of this exact repo, if you'd rather skip the ops work. Either way you get the same feature set - streaming chat, RAG over your own documents, meeting booking, lead capture, WhatsApp/Slack channels, and a full [MCP server](#mcp-server--agent-control) so an AI agent can run the whole dashboard for you.

| Capability | Closed-source SaaS chatbots | **Chatty** |
|---|---|---|
| **Data Ownership** | Stored on third-party servers, vendor locked | **Cloud**: Hosted on Chatty Cloud with zero AI training guarantee<br>**Self-Host**: 100% in your own private Supabase instance |
| **Pricing** | High per-seat fees & message overages | **Self-host for $0 forever** (MIT), or predictable flat-rate hosted cloud tiers |
| **LLM Choice** | Locked to vendor models | **Bring your own (BYOK)**: Gemini, OpenAI, Claude, OpenRouter, or local models |
| **Agent / MCP Access** | None, or expensive enterprise add-on | **Official 81-tool FastMCP server included** (OAuth 2.0 PKCE & API Keys) |
| **Source Code & License** | Proprietary closed source | **MIT Licensed** — 100% open-source, forkable, auditable, run anywhere |

## 🖥️ Live Dashboard Showcase (4K Retina)

All 22 core modules are captured from live production ([`chatty.personaliai.com/dashboard`](https://chatty.personaliai.com/dashboard)) in crisp **4K Retina (3840×2160)** resolution, representing real hydrated application state:

<table width="100%">
  <tr>
    <td width="50%" align="center">
      <a href="screenshots/real-06-inbox.png"><img src="screenshots/real-06-inbox.png" alt="Omnichannel Live Helpdesk & SLA Inbox" width="100%" /></a>
      <br />
      <b>Omnichannel Live Helpdesk & SLA Inbox</b>
      <br />
      <sub>Real-time visitor threads, SLA breach warnings & 1-click human takeover</sub>
    </td>
    <td width="50%" align="center">
      <a href="screenshots/real-04-knowledge-base.png"><img src="screenshots/real-04-knowledge-base.png" alt="Knowledge Base & Vector Documents" width="100%" /></a>
      <br />
      <b>Knowledge Base & Vector Documents</b>
      <br />
      <sub>Multi-format ingestion, recursive crawler & 186k+ tokens indexed</sub>
    </td>
  </tr>
  <tr>
    <td width="50%" align="center">
      <a href="screenshots/real-18-voice-agent.png"><img src="screenshots/real-18-voice-agent.png" alt="LiveKit WebRTC Voice Studio" width="100%" /></a>
      <br />
      <b>LiveKit WebRTC Voice Studio</b>
      <br />
      <sub>Sub-500ms bidirectional audio, dynamic visualizers & multi-platform SDKs</sub>
    </td>
    <td width="50%" align="center">
      <a href="screenshots/real-08-flow-builder.png"><img src="screenshots/real-08-flow-builder.png" alt="Visual Conversation Flow Architect" width="100%" /></a>
      <br />
      <b>Visual Conversation Flow Architect</b>
      <br />
      <sub>Interactive decision tree graph with AI Flow Copilot & cycle validation</sub>
    </td>
  </tr>
  <tr>
    <td width="50%" align="center">
      <a href="screenshots/real-03-customizer.png"><img src="screenshots/real-03-customizer.png" alt="Live Widget Customizer & Style Studio" width="100%" /></a>
      <br />
      <b>Live Widget Customizer & Style Studio</b>
      <br />
      <sub>WYSIWYG live preview with automated WCAG AA/AAA contrast engine</sub>
    </td>
    <td width="50%" align="center">
      <a href="screenshots/real-16-analytics.png"><img src="screenshots/real-16-analytics.png" alt="Resolution Rates & Deflection Telemetry" width="100%" /></a>
      <br />
      <b>Resolution Rates & Deflection Telemetry</b>
      <br />
      <sub>Conversation volume, 100% deflection rate, and token usage heatmaps</sub>
    </td>
  </tr>
</table>

<details>
<summary><b>📸 Click to explore all 22 High-Resolution Production Dashboard Views</b></summary>
<br />

| # | Module | Description | High-Res Capture |
| :---: | :--- | :--- | :---: |
| **01** | **Executive Overview** | 5-pillar health score, deflection rate & live 30-day KPIs | [View 4K Image](screenshots/real-01-overview.png) |
| **02** | **Chatbot Workspace** | Multi-bot management, model switching (GPT-4o, Claude, Gemini) | [View 4K Image](screenshots/real-02-workspace.png) |
| **03** | **Widget Customizer** | 6-part styling palette, brand logo, WCAG contrast pass/fail | [View 4K Image](screenshots/real-03-customizer.png) |
| **04** | **Knowledge Base** | 52+ sources, 186k chars indexed, HNSW vector search | [View 4K Image](screenshots/real-04-knowledge-base.png) |
| **05** | **AI Playground** | Sandboxed simulator with citation inspect drawer | [View 4K Image](screenshots/real-05-playground.png) |
| **06** | **Omnichannel Inbox** | Unified helpdesk, live visitor presence, SLA breach timers | [View 4K Image](screenshots/real-06-inbox.png) |
| **07** | **Campaigns** | Proactive announcement modals, exit-intent & scroll triggers | [View 4K Image](screenshots/real-07-campaigns.png) |
| **08** | **Flow Builder** | Drag-and-drop conversation canvas with AI Flow Copilot | [View 4K Image](screenshots/real-08-flow-builder.png) |
| **09** | **Visitor Leads CRM** | Automated lead extraction, GeoIP country/city telemetry, CSV export | [View 4K Image](screenshots/real-09-leads.png) |
| **10** | **Feedback & CSAT** | Post-chat customer ratings, sentiment analysis & friction tags | [View 4K Image](screenshots/real-10-feedback.png) |
| **11** | **Visitor Map** | Interactive Leaflet geolocation map showing regional traffic | [View 4K Image](screenshots/real-11-map.png) |
| **12** | **Meeting Scheduler** | 2-way Google Calendar OAuth sync & automated Meet links | [View 4K Image](screenshots/real-12-meetings.png) |
| **13** | **Inbound Mailbox** | Resend email routing converting incoming emails to tickets | [View 4K Image](screenshots/real-13-mailbox.png) |
| **14** | **Team Notifications** | Incident alert policies dispatching via Slack, Email, and SMS | [View 4K Image](screenshots/real-14-notifications.png) |
| **15** | **Audit Log** | Immutable append-only audit trail logging IP and actor email | [View 4K Image](screenshots/real-15-audit-log.png) |
| **16** | **Analytics** | Deflection analytics, resolution speed, and token heatmaps | [View 4K Image](screenshots/real-16-analytics.png) |
| **17** | **Embed & Integrate** | Embed generator for React, Next.js, WordPress & domain allowlist | [View 4K Image](screenshots/real-17-embed-integrate.png) |
| **18** | **Voice Agent** | LiveKit WebRTC studio with active visualizer & multi-SDK code | [View 4K Image](screenshots/real-18-voice-agent.png) |
| **19** | **FastMCP Server Hub** | 81 tools & 8 resources for Claude Desktop, Cursor, Antigravity | [View 4K Image](screenshots/real-19-mcp.png) |
| **20** | **Developer API** | Scoped API keys (`chatty_sk_...`) & multi-language SDK snippets | [View 4K Image](screenshots/real-20-developer-api.png) |
| **21** | **Billing & Quota** | Stripe portal, quota ledger, and affiliate referral program | [View 4K Image](screenshots/real-21-billing.png) |
| **22** | **Agent Settings** | Strict vector grounding, PII scrubbing, and BYOK encryption | [View 4K Image](screenshots/real-22-agent-settings.png) |

</details>


## ✨ Features

- 🔌 **7-Channel Omnichannel Hub** — Production-grade native messaging across WhatsApp Cloud API, Facebook Messenger, Instagram Direct, TikTok Business Messaging, Telegram Bot, Twilio Two-Way SMS (with automated TCPA opt-outs), and Inbound Support Email with quote-stripping.
- 🗺️ **Visual Flow Builder Engine** — Drag-and-drop interactive canvas (`@xyflow/react`) featuring declarative time-of-day condition branches (e.g. before 6:00 PM vs after 6:00 PM dynamic offers), lead capture, calendar booking, API webhooks, platform metadata detection, and AI Flow Copilot.
- ⚡ **Live Human Takeover & Inbox** — Real-time Server-Sent Events (SSE) streaming inbox enabling human agents to pause bot automation with one click and chat directly into WhatsApp, Instagram, TikTok, or SMS.
- 🛒 **WooCommerce & Multimodal RAG** — Direct WooCommerce store sync (order status lookup, live inventory, cart links) alongside PDF, DOCX, CSV, TXT ingestion, web crawling, and multimodal image context.
- 🎙️ **LiveKit Voice Agent** — Real-time WebRTC bidirectional voice conversations with 5 audio visualizers (`wave`, `bar`, `grid`, `radial`, `aura`), live speech transcription, pipeline & realtime multimodal models, and native embed support across Web, React, iOS, Android, Flutter, and React Native.
- 💬 **Embeddable Chat Widget** — One `<script>` tag, streaming SSE replies, crisp vector Shadow DOM rendering on any site with zero CSS bleed.
- 📚 **RAG Knowledge Hub** — Deep semantic retrieval powered by PostgreSQL `pgvector`, HNSW indexing, and hybrid lexical/vector search.
- 🛠️ **Autonomous Tool-Calling** — Schedules real meetings (Google Meet, Microsoft Teams, Zoom), qualifies leads, and checks calendars.
- 🔑 **Bring Your Own Key (BYOK)** — Free-tier Gemini by default, or per-bot OpenAI/Anthropic/Groq with AES-128 encryption.
- 🤖 **81-Tool FastMCP Server** — Control the entire dashboard programmatically from Claude Desktop, Cursor, or Codex via OAuth 2.0 / API Keys (including complete Voice Agent configuration, screenshot telemetry, and autonomous workflows).
- 📊 **5-Pillar Scorecard** — Independent A–F performance auditing across Conversion, Deflection, Accuracy, Reliability, and CSAT.
- 🎯 **Proactive Campaigns** — Behavioral triggers (exit-intent, time-on-page, scroll-depth) with timezone-aware cadence planning.
- 🐳 **One-Command Self-Host** — `docker compose up`, point to Supabase, and launch in 60 seconds.

<details>
<summary><b>🔧 Deep Dive: Campaign Telemetry & Flow Builder Safety Architecture</b></summary>
<br/>

### Campaign Telemetry Ledger
Campaign configuration is persisted in `chatty_campaigns`. Widget deployments record `impression`, `click`, and `conversion` events through `POST /api/widget/campaign-events` with `bot_id`, `campaign_id`, and an optional `idempotency_key` (safe for retries). Recomputed analytics are accessible via `GET /api/bots/{bot_id}/campaigns/{campaign_id}/analytics`.

Campaign drafts support a validated `schedule_config` (`once`, `hourly`, `daily`, or `weekly` with IANA timezone). `POST /api/bots/{bot_id}/campaigns/audience-suggest` generates bounded segments, intent thresholds, and rationales before saving. Delivery channels include web, email, WhatsApp, and SMS. Safety policies support overnight quiet hours (`quiet_hours: {"start": "22:00", "end": "08:00"}`). The background worker `python -m app.workers.campaign_scheduler` claims Redis idempotency keys for 24 hours to prevent duplicate dispatches. Provider-backed steps are expanded only for leads with explicit marketing consent and are then filtered by the same `segment`, `returning_only`, and `min_intent_score` rules used by the widget; qualification signals may be persisted in `chatty_leads.custom_fields` by an AI flow. Provider jobs additionally claim a hashed recipient/campaign frequency-cap key atomically before sending; cap hits are recorded as intentional suppressions, not retries. Each queued provider job carries its deterministic delivery key into the worker, which upserts `queued`, `sent`, `failed`, or `suppressed` state in `chatty_campaign_deliveries`; campaign analytics reports delivery success rate and channel breakdown without exposing recipient addresses. Apply migration `20260930130000_campaign_delivery_ledger.sql` before enabling provider campaigns in a new environment. Email delivery uses configured Resend or OneSignal credentials; unconfigured channels fail closed.

### Flow Builder Safety & Deterministic Dry-Runs
The AI Flow Architect endpoint (`POST /api/flow/generate`) requires authenticated users with `settings` permission. Prompts are bounded to 4,000 characters, and generated graphs are validated for unique node IDs and resolvable edge references. Dry-runs enforce execution step budgets to prevent runaway loops and store immutable graph snapshots for deterministic replay. Webhook/action mappings use a safe `{{input}}` and `{{context.path}}` resolver; exact-value mappings preserve JSON types and unresolved fields are surfaced in the trace rather than silently sent.

Published widget flows execute their control nodes too: `delay` is capped at five minutes, `condition` accepts only the declarative `input ==`, `!=`, `contains`, `starts_with`, and `ends_with` grammar, and `loop` has a 100-iteration hard ceiling plus an explicit `done`, `complete`, or `exit` route. A `webhook` node is dispatched through `POST /api/widget/flow/webhook`, not from browser JavaScript. The API reloads the current active flow and permits only the selected published node's `config.url` (or `config.webhook_url`), posts a bounded mapped body, adds an idempotency key, disables redirects, and pins DNS through the SSRF guard. Browser-supplied destinations, headers, and methods are never accepted. A webhook can set bounded `max_attempts` (1–5), `backoff_ms` (0–5,000), and `timeout_ms` (500–30,000); only connection errors, timeouts, and 5xx responses are retried. Use labeled `success`/`true` and `error`/`failed`/`timeout` edges to make the outcome path explicit. Operators can inspect an immutable run snapshot and trace at `GET /api/bots/{bot_id}/flow/runs/{run_id}` before replaying it.
</details>

## 🔌 7-Channel Omnichannel Hub

Chatty provides native, industrial-standard bidirectional messaging across all major customer conversation surfaces from a single, unified workspace. Messages from every platform normalize into an internal event pipeline, allowing automated flows, the AI brain, and human operators to interact seamlessly.

| Channel | Protocol / Provider | Payloads & UI Controls | Webhook Auth & Verification | Session Prefix | Human Takeover |
| :--- | :--- | :--- | :--- | :---: | :---: |
| **WhatsApp** | Meta Cloud API | Text, Media, Templates, Interactive Buttons (Max 3), Lists | `X-Hub-Signature-256` (HMAC-SHA256) | `wa:` | ✅ Real-time |
| **Messenger** | Meta Graph API | Text, Attachments, Quick Replies (Max 13), Postbacks | `X-Hub-Signature-256` (HMAC-SHA256) | `fb:` | ✅ Real-time |
| **Instagram DM** | Meta Graph API | Direct Messages, Story Mentions, Quick Replies | `X-Hub-Signature-256` (HMAC-SHA256) | `ig:` | ✅ Real-time |
| **TikTok** | TikTok Business Messaging | Text, Quick-Reply Buttons (Max 3) | Timestamped HMAC (`t=...,s=...`) | `tt:` | ✅ Real-time |
| **Telegram** | Telegram Bot API | Text, Markdown, Multi-row Dynamic Inline Keyboards | `X-Telegram-Bot-Api-Secret-Token` | `tg:` | ✅ Real-time |
| **Two-Way SMS** | Twilio Messaging | Plain Text, Automated TCPA STOP/UNSUBSCRIBE Opt-out | Twilio Cryptographic Signature | `sms:` | ✅ Real-time |
| **Support Email** | Resend / SendGrid Inbound | Clean Body, Automatic Quoted-Reply Stripping | Webhook Secret Challenge | `email:` | ✅ Real-time |

### Key Architectural Highlights
* **Zero-Latency Ingestion Queue:** Webhook endpoints perform HMAC verification and return `HTTP 200 OK` in <40ms, preventing Meta and TikTok from triggering exponential 3-second webhook retry storms while the AI reasons.
* **Smart UI Normalization:** Interactive buttons automatically adapt across channels (rendered as native inline keyboard grids on Telegram, sliced to 3 quick-reply buttons on WhatsApp and TikTok, and transpiled into numbered text options like `Reply [1] or [2]` for SMS).
* **24-Hour Messaging Window Enforcement:** Tracks `last_inbound_at` on Meta channels to prevent API rejection codes (`131047`), automatically falling back to pre-approved WhatsApp Business templates when the window expires.
* **TCPA Compliance Interceptor:** Deterministically halts automation and registers opt-outs when users text regulatory keywords (`STOP`, `UNSUBSCRIBE`, `CANCEL`, `QUIT`).
* **Non-Destructive Secret Store:** Credentials and webhook verify tokens are stored in an encrypted PostgreSQL JSONB envelope (`omnichannel_config`), ensuring updates to one channel never wipe keys from another.

---

## 🗺️ Visual Flow Builder Engine & Conditional Runtime

Chatty includes a visual node-based conversation engine built on `@xyflow/react`. You can design rigid conversational paths for high-stakes business logic (lead qualification, appointment scheduling, promotional campaigns) and let the AI brain handle open-ended questions.

* **Time-Conditional Branching:** Condition nodes support 24-hour and 12-hour time comparisons (e.g. `< 18:00` vs `>= 18:00`). Build time-variable marketing campaigns where visitors chatting before 6:00 PM receive early-bird offers expiring at 6:30 PM, while evening visitors receive offers valid until 9:00 PM.
* **Platform & Device Metadata:** Nodes inspect normalized incoming request metadata (`platform`, `channel`, `device`, `os`) to serve channel-specific answers or routing rules.
* **Deterministic Flow Nodes:**
  * **Trigger:** Activates on events (`session.started`, `message.user`, `lead.created`).
  * **Message & Question:** Sends rich markdown with multiple-choice buttons.
  * **Condition:** Declarative branching based on text input, captured variables, tags, or time-of-day.
  * **Lead Capture:** Gathers name, email, phone, and company into the CRM ledger.
  * **Book Meeting:** Generates real Google Meet, Microsoft Teams, or Zoom appointment links.
  * **Webhook:** Issues secure outbound HTTP requests with SSRF protection and retry policies.
  * **AI Fallback:** Seamlessly delegates conversation turns to the RAG knowledge base.

---

## 🛒 WooCommerce Store Integration & Multimodal RAG

Chatty connects directly to WooCommerce stores to deliver conversational e-commerce experiences:

* **Real-Time Order Tracking:** Visitors can query order status, shipping updates, and delivery tracking numbers using their order ID or billing email.
* **Live Product Search & Inventory:** Queries active catalog stock, regular and sale pricing, and product descriptions directly through WooCommerce REST APIs.
* **Multimodal Document RAG:** Indexes PDFs, DOCX, CSV tables, plain text, and recursive website sitemaps using PostgreSQL `pgvector` with HNSW indexing and hybrid semantic search.
* **Image Context:** Multimodal vision processing allows visitors to upload product photos or screenshots for troubleshooting and visual inquiry.

---

## 🎙️ LiveKit Voice Agent & SDKs

Chatty features an enterprise-grade, real-time voice agent powered by [LiveKit WebRTC](https://livekit.io), supporting low-latency bidirectional voice, 5 dynamic audio visualizers, live transcription cards, knowledge base grounding, calendar booking, and native multi-platform SDKs.

### Architecture: Modular Pipeline vs. Multimodal Realtime

- **Modular Pipeline Mode**:
  - **Speech-to-Text (STT)**: Google Cloud Speech Chirp, Deepgram Nova-3, OpenAI Whisper, Cartesia, Soniox, AssemblyAI.
  - **Reasoning (LLM)**: Gemini 2.5 Flash, Claude 3.5 Sonnet, GPT-4o-mini, OpenRouter.
  - **Text-to-Speech (TTS)**: Google Gemini TTS, Cartesia Sonic, ElevenLabs, Deepgram Aura, OpenAI Audio, Fish Audio.
- **Multimodal Realtime Mode**: Direct speech-to-speech multimodal audio with Gemini Live 2.5 Flash Native Audio, OpenAI Realtime, Azure OpenAI, and Ultravox.

### 5 Dynamic Audio Visualizers

Choose from 5 reactive audio representations in the dashboard or via SDK props:
- `wave` — Fluid harmonic sine waveform with natural audio peaks.
- `bar` — Animated frequency spectrum equalizer bars.
- `grid` — Futuristic LED matrix audio grid reacting to decibel energy.
- `radial` — Concentric circular ripples pulsating to voice intensity.
- `aura` — Radiant, breathing atmospheric aura with expression pitch reactivity.

### Multi-Platform SDK Support

| Platform / SDK | Voice Agent UI Component / Embed | Programmatic Control / Tokens |
| :--- | :--- | :--- |
| **HTML Script** (`widget.js`) | `<script src="..." data-mode="voice" data-display="modal"></script>` | `window.Chatty.openVoice()` |
| **React / Next.js** (`@personaliai/react-widget`) | `<VoiceAgent botId="..." />` or `<ChattyWidget mode="voice" />` | `useChatty().openVoice()` |
| **iOS** (SwiftUI) | `ChattyVoiceView(botId: "...")` | `ChattyClient.createVoiceToken(...)` |
| **Android** (Compose) | `ChattyVoiceScreen(botId = "...")` | `ChattyApi.createVoiceToken(...)` |
| **Flutter** | `ChattyVoiceScreen(botId: '...')` | `ChattyClient.createVoiceToken(...)` |
| **React Native** | `<ChattyVoiceView botId="..." />` | `ChattyClient.createVoiceToken(...)` |
| **Iframe Embed** | `<iframe src="https://chatty.personaliai.com/embed/{botId}?voice=only"></iframe>` | Direct hosted browser embed |

### Audio Engineering & Echo Prevention

- **Hardware-Accelerated WebRTC AEC**: Browser and mobile devices negotiate client-side Acoustic Echo Cancellation, noise suppression, and auto gain control.
- **Zero Comb-Filtering Artifacts**: The LiveKit worker runtime eliminates redundant server-side AEC filters, guaranteeing clean, natural speech without metallic vibration or stuttering.
- **Session Memory Reset**: A built-in reset action (`POST /api/widget/voice/reset`) flushes past conversation context from the database and rotates room nonces for clean reconnects.

## Architecture

The public repository has one canonical application layout: `frontend/` contains the Next.js dashboard, embeddable widget, and visual flow builder canvas, while `backend/` contains the FastAPI API, omnichannel adapters, background queue workers, and database migrations.

### Omnichannel Dual-Engine Architecture

```mermaid
flowchart TB
    subgraph INBOUND["Omnichannel Ingress & Clients"]
        direction LR
        WIDGET["Web Widget & LiveKit Voice"]
        WA["WhatsApp Cloud API"]
        META["Messenger & Instagram Direct"]
        TT["TikTok Business Messaging"]
        TG["Telegram Bot"]
        SMS["Twilio Two-Way SMS"]
        MAIL["Support Inbound Email"]
    end

    subgraph GATEWAY["Security & Webhook Ingestion Gateway"]
        direction TB
        HMAC["Cryptographic Auth (HMAC-SHA256 / Tokens)"]
        ACK["Sub-40ms HTTP 200 OK Fast ACK"]
        QUEUE["Async Deduplication & Event Pipeline"]
        DLP["Real-time PII & Sensitive Data Scrubber"]
    end

    subgraph CORE["Dual-Engine Execution Brain"]
        direction LR
        subgraph FLOW["Visual Flow Builder Runtime"]
            FNODES["Flow Nodes (@xyflow/react)"]
            FCOND["Time & Condition Routing"]
            FLEAD["Lead Capture & CRM Sync"]
            FBOOK["Calendar Meeting Dispatch"]
        end
        subgraph BRAIN["Multimodal RAG & AI Reasoning"]
            VECT["pgvector Hybrid Semantic Search"]
            KB["Knowledge Docs (PDF/DOCX/CSV/TXT)"]
            WOO["WooCommerce Store & Orders API"]
            LLM["BYOK LLMs (Gemini / Claude / GPT / Groq)"]
        end
    end

    subgraph TAKEOVER["Live Operator Desk"]
        direction TB
        SSE["Real-Time SSE Event Stream"]
        INBOX["Unified Helpdesk & SLA Inbox"]
        HUMAN["1-Click Human Agent Takeover"]
    end

    subgraph OUTBOUND["Channel UI Normalizer & Dispatch"]
        direction LR
        OUT_WA["WhatsApp 24h Window & Templates"]
        OUT_TT["TikTok Quick Replies (Max 3)"]
        OUT_TG["Telegram Dynamic Inline Keyboards"]
        OUT_SMS["SMS Numbered Choices & TCPA Opt-out"]
        OUT_MAIL["Email Clean Threaded Replies"]
        OUT_WEB["Widget Streamdown & Rich Cards"]
    end

    INBOUND --> GATEWAY
    HMAC --> ACK
    ACK --> QUEUE
    QUEUE --> DLP
    DLP --> CORE

    CORE <--> TAKEOVER
    CORE --> OUTBOUND
    TAKEOVER --> OUTBOUND
```

### Component & Data Architecture

<details>
<summary><b>📐 View Full Architecture Diagram (Click to expand)</b></summary>

```mermaid
flowchart TB
    classDef actor fill:#f8fafc,stroke:#64748b,color:#0f172a
    classDef edge fill:#eff6ff,stroke:#2563eb,color:#1e3a8a
    classDef app fill:#ecfdf5,stroke:#059669,color:#064e3b
    classDef data fill:#f0fdfa,stroke:#0f766e,color:#134e4a
    classDef integration fill:#fff7ed,stroke:#ea580c,color:#7c2d12
    classDef deploy fill:#f5f3ff,stroke:#7c3aed,color:#4c1d95

    subgraph clients["Clients & Channels"]
        direction LR
        visitor(("Website Visitor")):::actor
        operator(("Support Agent")):::actor
        omni["WhatsApp · Messenger · IG · TikTok · TG · SMS · Email · MCP"]:::actor
    end
    subgraph edge["Public Edge"]
        direction LR
        tls["TLS · Domain Allowlist · Rate Limits"]:::edge
        web["Next.js 15+ Frontend (App Router)"]:::app
    end
    subgraph runtime["Chatty Runtime"]
        direction LR
        api["FastAPI Backend · Flow Engine · RAG · Webhooks"]:::app
        mcp["FastMCP 81-Tool Server (OAuth 2.0 / API Keys)"]:::app
    end
    subgraph managed["Managed Supabase Tier"]
        direction LR
        auth["Supabase Auth"]:::data
        postgres["Postgres + pgvector · JSONB Configs · RLS"]:::data
        storage["Supabase Storage (Documents & Audio)"]:::data
        realtime["Supabase Realtime"]:::data
    end
    subgraph integrations["External Services"]
        direction TB
        llm["LLM Providers (Gemini / OpenAI / Anthropic / Groq)"]:::integration
        calendar["Google Calendar & Microsoft 365"]:::integration
        wooCommerce["WooCommerce Store API"]:::integration
        voiceLiveKit["LiveKit WebRTC Audio Mesh"]:::integration
    end
    subgraph targets["Deployment Targets"]
        direction LR
        docker["Docker Compose / VPS"]:::deploy
        railway["Railway"]:::deploy
        render["Render Blueprint"]:::deploy
        cloudrun["Google Cloud Run"]:::deploy
    end

    visitor --> tls
    operator --> web
    omni --> api
    tls --> web
    web -->|HTTPS| api
    api --> auth
    api --> postgres
    api --> storage
    api --> realtime
    api --> llm
    api --> calendar
    api --> wooCommerce
    api --> voiceLiveKit
    targets -. runs .-> runtime
    linkStyle default stroke:#64748b,stroke-width:1.5px
```

</details>

```
chatty/
├── frontend/         Next.js - dashboard, embeddable widget, widget.js loader
├── backend/          FastAPI - chat/RAG/bookings/channels/OAuth/MCP API
│   ├── app/          Routers, core (auth/security/db helpers), schemas
│   ├── plugins/       Google/Microsoft integrations, RAG, widget orchestration
│   ├── supabase/      Database schema and migrations (applied in order)
│   ├── scripts/       apply_migrations.py and other one-off ops scripts
│   └── tests/          pytest smoke + unit tests
└── docker-compose.yml
```

### Deployment profiles

| Profile | Data and identity services | When to use |
|---|---|---|
| `managed_supabase` (default) | Supabase Auth, Postgres, Storage, pgvector, and RLS | Chatty Cloud and every supported application deployment |

### Deployment-platform compatibility

The managed-Supabase deployment contract is two Docker services (API + frontend).
The root `docker-compose.yml` runs both services without provisioning a second
database. The complete platform runbook, including secret handling, domains,
health checks, verification, rollback, and troubleshooting, is in
[https://docs.chatty.personaliai.com/guides/self-hosting](https://docs.chatty.personaliai.com/guides/self-hosting).

| Platform | Official deployment guide | Current repository status |
|---|---|---|
| ![Docker](https://img.shields.io/badge/Docker%20%2F%20VPS-2496ED?logo=docker&logoColor=white) | [Managed-Supabase Docker Compose](docker-compose.yml) | **Supported now** for the API + frontend; put TLS in front. |
| ![Railway](https://img.shields.io/badge/Railway-0B0D0E?logo=railway&logoColor=white) | [Railway Docker Compose guide](https://docs.railway.com/guides/docker-compose) | **Supported as two services**; Railway maps the API and frontend Dockerfiles separately. |
| ![Render](https://img.shields.io/badge/Render-46E3B7?logo=render&logoColor=111827) | [`render.yaml`](render.yaml) / [Render Blueprint reference](https://render.com/docs/blueprint-spec) | **Blueprint included**; it creates the API + frontend services and prompts for secrets. |
| ![Heroku](https://img.shields.io/badge/Heroku-430098?logo=heroku&logoColor=white) | [Heroku container runtime](https://devcenter.heroku.com/articles/container-registry-and-runtime) | **Supported as two container apps**; no full-stack Button is claimed. |

For every supported application deployment keep `DEPLOYMENT_PROFILE=managed_supabase`.

## 📋 Requirements

| | Version | Needed for |
|---|---|---|
| [Docker](https://docs.docker.com/get-docker/) + Docker Compose | 24+ | Quick Start (recommended path) |
| [Python](https://www.python.org/downloads/) | 3.11+ | Backend, without Docker |
| [Node.js](https://nodejs.org/) | 20+ | Frontend, without Docker |
| [Supabase](https://supabase.com) account | free tier | Database (Postgres + Auth + Storage) |
| [Google AI Studio](https://aistudio.google.com/apikey) API key | free tier | Default LLM (Gemini) |

Everything else (WhatsApp/Slack tokens, Google/Microsoft OAuth, Lemon Squeezy billing, Sentry, Upstash Redis) is **optional** - each env var you leave blank just disables that one feature; nothing else breaks.

Usage and analytics stay with the deployment: self-hosted operators keep
conversation counts, weighted AI credits, tokens, latency, and provider-cost
telemetry in their own Supabase project. BYOK inference is still sent directly
to the selected model provider, and unpriced BYOK calls remain visible by
tokens/call count even when a dollar estimate is unavailable. No Chatty Cloud
account is required for the open-source deployment.

## ⚡ 1-Click Cloud Deployment (Render & Railway)

Deploy Chatty directly to the cloud without managing a server:

<p align="center">
  <a href="https://render.com/deploy?repo=https://github.com/PersonaliAI/chatty"><img src="https://render.com/images/deploy-to-render-button.svg" alt="Deploy to Render" /></a>
  &nbsp;
  <a href="https://railway.com/new/template?template=https://github.com/PersonaliAI/chatty"><img src="https://railway.com/button.svg" alt="Deploy on Railway" /></a>
</p>

Chatty uses a **managed-Supabase architecture** (containers run on Render/Railway, while Auth, Postgres, Storage, and Realtime stay managed in Supabase). Before or immediately after clicking deploy, complete these 3 quick steps:

1. **Create a Free Supabase Project:** Go to [supabase.com](https://supabase.com), create a free project, and copy your **Project URL**, **`anon` key**, **`service_role` key**, and **Database Connection String** from Project Settings.
2. **Apply Database Migrations:** Run the migration script once so all 67+ tables and vector schemas are initialized:
   ```bash
   cd backend && pip install psycopg2-binary
   python scripts/apply_migrations.py "postgresql://postgres:YOUR_PASSWORD@YOUR_HOST:5432/postgres"
   ```
   *(Or run the SQL files in `backend/supabase/migrations/` in Supabase's SQL Editor).*
3. **Get Free Gemini API Key & Set Variables:** Get a key from [aistudio.google.com/apikey](https://aistudio.google.com/apikey). When Render or Railway prompts for environment variables, fill in your `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `GEMINI_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

---

## 🚀 Quick Start (Docker Compose)

The fastest path from clone to a running instance. See [Self-Hosting, Step by Step](#-self-hosting-step-by-step) below if you want the full walkthrough with screenshots-in-words and troubleshooting.

```bash
git clone --recurse-submodules https://github.com/PersonaliAI/chatty.git
cd chatty

# Optional plugin and SDK source checkouts are independent submodules.
# For an existing clone, use: git submodule update --init --recursive

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

Chatty ships ordered SQL migration files under `backend/supabase/migrations/`. Apply them all in order with the included script - it's idempotent (tracks what's already applied in a `_migrations_log` table), so it's always safe to re-run after pulling updates:

```bash
cd backend
pip install psycopg2-binary
python scripts/apply_migrations.py "postgresql://postgres:YOUR_PASSWORD@YOUR_HOST:5432/postgres"
```

You should see output like:

```
<current migration count> migration files found
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
platform is [Self-Hosting Guide](https://docs.chatty.personaliai.com/guides/self-hosting).
It covers `DEPLOYMENT_PROFILE=managed_supabase`, secret-manager setup, domains,
health checks, production verification, rollback, and security boundaries.

The retired provider-neutral Postgres/Redis/object-store stack is intentionally
not part of this repository. Do not use old `install-self-host.ps1` instructions.

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

## MCP Server & Agent Control

Chatty ships a full [Model Context Protocol](https://modelcontextprotocol.io) server - connect Claude, ChatGPT, or any MCP-compatible client and run the entire dashboard from a conversation instead of clicking through screens.

- **Auth**: OAuth 2.0 authorization-code flow with mandatory PKCE (RFC 7636), dynamic client registration (RFC 7591), and authorization server metadata discovery (RFC 8414) - no API key to paste into a config file.
- **Scopes**: `read`, `write`, `knowledge`, `actions`, `admin` - a client only gets what it's granted.
- **81 tools** across 13 categories: bot lifecycle, customizer & design, visual flow builder, proactive campaigns, knowledge base & RAG, help center CMS, inbox & human takeover, leads/calendar/meetings, deflection analytics, WooCommerce store catalog sync, omnichannel escalations (Slack & WhatsApp), settings/guardrails/BYOK/team RBAC, and LiveKit Voice Studio & Screenshots.
- **Live resources & prompts**: inspect live voice state via `chatty://bots/{bot_id}/voice-config`, live dashboard screenshots via `chatty://dashboard/screenshots`, and run guided workflows with `setup-voice-agent`, `audit-and-optimize-bot`, and `build-bot-from-brand`.
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

For setup instructions and plugin manifests for **Claude Code** (`/plugin marketplace add PersonaliAI/chatty`), **Cursor IDE** (`.cursor/rules/`), **Claude Desktop**, and **Windsurf**, see the full [AI Coding Tools & Plugin Marketplace Guide](https://docs.chatty.personaliai.com/guides/ai-coding-plugins).

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

**Backend - optional, one per feature:** WhatsApp, Slack, Google/Microsoft OAuth (calendar booking), Zoom (Server-to-Server OAuth), transactional email (OneSignal), web crawl (Jina), billing (Lemon Squeezy), rate limiting (Upstash Redis), error monitoring (Sentry), and `CHATTY_BACKEND_URL`/`CHATTY_FRONTEND_URL` (only needed once you're deployed under your own domain - see [MCP Server & Agent Control](#mcp-server--agent-control)). Full list with setup links: [`backend/.env.example`](backend/.env.example).

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

## 🇪🇺 GDPR & Enterprise Data Privacy

Chatty is built for enterprise-grade compliance with the **EU General Data Protection Regulation (Regulation (EU) 2016/679)** and the **ePrivacy Directive (Directive 2002/58/EC)**:

* **Automated Data Loss Prevention (DLP):** Real-time PII scrubber (`backend/app/services/pii_service.py`) automatically detects and redacts Luhn-verified credit card numbers, US Social Security numbers, exposed API/Bearer tokens, and ISO 7064 MOD 97-10 European IBAN bank accounts across the web widget and all omnichannel streams (WhatsApp, Instagram, Telegram, SMS, Email).
* **Right to Erasure (RTBF / Art. 17):**
  - **Cascading Contact Erasure:** Administrative endpoint `DELETE /api/admin/inbox/contacts/{id}` executes PostgreSQL stored procedure `chatty_erase_contact()`, wiping conversation history, leads, sessions, and contact records.
  - **Self-Service Visitor Erasure:** Website visitors can independently erase their own session data and local storage directly within the live chat widget via the trash action.
  - **Cascade Delete on Bot Removal:** Deleting a bot (`DELETE /api/bots/{id}`) automatically cascades deletion across all 15+ child tables in PostgreSQL.
* **Storage Limitation & Automated Retention (Art. 5(1)(e)):** Automated 90-day retention cutoff for unadopted anonymous conversations via `cron.py`, with per-bot configurable retention periods and an authenticated on-demand purge API (`POST /api/bots/{id}/retention/purge`).
* **Cryptographic Isolation & Multi-Tenant RLS (Art. 32):**
  - **Encryption at Rest:** Sensitive BYOK API keys, OAuth tokens, and visitor identity signing keys are encrypted at rest with Fernet (authenticated AES-128-CBC + HMAC-SHA256).
  - **Encryption in Transit:** Mandatory TLS 1.3 encryption across all APIs and webhooks.
  - **Database Tenant Isolation:** Supabase Row-Level Security (RLS) policies isolate workspace data strictly by user ID and verified team membership.
  - **Webhook Authentication:** Cryptographic HMAC signature verification across all omnichannel providers (Meta Graph API, Twilio, Telegram).
* **Zero AI Foundation Model Training Guarantee:** Customer conversation turns and uploaded training documents are processed strictly in transient memory for real-time inference and are **never** used to train public foundation models (Google Vertex AI / OpenAI enterprise terms).
* **Binding Legal Agreements:**
  - Published [Data Processing Addendum (DPA)](frontend/src/app/(legal)/dpa/page.tsx) incorporating European Commission Standard Contractual Clauses (SCCs).
  - Public [Sub-processor Registry](frontend/src/app/(legal)/subprocessors/page.tsx) with international transfer safeguards and SOC 2 / ISO 27001 certifications.

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
