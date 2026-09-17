"use client";

import { useEffect, useState, useId } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  DollarSign,
  Users,
  MousePointerClick,
  CheckCircle2,
  Copy,
  Check,
  ExternalLink,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  Clock,
  Sparkles,
  RefreshCw,
  Share2,
  Settings,
  HelpCircle,
  LogOut,
  ChevronRight,
  Send,
  Lock,
} from "lucide-react";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { fetchBackend } from "@/lib/backend-client";

interface AffiliateProfile {
  id: string;
  referral_code: string;
  referral_url: string;
  display_name: string | null;
  website_url: string | null;
  payout_email: string;
  status: "active" | "pending" | "paused" | "rejected";
  commission_rate_bps: number;
  commission_percentage: number;
  cookie_window_days: number;
  payout_hold_days: number;
  minimum_payout_cents: number;
  created_at: string;
}

interface AffiliateStats {
  clicks_all_time: number;
  clicks_last_30d: number;
  referrals_total: number;
  referrals_paid: number;
  conversion_rate_percent: number;
  pending_cents: number;
  payable_cents: number;
  paid_cents: number;
  lifetime_earnings_cents: number;
  currency: string;
}

interface ReferralRecord {
  id: string;
  status: string;
  referral_code: string;
  created_at: string;
  converted_at: string | null;
  first_seen_at: string | null;
  total_commission_cents: number;
  commissions_count: number;
}

interface PayoutRecord {
  id: string;
  amount_cents: number;
  status: string;
  paid_at: string | null;
  payout_method: string;
  external_payout_id: string | null;
  created_at: string;
}

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function cleanSlug(val: string): string {
  return val
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

const TwitterIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const LinkedInIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
  </svg>
);

const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
  </svg>
);

