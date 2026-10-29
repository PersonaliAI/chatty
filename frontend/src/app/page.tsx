"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import Script from "next/script";
import {
  ArrowRight,
  Globe,
  Sparkles,
  Loader2,
  Zap,
  UserCheck,
  CalendarCheck,
  AudioWaveform,
  Menu,
  X,
  BookOpen,
  ChevronDown,
  CheckCircle2,
  ShieldCheck,
  Headphones,
  MessageSquare,
  Cpu,
  Bot,
  TrendingUp,
  Clock,
  Layers,
  Lock,
  Activity,
  Check,
  ShoppingBag,
  PhoneCall,
  Workflow,
  ExternalLink,
  type LucideIcon,
} from "lucide-react";
import { captureAffiliateReferral } from "@/lib/affiliate-referral";
import { BACKEND_URL, backendUrl } from "@/lib/backend-client";
import { VoiceAgentPanel } from "@/components/voice/VoiceAgentPanel";
import { McpHub } from "@/components/mcp/McpHub";


// Color tokens - a single warm, organic palette (this design has no dark
// mode, matching the reference it was redesigned from).
const colorVars = {
  "--color-bg": "#f5ead8",
  "--color-surface": "#ebddc5",
  "--color-text": "#201e1d",
  "--color-accent": "#c67139",
  "--color-accent-2": "#7a8a5e",
  "--color-divider": "color-mix(in srgb, #201e1d 16%, transparent)",
  "--color-accent-100": "#fff2eb",
  "--color-accent-200": "#ffe1d0",
  "--color-accent-600": "#b2622d",
  "--color-accent-700": "#8c491a",
  "--color-accent-800": "#643312",
  "--color-accent-2-100": "#f0fae1",
  "--color-accent-2-200": "#e1eecc",
  "--color-accent-2-800": "#3d472b",
  "--color-neutral-900": "#2e2b25",
  "--shadow-sm": "0 1px 2px color-mix(in srgb, #2e2b25 14%, transparent)",
  "--shadow-md": "0 3px 10px color-mix(in srgb, #2e2b25 16%, transparent)",
  "--shadow-lg": "0 12px 32px color-mix(in srgb, #2e2b25 22%, transparent)",
} as React.CSSProperties;

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56 0-.27-.01-1.17-.02-2.12-3.2.7-3.87-1.36-3.87-1.36-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.7.08-.7 1.17.08 1.78 1.2 1.78 1.2 1.03 1.77 2.71 1.26 3.37.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.05 11.05 0 0 1 5.79 0c2.2-1.49 3.17-1.18 3.17-1.18.64 1.59.24 2.76.12 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.69 5.38-5.25 5.67.41.36.78 1.07.78 2.15 0 1.55-.01 2.8-.01 3.18 0 .31.21.67.8.56A10.51 10.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
    </svg>
  );
}

interface Feature {
  title: string;
  desc: string;
}

const featuresList: Feature[] = [
  { title: "Knowledge", desc: "Train the AI agent to answer questions about your website, files, and more." },
  { title: "Actions", desc: "Go beyond just Q&A and let the AI agent use any of your apps." },
  { title: "Refine answers", desc: "Review conversations and correct the AI agent to give better answers." },
  { title: "Analytics", desc: "Learn how your customers are interacting with your AI agent." },
  { title: "Multiple AI agents", desc: "Create multiple AI agents for different use cases or different websites." },
  { title: "White-label", desc: "Features that help you resell AI agents as part of your business." },
  { title: "Inbox", desc: "Access conversations between your AI agent and page visitors." },
  { title: "AI Models", desc: "GPT-5.3, Claude Opus, Mistral, Gemini... Switch between AI models at any time." },
  { title: "AI Agent API", desc: "Use our powerful API and access your AI agent from other apps." },
  { title: "Self-Hosted & BYOK", desc: "Bring your own OpenAI, Anthropic, Gemini, or OpenRouter API keys, or self-host the open-source stack 100% free on your own servers." },
  { title: "Multilingual", desc: "Our AI agents can use over 95 languages out of the box." },
  { title: "Customizable", desc: "Change name, icon, theme, position, color, CSS, JS... make it yours." },
  { title: "Guardrails", desc: "Prevent abuse. Get a reliable and assertive AI agent, not 'ChatGPT for free'." },
  { title: "Auto train", desc: "Automatically keep your AI agent up to date: daily, weekly and monthly." },
  { title: "Allow list", desc: "Secure your AI agent to work only on domains under your control." },
  { title: "Leads", desc: "Collect name, email, phone number of the chat visitor." },
  { title: "Bulk", desc: "Bulk operations to handle any amount of training." },
  { title: "Notifications", desc: "Receive email & webhook updates with recent conversations." },
  { title: "GDPR & Privacy First", desc: "Enterprise data privacy: automated PII scrubbing (cards, SSN, IBAN), visitor right to erasure, and zero AI foundation training." },
];

const faqs = [
  { question: "How do I train my AI agent?", answer: "Point Chatty at your website, upload files (PDF, DOCX, CSV), or paste in text - it crawls and indexes everything automatically. Auto Train keeps it in sync on a daily, weekly, or monthly schedule so answers never go stale." },
  { question: "Is there a free plan or can I self-host?", answer: "All 3 cloud plans (Hobby, Standard, and Business) include a full-featured 14-day free trial with no credit card required. The only 100% free forever option is self-hosting the open-source Chatty stack on your own infrastructure via Docker and bringing your own LLM API keys." },
  { question: "How do message credits map to real conversations?", answer: "One credit covers one full AI question-and-answer cycle with vector knowledge retrieval. A typical customer inquiry takes 1–2 turns, meaning 1,000 credits handles about ~800 full visitor conversations. Standard includes ~8,000 conversations, and Business covers ~35,000 conversations per month. Need unlimited? Self-host our open-source codebase for $0 with your own LLM API key." },
  { question: "How does lead collection work?", answer: "Chatty can ask for a visitor's name, email, and phone number mid-conversation, save it automatically to your dashboard, and push it to your CRM or inbox via webhook or API." },
  { question: "Can I embed the AI agent on multiple sites?", answer: "Yes - each AI agent can be embedded anywhere, and the Allow List lets you restrict it to run only on domains you control." },
];

const helpArticles = [
  {
    category: "Getting started",
    title: "Launch your first Chatty bot",
    outcome: "A trained, branded assistant live on a production page with a tested fallback path.",
    summary: "Start with one focused use case: answer product questions, qualify visitors, or route support requests. Give the bot a clear identity, train it from trusted sources, then test it like a real visitor before publishing.",
    sections: [
      { heading: "Create the bot", body: "Open the dashboard, create a bot, and set the name, welcome message, tone, language behavior, and first suggested prompts. Keep the first welcome short and action-oriented so visitors know exactly what to ask." },
      { heading: "Train the source of truth", body: "Add your website, help docs, pricing page, policy pages, PDFs, or pasted text. Wait for indexing to finish, then ask the bot ten questions your customers actually ask." },
      { heading: "Publish safely", body: "Copy the embed script from the Embed tab and place it before the closing body tag. Add your production domain to the allow list before sending traffic to the widget." },
    ],
    checklist: ["Bot identity and welcome message are set", "At least one authoritative knowledge source is indexed", "Embed script works on a staging or production page", "Fallback contact or handoff route is visible"],
  },
  {
    category: "Knowledge",
    title: "Keep answers accurate with a healthy knowledge base",
    outcome: "Reliable answers that stay aligned with your current product, pricing, and policies.",
    summary: "A strong bot is only as good as the material it can cite. Treat the knowledge base like a living help center: structured, current, and biased toward canonical sources instead of broad crawls.",
    sections: [
      { heading: "Use canonical sources", body: "Train from pages that contain final policy, pricing, setup, billing, delivery, return, and troubleshooting information. Avoid duplicate drafts and outdated campaign pages." },
      { heading: "Close missing-answer gaps", body: "Review unanswered questions and low-confidence conversations weekly. Add a short article or source snippet for every recurring gap instead of relying on prompt changes alone." },
      { heading: "Automate freshness", body: "Enable Auto Train for sources that change often. Daily sync is best for pricing, inventory, status, and policy pages; weekly or monthly works for slower documentation." },
    ],
    checklist: ["Pricing and policy pages are indexed", "Old or duplicate sources are removed", "Unanswered questions are reviewed regularly", "Auto Train is enabled for changing content"],
  },
  {
    category: "Safety",
    title: "Secure a bot before publishing",
    outcome: "A public assistant that answers confidently without leaking access or pretending to be a human.",
    summary: "Security is part of the customer experience. Lock the widget to approved domains, keep integration keys scoped, and define exactly when Chatty should stop and hand the conversation to your team.",
    sections: [
      { heading: "Restrict where it runs", body: "Add every approved website to the Allow List before sharing the embed code. This prevents copied scripts from being used on unknown domains." },
      { heading: "Limit integration access", body: "Use separate API keys for separate systems and grant only the scopes each workflow needs. Rotate keys when a teammate or vendor no longer needs access." },
      { heading: "Design the handoff", body: "Add clear escalation rules for billing disputes, account access, urgent issues, sensitive personal data, and questions the bot cannot answer with confidence." },
    ],
    checklist: ["Production domains are allow-listed", "API keys are scoped by integration", "Human handoff rules are written", "Abuse and off-topic guardrails are enabled"],
  },
  {
    category: "Conversions",
    title: "Turn useful conversations into qualified leads",
    outcome: "More qualified conversations reaching your inbox, CRM, calendar, or sales team with context intact.",
    summary: "Lead capture works best when it feels like the natural next step, not a form dropped in front of the visitor. Ask for contact details only when the conversation has enough intent to justify it.",
    sections: [
      { heading: "Ask at the right moment", body: "Trigger lead collection after pricing, demo, custom quote, support escalation, or availability questions. Keep the form short: name, email, and phone only when phone follow-up is useful." },
      { heading: "Preserve conversation context", body: "Send the transcript, visitor page, lead fields, and detected intent to your team so follow-up starts from the conversation instead of a blank record." },
      { heading: "Book when intent is high", body: "Use calendar booking for demo requests, consultations, onboarding calls, and urgent support. Let the visitor choose a real available slot before they leave the site." },
    ],
    checklist: ["Lead trigger is tied to intent", "Required fields are minimal", "Email or webhook delivery is tested", "Booking is connected for high-intent flows"],
  },
  {
    category: "Operations",
    title: "Run the inbox and human handoff well",
    outcome: "A clean support rhythm where AI handles repeat questions and humans own the conversations that need judgment.",
    summary: "The inbox is where automation meets real customers. Use ownership, status, and feedback consistently so the bot improves instead of burying work.",
    sections: [
      { heading: "Own active conversations", body: "Assign conversations deliberately and keep team availability current. When a teammate takes over, pause AI replies so the visitor does not receive conflicting answers." },
      { heading: "Use statuses consistently", body: "Separate open, pending, resolved, and follow-up conversations. This makes response time, missed handoffs, and unresolved issues visible." },
      { heading: "Turn corrections into training", body: "When a human fixes an answer, capture that correction as a knowledge improvement. Repeated inbox fixes should become articles, sources, or guardrail changes." },
    ],
    checklist: ["Conversation ownership is assigned", "AI pause is used during human takeover", "Resolved status is applied after follow-up", "Corrections feed the knowledge base"],
  },
  {
    category: "Codex plugin",
    title: "Add Chatty to Codex with the plugin",
    outcome: "Codex can manage Chatty bots, knowledge, inboxes, campaigns, bookings, and analytics through the hosted MCP server.",
    summary: "Use the public Chatty plugin when you want the easiest Codex setup. The plugin contains the MCP endpoint and Chatty instructions, so users only add the marketplace source once and approve OAuth when Codex connects.",
    sections: [
      { heading: "Add the marketplace", body: "In Codex, open Settings, Plugins, Add, then Add plugin marketplace. Use source https://github.com/PersonaliAI/chatty.git, git ref main, and sparse paths .agents/plugins/marketplace.json and plugins/chatty-integration." },
      { heading: "Install Chatty", body: "After the marketplace loads, install the Chatty integration. Codex will show it as a normal plugin with the Chatty icon, description, starter prompts, and MCP connection." },
      { heading: "Connect your account", body: "Ask Codex to use Chatty. The first run opens OAuth; approve only the scopes you want, then Codex can audit bots, update articles, triage inboxes, and manage booking flows." },
    ],
    checklist: ["Marketplace source is the public GitHub repo", "Sparse path is plugins/chatty-integration", "Chatty plugin is installed and enabled", "OAuth approval completes on first use"],
  },
];

