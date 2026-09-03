"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import Script from "next/script";
import { Caprasimo, Figtree } from "next/font/google";
import {
  ArrowRight,
  Zap,
  UserCheck,
  CalendarCheck,
  Clock,
  Menu,
  X,
  ImageIcon,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";

const caprasimo = Caprasimo({ weight: "400", subsets: ["latin"], variable: "--font-heading", display: "swap" });
const figtree = Figtree({ weight: ["400", "600", "700"], subsets: ["latin"], variable: "--font-body", display: "swap" });

// Color tokens — a single warm, organic palette (this design has no dark
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

// Stand-in for a real product screenshot — labeled, not pretending to be one.
function ShowcasePlaceholder({ label, className = "" }: { label: string; className?: string }) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed text-center px-6 ${className}`}
      style={{ borderColor: "var(--color-divider)", background: "var(--color-surface)", color: "color-mix(in srgb, var(--color-text) 55%, transparent)" }}
    >
      <ImageIcon className="size-8" strokeWidth={1.5} />
      <span className="text-xs font-medium">{label}</span>
    </div>
  );
}

interface Feature {
  title: string;
  desc: string;
}

const featuresList: Feature[] = [
  { title: "Knowledge", desc: "Train the chatbot to answer questions about your website, files, and more." },
  { title: "Actions", desc: "Go beyond just Q&A and let the chatbot use any of your apps." },
  { title: "Refine answers", desc: "Review conversations and correct the chatbot to give better answers." },
  { title: "Analytics", desc: "Learn how your customers are interacting with your chatbot." },
  { title: "Multiple chatbots", desc: "Create multiple chatbots for different use cases or different websites." },
  { title: "White-label", desc: "Features that help you resell chatbots as part of your business." },
  { title: "Inbox", desc: "Access conversations between your chatbot and page visitors." },
  { title: "AI Models", desc: "GPT-5.3, Claude Opus, Mistral, Gemini... Switch between AI models at any time." },
  { title: "Chatbot API", desc: "Use our powerful API and access your chatbot from other apps." },
  { title: "BYOK Option", desc: "Provide your own OpenAI, Anthropic, or OpenRouter API key to manage your costs — on every plan." },
  { title: "Multilingual", desc: "Our chatbots can use over 95 languages out of the box." },
  { title: "Customizable", desc: "Change name, icon, theme, position, color, CSS, JS... make it yours." },
  { title: "Guardrails", desc: "Prevent abuse. Get a reliable and assertive chatbot, not 'ChatGPT for free'." },
  { title: "Auto train", desc: "Automatically keep your chatbot up to date: daily, weekly and monthly." },
  { title: "Allow list", desc: "Secure your chatbot to work only on domains under your control." },
  { title: "Leads", desc: "Collect name, email, phone number of the chat visitor." },
  { title: "Bulk", desc: "Bulk operations to handle any amount of training." },
  { title: "Notifications", desc: "Receive email & webhook updates with recent conversations." },
];

const faqs = [
  { question: "How do I train my chatbot?", answer: "Point Chatty at your website, upload files (PDF, DOCX, CSV), or paste in text — it crawls and indexes everything automatically. Auto Train keeps it in sync on a daily, weekly, or monthly schedule so answers never go stale." },
  { question: "Can I use my own API keys?", answer: "Yes. BYOK is available on every plan — plug in your own OpenAI, Anthropic, or OpenRouter key and manage your own model costs directly with the provider." },
  { question: "What counts as a 'message credit'?", answer: "Each reply your chatbot sends to a visitor uses one message credit. Credits reset every billing cycle, and unused credits don't roll over." },
  { question: "How does lead collection work?", answer: "Chatty can ask for a visitor's name, email, and phone number mid-conversation, save it automatically to your dashboard, and push it to your CRM or inbox via webhook or API." },
  { question: "Can I embed the chatbot on multiple sites?", answer: "Yes — each chatbot can be embedded anywhere, and the Allow List lets you restrict it to run only on domains you control." },
];

const plans = [
  {
    key: "hobby", tag: "HOBBY", name: "Hobby", monthly: 19, popular: false,
    desc: "Perfect for individuals, developers, and side projects.",
    features: ["1,000 message credits/mo", "10M training characters", "1 chatbot", "Fast & Advanced AI models", "AI Actions & Analytics", "Guardrails & Notifications", "Lead collection & API", "BYOK (Bring-Your-Own-Key)"],
  },
  {
    key: "standard", tag: "STANDARD", name: "Standard", monthly: 99, popular: true,
    desc: "All in Hobby, plus advanced automation and multi-bot systems.",
    features: ["10,000 message credits/mo", "20M training characters", "3 chatbots", "Daily Auto Train sync", "Remove branding completely", "Unlimited team members"],
  },
  {
    key: "business", tag: "BUSINESS", name: "Business", monthly: 399, popular: false,
    desc: "For enterprise scale, heavy traffic, and reseller options.",
    features: ["40,000 message credits/mo", "50M training characters", "5 chatbots", "White-label configuration", "Management Admin API"],
  },
];

const chips: { icon: LucideIcon; title: string; desc: string; bg: string; fg: string }[] = [
  { icon: Zap, title: "Zero-Code, Full Control", desc: "Or drive it all through MCP", bg: "var(--color-accent-100)", fg: "var(--color-accent-700)" },
  { icon: UserCheck, title: "Captures Every Lead", desc: "Name, email, phone — automatically", bg: "var(--color-accent-2-100)", fg: "var(--color-accent-2-800)" },
  { icon: CalendarCheck, title: "Books Its Own Meetings", desc: "Straight onto your calendar", bg: "#eee7db", fg: "#474238" },
];

const showcases = [
  { kicker: "Knowledge", kickerColor: "var(--color-accent-700)", title: "Train it once. It answers like your best rep.", desc: "Point it at your website, files, and docs and it learns your product. Auto Train keeps it current daily, weekly, or monthly, in over 95 languages, without you touching a thing.", label: "Drop a knowledge-training screenshot", imageFirst: false },
  { kicker: "Actions", kickerColor: "var(--color-accent-2-800)", title: 'Beyond Q&A — it gets things done.', desc: 'Let it use any of your apps, book meetings straight onto your calendar, and route conversations through guardrails so it stays reliable, never "ChatGPT for free."', label: "Drop an actions / integrations screenshot", imageFirst: true },
  { kicker: "Leads & Analytics", kickerColor: "var(--color-accent-700)", title: "Every lead captured. Every chat measured.", desc: "Name, email, and phone are collected automatically and land in your Inbox alongside analytics on how visitors actually use your chatbot.", label: "Drop an analytics / inbox screenshot", imageFirst: false },
];

const mcpPoints = [
  { title: "OAuth 2.0 + PKCE", desc: "RFC 7591/8414-compliant dynamic client registration — no shared secrets pasted into a config file." },
  { title: "55 real tools", desc: "Bots, flows, campaigns, voice, knowledge, inbox, leads, calendar, guardrails, team, billing, GDPR export." },
  { title: "Same data, same rules", desc: "Every tool reads and writes the exact tables the dashboard does — nothing simulated, nothing mocked." },
  { title: "Scoped access", desc: "read / write / knowledge / voice / actions / admin scopes, so an agent only gets what it needs." },
];

export default function Home() {
  const [isYearly, setIsYearly] = useState(false);
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const [selectedFeature, setSelectedFeature] = useState<Feature | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // widget.js (loaded below via <Script>) mounts itself by appending a
  // #chatty-widget-host div straight to document.body — outside React's
  // tree, and guarded by a one-time window.__chattyWidgetLoaded flag so it
  // never re-runs. Next's client-side router only unmounts this page's own
  // React tree on navigation; it has no way to know about (or undo)
  // widget.js's direct DOM/window side effects. Without this cleanup, a
  // visitor who clicks a <Link> from this landing page straight into
  // /dashboard (or any other authenticated route) keeps seeing the support
  // bubble until a full page reload — this effect's cleanup tears it down
  // the moment this page unmounts, so it never follows the visitor in.
  useEffect(() => {
    return () => {
      document.getElementById("chatty-widget-host")?.remove();
      delete (window as unknown as { Chatty?: unknown }).Chatty;
      delete (window as unknown as { __chattyWidgetLoaded?: unknown }).__chattyWidgetLoaded;
    };
  }, []);

  const navLinks = (
    <>
      <Link href="#features" className="hover:opacity-70 transition-opacity">Features</Link>
      <Link href="#pricing" className="hover:opacity-70 transition-opacity">Pricing</Link>
      <Link href="#faq" className="hover:opacity-70 transition-opacity">FAQ</Link>
    </>
  );

  return (
    <div className={`${caprasimo.variable} ${figtree.variable} antialiased`} style={{ ...colorVars, fontFamily: "var(--font-body)", background: "var(--color-bg)", color: "var(--color-text)", overflowX: "clip" }}>
      {/* Announcement bar */}
      <div className="text-center px-5 py-2.5 text-[13px] sm:text-[13.5px]" style={{ background: "var(--color-accent-2-100)" }}>
        <span className="font-semibold" style={{ color: "var(--color-accent-2-800)" }}>NEW</span>
        <span className="hidden sm:inline" style={{ color: "color-mix(in srgb, var(--color-text) 82%, transparent)" }}> — Chatty now ships a full MCP server: run your whole dashboard from a conversation.</span>
        <span className="sm:hidden" style={{ color: "color-mix(in srgb, var(--color-text) 82%, transparent)" }}> — Chatty now ships a full MCP server.</span>
        <a href="#mcp" className="ml-1.5 font-semibold whitespace-nowrap" style={{ color: "var(--color-accent)" }}>Learn more →</a>
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
          <Link href="/dashboard" className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition-colors" style={{ fontFamily: "var(--font-heading)", background: "var(--color-accent)", color: "var(--color-bg)" }}>
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
            <Link href="#faq" onClick={() => setMobileMenuOpen(false)}>FAQ</Link>
            <a href="https://github.com/PersonaliAI/chatty" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
              <GithubIcon className="size-[18px]" /> GitHub
            </a>
            <Link href="/dashboard" onClick={() => setMobileMenuOpen(false)}>Log in</Link>
            <Link
              href="/dashboard"
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
        <section className="relative pt-6 sm:pt-8 text-center">
          <div className="absolute left-1/2 -top-24 -translate-x-1/2 w-[500px] h-[340px] sm:w-[720px] sm:h-[480px] rounded-full -z-10 pointer-events-none opacity-65 blur-[2px]" style={{ background: "var(--color-accent-2-200)" }} />
          <div className="absolute -left-32 top-24 w-40 h-40 sm:w-64 sm:h-64 rounded-full -z-10 pointer-events-none opacity-80" style={{ background: "var(--color-accent-200)" }} />
          <div className="absolute -right-28 top-64 w-32 h-32 sm:w-56 sm:h-56 rounded-full -z-10 pointer-events-none opacity-80" style={{ background: "var(--color-accent-2-100)" }} />

          <h1 className="mx-auto max-w-[16ch] leading-[1.1] tracking-tight text-[clamp(34px,8vw,72px)]" style={{ fontFamily: "var(--font-heading)", fontWeight: 400 }}>
            Trained on your content. <span style={{ color: "var(--color-accent-600)" }}>Optimized for conversion.</span>
          </h1>
          <p className="text-base sm:text-[17px] leading-relaxed max-w-[56ch] mx-auto mt-6" style={{ color: "color-mix(in srgb, var(--color-text) 82%, transparent)" }}>
            An AI chatbot that captures leads and triggers actions. Zero coding, live on your site in five minutes.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-10 text-left max-w-[900px] mx-auto">
            {chips.map((c, i) => {
              const Icon = c.icon;
              return (
                <div key={i} className="rounded-3xl p-5" style={{ background: "var(--color-surface)", boxShadow: "var(--shadow-sm)" }}>
                  <span className="size-9 rounded-full flex items-center justify-center" style={{ background: c.bg, color: c.fg }}>
                    <Icon className="size-[18px]" strokeWidth={2.25} />
                  </span>
                  <p className="mt-3.5 text-base" style={{ fontFamily: "var(--font-heading)" }}>{c.title}</p>
                  <p className="mt-1.5 text-[13px] leading-snug" style={{ color: "color-mix(in srgb, var(--color-text) 68%, transparent)" }}>{c.desc}</p>
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-3.5 items-center justify-center mt-9">
            <Link href="/dashboard" className="inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-[15px] font-medium" style={{ fontFamily: "var(--font-heading)", background: "var(--color-accent)", color: "var(--color-bg)" }}>
              Start free 14-day trial
              <ArrowRight className="size-[15px]" />
            </Link>
            <Link href="#features" className="inline-flex items-center rounded-full px-5 py-3.5 text-[15px] font-medium" style={{ fontFamily: "var(--font-heading)", color: "var(--color-accent)" }}>
              Explore features
            </Link>
          </div>
          <p className="mt-4 text-[13px]" style={{ color: "color-mix(in srgb, var(--color-text) 65%, transparent)" }}>14-day trial · No credit card required</p>

          <div className="mt-14 sm:mt-16 relative max-w-[1080px] mx-auto">
            <div className="absolute -inset-4 sm:-inset-6 rounded-[52px] -z-10" style={{ background: "radial-gradient(closest-side, color-mix(in srgb, var(--color-accent) 18%, transparent), transparent 75%)" }} />
            <div className="relative rounded-[24px] sm:rounded-[36px] overflow-hidden p-2 sm:p-2.5" style={{ boxShadow: "var(--shadow-lg)", background: "var(--color-surface)" }}>
              <ShowcasePlaceholder label="Drop a product screenshot (dashboard / chat widget)" className="w-full aspect-[16/9.2] rounded-[16px] sm:rounded-[26px]" />
            </div>
            <div className="hidden sm:flex absolute -top-[18px] right-7 rounded-full items-center gap-2 px-4.5 py-2.5 text-[12.5px] font-semibold" style={{ background: "var(--color-bg)", boxShadow: "var(--shadow-md)", color: "var(--color-accent-700)" }}>
              <Clock className="size-[15px]" />
              Live on your site in 5 minutes
            </div>
          </div>
        </section>

        {/* Zigzag showcase sections */}
        {showcases.map((s, i) => (
          <section key={i} className={i === 0 ? "pt-20 sm:pt-24 pb-8" : i === showcases.length - 1 ? "py-8 sm:pb-14" : "py-8"}>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-12 items-center">
              <div className={`md:col-span-5 ${s.imageFirst ? "md:order-2" : ""}`}>
                <span className="block text-xs tracking-wide uppercase font-semibold mb-3.5" style={{ color: s.kickerColor }}>{s.kicker}</span>
                <h2 className="max-w-[14ch] text-[26px] sm:text-[30px]" style={{ fontFamily: "var(--font-heading)", fontWeight: 400 }}>{s.title}</h2>
                <p className="mt-4 text-[15px] sm:text-[15.5px] leading-relaxed max-w-[44ch]" style={{ color: "color-mix(in srgb, var(--color-text) 80%, transparent)" }}>{s.desc}</p>
                <Link href="#features" className="inline-flex items-center gap-1.5 mt-5 text-sm font-semibold" style={{ color: "var(--color-accent)" }}>
                  Explore features <ArrowRight className="size-3.5" />
                </Link>
              </div>
              <div className={`md:col-span-7 ${s.imageFirst ? "md:order-1" : ""}`}>
                <ShowcasePlaceholder label={s.label} className="w-full aspect-[16/10] rounded-3xl" />
              </div>
            </div>
          </section>
        ))}

        {/* Pricing */}
        <section id="pricing" className="py-14 sm:py-16">
          <span className="block text-[13px] tracking-wide uppercase font-semibold mb-4" style={{ color: "var(--color-accent-700)" }}>[ 01 / Transparent Fees ]</span>
          <h2 className="text-[28px] sm:text-[32px]" style={{ fontFamily: "var(--font-heading)", fontWeight: 400 }}>Pricing plans</h2>
          <p className="text-[15px] sm:text-[15.5px] leading-relaxed max-w-[56ch] mt-3.5" style={{ color: "color-mix(in srgb, var(--color-text) 78%, transparent)" }}>
            All plans include a 14-day free trial. Scale up or down as your traffic changes.
          </p>

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
                2 months free
              </span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-9">
            {plans.map((plan) => (
              <div
                key={plan.key}
                className="flex flex-col p-7 sm:p-8 rounded-[28px]"
                style={
                  plan.popular
                    ? { background: "var(--color-surface)", boxShadow: "var(--shadow-lg)", border: "2px solid var(--color-accent)" }
                    : { background: "var(--color-surface)" }
                }
              >
                {plan.popular && (
                  <span className="self-start rounded-full text-[11px] font-semibold px-3 py-1 mb-1.5" style={{ background: "var(--color-accent-100)", color: "var(--color-accent-800)" }}>
                    Popular choice
                  </span>
                )}
                <span className="text-xs tracking-wide uppercase mt-1.5" style={{ color: "color-mix(in srgb, var(--color-text) 60%, transparent)" }}>[ PLAN: {plan.tag} ]</span>
                <h3 className="text-2xl mt-2" style={{ fontFamily: "var(--font-heading)", fontWeight: 400 }}>{plan.name}</h3>
                <p className="mt-2.5 text-[32px]" style={{ fontFamily: "var(--font-heading)", color: "var(--color-accent-700)" }}>
                  {isYearly ? `$${plan.monthly * 10}/yr` : `$${plan.monthly}/mo`}
                </p>
                <p className="mt-2.5 text-sm leading-relaxed min-h-[44px]" style={{ color: "color-mix(in srgb, var(--color-text) 78%, transparent)" }}>{plan.desc}</p>
                <ul className="list-none m-0 p-0 mt-4.5 flex flex-col gap-3.5 flex-1">
                  {plan.features.map((feat) => (
                    <li key={feat} className="flex gap-2 items-start text-[13.5px] leading-snug">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent-600)" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5"><polyline points="20 6 9 17 4 12" /></svg>
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href={`/checkout?plan=${plan.key}&interval=${isYearly ? "yearly" : "monthly"}`}
                  className="mt-5 w-full text-center rounded-full px-6 py-3 text-sm font-medium"
                  style={{ fontFamily: "var(--font-heading)", background: "var(--color-accent)", color: "var(--color-bg)" }}
                >
                  Start 14-day trial
                </Link>
              </div>
            ))}
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
            <span className="block text-[13px] tracking-wide uppercase font-semibold mb-4" style={{ color: "var(--color-accent-2-800)" }}>[ 03 / Agent Control ]</span>
            <h2 className="max-w-[22ch] text-[26px] sm:text-[30px]" style={{ fontFamily: "var(--font-heading)", fontWeight: 400 }}>Start with MCP</h2>
            <p className="text-[15px] sm:text-[15.5px] leading-relaxed max-w-[62ch] mt-3.5" style={{ color: "color-mix(in srgb, var(--color-text) 82%, transparent)" }}>
              Chatty ships a full Model Context Protocol server. Point Claude, ChatGPT, or any MCP-compatible client at your account and run the entire dashboard — every bot, flow, campaign, and integration — from a conversation instead of clicking through screens.
            </p>
            <Link href="/dashboard" className="inline-flex items-center gap-2 rounded-full px-6.5 py-3.5 text-sm font-medium mt-6" style={{ fontFamily: "var(--font-heading)", background: "var(--color-accent)", color: "var(--color-bg)" }}>
              Connect your agent
            </Link>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-12">
              {mcpPoints.map((p) => (
                <div key={p.title}>
                  <h4 className="text-[17px]" style={{ fontFamily: "var(--font-heading)", fontWeight: 400 }}>{p.title}</h4>
                  <p className="text-[13.5px] leading-snug mt-2" style={{ color: "color-mix(in srgb, var(--color-text) 78%, transparent)" }}>{p.desc}</p>
                </div>
              ))}
            </div>

            <div className="mt-10">
              <p className="text-xs tracking-wide uppercase mb-2.5" style={{ color: "color-mix(in srgb, var(--color-text) 65%, transparent)" }}>Add to any MCP client</p>
              <pre className="rounded-[18px] p-5 sm:p-6 text-[12px] sm:text-[13.5px] leading-relaxed overflow-x-auto m-0 font-mono" style={{ background: "var(--color-neutral-900)", color: "#f9f4ed" }}>
{`{
  "mcpServers": {
    "chatty": {
      "url": "https://api.chatty.personaliai.com/mcp"
    }
  }
}`}
              </pre>
              <p className="text-[13px] leading-snug mt-3.5" style={{ color: "color-mix(in srgb, var(--color-text) 72%, transparent)" }}>
                The client opens a standard OAuth 2.0 authorization flow on first connect — approve it once, no API key to copy anywhere.
              </p>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="py-8 sm:py-10 pb-14 sm:pb-16">
          <span className="block text-[13px] tracking-wide uppercase font-semibold mb-4" style={{ color: "var(--color-accent-700)" }}>[ 04 / Common Inquiries ]</span>
          <h2 className="text-[28px] sm:text-[32px]" style={{ fontFamily: "var(--font-heading)", fontWeight: 400 }}>Questions</h2>
          <p className="text-[15px] sm:text-[15.5px] leading-relaxed max-w-[60ch] mt-3.5" style={{ color: "color-mix(in srgb, var(--color-text) 78%, transparent)" }}>
            Everything you need to know about Chatty&apos;s training mechanics, costs, safety layers, and white-label setups.
          </p>

          <div className="mt-8 max-w-[760px]">
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
              <Link href="/dashboard" className="rounded-full px-7 py-3.5 text-[15px] font-medium" style={{ fontFamily: "var(--font-heading)", background: "var(--color-bg)", color: "var(--color-accent-700)" }}>
                Start free 14-day trial
              </Link>
              <Link href="#features" className="rounded-full px-6 py-3.5 text-[15px] font-medium border" style={{ fontFamily: "var(--font-heading)", borderColor: "color-mix(in srgb, var(--color-bg) 60%, transparent)", color: "var(--color-bg)" }}>
                Explore features
              </Link>
            </div>
          </div>
        </section>
      </div>

      {/* Footer */}
      <footer className="max-w-[1200px] mx-auto px-5 sm:px-9 pb-10 sm:pb-12">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 pb-9 border-b" style={{ borderColor: "var(--color-divider)" }}>
          <div className="col-span-2 sm:col-span-1">
            <span className="flex items-center gap-2.5 text-[17px]" style={{ fontFamily: "var(--font-heading)" }}>
              <Image src="/favicon.png" alt="Chatty" width={26} height={26} className="size-[26px] object-contain shrink-0" />
              Chatty
            </span>
            <p className="text-[13.5px] leading-relaxed mt-3.5 max-w-[26ch]" style={{ color: "color-mix(in srgb, var(--color-text) 70%, transparent)" }}>
              Custom AI chatbots that train on your content and convert your visitors.
            </p>
            <span className="inline-block mt-3.5 text-[11px] tracking-wide uppercase" style={{ color: "color-mix(in srgb, var(--color-text) 55%, transparent)" }}>By PersonaliAI</span>
          </div>
          <div>
            <p className="text-xs tracking-wide uppercase mb-3.5" style={{ color: "color-mix(in srgb, var(--color-text) 55%, transparent)" }}>Product</p>
            <div className="flex flex-col gap-2.5 text-sm">
              <Link href="#features">Features</Link>
              <Link href="#pricing">Pricing</Link>
              <Link href="#faq">FAQ</Link>
              <Link href="#mcp">MCP server</Link>
            </div>
          </div>
          <div>
            <p className="text-xs tracking-wide uppercase mb-3.5" style={{ color: "color-mix(in srgb, var(--color-text) 55%, transparent)" }}>Company</p>
            <div className="flex flex-col gap-2.5 text-sm">
              <Link href="/privacy">Privacy</Link>
              <Link href="/terms">Terms</Link>
              <Link href="/dashboard">Dashboard</Link>
            </div>
          </div>
          <div>
            <p className="text-xs tracking-wide uppercase mb-3.5" style={{ color: "color-mix(in srgb, var(--color-text) 55%, transparent)" }}>Connect</p>
            <div className="flex flex-col gap-2.5 text-sm">
              <a href="https://github.com/PersonaliAI/chatty" target="_blank" rel="noopener noreferrer">GitHub</a>
              <Link href="/dashboard">Log in</Link>
            </div>
          </div>
        </div>
        <p className="mt-6 text-[12.5px]" style={{ color: "color-mix(in srgb, var(--color-text) 60%, transparent)" }}>&copy; {new Date().getFullYear()} PersonaliAI. All rights reserved.</p>
      </footer>

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
              Configure this from the dashboard — no code, no server-side setup.
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

      {/* Chatty on Chatty — the landing page runs its own product as its
          support widget. */}
      <Script
        src="https://chatty.personaliai.com/widget.js"
        data-id="ad32f373-7694-43f4-9465-f8d65ce291e3"
        strategy="afterInteractive"
      />
    </div>
  );
}
