"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2, AlertCircle, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthShell, GoogleIcon, MicrosoftIcon } from "@/components/auth/auth-shell";
import { createClient } from "@/lib/supabase/client";
import { captureAffiliateReferral, getAffiliateReferral } from "@/lib/affiliate-referral";
import { SELF_HOST_MODE } from "@/lib/deployment";

type BusyKey = "password" | "google" | "microsoft" | null;

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
  const [selectedPlan, setSelectedPlan] = useState<"chatty_hobby" | "chatty_standard" | "chatty_business">(initialPlan);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [busy, setBusy] = useState<BusyKey>(null);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

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
          ...(signupReferral ? { chatty_ref: signupReferral.ref, chatty_referral: signupReferral } : {}),
        },
      },
    });
    setBusy(null);
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

  async function handleOAuth(provider: "google" | "azure") {
    if (busy) return;
    setBusy(provider === "azure" ? "microsoft" : "google");
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
            : { prompt: "select_account" },
        scopes: provider === "azure" ? "email openid profile" : undefined,
      },
    });
    if (error) {
      setError(error.message);
      setBusy(null);
    }
  }

  if (SELF_HOST_MODE) {
    return (
      <AuthShell title="Create your account" subtitle="Your identity provider manages self-hosted access">
        <div className="space-y-3 text-center">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Self-hosted Chatty uses OIDC (Google, Microsoft, or your configured provider). Create the account there, then return to Chatty.
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
        {/* Plan preference picker */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-foreground/80 flex items-center justify-between">
            <span>Select Free Trial Plan</span>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider">
              14 Days Free
            </span>
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: "chatty_hobby", name: "Hobby", price: "$19/mo" },
              { id: "chatty_standard", name: "Standard", price: "$99/mo", popular: true },
              { id: "chatty_business", name: "Business", price: "$399/mo" },
            ].map((p) => {
              const isSelected = selectedPlan === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedPlan(p.id as typeof selectedPlan)}
                  className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer relative ${
                    isSelected
                      ? "border-foreground bg-foreground/5 font-bold ring-1 ring-foreground/10"
                      : "border-border hover:border-foreground/30 bg-background text-muted-foreground"
                  }`}
                >
                  {p.popular && (
                    <span className="absolute -top-2 left-1/2 -translate-x-1/2 px-1.5 py-0.2 rounded-full text-[8px] font-bold uppercase bg-orange-500 text-white">
                      Popular
                    </span>
                  )}
                  <div className="text-xs text-foreground font-semibold truncate">{p.name}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{p.price}</div>
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-muted-foreground text-center">
            No credit card required for 14-day free trial.{" "}
            <a
              href="https://github.com/PersonaliAI/chatty"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-foreground"
            >
              Self-host open source ($0)
            </a>
          </p>
        </div>

        {/* OAuth Buttons */}
        <div className="space-y-2 pt-1">
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
            onClick={() => handleOAuth("azure")}
          >
            {busy === "microsoft" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <MicrosoftIcon />
            )}
            Continue with Microsoft
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
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              required
              disabled={busy !== null}
              className="w-full h-11 px-3.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-foreground/20 disabled:opacity-60"
            />
          </div>
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
          <Button
            type="submit"
            className="w-full h-11 font-bold cursor-pointer mt-4 rounded-xl text-sm"
            disabled={!email.trim() || password.length < 8 || busy !== null}
          >
            {busy === "password" && <Loader2 className="size-4 animate-spin" />}
            Start Free Trial
          </Button>
        </form>

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
