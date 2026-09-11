import type { SupabaseClient } from "@supabase/supabase-js";

export const PRODUCTION_BACKEND_URL = "https://api.chatty.personaliai.com";

export const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? PRODUCTION_BACKEND_URL;

export function backendUrl(path: string): string {
  return `${BACKEND_URL}${path}`;
}

/**
 * Authenticated dashboard-to-API transport.
 *
 * Keeping token attachment and fallback behavior here prevents individual
 * dashboard features from subtly diverging in their authorization behavior.
 */
export async function fetchBackend(
  supabase: SupabaseClient,
  path: string,
  options: RequestInit = {},
): Promise<Response> {
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
