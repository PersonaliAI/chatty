"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Check,
  Copy,
  Sparkles,
  ShieldCheck,
  Calendar,
  ArrowRight,
  ExternalLink,
  Lock,
  MessageSquare,
  Loader2,
  AlertCircle,
  Trash2,
  X,
  CheckCircle2,
  Bot,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { BACKEND_URL, fetchBackend } from "@/lib/backend-client";
import { GoogleIcon } from "@/components/auth/auth-shell";

interface ClaimBotDetails {
  status: "unclaimed" | "claimed" | "declined" | "expired";
  bot_id: string;
  name: string;
  welcome_message: string;
  primary_color: string;
  avatar_url?: string | null;
  avatar_icon?: string | null;
  demo_target_name: string;
  demo_target_url: string;
  suggested_prompts: string[];
  sources_count: number;
  sources_sample: string[];
  demo_expires_at?: string | null;
  widget_token?: string | null;
}

export default function ClaimClient({ token }: { token: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const autoClaimParam = searchParams.get("auto_claim") === "1";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bot, setBot] = useState<ClaimBotDetails | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [mobileTab, setMobileTab] = useState<"chat" | "overview">("chat");

  // Modals & action states
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deletedSuccess, setDeletedSuccess] = useState(false);

  // Auth form inside modal
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authMode, setAuthMode] = useState<"signup" | "signin">("signup");
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthBusy, setIsAuthBusy] = useState(false);

  // Fetch bot details on mount
  useEffect(() => {
    let isMounted = true;

    async function loadClaimData() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`${BACKEND_URL}/api/claim/${encodeURIComponent(token)}`, {
          cache: "no-store",
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.detail || "Unable to load preview bot.");
        }

        const data: ClaimBotDetails = await res.json();
        if (isMounted) {
          setBot(data);
          // If auto_claim query param is present (e.g. from OAuth callback redirect)
          if (autoClaimParam && data.status === "unclaimed") {
            triggerClaim();
          }
        }
      } catch (err: unknown) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Failed to load assistant preview.");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadClaimData();
    return () => {
      isMounted = false;
    };
  }, [token, autoClaimParam]);

  // Copy suggested prompt to clipboard
  const handleCopyPrompt = async (promptText: string, index: number) => {
    try {
      await navigator.clipboard.writeText(promptText);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2500);
    } catch {
      // fallback
    }
  };

  // Execute ownership transfer
  const triggerClaim = async () => {
    const supabase = createClient();
    if (!supabase) return;

    setIsClaiming(true);
    setAuthError(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        // Not logged in -> show signup/login modal
        setShowClaimModal(true);
        setIsClaiming(false);
        return;
      }

      // User has active session -> call transfer API
      const res = await fetchBackend(supabase, `/api/claim/${encodeURIComponent(token)}`, {
        method: "POST",
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Ownership transfer failed.");
      }

      const result = await res.json();
      router.push(result.dashboard_url || `/dashboard?bot_id=${bot?.bot_id}&claimed=1`);
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : "Failed to transfer bot.");
      setIsClaiming(false);
    }
  };

  // Email + Password Auth submission
  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authEmail.trim() || !authPassword.trim()) return;

    const supabase = createClient();
    if (!supabase) return;

    setIsAuthBusy(true);
    setAuthError(null);

    try {
      if (authMode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: authEmail.trim(),
          password: authPassword,
        });
        if (error) throw error;
        if (!data.session) {
          setAuthError("Check your inbox for a confirmation link to complete registration.");
          setIsAuthBusy(false);
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: authEmail.trim(),
          password: authPassword,
        });
        if (error) throw error;
      }

      // Immediately execute claim
      const res = await fetchBackend(supabase, `/api/claim/${encodeURIComponent(token)}`, {
        method: "POST",
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Claim transfer failed.");
      }

      const result = await res.json();
      router.push(result.dashboard_url || `/dashboard?bot_id=${bot?.bot_id}&claimed=1`);
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : "Authentication error.");
      setIsAuthBusy(false);
    }
  };

  // Google OAuth flow
  const handleGoogleAuth = async () => {
    const supabase = createClient();
    if (!supabase) return;

    setIsAuthBusy(true);
    setAuthError(null);

    const origin =
      typeof window !== "undefined"
        ? window.location.origin
        : process.env.NEXT_PUBLIC_SITE_URL || "https://chatty.personaliai.com";

    // Returns to this claim page with ?auto_claim=1 after OAuth exchange
    const nextPath = `/claim/${encodeURIComponent(token)}?auto_claim=1`;
    const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(nextPath)}`;

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });

    if (error) {
      setAuthError(error.message);
      setIsAuthBusy(false);
    }
  };

  // Permanently delete demo bot
  const handleDeleteDemo = async () => {
    setIsDeleting(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/claim/${encodeURIComponent(token)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Failed to delete demo bot.");
      }
      setDeletedSuccess(true);
      setShowDeleteModal(false);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to delete demo bot.");
    } finally {
      setIsDeleting(false);
    }
  };

  // Helper to extract clean domain string
  const cleanDomain = (url: string) => {
    try {
      const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
      return parsed.hostname.replace(/^www\./, "");
    } catch {
      return url;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="flex items-center gap-3 text-slate-600 font-medium text-sm">
          <Loader2 className="size-5 animate-spin text-slate-800" />
          Loading assistant sandbox...
        </div>
      </div>
    );
  }

  if (deletedSuccess) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200/90 shadow-sm p-8 text-center space-y-4">
          <div className="size-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-700">
            <Trash2 className="size-6" />
          </div>
          <h1 className="text-xl font-semibold text-slate-900">Demo Data Deleted</h1>
          <p className="text-sm text-slate-600 leading-relaxed">
            This demo assistant, all indexed web pages, and vector embeddings have been permanently deleted from our
            database.
          </p>
          <div className="pt-2">
            <Link
              href="/"
              className="inline-flex text-xs font-medium text-slate-700 hover:text-slate-900 underline underline-offset-4"
            >
              Return to Chatty homepage
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (error || !bot) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200/90 shadow-sm p-8 text-center space-y-4">
          <div className="size-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto">
            <AlertCircle className="size-6" />
          </div>
          <h1 className="text-xl font-semibold text-slate-900">Preview Not Available</h1>
          <p className="text-sm text-slate-600 leading-relaxed">{error || "This preview link is invalid or expired."}</p>
          <div className="pt-2">
            <Link
              href="/"
              className="inline-flex items-center justify-center h-10 px-5 rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-black transition-colors"
            >
              Explore Chatty
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const targetDomain = cleanDomain(bot.demo_target_url || bot.demo_target_name);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Top Navigation */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2.5 group">
            <img
              src="/favicon.png"
              alt="Chatty Logo"
              className="size-7 object-contain shrink-0"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = "/logo.png";
              }}
            />
            <span className="font-semibold text-slate-900 text-base tracking-tight">Chatty</span>
          </Link>

          <span className="text-slate-300 font-light hidden sm:inline">|</span>

          <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
            Live Preview
          </span>
        </div>

        <div className="flex items-center gap-3">
          {bot.demo_target_url && (
            <a
              href={bot.demo_target_url}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden md:inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors"
            >
              <span>{targetDomain}</span>
              <ExternalLink className="size-3.5" />
            </a>
          )}

          <button
            onClick={() => triggerClaim()}
            disabled={isClaiming || bot.status === "claimed"}
            className="inline-flex items-center justify-center h-9 px-4 rounded-lg bg-slate-900 hover:bg-black text-white text-xs sm:text-sm font-medium shadow-sm transition-all disabled:opacity-50 cursor-pointer"
          >
            {isClaiming ? (
              <Loader2 className="size-4 animate-spin" />
            ) : bot.status === "claimed" ? (
              "Already Claimed"
            ) : (
              "Claim This Bot"
            )}
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
        {/* Mobile View Segmented Tab Selector */}
        <div className="lg:hidden mb-5 bg-slate-200/80 p-1 rounded-xl flex items-center gap-1 shadow-inner">
          <button
            type="button"
            onClick={() => setMobileTab("chat")}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              mobileTab === "chat"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <MessageSquare className="size-3.5" />
            Interactive Sandbox
          </button>
          <button
            type="button"
            onClick={() => setMobileTab("overview")}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              mobileTab === "overview"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Sparkles className="size-3.5" />
            Bot Details &amp; Prompts
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Context, Verified Sources, Suggested Prompts, CTAs */}
          <div className={`lg:col-span-5 space-y-6 ${mobileTab === "overview" ? "block" : "hidden lg:block"}`}>
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 sm:p-7 space-y-6">
              {/* Badge & Title */}
              <div className="space-y-2">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
                  <Sparkles className="size-3.5" />
                  Pre-trained for {bot.demo_target_name}
                </div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                  Your AI Customer Support Specialist is Ready
                </h1>
                <p className="text-sm text-slate-600 leading-relaxed">
                  We pre-trained an autonomous agent directly on your website and documentation. Test how accurately it
                  answers visitor questions about features, pricing, and integrations.
                </p>
              </div>

              {/* Training Summary Box */}
              <div className="bg-slate-50 border border-slate-200/70 rounded-xl p-4 space-y-3">
                <div className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
                  Knowledge Base Status
                </div>
                <div className="space-y-2 text-xs text-slate-600">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="size-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-slate-800">{bot.sources_count || "Multiple"} pages</strong> indexed from{" "}
                      <span className="font-mono text-slate-700">{targetDomain}</span>
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <ShieldCheck className="size-4 text-blue-600 shrink-0 mt-0.5" />
                    <span>Grounded with anti-hallucination guardrails and source citations</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Calendar className="size-4 text-indigo-600 shrink-0 mt-0.5" />
                    <span>Calendar booking (Google Meet / Teams / Zoom) ready to connect</span>
                  </div>
                </div>
              </div>

              {/* Click-to-Test Prompts */}
              {bot.suggested_prompts && bot.suggested_prompts.length > 0 && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800">Try asking these in the sandbox:</span>
                    <span className="text-slate-400">Click to copy</span>
                  </div>
                  <div className="space-y-1.5">
                    {bot.suggested_prompts.map((promptText, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleCopyPrompt(promptText, idx)}
                        className="w-full text-left p-2.5 rounded-lg border border-slate-200/80 bg-white hover:bg-slate-50 hover:border-slate-300 transition-all text-xs text-slate-700 flex items-center justify-between gap-2 group cursor-pointer"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <MessageSquare className="size-3.5 text-slate-400 shrink-0 group-hover:text-slate-600" />
                          <span className="truncate">{promptText}</span>
                        </div>
                        {copiedIndex === idx ? (
                          <span className="text-[11px] text-emerald-600 font-medium flex items-center gap-1 shrink-0">
                            <Check className="size-3" /> Copied
                          </span>
                        ) : (
                          <Copy className="size-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Primary Claim Action Block */}
              <div className="pt-2 border-t border-slate-100 space-y-3">
                <button
                  onClick={() => triggerClaim()}
                  disabled={isClaiming || bot.status === "claimed"}
                  className="w-full h-11 rounded-xl bg-slate-900 hover:bg-black text-white text-sm font-medium shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isClaiming ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : bot.status === "claimed" ? (
                    "Already Claimed by You"
                  ) : (
                    <>
                      <span>Claim This Assistant</span>
                      <ArrowRight className="size-4" />
                    </>
                  )}
                </button>

                <p className="text-[11px] text-center text-slate-500 leading-normal">
                  Free 14-day evaluation • Instant 1-line script embed • No credit card required
                </p>
              </div>

              {/* Decline / Delete Data Link */}
              <div className="pt-1 text-center">
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(true)}
                  className="text-xs text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                >
                  Not your company or want this data deleted? Click to remove
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Live Interactive Widget Sandbox */}
          <div className={`lg:col-span-7 space-y-3 ${mobileTab === "chat" ? "block" : "hidden lg:block"}`}>
            {/* Quick suggested prompt pills for mobile when on chat tab */}
            {bot.suggested_prompts && bot.suggested_prompts.length > 0 && (
              <div className="lg:hidden flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
                {bot.suggested_prompts.map((promptText, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleCopyPrompt(promptText, idx)}
                    className="shrink-0 px-2.5 py-1 bg-white border border-slate-200 rounded-full text-slate-700 text-[11px] font-medium hover:border-slate-300 flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <span className="truncate max-w-[200px]">{promptText}</span>
                    {copiedIndex === idx ? <Check className="size-3 text-emerald-600 shrink-0" /> : <Copy className="size-3 text-slate-400 shrink-0" />}
                  </button>
                ))}
              </div>
            )}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden flex flex-col">
              {/* Browser Window Header */}
              <div className="bg-slate-100/80 border-b border-slate-200/80 px-4 py-2.5 flex items-center justify-between select-none">
                <div className="flex items-center gap-1.5">
                  <div className="size-3 rounded-full bg-slate-300" />
                  <div className="size-3 rounded-full bg-slate-300" />
                  <div className="size-3 rounded-full bg-slate-300" />
                </div>

                <div className="flex items-center gap-1.5 bg-white border border-slate-200/90 rounded-md px-3 py-1 text-xs text-slate-600 font-mono shadow-2xs max-w-xs sm:max-w-md truncate">
                  <Lock className="size-3 text-emerald-600 shrink-0" />
                  <span className="truncate">https://{targetDomain}/chatty-preview</span>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                  <span className="size-2 rounded-full bg-emerald-500" />
                  <span className="hidden sm:inline">Active</span>
                </div>
              </div>

              {/* Embedded Live Widget Sandbox */}
              <div className="relative w-full h-[620px] sm:h-[660px] bg-slate-50/50">
                <iframe
                  src={`/embed/${bot.bot_id}?token=${encodeURIComponent(bot.widget_token || "")}&preview=true`}
                  title={`${bot.name} Interactive Sandbox`}
                  className="w-full h-full border-0"
                  allow="microphone; camera; clipboard-write"
                />
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Sticky Mobile Bottom Bar */}
      <div className="lg:hidden sticky bottom-0 z-20 bg-white/95 backdrop-blur-md border-t border-slate-200 px-4 py-3 flex items-center justify-between gap-3 shadow-lg">
        <div className="truncate">
          <div className="text-xs font-semibold text-slate-900 truncate">{bot.demo_target_name} Assistant</div>
          <div className="text-[11px] text-slate-500 truncate">14-day free trial</div>
        </div>
        <button
          onClick={() => triggerClaim()}
          disabled={isClaiming || bot.status === "claimed"}
          className="shrink-0 h-9 px-4 rounded-lg bg-slate-900 text-white text-xs font-medium flex items-center gap-1.5 cursor-pointer shadow-sm"
        >
          {isClaiming ? <Loader2 className="size-3.5 animate-spin" /> : "Claim Bot"}
        </button>
      </div>

      {/* Claim / Sign-up Modal */}
      {showClaimModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xl max-w-md w-full p-6 sm:p-7 space-y-5 relative">
            <button
              onClick={() => setShowClaimModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
            >
              <X className="size-5" />
            </button>

            <div className="space-y-1.5 text-center">
              <h2 className="text-xl font-bold text-slate-900">
                Claim {bot.demo_target_name}&apos;s Assistant
              </h2>
              <p className="text-xs text-slate-600 leading-relaxed">
                Create your account or sign in to take full ownership and copy your 1-line website embed script.
              </p>
            </div>

            {authError && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-100 flex items-start gap-2 text-xs text-red-600">
                <AlertCircle className="size-4 shrink-0 mt-0.5" />
                <span>{authError}</span>
              </div>
            )}

            {/* Google OAuth Button */}
            <button
              type="button"
              onClick={handleGoogleAuth}
              disabled={isAuthBusy}
              className="w-full h-10 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium flex items-center justify-center gap-2.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              <span className="size-4 shrink-0 flex items-center justify-center">
                <GoogleIcon />
              </span>
              <span>Continue with Google</span>
            </button>

            <div className="relative flex items-center justify-center">
              <div className="border-t border-slate-200 w-full" />
              <span className="bg-white px-2.5 text-[11px] text-slate-400 uppercase tracking-wider absolute">
                or with email
              </span>
            </div>

            {/* Email + Password Form */}
            <form onSubmit={handleEmailAuth} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Work Email</label>
                <input
                  type="email"
                  required
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder={`name@${targetDomain}`}
                  className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Password</label>
                <input
                  type="password"
                  required
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-slate-800"
                />
              </div>

              <button
                type="submit"
                disabled={isAuthBusy}
                className="w-full h-10 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50 mt-2"
              >
                {isAuthBusy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : authMode === "signup" ? (
                  "Create Account & Claim Bot"
                ) : (
                  "Sign In & Claim Bot"
                )}
              </button>
            </form>

            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => setAuthMode(authMode === "signup" ? "signin" : "signup")}
                className="text-xs text-slate-500 hover:text-slate-800 underline underline-offset-4 cursor-pointer"
              >
                {authMode === "signup" ? "Already have an account? Sign in" : "Need an account? Sign up"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete / Decline Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xl max-w-sm w-full p-6 space-y-4 relative">
            <button
              onClick={() => setShowDeleteModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
            >
              <X className="size-4" />
            </button>

            <div className="size-10 rounded-full bg-red-50 text-red-600 flex items-center justify-center">
              <Trash2 className="size-5" />
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-semibold text-slate-900">Permanently delete demo data?</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                This will immediately purge this assistant, all crawled text from {targetDomain}, and all vector
                embeddings from our servers.
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 h-9 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteDemo}
                disabled={isDeleting}
                className="flex-1 h-9 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? <Loader2 className="size-3.5 animate-spin" /> : "Delete Data"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
