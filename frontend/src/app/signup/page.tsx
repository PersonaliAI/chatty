"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2, AlertCircle, Eye, EyeOff, CheckCircle2, Info, ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthShell, GoogleIcon, GithubIcon } from "@/components/auth/auth-shell";
import { createClient } from "@/lib/supabase/client";
import { captureAffiliateReferral, getAffiliateReferral } from "@/lib/affiliate-referral";
import { SELF_HOST_MODE } from "@/lib/deployment";

type BusyKey = "password" | "google" | "github" | null;

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupPageInner />
    </Suspense>
  );
}

function SignupPageInner() {
  const supabase = createClient();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const dest = next && next.startsWith("/") ? next : "/dashboard";
  const rawPlanParam = (searchParams.get("plan") || "").toLowerCase();
  const initialPlan: "chatty_hobby" | "chatty_standard" | "chatty_business" =
    rawPlanParam === "hobby" || rawPlanParam === "chatty_hobby"
      ? "chatty_hobby"
      : rawPlanParam === "business" || rawPlanParam === "chatty_business"
      ? "chatty_business"
      : "chatty_standard";
  const [selectedPlan] = useState<"chatty_hobby" | "chatty_standard" | "chatty_business">(initialPlan);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [busy, setBusy] = useState<BusyKey>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [existingUserEmail, setExistingUserEmail] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  // If already signed in, immediately redirect to dashboard
  useEffect(() => {
    if (SELF_HOST_MODE) {
      setCheckingSession(false);
      return;
    }
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        window.location.href = dest;
        return;
      }
      setCheckingSession(false);
    });
  }, [supabase, dest]);

  useEffect(() => {
    captureAffiliateReferral(searchParams);
  }, [searchParams]);

  function redirect(): string {
    const origin = process.env.NEXT_PUBLIC_SITE_URL || (typeof window !== "undefined" ? window.location.origin : "https://chatty.personaliai.com");
    const ref = getAffiliateReferral()?.ref;
    const nextUrl = new URL(dest, origin || "https://chatty.personaliai.com");
    if (ref && !nextUrl.searchParams.get("ref")) nextUrl.searchParams.set("ref", ref);
    if (selectedPlan && !nextUrl.searchParams.get("plan")) nextUrl.searchParams.set("plan", selectedPlan);
    return `${origin}/auth/callback?next=${encodeURIComponent(`${nextUrl.pathname}${nextUrl.search}`)}`;
  }

  async function handlePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password || busy) return;
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setBusy("password");
    setError(null);
    const signupReferral = getAffiliateReferral();
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: redirect(),
        data: {
          plan_preference: selectedPlan,
          marketing_opt_in: marketingConsent,
          marketing_opt_in_at: marketingConsent ? new Date().toISOString() : null,
          marketing_opt_in_version: "v1.0",
          ...(signupReferral ? { chatty_ref: signupReferral.ref, chatty_referral: signupReferral } : {}),
        },
      },
    });
    setBusy(null);

    // Detect if this email is already registered in Supabase:
    // 1. Explicit error mentioning already registered
    // 2. Supabase anti-enumeration behavior: error is null, but data.user has empty identities []
    const isAlreadyRegistered = Boolean(
      (error && (error.message.toLowerCase().includes("already registered") || error.message.toLowerCase().includes("already been registered"))) ||
      (data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0)
    );

    if (isAlreadyRegistered) {
      setExistingUserEmail(email.trim());
      setError(null);
      return;
    }

    if (error) {
      setError(humanizeAuthError(error.message));
      return;
    }

    // If email confirmation is disabled in Supabase, route directly to onboarding
    if (data.session) {
      window.location.href = `/onboarding?plan=${selectedPlan}&next=${encodeURIComponent(dest)}`;
      return;
    }
    setSent(true);
  }

  async function handleOAuth(provider: "google" | "github") {
    if (busy) return;
    setBusy(provider);
    setError(null);
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem("chatty_plan_preference", selectedPlan);
      }
    } catch {}
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: redirect(),
        queryParams:
          provider === "google"
            ? { access_type: "offline", prompt: "consent" }
            : undefined,
      },
    });
    if (error) {
      setError(error.message);
      setBusy(null);
    }
  }

  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="size-6 text-muted-foreground animate-spin" />
      </div>
    );
  }

  if (SELF_HOST_MODE) {
    return (
      <AuthShell title="Create your account" subtitle="Your identity provider manages self-hosted access">
        <div className="space-y-3 text-center">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Self-hosted Chatty uses OIDC (Google, GitHub, or your configured provider). Create the account there, then return to Chatty.
          </p>
          <Link href={`/login?next=${encodeURIComponent(dest)}`} className="inline-flex w-full h-10 items-center justify-center rounded-md bg-foreground text-background text-sm font-medium">
            Continue to sign in
          </Link>
        </div>
      </AuthShell>
    );
  }

  if (sent) {
    return (
      <AuthShell title="Almost there" subtitle="Confirm your email to continue">
        <div className="text-center py-4">
          <div className="size-12 mx-auto rounded-full bg-emerald-50 dark:bg-emerald-950/60 grid place-items-center text-emerald-600 dark:text-emerald-400 mb-3 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="size-6" />
          </div>
          <h3 className="text-sm font-semibold">Check your email</h3>
          <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
            We sent a confirmation link to <b>{email}</b>.<br />
            Click it to verify your address, then complete onboarding.
          </p>
          <Link
            href="/login"
            className="mt-4 inline-block text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-4"
          >
            Back to sign in
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={dest.startsWith("/oauth/consent") ? "Create account to connect" : "Start your 14-day free trial"}
      subtitle={dest.startsWith("/oauth/consent") ? "Set up your free account to authorize your AI agent with Chatty" : "Experience all industrial features with zero commitments"}
      footer={
        <>
          Already have an account?{" "}
          <Link href={dest ? `/login?next=${encodeURIComponent(dest)}` : "/login"} className="font-medium text-foreground hover:underline font-semibold text-[#f97316]">
            Sign in
          </Link>
        </>
      }
    >
      <div className="space-y-5">
        {/* OAuth Buttons */}
        <div className="space-y-2">
          <Button
            variant="outline"
            type="button"
            className="w-full h-11 font-medium flex items-center justify-center gap-2 cursor-pointer text-sm rounded-xl"
            disabled={busy !== null}
            onClick={() => handleOAuth("google")}
          >
            {busy === "google" ? <Loader2 className="size-4 animate-spin" /> : <GoogleIcon />}
            Continue with Google
          </Button>
          <Button
            variant="outline"
            type="button"
            className="w-full h-11 font-medium flex items-center justify-center gap-2 cursor-pointer text-sm rounded-xl"
            disabled={busy !== null}
            onClick={() => handleOAuth("github")}
          >
            {busy === "github" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <GithubIcon />
            )}
            Continue with GitHub
          </Button>
        </div>

        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground text-[10px] font-semibold tracking-wider">
              Or with email
            </span>
          </div>
        </div>

        {/* Email Password Form */}
        <form onSubmit={handlePassword} className="space-y-3.5">
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-xs font-medium text-foreground/80">
              Work Email address
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (existingUserEmail) setExistingUserEmail(null);
                if (error) setError(null);
              }}
              placeholder="name@company.com"
              required
              disabled={busy !== null}
              className="w-full h-11 px-3.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-foreground/20 disabled:opacity-60"
            />
          </div>

          {/* Existing Account Notice - Directly below the email field so it is 100% visible above the fold */}
          {existingUserEmail && (
            <div className="p-3.5 rounded-xl bg-blue-50/90 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 text-blue-950 dark:text-blue-100 space-y-2.5 animate-in fade-in slide-in-from-top-1 duration-200">
              <div className="flex items-start gap-2.5">
                <Info className="size-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                <div className="text-xs leading-relaxed">
                  <p className="font-semibold text-blue-950 dark:text-blue-100">
                    Account already exists
                  </p>
                  <p className="text-blue-700 dark:text-blue-300 mt-0.5">
                    An account with <strong>{existingUserEmail}</strong> is already registered. Please sign in to continue.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-0.5">
                <Link
                  href={`/login?email=${encodeURIComponent(existingUserEmail)}&next=${encodeURIComponent(dest)}`}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-xs cursor-pointer"
                >
                  <span>Sign In with This Account</span>
                  <ArrowRight className="size-3" />
                </Link>
                <Link
                  href={`/forgot-password?email=${encodeURIComponent(existingUserEmail)}`}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline px-2 py-1"
                >
                  Forgot password?
                </Link>
              </div>
            </div>
          )}
          <div className="space-y-1.5">
            <label htmlFor="password" className="text-xs font-medium text-foreground/80">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPwd ? "text" : "password"}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                required
                minLength={8}
                disabled={busy !== null}
                className="w-full h-11 pl-3.5 pr-10 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-foreground/20 disabled:opacity-60"
              />
              <button
                type="button"
                onClick={() => setShowPwd((s) => !s)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground rounded"
                aria-label={showPwd ? "Hide password" : "Show password"}
              >
                {showPwd ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          {/* GDPR Affirmative Un-ticked Marketing Opt-in Checkbox with Crisp White Checkmark */}
          <div className="pt-1 pb-0.5">
            <label className="flex items-start gap-2.5 cursor-pointer text-xs text-muted-foreground select-none leading-relaxed">
              <button
                type="button"
                role="checkbox"
                aria-checked={marketingConsent}
                onClick={() => setMarketingConsent(!marketingConsent)}
                className={`mt-0.5 size-4 rounded-md border flex items-center justify-center transition-colors shrink-0 cursor-pointer ${
                  marketingConsent
                    ? "bg-[#f97316] border-[#f97316] text-white"
                    : "bg-background border-border hover:border-neutral-400 dark:hover:border-neutral-600"
                }`}
              >
                {marketingConsent && <Check className="size-3 text-white stroke-[3]" />}
              </button>
              <span onClick={() => setMarketingConsent(!marketingConsent)}>
                Keep me updated with Chatty product releases, AI features, and engineering tips via email (optional).
              </span>
            </label>
          </div>

          <Button
            type="submit"
            className="w-full h-11 font-bold cursor-pointer mt-3 rounded-xl text-sm"
            disabled={!email.trim() || password.length < 8 || busy !== null}
          >
            {busy === "password" && <Loader2 className="size-4 animate-spin" />}
            Start Free Trial
          </Button>

          {/* GDPR Legal Basis & Agreement Transparency */}
          <div className="space-y-1.5 pt-2 text-center">
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              By creating an account, you agree to our{" "}
              <Link href="/terms" target="_blank" className="text-foreground hover:underline underline-offset-2 font-medium">
                Terms of Use
              </Link>{" "}
              and acknowledge our{" "}
              <Link href="/privacy" target="_blank" className="text-foreground hover:underline underline-offset-2 font-medium">
                Privacy Policy
              </Link>.
            </p>
            <p className="text-[10px] text-muted-foreground/80">
              14-day free trial &bull; $0.00 today &bull; 1-click cancel anytime.
            </p>
          </div>
        </form>

        {/* Informational Notice */}
        {notice && (
          <div className="flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 p-3 rounded-xl border border-amber-200 dark:border-amber-800">
            <Info className="size-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <span>{notice}</span>
          </div>
        )}

        {/* Actual Failure / Error */}
        {error && (
          <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/10 p-3 rounded-xl border border-destructive/20">
            <AlertCircle className="size-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>
    </AuthShell>
  );
}

function humanizeAuthError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("user already registered") || m.includes("already been registered")) {
    return "An account with this email already exists. Try signing in instead.";
  }
  if (m.includes("password should be")) {
    return "Password must be at least 8 characters.";
  }
  if (m.includes("rate limit")) {
    return "Too many signups from this IP. Wait a minute, then try again.";
  }
  return msg;
}
