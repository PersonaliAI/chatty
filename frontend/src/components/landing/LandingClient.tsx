"use client";

import React, { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Bot,
  Calendar,
  CalendarCheck,
  Check,
  ChevronDown,
  ChevronRight,
  Clock3,
  Code2,
  Copy,
  Cpu,
  Database,
  ExternalLink,
  FileText,
  Globe2,
  Headphones,
  HelpCircle,
  Inbox,
  Layers,
  LayoutGrid,
  Lock,
  Menu,
  MessageCircle,
  MessageSquareCode,
  MousePointerClick,
  Play,
  PlugZap,
  RefreshCw,
  Search,
  Server,
  Shield,
  ShieldCheck,
  Sliders,
  Sparkles,
  Terminal,
  TrendingUp,
  UserCheck,
  Users,
  Workflow,
  X,
  Zap,
} from "lucide-react";

// ==========================================
// STATIC DATA & CONTENT
// ==========================================

const MEGA_MENU_PRODUCTS = [
  {
    title: "Autonomous Agents",
    badge: "Core",
    items: [
      {
        icon: Database,
        title: "Grounded Knowledge RAG",
        desc: "Strict cosine thresholding with zero hallucinations and verified source citations.",
        href: "#capabilities",
        iconColor: "text-orange-500 bg-orange-50 border-orange-100",
      },
      {
        icon: CalendarCheck,
        title: "In-Chat Calendar Booking",
        desc: "Google Calendar & Outlook slot picker embedded directly into live conversations.",
        href: "#playground",
        iconColor: "text-blue-500 bg-blue-50 border-blue-100",
      },
      {
        icon: MousePointerClick,
        title: "Intent Lead Capture",
        desc: "Naturally collect verified email, company, and purchase intent without clunky forms.",
        href: "#capabilities",
        iconColor: "text-emerald-500 bg-emerald-50 border-emerald-100",
      },
      {
        icon: Inbox,
        title: "Omnichannel Team Inbox",
        desc: "Live visitor monitoring, sentiment alerts, and 1-click human takeover lock.",
        href: "#capabilities",
        iconColor: "text-purple-500 bg-purple-50 border-purple-100",
      },
    ],
  },
  {
    title: "Developer Platform",
    badge: "Protocol",
    items: [
      {
        icon: PlugZap,
        title: "Model Context Protocol (MCP)",
        desc: "Native MCP server for Claude Desktop, Cursor, and autonomous agent fleets.",
        href: "https://docs.chatty.personaliai.com",
        iconColor: "text-amber-500 bg-amber-50 border-amber-100",
      },
      {
        icon: Cpu,
        title: "Zero-Markup BYOK Engine",
        desc: "Bring your own OpenAI, Anthropic, Gemini, or OpenRouter keys with zero fee.",
        href: "#pricing",
        iconColor: "text-rose-500 bg-rose-50 border-rose-100",
      },
      {
        icon: Terminal,
        title: "Management API & Webhooks",
        desc: "Full programmatic control over bots, training data, leads, and transcripts.",
        href: "https://docs.chatty.personaliai.com",
        iconColor: "text-indigo-500 bg-indigo-50 border-indigo-100",
      },
      {
        icon: Headphones,
        title: "Voice AI Assistant Demo",
        desc: "Experience ultra-low-latency real-time voice conversations with Chatty.",
        href: "/voice-demo",
        iconColor: "text-teal-500 bg-teal-50 border-teal-100",
      },
    ],
  },
];

const MEGA_MENU_RESOURCES = [
  {
    title: "Documentation",
    desc: "Complete guides, embed instructions, and architecture references.",
    href: "https://docs.chatty.personaliai.com",
    external: true,
  },
  {
    title: "Affiliates Program",
    desc: "Earn recurring commissions by referring high-growth businesses.",
    href: "/affiliates",
    external: false,
  },
  {
    title: "Support & Help Center",
    desc: "Get fast answers or contact our engineering and support team.",
    href: "/support",
    external: false,
  },
  {
    title: "Voice AI Playground",
    desc: "Test bidirectional voice agents with LiveKit and Cartesia models.",
    href: "/voice-demo",
    external: false,
  },
  {
    title: "Zoom App Integration",
    desc: "Connect Chatty directly to your Zoom team workspaces and meetings.",
    href: "/zoom",
    external: false,
  },
];

const PLAYGROUND_TABS = [
  {
    id: "booking",
    label: "Demo Calendar Booking",
    icon: CalendarCheck,
    prompt: "I'd like to book a 15-minute live demo with your solutions team this week.",
    response:
      "I'd love to set that up! You can pick an open slot with our engineering team directly on my calendar below. Timezones are automatically detected.",
    hasCalendar: true,
    citations: ["personaliai.com/team-calendar", "docs.chatty.personaliai.com/booking"],
  },
  {
    id: "rag",
    label: "Grounded Knowledge RAG",
    icon: Database,
    prompt: "How does Chatty ensure answers are grounded without AI hallucinations?",
    response:
      "Chatty uses pgvector cosine similarity cutoff (0.78 threshold). If visitor questions cannot be matched to verified chunks from your crawled sitemap or uploaded docs, the assistant admits uncertainty and routes to a human instead of hallucinating.",
    hasCalendar: false,
    citations: ["docs.chatty.personaliai.com/rag-pipeline", "personaliai.com/security"],
  },
  {
    id: "compare",
    label: "Compare Intercom & Crisp",
    icon: LayoutGrid,
    prompt: "How does Chatty compare to Intercom Fin and Crisp on pricing and AI markup?",
    response:
      "Unlike Intercom Fin which adds a $0.99 tax on every single AI resolution plus per-seat pricing, Chatty offers a Free BYOK tier ($0) with unlimited tokens, and flat plans starting at $19/mo with full calendar booking, lead capture, and MCP tooling included.",
    hasCalendar: false,
    citations: ["personaliai.com/pricing", "docs.chatty.personaliai.com/comparison"],
  },
  {
    id: "byok",
    label: "Zero-Markup BYOK",
    icon: Cpu,
    prompt: "Can I bring my own OpenAI or Anthropic API key without platform fees?",
    response:
      "Yes. Under our Free BYOK tier, you paste your provider key into the dashboard. We stream tokens directly with 0% platform markup, giving you complete cost control and access to your provider volume discounts.",
    hasCalendar: false,
    citations: ["docs.chatty.personaliai.com/providers/byok", "github.com/Damayantha/chatty"],
  },
];

const CODE_EXAMPLES = [
  {
    lang: "HTML Embed",
    title: "1-Line Website Script",
    code: `<!-- Add Chatty to your website <head> -->
<script
  src="https://chatty.personaliai.com/widget.js"
  data-chatty-bot="bot_982b1fa4e8"
  data-primary-color="#f95721"
  defer>
</script>`,
    response: {
      status: "initialized",
      bot_id: "bot_982b1fa4e8",
      grounding_threshold: 0.78,
      calendar_sync: "Google Calendar (Active)",
      latency: "182ms",
    },
  },
  {
    lang: "Python SDK",
    title: "Query Trained Knowledge",
    code: `from chatty import ChattyClient

client = ChattyClient(api_key="cty_live_92018a...")

# Query grounded knowledge base
response = client.chat.create(
    bot_id="bot_982b1fa4e8",
    message="What is your enterprise SLA policy?",
    enable_citations=True
)

print(response.answer)
print(response.citations)`,
    response: {
      answer: "We guarantee 99.98% uptime with 15-minute response SLA.",
      grounding_score: 0.992,
      citations: ["https://personaliai.com/docs/sla#L14"],
    },
  },
  {
    lang: "Node.js",
    title: "Book Meeting Programmatically",
    code: `import { Chatty } from "@personaliai/chatty";

const chatty = new Chatty({ apiKey: process.env.CHATTY_API_KEY });

// Retrieve available slots and book
const booking = await chatty.bookings.confirm({
  botId: "bot_982b1fa4e8",
  visitorEmail: "alex@acme.corp",
  slotTime: "2026-09-15T14:30:00Z",
  timezone: "America/New_York"
});`,
    response: {
      booking_id: "bk_77189a",
      status: "confirmed",
      calendar_event: "Google Meet link generated",
      attendees: ["alex@acme.corp", "team@personaliai.com"],
    },
  },
  {
    lang: "MCP Server",
    title: "Claude & Cursor Protocol Config",
    code: `{
  "mcpServers": {
    "chatty": {
      "command": "npx",
      "args": ["-y", "@personaliai/chatty-mcp@latest"],
      "env": {
        "CHATTY_API_KEY": "cty_live_92018a..."
      }
    }
  }
}`,
    response: {
      protocol_version: "2024-11-05",
      tools_registered: 18,
      capabilities: ["query_bot", "book_slot", "triage_leads", "update_sources"],
    },
  },
];

