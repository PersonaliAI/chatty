import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  CalendarCheck,
  Check,
  ChevronRight,
  Clock3,
  Code2,
  FileText,
  Globe2,
  Inbox,
  MessageCircle,
  MousePointerClick,
  PlugZap,
  ShieldCheck,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Chatty | AI Customer Support Chatbot for Your Website",
  description:
    "Chatty is an AI customer support chatbot trained on your website, files, and help docs. Capture leads, book meetings, automate answers, and manage conversations from one dashboard.",
  keywords: [
    "AI customer support chatbot",
    "website chatbot",
    "AI live chat",
    "customer communication software",
    "Crisp alternative",
    "Intercom alternative",
    "lead capture chatbot",
    "AI booking assistant",
    "open source chatbot",
    "MCP chatbot",
  ],
  alternates: { canonical: "https://chatty.personaliai.com" },
  openGraph: {
    title: "Chatty — AI customer support for your website",
    description: "Train Chatty on your website, files, and docs. Answer visitors instantly, capture leads, book meetings, and hand off to your team.",
    url: "https://chatty.personaliai.com",
    siteName: "Chatty",
    type: "website",
    images: [{ url: "/chatty-hero-product.webp", width: 1270, height: 760, alt: "Chatty AI customer support dashboard and website chatbot" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Chatty — AI customer support for your website",
    description: "A website chatbot that answers, captures leads, books meetings, and works with Codex through MCP.",
    images: ["/chatty-hero-product.webp"],
  },
};

const productJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Chatty",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description: "AI customer support chatbot trained on websites, files, and help docs with lead capture, booking, team inbox, analytics, and MCP support.",
  url: "https://chatty.personaliai.com",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD", description: "Free BYOK plan and paid hosted AI plans." },
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What is Chatty?",
      acceptedAnswer: { "@type": "Answer", text: "Chatty is an AI customer support chatbot for websites. It trains on your content, answers questions, captures leads, books meetings, and routes conversations to your team." },
    },
    {
      "@type": "Question",
      name: "Can Chatty be an alternative to Crisp or Intercom?",
      acceptedAnswer: { "@type": "Answer", text: "Chatty is best for teams that want an AI-first customer communication product with website chat, trained answers, lead capture, booking, inbox workflows, analytics, and MCP automation." },
    },
    {
      "@type": "Question",
      name: "Is Chatty open source?",
      acceptedAnswer: { "@type": "Answer", text: "Yes. Chatty has a public open source repository on GitHub, plus a hosted cloud product for teams that want a managed deployment." },
    },
  ],
};

const nav = [
  ["Product", "#product"],
  ["Use cases", "#use-cases"],
  ["MCP", "#mcp"],
  ["Pricing", "#pricing"],
  ["FAQ", "#faq"],
];

const metrics = [
  ["5 min", "to launch a trained bot"],
  ["95+", "languages supported"],
  ["24/7", "instant visitor replies"],
  ["BYOK", "free forever option"],
];

const capabilities = [
  [BookOpen, "Train on real content", "Import websites, help articles, PDFs, files, and notes so answers come from your business, not generic AI memory."],
  [MessageCircle, "Answer every visitor", "Give fast, consistent help on pricing, setup, policy, troubleshooting, onboarding, and product questions."],
  [Inbox, "Human inbox when needed", "Review conversations, pause AI replies, assign owners, and keep context when a human should take over."],
  [CalendarCheck, "Book meetings in context", "Let qualified visitors choose real available calendar slots in their timezone before they leave your website."],
  [MousePointerClick, "Capture leads naturally", "Collect name, email, phone, company, and conversation intent only when the visitor shows real intent."],
  [PlugZap, "Connect through MCP", "Use Codex and other MCP clients to manage bots, knowledge, inboxes, campaigns, bookings, analytics, and team settings."],
] as const;

