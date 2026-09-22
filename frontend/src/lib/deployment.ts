/** Runtime deployment switches shared by browser and server code.
 *
 * The managed Supabase profile remains the default. Self-host mode deliberately
 * uses a same-origin BFF route so OIDC tokens never enter client JavaScript.
 */
export const SELF_HOST_MODE = process.env.NEXT_PUBLIC_DEPLOYMENT_PROFILE === "self_host";

export const SELF_HOST_PROXY_PREFIX = "/api/self-host/proxy";

export function safeNextPath(value: string | null | undefined, fallback = "/dashboard"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;
  return value;
}
