import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://dckjbkcormifiuwfpahj.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRja2pia2Nvcm1pZml1d2ZwYWhqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzAzNzYxMywiZXhwIjoyMTAyNjEzNjEzfQ.j6-HxLhvEkWVWS8DRIeDHb2gRlqEv6tRTx706QtiGFg";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const formattedArticles = [
  {
    id: "66b77ac9-638f-4e1a-8151-bd9ab85caf1f",
    title: "Quickstart: Installing Chatty on Your Website",
    subtitle: "Step-by-step setup for HTML, React/Next.js, WordPress, Shopify, and Webflow.",
    content: `# Quickstart: Installing Chatty on Your Website

Chatty is designed for lightning-fast installation. You can embed the interactive support widget on any website, single-page application, or CMS in under 2 minutes.

---

## 1. Installation Methods Overview

| Platform / Framework | Installation Method | Bundle Overhead | Shadow DOM Isolation | Dynamic Theme Sync |
| :--- | :--- | :--- | :--- | :--- |
| **Vanilla HTML / Static** | Script tag in \`<body>\` | < 35 KB gzipped | Yes (Full CSS isolation) | Automatic |
| **React / Next.js** | \`@personaliai/react-widget\` | Zero layout shift | Yes | Reactive props |
| **WordPress** | Header/Footer plugin or \`functions.php\` | Cached CDN asset | Yes | Automatic |
| **Shopify** | \`theme.liquid\` snippet | Async non-blocking | Yes | Automatic |
| **Webflow** | Custom Code Footer | Async non-blocking | Yes | Automatic |

---

## 2. Single-Line HTML Embed

Paste this snippet immediately before the closing \`</body>\` tag of your website:

\`\`\`html
<!-- Chatty AI Support Widget -->
<script
  src="https://chatty.personaliai.com/widget.js"
  data-bot-id="ad32f373-7694-43f4-9465-f8d65ce291e3"
  defer
></script>
\`\`\`

> [!NOTE]
> The script is loaded asynchronously with \`defer\` so it never blocks DOM construction or impacts your Core Web Vitals.

---

## 3. React & Next.js Installation

Install the official lightweight React SDK:

\`\`\`bash
npm install @personaliai/react-widget
# or
yarn add @personaliai/react-widget
# or
pnpm add @personaliai/react-widget
\`\`\`

Then render the widget in your root layout or dashboard view:

\`\`\`tsx
"use client";

import { ChatWidget } from "@personaliai/react-widget";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <ChatWidget
          botId="ad32f373-7694-43f4-9465-f8d65ce291e3"
          position="bottom-right"
        />
      </body>
    </html>
  );
}
\`\`\`

---

## 4. Performance & Latency Budget

Chatty's standalone script is delivered via global edge CDN caches (Cloudflare) with brotli compression. The browser latency is bounded by:

$$\\text{Total Widget Load Time} = T_{\\text{DNS}} + T_{\\text{TLS}} + \\frac{S_{\\text{bundle}}}{B_{\\text{bandwidth}}} \\le 120\\,\\text{ms}$$

where:
* $S_{\\text{bundle}} \\approx 34.2\\,\\text{KB}$ (gzipped runtime bundle)
* $B_{\\text{bandwidth}}$ is the visitor's network throughput
* Execution occurs entirely inside an isolated **Shadow Root**, ensuring zero CSS collisions with your application styles.

---

## 5. Verification Checklist

* [x] Widget launcher icon appears in bottom-right (or bottom-left) corner.
* [x] Clicking opens the animated Home tab with conversation starters.
* [x] Send a test message to verify real-time streaming replies.`
  },
  {
    id: "96452b53-da08-4e0f-91fd-748297d4bdb3",
    title: "Configuring Your AI Assistant Tone and Persona",
    subtitle: "Customize system instructions, fallback rules, conversation starters, and language settings.",
    content: `# Configuring Your AI Assistant Tone and Persona

Chatty lets you tailor your assistant's communication style so it authentically reflects your company voice, brand standards, and support protocols.

---

## 1. Tone Presets & Temperature Matrix

The assistant's persona is governed by system instructions and model sampling temperature $T$:

| Preset Name | Sampling Temp ($T$) | Tone Profile | Recommended Industry | Typical Output Style |
| :--- | :--- | :--- | :--- | :--- |
| **Professional & Concise** | $0.20$ | Crisp, direct, matter-of-fact | B2B SaaS, Finance, Legal | Bulleted facts, minimal filler |
| **Empathetic & Warm** | $0.50$ | Friendly, understanding, patient | Healthcare, DTC eCommerce | Polite greetings, supportive guidance |
| **Playful & Quirky** | $0.75$ | Casual, witty, energetic | Gaming, Creator tools, Lifestyle | Conversational idioms, appropriate emojis |
| **Technical Specialist** | $0.15$ | Rigorous, code-oriented, exact | Developer APIs, Cloud infra | Code snippets, terminal commands |

The model token probability distribution follows the standard softmax function:

$$P(w_i) = \\frac{\\exp(z_i / T)}{\\sum_{j} \\exp(z_j / T)}$$

Lower values ($T \\to 0$) yield deterministic, highly factual responses ideal for support documentation, while moderate values ($T \\approx 0.5$) introduce natural conversational warmth.

---

## 2. Custom System Instructions

You can provide explicit operational constraints under **Dashboard > Customizer > Persona**:

\`\`\`markdown
You are the Chatty Assistant for Acme Corp.
Your duties:
1. Greet visitors warmly and answer questions using provided Knowledge Base chunks.
2. If asked about pricing, reference Acme's official tiers: Starter ($29/mo) and Scale ($99/mo).
3. Always provide links to relevant documentation when available.
4. If a question cannot be resolved from the Knowledge Base, politely offer human handoff.
\`\`\`

---

## 3. Fallback & Hand-off Behavior

When the AI encounters an out-of-scope inquiry, you can select one of three automatic fallback pathways:

* **Graceful Deflection**: The bot states it does not have the necessary details and invites an email leave-behind.
* **Live Agent Escalation**: If agents are online, the conversation flags as urgent in the Live Inbox.
* **Lead Capture Form**: Automatically surfaces an in-chat form requesting full name, company email, and message details.`
  },
  {
    id: "ad493119-d83c-40aa-9981-54de5dfddbbe",
    title: "Connecting Data Sources & Training Your Assistant",
    subtitle: "Sync websites, sitemaps, PDFs, Notion pages, and docs into your AI knowledge base.",
    content: `# Connecting Data Sources & Training Your Assistant

Chatty employs an enterprise-grade RAG (Retrieval-Augmented Generation) pipeline that converts your company documents, public web pages, and product catalogs into accurate, hallucination-free answers.

---

## 1. Supported Ingestion Sources

| Source Type | Accepted Formats | Maximum Document Size | Re-indexing Cadence | Parsing Strategy |
| :--- | :--- | :--- | :--- | :--- |
| **Website Crawler** | URL (Deep crawl up to 500 pages) | Unlimited total domain | Daily / Weekly / Manual | HTML text extraction & nav pruning |
| **XML Sitemap** | \`sitemap.xml\` URL | Up to 1,000 URLs per bot | Automatic weekly resync | Hierarchical URL discovery |
| **Document Uploads** | PDF, DOCX, Markdown, TXT | 50 MB per file | Instant upon upload | OCR + Structural layout parser |
| **Notion Workspaces** | Notion OAuth integration | Unlimited synced pages | Real-time webhook update | Markdown blocks extraction |
| **Google Drive** | Docs, Sheets, Presentations | 25 MB per file | On-demand or scheduled | Document text & table extractor |

---

## 2. Chunking & Embedding Geometry

During indexing, source texts are segmented into overlapping semantic chunks:

$$\\text{Chunk Size} = L_{\\text{chunk}}, \\quad \\text{Overlap} = \\alpha \\cdot L_{\\text{chunk}} \\quad (\\alpha \\in [0.10, 0.20])$$

For technical manuals, a typical configuration is $L_{\\text{chunk}} = 512$ tokens with $\\text{Overlap} = 64$ tokens. This ensures query boundaries never bisect key conceptual sentences.

\`\`\`
[ Chunk 1: Tokens 0 to 512 ]
              [ Overlap: 64 tokens ]
              [ Chunk 2: Tokens 448 to 960 ]
\`\`\`

---

## 3. Training Steps

1. Open **Dashboard > Knowledge Base > Sources**.
2. Click **+ Add Data Source**.
3. Enter your website address or drop your PDF manual.
4. Click **Start Ingestion**. The progress indicator shows crawling, chunking, and vector embedding status in real time.
5. Test immediately in the **Playground** tab to verify retrieval accuracy.`
  },
  {
    id: "224e7777-02ba-4074-a591-f2e83a0cb2ca",
    title: "Publishing Help Articles to the Visitor Widget",
    subtitle: "How to write, organize, and surface searchable articles inside the Crisp-style help center tab.",
    content: `# Publishing Help Articles to the Visitor Widget

Chatty includes a built-in Crisp/Intercom-grade Knowledge Base that visitors can browse, search, and read directly inside the chat widget or on your dedicated Help Center portal (\`/kb/[botId]\`).

---

## 1. Article Lifecycle & Visibility

| Article Status | Widget Help Center Tab | Public Portal (\`/kb/...\`) | AI Vector Ingestion | Searchable |
| :--- | :--- | :--- | :--- | :--- |
| **Published (Public)** | Visible | Visible | Yes (Live for RAG) | Yes |
| **Internal Only** | Hidden from visitors | Requires team login | Yes (Agents only) | Restricted |
| **Draft** | Hidden | Hidden | No | No |
| **Archived** | Hidden | Hidden | No | No |

---

## 2. Content Formatting Capabilities

The article editor supports full **GitHub Flavored Markdown (GFM)**, **LaTeX mathematical typography**, and **structured tables**:

* **Tables**: Insert multi-column specification tables, feature comparisons, and pricing matrixes.
* **Math / LaTeX**: Render complex scientific, financial, or engineering equations inline ($\$x^2\$) or centered (\$\$\\dots\$\$).
* **Code Blocks**: Formatted syntax-highlighted code for Javascript, Python, HTML, and JSON.
* **Callout Quotes**: Highlight important warnings, tips, and operational notes.

---

## 3. Measuring Article CSAT & Helpfulness

Every published article features an integrated **Was this article helpful?** feedback module. The helpfulness percentage is computed as:

$$\\text{CSAT}_{\\text{article}} = \\left( \\frac{N_{\\text{helpful}}}{N_{\\text{helpful}} + N_{\\text{unhelpful}}} \\right) \\times 100\\%$$

Articles scoring below $70\\%$ are flagged in your **Knowledge Base Analytics** dashboard so your content team can expand clarity and address gaps.`
  },
  {
    id: "0d1c868b-7e6e-4bee-98f1-c7a3c0d44648",
    title: "Managing the Live Inbox, SLAs, and Ticket States",
    subtitle: "Real-time SSE updates, priority queues, SLA breach warnings, and canned responses.",
    content: `# Managing the Live Inbox, SLAs, and Ticket States

The Chatty Live Inbox gives support agents a high-speed command center to monitor AI conversations in real time, take over complex sessions, and meet customer SLAs.

---

## 1. Ticket States & Lifecycle

Every incoming customer conversation flows through 4 distinct states:

| Status | Trigger Condition | SLA Timer Status | Recommended Action |
| :--- | :--- | :--- | :--- |
| **Open** | Customer sent new message; awaiting human or AI resolution | Active (Counting down) | Assign agent or let AI answer |
| **Pending** | Agent replied; waiting for visitor response | Paused | Monitor for visitor reply |
| **Snoozed** | Deferred until customer returns or specified time arrives | Suspended | Auto-reopens on customer ping |
| **Closed** | Issue fully resolved or visitor ended session | Stopped | Triggers CSAT survey |

---

## 2. Service Level Agreement (SLA) Calculations

SLA timers ensure high-priority inquiries are addressed promptly. The remaining time until breach is calculated as:

$$\\Delta t_{\\text{SLA}} = t_{\\text{created}} + T_{\\text{threshold}} - t_{\\text{current}}$$

| Priority Tier | Target First Response ($T_{\\text{threshold}}$) | Resolution Target | Breach Escalation |
| :--- | :--- | :--- | :--- |
| **Urgent (VIP)** | $\\le 5\\,\\text{minutes}$ | $\\le 1\\,\\text{hour}$ | Immediate Slack alert + Manager notify |
| **High** | $\\le 15\\,\\text{minutes}$ | $\\le 4\\,\\text{hours}$ | Pinned to top of agent queue |
| **Normal** | $\\le 1\\,\\text{hour}$ | $\\le 24\\,\\text{hours}$ | Standard queue ordering |
| **Low** | $\\le 4\\,\\text{hours}$ | $\\le 48\\,\\text{hours}$ | Standard queue ordering |

Overall team SLA compliance is calculated across rolling 30-day windows:

$$\\text{SLA Compliance} = \\left( \\frac{N_{\\text{within SLA}}}{N_{\\text{total tickets}}} \\right) \\times 100\\%$$

---

## 3. Real-Time Streaming & Canned Responses

* **SSE Live Stream**: Agent messages and customer keystrokes sync instantly without manual browser refreshes.
* **Canned Responses**: Type \`/\` in the message composer to summon saved reply templates for instant answers to frequent questions.`
  },
  {
    id: "64ff32cb-6a70-4402-aa56-c0d7115c0d7a",
    title: "Agent Presence, Team Roster, and Workload Limits",
    subtitle: "Configure status toggles (Available, Busy, Away), active chat caps, and round-robin assignment.",
    content: `# Agent Presence, Team Roster, and Workload Limits

Keep team workloads balanced and prevent agent burnout while ensuring website visitors always receive prompt, attentive responses.

---

## 1. Presence States Reference

Agents can toggle their real-time presence directly from the Inbox header:

| Presence State | Receives New Chats | Widget Status Indicator | Auto-Trigger Condition |
| :--- | :--- | :--- | :--- |
| 🟢 **Available** | Yes (via round-robin) | "Support team online" | Active window activity |
| 🟡 **Busy** | Only assigned follow-ups | "Limited agent availability" | Reached concurrency cap |
| 🟠 **Away** | No new chats assigned | "Typically replies in 15m" | Inactive for > 10 minutes |
| ⚪ **Offline** | No chats assigned | "AI assistant on duty" | Logged out or closed tab |

---

## 2. Team Concurrency & Workload Equation

Total real-time team capacity $C_{\\text{team}}$ is computed dynamically based on active agents:

$$C_{\\text{team}} = \\sum_{i=1}^{M} \\left( \\text{MaxConcurrentChats}_i - \\text{ActiveChats}_i \\right) \\times \\mathbb{I}(\\text{State}_i = \\text{Available})$$

If $C_{\\text{team}} \\le 0$, the widget automatically switches to **AI Lead Capture mode**, assuring the customer that a human teammate will follow up via email.

---

## 3. Configuring Routing Rules

1. Navigate to **Dashboard > Settings > Team Routing**.
2. Set **Maximum Concurrent Chats** per agent (default: 5).
3. Toggle **Round-Robin Assignment** to distribute chats evenly among all currently available operators.`
  },
  {
    id: "1c19ca16-de61-48d3-92d0-485a8b03de86",
    title: "Real-Time AI Voice Calling Setup",
    subtitle: "Deploy LiveKit WebRTC audio pipelines for interactive, ultra-low latency voice conversations.",
    content: `# Real-Time AI Voice Calling Setup

Chatty supports interactive, ultra-low-latency voice conversations, allowing website visitors to speak naturally with your AI assistant directly from their browser without downloading any external software.

---

## 1. WebRTC Audio Pipeline Architecture

Chatty utilizes a state-of-the-art streaming voice pipeline built on WebRTC and LiveKit:

| Pipeline Stage | Technology Component | Typical Latency ($L_i$) | Functional Purpose |
| :--- | :--- | :--- | :--- |
| **1. Audio Capture** | Browser WebRTC Opus (16kHz / 48kHz) | $20\\,\\text{ms}$ | Full-duplex microphone stream |
| **2. Voice Activity Detection** | Silero VAD (Server-side) | $30\\,\\text{ms}$ | Detects user speech onset & natural pauses |
| **3. Speech-to-Text (STT)** | Deepgram Nova-2 / Whisper Realtime | $120\\,\\text{ms}$ | Streaming tokenized speech recognition |
| **4. Intelligence (LLM)** | Gemini 2.0 Flash / GPT-4o Realtime | $140\\,\\text{ms}$ (TTFT) | Generates grounded conversational replies |
| **5. Text-to-Speech (TTS)** | Cartesia Sonic / ElevenLabs Turbo | $90\\,\\text{ms}$ (TTFB) | Ultra-expressive streaming audio synthesis |
| **6. WebRTC Playout** | LiveKit Edge Rooms | $25\\,\\text{ms}$ | Jitter-buffered audio playback |

---

## 2. Total Turn-Taking Latency Budget

End-to-end voice latency represents the delay between a user finishing their sentence and hearing the AI's first spoken syllable:

$$L_{\\text{E2E}} = L_{\\text{VAD}} + L_{\\text{STT}} + L_{\\text{LLM-TTFT}} + L_{\\text{TTS-TTFB}} + 2 \\times \\text{RTT}_{\\text{network}}$$

$$L_{\\text{E2E}} \\approx 30 + 120 + 140 + 90 + 50 = 430\\,\\text{ms}$$

At $\\approx 430\\,\\text{ms}$, conversations feel fluid, lifelike, and natural, matching standard human phone conversation cadence.

---

## 3. Enabling Voice Calling on Your Bot

1. Open **Dashboard > Customizer > Features**.
2. Toggle **Voice Call Support** to ON.
3. Configure your **LiveKit Server URL** and **API Secrets** (or use Chatty's pre-configured cloud voice infrastructure).
4. Select your preferred assistant voice profile (e.g., *Nova*, *Alloy*, *Echo*, *Cartesia Conversational*).
5. Open the visitor widget and click the **Phone / Call** button to begin testing.`
  },
  {
    id: "b9ea2aa6-862f-4d6d-856e-db6eaab89786",
    title: "Connecting Calendar Booking & Zoom Meetings",
    subtitle: "Let leads book sales consultations and product demos directly inside chat with full reschedule sync.",
    content: `# Connecting Calendar Booking & Zoom Meetings

Turn website visitors and qualified prospects into booked sales calls automatically through natural conversation and interactive calendar cards.

---

## 1. Integration Matrix

| Calendar Provider | Auth Protocol | Real-Time Sync | Meeting Link Generation | Reschedule & Cancel |
| :--- | :--- | :--- | :--- | :--- |
| **Google Calendar** | Google OAuth 2.0 | Instant bidirectional | Google Meet / Zoom | Supported in chat |
| **Outlook / Office 365** | Microsoft Graph API | Instant bidirectional | Microsoft Teams / Zoom | Supported in chat |
| **Cal.com** | API Key & Webhooks | Instant bidirectional | Zoom / Meet / Custom | Supported in chat |
| **Calendly** | Personal Access Token | Webhook notifications | Calendly default URL | Redirect link |

---

## 2. Conflict-Free Slot Calculation

When a visitor requests a meeting, the AI assistant computes available times by subtracting existing events and safety buffers:

$$\\mathcal{S}_{\\text{available}} = \\mathcal{W}_{\\text{working hours}} \\setminus \\bigcup_{k} \\left[ t_k^{\\text{start}} - \\Delta t_{\\text{buffer}},\\; t_k^{\\text{end}} + \\Delta t_{\\text{buffer}} \\right]$$

where $\\Delta t_{\\text{buffer}} = 10\\,\\text{minutes}$ prevents back-to-back scheduling fatigue.

---

## 3. Booking Experience Flow

1. **Natural Language Qualification**: The visitor asks about a demo or strategy call.
2. **Interactive Date/Time Picker**: The bot outputs an in-chat visual card allowing the visitor to select convenient slots across their local timezone.
3. **Automated Confirmation**: Upon selection, the bot creates the calendar event, sends email invitations with the video link, and displays dynamic **Reschedule** and **Cancel** controls directly in the chat thread.`
  },
  {
    id: "156712a6-dcd6-4bdd-a6db-624836ba6460",
    title: "Managing Subscription, Seats, and Workspace Security",
    subtitle: "Role-based access control, PriceShield anti-abuse defenses, and scoped API keys.",
    content: `# Managing Subscription, Seats, and Workspace Security

Learn how to configure granular team permissions, safeguard your AI token usage against malicious spam bots, and manage enterprise security controls.

---

## 1. Role-Based Access Control (RBAC)

| Capability / Action | Owner | Admin | Support Agent | Read-Only Analyst |
| :--- | :---: | :---: | :---: | :---: |
| **Manage Billing & Subscriptions** | Yes | No | No | No |
| **Invite & Remove Team Members** | Yes | Yes | No | No |
| **Edit Bot Personas & Prompts** | Yes | Yes | No | No |
| **Manage Knowledge Base Sources** | Yes | Yes | No | No |
| **Reply in Live Inbox** | Yes | Yes | Yes | No |
| **View Analytics & Reports** | Yes | Yes | Yes | Yes |

---

## 2. PriceShield Anti-Abuse Defenses

To shield your account from malicious scraping and rapid prompt exhaustion, Chatty includes a built-in token-bucket rate limiter:

$$B(t) = \\min\\left( B_{\\max},\\; B(t - \\Delta t) + r \\cdot \\Delta t \\right)$$

* **Burst Allowance ($B_{\\max}$)**: Maximum 10 messages in rapid succession per visitor IP.
* **Refill Rate ($r$)**: 1 token every 3 seconds.
* **Malicious Payload Inspection**: Automatic filtering of SQL injection, prompt injection overrides, and multi-megabyte payloads before reaching LLM inference.`
  },
  {
    id: "28a1a2a6-7f11-40a4-abf7-28ce364328e2",
    title: "Customizing Widget Design, Colors, and Presets",
    subtitle: "Styling presets, contrast-aware color systems, dark mode, and launcher badge positioning.",
    content: `# Customizing Widget Design, Colors, and Presets

Chatty offers complete design control so your chat widget matches your exact brand aesthetic, visual guidelines, and contrast standards.

---

## 1. Visual Design Presets

| Preset Name | Border Radius | Shadow Depth | Typography Style | Best Suited For |
| :--- | :--- | :--- | :--- | :--- |
| **Modern (Default)** | \`1.25rem\` (20px) | Soft multi-layer diffuse | Inter / Sans-serif | SaaS apps, Modern tech startups |
| **Minimalist** | \`0.5rem\` (8px) | 1px clean hairline border | System font stack | Clean, monochrome editorial sites |
| **Compact** | \`0.75rem\` (12px) | Tight subtle elevation | Dense condensed typography | High-density dashboards, portals |
| **Neumorphic** | \`1.5rem\` (24px) | Dual inner/outer soft shadow | Curved friendly rounded | Creative studios, mobile-first web |
| **Cyberpunk** | \`0.25rem\` (4px) | Neon accent glow border | Monospace accents | Web3, Gaming, Developer tools |

---

## 2. WCAG 2.1 Contrast Guarantee

Chatty dynamically evaluates your brand's primary color to guarantee accessible text readability:

$$\\text{Contrast Ratio} = \\frac{L_1 + 0.05}{L_2 + 0.05} \\ge 4.5:1$$

where $L_1$ is the relative luminance of the lighter color and $L_2$ is the luminance of the darker color. If your selected brand color does not meet the $4.5:1$ threshold for text buttons, Chatty automatically selects high-contrast foreground typography (crisp white or deep slate).

---

## 3. Positioning & Dark Mode

* **Positioning**: Choose bottom-right or bottom-left corner placement, with customizable horizontal and vertical edge offsets ($10\\,\\text{px}$ to $50\\,\\text{px}$).
* **Theme Modes**: Supports **Auto** (matches user system preference), **Strict Light**, or **Strict Dark** mode.`
  },
  {
    id: "1bdd9e2e-3112-40e4-9ad0-5213f3f67a68",
    title: "Optimizing RAG Search Accuracy & Chunking Strategies",
    subtitle: "Similarity thresholds, chunk overlap, context windows, and zero-hallucination settings.",
    content: `# Optimizing RAG Search Accuracy & Chunking Strategies

Fine-tune your Retrieval-Augmented Generation (RAG) parameters to ensure pinpoint accuracy, high precision, and zero hallucinations across complex technical documentation.

---

## 1. Chunking Recommendations by Document Type

| Content Format | Recommended Chunk Size | Chunk Overlap | Similarity Cutoff ($\\tau$) | Top-$K$ Chunks |
| :--- | :--- | :--- | :--- | :--- |
| **FAQ & Q&A Lists** | 256 tokens | 32 tokens | $\\tau \\ge 0.75$ | 3 |
| **Technical API Docs** | 512 tokens | 64 tokens | $\\tau \\ge 0.70$ | 5 |
| **Lengthy PDF Manuals** | 768 tokens | 128 tokens | $\\tau \\ge 0.65$ | 6 |
| **Legal / Terms of Service** | 512 tokens | 100 tokens | $\\tau \\ge 0.80$ | 4 |

---

## 2. Vector Cosine Similarity Metric

During query execution, the visitor's question vector $\\mathbf{q}$ is compared against all document chunk vectors $\\mathbf{d}_i$:

$$\\text{Sim}(\\mathbf{q}, \\mathbf{d}_i) = \\frac{\\mathbf{q} \\cdot \\mathbf{d}_i}{\\|\\mathbf{q}\\| \\|\\mathbf{d}_i\\|} = \\frac{\\sum_{j=1}^{D} q_j d_{i,j}}{\\sqrt{\\sum_{j=1}^{D} q_j^2} \\sqrt{\\sum_{j=1}^{D} d_{i,j}^2}}$$

Only chunks satisfying $\\text{Sim}(\\mathbf{q}, \\mathbf{d}_i) \\ge \\tau$ are injected into the LLM context window.

---

## 3. Anti-Hallucination Guardrails

1. **Zero-Guessing Directive**: If $\\max_i \\text{Sim}(\\mathbf{q}, \\mathbf{d}_i) < \\tau$, the model is strictly instructed to defer to support rather than extrapolate.
2. **Exact Source Attribution**: Responses include clickable source citations pointing to the exact page and paragraph of origin.`
  },
  {
    id: "82b54cf7-9640-483c-b8d9-e4b2bbf0116b",
    title: "Email & Slack Escalation Workflows",
    subtitle: "Automate off-hours lead capture and route urgent conversations directly to your Slack channels.",
    content: `# Email & Slack Escalation Workflows

Ensure no customer request slips through the cracks, even when your entire human support team is offline or in different time zones.

---

## 1. Escalation Trigger Matrix

| Trigger Event | Severity Level | Target Notification Channel | Automated Widget Action |
| :--- | :--- | :--- | :--- |
| **Visitor Requests Human** | Normal | Slack channel \`#support-general\` | Flags ticket as awaiting human |
| **AI Confidence Below $\\tau$** | Medium | Slack channel \`#support-triage\` | Offers visitor email follow-up |
| **Frustrated Sentiment Detected** | High | Slack channel \`#support-urgent\` | Pinned to top of inbox queue |
| **After-Hours Inbound Inquiry** | Normal | Team support email address | Displays **Leave a Message** card |

The composite urgency score is calculated as:

$$\\text{Urgency} = w_1 \\cdot (1 - \\text{Confidence}) + w_2 \\cdot \\mathbb{I}(\\text{Negative Sentiment}) + w_3 \\cdot \\mathbb{I}(\\text{VIP})$$

---

## 2. Interactive Slack Action Buttons

Every Slack notification card posted by Chatty includes interactive one-click actions:

* **Claim Conversation**: Instantly assigns the ticket to the Slack user who clicked the button.
* **Open in Dashboard**: Deep-links directly to the customer's live chat session.
* **Reply via Slack**: Type a reply in the Slack thread to transmit it straight back to the visitor's website widget.`
  },
  {
    id: "f812b78e-f2c3-4e07-8759-a84664ef997c",
    title: "Connecting WhatsApp & Slack Channels",
    subtitle: "Connect Meta WhatsApp Cloud API and Slack Bot Manifest to unify all customer channels.",
    content: `# Connecting WhatsApp & Slack Channels

Consolidate all customer communications into one unified omnichannel inbox by connecting your official WhatsApp Business and Slack channels.

---

## 1. Channel Feature Capabilities

| Feature Capability | Web Chat Widget | WhatsApp Cloud API | Slack Connect |
| :--- | :---: | :---: | :---: |
| **Real-time AI Responses** | Yes (Streaming) | Yes (Message reply) | Yes |
| **Voice Audio Calling** | Yes (WebRTC) | Audio voice notes | Audio huddles |
| **Interactive UI Cards** | Yes (Booking & Products) | WhatsApp Interactive Buttons | Slack Block Kit |
| **File / Media Attachments** | Images, Audio, Docs | Images, Voice, Docs | All file types |
| **Read Receipts & Delivery** | Instant | Double checkmarks | Slack checkmark |

---

## 2. Meta WhatsApp Cloud API Setup

1. Open **Dashboard > Integrations > WhatsApp**.
2. Enter your Meta Developer credentials:
   * **Phone Number ID**
   * **WhatsApp Business Account ID (WABA)**
   * **System User Permanent Access Token**
3. Configure your Webhook URL in your Meta App:
   \`\`\`
   Webhook URL: https://api.chatty.personaliai.com/api/integrations/whatsapp/webhook
   Verify Token: [Your Secure Verification Token]
   \`\`\`
4. Subscribe to the \`messages\` webhook event.`
  },
  {
    id: "ab56a7a6-e00c-4c5b-8fde-87c942d4bd1a",
    title: "Understanding Quotas, Token Limits, and BYOK Pricing",
    subtitle: "How message counters, token limits, and Bring-Your-Own-Key modes work with 0% markup.",
    content: `# Understanding Quotas, Token Limits, and BYOK Pricing

Chatty provides transparent, predictable pricing designed to scale effortlessly from solo builders to high-volume enterprise operations.

---

## 1. Managed Plans vs. Bring-Your-Own-Key (BYOK)

| Plan Feature | Free (BYOK) | Hobby Plan ($19/mo) | Pro Plan ($49/mo) | Enterprise |
| :--- | :--- | :--- | :--- | :--- |
| **Platform Subscription** | **$0 / month** | $19 / month | $49 / month | Custom SLA |
| **Included Messages** | Unlimited | 2,000 / month | 10,000 / month | Unlimited |
| **Platform Markup** | **0% Markup** | Inclusive | Inclusive | Volume discounts |
| **Concurrency Limit** | 5 requests / sec | 10 requests / sec | 25 requests / sec | 100+ requests / sec |
| **Key Encryption Vault** | AES-256 Fernet | Not required | Not required | Dedicated HSM |

---

## 2. Wholesale BYOK Cost Calculation

On the Free BYOK plan, you are billed directly by your AI provider (Google Gemini, OpenAI, Anthropic, or OpenRouter) at their baseline developer rates with **0% markup from Chatty**:

$$\\text{Total Cost} = \\left( \\frac{N_{\\text{input tokens}}}{10^6} \\times P_{\\text{input}} \\right) + \\left( \\frac{N_{\\text{output tokens}}}{10^6} \\times P_{\\text{output}} \\right)$$

### Typical Savings Example (Gemini 2.0 Flash)
* Input rate: $P_{\\text{in}} = \\$0.10$ per $1\\,\\text{M tokens}$
* Output rate: $P_{\\text{out}} = \\$0.40$ per $1\\,\\text{M tokens}$
* For 5,000 standard customer conversations ($\\approx 3.5\\,\\text{M input tokens}, 1.2\\,\\text{M output tokens}$):

$$\\text{Monthly AI Cost} = (3.5 \\times 0.10) + (1.2 \\times 0.40) = 0.35 + 0.48 = \\$0.83\\,/\\,\\text{month}$$

$$\\text{Effective Savings vs. Traditional \\$99/mo SaaS} = \\left( 1 - \\frac{0.83}{99} \\right) \\times 100\\% \\approx 99.16\\%$$`
  },
  {
    id: "7023d35c-b431-4dab-b5f2-7c44d17c9aef",
    title: "Billing FAQ: Invoices, Receipts, Payment Methods, and Cancellations",
    subtitle: "Everything you need to know about payment processing, receipts, tax VAT IDs, and renewals.",
    content: `# Billing FAQ: Invoices, Receipts, Payment Methods, and Cancellations

Find immediate answers to common questions regarding invoice retrieval, corporate billing details, VAT tax compliance, and subscription management.

---

## 1. Supported Payment Methods

| Payment Method | Accepted Currencies | Processing Platform | Settlement Speed |
| :--- | :--- | :--- | :--- |
| **Credit / Debit Cards** (Visa, MC, Amex, Discover) | USD, EUR, GBP, CAD, AUD + 135 others | Stripe Payments | Instant |
| **Apple Pay & Google Pay** | Multi-currency (Device dependent) | Stripe Mobile Express | Instant |
| **SEPA Direct Debit** | EUR (€) | Stripe SEPA | 2 to 3 business days |
| **ACH Wire Transfers** | USD ($) | Enterprise Treasury | 1 to 2 business days |

---

## 2. Prorated Upgrades & Cancellations

If you upgrade or adjust seats mid-cycle, Stripe automatically calculates your prorated credit:

$$\\text{Proration Credit} = \\text{Base Cost} \\times \\left( \\frac{D_{\\text{remaining}}}{D_{\\text{total billing days}}} \\right)$$

* **Cancel Anytime**: Subscriptions can be canceled at any time with a single click in **Settings > Billing**.
* **Zero Lock-In**: Your account remains fully operational until the end of your prepaid period, then seamlessly switches to the Free BYOK plan with zero data loss.`
  }
];

async function updateArticles() {
  console.log(`Updating ${formattedArticles.length} articles in Supabase...`);

  for (const article of formattedArticles) {
    const { error } = await supabase
      .from("chatty_kb_articles")
      .update({
        title: article.title,
        subtitle: article.subtitle,
        content: article.content,
        updated_at: new Date().toISOString()
      })
      .eq("id", article.id);

    if (error) {
      console.error(`Error updating article "${article.title}" (${article.id}):`, error);
    } else {
      console.log(`✓ Successfully updated "${article.title}"`);
    }
  }

  console.log("Finished updating all articles!");
}

updateArticles().catch(console.error);