export function AffiliatePortalClient() {
  const supabase = createClient();

  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAffiliate, setIsAffiliate] = useState(false);
  const [profile, setProfile] = useState<AffiliateProfile | null>(null);
  const [stats, setStats] = useState<AffiliateStats | null>(null);
  const [recentReferrals, setRecentReferrals] = useState<ReferralRecord[]>([]);
  const [recentPayouts, setRecentPayouts] = useState<PayoutRecord[]>([]);

  // Navigation sub-tab inside portal
  const [activeTab, setActiveTab] = useState<"overview" | "referrals" | "payouts" | "settings">("overview");

  // Onboarding form state
  const [codeCandidate, setCodeCandidate] = useState("");
  const [codeChecking, setCodeChecking] = useState(false);
  const [codeValidation, setCodeValidation] = useState<{ available: boolean; reason?: string | null } | null>(null);
  const [payoutEmail, setPayoutEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  // Settings update form state
  const [updatingSettings, setUpdatingSettings] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState(false);

  // Copy feedback
  const [copied, setCopied] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Calculator state for unauthenticated landing view
  const [calcCustomers, setCalcCustomers] = useState(15);
  const [calcPlan, setCalcPlan] = useState<"hobby" | "standard" | "business">("standard");

  const planPrices = {
    hobby: 19,
    standard: 99,
    business: 399,
  };

  const estimatedMonthlyCommission = Math.round(calcCustomers * planPrices[calcPlan] * 0.3);
  const estimatedYearlyCommission = estimatedMonthlyCommission * 12;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    showToast("Referral link copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  // Load user session & affiliate profile
  const loadProfile = async (currentUser: SupabaseUser) => {
    try {
      setLoading(true);
      const res = await fetchBackend(supabase, "/api/affiliate/me");
      if (res.ok) {
        const data = await res.json();
        if (data.is_affiliate && data.profile) {
          setIsAffiliate(true);
          setProfile(data.profile);
          setStats(data.stats);
          setRecentReferrals(data.recent_referrals || []);
          setRecentPayouts(data.recent_payouts || []);
          setPayoutEmail(data.profile.payout_email || currentUser.email || "");
          setDisplayName(data.profile.display_name || "");
          setWebsiteUrl(data.profile.website_url || "");
        } else {
          setIsAffiliate(false);
          // Suggest default code from email or user metadata
          const prefix = currentUser.email?.split("@")[0] || "partner";
          setCodeCandidate(cleanSlug(prefix));
          setPayoutEmail(currentUser.email || "");
        }
      } else {
        setIsAffiliate(false);
      }
    } catch (err) {
      console.error("Failed to load affiliate profile:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user ?? null;
      setUser(u);
      if (u) {
        loadProfile(u);
      } else {
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) {
        loadProfile(u);
      } else {
        setLoading(false);
        setIsAffiliate(false);
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Debounced code availability check
  useEffect(() => {
    if (isAffiliate || !codeCandidate || codeCandidate.length < 3) {
      setCodeValidation(null);
      return;
    }

    const timer = setTimeout(async () => {
      setCodeChecking(true);
      try {
        const res = await fetchBackend(supabase, `/api/affiliate/check-code?code=${encodeURIComponent(codeCandidate)}`);
        if (res.ok) {
          const body = await res.json();
          setCodeValidation(body);
        }
      } catch {
        // silent
      } finally {
        setCodeChecking(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [codeCandidate, isAffiliate]);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreeTerms) {
      setJoinError("You must accept the affiliate partner terms to continue.");
      return;
    }
    if (!payoutEmail) {
      setJoinError("Payout email is required for receiving commissions.");
      return;
    }

    setJoining(true);
    setJoinError(null);

    try {
      const res = await fetchBackend(supabase, "/api/affiliate/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          referral_code: codeCandidate,
          payout_email: payoutEmail,
          display_name: displayName || undefined,
          website_url: websiteUrl || undefined,
        }),
      });

      const body = await res.json();
      if (!res.ok) {
        setJoinError(body.detail || "Failed to activate partner account.");
        setJoining(false);
        return;
      }

      showToast("Welcome to the Chatty Affiliate Program!");
      if (user) {
        await loadProfile(user);
      }
    } catch {
      setJoinError("An unexpected error occurred. Please try again.");
    } finally {
      setJoining(false);
    }
  };

  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdatingSettings(true);
    setSettingsSuccess(false);

    try {
      const res = await fetchBackend(supabase, "/api/affiliate/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payout_email: payoutEmail,
          display_name: displayName,
          website_url: websiteUrl,
        }),
      });

      if (res.ok) {
        setSettingsSuccess(true);
        showToast("Settings updated successfully!");
        if (user) await loadProfile(user);
      }
    } catch {
      showToast("Failed to update settings.");
    } finally {
      setUpdatingSettings(false);
    }
  };

  const shareOnTwitter = () => {
    if (!profile) return;
    const text = encodeURIComponent(
      "Supercharge your website with Chatty AI - modern, open-source AI customer support and lead automation!"
    );
    const url = encodeURIComponent(profile.referral_url);
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, "_blank");
  };

  const shareOnLinkedIn = () => {
    if (!profile) return;
    const url = encodeURIComponent(profile.referral_url);
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${url}`, "_blank");
  };

  const shareOnWhatsApp = () => {
    if (!profile) return;
    const text = encodeURIComponent(
      `Check out Chatty AI customer support: ${profile.referral_url}`
    );
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  // -------------------------------------------------------------------------
  // Render: Loading Screen
  // -------------------------------------------------------------------------
  if (loading) {
    return (
      <div className="min-h-screen bg-[#faf8f5] dark:bg-neutral-950 flex flex-col items-center justify-center p-6 text-neutral-800 dark:text-neutral-200">
        <RefreshCw className="size-8 text-[#f97316] animate-spin mb-4" />
        <p className="text-sm font-medium">Loading partner portal...</p>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Render: Unauthenticated Landing Page
  // -------------------------------------------------------------------------
  if (!user) {
    return (
      <div className="min-h-screen bg-[#faf8f5] dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 flex flex-col font-sans">
        {/* Navigation Bar */}
        <header className="border-b border-neutral-200/80 dark:border-neutral-800/80 bg-white/70 dark:bg-neutral-900/70 backdrop-blur sticky top-0 z-30">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-2">
            <Link href="/" className="flex items-center gap-2 sm:gap-2.5 min-w-0">
              <Image src="/favicon.png" alt="Chatty Logo" width={28} height={28} className="size-6 sm:size-7 object-contain shrink-0" />
              <span className="font-serif text-lg sm:text-xl font-bold tracking-tight">Chatty</span>
              <span className="text-[9px] sm:text-[10px] uppercase font-mono tracking-widest px-1.5 sm:px-2 py-0.5 rounded-full bg-[#f97316]/10 text-[#f97316] font-semibold">
                Partner
              </span>
            </Link>
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              <Link
                href="/login?next=/affiliate"
                className="text-xs font-semibold text-neutral-600 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-white px-2.5 sm:px-3 py-2 transition-colors"
              >
                Sign In
              </Link>
              <Link
                href="/signup?next=/affiliate"
                className="text-xs font-semibold bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-100 px-3.5 sm:px-4 py-2 rounded-full transition-all shadow-sm"
              >
                Join Program
              </Link>
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-16 lg:py-24 grid lg:grid-cols-12 gap-8 lg:gap-12 items-center flex-1">
          <div className="lg:col-span-7 space-y-5 sm:space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#f97316]/10 text-[#ea580c] dark:text-[#f97316] text-xs font-semibold">
              <Sparkles className="size-3.5" />
              Official Chatty Affiliate Program
            </div>

            <h1 className="font-serif text-3xl sm:text-5xl lg:text-6xl font-black leading-[1.1] tracking-tight">
              Earn <span className="text-[#f97316]">30% recurring</span> revenue for every customer you refer.
            </h1>

            <p className="text-base sm:text-lg text-neutral-600 dark:text-neutral-400 leading-relaxed max-w-xl">
              Recommend Chatty to your clients, audience, or community. When they build AI chatbots and automate lead capture, you get paid every single month for up to a full year.
            </p>

            {/* Benefit Bullets */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 pt-2">
              <div className="flex items-start gap-3 p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/60 shadow-xs">
                <DollarSign className="size-5 text-[#ea580c] dark:text-[#f97316] mt-0.5 shrink-0" />
                <div>
                  <h2 className="text-xs font-bold text-neutral-900 dark:text-white">30% Recurring Commission</h2>
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                    Earn month after month for up to 12 months on all plan tiers.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/60 shadow-xs">
                <Clock className="size-5 text-[#ea580c] dark:text-[#f97316] mt-0.5 shrink-0" />
                <div>
                  <h2 className="text-xs font-bold text-neutral-900 dark:text-white">60-Day Cookie Window</h2>
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                    Generous attribution window via cookie and local storage backup.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/60 shadow-xs">
                <ShieldCheck className="size-5 text-[#ea580c] dark:text-[#f97316] mt-0.5 shrink-0" />
                <div>
                  <h2 className="text-xs font-bold text-neutral-900 dark:text-white">Reliable Payouts</h2>
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                    Direct PayPal payouts with transparent commission tracking.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/60 shadow-xs">
                <Users className="size-5 text-[#ea580c] dark:text-[#f97316] mt-0.5 shrink-0" />
                <div>
                  <h2 className="text-xs font-bold text-neutral-900 dark:text-white">Real-Time Analytics</h2>
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                    Live dashboard tracking clicks, conversions, and pending payouts.
                  </p>
                </div>
              </div>
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <Link
                href="/signup?next=/affiliate"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[#f97316] hover:bg-[#ea580c] px-6 sm:px-7 py-3.5 text-sm font-bold text-white shadow-md transition-all hover:scale-[1.01]"
              >
                Apply as Partner
                <ArrowRight className="size-4" />
              </Link>
              <Link
                href="/login?next=/affiliate"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-850 px-5 sm:px-6 py-3.5 text-sm font-semibold text-neutral-800 dark:text-neutral-200 transition-colors"
              >
                Existing Partner Login
              </Link>
            </div>
          </div>

          {/* Earnings Interactive Calculator Card */}
          <div className="lg:col-span-5 w-full">
            <div className="rounded-2xl sm:rounded-3xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5 sm:p-7 shadow-xl space-y-5 sm:space-y-6">
              <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-4">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-widest text-[#ea580c] dark:text-[#f97316] font-bold">
                    Earnings Estimator
                  </span>
                  <h2 className="text-lg font-bold text-neutral-900 dark:text-white mt-0.5">
                    How much can you earn?
                  </h2>
                </div>
                <div className="p-2 rounded-xl bg-[#f97316]/10 text-[#ea580c] dark:text-[#f97316]">
                  <DollarSign className="size-5" />
                </div>
              </div>

              {/* Plan Picker */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-neutral-600 dark:text-neutral-400">
                  Average Customer Plan:
                </label>
                <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                  {(["hobby", "standard", "business"] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setCalcPlan(p)}
                      className={`px-2 sm:px-3 py-2 text-[11px] sm:text-xs font-semibold rounded-xl border transition-all cursor-pointer capitalize text-center ${
                        calcPlan === p
                          ? "border-[#f97316] bg-[#f97316]/10 text-[#ea580c] dark:text-[#f97316] shadow-xs"
                          : "border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:border-neutral-300"
                      }`}
                    >
                      {p} <span className="block sm:inline font-mono">(${planPrices[p]}/mo)</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Slider */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  <span>Referred Paying Customers:</span>
                  <span className="font-mono text-sm text-[#ea580c] dark:text-[#f97316]">{calcCustomers}</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="100"
                  value={calcCustomers}
                  onChange={(e) => setCalcCustomers(parseInt(e.target.value, 10) || 1)}
                  className="w-full accent-[#f97316] cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-neutral-400 font-mono">
                  <span>1 customer</span>
                  <span>50 customers</span>
                  <span>100 customers</span>
                </div>
              </div>

              {/* Computed Reward */}
              <div className="p-3.5 sm:p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-850/60 border border-neutral-100 dark:border-neutral-800 space-y-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-neutral-500 dark:text-neutral-400">Monthly Recurring:</span>
                  <span className="text-xl sm:text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
                    ${estimatedMonthlyCommission.toLocaleString()}
                    <span className="text-xs font-normal text-neutral-400">/mo</span>
                  </span>
                </div>
                <div className="flex items-baseline justify-between border-t border-neutral-200 dark:border-neutral-800 pt-2">
                  <span className="text-xs text-neutral-500 dark:text-neutral-400">Estimated 12-Month Total:</span>
                  <span className="text-sm sm:text-base font-bold font-mono text-neutral-900 dark:text-white">
                    ${estimatedYearlyCommission.toLocaleString()}
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-neutral-400 leading-relaxed text-center">
                Commissions paid monthly via PayPal. 30-day payout hold protects against refunds and chargebacks.
              </p>
            </div>
          </div>
        </section>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Render: Authenticated - Onboarding View (!isAffiliate)
  // -------------------------------------------------------------------------
  if (!isAffiliate) {
    const defaultReferralLink = `https://chatty.personaliai.com?ref=${codeCandidate || "yourcode"}`;

    return (
      <div className="min-h-screen bg-[#faf8f5] dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 flex flex-col font-sans">
        {/* Navigation Bar */}
        <header className="border-b border-neutral-200/80 dark:border-neutral-800/80 bg-white/70 dark:bg-neutral-900/70 backdrop-blur sticky top-0 z-30">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
            <Link href="/dashboard" className="flex items-center gap-2">
              <Image src="/favicon.png" alt="Chatty Logo" width={28} height={28} className="size-6 sm:size-7 object-contain" />
              <span className="font-serif text-base sm:text-lg font-bold">Chatty Partner</span>
            </Link>
            <Link
              href="/dashboard"
              className="text-xs font-medium text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors"
            >
              Back to Dashboard
            </Link>
          </div>
        </header>

        {/* Onboarding Container */}
        <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12 w-full flex-1">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl sm:rounded-3xl p-5 sm:p-8 sm:p-10 shadow-lg space-y-6 sm:space-y-8">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#ea580c] dark:text-[#f97316] font-bold">
                Step 1 of 1 &middot; Quick Setup
              </span>
              <h1 className="text-xl sm:text-3xl font-bold tracking-tight text-neutral-900 dark:text-white mt-1">
                Activate Your Affiliate Partner Account
              </h1>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-2 leading-relaxed">
                Choose a personalized referral code and enter your payout email to start earning 30% recurring commissions.
              </p>
            </div>

            {joinError && (
              <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 flex items-center gap-2.5 text-xs text-red-700 dark:text-red-400">
                <AlertCircle className="size-4 shrink-0" />
                <span>{joinError}</span>
              </div>
            )}

            <form onSubmit={handleJoin} className="space-y-6">
              {/* Referral Code Field */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                  Custom Referral Code <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={codeCandidate}
                    onChange={(e) => setCodeCandidate(cleanSlug(e.target.value))}
                    placeholder="e.g. yourname, agency, marketingai"
                    required
                    className="w-full px-4 py-2.5 text-sm rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950 focus:border-[#f97316] focus:outline-none font-mono text-neutral-900 dark:text-white"
                  />
                  <div className="absolute right-3 top-2.5 flex items-center gap-1.5">
                    {codeChecking && <RefreshCw className="size-4 text-neutral-400 animate-spin" />}
                    {!codeChecking && codeValidation && (
                      codeValidation.available ? (
                        <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                          <Check className="size-3.5" /> Available
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[11px] font-semibold text-red-500">
                          <AlertCircle className="size-3.5" /> {codeValidation.reason || "Taken"}
                        </span>
                      )
                    )}
                  </div>
                </div>
                <p className="text-[11px] text-neutral-400">
                  Lowercase letters, numbers, and hyphens only (3-80 chars). This code will appear in your referral link.
                </p>
              </div>

              {/* Live Link Preview */}
              <div className="p-3.5 rounded-xl bg-[#f97316]/5 dark:bg-[#f97316]/10 border border-[#f97316]/20">
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#ea580c] dark:text-[#f97316] font-bold block mb-1">
                  Your Public Partner Link:
                </span>
                <span className="font-mono text-xs text-neutral-800 dark:text-neutral-200 break-all select-all font-semibold">
                  {defaultReferralLink}
                </span>
              </div>

              {/* Payout Email */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                  PayPal / Payout Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={payoutEmail}
                  onChange={(e) => setPayoutEmail(e.target.value)}
                  placeholder="payouts@yourdomain.com"
                  required
                  className="w-full px-4 py-2.5 text-sm rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950 focus:border-[#f97316] focus:outline-none text-neutral-900 dark:text-white"
                />
                <p className="text-[11px] text-neutral-400">
                  Commissions are remitted to this PayPal address once your payable balance reaches the $50 minimum threshold.
                </p>
              </div>

              {/* Display Name (Optional) */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                  Display / Agency Name <span className="text-neutral-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Acme Media or Jane Doe"
                  className="w-full px-4 py-2.5 text-sm rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950 focus:border-[#f97316] focus:outline-none text-neutral-900 dark:text-white"
                />
              </div>

              {/* Website URL (Optional) */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                  Website or Social Profile <span className="text-neutral-400 font-normal">(optional)</span>
                </label>
                <input
                  type="url"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  placeholder="https://yourwebsite.com or https://x.com/username"
                  className="w-full px-4 py-2.5 text-sm rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950 focus:border-[#f97316] focus:outline-none text-neutral-900 dark:text-white"
                />
              </div>

              {/* Terms Checkbox */}
              <div className="pt-2">
                <label className="flex items-start gap-3 text-xs text-neutral-600 dark:text-neutral-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreeTerms}
                    onChange={(e) => setAgreeTerms(e.target.checked)}
                    className="mt-0.5 size-4 rounded accent-[#f97316]"
                  />
                  <span>
                    I agree to the <strong>Chatty Affiliate Partner Terms</strong>: 30% recurring commission for up to 12 months, 60-day cookie window, 30-day refund hold, and strict prohibition on self-referrals and search ads bidding on Chatty brand terms.
                  </span>
                </label>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={joining || (codeValidation ? !codeValidation.available : false)}
                className="w-full py-3 px-6 rounded-full bg-[#f97316] hover:bg-[#ea580c] disabled:opacity-50 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {joining ? (
                  <>
                    <RefreshCw className="size-4 animate-spin" /> Activating...
                  </>
                ) : (
                  <>
                    Activate Partner Account <ArrowRight className="size-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        </main>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Render: Authenticated - Full Partner Dashboard (isAffiliate)
  // -------------------------------------------------------------------------
  const referralLink = profile?.referral_url || `https://chatty.personaliai.com?ref=${profile?.referral_code}`;

  return (
    <div className="min-h-screen bg-[#faf8f5] dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 flex flex-col font-sans">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 px-4 py-2.5 rounded-xl shadow-xl text-xs font-semibold flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 className="size-4 text-emerald-400 dark:text-emerald-600" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Bar */}
      <header className="border-b border-neutral-200/80 dark:border-neutral-800/80 bg-white/80 dark:bg-neutral-900/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Link href="/dashboard" className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <Image src="/favicon.png" alt="Chatty Logo" width={28} height={28} className="size-6 sm:size-7 object-contain shrink-0" />
              <span className="font-serif text-base sm:text-lg font-bold tracking-tight">Chatty</span>
            </Link>
            <span className="text-neutral-300 dark:text-neutral-700">/</span>
            <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-[#ea580c] dark:text-[#f97316] truncate">
              Partner Dashboard
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded-full border border-neutral-200 dark:border-neutral-800 text-[11px] font-mono text-neutral-600 dark:text-neutral-400">
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              Status: <span className="font-bold capitalize text-neutral-900 dark:text-white">{profile?.status || "active"}</span>
            </div>
            <Link
              href="/dashboard"
              className="text-xs font-semibold text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white px-2.5 sm:px-3 py-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              Console
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 w-full flex-1 space-y-6 sm:space-y-8">
        {/* Partner Link Banner */}
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-sm flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5 lg:gap-6">
          <div className="space-y-2 flex-1 w-full min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#ea580c] dark:text-[#f97316] font-bold">
                Your Unique Partner Referral Link
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 font-semibold">
                30% Recurring Active
              </span>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1 w-full min-w-0">
              <div className="flex-1 min-w-0 bg-neutral-100 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-2 flex items-center overflow-hidden">
                <code className="text-xs sm:text-sm font-mono text-neutral-900 dark:text-neutral-100 font-semibold truncate select-all w-full">
                  {referralLink}
                </code>
              </div>
              <button
                type="button"
                onClick={() => copyToClipboard(referralLink)}
                className="w-full sm:w-auto px-4 py-2.5 sm:py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-100 text-xs font-bold transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer shadow-xs"
              >
                {copied ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
                {copied ? "Copied" : "Copy Link"}
              </button>
            </div>
          </div>

          {/* Social Share Shortcuts */}
          <div className="w-full lg:w-auto flex flex-wrap sm:flex-nowrap items-center gap-2 shrink-0 border-t lg:border-t-0 lg:border-l border-neutral-100 dark:border-neutral-800 pt-4 lg:pt-0 lg:pl-6">
            <span className="text-xs font-semibold text-neutral-500 mr-1 hidden xl:inline">Share:</span>
            <button
              type="button"
              onClick={shareOnTwitter}
              className="flex-1 sm:flex-none justify-center px-3 py-2 sm:py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-850 text-xs font-medium text-neutral-700 dark:text-neutral-300 transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Share on X / Twitter"
            >
              <TwitterIcon className="size-3.5 text-neutral-900 dark:text-white" />
              X / Twitter
            </button>
            <button
              type="button"
              onClick={shareOnLinkedIn}
              className="flex-1 sm:flex-none justify-center px-3 py-2 sm:py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-850 text-xs font-medium text-neutral-700 dark:text-neutral-300 transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Share on LinkedIn"
            >
              <LinkedInIcon className="size-3.5 text-[#0077b5]" />
              LinkedIn
            </button>
            <button
              type="button"
              onClick={shareOnWhatsApp}
              className="flex-1 sm:flex-none justify-center px-3 py-2 sm:py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-850 text-xs font-medium text-neutral-700 dark:text-neutral-300 transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Share on WhatsApp"
            >
              <WhatsAppIcon className="size-3.5 text-[#25D366]" />
              WhatsApp
            </button>
          </div>
        </div>

        {/* 6-Metric KPI Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-4">
          {/* Clicks */}
          <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs space-y-1 min-w-0">
            <div className="flex items-center justify-between text-neutral-400">
              <span className="text-[10px] font-mono uppercase tracking-wider">Clicks</span>
              <MousePointerClick className="size-3.5" />
            </div>
            <p className="text-lg sm:text-xl font-black font-mono text-neutral-900 dark:text-white truncate">
              {stats?.clicks_all_time ?? 0}
            </p>
            <p className="text-[10px] text-neutral-500 truncate">
              {stats?.clicks_last_30d ?? 0} in last 30d
            </p>
          </div>

          {/* Referrals */}
          <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs space-y-1 min-w-0">
            <div className="flex items-center justify-between text-neutral-400">
              <span className="text-[10px] font-mono uppercase tracking-wider">Signups</span>
              <Users className="size-3.5" />
            </div>
            <p className="text-lg sm:text-xl font-black font-mono text-neutral-900 dark:text-white truncate">
              {stats?.referrals_total ?? 0}
            </p>
            <p className="text-[10px] text-neutral-500 truncate">Accounts created</p>
          </div>

          {/* Conversions / Paying */}
          <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs space-y-1 min-w-0">
            <div className="flex items-center justify-between text-neutral-400">
              <span className="text-[10px] font-mono uppercase tracking-wider">Paying</span>
              <CheckCircle2 className="size-3.5 text-emerald-500" />
            </div>
            <p className="text-lg sm:text-xl font-black font-mono text-emerald-600 dark:text-emerald-400 truncate">
              {stats?.referrals_paid ?? 0}
            </p>
            <p className="text-[10px] text-neutral-500 truncate">
              {stats?.conversion_rate_percent ?? 0}% conversion
            </p>
          </div>

          {/* Pending Hold */}
          <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs space-y-1 min-w-0">
            <div className="flex items-center justify-between text-neutral-400">
              <span className="text-[10px] font-mono uppercase tracking-wider">Pending Hold</span>
              <Clock className="size-3.5 text-amber-500" />
            </div>
            <p className="text-lg sm:text-xl font-black font-mono text-amber-600 dark:text-amber-400 truncate">
              {formatCents(stats?.pending_cents ?? 0)}
            </p>
            <p className="text-[10px] text-neutral-500 truncate">30d refund hold</p>
          </div>

          {/* Payable Balance */}
          <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-white dark:bg-neutral-900 border border-[#f97316]/30 dark:border-[#f97316]/30 shadow-xs space-y-1 relative overflow-hidden min-w-0">
            <div className="flex items-center justify-between text-[#ea580c] dark:text-[#f97316]">
              <span className="text-[10px] font-mono uppercase tracking-wider font-bold">Payable</span>
              <DollarSign className="size-3.5" />
            </div>
            <p className="text-lg sm:text-xl font-black font-mono text-[#ea580c] dark:text-[#f97316] truncate">
              {formatCents(stats?.payable_cents ?? 0)}
            </p>
            <p className="text-[10px] text-neutral-500 truncate">Next payout cycle</p>
          </div>

          {/* Lifetime Earned */}
          <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs space-y-1 min-w-0">
            <div className="flex items-center justify-between text-neutral-400">
              <span className="text-[10px] font-mono uppercase tracking-wider">Total Earned</span>
              <Sparkles className="size-3.5 text-purple-500" />
            </div>
            <p className="text-lg sm:text-xl font-black font-mono text-neutral-900 dark:text-white truncate">
              {formatCents(stats?.lifetime_earnings_cents ?? 0)}
            </p>
            <p className="text-[10px] text-neutral-500 truncate">
              Paid: {formatCents(stats?.paid_cents ?? 0)}
            </p>
          </div>
        </div>

        {/* Portal Tabs Bar */}
        <div className="border-b border-neutral-200 dark:border-neutral-800 flex items-center gap-4 sm:gap-6 text-xs font-semibold overflow-x-auto no-scrollbar scrollbar-none pb-px -mx-4 px-4 sm:mx-0 sm:px-0">
          <button
            type="button"
            onClick={() => setActiveTab("overview")}
            className={`pb-3 border-b-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              activeTab === "overview"
                ? "border-[#f97316] text-[#ea580c] dark:text-[#f97316]"
                : "border-transparent text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
            }`}
          >
            Overview &amp; Assets
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("referrals")}
            className={`pb-3 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              activeTab === "referrals"
                ? "border-[#f97316] text-[#ea580c] dark:text-[#f97316]"
                : "border-transparent text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
            }`}
          >
            Referrals History
            {recentReferrals.length > 0 && (
              <span className="size-5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-[10px] font-mono flex items-center justify-center">
                {recentReferrals.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("payouts")}
            className={`pb-3 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              activeTab === "payouts"
                ? "border-[#f97316] text-[#ea580c] dark:text-[#f97316]"
                : "border-transparent text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
            }`}
          >
            Payouts &amp; Ledger
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("settings")}
            className={`pb-3 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              activeTab === "settings"
                ? "border-[#f97316] text-[#ea580c] dark:text-[#f97316]"
                : "border-transparent text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
            }`}
          >
            <Settings className="size-3.5" />
            Payout Settings
          </button>
        </div>

        {/* Tab 1: Overview & Promotional Assets */}
        {activeTab === "overview" && (
          <div className="grid md:grid-cols-2 gap-6">
            {/* Promo Snippets */}
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl sm:rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
              <h2 className="text-sm font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                <Share2 className="size-4 text-[#f97316]" />
                Ready-to-Use Copy &amp; Snippets
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Copy and paste these pre-formatted snippets into your blog posts, newsletter, or social channels.
              </p>

              {/* Snippet 1 */}
              <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 space-y-2">
                <div className="flex justify-between items-center text-[11px] font-semibold text-neutral-700 dark:text-neutral-300">
                  <span>Short Social Post</span>
                  <button
                    type="button"
                    onClick={() =>
                      copyToClipboard(
                        `We use Chatty to automate customer support and capture leads on our site. Highly recommend checking it out: ${referralLink}`
                      )
                    }
                    className="text-[10px] text-[#ea580c] dark:text-[#f97316] hover:underline font-mono cursor-pointer"
                  >
                    Copy
                  </button>
                </div>
                <p className="text-xs text-neutral-600 dark:text-neutral-400 italic break-words">
                  &ldquo;We use Chatty to automate customer support and capture leads on our site. Highly recommend checking it out: <span className="break-all">{referralLink}</span>&rdquo;
                </p>
              </div>

              {/* Snippet 2 */}
              <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 space-y-2">
                <div className="flex justify-between items-center text-[11px] font-semibold text-neutral-700 dark:text-neutral-300">
                  <span>Markdown Link Badge</span>
                  <button
                    type="button"
                    onClick={() =>
                      copyToClipboard(`[Powered by Chatty AI](${referralLink})`)
                    }
                    className="text-[10px] text-[#ea580c] dark:text-[#f97316] hover:underline font-mono cursor-pointer"
                  >
                    Copy
                  </button>
                </div>
                <code className="text-xs font-mono text-neutral-700 dark:text-neutral-300 block break-all">
                  [Powered by Chatty AI]({referralLink})
                </code>
              </div>
            </div>

            {/* Program Rules & FAQ */}
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl sm:rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
              <h2 className="text-sm font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                <ShieldCheck className="size-4 text-emerald-500" />
                Affiliate Guidelines &amp; Policies
              </h2>

              <ul className="space-y-2.5 text-xs text-neutral-600 dark:text-neutral-400">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="size-4 text-emerald-500 mt-0.5 shrink-0" />
                  <span>
                    <strong>30% Recurring Commission:</strong> You earn 30% of customer payments for up to 12 consecutive months per referred account.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="size-4 text-emerald-500 mt-0.5 shrink-0" />
                  <span>
                    <strong>60-Day Cookie:</strong> If a visitor signs up within 60 days of clicking your link, you are credited with the referral.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="size-4 text-emerald-500 mt-0.5 shrink-0" />
                  <span>
                    <strong>30-Day Refund Hold:</strong> New commissions mature to &quot;Payable&quot; after 30 days to protect against customer refund requests.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <AlertCircle className="size-4 text-amber-500 mt-0.5 shrink-0" />
                  <span>
                    <strong>Anti-Self-Referral:</strong> You cannot refer yourself or use your own link to purchase subscriptions for your own accounts.
                  </span>
                </li>
              </ul>
            </div>
          </div>
        )}

        {/* Tab 2: Referrals History */}
        {activeTab === "referrals" && (
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl sm:rounded-2xl overflow-hidden shadow-xs">
            <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-neutral-200 dark:border-neutral-800 flex justify-between items-center">
              <h2 className="text-sm font-bold text-neutral-900 dark:text-white">
                Referred Conversions &amp; Accounts
              </h2>
              <span className="text-xs text-neutral-400 font-mono">
                Total: {recentReferrals.length}
              </span>
            </div>

            {recentReferrals.length === 0 ? (
              <div className="py-12 px-4 sm:px-6 text-center space-y-2">
                <Users className="size-8 text-neutral-300 dark:text-neutral-700 mx-auto" />
                <p className="text-xs font-semibold text-neutral-600 dark:text-neutral-400">
                  No referrals tracked yet
                </p>
                <p className="text-[11px] text-neutral-400 max-w-sm mx-auto">
                  Share your link with colleagues, clients, or on social media to see your first referred users appear here.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[560px]">
                  <thead className="bg-neutral-50 dark:bg-neutral-950 text-neutral-500 uppercase font-mono text-[10px] border-b border-neutral-200 dark:border-neutral-800">
                    <tr>
                      <th className="py-3 px-3 sm:px-6">Referral ID</th>
                      <th className="py-3 px-3 sm:px-6">Status</th>
                      <th className="py-3 px-3 sm:px-6">First Seen</th>
                      <th className="py-3 px-3 sm:px-6">Converted At</th>
                      <th className="py-3 px-3 sm:px-6 text-right">Commission</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800 text-neutral-700 dark:text-neutral-300">
                    {recentReferrals.map((ref) => (
                      <tr key={ref.id} className="hover:bg-neutral-50/60 dark:hover:bg-neutral-850/40 transition-colors">
                        <td className="py-3.5 px-3 sm:px-6 font-mono font-medium">
                          {ref.id.slice(0, 8)}...
                        </td>
                        <td className="py-3.5 px-3 sm:px-6">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-mono uppercase font-bold ${
                              ref.status === "paid"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400"
                                : ref.status === "trial"
                                ? "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-400"
                                : ref.status === "refunded"
                                ? "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-400"
                                : "bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-300"
                            }`}
                          >
                            {ref.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 sm:px-6 text-neutral-500 font-mono">
                          {ref.first_seen_at ? new Date(ref.first_seen_at).toLocaleDateString() : new Date(ref.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-3.5 px-3 sm:px-6 text-neutral-500 font-mono">
                          {ref.converted_at ? new Date(ref.converted_at).toLocaleDateString() : "-"}
                        </td>
                        <td className="py-3.5 px-3 sm:px-6 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {formatCents(ref.total_commission_cents || 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Payouts & Ledger */}
        {activeTab === "payouts" && (
          <div className="space-y-6">
            {/* Payout Progress Bar */}
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-xs space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-neutral-900 dark:text-white">
                  Minimum Payout Threshold Progress
                </span>
                <span className="font-mono text-neutral-500">
                  {formatCents(stats?.payable_cents ?? 0)} / {formatCents(profile?.minimum_payout_cents ?? 5000)}
                </span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
                <div
                  className="h-full bg-[#f97316] transition-all rounded-full"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.round(((stats?.payable_cents ?? 0) / (profile?.minimum_payout_cents ?? 5000)) * 100)
                    )}%`,
                  }}
                />
              </div>
              <p className="text-[11px] text-neutral-400">
                Payouts are batched and disbursed automatically at the end of each monthly cycle for all partners who have reached the $50 minimum threshold.
              </p>
            </div>

            {/* Payouts Table */}
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl sm:rounded-2xl overflow-hidden shadow-xs">
              <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-neutral-200 dark:border-neutral-800 flex justify-between items-center">
                <h2 className="text-sm font-bold text-neutral-900 dark:text-white">Disbursement Ledger</h2>
                <span className="text-xs text-neutral-400 font-mono">
                  {recentPayouts.length} disbursements
                </span>
              </div>

              {recentPayouts.length === 0 ? (
                <div className="py-12 px-4 sm:px-6 text-center space-y-2">
                  <DollarSign className="size-8 text-neutral-300 dark:text-neutral-700 mx-auto" />
                  <p className="text-xs font-semibold text-neutral-600 dark:text-neutral-400">
                    No payouts processed yet
                  </p>
                  <p className="text-[11px] text-neutral-400 max-w-sm mx-auto">
                    Once your commissions mature and exceed the $50 threshold, your remittances will appear in this ledger.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs min-w-[560px]">
                    <thead className="bg-neutral-50 dark:bg-neutral-950 text-neutral-500 uppercase font-mono text-[10px] border-b border-neutral-200 dark:border-neutral-800">
                      <tr>
                        <th className="py-3 px-3 sm:px-6">Date</th>
                        <th className="py-3 px-3 sm:px-6">Method</th>
                        <th className="py-3 px-3 sm:px-6">Transaction ID</th>
                        <th className="py-3 px-3 sm:px-6">Status</th>
                        <th className="py-3 px-3 sm:px-6 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800 text-neutral-700 dark:text-neutral-300">
                      {recentPayouts.map((p) => (
                        <tr key={p.id}>
                          <td className="py-3 px-3 sm:px-6 font-mono text-neutral-500">
                            {p.paid_at ? new Date(p.paid_at).toLocaleDateString() : new Date(p.created_at).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-3 sm:px-6 font-medium capitalize">
                            {p.payout_method}
                          </td>
                          <td className="py-3 px-3 sm:px-6 font-mono text-neutral-400">
                            {p.external_payout_id || "-"}
                          </td>
                          <td className="py-3 px-3 sm:px-6">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400 font-bold">
                              {p.status}
                            </span>
                          </td>
                          <td className="py-3 px-3 sm:px-6 text-right font-mono font-bold text-neutral-900 dark:text-white">
                            {formatCents(p.amount_cents)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 4: Payout Settings */}
        {activeTab === "settings" && (
          <div className="max-w-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl sm:rounded-2xl p-5 sm:p-8 shadow-xs space-y-6">
            <div>
              <h2 className="text-base font-bold text-neutral-900 dark:text-white">
                Affiliate Profile &amp; Payout Settings
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                Keep your payout details accurate to ensure uninterrupted commission transfers.
              </p>
            </div>

            <form onSubmit={handleUpdateSettings} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  PayPal / Payout Email Address
                </label>
                <input
                  type="email"
                  value={payoutEmail}
                  onChange={(e) => setPayoutEmail(e.target.value)}
                  required
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950 text-neutral-900 dark:text-white focus:outline-none focus:border-[#f97316]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  Public Partner Display Name
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Media Agency or Creator Name"
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950 text-neutral-900 dark:text-white focus:outline-none focus:border-[#f97316]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  Website or Profile Link
                </label>
                <input
                  type="url"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  placeholder="https://yourbrand.com"
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950 text-neutral-900 dark:text-white focus:outline-none focus:border-[#f97316]"
                />
              </div>

              <div className="pt-2 flex items-center justify-between">
                <button
                  type="submit"
                  disabled={updatingSettings}
                  className="px-5 py-2.5 rounded-full bg-[#f97316] hover:bg-[#ea580c] text-white text-xs font-bold transition-all disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  {updatingSettings ? "Saving..." : "Save Payout Settings"}
                </button>
                {settingsSuccess && (
                  <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                    <Check className="size-3.5" /> Saved!
                  </span>
                )}
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
