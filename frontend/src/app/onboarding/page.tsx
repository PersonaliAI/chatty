"use client";

import React, { Suspense, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Sparkles,
  Building2,
  Users,
  Briefcase,
  Globe,
  ArrowRight,
  CheckCircle2,
  Loader2,
  ShieldCheck,
  Check,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { SELF_HOST_MODE } from "@/lib/deployment";
import { ModernDropdown, DropdownOption } from "@/components/auth/modern-dropdown";
import {
  GoogleSearchIcon,
  XTwitterIcon,
  LinkedInIcon,
  YouTubeIcon,
  RedditIcon,
  InstagramTikTokIcon,
  ProductHuntIcon,
  WordOfMouthIcon,
  OtherSourceIcon,
} from "@/components/auth/referral-source-icons";

const COMPANY_SIZES: DropdownOption[] = [
  { value: "1", label: "1 (Just me)", description: "Solo founder or individual consultant" },
  { value: "2-10", label: "2–10 employees", description: "Early-stage startup or small studio" },
  { value: "11-50", label: "11–50 employees", description: "Rapidly scaling business or agency" },
  { value: "51-200", label: "51–200 employees", description: "Established mid-size company" },
  { value: "201-1000", label: "201–1,000 employees", description: "Enterprise organization" },
  { value: "1000+", label: "1,000+ employees", description: "Large global enterprise" },
];

const ROLES: DropdownOption[] = [
  { value: "founder", label: "Founder / Executive / CEO", description: "Executive leadership & strategy" },
  { value: "engineering", label: "Engineering / Product Manager", description: "Technical implementation & design" },
  { value: "support", label: "Customer Support / Operations", description: "Customer care & service delivery" },
  { value: "marketing", label: "Marketing / Growth / Content", description: "User acquisition & lead generation" },
  { value: "sales", label: "Sales / Business Development", description: "Closing deals & client outreach" },
  { value: "consultant", label: "Consultant / Agency Partner", description: "Building AI agents for clients" },
  { value: "other", label: "Other / General", description: "Exploring AI agent capabilities" },
];

const REFERRAL_SOURCES = [
  { id: "google", name: "Google Search", icon: <GoogleSearchIcon className="size-4.5" /> },
  { id: "twitter", name: "X / Twitter", icon: <XTwitterIcon className="size-4.5" /> },
  { id: "linkedin", name: "LinkedIn", icon: <LinkedInIcon className="size-4.5" /> },
  { id: "youtube", name: "YouTube", icon: <YouTubeIcon className="size-4.5" /> },
  { id: "reddit", name: "Reddit", icon: <RedditIcon className="size-4.5" /> },
  { id: "social", name: "Instagram / TikTok", icon: <InstagramTikTokIcon className="size-4.5" /> },
  { id: "product_hunt", name: "Product Hunt", icon: <ProductHuntIcon className="size-4.5" /> },
  { id: "friend", name: "Colleague / Word of mouth", icon: <WordOfMouthIcon className="size-4.5" /> },
  { id: "other", name: "Other source", icon: <OtherSourceIcon className="size-4.5" /> },
];

interface PlanTier {
  id: "chatty_hobby" | "chatty_standard" | "chatty_business";
  name: string;
  badge?: string;
  monthlyPrice: number;
  description: string;
  features: string[];
}

const PLANS: PlanTier[] = [
  {
    id: "chatty_hobby",
    name: "Hobby",
    monthlyPrice: 19,
    description: "Perfect for individuals, developers, and side projects.",
    features: [
      "3 Live AI Agents",
      "1,000 weighted AI credits / mo (≈ ~800 chats)",
      "10M training characters",
      "500 MB Media Storage (250 products)",
      "AI Actions, Analytics & Lead capture",
    ],
  },
  {
    id: "chatty_standard",
    name: "Standard",
    badge: "Most Popular",
    monthlyPrice: 99,
    description: "All in Hobby, plus advanced automation and multi-bot systems.",
    features: [
      "6 Live AI Agents",
      "10,000 weighted AI credits / mo (≈ ~8,000 chats)",
      "20M training characters",
      "2 GB Media Storage (1,500 products)",
      "Daily Auto Train & Remove branding",
      "Unlimited team inbox members",
    ],
  },
  {
    id: "chatty_business",
    name: "Business",
    badge: "Enterprise Grade",
    monthlyPrice: 399,
    description: "For enterprise scale, heavy traffic, and reseller options.",
    features: [
      "Unlimited AI Agents (fair-use limits)",
      "40,000 weighted AI credits / mo (≈ ~35,000 chats)",
      "50M training characters",
      "10 GB Media Storage (Unlimited products)",
      "White-label configuration & BYOK option",
      "Management Admin API",
    ],
  },
];

export default function OnboardingPage() {
  return (
    <Suspense fallback={null}>
      <OnboardingPageInner />
    </Suspense>
  );
}

function OnboardingPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/dashboard";

  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const rawPlanParam = (searchParams.get("plan") || "").toLowerCase();
  const initialPlan: "chatty_hobby" | "chatty_standard" | "chatty_business" =
    rawPlanParam === "hobby" || rawPlanParam === "chatty_hobby"
      ? "chatty_hobby"
      : rawPlanParam === "business" || rawPlanParam === "chatty_business"
      ? "chatty_business"
      : "chatty_standard";
  const [selectedPlan, setSelectedPlan] = useState<"chatty_hobby" | "chatty_standard" | "chatty_business">(initialPlan);
  const [companyName, setCompanyName] = useState("");
  const [companySize, setCompanySize] = useState("2-10");
  const [companyRole, setCompanyRole] = useState("founder");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [referralSource, setReferralSource] = useState("google");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(true);

  // Self-host mode check
  useEffect(() => {
    if (SELF_HOST_MODE) {
      router.replace(next);
      return;
    }

    async function checkAuth() {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        // Not logged in, route back to signup
        router.replace(`/signup?next=${encodeURIComponent(next)}`);
        return;
      }

      // Check if already completed registration onboarding
      const user = session.user;
      if (user?.user_metadata?.onboarding_completed || user?.user_metadata?.registration_onboarded) {
        router.replace(next);
        return;
      }

      // Pre-fill from metadata if existing
      if (user?.user_metadata?.plan_preference) {
        setSelectedPlan(user.user_metadata.plan_preference);
      }
      if (user?.user_metadata?.company_name) {
        setCompanyName(user.user_metadata.company_name);
      }
      setInitialLoading(false);
    }

    checkAuth();
  }, [next, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!termsAccepted) {
      setError("Please accept the Terms of Service and Privacy Policy to continue.");
      return;
    }
    if (!companyName.trim()) {
      setError("Please enter your company or workspace name.");
      setStep(1);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || "";

      // Send to backend API
      const backendUrl = process.env.NEXT_PUBLIC_API_URL || "https://api.chatty.personaliai.com";
      const res = await fetch(`${backendUrl}/api/user/onboarding`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          plan_preference: selectedPlan,
          company_name: companyName.trim(),
          company_size: companySize,
          company_role: companyRole,
          website_url: websiteUrl.trim(),
          referral_source: referralSource,
          terms_accepted: true,
          marketing_opt_in: marketingOptIn,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || "Failed to save onboarding details.");
      }

      // Also persist to Supabase auth client metadata so immediate redirects read updated state
      await supabase.auth.updateUser({
        data: {
          onboarding_completed: true,
          registration_onboarded: true,
          plan_preference: selectedPlan,
          company_name: companyName.trim(),
          company_size: companySize,
          company_role: companyRole,
          website_url: websiteUrl.trim(),
          referral_source: referralSource,
          trial_started_at: new Date().toISOString(),
        },
      });

      // Seamless redirect to dashboard
      window.location.href = next;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An unexpected error occurred.";
      setError(msg);
      setLoading(false);
    }
  }

  if (SELF_HOST_MODE || initialLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-950">
        <Loader2 className="size-6 text-neutral-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col justify-between bg-neutral-50/60 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 transition-colors">
      {/* Top Navbar */}
      <header className="w-full border-b border-neutral-200/80 dark:border-neutral-800/80 bg-white/70 dark:bg-neutral-900/70 backdrop-blur-md px-4 sm:px-8 py-4 flex items-center justify-between shrink-0">
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/logo.png"
            alt="PersonaliAI Chatty"
            width={120}
            height={24}
            className="h-6 w-auto"
            priority
          />
        </Link>
        <div className="flex items-center gap-2 text-xs font-medium text-neutral-500 dark:text-neutral-400">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 font-semibold border border-emerald-200 dark:border-emerald-800">
            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
            14-Day Free Trial
          </span>
          <span className="hidden sm:inline">• No credit card required</span>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-8 sm:py-12 flex flex-col justify-center">
        {/* Progress Tracker */}
        <div className="max-w-md mx-auto w-full mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-neutral-600 dark:text-neutral-300">
              {step === 1 ? "Step 1 of 2: Plan & Workspace" : "Step 2 of 2: Referral & Terms"}
            </span>
            <span className="text-[11px] font-mono text-neutral-400">
              {step === 1 ? "50%" : "100%"}
            </span>
          </div>
          <div className="w-full h-1.5 bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-neutral-950 dark:bg-white transition-all duration-300 rounded-full"
              style={{ width: step === 1 ? "50%" : "100%" }}
            />
          </div>
        </div>

        {/* Content Box */}
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200/90 dark:border-neutral-800 rounded-2xl sm:rounded-3xl shadow-xl shadow-neutral-950/5 dark:shadow-black/20 p-6 sm:p-10">
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-xs sm:text-sm font-medium flex items-start gap-2.5">
              <span className="shrink-0 mt-0.5 font-bold">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-8 animate-in fade-in-50 duration-200">
              {/* Heading */}
              <div>
                <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-2">
                  <Sparkles className="size-3.5 text-orange-500" />
                  Free Trial Customization
                </span>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-950 dark:text-white">
                  Choose your 14-day free trial plan
                </h1>
                <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 mt-1.5 leading-relaxed">
                  Every plan comes with full industrial capabilities for 14 days. Zero billing or credit card required to start.
                </p>
              </div>

              {/* Plan Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 sm:gap-4">
                {PLANS.map((plan) => {
                  const isSelected = selectedPlan === plan.id;
                  return (
                    <div
                      key={plan.id}
                      onClick={() => setSelectedPlan(plan.id)}
                      className={`relative p-5 sm:p-6 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                        isSelected
                          ? "border-neutral-950 dark:border-white bg-neutral-50/70 dark:bg-neutral-850 shadow-md ring-1 ring-neutral-950/10 dark:ring-white/10"
                          : "border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 bg-white dark:bg-neutral-900"
                      }`}
                    >
                      {plan.badge && (
                        <span className="absolute -top-3 right-4 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-orange-500 text-white shadow-sm">
                          {plan.badge}
                        </span>
                      )}

                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-base font-bold text-neutral-950 dark:text-white">
                            {plan.name}
                          </h3>
                          <div
                            className={`size-5 rounded-full border flex items-center justify-center transition-colors ${
                              isSelected
                                ? "border-neutral-950 dark:border-white bg-neutral-950 dark:bg-white text-white dark:text-neutral-950"
                                : "border-neutral-300 dark:border-neutral-700"
                            }`}
                          >
                            {isSelected && <Check className="size-3 stroke-[3]" />}
                          </div>
                        </div>

                        <div className="flex items-baseline gap-1 my-3">
                          <span className="text-2xl sm:text-3xl font-extrabold text-neutral-950 dark:text-white">
                            ${plan.monthlyPrice}
                          </span>
                          <span className="text-xs text-neutral-400 font-medium">/month</span>
                          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold ml-auto">
                            Free for 14 days
                          </span>
                        </div>

                        <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-4 leading-relaxed">
                          {plan.description}
                        </p>

                        <div className="space-y-2 border-t border-neutral-200/60 dark:border-neutral-800/60 pt-3">
                          {plan.features.map((feature, idx) => (
                            <div key={idx} className="flex items-start gap-2 text-xs text-neutral-700 dark:text-neutral-300 font-medium">
                              <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0 mt-0.5" />
                              <span>{feature}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Company Details Section */}
              <div className="pt-6 border-t border-neutral-200 dark:border-neutral-800 space-y-5">
                <div className="flex items-center gap-2">
                  <Building2 className="size-4 text-neutral-500 dark:text-neutral-400" />
                  <h3 className="text-sm sm:text-base font-bold text-neutral-950 dark:text-white">
                    Company &amp; Workspace Details
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Company Name */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor="company-name"
                      className="block text-xs font-semibold text-neutral-800 dark:text-neutral-200"
                    >
                      Company or Brand Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="company-name"
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="e.g. Acme Studio, TechFlow Inc"
                      required
                      className="w-full h-11 sm:h-12 px-3.5 sm:px-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-sm font-medium text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-950/10 dark:focus:ring-white/10 focus:border-neutral-950 dark:focus:border-white transition-all"
                    />
                    <p className="text-[11px] sm:text-xs text-neutral-500 dark:text-neutral-400 pl-0.5">
                      Used to brand your chatbots and workspace environment.
                    </p>
                  </div>

                  {/* Company Size */}
                  <ModernDropdown
                    id="company-size"
                    label="Company Size"
                    options={COMPANY_SIZES}
                    value={companySize}
                    onChange={setCompanySize}
                    hint="Helps us scale concurrent worker allocation appropriately."
                  />

                  {/* Role */}
                  <ModernDropdown
                    id="company-role"
                    label="Your Primary Role"
                    options={ROLES}
                    value={companyRole}
                    onChange={setCompanyRole}
                    hint="Personalizes recommended bots and automated workflows."
                  />

                  {/* Website URL */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor="company-website"
                      className="block text-xs font-semibold text-neutral-800 dark:text-neutral-200"
                    >
                      Website URL <span className="text-neutral-400 font-normal">(optional)</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-400">
                        <Globe className="size-4" />
                      </div>
                      <input
                        id="company-website"
                        type="url"
                        value={websiteUrl}
                        onChange={(e) => setWebsiteUrl(e.target.value)}
                        placeholder="https://example.com"
                        className="w-full h-11 sm:h-12 pl-10 pr-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-sm font-medium text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-950/10 dark:focus:ring-white/10 focus:border-neutral-950 dark:focus:border-white transition-all"
                      />
                    </div>
                    <p className="text-[11px] sm:text-xs text-neutral-500 dark:text-neutral-400 pl-0.5">
                      We can crawl this later to seed your knowledge base in seconds.
                    </p>
                  </div>
                </div>
              </div>

              {/* Next Step Button */}
              <div className="pt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    if (!companyName.trim()) {
                      setError("Please provide a company or workspace name to proceed.");
                      return;
                    }
                    setError(null);
                    setStep(2);
                  }}
                  className="w-full sm:w-auto h-11 sm:h-12 px-6 sm:px-8 rounded-xl bg-neutral-950 text-white dark:bg-white dark:text-neutral-950 font-bold text-sm inline-flex items-center justify-center gap-2 hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-all cursor-pointer shadow-sm active:scale-[0.99]"
                >
                  <span>Continue to Step 2</span>
                  <ArrowRight className="size-4" />
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <form onSubmit={handleSubmit} className="space-y-8 animate-in fade-in-50 duration-200">
              {/* Heading */}
              <div>
                <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-2">
                  <Users className="size-3.5 text-orange-500" />
                  Referral &amp; Terms
                </span>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-950 dark:text-white">
                  Where did you hear about Chatty?
                </h1>
                <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 mt-1.5 leading-relaxed">
                  Help us understand where our users discover PersonaliAI Chatty.
                </p>
              </div>

              {/* Referral Source Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {REFERRAL_SOURCES.map((src) => {
                  const isSelected = referralSource === src.id;
                  return (
                    <button
                      key={src.id}
                      type="button"
                      onClick={() => setReferralSource(src.id)}
                      className={`h-12 sm:h-14 px-3 sm:px-4 rounded-xl border text-left flex items-center gap-2.5 transition-all cursor-pointer text-xs sm:text-sm font-semibold ${
                        isSelected
                          ? "border-neutral-950 dark:border-white bg-neutral-100 dark:bg-neutral-800 text-neutral-950 dark:text-white ring-2 ring-neutral-950/10 dark:ring-white/10 shadow-sm"
                          : "border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 hover:border-neutral-300 dark:hover:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-850"
                      }`}
                    >
                      <span className="shrink-0">{src.icon}</span>
                      <span className="truncate">{src.name}</span>
                    </button>
                  );
                })}
              </div>

              {/* Terms and Legal Acceptance Section */}
              <div className="pt-6 border-t border-neutral-200 dark:border-neutral-800 space-y-4">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
                  <h3 className="text-sm sm:text-base font-bold text-neutral-950 dark:text-white">
                    Agreement &amp; Consent
                  </h3>
                </div>

                <div className="space-y-3 bg-neutral-50 dark:bg-neutral-850/50 p-4 sm:p-5 rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80">
                  <label className="flex items-start gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={termsAccepted}
                      onChange={(e) => setTermsAccepted(e.target.checked)}
                      className="mt-0.5 size-4.5 rounded border-neutral-300 text-neutral-950 focus:ring-neutral-950 dark:border-neutral-700 dark:bg-neutral-900 cursor-pointer"
                    />
                    <div className="text-xs sm:text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed font-medium">
                      I agree to PersonaliAI&apos;s{" "}
                      <Link
                        href="/terms"
                        target="_blank"
                        className="text-neutral-950 dark:text-white font-bold underline underline-offset-4 hover:opacity-80"
                      >
                        Terms of Service
                      </Link>{" "}
                      and{" "}
                      <Link
                        href="/privacy"
                        target="_blank"
                        className="text-neutral-950 dark:text-white font-bold underline underline-offset-4 hover:opacity-80"
                      >
                        Privacy Policy
                      </Link>
                      . <span className="text-red-500 font-bold">*</span>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={marketingOptIn}
                      onChange={(e) => setMarketingOptIn(e.target.checked)}
                      className="mt-0.5 size-4.5 rounded border-neutral-300 text-neutral-950 focus:ring-neutral-950 dark:border-neutral-700 dark:bg-neutral-900 cursor-pointer"
                    />
                    <div className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed font-normal">
                      Send me product release notes, new agent templates, and automation tips (optional).
                    </div>
                  </label>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 flex flex-col-reverse sm:flex-row items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="w-full sm:w-auto h-11 sm:h-12 px-5 rounded-xl border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800 font-semibold text-xs sm:text-sm text-neutral-700 dark:text-neutral-300 transition-colors"
                >
                  Back to Step 1
                </button>

                <button
                  type="submit"
                  disabled={loading || !termsAccepted}
                  className="w-full sm:w-auto h-11 sm:h-12 px-8 rounded-xl bg-neutral-950 text-white dark:bg-white dark:text-neutral-950 font-bold text-sm inline-flex items-center justify-center gap-2 hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-all cursor-pointer shadow-md disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.99]"
                >
                  {loading ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      <span>Setting up workspace...</span>
                    </>
                  ) : (
                    <>
                      <span>Start 14-Day Free Trial</span>
                      <ArrowRight className="size-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-neutral-200/80 dark:border-neutral-800/80 py-4 px-6 text-center text-xs text-neutral-400">
        © 2026 PersonaliAI Inc. All rights reserved. • Industrial Conversational AI Platform
      </footer>
    </div>
  );
}
