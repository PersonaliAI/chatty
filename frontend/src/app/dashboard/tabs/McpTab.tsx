"use client";

import { Cpu, Lock, Shield, Layers } from "lucide-react";
import { BACKEND_URL } from "@/lib/backend-client";

export function McpTab() {
  return (
    <div className="max-w-4xl mx-auto w-full py-6 px-4 space-y-6">
      <div>
        <h3 className="text-sm font-bold flex items-center gap-2">
          <Cpu className="size-4 text-[#f97316]" /> MCP Server
        </h3>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1.5 leading-relaxed max-w-xl">
          Connect Claude, ChatGPT, or any Model Context Protocol client to run this entire dashboard
          from a conversation - bots, flows, campaigns, voice, knowledge, inbox, leads, calendar,
          guardrails, team, billing, and GDPR export, all as callable tools. Authenticated with a
          standard OAuth 2.0 + PKCE flow, not a pasted API key.
        </p>
      </div>

      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="flex items-start gap-2">
            <Lock className="size-3.5 text-[#f97316] mt-0.5 shrink-0" />
            <p className="text-[11px] text-neutral-600 dark:text-neutral-400 leading-relaxed">
              OAuth 2.0 + PKCE - no shared secret to paste into a config file.
            </p>
          </div>
          <div className="flex items-start gap-2">
            <Shield className="size-3.5 text-[#f97316] mt-0.5 shrink-0" />
            <p className="text-[11px] text-neutral-600 dark:text-neutral-400 leading-relaxed">
              Scoped access: read / write / knowledge / voice / actions / admin.
            </p>
          </div>
          <div className="flex items-start gap-2">
            <Layers className="size-3.5 text-[#f97316] mt-0.5 shrink-0" />
            <p className="text-[11px] text-neutral-600 dark:text-neutral-400 leading-relaxed">
              55 tools, all reading and writing the same tables the dashboard does.
            </p>
          </div>
        </div>
        <p className="text-[10px] text-neutral-400">
          MCP endpoint: <code className="font-mono">{BACKEND_URL}/mcp</code> · Discovery:{" "}
          <code className="font-mono">{BACKEND_URL}/.well-known/oauth-authorization-server</code>
        </p>
        <pre className="bg-neutral-950 text-neutral-100 rounded-xl p-4 overflow-x-auto text-[11px] font-mono leading-relaxed">{`{
  "mcpServers": {
    "chatty": {
      "url": "${BACKEND_URL}/mcp"
    }
  }
}`}</pre>
        <p className="text-[10px] text-neutral-400">
          Add this to your MCP client&apos;s config (e.g. Claude Desktop&apos;s{" "}
          <code className="font-mono">claude_desktop_config.json</code>), or paste the URL into claude.ai&apos;s Connectors settings directly. The client opens a normal OAuth consent screen on first connect - approve it once per account.
        </p>
      </div>

      {/* Tool catalog */}
      <div>
        <h3 className="text-sm font-bold flex items-center gap-2">
          <Layers className="size-4 text-[#f97316] shrink-0" /> Tool catalog
        </h3>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1.5 leading-relaxed max-w-xl">
          Every tool the server exposes, grouped the same way the server source groups them.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[
          { name: "Bot Lifecycle", count: 6, desc: "Create, list, get, update, clone, and delete chatbots." },
          { name: "Customizer & Design Studio", count: 4, desc: "Widget styling, WCAG contrast audits, HTML preview, embed code." },
          { name: "Visual Flow Builder", count: 4, desc: "AI-generate, read, update, and simulate conversation flows." },
          { name: "Proactive Campaigns", count: 5, desc: "Create, list, update, delete campaigns, and read their analytics." },
          { name: "Voice Agent", count: 2, desc: "Configure the real-time voice agent and mint secure session tokens." },
          { name: "Knowledge Base & RAG", count: 7, desc: "Add text, crawl URLs, upload documents, sync Drive/OneDrive, test retrieval." },
          { name: "Inbox, Live Chat & Takeover", count: 6, desc: "List conversations, read transcripts, human takeover, agent replies and notes." },
          { name: "Leads, Calendar & Meetings", count: 7, desc: "Lead capture config, export, calendar booking, and meeting lists." },
          { name: "Analytics & Self-Healing", count: 4, desc: "Usage analytics, knowledge-gap discovery, sentiment, feedback/CSAT." },
          { name: "Settings, Guardrails, BYOK & Team", count: 10, desc: "Guardrails, bring-your-own-key, team RBAC, domain allowlist, notifications, webhooks, billing, audit logs, GDPR export." },
        ].map((cat) => (
          <div key={cat.name} className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-neutral-900 dark:text-white">{cat.name}</p>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1 leading-relaxed">{cat.desc}</p>
            </div>
            <span className="shrink-0 text-[10px] font-bold px-2 py-1 rounded-full bg-[#f97316]/10 text-[#f97316]">{cat.count}</span>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-neutral-400">
        Plus 2 live MCP resources (bot config/analytics/knowledge-gaps as read context) and pre-built prompt workflows (e.g. &quot;audit and optimize this bot&quot;, &quot;build a bot from a brand URL&quot;) a client can invoke directly.
      </p>
    </div>
  );
}
