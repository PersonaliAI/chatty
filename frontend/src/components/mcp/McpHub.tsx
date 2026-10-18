"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Check,
  Copy,
  Layers,
  HelpCircle,
  X,
  Sparkles,
  ArrowRight,
  Terminal,
} from "lucide-react";
import { AgentImgIcon, TerminalIcon } from "./AgentIcons";

export type AgentId =
  | "chatgpt"
  | "claude"
  | "claude-code"
  | "cursor"
  | "gemini"
  | "antigravity"
  | "codex"
  | "grok"
  | "windsurf"
  | "cli";

export interface AgentConfig {
  id: AgentId;
  name: string;
  badge?: string;
  headlineName: string;
  iconFile?: string;
  isCli?: boolean;
  connectorName: string;
  settingsPath: string;
  configFilename?: string;
  codeSnippet: string;
  steps: { title: string; desc: string }[];
  samplePrompts: string[];
}

const MCP_URL = "https://api.chatty.personaliai.com/mcp";

export const AGENTS: AgentConfig[] = [
  {
    id: "chatgpt",
    name: "ChatGPT",
    badge: "Plugin",
    headlineName: "ChatGPT",
    iconFile: "chatgpt",
    connectorName: "ChatGPT Connectors / Custom GPT Actions",
    settingsPath: "Settings → Connectors → Add Custom Action / MCP",
    codeSnippet: `https://api.chatty.personaliai.com/mcp`,
    steps: [
      {
        title: "Open ChatGPT connector settings",
        desc: "Go to your GPT or Assistant configuration and select 'Add Action / MCP Server'.",
      },
      {
        title: "Copy the Chatty MCP URL",
        desc: "Paste the hosted endpoint URL into the connector settings.",
      },
      {
        title: "Authenticate and start creating",
        desc: "Authorize with your Chatty account. If you are a new user, you can create a free account right on the login screen during OAuth.",
      },
    ],
    samplePrompts: [
      "List all my chatbots in Chatty and summarize their latest lead capture rates.",
      "Create a customer support bot named 'HelpDesk' with primary color #c67139.",
      "Crawl https://mywebsite.com and train my chatbot with all documentation pages.",
    ],
  },
  {
    id: "claude",
    name: "Claude",
    badge: "Desktop",
    headlineName: "Claude",
    iconFile: "claude",
    connectorName: "Claude Desktop Config",
    settingsPath: "claude_desktop_config.json",
    configFilename: "claude_desktop_config.json",
    codeSnippet: `{\n  "mcpServers": {\n    "chatty": {\n      "url": "https://api.chatty.personaliai.com/mcp"\n    }\n  }\n}`,
    steps: [
      {
        title: "Open Claude Desktop configuration",
        desc: "Open %APPDATA%/Claude/claude_desktop_config.json (Windows) or ~/Library/Application Support/Claude/claude_desktop_config.json (Mac).",
      },
      {
        title: "Paste the Chatty MCP server configuration",
        desc: "Add the Chatty server block to 'mcpServers' and restart Claude Desktop.",
      },
      {
        title: "Approve OAuth consent",
        desc: "Claude Desktop opens your browser to Chatty OAuth consent. Click 'Allow' (or sign up if you don't have an account yet).",
      },
    ],
    samplePrompts: [
      "Audit all 81 Chatty tools and tell me what my bot 'PriceShield' is missing.",
      "Analyze the widget styling contrast against WCAG AAA guidelines.",
      "Find all unanswered visitor questions and generate draft answers to add to knowledge.",
    ],
  },
  {
    id: "claude-code",
    name: "Claude Code",
    badge: "CLI",
    headlineName: "Claude Code",
    iconFile: "claude-code",
    connectorName: "Claude Code CLI",
    settingsPath: "Terminal",
    codeSnippet: `claude mcp add chatty https://api.chatty.personaliai.com/mcp`,
    steps: [
      {
        title: "Run the Claude Code MCP add command",
        desc: "Execute the single command in your terminal to register the remote MCP endpoint.",
      },
      {
        title: "Sign in when prompted",
        desc: "Follow the PKCE login link in your browser to authorize your Chatty account.",
      },
      {
        title: "Manage bots directly from CLI",
        desc: "Ask Claude Code to sync local markdown docs to your Chatty bot's knowledge base.",
      },
    ],
    samplePrompts: [
      "Upload my ./docs folder to my Chatty bot knowledge base.",
      "Test RAG retrieval for query 'pricing and refunds' against our bot.",
      "Generate the embed script tag for our production Next.js landing page.",
    ],
  },
  {
    id: "cursor",
    name: "Cursor",
    badge: "IDE",
    headlineName: "Cursor",
    iconFile: "cursor",
    connectorName: "Cursor MCP Settings",
    settingsPath: "Cursor Settings → Features → MCP → Add New MCP Server",
    codeSnippet: `Name: chatty\nType: sse\nURL: https://api.chatty.personaliai.com/mcp`,
    steps: [
      {
        title: "Open Cursor MCP Settings",
        desc: "Press Ctrl+Shift+J (or Cmd+Shift+J), go to Features → MCP, and click 'Add New MCP Server'.",
      },
      {
        title: "Add the Chatty remote endpoint",
        desc: "Set Name to 'chatty', Type to 'sse' (or remote), and URL to https://api.chatty.personaliai.com/mcp.",
      },
      {
        title: "Approve OAuth 2.0 PKCE consent",
        desc: "Cursor triggers automatic Dynamic Client Registration and opens your browser to sign in and authorize.",
      },
    ],
    samplePrompts: [
      "Check our website's chatbot styling and match it to our Tailwind CSS theme.",
      "Read unanswered questions from Chatty and generate FAQ component in React.",
      "Setup proactive campaign for visitors on the /pricing page.",
    ],
  },
  {
    id: "gemini",
    name: "Gemini",
    badge: "Google",
    headlineName: "Gemini",
    iconFile: "gemini",
    connectorName: "Gemini Extensions / Connector Settings",
    settingsPath: "Gemini Settings → Extensions → Custom MCP",
    codeSnippet: `https://api.chatty.personaliai.com/mcp`,
    steps: [
      {
        title: "Open Gemini connector settings",
        desc: "In Gemini, navigate to Extensions or custom tool configuration.",
      },
      {
        title: "Copy the Chatty MCP URL",
        desc: "Paste the URL https://api.chatty.personaliai.com/mcp into the connector input.",
      },
      {
        title: "Connect and start creating",
        desc: "After connecting, ask Gemini to inspect your bots, crawl sitemaps, or schedule meetings.",
      },
    ],
    samplePrompts: [
      "Crawl https://example.com/sitemap.xml and train my chatbot with all 20 pages.",
      "Show me sentiment trends and CSAT ratings from recent chat conversations.",
      "Create a meeting scheduling integration with Google Calendar.",
    ],
  },
  {
    id: "antigravity",
    name: "Antigravity",
    badge: "Agentic AI",
    headlineName: "Antigravity",
    iconFile: "antigravity",
    connectorName: "Antigravity Agent Settings",
    settingsPath: "~/.gemini/antigravity/mcp/chatty",
    codeSnippet: `{\n  "mcpServers": {\n    "chatty": {\n      "url": "https://api.chatty.personaliai.com/mcp"\n    }\n  }\n}`,
    steps: [
      {
        title: "Register Chatty in Antigravity MCP directory",
        desc: "Mount Chatty as a remote MCP server with full tools and schema definitions.",
      },
      {
        title: "Authenticate account",
        desc: "Use account-wide OAuth 2.0 token (chatty_oat_...) or bot-specific API key (chatty_sk_...).",
      },
      {
        title: "Autonomous bot engineering",
        desc: "Instruct Antigravity to iteratively audit knowledge gaps, fix RAG retrieval, and test widget CSS.",
      },
    ],
    samplePrompts: [
      "Perform a full health check on all chatbots and discover knowledge gaps.",
      "Synchronize all documentation articles with the chatbot knowledge base.",
      "Audit widget contrast for WCAG AA compliance and generate updated styling palette.",
    ],
  },
  {
    id: "codex",
    name: "Codex (CLI)",
    badge: "Marketplace",
    headlineName: "Codex",
    iconFile: "codex",
    connectorName: "Codex Marketplace & Plugin",
    settingsPath: "Codex → Settings → Plugins → Add marketplace",
    codeSnippet: `Source: https://github.com/PersonaliAI/chatty.git\nGit ref: main\nPath: plugins/chatty-integration`,
    steps: [
      {
        title: "Install from GitHub marketplace",
        desc: "Open Codex, go to Settings → Plugins → Add marketplace, and paste the Chatty repository values.",
      },
      {
        title: "Enable Chatty integration",
        desc: "Keep the Chatty plugin enabled and complete the browser OAuth sign-in on first call.",
      },
      {
        title: "Execute automated bot workflows",
        desc: "Ask Codex to build assistants, triage customer inquiries, or export GDPR visitor logs.",
      },
    ],
    samplePrompts: [
      "Create a booking-ready bot with lead capture form asking for full name, email, and company.",
      "Configure guardrails to block competitor mentions and prevent off-topic prompts.",
      "Export visitor logs and analyze weekly conversation volumes.",
    ],
  },
  {
    id: "grok",
    name: "Grok",
    badge: "xAI",
    headlineName: "Grok",
    iconFile: "grok",
    connectorName: "Grok Tool Integrations",
    settingsPath: "Grok Settings → External Tools → MCP",
    codeSnippet: `https://api.chatty.personaliai.com/mcp`,
    steps: [
      {
        title: "Open Grok tools settings",
        desc: "Select MCP tool integration in your Grok workspace settings.",
      },
      {
        title: "Provide Chatty MCP endpoint",
        desc: "Paste https://api.chatty.personaliai.com/mcp into the server URL field.",
      },
      {
        title: "Connect and start chatting",
        desc: "Authorize the connection. Grok can now query and manage your customer assistants live.",
      },
    ],
    samplePrompts: [
      "Show all active customer conversations and flag any needing human takeover.",
      "Send an agent message to visitor session on bot 'PriceShield'.",
      "Summarize customer feature requests from recent chat logs.",
    ],
  },
  {
    id: "windsurf",
    name: "Windsurf",
    badge: "Codeium",
    headlineName: "Windsurf",
    iconFile: "windsurf",
    connectorName: "Windsurf Cascade MCP Config",
    settingsPath: "~/.codeium/windsurf/mcp_config.json",
    codeSnippet: `{\n  "mcpServers": {\n    "chatty": {\n      "url": "https://api.chatty.personaliai.com/mcp"\n    }\n  }\n}`,
    steps: [
      {
        title: "Open Cascade MCP configuration",
        desc: "Access your Windsurf MCP configuration file from Cascade panel or settings.",
      },
      {
        title: "Paste Chatty server JSON",
        desc: "Insert the server URL block and reload Cascade.",
      },
      {
        title: "Approve PKCE authorization",
        desc: "Authorize once to unlock full account-wide bot management in Cascade chat.",
      },
    ],
    samplePrompts: [
      "Inspect my web app project and generate a matching Chatty widget configuration.",
      "Add our API documentation markdown files directly to our bot's knowledge base.",
      "Simulate a live conversation flow for lead qualification.",
    ],
  },
  {
    id: "cli",
    name: "Universal CLI",
    badge: "cURL / SDK",
    headlineName: "Any MCP Client",
    isCli: true,
    connectorName: "Generic MCP Client / cURL",
    settingsPath: "Environment or Command Line",
    codeSnippet: `curl -s https://api.chatty.personaliai.com/.well-known/oauth-authorization-server`,
    steps: [
      {
        title: "Auto-discovery endpoint",
        desc: "Query /.well-known/oauth-authorization-server for OAuth 2.0 PKCE and Dynamic Client Registration metadata.",
      },
      {
        title: "Dynamic Client Registration",
        desc: "POST /oauth/register with client_name and redirect_uris (supports native loopback per RFC 8252).",
      },
      {
        title: "Full Account Access",
        desc: "Mint account-wide chatty_oat_... access tokens to programmatically automate all 81 tools.",
      },
    ],
    samplePrompts: [
      "Programmatically sync CI/CD documentation builds to Chatty RAG knowledge base.",
      "Automate nightly WCAG accessibility and brand design audits.",
      "Batch-export captured leads into internal data warehouses.",
    ],
  },
];