const AGENT_NODES = [
  {
    id: "rag",
    name: "Knowledge RAG Agent",
    tag: "pgvector · Cosine 0.78",
    status: "Active",
    desc: "Retrieves verified chunks from crawled sitemaps, docs, and PDFs with strict anti-hallucination guardrails.",
    metric: "99.4% Grounding Accuracy",
    payload: {
      source: "docs.personaliai.com/api",
      similarity_score: 0.892,
      latency_ms: 184,
      hallucination_guard: "Passed (100%)",
    },
  },
  {
    id: "booking",
    name: "Calendar Booking Agent",
    tag: "Google · Outlook Sync",
    status: "Active",
    desc: "Checks real-time host availability, handles timezone conversion, and confirms calendar invites.",
    metric: "0% Drop-off Rate",
    payload: {
      integration: "Google Calendar v3",
      timezone: "America/New_York",
      available_slots: ["10:00 AM", "02:30 PM", "04:00 PM"],
      confirmation: "Auto-invite dispatched",
    },
  },
  {
    id: "leads",
    name: "Lead Qualification Agent",
    tag: "Progressive Profiling",
    status: "Active",
    desc: "Evaluates conversational intent, extracts company domain, and routes qualified buyers to CRM.",
    metric: "3.4x Higher Conversion",
    payload: {
      intent_tier: "High (Enterprise Evaluation)",
      extracted_fields: { email: "alex@acme.corp", company: "Acme Corp", seats: 45 },
      webhook_status: "Dispatched to Hubspot",
    },
  },
  {
    id: "sentinel",
    name: "Human Takeover Sentinel",
    tag: "Real-Time Sentiment",
    status: "Monitoring",
    desc: "Scans conversation sentiment in real time. Dispatches instant Slack alerts when human judgment is needed.",
    metric: "< 2s Notification Speed",
    payload: {
      sentiment_score: "Frustrated (-0.72)",
      trigger: "Billing discrepancy detected",
      action: "AI reply paused · Human assigned",
    },
  },
  {
    id: "mcp",
    name: "MCP Fleet Operator",
    tag: "Claude · Cursor Protocol",
    status: "Ready",
    desc: "Enables external AI agents to query analytics, train new sources, and trigger customer broadcasts.",
    metric: "18 Native Tools",
    payload: {
      protocol: "Model Context Protocol v1.0",
      active_clients: ["Cursor", "Claude Desktop"],
      permissions: "Bots:ReadWrite, Leads:Read",
    },
  },
];

const COMPARISONS = [
  {
    feature: "Open-Source & Self-Hostable",
    chatty: "Full GitHub Repo & Docker",
    intercom: "Closed Proprietary",
    zendesk: "Closed Proprietary",
    crisp: "Closed Proprietary",
  },
  {
    feature: "Zero-Markup BYOK (OpenAI/Anthropic)",
    chatty: "Included Free Forever",
    intercom: "Not Supported",
    zendesk: "Not Supported",
    crisp: "Not Supported",
  },
  {
    feature: "Native In-Chat Calendar Booking",
    chatty: "Google & Outlook Direct",
    intercom: "Paid Add-on App",
    zendesk: "Third-party redirect",
    crisp: "Third-party redirect",
  },
  {
    feature: "Model Context Protocol (MCP) Server",
    chatty: "Official Native Tools",
    intercom: "No MCP support",
    zendesk: "No MCP support",
    crisp: "No MCP support",
  },
  {
    feature: "Grounded Anti-Hallucination Citations",
    chatty: "Strict Cosine + Direct URL",
    intercom: "Basic Fin Summary",
    zendesk: "Generic KB search",
    crisp: "Generic KB search",
  },
  {
    feature: "Pricing Model",
    chatty: "Flat Rate or Free BYOK",
    intercom: "$39/seat + $0.99/resolution",
    zendesk: "$55/seat + AI add-on",
    crisp: "$95/mo + limited AI",
  },
];

const FAQS = [
  {
    q: "How fast can I deploy Chatty on my live website?",
    a: "Most teams are fully live in under 3 minutes. Simply create an account, paste your website URL or upload your help documentation, let our crawler index your knowledge chunks, and copy-paste one <script> snippet into your HTML head or Google Tag Manager.",
  },
  {
    q: "How does Chatty prevent AI hallucinations?",
    a: "Chatty implements strict cosine similarity thresholding with pgvector. If a visitor's question cannot be grounded with high mathematical confidence in your ingested data sources, the assistant transparently admits it doesn't know and offers to schedule a call or route to a human team member.",
  },
  {
    q: "How does the in-chat calendar booking work?",
    a: "Chatty connects directly to your Google Calendar or Microsoft Outlook account. When a qualified prospect requests a meeting, the assistant dynamically presents real-time open slots inside the chat widget. Once picked, the calendar event and Google Meet/Zoom link are created instantly with zero external redirects.",
  },
  {
    q: "What does BYOK (Bring Your Own Key) mean?",
    a: "BYOK allows you to plug in your own API key from OpenAI, Anthropic, Google Gemini, or OpenRouter. Chatty manages the UI, vector search, crawler, and chat widget, while model tokens are billed directly to your own provider account without any markup from us.",
  },
  {
    q: "What is Model Context Protocol (MCP) and how does Chatty use it?",
    a: "MCP is the open standard created by Anthropic that allows AI agents like Claude Desktop and Cursor to securely call tools. Chatty provides a native MCP server so your local development or support agents can query conversation analytics, update knowledge bases, and triage customer tickets using natural language.",
  },
  {
    q: "Can my support team take over conversations in real time?",
    a: "Yes. Our real-time Omnichannel Team Inbox lets you monitor active conversations. If an agent detects negative sentiment or complex enterprise requirements, you can pause the AI with one click, lock the conversation to a human rep, and reply seamlessly.",
  },
];

// ==========================================
// MAIN LANDING CLIENT COMPONENT
// ==========================================

