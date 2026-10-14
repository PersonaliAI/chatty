import { headers } from "next/headers";
import EmbedClient from "./EmbedClient";
import { BACKEND_URL } from "@/lib/backend-client";

export default async function EmbedPage({
  params,
  searchParams,
}: {
  params: Promise<{ botId: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { botId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const directToken = typeof resolvedSearchParams.token === "string" ? resolvedSearchParams.token : null;

  const hdrs = await headers();
  const referer = hdrs.get("referer") || "";

  // If a pre-verified widget token was directly supplied (e.g. from the claim sandbox or preview),
  // use it directly. Otherwise exchange the real Referer for an origin token.
  let originToken: string | null = directToken;
  if (!originToken) {
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
      // graceful degradation
    }
  }

  return <EmbedClient botId={botId} originToken={originToken} />;
}
