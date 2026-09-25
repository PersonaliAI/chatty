# Chatty: Comprehensive Technical Documentation & Platform Manual

Welcome to the complete technical documentation for **Chatty** — the enterprise conversational AI, live omnichannel helpdesk, intelligent scheduling, and real-time voice platform.

---

## Table of Contents

1. [System Architecture & Tech Stack](#1-system-architecture--tech-stack)
2. [Database Schema & Data Models](#2-database-schema--data-models)
3. [The 21 Dashboard Modules](#3-the-21-dashboard-modules)
4. [Widget SDK & Embed Engine](#4-widget-sdk--embed-engine)
5. [Conversational AI Brain & RAG Engine](#5-conversational-ai-brain--rag-engine)
6. [Visual Flow Architect & AI Copilot](#6-visual-flow-architect--ai-copilot)
7. [Enterprise Knowledge Base & Help Center](#7-enterprise-knowledge-base--help-center)
8. [Omnichannel Live Inbox & SLA Routing](#8-omnichannel-live-inbox--sla-routing)
9. [Intelligent Calendar & Meeting Booking](#9-intelligent-calendar--meeting-booking)
10. [LiveKit Real-Time Voice Agent](#10-livekit-real-time-voice-agent)
11. [Complete REST API Reference](#11-complete-rest-api-reference)
12. [Model Context Protocol (MCP) Server](#12-model-context-protocol-mcp-server)
13. [Webhooks & Events Reference](#13-webhooks--events-reference)
14. [Security, BYOK & Permissions](#14-security-byok--permissions)
15. [Deployment, DevOps & Mirroring Guide](#15-deployment-devops--mirroring-guide)

---

## 1. System Architecture & Tech Stack

Chatty is built as a cloud-native, real-time distributed application designed for multi-tenant scalability, high availability, and ultra-low latency.

```mermaid
graph TB
    subgraph Clients["Clients & Embeds"]
        WebDash["Next.js 15 App Router Dashboard<br/>(chatty.personaliai.com)"]
        WidgetReact["@personaliai/react-widget<br/>(ChatWidgetCore)"]
        WidgetScript["Standalone Embed Script<br/>(chatty-app.js)"]
        KBPortal["Public Knowledge Base & Help Center<br/>(/kb/[botId])"]
        VoiceWidget["LiveKit WebRTC Voice Call Interface"]
    end

    subgraph BackendServices["Backend Microservices (api.chatty.personaliai.com)"]
        FastAPI["FastAPI Core Engine"]
        WidgetBrain["Widget Brain & Agent Tool Loop"]
        AvailabilityEngine["Availability & Round-Robin Meeting Engine"]
        DocRAG["Document Indexing & Semantic Vector RAG"]
        VoiceWorker["LiveKit Real-time Voice Worker<br/>(Cartesia + Deepgram)"]
        MCPRouter["Model Context Protocol (MCP) Server"]
    end

    subgraph DataLayer["Storage & External Services"]
        Supabase["Supabase PostgreSQL 15+<br/>(pgvector, Auth, Realtime, Storage)"]
        LLMs["Multi-Provider LLMs<br/>(Gemini, OpenAI, Anthropic, Groq, BYOK)"]
        Calendars["Google Calendar & Outlook 365 (OAuth2)"]
        VoiceServices["LiveKit Cloud / WebRTC SFU"]
        Payments["Stripe / Lemon Squeezy"]
        Webhooks["HMAC-SHA256 Outbound & Inbound Email (Resend)"]
    end

    Clients --> FastAPI
    FastAPI --> WidgetBrain
    FastAPI --> AvailabilityEngine
    FastAPI --> DocRAG
    FastAPI --> MCPRouter
    Clients --> VoiceWorker
    FastAPI --> Supabase
    WidgetBrain --> LLMs
    DocRAG --> Supabase
    AvailabilityEngine --> Calendars
    FastAPI --> Payments
    FastAPI --> Webhooks
```

### Core Technologies

- **Frontend & Admin Dashboard**:
  - **Framework**: Next.js 15 (App Router, Turbopack, Server Actions, React 19).
  - **Styling**: Tailwind CSS v4, Framer Motion animations, Radix UI / Base UI primitives, Lucide icons.
  - **Data Visualization**: Leaflet / React-Leaflet (Visitor Geospatial Map), KaTeX (LaTeX math rendering), Cytoscape / React Flow (Flow Architect).
  - **State & Realtime**: Supabase SSR client with PostgreSQL real-time change subscriptions.
- **Backend API & Microservices**:
  - **Framework**: Python 3.11+, FastAPI, Uvicorn, Pydantic v2.
  - **Security**: Fernet AES-128-CBC symmetric encryption (BYOK & OAuth tokens), HMAC-SHA256 webhook signatures, JWT verification, granular CORS, Request-ID tracing.
  - **Observability**: Sentry SDK with distributed tracing and performance profiling.
- **AI & RAG Infrastructure**:
  - **Primary Models**: Google Gemini 2.5 Flash / 3.x Flash-Lite, OpenAI GPT-4o / GPT-4o-mini, Anthropic Claude 3.5 Sonnet / Haiku, Groq Llama 3.3 70B.
  - **Embeddings**: Google `text-embedding-004` (768 dimensions) & OpenAI `text-embedding-3-small` (1536 dimensions).
  - **Vector Database**: PostgreSQL with `pgvector` extension and HNSW indexing for sub-millisecond semantic retrieval.
- **Voice Agent Infrastructure**:
  - **WebRTC SFU**: LiveKit WebRTC server with SIP trunking capabilities.
  - **STT (Speech-to-Text)**: Deepgram Nova-2 with real-time streaming transcription.
  - **TTS (Text-to-Speech)**: Cartesia Sonic with ultra-low latency voice synthesis (<100ms first audio chunk).
  - **VAD (Voice Activity Detection)**: Silero VAD for instant interruption handling.

---

## 2. Database Schema & Data Models

The database is built on PostgreSQL via Supabase, protected by Row Level Security (RLS), custom database functions, and foreign-key constraints.

```mermaid
erDiagram
    chatty_bots ||--o{ chatty_sessions : "has many"
    chatty_bots ||--o{ chatty_sources : "indexes"
    chatty_bots ||--o{ chatty_documents : "contains"
    chatty_bots ||--o{ chatty_team_members : "manages"
    chatty_bots ||--o{ chatty_meetings : "schedules"
    chatty_bots ||--o{ chatty_leads : "captures"
    chatty_bots ||--o{ chatty_webhooks : "dispatches"
    chatty_bots ||--o{ chatty_kb_collections : "organizes"
    chatty_bots ||--o{ chatty_agent_presence : "tracks"
    chatty_bots ||--o{ chatty_api_keys : "authenticates"
    chatty_sessions ||--o{ chatty_conversations : "contains"
    chatty_sessions ||--o{ chatty_session_notes : "annotated by"
    chatty_sessions ||--o{ chatty_csat_feedback : "rated by"
    chatty_kb_collections ||--o{ chatty_kb_articles : "groups"
```

### Table Dictionary

#### `chatty_bots`
The root bot entity representing an AI agent instance.
- `id` (`uuid`, PK): Bot identifier.
- `user_id` (`uuid`, FK -> auth.users): The bot creator/owner.
- `name` (`text`): Display name of the bot.
- `system_prompt` (`text`): Master behavioral instruction prompt injected into LLM context.
- `model` (`text`): Active LLM model (e.g. `gemini-2.5-flash`, `gpt-4o`).
- `temperature` (`float`): Sampling temperature (0.0 to 1.0).
- `color_scheme` (`jsonb`): Widget color theme, hex codes, auto-contrast tokens.
- `avatar_url` (`text`): Custom avatar image URI or preset icon identifier.
- `launcher_style` (`text`): Widget launcher type (`bubble`, `bar`, `tab`, `inline`).
- `panel_size` (`text`): Dimensions (`compact`, `standard`, `spacious`, `fullscreen`).
- `allowed_domains` (`text[]`): Domain origin allowlist for embed widgets.
- `notification_emails` (`text[]`): Recipient list for instant lead and handoff alerts.
- `voice_enabled` (`boolean`): Toggle for LiveKit real-time voice call capability.
- `voice_role` (`text`): Voice personality preset (`friendly_support`, `executive_assistant`, `technical_specialist`).
- `csat_enabled` (`boolean`): Whether to display post-chat CSAT star rating widget.

#### `chatty_sessions`
Represents an individual visitor ticket or omnichannel conversation thread.
- `id` (`uuid`, PK): Internal row ID.
- `session_id` (`text`, Unique per bot): Visitor session ID (`v-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`).
- `bot_id` (`uuid`, FK -> chatty_bots): Associated bot.
- `status` (`text`): Lifecycle status (`open`, `pending`, `resolved`, `closed`).
- `priority` (`text`): Helpdesk priority (`urgent`, `high`, `normal`, `low`).
- `channel` (`text`): Ingress channel (`web`, `email`, `whatsapp`).
- `visitor_name` (`text`): Identified visitor name.
- `visitor_email` (`text`): Identified visitor email.
- `assigned_agent_email` (`text`, Nullable): Currently assigned team member email.
- `assigned_agent_name` (`text`, Nullable): Assigned agent display name.
- `ai_paused` (`boolean`): When `true`, AI generation is suspended for live human takeover.
- `needs_attention` (`boolean`): Flag raised when visitor requests human escalation or sentiment drops.
- `escalation_reason` (`text`, Nullable): Reason for human handoff.
- `sla_status` (`text`): SLA compliance state (`on_track`, `breached`, `met`).
- `first_response_due_at` (`timestamptz`): SLA deadline for first agent response.
- `first_responded_at` (`timestamptz`): Actual timestamp of first agent message.
- `resolution_due_at` (`timestamptz`): SLA deadline for full ticket resolution.
- `resolved_at` (`timestamptz`): Timestamp when ticket was marked resolved.
- `tags` (`text[]`): Custom organizational tags.
- `last_message` (`text`): Snippet of the most recent message.
- `last_message_at` (`timestamptz`): Timestamp of latest message activity.

#### `chatty_conversations`
Individual chat messages belonging to a session.
- `id` (`uuid`, PK): Message ID.
- `session_id` (`text`): Associated session identifier.
- `bot_id` (`uuid`, FK -> chatty_bots): Associated bot.
- `sender` (`text`): Message author (`user`, `bot`, `agent`, `system`).
- `text` (`text`): Content payload (supports Markdown, LaTeX math, code blocks).
- `audio_url` (`text`, Nullable): Voice message recording URL if voice message.
- `feedback` (`int2`, Nullable): User reaction rating (`1` for thumbs up, `-1` for thumbs down).
- `created_at` (`timestamptz`): Timestamp created.

#### `chatty_session_notes`
Internal collaboration notes viewable only by staff members.
- `id` (`uuid`, PK): Note ID.
- `session_id` (`text`): Associated session identifier.
- `bot_id` (`uuid`, FK -> chatty_bots): Associated bot.
- `author_email` (`text`): Staff member email who created the note.
- `author_name` (`text`): Staff member display name.
- `note` (`text`): Internal note text.
- `created_at` (`timestamptz`): Creation timestamp.

#### `chatty_agent_presence`
Tracks real-time online status and live ticket workload of human agents.
- `id` (`uuid`, PK): Presence ID.
- `bot_id` (`uuid`, FK -> chatty_bots): Associated bot.
- `agent_email` (`text`): Agent email.
- `agent_name` (`text`): Agent name.
- `status` (`text`): Presence state (`online`, `busy`, `away`, `offline`).
- `max_capacity` (`int`): Maximum concurrent active tickets (default `5`).
- `active_tickets_count` (`int`): Live count of open/pending tickets assigned to agent.
- `last_seen_at` (`timestamptz`): Last heartbeat ping from dashboard.
- `last_assigned_at` (`timestamptz`): Timestamp of most recent ticket assignment (for round-robin balance).

#### `chatty_routing_settings`
Configures automatic ticket dispatching and load balancing rules.
- `bot_id` (`uuid`, PK, FK -> chatty_bots): Associated bot.
- `routing_strategy` (`text`): Strategy (`round_robin`, `least_loaded`, `skill_based`).
- `auto_assign_enabled` (`boolean`): Whether incoming tickets are automatically dispatched.
- `reassign_on_offline` (`boolean`): Reassign tickets if agent goes offline.
- `offline_timeout_minutes` (`int`): Inactivity minutes before an agent is considered offline.

#### `chatty_team_members`
Team roster and granular permissions matrix.
- `id` (`uuid`, PK): Membership ID.
- `bot_id` (`uuid`, FK -> chatty_bots): Associated bot.
- `email` (`text`): Team member email.
- `name` (`text`): Team member name.
- `role` (`text`): High-level role (`owner`, `admin`, `agent`).
- `permissions` (`text[]`): Array of accessible dashboard tabs (`inbox`, `sources`, `design`, `settings`, `voice`, `team`, `meetings`).
- `bookable` (`boolean`): Whether this agent is eligible to receive booked calendar meetings.
- `book_on_own_calendar` (`boolean`): Whether appointments sync to their own connected calendar vs. bot primary calendar.

#### `chatty_meetings`
Appointments booked through the chatbot.
- `id` (`uuid`, PK): Meeting ID.
- `bot_id` (`uuid`, FK -> chatty_bots): Associated bot.
- `session_id` (`text`, Nullable): Associated chat session.
- `provider` (`text`): Calendar provider (`google`, `microsoft`, `calcom`).
- `provider_event_id` (`text`): Upstream calendar event ID.
- `assigned_agent_email` (`text`): Agent assigned to host the meeting.
- `start_time` (`timestamptz`): Meeting start time.
- `end_time` (`timestamptz`): Meeting end time.
- `timezone` (`text`): Attendee timezone (e.g. `America/New_York`, `Asia/Colombo`).
- `attendee_name` (`text`): Visitor full name.
- `attendee_email` (`text`): Visitor email.
- `attendee_phone` (`text`, Nullable): Visitor phone.
- `meeting_link` (`text`, Nullable): Google Meet, Teams, or Zoom URL.
- `status` (`text`): Status (`confirmed`, `rescheduled`, `cancelled`).

#### `chatty_scheduling_settings`
Working hours and calendar constraints.
- `bot_id` (`uuid`, PK, FK -> chatty_bots): Associated bot.
- `working_hours` (`jsonb`): Day-by-day availability schedules (e.g. Mon-Fri 09:00-17:00).
- `slot_duration_minutes` (`int`): Meeting duration (e.g. 15, 30, 45, 60 minutes).
- `buffer_minutes` (`int`): Padding before and after meetings.
- `min_notice_hours` (`int`): Minimum advance notice required to book (e.g. 2 hours).
- `max_days_out` (`int`): Maximum booking horizon (e.g. 14 days).
- `max_meetings_per_day` (`int`): Daily meeting cap to prevent burnout.

#### `chatty_sources` & `chatty_documents`
Vector-indexed knowledge base resources.
- `chatty_sources`: High-level source (URL website crawl, sitemap, or file upload batch).
  - `id` (`uuid`, PK), `bot_id`, `type` (`url`, `sitemap`, `file`, `qa`), `url`, `status` (`indexing`, `indexed`, `failed`), `crawl_schedule` (`manual`, `daily`, `weekly`).
- `chatty_documents`: Individual text chunks and vector embeddings.
  - `id` (`uuid`, PK), `source_id`, `bot_id`, `title`, `content` (`text`), `token_count` (`int`), `embedding` (`vector(768)` or `vector(1536)`).

#### `chatty_kb_collections` & `chatty_kb_articles`
Enterprise public Help Center documentation portal.
- `chatty_kb_collections`: Categories / Knowledge hubs (e.g. "Getting Started", "Billing & Plans").
  - `id` (`uuid`, PK), `bot_id`, `title`, `description`, `icon`, `slug`, `order_index`.
- `chatty_kb_articles`: Individual Help Center articles.
  - `id` (`uuid`, PK), `collection_id`, `bot_id`, `title`, `slug`, `content` (`text`, rich markdown/HTML), `views` (`int`), `helpful_votes` (`int`), `unhelpful_votes` (`int`), `published` (`boolean`).

#### `chatty_leads`
Captured prospect records.
- `id` (`uuid`, PK), `bot_id`, `session_id`, `name`, `email`, `phone`, `company`, `custom_fields` (`jsonb`), `ip_address`, `country`, `city`, `latitude`, `longitude`, `created_at`.

#### `chatty_webhooks` & `chatty_webhook_deliveries`
Event notification system.
- `chatty_webhooks`: Subscribed endpoints with HMAC signing secrets.
- `chatty_webhook_deliveries`: Delivery audit logs with HTTP response status, execution duration, and automatic retry attempts.

---

## 3. The 21 Dashboard Modules

The Chatty Dashboard (`/dashboard`) delivers an all-in-one suite across 21 specialized views:

| Module | Identifier | Key Functions |
| :--- | :--- | :--- |
| **1. Home** | `home` | Real-time overview, total tickets, deflection rate, lead counts, bot health scorecard. |
| **2. Customizer** | `customizer` | Live interactive widget designer: 5 launcher styles, avatar upload, themes, color contrast scoring, panel sizing. |
| **3. Knowledge** | `knowledge` | RAG ingestion hub: URL crawler, sitemap parser, PDF/DOCX/TXT uploader, enterprise Help Center article editor. |
| **4. Playground** | `playground` | Interactive developer test sandbox with prompt modification, live RAG inspection, and debug tokens. |
| **5. Inbox** | `inbox` | Live helpdesk: Ticket queuing, status filtering, SLA countdown clocks, presence roster, auto-dispatch. |
| **6. Flows** | `flows` | Visual Flow Architect: Canvas-based node editor with AI Copilot for branching conversation flows. |
| **7. Campaigns** | `campaigns` | Proactive popups, teaser messages, behavioral triggers, exit-intent detection, page URL matching. |
| **8. Leads** | `leads` | Lead CRM table: Dynamic columns, geolocation details, conversation transcripts, CSV export. |
| **9. Feedback** | `feedback` | CSAT analytics: 1-5 star ratings, feedback breakdown, customer sentiment trends. |
| **10. Map** | `map` | Interactive geospatial world map displaying visitor distribution and regional density. |
| **11. Meetings** | `meetings` | Booked appointments calendar: Google Meet / Outlook links, attendee data, cancellation management. |
| **12. Voice Agent** | `voice_agent` | Real-time voice caller controls: LiveKit room monitor, Cartesia voice library, Deepgram speech recognition. |
| **13. Mailbox** | `mailbox` | Inbound email ticketing: Postmark/Resend webhook ingestion, customer email threading, staff email replies. |
| **14. Notifications** | `notifications` | Alert dispatcher: Configure instant alerts to Slack, Discord, Telegram, or Webhooks for new leads and tickets. |
| **15. Audit Log** | `audit_log` | Security audit trail: Searchable, immutable record of staff logins, bot edits, API requests, and data exports. |
| **16. Analytics** | `analytics` | Performance charts: Message volume, deflection rates, average resolution time, token consumption. |
| **17. Integrations** | `integrations` | External calendar OAuth connectors (Google Calendar, Microsoft Outlook, Cal.com), Zapier webhooks. |
| **18. Developer** | `developer` | API key management (SHA-256 hashed), usage quotas, interactive OpenAPI Swagger explorer. |
| **19. MCP** | `mcp` | Model Context Protocol server configuration allowing Cursor and Claude Desktop to execute Chatty tools. |
| **20. Billing** | `billing` | Subscription management (Hobby, Standard, Business, Enterprise), invoice downloads, quota limits. |
| **21. Settings** | `settings` | Core bot parameters: LLM model selection, temperature, guardrails, allowed domains, BYOK encryption keys. |

---

## 4. Widget SDK & Embed Engine

The Chatty widget can be embedded into any website or application using either the lightweight script loader or the official React component.

### Script Embed (Vanilla HTML, WordPress, Webflow, Shopify)

Add this script snippet before the closing `</body>` tag:

```html
<script
  src="https://chatty.personaliai.com/chatty-app.js"
  data-bot-id="YOUR_BOT_ID"
  async
></script>
```

#### Programmatic JavaScript API (`window.Chatty`)

Once loaded, the widget exposes the global `window.Chatty` object:

```javascript
// Open or close the widget
window.Chatty.open();
window.Chatty.close();
window.Chatty.toggle();

// Identify known user & pre-populate leads/booking fields
window.Chatty.identify({
  name: "Jane Doe",
  email: "jane@company.com",
  phone: "+1 555-0199",
  company: "Acme Corp"
});

// Send a programmatic message on behalf of user
window.Chatty.sendMessage("Can I see your enterprise pricing?");

// Listen to widget events
window.addEventListener("chatty:opened", () => console.log("Widget opened"));
window.addEventListener("chatty:lead_captured", (e) => console.log("Lead captured:", e.detail));
window.addEventListener("chatty:meeting_booked", (e) => console.log("Meeting booked:", e.detail));
```

### React / Next.js Component (`@personaliai/react-widget`)

Install the package:

```bash
npm install @personaliai/react-widget
```

Usage in React:

```tsx
import { ChatWidgetCore } from "@personaliai/react-widget";
import "@personaliai/react-widget/dist/style.css";

export default function App() {
  return (
    <ChatWidgetCore
      botId="YOUR_BOT_ID"
      backendUrl="https://api.chatty.personaliai.com"
      theme={{
        primaryColor: "#f97316",
        position: "bottom-right",
        launcherStyle: "bubble",
        panelSize: "standard"
      }}
      initialUserData={{
        name: "Jane Doe",
        email: "jane@company.com"
      }}
      onMeetingBooked={(meeting) => console.log("Booked:", meeting)}
      onLeadCaptured={(lead) => console.log("Lead:", lead)}
    />
  );
}
```

---

## 5. Conversational AI Brain & RAG Engine

The conversational brain (`plugins/widget_brain.py`) orchestrates real-time generation, retrieval-augmented generation (RAG), tool calling, and fallback safety chains.

```mermaid
sequenceDiagram
    autonumber
    actor Visitor as Visitor / User
    participant Widget as Chat Widget / SDK
    participant API as FastAPI Backend
    participant Brain as Widget Brain
    participant VectorDB as Supabase pgvector
    participant LLM as AI Model (Gemini/OpenAI)

    Visitor->>Widget: Types message ("What are your enterprise SLA policies?")
    Widget->>API: POST /api/widget/chat/stream
    API->>Brain: Process chat request
    Brain->>VectorDB: Query semantic embeddings (cosine similarity)
    VectorDB-->>Brain: Return top-K relevant document chunks
    Brain->>LLM: Ingest System Prompt + RAG Context + History + Tool Definitions
    alt LLM decides to call a Tool (e.g. check_calendar_availability)
        LLM-->>Brain: Tool Call: check_calendar_availability(date="2026-09-15")
        Brain->>API: Execute internal tool
        API-->>Brain: Tool Result (3 available slots)
        Brain->>LLM: Pass Tool Result back
    end
    LLM-->>Brain: Stream generated response tokens
    Brain-->>Widget: Server-Sent Events (SSE) stream
    Widget-->>Visitor: Live rendering of response with citations & interactive cards
```

### Multi-Model Fallback Chain
To guarantee 99.99% uptime during provider outages or rate limits (`429 Too Many Requests`), Chatty employs an automated fallback sequence:
1. Primary configured model (e.g., `gemini-2.5-flash` or customer BYOK key).
2. Secondary fallback (`gemini-3.1-flash-lite`).
3. Tertiary fallback (`gemini-3.5-flash-lite`).
4. Quaternary fallback (`gemini-2.5-flash-lite`).
5. Graceful offline ticket escalation if all LLMs are unreachable.

---

## 6. Visual Flow Architect & AI Copilot

The Visual Flow Architect (`src/components/chatbot-flow-builder.tsx`) empowers teams to visually map out conversational decision trees and deterministic flows.

### Node Types
- **Trigger Node**: Initial conversation start, keyword match, URL regex, or button click.
- **Message Node**: Sends rich text, images, videos, audio clips, or markdown links.
- **Question Node**: Collects user input with strict validation (Email, Phone, Number, Date, Regex).
- **Condition Node**: Branching logic (`if lead.country == "US"` or `if intent == "pricing"`).
- **Tool / Action Node**: Triggers internal actions (check calendar, capture lead, send webhook).
- **Human Handoff Node**: Escalates ticket to human agent inbox and pauses AI.
- **End Node**: Concludes conversation branch with optional CSAT feedback prompt.

### Natural Language AI Copilot
Users can describe their desired conversation logic in plain English (e.g. *"Create a lead qualification flow that asks for budget, company size, and books a call if budget > $5,000"*). The Flow Copilot (`/api/flow/generate`) automatically synthesizes nodes, edges, and conditions directly onto the canvas.

---

## 7. Enterprise Knowledge Base & Help Center

Chatty combines an automated multi-source ingestion pipeline with a public-facing documentation portal.

### Multi-Source Ingestion
- **Website Crawler (`app/routers/crawl.py`)**: Crawls entire websites or sitemaps (`sitemap.xml`), strips boilerplate navigation/footers, and indexes clean content.
- **Document Uploader (`app/routers/documents.py`)**: Extracts text from PDF, DOCX, TXT, CSV, and Markdown files.
- **Automated Re-crawling**: Schedules crawls daily or weekly to keep bot knowledge synchronized with live websites.

### Public Help Center Portal (`/kb/[botId]`)
- Fully branded public knowledge base hosted at `chatty.personaliai.com/kb/<bot_id>`.
- Supports hierarchical collections, SEO-optimized slugs, search autocompletion, code highlighting, and customer vote feedback (*"Was this helpful?"*).

---

## 8. Omnichannel Live Inbox & SLA Routing

The Inbox (`src/components/inbox-panel.tsx` & `app/routers/admin.py`) transforms Chatty into a full-scale helpdesk.

### Ticket Status Lifecycle
- **Open**: New or actively conversing ticket awaiting staff action.
- **Pending**: Waiting on visitor response or external inquiry.
- **Resolved**: Problem resolved; resolution SLA timer stops.
- **Closed**: Archived conversation thread.

### SLA Calculation Engine
Tracks two critical enterprise service level agreements in real time:
1. **First Response SLA**: Time elapsed between ticket creation and the first staff response (e.g. 15-minute threshold).
2. **Resolution SLA**: Time elapsed between ticket creation and resolution (e.g. 4-hour threshold).
- Visual warning badges display dynamic countdown timers (`⏱️ 12m left (Resp)`), shifting to pulsing red alerts upon breach (`🚨 Breached 5m ago`).

### Automatic Queue Routing & Load Balancing
- **Agent Presence**: Tracks `online`, `busy`, `away`, and `offline` statuses.
- **Capacity Balancing**: Ensures no agent receives more tickets than their configured `max_capacity`.
- **Auto-Assign Dispatcher**: Round-robin queue routing assigns waiting unassigned tickets to available online agents with the lowest load, automatically pausing AI to prevent agent-bot message conflicts.

---

## 9. Intelligent Calendar & Meeting Booking

Chatty includes a native scheduling engine (`plugins/availability_engine.py` & `plugins/google_integrations.py`) that eliminates back-and-forth scheduling emails.

### Features
- **OAuth2 Providers**: Direct integration with Google Calendar, Microsoft Outlook 365, and Cal.com.
- **Round-Robin Team Scheduling**: Distributes incoming sales demos and support calls across qualified team members based on availability.
- **Anti-Fake Meeting Defense**: Verifies visitor email syntax, blocks disposable email domains, and rate-limits booking attempts.
- **Timezone Auto-Detection**: Uses browser heuristics, geolocation IP, and IANA timezone tables to show slots in the visitor's local time.
- **Lead Auto-Fill**: Automatically pre-fills visitor name, email, and phone collected earlier in the conversation into the booking confirmation step.

---

## 10. LiveKit Real-Time Voice Agent

Chatty features real-time bidirectional voice calling (`voice-agent/voice_worker.py`) using WebRTC.

### Audio Pipeline Architecture
1. **Audio Capture**: Browser or mobile app captures audio via WebRTC audio track.
2. **Voice Activity Detection**: Silero VAD runs on the audio stream to detect user speech start and stop with zero perceptible delay.
3. **Real-time STT**: Deepgram Nova-2 streams transcribed user speech into the LLM context.
4. **LLM Generation**: Gemini 2.5 Flash produces conversational replies with tool execution support.
5. **Ultra-Low Latency TTS**: Cartesia Sonic streams voice chunks back over WebRTC (<100ms response time).
6. **Barge-In Support**: If the user speaks while the bot is talking, playback immediately halts and the agent listens.

---

## 11. Complete REST API Reference

Base Production URL:
```
https://api.chatty.personaliai.com
```

### Authentication
Authenticate requests using a Bearer token in the `Authorization` header:
```http
Authorization: Bearer chatty_sk_your_api_key_here
```

### Endpoints Catalog

#### Widget Endpoints (`/api/widget/*`)
- `POST /api/widget/chat`: Send a message and receive a JSON completion reply.
- `POST /api/widget/chat/stream`: Send a message and stream Server-Sent Events (SSE).
- `GET /api/widget/config?bot_id={id}`: Fetch bot design tokens, colors, avatar, and starter prompts.
- `POST /api/widget/lead`: Submit visitor contact details.
- `GET /api/widget/availability`: Fetch available calendar slots for a date range.
- `POST /api/widget/book`: Book an appointment slot.
- `POST /api/widget/feedback`: Submit CSAT star rating and comments.

#### Admin / Helpdesk Endpoints (`/api/admin/*`)
- `GET /api/admin/inbox/sessions?bot_id={id}`: List all tickets with SLA data, status, and assignees.
- `PATCH /api/admin/inbox/session`: Update ticket status, priority, tags, or assignee (supports `unassign: true`).
- `GET /api/admin/inbox/messages?bot_id={id}&session_id={sid}`: Retrieve message history for a ticket.
- `POST /api/admin/inbox/messages`: Send an agent reply to the visitor.
- `POST /api/admin/inbox/notes`: Add an internal staff note.
- `GET /api/admin/routing/presence?bot_id={id}`: Fetch agent presence roster and active ticket workloads.
- `POST /api/admin/routing/status`: Update calling agent presence (`online`, `busy`, `away`, `offline`).
- `POST /api/admin/routing/dispatch-queue?bot_id={id}`: Dispatch unassigned tickets from queue to online agents.

#### Knowledge Base Endpoints (`/api/kb/*`)
- `GET /api/kb/sources?bot_id={id}`: List all indexed sources and crawl status.
- `POST /api/kb/crawl`: Enqueue a URL or domain crawl.
- `POST /api/kb/upload`: Upload PDF, Word, TXT document for indexing.
- `DELETE /api/kb/sources/{source_id}`: Remove a knowledge source and purge vector embeddings.
- `GET /api/kb/articles?bot_id={id}`: List public Help Center articles.
- `POST /api/kb/articles`: Create or update a Help Center article.

#### Visual Flow Endpoints (`/api/flow/*`)
- `GET /api/flow?bot_id={id}`: Fetch the flow node and edge graph.
- `POST /api/flow`: Save updated flow graph.
- `POST /api/flow/generate`: AI Copilot natural language flow generator.

#### Team & Permissions Endpoints (`/api/admin/team/*`)
- `GET /api/admin/team?bot_id={id}`: List team members, roles, and tab permissions.
- `POST /api/admin/team/invite`: Invite a new team member by email.
- `PATCH /api/admin/team/{member_id}`: Update permissions (`inbox`, `sources`, `design`, `settings`, etc.).
- `DELETE /api/admin/team/{member_id}`: Remove a team member.

#### Webhooks Endpoints (`/api/admin/webhooks/*`)
- `GET /api/admin/webhooks?bot_id={id}`: List registered webhook subscriptions.
- `POST /api/admin/webhooks`: Register a new webhook endpoint.
- `POST /api/admin/webhooks/test`: Dispatch a mock event to test customer endpoint.
- `GET /api/admin/webhooks/deliveries?bot_id={id}`: View recent webhook delivery attempts and status.

---

## 12. Model Context Protocol (MCP) Server

Chatty features a native MCP server (`app/routers/mcp.py`) allowing external AI environments (Claude Desktop, Cursor, Zed) to interact with Chatty bots as AI tools.

### Available MCP Tools
- `chatty_send_message`: Send a chat prompt to a specific bot.
- `chatty_search_knowledge`: Semantically search a bot's indexed knowledge base.
- `chatty_list_leads`: Query captured customer leads.
- `chatty_check_availability`: Inspect open calendar slots.
- `chatty_book_meeting`: Schedule an appointment.

---

## 13. Webhooks & Events Reference

Chatty dispatches outbound HTTPS POST requests with JSON payloads whenever critical events occur.

### Supported Events
- `chat.started`: Triggered when a new visitor initiates a session.
- `chat.ended`: Triggered when a chat is resolved or times out.
- `lead.captured`: Triggered when visitor contact details are captured.
- `meeting.booked`: Triggered when a calendar appointment is confirmed.
- `handoff.requested`: Triggered when a visitor requests a human agent.
- `sla.breached`: Triggered when a response or resolution SLA is breached.

### HMAC-SHA256 Signature Verification
Every webhook request includes the `X-Chatty-Signature` header computed using the webhook's signing secret.

#### Verification in Node.js
```javascript
const crypto = require("crypto");

function verifyChattyWebhook(rawBody, signatureHeader, secret) {
  const hmac = crypto.createHmac("sha256", secret);
  const digest = "sha256=" + hmac.update(rawBody).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signatureHeader));
}
```

#### Verification in Python
```python
import hmac
import hashlib

def verify_chatty_webhook(raw_body: bytes, signature_header: str, secret: str) -> bool:
    expected = "sha256=" + hmac.new(secret.encode(), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature_header)
```

---

## 14. Security, BYOK & Permissions

### Bring Your Own Key (BYOK)
Chatty offers enterprise encryption for BYOK credentials. When customers provide their own API keys for Google Gemini, OpenAI, Anthropic, or Groq:
- Keys are encrypted in application memory using `Fernet` (AES-128-CBC with PKCS7 padding and HMAC-SHA256 authentication).
- Stored as ciphertext in the `chatty_byok` Supabase table.
- Decrypted only in transient memory during LLM inference.
- Never logged or exposed to client-side scripts.

### Role-Based Access Control (RBAC)
- **Owner**: Creator of the bot; possesses full authority over all 21 tabs, billing, API keys, and deletion.
- **Admin**: Can manage knowledge sources, customizer, voice settings, inbox, and team roster. Cannot modify billing or delete the bot.
- **Agent**: Restricted by default to the live **Inbox** tab to handle customer conversations, view notes, and update ticket statuses.

---

## 15. Deployment, DevOps & Mirroring Guide

### Repository Architecture

`PersonaliAI/chatty` is the single canonical repository. It contains the
frontend, backend, voice worker, deployment configuration, tests, and docs.
Changes are committed and pushed directly to its `main` branch. There is no
private source repository or frontend mirroring step.

GitHub Actions CI (`.github/workflows/ci.yml`) and the configured deployment
providers validate and release the canonical repository.

### Local Development Setup

#### Prerequisites
- Node.js 20+ and npm
- Python 3.11+
- Supabase Project URL and Service Role Key

#### Backend Setup
```bash
cd chatty-backend
python -m venv venv
source venv/bin/activate  # On Windows: .\venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

#### Frontend Setup
```bash
cd chatty
npm install
npm run dev  # Starts Next.js on http://localhost:3000
```

### Production Deployment
- **Backend**: Containerized with Docker and deployed to **Google Cloud Run**:
  ```bash
  gcloud run deploy chatty-api --source . --region=us-central1 --project=personaliai --clear-base-image --quiet
  ```
- **Frontend**: Deployed to **Vercel** with automatic preview branches and edge caching.
