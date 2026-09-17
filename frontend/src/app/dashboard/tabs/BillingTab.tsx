"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ExternalLink,
  CheckCircle2,
  Copy,
  Check,
  DollarSign,
  Users,
  RefreshCw,
  Sparkles,
  Share2,
  ShieldCheck,
  ArrowRight,
} from "lucide-react";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { fetchBackend } from "@/lib/backend-client";

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
  free: [
    "100 message credits/mo",
    "1 chatbot",
    "Basic AI models",
    "100 MB Media Storage (50 products)",
  ],
  chatty_hobby: [
    "1,000 message credits/mo",
    "10M training characters",
    "3 chatbots",
    "Fast & Advanced AI models",
    "500 MB Media Storage (250 products)",
    "AI Actions & Analytics",
    "Guardrails & Notifications",
    "Lead collection & API",
  ],
  chatty_standard: [
    "10,000 message credits/mo",
    "20M training characters",
    "6 chatbots",
    "2 GB Media Storage (1,500 products)",
    "Daily Auto Train sync",
    "Remove branding completely",
    "Unlimited team members",
  ],
  chatty_business: [
    "40,000 message credits/mo",
    "50M training characters",
    "Unlimited chatbots",
    "10 GB Media Storage (Unlimited products)",
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

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

/**
 * User Account Affiliate & Payout Details Section.
 * Gives every user direct access to their referral link, stats,
 * and payment/payout details (e.g. PayPal/Wise email) right in their account.
 */
function UserAffiliateSection({ user }: { user: SupabaseUser | null }) {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [isAffiliate, setIsAffiliate] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  // Form states for payout details
  const [payoutEmail, setPayoutEmail] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);
  const [emailSaved, setEmailSaved] = useState(false);

  // Join state
  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  const loadAffiliateInfo = async () => {
    try {
      setLoading(true);
      const res = await fetchBackend(supabase, "/api/affiliate/me");
      if (res.ok) {
        const data = await res.json();
        if (data.is_affiliate && data.profile) {
          setIsAffiliate(true);
          setProfile(data.profile);
          setStats(data.stats);
          setPayoutEmail(data.profile.payout_email || user?.email || "");
        } else {
          setIsAffiliate(false);
          const defaultCode = (user?.email?.split("@")[0] || "partner")
            .toLowerCase()
            .replace(/[^a-z0-9_-]/g, "-")
            .slice(0, 30);
          setJoinCode(defaultCode);
          setPayoutEmail(user?.email || "");
        }
      }
    } catch (err) {
      console.error("Failed to load affiliate info:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) loadAffiliateInfo();
  }, [user]);

  const handleCopy = () => {
    if (!profile?.referral_url) return;
    navigator.clipboard.writeText(profile.referral_url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleUpdatePayoutEmail = async () => {
    if (!payoutEmail.trim()) return;
    setSavingEmail(true);
    setEmailSaved(false);
    try {
      const res = await fetchBackend(supabase, "/api/affiliate/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payout_email: payoutEmail.trim().toLowerCase() }),
      });
      if (res.ok) {
        setEmailSaved(true);
        setTimeout(() => setEmailSaved(false), 3000);
      }
    } catch (err) {
      console.error("Failed to update payout email:", err);
    } finally {
      setSavingEmail(false);
    }
  };

  const handleJoin = async () => {
    if (!joinCode.trim() || !payoutEmail.trim()) return;
    setJoining(true);
    setJoinError(null);
    try {
      const res = await fetchBackend(supabase, "/api/affiliate/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          referral_code: joinCode.trim().toLowerCase(),
          payout_email: payoutEmail.trim().toLowerCase(),
        }),
      });
      if (res.ok) {
        await loadAffiliateInfo();
      } else {
        const data = await res.json().catch(() => null);
        setJoinError(data?.detail || "Failed to activate referral code. Try another code.");
      }
    } catch (err) {
      console.error("Join affiliate error:", err);
      setJoinError("Network error. Please try again.");
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 flex items-center justify-center gap-2 text-xs text-neutral-400">
        <RefreshCw className="size-4 animate-spin" />
        <span>Loading affiliate &amp; payout settings...</span>
      </div>
    );
  }

  // State A: User is an Active Affiliate Partner
  if (isAffiliate && profile) {
    return (
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 space-y-5 shadow-xs">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-100 dark:border-neutral-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#f97316] font-bold">
                Partner &amp; Referral Program
              </span>
              <span className="px-2 py-0.5 rounded-full bg-[#f97316]/10 text-[#f97316] text-[10px] font-mono font-bold">
                {profile.commission_percentage}% Monthly Commission
              </span>
            </div>
            <h3 className="text-base font-bold text-neutral-900 dark:text-white mt-1">
              Your Referral Link &amp; Payment Payout Details
            </h3>
          </div>
          <Link
            href="/affiliate"
            className="text-xs font-semibold text-neutral-600 hover:text-[#f97316] dark:text-neutral-400 dark:hover:text-[#f97316] flex items-center gap-1 transition-colors"
          >
            <span>Full Partner Portal</span>
            <ExternalLink className="size-3.5" />
          </Link>
        </div>

        {/* Referral Link Box */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
            <Share2 className="size-3.5 text-[#f97316]" />
            <span>Your Personal Referral Link</span>
          </label>
          <div className="flex items-center gap-2">
            <div className="flex-1 px-3 py-2 text-xs font-mono rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-neutral-800 dark:text-neutral-200 truncate">
              {profile.referral_url}
            </div>
            <button
              type="button"
              onClick={handleCopy}
              className="px-3.5 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:text-neutral-900 text-xs font-semibold flex items-center gap-1.5 transition-all shrink-0 cursor-pointer"
            >
              {copied ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
              <span>{copied ? "Copied" : "Copy Link"}</span>
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-100 dark:border-neutral-800 space-y-0.5">
            <span className="text-[10px] uppercase font-mono text-neutral-400 block">Total Clicks</span>
            <p className="text-lg font-bold font-mono text-neutral-900 dark:text-white">
              {stats?.clicks_all_time ?? 0}
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-100 dark:border-neutral-800 space-y-0.5">
            <span className="text-[10px] uppercase font-mono text-neutral-400 block">Paid Referrals</span>
            <p className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400">
              {stats?.referrals_paid ?? 0}
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-100 dark:border-neutral-800 space-y-0.5">
            <span className="text-[10px] uppercase font-mono text-neutral-400 block">Pending Hold</span>
            <p className="text-lg font-bold font-mono text-amber-500">
              {formatCents(stats?.pending_cents ?? 0)}
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-100 dark:border-neutral-800 space-y-0.5">
            <span className="text-[10px] uppercase font-mono text-neutral-400 block">Payable Balance</span>
            <p className="text-lg font-bold font-mono text-[#f97316]">
              {formatCents(stats?.payable_cents ?? 0)}
            </p>
          </div>
        </div>

        {/* Payment Required Details in User Accounts */}
        <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800 space-y-2">
          <div>
            <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block">
              PayPal Payout Account (Required for commission disbursements)
            </label>
            <p className="text-[11px] text-neutral-400 mt-0.5">
              Specify your verified PayPal email address where earned commissions will be disbursed.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <input
              type="email"
              value={payoutEmail}
              onChange={(e) => setPayoutEmail(e.target.value)}
              placeholder="your-account@paypal.com"
              className="flex-1 px-3 py-2 text-xs rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-white focus:outline-none focus:border-[#f97316] transition-colors"
            />
            <button
              type="button"
              onClick={handleUpdatePayoutEmail}
              disabled={savingEmail || !payoutEmail.trim()}
              className="px-4 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:text-neutral-900 text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer shrink-0 flex items-center justify-center gap-1.5"
            >
              {savingEmail ? (
                <RefreshCw className="size-3.5 animate-spin" />
              ) : emailSaved ? (
                <Check className="size-3.5 text-emerald-400" />
              ) : null}
              <span>{emailSaved ? "Saved!" : "Save PayPal Email"}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // State B: User has not joined yet — 1-click Activation Card
  return (
    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 space-y-4 shadow-xs">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-mono uppercase tracking-widest text-[#f97316] font-bold">
          Partner Program
        </span>
        <span className="px-2 py-0.5 rounded-full bg-[#f97316]/10 text-[#f97316] text-[10px] font-bold">
          30% Recurring
        </span>
      </div>

      <div className="space-y-1">
        <h3 className="text-base font-bold text-neutral-900 dark:text-white">
          Earn 30% monthly commission by recommending Chatty
        </h3>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          Share your referral link with clients and colleagues. You&apos;ll earn recurring payouts on all paid subscriptions for 12 months.
        </p>
      </div>

      {joinError && (
        <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-600 dark:text-red-400">
          {joinError}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
        <div>
          <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block mb-1">
            Choose Referral Code
          </label>
          <input
            type="text"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))}
            placeholder="your-code"
            className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-white focus:outline-none focus:border-[#f97316]"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block mb-1">
            PayPal Email (Required for payouts)
          </label>
          <input
            type="email"
            value={payoutEmail}
            onChange={(e) => setPayoutEmail(e.target.value)}
            placeholder="paypal@yourdomain.com"
            className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-white focus:outline-none focus:border-[#f97316]"
          />
        </div>
      </div>

      <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <button
          type="button"
          onClick={handleJoin}
          disabled={joining || !joinCode.trim() || !payoutEmail.trim()}
          className="px-5 py-2.5 rounded-xl bg-[#f97316] hover:bg-[#ea580c] text-white text-xs font-bold transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
        >
          {joining ? (
            <RefreshCw className="size-3.5 animate-spin" />
          ) : (
            <Sparkles className="size-3.5" />
          )}
          <span>Activate Referral Link &amp; PayPal Payouts</span>
        </button>

        <Link
          href="/affiliate"
          className="text-xs text-neutral-500 hover:text-[#f97316] text-center sm:text-right transition-colors"
        >
          Learn more about terms &rarr;
        </Link>
      </div>
    </div>
  );
}

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
      {/* Header */}
      <div>
        <h2 className="text-sm font-bold">Billing &amp; Usage</h2>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
          Manage your subscription tier, billing interval, and affiliate partner earnings.
        </p>
      </div>

      {/* Current Plan Overview Card */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400">
              Current Subscription
            </span>
            <div className="flex items-center gap-3 mt-1">
              <h3 className="text-xl font-bold capitalize">
                {PLAN_LABELS[plan] || plan}
              </h3>
              {status && (
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase font-bold ${
                    status === "active"
                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                      : status === "on_trial"
                      ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400"
                      : "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400"
                  }`}
                >
                  {status}
                </span>
              )}
            </div>
            {billingInfo?.renewsAt && (
              <p className="text-xs text-neutral-400 mt-1">
                Renews on {new Date(billingInfo.renewsAt).toLocaleDateString()}
              </p>
            )}
          </div>

          {isPaid && portalUrl && (
            <a
              href={portalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-850 text-xs font-semibold text-neutral-700 dark:text-neutral-300 transition-colors"
            >
              <span>Manage Invoices</span>
              <ExternalLink className="size-3.5" />
            </a>
          )}
        </div>
      </div>

      {/* Plan Selection Grid */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold">Upgrade or Change Plan</h3>
            <p className="text-xs text-neutral-400">
              Choose the tier that matches your monthly conversation volume.
            </p>
          </div>

          {/* Monthly / Yearly Toggle */}
          <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-800 p-1 rounded-xl self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setBillingInterval("monthly")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                billingInterval === "monthly"
                  ? "bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-xs"
                  : "text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setBillingInterval("yearly")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1 ${
                billingInterval === "yearly"
                  ? "bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-xs"
                  : "text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
              }`}
            >
              <span>Yearly</span>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                (Save ~20%)
              </span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {PLAN_CARDS.map((card) => {
            const isCurrent = plan.includes(card.id);
            const price =
              billingInterval === "yearly" ? card.yearly : card.monthly;

            return (
              <div
                key={card.id}
                className={`rounded-2xl p-6 flex flex-col justify-between border transition-all ${
                  card.popular
                    ? "border-[#f97316] bg-white dark:bg-neutral-900 shadow-md relative"
                    : "border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900"
                }`}
              >
                {card.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-[#f97316] text-white text-[10px] font-mono uppercase font-bold tracking-wider shadow-xs">
                    Most Popular
                  </span>
                )}
                <div>
                  <h4 className="text-base font-bold">{card.label}</h4>
                  <p className="text-xs text-neutral-400 mt-1 min-h-[32px]">
                    {card.blurb}
                  </p>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-3xl font-black">${price}</span>
                    <span className="text-xs text-neutral-400">/month</span>
                  </div>
                  {billingInterval === "yearly" && (
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
                      Billed annually (${price * 12}/yr)
                    </p>
                  )}

                  <ul className="mt-6 space-y-2 text-xs text-neutral-600 dark:text-neutral-400">
                    {(PLAN_FEATURES[`chatty_${card.id}`] || []).map((feat) => (
                      <li key={feat} className="flex items-start gap-2">
                        <CheckCircle2 className="size-3.5 text-[#f97316] shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {isCurrent ? (
                  <span className="mt-6 text-center text-xs font-mono uppercase tracking-wider border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-2.5 text-neutral-400">
                    Current plan
                  </span>
                ) : (
                  <Link
                    href={`/checkout?plan=${card.id}&interval=${billingInterval}`}
                    className={`mt-6 text-center text-xs font-mono uppercase tracking-wider rounded-xl px-3 py-2.5 transition-all ${
                      card.popular
                        ? "bg-[#f97316] hover:bg-[#ea580c] text-white font-bold shadow-xs"
                        : "border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800 font-semibold"
                    }`}
                  >
                    {isPaid ? "Switch Plan" : "Upgrade"}
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* User Account Affiliate & Payment Required Details */}
      <UserAffiliateSection user={user} />
    </div>
  );
}
