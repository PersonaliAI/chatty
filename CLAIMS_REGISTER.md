# Chatty Claims Register & Source of Truth

> **Purpose**: This register documents every public architectural, capability, and pricing claim made across `chatty.personaliai.com`, `github.com/PersonaliAI/chatty`, and comparison pages. All team members, copywriters, and automated CI workflows must keep public messaging synchronized with this register.
> **Last Verified**: October 29, 2026  
> **Review Cadence**: Quarterly (Next Review: January 2027)

---

## 1. Core Architecture & Feature Claims

| Claim | Verified Value | Codebase Source of Truth | Verification Method |
| :--- | :--- | :--- | :--- |
| **Model Context Protocol (MCP) Tools** | **81 FastMCP Tools** across 13 functional categories | [`backend/app/routers/mcp.py`](backend/app/routers/mcp.py), [`frontend/src/components/mcp/McpHub.tsx`](frontend/src/components/mcp/McpHub.tsx) | Code count: 81 `@mcp.tool()` definitions |
| **Setup & Live Time** | **Under 5 minutes** | Automated crawler + `<script>` embed | Median time to crawl 5 pages and embed widget |
| **Self-Hosting Model** | **Free Open-Source Software (MIT)** | [`docker-compose.yml`](docker-compose.yml), [`LICENSE`](LICENSE) | User provides host, Supabase (or Docker Postgres/pgvector), and LLM API key |
| **Cloud Data Hosting** | **Private Chatty Cloud Infrastructure** | Supabase managed cluster + AES-256 encryption | Zero training on customer conversations guarantee |
| **Voice Agent Technology** | **Native WebRTC Bidirectional Calling** | LiveKit integration via [`backend/app/routers/voice.py`](backend/app/routers/voice.py) | Sub-second latency WebRTC voice agent |
| **Omnichannel Channels** | **7 Channels** (Web, WhatsApp, Slack, Messenger, IG, Telegram, SMS/Email) | [`backend/app/services/omnichannel_service.py`](backend/app/services/omnichannel_service.py) | Live webhook routing |
| **E-Commerce Integration** | **WooCommerce Native Bidirectional Sync** | [`backend/app/services/woocommerce_service.py`](backend/app/services/woocommerce_service.py) | Products, orders, and stock lookup |

---

## 2. Pricing & Capacity Conversion Mapping

| Plan Tier | Monthly Price | Monthly AI Credits | Conversation Equivalent | Storage & Media Quota |
| :--- | :--- | :--- | :--- | :--- |
| **Hobby** | $19 / mo ($15 billed yearly) | 1,000 credits | **≈ ~800 conversations** | 500 MB (250 products) |
| **Standard** | $99 / mo ($79 billed yearly) | 10,000 credits | **≈ ~8,000 conversations** | 2 GB (1,500 products) |
| **Business** | $399 / mo ($319 billed yearly) | 40,000 credits | **≈ ~35,000 conversations** | 10 GB (Unlimited products) |
| **Self-Host (MIT)** | **$0 forever** | Unlimited (BYOK) | **Unlimited** | Bound only by your database disk |

*Note: 1 AI credit covers 1 full customer question-and-answer cycle including semantic vector retrieval.*

---

## 3. Verified Competitor Benchmarks (October 2026 Audit)

| Competitor | Compared Tier | Competitor Price | Chatty Price | Cost Advantage | Feature Advantages |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Chatbase** | Hobby Tier | $40 / mo (2,000 msgs) | $19 / mo (~800 chats) | **52% lower cost** ($252/yr saved) | Chatty includes Lead CRM, Allowlist, and Visual Flows |
| **Chatbase** | Standard Tier | $150 / mo (10,000 msgs) | $99 / mo (~8,000 chats) | **34% lower cost** ($612/yr saved) | Chatty includes 81 MCP tools, WooCommerce sync, voice calling |
| **Intercom Fin** | Per-Resolution | $39–$99/seat + $0.99/res | $19–$99 flat | **Up to 80% savings** | No per-resolution variable tax; unlimited team seats |
| **Zendesk AI** | Suite + Advanced AI | $105–$165 / seat / mo | $19–$99 flat | **$1,000s/yr saved** | No per-seat penalty; live in under 5 minutes vs months |
| **Tidio Lyro AI** | Starter + Lyro Packs | $39+ / 50 conversations | $19–$99 flat | **No quota cliff** | No tight 50-conversation limit; full open-source access |
| **Gorgias** | Ticket-Based | $10–$900 / mo | $19–$99 flat | **Zero holiday overages** | No Q4/holiday ticket penalties on sales surges |

---

## 4. Privacy, Legal & Security Commitments

1. **GDPR DPA & Standard Contractual Clauses (SCCs)**: Available to all users at [`/dpa`](frontend/src/app/(legal)/dpa/page.tsx).
2. **Sub-processor Directory**: Fully transparent, public list of all third-party sub-processors maintained at [`/subprocessors`](frontend/src/app/(legal)/subprocessors/page.tsx).
3. **Zero AI Foundation Model Training**: Contractually guaranteed with LLM providers (Google, OpenAI, Anthropic) that no customer queries, documents, or conversation transcripts are used to train foundational AI models.
4. **Encryption**: AES-256 for all stored BYOK API keys and data at rest; TLS 1.3 for data in transit.
5. **Right to Erasure & Data Export**: Self-serve GDPR account and data export/deletion available directly in user settings.