export default function LandingClient() {
  // Navigation Menus State
  const [productsMenuOpen, setProductsMenuOpen] = useState(false);
  const [resourcesMenuOpen, setResourcesMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Playground Simulator State
  const [selectedPlaygroundTab, setSelectedPlaygroundTab] = useState(PLAYGROUND_TABS[0]);
  const [simulatedSlot, setSimulatedSlot] = useState<string | null>(null);
  const [bookingConfirmed, setBookingConfirmed] = useState(false);
  const [isTyping, setIsTyping] = useState(false);

  // Code Showcase State
  const [selectedCodeTab, setSelectedCodeTab] = useState(0);
  const [codeCopied, setCodeCopied] = useState(false);

  // Multi-Agent Pipeline State
  const [selectedAgentId, setSelectedAgentId] = useState("rag");
  const selectedAgent = useMemo(
    () => AGENT_NODES.find((a) => a.id === selectedAgentId) || AGENT_NODES[0],
    [selectedAgentId]
  );

  // ROI Calculator State
  const [monthlyVisitors, setMonthlyVisitors] = useState(25000);
  const [monthlyTickets, setMonthlyTickets] = useState(1200);

  const calculatedMetrics = useMemo(() => {
    const deflectedTickets = Math.round(monthlyTickets * 0.84);
    const hoursSaved = Math.round((deflectedTickets * 14) / 60);
    const leadsCaptured = Math.round(monthlyVisitors * 0.038);
    const estimatedCostSavings = Math.round(deflectedTickets * 3.4);
    return {
      deflectedTickets,
      hoursSaved,
      leadsCaptured,
      estimatedCostSavings,
    };
  }, [monthlyVisitors, monthlyTickets]);

  // Pricing Toggle State
  const [isAnnual, setIsAnnual] = useState(true);

  // FAQ Accordion State
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  // Switch playground tab with typing simulation
  const handleSelectTab = (tab: typeof PLAYGROUND_TABS[0]) => {
    setSelectedPlaygroundTab(tab);
    setSimulatedSlot(null);
    setBookingConfirmed(false);
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
    }, 280);
  };

  // Copy code handler
  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  // Close menus on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setProductsMenuOpen(false);
        setResourcesMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="min-h-screen bg-white text-zinc-900 font-sans selection:bg-[#f95721] selection:text-white antialiased">
      {/* ==========================================
          TOP NAVIGATION (Spacious, Firecrawl + Nimble Style)
          ========================================== */}
      <header className="sticky top-0 z-50 border-b border-zinc-200/80 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Left: Brand Logo & Open Source Badge */}
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2.5 focus:outline-none">
              <Image
                src="/favicon.png"
                alt="Chatty Logo"
                width={32}
                height={32}
                className="object-contain"
                priority
              />
              <span className="font-display text-xl font-bold tracking-tight text-zinc-950">Chatty</span>
            </Link>
            <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-2.5 py-0.5 text-[11px] font-mono font-medium text-[#f95721]">
              <span className="size-1.5 rounded-full bg-[#f95721] animate-pulse" />
              Open Source
            </span>
          </div>

          {/* Center: Desktop Navigation Links with Mega-Menus */}
          <nav className="hidden md:flex items-center gap-1 text-sm font-medium text-zinc-600">
            {/* Products Mega-Menu Dropdown */}
            <div
              className="relative"
              onMouseEnter={() => setProductsMenuOpen(true)}
              onMouseLeave={() => setProductsMenuOpen(false)}
            >
              <button
                type="button"
                onClick={() => setProductsMenuOpen(!productsMenuOpen)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg transition-colors ${
                  productsMenuOpen ? "text-zinc-950 bg-zinc-100" : "hover:text-zinc-950 hover:bg-zinc-50"
                }`}
              >
                <span>Products</span>
                <ChevronDown
                  className={`size-3.5 text-zinc-400 transition-transform duration-200 ${
                    productsMenuOpen ? "rotate-180 text-[#f95721]" : ""
                  }`}
                />
              </button>

              {/* Firecrawl / Nimble Style 2-Column Mega-Menu Card */}
              {productsMenuOpen && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 pt-2 w-[760px] transition-all duration-150">
                  <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl shadow-zinc-200/80">
                    <div className="grid grid-cols-12 gap-6">
                      {/* Left Two Columns: Products List */}
                      <div className="col-span-8 grid grid-cols-2 gap-6 border-r border-zinc-100 pr-6">
                        {MEGA_MENU_PRODUCTS.map((section) => (
                          <div key={section.title} className="space-y-3">
                            <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
                              <span className="text-xs font-mono font-semibold uppercase tracking-wider text-zinc-400">
                                {section.title}
                              </span>
                              <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-mono text-zinc-500">
                                {section.badge}
                              </span>
                            </div>
                            <div className="space-y-1">
                              {section.items.map((item) => {
                                const Icon = item.icon;
                                return (
                                  <Link
                                    key={item.title}
                                    href={item.href}
                                    onClick={() => setProductsMenuOpen(false)}
                                    className="group flex items-start gap-2.5 rounded-xl p-2 transition-colors hover:bg-orange-50/50"
                                  >
                                    <div
                                      className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg border ${item.iconColor}`}
                                    >
                                      <Icon className="size-3.5" />
                                    </div>
                                    <div>
                                      <p className="text-xs font-semibold text-zinc-900 group-hover:text-[#f95721] transition-colors">
                                        {item.title}
                                      </p>
                                      <p className="text-[11px] leading-relaxed text-zinc-500 line-clamp-2">
                                        {item.desc}
                                      </p>
                                    </div>
                                  </Link>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Right Column: Firecrawl-Style Open Source Feature Box */}
                      <div className="col-span-4 flex flex-col justify-between rounded-xl border border-orange-100 bg-orange-50/40 p-4">
                        <div className="space-y-3">
                          <div className="flex size-9 items-center justify-center rounded-xl bg-[#f95721] text-white shadow-sm">
                            <Bot className="size-5" />
                          </div>
                          <div>
                            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#f95721]">
                              Open Source
                            </span>
                            <h4 className="mt-1 text-sm font-bold text-zinc-900">Chatty is 100% open source.</h4>
                            <p className="mt-1 text-xs text-zinc-600 leading-relaxed">
                              Star our repository on GitHub to follow weekly releases and contribute tools.
                            </p>
                          </div>
                        </div>

                        <Link
                          href="https://github.com/Damayantha/chatty"
                          target="_blank"
                          rel="noreferrer"
                          className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-[#f95721] hover:text-[#ea4815] transition-colors"
                        >
                          <span>View GitHub Repository</span>
                          <ArrowRight className="size-3.5" />
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Resources Dropdown */}
            <div
              className="relative"
              onMouseEnter={() => setResourcesMenuOpen(true)}
              onMouseLeave={() => setResourcesMenuOpen(false)}
            >
              <button
                type="button"
                onClick={() => setResourcesMenuOpen(!resourcesMenuOpen)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg transition-colors ${
                  resourcesMenuOpen ? "text-zinc-950 bg-zinc-100" : "hover:text-zinc-950 hover:bg-zinc-50"
                }`}
              >
                <span>Resources</span>
                <ChevronDown
                  className={`size-3.5 text-zinc-400 transition-transform duration-200 ${
                    resourcesMenuOpen ? "rotate-180 text-[#f95721]" : ""
                  }`}
                />
              </button>

              {resourcesMenuOpen && (
                <div className="absolute top-full left-0 pt-2 w-72 transition-all duration-150">
                  <div className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-xl space-y-1">
                    {MEGA_MENU_RESOURCES.map((item) => (
                      <Link
                        key={item.title}
                        href={item.href}
                        target={item.external ? "_blank" : undefined}
                        onClick={() => setResourcesMenuOpen(false)}
                        className="block rounded-xl p-2.5 transition-colors hover:bg-zinc-50"
                      >
                        <p className="text-xs font-semibold text-zinc-900 flex items-center justify-between">
                          <span>{item.title}</span>
                          {item.external && <ExternalLink className="size-3 text-zinc-400" />}
                        </p>
                        <p className="text-[11px] text-zinc-500 mt-0.5">{item.desc}</p>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <Link href="#pricing" className="px-3.5 py-2 rounded-lg hover:text-zinc-950 hover:bg-zinc-50">
              Pricing
            </Link>
            <Link
              href="https://docs.chatty.personaliai.com"
              target="_blank"
              className="px-3.5 py-2 rounded-lg hover:text-zinc-950 hover:bg-zinc-50"
            >
              Docs
            </Link>
            <Link href="#playground" className="px-3.5 py-2 rounded-lg hover:text-zinc-950 hover:bg-zinc-50">
              Playground
            </Link>
          </nav>

          {/* Right: Actions (GitHub Stars Pill, Sign In, Start for Free) */}
          <div className="hidden sm:flex items-center gap-3">
            {/* GitHub Stars Pill (Exact Firecrawl Style) */}
            <Link
              href="https://github.com/Damayantha/chatty"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-zinc-800 transition-colors shadow-sm"
            >
              <span>⭐</span>
              <span>1.2k</span>
            </Link>

            {/* Sign In Link */}
            <Link
              href="/login"
              className="text-xs font-semibold text-zinc-700 hover:text-zinc-950 px-2 py-1.5 transition-colors"
            >
              Sign In
            </Link>

            {/* Vibrant Orange Primary Button */}
            <Link
              href="/signup"
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#f95721] hover:bg-[#ea4815] px-4 py-2 text-xs font-semibold text-white shadow-sm shadow-orange-500/20 active:scale-[0.98] transition-all"
            >
              <span>Start for free</span>
              <ArrowRight className="size-3.5" />
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex sm:hidden items-center gap-2">
            <Link
              href="/signup"
              className="rounded-lg bg-[#f95721] px-3 py-1 text-xs font-semibold text-white"
            >
              Sign up
            </Link>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-zinc-600 hover:text-zinc-950"
            >
              {mobileMenuOpen ? <X className="size-6" /> : <Menu className="size-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="sm:hidden border-b border-zinc-200 bg-white px-4 py-5 space-y-3">
            <Link
              href="#playground"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-sm font-medium text-zinc-700 py-1"
            >
              Playground
            </Link>
            <Link
              href="#capabilities"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-sm font-medium text-zinc-700 py-1"
            >
              Features & RAG
            </Link>
            <Link
              href="#pricing"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-sm font-medium text-zinc-700 py-1"
            >
              Pricing
            </Link>
            <Link
              href="/affiliates"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-sm font-medium text-zinc-700 py-1"
            >
              Affiliates Program
            </Link>
            <Link
              href="/support"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-sm font-medium text-zinc-700 py-1"
            >
              Help & Support
            </Link>
            <Link
              href="/voice-demo"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-sm font-medium text-zinc-700 py-1"
            >
              Voice AI Demo
            </Link>
            <Link
              href="https://docs.chatty.personaliai.com"
              target="_blank"
              className="block text-sm font-medium text-zinc-700 py-1"
            >
              Documentation
            </Link>
            <Link
              href="https://github.com/Damayantha/chatty"
              target="_blank"
              className="flex items-center gap-2 text-sm font-medium text-zinc-700 py-1"
            >
              <span>⭐ Star on GitHub (1.2k)</span>
            </Link>
            <div className="pt-3 border-t border-zinc-100 flex items-center justify-between">
              <Link href="/login" className="text-sm font-semibold text-zinc-800">
                Sign In
              </Link>
              <Link
                href="/signup"
                className="rounded-xl bg-[#f95721] px-4 py-2 text-xs font-semibold text-white shadow-sm"
              >
                Start for free
              </Link>
            </div>
          </div>
        )}
      </header>

      <main>
        {/* ==========================================
            HERO SECTION (Spacious, Firecrawl Style)
            ========================================== */}
        <section className="relative overflow-hidden pt-16 pb-24 sm:pt-24 sm:pb-32 lg:pt-28">
          {/* Subtle Clean Technical Grid Pattern with Orange Sparkle Stars (✦) */}
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.4]"
            style={{
              backgroundImage: `linear-gradient(to right, #f1f5f9 1px, transparent 1px), linear-gradient(to bottom, #f1f5f9 1px, transparent 1px)`,
              backgroundSize: "48px 48px",
            }}
          />

          {/* Firecrawl Style Orange Sparkle Crosses */}
          <div className="absolute left-[15%] top-28 hidden lg:block text-[#f95721] text-lg font-bold select-none opacity-80">
            ✦
          </div>
          <div className="absolute right-[18%] top-32 hidden lg:block text-[#f95721] text-lg font-bold select-none opacity-80">
            ✦
          </div>

          <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
            {/* Announcement Pill (Firecrawl style: 2 Months Free - Annually) */}
            <Link
              href="#pricing"
              className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-4 py-1.5 text-xs font-medium text-zinc-700 shadow-sm hover:border-zinc-300 hover:bg-zinc-50 transition-all mb-8"
            >
              <span className="font-semibold text-[#f95721]">2 Months Free</span>
              <span className="text-zinc-300">·</span>
              <span>Annually Billed</span>
              <span className="flex size-4 items-center justify-center rounded-full bg-zinc-900 text-white text-[10px] ml-1">
                ›
              </span>
            </Link>

            {/* Spacious Bold Headline */}
            <h1 className="font-display text-4xl font-extrabold tracking-tight text-zinc-950 sm:text-6xl lg:text-7xl max-w-5xl mx-auto leading-[1.08]">
              Power AI customer support with{" "}
              <span className="text-[#f95721]">grounded business data</span>
            </h1>

            {/* Spacious Clear Subtitle */}
            <p className="mt-6 max-w-3xl mx-auto text-base sm:text-lg text-zinc-600 leading-relaxed">
              The context-aware AI platform to answer visitor inquiries, capture high-intent leads, and schedule
              calendar demo meetings at scale. It&apos;s also open source.
            </p>

            {/* CTAs Row */}
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/signup"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-[#f95721] hover:bg-[#ea4815] px-8 py-3.5 text-sm font-bold text-white shadow-lg shadow-orange-500/25 active:scale-[0.98] transition-all"
              >
                <span>Start for free</span>
              </Link>
              <Link
                href="https://docs.chatty.personaliai.com"
                target="_blank"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 px-6 py-3.5 text-sm font-semibold text-zinc-800 shadow-sm transition-all"
              >
                <Terminal className="size-4 text-zinc-500" />
                <span>Setup for agents (MCP)</span>
              </Link>
              <Link
                href="https://github.com/Damayantha/chatty"
                target="_blank"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 px-5 py-3.5 text-sm font-semibold text-zinc-700 shadow-sm transition-all"
              >
                <span>⭐ GitHub Repo</span>
              </Link>
            </div>

            {/* Trust Badges Row */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-medium text-zinc-500">
              <span className="flex items-center gap-1.5">
                <Check className="size-4 text-emerald-600" /> No credit card required
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="size-4 text-emerald-600" /> Free BYOK tier forever
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="size-4 text-emerald-600" /> 2-minute embed script
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="size-4 text-emerald-600" /> Google & Outlook calendar sync
              </span>
            </div>

            {/* ==========================================
                HERO INTERACTIVE SEARCH & SIMULATOR BOX
                (Firecrawl Style Interactive Input Bar - Image 2)
                ========================================== */}
            <div id="playground" className="mt-14 max-w-4xl mx-auto text-left">
              <div className="rounded-2xl border border-zinc-200/80 bg-white shadow-2xl shadow-zinc-200/60 p-4 sm:p-5">
                {/* Search Bar Input Row */}
                <div className="flex items-center gap-3 pb-3 border-b border-zinc-100">
                  <Globe2 className="size-5 text-[#f95721] shrink-0 ml-1" />
                  <span className="text-sm font-medium text-zinc-800 flex-1 truncate">
                    {selectedPlaygroundTab.prompt}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleSelectTab(selectedPlaygroundTab)}
                    className="flex size-9 items-center justify-center rounded-xl bg-[#f95721] hover:bg-[#ea4815] text-white shadow-sm shrink-0 transition-all"
                    title="Send Prompt"
                  >
                    <ArrowRight className="size-4" />
                  </button>
                </div>

                {/* Firecrawl Style Mode Tabs (Search, Scrape, Map, Crawl equivalent) */}
                <div className="flex flex-wrap items-center gap-2 pt-3">
                  {PLAYGROUND_TABS.map((tab) => {
                    const isSelected = tab.id === selectedPlaygroundTab.id;
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => handleSelectTab(tab)}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                          isSelected
                            ? "bg-[#f95721] text-white shadow-sm shadow-orange-500/20"
                            : "bg-zinc-100/80 text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900"
                        }`}
                      >
                        <Icon className="size-3.5" />
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Assistant Output Result Box */}
                <div className="mt-4 rounded-xl border border-zinc-100 bg-zinc-50/70 p-4 sm:p-5">
                  <div className="flex items-start gap-3.5">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#f95721] text-white font-bold shadow-sm">
                      <Bot className="size-4" />
                    </div>
                    <div className="flex-1 space-y-3">
                      {isTyping ? (
                        <div className="flex items-center gap-1.5 py-1 text-xs font-mono text-zinc-500">
                          <span className="size-2 rounded-full bg-[#f95721] animate-bounce" />
                          <span className="size-2 rounded-full bg-[#f95721] animate-bounce [animation-delay:150ms]" />
                          <span className="size-2 rounded-full bg-[#f95721] animate-bounce [animation-delay:300ms]" />
                          <span className="ml-1">Retrieving grounded knowledge...</span>
                        </div>
                      ) : (
                        <p className="text-xs sm:text-sm text-zinc-800 leading-relaxed">
                          {selectedPlaygroundTab.response}
                        </p>
                      )}

                      {/* INLINE CALENDAR BOOKING CARD (Interactive demonstration) */}
                      {!isTyping && selectedPlaygroundTab.hasCalendar && (
                        <div className="mt-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
                          <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
                            <span className="font-semibold text-xs text-zinc-900 flex items-center gap-1.5">
                              <CalendarCheck className="size-4 text-[#f95721]" />
                              Engineering Demo (15 min)
                            </span>
                            <span className="text-[11px] font-mono text-zinc-400">Timezone: Auto-detected</span>
                          </div>

                          {bookingConfirmed ? (
                            <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-center">
                              <p className="text-xs font-bold text-emerald-800">
                                ✓ Demo Confirmed for Tomorrow at {simulatedSlot}!
                              </p>
                              <p className="mt-1 text-[11px] text-emerald-600">
                                Calendar invite and Google Meet link dispatched.
                              </p>
                            </div>
                          ) : (
                            <div className="mt-3 space-y-3">
                              <p className="text-[11px] text-zinc-500">Select an available open slot:</p>
                              <div className="grid grid-cols-3 gap-2">
                                {["10:00 AM", "02:30 PM", "04:00 PM"].map((slot) => (
                                  <button
                                    key={slot}
                                    type="button"
                                    onClick={() => setSimulatedSlot(slot)}
                                    className={`py-2 px-1 rounded-lg font-mono text-xs font-semibold transition-all border ${
                                      simulatedSlot === slot
                                        ? "bg-[#f95721] text-white border-[#f95721] shadow-sm"
                                        : "bg-white text-zinc-700 border-zinc-200 hover:border-zinc-300"
                                    }`}
                                  >
                                    {slot}
                                  </button>
                                ))}
                              </div>
                              {simulatedSlot && (
                                <button
                                  type="button"
                                  onClick={() => setBookingConfirmed(true)}
                                  className="w-full mt-2 rounded-lg bg-[#f95721] hover:bg-[#ea4815] py-2 text-xs font-bold text-white transition-colors shadow-sm"
                                >
                                  Confirm Demo Slot at {simulatedSlot}
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Verified Citation Pill Badges */}
                      {!isTyping && (
                        <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] font-mono text-zinc-500">
                          <span>Grounding Sources:</span>
                          {selectedPlaygroundTab.citations.map((c) => (
                            <span
                              key={c}
                              className="inline-flex items-center gap-1 rounded border border-zinc-200 bg-white px-2 py-0.5 text-zinc-700 font-medium"
                            >
                              <Database className="size-2.5 text-[#f95721]" />
                              {c}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ==========================================
            CODE & INTEGRATION SHOWCASE
            (Firecrawl Style Interactive Code Box - Image 3)
            ========================================== */}
        <section className="py-20 border-t border-b border-zinc-200/80 bg-[#fbfbfb]">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto">
              <p className="text-xs font-mono font-semibold uppercase tracking-wider text-[#f95721]">
                // DEVELOPER INTEGRATIONS
              </p>
              <h2 className="mt-3 font-display text-3xl sm:text-4xl font-bold tracking-tight text-zinc-950">
                Embed in one line. Or build on the API.
              </h2>
              <p className="mt-3 text-sm sm:text-base text-zinc-600">
                Drop the script tag on your website, query trained knowledge with Python/Node.js, or manage everything
                autonomously via the Model Context Protocol.
              </p>
            </div>

            {/* Code Box Container */}
            <div className="mt-12 max-w-5xl mx-auto rounded-2xl border border-zinc-200 bg-white shadow-xl overflow-hidden">
              {/* Language Tabs Row */}
              <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-50 px-4 py-2.5">
                <div className="flex items-center gap-1.5 overflow-x-auto">
                  {CODE_EXAMPLES.map((item, idx) => (
                    <button
                      key={item.lang}
                      type="button"
                      onClick={() => setSelectedCodeTab(idx)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        selectedCodeTab === idx
                          ? "bg-white text-zinc-950 shadow-sm border border-zinc-200"
                          : "text-zinc-600 hover:text-zinc-950"
                      }`}
                    >
                      {item.lang}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => handleCopyCode(CODE_EXAMPLES[selectedCodeTab].code)}
                  className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-700 transition-colors shadow-sm"
                >
                  {codeCopied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
                  <span>{codeCopied ? "Copied!" : "Copy code"}</span>
                </button>
              </div>

              {/* Side-by-Side Code and JSON Result Output */}
              <div className="grid grid-cols-1 lg:grid-cols-12">
                {/* Code Block */}
                <div className="lg:col-span-7 bg-[#0f1117] p-5 font-mono text-xs text-zinc-200 overflow-x-auto">
                  <div className="flex items-center justify-between pb-3 border-b border-zinc-800 text-zinc-400 text-[11px]">
                    <span>{CODE_EXAMPLES[selectedCodeTab].title}</span>
                    <span className="text-[#f95721]">{CODE_EXAMPLES[selectedCodeTab].lang}</span>
                  </div>
                  <pre className="pt-4 leading-relaxed whitespace-pre font-mono">
                    {CODE_EXAMPLES[selectedCodeTab].code}
                  </pre>
                </div>

                {/* API Response JSON Output */}
                <div className="lg:col-span-5 bg-[#161822] border-t lg:border-t-0 lg:border-l border-zinc-800 p-5 font-mono text-xs text-emerald-400 overflow-x-auto">
                  <div className="flex items-center justify-between pb-3 border-b border-zinc-800 text-zinc-400 text-[11px]">
                    <span>RESPONSE :: HTTP 200 OK</span>
                    <span className="text-emerald-400">Grounded</span>
                  </div>
                  <pre className="pt-4 leading-relaxed font-mono">
                    {JSON.stringify(CODE_EXAMPLES[selectedCodeTab].response, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ==========================================
            MULTI-AGENT ARCHITECTURE PIPELINE (Nimble Style)
            ========================================== */}
        <section className="py-24 bg-white">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto">
              <p className="text-xs font-mono font-semibold uppercase tracking-wider text-[#f95721]">
                // MULTI-AGENT ORCHESTRATION
              </p>
              <h2 className="mt-3 font-display text-3xl sm:text-4xl font-bold tracking-tight text-zinc-950">
                Specialized agents. Coordinated resolution.
              </h2>
              <p className="mt-3 text-sm sm:text-base text-zinc-600">
                Instead of a single brittle prompt, incoming visitor messages pass through specialized autonomous
                agents for vector retrieval, calendar coordination, CRM enrichment, and human fallback.
              </p>
            </div>

            <div className="mt-14 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start max-w-5xl mx-auto">
              {/* Left Column: Interactive Agent List */}
              <div className="lg:col-span-5 space-y-3">
                {AGENT_NODES.map((agent) => {
                  const isSelected = agent.id === selectedAgentId;
                  return (
                    <button
                      key={agent.id}
                      type="button"
                      onClick={() => setSelectedAgentId(agent.id)}
                      className={`w-full text-left p-4 rounded-xl border transition-all ${
                        isSelected
                          ? "border-[#f95721] bg-orange-50/50 shadow-md shadow-orange-500/10"
                          : "border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-zinc-900">{agent.name}</span>
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                            isSelected
                              ? "bg-[#f95721] text-white border-[#f95721]"
                              : "bg-zinc-100 text-zinc-600 border-zinc-200"
                          }`}
                        >
                          {agent.tag}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-zinc-600 leading-relaxed">{agent.desc}</p>
                      <div className="mt-3 flex items-center justify-between text-[11px] font-mono font-medium">
                        <span className="text-emerald-600 flex items-center gap-1">
                          <span className="size-1.5 rounded-full bg-emerald-500" />
                          {agent.status}
                        </span>
                        <span className="text-zinc-700">{agent.metric}</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Right Column: Active Agent Telemetry & Pipeline */}
              <div className="lg:col-span-7 rounded-2xl border border-zinc-200 bg-[#0f1117] p-6 text-zinc-100 shadow-xl">
                <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
                  <div className="flex items-center gap-2">
                    <span className="size-2.5 rounded-full bg-red-500" />
                    <span className="size-2.5 rounded-full bg-yellow-500" />
                    <span className="size-2.5 rounded-full bg-green-500" />
                    <span className="ml-2 font-mono text-xs text-zinc-400">
                      agent_telemetry :: {selectedAgent.id}.spec.json
                    </span>
                  </div>
                  <span className="rounded bg-emerald-950 border border-emerald-500/40 px-2 py-0.5 text-[10px] font-mono text-emerald-400">
                    ONLINE
                  </span>
                </div>

                <div className="mt-5 space-y-4">
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <span>{selectedAgent.name}</span>
                      <span className="text-xs font-mono font-normal text-zinc-400">({selectedAgent.tag})</span>
                    </h3>
                    <p className="mt-1 text-xs text-zinc-400 leading-relaxed">{selectedAgent.desc}</p>
                  </div>

                  {/* Visual Pipeline Trace */}
                  <div className="rounded-xl border border-zinc-800 bg-[#090a0f] p-4">
                    <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400 mb-3">
                      <span>ORCHESTRATION STAGE</span>
                      <span className="text-[#f95721]">Active</span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="rounded-lg border border-zinc-800 bg-[#161822] p-2.5">
                        <span className="block text-[10px] font-mono text-zinc-500">STAGE 01</span>
                        <span className="font-semibold text-white">Ingestion</span>
                      </div>
                      <div className="rounded-lg border border-[#f95721]/60 bg-[#f95721]/10 p-2.5">
                        <span className="block text-[10px] font-mono text-[#f95721]">STAGE 02</span>
                        <span className="font-semibold text-white">{selectedAgent.name.split(" ")[0]}</span>
                      </div>
                      <div className="rounded-lg border border-zinc-800 bg-[#161822] p-2.5">
                        <span className="block text-[10px] font-mono text-zinc-500">STAGE 03</span>
                        <span className="font-semibold text-white">Resolution</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="text-[11px] font-mono text-zinc-400 uppercase mb-2">Live Agent Payload:</p>
                    <pre className="rounded-xl border border-zinc-800 bg-[#07080c] p-4 font-mono text-xs text-emerald-400 overflow-x-auto">
                      {JSON.stringify(selectedAgent.payload, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ==========================================
            CORE INDUSTRIAL CAPABILITIES
            ========================================== */}
        <section id="capabilities" className="py-24 border-t border-b border-zinc-200/80 bg-[#fbfbfb]">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto">
              <p className="text-xs font-mono font-semibold uppercase tracking-wider text-[#f95721]">
                // INDUSTRIAL CAPABILITIES
              </p>
              <h2 className="mt-3 font-display text-3xl sm:text-4xl font-bold tracking-tight text-zinc-950">
                Engineered for conversion, accuracy, and scale.
              </h2>
              <p className="mt-3 text-sm sm:text-base text-zinc-600">
                Traditional chatbots ask visitors to wait for an email. Chatty answers instantly, captures intent, and
                completes calendar bookings in the live conversation.
              </p>
            </div>

            <div className="mt-14 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
              {/* Feature 1 */}
              <div className="rounded-2xl border border-zinc-200 bg-white p-7 shadow-sm hover:shadow-md hover:border-orange-200 transition-all">
                <div className="flex size-11 items-center justify-center rounded-xl bg-orange-50 text-[#f95721] border border-orange-100">
                  <Database className="size-5" />
                </div>
                <h3 className="mt-5 font-bold text-base text-zinc-900">Grounded Vector RAG</h3>
                <p className="mt-2 text-xs text-zinc-600 leading-relaxed">
                  Indexed with pgvector and cosine distance cutoff. Chatty never fabricates features or pricing. Every
                  answer references exact source documents.
                </p>
                <div className="mt-4 pt-3 border-t border-zinc-100 flex items-center gap-2 text-[11px] font-mono text-zinc-600">
                  <Check className="size-3.5 text-emerald-600" /> Cosine similarity threshold 0.78
                </div>
              </div>

              {/* Feature 2 */}
              <div className="rounded-2xl border border-zinc-200 bg-white p-7 shadow-sm hover:shadow-md hover:border-blue-200 transition-all">
                <div className="flex size-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
                  <CalendarCheck className="size-5" />
                </div>
                <h3 className="mt-5 font-bold text-base text-zinc-900">In-Chat Calendar Booking</h3>
                <p className="mt-2 text-xs text-zinc-600 leading-relaxed">
                  Eliminate external redirects that lose high-intent leads. Prospects choose real open calendar slots
                  directly inside the chat window with instant Google & Outlook sync.
                </p>
                <div className="mt-4 pt-3 border-t border-zinc-100 flex items-center gap-2 text-[11px] font-mono text-zinc-600">
                  <Check className="size-3.5 text-emerald-600" /> Automatic timezone detection
                </div>
              </div>

              {/* Feature 3 */}
              <div className="rounded-2xl border border-zinc-200 bg-white p-7 shadow-sm hover:shadow-md hover:border-purple-200 transition-all">
                <div className="flex size-11 items-center justify-center rounded-xl bg-purple-50 text-purple-600 border border-purple-100">
                  <Inbox className="size-5" />
                </div>
                <h3 className="mt-5 font-bold text-base text-zinc-900">Omnichannel Team Inbox</h3>
                <p className="mt-2 text-xs text-zinc-600 leading-relaxed">
                  Review live chats in real time. If a conversation requires human nuance, pause the bot with 1 click,
                  assign the ticket to a teammate, and take over seamlessly.
                </p>
                <div className="mt-4 pt-3 border-t border-zinc-100 flex items-center gap-2 text-[11px] font-mono text-zinc-600">
                  <Check className="size-3.5 text-emerald-600" /> Collision lock & sentiment alerts
                </div>
              </div>

              {/* Feature 4 */}
              <div className="rounded-2xl border border-zinc-200 bg-white p-7 shadow-sm hover:shadow-md hover:border-amber-200 transition-all">
                <div className="flex size-11 items-center justify-center rounded-xl bg-amber-50 text-amber-600 border border-amber-100">
                  <PlugZap className="size-5" />
                </div>
                <h3 className="mt-5 font-bold text-base text-zinc-900">Model Context Protocol (MCP)</h3>
                <p className="mt-2 text-xs text-zinc-600 leading-relaxed">
                  Official MCP server support. Connect Claude Desktop, Cursor, or Codex to manage bots, inspect
                  transcripts, update sources, and trigger broadcasts via natural language.
                </p>
                <div className="mt-4 pt-3 border-t border-zinc-100 flex items-center gap-2 text-[11px] font-mono text-zinc-600">
                  <Check className="size-3.5 text-emerald-600" /> 18 official MCP tool definitions
                </div>
              </div>

              {/* Feature 5 */}
              <div className="rounded-2xl border border-zinc-200 bg-white p-7 shadow-sm hover:shadow-md hover:border-emerald-200 transition-all">
                <div className="flex size-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
                  <MousePointerClick className="size-5" />
                </div>
                <h3 className="mt-5 font-bold text-base text-zinc-900">Natural Lead Qualification</h3>
                <p className="mt-2 text-xs text-zinc-600 leading-relaxed">
                  Collect email, company name, team size, and specific pain points organically during conversations.
                  Automatically enrich domain data and sync to your CRM via webhooks.
                </p>
                <div className="mt-4 pt-3 border-t border-zinc-100 flex items-center gap-2 text-[11px] font-mono text-zinc-600">
                  <Check className="size-3.5 text-emerald-600" /> Webhooks dispatch & CSV export
                </div>
              </div>

              {/* Feature 6 */}
              <div className="rounded-2xl border border-zinc-200 bg-white p-7 shadow-sm hover:shadow-md hover:border-rose-200 transition-all">
                <div className="flex size-11 items-center justify-center rounded-xl bg-rose-50 text-rose-600 border border-rose-100">
                  <Cpu className="size-5" />
                </div>
                <h3 className="mt-5 font-bold text-base text-zinc-900">Zero-Markup BYOK Engine</h3>
                <p className="mt-2 text-xs text-zinc-600 leading-relaxed">
                  Plug in your own API key from OpenAI, Anthropic, Gemini, or OpenRouter. Chatty charges $0 platform
                  markup on tokens, providing total cost predictability.
                </p>
                <div className="mt-4 pt-3 border-t border-zinc-100 flex items-center gap-2 text-[11px] font-mono text-zinc-600">
                  <Check className="size-3.5 text-emerald-600" /> Free forever tier available
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ==========================================
            INTERACTIVE ROI & DEFLECTION CALCULATOR
            ========================================== */}
        <section className="py-24 bg-white">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto">
              <p className="text-xs font-mono font-semibold uppercase tracking-wider text-[#f95721]">
                // ROI & DEFLECTION ESTIMATOR
              </p>
              <h2 className="mt-3 font-display text-3xl sm:text-4xl font-bold tracking-tight text-zinc-950">
                Calculate your monthly time and cost savings.
              </h2>
              <p className="mt-3 text-sm sm:text-base text-zinc-600">
                Adjust your monthly website visitors and support volume to calculate estimated ticket deflection,
                hours saved, and high-intent sales leads captured.
              </p>
            </div>

            <div className="mt-12 max-w-4xl mx-auto rounded-2xl border border-zinc-200 bg-white p-6 sm:p-10 shadow-xl">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                {/* Sliders Area */}
                <div className="lg:col-span-6 space-y-7">
                  {/* Slider 1: Monthly Visitors */}
                  <div>
                    <div className="flex justify-between items-center text-xs font-semibold mb-2">
                      <span className="text-zinc-700">Monthly Website Visitors:</span>
                      <span className="font-mono text-[#f95721] text-sm font-bold">
                        {monthlyVisitors.toLocaleString()}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="2000"
                      max="200000"
                      step="2000"
                      value={monthlyVisitors}
                      onChange={(e) => setMonthlyVisitors(Number(e.target.value))}
                      className="w-full accent-[#f95721] cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] font-mono text-zinc-400 mt-1">
                      <span>2,000</span>
                      <span>100,000</span>
                      <span>200,000+</span>
                    </div>
                  </div>

                  {/* Slider 2: Monthly Support Inquiries */}
                  <div>
                    <div className="flex justify-between items-center text-xs font-semibold mb-2">
                      <span className="text-zinc-700">Monthly Support Inquiries:</span>
                      <span className="font-mono text-[#f95721] text-sm font-bold">
                        {monthlyTickets.toLocaleString()}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="100"
                      max="10000"
                      step="100"
                      value={monthlyTickets}
                      onChange={(e) => setMonthlyTickets(Number(e.target.value))}
                      className="w-full accent-[#f95721] cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] font-mono text-zinc-400 mt-1">
                      <span>100</span>
                      <span>5,000</span>
                      <span>10,000+</span>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-zinc-100 text-xs text-zinc-500">
                    <p className="flex items-center gap-2">
                      <Check className="size-4 text-emerald-600 shrink-0" />
                      Assumes standard 84% deflection rate based on grounded documentation.
                    </p>
                  </div>
                </div>

                {/* Calculation Outputs Card */}
                <div className="lg:col-span-6 rounded-xl border border-zinc-200 bg-zinc-50 p-6 text-left">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-lg border border-zinc-200 bg-white p-3.5 shadow-sm">
                      <p className="font-mono text-2xl font-bold text-zinc-950">
                        {calculatedMetrics.deflectedTickets.toLocaleString()}
                      </p>
                      <p className="text-[11px] font-semibold text-[#f95721] mt-1">Deflected Inquiries / mo</p>
                    </div>

                    <div className="rounded-lg border border-zinc-200 bg-white p-3.5 shadow-sm">
                      <p className="font-mono text-2xl font-bold text-zinc-950">{calculatedMetrics.hoursSaved}h</p>
                      <p className="text-[11px] font-semibold text-[#f95721] mt-1">Support Hours Saved</p>
                    </div>

                    <div className="rounded-lg border border-zinc-200 bg-white p-3.5 shadow-sm">
                      <p className="font-mono text-2xl font-bold text-emerald-600">
                        {calculatedMetrics.leadsCaptured.toLocaleString()}
                      </p>
                      <p className="text-[11px] font-semibold text-zinc-700 mt-1">High-Intent Leads</p>
                    </div>

                    <div className="rounded-lg border border-zinc-200 bg-white p-3.5 shadow-sm">
                      <p className="font-mono text-2xl font-bold text-emerald-600">
                        ${calculatedMetrics.estimatedCostSavings.toLocaleString()}
                      </p>
                      <p className="text-[11px] font-semibold text-zinc-700 mt-1">Monthly Cost Savings</p>
                    </div>
                  </div>

                  <Link
                    href="/signup"
                    className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[#f95721] hover:bg-[#ea4815] py-3 text-xs font-bold text-white transition-colors shadow-md shadow-orange-500/20"
                  >
                    <span>Start Deflecting Today (Free)</span>
                    <ArrowRight className="size-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ==========================================
            ARCHITECTURAL COMPARISON MATRIX
            ========================================== */}
        <section className="py-20 border-t border-b border-zinc-200/80 bg-[#fbfbfb]">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto">
              <p className="text-xs font-mono font-semibold uppercase tracking-wider text-[#f95721]">
                // ARCHITECTURAL COMPARISON
              </p>
              <h2 className="mt-3 font-display text-3xl sm:text-4xl font-bold tracking-tight text-zinc-950">
                How Chatty compares to legacy platforms.
              </h2>
              <p className="mt-3 text-sm sm:text-base text-zinc-600">
                See why modern engineering and support teams are choosing an open-source, BYOK-first architecture.
              </p>
            </div>

            <div className="mt-12 overflow-x-auto max-w-5xl mx-auto rounded-2xl border border-zinc-200 bg-white shadow-sm">
              <table className="w-full text-left border-collapse min-w-[640px]">
                <thead>
                  <tr className="border-b border-zinc-200 text-xs font-mono uppercase tracking-wider text-zinc-500 bg-zinc-50">
                    <th className="py-4 px-5">Feature / Protocol</th>
                    <th className="py-4 px-5 bg-orange-50/70 text-[#f95721] font-bold border-l border-r border-orange-200">
                      Chatty (OSS)
                    </th>
                    <th className="py-4 px-5 text-zinc-600">Intercom Fin</th>
                    <th className="py-4 px-5 text-zinc-600">Zendesk AI</th>
                    <th className="py-4 px-5 text-zinc-600">Crisp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 text-xs">
                  {COMPARISONS.map((row) => (
                    <tr key={row.feature} className="hover:bg-zinc-50/60 transition-colors">
                      <td className="py-4 px-5 font-semibold text-zinc-900">{row.feature}</td>
                      <td className="py-4 px-5 bg-orange-50/50 font-bold text-[#f95721] border-l border-r border-orange-200">
                        {row.chatty}
                      </td>
                      <td className="py-4 px-5 text-zinc-600">{row.intercom}</td>
                      <td className="py-4 px-5 text-zinc-600">{row.zendesk}</td>
                      <td className="py-4 px-5 text-zinc-600">{row.crisp}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ==========================================
            TRANSPARENT PRICING TIERS
            ========================================== */}
        <section id="pricing" className="py-24 bg-white">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto">
              <p className="text-xs font-mono font-semibold uppercase tracking-wider text-[#f95721]">
                // TRANSPARENT PRICING
              </p>
              <h2 className="mt-3 font-display text-3xl sm:text-4xl font-bold tracking-tight text-zinc-950">
                Predictable plans. No hidden per-resolution tax.
              </h2>
              <p className="mt-3 text-sm sm:text-base text-zinc-600">
                Start completely free with your own API keys, or upgrade for managed AI credits, multi-bot fleets, and
                white-label branding.
              </p>

              {/* Monthly vs Annual Toggle */}
              <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-100 p-1 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setIsAnnual(false)}
                  className={`rounded-full px-4 py-1.5 transition-colors ${
                    !isAnnual ? "bg-white text-zinc-950 shadow-sm" : "text-zinc-600 hover:text-zinc-950"
                  }`}
                >
                  Monthly Billing
                </button>
                <button
                  type="button"
                  onClick={() => setIsAnnual(true)}
                  className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 transition-colors ${
                    isAnnual ? "bg-[#f95721] text-white shadow-sm" : "text-zinc-600 hover:text-zinc-950"
                  }`}
                >
                  <span>Annual Billing</span>
                  <span className="rounded bg-white/20 px-1.5 py-0.5 text-[10px] font-bold uppercase">
                    Save 20%
                  </span>
                </button>
              </div>
            </div>

            {/* Pricing Cards Grid */}
            <div className="mt-14 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch max-w-7xl mx-auto">
              {/* Plan 1: Free BYOK */}
              <div className="rounded-2xl border border-zinc-200 bg-white p-6 flex flex-col justify-between shadow-sm hover:shadow-md transition-all">
                <div>
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-500">Free BYOK</span>
                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="font-display text-4xl font-bold text-zinc-950">$0</span>
                    <span className="text-xs font-mono text-zinc-400">/ forever</span>
                  </div>
                  <p className="mt-2 text-xs text-zinc-600">Bring your own model keys with zero platform fee.</p>

                  <ul className="mt-6 space-y-2.5 text-xs text-zinc-700">
                    <li className="flex items-center gap-2">
                      <Check className="size-4 text-emerald-600 shrink-0" /> 1 Live Chatbot
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="size-4 text-emerald-600 shrink-0" /> Bring OpenAI, Anthropic, Gemini
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="size-4 text-emerald-600 shrink-0" /> Knowledge RAG training
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="size-4 text-emerald-600 shrink-0" /> Conversational lead capture
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="size-4 text-emerald-600 shrink-0" /> Zero token markup
                    </li>
                  </ul>
                </div>

                <Link
                  href="/signup"
                  className="mt-8 block w-full rounded-xl border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 py-2.5 text-center text-xs font-bold text-zinc-900 transition-all shadow-sm"
                >
                  Deploy Free BYOK
                </Link>
              </div>

              {/* Plan 2: Hobby */}
              <div className="rounded-2xl border border-zinc-200 bg-white p-6 flex flex-col justify-between shadow-sm hover:shadow-md transition-all">
                <div>
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-500">Hobby</span>
                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="font-display text-4xl font-bold text-zinc-950">{isAnnual ? "$15" : "$19"}</span>
                    <span className="text-xs font-mono text-zinc-400">/ mo</span>
                  </div>
                  <p className="mt-2 text-xs text-zinc-600">For indie builders & solo founders.</p>

                  <ul className="mt-6 space-y-2.5 text-xs text-zinc-700">
                    <li className="flex items-center gap-2">
                      <Check className="size-4 text-emerald-600 shrink-0" /> 3 Live Chatbots
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="size-4 text-emerald-600 shrink-0" /> Included AI message credits
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="size-4 text-emerald-600 shrink-0" /> 10M characters knowledge base
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="size-4 text-emerald-600 shrink-0" /> Analytics & visitor logs
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="size-4 text-emerald-600 shrink-0" /> Calendar booking integration
                    </li>
                  </ul>
                </div>

                <Link
                  href="/signup"
                  className="mt-8 block w-full rounded-xl border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 py-2.5 text-center text-xs font-bold text-zinc-900 transition-all shadow-sm"
                >
                  Get Started
                </Link>
              </div>

              {/* Plan 3: Standard (Highlighted) */}
              <div className="rounded-2xl border-2 border-[#f95721] bg-white p-6 flex flex-col justify-between shadow-xl relative">
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#f95721] px-3 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider text-white">
                  MOST POPULAR
                </span>

                <div>
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#f95721]">
                    Standard
                  </span>
                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="font-display text-4xl font-bold text-zinc-950">{isAnnual ? "$79" : "$99"}</span>
                    <span className="text-xs font-mono text-zinc-400">/ mo</span>
                  </div>
                  <p className="mt-2 text-xs text-zinc-600">For fast-growing SaaS & support teams.</p>

                  <ul className="mt-6 space-y-2.5 text-xs text-zinc-800">
                    <li className="flex items-center gap-2">
                      <Check className="size-4 text-[#f95721] shrink-0" /> 6 Live Chatbots
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="size-4 text-[#f95721] shrink-0" /> 10,000 Included AI credits
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="size-4 text-[#f95721] shrink-0" /> Daily auto-sync crawler
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="size-4 text-[#f95721] shrink-0" /> Remove &quot;Powered by Chatty&quot;
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="size-4 text-[#f95721] shrink-0" /> Unlimited team inbox members
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="size-4 text-[#f95721] shrink-0" /> Full MCP Server access
                    </li>
                  </ul>
                </div>

                <Link
                  href="/signup"
                  className="mt-8 block w-full rounded-xl bg-[#f95721] hover:bg-[#ea4815] py-2.5 text-center text-xs font-bold text-white transition-all shadow-md shadow-orange-500/20"
                >
                  Start 14-Day Free Trial
                </Link>
              </div>

              {/* Plan 4: Business */}
              <div className="rounded-2xl border border-zinc-200 bg-white p-6 flex flex-col justify-between shadow-sm hover:shadow-md transition-all">
                <div>
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-500">Business</span>
                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="font-display text-4xl font-bold text-zinc-950">{isAnnual ? "$319" : "$399"}</span>
                    <span className="text-xs font-mono text-zinc-400">/ mo</span>
                  </div>
                  <p className="mt-2 text-xs text-zinc-600">For high-volume enterprises & agencies.</p>

                  <ul className="mt-6 space-y-2.5 text-xs text-zinc-700">
                    <li className="flex items-center gap-2">
                      <Check className="size-4 text-emerald-600 shrink-0" /> Unlimited Chatbots
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="size-4 text-emerald-600 shrink-0" /> 40,000 Included AI credits
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="size-4 text-emerald-600 shrink-0" /> 50M characters knowledge base
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="size-4 text-emerald-600 shrink-0" /> Full white-label controls
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="size-4 text-emerald-600 shrink-0" /> Management API & Webhooks
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="size-4 text-emerald-600 shrink-0" /> Priority 99.9% uptime SLA
                    </li>
                  </ul>
                </div>

                <Link
                  href="/signup"
                  className="mt-8 block w-full rounded-xl border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 py-2.5 text-center text-xs font-bold text-zinc-900 transition-all shadow-sm"
                >
                  Deploy Business
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ==========================================
            SEO FAQ ACCORDION SECTION
            ========================================== */}
        <section id="faq" className="py-20 border-t border-zinc-200/80 bg-[#fbfbfb]">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <p className="text-xs font-mono font-semibold uppercase tracking-wider text-[#f95721]">
                // FREQUENTLY ASKED QUESTIONS
              </p>
              <h2 className="mt-3 font-display text-3xl sm:text-4xl font-bold tracking-tight text-zinc-950">
                Everything you need to know about Chatty.
              </h2>
            </div>

            <div className="mt-12 space-y-3">
              {FAQS.map((faq, index) => {
                const isOpen = openFaqIndex === index;
                return (
                  <div
                    key={faq.q}
                    className="rounded-xl border border-zinc-200 bg-white overflow-hidden shadow-sm transition-colors"
                  >
                    <button
                      type="button"
                      onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                      className="flex w-full items-center justify-between p-5 text-left text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
                    >
                      <span>{faq.q}</span>
                      <ChevronDown
                        className={`size-4 text-zinc-400 transition-transform duration-200 shrink-0 ml-4 ${
                          isOpen ? "rotate-180 text-[#f95721]" : ""
                        }`}
                      />
                    </button>
                    {isOpen && (
                      <div className="px-5 pb-5 pt-1 text-xs text-zinc-600 leading-relaxed border-t border-zinc-100">
                        {faq.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ==========================================
            PRE-FOOTER CALL TO ACTION (Vibrant Warm Orange)
            ========================================== */}
        <section className="py-20 bg-white">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
            <div className="rounded-3xl bg-[#f95721] p-8 sm:p-14 max-w-4xl mx-auto shadow-2xl shadow-orange-500/30 text-white relative overflow-hidden">
              <h2 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight max-w-2xl mx-auto">
                Ready to automate customer support with zero hallucinations?
              </h2>
              <p className="mt-4 text-sm sm:text-base text-orange-100 max-w-xl mx-auto">
                Deploy your first grounded website assistant in under 3 minutes. Zero coding required.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                  href="/signup"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-white text-[#f95721] hover:bg-orange-50 px-8 py-3.5 text-sm font-bold shadow-md transition-all"
                >
                  <span>Start free</span>
                  <ArrowRight className="size-4" />
                </Link>
                <Link
                  href="https://github.com/Damayantha/chatty"
                  target="_blank"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-white/40 bg-white/10 hover:bg-white/20 px-6 py-3.5 text-sm font-semibold text-white transition-all"
                >
                  <span>⭐ Star on GitHub</span>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ==========================================
          FOOTER (Clean Light Theme with All Existing Links)
          ========================================== */}
      <footer className="border-t border-zinc-200 bg-white py-14 text-xs text-zinc-600">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
            {/* Brand Column */}
            <div className="col-span-2 space-y-4">
              <Link href="/" className="flex items-center gap-2.5">
                <Image src="/favicon.png" alt="Chatty Logo" width={24} height={24} className="object-contain" />
                <span className="font-display text-lg font-bold text-zinc-950">Chatty</span>
              </Link>
              <p className="text-xs text-zinc-500 leading-relaxed max-w-sm">
                Autonomous conversational AI that grounds support on real business data, captures qualified leads,
                and books meetings in-chat. Open source & BYOK-ready.
              </p>
              <div className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-[11px] font-mono text-zinc-700">
                <span className="size-2 rounded-full bg-emerald-500" />
                <span>All systems operational · 99.98% uptime</span>
              </div>
            </div>

            {/* Column: Product */}
            <div className="space-y-3">
              <p className="font-mono text-xs font-bold uppercase tracking-wider text-zinc-950">Product</p>
              <ul className="space-y-2">
                <li><Link href="#playground" className="hover:text-zinc-950 transition-colors">Playground</Link></li>
                <li><Link href="#capabilities" className="hover:text-zinc-950 transition-colors">Grounded RAG</Link></li>
                <li><Link href="#pricing" className="hover:text-zinc-950 transition-colors">Pricing</Link></li>
                <li><Link href="/affiliates" className="hover:text-zinc-950 transition-colors">Affiliates Program</Link></li>
                <li><Link href="/dashboard" className="hover:text-zinc-950 transition-colors">Dashboard</Link></li>
              </ul>
            </div>

            {/* Column: Resources */}
            <div className="space-y-3">
              <p className="font-mono text-xs font-bold uppercase tracking-wider text-zinc-950">Resources</p>
              <ul className="space-y-2">
                <li><Link href="https://docs.chatty.personaliai.com" target="_blank" className="hover:text-zinc-950 transition-colors">Documentation</Link></li>
                <li><Link href="https://github.com/Damayantha/chatty" target="_blank" className="hover:text-zinc-950 transition-colors">GitHub Repository</Link></li>
                <li><Link href="/support" className="hover:text-zinc-950 transition-colors">Support Center</Link></li>
                <li><Link href="/voice-demo" className="hover:text-zinc-950 transition-colors">Voice AI Demo</Link></li>
                <li><Link href="/zoom" className="hover:text-zinc-950 transition-colors">Zoom Integration</Link></li>
              </ul>
            </div>

            {/* Column: Legal & Company */}
            <div className="space-y-3">
              <p className="font-mono text-xs font-bold uppercase tracking-wider text-zinc-950">Legal & Company</p>
              <ul className="space-y-2">
                <li><Link href="/privacy" className="hover:text-zinc-950 transition-colors">Privacy Policy</Link></li>
                <li><Link href="/terms" className="hover:text-zinc-950 transition-colors">Terms of Service</Link></li>
                <li><Link href="mailto:support@personaliai.com" className="hover:text-zinc-950 transition-colors">Contact Support</Link></li>
                <li><Link href="https://twitter.com/personaliai" target="_blank" className="hover:text-zinc-950 transition-colors">Twitter / X</Link></li>
                <li><Link href="/login" className="hover:text-zinc-950 transition-colors">Sign In</Link></li>
              </ul>
            </div>
          </div>

          <div className="mt-12 pt-6 border-t border-zinc-200 flex flex-col sm:flex-row items-center justify-between text-[11px] text-zinc-500 gap-4">
            <p>© {new Date().getFullYear()} PersonaliAI. All rights reserved.</p>
            <p className="font-mono text-zinc-500">Built for precision customer communication.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
