import { createBrowserClient } from "@supabase/ssr";

export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co",
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder",
);

export const chattyApiUrl = (process.env.NEXT_PUBLIC_CHATTY_API_URL ?? "https://api.chatty.personaliai.com").replace(/\/$/, "");

export async function chattyRequest(path: string, options: RequestInit = {}) {
  const { data } = await supabase.auth.getSession();
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (data.session?.access_token) headers.set("Authorization", `Bearer ${data.session.access_token}`);
  const query = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const botId = query?.get("bot_id") || query?.get("botId") || "unknown";
  const handoffKey = `chatty-flow-handoff:${botId}`;
  const queryHandoff = query?.get("handoff") || null;
  const storedHandoff = typeof window !== "undefined" ? window.sessionStorage.getItem(handoffKey) : null;
  if (queryHandoff && typeof window !== "undefined") {
    window.sessionStorage.setItem(handoffKey, queryHandoff);
    // Keep the short-lived credential out of browser history and referrers.
    const cleanUrl = new URL(window.location.href);
    cleanUrl.searchParams.delete("handoff");
    window.history.replaceState({}, "", cleanUrl.toString());
  }
  if (!data.session?.access_token && (queryHandoff || storedHandoff)) headers.set("X-Chatty-Flow-Handoff", queryHandoff || storedHandoff || "");
  return fetch(`${chattyApiUrl}${path}`, { ...options, headers, credentials: "include" });
}

export async function getFlowSession() {
  return supabase.auth.getSession();
}

export function hasFlowHandoff() {
  if (typeof window === "undefined") return false;
  const queryHandoff = new URLSearchParams(window.location.search).get("handoff");
  const botId = new URLSearchParams(window.location.search).get("bot_id") || new URLSearchParams(window.location.search).get("botId") || "unknown";
  return Boolean(queryHandoff || window.sessionStorage.getItem(`chatty-flow-handoff:${botId}`));
}
