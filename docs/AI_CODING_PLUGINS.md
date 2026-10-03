# 🤖 AI Coding Tools & Plugin Marketplace Integration

Connect your favorite AI coding assistant (Claude Code, Cursor, Claude Desktop, Windsurf, Codex) directly to Chatty's **55-tool Model Context Protocol (MCP) server**.

Manage chatbots, generate visual flows, audit performance, and review lead analytics directly from your conversational coding workflow without switching context.

---

## ⚡ 1. Claude Code CLI Integration

Chatty publishes an official Claude Code plugin manifest under `.claude-plugin/marketplace.json`.

### Add Marketplace:
Inside your Claude Code session, register Chatty:

```bash
/plugin marketplace add PersonaliAI/chatty
```

Or install directly:
```bash
claude plugin install chatty
```

Once installed, ask Claude:
> *"Audit my Chatty bot `8f9024b1-e25c-4122-8d77-a82a6fce921b` and show the 5-pillar scorecard."*  
> *"Create a customer support flow for my Chatty bot and open it in Flow Builder."*

---

## 💻 2. Cursor IDE Integration

Cursor supports both native MCP servers and repository rules.

### Step 1: Configure MCP in Cursor
1. Open Cursor **Settings** (`Cmd + ,` or `Ctrl + ,`).
2. Go to **Features → MCP Servers → Add New MCP Server**.
3. Fill in:
   - **Name:** `chatty`
   - **Type:** `sse` (or `http`)
   - **Server URL:** `https://your-backend-domain/mcp` (or `http://localhost:8000/mcp`)
4. Authorize via the OAuth consent popup on first connect.

### Step 2: Cursor Rules Active
This repository includes:
- [`.cursor/rules/chatty.mdc`](../.cursor/rules/chatty.mdc): Automatic system guidance on Chatty architecture, tools, and security.
- [`.cursorrules`](../.cursorrules): Universal editor prompt rules.

Ask Cursor's composer (`Ctrl + I` or `Cmd + I`):
> *"Use `@chatty` to generate a 4-step lead qualification flow and run dry-run validation."*

---

## 🖥️ 3. Claude Desktop Integration

Edit your Claude Desktop configuration file:
- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

Add the Chatty MCP server:

```json
{
  "mcpServers": {
    "chatty": {
      "url": "https://api.chatty.personaliai.com/mcp"
    }
  }
}
```

Restart Claude Desktop. A browser tab will open asking you to authorize your Chatty account. Once approved, all 55 tools are live.

---

## 🏄 4. Windsurf / Cascade Integration

In `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "chatty": {
      "serverUrl": "https://api.chatty.personaliai.com/mcp"
    }
  }
}
```

Cascade can now inspect live chatbot configurations, test RAG semantic search, and audit conversion rates during editor sessions.

---

## 📦 5. OpenAI Codex Integration

Chatty includes a complete Codex connector package in [`plugins/chatty-integration`](../plugins/chatty-integration):
- `.codex-plugin/plugin.json`: Official Codex manifest with UI branding.
- `skills/chatty/SKILL.md`: Autonomous agent operating rules.
- `.agents/plugins/marketplace.json`: Local discovery catalog.

---

## 🛠️ Summary of Available AI Capabilities

| Category | Available AI Tools | Example Prompt |
|---|---|---|
| **Auditing & Health** | `get_bot_performance_scorecard`, `analyze_widget_design`, `discover_knowledge_gaps` | *"Give my bot an A-F audit and identify unanswered user queries."* |
| **Bot Management** | `create_chatbot`, `update_chatbot`, `configure_guardrails`, `configure_byok` | *"Set up strict RAG guardrails and enable Gemini 2.5 Flash."* |
| **Visual Flows** | `generate_flow_with_ai`, `optimize_flow_draft`, `dry_run_flow` | *"Generate a returns workflow and dry-run with a sample user."* |
| **Knowledge Base** | `add_chatbot_knowledge`, `test_rag_retrieval`, `trigger_website_crawl` | *"Index docs.mycompany.com and test retrieval for 'refund policy'."* |
| **CRM & Inbox** | `list_inbox_threads`, `send_inbox_reply`, `list_leads`, `export_leads_csv` | *"Show me all unhandled leads from the past 7 days."* |
