import { headers } from "next/headers";
import VerifyClient from "./VerifyClient";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "https://api.chatty.personaliai.com";

// Domain-verification handshake only — Stage 5 of the cross-origin iframe →
// Shadow DOM rewrite (C:\Users\HP\.claude\plans\gleaming-watching-sunrise.md).
// widget.js loads this in a 1x1 display:none iframe so the browser attaches
// a genuine, JS-unspoofable Referer header to this document's own request —
// the same mechanism ../page.tsx already relies on, just split into its own
// route now that the visible chat UI mounts directly into the host page's
// DOM instead of a full-panel iframe. Renders nothing visible; its only job
// is exchanging that Referer for a short-lived token and posting it back to
// the parent window once.
export default async function EmbedVerifyPage({
  params,
}: {
  params: Promise<{ botId: string }>;
}) {
  const { botId } = await params;
  const hdrs = await headers();
  const referer = hdrs.get("referer") || "";

  let originToken: string | null = null;
  try {
    const res = await fetch(`${BACKEND_URL}/api/widget/verify-origin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bot_id: botId, referer }),
      cache: "no-store",
    });
    if (res.ok) {
      const data = (await res.json()) as { token?: string };
      originToken = data.token ?? null;
    }
  } catch {
    // graceful degradation — a null token just means the backend falls back
    // to its stricter unverified-origin rate limit tier, never a hard block.
  }

  return <VerifyClient token={originToken} />;
}
