"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2, AlertCircle, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthShell, GoogleIcon, MicrosoftIcon } from "@/components/auth/auth-shell";
import { createClient } from "@/lib/supabase/client";

type BusyKey = "password" | "google" | "microsoft" | null;

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const supabase = createClient();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const dest = next && next.startsWith("/") ? next : "/dashboard";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [busy, setBusy] = useState<BusyKey>(null);
  const [error, setError] = useState<string | null>(null);

  function redirect(): string {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}/auth/callback?next=${encodeURIComponent(dest)}`;
  }

  async function handlePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password || busy) return;
    setBusy("password");
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) {
      setBusy(null);
      setError(humanizeAuthError(error.message));
      return;
    }
    // Successful — let middleware route us. We trigger a hard navigation so
    // the layout + server components re-fetch the new session.
    window.location.href = dest;
  }

  async function handleOAuth(provider: "google" | "azure") {
    if (busy) return;
    setBusy(provider === "azure" ? "microsoft" : "google");
    setError(null);
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

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to manage your Chatty assistant"
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="font-medium text-foreground hover:underline">
            Create one
          </Link>
        </>
      }
    >
      <form onSubmit={handlePassword} className="space-y-3">
        <div className="space-y-1.5">
          <label htmlFor="email" className="text-xs font-medium text-foreground/80">
            Email address
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
            required
            disabled={busy !== null}
            className="w-full h-10 px-3 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-foreground/20 disabled:opacity-60"
          />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="text-xs font-medium text-foreground/80">
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <input
              id="password"
              type={showPwd ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={busy !== null}
              className="w-full h-10 pl-3 pr-10 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-foreground/20 disabled:opacity-60"
            />
            <button
              type="button"
              onClick={() => setShowPwd((s) => !s)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground rounded"
              aria-label={showPwd ? "Hide password" : "Show password"}
            >
              {showPwd ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>
        <Button
          type="submit"
          className="w-full h-10 font-medium cursor-pointer mt-4"
          disabled={!email.trim() || !password || busy !== null}
        >
          {busy === "password" && <Loader2 className="size-4 animate-spin" />}
          Sign in
        </Button>
      </form>

      <div className="relative my-5">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground">Or</span>
        </div>
      </div>

      <div className="space-y-2">
        <Button
          variant="outline"
          type="button"
          className="w-full h-10 font-medium flex items-center justify-center gap-2 cursor-pointer"
          disabled={busy !== null}
          onClick={() => handleOAuth("google")}
        >
          {busy === "google" ? <Loader2 className="size-4 animate-spin" /> : <GoogleIcon />}
          Continue with Google
        </Button>
        <Button
          variant="outline"
          type="button"
          className="w-full h-10 font-medium flex items-center justify-center gap-2 cursor-pointer"
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

      {error && (
        <div className="mt-4 flex items-start gap-2 text-xs text-destructive">
          <AlertCircle className="size-3.5 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </AuthShell>
  );
}

function humanizeAuthError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("invalid login") || m.includes("invalid credentials")) {
    return "Wrong email or password. Try again or reset your password.";
  }
  if (m.includes("email not confirmed")) {
    return "Please verify your email first — check your inbox for the confirmation link.";
  }
  if (m.includes("rate limit")) {
    return "Too many attempts. Wait a minute, then try again.";
  }
  return msg;
}