const workflows = [
  ["1", "Train", "Add your site, files, help docs, policies, and product details."],
  ["2", "Publish", "Copy one script, allow-list your domain, and launch the assistant."],
  ["3", "Convert", "Chatty answers, captures leads, books calls, and routes exceptions."],
  ["4", "Improve", "Review analytics and update knowledge from real visitor questions."],
];

const useCases = [
  ["SaaS support", "Answer setup, billing, integration, and account questions before they become tickets.", ["Help docs", "Product onboarding", "Human handoff"]],
  ["Sales qualification", "Turn high-intent website chats into qualified leads with meeting booking and transcript context.", ["Lead fields", "Calendar booking", "CRM/webhook handoff"]],
  ["Agencies & resellers", "Create branded bots for multiple client websites and manage them from one dashboard.", ["Multiple bots", "White label", "Team roles"]],
  ["Self-hosted teams", "Use the open source project when your team needs more control over hosting and architecture.", ["GitHub source", "BYOK models", "API access"]],
] as const;

const comparisons = [
  ["AI-first website support", "Purpose-built around trained website answers, not just live chat with an AI add-on."],
  ["Lead capture + booking", "Capture intent, contact details, and a meeting slot in the same conversation."],
  ["Open source path", "Use the hosted product or inspect and extend the public repository."],
  ["Codex/MCP control", "Manage real Chatty operations from an agent workflow instead of only clicking UI."],
];

const plans = [
  ["Free BYOK", "$0", "Use your own model key", ["1 chatbot", "Bring OpenAI, Gemini, Anthropic, or OpenRouter", "Knowledge training", "Lead capture", "No platform AI markup"], false],
  ["Hobby", "$19", "For solo builders", ["3 chatbots", "Included AI credits", "10M training characters", "Analytics", "API and notifications"], true],
  ["Standard", "$99", "For growing teams", ["6 chatbots", "10,000 message credits", "Daily auto-train", "Remove branding", "Unlimited team members"], false],
  ["Business", "$399", "For scale and resellers", ["Unlimited chatbots", "40,000 message credits", "50M training characters", "White-label controls", "Management API"], false],
] as const;

const faqs = [
  ["How fast can I launch Chatty?", "Most teams can launch the first trained website bot in minutes: create a bot, add sources, test common questions, then paste the embed script on the site."],
  ["Can Chatty be an alternative to Crisp?", "Yes, especially if you want an AI-first website communication product with trained answers, leads, booking, inbox, analytics, and a lower-complexity setup."],
  ["Does Chatty support human takeover?", "Yes. Your team can review conversations, pause AI replies, assign ownership, and use the inbox as the control room for conversations that need judgment."],
  ["Can I use my own AI provider key?", "Yes. The free BYOK option lets you use your own OpenAI, Anthropic, Gemini, or OpenRouter key without paying Chatty for model usage."],
  ["Does it work with Codex?", "Yes. Chatty ships a Codex plugin and hosted MCP server so agents can manage bots, knowledge, leads, bookings, inboxes, campaigns, and analytics."],
];

const heroSources = [
  ["Website pages", "1,248 indexed", FileText],
  ["Help articles", "96 synced", BookOpen],
  ["Product files", "32 uploaded", Code2],
] as const;

function LogoMark({ className = "size-8" }: { className?: string }) {
  return <Image src="/favicon.png" alt="" width={32} height={32} className={`${className} object-contain`} priority />;
}

