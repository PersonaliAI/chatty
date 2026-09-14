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
// STATIC DATA & DEFINITIONS
// ==========================================

const MEGA_MENU_PRODUCTS = [
  {
    title: "Autonomous Agent Fleet",
    badge: "Core",
    items: [
      {
        icon: Database,
        title: "Grounded Knowledge RAG",
        desc: "Strict cosine thresholding with zero hallucinations and verified source citations.",
        href: "#architecture",
      },
      {
        icon: CalendarCheck,
        title: "In-Chat Calendar Booking",
        desc: "Google Calendar & Outlook slot picker embedded directly into live chat conversations.",
        href: "#simulator",
      },
      {
        icon: MousePointerClick,
        title: "Intent Lead Capture",
        desc: "Naturally collect verified email, company, and purchase intent without clunky forms.",
        href: "#capabilities",
      },
      {
        icon: Inbox,
        title: "Omnichannel Team Inbox",
        desc: "Live visitor monitoring, sentiment alerts, and 1-click human takeover lock.",
        href: "#capabilities",
      },
    ],
  },
  {
    title: "Developer Platform & Protocol",
    badge: "Open Source",
    items: [
      {
        icon: PlugZap,
        title: "Model Context Protocol (MCP)",
        desc: "Native MCP server for Claude Desktop, Cursor, and autonomous agent orchestration.",
        href: "#mcp",
      },
      {
        icon: Cpu,
        title: "Zero-Markup BYOK Engine",
        desc: "Bring your own OpenAI, Anthropic, Gemini, or OpenRouter keys with zero platform fee.",
        href: "#pricing",
      },
      {
        icon: Terminal,
        title: "Management API & Webhooks",
        desc: "Full programmatic control over bots, training data, leads, and transcript exports.",
        href: "https://docs.chatty.personaliai.com",
      },
      {
        icon: Code2,
        title: "Public GitHub Repository",
        desc: "Inspect source code, self-host via Docker, or contribute to the open-source community.",
        href: "https://github.com/Damayantha/chatty",
      },
    ],
  },
];