const TOOL_CATEGORIES = [
  {
    name: "Bot Lifecycle & Personas",
    count: 8,
    tools: ["list_chatbots", "create_chatbot", "get_chatbot", "update_chatbot", "clone_chatbot", "delete_chatbot", "update_chatbot_instructions", "get_chatbot_instructions"],
    desc: "Create, inspect, clone, delete, and fine-tune system prompts, persona tone, and behavior guidelines across your account.",
  },
  {
    name: "Widget Customizer & Design Studio",
    count: 4,
    tools: ["customize_widget_styling", "analyze_widget_design", "preview_widget_html", "generate_embed_code"],
    desc: "Custom CSS palettes, launcher positions, WCAG contrast audits, and one-line embed script tags.",
  },
  {
    name: "Visual Flow Builder",
    count: 2,
    tools: ["get_conversation_flow", "update_conversation_flow"],
    desc: "Inspect and update multi-path visual decision trees, conditional branches, triggers, and action nodes.",
  },
  {
    name: "Proactive Marketing Campaigns",
    count: 5,
    tools: ["create_campaign", "list_campaigns", "update_campaign", "delete_campaign", "get_campaign_analytics"],
    desc: "Targeted outbound greetings, scroll/exit-intent triggers, lead magnets, and real-time impression analytics.",
  },
  {
    name: "Knowledge Base, RAG & Testing",
    count: 10,
    tools: ["add_chatbot_knowledge", "crawl_website_knowledge", "upload_knowledge_document", "sync_cloud_storage", "list_knowledge_sources", "delete_knowledge_source", "test_rag_retrieval", "get_knowledge_sync_status", "purge_bot_knowledge", "test_chatbot_reply"],
    desc: "Crawl sitemaps, upload PDFs, sync cloud drives, purge outdated vectors, test RAG chunks, and run simulated dry-run replies.",
  },
  {
    name: "Help Center & SEO Articles",
    count: 10,
    tools: ["list_help_center_categories", "create_help_center_category", "update_help_center_category", "delete_help_center_category", "list_help_center_articles", "get_help_center_article", "create_help_center_article", "update_help_center_article", "delete_help_center_article", "get_help_center_analytics"],
    desc: "Publish, update, and categorize public Help Center articles with auto-generated SEO, deep links, and deflection analytics.",
  },
  {
    name: "Inbox, Live Chat & Takeover",
    count: 6,
    tools: ["list_conversations", "get_conversation_transcript", "human_agent_takeover", "send_agent_message", "add_conversation_internal_note", "list_conversation_notes"],
    desc: "Monitor live visitor sessions, view transcripts, take over from AI, send real-time agent messages, and attach private team notes.",
  },
  {
    name: "Leads, Calendar & Identity",
    count: 8,
    tools: ["get_customer_identity_guide", "configure_lead_capture", "list_leads", "export_leads", "get_mailbox_logs", "export_visitor_data", "configure_calendar_integration", "list_meetings"],
    desc: "Automated qualification forms, CSV lead export, Google/Outlook calendar booking, visitor GDPR exports, and HMAC signed identity.",
  },
  {
    name: "Analytics & Self-Healing",
    count: 4,
    tools: ["analyze_chatbot", "discover_knowledge_gaps", "analyze_sentiment_trends", "get_feedback_and_csat"],
    desc: "Discover unanswered visitor questions to self-heal knowledge, inspect CSAT scores, sentiment curves, and conversation volume.",
  },
  {
    name: "E-Commerce & WooCommerce",
    count: 3,
    tools: ["get_woocommerce_store_status", "configure_woocommerce", "sync_woocommerce_products"],
    desc: "Connect WooCommerce REST APIs, sync catalog product feeds directly into bot knowledge, and query sync health.",
  },
  {
    name: "Multi-Channel & Escalation",
    count: 2,
    tools: ["configure_slack_escalation", "configure_whatsapp_integration"],
    desc: "Route urgent tickets and live takeover notifications to Slack channels or WhatsApp Business phone numbers.",
  },
  {
    name: "Security, API Keys & Team",
    count: 14,
    tools: ["configure_guardrails", "configure_byok", "manage_team_members", "configure_notifications", "create_webhook_subscription", "list_webhook_subscriptions", "delete_webhook_subscription", "configure_domain_allowlist", "get_audit_logs", "get_account_billing", "get_bot_performance_scorecard", "list_api_keys", "create_api_key", "revoke_api_key"],
    desc: "Bring your own OpenAI/Anthropic key, domain allowlists, RBAC team roles, webhooks, audit trails, and manage programmatic API keys.",
  },
  {
    name: "Voice & Real-Time LiveKit",
    count: 4,
    tools: ["get_voice_agent_config", "configure_voice_agent", "get_voice_agent_embed_code", "generate_claimable_demo_bot"],
    desc: "Ultra-low-latency bidirectional voice agents with WebRTC, custom voice avatars, audio visualizers, and instant demo builders.",
  },
  {
    name: "Multimodal & Screenshots",
    count: 1,
    tools: ["get_dashboard_screenshots"],
    desc: "Capture visual verification screenshots of your live bot widget, dashboard tabs, and conversation states for multimodal models.",
  },
];

