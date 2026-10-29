"use client";

import { useEffect, useState, useMemo } from "react";
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
  Bot,
  Database,
  Infinity as InfinityIcon,
  Zap,
  Clock,
  Lock,
  Crown,
  Layers,
  HardDrive,
} from "lucide-react";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { fetchBackend } from "@/lib/backend-client";
import { StorageManagementPanel } from "@/components/storage-management-panel";

export interface BillingInfo {
  plan?: string | null;
  status?: string | null;
  renewsAt?: string | null;
  ownerEmail?: string | null;
  ownerName?: string | null;
  isSharedBot?: boolean;
}

interface BillingTabProps {
  botId?: string | null;
  billingInfo: BillingInfo | null;
  user: SupabaseUser | null;
  billingInterval: "monthly" | "yearly";
  setBillingInterval: (iv: "monthly" | "yearly") => void;
  isPlatformAdmin?: boolean;
  userBotsCount?: number;
  totalCharsCount?: number;
  teamMembersCount?: number;
}

const ADMIN_BYPASS_EMAILS = new Set([
  "personaliai.com@gmail.com",
  "damayanthakat@gmail.com",
]);

const PLAN_LABELS: Record<string, string> = {
  free: "Standard (14-Day Trial)",
  chatty_hobby: "Hobby",
  chatty_standard: "Standard",
  chatty_business: "Business",
  chatty_enterprise: "Enterprise Operator (Super Admin)",
};

interface PlanTierConfig {
  id: string;
  label: string;
  monthlyCredits: number | null; // null = unlimited
  maxBots: number | null; // null = unlimited
  maxCharacters: number | null; // null = unlimited
  mediaStorageMb: number | null; // null = unlimited
  teamSeats: number | null; // null = unlimited
  whitelabel: boolean;
  byok: boolean;
  autoTrainSchedule: string;
  adminApi: boolean;
  features: string[];
}

const PLAN_TIER_CONFIGS: Record<string, PlanTierConfig> = {
  chatty_hobby: {
    id: "chatty_hobby",
    label: "Hobby",
    monthlyCredits: 1000,
    maxBots: 3,
    maxCharacters: 10_000_000,
    mediaStorageMb: 500,
    teamSeats: 1,
    whitelabel: false,
    byok: false,
    autoTrainSchedule: "Manual",
    adminApi: false,
    features: [
      "1,000 weighted AI credits / mo (≈ ~800 chats)",
      "10M training characters",
      "Up to 3 live AI chatbots",
      "500 MB Media Storage (250 products)",
      "Fast & Advanced foundation models",
      "Lead extraction & notifications",
      "Calendar scheduling (Outlook & Google)",
      "Single teammate workspace",
    ],
  },
  chatty_standard: {
    id: "chatty_standard",
    label: "Standard",
    monthlyCredits: 10000,
    maxBots: 6,
    maxCharacters: 20_000_000,
    mediaStorageMb: 2048,
    teamSeats: null,
    whitelabel: true,
    byok: false,
    autoTrainSchedule: "Daily Auto-Sync",
    adminApi: false,
    features: [
      "10,000 weighted AI credits / mo (≈ ~8,000 chats)",
      "20M training characters",
      "Up to 6 live AI chatbots",
      "2 GB Media Storage (1,500 products)",
      "Remove Chatty branding completely",
      "Daily Auto Train & cloud re-indexing",
      "Teams & Meet video links generated",
      "Unlimited team collaboration seats",
    ],
  },
  chatty_business: {
    id: "chatty_business",
    label: "Business",
    monthlyCredits: 40000,
    maxBots: null,
    maxCharacters: 50_000_000,
    mediaStorageMb: 10240,
    teamSeats: null,
    whitelabel: true,
    byok: true,
    autoTrainSchedule: "Realtime Continuous",
    adminApi: true,
    features: [
      "40,000 weighted AI credits / mo (≈ ~35,000 chats)",
      "50M training characters",
      "Unlimited AI chatbots",
      "10 GB Media Storage (Unlimited products)",
      "Bring-Your-Own-Key (BYOK) for 0 platform fees",
      "Full White-label configuration & domain CNAME",
      "Management Admin API & webhooks",
      "Priority inference routing & SLA",
    ],
  },
  chatty_enterprise: {
    id: "chatty_enterprise",
    label: "Enterprise Operator",
    monthlyCredits: null,
    maxBots: null,
    maxCharacters: null,
    mediaStorageMb: null,
    teamSeats: null,
    whitelabel: true,
    byok: true,
    autoTrainSchedule: "Realtime Continuous",
    adminApi: true,
    features: [
      "Unlimited weighted AI credits ($0 Operator Plan)",
      "Unlimited training character volume",
      "Unlimited live chatbots & deployments",
      "Unlimited Media Storage & products",
      "Full Enterprise White-labeling",
      "Dedicated developer APIs & webhooks",
      "Super-Admin administrative bypass",
      "All limits, quotas & trials bypassed",
    ],
  },
};

