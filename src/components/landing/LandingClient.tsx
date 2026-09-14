"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { gsap } from "gsap";
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
  Globe,
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

const MEGA_MENU_ENDPOINTS = [
  {
    title: "Knowledge Search",
    desc: "Grounded vector RAG across crawled sitemaps and docs.",
    href: "#capabilities",
    tags: ["pgvector", "Cosine Cutoff"],
  },
  {
    title: "Calendar Booking",
    desc: "In-chat Google & Outlook meeting scheduling.",
    href: "https://docs.chatty.personaliai.com/guides/calendar-scheduling",
    external: true,
    tags: ["Google Meet", "Outlook"],
  },
  {
    title: "Lead Capture",
    desc: "Progressive intent profiling and CRM deal enrichment.",
    href: "#roi",
    tags: ["CRM Sync", "Webhooks"],
  },
  {
    title: "Omnichannel Inbox",
    desc: "Live sentiment triage and 1-click human takeover lock.",
    href: "https://docs.chatty.personaliai.com/guides/human-takeover",
    external: true,
    tags: ["Handoff", "Triage"],
  },
  {
    title: "Model Context Protocol",
    desc: "Official MCP server for Claude Desktop and Cursor.",
    href: "#mcp",
    badge: "Native",
  },
];

const MEGA_MENU_SURFACES = [
  {
    title: "MCP Server",
    desc: "Direct tools for autonomous agents over SSE.",
    href: "#mcp",
    badge: "Native",
  },
  {
    title: "Web Chat Widget",
    desc: "1-line embed snippet with live theme customizations.",
    href: "https://docs.chatty.personaliai.com/guides/embed-widget",
    external: true,
  },
  {
    title: "REST API",
    desc: "Programmatic management of bots, sources, and leads.",
    href: "https://docs.chatty.personaliai.com/api-reference/chat/send-message",
    external: true,
  },
  {
    title: "Client SDKs",
    desc: "Official Python and TypeScript client libraries.",
    href: "https://docs.chatty.personaliai.com/guides/react-sdk",
    external: true,
  },
  {
    title: "Calendar Sync",
    desc: "Native OAuth integration for Google Calendar & Outlook.",
    href: "https://docs.chatty.personaliai.com/guides/calendar-scheduling",
    external: true,
  },
];

const MEGA_MENU_RESOURCES = [
  {
    title: "Documentation",
    desc: "Complete setup guides, embed snippets, and API references.",
    href: "https://docs.chatty.personaliai.com",
    external: true,
  },
  {
    title: "Affiliates Program",
    desc: "Earn 30% recurring commission referring high-growth teams.",
    href: "/affiliates",
    external: false,
  },
  {
    title: "Support Center",
    desc: "Get fast answers or contact our engineering team directly.",
    href: "/support",
    external: false,
  },
  {
    title: "Voice AI Demo",
    desc: "Test bidirectional voice agents with LiveKit models.",
    href: "/voice-demo",
    external: false,
  },
  {
    title: "Zoom App Integration",
    desc: "Connect Chatty directly to your Zoom workspaces.",
    href: "/zoom",
    external: false,
  },
  {
    title: "GitHub Repository",
    desc: "Open source codebase, Docker deployment, and issues.",
    href: "https://github.com/Damayantha/chatty",
    external: true,
  },
];

