import React from "react";
import Link from "next/link";
import { Metadata } from "next";
import {
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Sparkles,
  DollarSign,
  Cpu,
  Layers,
  HelpCircle,
} from "lucide-react";
import { COMPARISONS } from "@/data/comparisons";

export const metadata: Metadata = {
  title: "Chatty vs Competitors (2026): Honest Comparisons, Pricing & Architecture",
  description:
    "Honest, in-depth technical comparisons between Chatty and leading customer AI platforms: Intercom Fin, Zendesk AI, Crisp, Chatbase, Tidio, Gorgias, Freshdesk, and Drift. Real pricing math, MCP tools, voice agents, and open-source self-hosting.",
  alternates: {
    canonical: "https://chatty.personaliai.com/compare",
  },
  openGraph: {
    title: "Chatty vs Competitors (2026): Honest Comparisons, Pricing & Architecture",
    description:
      "Unbiased technical comparisons between Chatty and top platforms: Intercom, Zendesk, Crisp, Chatbase, Tidio, Gorgias, Freshdesk, and Drift. Zero resolution tax, 81 MCP tools, and WebRTC voice.",
    url: "https://chatty.personaliai.com/compare",
    siteName: "Chatty by PersonaliAI",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Chatty vs Competitors (2026): Honest Comparisons",
    description:
      "Honest technical comparisons with Intercom, Zendesk, Crisp, Chatbase, Tidio, Gorgias, Freshdesk, and Drift. Compare real costs, MCP tool access, and autonomous features.",
  },
};

