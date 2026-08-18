"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const VALID_PLANS = new Set(["hobby", "standard", "business"]);

export default function CheckoutPage() {
  return (
    <Suspense fallback={null}>
      <CheckoutPageInner />
    </Suspense>
  );
}

function CheckoutPageInner() {
  const searchParams = useSearchParams();
  const plan = (searchParams.get("plan") || "").toLowerCase();
  const interval = searchParams.get("interval") === "yearly" ? "yearly" : "monthly";
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!VALID_PLANS.has(plan)) {
      setError("Unknown plan.");
      return;
    }

    let cancelled = false;

    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        // Not signed in — route through signup, then straight back here once
        // auth completes, so the plan never gets lost along the way.
        const self = `/checkout?plan=${encodeURIComponent(plan)}&interval=${interval}`;
        window.location.href = `/signup?next=${encodeURIComponent(self)}`;
        return;
      }

      try {
        const res = await fetch("/api/billing/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan, interval }),
        });
        const data = (await res.json()) as { url?: string; error?: string };
        if (cancelled) return;
        if (!res.ok || !data.url) {
          setError(data.error || "Couldn't start checkout. Please try again.");
          return;
        }
        window.location.href = data.url;
      } catch {
        if (!cancelled) setError("Couldn't start checkout. Please try again.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [plan, interval]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
      {error ? (
        <div className="max-w-sm space-y-3">
          <AlertCircle className="size-8 mx-auto text-destructive" />
          <p className="text-sm text-muted-foreground">{error}</p>
          <a
            href="/dashboard"
            className="inline-block text-sm font-medium underline underline-offset-4"
          >
            Go to dashboard
          </a>
        </div>
      ) : (
        <div className="space-y-3">
          <Loader2 className="size-8 mx-auto animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Taking you to checkout…</p>
        </div>
      )}
    </div>
  );
}
