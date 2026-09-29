# 📦 Chatty Production Bot Templates

Pre-configured, domain-tuned starter kits for Chatty chatbots. Each template includes a specialized system prompt with safety guardrails, starter knowledge base articles, recommended UI palette tokens, and sample test prompts.

Inspired by top open-source projects, these templates allow businesses and developers to launch a production-grade AI assistant in under 60 seconds without starting from a blank page.

---

## 🗂️ Available Templates

| Template | Industry | Key Features | Target Channels |
|---|---|---|---|
| [`ecommerce-store.json`](ecommerce-store.json) | **Retail & E-Commerce** | Sizing advice, return policy workflows, order tracking, cart recovery discounts | Web Widget, WhatsApp |
| [`healthcare-clinic.json`](healthcare-clinic.json) | **Healthcare & Dental** | Medical emergency disclaimers, insurance coverage FAQ, appointment booking | Web Widget, Voice Agent |
| [`real-estate-agency.json`](real-estate-agency.json) | **Real Estate** | Buyer budget & timeline qualification, neighborhood guides, tour scheduling | Web Widget, WhatsApp, Voice |
| [`restaurant-hospitality.json`](restaurant-hospitality.json) | **Hospitality & Dining** | Table reservations, dietary/allergy safety, private dining, wine corkage | Web Widget, WhatsApp, Voice |
| [`saas-customer-support.json`](saas-customer-support.json) | **B2B SaaS & DevTools** | API troubleshooting, HMAC webhook verification, rate limits, SLA escalation | Web Widget, Slack, Email |

---

## 🚀 How to Import a Template

### Method 1: Using the Import CLI Script

Run the provided helper script pointing to your running Chatty instance:

```bash
# Print template preview without applying:
python scripts/import_template.py --template templates/ecommerce-store.json --dry-run

# Import into your Chatty instance:
export CHATTY_BACKEND_URL="http://localhost:8000"
export CHATTY_API_KEY="your-jwt-or-api-key"
python scripts/import_template.py --template templates/ecommerce-store.json
```

### Method 2: Import via MCP (Claude Desktop, Cursor, Codex)

Ask your AI coding assistant:

> *"Import the `templates/saas-customer-support.json` template to create a new developer support chatbot for my workspace."*

Your MCP client will read the template JSON and invoke `create_chatbot` and `add_chatbot_knowledge` automatically.

---

## 📐 Template Schema Specification

Every template adheres to this standardized structure:

```json
{
  "template_version": "1.0",
  "metadata": {
    "name": "Template Title",
    "category": "Industry Category",
    "description": "Overview of capabilities and target use cases",
    "target_channels": ["web_widget", "voice_agent", "whatsapp", "slack"]
  },
  "bot_config": {
    "name": "Default Bot Name",
    "welcome_message": "Friendly greeting message",
    "selected_model": "gemini-2.5-flash",
    "primary_color": "#HexColor",
    "response_language": "en",
    "strict_mode": true,
    "lead_capture_enabled": true,
    "system_instructions": "Detailed prompt with guidelines and boundary constraints"
  },
  "knowledge_base": [
    {
      "name": "Knowledge Document Title",
      "content": "Full markdown or plaintext knowledge content to embed"
    }
  ],
  "sample_prompts": [
    "Example test question 1",
    "Example test question 2"
  ]
}
```
