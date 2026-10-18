"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Check,
  Copy,
  ExternalLink,
  Layers,
  Lock,
  Shield,
  HelpCircle,
  X,
  Sparkles,
  ArrowRight,
  Terminal,
  Code2,
  Cpu,
} from "lucide-react";
import {
  OpenAIIcon,
  ClaudeOfficialIcon,
  CursorIcon,
  GeminiIcon,
  GrokIcon,
  AntigravityIcon,
  CodexIcon,
  WindsurfIcon,
  TelegramIcon,
  TerminalIcon as TerminalSvgIcon,
} from "./AgentIcons";

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
  icon: React.ReactNode;
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
    badge: "Plugin / MCP",
    headlineName: "CHATGPT",
    icon: <OpenAIIcon className="size-4" />,
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
      "Create a customer support bot named 'HelpDesk' with primary color #2563eb.",
      "Crawl https://mywebsite.com and train my chatbot with all documentation pages.",
    ],
  },
  {
    id: "claude",
    name: "Claude",
    badge: "Desktop / Web",
    headlineName: "CLAUDE",
    icon: <ClaudeOfficialIcon className="size-4" />,
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
      "Audit all 55 Chatty tools and tell me what my bot 'PriceShield' is missing.",
      "Analyze the widget styling contrast against WCAG AAA guidelines.",
      "Find all unanswered visitor questions and generate draft answers to add to knowledge.",
    ],
  },
  {
    id: "claude-code",
    name: "Claude Code",
    badge: "CLI",
    headlineName: "CLAUDE CODE",
    icon: <TerminalSvgIcon className="size-4" />,
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
    headlineName: "CURSOR",
    icon: <CursorIcon className="size-4" />,
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
    headlineName: "GEMINI",
    icon: <GeminiIcon className="size-4" />,
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
    headlineName: "ANTIGRAVITY",
    icon: <AntigravityIcon className="size-4" />,
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
    badge: "OpenAI",
    headlineName: "CODEX",
    icon: <CodexIcon className="size-4" />,
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
    headlineName: "GROK",
    icon: <GrokIcon className="size-4" />,
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
    headlineName: "WINDSURF",
    icon: <WindsurfIcon className="size-4" />,
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
    headlineName: "ANY MCP CLIENT",
    icon: <Terminal className="size-4" />,
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
        desc: "Mint account-wide chatty_oat_... access tokens to programmatically automate all 55 tools.",
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
    name: "Bot Lifecycle",
    count: 6,
    tools: ["list_chatbots", "create_chatbot", "get_chatbot", "update_chatbot", "clone_chatbot", "delete_chatbot"],
    desc: "Create, list, get, update, clone, and delete chatbots across your account.",
  },
  {
    name: "Widget Customizer & Design Studio",
    count: 4,
    tools: ["customize_widget_styling", "analyze_widget_design", "preview_widget_html", "generate_embed_code"],
    desc: "Custom CSS palettes, launcher positions, WCAG contrast audits, and one-line embed script tags.",
  },
  {
    name: "Knowledge Base & RAG Crawling",
    count: 7,
    tools: ["crawl_website_knowledge", "add_chatbot_knowledge", "upload_knowledge_document", "sync_cloud_storage", "list_knowledge_sources", "delete_knowledge_source", "test_rag_retrieval"],
    desc: "Crawl full sitemaps or URLs, upload PDFs, sync cloud drives, and test semantic RAG retrieval.",
  },
  {
    name: "Help Center & Articles",
    count: 7,
    tools: ["list_help_center_articles", "get_help_center_article", "create_help_center_article", "update_help_center_article", "delete_help_center_article", "list_help_center_categories", "get_help_center_analytics"],
    desc: "Publish, update, and categorize public Help Center articles with auto-generated SEO and deep links.",
  },
  {
    name: "Inbox, Live Chat & Takeover",
    count: 6,
    tools: ["list_conversations", "get_conversation_transcript", "human_agent_takeover", "send_agent_message", "add_conversation_internal_note", "list_conversation_notes"],
    desc: "Monitor live visitor sessions, view transcripts, take over from AI, and send real-time agent messages.",
  },
  {
    name: "Leads, Calendar & Meetings",
    count: 7,
    tools: ["configure_lead_capture", "list_leads", "export_leads", "configure_calendar_integration", "list_meetings", "get_customer_identity_guide", "get_mailbox_logs"],
    desc: "Automated qualification forms, CSV lead export, Google/Outlook calendar booking, and HMAC signed identity.",
  },
  {
    name: "Analytics & Self-Healing",
    count: 4,
    tools: ["analyze_chatbot", "discover_knowledge_gaps", "analyze_sentiment_trends", "get_feedback_and_csat"],
    desc: "Discover unanswered visitor questions to self-heal knowledge, inspect CSAT scores and sentiment curves.",
  },
  {
    name: "Security, BYOK & Team",
    count: 10,
    tools: ["configure_guardrails", "configure_byok", "manage_team_members", "configure_domain_allowlist", "configure_notifications", "create_webhook_subscription", "list_webhook_subscriptions", "get_audit_logs", "export_visitor_data", "get_bot_performance_scorecard"],
    desc: "Bring your own OpenAI/Anthropic key, strict domain allowlists, RBAC team roles, webhooks, and GDPR export.",
  },
  {
    name: "Voice & Real-Time Agents",
    count: 4,
    tools: ["get_voice_agent_config", "configure_voice_agent", "get_voice_agent_embed_code", "generate_claimable_demo_bot"],
    desc: "Ultra-low-latency bidirectional voice agents with WebRTC, custom voice avatars, and demo builders.",
  },
];