const AGENT_NODES = [
  {
    id: "rag",
    name: "Knowledge RAG Agent",
    tag: "pgvector · Cosine 0.78",
    status: "Active",
    desc: "Retrieves verified chunks from crawled sitemaps, docs, and PDFs with strict grounding guardrails.",
    metric: "99.4% Grounding Accuracy",
    samplePayload: {
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
    samplePayload: {
      integration: "Google Calendar v3",
      timezone: "America/New_York",
      available_slots: ["10:00 AM", "02:30 PM", "04:00 PM"],
      confirmation: "Auto-invite dispatched",
    },
  },
  {
    id: "leads",
    name: "Lead Qualification Agent",
    tag: "Progressive Enrichment",
    status: "Active",
    desc: "Evaluates conversational intent, extracts company domain, and routes qualified buyers to CRM.",
    metric: "3.4x Higher Conversion",
    samplePayload: {
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
    samplePayload: {
      sentiment_score: "Frustrated (-0.72)",
      trigger: "Billing discrepancy detected",
      action: "AI reply paused · Human assigned",
    },
  },
  {
    id: "mcp",
    name: "MCP Fleet Operator",
    tag: "Claude · Cursor Tools",
    status: "Ready",
    desc: "Enables external AI agents to query analytics, train new sources, and trigger customer broadcasts.",
    metric: "18 Native Tool Definitions",
    samplePayload: {
      protocol: "Model Context Protocol v1.0",
      active_clients: ["Cursor", "Claude Desktop"],
      permissions: "Bots:ReadWrite, Leads:Read",
    },
  },
];

const SIMULATOR_PROMPTS = [
  {
    id: "calendar",
    pill: "Demo Calendar Booking",
    query: "I want to see a live demo of Chatty with our engineering team. Do you have 15 minutes this week?",
    response:
      "I'd love to set that up! You can pick an open slot with our solutions engineering team directly on my calendar below. Timezones are automatically synchronized with your browser.",
    hasCalendar: true,
    citations: ["personaliai.com/team-schedule", "calendar.personaliai.com/se-demo"],
  },
  {
    id: "pricing",
    pill: "Compare Intercom & Crisp",
    query: "How does Chatty compare to Intercom Fin and Crisp on pricing and AI markup?",
    response:
      "Unlike Intercom Fin which charges $0.99 for every single AI resolution on top of heavy seat fees, Chatty offers a Free BYOK (Bring Your Own Key) tier with zero token markup. Our paid plans start at a predictable flat rate ($19 - $99/mo) with full calendar booking, lead capture, and MCP tooling included.",
    hasCalendar: false,
    citations: ["personaliai.com/pricing", "docs.chatty.personaliai.com/byok-guide"],
  },
  {
    id: "byok",
    pill: "Zero-Markup BYOK Setup",
    query: "Can I connect my own OpenAI, Gemini, or Anthropic API key without platform fees?",
    response:
      "Yes. With Chatty's BYOK architecture, you paste your provider API key into the dashboard. We stream tokens directly between your provider and your visitors. We charge zero platform markup on your tokens, giving you full control over rate limits and enterprise discounts.",
    hasCalendar: false,
    citations: ["docs.chatty.personaliai.com/providers/byok", "github.com/Damayantha/chatty"],
  },
];

const METRICS = [
  { label: "First Token Latency", value: "< 400ms", detail: "Streaming pgvector RAG pipeline" },
  { label: "Ticket Deflection Rate", value: "84%", detail: "Autonomous first-contact resolution" },
  { label: "Cross-Lingual Reasoning", value: "95+", detail: "Native multilingual embeddings" },
  { label: "Free BYOK Tier", value: "$0", detail: "Zero platform markup on your API keys" },
];

const COMPARISON_ROWS = [
  {
    feature: "Open-Source & Self-Hostable",
    chatty: "Full GitHub Repo & Docker",
    intercom: "Closed Proprietary",
    zendesk: "Closed Proprietary",
    crisp: "Closed Proprietary",
    chattyHighlight: true,
  },
  {
    feature: "Zero-Markup BYOK (OpenAI/Anthropic)",
    chatty: "Included Free Forever",
    intercom: "Not Supported",
    zendesk: "Not Supported",
    crisp: "Not Supported",
    chattyHighlight: true,
  },
  {
    feature: "Native In-Chat Calendar Booking",
    chatty: "Google & Outlook Direct",
    intercom: "Paid App Add-on",
    zendesk: "Third-party redirect",
    crisp: "Third-party redirect",
    chattyHighlight: true,
  },
  {
    feature: "Model Context Protocol (MCP) Server",
    chatty: "Official Native Tools",
    intercom: "No MCP support",
    zendesk: "No MCP support",
    crisp: "No MCP support",
    chattyHighlight: true,
  },
  {
    feature: "Grounded Anti-Hallucination Citations",
    chatty: "Strict Cosine + Direct URL",
    intercom: "Basic Fin Summary",
    zendesk: "Generic KB search",
    crisp: "Generic KB search",
    chattyHighlight: true,
  },
  {
    feature: "Pricing Model",
    chatty: "Flat Rate or Free BYOK",
    intercom: "$39/seat + $0.99/resolution",
    zendesk: "$55/seat + AI add-on",
    crisp: "$95/mo + limited AI",
    chattyHighlight: true,
  },
];

const FAQS = [
  {
    q: "How fast can I deploy Chatty on my live website?",
    a: "Most teams are fully live in under 3 minutes. Simply create an account, paste your website URL or upload your help documentation, let our crawler index your knowledge chunks, and copy-paste one `<script>` snippet into your HTML head or Google Tag Manager.",
  },
  {
    q: "How does Chatty guarantee zero hallucinations?",
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
// SUB-COMPONENTS
// ==========================================

function GithubStarIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56 0-.27-.01-1.17-.02-2.12-3.2.7-3.87-1.36-3.87-1.36-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.7.08-.7 1.17.08 1.78 1.2 1.78 1.2 1.03 1.77 2.71 1.26 3.37.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.05 11.05 0 0 1 5.79 0c2.2-1.49 3.17-1.18 3.17-1.18.64 1.59.24 2.76.12 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.69 5.38-5.25 5.67.41.36.78 1.07.78 2.15 0 1.55-.01 2.8-.01 3.18 0 .31.21.67.8.56A10.51 10.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
    </svg>
  );
}

// ==========================================
// MAIN LANDING CLIENT COMPONENT
// ==========================================

export default function LandingClient() {
  // Navigation & Mega-Menu State
  const [isMegaMenuOpen, setIsMegaMenuOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Agent Architecture Node Switcher
  const [activeNodeId, setActiveNodeId] = useState("rag");
  const activeNode = useMemo(
    () => AGENT_NODES.find((n) => n.id === activeNodeId) || AGENT_NODES[0],
    [activeNodeId]
  );

  // Simulator State
  const [selectedPrompt, setSelectedPrompt] = useState(SIMULATOR_PROMPTS[0]);
  const [simulatedSlot, setSimulatedSlot] = useState<string | null>(null);
  const [bookingConfirmed, setBookingConfirmed] = useState(false);
  const [isTyping, setIsTyping] = useState(false);

  // Switch prompt with simulated typing latency
  const handleSelectPrompt = (prompt: typeof SIMULATOR_PROMPTS[0]) => {
    setSelectedPrompt(prompt);
    setSimulatedSlot(null);
    setBookingConfirmed(false);
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
    }, 350);
  };

  // ROI Calculator State
  const [monthlyVisitors, setMonthlyVisitors] = useState(25000);
  const [monthlyTickets, setMonthlyTickets] = useState(1200);

  // Calculated ROI Metrics
  const calculatedMetrics = useMemo(() => {
    const deflectedTickets = Math.round(monthlyTickets * 0.84);
    const hoursSaved = Math.round((deflectedTickets * 14) / 60); // 14 mins avg handle time
    const leadsCaptured = Math.round(monthlyVisitors * 0.038); // 3.8% conversion
    const estimatedCostSavings = Math.round(deflectedTickets * 3.4); // ~$3.40 avg cost per tier 1 ticket
    return {
      deflectedTickets,
      hoursSaved,
      leadsCaptured,
      estimatedCostSavings,
    };
  }, [monthlyVisitors, monthlyTickets]);

  // Pricing Billing Toggle
  const [isAnnual, setIsAnnual] = useState(true);

  // FAQ Accordion State
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  // Close mega-menu on escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsMegaMenuOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="min-h-screen bg-[#090a0f] text-zinc-100 font-sans selection:bg-[#facc15] selection:text-black antialiased">
      {/* ==========================================
          HEADER & INDUSTRIAL MEGA-MENU
          ========================================== */}
      <header className="sticky top-0 z-50 border-b border-white/[0.08] bg-[#090a0f]/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Logo & Version Tag */}
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2.5 focus:outline-none">
              <div className="relative flex size-8 items-center justify-center rounded-lg border border-white/10 bg-[#131722]">
                <Image
                  src="/favicon.png"
                  alt="Chatty Logo"
                  width={22}
                  height={22}
                  className="object-contain"
                  priority
                />
              </div>
              <span className="font-display text-lg font-bold tracking-tight text-white">Chatty</span>
            </Link>
            <span className="hidden sm:inline-flex items-center gap-1.5 rounded border border-white/10 bg-[#131722] px-2 py-0.5 text-[11px] font-mono text-zinc-400">
              <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
              v2.4.0 · OSS
            </span>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 text-sm font-medium text-zinc-300">
            {/* Products Mega-Menu Button */}
            <div
              className="relative"
              onMouseEnter={() => setIsMegaMenuOpen(true)}
              onMouseLeave={() => setIsMegaMenuOpen(false)}
            >
              <button
                type="button"
                onClick={() => setIsMegaMenuOpen(!isMegaMenuOpen)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors ${
                  isMegaMenuOpen ? "text-white bg-white/[0.06]" : "hover:text-white hover:bg-white/[0.04]"
                }`}
                aria-expanded={isMegaMenuOpen}
              >
                <span>Products</span>
                <ChevronDown
                  className={`size-3.5 text-zinc-400 transition-transform duration-200 ${
                    isMegaMenuOpen ? "rotate-180 text-yellow-400" : ""
                  }`}
                />
              </button>

              {/* Mega-Menu Dropdown Panel */}
              {isMegaMenuOpen && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 pt-2 w-[720px] transition-all duration-150">
                  <div className="rounded-2xl border border-white/[0.12] bg-[#0d0f17] p-6 shadow-2xl shadow-black/80">
                    <div className="grid grid-cols-2 gap-8">
                      {MEGA_MENU_PRODUCTS.map((col) => (
                        <div key={col.title}>
                          <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
                            <span className="text-xs font-mono font-semibold uppercase tracking-wider text-zinc-400">
                              {col.title}
                            </span>
                            <span className="rounded bg-white/[0.08] px-1.5 py-0.5 text-[10px] font-mono text-zinc-300">
                              {col.badge}
                            </span>
                          </div>
                          <div className="mt-3 space-y-1">
                            {col.items.map((item) => {
                              const Icon = item.icon;
                              return (
                                <Link
                                  key={item.title}
                                  href={item.href}
                                  onClick={() => setIsMegaMenuOpen(false)}
                                  className="group flex items-start gap-3 rounded-xl p-2.5 transition-colors hover:bg-white/[0.05]"
                                >
                                  <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-[#141824] text-zinc-300 group-hover:border-yellow-400/50 group-hover:text-yellow-400 transition-colors">
                                    <Icon className="size-4" />
                                  </div>
                                  <div>
                                    <p className="text-xs font-semibold text-white group-hover:text-yellow-300 transition-colors">
                                      {item.title}
                                    </p>
                                    <p className="text-[11px] leading-relaxed text-zinc-400 line-clamp-2">
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
                    {/* Mega Menu Footer Banner */}
                    <div className="mt-5 pt-4 border-t border-white/[0.06] flex items-center justify-between text-xs text-zinc-400">
                      <div className="flex items-center gap-2">
                        <span className="size-2 rounded-full bg-emerald-400" />
                        <span>Zero hallucinations with strict cosine distance cutoff</span>
                      </div>
                      <Link
                        href="https://github.com/Damayantha/chatty"
                        target="_blank"
                        className="inline-flex items-center gap-1 font-mono text-yellow-400 hover:text-yellow-300"
                      >
                        <span>GitHub Repository</span>
                        <ChevronRight className="size-3" />
                      </Link>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <Link href="#architecture" className="px-3 py-1.5 rounded-md hover:text-white hover:bg-white/[0.04]">
              Architecture
            </Link>
            <Link href="#simulator" className="px-3 py-1.5 rounded-md hover:text-white hover:bg-white/[0.04]">
              Simulator
            </Link>
            <Link href="#calculator" className="px-3 py-1.5 rounded-md hover:text-white hover:bg-white/[0.04]">
              ROI Calculator
            </Link>
            <Link href="#pricing" className="px-3 py-1.5 rounded-md hover:text-white hover:bg-white/[0.04]">
              Pricing
            </Link>
            <Link
              href="https://docs.chatty.personaliai.com"
              target="_blank"
              className="px-3 py-1.5 rounded-md hover:text-white hover:bg-white/[0.04]"
            >
              Docs
            </Link>
          </nav>

          {/* Right Action Items */}
          <div className="hidden sm:flex items-center gap-3">
            {/* GitHub Repo Button */}
            <Link
              href="https://github.com/Damayantha/chatty"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-[#131722] px-3 py-1.5 text-xs font-medium text-zinc-300 hover:border-white/20 hover:text-white transition-colors"
            >
              <GithubStarIcon className="size-3.5" />
              <span>Star</span>
              <span className="border-l border-white/10 pl-1.5 font-mono text-[11px] text-zinc-400">1.2k</span>
            </Link>

            {/* Sign In Link */}
            <Link
              href="/auth/login"
              className="text-xs font-medium text-zinc-300 hover:text-white px-2 py-1.5 transition-colors"
            >
              Sign In
            </Link>

            {/* Primary Solar Yellow CTA Button */}
            <Link
              href="/auth/login"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#facc15] px-4 py-1.5 text-xs font-semibold text-black hover:bg-[#eab308] active:scale-[0.98] transition-all"
            >
              <span>Deploy Free</span>
              <ArrowRight className="size-3.5" />
            </Link>
          </div>

          {/* Mobile Menu Toggle */}
          <div className="flex sm:hidden items-center gap-2">
            <Link
              href="/auth/login"
              className="rounded-lg bg-[#facc15] px-3 py-1 text-xs font-semibold text-black"
            >
              Deploy
            </Link>
            <button
              type="button"
              onClick={() => setMobileNavOpen(!mobileNavOpen)}
              className="p-1.5 text-zinc-400 hover:text-white"
            >
              {mobileNavOpen ? <X className="size-6" /> : <Menu className="size-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileNavOpen && (
          <div className="sm:hidden border-b border-white/[0.08] bg-[#0d0f17] px-4 py-5 space-y-3">
            <Link
              href="#architecture"
              onClick={() => setMobileNavOpen(false)}
              className="block text-sm font-medium text-zinc-300 py-1"
            >
              Architecture
            </Link>
            <Link
              href="#simulator"
              onClick={() => setMobileNavOpen(false)}
              className="block text-sm font-medium text-zinc-300 py-1"
            >
              Simulator
            </Link>
            <Link
              href="#calculator"
              onClick={() => setMobileNavOpen(false)}
              className="block text-sm font-medium text-zinc-300 py-1"
            >
              ROI Calculator
            </Link>
            <Link
              href="#pricing"
              onClick={() => setMobileNavOpen(false)}
              className="block text-sm font-medium text-zinc-300 py-1"
            >
              Pricing
            </Link>
            <Link
              href="https://docs.chatty.personaliai.com"
              target="_blank"
              className="block text-sm font-medium text-zinc-300 py-1"
            >
              Documentation
            </Link>
            <Link
              href="https://github.com/Damayantha/chatty"
              target="_blank"
              className="flex items-center gap-2 text-sm font-medium text-zinc-300 py-1"
            >
              <GithubStarIcon className="size-4" />
              <span>GitHub (1.2k Stars)</span>
            </Link>
            <div className="pt-3 border-t border-white/[0.08] flex items-center justify-between">
              <Link href="/auth/login" className="text-sm font-medium text-zinc-300">
                Sign In
              </Link>
              <Link
                href="/auth/login"
                className="rounded-lg bg-[#facc15] px-4 py-2 text-xs font-semibold text-black"
              >
                Deploy Free Assistant
              </Link>
            </div>
          </div>
        )}
      </header>

      <main>
        {/* ==========================================
            HERO SECTION (High Impact, Solid, Zero Gradient)
            ========================================== */}
        <section className="relative overflow-hidden pt-12 pb-20 sm:pt-16 sm:pb-28 lg:pt-20">
          {/* Subtle Industrial Grid Background Pattern */}
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.03]"
            style={{
              backgroundImage: `linear-gradient(#ffffff 1px, transparent 1px), linear-gradient(to right, #ffffff 1px, transparent 1px)`,
              backgroundSize: "48px 48px",
            }}
          />

          <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
            {/* Status Pill Badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#131722] px-3.5 py-1 text-xs font-mono text-zinc-300 shadow-sm">
              <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-zinc-400">OPEN-SOURCE CONVERSATIONAL AI</span>
              <span className="text-zinc-600">·</span>
              <span className="text-yellow-400 font-semibold">ZERO HALLUCINATIONS</span>
              <span className="text-zinc-600">·</span>
              <span>FREE BYOK</span>
            </div>

            {/* Industrial Headline */}
            <h1 className="mt-6 font-display text-4xl font-extrabold tracking-tight text-white sm:text-6xl lg:text-7xl max-w-5xl mx-auto leading-[1.08]">
              Autonomous customer support that captures leads and books meetings.
            </h1>

            {/* High-Converting Subtitle */}
            <p className="mt-6 max-w-3xl mx-auto text-base sm:text-lg text-zinc-400 leading-relaxed font-normal">
              Chatty grounds autonomous AI agents on your real business data—website sitemaps, help documents,
              and APIs. Resolve <span className="text-white font-medium">84%+ of customer inquiries</span>, book demo
              slots directly inside live chat, and hand off seamlessly to humans.
            </p>

            {/* CTA Buttons Row */}
            <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/auth/login"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-[#facc15] px-7 py-3.5 text-sm font-bold text-black shadow-lg hover:bg-[#eab308] active:scale-[0.98] transition-all"
              >
                <span>Deploy Free Assistant</span>
                <ArrowRight className="size-4" />
              </Link>
              <Link
                href="https://github.com/Damayantha/chatty"
                target="_blank"
                rel="noreferrer"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-[#12151f] px-6 py-3.5 text-sm font-semibold text-zinc-200 hover:border-white/25 hover:text-white transition-all"
              >
                <GithubStarIcon className="size-4 text-zinc-400" />
                <span>Inspect GitHub Source</span>
              </Link>
              <Link
                href="#simulator"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-transparent px-5 py-3.5 text-sm font-semibold text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                <Play className="size-3.5 fill-current" />
                <span>Test Live Simulator</span>
              </Link>
            </div>

            {/* Micro Trust Signals */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-mono text-zinc-400">
              <span className="flex items-center gap-1.5">
                <Check className="size-3.5 text-emerald-400" /> No credit card required
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="size-3.5 text-emerald-400" /> Free BYOK tier forever
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="size-3.5 text-emerald-400" /> 2-minute embed script
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="size-3.5 text-emerald-400" /> Native MCP server support
              </span>
            </div>

            {/* ==========================================
                TECHNICAL METRICS STRIP
                ========================================== */}
            <div className="mt-14 grid grid-cols-2 gap-4 lg:grid-cols-4 max-w-5xl mx-auto">
              {METRICS.map((m) => (
                <div
                  key={m.label}
                  className="rounded-xl border border-white/[0.08] bg-[#0e1017] p-5 text-left transition-colors hover:border-white/20"
                >
                  <p className="font-mono text-2xl sm:text-3xl font-bold tracking-tight text-white">{m.value}</p>
                  <p className="mt-1 text-xs font-semibold text-yellow-400/90">{m.label}</p>
                  <p className="mt-1 text-[11px] text-zinc-400 leading-tight">{m.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ==========================================
            CONNECTED AGENT NODE ARCHITECTURE
            (Inspired by Nimble's agent ecosystem)
            ========================================== */}
        <section id="architecture" className="py-20 border-t border-b border-white/[0.08] bg-[#0c0d12]">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto">
              <p className="text-xs font-mono font-semibold uppercase tracking-wider text-yellow-400">
                // MULTI-AGENT ORCHESTRATION PIPELINE
              </p>
              <h2 className="mt-3 font-display text-3xl sm:text-4xl font-bold tracking-tight text-white">
                How Chatty coordinates specialized AI agents.
              </h2>
              <p className="mt-3 text-sm sm:text-base text-zinc-400">
                Instead of a single brittle prompt, incoming visitor messages pass through specialized autonomous
                agents for vector retrieval, calendar coordination, CRM enrichment, and human fallback.
              </p>
            </div>

            {/* Visual Node Workflow Stage */}
            <div className="mt-12 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: Interactive Agent Selector Buttons */}
              <div className="lg:col-span-5 space-y-3">
                {AGENT_NODES.map((node) => {
                  const isSelected = node.id === activeNodeId;
                  return (
                    <button
                      key={node.id}
                      type="button"
                      onClick={() => setActiveNodeId(node.id)}
                      className={`w-full text-left p-4 rounded-xl border transition-all ${
                        isSelected
                          ? "border-yellow-400/60 bg-[#151926] shadow-lg shadow-black/40"
                          : "border-white/[0.08] bg-[#0f111a] hover:border-white/20 hover:bg-[#121520]"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-sm text-white">{node.name}</span>
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                            isSelected
                              ? "bg-yellow-400/10 text-yellow-400 border-yellow-400/30"
                              : "bg-white/[0.04] text-zinc-400 border-white/10"
                          }`}
                        >
                          {node.tag}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-zinc-400 leading-relaxed">{node.desc}</p>
                      <div className="mt-3 flex items-center justify-between text-[11px] font-mono">
                        <span className="text-emerald-400 flex items-center gap-1">
                          <span className="size-1.5 rounded-full bg-emerald-400" />
                          {node.status}
                        </span>
                        <span className="text-zinc-300 font-medium">{node.metric}</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Right Column: Active Node Telemetry & JSON Inspector */}
              <div className="lg:col-span-7 rounded-2xl border border-white/[0.12] bg-[#090b10] p-6 shadow-2xl">
                <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
                  <div className="flex items-center gap-2">
                    <span className="size-2.5 rounded-full bg-red-500/80" />
                    <span className="size-2.5 rounded-full bg-yellow-500/80" />
                    <span className="size-2.5 rounded-full bg-green-500/80" />
                    <span className="ml-2 font-mono text-xs text-zinc-400">
                      agent_telemetry :: {activeNode.id}.spec.json
                    </span>
                  </div>
                  <span className="rounded bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-mono text-emerald-400">
                    REALTIME DISPATCHED
                  </span>
                </div>

                <div className="mt-5 space-y-4">
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <span>{activeNode.name}</span>
                      <span className="text-xs font-mono font-normal text-zinc-400">({activeNode.tag})</span>
                    </h3>
                    <p className="mt-1 text-xs text-zinc-400 leading-relaxed">{activeNode.desc}</p>
                  </div>

                  {/* Architecture Diagram Representation */}
                  <div className="rounded-xl border border-white/[0.06] bg-[#06070a] p-4">
                    <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400 mb-3">
                      <span>DATA PIPELINE TRACE</span>
                      <span className="text-yellow-400">Active Stage</span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="rounded-lg border border-white/10 bg-[#0d0f17] p-2.5">
                        <span className="block text-[10px] font-mono text-zinc-400">STAGE 01</span>
                        <span className="font-semibold text-white">Ingestion</span>
                      </div>
                      <div className="rounded-lg border border-yellow-400/40 bg-yellow-400/5 p-2.5">
                        <span className="block text-[10px] font-mono text-yellow-400">STAGE 02</span>
                        <span className="font-semibold text-yellow-300">{activeNode.name.split(" ")[0]}</span>
                      </div>
                      <div className="rounded-lg border border-white/10 bg-[#0d0f17] p-2.5">
                        <span className="block text-[10px] font-mono text-zinc-400">STAGE 03</span>
                        <span className="font-semibold text-white">Resolution</span>
                      </div>
                    </div>
                  </div>

                  {/* JSON Payload Inspector */}
                  <div>
                    <p className="text-[11px] font-mono text-zinc-400 uppercase mb-2">Live Agent Payload & Context:</p>
                    <pre className="rounded-xl border border-white/[0.08] bg-[#050608] p-4 font-mono text-xs text-emerald-400 overflow-x-auto">
                      {JSON.stringify(activeNode.samplePayload, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ==========================================
            INTERACTIVE ASSISTANT SIMULATOR
            (Replacing passive video with live interactive product stage)
            ========================================== */}
        <section id="simulator" className="py-24 bg-[#090a0f] relative overflow-hidden">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto">
              <p className="text-xs font-mono font-semibold uppercase tracking-wider text-yellow-400">
                // INTERACTIVE PRODUCT STAGE
              </p>
              <h2 className="mt-3 font-display text-3xl sm:text-4xl font-bold tracking-tight text-white">
                Experience Chatty live in your browser.
              </h2>
              <p className="mt-3 text-sm sm:text-base text-zinc-400">
                Click any prompt pill below to test live vector retrieval, citation grounding, and frictionless
                in-chat calendar scheduling.
              </p>
            </div>

            {/* Prompt Selector Pills */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              {SIMULATOR_PROMPTS.map((p) => {
                const isActive = p.id === selectedPrompt.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelectPrompt(p)}
                    className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition-all ${
                      isActive
                        ? "bg-[#facc15] text-black shadow-md shadow-yellow-500/10"
                        : "border border-white/10 bg-[#121520] text-zinc-300 hover:border-white/20 hover:text-white"
                    }`}
                  >
                    <Sparkles className="size-3" />
                    <span>{p.pill}</span>
                  </button>
                );
              })}
            </div>

            {/* The Dual-Pane Command Simulator */}
            <div className="mt-10 rounded-2xl border border-white/[0.12] bg-[#0c0e15] shadow-2xl overflow-hidden max-w-5xl mx-auto">
              {/* Simulator Window Header */}
              <div className="flex items-center justify-between border-b border-white/[0.08] bg-[#11131c] px-5 py-3 text-xs">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="size-3 rounded-full bg-red-500/80" />
                    <span className="size-3 rounded-full bg-yellow-500/80" />
                    <span className="size-3 rounded-full bg-green-500/80" />
                  </div>
                  <span className="font-mono text-zinc-400">chatty-widget-v2 :: runtime_environment</span>
                </div>
                <div className="flex items-center gap-3 font-mono text-[11px] text-zinc-400">
                  <span className="hidden sm:inline">Stream Latency: <strong className="text-emerald-400">182ms</strong></span>
                  <span className="inline-flex items-center gap-1 text-yellow-400">
                    <ShieldCheck className="size-3.5" />
                    Grounding: 100%
                  </span>
                </div>
              </div>

              {/* Dual-Pane Layout */}
              <div className="grid grid-cols-1 md:grid-cols-12">
                {/* Left Pane: Ingested Knowledge Health */}
                <div className="md:col-span-4 border-b md:border-b-0 md:border-r border-white/[0.08] bg-[#0a0c12] p-5">
                  <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
                    <span className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-300">
                      Ingested Sources
                    </span>
                    <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
                      LIVE SYNC
                    </span>
                  </div>

                  <div className="mt-4 space-y-3">
                    <div className="rounded-lg border border-white/[0.06] bg-[#10131d] p-3 text-xs">
                      <div className="flex items-center justify-between font-semibold text-white">
                        <span className="flex items-center gap-2 truncate">
                          <Globe2 className="size-3.5 text-sky-400 shrink-0" />
                          <span>personaliai.com/docs</span>
                        </span>
                        <span className="font-mono text-[10px] text-zinc-400">1,248 chunks</span>
                      </div>
                      <p className="mt-1 text-[11px] text-zinc-400">Auto-crawled sitemap & API endpoints</p>
                    </div>

                    <div className="rounded-lg border border-white/[0.06] bg-[#10131d] p-3 text-xs">
                      <div className="flex items-center justify-between font-semibold text-white">
                        <span className="flex items-center gap-2 truncate">
                          <FileText className="size-3.5 text-yellow-400 shrink-0" />
                          <span>Pricing_SLA_2026.pdf</span>
                        </span>
                        <span className="font-mono text-[10px] text-zinc-400">84 chunks</span>
                      </div>
                      <p className="mt-1 text-[11px] text-zinc-400">Extracted tables & BYOK policies</p>
                    </div>

                    <div className="rounded-lg border border-white/[0.06] bg-[#10131d] p-3 text-xs">
                      <div className="flex items-center justify-between font-semibold text-white">
                        <span className="flex items-center gap-2 truncate">
                          <Calendar className="size-3.5 text-emerald-400 shrink-0" />
                          <span>Google Calendar Sync</span>
                        </span>
                        <span className="font-mono text-[10px] text-emerald-400">Connected</span>
                      </div>
                      <p className="mt-1 text-[11px] text-zinc-400">Live availability & timezone detection</p>
                    </div>
                  </div>

                  {/* Guardrail Metrics */}
                  <div className="mt-6 pt-4 border-t border-white/[0.06] space-y-2 text-[11px] font-mono">
                    <div className="flex justify-between text-zinc-400">
                      <span>Cosine Distance Cutoff:</span>
                      <span className="text-white">0.78</span>
                    </div>
                    <div className="flex justify-between text-zinc-400">
                      <span>Hallucination Filter:</span>
                      <span className="text-emerald-400">STRICT</span>
                    </div>
                    <div className="flex justify-between text-zinc-400">
                      <span>Model Engine:</span>
                      <span className="text-yellow-400">Claude 3.5 / GPT-4o</span>
                    </div>
                  </div>
                </div>

                {/* Right Pane: Live Interactive Chat Mockup */}
                <div className="md:col-span-8 p-6 flex flex-col justify-between bg-[#0e1017]">
                  <div className="space-y-4">
                    {/* Visitor Question Bubble */}
                    <div className="flex items-start justify-end gap-3">
                      <div className="rounded-2xl rounded-tr-sm bg-white/[0.1] px-4 py-3 text-xs sm:text-sm text-white max-w-[85%] border border-white/10">
                        {selectedPrompt.query}
                      </div>
                      <div className="size-8 rounded-full bg-zinc-700 flex items-center justify-center text-xs font-bold text-white shrink-0">
                        You
                      </div>
                    </div>

                    {/* Chatty Assistant Response Bubble */}
                    <div className="flex items-start gap-3">
                      <div className="size-8 rounded-lg bg-[#facc15] flex items-center justify-center text-black shrink-0 font-bold">
                        <Bot className="size-5" />
                      </div>
                      <div className="space-y-3 max-w-[90%]">
                        <div className="rounded-2xl rounded-tl-sm border border-white/[0.08] bg-[#141724] p-4 text-xs sm:text-sm text-zinc-200 leading-relaxed shadow-sm">
                          {isTyping ? (
                            <div className="flex items-center gap-1.5 py-1 text-zinc-400 font-mono text-xs">
                              <span className="size-2 rounded-full bg-yellow-400 animate-bounce" />
                              <span className="size-2 rounded-full bg-yellow-400 animate-bounce [animation-delay:150ms]" />
                              <span className="size-2 rounded-full bg-yellow-400 animate-bounce [animation-delay:300ms]" />
                              <span className="ml-1">Synthesizing grounded response...</span>
                            </div>
                          ) : (
                            <p>{selectedPrompt.response}</p>
                          )}
                        </div>

                        {/* Interactive In-Chat Calendar Card (if selected prompt has calendar) */}
                        {!isTyping && selectedPrompt.hasCalendar && (
                          <div className="rounded-xl border border-white/10 bg-[#161a28] p-4 text-xs">
                            <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
                              <span className="font-semibold text-white flex items-center gap-2">
                                <CalendarCheck className="size-4 text-yellow-400" />
                                Solutions Engineering Demo (15 min)
                              </span>
                              <span className="text-[10px] font-mono text-zinc-400">Your Timezone: Local</span>
                            </div>

                            {bookingConfirmed ? (
                              <div className="mt-3 rounded-lg border border-emerald-500/40 bg-emerald-950/40 p-3 text-center">
                                <p className="text-xs font-bold text-emerald-400">
                                  ✓ Demo Confirmed for Tomorrow at {simulatedSlot}!
                                </p>
                                <p className="mt-1 text-[11px] text-zinc-300">
                                  Calendar invite and Google Meet link dispatched to your email.
                                </p>
                              </div>
                            ) : (
                              <div className="mt-3 space-y-3">
                                <p className="text-zinc-400 text-[11px]">Select a confirmed slot for tomorrow:</p>
                                <div className="grid grid-cols-3 gap-2">
                                  {["10:00 AM", "02:30 PM", "04:00 PM"].map((slot) => (
                                    <button
                                      key={slot}
                                      type="button"
                                      onClick={() => setSimulatedSlot(slot)}
                                      className={`py-2 px-1 rounded-lg font-mono text-xs font-semibold transition-all border ${
                                        simulatedSlot === slot
                                          ? "bg-yellow-400 text-black border-yellow-400 shadow-sm"
                                          : "bg-[#0f111a] text-zinc-200 border-white/10 hover:border-white/20"
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
                                    className="w-full mt-2 rounded-lg bg-[#facc15] py-2 text-xs font-bold text-black hover:bg-[#eab308] transition-colors"
                                  >
                                    Confirm Demo at {simulatedSlot}
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Verified Grounding Citations */}
                        {!isTyping && (
                          <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-zinc-400">
                            <span className="text-zinc-500">Verified Sources:</span>
                            {selectedPrompt.citations.map((c) => (
                              <span
                                key={c}
                                className="inline-flex items-center gap-1 rounded bg-white/[0.06] border border-white/10 px-2 py-0.5 text-sky-400"
                              >
                                <Database className="size-2.5" />
                                {c}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Simulator Bottom Input Bar */}
                  <div className="mt-6 pt-4 border-t border-white/[0.08] flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value="Ask Chatty about integrations, SLAs, calendar setup, or BYOK..."
                      className="w-full rounded-xl border border-white/10 bg-[#090b10] px-4 py-2.5 text-xs text-zinc-500 cursor-not-allowed font-sans focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleSelectPrompt(SIMULATOR_PROMPTS[0])}
                      className="rounded-xl bg-[#facc15] p-2.5 text-black hover:bg-[#eab308] shrink-0 font-semibold"
                      title="Test Booking"
                    >
                      <ArrowRight className="size-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ==========================================
            CORE INDUSTRIAL CAPABILITIES
            ========================================== */}
        <section id="capabilities" className="py-20 border-t border-b border-white/[0.08] bg-[#0c0d12]">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto">
              <p className="text-xs font-mono font-semibold uppercase tracking-wider text-yellow-400">
                // INDUSTRIAL CAPABILITIES
              </p>
              <h2 className="mt-3 font-display text-3xl sm:text-4xl font-bold tracking-tight text-white">
                Engineered for conversion, accuracy, and scale.
              </h2>
              <p className="mt-3 text-sm sm:text-base text-zinc-400">
                Traditional chatbots ask visitors to fill out form fields or wait for an email. Chatty answers instantly,
                captures intent, and completes bookings in the conversation.
              </p>
            </div>

            <div className="mt-14 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Feature 1 */}
              <div className="rounded-2xl border border-white/[0.08] bg-[#0f111a] p-6 hover:border-white/20 transition-all">
                <div className="flex size-10 items-center justify-center rounded-xl border border-white/10 bg-[#161a26] text-yellow-400">
                  <Database className="size-5" />
                </div>
                <h3 className="mt-4 font-bold text-base text-white">Grounded Vector RAG</h3>
                <p className="mt-2 text-xs text-zinc-400 leading-relaxed">
                  Indexed with pgvector and cosine distance cutoff. Chatty never fabricates features, pricing, or
                  promises. Every answer references exact source documents.
                </p>
                <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center gap-2 text-[11px] font-mono text-zinc-400">
                  <Check className="size-3.5 text-emerald-400" /> Cosine similarity threshold 0.78
                </div>
              </div>

              {/* Feature 2 */}
              <div className="rounded-2xl border border-white/[0.08] bg-[#0f111a] p-6 hover:border-white/20 transition-all">
                <div className="flex size-10 items-center justify-center rounded-xl border border-white/10 bg-[#161a26] text-yellow-400">
                  <CalendarCheck className="size-5" />
                </div>
                <h3 className="mt-4 font-bold text-base text-white">In-Chat Calendar Booking</h3>
                <p className="mt-2 text-xs text-zinc-400 leading-relaxed">
                  Eliminate Calendly redirects that leak leads. Qualified prospects choose real open calendar slots
                  directly inside the chat window with instant Google & Outlook sync.
                </p>
                <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center gap-2 text-[11px] font-mono text-zinc-400">
                  <Check className="size-3.5 text-emerald-400" /> Automatic timezone detection
                </div>
              </div>

              {/* Feature 3 */}
              <div className="rounded-2xl border border-white/[0.08] bg-[#0f111a] p-6 hover:border-white/20 transition-all">
                <div className="flex size-10 items-center justify-center rounded-xl border border-white/10 bg-[#161a26] text-yellow-400">
                  <Inbox className="size-5" />
                </div>
                <h3 className="mt-4 font-bold text-base text-white">Omnichannel Team Inbox</h3>
                <p className="mt-2 text-xs text-zinc-400 leading-relaxed">
                  Review live chats in real time. If a conversation requires human nuance, pause the bot with 1 click,
                  assign the ticket to a teammate, and take over seamlessly.
                </p>
                <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center gap-2 text-[11px] font-mono text-zinc-400">
                  <Check className="size-3.5 text-emerald-400" /> Collision lock & sentiment triage
                </div>
              </div>

              {/* Feature 4 */}
              <div className="rounded-2xl border border-white/[0.08] bg-[#0f111a] p-6 hover:border-white/20 transition-all">
                <div className="flex size-10 items-center justify-center rounded-xl border border-white/10 bg-[#161a26] text-yellow-400">
                  <PlugZap className="size-5" />
                </div>
                <h3 className="mt-4 font-bold text-base text-white">Model Context Protocol (MCP)</h3>
                <p className="mt-2 text-xs text-zinc-400 leading-relaxed">
                  First-class MCP server support. Connect Claude Desktop, Cursor, or Codex to manage bots, inspect
                  transcripts, update sources, and trigger broadcasts via natural language.
                </p>
                <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center gap-2 text-[11px] font-mono text-zinc-400">
                  <Check className="size-3.5 text-emerald-400" /> 18 official MCP tool definitions
                </div>
              </div>

              {/* Feature 5 */}
              <div className="rounded-2xl border border-white/[0.08] bg-[#0f111a] p-6 hover:border-white/20 transition-all">
                <div className="flex size-10 items-center justify-center rounded-xl border border-white/10 bg-[#161a26] text-yellow-400">
                  <MousePointerClick className="size-5" />
                </div>
                <h3 className="mt-4 font-bold text-base text-white">Natural Lead Qualification</h3>
                <p className="mt-2 text-xs text-zinc-400 leading-relaxed">
                  Collect email, company name, team size, and specific pain points organically during conversations.
                  Automatically enrich domain data and sync to your CRM via webhooks.
                </p>
                <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center gap-2 text-[11px] font-mono text-zinc-400">
                  <Check className="size-3.5 text-emerald-400" /> Webhook dispatch & CSV export
                </div>
              </div>

              {/* Feature 6 */}
              <div className="rounded-2xl border border-white/[0.08] bg-[#0f111a] p-6 hover:border-white/20 transition-all">
                <div className="flex size-10 items-center justify-center rounded-xl border border-white/10 bg-[#161a26] text-yellow-400">
                  <Cpu className="size-5" />
                </div>
                <h3 className="mt-4 font-bold text-base text-white">Zero-Markup BYOK Engine</h3>
                <p className="mt-2 text-xs text-zinc-400 leading-relaxed">
                  Plug in your own API key from OpenAI, Anthropic, Gemini, or OpenRouter. Chatty charges $0 platform
                  markup on tokens, providing total cost predictability.
                </p>
                <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center gap-2 text-[11px] font-mono text-zinc-400">
                  <Check className="size-3.5 text-emerald-400" /> Free forever tier available
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ==========================================
            INTERACTIVE ROI & DEFLECTION CALCULATOR
            ========================================== */}
        <section id="calculator" className="py-24 bg-[#090a0f]">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto">
              <p className="text-xs font-mono font-semibold uppercase tracking-wider text-yellow-400">
                // ROI & DEFLECTION ESTIMATOR
              </p>
              <h2 className="mt-3 font-display text-3xl sm:text-4xl font-bold tracking-tight text-white">
                Calculate your monthly time and cost savings.
              </h2>
              <p className="mt-3 text-sm sm:text-base text-zinc-400">
                Adjust your monthly website visitors and support volume to calculate estimated ticket deflection,
                hours saved, and high-intent sales leads captured.
              </p>
            </div>

            <div className="mt-12 max-w-4xl mx-auto rounded-2xl border border-white/[0.12] bg-[#0e1017] p-6 sm:p-10 shadow-2xl">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                {/* Sliders Area */}
                <div className="lg:col-span-6 space-y-7">
                  {/* Slider 1: Monthly Visitors */}
                  <div>
                    <div className="flex justify-between items-center text-xs font-semibold mb-2">
                      <span className="text-zinc-300">Monthly Website Visitors:</span>
                      <span className="font-mono text-yellow-400 text-sm">{monthlyVisitors.toLocaleString()}</span>
                    </div>
                    <input
                      type="range"
                      min="2000"
                      max="200000"
                      step="2000"
                      value={monthlyVisitors}
                      onChange={(e) => setMonthlyVisitors(Number(e.target.value))}
                      className="w-full accent-yellow-400 cursor-pointer"
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
                      <span className="text-zinc-300">Monthly Support Inquiries:</span>
                      <span className="font-mono text-yellow-400 text-sm">{monthlyTickets.toLocaleString()}</span>
                    </div>
                    <input
                      type="range"
                      min="100"
                      max="10000"
                      step="100"
                      value={monthlyTickets}
                      onChange={(e) => setMonthlyTickets(Number(e.target.value))}
                      className="w-full accent-yellow-400 cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] font-mono text-zinc-400 mt-1">
                      <span>100</span>
                      <span>5,000</span>
                      <span>10,000+</span>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-white/[0.08] text-xs text-zinc-400">
                    <p className="flex items-center gap-2">
                      <Check className="size-4 text-emerald-400 shrink-0" />
                      Assumes standard 84% deflection rate based on grounded documentation.
                    </p>
                  </div>
                </div>

                {/* Calculation Outputs Card */}
                <div className="lg:col-span-6 rounded-xl border border-white/[0.08] bg-[#141724] p-6 text-left">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-lg border border-white/0.06 bg-[#0c0e15] p-3.5">
                      <p className="font-mono text-2xl font-bold text-white">
                        {calculatedMetrics.deflectedTickets.toLocaleString()}
                      </p>
                      <p className="text-[11px] font-semibold text-yellow-400 mt-1">Deflected Inquiries / mo</p>
                    </div>

                    <div className="rounded-lg border border-white/0.06 bg-[#0c0e15] p-3.5">
                      <p className="font-mono text-2xl font-bold text-white">{calculatedMetrics.hoursSaved}h</p>
                      <p className="text-[11px] font-semibold text-yellow-400 mt-1">Support Hours Saved</p>
                    </div>

                    <div className="rounded-lg border border-white/0.06 bg-[#0c0e15] p-3.5">
                      <p className="font-mono text-2xl font-bold text-emerald-400">
                        {calculatedMetrics.leadsCaptured.toLocaleString()}
                      </p>
                      <p className="text-[11px] font-semibold text-zinc-300 mt-1">High-Intent Leads</p>
                    </div>

                    <div className="rounded-lg border border-white/0.06 bg-[#0c0e15] p-3.5">
                      <p className="font-mono text-2xl font-bold text-emerald-400">
                        ${calculatedMetrics.estimatedCostSavings.toLocaleString()}
                      </p>
                      <p className="text-[11px] font-semibold text-zinc-300 mt-1">Estimated Monthly Savings</p>
                    </div>
                  </div>

                  <Link
                    href="/auth/login"
                    className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[#facc15] py-3 text-xs font-bold text-black hover:bg-[#eab308] transition-colors"
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
            INDUSTRIAL COMPETITOR COMPARISON MATRIX
            ========================================== */}
        <section className="py-20 border-t border-b border-white/[0.08] bg-[#0c0d12]">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto">
              <p className="text-xs font-mono font-semibold uppercase tracking-wider text-yellow-400">
                // ARCHITECTURAL COMPARISON
              </p>
              <h2 className="mt-3 font-display text-3xl sm:text-4xl font-bold tracking-tight text-white">
                How Chatty compares to legacy platforms.
              </h2>
              <p className="mt-3 text-sm sm:text-base text-zinc-400">
                See why modern engineering and support teams are choosing an open-source, BYOK-first architecture.
              </p>
            </div>

            <div className="mt-12 overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[640px]">
                <thead>
                  <tr className="border-b border-white/[0.12] text-xs font-mono uppercase tracking-wider text-zinc-400">
                    <th className="py-4 px-4">Feature / Protocol</th>
                    <th className="py-4 px-4 bg-yellow-400/5 text-yellow-400 font-bold border-l border-r border-yellow-400/20">
                      Chatty (OSS)
                    </th>
                    <th className="py-4 px-4 text-zinc-400">Intercom Fin</th>
                    <th className="py-4 px-4 text-zinc-400">Zendesk AI</th>
                    <th className="py-4 px-4 text-zinc-400">Crisp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06] text-xs">
                  {COMPARISON_ROWS.map((row) => (
                    <tr key={row.feature} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-4 px-4 font-semibold text-white">{row.feature}</td>
                      <td className="py-4 px-4 bg-yellow-400/5 font-bold text-yellow-300 border-l border-r border-yellow-400/20">
                        {row.chatty}
                      </td>
                      <td className="py-4 px-4 text-zinc-400">{row.intercom}</td>
                      <td className="py-4 px-4 text-zinc-400">{row.zendesk}</td>
                      <td className="py-4 px-4 text-zinc-400">{row.crisp}</td>
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
        <section id="pricing" className="py-24 bg-[#090a0f]">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto">
              <p className="text-xs font-mono font-semibold uppercase tracking-wider text-yellow-400">
                // TRANSPARENT FLAT PRICING
              </p>
              <h2 className="mt-3 font-display text-3xl sm:text-4xl font-bold tracking-tight text-white">
                Predictable plans. No hidden per-resolution tax.
              </h2>
              <p className="mt-3 text-sm sm:text-base text-zinc-400">
                Start completely free with your own API keys, or upgrade for managed AI credits, multi-bot fleets, and
                white-label branding.
              </p>

              {/* Monthly vs Annual Toggle */}
              <div className="mt-8 inline-flex items-center gap-3 rounded-full border border-white/10 bg-[#121520] p-1.5 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setIsAnnual(false)}
                  className={`rounded-full px-4 py-1.5 transition-colors ${
                    !isAnnual ? "bg-white/[0.12] text-white" : "text-zinc-400 hover:text-white"
                  }`}
                >
                  Monthly Billing
                </button>
                <button
                  type="button"
                  onClick={() => setIsAnnual(true)}
                  className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 transition-colors ${
                    isAnnual ? "bg-[#facc15] text-black" : "text-zinc-400 hover:text-white"
                  }`}
                >
                  <span>Annual Billing</span>
                  <span className="rounded bg-black/20 px-1.5 py-0.5 text-[10px] font-bold uppercase">
                    Save 20%
                  </span>
                </button>
              </div>
            </div>

            {/* Pricing Cards Grid */}
            <div className="mt-14 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
              {/* Plan 1: Free BYOK */}
              <div className="rounded-2xl border border-white/[0.08] bg-[#0e1017] p-6 flex flex-col justify-between hover:border-white/20 transition-all">
                <div>
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-400">Free BYOK</span>
                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="font-display text-4xl font-bold text-white">$0</span>
                    <span className="text-xs font-mono text-zinc-400">/ forever</span>
                  </div>
                  <p className="mt-2 text-xs text-zinc-400">Bring your own model keys with zero platform fee.</p>

                  <ul className="mt-6 space-y-2.5 text-xs text-zinc-300">
                    <li className="flex items-center gap-2">
                      <Check className="size-4 text-emerald-400 shrink-0" /> 1 Live Chatbot
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="size-4 text-emerald-400 shrink-0" /> Bring OpenAI, Anthropic, Gemini
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="size-4 text-emerald-400 shrink-0" /> Knowledge RAG training
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="size-4 text-emerald-400 shrink-0" /> Conversational lead capture
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="size-4 text-emerald-400 shrink-0" /> Zero token markup
                    </li>
                  </ul>
                </div>

                <Link
                  href="/auth/login"
                  className="mt-8 block w-full rounded-xl border border-white/10 bg-[#141724] py-2.5 text-center text-xs font-bold text-white hover:border-white/25 transition-all"
                >
                  Deploy Free BYOK
                </Link>
              </div>

              {/* Plan 2: Hobby */}
              <div className="rounded-2xl border border-white/[0.08] bg-[#0e1017] p-6 flex flex-col justify-between hover:border-white/20 transition-all">
                <div>
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-400">Hobby</span>
                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="font-display text-4xl font-bold text-white">{isAnnual ? "$15" : "$19"}</span>
                    <span className="text-xs font-mono text-zinc-400">/ mo</span>
                  </div>
                  <p className="mt-2 text-xs text-zinc-400">For indie founders & single websites.</p>

                  <ul className="mt-6 space-y-2.5 text-xs text-zinc-300">
                    <li className="flex items-center gap-2">
                      <Check className="size-4 text-emerald-400 shrink-0" /> 3 Live Chatbots
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="size-4 text-emerald-400 shrink-0" /> Included AI message credits
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="size-4 text-emerald-400 shrink-0" /> 10M characters knowledge base
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="size-4 text-emerald-400 shrink-0" /> Analytics & visitor logs
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="size-4 text-emerald-400 shrink-0" /> Calendar booking integration
                    </li>
                  </ul>
                </div>

                <Link
                  href="/auth/login"
                  className="mt-8 block w-full rounded-xl border border-white/10 bg-[#141724] py-2.5 text-center text-xs font-bold text-white hover:border-white/25 transition-all"
                >
                  Get Started
                </Link>
              </div>

              {/* Plan 3: Standard (Highlighted) */}
              <div className="rounded-2xl border-2 border-yellow-400 bg-[#121522] p-6 flex flex-col justify-between shadow-xl relative">
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#facc15] px-3 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider text-black">
                  MOST POPULAR
                </span>

                <div>
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-yellow-400">
                    Standard
                  </span>
                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="font-display text-4xl font-bold text-white">{isAnnual ? "$79" : "$99"}</span>
                    <span className="text-xs font-mono text-zinc-400">/ mo</span>
                  </div>
                  <p className="mt-2 text-xs text-zinc-400">For fast-growing SaaS & support teams.</p>

                  <ul className="mt-6 space-y-2.5 text-xs text-zinc-200">
                    <li className="flex items-center gap-2">
                      <Check className="size-4 text-yellow-400 shrink-0" /> 6 Live Chatbots
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="size-4 text-yellow-400 shrink-0" /> 10,000 Included AI credits
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="size-4 text-yellow-400 shrink-0" /> Daily auto-sync crawler
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="size-4 text-yellow-400 shrink-0" /> Remove &quot;Powered by Chatty&quot;
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="size-4 text-yellow-400 shrink-0" /> Unlimited team inbox members
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="size-4 text-yellow-400 shrink-0" /> Full MCP Server access
                    </li>
                  </ul>
                </div>

                <Link
                  href="/auth/login"
                  className="mt-8 block w-full rounded-xl bg-[#facc15] py-2.5 text-center text-xs font-bold text-black hover:bg-[#eab308] transition-all shadow-md"
                >
                  Start 14-Day Free Trial
                </Link>
              </div>

              {/* Plan 4: Business */}
              <div className="rounded-2xl border border-white/[0.08] bg-[#0e1017] p-6 flex flex-col justify-between hover:border-white/20 transition-all">
                <div>
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-400">Business</span>
                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="font-display text-4xl font-bold text-white">{isAnnual ? "$319" : "$399"}</span>
                    <span className="text-xs font-mono text-zinc-400">/ mo</span>
                  </div>
                  <p className="mt-2 text-xs text-zinc-400">For high-volume enterprises & agencies.</p>

                  <ul className="mt-6 space-y-2.5 text-xs text-zinc-300">
                    <li className="flex items-center gap-2">
                      <Check className="size-4 text-emerald-400 shrink-0" /> Unlimited Chatbots
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="size-4 text-emerald-400 shrink-0" /> 40,000 Included AI credits
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="size-4 text-emerald-400 shrink-0" /> 50M characters knowledge base
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="size-4 text-emerald-400 shrink-0" /> Full white-label controls
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="size-4 text-emerald-400 shrink-0" /> Management API & Webhooks
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="size-4 text-emerald-400 shrink-0" /> Priority 99.9% uptime SLA
                    </li>
                  </ul>
                </div>

                <Link
                  href="/auth/login"
                  className="mt-8 block w-full rounded-xl border border-white/10 bg-[#141724] py-2.5 text-center text-xs font-bold text-white hover:border-white/25 transition-all"
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
        <section id="faq" className="py-20 border-t border-white/[0.08] bg-[#0c0d12]">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <p className="text-xs font-mono font-semibold uppercase tracking-wider text-yellow-400">
                // FREQUENTLY ASKED QUESTIONS
              </p>
              <h2 className="mt-3 font-display text-3xl sm:text-4xl font-bold tracking-tight text-white">
                Everything you need to know about Chatty.
              </h2>
            </div>

            <div className="mt-12 space-y-3">
              {FAQS.map((faq, index) => {
                const isOpen = openFaqIndex === index;
                return (
                  <div
                    key={faq.q}
                    className="rounded-xl border border-white/[0.08] bg-[#0e1017] overflow-hidden transition-colors"
                  >
                    <button
                      type="button"
                      onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                      className="flex w-full items-center justify-between p-5 text-left text-sm font-semibold text-white hover:bg-white/[0.02]"
                    >
                      <span>{faq.q}</span>
                      <ChevronDown
                        className={`size-4 text-zinc-400 transition-transform duration-200 shrink-0 ml-4 ${
                          isOpen ? "rotate-180 text-yellow-400" : ""
                        }`}
                      />
                    </button>
                    {isOpen && (
                      <div className="px-5 pb-5 pt-1 text-xs text-zinc-400 leading-relaxed border-t border-white/[0.04]">
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
            PRE-FOOTER CALL TO ACTION
            ========================================== */}
        <section className="py-20 bg-[#090a0f] border-t border-white/[0.08]">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
            <div className="rounded-3xl border border-white/[0.12] bg-[#0f121d] p-8 sm:p-14 max-w-4xl mx-auto shadow-2xl relative overflow-hidden">
              <span className="size-2 rounded-full bg-emerald-400 inline-block mb-3 animate-pulse" />
              <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-white max-w-2xl mx-auto">
                Ready to automate customer support with zero hallucinations?
              </h2>
              <p className="mt-4 text-sm sm:text-base text-zinc-400 max-w-xl mx-auto">
                Deploy your first grounded website assistant in under 3 minutes. Zero coding required.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                  href="/auth/login"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-[#facc15] px-8 py-3.5 text-sm font-bold text-black hover:bg-[#eab308] transition-all"
                >
                  <span>Deploy Free Assistant</span>
                  <ArrowRight className="size-4" />
                </Link>
                <Link
                  href="https://github.com/Damayantha/chatty"
                  target="_blank"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-[#161a26] px-6 py-3.5 text-sm font-semibold text-zinc-200 hover:border-white/20 transition-all"
                >
                  <GithubStarIcon className="size-4" />
                  <span>Star on GitHub</span>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ==========================================
          INDUSTRIAL FOOTER
          ========================================== */}
      <footer className="border-t border-white/[0.08] bg-[#06070a] py-14 text-xs text-zinc-400">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
            {/* Brand column */}
            <div className="col-span-2 space-y-4">
              <Link href="/" className="flex items-center gap-2.5">
                <div className="flex size-7 items-center justify-center rounded-lg border border-white/10 bg-[#131722]">
                  <Image src="/favicon.png" alt="Chatty Logo" width={18} height={18} className="object-contain" />
                </div>
                <span className="font-display text-base font-bold text-white">Chatty</span>
              </Link>
              <p className="text-xs text-zinc-400 leading-relaxed max-w-sm">
                Autonomous conversational AI that grounds support on real business data, captures qualified leads,
                and books meetings in-chat. Open source & BYOK-ready.
              </p>
              <div className="inline-flex items-center gap-2 rounded border border-white/10 bg-[#0d0f17] px-2.5 py-1 text-[11px] font-mono text-zinc-300">
                <span className="size-2 rounded-full bg-emerald-400" />
                <span>All systems operational · 99.98% uptime</span>
              </div>
            </div>

            {/* Column: Product */}
            <div className="space-y-3">
              <p className="font-mono text-xs font-bold uppercase tracking-wider text-zinc-300">Product</p>
              <ul className="space-y-2">
                <li><Link href="#architecture" className="hover:text-white transition-colors">Agent Pipeline</Link></li>
                <li><Link href="#simulator" className="hover:text-white transition-colors">Live Simulator</Link></li>
                <li><Link href="#capabilities" className="hover:text-white transition-colors">Grounded RAG</Link></li>
                <li><Link href="#pricing" className="hover:text-white transition-colors">Pricing & BYOK</Link></li>
              </ul>
            </div>

            {/* Column: Developers */}
            <div className="space-y-3">
              <p className="font-mono text-xs font-bold uppercase tracking-wider text-zinc-300">Developers</p>
              <ul className="space-y-2">
                <li><Link href="https://github.com/Damayantha/chatty" target="_blank" className="hover:text-white transition-colors">GitHub Repository</Link></li>
                <li><Link href="https://docs.chatty.personaliai.com" target="_blank" className="hover:text-white transition-colors">Documentation</Link></li>
                <li><Link href="https://docs.chatty.personaliai.com/mcp" target="_blank" className="hover:text-white transition-colors">MCP Protocol Spec</Link></li>
                <li><Link href="https://docs.chatty.personaliai.com/api" target="_blank" className="hover:text-white transition-colors">Management API</Link></li>
              </ul>
            </div>

            {/* Column: Legal & Company */}
            <div className="space-y-3">
              <p className="font-mono text-xs font-bold uppercase tracking-wider text-zinc-300">Legal & Company</p>
              <ul className="space-y-2">
                <li><Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
                <li><Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link></li>
                <li><Link href="mailto:support@personaliai.com" className="hover:text-white transition-colors">Contact Support</Link></li>
                <li><Link href="https://twitter.com/personaliai" target="_blank" className="hover:text-white transition-colors">Twitter / X</Link></li>
              </ul>
            </div>
          </div>

          <div className="mt-12 pt-6 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between text-[11px] text-zinc-400 gap-4">
            <p>© {new Date().getFullYear()} PersonaliAI. All rights reserved.</p>
            <p className="font-mono text-zinc-400">Built for precision customer communication.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