const PLAN_CARDS = [
  {
    id: "hobby",
    key: "chatty_hobby",
    label: "Hobby",
    monthly: 19,
    yearly: 15,
    blurb: "Perfect for individuals, developers, and side projects.",
    credits: "1,000 credits/mo",
    bots: "3 chatbots",
    chars: "10M chars",
  },
  {
    id: "standard",
    key: "chatty_standard",
    label: "Standard",
    monthly: 99,
    yearly: 79,
    blurb: "All in Hobby, plus advanced automation and multi-bot systems.",
    credits: "10,000 credits/mo",
    bots: "6 chatbots",
    chars: "20M chars",
    popular: true,
  },
  {
    id: "business",
    key: "chatty_business",
    label: "Business",
    monthly: 399,
    yearly: 319,
    blurb: "For enterprise scale, heavy traffic, and reseller options.",
    credits: "40,000 credits/mo",
    bots: "Unlimited chatbots",
    chars: "50M chars",
  },
];

function formatNumber(num: number | null | undefined): string {
  if (num === null || num === undefined) return "∞ Unlimited";
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toLocaleString();
}

/**
 * User Account Affiliate & Payout Details Section.
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
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 sm:p-6 flex items-center justify-center gap-2 text-xs text-neutral-400">
        <RefreshCw className="size-4 animate-spin" />
        <span>Loading affiliate &amp; payout settings...</span>
      </div>
    );
  }

  if (isAffiliate && profile) {
    return (
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 sm:p-6 space-y-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-100 dark:border-neutral-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#f97316] font-bold">
                Partner &amp; Referral Program
              </span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-[10px] font-mono font-bold">
                Active Partner (30% Commission)
              </span>
            </div>
            <h3 className="text-base font-bold mt-1 text-neutral-900 dark:text-white">
              Your Referral Link &amp; Earnings
            </h3>
          </div>
          <Link
            href="/affiliate"
            className="text-xs text-neutral-500 hover:text-[#f97316] inline-flex items-center gap-1 transition-colors"
          >
            <span>Partner Terms</span>
            <ArrowRight className="size-3" />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-950/50 border border-neutral-200/60 dark:border-neutral-800/60">
            <span className="text-[10px] font-mono uppercase text-neutral-400 block">Total Referrals</span>
            <span className="text-lg font-bold text-neutral-900 dark:text-white mt-0.5 block">
              {stats?.total_referrals || 0}
            </span>
          </div>
          <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-950/50 border border-neutral-200/60 dark:border-neutral-800/60">
            <span className="text-[10px] font-mono uppercase text-neutral-400 block">Paid Customers</span>
            <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 block">
              {stats?.active_subscriptions || 0}
            </span>
          </div>
          <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-950/50 border border-neutral-200/60 dark:border-neutral-800/60">
            <span className="text-[10px] font-mono uppercase text-neutral-400 block">Unpaid Commission</span>
            <span className="text-lg font-bold text-[#f97316] mt-0.5 block">
              ${((stats?.pending_commission_cents || 0) / 100).toFixed(2)}
            </span>
          </div>
          <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-950/50 border border-neutral-200/60 dark:border-neutral-800/60">
            <span className="text-[10px] font-mono uppercase text-neutral-400 block">Total Paid Out</span>
            <span className="text-lg font-bold text-neutral-900 dark:text-white mt-0.5 block">
              ${((stats?.paid_commission_cents || 0) / 100).toFixed(2)}
            </span>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block">
            Your Dedicated Referral Link
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={profile.referral_url}
              className="flex-1 px-3 py-2 text-xs font-mono rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-neutral-700 dark:text-neutral-300 select-all focus:outline-none"
            />
            <button
              type="button"
              onClick={handleCopy}
              className="px-3.5 py-2 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 hover:bg-neutral-800 text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer"
            >
              {copied ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
              <span>{copied ? "Copied" : "Copy Link"}</span>
            </button>
          </div>
        </div>

        <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1">
            <span className="text-xs text-neutral-500 whitespace-nowrap">Payout PayPal:</span>
            <input
              type="email"
              value={payoutEmail}
              onChange={(e) => setPayoutEmail(e.target.value)}
              placeholder="paypal@yourdomain.com"
              className="px-3 py-1.5 text-xs rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-white flex-1 max-w-sm focus:outline-none focus:border-[#f97316]"
            />
            <button
              type="button"
              onClick={handleUpdatePayoutEmail}
              disabled={savingEmail || !payoutEmail.trim()}
              className="px-3 py-1.5 rounded-xl border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs font-semibold text-neutral-700 dark:text-neutral-300 transition-colors disabled:opacity-50 shrink-0 cursor-pointer"
            >
              {savingEmail ? "Saving..." : emailSaved ? "Saved!" : "Update"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 sm:p-6 space-y-4 shadow-xs">
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
  botId,
  billingInfo,
  user,
  billingInterval,
  setBillingInterval,
  isPlatformAdmin = false,
  userBotsCount = 1,
  totalCharsCount = 0,
  teamMembersCount = 1,
}: BillingTabProps) {
  const supabase = createClient();
  const [summaryData, setSummaryData] = useState<any>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  const userEmail = (user?.email || "").toLowerCase().trim();
  const isAdmin = useMemo(() => {
    return isPlatformAdmin || ADMIN_BYPASS_EMAILS.has(userEmail);
  }, [isPlatformAdmin, userEmail]);

  // Determine effective plan
  const selectedPlanPref = (user?.user_metadata?.plan_preference as string) || (user?.user_metadata?.selected_plan as string);
  const activePlanKey = useMemo(() => {
    if (isAdmin) return "chatty_enterprise";
    if (billingInfo?.plan && billingInfo.plan !== "free") {
      return billingInfo.plan;
    }
    if (selectedPlanPref && PLAN_TIER_CONFIGS[selectedPlanPref]) {
      return selectedPlanPref;
    }
    return "chatty_standard";
  }, [isAdmin, billingInfo?.plan, selectedPlanPref]);

  const activeTierConfig = PLAN_TIER_CONFIGS[activePlanKey] || PLAN_TIER_CONFIGS.chatty_standard;

  const isPaidActive = Boolean(
    !isAdmin &&
    billingInfo?.status &&
    ["active", "paid"].includes(billingInfo.status) &&
    billingInfo.plan &&
    billingInfo.plan !== "free"
  );

  const isTrial = Boolean(!isAdmin && !isPaidActive);

  // Trial countdown calculation
  const trialDaysRemaining = useMemo(() => {
    if (!isTrial) return 14;
    const startRaw = (user?.user_metadata?.trial_started_at as string) || user?.created_at;
    if (!startRaw) return 14;
    try {
      const start = new Date(startRaw);
      const elapsed = Math.floor((Date.now() - start.getTime()) / (1000 * 60 * 60 * 24));
      return Math.max(0, 14 - elapsed);
    } catch {
      return 14;
    }
  }, [isTrial, user]);

  const trialDaysElapsed = Math.min(14, Math.max(0, 14 - trialDaysRemaining));

  // Load backend summary if available
  useEffect(() => {
    async function loadSummary() {
      try {
        setLoadingSummary(true);
        const res = await fetchBackend(supabase, "/api/billing/summary");
        if (res.ok) {
          const d = await res.json();
          setSummaryData(d);
        }
      } catch (err) {
        console.warn("Billing summary query fallback to client state:", err);
      } finally {
        setLoadingSummary(false);
      }
    }
    loadSummary();
  }, []);

  // Compute live usage numbers
  const liveAiCreditsUsed = summaryData?.usage?.ai_credits?.used ?? 0;
  const liveAiCreditsLimit = isAdmin ? null : (summaryData?.usage?.ai_credits?.limit ?? activeTierConfig.monthlyCredits);

  const liveBotsCount = summaryData?.usage?.chatbots?.used ?? userBotsCount;
  const liveBotsLimit = isAdmin ? null : (summaryData?.usage?.chatbots?.limit ?? activeTierConfig.maxBots);

  const liveCharsCount = summaryData?.usage?.characters?.used ?? totalCharsCount;
  const liveCharsLimit = isAdmin ? null : (summaryData?.usage?.characters?.limit ?? activeTierConfig.maxCharacters);

  const liveTeamCount = summaryData?.usage?.team_members?.used ?? teamMembersCount;
  const liveTeamLimit = isAdmin ? null : (summaryData?.usage?.team_members?.limit ?? activeTierConfig.teamSeats);

  const liveStorageUsed = summaryData?.usage?.storage_mb?.used ?? 0;
  const liveStorageLimit = isAdmin ? null : (summaryData?.usage?.storage_mb?.limit ?? activeTierConfig.mediaStorageMb);

  const portalUrl = process.env.NEXT_PUBLIC_LEMON_PORTAL_URL || "";

  return (
    <div className="max-w-5xl mx-auto w-full py-6 px-4 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
              Billing &amp; Resource Quotas
            </h2>
            {isAdmin && (
              <span className="px-2 py-0.5 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 text-white text-[10px] font-bold tracking-wider uppercase shadow-xs flex items-center gap-1">
                <Crown className="size-3" /> Super Admin Unlimited
              </span>
            )}
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            Real-time telemetry, active resource usage against plan capacity, and billing management.
          </p>
        </div>

        {isPaidActive && portalUrl && (
          <a
            href={portalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-850 text-xs font-semibold text-neutral-700 dark:text-neutral-300 transition-colors shadow-xs shrink-0"
          >
            <span>Manage Invoices &amp; Cards</span>
            <ExternalLink className="size-3.5" />
          </a>
        )}
      </div>

      {/* ========================================================
          1. ACTIVE PLAN & TRIAL STATUS BANNER (Industrial Standard)
          ======================================================== */}
      {isAdmin ? (
        // Super Admin Unlimited Banner
        <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-neutral-900 via-neutral-950 to-neutral-900 border border-orange-500/30 text-white shadow-md relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
            <Crown className="size-48 text-orange-400" />
          </div>
          <div className="relative z-10 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-md bg-orange-500/20 text-orange-400 border border-orange-500/40 text-[10px] font-mono font-bold uppercase tracking-wider">
                  Self-Host / Platform Operator
                </span>
                <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] font-mono font-bold uppercase">
                  Active • Lifetime Access
                </span>
              </div>
              <span className="text-xs font-mono text-neutral-400">
                Primary Account: <strong>{userEmail}</strong>
              </span>
            </div>

            <div className="space-y-1">
              <h3 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                <span>Enterprise Operator Plan</span>
                <InfinityIcon className="size-5 text-orange-400" />
              </h3>
              <p className="text-xs text-neutral-300/90 max-w-2xl leading-relaxed">
                You are signed in as the SaaS Platform Administrator. All chatbot instance limits, AI token inference credits, RAG training characters, team seats, and trial timeouts are <strong>completely unlimited ($0/mo Operator License)</strong>.
              </p>
            </div>
          </div>
        </div>
      ) : isTrial ? (
        // Free Trial Banner (Accurately Reflecting Selected Plan)
        <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-4">
          {/* Founding 50 Member Callout */}
        <div className="p-4 rounded-2xl border border-amber-200/90 dark:border-amber-800/60 bg-amber-50/80 dark:bg-amber-950/30 text-xs sm:text-sm text-amber-950 dark:text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">🏷️</span>
            <div>
              <span className="font-bold">Founding 50 Lifetime Price Lock:</span> Early customers lock in launch rates for life upon completing a short 20-minute product review after 25 conversations.
            </div>
          </div>
          <a
            href="mailto:support@personaliai.com?subject=Founding%2050%20Review%20Booking"
            className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white transition self-start sm:self-auto shrink-0"
          >
            Claim Price Lock
          </a>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-orange-50 dark:bg-orange-950/60 border border-orange-200 dark:border-orange-800/60 text-[#f97316] text-[10px] font-mono font-bold uppercase tracking-wider">
                  14-Day Free Trial
                </span>
                <span className="text-xs font-mono text-neutral-400">
                  Tier: <strong>{activeTierConfig.label} Plan</strong>
                </span>
              </div>
              <h3 className="text-lg font-bold text-neutral-900 dark:text-white">
                {activeTierConfig.label} Plan Trial ({trialDaysRemaining} {trialDaysRemaining === 1 ? "day" : "days"} remaining)
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                You have full access to all {activeTierConfig.label} features during your trial: <strong>{formatNumber(activeTierConfig.monthlyCredits)} AI credits</strong>, <strong>{formatNumber(activeTierConfig.maxBots)} chatbots</strong>, and <strong>{formatNumber(activeTierConfig.maxCharacters)} characters</strong>.
              </p>
            </div>

            <Link
              href={`/checkout?plan=${activePlanKey.replace("chatty_", "")}&interval=${billingInterval}`}
              className="px-5 py-2.5 rounded-xl bg-[#f97316] hover:bg-[#ea580c] text-white text-xs font-bold transition-all shadow-sm shrink-0 text-center flex items-center justify-center gap-2 cursor-pointer"
            >
              <Zap className="size-3.5 fill-white" />
              <span>Activate Full Subscription</span>
            </Link>
          </div>

          {/* 14-Day Trial Timeline Bar */}
          <div className="space-y-1.5 pt-2 border-t border-neutral-100 dark:border-neutral-800">
            <div className="flex justify-between text-[11px]">
              <span className="text-neutral-500">Day {trialDaysElapsed} of 14</span>
              <span className="font-semibold text-neutral-700 dark:text-neutral-300">
                {trialDaysRemaining > 0 ? `${trialDaysRemaining} days left` : "Trial expired today"}
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-400 transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(7, (trialDaysElapsed / 14) * 100))}%` }}
              />
            </div>
          </div>
        </div>
      ) : (
        // Active Paid Subscription Card
        <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400">
                Active Subscription
              </span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-[10px] font-mono font-bold uppercase">
                Active
              </span>
            </div>
            <h3 className="text-xl font-bold mt-1 text-neutral-900 dark:text-white capitalize">
              {PLAN_LABELS[billingInfo?.plan || ""] || billingInfo?.plan || "Standard Plan"}
            </h3>
            {billingInfo?.renewsAt && (
              <p className="text-xs text-neutral-400 mt-1 flex items-center gap-1.5">
                <Clock className="size-3.5" />
                <span>Next renewal on {new Date(billingInfo.renewsAt).toLocaleDateString()}</span>
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 text-xs font-semibold">
              Billed {billingInterval === "yearly" ? "Annually (Save 20%)" : "Monthly"}
            </span>
          </div>
        </div>
      )}

      {/* ========================================================
          2. REAL-TIME USAGE & QUOTA METERS (Industrial Standard)
          ======================================================== */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
              Live Quotas &amp; Usage
            </h3>
            <p className="text-[11px] text-neutral-500 mt-0.5">
              Current telemetry and consumption for your active billing cycle.
            </p>
          </div>
          {loadingSummary && (
            <span className="text-[10px] text-neutral-400 flex items-center gap-1">
              <RefreshCw className="size-3 animate-spin" /> Syncing...
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Meter 1: AI Credits / Messages */}
          <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase font-semibold text-neutral-400">AI Inference Credits</span>
              <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/30">
                <Sparkles className="size-4" />
              </div>
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-neutral-900 dark:text-white">
                  {liveAiCreditsUsed.toLocaleString()}
                </span>
                {liveAiCreditsLimit ? (
                  <span className="text-xs text-neutral-400 font-mono">
                    / {liveAiCreditsLimit.toLocaleString()}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                    <InfinityIcon className="size-3" /> Unlimited
                  </span>
                )}
              </div>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1">
                {liveAiCreditsLimit
                  ? `${Math.min(100, Math.round((liveAiCreditsUsed / liveAiCreditsLimit) * 100))}% consumed this cycle`
                  : "0 credits consumed · No monthly cap"}
              </p>
            </div>
            {/* Meter Bar */}
            <div className="w-full h-1.5 rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  !liveAiCreditsLimit
                    ? "bg-emerald-500"
                    : (liveAiCreditsUsed / liveAiCreditsLimit) > 0.9
                    ? "bg-rose-500"
                    : (liveAiCreditsUsed / liveAiCreditsLimit) > 0.75
                    ? "bg-amber-500"
                    : "bg-emerald-500"
                }`}
                style={{
                  width: liveAiCreditsLimit
                    ? `${Math.min(100, Math.max(3, (liveAiCreditsUsed / liveAiCreditsLimit) * 100))}%`
                    : "0%",
                }}
              />
            </div>
          </div>

          {/* Meter 2: Active Chatbots */}
          <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase font-semibold text-neutral-400">Active Chatbots</span>
              <div className="p-2 rounded-xl bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400 border border-sky-100 dark:border-sky-800/30">
                <Bot className="size-4" />
              </div>
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-neutral-900 dark:text-white">
                  {liveBotsCount}
                </span>
                {liveBotsLimit ? (
                  <span className="text-xs text-neutral-400 font-mono">
                    / {liveBotsLimit}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 text-[10px] font-bold text-sky-700 dark:text-sky-300">
                    <InfinityIcon className="size-3" /> Unlimited
                  </span>
                )}
              </div>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1">
                {liveBotsLimit
                  ? `${liveBotsCount} of ${liveBotsLimit} assistants in use`
                  : `${liveBotsCount} assistants deployed · Unlimited creation`}
              </p>
            </div>
            {/* Meter Bar */}
            <div className="w-full h-1.5 rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  liveBotsLimit && liveBotsCount >= liveBotsLimit
                    ? "bg-amber-500"
                    : "bg-sky-500"
                }`}
                style={{
                  width: liveBotsLimit
                    ? `${Math.min(100, Math.max(5, (liveBotsCount / liveBotsLimit) * 100))}%`
                    : `${Math.min(100, Math.max(10, liveBotsCount * 12))}%`,
                }}
              />
            </div>
          </div>

          {/* Meter 3: Knowledge Characters */}
          <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase font-semibold text-neutral-400">Training Characters</span>
              <div className="p-2 rounded-xl bg-orange-50 dark:bg-orange-950/50 text-[#f97316] border border-orange-100 dark:border-orange-800/30">
                <Database className="size-4" />
              </div>
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-neutral-900 dark:text-white">
                  {formatNumber(liveCharsCount)}
                </span>
                {liveCharsLimit ? (
                  <span className="text-xs text-neutral-400 font-mono">
                    / {formatNumber(liveCharsLimit)}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-50 dark:bg-orange-950/60 border border-orange-200 dark:border-orange-800 text-[10px] font-bold text-orange-700 dark:text-orange-300">
                    <InfinityIcon className="size-3" /> Unlimited
                  </span>
                )}
              </div>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1">
                {liveCharsLimit
                  ? `${formatNumber(liveCharsCount)} of ${formatNumber(liveCharsLimit)} characters indexed`
                  : `${liveCharsCount.toLocaleString()} indexed characters · Unlimited pgvector storage`}
              </p>
            </div>
            {/* Meter Bar */}
            <div className="w-full h-1.5 rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-400 transition-all duration-500"
                style={{
                  width: liveCharsLimit
                    ? `${Math.min(100, Math.max(4, (liveCharsCount / liveCharsLimit) * 100))}%`
                    : `${Math.min(100, Math.max(8, Math.round((liveCharsCount / 1_000_000) * 20)))}%`,
                }}
              />
            </div>
          </div>

          {/* Meter 4: Team Collaboration */}
          <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase font-semibold text-neutral-400">Team Seats</span>
              <div className="p-2 rounded-xl bg-violet-50 dark:bg-violet-950/50 text-violet-600 dark:text-violet-400 border border-violet-100 dark:border-violet-800/30">
                <Users className="size-4" />
              </div>
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-neutral-900 dark:text-white">
                  {liveTeamCount}
                </span>
                {liveTeamLimit ? (
                  <span className="text-xs text-neutral-400 font-mono">
                    / {liveTeamLimit}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-50 dark:bg-violet-950/60 border border-violet-200 dark:border-violet-800 text-[10px] font-bold text-violet-700 dark:text-violet-300">
                    <InfinityIcon className="size-3" /> Unlimited
                  </span>
                )}
              </div>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1">
                {liveTeamLimit
                  ? `${liveTeamCount} of ${liveTeamLimit} seat occupied`
                  : "0 teammates added · Unlimited team seats"}
              </p>
            </div>
            {/* Meter Bar */}
            <div className="w-full h-1.5 rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-400 transition-all duration-500"
                style={{
                  width: liveTeamLimit
                    ? `${Math.min(100, Math.max(6, (liveTeamCount / liveTeamLimit) * 100))}%`
                    : "0%",
                }}
              />
            </div>
          </div>

          {/* Meter 5: Storage Space */}
          <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase font-semibold text-neutral-400">Storage Usage</span>
              <div className="p-2 rounded-xl bg-cyan-50 dark:bg-cyan-950/50 text-cyan-600 dark:text-cyan-400 border border-cyan-100 dark:border-cyan-800/30">
                <HardDrive className="size-4" />
              </div>
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-neutral-900 dark:text-white">
                  {liveStorageUsed} <span className="text-sm font-normal text-neutral-400">MB</span>
                </span>
                {liveStorageLimit ? (
                  <span className="text-xs text-neutral-400 font-mono">
                    / {liveStorageLimit >= 1024 ? `${liveStorageLimit / 1024} GB` : `${liveStorageLimit} MB`}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-50 dark:bg-cyan-950/60 border border-cyan-200 dark:border-cyan-800 text-[10px] font-bold text-cyan-700 dark:text-cyan-300">
                    <InfinityIcon className="size-3" /> Unlimited
                  </span>
                )}
              </div>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1">
                {liveStorageLimit
                  ? `${Math.min(100, Math.round((liveStorageUsed / liveStorageLimit) * 100))}% capacity consumed`
                  : `${liveStorageUsed} MB stored · Unlimited storage`}
              </p>
            </div>
            {/* Meter Bar */}
            <div className="w-full h-1.5 rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-sky-400 transition-all duration-500"
                style={{
                  width: liveStorageLimit
                    ? `${Math.min(100, Math.max(4, (liveStorageUsed / liveStorageLimit) * 100))}%`
                    : `${Math.min(100, Math.max(5, liveStorageUsed))}%`,
                }}
              />
            </div>
          </div>
        </div>

        {/* Dedicated Storage Management & Retention Purge Panel */}
        {botId && (
          <div className="pt-2">
            <StorageManagementPanel
              botId={botId}
              onStorageUpdated={async () => {
                try {
                  const res = await fetchBackend(supabase, "/api/billing/summary");
                  if (res.ok) {
                    const d = await res.json();
                    setSummaryData(d);
                  }
                } catch {
                  // silent
                }
              }}
            />
          </div>
        )}
      </div>

      {/* ========================================================
          3. FEATURE ENTITLEMENTS MATRIX (Checked with Plan Cards)
          ======================================================== */}
      <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-4">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
            Current Tier Capabilities &amp; Features
          </h3>
          <p className="text-[11px] text-neutral-500 mt-0.5">
            Features currently enabled for your account under the <strong>{activeTierConfig.label}</strong> tier.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
          {activeTierConfig.features.map((feat, idx) => (
            <div
              key={idx}
              className="flex items-start gap-2.5 p-3 rounded-xl bg-neutral-50/70 dark:bg-neutral-950/40 border border-neutral-200/50 dark:border-neutral-800/50 text-xs text-neutral-800 dark:text-neutral-200 font-medium"
            >
              <CheckCircle2 className="size-4 text-emerald-500 shrink-0 mt-0.5" />
              <span>{feat}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ========================================================
          4. PLAN SELECTION & UPGRADE CARDS
          ======================================================== */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
              {isAdmin ? "SaaS Commercial Pricing Tiers" : "Available Subscription Tiers"}
            </h3>
            <p className="text-xs text-neutral-400">
              Select or upgrade your tier to unlock higher conversation limits and enterprise features.
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
            const isCurrentPaid = isPaidActive && activePlanKey === card.key;
            const isCurrentTrial = isTrial && activePlanKey === card.key;
            const price = billingInterval === "yearly" ? card.yearly : card.monthly;

            return (
              <div
                key={card.id}
                className={`rounded-2xl p-4 sm:p-6 flex flex-col justify-between border transition-all ${
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
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-base font-bold text-neutral-900 dark:text-white">{card.label}</h4>
                    {isCurrentTrial && (
                      <span className="px-2 py-0.5 rounded-full bg-orange-50 dark:bg-orange-950/60 border border-orange-200 dark:border-orange-800/60 text-[#f97316] text-[10px] font-mono font-bold uppercase">
                        Current Trial
                      </span>
                    )}
                    {isCurrentPaid && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-[10px] font-mono font-bold uppercase">
                        Active Plan
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-neutral-400 mt-1 min-h-[32px]">
                    {card.blurb}
                  </p>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-3xl font-black text-neutral-900 dark:text-white">${price}</span>
                    <span className="text-xs text-neutral-400">/month</span>
                  </div>
                  {billingInterval === "yearly" && (
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
                      Billed annually (${price * 12}/yr)
                    </p>
                  )}

                  <ul className="mt-6 space-y-2 text-xs text-neutral-600 dark:text-neutral-400">
                    {(PLAN_TIER_CONFIGS[card.key]?.features || []).map((feat, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <CheckCircle2 className="size-3.5 text-[#f97316] shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {isAdmin ? (
                  <span className="mt-6 text-center text-xs font-mono uppercase tracking-wider border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-2.5 text-neutral-400 bg-neutral-50 dark:bg-neutral-950">
                    Included in Operator License
                  </span>
                ) : isCurrentPaid ? (
                  <span className="mt-6 text-center text-xs font-mono uppercase tracking-wider border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 rounded-xl px-3 py-2.5 font-bold">
                    Current Plan
                  </span>
                ) : (
                  <Link
                    href={`/checkout?plan=${card.id}&interval=${billingInterval}`}
                    className={`mt-6 text-center text-xs font-mono uppercase tracking-wider rounded-xl px-3 py-2.5 transition-all ${
                      card.popular
                        ? "bg-[#f97316] hover:bg-[#ea580c] text-white font-bold shadow-xs"
                        : "border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800 font-semibold text-neutral-900 dark:text-white"
                    }`}
                  >
                    {isCurrentTrial ? `Activate ${card.label} Subscription` : `Switch to ${card.label}`}
                  </Link>
                )}
              </div>
            );
          })}
        </div>

        {/* Self-Hosted Open Source */}
        <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/60 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-[10px] font-mono font-bold uppercase">
                Developer Option
              </span>
              <span className="text-xs font-bold text-neutral-900 dark:text-white">
                Self-Host Open Source Stack ($0 Forever)
              </span>
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Run Chatty on your own private infrastructure with Docker, Supabase, and your own LLM API keys with complete code ownership.
            </p>
          </div>
          <a
            href="https://github.com/PersonaliAI/chatty"
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 inline-flex items-center justify-center gap-1.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800 px-4 py-2 text-xs font-semibold text-neutral-900 dark:text-white transition-colors"
          >
            <span>GitHub Repository</span>
            <ExternalLink className="size-3.5" />
          </a>
        </div>
      </div>

      {/* User Account Affiliate & Referral Details */}
      <UserAffiliateSection user={user} />
    </div>
  );
}
