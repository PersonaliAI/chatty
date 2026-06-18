"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthShell } from "@/components/auth/auth-shell";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handle(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || busy) return;
    setBusy(true);
    setError(null);
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${origin}/reset-password`,
    });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <AuthShell title="Check your email" subtitle="Password reset link sent">
        <div className="text-center py-4">
          <div className="size-12 mx-auto rounded-full bg-emerald-50 grid place-items-center text-emerald-600 mb-3">
            <CheckCircle2 className="size-6" />
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            If an account exists for <b>{email}</b>, we sent a password reset link.
            <br />
            Click it to set a new password.
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
      title="Forgot your password?"
      subtitle="We'll email you a reset link"
      footer={
        <>
          Remembered it?{" "}
          <Link href="/login" className="font-medium text-foreground hover:underline">
            Back to sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handle} className="space-y-3">
        <div className="space-y-1.5">
          <label htmlFor="email" className="text-xs font-medium text-foreground/80">
            Email address
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={busy}
            placeholder="name@example.com"
            className="w-full h-10 px-3 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-foreground/20 disabled:opacity-60"
          />
        </div>
        <Button
          type="submit"
          className="w-full h-10 font-medium cursor-pointer mt-2"
          disabled={!email.trim() || busy}
        >
          {busy && <Loader2 className="size-4 animate-spin" />}
          Send reset link
        </Button>
        {error && (
          <div className="flex items-start gap-2 text-xs text-destructive">
            <AlertCircle className="size-3.5 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </form>
    </AuthShell>
  );
}
