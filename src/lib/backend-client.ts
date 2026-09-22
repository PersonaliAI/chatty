import type { SupabaseClient } from "@supabase/supabase-js";
import { SELF_HOST_MODE, SELF_HOST_PROXY_PREFIX } from "@/lib/deployment";

export const PRODUCTION_BACKEND_URL = "https://api.chatty.personaliai.com";

export const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? PRODUCTION_BACKEND_URL;

export function backendUrl(path: string): string {
  if (SELF_HOST_MODE) return `${SELF_HOST_PROXY_PREFIX}${path}`;
  return `${BACKEND_URL}${path}`;
}

/**
 * Authenticated dashboard-to-API transport.
 *
 * Keeping token attachment and fallback behavior here prevents individual
 * dashboard features from subtly diverging in their authorization behavior.
 */
export async function fetchBackend(path: string, options?: RequestInit): Promise<Response>;
export async function fetchBackend(supabase: SupabaseClient, path: string, options?: RequestInit): Promise<Response>;
export async function fetchBackend(
  supabaseOrPath: SupabaseClient | string,
  pathOrOptions?: string | RequestInit,
  maybeOptions: RequestInit = {},
): Promise<Response> {
  const supabase = typeof supabaseOrPath === "string" ? null : supabaseOrPath;
  const path = typeof supabaseOrPath === "string" ? supabaseOrPath : pathOrOptions as string;
  const options = typeof supabaseOrPath === "string" ? (pathOrOptions as RequestInit | undefined) ?? {} : maybeOptions;

  if (SELF_HOST_MODE) {
    return fetch(`${SELF_HOST_PROXY_PREFIX}${path}`, { ...options, credentials: "same-origin" });
  }

  if (!supabase) throw new Error("Supabase client is required in managed_supabase mode");
  const { data } = await supabase.auth.getSession();
  const headers = new Headers(options.headers);
  if (data.session?.access_token) headers.set("Authorization", `Bearer ${data.session.access_token}`);

  const configuredUrl = BACKEND_URL;
  try {
    return await fetch(`${configuredUrl}${path}`, { ...options, headers });
  } catch (error) {
    if (configuredUrl === PRODUCTION_BACKEND_URL) throw error;
    console.warn(`Configured backend unavailable for ${path}; retrying production API.`);
    return fetch(`${PRODUCTION_BACKEND_URL}${path}`, { ...options, headers });
  }
}
