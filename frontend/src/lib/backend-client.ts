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
  let accessToken = data.session?.access_token;

  // A browser can retain an expired access token while Supabase's refresh
  // listener is still catching up (especially after a key rotation or a tab
  // restored from sleep). Do not send a request without first using the
  // session that is already available to the client.
  const request = (url: string, token?: string) => {
    const headers = new Headers(options.headers);
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return fetch(`${url}${path}`, { ...options, headers });
  };

  const configuredUrl = BACKEND_URL;
  const requestWithFallback = async (token?: string): Promise<Response> => {
    try {
      return await request(configuredUrl, token);
    } catch (error) {
      if (configuredUrl === PRODUCTION_BACKEND_URL) throw error;
      console.warn(`Configured backend unavailable for ${path}; retrying production API.`);
      return request(PRODUCTION_BACKEND_URL, token);
    }
  };

  let response = await requestWithFallback(accessToken);

  // Refresh exactly once after an authorization failure. A 401 means the
  // request was rejected before application work, so retrying the same
  // request with a newly issued token is safe for dashboard reads and writes.
  // ReadableStream bodies cannot be replayed; leave those responses alone.
  const body = options.body;
  const canReplayBody = !(body && typeof body === "object" && "getReader" in body);
  if (response.status === 401 && canReplayBody) {
    try {
      const refreshed = await supabase.auth.refreshSession();
      const refreshedToken = refreshed.data.session?.access_token;
      if (refreshedToken && refreshedToken !== accessToken) {
        accessToken = refreshedToken;
        response = await requestWithFallback(accessToken);
      }
    } catch {
      // Return the original 401. The caller can surface the normal
      // authentication error instead of masking it with a refresh failure.
    }
  }

  return response;
}