export function McpHub({ defaultAgent = "chatgpt", showCatalog = true }: { defaultAgent?: AgentId; showCatalog?: boolean }) {
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
    <div className="w-full space-y-8">
      {/* Higgsfield-style Top Pill Navigation */}
      <div className="flex items-center justify-center">
        <div className="flex flex-wrap items-center justify-center gap-1.5 p-1.5 rounded-full bg-neutral-900/90 border border-neutral-800 shadow-xl backdrop-blur-md max-w-full overflow-x-auto">
          {AGENTS.map((agent) => {
            const isSelected = activeTab === agent.id;
            return (
              <button
                key={agent.id}
                type="button"
                onClick={() => setActiveTab(agent.id)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all duration-150 cursor-pointer ${
                  isSelected
                    ? "bg-white text-neutral-950 shadow-md font-bold"
                    : "text-neutral-400 hover:text-white hover:bg-neutral-800/60"
                }`}
              >
                <span className="shrink-0">{agent.icon}</span>
                <span>{agent.name}</span>
                {agent.badge && isSelected && (
                  <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-neutral-900 text-neutral-200">
                    {agent.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Hero Showcase Card */}
      <div className="relative rounded-3xl bg-neutral-950 border border-neutral-800 p-6 sm:p-10 text-center overflow-hidden shadow-2xl">
        {/* Ambient background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-48 bg-gradient-to-b from-[#f97316]/20 to-transparent blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-3xl mx-auto space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-neutral-900/80 border border-neutral-800 text-[11px] font-medium text-neutral-300">
            <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
            Model Context Protocol · 55 Live Production Tools · OAuth 2.0 PKCE
          </div>

          <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white uppercase leading-tight">
            DEPLOY & MANAGE CHATBOTS IN{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#f97316] via-amber-400 to-[#f97316]">
              {activeAgent.headlineName}
            </span>{" "}
            WITH CHATTY
          </h2>

          <p className="text-sm sm:text-base text-neutral-400 max-w-2xl mx-auto leading-relaxed">
            Run your entire Chatty workspace directly inside {activeAgent.name}. Build bots, crawl websites for RAG
            knowledge, customize widget themes, audit WCAG contrast, and review captured leads right from your chat prompt.
          </p>

          {/* Primary Action Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white text-neutral-950 text-sm font-bold shadow-lg hover:bg-neutral-100 transition cursor-pointer"
            >
              <HelpCircle className="size-4 text-[#f97316]" />
              How to connect?
            </button>

            <Link
              href="/signup?next=/oauth/consent"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-[#f97316] to-[#ea580c] text-white text-sm font-bold shadow-lg hover:brightness-110 transition cursor-pointer"
            >
              <span>Create Free Account</span>
              <ArrowRight className="size-4" />
            </Link>
          </div>

          {/* Quick Copy MCP URL Bar */}
          <div className="pt-2">
            <div className="inline-flex items-center gap-2 p-1.5 pl-4 rounded-full bg-neutral-900 border border-neutral-800 max-w-xl w-full text-left">
              <span className="text-[10px] uppercase font-bold tracking-wider text-neutral-500 shrink-0">MCP URL</span>
              <span className="font-mono text-xs text-neutral-200 truncate flex-1">{MCP_URL}</span>
              <button
                type="button"
                onClick={() => copyText(MCP_URL, "url")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-semibold transition shrink-0 cursor-pointer"
              >
                {copiedUrl ? (
                  <>
                    <Check className="size-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="size-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
            <p className="text-[11px] text-neutral-500 mt-2">
              Supports automated Dynamic Client Registration (RFC 7591) and native loopback authentication (RFC 8252).
            </p>
          </div>
        </div>
      </div>

      {/* Detailed Integration Tabs / Walkthrough Box */}
      <div className="rounded-2xl bg-neutral-900/60 border border-neutral-800 p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 pb-5">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-neutral-800 flex items-center justify-center text-white shrink-0">
              {activeAgent.icon}
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Connecting with {activeAgent.name}
              </h3>
              <p className="text-xs text-neutral-400">Target config: {activeAgent.settingsPath}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-neutral-400">Auth mode:</span>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#f97316]/10 text-[#f97316] border border-[#f97316]/20">
              OAuth 2.0 PKCE + Account Token
            </span>
          </div>
        </div>

        {/* 3 Step Guide (Higgsfield Style) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {activeAgent.steps.map((step, idx) => (
            <div
              key={idx}
              className="p-4 rounded-xl bg-neutral-950/80 border border-neutral-800/80 flex flex-col justify-between space-y-3"
            >
              <div>
                <div className="size-6 rounded-full bg-[#f97316]/20 text-[#f97316] text-xs font-bold flex items-center justify-center mb-2.5">
                  {idx + 1}
                </div>
                <h4 className="text-sm font-semibold text-white">{step.title}</h4>
                <p className="text-xs text-neutral-400 mt-1 leading-relaxed">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Code Snippet / Config Block */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
              {activeAgent.configFilename ? `Configuration (${activeAgent.configFilename})` : "Connection Command / Snippet"}
            </span>
            <button
              type="button"
              onClick={() => copyText(activeAgent.codeSnippet, "code")}
              className="flex items-center gap-1 text-xs text-neutral-400 hover:text-white transition cursor-pointer"
            >
              {copiedCode ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
              <span>{copiedCode ? "Copied" : "Copy configuration"}</span>
            </button>
          </div>
          <pre className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 text-neutral-200 text-xs font-mono overflow-x-auto leading-relaxed">
            {activeAgent.codeSnippet}
          </pre>
        </div>

        {/* Ready to use Prompts for this AI Agent */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="size-4 text-[#f97316]" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-300">
              Starter Prompts for {activeAgent.name}
            </h4>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {activeAgent.samplePrompts.map((prompt, pIdx) => (
              <button
                key={pIdx}
                type="button"
                onClick={() => copyText(prompt, pIdx)}
                className="text-left p-3.5 rounded-xl bg-neutral-950/60 hover:bg-neutral-800/60 border border-neutral-800 hover:border-neutral-700 transition flex flex-col justify-between group cursor-pointer"
              >
                <p className="text-xs text-neutral-300 leading-snug group-hover:text-white font-medium">&quot;{prompt}&quot;</p>
                <div className="mt-3 flex items-center justify-between text-[11px] text-neutral-500">
                  <span>Click to copy prompt</span>
                  {copiedPromptIdx === pIdx ? (
                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                      <Check className="size-3" /> Copied
                    </span>
                  ) : (
                    <Copy className="size-3 opacity-0 group-hover:opacity-100 transition" />
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tool Catalog Section */}
      {showCatalog && (
        <div className="space-y-4 pt-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Layers className="size-4 text-[#f97316]" /> 55 Production MCP Tools
              </h3>
              <p className="text-xs text-neutral-400 mt-1">
                Every tool interacts directly with live PostgreSQL data. No mocks, no synthetic delays.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {TOOL_CATEGORIES.map((cat) => (
              <div key={cat.name} className="p-4 rounded-xl bg-neutral-900/40 border border-neutral-800 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-white">{cat.name}</h4>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#f97316]/10 text-[#f97316] border border-[#f97316]/20">
                    {cat.count} tools
                  </span>
                </div>
                <p className="text-[11px] text-neutral-400 leading-relaxed">{cat.desc}</p>
                <div className="pt-2 flex flex-wrap gap-1">
                  {cat.tools.slice(0, 3).map((t) => (
                    <code key={t} className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-neutral-950 text-neutral-300">
                      {t}
                    </code>
                  ))}
                  {cat.tools.length > 3 && (
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400">
                      +{cat.tools.length - 3} more
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* "How to Connect" Modal (Screen 2 from Higgsfield) */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-2xl rounded-2xl bg-neutral-950 border border-neutral-800 p-6 sm:p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  Connect {activeAgent.name} to Chatty
                </h3>
                <p className="text-xs text-neutral-400 mt-1">
                  Follow these 3 simple steps to integrate Chatty into {activeAgent.name}.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Inner Agent Tabs in Modal */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-neutral-800">
              {AGENTS.map((agent) => (
                <button
                  key={agent.id}
                  type="button"
                  onClick={() => setActiveTab(agent.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                    activeTab === agent.id
                      ? "bg-neutral-800 text-white"
                      : "text-neutral-400 hover:text-white hover:bg-neutral-900"
                  }`}
                >
                  {agent.icon}
                  <span>{agent.name}</span>
                </button>
              ))}
            </div>

            {/* Step 1 */}
            <div className="space-y-4">
              <div className="flex items-start gap-4 p-4 rounded-xl bg-neutral-900/60 border border-neutral-800">
                <div className="size-7 rounded-full bg-[#f97316]/20 text-[#f97316] text-xs font-bold flex items-center justify-center shrink-0">
                  1
                </div>
                <div className="flex-1 space-y-1">
                  <h4 className="text-sm font-semibold text-white">Open {activeAgent.name} connector settings</h4>
                  <p className="text-xs text-neutral-400">{activeAgent.steps[0].desc}</p>
                  <p className="text-[11px] font-mono text-neutral-500 pt-1">Location: {activeAgent.settingsPath}</p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex items-start gap-4 p-4 rounded-xl bg-neutral-900/60 border border-neutral-800">
                <div className="size-7 rounded-full bg-[#f97316]/20 text-[#f97316] text-xs font-bold flex items-center justify-center shrink-0">
                  2
                </div>
                <div className="flex-1 space-y-2">
                  <h4 className="text-sm font-semibold text-white">Copy the Chatty MCP configuration</h4>
                  <p className="text-xs text-neutral-400">{activeAgent.steps[1].desc}</p>
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-neutral-950 border border-neutral-800">
                    <pre className="text-xs font-mono text-neutral-200 overflow-x-auto flex-1">{activeAgent.codeSnippet}</pre>
                    <button
                      type="button"
                      onClick={() => copyText(activeAgent.codeSnippet, "code")}
                      className="px-3 py-1.5 rounded-md bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-white shrink-0 cursor-pointer"
                    >
                      {copiedCode ? "Copied" : "Copy"}
                    </button>
                  </div>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex items-start gap-4 p-4 rounded-xl bg-neutral-900/60 border border-neutral-800">
                <div className="size-7 rounded-full bg-[#f97316]/20 text-[#f97316] text-xs font-bold flex items-center justify-center shrink-0">
                  3
                </div>
                <div className="flex-1 space-y-1.5">
                  <h4 className="text-sm font-semibold text-white">Sign in or create account during OAuth consent</h4>
                  <p className="text-xs text-neutral-400">
                    {activeAgent.name} will trigger the browser authorization flow at{" "}
                    <code className="text-[11px] text-[#f97316]">https://chatty.personaliai.com/oauth/consent</code>.
                  </p>
                  <div className="p-3 rounded-lg bg-[#f97316]/10 border border-[#f97316]/20 text-xs text-neutral-300 leading-relaxed">
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
                className="px-5 py-2.5 rounded-full bg-white text-neutral-950 text-xs font-bold hover:bg-neutral-100 transition cursor-pointer"
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
