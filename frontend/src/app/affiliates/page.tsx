import Link from "next/link";
import Image from "next/image";
import { ArrowRight, CheckCircle2, Clock, DollarSign, ShieldCheck } from "lucide-react";

const terms = [
  { label: "Commission", value: "30% recurring for 12 months", icon: DollarSign },
  { label: "Cookie window", value: "60 days attribution window", icon: Clock },
  { label: "Payout schedule", value: "30 days for refunds & automated verification", icon: ShieldCheck },
];

const fit = [
  "AI & SaaS builders and creators",
  "Web design agencies and freelancers",
  "Customer support & operations consultants",
  "Developer communities & newsletters",
];

export const metadata = {
  title: "Chatty Affiliate Program | Earn 30% Recurring Commission",
  description: "Earn recurring commission by sharing Chatty, the open-source AI customer support agent for websites.",
};

export default function AffiliatesPage() {
  return (
    <main className="min-h-screen bg-white text-zinc-900 font-sans antialiased">
      {/* Top Nav */}
      <header className="sticky top-0 z-50 border-b border-zinc-200/80 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/favicon.png" alt="Chatty Logo" width={28} height={28} className="object-contain" priority />
            <span className="font-display font-bold text-lg text-zinc-950">Chatty</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-xs font-semibold text-zinc-600 hover:text-zinc-950 px-3 py-1.5 transition-colors"
            >
              Back to Home
            </Link>
            <Link
              href="/affiliate"
              className="rounded-xl bg-[#f95721] hover:bg-[#ea4815] text-white px-4 py-2 text-xs font-semibold shadow-sm shadow-orange-500/20 transition-all"
            >
              Partner Portal
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <section className="mx-auto max-w-6xl px-6 py-16 sm:py-24">
        <div className="grid gap-12 lg:grid-cols-[1fr_420px] items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-mono font-medium text-[#f95721]">
              <span className="size-1.5 rounded-full bg-[#f95721]" />
              Affiliate Partner Program
            </div>

            <h1 className="mt-6 font-display text-4xl sm:text-6xl font-extrabold tracking-tight text-zinc-950 leading-[1.08]">
              Earn by sharing open-source <span className="text-[#f95721]">conversational AI</span>.
            </h1>

            <p className="mt-6 text-base sm:text-lg text-zinc-600 leading-relaxed max-w-xl">
              Refer teams to Chatty and earn 30% recurring commission when they launch
              autonomous AI customer support on their website. Built for makers, agencies,
              and consultants helping businesses scale customer communication.
            </p>

            <div className="mt-10 flex flex-col sm:flex-row gap-4">
              <Link
                href="/affiliate"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#f95721] hover:bg-[#ea4815] px-7 py-3.5 text-sm font-bold text-white shadow-md shadow-orange-500/25 transition-all"
              >
                <span>Join Partner Portal</span>
                <ArrowRight className="size-4" />
              </Link>
              <Link
                href="/#pricing"
                className="inline-flex items-center justify-center rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 px-6 py-3.5 text-sm font-semibold text-zinc-800 shadow-sm transition-all"
              >
                View Product Pricing
              </Link>
            </div>
          </div>

          {/* Program Terms Card */}
          <aside className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-6 sm:p-7 shadow-lg">
            <h2 className="font-display text-xl font-bold text-zinc-950">Program Terms</h2>
            <div className="mt-6 space-y-3">
              {terms.map(({ label, value, icon: Icon }) => (
                <div key={label} className="flex items-start gap-3.5 rounded-xl border border-zinc-200 bg-white p-3.5 shadow-sm">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-orange-50 text-[#f95721] border border-orange-100">
                    <Icon className="size-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-zinc-900">{label}</p>
                    <p className="mt-0.5 text-xs text-zinc-600 leading-relaxed">{value}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-xs font-bold text-emerald-900">Who it&apos;s best for</p>
              <ul className="mt-2.5 space-y-1.5">
                {fit.map((item) => (
                  <li key={item} className="flex items-center gap-2 text-xs text-emerald-800">
                    <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <p className="mt-5 text-[11px] text-zinc-500 leading-relaxed">
              No self-referrals. No paid search bidding on Chatty or PersonaliAI brand terms.
              Payouts are verified via automated audit.
            </p>
          </aside>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-200 bg-white py-8 text-xs text-zinc-500">
        <div className="mx-auto max-w-6xl px-6 flex flex-wrap items-center justify-between gap-4">
          <span>© {new Date().getFullYear()} PersonaliAI. All rights reserved.</span>
          <div className="flex items-center gap-4">
            <Link href="/" className="hover:text-zinc-900">Home</Link>
            <Link href="/privacy" className="hover:text-zinc-900">Privacy</Link>
            <Link href="/terms" className="hover:text-zinc-900">Terms</Link>
            <Link href="/support" className="hover:text-zinc-900">Support</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
