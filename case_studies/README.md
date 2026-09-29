# 🏢 Chatty Case Studies & Verified Scorecards

Independent operational assurance case studies evaluating real-world Chatty deployments across retail e-commerce, healthcare scheduling, B2B SaaS technical support, and real estate lead generation.

Each case study includes a full, citable **`SCORECARD.md`** evaluating the deployment against our standardized 5-pillar operational framework (Conversion, Engagement, Accuracy, Reliability, Satisfaction) along with verified before-and-after business metrics.

---

## 📑 Published Case Studies

| Case Study | Industry | Deployed Features | Key Results | Scorecard Grade |
|---|---|---|---|:---:|
| [**Urban Threads Apparel**](urban-threads-ecommerce/SCORECARD.md) | E-Commerce Retail | Shadow DOM Widget, WooCommerce Sync, Exit-Intent Campaigns | **3.4×** lead capture, **88.2%** autonomous deflection, $42k recovered pipeline | **A-** (89.1/100) |
| [**Apex Dental Care**](apex-health-dental/SCORECARD.md) | Healthcare & Dental | Google Calendar Round-Robin, Patient Triage, LiveKit Voice | **92.4%** automated booking rate, **zero** double-bookings, 4.8/5 CSAT | **A** (91.8/100) |
| [**CloudFlow Analytics**](cloudflow-saas-support/SCORECARD.md) | B2B SaaS & DevTools | RAG Knowledge Base, Slack Omnichannel, SLA Countdown | p95 first response **1.4s**, **78%** ticket deflection, 99.98% uptime | **A** (92.4/100) |
| [**Metro Realty Group**](metro-realty-group/SCORECARD.md) | Real Estate & Brokerage | Virtual Tour Booking, WhatsApp Cloud API, Lead Scoring | **24/7** instant lead qualification, **2.8×** showing volume | **B+** (86.7/100) |

---

## 🔬 Auditing Methodology

Every case study in this directory is generated using the standardized **Chatty Performance Auditor CLI** (`scripts/audit_bot.py`) analyzing a minimum 30-day operating window of verified production telemetry:
- **Conversion (25%)**: Real visitor sessions $\to$ verified email/phone leads or scheduled meetings.
- **Engagement & Deflection (20%)**: Ticket deflection without human takeover or negative escalation.
- **Accuracy & Grounding (25%)**: Document RAG retrieval precision and tool-calling execution integrity.
- **Reliability & Latency (15%)**: Real-world p95 latency and error rate.
- **Customer Satisfaction (15%)**: Post-chat 1–5 star ratings submitted directly by end users.

For more details on grading rubrics and calculation formulas, read [docs/SCORECARD.md](../docs/SCORECARD.md).
