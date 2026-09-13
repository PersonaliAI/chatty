"use client";

import Link from "next/link";
import { ExternalLink, CheckCircle2 } from "lucide-react";
import type { User as SupabaseUser } from "@supabase/supabase-js";

interface BillingInfo {
  plan?: string | null;
  status?: string | null;
  renewsAt?: string | null;
}

interface BillingTabProps {
  billingInfo: BillingInfo | null;
  user: SupabaseUser | null;
  billingInterval: "monthly" | "yearly";
  setBillingInterval: (iv: "monthly" | "yearly") => void;
}

const PLAN_LABELS: Record<string, string> = {
  free: "Free",
  chatty_hobby: "Hobby",
  chatty_standard: "Standard",
  chatty_business: "Business",
};

const PLAN_FEATURES: Record<string, string[]> = {
  free: ["100 message credits/mo", "1 chatbot", "Basic AI models"],
  chatty_hobby: [
    "1,000 message credits/mo",
    "10M training characters",
    "1 chatbot",
    "Fast & Advanced AI models",
    "AI Actions & Analytics",
    "Guardrails & Notifications",
    "Lead collection & API",
  ],
  chatty_standard: [
    "10,000 message credits/mo",
    "20M training characters",
    "3 chatbots",
    "Daily Auto Train sync",
    "Remove branding completely",
    "Unlimited team members",
  ],
  chatty_business: [
    "40,000 message credits/mo",
    "50M training characters",
    "5 chatbots",
    "BYOK (Bring-Your-Own-Key) option",
    "White-label configuration",
    "Management Admin API",
  ],
};

const PLAN_CARDS: {
  id: "hobby" | "standard" | "business";
  label: string;
  monthly: number;
  yearly: number;
  blurb: string;
  popular?: boolean;
}[] = [
  {
    id: "hobby",
    label: "Hobby",
    monthly: 19,
    yearly: 15,
    blurb: "Perfect for individuals, developers, and side projects.",
  },
  {
    id: "standard",
    label: "Standard",
    monthly: 99,
    yearly: 82,
    blurb: "All in Hobby, plus advanced automation and multi-bot systems.",
    popular: true,
  },
  {
    id: "business",
    label: "Business",
    monthly: 399,
    yearly: 332,
    blurb: "For enterprise scale, heavy traffic, and reseller options.",
  },
];

