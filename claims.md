# Chatty Claims & Benchmark Register

This register documents every public claim, capability number, and competitive metric published across `chatty.personaliai.com` and `github.com/PersonaliAI/chatty`.

## Principles
1. **Code-verified**: Every technical claim must correspond to implemented code in this repository.
2. **Sourced & Dated**: Every third-party competitor metric must cite public documentation and verification dates.
3. **Quarterly Re-verification**: Competitor pricing and capabilities must be re-checked every 90 days.

---

## 1. Internal Platform Claims

| Claim | Public Location | Source of Truth in Code | Verification Date | Status |
| :--- | :--- | :--- | :---: | :---: |
| **81 MCP Tools** | Homepage, Compare, README | `backend/app/routers/mcp.py` (FastMCP tool registrations) | October 2026 | Verified |
| **Deploy in under 5 minutes** | Homepage, Compare Hub | Docker Compose quickstart & Instant URL sandbox | October 2026 | Verified |
| **MIT License ($0 Software)** | Homepage, README | `LICENSE` file in repo root | October 2026 | Verified |
| **Zero Model Training** | Homepage, DPA | `backend/app/services/llm_client.py` (stateless API inference with data opt-out headers) | October 2026 | Verified |
| **Omnichannel (WhatsApp & Slack)** | Homepage, README | `backend/app/routers/webhooks.py`, `backend/app/omnichannel/` | October 2026 | Verified |
| **Live Human Takeover** | Homepage, Features | `backend/app/routers/chat.py` (live agent takeover endpoints) | October 2026 | Verified |
| **WebRTC Real-Time Voice** | Homepage, Compare | `backend/app/routers/voice.py`, `LiveKit` integration | October 2026 | Verified |
| **WooCommerce Catalog Sync** | Homepage, Guides | `backend/app/routers/woocommerce.py` | October 2026 | Verified |

---

## 2. Competitive Pricing & Capability Benchmarks

| Competitor | Documented Price | Chatty Savings | Sourced Reference | Last Checked |
| :--- | :--- | :--- | :--- | :---: |
| **Chatbase** | $40/mo (Hobby: 2,000 msgs)<br />$150/mo (Standard: 10,000 msgs) | 52% on Hobby ($19 vs $40)<br />34% on Standard ($99 vs $150) | Official Chatbase Pricing / ActivePieces 2026 Review | October 2026 |
| **Intercom (Fin AI)** | $39–$115/seat/mo + $0.99 per resolution | Flat pricing saves $400–$1,200+/mo at 1,000+ resolutions | Official Intercom Pricing Documentation | October 2026 |
| **Zendesk AI** | $55–$115/agent/mo + $50 AI agent add-on | Zero per-seat fee; unlimited agents on Standard | Official Zendesk Suite Pricing | October 2026 |
| **Crisp** | $95/month (Unlimited plan) | Chatty Hobby ($19/mo) offers lower entry threshold | Official Crisp Pricing Page | October 2026 |
| **Tidio (Lyro AI)** | Starter plan includes only 50 Lyro AI chats | Chatty Standard includes ~8,000 chats without add-on packs | Official Tidio Pricing | October 2026 |

---

## 3. Maintenance Cadence
- **Owner**: PersonaliAI Core Team
- **Next Re-Verification Date**: January 15, 2027
