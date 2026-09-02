"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, AlertCircle, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthShell } from "@/components/auth/auth-shell";
import { createClient } from "@/lib/supabase/client";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "https://api.chatty.personaliai.com";

type ConsentInfo = {
  client_name: string;
  scopes: { id: string; description: string }[];
  user_email?: string | null;
};

// The OAuth2 consent screen an MCP client (or any third-party app) sends a
// user's browser to after GET /oauth/authorize on the backend — that
// endpoint has no HTML of its own, so it redirects here with the same
// query params. See chatty-backend/app/routers/oauth.py's module docstring
// for the full flow this page is step 3 of.
export default function OAuthConsentPage() {
  return (
    <Suspense fallback={null}>
      <OAuthConsentInner />
    </Suspense>
  );
}

function OAuthConsentInner() {
  const supabase = createClient();
  const searchParams = useSearchParams();
  const clientId = searchParams.get("client_id") || "";
  const redirectUri = searchParams.get("redirect_uri") || "";
  const scope = searchParams.get("scope") || "chat read";
  const state = searchParams.get("state");
  const codeChallenge = searchParams.get("code_challenge");
  const codeChallengeMethod = searchParams.get("code_challenge_method");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<ConsentInfo | null>(null);
  const [deciding, setDeciding] = useState<"approve" | "deny" | null>(null);

  useEffect(() => {
    (async () => {
      if (!clientId || !redirectUri) {
        setError("This link is missing required parameters — go back to the app you were connecting and try again.");
        setLoading(false);
        return;
      }
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        const dest = `/oauth/consent?${searchParams.toString()}`;
        window.location.href = `/login?next=${encodeURIComponent(dest)}`;
        return;
      }
      try {
        const res = await fetch(
          `${BACKEND_URL}/api/oauth/consent-info?client_id=${encodeURIComponent(clientId)}&scope=${encodeURIComponent(scope)}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (!res.ok) throw new Error(await friendlyError(res));
        setInfo(await res.json());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't load this app's details.");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function decide(approve: boolean) {
    if (deciding) return;
    setDeciding(approve ? "approve" : "deny");
    setError(null);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Your session expired — please log in again.");
      const res = await fetch(`${BACKEND_URL}/api/oauth/authorize`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          client_id: clientId,
          redirect_uri: redirectUri,
          scope,
          state: state || undefined,
          code_challenge: codeChallenge || undefined,
          code_challenge_method: codeChallengeMethod || undefined,
          approve,
        }),
      });
      if (!res.ok) throw new Error(await friendlyError(res));
      const { redirect_url } = await res.json();
      window.location.href = redirect_url;
    } catch (err) {
      setDeciding(null);
      setError(err instanceof Error ? err.message : "Something went wrong — please try again.");
    }
  }

  return (
    <AuthShell
      title="Connect an app"
      subtitle={info ? `${info.client_name} wants to access your Chatty account` : "Reviewing this request..."}
    >
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="flex items-start gap-2 text-sm text-red-600 dark:text-red-400">
          <AlertCircle className="size-4 shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      ) : info ? (
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-full bg-[#f97316]/10 flex items-center justify-center shrink-0">
              <ShieldCheck className="size-5 text-[#f97316]" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{info.client_name}</p>
              {info.user_email && (
                <p className="text-xs text-muted-foreground truncate">Signed in as {info.user_email}</p>
              )}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              This app will be able to
            </p>
            <ul className="space-y-1.5">
              {info.scopes.map((s) => (
                <li key={s.id} className="text-sm flex items-start gap-2">
                  <span className="text-[#f97316] mt-0.5">•</span>
                  <span>{s.description}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              disabled={deciding !== null}
              onClick={() => decide(false)}
            >
              {deciding === "deny" ? <Loader2 className="size-4 animate-spin" /> : "Deny"}
            </Button>
            <Button
              className="flex-1"
              disabled={deciding !== null}
              onClick={() => decide(true)}
            >
              {deciding === "approve" ? <Loader2 className="size-4 animate-spin" /> : "Allow"}
            </Button>
          </div>
        </div>
      ) : null}
    </AuthShell>
  );
}

async function friendlyError(res: Response): Promise<string> {
  const raw = await res.text();
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed?.detail === "string") return parsed.detail;
  } catch {
    // not JSON — fall through to raw text
  }
  return raw || `Request failed (${res.status})`;
}
