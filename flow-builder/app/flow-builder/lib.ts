import { createBrowserClient } from "@supabase/ssr";

export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder",
);

export const chattyApiUrl = (process.env.NEXT_PUBLIC_CHATTY_API_URL ?? "https://api.chatty.personaliai.com").replace(/\/$/, "");

export async function chattyRequest(path: string, options: RequestInit = {}) {
  const { data } = await supabase.auth.getSession();
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (data.session?.access_token) headers.set("Authorization", `Bearer ${data.session.access_token}`);
  const queryHandoff = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("handoff") : null;
  const storedHandoff = typeof window !== "undefined" ? window.sessionStorage.getItem("chatty-flow-handoff") : null;
  if (queryHandoff && typeof window !== "undefined") window.sessionStorage.setItem("chatty-flow-handoff", queryHandoff);
  if (!data.session?.access_token && (queryHandoff || storedHandoff)) headers.set("X-Chatty-Flow-Handoff", queryHandoff || storedHandoff || "");
  return fetch(`${chattyApiUrl}${path}`, { ...options, headers });
}
