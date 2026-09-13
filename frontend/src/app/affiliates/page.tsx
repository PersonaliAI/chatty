import Link from "next/link";
import { ArrowRight, CheckCircle2, Clock, DollarSign, ShieldCheck } from "lucide-react";

const affiliateUrl = "/affiliate";

const terms = [
  { label: "Commission", value: "30% recurring for 12 months", icon: DollarSign },
  { label: "Cookie window", value: "60 days", icon: Clock },
  { label: "Payout hold", value: "30 days for refunds and review", icon: ShieldCheck },
];

const fit = [
  "AI and SaaS creators",
  "Web agencies and freelancers",
  "Customer support consultants",
  "Startup communities and newsletters",
];

export const metadata = {
  title: "Chatty Affiliate Program",
  description: "Earn recurring commission by sharing Chatty, the open-source AI customer support bot for websites.",
};

export default function AffiliatesPage() {
  return (
    <main className="min-h-screen bg-[#f5ead8] text-[#201e1d]">
      <section className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-8">
        <nav className="flex items-center justify-between">
          <Link href="/" className="font-serif text-2xl font-bold">
            Chatty
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/affiliate"
              className="rounded-full bg-[#c67139] text-white px-4 py-2 text-sm font-semibold hover:bg-[#b2622d] transition-colors"
            >
              Partner Portal
            </Link>
            <Link
              href="/"
              className="rounded-full border border-[#201e1d]/15 px-4 py-2 text-sm font-medium hover:bg-white/40 transition-colors"
            >
              Back to Chatty
            </Link>
          </div>
        </nav>

        <div className="grid flex-1 items-center gap-12 py-16 lg:grid-cols-[1fr_440px]">
          <div>
            <p className="mb-5 text-sm font-bold uppercase tracking-wide text-[#c67139]">
              Affiliate Program
            </p>
            <h1 className="max-w-4xl font-serif text-5xl font-black leading-[1.05] md:text-7xl">
              Earn by sharing open-source AI support.
            </h1>
            <p className="mt-8 max-w-2xl text-xl leading-8 text-[#706c67]">
              Refer teams to Chatty and earn recurring commission when they launch
              AI customer support on their website. Good for makers, agencies,
              consultants, and creators who help businesses improve customer communication.
            </p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/affiliate"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[#c67139] px-7 py-4 text-sm font-bold text-white shadow-sm hover:bg-[#b2622d] transition-colors"
              >
                Join or Open Partner Portal
                <ArrowRight className="size-4" />
              </Link>
              <Link
                href="/pricing"
                className="inline-flex items-center justify-center rounded-full border border-[#201e1d]/15 px-7 py-4 text-sm font-bold hover:bg-white/40 transition-colors"
              >
                View product pricing
              </Link>
            </div>
          </div>

          <aside className="rounded-[28px] border border-[#201e1d]/10 bg-[#fffaf6] p-6 shadow-[0_20px_60px_rgba(42,37,33,0.12)]">
            <h2 className="text-2xl font-bold">Program terms</h2>
            <div className="mt-6 space-y-4">
              {terms.map(({ label, value, icon: Icon }) => (
                <div key={label} className="flex gap-4 rounded-2xl border border-[#201e1d]/10 bg-white p-4">
                  <div className="grid size-11 shrink-0 place-items-center rounded-full bg-[#fbefe5] text-[#c67139]">
                    <Icon className="size-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold">{label}</p>
                    <p className="mt-1 text-sm leading-6 text-[#706c67]">{value}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-7 rounded-2xl bg-[#eaf6ef] p-5">
              <p className="text-sm font-bold text-[#168565]">Best fit</p>
              <ul className="mt-3 space-y-2">
                {fit.map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm text-[#201e1d]">
                    <CheckCircle2 className="size-4 text-[#168565]" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <p className="mt-6 text-xs leading-6 text-[#706c67]">
              No self-referrals. No paid search bidding on Chatty or PersonaliAI
              brand terms. Payouts are reviewed before approval.
            </p>
          </aside>
        </div>
      </section>
    </main>
  );
}