const plans = [
  {
    key: "hobby", tag: "HOBBY", name: "Hobby", monthly: 19, yearlyMonthly: 15, popular: false,
    desc: "Perfect for individuals, developers, and side projects.",
    features: [
      "14-day free trial included",
      "1,000 AI credits/mo (≈ ~800 conversations)",
      "10M training characters",
      "500 MB Media Storage (250 products)",
      "3 AI agents",
      "Fast & Advanced AI models",
      "AI Actions & Analytics",
      "Guardrails & Notifications",
      "Lead collection & API",
      "Provider-managed AI routing",
    ],
  },
  {
    key: "standard", tag: "STANDARD", name: "Standard", monthly: 99, yearlyMonthly: 79, popular: true,
    desc: "All in Hobby, plus advanced automation and multi-bot systems.",
    features: [
      "14-day free trial included",
      "10,000 AI credits/mo (≈ ~8,000 conversations)",
      "20M training characters",
      "2 GB Media Storage (1,500 products)",
      "6 AI agents",
      "Daily Auto Train sync",
      "Remove branding completely",
      "Unlimited team members",
    ],
  },
  {
    key: "business", tag: "BUSINESS", name: "Business", monthly: 399, yearlyMonthly: 319, popular: false,
    desc: "For enterprise scale, heavy traffic, and reseller options.",
    features: [
      "14-day free trial included",
      "40,000 AI credits/mo (≈ ~35,000 conversations)",
      "50M training characters",
      "10 GB Media Storage (Unlimited products)",
      "Unlimited agent configurations (fair-use limits apply)",
      "BYOK (Bring-Your-Own-Key) option",
      "White-label configuration",
      "Management Admin API",
    ],
  },
];

const chips: { icon: LucideIcon; title: string; desc: string; bg: string; fg: string }[] = [
  { icon: Zap, title: "Zero-Code, Full Control", desc: "Or drive it all through 81 MCP tools", bg: "var(--color-accent-100)", fg: "var(--color-accent-700)" },
  { icon: UserCheck, title: "Captures Every Lead", desc: "Name, email, phone - automatically", bg: "var(--color-accent-2-100)", fg: "var(--color-accent-2-800)" },
  { icon: CalendarCheck, title: "Books Its Own Meetings", desc: "Straight onto your calendar", bg: "#eee7db", fg: "#474238" },
];

const mcpPoints = [
  { title: "OAuth 2.0 + PKCE", desc: "RFC 7591/8414-compliant dynamic client registration - no shared secrets pasted into a config file." },
  { title: "81 real tools", desc: "Bots, flows, campaigns, knowledge, inbox, leads, calendar, deflection, WooCommerce sync, voice studio, GDPR export." },
  { title: "Same data, same rules", desc: "Every tool reads and writes the exact tables the dashboard does - nothing simulated, nothing mocked." },
  { title: "Scoped access", desc: "read / write / knowledge / actions / admin scopes, so an agent only gets what it needs." },
];

type McpInstallTab = "plugin" | "hosted" | "manual";

const mcpInstallTabs: {
  id: McpInstallTab;
  label: string;
  eyebrow: string;
  title: string;
  desc: string;
  steps: string[];
  code?: string;
  cta?: { label: string; href: string };
}[] = [
  {
    id: "plugin",
    label: "Codex plugin",
    eyebrow: "Recommended",
    title: "Install the Chatty Codex integration",
    desc: "The public plugin lets any Codex user add Chatty from GitHub. It ships the Chatty icon, starter prompts, skill guidance, and the hosted MCP endpoint in one integration.",
    steps: [
      "Open Codex, then go to Settings, Plugins, Add, and choose Add plugin marketplace.",
      "Paste the public Chatty repository values shown here, then add the marketplace.",
      "Install the Chatty integration, keep it enabled, and approve OAuth on first use.",
      "Ask Codex to audit bots, update knowledge, triage inboxes, manage campaigns, or create booking-ready assistants.",
    ],
    code: `Source\nhttps://github.com/PersonaliAI/chatty.git\n\nGit ref\nmain\n\nSparse paths\n.agents/plugins/marketplace.json\nplugins/chatty-integration`,
    cta: { label: "Open dashboard", href: "/dashboard" },
  },
  {
    id: "hosted",
    label: "Hosted MCP",
    eyebrow: "No self-hosting",
    title: "Connect directly to Chatty's hosted MCP server",
    desc: "Use the managed endpoint for Claude, ChatGPT, Cursor, Windsurf, or any client that supports remote MCP over OAuth.",
    steps: [
      "Add the hosted Chatty MCP URL to your client.",
      "Sign in with your Chatty account during OAuth authorization.",
      "Keep using the dashboard and MCP together - they read and write the same production data.",
    ],
    code: `https://api.chatty.personaliai.com/mcp`,
  },
  {
    id: "manual",
    label: "Manual config",
    eyebrow: "Universal",
    title: "Paste the JSON into any MCP-compatible client",
    desc: "For clients that still expect a JSON block, use this config exactly. The first connection opens the same OAuth consent flow.",
    steps: [
      "Open your MCP client configuration file.",
      "Paste the Chatty server block and save.",
      "Restart the client if it does not hot-reload MCP servers.",
    ],
    code: `{\n  "mcpServers": {\n    "chatty": {\n      "url": "https://api.chatty.personaliai.com/mcp"\n    }\n  }\n}`,
  },
];