export function McpHub({
  defaultAgent = "chatgpt",
  showCatalog = true,
}: {
  defaultAgent?: AgentId;
  showCatalog?: boolean;
}) {
  const [activeTab, setActiveTab] = useState<AgentId>(defaultAgent);
  const [modalOpen, setModalOpen] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedPromptIdx, setCopiedPromptIdx] = useState<number | null>(null);

  const activeAgent = AGENTS.find((a) => a.id === activeTab) ?? AGENTS[0];

  function copyText(text: string, type: "url" | "code" | number) {
    navigator.clipboard.writeText(text);
    if (type === "url") {
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } else if (type === "code") {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } else {
      setCopiedPromptIdx(type);
      setTimeout(() => setCopiedPromptIdx(null), 2000);
    }
  }

  return (
    <div className="w-full space-y-7">
      {/* Top Pill Navigation - Styled with Warm Editorial Colors */}
      <div className="flex items-center justify-center">
        <div
          className="flex flex-wrap items-center justify-center gap-1.5 p-1.5 rounded-full border shadow-sm max-w-full overflow-x-auto"
          style={{
            background: "color-mix(in srgb, var(--color-bg, #f5ead8) 85%, white 15%)",
            borderColor: "var(--color-divider, rgba(32, 30, 29, 0.16))",
          }}
        >
          {AGENTS.map((agent) => {
            const isSelected = activeTab === agent.id;
            return (
              <button
                key={agent.id}
                type="button"
                onClick={() => setActiveTab(agent.id)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs transition-all duration-150 cursor-pointer ${
                  isSelected
                    ? "font-bold shadow-sm"
                    : "hover:bg-black/5"
                }`}
                style={{
                  background: isSelected ? "var(--color-accent, #c67139)" : "transparent",
                  color: isSelected ? "#ffffff" : "var(--color-text, #201e1d)",
                }}
              >
                {agent.iconFile ? (
                  <AgentImgIcon name={agent.iconFile} alt={agent.name} className="size-4 rounded-sm" />
                ) : (
                  <TerminalIcon className="size-4" />
                )}
                <span>{agent.name}</span>
                {agent.badge && isSelected && (
                  <span
                    className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full font-bold"
                    style={{ background: "rgba(0,0,0,0.2)", color: "#ffffff" }}
                  >
                    {agent.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Showcase Hero - Color Matched Warm Sand / Editorial Palette */}
      <div
        className="rounded-[24px] sm:rounded-[32px] p-6 sm:p-10 border text-center shadow-sm relative overflow-hidden"
        style={{
          background: "color-mix(in srgb, var(--color-bg, #f5ead8) 70%, white 30%)",
          borderColor: "var(--color-divider, rgba(32, 30, 29, 0.16))",
        }}
      >
        <div className="relative z-10 max-w-3xl mx-auto space-y-5">
          <div
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-semibold border shadow-xs"
            style={{
              background: "#ffffff",
              borderColor: "var(--color-divider, rgba(32, 30, 29, 0.16))",
              color: "var(--color-accent-800, #643312)",
            }}
          >
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
            Model Context Protocol · 81 Live Production Tools · OAuth 2.0 PKCE
          </div>

          <h2
            className="text-[26px] sm:text-[34px] tracking-tight leading-tight"
            style={{ fontFamily: "var(--font-heading)", color: "var(--color-text, #201e1d)", fontWeight: 400 }}
          >
            Deploy & Manage Chatbots in{" "}
            <span style={{ color: "var(--color-accent, #c67139)", fontWeight: 600 }}>
              {activeAgent.headlineName}
            </span>{" "}
            with Chatty
          </h2>

          <p
            className="text-[14.5px] sm:text-[15.5px] leading-relaxed max-w-2xl mx-auto"
            style={{ color: "color-mix(in srgb, var(--color-text, #201e1d) 82%, transparent)" }}
          >
            Run your entire Chatty workspace directly inside {activeAgent.name}. Build bots, crawl websites for RAG
            knowledge, customize widget themes, audit WCAG contrast, and review captured leads right from your chat prompt.
          </p>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold border shadow-xs hover:shadow-sm transition cursor-pointer"
              style={{
                background: "#ffffff",
                borderColor: "var(--color-divider, rgba(32, 30, 29, 0.16))",
                color: "var(--color-text, #201e1d)",
              }}
            >
              <HelpCircle className="size-4" style={{ color: "var(--color-accent, #c67139)" }} />
              How to connect?
            </button>

            <Link
              href="/signup?next=/oauth/consent"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-medium shadow-sm hover:brightness-105 transition cursor-pointer"
              style={{
                fontFamily: "var(--font-heading)",
                background: "var(--color-accent, #c67139)",
                color: "var(--color-bg, #f5ead8)",
              }}
            >
              <span>Create Free Account</span>
              <ArrowRight className="size-4" />
            </Link>
          </div>

          {/* 1-Click Copy MCP URL Bar */}
          <div className="pt-2 max-w-xl mx-auto">
            <div
              className="flex items-center gap-2 p-1.5 pl-4 rounded-full border shadow-xs text-left"
              style={{
                background: "#ffffff",
                borderColor: "var(--color-divider, rgba(32, 30, 29, 0.16))",
              }}
            >
              <span
                className="text-[10px] uppercase font-bold tracking-wider shrink-0"
                style={{ color: "var(--color-accent, #c67139)" }}
              >
                MCP URL
              </span>
              <span className="font-mono text-xs sm:text-[13px] text-neutral-800 truncate flex-1">{MCP_URL}</span>
              <button
                type="button"
                onClick={() => copyText(MCP_URL, "url")}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold transition shrink-0 cursor-pointer text-white shadow-xs"
                style={{ background: "var(--color-accent, #c67139)" }}
              >
                {copiedUrl ? (
                  <>
                    <Check className="size-3.5" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="size-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
            <p
              className="text-[11.5px] mt-2"
              style={{ color: "color-mix(in srgb, var(--color-text, #201e1d) 70%, transparent)" }}
            >
              Supports automated Dynamic Client Registration (RFC 7591) and native loopback authentication (RFC 8252).
            </p>
          </div>
        </div>
      </div>

      {/* Integration Walkthrough Box */}
      <div
        className="rounded-[24px] p-6 sm:p-8 border shadow-xs space-y-6"
        style={{
          background: "color-mix(in srgb, var(--color-bg, #f5ead8) 80%, white 20%)",
          borderColor: "var(--color-divider, rgba(32, 30, 29, 0.16))",
        }}
      >
        <div
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-5"
          style={{ borderColor: "var(--color-divider, rgba(32, 30, 29, 0.16))" }}
        >
          <div className="flex items-center gap-3">
            <div
              className="size-10 rounded-xl flex items-center justify-center p-1.5 border shadow-xs shrink-0"
              style={{ background: "#ffffff", borderColor: "var(--color-divider, rgba(32, 30, 29, 0.16))" }}
            >
              {activeAgent.iconFile ? (
                <AgentImgIcon name={activeAgent.iconFile} alt={activeAgent.name} className="size-6" />
              ) : (
                <TerminalIcon className="size-6" />
              )}
            </div>
            <div>
              <h3
                className="text-base font-bold flex items-center gap-2"
                style={{ fontFamily: "var(--font-heading)", color: "var(--color-text, #201e1d)" }}
              >
                Connecting with {activeAgent.name}
              </h3>
              <p
                className="text-xs font-mono"
                style={{ color: "color-mix(in srgb, var(--color-text, #201e1d) 70%, transparent)" }}
              >
                Target config: {activeAgent.settingsPath}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className="text-xs"
              style={{ color: "color-mix(in srgb, var(--color-text, #201e1d) 70%, transparent)" }}
            >
              Auth mode:
            </span>
            <span
              className="text-xs font-semibold px-2.5 py-1 rounded-full border"
              style={{
                background: "var(--color-accent-100, #fff2eb)",
                color: "var(--color-accent-800, #643312)",
                borderColor: "var(--color-accent-200, #ffe1d0)",
              }}
            >
              OAuth 2.0 PKCE + Account Token
            </span>
          </div>
        </div>

        {/* 3 Step Guide */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {activeAgent.steps.map((step, idx) => (
            <div
              key={idx}
              className="p-5 rounded-2xl border shadow-xs flex flex-col justify-between space-y-3"
              style={{
                background: "#ffffff",
                borderColor: "var(--color-divider, rgba(32, 30, 29, 0.16))",
              }}
            >
              <div>
                <div
                  className="size-6 rounded-full text-xs font-bold flex items-center justify-center mb-2.5"
                  style={{
                    background: "var(--color-accent-100, #fff2eb)",
                    color: "var(--color-accent, #c67139)",
                    border: "1px solid var(--color-accent-200, #ffe1d0)",
                  }}
                >
                  {idx + 1}
                </div>
                <h4
                  className="text-sm font-semibold"
                  style={{ color: "var(--color-text, #201e1d)" }}
                >
                  {step.title}
                </h4>
                <p
                  className="text-xs mt-1.5 leading-relaxed"
                  style={{ color: "color-mix(in srgb, var(--color-text, #201e1d) 78%, transparent)" }}
                >
                  {step.desc}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Code Snippet Box - High Contrast Dark Espresso */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span
              className="text-xs font-semibold uppercase tracking-wider"
              style={{ color: "color-mix(in srgb, var(--color-text, #201e1d) 75%, transparent)" }}
            >
              {activeAgent.configFilename ? `Configuration (${activeAgent.configFilename})` : "Connection Command / Snippet"}
            </span>
            <button
              type="button"
              onClick={() => copyText(activeAgent.codeSnippet, "code")}
              className="flex items-center gap-1.5 text-xs font-semibold transition cursor-pointer"
              style={{ color: "var(--color-accent, #c67139)" }}
            >
              {copiedCode ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
              <span>{copiedCode ? "Copied" : "Copy snippet"}</span>
            </button>
          </div>
          <pre
            className="p-4 sm:p-5 rounded-[18px] text-[12px] sm:text-[13px] font-mono overflow-x-auto leading-relaxed shadow-sm"
            style={{
              background: "#1c1917",
              color: "#f9f4ed",
              border: "1px solid rgba(0,0,0,0.15)",
            }}
          >
            {activeAgent.codeSnippet}
          </pre>
        </div>

        {/* Starter Prompts for this Agent */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="size-4" style={{ color: "var(--color-accent, #c67139)" }} />
            <h4
              className="text-xs font-bold uppercase tracking-wider"
              style={{ color: "var(--color-text, #201e1d)" }}
            >
              Starter Prompts for {activeAgent.name}
            </h4>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {activeAgent.samplePrompts.map((prompt, pIdx) => (
              <button
                key={pIdx}
                type="button"
                onClick={() => copyText(prompt, pIdx)}
                className="text-left p-4 rounded-xl border transition flex flex-col justify-between group cursor-pointer shadow-xs"
                style={{
                  background: "#ffffff",
                  borderColor: "var(--color-divider, rgba(32, 30, 29, 0.16))",
                }}
              >
                <p
                  className="text-xs leading-relaxed font-medium"
                  style={{ color: "var(--color-text, #201e1d)" }}
                >
                  &quot;{prompt}&quot;
                </p>
                <div
                  className="mt-3 flex items-center justify-between text-[11px]"
                  style={{ color: "color-mix(in srgb, var(--color-text, #201e1d) 65%, transparent)" }}
                >
                  <span>Click to copy</span>
                  {copiedPromptIdx === pIdx ? (
                    <span className="text-emerald-600 font-bold flex items-center gap-1">
                      <Check className="size-3" /> Copied
                    </span>
                  ) : (
                    <Copy className="size-3 opacity-60 group-hover:opacity-100 transition" />
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tool Catalog Section */}
      {showCatalog && (
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <div>
              <h3
                className="text-lg font-bold flex items-center gap-2"
                style={{ fontFamily: "var(--font-heading)", color: "var(--color-text, #201e1d)" }}
              >
                <Layers className="size-4" style={{ color: "var(--color-accent, #c67139)" }} /> 81 Production MCP Tools
              </h3>
              <p
                className="text-xs mt-1"
                style={{ color: "color-mix(in srgb, var(--color-text, #201e1d) 75%, transparent)" }}
              >
                Every tool interacts directly with live PostgreSQL data. No mocks, no synthetic delays.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {TOOL_CATEGORIES.map((cat) => (
              <div
                key={cat.name}
                className="p-4 rounded-xl border shadow-xs space-y-2"
                style={{
                  background: "#ffffff",
                  borderColor: "var(--color-divider, rgba(32, 30, 29, 0.16))",
                }}
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold" style={{ color: "var(--color-text, #201e1d)" }}>
                    {cat.name}
                  </h4>
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full border"
                    style={{
                      background: "var(--color-accent-100, #fff2eb)",
                      color: "var(--color-accent-800, #643312)",
                      borderColor: "var(--color-accent-200, #ffe1d0)",
                    }}
                  >
                    {cat.count} tools
                  </span>
                </div>
                <p
                  className="text-[11px] leading-relaxed"
                  style={{ color: "color-mix(in srgb, var(--color-text, #201e1d) 78%, transparent)" }}
                >
                  {cat.desc}
                </p>
                <div className="pt-1.5 flex flex-wrap gap-1">
                  {cat.tools.slice(0, 3).map((t) => (
                    <code
                      key={t}
                      className="text-[9.5px] font-mono px-1.5 py-0.5 rounded border"
                      style={{
                        background: "color-mix(in srgb, var(--color-bg, #f5ead8) 60%, white 40%)",
                        borderColor: "var(--color-divider, rgba(32, 30, 29, 0.16))",
                        color: "var(--color-text, #201e1d)",
                      }}
                    >
                      {t}
                    </code>
                  ))}
                  {cat.tools.length > 3 && (
                    <span
                      className="text-[9.5px] font-mono px-1.5 py-0.5 rounded"
                      style={{ color: "color-mix(in srgb, var(--color-text, #201e1d) 65%, transparent)" }}
                    >
                      +{cat.tools.length - 3} more
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* "How to Connect" Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div
            className="relative w-full max-w-2xl rounded-2xl border p-6 sm:p-8 shadow-xl space-y-6 max-h-[90vh] overflow-y-auto"
            style={{
              background: "var(--color-bg, #f5ead8)",
              borderColor: "var(--color-divider, rgba(32, 30, 29, 0.2))",
              color: "var(--color-text, #201e1d)",
            }}
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold" style={{ fontFamily: "var(--font-heading)" }}>
                  Connect {activeAgent.name} to Chatty
                </h3>
                <p
                  className="text-xs mt-1"
                  style={{ color: "color-mix(in srgb, var(--color-text, #201e1d) 75%, transparent)" }}
                >
                  Follow these 3 simple steps to integrate Chatty into {activeAgent.name}.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-black/5 transition cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Inner Agent Tabs in Modal */}
            <div
              className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b"
              style={{ borderColor: "var(--color-divider, rgba(32, 30, 29, 0.16))" }}
            >
              {AGENTS.map((agent) => (
                <button
                  key={agent.id}
                  type="button"
                  onClick={() => setActiveTab(agent.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                    activeTab === agent.id
                      ? "shadow-xs"
                      : "hover:bg-black/5"
                  }`}
                  style={{
                    background: activeTab === agent.id ? "var(--color-accent, #c67139)" : "transparent",
                    color: activeTab === agent.id ? "#ffffff" : "var(--color-text, #201e1d)",
                  }}
                >
                  {agent.iconFile ? (
                    <AgentImgIcon name={agent.iconFile} alt={agent.name} className="size-3.5" />
                  ) : (
                    <TerminalIcon className="size-3.5" />
                  )}
                  <span>{agent.name}</span>
                </button>
              ))}
            </div>

            {/* Steps */}
            <div className="space-y-4">
              <div
                className="flex items-start gap-4 p-4 rounded-xl border shadow-xs"
                style={{ background: "#ffffff", borderColor: "var(--color-divider, rgba(32, 30, 29, 0.16))" }}
              >
                <div
                  className="size-7 rounded-full text-xs font-bold flex items-center justify-center shrink-0"
                  style={{
                    background: "var(--color-accent-100, #fff2eb)",
                    color: "var(--color-accent, #c67139)",
                    border: "1px solid var(--color-accent-200, #ffe1d0)",
                  }}
                >
                  1
                </div>
                <div className="flex-1 space-y-1">
                  <h4 className="text-sm font-semibold">Open {activeAgent.name} connector settings</h4>
                  <p
                    className="text-xs"
                    style={{ color: "color-mix(in srgb, var(--color-text, #201e1d) 78%, transparent)" }}
                  >
                    {activeAgent.steps[0].desc}
                  </p>
                  <p
                    className="text-[11px] font-mono pt-1"
                    style={{ color: "var(--color-accent-800, #643312)" }}
                  >
                    Location: {activeAgent.settingsPath}
                  </p>
                </div>
              </div>

              <div
                className="flex items-start gap-4 p-4 rounded-xl border shadow-xs"
                style={{ background: "#ffffff", borderColor: "var(--color-divider, rgba(32, 30, 29, 0.16))" }}
              >
                <div
                  className="size-7 rounded-full text-xs font-bold flex items-center justify-center shrink-0"
                  style={{
                    background: "var(--color-accent-100, #fff2eb)",
                    color: "var(--color-accent, #c67139)",
                    border: "1px solid var(--color-accent-200, #ffe1d0)",
                  }}
                >
                  2
                </div>
                <div className="flex-1 space-y-2">
                  <h4 className="text-sm font-semibold">Copy the Chatty MCP configuration</h4>
                  <p
                    className="text-xs"
                    style={{ color: "color-mix(in srgb, var(--color-text, #201e1d) 78%, transparent)" }}
                  >
                    {activeAgent.steps[1].desc}
                  </p>
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-neutral-900 border border-neutral-800">
                    <pre className="text-xs font-mono text-neutral-200 overflow-x-auto flex-1">{activeAgent.codeSnippet}</pre>
                    <button
                      type="button"
                      onClick={() => copyText(activeAgent.codeSnippet, "code")}
                      className="px-3 py-1.5 rounded-md text-xs font-semibold text-white shrink-0 cursor-pointer shadow-xs"
                      style={{ background: "var(--color-accent, #c67139)" }}
                    >
                      {copiedCode ? "Copied" : "Copy"}
                    </button>
                  </div>
                </div>
              </div>

              <div
                className="flex items-start gap-4 p-4 rounded-xl border shadow-xs"
                style={{ background: "#ffffff", borderColor: "var(--color-divider, rgba(32, 30, 29, 0.16))" }}
              >
                <div
                  className="size-7 rounded-full text-xs font-bold flex items-center justify-center shrink-0"
                  style={{
                    background: "var(--color-accent-100, #fff2eb)",
                    color: "var(--color-accent, #c67139)",
                    border: "1px solid var(--color-accent-200, #ffe1d0)",
                  }}
                >
                  3
                </div>
                <div className="flex-1 space-y-1.5">
                  <h4 className="text-sm font-semibold">Sign in or create account during OAuth consent</h4>
                  <p
                    className="text-xs"
                    style={{ color: "color-mix(in srgb, var(--color-text, #201e1d) 78%, transparent)" }}
                  >
                    {activeAgent.name} will trigger the browser authorization flow at{" "}
                    <code className="text-[11px] font-bold" style={{ color: "var(--color-accent, #c67139)" }}>
                      https://chatty.personaliai.com/oauth/consent
                    </code>.
                  </p>
                  <div
                    className="p-3 rounded-lg border text-xs leading-relaxed"
                    style={{
                      background: "var(--color-accent-100, #fff2eb)",
                      borderColor: "var(--color-accent-200, #ffe1d0)",
                      color: "var(--color-accent-800, #643312)",
                    }}
                  >
                    <b>No account yet?</b> You don&apos;t need an invite. Simply click &quot;Create account&quot; right on the
                    sign-in page to generate your free Chatty account on the fly.
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-6 py-2.5 rounded-full text-xs font-bold shadow-xs transition cursor-pointer"
                style={{
                  background: "var(--color-accent, #c67139)",
                  color: "#ffffff",
                }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
