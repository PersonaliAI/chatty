import { headers } from "next/headers";
import VoiceAgentEmbedClient from "./VoiceAgentEmbedClient";
import { BACKEND_URL } from "@/lib/backend-client";

export default async function VoiceAgentPage({
  params,
}: {
  params: Promise<{ botId: string }>;
}) {
  const { botId } = await params;
  const hdrs = await headers();
  const referer = hdrs.get("referer") || "";

  // Keep the same origin verification used by the chat embed. The token is
  // short-lived and scoped to this bot + embedding origin.
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
    // The voice token endpoint applies its normal unverified-origin limits if
    // verification is unavailable, so the embed remains usable.
  }

  return <VoiceAgentEmbedClient botId={botId} originToken={originToken} />;
}