function GithubMark({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56 0-.27-.01-1.17-.02-2.12-3.2.7-3.87-1.36-3.87-1.36-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.7.08-.7 1.17.08 1.78 1.2 1.78 1.2 1.03 1.77 2.71 1.26 3.37.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.05 11.05 0 0 1 5.79 0c2.2-1.49 3.17-1.18 3.17-1.18.64 1.59.24 2.76.12 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.69 5.38-5.25 5.67.41.36.78 1.07.78 2.15 0 1.55-.01 2.8-.01 3.18 0 .31.21.67.8.56A10.51 10.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
    </svg>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-black uppercase tracking-[0.24em] text-[#9c643f]">{children}</p>;
}

function HeroProductMockup() {
  return (
    <div className="relative mx-auto max-w-[720px]">
      <div className="absolute -left-8 top-14 hidden h-24 w-24 rounded-full border border-[#d8c9b5] bg-[#f0e2ce] lg:block" />
      <div className="absolute -right-8 bottom-10 hidden h-32 w-20 rounded-[999px] border border-[#d8c9b5] bg-[#e8d6bc] lg:block" />
      <div className="relative overflow-hidden rounded-[32px] border border-[#d6c5ad] bg-[#fffaf2] shadow-[0_22px_80px_rgba(46,35,24,0.16)]">
        <div className="flex items-center justify-between border-b border-[#e6d8c6] bg-[#f1e4d1] px-5 py-3 text-xs text-[#756654]">
          <div className="flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-[#c67139]" />
            <span className="size-2.5 rounded-full bg-[#d7b789]" />
            <span className="size-2.5 rounded-full bg-[#7a8a5e]" />
          </div>
          <span className="font-medium">your-store.com</span>
          <span className="hidden sm:inline">Live customer experience</span>
        </div>
        <div className="grid gap-5 p-5 md:grid-cols-[1fr_340px]">
          <div className="rounded-[24px] border border-[#eadcc9] bg-[#fbf4ea] p-5">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#9c643f]">Knowledge health</p>
            <h3 className="mt-4 max-w-[16ch] text-3xl font-black tracking-[-0.05em] text-[#201e1d]">Your content becomes answers.</h3>
            <div className="mt-6 grid gap-3">
              {heroSources.map(([title, desc, Icon]) => (
                <div key={String(title)} className="flex items-center gap-3 rounded-2xl border border-[#e6d8c6] bg-[#fffaf2] p-3">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-[#efe2cc] text-[#b2622d]">
                    <Icon className="size-5" />
                  </span>
                  <div>
                    <p className="text-sm font-black text-[#201e1d]">{title}</p>
                    <p className="text-xs text-[#7b6f61]">{desc}</p>
                  </div>
                  <Check className="ml-auto size-4 text-[#7a8a5e]" />
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-[24px] border border-[#d4b596] bg-white shadow-[0_14px_42px_rgba(69,48,29,0.14)]">
            <div className="flex items-center gap-3 rounded-t-[24px] bg-[#c67139] px-4 py-3 text-white">
              <span className="flex size-10 items-center justify-center rounded-full bg-white">
                <LogoMark className="size-7" />
              </span>
              <div>
                <p className="font-black leading-none">Chatty</p>
                <p className="mt-1 text-xs text-white/85">Online · replies instantly</p>
              </div>
            </div>
            <div className="space-y-3 p-4">
              <p className="w-[84%] rounded-2xl bg-[#f2e7d7] px-4 py-3 text-sm text-[#312820]">Do you integrate with my docs and calendar?</p>
              <div className="rounded-2xl bg-[#edf3e4] px-4 py-3 text-sm leading-relaxed text-[#303b24]">
                Yes. Train Chatty on your docs, capture lead details, then let visitors book a meeting in their timezone.
              </div>
              <div className="rounded-2xl border border-[#e6d8c6] bg-[#fffaf2] p-3">
                <div className="flex items-center justify-between text-xs text-[#756654]">
                  <span className="inline-flex items-center gap-1.5"><Clock3 className="size-3.5" /> 30m</span>
                  <span className="inline-flex items-center gap-1.5"><Globe2 className="size-3.5" /> Visitor time</span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {["9:00 AM", "9:30 AM", "10:00 AM"].map((time) => (
                    <span key={time} className="rounded-xl border border-[#e2d1bc] px-2 py-2 text-center text-xs font-black text-[#201e1d]">{time}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f6ebdb] text-[#201e1d]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <style>{`
        @keyframes chatty-rise { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes chatty-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        @keyframes chatty-pulse-line { 0%, 100% { width: 34%; } 50% { width: 92%; } }
        .chatty-rise { animation: chatty-rise .75s ease both; }
        .chatty-float { animation: chatty-float 5s ease-in-out infinite; }
        .chatty-line { animation: chatty-pulse-line 4.5s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .chatty-rise, .chatty-float, .chatty-line { animation: none; } }
      `}</style>

      <header className="sticky top-0 z-40 border-b border-[#e2d2bd] bg-[#f6ebdb]/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8">
          <Link href="/" className="flex items-center gap-3" aria-label="Chatty home">
            <LogoMark />
            <span className="text-xl font-black tracking-[-0.04em]">Chatty</span>
          </Link>
          <nav className="hidden items-center gap-7 text-sm font-medium text-[#51463a] md:flex">
            {nav.map(([label, href]) => <Link key={label} href={href} className="hover:text-[#b2622d]">{label}</Link>)}
          </nav>
          <div className="flex items-center gap-3">
            <a href="https://github.com/PersonaliAI/chatty" target="_blank" rel="noreferrer" className="hidden rounded-full border border-[#d7c7b2] px-4 py-2 text-sm font-black text-[#51463a] hover:bg-[#efe0cc] sm:inline-flex">
              <GithubMark className="mr-2 size-4" /> GitHub
            </a>
            <Link href="/dashboard" className="rounded-full bg-[#201e1d] px-5 py-2.5 text-sm font-black text-[#fff7ed] shadow-[0_8px_24px_rgba(32,30,29,0.18)]">Start free</Link>
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-12 px-5 pb-20 pt-16 lg:grid-cols-[0.92fr_1.08fr] lg:px-8 lg:pb-28 lg:pt-24">
        <div className="chatty-rise">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#d8c6ae] bg-[#fff7ec] px-3 py-1.5 text-xs font-black uppercase tracking-[0.16em] text-[#7a4a28]">
            <Sparkles className="size-3.5" /> AI support · live chat · leads · booking
          </div>
          <h1 className="mt-7 max-w-[11ch] text-6xl font-black leading-[0.9] tracking-[-0.075em] text-[#201e1d] sm:text-7xl lg:text-[92px]">
            Customer support that sells while it helps.
          </h1>
          <p className="mt-7 max-w-xl text-lg leading-8 text-[#5f5144]">
            Chatty is an AI customer support chatbot for your website. Train it on your content, answer visitors instantly, capture qualified leads, and book meetings from one calm dashboard.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link href="/dashboard" className="inline-flex items-center justify-center rounded-full bg-[#c67139] px-7 py-4 text-base font-black text-white shadow-[0_14px_34px_rgba(198,113,57,0.26)]">
              Launch your bot <ArrowRight className="ml-2 size-4" />
            </Link>
            <Link href="#product" className="inline-flex items-center justify-center rounded-full border border-[#cdbca6] px-7 py-4 text-base font-black text-[#3c332b] hover:bg-[#efe0cc]">See how it works</Link>
          </div>
          <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {metrics.map(([value, label]) => (
              <div key={value} className="rounded-2xl border border-[#ddccb5] bg-[#f9f0e3] p-4">
                <p className="text-xl font-black tracking-[-0.04em] text-[#201e1d]">{value}</p>
                <p className="mt-1 text-xs leading-snug text-[#756654]">{label}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="chatty-rise chatty-float lg:pt-8" style={{ animationDelay: ".12s" }}>
          <HeroProductMockup />
        </div>
      </section>

      <section className="border-y border-[#e0ceb6] bg-[#fff7ec]">
        <div className="mx-auto grid max-w-7xl gap-4 px-5 py-6 text-center text-sm font-black text-[#756654] sm:grid-cols-4 lg:px-8">
          <span>Open source option</span>
          <span>Hosted cloud product</span>
          <span>Codex MCP integration</span>
          <span>Built for customer communication</span>
        </div>
      </section>

      <section id="product" className="mx-auto max-w-7xl px-5 py-24 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[0.72fr_1fr]">
          <div>
            <SectionLabel>Product</SectionLabel>
            <h2 className="mt-4 max-w-[12ch] text-5xl font-black leading-[0.95] tracking-[-0.065em]">Everything a website conversation needs.</h2>
            <p className="mt-6 max-w-md text-base leading-7 text-[#625649]">
              Strong chatbot products sell a complete support system, not only a floating bubble. Chatty brings the system into one focused product: knowledge, inbox, leads, booking, analytics, and agent control.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {capabilities.map(([Icon, title, body], index) => (
              <article key={title} className="chatty-rise rounded-[28px] border border-[#decdb6] bg-[#fbf2e6] p-6 shadow-[0_10px_28px_rgba(68,48,30,0.07)]" style={{ animationDelay: `${index * 60}ms` }}>
                <span className="flex size-11 items-center justify-center rounded-2xl bg-[#e8d9c3] text-[#b2622d]"><Icon className="size-5" /></span>
                <h3 className="mt-5 text-xl font-black tracking-[-0.035em]">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-[#625649]">{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#201e1d] py-24 text-[#fff4e7]">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-[#dfa66f]">Why teams switch</p>
              <h2 className="mt-4 max-w-[13ch] text-5xl font-black leading-[0.95] tracking-[-0.065em]">A lighter alternative to bulky helpdesks.</h2>
              <p className="mt-6 max-w-xl text-base leading-7 text-[#d7c8b7]">
                Crisp, Intercom, Tidio, and Zendesk prove the same market truth: customers want answers now, and teams need a workspace behind the bot. Chatty focuses that idea for founders, SaaS teams, agencies, and operators who want AI-first communication without enterprise sprawl.
              </p>
            </div>
            <div className="grid gap-4">
              {comparisons.map(([title, body]) => (
                <div key={title} className="rounded-[24px] border border-[#493f35] bg-[#2a2723] p-5">
                  <h3 className="font-black tracking-[-0.03em] text-[#fff4e7]">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#d7c8b7]">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-24 lg:px-8">
        <div className="rounded-[36px] border border-[#d9c7ae] bg-[#efe0cc] p-6 sm:p-10 lg:p-12">
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <SectionLabel>Workflow</SectionLabel>
              <h2 className="mt-4 text-5xl font-black leading-[0.95] tracking-[-0.065em]">Launch once. Improve from every chat.</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {workflows.map(([num, title, body]) => (
                <div key={num} className="rounded-[26px] border border-[#d1bea5] bg-[#fff7ec] p-5">
                  <span className="flex size-10 items-center justify-center rounded-full bg-[#c67139] text-sm font-black text-white">{num}</span>
                  <h3 className="mt-5 text-xl font-black tracking-[-0.04em]">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#625649]">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="use-cases" className="mx-auto max-w-7xl px-5 pb-24 lg:px-8">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <SectionLabel>Use cases</SectionLabel>
            <h2 className="mt-4 max-w-[13ch] text-5xl font-black leading-[0.95] tracking-[-0.065em]">Built for real website teams.</h2>
          </div>
          <p className="max-w-xl text-base leading-7 text-[#625649]">
            The best AI customer support chatbot is not just accurate. It fits the operating model: sales, support, agencies, or self-hosted product teams.
          </p>
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {useCases.map(([title, body, items]) => (
            <article key={title} className="rounded-[28px] border border-[#decdb6] bg-[#fbf2e6] p-6">
              <h3 className="text-xl font-black tracking-[-0.035em]">{title}</h3>
              <p className="mt-3 text-sm leading-6 text-[#625649]">{body}</p>
              <ul className="mt-6 space-y-2">
                {items.map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm font-black text-[#51463a]"><Check className="size-4 text-[#7a8a5e]" /> {item}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section id="mcp" className="border-y border-[#d8c6ae] bg-[#fff7ec] py-24">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
          <div>
            <SectionLabel>MCP + Codex</SectionLabel>
            <h2 className="mt-4 max-w-[12ch] text-5xl font-black leading-[0.95] tracking-[-0.065em]">Run Chatty from a conversation.</h2>
            <p className="mt-6 max-w-xl text-base leading-7 text-[#625649]">
              Install the Chatty Codex plugin or connect the hosted MCP server. Agents can audit bots, update knowledge, review leads, manage campaigns, inspect analytics, and operate bookings with scoped OAuth access.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/dashboard" className="rounded-full bg-[#201e1d] px-6 py-3 text-sm font-black text-[#fff7ec]">Connect account</Link>
              <a href="https://github.com/PersonaliAI/chatty" target="_blank" rel="noreferrer" className="rounded-full border border-[#ccb89d] px-6 py-3 text-sm font-black text-[#3c332b]">View plugin source</a>
            </div>
          </div>
          <div className="rounded-[32px] border border-[#d6c5ad] bg-[#f5ead8] p-5">
            <div className="rounded-[24px] bg-[#201e1d] p-5 font-mono text-sm text-[#fff4e7]">
              <p className="text-[#dfa66f]">Codex → Chatty MCP</p>
              <div className="mt-5 space-y-3">
                {["Audit my lead-capture bot", "Update help articles from support gaps", "Show bookings by team member timezone", "Export unanswered questions this week"].map((line) => (
                  <div key={line} className="rounded-2xl border border-[#4c4137] bg-[#2a2723] px-4 py-3"><span className="text-[#dfa66f]">$</span> {line}</div>
                ))}
              </div>
              <div className="chatty-line mt-6 h-1.5 rounded-full bg-[#c67139]" />
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-24 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-3">
          {[
            [ShieldCheck, "Safe by design", "Domain allow-lists, scoped integrations, business email checks, handoff rules, and visibility for admin teams."],
            [Users, "Team-ready", "Invite teammates, share inbox work, route meetings, and keep availability aligned across timezones."],
            [BarChart3, "Measured outcomes", "Track conversations, leads, unanswered questions, bookings, model usage, and customer intent."],
          ].map(([Icon, title, body]) => {
            const Cmp = Icon as typeof ShieldCheck;
            return (
              <article key={String(title)} className="rounded-[32px] border border-[#decdb6] bg-[#fbf2e6] p-7">
                <Cmp className="size-7 text-[#b2622d]" />
                <h3 className="mt-5 text-2xl font-black tracking-[-0.045em]">{title as string}</h3>
                <p className="mt-3 text-sm leading-6 text-[#625649]">{body as string}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section id="pricing" className="bg-[#efe0cc] py-24">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="max-w-2xl">
            <SectionLabel>Pricing</SectionLabel>
            <h2 className="mt-4 text-5xl font-black leading-[0.95] tracking-[-0.065em]">Start free. Scale when support grows.</h2>
          </div>
          <div className="mt-10 grid gap-4 lg:grid-cols-4">
            {plans.map(([name, price, note, features, highlighted]) => (
              <article key={name} className={`rounded-[30px] border p-6 ${highlighted ? "border-[#201e1d] bg-[#201e1d] text-[#fff7ec]" : "border-[#d1bea5] bg-[#fff7ec]"}`}>
                {highlighted && <span className="rounded-full bg-[#c67139] px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-white">Popular</span>}
                <h3 className="mt-5 text-2xl font-black tracking-[-0.04em]">{name}</h3>
                <p className={`mt-2 text-sm ${highlighted ? "text-[#d7c8b7]" : "text-[#756654]"}`}>{note}</p>
                <p className="mt-6 text-4xl font-black tracking-[-0.06em]">{price}<span className="text-base font-semibold">/mo</span></p>
                <ul className="mt-6 space-y-3">
                  {features.map((feature) => <li key={feature} className={`flex gap-2 text-sm ${highlighted ? "text-[#f4e7d6]" : "text-[#51463a]"}`}><Check className="mt-0.5 size-4 shrink-0 text-[#7a8a5e]" /> {feature}</li>)}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="faq" className="mx-auto max-w-5xl px-5 py-24 lg:px-8">
        <div className="text-center">
          <SectionLabel>FAQ</SectionLabel>
          <h2 className="mt-4 text-5xl font-black leading-[0.95] tracking-[-0.065em]">Questions buyers search before they choose.</h2>
        </div>
        <div className="mt-10 divide-y divide-[#dcc9b0] rounded-[32px] border border-[#dcc9b0] bg-[#fbf2e6]">
          {faqs.map(([question, answer]) => (
            <article key={question} className="grid gap-3 p-6 md:grid-cols-[0.42fr_0.58fr]">
              <h3 className="text-lg font-black tracking-[-0.03em]">{question}</h3>
              <p className="text-sm leading-6 text-[#625649]">{answer}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-24 lg:px-8">
        <div className="relative overflow-hidden rounded-[40px] bg-[#c67139] p-8 text-white sm:p-12 lg:p-16">
          <div className="absolute right-8 top-8 hidden rounded-full border border-white/25 px-4 py-2 text-sm font-black lg:block"><Zap className="mr-2 inline size-4" /> No code required</div>
          <h2 className="max-w-[14ch] text-5xl font-black leading-[0.95] tracking-[-0.065em]">Put Chatty on your website today.</h2>
          <p className="mt-5 max-w-xl text-base leading-7 text-[#fff0df]">Build an AI customer support chatbot that answers accurately, captures every serious lead, books meetings, and gives your team the context to follow up.</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/dashboard" className="inline-flex items-center justify-center rounded-full bg-white px-7 py-4 font-black text-[#9c4f1c]">Start free <ChevronRight className="ml-1 size-5" /></Link>
            <a href="https://docs.chatty.personaliai.com" target="_blank" rel="noreferrer" className="inline-flex items-center justify-center rounded-full border border-white/45 px-7 py-4 font-black text-white">Read docs</a>
          </div>
        </div>
      </section>

      <footer className="border-t border-[#d8c6ae] bg-[#fff7ec]">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-12 sm:grid-cols-2 lg:grid-cols-4 lg:px-8">
          <div>
            <Link href="/" className="flex items-center gap-3"><LogoMark /><span className="text-xl font-black tracking-[-0.04em]">Chatty</span></Link>
            <p className="mt-4 max-w-xs text-sm leading-6 text-[#625649]">AI customer communication software for websites that need support, lead capture, booking, and real human handoff.</p>
          </div>
          <div>
            <h3 className="font-black">Product</h3>
            <div className="mt-4 grid gap-2 text-sm text-[#625649]"><Link href="#product">Features</Link><Link href="#use-cases">Use cases</Link><Link href="#pricing">Pricing</Link><Link href="/affiliates">Affiliates</Link></div>
          </div>
          <div>
            <h3 className="font-black">Resources</h3>
            <div className="mt-4 grid gap-2 text-sm text-[#625649]"><a href="https://docs.chatty.personaliai.com" target="_blank" rel="noreferrer">Documentation</a><a href="https://github.com/PersonaliAI/chatty" target="_blank" rel="noreferrer">GitHub</a><Link href="/support">Support</Link></div>
          </div>
          <div>
            <h3 className="font-black">Legal</h3>
            <div className="mt-4 grid gap-2 text-sm text-[#625649]"><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/zoom">Zoom app</Link></div>
          </div>
        </div>
        <div className="mx-auto max-w-7xl border-t border-[#e1cfb8] px-5 py-6 text-sm text-[#756654] lg:px-8">
          © {new Date().getFullYear()} PersonaliAI. Chatty is built for fast, accountable customer conversations.
        </div>
      </footer>
    </main>
  );
}
