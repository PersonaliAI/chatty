/** Runtime deployment switches shared by browser and server code.
 *
 * Chatty's application data plane is Supabase-backed in every supported
 * deployment. Only the LiveKit voice media plane may be self-hosted (see
 * backend/voice-agent); the retired full-stack OIDC deployment is deliberately
 * disabled so an old environment variable cannot silently select dead routes.
 */
export const SELF_HOST_MODE = false;

/** Kept as a stable internal constant for the backend-client compatibility
 * branches while downstream mirrors remove those unreachable branches. */
export const SELF_HOST_PROXY_PREFIX = "/api/self-host/proxy";