export default function Home() {
  const router = useRouter();
  const [sandboxUrl, setSandboxUrl] = useState("");
  const [isSandboxLoading, setIsSandboxLoading] = useState(false);
  const [sandboxError, setSandboxError] = useState<string | null>(null);

  async function handleInstantSandbox(e: React.FormEvent) {
    e.preventDefault();
    const raw = sandboxUrl.trim();
    if (!raw) {
      setSandboxError("Please enter your website or store URL.");
      return;
    }

    setIsSandboxLoading(true);
    setSandboxError(null);

    try {
      const res = await fetch(backendUrl("/api/claim/instant-sandbox"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: raw }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "Unable to initialize sandbox. Please check the URL.");
      }

      const data = await res.json();
      if (data.claim_url) {
        router.push(data.claim_url);
      } else {
        router.push(`/claim/${data.claim_token}`);
      }
    } catch (err: unknown) {
      setSandboxError(err instanceof Error ? err.message : "Failed to generate instant sandbox bot.");
      setIsSandboxLoading(false);
    }
  }
  const [isYearly, setIsYearly] = useState(false);
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const [selectedFeature, setSelectedFeature] = useState<Feature | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeMcpInstallTab, setActiveMcpInstallTab] = useState<McpInstallTab>("plugin");
  const [activeAnnouncement, setActiveAnnouncement] = useState(0);
  const [heroVoiceOpen, setHeroVoiceOpen] = useState(false);
  const [heroVoiceSessionId, setHeroVoiceSessionId] = useState("");
  const [heroActiveTab, setHeroActiveTab] = useState<"resolution" | "voice" | "ecommerce" | "workflows">("resolution");
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveAnnouncement((prev) => (prev === 0 ? 1 : 0));
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    captureAffiliateReferral(new URLSearchParams(window.location.search));
  }, []);

  useEffect(() => {
    if (!heroVoiceOpen) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setHeroVoiceOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [heroVoiceOpen]);

  const activeMcpInstall = mcpInstallTabs.find((tab) => tab.id === activeMcpInstallTab) ?? mcpInstallTabs[0];

  const openHeroVoiceAgent = () => {
    setHeroVoiceSessionId(`landing-voice-${Date.now()}`);
    setHeroVoiceOpen(true);
  };

  // widget.js cleanup on unmount
  useEffect(() => {
    return () => {
      document.getElementById("chatty-widget-host")?.remove();
      delete (window as unknown as { Chatty?: unknown }).Chatty;
      delete (window as unknown as { __chattyWidgetLoaded?: unknown }).__chattyWidgetLoaded;
      delete (window as unknown as { __chatty_loaded?: unknown }).__chatty_loaded;
    };
  }, []);

  const navLinks = (
    <>
      <Link href="#features" className="hover:opacity-70 transition-opacity">Features</Link>
      <Link href="#pricing" className="hover:opacity-70 transition-opacity">Pricing</Link>
      <Link href="#help-center" className="hover:opacity-70 transition-opacity">Help center</Link>
      <Link href="/affiliates" className="hover:opacity-70 transition-opacity">Affiliates</Link>
      <Link href="#faq" className="hover:opacity-70 transition-opacity">FAQ</Link>
    </>
  );

  return (
    <div className="chatty-landing antialiased" style={{ ...colorVars, fontFamily: "var(--font-body)", background: "var(--color-bg)", color: "var(--color-text)", overflowX: "clip" }}>
      {/* Announcement bar auto slider */}
      <div className="relative overflow-hidden h-[40px] sm:h-[44px] transition-colors duration-700" style={{ background: activeAnnouncement === 0 ? "var(--color-accent-2-100)" : "var(--color-accent-100)" }}>
        {/* MCP Notification */}
        <div 
          className="absolute inset-0 flex items-center justify-center text-center px-5 text-[13px] sm:text-[13.5px] transition-transform duration-700 ease-in-out" 
          style={{ 
            transform: activeAnnouncement === 0 ? "translateY(0)" : "translateY(-100%)",
            opacity: activeAnnouncement === 0 ? 1 : 0,
            pointerEvents: activeAnnouncement === 0 ? "auto" : "none"
          }}
        >
          <div>
            <span className="font-semibold" style={{ color: "var(--color-accent-2-800)" }}>NEW</span>
            <span className="hidden sm:inline" style={{ color: "color-mix(in srgb, var(--color-text) 82%, transparent)" }}> — Chatty now ships a full MCP server: run your dashboard from a conversation.</span>
            <span className="sm:hidden" style={{ color: "color-mix(in srgb, var(--color-text) 82%, transparent)" }}> — Chatty now ships a full MCP server.</span>
            <a href="#mcp" className="ml-1.5 font-semibold whitespace-nowrap" style={{ color: "var(--color-accent)" }}>Learn more →</a>
          </div>
        </div>
        
        {/* Affiliate Notification */}
        <div 
          className="absolute inset-0 flex items-center justify-center text-center px-5 text-[13px] sm:text-[13.5px] transition-transform duration-700 ease-in-out" 
          style={{ 
            transform: activeAnnouncement === 1 ? "translateY(0)" : "translateY(100%)",
            opacity: activeAnnouncement === 1 ? 1 : 0,
            pointerEvents: activeAnnouncement === 1 ? "auto" : "none"
          }}
        >
          <div>
            <span className="font-semibold" style={{ color: "var(--color-accent-800)" }}>PARTNERS</span>
            <span className="hidden sm:inline" style={{ color: "color-mix(in srgb, var(--color-text) 82%, transparent)" }}> — Earn 30% monthly recurring commission by joining our Affiliate Program.</span>
            <span className="sm:hidden" style={{ color: "color-mix(in srgb, var(--color-text) 82%, transparent)" }}> — Earn 30% recurring commission.</span>
            <Link href="/affiliate" className="ml-1.5 font-semibold whitespace-nowrap" style={{ color: "var(--color-accent)" }}>Join now →</Link>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="max-w-[1200px] mx-auto flex items-center gap-4 px-5 sm:px-9 py-4 relative">
        <Link href="/" className="flex items-center gap-2.5 mr-auto shrink-0" style={{ fontFamily: "var(--font-heading)", fontSize: "18px" }}>
          <Image src="/favicon.png" alt="Chatty" width={28} height={28} className="size-7 object-contain shrink-0" />
          Chatty
        </Link>
        <div className="hidden md:flex items-center gap-8 text-sm">
          {navLinks}
          <a href="https://github.com/PersonaliAI/chatty" target="_blank" rel="noopener noreferrer" aria-label="GitHub" className="flex items-center hover:opacity-70 transition-opacity">
            <GithubIcon className="size-[19px]" />
          </a>
          <Link href="/dashboard" className="hover:opacity-70 transition-opacity">Log in</Link>
          <Link href="/signup" className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition-colors" style={{ fontFamily: "var(--font-heading)", background: "var(--color-accent)", color: "var(--color-bg)" }}>
            Start Free Trial
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
        <button
          onClick={() => setMobileMenuOpen((v) => !v)}
          className="md:hidden p-2 -mr-2 cursor-pointer"
          aria-label="Toggle menu"
          aria-expanded={mobileMenuOpen}
        >
          {mobileMenuOpen ? <X className="size-6" /> : <Menu className="size-6" />}
        </button>

        {mobileMenuOpen && (
          <div
            className="md:hidden absolute top-full left-0 right-0 mx-5 mt-1 rounded-3xl p-6 flex flex-col gap-5 text-base z-40"
            style={{ background: "var(--color-surface)", boxShadow: "var(--shadow-lg)" }}
          >
            <Link href="#features" onClick={() => setMobileMenuOpen(false)}>Features</Link>
            <Link href="#pricing" onClick={() => setMobileMenuOpen(false)}>Pricing</Link>
            <Link href="#help-center" onClick={() => setMobileMenuOpen(false)}>Help center</Link>
            <Link href="/affiliates" onClick={() => setMobileMenuOpen(false)}>Affiliates</Link>
            <Link href="#faq" onClick={() => setMobileMenuOpen(false)}>FAQ</Link>
            <a href="https://github.com/PersonaliAI/chatty" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
              <GithubIcon className="size-[18px]" /> GitHub
            </a>
            <Link href="/dashboard" onClick={() => setMobileMenuOpen(false)}>Log in</Link>
            <Link
              href="/signup"
              onClick={() => setMobileMenuOpen(false)}
              className="inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-medium"
              style={{ fontFamily: "var(--font-heading)", background: "var(--color-accent)", color: "var(--color-bg)" }}
            >
              Start Free Trial
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        )}
      </nav>

      <div className="max-w-[1200px] mx-auto px-5 sm:px-9">
        {/* Hero */}
        <section className="relative pt-6 sm:pt-12 pb-16 sm:pb-24 text-center overflow-visible">
          {/* Subtle Ambient Lighting Gradients */}
          <div className="absolute left-1/2 -top-28 -translate-x-1/2 w-[600px] h-[400px] sm:w-[900px] sm:h-[520px] rounded-full -z-10 pointer-events-none opacity-60 blur-3xl" style={{ background: "radial-gradient(circle, var(--color-accent-2-200) 0%, transparent 70%)" }} />
          <div className="absolute -left-32 top-24 w-52 h-52 sm:w-80 sm:h-80 rounded-full -z-10 pointer-events-none opacity-50 blur-2xl" style={{ background: "radial-gradient(circle, var(--color-accent-200) 0%, transparent 70%)" }} />
          <div className="absolute -right-32 top-64 w-48 h-48 sm:w-72 sm:h-72 rounded-full -z-10 pointer-events-none opacity-50 blur-2xl" style={{ background: "radial-gradient(circle, var(--color-accent-2-100) 0%, transparent 70%)" }} />

          {/* Top Trust Proof Bar (Product Hunt & Founding 50) */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 mb-7">
            <a
              href="https://www.producthunt.com/products/chatty-9/reviews/new?utm_source=badge-product_review&utm_medium=badge&utm_source=badge-chatty&#0045;9"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block transition-transform hover:scale-105"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://api.producthunt.com/widgets/embed-image/v1/product_review.svg?product_id=1317137&theme=light"
                alt="Chatty - Open-source AI support bot for your website | Product Hunt"
                style={{ width: "240px", height: "52px" }}
                width="240"
                height="52"
              />
            </a>
            <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full text-xs font-medium border bg-amber-50/95 border-amber-300/80 text-amber-950 shadow-2xs backdrop-blur-xs">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
              </span>
              <span><strong>Founding 50 Program:</strong> Lock in today&apos;s price for life. <strong>18 of 50 spots claimed</strong>.</span>
            </div>
          </div>

          {/* Enterprise Eyebrow Pill */}
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full text-xs font-semibold border bg-white/75 backdrop-blur-md border-[var(--color-divider)] text-[var(--color-neutral-900)] shadow-2xs mb-5">
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="tracking-wide uppercase text-[11px] font-bold text-neutral-800">Autonomous Customer Service Platform</span>
            <span className="text-neutral-400">·</span>
            <span className="text-[var(--color-accent-700)] font-semibold">Resolves 78% of Tickets Instantly</span>
          </div>

          {/* Master Headline (Intercom & Zendesk Enterprise Grade) */}
          <h1 className="mx-auto max-w-[21ch] leading-[1.08] tracking-tight text-[clamp(34px,6.8vw,70px)]" style={{ fontFamily: "var(--font-heading)", fontWeight: 400 }}>
            The AI customer service platform built to <span style={{ color: "var(--color-accent-600)" }}>resolve</span>, <span style={{ color: "var(--color-accent-700)" }}>qualify</span>, and <span style={{ color: "var(--color-accent-600)" }}>convert</span>.
          </h1>

          {/* Subtitle */}
          <p className="text-base sm:text-[18px] leading-relaxed max-w-[62ch] mx-auto mt-6" style={{ color: "color-mix(in srgb, var(--color-text) 82%, transparent)" }}>
            Deliver human-quality service at enterprise scale. Chatty deploys autonomous AI agents across web chat, real-time LiveKit voice, WhatsApp, and Slack — trained on your store, help docs, and internal APIs.
          </p>

          {/* Primary & Secondary Enterprise CTA Group */}
          <div className="flex flex-wrap gap-3.5 items-center justify-center mt-8">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2.5 rounded-full px-8 py-4 text-[15px] font-semibold transition-all shadow-md hover:shadow-lg hover:brightness-105 cursor-pointer"
              style={{ fontFamily: "var(--font-heading)", background: "var(--color-accent)", color: "var(--color-bg)" }}
            >
              Start Free 14-Day Trial
              <ArrowRight className="size-4" />
            </Link>
            <button
              type="button"
              onClick={openHeroVoiceAgent}
              className="inline-flex items-center gap-2.5 rounded-full border border-[var(--color-divider)] bg-white/80 backdrop-blur-sm px-6 py-4 text-[15px] font-semibold text-neutral-900 transition-all hover:bg-white hover:border-neutral-400 shadow-2xs cursor-pointer"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              <span className="flex size-2 rounded-full bg-emerald-500 animate-pulse" />
              <AudioWaveform className="size-[18px] text-[var(--color-accent-700)]" />
              <span>Talk to Voice Agent (Live)</span>
            </button>
          </div>
          <p className="mt-3.5 text-xs sm:text-[13px]" style={{ color: "color-mix(in srgb, var(--color-text) 65%, transparent)" }}>
            14-day free trial · No credit card required · Setup in under 5 minutes
          </p>

          {/* Interactive Instant URL Sandbox Bar */}
          <form onSubmit={handleInstantSandbox} className="mt-8 max-w-[640px] mx-auto text-left">
            <div className="flex flex-col sm:flex-row items-stretch gap-2 p-1.5 sm:p-2 rounded-2xl sm:rounded-full bg-white/95 shadow-md border border-[var(--color-divider)] transition-all focus-within:ring-2 focus-within:ring-[var(--color-accent)]/30">
              <div className="flex items-center gap-2.5 px-4 py-2 flex-1 min-w-0">
                <Globe className="size-5 text-[var(--color-accent-700)] shrink-0" />
                <input
                  type="text"
                  value={sandboxUrl}
                  onChange={(e) => {
                    setSandboxUrl(e.target.value);
                    if (sandboxError) setSandboxError(null);
                  }}
                  placeholder="Enter your store or company website (e.g. mystore.com)"
                  className="w-full bg-transparent text-sm sm:text-[15px] outline-hidden placeholder:text-zinc-400 text-zinc-900"
                  disabled={isSandboxLoading}
                />
              </div>
              <button
                type="submit"
                disabled={isSandboxLoading}
                className="inline-flex items-center justify-center gap-2 rounded-xl sm:rounded-full px-6 py-3 text-sm font-semibold text-white transition shadow-sm hover:brightness-105 shrink-0 disabled:opacity-70 cursor-pointer"
                style={{ background: "var(--color-accent)" }}
              >
                {isSandboxLoading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    <span>Building Bot...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="size-4" />
                    <span>Test on Your Site (60s)</span>
                    <ArrowRight className="size-3.5" />
                  </>
                )}
              </button>
            </div>
            {sandboxError && (
              <p className="mt-2 text-xs text-rose-600 font-medium text-center">{sandboxError}</p>
            )}
            <div className="flex flex-wrap items-center justify-center gap-3 mt-3 text-xs" style={{ color: "color-mix(in srgb, var(--color-text) 70%, transparent)" }}>
              <span>⚡ Instant sandbox</span>
              <span>·</span>
              <span>Zero signup required</span>
              <span>·</span>
              <span>No credit card</span>
            </div>
          </form>

          {/* Interactive Enterprise AI Console Showcase (Intercom & Zendesk Centerpiece) */}
          <div className="mt-14 max-w-[1040px] mx-auto text-left">
            <div className="rounded-3xl border border-black/10 bg-white/90 backdrop-blur-xl shadow-xl overflow-hidden">
              {/* Console Top Window Chrome */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-3.5 border-b border-black/8 bg-neutral-50/80">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5" aria-hidden="true">
                    <span className="size-3 rounded-full bg-rose-400/80" />
                    <span className="size-3 rounded-full bg-amber-400/80" />
                    <span className="size-3 rounded-full bg-emerald-400/80" />
                  </div>
                  <span className="text-xs font-semibold text-neutral-700 tracking-tight flex items-center gap-1.5">
                    <Bot className="size-3.5 text-[var(--color-accent-700)]" />
                    <span>Chatty Enterprise Orchestrator</span>
                    <span className="hidden sm:inline text-neutral-400 font-normal">| Live Agent Workspace</span>
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-neutral-600">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/80 font-medium">
                    <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    99.4% Confidence
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200/80 font-medium">
                    <Clock className="size-3" />
                    320ms Latency
                  </span>
                </div>
              </div>

              {/* Interactive Showcase Tabs */}
              <div className="flex items-center gap-1.5 p-2 bg-neutral-100/70 border-b border-black/5 overflow-x-auto scrollbar-none">
                <button
                  type="button"
                  onClick={() => setHeroActiveTab("resolution")}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                    heroActiveTab === "resolution"
                      ? "bg-white text-neutral-900 shadow-xs border border-black/5"
                      : "text-neutral-600 hover:text-neutral-900 hover:bg-white/50"
                  }`}
                >
                  <Sparkles className="size-3.5 text-[var(--color-accent-600)]" />
                  <span>Autonomous Resolution</span>
                </button>
                <button
                  type="button"
                  onClick={() => setHeroActiveTab("voice")}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                    heroActiveTab === "voice"
                      ? "bg-white text-neutral-900 shadow-xs border border-black/5"
                      : "text-neutral-600 hover:text-neutral-900 hover:bg-white/50"
                  }`}
                >
                  <Headphones className="size-3.5 text-blue-600" />
                  <span>LiveKit Voice Agent</span>
                </button>
                <button
                  type="button"
                  onClick={() => setHeroActiveTab("ecommerce")}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                    heroActiveTab === "ecommerce"
                      ? "bg-white text-neutral-900 shadow-xs border border-black/5"
                      : "text-neutral-600 hover:text-neutral-900 hover:bg-white/50"
                  }`}
                >
                  <ShoppingBag className="size-3.5 text-amber-600" />
                  <span>E-Commerce &amp; Leads</span>
                </button>
                <button
                  type="button"
                  onClick={() => setHeroActiveTab("workflows")}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                    heroActiveTab === "workflows"
                      ? "bg-white text-neutral-900 shadow-xs border border-black/5"
                      : "text-neutral-600 hover:text-neutral-900 hover:bg-white/50"
                  }`}
                >
                  <Workflow className="size-3.5 text-purple-600" />
                  <span>81 MCP Workflows</span>
                </button>
              </div>

              {/* Tab 1: Autonomous Resolution (Zendesk & Intercom Fin Style) */}
              {heroActiveTab === "resolution" && (
                <div className="p-5 sm:p-7 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  {/* Left Chat Pane */}
                  <div className="lg:col-span-7 space-y-4">
                    {/* Visitor Message */}
                    <div className="flex items-start gap-3">
                      <div className="size-8 rounded-full bg-neutral-200 border border-neutral-300 flex items-center justify-center font-bold text-xs text-neutral-700 shrink-0">
                        EM
                      </div>
                      <div className="rounded-2xl rounded-tl-xs px-4 py-3 bg-neutral-100 text-neutral-900 text-xs sm:text-sm max-w-[85%] leading-relaxed border border-neutral-200/60 shadow-2xs">
                        Hi! We ordered 50 units (Order #CH-88219). Can we reroute delivery to our Chicago tech hub, and is Net-30 invoicing available for our replenishment?
                      </div>
                    </div>

                    {/* AI Agent Instant Resolution */}
                    <div className="flex items-start gap-3">
                      <div className="size-8 rounded-full bg-[var(--color-accent)] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                        <Bot className="size-4" />
                      </div>
                      <div className="space-y-2.5 max-w-[90%]">
                        <div className="rounded-2xl rounded-tl-xs p-4 bg-white border border-neutral-200/90 shadow-sm space-y-3 text-xs sm:text-sm leading-relaxed text-neutral-800">
                          <p>
                            Hello Emily! I checked <strong>Order #CH-88219</strong> in your store. Since fulfillment begins tomorrow morning, I have successfully updated the delivery destination to your Chicago corporate hub:
                          </p>

                          {/* Live Executed Action Card */}
                          <div className="p-3 rounded-xl bg-emerald-50/90 border border-emerald-200 text-emerald-900 text-xs space-y-1.5">
                            <div className="flex items-center justify-between font-semibold">
                              <span className="flex items-center gap-1.5">
                                <CheckCircle2 className="size-4 text-emerald-600" />
                                Destination Updated in Shopify &amp; DHL
                              </span>
                              <span className="text-[10px] uppercase font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded">Action Done</span>
                            </div>
                            <p className="text-[11px] text-emerald-800">
                              New Address: 333 W Wacker Dr, Suite 1400, Chicago, IL 60606. Tracking confirmed.
                            </p>
                          </div>

                          <p>
                            Regarding <strong>Net-30 invoicing</strong>: your corporate account is pre-approved based on annual volume. I have issued your Net-30 invoice and forwarded the direct billing portal link to your AP team.
                          </p>

                          {/* Source Citation */}
                          <div className="pt-2 border-t border-neutral-100 flex items-center justify-between text-[11px] text-neutral-500">
                            <span className="flex items-center gap-1 text-[var(--color-accent-700)] font-medium">
                              <BookOpen className="size-3" />
                              Cited: Corporate Procurement Policy (Sec. 4.2)
                            </span>
                            <span className="text-neutral-400">0.34s resolution</span>
                          </div>
                        </div>

                        {/* Interactive Action Pills */}
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <button type="button" className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-xs font-medium text-neutral-700 transition cursor-pointer">
                            <span>View Updated Invoice #INV-492</span>
                            <ExternalLink className="size-3" />
                          </button>
                          <button type="button" className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-xs font-medium text-neutral-700 transition cursor-pointer">
                            <Headphones className="size-3 text-blue-600" />
                            <span>Escalate to Human Agent</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Context & Telemetry Sidebar */}
                  <div className="lg:col-span-5 rounded-2xl border border-black/8 bg-neutral-50/70 p-4 space-y-4 text-xs">
                    <div>
                      <div className="flex items-center justify-between text-neutral-500 mb-2">
                        <span className="font-semibold uppercase tracking-wider text-[10px]">Real-Time Telemetry</span>
                        <span className="text-emerald-600 font-medium flex items-center gap-1">
                          <Activity className="size-3" /> Live Hook
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="p-2.5 rounded-xl bg-white border border-neutral-200/80">
                          <span className="text-neutral-400 text-[10px] block">Intent Classified</span>
                          <strong className="text-neutral-800 font-semibold text-xs">Order Mod + Net-30</strong>
                        </div>
                        <div className="p-2.5 rounded-xl bg-white border border-neutral-200/80">
                          <span className="text-neutral-400 text-[10px] block">RAG Citations</span>
                          <strong className="text-neutral-800 font-semibold text-xs">3 Policy Sources</strong>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <span className="font-semibold uppercase tracking-wider text-[10px] text-neutral-500 block">Automated Tool Executions</span>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-neutral-200/70 text-[11px]">
                          <span className="font-mono text-neutral-700">shopify.update_order_address</span>
                          <span className="text-emerald-600 font-bold">200 OK</span>
                        </div>
                        <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-neutral-200/70 text-[11px]">
                          <span className="font-mono text-neutral-700">billing.issue_net30_invoice</span>
                          <span className="text-emerald-600 font-bold">200 OK</span>
                        </div>
                        <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-neutral-200/70 text-[11px]">
                          <span className="font-mono text-neutral-700">crm.log_customer_sentiment</span>
                          <span className="text-emerald-600 font-bold">0.96 Pos</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-200/80 text-amber-900 text-[11px] leading-relaxed">
                      💡 <strong>Autonomous Deflection:</strong> Resolved without agent intervention. Saved ~14 minutes of tier-2 support time.
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: LiveKit Voice Agent (Real-Time WebRTC) */}
              {heroActiveTab === "voice" && (
                <div className="p-5 sm:p-7 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                  <div className="lg:col-span-7 space-y-4">
                    <div className="flex items-center gap-2.5">
                      <span className="px-2.5 py-1 rounded-md bg-blue-100 text-blue-800 font-semibold text-xs flex items-center gap-1.5">
                        <span className="size-2 rounded-full bg-blue-600 animate-pulse" />
                        WebRTC LiveKit Cloud
                      </span>
                      <span className="text-xs text-neutral-500">Chirp 3 STT · Gemini 3.1 TTS · 280ms Latency</span>
                    </div>

                    <div className="rounded-2xl p-5 bg-neutral-900 text-white shadow-md space-y-4">
                      {/* Audio Visualizer Simulation */}
                      <div className="flex items-center justify-center gap-1.5 h-16 py-2">
                        {[40, 75, 100, 60, 30, 85, 95, 50, 80, 100, 70, 45, 90, 60, 35].map((h, i) => (
                          <div
                            key={i}
                            className="w-1.5 rounded-full bg-emerald-400 animate-pulse"
                            style={{ height: `${h}%`, animationDelay: `${i * 70}ms` }}
                          />
                        ))}
                      </div>

                      {/* Voice Transcript Simulation */}
                      <div className="space-y-2 text-xs border-t border-neutral-800 pt-3 text-neutral-300">
                        <p><strong className="text-white">Caller:</strong> &ldquo;Can you reschedule our product demo for Thursday at 2:00 PM EST and send the invite to Sarah?&rdquo;</p>
                        <p className="text-emerald-300"><strong className="text-white">Chatty Voice:</strong> &ldquo;Done! I&apos;ve moved your team demo to Thursday at 2:00 PM EST and invited Sarah. Confirmation is in your inbox.&rdquo;</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={openHeroVoiceAgent}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-bold text-white transition hover:brightness-110 shadow-xs cursor-pointer"
                        style={{ background: "var(--color-accent)" }}
                      >
                        <PhoneCall className="size-3.5" />
                        <span>Launch Live Voice Agent Now</span>
                      </button>
                      <span className="text-xs text-neutral-500">Scale-to-zero compute · Zero idle fees</span>
                    </div>
                  </div>

                  <div className="lg:col-span-5 rounded-2xl border border-black/8 bg-neutral-50/70 p-4 space-y-3 text-xs">
                    <span className="font-semibold uppercase tracking-wider text-[10px] text-neutral-500 block">Voice Engine Capabilities</span>
                    <ul className="space-y-2 text-neutral-700">
                      <li className="flex items-start gap-2">
                        <Check className="size-4 text-emerald-600 shrink-0 mt-0.5" />
                        <span><strong>Barge-in / Interruptible:</strong> Users can cut in mid-sentence; the agent pauses instantly.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="size-4 text-emerald-600 shrink-0 mt-0.5" />
                        <span><strong>95+ Languages:</strong> Automatic accent detection and multi-lingual voice switching.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="size-4 text-emerald-600 shrink-0 mt-0.5" />
                        <span><strong>Google Cloud Run Scale-to-Zero:</strong> Runs on demand with sub-3s cold starts and heartbeats.</span>
                      </li>
                    </ul>
                  </div>
                </div>
              )}

              {/* Tab 3: E-Commerce & Lead Capture */}
              {heroActiveTab === "ecommerce" && (
                <div className="p-5 sm:p-7 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  <div className="lg:col-span-7 space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="size-8 rounded-full bg-neutral-200 border border-neutral-300 flex items-center justify-center font-bold text-xs text-neutral-700 shrink-0">
                        JD
                      </div>
                      <div className="rounded-2xl rounded-tl-xs px-4 py-3 bg-neutral-100 text-neutral-900 text-xs sm:text-sm max-w-[85%] border border-neutral-200/60 shadow-2xs">
                        Looking for wireless noise-canceling headsets with at least 30-hour battery life under $150.
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="size-8 rounded-full bg-[var(--color-accent)] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                        <Bot className="size-4" />
                      </div>
                      <div className="space-y-3 max-w-[92%]">
                        <p className="text-xs sm:text-sm text-neutral-800">
                          Here are the top 2 in-stock models that match your criteria, verified from your WooCommerce catalog:
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <div className="p-3 rounded-xl border border-neutral-200 bg-white shadow-2xs space-y-1.5">
                            <span className="text-[10px] uppercase font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">In Stock · 36h Battery</span>
                            <h4 className="text-xs font-bold text-neutral-900">AeroSound Pro Wireless</h4>
                            <p className="text-xs text-neutral-500">$129.00 <span className="line-through text-[11px]">$169.00</span></p>
                            <button type="button" className="w-full py-1.5 rounded-lg text-xs font-semibold bg-neutral-900 text-white hover:bg-neutral-800 transition cursor-pointer">
                              Add to Cart
                            </button>
                          </div>
                          <div className="p-3 rounded-xl border border-neutral-200 bg-white shadow-2xs space-y-1.5">
                            <span className="text-[10px] uppercase font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">In Stock · 40h Battery</span>
                            <h4 className="text-xs font-bold text-neutral-900">EchoShield ANC Headset</h4>
                            <p className="text-xs text-neutral-500">$142.00</p>
                            <button type="button" className="w-full py-1.5 rounded-lg text-xs font-semibold bg-neutral-900 text-white hover:bg-neutral-800 transition cursor-pointer">
                              Add to Cart
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="lg:col-span-5 rounded-2xl border border-black/8 bg-neutral-50/70 p-4 space-y-3 text-xs">
                    <span className="font-semibold uppercase tracking-wider text-[10px] text-neutral-500 block">Lead Enrichment &amp; CRM Sync</span>
                    <div className="p-3 rounded-xl bg-white border border-neutral-200/80 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-neutral-900">John Doe (VP of Operations)</span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">Lead Score 92</span>
                      </div>
                      <p className="text-neutral-500 text-[11px]">email: john@acme-corp.com · intent: Enterprise Equipment Order</p>
                      <div className="pt-2 border-t border-neutral-100 flex items-center gap-1.5 text-emerald-700 text-[11px] font-medium">
                        <CheckCircle2 className="size-3.5 text-emerald-600" />
                        <span>Pushed to HubSpot &amp; Salesforce automatically</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 4: 81 MCP Tools & Workflows */}
              {heroActiveTab === "workflows" && (
                <div className="p-5 sm:p-7 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  <div className="lg:col-span-7 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-neutral-700">Enterprise Model Context Protocol (MCP) Execution</span>
                      <span className="text-[11px] font-mono text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">RFC 7591 OAuth 2.0 PKCE</span>
                    </div>

                    <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4 font-mono text-xs text-neutral-300 space-y-2 shadow-inner">
                      <p className="text-neutral-500">// 1. Autonomous tool dispatch</p>
                      <p className="text-emerald-400">&gt; call_mcp_tool(&quot;sync_woocommerce_products&quot;, &#123; store_id: &quot;prod_991&quot; &#125;)</p>
                      <p className="text-neutral-400">  status: &quot;248 catalog items synced in 420ms&quot;</p>
                      <p className="text-emerald-400">&gt; call_mcp_tool(&quot;create_calendar_integration&quot;, &#123; slot: &quot;2026-10-30T14:00:00Z&quot; &#125;)</p>
                      <p className="text-neutral-400">  status: &quot;Google Calendar event confirmed. Zoom link attached.&quot;</p>
                    </div>

                    <p className="text-xs text-neutral-600 leading-relaxed">
                      Control bots, training crawls, help center articles, campaigns, inboxes, and meeting calendars from Codex, Claude, ChatGPT, Cursor, or your custom agents.
                    </p>
                  </div>

                  <div className="lg:col-span-5 rounded-2xl border border-black/8 bg-neutral-50/70 p-4 space-y-2.5 text-xs">
                    <span className="font-semibold uppercase tracking-wider text-[10px] text-neutral-500 block">Out-of-the-Box MCP Tools</span>
                    <div className="flex flex-wrap gap-1.5">
                      {["sync_woocommerce", "crawl_website", "human_takeover", "export_leads", "configure_calendar", "discover_gaps", "purge_knowledge", "voice_agent_config", "webhook_dispatch"].map((tool) => (
                        <span key={tool} className="px-2 py-1 rounded-md bg-white border border-neutral-200 text-neutral-700 font-mono text-[10px]">
                          {tool}
                        </span>
                      ))}
                    </div>
                    <span className="text-[11px] text-neutral-500 block pt-1">+ 72 more production tools available instantly.</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Enterprise Key Metrics Strip (Zendesk / Intercom Style) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-12 max-w-[1040px] mx-auto text-left">
            <div className="rounded-2xl p-4 sm:p-5 border border-black/8 bg-white/80 backdrop-blur-sm shadow-2xs">
              <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-neutral-900 block" style={{ fontFamily: "var(--font-heading)" }}>
                78%
              </span>
              <p className="text-xs sm:text-sm font-semibold text-neutral-800 mt-1">Autonomous Resolution</p>
              <p className="text-[11px] sm:text-xs text-neutral-500 mt-0.5">Deflected with zero human touches</p>
            </div>
            <div className="rounded-2xl p-4 sm:p-5 border border-black/8 bg-white/80 backdrop-blur-sm shadow-2xs">
              <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-neutral-900 block" style={{ fontFamily: "var(--font-heading)" }}>
                &lt; 1.2s
              </span>
              <p className="text-xs sm:text-sm font-semibold text-neutral-800 mt-1">Average Response Latency</p>
              <p className="text-[11px] sm:text-xs text-neutral-500 mt-0.5">Streaming tokens across all channels</p>
            </div>
            <div className="rounded-2xl p-4 sm:p-5 border border-black/8 bg-white/80 backdrop-blur-sm shadow-2xs">
              <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-neutral-900 block" style={{ fontFamily: "var(--font-heading)" }}>
                95+
              </span>
              <p className="text-xs sm:text-sm font-semibold text-neutral-800 mt-1">Supported Languages</p>
              <p className="text-[11px] sm:text-xs text-neutral-500 mt-0.5">Real-time STT &amp; TTS voice &amp; text</p>
            </div>
            <div className="rounded-2xl p-4 sm:p-5 border border-black/8 bg-white/80 backdrop-blur-sm shadow-2xs">
              <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-neutral-900 block" style={{ fontFamily: "var(--font-heading)" }}>
                81
              </span>
              <p className="text-xs sm:text-sm font-semibold text-neutral-800 mt-1">Enterprise MCP Tools</p>
              <p className="text-[11px] sm:text-xs text-neutral-500 mt-0.5">Ready for Codex, Claude &amp; Cursor</p>
            </div>
          </div>

          {/* Enterprise Security, Privacy & Compliance Bar */}
          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-7 mt-10 pt-7 max-w-[900px] mx-auto border-t border-[var(--color-divider)]">
            <Link
              href="/dpa"
              className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-blue-50/90 hover:bg-blue-100 border border-blue-200/90 transition-all shadow-2xs group cursor-pointer"
            >
              <Image
                src="/logos/eu-gdpr-icon.svg"
                alt="European Union GDPR Compliance"
                width={26}
                height={26}
                className="size-6 object-contain shrink-0 group-hover:scale-105 transition-transform"
              />
              <span className="font-bold text-blue-950 text-xs tracking-tight">GDPR Compliant</span>
              <span className="text-[11px] text-blue-700 font-medium">(EU &amp; UK)</span>
            </Link>

            <span className="hidden sm:inline-block w-1 h-1 rounded-full bg-neutral-400 opacity-60" />

            <div className="inline-flex items-center gap-2 text-xs font-medium text-neutral-800">
              <span className="size-2 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
              <span>Zero AI Training Guarantee</span>
            </div>

            <span className="hidden sm:inline-block w-1 h-1 rounded-full bg-neutral-400 opacity-60" />

            <div className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-800">
              <Lock className="size-3.5 text-neutral-700" />
              <span>AES-256 Bit Encrypted</span>
            </div>

            <span className="hidden sm:inline-block w-1 h-1 rounded-full bg-neutral-400 opacity-60" />

            <div className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-800">
              <ShieldCheck className="size-4 text-neutral-700" />
              <span>SOC 2 Type II Aligned</span>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="py-14 sm:py-16">
          <span className="block text-[13px] tracking-wide uppercase font-semibold mb-4" style={{ color: "var(--color-accent-700)" }}>[ 01 / Transparent Fees ]</span>
          <h2 className="text-[28px] sm:text-[32px]" style={{ fontFamily: "var(--font-heading)", fontWeight: 400 }}>Pricing plans</h2>
          <p className="text-[15px] sm:text-[15.5px] leading-relaxed max-w-[60ch] mt-3.5" style={{ color: "color-mix(in srgb, var(--color-text) 78%, transparent)" }}>
            Every cloud plan includes a full-featured <strong>14-day free trial</strong> with no credit card required. The only free forever option is self-hosting our open-source stack on your own infrastructure.
          </p>

          {/* Founding 50 Guarantee Banner */}
          <div className="mt-6 p-4 rounded-2xl border border-amber-200/90 bg-amber-50/80 max-w-[760px] flex items-start sm:items-center gap-3 text-xs sm:text-sm text-amber-950 shadow-2xs">
            <span className="text-xl shrink-0">🏷️</span>
            <div>
              <strong>Founding 50 Lifetime Price Lock:</strong> Early customers lock in launch subscription pricing for life while subscribed, in return for a 20-minute product review and testimonial after your first 25 real conversations.
            </div>
          </div>

          <div className="inline-flex rounded-full overflow-hidden border mt-7" style={{ borderColor: "var(--color-divider)" }}>
            <button
              onClick={() => setIsYearly(false)}
              className={`px-4 py-2 text-[13px] cursor-pointer transition-colors ${!isYearly ? "font-semibold" : ""}`}
              style={!isYearly ? { background: "var(--color-accent)", color: "var(--color-bg)" } : {}}
            >
              Monthly
            </button>
            <button
              onClick={() => setIsYearly(true)}
              className={`flex items-center gap-2 px-4 py-2 text-[13px] cursor-pointer transition-colors border-l ${isYearly ? "font-semibold" : ""}`}
              style={{ borderColor: "var(--color-divider)", ...(isYearly ? { background: "var(--color-accent)", color: "var(--color-bg)" } : {}) }}
            >
              Yearly
              <span className="rounded-full text-[10px] px-1.5 py-0.5 font-bold" style={{ background: isYearly ? "var(--color-bg)" : "var(--color-accent-100)", color: isYearly ? "var(--color-accent-700)" : "var(--color-accent-800)" }}>
                Save 20%
              </span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-9">
            {plans.map((plan) => (
              <div
                key={plan.key}
                className="flex flex-col p-6 sm:p-7 rounded-[28px]"
                style={
                  plan.popular
                    ? { background: "var(--color-surface)", boxShadow: "var(--shadow-lg)", border: "2px solid var(--color-accent)" }
                    : { background: "var(--color-surface)", boxShadow: "var(--shadow-sm)" }
                }
              >
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  {plan.popular && (
                    <span className="rounded-full text-[11px] font-semibold px-3 py-1" style={{ background: "var(--color-accent-100)", color: "var(--color-accent-800)" }}>
                      Popular choice
                    </span>
                  )}
                  <span className="rounded-full text-[11px] font-semibold px-3 py-1" style={{ background: "var(--color-accent-2-100)", color: "var(--color-accent-2-800)" }}>
                    14-Day Free Trial
                  </span>
                </div>
                <span className="text-xs tracking-wide uppercase mt-1.5" style={{ color: "color-mix(in srgb, var(--color-text) 60%, transparent)" }}>[ PLAN: {plan.tag} ]</span>
                <h3 className="text-2xl mt-2" style={{ fontFamily: "var(--font-heading)", fontWeight: 400 }}>{plan.name}</h3>
                <div className="mt-2.5 flex items-baseline gap-1.5">
                  <p className="text-[32px]" style={{ fontFamily: "var(--font-heading)", color: "var(--color-accent-700)" }}>
                    ${isYearly ? plan.yearlyMonthly : plan.monthly}/mo
                  </p>
                  <span className="text-xs" style={{ color: "color-mix(in srgb, var(--color-text) 60%, transparent)" }}>
                    {isYearly ? `billed annually ($${plan.yearlyMonthly * 12}/yr)` : "billed monthly"}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-relaxed min-h-[44px]" style={{ color: "color-mix(in srgb, var(--color-text) 78%, transparent)" }}>{plan.desc}</p>
                <ul className="list-none m-0 p-0 mt-4.5 flex flex-col gap-3 flex-1">
                  {plan.features.map((feat) => (
                    <li key={feat} className="flex gap-2 items-start text-[13px] leading-snug">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent-600)" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5"><polyline points="20 6 9 17 4 12" /></svg>
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href={`/signup?plan=chatty_${plan.key}`}
                  className="mt-6 w-full text-center rounded-full px-5 py-3 text-sm font-medium transition-opacity hover:opacity-90"
                  style={{ fontFamily: "var(--font-heading)", background: "var(--color-accent)", color: "var(--color-bg)" }}
                >
                  Start 14-day free trial
                </Link>
              </div>
            ))}
          </div>

          {/* Self-Hosted Open Source — Only Free Option */}
          <div
            className="mt-6 p-6 sm:p-7 rounded-[28px] flex flex-col md:flex-row md:items-center justify-between gap-6 border"
            style={{ background: "var(--color-surface)", borderColor: "var(--color-divider)", boxShadow: "var(--shadow-sm)" }}
          >
            <div className="space-y-2 max-w-[66ch]">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full text-[11px] font-semibold px-3 py-1" style={{ background: "var(--color-accent-2-100)", color: "var(--color-accent-2-800)" }}>
                  Only Free Option
                </span>
                <span className="text-xs tracking-wide uppercase font-semibold" style={{ color: "color-mix(in srgb, var(--color-text) 60%, transparent)" }}>
                  [ SELF-HOSTED / OPEN SOURCE ]
                </span>
              </div>
              <h3 className="text-[22px] sm:text-2xl" style={{ fontFamily: "var(--font-heading)", fontWeight: 400 }}>
                Self-Host on Your Own Server &mdash; $0 Forever
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: "color-mix(in srgb, var(--color-text) 78%, transparent)" }}>
                Free open-source software (MIT). You supply hosting, Supabase (or Docker with Postgres/pgvector), and your own model API keys (Gemini, OpenAI, Anthropic, OpenRouter). Zero software licensing costs forever.
              </p>
            </div>
            <div className="shrink-0">
              <a
                href="https://github.com/PersonaliAI/chatty"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-full border px-6 py-3 text-sm font-medium transition-colors hover:bg-black/5"
                style={{ fontFamily: "var(--font-heading)", borderColor: "var(--color-divider)", color: "var(--color-text)" }}
              >
                <GithubIcon className="size-4" />
                <span>Self-Host via GitHub</span>
              </a>
            </div>
          </div>

          <p className="mt-7 text-[11px] tracking-wide uppercase" style={{ color: "color-mix(in srgb, var(--color-text) 55%, transparent)" }}>
            [ Taxes &amp; Compliance ] All plans are subject to local tax system regulation.
          </p>
        </section>

        {/* Features grid */}
        <section id="features" className="py-8 sm:py-10 pb-14 sm:pb-16">
          <span className="block text-[13px] tracking-wide uppercase font-semibold mb-4" style={{ color: "var(--color-accent-700)" }}>[ 02 / Capabilities ]</span>
          <h2 className="text-[28px] sm:text-[32px]" style={{ fontFamily: "var(--font-heading)", fontWeight: 400 }}>Core features</h2>
          <p className="text-[15px] sm:text-[15.5px] leading-relaxed max-w-[64ch] mt-3.5" style={{ color: "color-mix(in srgb, var(--color-text) 78%, transparent)" }}>
            A granular index of Chatty&apos;s feature set. Click on any block to see detailed configuration parameters and dashboard instructions.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-8">
            {featuresList.map((f, i) => (
              <button
                key={f.title}
                onClick={() => setSelectedFeature(f)}
                className="text-left flex flex-col gap-2.5 p-5 rounded-[22px] cursor-pointer transition-transform hover:-translate-y-0.5"
                style={{ background: "var(--color-surface)", boxShadow: "var(--shadow-sm)" }}
              >
                <span
                  className="size-[34px] rounded-full flex items-center justify-center text-xs"
                  style={{ fontFamily: "var(--font-heading)", background: i % 2 === 0 ? "var(--color-accent-100)" : "var(--color-accent-2-100)", color: i % 2 === 0 ? "var(--color-accent-700)" : "var(--color-accent-2-800)" }}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <p className="text-[17px]" style={{ fontFamily: "var(--font-heading)" }}>{f.title}</p>
                <p className="text-[13px] leading-snug opacity-75">{f.desc}</p>
              </button>
            ))}
          </div>
        </section>

        {/* MCP */}
        <section id="mcp" className="py-8 sm:py-10 pb-16 sm:pb-20">
          <div className="rounded-[28px] sm:rounded-[40px] p-7 sm:p-14" style={{ background: "var(--color-accent-2-100)" }}>
            <span className="block text-[13px] tracking-wide uppercase font-semibold mb-5" style={{ color: "var(--color-accent-2-800)" }}>[ 03 / Agent Control ]</span>
            <McpHub defaultAgent="chatgpt" showCatalog={true} />
          </div>
        </section>

        {/* Help center */}
        <section id="help-center" className="py-8 sm:py-10 pb-14 sm:pb-16" aria-labelledby="help-center-heading">
          <span className="block text-[13px] tracking-wide uppercase font-semibold mb-4" style={{ color: "var(--color-accent-700)" }}>[ 04 / Help Center ]</span>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 id="help-center-heading" className="text-[28px] sm:text-[32px]" style={{ fontFamily: "var(--font-heading)", fontWeight: 400 }}>Build a bot people trust</h2>
              <p className="text-[15px] sm:text-[15.5px] leading-relaxed max-w-[64ch] mt-3.5" style={{ color: "color-mix(in srgb, var(--color-text) 78%, transparent)" }}>
                Practical operating guides for a useful, safe, and conversion-ready Chatty deployment. Each guide is written for the person responsible for the customer experience - not just the installation.
              </p>
            </div>
            <a href="https://docs.chatty.personaliai.com" target="_blank" rel="noopener noreferrer" className="inline-flex w-fit items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium" style={{ borderColor: "var(--color-divider)", color: "var(--color-accent-800)" }}>
              <BookOpen className="size-4" aria-hidden="true" /> Browse documentation
            </a>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-8">
            {helpArticles.map((article, index) => (
              <article key={article.title} className="rounded-[28px] p-5 sm:p-7" style={{ background: "var(--color-surface)", boxShadow: "var(--shadow-sm)" }}>
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className="inline-flex size-9 items-center justify-center rounded-full text-xs"
                    style={{
                      fontFamily: "var(--font-heading)",
                      background: index % 2 === 0 ? "var(--color-accent-100)" : "var(--color-accent-2-100)",
                      color: index % 2 === 0 ? "var(--color-accent-700)" : "var(--color-accent-2-800)",
                    }}
                  >
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide" style={{ borderColor: "var(--color-divider)", color: "color-mix(in srgb, var(--color-text) 62%, transparent)" }}>{article.category}</span>
                </div>
                <h3 className="mt-5 text-[22px] leading-tight" style={{ fontFamily: "var(--font-heading)", fontWeight: 400 }}>{article.title}</h3>
                <p className="mt-2.5 text-sm leading-relaxed" style={{ color: "color-mix(in srgb, var(--color-text) 78%, transparent)" }}>{article.summary}</p>
                <div className="mt-4 rounded-[18px] px-4 py-3 text-[13.5px] leading-relaxed" style={{ background: index % 2 === 0 ? "var(--color-accent-100)" : "var(--color-accent-2-100)", color: "color-mix(in srgb, var(--color-text) 84%, transparent)" }}>
                  <span className="block text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: index % 2 === 0 ? "var(--color-accent-700)" : "var(--color-accent-2-800)" }}>Outcome</span>
                  {article.outcome}
                </div>
                <div className="mt-5 space-y-4">
                  {article.sections.map((section) => (
                    <section key={section.heading}>
                      <h4 className="text-[15px]" style={{ fontFamily: "var(--font-heading)", fontWeight: 400 }}>{section.heading}</h4>
                      <p className="mt-1.5 text-[13.5px] leading-relaxed" style={{ color: "color-mix(in srgb, var(--color-text) 76%, transparent)" }}>{section.body}</p>
                    </section>
                  ))}
                </div>
                <div className="mt-5 border-t pt-4" style={{ borderColor: "var(--color-divider)" }}>
                  <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "color-mix(in srgb, var(--color-text) 58%, transparent)" }}>Before you ship</p>
                  <ul className="mt-3 grid gap-2 text-[13px] leading-snug" style={{ color: "color-mix(in srgb, var(--color-text) 82%, transparent)" }}>
                    {article.checklist.map((item) => (
                      <li key={item} className="flex gap-2">
                        <span className="mt-1 size-1.5 shrink-0 rounded-full" style={{ background: index % 2 === 0 ? "var(--color-accent)" : "var(--color-accent-2)" }} />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="py-8 sm:py-10 pb-14 sm:pb-16">
          <span className="block text-[13px] tracking-wide uppercase font-semibold mb-4" style={{ color: "var(--color-accent-700)" }}>[ 05 / Common Inquiries ]</span>
          <h2 className="text-[28px] sm:text-[32px]" style={{ fontFamily: "var(--font-heading)", fontWeight: 400 }}>Questions</h2>
          <p className="text-[15px] sm:text-[15.5px] leading-relaxed max-w-[60ch] mt-3.5" style={{ color: "color-mix(in srgb, var(--color-text) 78%, transparent)" }}>
            Everything you need to know about Chatty&apos;s training mechanics, costs, safety layers, and white-label setups.
          </p>

          <div className="mt-8 w-full">
            {faqs.map((faq, i) => (
              <div key={faq.question} className="border-b" style={{ borderColor: "var(--color-divider)" }}>
                <button
                  onClick={() => setActiveFaq(activeFaq === i ? null : i)}
                  aria-expanded={activeFaq === i}
                  className="w-full flex justify-between items-center gap-4 bg-transparent border-0 cursor-pointer py-5 text-left"
                  style={{ fontFamily: "var(--font-heading)", fontSize: "16px sm:17px", color: "var(--color-text)" }}
                >
                  <span className="text-[15.5px] sm:text-[17px]">{faq.question}</span>
                  <ChevronDown className={`size-5 shrink-0 transition-transform ${activeFaq === i ? "rotate-180" : ""}`} style={{ color: "var(--color-accent)" }} strokeWidth={2.75} />
                </button>
                {activeFaq === i && (
                  <p className="m-0 mb-5 text-sm leading-relaxed max-w-[64ch]" style={{ color: "color-mix(in srgb, var(--color-text) 78%, transparent)" }}>{faq.answer}</p>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-8 pb-16 sm:pb-20">
          <div className="rounded-[28px] sm:rounded-[44px] py-12 sm:py-16 px-7 sm:px-16 text-center relative overflow-hidden" style={{ background: "var(--color-accent)" }}>
            <div className="absolute -left-24 -bottom-28 w-56 h-56 sm:w-[300px] sm:h-[300px] rounded-full opacity-50 pointer-events-none" style={{ background: "var(--color-accent-600)" }} />
            <h2 className="mx-auto max-w-[20ch] text-[26px] sm:text-[clamp(28px,3.4vw,40px)]" style={{ fontFamily: "var(--font-heading)", fontWeight: 400, color: "var(--color-bg)" }}>
              Ready to convert more visitors?
            </h2>
            <p className="text-[15px] sm:text-[15.5px] leading-relaxed mx-auto mt-4 max-w-[48ch]" style={{ color: "color-mix(in srgb, #f5ead8 85%, transparent)" }}>
              Zero coding. Live on your site in five minutes. Cancel any time during your trial.
            </p>
            <div className="flex gap-3.5 justify-center flex-wrap mt-7">
              <Link href="/signup" className="rounded-full px-7 py-3.5 text-[15px] font-medium" style={{ fontFamily: "var(--font-heading)", background: "var(--color-bg)", color: "var(--color-accent-700)" }}>
                Start free 14-day trial
              </Link>
            </div>
          </div>
        </section>
      </div>

      {/* Footer */}
      {/* Footer */}
      <footer className="max-w-[1200px] mx-auto px-5 sm:px-9 pb-10 sm:pb-12">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-8 pb-9 border-b" style={{ borderColor: "var(--color-divider)" }}>
          <div className="col-span-2 sm:col-span-3 lg:col-span-1">
            <span className="flex items-center gap-2.5 text-[17px]" style={{ fontFamily: "var(--font-heading)" }}>
              <Image src="/favicon.png" alt="Chatty" width={26} height={26} className="size-[26px] object-contain shrink-0" />
              Chatty
            </span>
            <p className="text-[13.5px] leading-relaxed mt-3.5 max-w-[26ch]" style={{ color: "color-mix(in srgb, var(--color-text) 70%, transparent)" }}>
              Custom AI agents that train on your content and convert your visitors.
            </p>
            <span className="inline-block mt-3.5 text-[11px] tracking-wide uppercase" style={{ color: "color-mix(in srgb, var(--color-text) 55%, transparent)" }}>By PersonaliAI</span>
          </div>
          <div>
            <p className="text-xs tracking-wide uppercase mb-3.5 font-semibold" style={{ color: "color-mix(in srgb, var(--color-text) 55%, transparent)" }}>Product</p>
            <div className="flex flex-col gap-2.5 text-sm">
              <Link href="#features">Features</Link>
              <Link href="#pricing">Pricing</Link>
              <Link href="#help-center">Help center</Link>
              <Link href="/affiliates">Affiliates</Link>
              <Link href="#faq">FAQ</Link>
              <Link href="#mcp">MCP server</Link>
            </div>
          </div>
          <div>
            <p className="text-xs tracking-wide uppercase mb-3.5 font-semibold" style={{ color: "color-mix(in srgb, var(--color-text) 55%, transparent)" }}>Compare</p>
            <div className="flex flex-col gap-2.5 text-sm">
              <Link href="/compare/chatty-vs-intercom" className="hover:opacity-80 transition-opacity">vs Intercom</Link>
              <Link href="/compare/chatty-vs-zendesk" className="hover:opacity-80 transition-opacity">vs Zendesk</Link>
              <Link href="/compare/chatty-vs-crisp" className="hover:opacity-80 transition-opacity">vs Crisp</Link>
              <Link href="/compare/chatty-vs-chatbase" className="hover:opacity-80 transition-opacity">vs Chatbase</Link>
              <Link href="/compare/chatty-vs-tidio" className="hover:opacity-80 transition-opacity">vs Tidio</Link>
              <Link href="/compare/chatty-vs-gorgias" className="hover:opacity-80 transition-opacity">vs Gorgias</Link>
              <Link href="/compare" className="font-medium text-[#c67139] hover:opacity-80 transition-opacity">All comparisons &rarr;</Link>
            </div>
          </div>
          <div>
            <p className="text-xs tracking-wide uppercase mb-3.5 font-semibold" style={{ color: "color-mix(in srgb, var(--color-text) 55%, transparent)" }}>Company</p>
            <div className="flex flex-col gap-2.5 text-sm">
              <Link href="/privacy">Privacy Policy</Link>
              <Link href="/terms">Terms of Service</Link>
              <Link href="/dpa">Data Processing (DPA)</Link>
              <Link href="/subprocessors">Sub-processors</Link>
              <Link href="/dashboard">Dashboard</Link>
            </div>
          </div>
          <div>
            <p className="text-xs tracking-wide uppercase mb-3.5 font-semibold" style={{ color: "color-mix(in srgb, var(--color-text) 55%, transparent)" }}>Connect</p>
            <div className="flex flex-col gap-2.5 text-sm">
              <a href="https://github.com/PersonaliAI/chatty" target="_blank" rel="noopener noreferrer">GitHub</a>
              <Link href="/dashboard">Log in</Link>
              <div className="pt-2">
                <a
                  href="https://www.producthunt.com/products/chatty-9/reviews/new?utm_source=badge-product_review&utm_medium=badge&utm_source=badge-chatty&#0045;9"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block hover:opacity-85 transition-opacity"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="https://api.producthunt.com/widgets/embed-image/v1/product_review.svg?product_id=1317137&theme=light"
                    alt="Chatty - Open-source AI support bot for your website | Product Hunt"
                    style={{ width: "200px", height: "43px" }}
                    width="200"
                    height="43"
                  />
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* GDPR Compliance Footer Strip */}
        <div
          className="mt-10 pt-8 pb-4 border-t flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 text-xs"
          style={{ borderColor: "var(--color-divider)" }}
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-5">
            <Link
              href="/dpa"
              className="shrink-0 hover:scale-[1.03] transition-transform drop-shadow-md"
              title="Official European Union GDPR Compliance (Regulation EU 2016/679)"
            >
              <Image
                src="/logos/gdpr-official-badge-v2.svg"
                alt="Official European Union GDPR Compliance Badge"
                width={280}
                height={60}
                className="h-14 sm:h-16 w-auto object-contain"
                priority
              />
            </Link>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <p className="font-bold text-zinc-900 text-sm tracking-tight">
                  EU &amp; UK Data Protection
                </p>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  VERIFIED
                </span>
              </div>
              <p className="text-xs font-medium text-zinc-600 flex flex-wrap items-center gap-x-2">
                <span>Automated PII scrubbing</span>
                <span className="text-zinc-400">•</span>
                <span>Built-in DPA &amp; SCCs</span>
                <span className="text-zinc-400">•</span>
                <span>Zero AI training</span>
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs font-medium shrink-0">
            <Link
              href="/dpa"
              className="px-4 py-2 rounded-lg bg-blue-50 text-blue-900 hover:bg-blue-100 border border-blue-200 transition-colors shadow-2xs font-semibold"
            >
              Download DPA &amp; SCCs
            </Link>
            <Link
              href="/subprocessors"
              className="hover:underline underline-offset-2 px-2 py-1 text-zinc-700 hover:text-zinc-950 font-medium"
            >
              Subprocessors
            </Link>
            <span className="opacity-40">•</span>
            <Link
              href="/privacy"
              className="hover:underline underline-offset-2 px-2 py-1 text-zinc-700 hover:text-zinc-950 font-medium"
            >
              Privacy Safeguards
            </Link>
          </div>
        </div>

        <p className="mt-6 text-[12.5px]" style={{ color: "color-mix(in srgb, var(--color-text) 60%, transparent)" }}>&copy; {new Date().getFullYear()} PersonaliAI. All rights reserved.</p>
      </footer>

      {/* Keep the landing CTA as a centered in-page popup. The floating chat
          widget has its own compact voice surface and does not reuse this shell. */}
      {heroVoiceOpen && heroVoiceSessionId && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
          aria-label="Chatty voice agent"
        >
          <button
            type="button"
            className="absolute inset-0 cursor-default bg-neutral-950/35 backdrop-blur-sm"
            onClick={() => setHeroVoiceOpen(false)}
            aria-label="Close voice agent"
          />
          <div className="relative z-10 h-[min(820px,calc(100dvh-1.5rem))] max-h-[calc(100dvh-1.5rem)] w-full max-w-[560px] overflow-hidden rounded-[28px] bg-white shadow-[0_28px_90px_-28px_rgba(0,0,0,.55)] animate-in fade-in zoom-in-95 slide-in-from-bottom-4 duration-300">
            <VoiceAgentPanel
              botId="ad32f373-7694-43f4-9465-f8d65ce291e3"
              sessionId={heroVoiceSessionId}
              backendUrl={BACKEND_URL}
              onClose={() => setHeroVoiceOpen(false)}
              className="h-full"
            />
          </div>
        </div>
      )}

      {/* Feature detail modal */}
      {selectedFeature && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "color-mix(in srgb, var(--color-neutral-900) 55%, transparent)" }}>
          <div onClick={() => setSelectedFeature(null)} className="absolute inset-0" />
          <div className="relative w-full max-w-md p-6 sm:p-7 z-10 text-left rounded-[28px]" style={{ background: "var(--color-bg)", boxShadow: "var(--shadow-lg)" }}>
            <button
              onClick={() => setSelectedFeature(null)}
              className="absolute top-5 right-5 p-1.5 rounded-full cursor-pointer transition-colors"
              style={{ color: "color-mix(in srgb, var(--color-text) 55%, transparent)" }}
              aria-label="Close modal"
            >
              <X className="size-4" />
            </button>
            <span
              className="inline-flex size-9 rounded-full items-center justify-center text-xs"
              style={{ fontFamily: "var(--font-heading)", background: "var(--color-accent-100)", color: "var(--color-accent-700)" }}
            >
              {String(featuresList.findIndex((f) => f.title === selectedFeature.title) + 1).padStart(2, "0")}
            </span>
            <h3 className="mt-4 text-xl" style={{ fontFamily: "var(--font-heading)", fontWeight: 400 }}>{selectedFeature.title}</h3>
            <p className="mt-3 text-sm leading-relaxed" style={{ color: "color-mix(in srgb, var(--color-text) 80%, transparent)" }}>{selectedFeature.desc}</p>
            <div className="mt-5 p-4 rounded-2xl text-[13px] leading-relaxed" style={{ background: "var(--color-surface)", color: "color-mix(in srgb, var(--color-text) 75%, transparent)" }}>
              Configure this from the dashboard - no code, no server-side setup.
            </div>
            <div className="mt-6 flex justify-end gap-2.5">
              <button
                onClick={() => setSelectedFeature(null)}
                className="px-4 py-2.5 text-sm rounded-full cursor-pointer border"
                style={{ borderColor: "var(--color-divider)" }}
              >
                Dismiss
              </button>
              <Link
                href="/dashboard"
                onClick={() => setSelectedFeature(null)}
                className="px-4 py-2.5 text-sm rounded-full"
                style={{ fontFamily: "var(--font-heading)", background: "var(--color-accent)", color: "var(--color-bg)" }}
              >
                Try feature
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Chatty on Chatty support widget */}
      <Script
        src="/widget.js?v=2026-10-23.v4"
        data-id="ad32f373-7694-43f4-9465-f8d65ce291e3"
        data-bot-id="ad32f373-7694-43f4-9465-f8d65ce291e3"
        strategy="afterInteractive"
      />
    </div>
  );
}
