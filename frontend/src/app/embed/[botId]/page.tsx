import { headers } from "next/headers";
import EmbedClient from "./EmbedClient";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "https://chatty-api-376030619262.us-central1.run.app";

export default async function EmbedPage({
  params,
}: {
  params: Promise<{ botId: string }>;
}) {
  const { botId } = await params;
  const hdrs = await headers();
  const referer = hdrs.get("referer") || "";

  // Exchange the real Referer (only genuinely available here, on the
  // iframe's own document load) for a short-lived signed token the client
  // then attaches to every chat/media call. Never let this block the widget
  // — a failed/errored call just means the token comes back null and the
  // backend falls into its stricter unverified-origin rate tier.
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
    // graceful degradation — see comment above
  }

  return <EmbedClient botId={botId} originToken={originToken} />;
}