export function BillingTab({
  billingInfo,
  user,
  billingInterval,
  setBillingInterval,
}: BillingTabProps) {
  const plan = billingInfo?.plan || "free";
  const status = billingInfo?.status;
  const isPaid = ["active", "on_trial", "paused"].includes(status || "");
  const portalUrl = process.env.NEXT_PUBLIC_LEMON_PORTAL_URL || "";

  return (
    <div className="max-w-5xl mx-auto w-full py-6 px-4 space-y-6">
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-neutral-400">Current plan</div>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-xl font-bold text-neutral-900 dark:text-white">
                {PLAN_LABELS[plan] || plan}
              </span>
              {status && (
                <span
                  className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                    isPaid
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400"
                  }`}
                >
                  {status}
                </span>
              )}
            </div>
            {billingInfo?.renewsAt && (
              <div className="mt-1 text-xs text-neutral-400">
                Renews{" "}
                {new Date(billingInfo.renewsAt).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </div>
            )}
          </div>
          {isPaid && portalUrl && (
            <a
              href={portalUrl}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 inline-flex items-center gap-1.5 text-xs font-medium border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
            >
              Manage subscription <ExternalLink className="size-3.5" />
            </a>
          )}
        </div>

        <ul className="grid sm:grid-cols-2 gap-2">
          {(PLAN_FEATURES[plan] || PLAN_FEATURES.free).map((f) => (
            <li key={f} className="flex items-start gap-2 text-xs text-neutral-600 dark:text-neutral-400">
              <CheckCircle2 className="size-3.5 text-emerald-600 mt-0.5 shrink-0" />
              {f}
            </li>
          ))}
        </ul>

        <p className="text-[11px] text-neutral-400">
          Billing is handled by Lemon Squeezy. Receipts and tax invoices are sent to <b>{user?.email}</b>.
        </p>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="text-[10px] font-mono uppercase tracking-widest text-neutral-400">
            {isPaid ? "Change plan" : "Upgrade"}
          </div>
          <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-800 rounded-full p-0.5">
            {(["monthly", "yearly"] as const).map((iv) => (
              <button
                key={iv}
                type="button"
                onClick={() => setBillingInterval(iv)}
                className={`text-[10px] font-mono uppercase tracking-wider px-3 py-1.5 rounded-full transition-colors cursor-pointer ${
                  billingInterval === iv
                    ? "bg-white dark:bg-neutral-950 text-neutral-900 dark:text-white shadow-sm"
                    : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                }`}
              >
                {iv === "monthly" ? "Monthly" : "Yearly · 2 months free"}
              </button>
            ))}
          </div>
        </div>
        <div className="grid sm:grid-cols-3 gap-4">
          {PLAN_CARDS.map((card) => {
            const isCurrent = plan === `chatty_${card.id}`;
            return (
              <div
                key={card.id}
                className={`relative flex flex-col p-5 bg-white dark:bg-neutral-900 border rounded-2xl ${
                  card.popular
                    ? "border-neutral-900 dark:border-white"
                    : "border-neutral-200 dark:border-neutral-800"
                }`}
              >
                {card.popular && (
                  <span className="absolute top-0 right-5 -translate-y-1/2 px-2 py-0.5 bg-neutral-900 dark:bg-white text-white dark:text-black text-[9px] font-mono uppercase tracking-wider rounded">
                    Popular
                  </span>
                )}
                <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-400">
                  {card.label}
                </span>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-neutral-900 dark:text-white">
                    ${billingInterval === "yearly" ? card.yearly : card.monthly}
                  </span>
                  <span className="text-xs text-neutral-400">/mo</span>
                </div>
                {billingInterval === "yearly" && (
                  <span className="text-[10px] text-emerald-600">billed ${card.yearly * 12}/yr</span>
                )}
                <p className="mt-2 text-[11px] text-neutral-500 dark:text-neutral-400 leading-relaxed">
                  {card.blurb}
                </p>
                <ul className="mt-4 space-y-2 flex-1">
                  {PLAN_FEATURES[`chatty_${card.id}`].map((f) => (
                    <li
                      key={f}
                      className="flex items-start gap-2 text-[11px] text-neutral-600 dark:text-neutral-400"
                    >
                      <CheckCircle2 className="size-3.5 text-emerald-600 mt-0.5 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                {isCurrent ? (
                  <span className="mt-4 text-center text-xs font-mono uppercase tracking-wider border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2.5 text-neutral-400">
                    Current plan
                  </span>
                ) : (
                  <Link
                    href={`/checkout?plan=${card.id}&interval=${billingInterval}`}
                    className={`mt-4 text-center text-xs font-mono uppercase tracking-wider rounded-lg px-3 py-2.5 transition-colors ${
                      card.popular
                        ? "bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:text-black dark:hover:bg-neutral-100"
                        : "border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                    }`}
                  >
                    {isPaid ? "Switch" : "Upgrade"}
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Affiliate Partner Callout Banner */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono uppercase tracking-widest text-[#f97316] font-bold">
              Chatty Partner Program
            </span>
            <span className="px-2 py-0.5 rounded-full bg-[#f97316]/10 text-[#f97316] text-[10px] font-bold">
              30% Recurring
            </span>
          </div>
          <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
            Earn 30% monthly commission by recommending Chatty
          </h3>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Share your custom referral link with clients and peers. Earn recurring revenue on all paid plans for up to 12 months.
          </p>
        </div>
        <Link
          href="/affiliate"
          className="shrink-0 px-4 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100 text-xs font-bold transition-all shadow-xs"
        >
          Open Partner Portal &rarr;
        </Link>
      </div>
    </div>
  );
}