const CODE_FEATURES = [
  {
    id: "rag",
    title: "Knowledge Vector RAG",
    tag: "Search Grounding",
    desc: "Query ingested docs with cosine distance threshold cutoff.",
    icon: Database,
    languages: [
      {
        lang: "Python",
        filename: "query_rag.py",
        code: `# pip install chatty-python
from chatty import ChattyClient

client = ChattyClient(api_key="chatty_sk_live_9a8f...")

response = client.knowledge.search(
    bot_id="ad32f373-7694-43f4-9465-f8d65ce291e3",
    query="What is your enterprise SLA and pricing terms?",
    strict_grounding=True
)

print(response.citations)`,
        response: `[
  {
    "source": "https://personaliai.com/docs/sla",
    "title": "Enterprise Service Level Agreement",
    "similarity_score": 0.942,
    "grounded": true
  },
  {
    "source": "https://personaliai.com/pricing",
    "title": "Transparent Flat Pricing",
    "similarity_score": 0.891,
    "grounded": true
  }
]`,
      },
      {
        lang: "Node.js",
        filename: "search.ts",
        code: `import { ChattyClient } from "@personaliai/chatty";

const client = new ChattyClient({ apiKey: process.env.CHATTY_API_KEY });

const results = await client.knowledge.search({
  botId: "ad32f373-7694-43f4-9465-f8d65ce291e3",
  query: "Enterprise SLA and pricing terms",
  limit: 2
});

console.log(results.matches);`,
        response: `{
  "status": "success",
  "bot_id": "ad32f373-7694-43f4-9465-f8d65ce291e3",
  "query_tokens": 8,
  "matches": [
    {
      "title": "Enterprise SLA",
      "url": "https://personaliai.com/docs/sla",
      "cosine_score": 0.942
    },
    {
      "title": "Pricing Plans",
      "url": "https://personaliai.com/pricing",
      "cosine_score": 0.891
    }
  ]
}`,
      },
      {
        lang: "cURL",
        filename: "search.sh",
        code: `curl -X POST https://api.chatty.personaliai.com/v1/knowledge/search \\
  -H "Authorization: Bearer chatty_sk_live_9a8f..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "bot_id": "ad32f373-7694-43f4-9465-f8d65ce291e3",
    "query": "Enterprise SLA policy",
    "threshold": 0.78
  }'`,
        response: `{
  "grounded": true,
  "confidence": 0.942,
  "chunks_evaluated": 1248,
  "matched_sources": [
    "https://personaliai.com/docs/sla"
  ]
}`,
      },
    ],
  },
  {
    id: "booking",
    title: "Calendar Booking",
    tag: "Calendar Sync",
    desc: "Confirm Google & Outlook meeting slots in live chat.",
    icon: CalendarCheck,
    languages: [
      {
        lang: "Python",
        filename: "book_meeting.py",
        code: `# Reserve calendar slot directly in conversation
booking = client.calendar.create_event(
    bot_id="ad32f373-7694-43f4-9465-f8d65ce291e3",
    visitor_email="alex@acme.corp",
    slot_iso="2026-09-15T14:30:00Z",
    timezone="America/New_York"
)

print(booking.meet_link)`,
        response: `{
  "booking_id": "bk_9012a",
  "status": "confirmed",
  "attendees": [
    "alex@acme.corp",
    "solutions@personaliai.com"
  ],
  "calendar_event": "https://meet.google.com/abc-defg-hij",
  "synced_provider": "google_calendar"
}`,
      },
      {
        lang: "Node.js",
        filename: "booking.ts",
        code: `import { Chatty } from "@personaliai/chatty";

const chatty = new Chatty({ apiKey: process.env.CHATTY_API_KEY });

const booking = await chatty.bookings.confirm({
  botId: "ad32f373-7694-43f4-9465-f8d65ce291e3",
  visitorEmail: "alex@acme.corp",
  slotTime: "2026-09-15T14:30:00Z"
});

console.log(booking.calendar_event);`,
        response: `{
  "booking_id": "bk_9012a",
  "status": "confirmed",
  "calendar_event": "https://meet.google.com/abc-defg-hij",
  "duration_minutes": 15
}`,
      },
      {
        lang: "cURL",
        filename: "confirm.sh",
        code: `curl -X POST https://api.chatty.personaliai.com/v1/calendar/confirm \\
  -H "Authorization: Bearer chatty_sk_live_9a8f..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "bot_id": "ad32f373-7694-43f4-9465-f8d65ce291e3",
    "email": "alex@acme.corp",
    "slot": "2026-09-15T14:30:00Z"
  }'`,
        response: `{
  "status": "confirmed",
  "calendar_link": "https://meet.google.com/abc-defg-hij",
  "confirmation_email_dispatched": true
}`,
      },
    ],
  },
  {
    id: "leads",
    title: "Lead Qualification",
    tag: "Intent Profiling",
    desc: "Enrich visitor budget and sync deals directly to CRM.",
    icon: UserCheck,
    languages: [
      {
        lang: "Python",
        filename: "qualify_lead.py",
        code: `# Automatically score intent and enrich lead
lead = client.leads.qualify(
    bot_id="ad32f373-7694-43f4-9465-f8d65ce291e3",
    conversation_id="conv_8819a",
    sync_crm="hubspot"
)

print(lead.qualification_score)`,
        response: `{
  "lead_id": "ld_3309a",
  "email": "sarah@venture.io",
  "company_size": "100-500",
  "intent_score": 0.95,
  "budget_verified": true,
  "crm_synced": true
}`,
      },
      {
        lang: "Node.js",
        filename: "lead.ts",
        code: `const lead = await client.leads.capture({
  botId: "ad32f373-7694-43f4-9465-f8d65ce291e3",
  visitorData: { email: "sarah@venture.io", plan: "Enterprise" }
});

console.log(lead.status);`,
        response: `{
  "status": "qualified",
  "crm_destination": "HubSpot Deals",
  "deal_value_estimate": 12000,
  "sales_rep_assigned": "Enterprise Pod A"
}`,
      },
      {
        lang: "cURL",
        filename: "qualify.sh",
        code: `curl -X POST https://api.chatty.personaliai.com/v1/leads/qualify \\
  -H "Authorization: Bearer chatty_sk_live_9a8f..." \\
  -H "Content-Type: application/json" \\
  -d '{"bot_id":"ad32f373-7694-43f4-9465-f8d65ce291e3","sync":true}'`,
        response: `{
  "qualified": true,
  "score": 0.95,
  "webhook_triggered": "https://hooks.zapier.com/lead-sync"
}`,
      },
    ],
  },
  {
    id: "mcp",
    title: "MCP Protocol Call",
    tag: "Native Protocol",
    desc: "Autonomous bot management over streamable HTTP SSE.",
    icon: PlugZap,
    languages: [
      {
        lang: "Python",
        filename: "mcp_call.py",
        code: `from mcp import ClientSession
from mcp.client.sse import sse_client

headers = {"Authorization": "Bearer chatty_sk_..."}
async with sse_client("https://api.chatty.personaliai.com/mcp", headers=headers) as (r, w):
    async with ClientSession(r, w) as session:
        await session.initialize()
        result = await session.call_tool("customize_widget_styling", {
            "bot_id": "ad32f373-7694-43f4-9465-f8d65ce291e3",
            "primary_color": "#f95721"
        })
        print(result)`,
        response: `{
  "tool": "customize_widget_styling",
  "status": "success",
  "primary_color": "#f95721",
  "color_scheme": {
    "header": { "bg": "#f95721", "text": "#ffffff" },
    "launcher": { "bg": "#f95721", "text": "#ffffff" },
    "sendBtn": { "bg": "#f95721", "text": "#ffffff" }
  }
}`,
      },
      {
        lang: "Node.js",
        filename: "mcp_rpc.ts",
        code: `// Direct JSON-RPC protocol execution
const response = await fetch("https://api.chatty.personaliai.com/mcp", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Accept": "application/json, text/event-stream",
    "Authorization": "Bearer chatty_sk_..."
  },
  body: JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: { name: "list_chatbots", arguments: {} }
  })
});`,
        response: `{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "bots": [
      {
        "id": "ad32f373-7694-43f4-9465-f8d65ce291e3",
        "name": "Chatty Support Agent",
        "status": "active"
      }
    ]
  }
}`,
      },
      {
        lang: "cURL",
        filename: "mcp_list.sh",
        code: `curl -X POST https://api.chatty.personaliai.com/mcp \\
  -H "Content-Type: application/json" \\
  -H "Accept: application/json, text/event-stream" \\
  -H "Authorization: Bearer chatty_sk_..." \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'`,
        response: `{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "tools_count": 65,
    "suites": [
      "bot_lifecycle",
      "styling_theme",
      "calendar_booking",
      "knowledge_rag"
    ]
  }
}`,
      },
    ],
  },
];

const MCP_INTEGRATIONS = [
  {
    name: "Claude Desktop",
    file: "%APPDATA%\\Claude\\claude_desktop_config.json",
    badge: "OAuth / Direct",
    code: `{
  "mcpServers": {
    "chatty": {
      "url": "https://api.chatty.personaliai.com/mcp"
    }
  }
}`,
  },
  {
    name: "Cursor IDE",
    file: ".cursor/mcp.json",
    badge: "API Key",
    code: `{
  "mcpServers": {
    "chatty": {
      "url": "https://api.chatty.personaliai.com/mcp",
      "headers": {
        "Authorization": "Bearer chatty_sk_your_api_key_here"
      }
    }
  }
}`,
  },
  {
    name: "Claude Code CLI",
    file: "Terminal Command",
    badge: "CLI",
    code: `claude mcp add chatty https://api.chatty.personaliai.com/mcp`,
  },
  {
    name: "cURL / HTTP JSON-RPC",
    file: "Direct Protocol Call",
    badge: "HTTP",
    code: `curl -X POST https://api.chatty.personaliai.com/mcp \\
  -H "Content-Type: application/json" \\
  -H "Accept: application/json, text/event-stream" \\
  -H "Authorization: Bearer chatty_sk_your_api_key_here" \\
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "customize_widget_styling",
      "arguments": {
        "bot_id": "YOUR_BOT_UUID",
        "primary_color": "#f95721"
      }
    }
  }'`,
  },
  {
    name: "Python MCP Client",
    file: "mcp_client.py",
    badge: "FastMCP",
    code: `import asyncio
from mcp import ClientSession
from mcp.client.sse import sse_client

async def main():
    headers = {"Authorization": "Bearer chatty_sk_your_api_key_here"}
    async with sse_client("https://api.chatty.personaliai.com/mcp", headers=headers) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            tools = await session.list_tools()
            print(f"Connected to Chatty: {len(tools.tools)} tools available")

asyncio.run(main())`,
  },
];

function renderSyntaxTokens(line: string) {
  const trimmed = line.trim();
  if (trimmed.startsWith("#") || trimmed.startsWith("//") || trimmed.startsWith("<!--")) {
    return <span className="text-zinc-400 italic">{line}</span>;
  }

  const jsonKeyMatch = line.match(/^(\s*)(".*?")(\s*:\s*)(.*)$/);
  if (jsonKeyMatch) {
    const [, indent, key, colon, value] = jsonKeyMatch;
    return (
      <>
        <span>{indent}</span>
        <span className="text-blue-600 font-medium">{key}</span>
        <span className="text-zinc-400">{colon}</span>
        {renderJsonValue(value)}
      </>
    );
  }

  const tokens = line.split(/(\s+|[(){}[\]:;,])/);
  return tokens.map((token, i) => {
    if (/^(import|from|const|await|async|def|class|return|curl|export|function)$/.test(token)) {
      return <span key={i} className="text-purple-600 font-semibold">{token}</span>;
    }
    if (/^(".*"|'.*')$/.test(token)) {
      return <span key={i} className="text-emerald-700">{token}</span>;
    }
    if (/^(true|false|null|None)$/.test(token)) {
      return <span key={i} className="text-rose-600 font-semibold">{token}</span>;
    }
    if (/^\d+(\.\d+)?$/.test(token)) {
      return <span key={i} className="text-amber-600">{token}</span>;
    }
    if (/^[(){}[\]:;,]$/.test(token)) {
      return <span key={i} className="text-zinc-400">{token}</span>;
    }
    return <span key={i}>{token}</span>;
  });
}

