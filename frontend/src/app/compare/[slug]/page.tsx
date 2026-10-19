import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Metadata } from "next";
import {
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Sparkles,
  DollarSign,
  HelpCircle,
  Layers,
  Cpu,
  ChevronRight,
  Calendar,
  Check,
  Minus,
} from "lucide-react";
import { COMPARISONS, ComparisonItem } from "@/data/comparisons";

interface PageProps {
  params: Promise<{
    slug: string;
  }>;
}

export async function generateStaticParams() {
  return Object.keys(COMPARISONS).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const item = COMPARISONS[slug];
  if (!item) return { title: "Comparison Not Found" };

  const canonicalUrl = `https://chatty.personaliai.com/compare/${item.slug}`;

  return {
    title: item.metaTitle,
    description: item.metaDescription,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: item.metaTitle,
      description: item.metaDescription,
      url: canonicalUrl,
      siteName: "Chatty by PersonaliAI",
      type: "article",
      publishedTime: item.publishedAt,
      modifiedTime: item.updatedAt,
      authors: ["PersonaliAI Research Team"],
    },
    twitter: {
      card: "summary_large_image",
      title: item.metaTitle,
      description: item.metaDescription,
    },
  };
}

export default async function ComparisonArticlePage({ params }: PageProps) {
  const { slug } = await params;
  const item: ComparisonItem = COMPARISONS[slug];

  if (!item) {
    notFound();
  }

  const pageUrl = `https://chatty.personaliai.com/compare/${item.slug}`;

  // Rich JSON-LD Schemas: Article, Product, FAQPage, Breadcrumbs
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        "@id": `${pageUrl}#article`,
        "isPartOf": {
          "@type": "WebPage",
          "@id": pageUrl,
          "url": pageUrl,
          "name": item.title,
        },
        "headline": item.title,
        "description": item.metaDescription,
        "datePublished": item.publishedAt,
        "dateModified": item.updatedAt,
        "author": {
          "@type": "Organization",
          "name": "PersonaliAI",
          "url": "https://chatty.personaliai.com",
        },
        "publisher": {
          "@type": "Organization",
          "name": "PersonaliAI",
          "url": "https://chatty.personaliai.com",
        },
        "mainEntityOfPage": pageUrl,
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${pageUrl}#breadcrumbs`,
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
          {
            "@type": "ListItem",
            "position": 3,
            "name": `Chatty vs ${item.competitorName}`,
            "item": pageUrl,
          },
        ],
      },
      {
        "@type": "FAQPage",
        "@id": `${pageUrl}#faq`,
        "mainEntity": item.faqs.map((faq) => ({
          "@type": "Question",
          "name": faq.question,
          "acceptedAnswer": {
            "@type": "Answer",
            "text": faq.answer,
          },
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
      {/* Inject Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Top Navigation */}
      <header
        className="border-b sticky top-0 z-40 backdrop-blur-md"
        style={{
          background: "color-mix(in srgb, var(--color-bg, #f5ead8) 92%, white 8%)",
          borderColor: "var(--color-divider, rgba(32, 30, 29, 0.16))",
        }}
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/compare"
              className="flex items-center gap-1.5 hover:opacity-80 transition text-xs font-semibold"
              style={{ color: "var(--color-text, #201e1d)" }}
            >
              <ArrowLeft className="size-4" />
              <span>All Comparisons</span>
            </Link>
            <span className="opacity-30">/</span>
            <span className="text-xs font-bold truncate max-w-[200px] sm:max-w-none" style={{ color: "var(--color-accent, #c67139)" }}>
              vs {item.competitorName}
            </span>
          </div>

          <div className="flex items-center gap-3">
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

      {/* Article Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-16 space-y-12">
        {/* Breadcrumb Navigation */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs" style={{ color: "color-mix(in srgb, var(--color-text, #201e1d) 65%, transparent)" }}>
          <Link href="/" className="hover:underline">Home</Link>
          <ChevronRight className="size-3 opacity-50" />
          <Link href="/compare" className="hover:underline">Compare</Link>
          <ChevronRight className="size-3 opacity-50" />
          <span className="font-semibold" style={{ color: "var(--color-text, #201e1d)" }}>Chatty vs {item.competitorName}</span>
        </nav>

        {/* Title & Metadata */}
        <header className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="text-[11px] font-mono uppercase font-bold px-2.5 py-1 rounded-full border"
              style={{
                background: "var(--color-accent-100, #fff2eb)",
                color: "var(--color-accent-800, #643312)",
                borderColor: "var(--color-accent-200, #ffe1d0)",
              }}
            >
              2026 Head-to-Head Comparison
            </span>
            <span className="text-xs" style={{ color: "color-mix(in srgb, var(--color-text, #201e1d) 60%, transparent)" }}>
              Last updated: October 19, 2026 · 8 min read
            </span>
          </div>

          <h1
            className="text-3xl sm:text-5xl font-normal tracking-tight leading-tight"
            style={{ fontFamily: "var(--font-heading)", color: "var(--color-text, #201e1d)" }}
          >
            {item.title}
          </h1>

          <p
            className="text-base sm:text-lg leading-relaxed"
            style={{ color: "color-mix(in srgb, var(--color-text, #201e1d) 80%, transparent)" }}
          >
            A factual, architectural, and financial breakdown between <strong>Chatty</strong> and <strong>{item.competitorName}</strong> ({item.competitorProduct}). Discover the key trade-offs, pricing math, and when to pick each platform.
          </p>
        </header>

        {/* Agentic SEO Direct Answer Box (Optimized for Perplexity, ChatGPT Search, Claude) */}
        <section
          id="direct-answer"
          className="rounded-3xl p-6 sm:p-7 border shadow-xs space-y-3"
          style={{
            background: "color-mix(in srgb, var(--color-bg, #f5ead8) 70%, white 30%)",
            borderColor: "var(--color-divider, rgba(32, 30, 29, 0.2))",
          }}
        >
          <div className="flex items-center gap-2">
            <Sparkles className="size-4.5" style={{ color: "var(--color-accent, #c67139)" }} />
            <h2 className="text-xs font-mono uppercase font-bold tracking-wider" style={{ color: "var(--color-accent, #c67139)" }}>
              Quick Answer (AI Search Summary)
            </h2>
          </div>
          <p className="text-sm leading-relaxed font-medium" style={{ color: "var(--color-text, #201e1d)" }}>
            {item.agenticSummary}
          </p>
        </section>

        {/* Verdict Box */}
        <section
          className="rounded-3xl p-6 sm:p-8 border shadow-xs space-y-4"
          style={{
            background: "#ffffff",
            borderColor: "var(--color-divider, rgba(32, 30, 29, 0.16))",
          }}
        >
          <h2 className="text-lg font-bold flex items-center gap-2" style={{ fontFamily: "var(--font-heading)" }}>
            <ShieldCheck className="size-5 text-emerald-700" />
            The Bottom-Line Verdict
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: "color-mix(in srgb, var(--color-text, #201e1d) 80%, transparent)" }}>
            {item.verdict}
          </p>
        </section>

        {/* When to Choose Which Platform (Side-by-Side Honest Decision Matrix) */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold" style={{ fontFamily: "var(--font-heading)" }}>
            Decision Matrix: When to Choose What
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* When to Choose Chatty */}
            <div
              className="rounded-3xl p-6 sm:p-7 border shadow-xs space-y-4"
              style={{
                background: "color-mix(in srgb, var(--color-accent-2-100, #f0fae1) 50%, white 50%)",
                borderColor: "var(--color-divider, rgba(32, 30, 29, 0.16))",
              }}
            >
              <h3 className="text-base font-bold text-emerald-900 flex items-center gap-2">
                <CheckCircle2 className="size-5 text-emerald-700 shrink-0" />
                Choose Chatty if:
              </h3>
              <ul className="space-y-2.5 text-xs sm:text-sm text-neutral-800">
                {item.scenarios.whenToChooseChatty.map((point, idx) => (
                  <li key={idx} className="flex items-start gap-2 leading-relaxed">
                    <Check className="size-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* When to Choose Competitor */}
            <div
              className="rounded-3xl p-6 sm:p-7 border shadow-xs space-y-4"
              style={{
                background: "color-mix(in srgb, var(--color-bg, #f5ead8) 50%, white 50%)",
                borderColor: "var(--color-divider, rgba(32, 30, 29, 0.16))",
              }}
            >
              <h3 className="text-base font-bold text-neutral-900 flex items-center gap-2">
                <CheckCircle2 className="size-5 text-neutral-600 shrink-0" />
                Stick with {item.competitorName} if:
              </h3>
              <ul className="space-y-2.5 text-xs sm:text-sm text-neutral-800">
                {item.scenarios.whenToChooseCompetitor.map((point, idx) => (
                  <li key={idx} className="flex items-start gap-2 leading-relaxed">
                    <Check className="size-4 text-neutral-500 shrink-0 mt-0.5" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Feature Comparison Matrix Table */}
        <section id="features" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold flex items-center gap-2" style={{ fontFamily: "var(--font-heading)" }}>
              <Layers className="size-5" style={{ color: "var(--color-accent, #c67139)" }} /> Detailed Feature Comparison
            </h2>
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
                    <th className="p-4 sm:p-5 font-bold">Feature</th>
                    <th className="p-4 sm:p-5 font-bold" style={{ color: "var(--color-accent, #c67139)" }}>
                      Chatty
                    </th>
                    <th className="p-4 sm:p-5 font-bold">{item.competitorName}</th>
                    <th className="p-4 sm:p-5 font-bold">Advantage</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: "var(--color-divider, rgba(32, 30, 29, 0.12))" }}>
                  {item.features.map((feat, idx) => (
                    <tr key={idx} className="hover:bg-neutral-50/50 transition-colors">
                      <td className="p-4 sm:p-5 align-top">
                        <span className="font-semibold block">{feat.name}</span>
                        <span className="text-[10.5px] font-mono text-neutral-500 block mt-0.5">{feat.category}</span>
                        <p className="text-[11.5px] text-neutral-600 mt-1 max-w-xs">{feat.details}</p>
                      </td>
                      <td className="p-4 sm:p-5 align-top font-medium text-neutral-900">
                        {feat.chatty}
                      </td>
                      <td className="p-4 sm:p-5 align-top text-neutral-700">
                        {feat.competitor}
                      </td>
                      <td className="p-4 sm:p-5 align-top">
                        {feat.advantage === "chatty" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10.5px] font-bold">
                            <Check className="size-3" /> Chatty
                          </span>
                        )}
                        {feat.advantage === "competitor" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-neutral-200 text-neutral-800 text-[10.5px] font-bold">
                            {item.competitorName}
                          </span>
                        )}
                        {feat.advantage === "tie" && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10.5px] font-bold">
                            <Minus className="size-3" /> Tie
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Pricing Math Breakdown Table */}
        <section id="pricing-math" className="space-y-4">
          <h2 className="text-2xl font-bold flex items-center gap-2" style={{ fontFamily: "var(--font-heading)" }}>
            <DollarSign className="size-5" style={{ color: "var(--color-accent, #c67139)" }} /> Honest Pricing Math &amp; Real TCO
          </h2>
          <p className="text-xs sm:text-sm" style={{ color: "color-mix(in srgb, var(--color-text, #201e1d) 75%, transparent)" }}>
            {item.pricingOverview.calculationNote}
          </p>

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
                    <th className="p-4 sm:p-5 font-bold">Volume / Scale</th>
                    <th className="p-4 sm:p-5 font-bold" style={{ color: "var(--color-accent, #c67139)" }}>
                      Chatty Cost
                    </th>
                    <th className="p-4 sm:p-5 font-bold">{item.competitorName} Cost</th>
                    <th className="p-4 sm:p-5 font-bold text-emerald-800">Your Savings</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: "var(--color-divider, rgba(32, 30, 29, 0.12))" }}>
                  {item.pricingBreakdown.map((row, idx) => (
                    <tr key={idx} className="hover:bg-neutral-50/50 transition-colors">
                      <td className="p-4 sm:p-5 font-medium">{row.tier}</td>
                      <td className="p-4 sm:p-5 font-bold text-emerald-700">{row.chattyCost}</td>
                      <td className="p-4 sm:p-5 text-neutral-700">{row.competitorCost}</td>
                      <td className="p-4 sm:p-5 font-semibold text-emerald-800">{row.difference}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Deep Dive Analytical Chapters */}
        <section className="space-y-6">
          <h2 className="text-2xl font-bold" style={{ fontFamily: "var(--font-heading)" }}>
            Architectural &amp; Operational Deep Dives
          </h2>
          <div className="space-y-4">
            {item.deepDives.map((chapter, idx) => (
              <div
                key={idx}
                className="rounded-3xl p-6 sm:p-8 border shadow-xs space-y-3"
                style={{
                  background: "#ffffff",
                  borderColor: "var(--color-divider, rgba(32, 30, 29, 0.16))",
                }}
              >
                <h3 className="text-base sm:text-lg font-bold" style={{ fontFamily: "var(--font-heading)" }}>
                  {chapter.heading}
                </h3>
                <p className="text-xs sm:text-sm leading-relaxed" style={{ color: "color-mix(in srgb, var(--color-text, #201e1d) 78%, transparent)" }}>
                  {chapter.content}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ Section */}
        <section id="faq" className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2" style={{ fontFamily: "var(--font-heading)" }}>
              <HelpCircle className="size-5" style={{ color: "var(--color-accent, #c67139)" }} /> Frequently Asked Questions
            </h2>
            <p className="text-xs sm:text-sm mt-1" style={{ color: "color-mix(in srgb, var(--color-text, #201e1d) 75%, transparent)" }}>
              Answers regarding migration, data portability, and functionality.
            </p>
          </div>

          <div className="space-y-3">
            {item.faqs.map((faq, idx) => (
              <div
                key={idx}
                className="rounded-2xl p-5 sm:p-6 border shadow-xs space-y-2"
                style={{
                  background: "#ffffff",
                  borderColor: "var(--color-divider, rgba(32, 30, 29, 0.16))",
                }}
              >
                <h3 className="text-sm font-bold" style={{ color: "var(--color-text, #201e1d)" }}>
                  {faq.question}
                </h3>
                <p className="text-xs sm:text-sm leading-relaxed" style={{ color: "color-mix(in srgb, var(--color-text, #201e1d) 78%, transparent)" }}>
                  {faq.answer}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Bottom CTA Banner */}
        <div
          className="rounded-3xl p-8 sm:p-12 text-center border shadow-sm space-y-6"
          style={{
            background: "color-mix(in srgb, var(--color-bg, #f5ead8) 60%, white 40%)",
            borderColor: "var(--color-divider, rgba(32, 30, 29, 0.16))",
          }}
        >
          <div className="max-w-xl mx-auto space-y-3">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ fontFamily: "var(--font-heading)" }}>
              Ready to Upgrade Your Customer Experience?
            </h2>
            <p className="text-xs sm:text-sm leading-relaxed" style={{ color: "color-mix(in srgb, var(--color-text, #201e1d) 80%, transparent)" }}>
              Deploy your AI assistant on your website in under 3 minutes. Test with a full 14-day trial, zero resolution fees, and unlimited team seats.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/signup"
              className="px-6 py-3 rounded-full text-xs font-bold text-white transition shadow-sm hover:brightness-105"
              style={{ background: "var(--color-accent, #c67139)" }}
            >
              Start Free Trial Now
            </Link>
            <Link
              href="/mcp"
              className="px-6 py-3 rounded-full text-xs font-semibold border transition hover:bg-black/5"
              style={{
                borderColor: "var(--color-divider, rgba(32, 30, 29, 0.2))",
                color: "var(--color-text, #201e1d)",
                background: "#ffffff",
              }}
            >
              Explore 81 MCP Tools
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
        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 Chatty (PersonaliAI). All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Link href="/compare" className="hover:opacity-80 transition">
              All Competitors
            </Link>
            <Link href="/mcp" className="hover:opacity-80 transition">
              MCP Server
            </Link>
            <Link href="/privacy" className="hover:opacity-80 transition">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:opacity-80 transition">
              Terms of Service
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