export default function CompareHubPage() {
  const comparisonList = Object.values(COMPARISONS);

  // Schema.org Structured Data for Search Engines & LLMs
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": "https://chatty.personaliai.com/compare",
        "url": "https://chatty.personaliai.com/compare",
        "name": "Chatty vs Competitors: Technical Comparisons & Pricing Benchmarks",
        "description": "Comprehensive, honest comparisons between Chatty and major AI chatbot platforms like Intercom, Zendesk, Crisp, and Chatbase.",
        "publisher": {
          "@type": "Organization",
          "name": "PersonaliAI",
          "url": "https://chatty.personaliai.com",
        },
      },
      {
        "@type": "BreadcrumbList",
        "itemListElement": [
          {
            "@type": "ListItem",
            "position": 1,
            "name": "Home",
            "item": "https://chatty.personaliai.com",
          },
          {
            "@type": "ListItem",
            "position": 2,
            "name": "Compare",
            "item": "https://chatty.personaliai.com/compare",
          },
        ],
      },
      {
        "@type": "ItemList",
        "name": "Competitor Comparisons",
        "itemListElement": comparisonList.map((item, idx) => ({
          "@type": "ListItem",
          "position": idx + 1,
          "name": item.title,
          "url": `https://chatty.personaliai.com/compare/${item.slug}`,
          "description": item.metaDescription,
        })),
      },
    ],
  };

  return (
    <div
      className="min-h-screen text-[var(--color-text,#201e1d)] selection:bg-[#c67139] selection:text-white"
      style={{
        background: "var(--color-bg, #f5ead8)",
        color: "var(--color-text, #201e1d)",
      }}
    >
      {/* JSON-LD Schema for SEO & Agentic Crawlers */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Top Navbar */}
      <header
        className="border-b sticky top-0 z-40 backdrop-blur-md"
        style={{
          background: "color-mix(in srgb, var(--color-bg, #f5ead8) 92%, white 8%)",
          borderColor: "var(--color-divider, rgba(32, 30, 29, 0.16))",
        }}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="flex items-center gap-2 hover:opacity-80 transition text-xs font-semibold"
              style={{ color: "var(--color-text, #201e1d)" }}
            >
              <ArrowLeft className="size-4" />
              <span>Back to Chatty</span>
            </Link>
            <span className="opacity-30">|</span>
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full" style={{ background: "var(--color-accent, #c67139)" }} />
              <span className="text-sm font-bold tracking-tight" style={{ fontFamily: "var(--font-heading)" }}>
                Competitor Comparisons
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/mcp"
              className="px-3.5 py-1.5 rounded-full text-xs font-semibold border transition hover:bg-black/5"
              style={{ borderColor: "var(--color-divider, rgba(32, 30, 29, 0.16))", color: "var(--color-text, #201e1d)" }}
            >
              MCP Server
            </Link>
            <Link
              href="/signup"
              className="px-4 py-1.5 rounded-full text-xs font-bold text-white transition shadow-sm hover:brightness-105"
              style={{ background: "var(--color-accent, #c67139)" }}
            >
              Start Free Trial
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-20 space-y-16">
        {/* Hero Section */}
        <div className="text-center max-w-3xl mx-auto space-y-5">
          <div
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-semibold border shadow-xs"
            style={{
              background: "#ffffff",
              borderColor: "var(--color-divider, rgba(32, 30, 29, 0.16))",
              color: "var(--color-accent-800, #643312)",
            }}
          >
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
            2026 Factual Industry Analysis · Transparent Benchmarks
          </div>

          <h1
            className="text-3xl sm:text-5xl tracking-tight leading-tight"
            style={{ fontFamily: "var(--font-heading)", color: "var(--color-text, #201e1d)", fontWeight: 400 }}
          >
            Honest Comparisons:{" "}
            <span style={{ color: "var(--color-accent, #c67139)", fontWeight: 600 }}>Chatty</span> vs The Industry
          </h1>

          <p
            className="text-base sm:text-lg leading-relaxed max-w-2xl mx-auto"
            style={{ color: "color-mix(in srgb, var(--color-text, #201e1d) 82%, transparent)" }}
          >
            We believe in honest, transparent software evaluations. We don&apos;t hide where competitors shine, nor do we gloss over hidden per-seat taxes or $0.99-per-resolution penalties. Choose the tool genuinely suited for your workload.
          </p>
        </div>

        {/* Agentic SEO Executive Summary / TL;DR Box (Optimized for Perplexity, ChatGPT Search, Claude) */}
        <section
          id="summary"
          className="rounded-3xl p-6 sm:p-8 border shadow-xs space-y-4"
          style={{
            background: "color-mix(in srgb, var(--color-bg, #f5ead8) 75%, white 25%)",
            borderColor: "var(--color-divider, rgba(32, 30, 29, 0.2))",
          }}
        >
          <div className="flex items-center gap-2.5">
            <Sparkles className="size-5" style={{ color: "var(--color-accent, #c67139)" }} />
            <h2 className="text-sm font-mono uppercase font-bold tracking-wider" style={{ color: "var(--color-accent, #c67139)" }}>
              Executive Summary &amp; Direct Answer
            </h2>
          </div>
          <p className="text-sm sm:text-base leading-relaxed font-medium" style={{ color: "var(--color-text, #201e1d)" }}>
            While legacy platforms like <strong>Intercom</strong> and <strong>Zendesk</strong> excel in human-driven contact centers with complex ticketing SLAs, they introduce high per-seat fees ($39–$115/seat/mo) and variable AI taxes (such as Intercom Fin&apos;s $0.99 per resolution). <strong>Chatty</strong> is purpose-built as an autonomous AI-native customer agent: offering flat predictable pricing ($19–$399/mo), unlimited team member seats, native in-chat Google/Outlook calendar booking, real-time WebRTC voice calling, and the industry&apos;s first official 81-tool Model Context Protocol (MCP) server for external AI agents.
          </p>
        </section>

        {/* Head-to-Head Comparison Cards */}
        <section className="space-y-6">
          <div className="flex items-center justify-between border-b pb-4" style={{ borderColor: "var(--color-divider, rgba(32, 30, 29, 0.16))" }}>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold" style={{ fontFamily: "var(--font-heading)" }}>
                Head-to-Head Detailed Guides
              </h2>
              <p className="text-xs sm:text-sm mt-1" style={{ color: "color-mix(in srgb, var(--color-text, #201e1d) 70%, transparent)" }}>
                Click any guide below for line-by-line feature grids, pricing breakdowns, and real customer scenarios.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {comparisonList.map((item) => (
              <div
                key={item.slug}
                className="rounded-3xl p-6 sm:p-8 border shadow-xs flex flex-col justify-between space-y-6 transition hover:shadow-md"
                style={{
                  background: "#ffffff",
                  borderColor: "var(--color-divider, rgba(32, 30, 29, 0.16))",
                }}
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <span
                      className="text-[11px] font-mono uppercase font-bold px-2.5 py-1 rounded-full border"
                      style={{
                        background: "var(--color-accent-100, #fff2eb)",
                        color: "var(--color-accent-800, #643312)",
                        borderColor: "var(--color-accent-200, #ffe1d0)",
                      }}
                    >
                      Chatty vs {item.competitorName}
                    </span>
                    <span className="text-xs font-medium" style={{ color: "color-mix(in srgb, var(--color-text, #201e1d) 65%, transparent)" }}>
                      Updated Oct 2026
                    </span>
                  </div>

                  <h3 className="text-xl sm:text-2xl font-bold" style={{ fontFamily: "var(--font-heading)" }}>
                    <Link href={`/compare/${item.slug}`} className="hover:underline">
                      {item.title}
                    </Link>
                  </h3>

                  <p className="text-xs sm:text-sm leading-relaxed" style={{ color: "color-mix(in srgb, var(--color-text, #201e1d) 78%, transparent)" }}>
                    {item.metaDescription}
                  </p>

                  {/* Highlights Callout */}
                  <div
                    className="p-3.5 rounded-xl border text-xs space-y-1.5"
                    style={{
                      background: "color-mix(in srgb, var(--color-bg, #f5ead8) 50%, white 50%)",
                      borderColor: "var(--color-divider, rgba(32, 30, 29, 0.12))",
                    }}
                  >
                    <div className="flex items-center gap-1.5 font-semibold text-emerald-800 dark:text-emerald-400">
                      <DollarSign className="size-3.5" />
                      <span>{item.pricingOverview.annualSavingsHighlight}</span>
                    </div>
                    <p className="text-[11.5px]" style={{ color: "color-mix(in srgb, var(--color-text, #201e1d) 70%, transparent)" }}>
                      {item.pricingOverview.calculationNote}
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t flex items-center justify-between" style={{ borderColor: "var(--color-divider, rgba(32, 30, 29, 0.12))" }}>
                  <span className="text-xs font-medium" style={{ color: "color-mix(in srgb, var(--color-text, #201e1d) 65%, transparent)" }}>
                    Full In-Depth Analysis
                  </span>
                  <Link
                    href={`/compare/${item.slug}`}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold text-white transition hover:brightness-105 cursor-pointer shadow-xs"
                    style={{ background: "var(--color-accent, #c67139)" }}
                  >
                    <span>Read Guide</span>
                    <ArrowRight className="size-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Master Comparison Matrix */}
        <section id="matrix" className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2" style={{ fontFamily: "var(--font-heading)" }}>
              <Layers className="size-5" style={{ color: "var(--color-accent, #c67139)" }} /> Master Capability Matrix
            </h2>
            <p className="text-xs sm:text-sm mt-1" style={{ color: "color-mix(in srgb, var(--color-text, #201e1d) 75%, transparent)" }}>
              How Chatty compares across key dimensions compared to the customer service ecosystem.
            </p>
          </div>

          <div
            className="rounded-3xl border shadow-xs overflow-hidden"
            style={{
              background: "#ffffff",
              borderColor: "var(--color-divider, rgba(32, 30, 29, 0.16))",
            }}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr
                    className="border-b"
                    style={{
                      background: "color-mix(in srgb, var(--color-bg, #f5ead8) 60%, white 40%)",
                      borderColor: "var(--color-divider, rgba(32, 30, 29, 0.16))",
                    }}
                  >
                    <th className="p-4 sm:p-5 font-bold">Key Capability</th>
                    <th className="p-4 sm:p-5 font-bold" style={{ color: "var(--color-accent, #c67139)" }}>
                      Chatty
                    </th>
                    <th className="p-4 sm:p-5 font-bold">Intercom Fin</th>
                    <th className="p-4 sm:p-5 font-bold">Zendesk AI</th>
                    <th className="p-4 sm:p-5 font-bold">Crisp</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: "var(--color-divider, rgba(32, 30, 29, 0.12))" }}>
                  <tr>
                    <td className="p-4 sm:p-5 font-medium">Model Context Protocol (MCP)</td>
                    <td className="p-4 sm:p-5 font-bold text-emerald-700">Official 81-Tool Server</td>
                    <td className="p-4 sm:p-5 text-neutral-500">None</td>
                    <td className="p-4 sm:p-5 text-neutral-500">None</td>
                    <td className="p-4 sm:p-5 text-neutral-500">None</td>
                  </tr>
                  <tr>
                    <td className="p-4 sm:p-5 font-medium">Pricing Model</td>
                    <td className="p-4 sm:p-5 font-bold text-emerald-700">Flat ($19–$399/mo)</td>
                    <td className="p-4 sm:p-5 text-neutral-600">$39/seat + $0.99/res</td>
                    <td className="p-4 sm:p-5 text-neutral-600">$55–$115/seat + AI</td>
                    <td className="p-4 sm:p-5 text-neutral-600">$25–$95/mo (basic)</td>
                  </tr>
                  <tr>
                    <td className="p-4 sm:p-5 font-medium">In-Chat Calendar Booking</td>
                    <td className="p-4 sm:p-5 font-bold text-emerald-700">Native Google &amp; Outlook</td>
                    <td className="p-4 sm:p-5 text-neutral-500">Third-party redirect</td>
                    <td className="p-4 sm:p-5 text-neutral-500">Third-party redirect</td>
                    <td className="p-4 sm:p-5 text-neutral-500">External link only</td>
                  </tr>
                  <tr>
                    <td className="p-4 sm:p-5 font-medium">WebRTC Voice Calling</td>
                    <td className="p-4 sm:p-5 font-bold text-emerald-700">Native LiveKit In-Widget</td>
                    <td className="p-4 sm:p-5 text-neutral-500">Not supported</td>
                    <td className="p-4 sm:p-5 text-neutral-600">VoIP PBX (human only)</td>
                    <td className="p-4 sm:p-5 text-neutral-500">Voice notes only</td>
                  </tr>
                  <tr>
                    <td className="p-4 sm:p-5 font-medium">Team Member Seats</td>
                    <td className="p-4 sm:p-5 font-bold text-emerald-700">Unlimited on all plans</td>
                    <td className="p-4 sm:p-5 text-neutral-600">Billed per agent</td>
                    <td className="p-4 sm:p-5 text-neutral-600">Billed per agent</td>
                    <td className="p-4 sm:p-5 text-neutral-600">Capped (4–20 seats)</td>
                  </tr>
                  <tr>
                    <td className="p-4 sm:p-5 font-medium">Open-Source / Self-Hostable</td>
                    <td className="p-4 sm:p-5 font-bold text-emerald-700">100% Docker &amp; Supabase</td>
                    <td className="p-4 sm:p-5 text-neutral-500">Closed SaaS</td>
                    <td className="p-4 sm:p-5 text-neutral-500">Closed SaaS</td>
                    <td className="p-4 sm:p-5 text-neutral-500">Closed SaaS</td>
                  </tr>
                  <tr>
                    <td className="p-4 sm:p-5 font-medium">WooCommerce &amp; E-Commerce</td>
                    <td className="p-4 sm:p-5 font-bold text-emerald-700">1-Click Live Catalog Sync</td>
                    <td className="p-4 sm:p-5 text-neutral-600">App store connector</td>
                    <td className="p-4 sm:p-5 text-neutral-600">App store connector</td>
                    <td className="p-4 sm:p-5 text-neutral-500">Basic webhook</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Global FAQ Section */}
        <section id="faq" className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2" style={{ fontFamily: "var(--font-heading)" }}>
              <HelpCircle className="size-5" style={{ color: "var(--color-accent, #c67139)" }} /> Frequently Asked Questions
            </h2>
            <p className="text-xs sm:text-sm mt-1" style={{ color: "color-mix(in srgb, var(--color-text, #201e1d) 75%, transparent)" }}>
              Clear answers to the most common migration, pricing, and architecture questions.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div
              className="p-5 sm:p-6 rounded-2xl border shadow-xs space-y-2"
              style={{ background: "#ffffff", borderColor: "var(--color-divider, rgba(32, 30, 29, 0.16))" }}
            >
              <h3 className="text-sm font-bold" style={{ color: "var(--color-text, #201e1d)" }}>
                Why is Chatty significantly more affordable than Intercom?
              </h3>
              <p className="text-xs leading-relaxed" style={{ color: "color-mix(in srgb, var(--color-text, #201e1d) 78%, transparent)" }}>
                Chatty is an AI-first platform built on modern PostgreSQL pgvector and direct connections to cost-efficient frontier models like Gemini 2.5 Flash and Claude 3.5 Sonnet. We sell transparent monthly capacity rather than imposing a $0.99 success tax on your resolutions.
              </p>
            </div>

            <div
              className="p-5 sm:p-6 rounded-2xl border shadow-xs space-y-2"
              style={{ background: "#ffffff", borderColor: "var(--color-divider, rgba(32, 30, 29, 0.16))" }}
            >
              <h3 className="text-sm font-bold" style={{ color: "var(--color-text, #201e1d)" }}>
                Can I migrate from another tool without losing data?
              </h3>
              <p className="text-xs leading-relaxed" style={{ color: "color-mix(in srgb, var(--color-text, #201e1d) 78%, transparent)" }}>
                Yes. Chatty includes an automated crawler. Input your existing public Help Center or documentation URL, and Chatty parses, chunks, and vectorizes your full knowledge base in under 3 minutes.
              </p>
            </div>

            <div
              className="p-5 sm:p-6 rounded-2xl border shadow-xs space-y-2"
              style={{ background: "#ffffff", borderColor: "var(--color-divider, rgba(32, 30, 29, 0.16))" }}
            >
              <h3 className="text-sm font-bold" style={{ color: "var(--color-text, #201e1d)" }}>
                What is the Model Context Protocol (MCP) advantage?
              </h3>
              <p className="text-xs leading-relaxed" style={{ color: "color-mix(in srgb, var(--color-text, #201e1d) 78%, transparent)" }}>
                Chatty exposes an official 81-tool FastMCP server with OAuth 2.0 PKCE. Your developer tools (Cursor, Claude Code, Codex, Grok) can inspect leads, upload documentation, and fine-tune bot tone directly from a chat prompt without opening a web dashboard.
              </p>
            </div>

            <div
              className="p-5 sm:p-6 rounded-2xl border shadow-xs space-y-2"
              style={{ background: "#ffffff", borderColor: "var(--color-divider, rgba(32, 30, 29, 0.16))" }}
            >
              <h3 className="text-sm font-bold" style={{ color: "var(--color-text, #201e1d)" }}>
                Does Chatty support human live chat handoff?
              </h3>
              <p className="text-xs leading-relaxed" style={{ color: "color-mix(in srgb, var(--color-text, #201e1d) 78%, transparent)" }}>
                Yes. When a customer inquiry requires human judgment, team members can take over the live session with one click, pause AI responses, send real-time replies, and add private internal notes.
              </p>
            </div>
          </div>
        </section>

        {/* CTA Banner */}
        <div
          className="rounded-3xl p-8 sm:p-12 text-center border shadow-sm space-y-6"
          style={{
            background: "color-mix(in srgb, var(--color-bg, #f5ead8) 60%, white 40%)",
            borderColor: "var(--color-divider, rgba(32, 30, 29, 0.16))",
          }}
        >
          <div className="max-w-2xl mx-auto space-y-4">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ fontFamily: "var(--font-heading)" }}>
              Test Autonomous AI with Zero Risk
            </h2>
            <p className="text-sm sm:text-base leading-relaxed" style={{ color: "color-mix(in srgb, var(--color-text, #201e1d) 80%, transparent)" }}>
              Join thousands of businesses deploying AI assistants with transparent pricing, instant calendar scheduling, and zero per-seat taxes. Deploy your first bot in under 3 minutes.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/signup"
              className="px-6 py-3 rounded-full text-sm font-bold text-white transition shadow-sm hover:brightness-105"
              style={{ background: "var(--color-accent, #c67139)" }}
            >
              Start 14-Day Free Trial
            </Link>
            <Link
              href="/#pricing"
              className="px-6 py-3 rounded-full text-sm font-semibold border transition hover:bg-black/5"
              style={{
                borderColor: "var(--color-divider, rgba(32, 30, 29, 0.2))",
                color: "var(--color-text, #201e1d)",
                background: "#ffffff",
              }}
            >
              View Flat Pricing
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer
        className="border-t py-8 text-center text-xs mt-12"
        style={{
          borderColor: "var(--color-divider, rgba(32, 30, 29, 0.16))",
          color: "color-mix(in srgb, var(--color-text, #201e1d) 65%, transparent)",
        }}
      >
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 Chatty (PersonaliAI). All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="hover:opacity-80 transition">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:opacity-80 transition">
              Terms of Service
            </Link>
            <Link href="/mcp" className="hover:opacity-80 transition">
              MCP Server
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