function renderJsonValue(val: string) {
  const trimmed = val.trim();
  if (/^".*"[,\s]*$/.test(trimmed)) {
    return <span className="text-emerald-700">{val}</span>;
  }
  if (/^(true|false|null)[,\s]*$/.test(trimmed)) {
    return <span className="text-rose-600 font-semibold">{val}</span>;
  }
  if (/^-?\d+(\.\d+)?[,\s]*$/.test(trimmed)) {
    return <span className="text-amber-600">{val}</span>;
  }
  return <span className="text-zinc-800">{val}</span>;
}

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

function GithubIcon({ className = "size-4" }: { className?: string }) {
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
  // Navigation Menus State
  const [productsMenuOpen, setProductsMenuOpen] = useState(false);
  const [resourcesMenuOpen, setResourcesMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // GSAP DOM Element Refs
  const heroSectionRef = useRef<HTMLDivElement>(null);
  const heroBadgeRef = useRef<HTMLAnchorElement>(null);
  const heroHeadingRef = useRef<HTMLHeadingElement>(null);
  const heroSubRef = useRef<HTMLParagraphElement>(null);
  const heroCtasRef = useRef<HTMLDivElement>(null);
  const heroBadgesRef = useRef<HTMLDivElement>(null);
  const mouseAuraRef = useRef<HTMLDivElement>(null);
  const playIconRef = useRef<SVGSVGElement>(null);
  const megaMenuProductsRef = useRef<HTMLDivElement>(null);
  const megaMenuResourcesRef = useRef<HTMLDivElement>(null);
  const heroCanvasRef = useRef<HTMLCanvasElement>(null);
  const terminalBoxRef = useRef<HTMLDivElement>(null);

  // Feature Code Showcase State (Firecrawl Interactive Code Section)
  const [activeFeatureIdx, setActiveFeatureIdx] = useState(0);
  const [activeLangIdx, setActiveLangIdx] = useState(0);
  const [codeCopied, setCodeCopied] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [visibleLines, setVisibleLines] = useState<number>(999);

  // MCP Integration Code State
  const [selectedMcpIdx, setSelectedMcpIdx] = useState(0);
  const [mcpCodeCopied, setMcpCodeCopied] = useState(false);

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

  // Animated Digital Rolling Counters powered by GSAP
  const [animatedDeflected, setAnimatedDeflected] = useState(calculatedMetrics.deflectedTickets);
  const [animatedHours, setAnimatedHours] = useState(calculatedMetrics.hoursSaved);
  const [animatedLeads, setAnimatedLeads] = useState(calculatedMetrics.leadsCaptured);
  const [animatedSavings, setAnimatedSavings] = useState(calculatedMetrics.estimatedCostSavings);

  const metricTweenRef = useRef({
    deflected: calculatedMetrics.deflectedTickets,
    hours: calculatedMetrics.hoursSaved,
    leads: calculatedMetrics.leadsCaptured,
    savings: calculatedMetrics.estimatedCostSavings,
  });

  useEffect(() => {
    gsap.to(metricTweenRef.current, {
      deflected: calculatedMetrics.deflectedTickets,
      hours: calculatedMetrics.hoursSaved,
      leads: calculatedMetrics.leadsCaptured,
      savings: calculatedMetrics.estimatedCostSavings,
      duration: 0.45,
      ease: "power2.out",
      onUpdate: () => {
        setAnimatedDeflected(Math.round(metricTweenRef.current.deflected));
        setAnimatedHours(Math.round(metricTweenRef.current.hours));
        setAnimatedLeads(Math.round(metricTweenRef.current.leads));
        setAnimatedSavings(Math.round(metricTweenRef.current.savings));
      },
    });
  }, [calculatedMetrics]);

  // Pricing Toggle State
  const [isAnnual, setIsAnnual] = useState(true);

  // FAQ Accordion State
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  // Active Feature & Language objects
  const activeFeature = CODE_FEATURES[activeFeatureIdx] || CODE_FEATURES[0];
  const activeLang = activeFeature.languages[activeLangIdx] || activeFeature.languages[0];
  const activeResponseLines = useMemo(() => activeLang.response.split("\n"), [activeLang]);

  // Handle running/re-running code execution simulation with GSAP play spin
  const handleTriggerRun = () => {
    if (playIconRef.current) {
      gsap.fromTo(
        playIconRef.current,
        { rotation: 0 },
        { rotation: 360, duration: 0.5, ease: "power2.inOut" }
      );
    }
    setIsExecuting(true);
    setVisibleLines(0);
    const totalLines = activeLang.response.split("\n").length;
    let currentLine = 0;

    const delayTimer = setTimeout(() => {
      setIsExecuting(false);
      const lineInterval = setInterval(() => {
        if (currentLine <= totalLines) {
          setVisibleLines(currentLine);
          currentLine++;
        } else {
          clearInterval(lineInterval);
        }
      }, 22);
    }, 420);

    return () => clearTimeout(delayTimer);
  };

  // Trigger animation on feature or language tab switch
  useEffect(() => {
    handleTriggerRun();
  }, [activeFeatureIdx, activeLangIdx]);

  // Interactive Constellation Canvas in Hero
  useEffect(() => {
    const canvas = heroCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let width = (canvas.width = canvas.parentElement?.clientWidth || window.innerWidth);
    let height = (canvas.height = canvas.parentElement?.clientHeight || 650);

    const handleResize = () => {
      if (!canvas || !canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth;
      height = canvas.height = canvas.parentElement.clientHeight;
    };
    window.addEventListener("resize", handleResize);

    const particles: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      color: string;
    }> = [];

    const PARTICLE_COUNT = 36;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const isOrange = Math.random() > 0.65;
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        size: isOrange ? 2.2 : 1.6,
        color: isOrange ? "rgba(249, 87, 33, 0.4)" : "rgba(148, 163, 184, 0.3)",
      });
    }

    let mouseX = -9999;
    let mouseY = -9999;
    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseX = e.clientX - rect.left;
      mouseY = e.clientY - rect.top;
    };
    const onMouseLeave = () => {
      mouseX = -9999;
      mouseY = -9999;
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseleave", onMouseLeave);

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 110) {
            const alpha = (1 - dist / 110) * 0.2;
            ctx.strokeStyle = `rgba(249, 87, 33, ${alpha})`;
            ctx.lineWidth = 0.7;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        const mdx = mouseX - p.x;
        const mdy = mouseY - p.y;
        const mDist = Math.sqrt(mdx * mdx + mdy * mdy);
        if (mDist < 110) {
          const force = (1 - mDist / 110) * 0.75;
          p.x -= (mdx / mDist) * force;
          p.y -= (mdy / mDist) * force;
        }

        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      animId = requestAnimationFrame(render);
    };
    render();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseleave", onMouseLeave);
    };
  }, []);

  // GSAP Creative Hero Entrance & Timeline
  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

      if (heroBadgeRef.current) {
        tl.from(heroBadgeRef.current, {
          y: -16,
          opacity: 0,
          scale: 0.9,
          duration: 0.6,
        });
      }

      // Kinetic 3D word-by-word flip-in
      tl.fromTo(
        ".hero-word",
        {
          y: 48,
          rotateX: -70,
          opacity: 0,
          scale: 0.92,
        },
        {
          y: 0,
          rotateX: 0,
          opacity: 1,
          scale: 1,
          duration: 0.8,
          stagger: 0.045,
          ease: "back.out(1.8)",
        },
        "-=0.3"
      );

      if (heroSubRef.current) {
        tl.from(
          heroSubRef.current,
          {
            y: 20,
            opacity: 0,
            duration: 0.65,
          },
          "-=0.5"
        );
      }
      if (heroCtasRef.current) {
        tl.from(
          heroCtasRef.current,
          {
            y: 20,
            opacity: 0,
            duration: 0.6,
            ease: "back.out(1.2)",
          },
          "-=0.4"
        );
      }

      if (terminalBoxRef.current) {
        tl.from(
          terminalBoxRef.current,
          {
            y: 32,
            opacity: 0,
            scale: 0.97,
            duration: 0.75,
            ease: "power3.out",
          },
          "-=0.3"
        );
        tl.fromTo(
          ".terminal-line",
          { opacity: 0, x: -8 },
          { opacity: 1, x: 0, stagger: 0.14, duration: 0.45, ease: "power2.out" },
          "-=0.4"
        );
      }

      if (heroBadgesRef.current) {
        tl.from(
          heroBadgesRef.current.children,
          {
            opacity: 0,
            y: 12,
            duration: 0.5,
            stagger: 0.08,
          },
          "-=0.3"
        );
      }

      // Sine-wave floating telemetry pills in hero
      gsap.to(".telemetry-pill-1", {
        y: -12,
        duration: 2.8,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
      });
      gsap.to(".telemetry-pill-2", {
        y: 10,
        duration: 3.4,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
        delay: 0.5,
      });
      gsap.to(".telemetry-pill-3", {
        y: -9,
        duration: 3.0,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
        delay: 1,
      });
    }, heroSectionRef);

    return () => ctx.revert();
  }, []);

  // Ambient Cursor Aura & 3D Depth Parallax following mouse in Hero
  const handleHeroMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!mouseAuraRef.current || !heroSectionRef.current) return;
    const rect = heroSectionRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const deltaX = (x - centerX) / centerX;
    const deltaY = (y - centerY) / centerY;

    gsap.to(mouseAuraRef.current, {
      x: x - 180,
      y: y - 180,
      duration: 0.5,
      ease: "power2.out",
    });

    gsap.to(".telemetry-pill-1", { x: deltaX * 20, y: deltaY * 20, duration: 0.5, ease: "power2.out" });
    gsap.to(".telemetry-pill-2", { x: deltaX * -22, y: deltaY * -22, duration: 0.5, ease: "power2.out" });
    gsap.to(".telemetry-pill-3", { x: deltaX * 16, y: deltaY * 16, duration: 0.5, ease: "power2.out" });
  };

  // Magnetic Button Physics
  const handleMagneticMove = (e: React.MouseEvent<HTMLElement>) => {
    const btn = e.currentTarget;
    const rect = btn.getBoundingClientRect();
    const x = (e.clientX - rect.left - rect.width / 2) * 0.28;
    const y = (e.clientY - rect.top - rect.height / 2) * 0.28;
    gsap.to(btn, { x, y, duration: 0.25, ease: "power2.out" });
  };

  const handleMagneticLeave = (e: React.MouseEvent<HTMLElement>) => {
    gsap.to(e.currentTarget, { x: 0, y: 0, duration: 0.55, ease: "elastic.out(1, 0.45)" });
  };

  // Mega-menu GSAP entrance
  useEffect(() => {
    if (productsMenuOpen && megaMenuProductsRef.current) {
      gsap.fromTo(
        megaMenuProductsRef.current,
        { opacity: 0, y: -8, scale: 0.98 },
        { opacity: 1, y: 0, scale: 1, duration: 0.2, ease: "power3.out" }
      );
    }
  }, [productsMenuOpen]);

  useEffect(() => {
    if (resourcesMenuOpen && megaMenuResourcesRef.current) {
      gsap.fromTo(
        megaMenuResourcesRef.current,
        { opacity: 0, y: -8, scale: 0.98 },
        { opacity: 1, y: 0, scale: 1, duration: 0.2, ease: "power3.out" }
      );
    }
  }, [resourcesMenuOpen]);

  // Copy code handlers
  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const handleCopyMcp = (code: string) => {
    navigator.clipboard.writeText(code);
    setMcpCodeCopied(true);
    setTimeout(() => setMcpCodeCopied(false), 2000);
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
      {/* Top Announcement Bar (Firecrawl Style) */}
      <aside className="border-b border-orange-200/80 bg-orange-50/90 py-2.5 px-4 text-center text-xs font-medium text-zinc-800 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-[#f95721] px-2 py-0.5 text-[10px] font-mono font-bold text-white uppercase tracking-wider">
            New
          </span>
          <span>
            Introducing Chatty Model Context Protocol (MCP) — Connect Claude Desktop, Cursor & agents.
          </span>
          <Link
            href="#mcp"
            className="inline-flex items-center gap-1 font-semibold text-[#f95721] hover:underline"
          >
            <span>View integration code</span>
            <ArrowRight className="size-3" />
          </Link>
        </div>
      </aside>

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
              <span className="size-1.5 rounded-full bg-[#f95721]" />
              Open Source
            </span>
          </div>

          {/* Center: Desktop Navigation Links with Mega-Menus */}
          <nav className="hidden md:flex items-center gap-1 text-sm font-medium text-zinc-600">
            {/* Products Mega-Menu Dropdown (Spacious 3-column layout matching screenshot 2) */}
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

              {/* Firecrawl / Nimble Style 3-Column Mega-Menu Card */}
              {productsMenuOpen && (
                <div ref={megaMenuProductsRef} className="absolute top-full left-1/2 -translate-x-1/2 pt-2 w-[860px] transition-all duration-200">
                  <div className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-2xl shadow-zinc-200/80">
                    <div className="grid grid-cols-12 gap-8">
                      {/* Column 1: Endpoints & Capabilities */}
                      <div className="col-span-4 space-y-4 border-r border-zinc-100 pr-6">
                        <span className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-400">
                          Endpoints
                        </span>
                        <div className="space-y-3">
                          {MEGA_MENU_ENDPOINTS.map((item) => (
                            <Link
                              key={item.title}
                              href={item.href}
                              target={item.external ? "_blank" : undefined}
                              rel={item.external ? "noreferrer" : undefined}
                              onClick={() => setProductsMenuOpen(false)}
                              className="group block rounded-xl p-2 transition-colors hover:bg-orange-50/50"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-zinc-900 group-hover:text-[#f95721] transition-colors">
                                  {item.title}
                                </span>
                                {item.badge && (
                                  <span className="rounded bg-orange-100 text-[#f95721] text-[10px] font-mono font-bold px-1.5 py-0.5">
                                    {item.badge}
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-zinc-500 leading-relaxed mt-0.5">{item.desc}</p>
                              {item.tags && (
                                <div className="mt-1.5 flex items-center gap-1.5">
                                  {item.tags.map((tag) => (
                                    <span
                                      key={tag}
                                      className="inline-flex items-center text-[10px] font-mono text-zinc-500 bg-zinc-100 px-1.5 py-0.5 rounded"
                                    >
                                      {tag} ↗
                                    </span>
                                  ))}
                                </div>
                              )}
                            </Link>
                          ))}
                        </div>
                      </div>

                      {/* Column 2: Surfaces & Protocol */}
                      <div className="col-span-4 space-y-4 border-r border-zinc-100 pr-6">
                        <span className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-400">
                          Surfaces
                        </span>
                        <div className="space-y-3">
                          {MEGA_MENU_SURFACES.map((item) => (
                            <Link
                              key={item.title}
                              href={item.href}
                              target={item.external ? "_blank" : undefined}
                              rel={item.external ? "noreferrer" : undefined}
                              onClick={() => setProductsMenuOpen(false)}
                              className="group block rounded-xl p-2 transition-colors hover:bg-orange-50/50"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-zinc-900 group-hover:text-[#f95721] transition-colors">
                                  {item.title}
                                </span>
                                {item.badge && (
                                  <span className="rounded bg-zinc-100 text-zinc-700 text-[10px] font-mono font-bold px-1.5 py-0.5">
                                    {item.badge}
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-zinc-500 leading-relaxed mt-0.5">{item.desc}</p>
                            </Link>
                          ))}
                        </div>
                      </div>

                      {/* Column 3: Featured Customer Story (Aligned Header & Layout) */}
                      <div className="col-span-4 space-y-4 flex flex-col">
                        <span className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-400">
                          Featured Story
                        </span>
                        <div className="flex-1 flex flex-col justify-between rounded-xl border border-zinc-200 bg-zinc-50/80 p-5">
                          <div className="space-y-3">
                            <span className="inline-block text-[10px] font-mono font-bold uppercase tracking-wider text-[#f95721] bg-orange-100 px-2 py-0.5 rounded">
                              Customer Story
                            </span>
                            <h4 className="text-sm font-extrabold text-zinc-950 leading-snug">
                              How scaling teams use Chatty to automate 84% of support inquiries.
                            </h4>
                            <p className="text-xs text-zinc-600 leading-relaxed">
                              Zero hallucinations, calendar booking in-chat, and full MCP tooling for autonomous AI agents.
                            </p>
                          </div>

                          <Link
                            href="#mcp"
                            onClick={() => setProductsMenuOpen(false)}
                            className="mt-6 inline-flex items-center gap-1.5 text-xs font-semibold text-[#f95721] hover:text-[#ea4815] transition-colors"
                          >
                            <span>Explore MCP Integration</span>
                            <ArrowRight className="size-3.5" />
                          </Link>
                        </div>
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
                <div ref={megaMenuResourcesRef} className="absolute top-full left-0 pt-2 w-72 transition-all duration-150">
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

            <Link href="#capabilities" className="px-3.5 py-2 rounded-lg hover:text-zinc-950 hover:bg-zinc-50">
              Capabilities
            </Link>
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
          </nav>

          {/* Right: Actions (Pure Flat GitHub Icon, Sign In, Start for Free) */}
          <div className="hidden sm:flex items-center gap-3">
            {/* Pure GitHub Icon Button (Flat minimal, no elevation) */}
            <Link
              href="https://github.com/Damayantha/chatty"
              target="_blank"
              rel="noreferrer"
              className="flex size-9 items-center justify-center rounded-lg hover:bg-zinc-100 text-zinc-700 hover:text-zinc-950 transition-colors"
              title="GitHub Repository"
            >
              <GithubIcon className="size-4" />
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
              href="#capabilities"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-sm font-medium text-zinc-700 py-1"
            >
              Capabilities
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
              href="https://github.com/Damayantha/chatty"
              target="_blank"
              className="flex items-center gap-2 text-sm font-medium text-zinc-700 py-1"
            >
              <GithubIcon className="size-4" />
              <span>GitHub Repository</span>
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
            HERO SECTION (Spacious, Firecrawl Style with GSAP)
            ========================================== */}
        <section
          ref={heroSectionRef}
          onMouseMove={handleHeroMouseMove}
          className="relative overflow-hidden pt-16 pb-24 sm:pt-24 sm:pb-32 lg:pt-28"
        >
          {/* Interactive Particle Constellation Canvas */}
          <canvas
            ref={heroCanvasRef}
            className="pointer-events-none absolute inset-0 z-0 h-full w-full opacity-65"
          />

          {/* Ambient Mouse Glow Aura (GSAP Follower) */}
          <div
            ref={mouseAuraRef}
            className="pointer-events-none absolute -top-40 -left-40 size-[460px] rounded-full bg-gradient-to-br from-orange-400/20 via-rose-300/10 to-transparent blur-3xl transition-opacity duration-300"
            style={{ willChange: "transform" }}
          />

          {/* Subtle Clean Technical Grid Pattern */}
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.35]"
            style={{
              backgroundImage: `linear-gradient(to right, #f1f5f9 1px, transparent 1px), linear-gradient(to bottom, #f1f5f9 1px, transparent 1px)`,
              backgroundSize: "48px 48px",
            }}
          />

          {/* Creative Floating Technical Telemetry Badges (GSAP 3D parallax) */}
          <div className="telemetry-pill-1 pointer-events-none absolute top-12 left-4 sm:left-12 hidden md:inline-flex items-center gap-2 rounded-full border border-zinc-200/90 bg-white/95 px-3.5 py-1.5 text-[11px] font-mono text-zinc-700 shadow-md shadow-zinc-200/50 backdrop-blur-md z-10">
            <span className="size-2 rounded-full bg-[#f95721] animate-ping" />
            <span>pgvector · 1536-dim RAG</span>
          </div>
          <div className="telemetry-pill-2 pointer-events-none absolute top-20 right-4 sm:right-12 hidden md:inline-flex items-center gap-2 rounded-full border border-zinc-200/90 bg-white/95 px-3.5 py-1.5 text-[11px] font-mono text-zinc-700 shadow-md shadow-zinc-200/50 backdrop-blur-md z-10">
            <span className="size-2 rounded-full bg-emerald-500" />
            <span>MCP Protocol · 18 Tools Active</span>
          </div>
          <div className="telemetry-pill-3 pointer-events-none absolute bottom-8 left-10 hidden lg:inline-flex items-center gap-2 rounded-full border border-zinc-200/90 bg-white/95 px-3.5 py-1.5 text-[11px] font-mono text-zinc-700 shadow-md shadow-zinc-200/50 backdrop-blur-md z-10">
            <span className="size-2 rounded-full bg-blue-500" />
            <span>Google & Outlook Sync · Live</span>
          </div>

          <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center z-10">
            {/* Announcement Pill */}
            <Link
              ref={heroBadgeRef}
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

            {/* Kinetic 3D Staggered Headline */}
            <h1
              ref={heroHeadingRef}
              className="font-display text-4xl font-extrabold tracking-tight text-zinc-950 sm:text-6xl lg:text-7xl max-w-5xl mx-auto leading-[1.08] [perspective:1200px]"
            >
              {["Power", "AI", "customer", "support", "with"].map((w, idx) => (
                <span key={idx} className="hero-word inline-block mr-2 sm:mr-3.5 origin-bottom">
                  {w}
                </span>
              ))}{" "}
              <span className="inline-block text-[#f95721]">
                {["grounded", "business", "data"].map((w, idx) => (
                  <span key={idx} className="hero-word inline-block mr-2 sm:mr-3.5 origin-bottom">
                    {w}
                  </span>
                ))}
              </span>
            </h1>

            {/* Spacious Clear Subtitle */}
            <p
              ref={heroSubRef}
              className="mt-6 max-w-3xl mx-auto text-base sm:text-lg text-zinc-600 leading-relaxed"
            >
              The context-aware AI platform to answer visitor inquiries, capture high-intent leads, and schedule
              calendar demo meetings at scale. It&apos;s also open source.
            </p>

            {/* CTAs Row with Magnetic Pull Physics */}
            <div
              ref={heroCtasRef}
              className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
            >
              <Link
                href="/signup"
                onMouseMove={handleMagneticMove}
                onMouseLeave={handleMagneticLeave}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-[#f95721] hover:bg-[#ea4815] px-8 py-3.5 text-sm font-bold text-white shadow-lg shadow-orange-500/25 active:scale-[0.98] transition-shadow"
              >
                <span>Start for free</span>
              </Link>
              <Link
                href="#mcp"
                onMouseMove={handleMagneticMove}
                onMouseLeave={handleMagneticLeave}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 px-6 py-3.5 text-sm font-semibold text-zinc-800 shadow-sm transition-shadow"
              >
                <Terminal className="size-4 text-zinc-500" />
                <span>Setup for agents (MCP)</span>
              </Link>
              <Link
                href="https://github.com/Damayantha/chatty"
                target="_blank"
                onMouseMove={handleMagneticMove}
                onMouseLeave={handleMagneticLeave}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 px-5 py-3.5 text-sm font-semibold text-zinc-800 transition-colors"
              >
                <GithubIcon className="size-4 text-zinc-700" />
                <span>GitHub Source</span>
              </Link>
            </div>

            {/* Live Autonomous MCP Terminal Window (GSAP Hacking Text Animation) */}
            <div
              ref={terminalBoxRef}
              className="mt-12 mx-auto max-w-2xl rounded-2xl border border-zinc-800 bg-zinc-950 p-4 sm:p-5 shadow-2xl text-left font-mono text-xs"
            >
              {/* Window Header */}
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-zinc-800 text-zinc-400">
                <div className="flex items-center gap-2">
                  <span className="size-2.5 rounded-full bg-red-500/80 inline-block" />
                  <span className="size-2.5 rounded-full bg-yellow-500/80 inline-block" />
                  <span className="size-2.5 rounded-full bg-emerald-500/80 inline-block" />
                  <span className="ml-2 text-[11px] text-zinc-400 font-medium">chatty-agent@edge:~ // mcp-stream v2.4</span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/60 font-semibold">
                  <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>ONLINE SSE</span>
                </div>
              </div>

              {/* Terminal Code Lines */}
              <div className="space-y-1.5 text-[11px] sm:text-xs">
                <div className="terminal-line text-zinc-400 flex items-center gap-2">
                  <span className="text-[#f95721] font-bold">❯</span>
                  <span>chatty mcp-connect --sse https://api.chatty.personaliai.com/mcp</span>
                </div>
                <div className="terminal-line text-zinc-500 pl-4">
                  [mcp:handshake] Connected to Claude Desktop / Cursor. 18 tools active.
                </div>
                <div className="terminal-line text-zinc-300 flex items-center gap-2">
                  <span className="text-emerald-400 font-bold">❯</span>
                  <span>tool/call: &quot;knowledge_search&quot; threshold=0.84 query=&quot;Enterprise SLA terms&quot;</span>
                </div>
                <div className="terminal-line text-emerald-400 pl-4 flex items-center gap-2">
                  <span>⚡ [pgvector:1536d] Cosine: 0.942 · 0 hallucinations · 34ms</span>
                </div>
                <div className="terminal-line text-orange-300 pl-4 flex items-center gap-1">
                  <span>✓ Reserved 2:30 PM meeting slot via Google Calendar Sync</span>
                  <span className="inline-block w-1.5 h-3.5 bg-[#f95721] ml-1 animate-pulse" />
                </div>
              </div>
            </div>

            {/* Trust Badges Row */}
            <div
              ref={heroBadgesRef}
              className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-medium text-zinc-500"
            >
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
          </div>
        </section>

        {/* ==========================================
            INTERACTIVE CODE MATRIX (Firecrawl Style)
            ========================================== */}
        <section id="code" className="py-20 border-t border-b border-zinc-200/80 bg-[#fbfbfb]">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto">
              <p className="text-xs font-mono font-semibold uppercase tracking-wider text-[#f95721]">
                // CAPABILITY CODE MATRIX
              </p>
              <h2 className="mt-3 font-display text-3xl sm:text-4xl font-bold tracking-tight text-zinc-950">
                Interactive Engine & Live Response
              </h2>
              <p className="mt-3 text-sm sm:text-base text-zinc-600">
                Select a capability below and test the real-time API execution and formatted JSON response.
              </p>
            </div>

            {/* 4 Feature Selector Cards (Firecrawl Style) */}
            <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 max-w-5xl mx-auto">
              {CODE_FEATURES.map((feat, idx) => {
                const isSelected = activeFeatureIdx === idx;
                const Icon = feat.icon;
                return (
                  <button
                    key={feat.id}
                    type="button"
                    onClick={() => {
                      setActiveFeatureIdx(idx);
                      setActiveLangIdx(0);
                    }}
                    className={`text-left p-4 rounded-xl border transition-all ${
                      isSelected
                        ? "bg-white border-[#f95721] shadow-md shadow-orange-500/10 ring-1 ring-[#f95721]"
                        : "bg-white/80 border-zinc-200 text-zinc-700 hover:bg-white hover:border-zinc-300"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div
                        className={`flex size-8 items-center justify-center rounded-lg ${
                          isSelected ? "bg-[#f95721] text-white" : "bg-zinc-100 text-zinc-600"
                        }`}
                      >
                        <Icon className="size-4" />
                      </div>
                      <span className="text-[10px] font-mono font-semibold text-zinc-400 bg-zinc-100 px-1.5 py-0.5 rounded">
                        {feat.tag}
                      </span>
                    </div>
                    <p className="mt-3 font-bold text-xs text-zinc-950">{feat.title}</p>
                    <p className="mt-1 text-[11px] text-zinc-500 leading-snug line-clamp-2">{feat.desc}</p>
                  </button>
                );
              })}
            </div>

            {/* Dual Terminal Frame (Firecrawl Style) */}
            <div className="mt-6 max-w-5xl mx-auto rounded-2xl border border-zinc-200 bg-white shadow-xl overflow-hidden">
              {/* Top Controls Bar */}
              <div className="flex flex-wrap items-center justify-between border-b border-zinc-200 bg-zinc-50/90 px-4 py-2.5 gap-3">
                {/* Language Tabs */}
                <div className="flex items-center gap-1.5">
                  {activeFeature.languages.map((l, idx) => (
                    <button
                      key={l.lang}
                      type="button"
                      onClick={() => setActiveLangIdx(idx)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                        activeLangIdx === idx
                          ? "bg-white text-zinc-950 shadow-sm border border-zinc-200"
                          : "text-zinc-600 hover:text-zinc-950"
                      }`}
                    >
                      {l.lang}
                    </button>
                  ))}
                </div>

                {/* Action Buttons: Run Query + Copy Code */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleTriggerRun}
                    disabled={isExecuting}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#f95721] hover:bg-[#ea4815] text-white px-3 py-1.5 text-xs font-semibold shadow-sm transition-all active:scale-[0.98] disabled:opacity-50"
                  >
                    <Play ref={playIconRef} className={`size-3 fill-current ${isExecuting ? "animate-spin" : ""}`} />
                    <span>{isExecuting ? "Executing..." : "Run Query"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleCopyCode(activeLang.code)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors shadow-sm"
                  >
                    {codeCopied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
                    <span>{codeCopied ? "Copied!" : "Copy"}</span>
                  </button>
                </div>
              </div>

              {/* Side-by-Side Dual Terminal */}
              <div className="grid grid-cols-1 lg:grid-cols-12 bg-white divide-y lg:divide-y-0 lg:divide-x divide-zinc-200">
                {/* Left: Request / Integration Code */}
                <div className="lg:col-span-7 p-5 bg-white font-mono text-xs text-zinc-800 overflow-x-auto min-h-[340px]">
                  <div className="flex items-center justify-between pb-3 mb-3 border-b border-zinc-100 text-zinc-400 text-[11px]">
                    <span className="font-semibold text-zinc-700">{activeLang.filename}</span>
                    <span className="text-[#f95721] font-bold font-mono">{activeLang.lang}</span>
                  </div>
                  <div className="flex gap-4">
                    <div className="select-none text-zinc-300 text-right pr-3 border-r border-zinc-100 min-w-[2rem]">
                      {activeLang.code.split("\n").map((_, i) => (
                        <div key={i}>{i + 1}</div>
                      ))}
                    </div>
                    <div className="flex-1 leading-relaxed whitespace-pre">
                      {activeLang.code.split("\n").map((line, i) => (
                        <div key={i}>{renderSyntaxTokens(line)}</div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right: Live Response Window with Streaming Reveal and Status Badge */}
                <div className="lg:col-span-5 p-5 bg-[#fafafa] font-mono text-xs text-zinc-800 overflow-x-auto min-h-[340px] flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between pb-3 mb-3 border-b border-zinc-200 text-zinc-400 text-[11px]">
                      <span className="font-semibold text-zinc-700">RESPONSE</span>
                      <div className="flex items-center gap-2">
                        {isExecuting ? (
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-mono font-medium text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                            <span className="size-1.5 rounded-full bg-amber-500 animate-ping" />
                            <span>Evaluating...</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-mono font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                            <span className="size-1.5 rounded-full bg-emerald-500" />
                            <span>200 OK · 142ms</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Response Output with Line-by-Line Reveal */}
                    <div className="flex gap-4">
                      <div className="select-none text-zinc-300 text-right pr-3 border-r border-zinc-200 min-w-[2rem]">
                        {activeResponseLines.map((_, i) => (
                          <div key={i} className={i <= visibleLines ? "opacity-100" : "opacity-0"}>
                            {i + 1}
                          </div>
                        ))}
                      </div>
                      <div className="flex-1 leading-relaxed whitespace-pre">
                        {activeResponseLines.map((line, i) => (
                          <div
                            key={i}
                            className={`transition-opacity duration-100 ${
                              i <= visibleLines ? "opacity-100" : "opacity-0"
                            }`}
                          >
                            {renderSyntaxTokens(line)}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-zinc-200 flex items-center justify-between text-[11px] text-zinc-400">
                    <span>Payload: JSON-RPC 2.0</span>
                    <span className="text-zinc-600 font-mono">Status: Verified Grounded</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ==========================================
            MCP INTEGRATION CODE ONLY (No Descriptions)
            ========================================== */}
        <section id="mcp" className="py-20 bg-white border-b border-zinc-200/80">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-200">
              <div>
                <div className="inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-2.5 py-0.5 text-[11px] font-mono font-bold text-[#f95721] mb-2">
                  <PlugZap className="size-3" />
                  MODEL CONTEXT PROTOCOL
                </div>
                <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-zinc-950">
                  MCP Integration Code
                </h2>
                <p className="mt-1 font-mono text-xs text-zinc-500">
                  Endpoint: <span className="text-zinc-900 font-semibold">https://api.chatty.personaliai.com/mcp</span>
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Link
                  href="https://docs.chatty.personaliai.com/guides/mcp"
                  target="_blank"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-600 hover:text-zinc-950 px-3 py-2 rounded-lg border border-zinc-200 hover:bg-zinc-50 transition-colors"
                >
                  <span>Protocol Spec</span>
                  <ExternalLink className="size-3 text-zinc-400" />
                </Link>
              </div>
            </div>

            {/* MCP Target Platforms Tabs */}
            <div className="mt-6 flex flex-wrap items-center gap-2">
              {MCP_INTEGRATIONS.map((target, idx) => (
                <button
                  key={target.name}
                  type="button"
                  onClick={() => setSelectedMcpIdx(idx)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all border ${
                    selectedMcpIdx === idx
                      ? "bg-[#f95721] text-white border-[#f95721] shadow-sm shadow-orange-500/20"
                      : "bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100 hover:text-zinc-950"
                  }`}
                >
                  {target.name}
                </button>
              ))}
            </div>

            {/* MCP Code Viewer Box */}
            <div className="mt-4 rounded-2xl border border-zinc-200 bg-white shadow-lg overflow-hidden">
              <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-50/90 px-4 py-3 text-xs">
                <div className="flex items-center gap-2 font-mono text-[11px] text-zinc-600">
                  <span className="font-semibold text-zinc-900">{MCP_INTEGRATIONS[selectedMcpIdx].file}</span>
                  <span className="rounded bg-zinc-200/80 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-700">
                    {MCP_INTEGRATIONS[selectedMcpIdx].badge}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => handleCopyMcp(MCP_INTEGRATIONS[selectedMcpIdx].code)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors shadow-sm"
                >
                  {mcpCodeCopied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
                  <span>{mcpCodeCopied ? "Copied!" : "Copy Code"}</span>
                </button>
              </div>

              <div className="p-5 font-mono text-xs text-zinc-800 bg-white overflow-x-auto">
                <div className="flex gap-4">
                  {/* Line Numbers */}
                  <div className="select-none text-zinc-300 text-right pr-3 border-r border-zinc-100 min-w-[2rem]">
                    {MCP_INTEGRATIONS[selectedMcpIdx].code.split("\n").map((_, i) => (
                      <div key={i}>{i + 1}</div>
                    ))}
                  </div>
                  {/* Code Lines */}
                  <div className="flex-1 leading-relaxed whitespace-pre">
                    {MCP_INTEGRATIONS[selectedMcpIdx].code.split("\n").map((line, i) => (
                      <div key={i}>{renderSyntaxTokens(line)}</div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ==========================================
            CORE INDUSTRIAL CAPABILITIES
            ========================================== */}
        <section id="capabilities" className="py-24 bg-[#fbfbfb]">
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
            (Clean Light Styling - No Black/Orange Clashing)
            ========================================== */}
        <section id="roi" className="py-24 bg-white border-t border-zinc-200/80">
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
                {/* Sliders Area (Clean Light Styling) */}
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
                      className="w-full h-2 rounded-lg bg-zinc-200 appearance-none cursor-pointer accent-[#f95721]"
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
                      className="w-full h-2 rounded-lg bg-zinc-200 appearance-none cursor-pointer accent-[#f95721]"
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

                {/* Calculation Outputs Card (Clean Light Styling) */}
                <div className="lg:col-span-6 rounded-xl border border-zinc-200 bg-zinc-50/80 p-6 text-left">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-lg border border-zinc-200 bg-white p-3.5 shadow-sm">
                      <p className="font-mono text-2xl font-bold text-zinc-950">
                        {animatedDeflected.toLocaleString()}
                      </p>
                      <p className="text-[11px] font-semibold text-[#f95721] mt-1">Deflected Inquiries / mo</p>
                    </div>

                    <div className="rounded-lg border border-zinc-200 bg-white p-3.5 shadow-sm">
                      <p className="font-mono text-2xl font-bold text-zinc-950">{animatedHours}h</p>
                      <p className="text-[11px] font-semibold text-[#f95721] mt-1">Support Hours Saved</p>
                    </div>

                    <div className="rounded-lg border border-zinc-200 bg-white p-3.5 shadow-sm">
                      <p className="font-mono text-2xl font-bold text-emerald-600">
                        {animatedLeads.toLocaleString()}
                      </p>
                      <p className="text-[11px] font-semibold text-zinc-700 mt-1">High-Intent Leads</p>
                    </div>

                    <div className="rounded-lg border border-zinc-200 bg-white p-3.5 shadow-sm">
                      <p className="font-mono text-2xl font-bold text-emerald-600">
                        ${animatedSavings.toLocaleString()}
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
        <section id="architecture" className="py-20 border-t border-b border-zinc-200/80 bg-[#fbfbfb]">
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
            PRE-FOOTER CALL TO ACTION (Vibrant Fire Orange)
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
                  <GithubIcon className="size-4" />
                  <span>GitHub Repository</span>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ==========================================
          FOOTER (Firecrawl Precision Bordered Grid - Exact Match to Screenshot)
          ========================================== */}
      <footer className="border-t border-zinc-200/80 bg-white">
        <div className="mx-auto max-w-7xl border-x border-zinc-200/80">
          {/* Top 3-Column Grid: Left Column, Open Center Space, Right Column */}
          <div className="grid grid-cols-1 md:grid-cols-4">
            {/* Left Column (Capabilities & Developer Surfaces) */}
            <div className="col-span-1 md:border-r border-zinc-200/80 flex flex-col">
              <Link
                href="#capabilities"
                className="px-6 py-4 text-sm text-zinc-600 hover:text-zinc-950 transition-colors border-b border-zinc-200/80"
              >
                Grounded RAG & Vectors
              </Link>
              <Link
                href="#mcp"
                className="px-6 py-4 text-sm text-zinc-600 hover:text-zinc-950 transition-colors border-b border-zinc-200/80"
              >
                MCP Protocol Server
              </Link>
              <Link
                href="#code"
                className="px-6 py-4 text-sm text-zinc-600 hover:text-zinc-950 transition-colors border-b border-zinc-200/80"
              >
                Developer API & SDK
              </Link>
              <Link
                href="#pricing"
                className="px-6 py-4 text-sm text-zinc-600 hover:text-zinc-950 transition-colors border-b border-zinc-200/80"
              >
                Pricing Plans
              </Link>
              <Link
                href="/voice-demo"
                className="px-6 py-4 text-sm text-zinc-600 hover:text-zinc-950 transition-colors border-b border-zinc-200/80"
              >
                Voice AI Demo
              </Link>
              <Link
                href="/zoom"
                className="px-6 py-4 text-sm text-zinc-600 hover:text-zinc-950 transition-colors border-b border-zinc-200/80"
              >
                Zoom Integration
              </Link>
              <Link
                href="https://docs.chatty.personaliai.com/guides/calendar-scheduling"
                target="_blank"
                rel="noreferrer"
                className="px-6 py-4 text-sm text-zinc-600 hover:text-zinc-950 transition-colors border-b md:border-b-0 border-zinc-200/80"
              >
                Calendar & Booking Sync
              </Link>
            </div>

            {/* Center Column: Open Architectural Negative Space (Firecrawl Style) */}
            <div className="col-span-2 hidden md:block border-r border-zinc-200/80 bg-white" />

            {/* Right Column (Community, Ecosystem & Trust) */}
            <div className="col-span-1 flex flex-col">
              <Link
                href="/affiliates"
                className="px-6 py-4 text-sm text-zinc-600 hover:text-zinc-950 transition-colors border-b border-zinc-200/80"
              >
                Affiliates Program
              </Link>
              <Link
                href="https://docs.chatty.personaliai.com"
                target="_blank"
                rel="noreferrer"
                className="px-6 py-4 text-sm text-zinc-600 hover:text-zinc-950 transition-colors border-b border-zinc-200/80"
              >
                Documentation
              </Link>
              <Link
                href="#architecture"
                className="px-6 py-4 text-sm text-zinc-600 hover:text-zinc-950 transition-colors border-b border-zinc-200/80"
              >
                Chatty vs Zendesk
              </Link>
              <Link
                href="#roi"
                className="px-6 py-4 text-sm text-zinc-600 hover:text-zinc-950 transition-colors border-b border-zinc-200/80"
              >
                Deflection Benchmarks
              </Link>
              <Link
                href="/support"
                className="px-6 py-4 text-sm text-zinc-600 hover:text-zinc-950 transition-colors border-b border-zinc-200/80"
              >
                Support Center
              </Link>
              <Link
                href="https://github.com/Damayantha/chatty"
                target="_blank"
                rel="noreferrer"
                className="px-6 py-4 text-sm text-zinc-600 hover:text-zinc-950 transition-colors border-b border-zinc-200/80"
              >
                GitHub Repository
              </Link>
              <Link
                href="/privacy"
                className="px-6 py-4 text-sm text-zinc-600 hover:text-zinc-950 transition-colors border-b md:border-b-0 border-zinc-200/80"
              >
                Security & Compliance
              </Link>
            </div>
          </div>

          {/* 4-Cell Legal & Copyright Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 border-t border-zinc-200/80">
            <div className="px-6 py-4 text-sm text-zinc-400 border-r border-b md:border-b-0 border-zinc-200/80 flex items-center">
              © {new Date().getFullYear()} PersonaliAI
            </div>
            <Link
              href="/terms"
              className="px-6 py-4 text-sm text-zinc-600 hover:text-zinc-950 transition-colors border-b md:border-b-0 md:border-r border-zinc-200/80 flex items-center"
            >
              Terms of Service
            </Link>
            <Link
              href="/privacy"
              className="px-6 py-4 text-sm text-zinc-600 hover:text-zinc-950 transition-colors border-r border-zinc-200/80 flex items-center"
            >
              Privacy Policy
            </Link>
            <Link
              href="mailto:security@personaliai.com"
              className="px-6 py-4 text-sm text-zinc-600 hover:text-zinc-950 transition-colors flex items-center"
            >
              Report Abuse
            </Link>
          </div>

          {/* Status Bar Row (Blue live indicator matching Firecrawl) */}
          <div className="grid grid-cols-1 md:grid-cols-2 border-t border-zinc-200/80">
            <div className="px-6 py-4 md:border-r border-zinc-200/80 flex items-center gap-2 text-sm text-[#2b7fff] font-medium">
              <span className="size-2 rounded-full bg-[#2b7fff] inline-block animate-pulse" />
              <a
                href="https://status.personaliai.com"
                target="_blank"
                rel="noreferrer"
                className="hover:underline"
              >
                All systems normal
              </a>
            </div>
            <div className="hidden md:block px-6 py-4 bg-white" />
          </div>
        </div>
      </footer>
    </div>
  );
}
