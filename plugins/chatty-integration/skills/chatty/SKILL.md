---
name: chatty
description: Use the Chatty MCP integration to manage Chatty bots, knowledge bases, leads, inbox conversations, campaigns, voice agents, booking, analytics, team access, billing, and compliance from Codex.
---

# Chatty Integration

Use the bundled `chatty` MCP server for Chatty account work. The server is the hosted Chatty MCP endpoint at `https://api.chatty.personaliai.com/mcp`, so its tools are the source of truth for the currently connected Chatty account.

## When to use

- The user asks to manage Chatty bots, flows, campaigns, lead capture, inbox conversations, knowledge sources, analytics, voice agents, booking, guardrails, team access, billing, or GDPR/compliance exports.
- The user asks to audit or optimize a Chatty bot using live account data.
- The user asks to create, update, inspect, or troubleshoot Chatty resources without manually clicking through the dashboard.

## Operating rules

- Prefer read-only inspection before write operations when the user's exact target is not obvious.
- For account-changing actions, operate only on the Chatty resources named by the user or unambiguously implied by prior context.
- Treat the MCP server responses as authoritative for available tools, IDs, permissions, and current account state.
- Do not invent bot IDs, campaign IDs, integration IDs, or billing state.
