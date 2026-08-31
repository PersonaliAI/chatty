import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

function publicOrigin(request: NextRequest): string {
  const proto = request.headers.get('x-forwarded-proto') ?? 'https'
  const host =
    request.headers.get('x-forwarded-host') ??
    request.headers.get('host') ??
    request.nextUrl.host
  return `${proto}://${host}`
}

export async function middleware(request: NextRequest) {
  // FAIL-SAFE: if Supabase ever redirects an auth code to the root path,
  // forward it to /auth/callback on the public origin (not the container's
  // internal 0.0.0.0:8080 host).
  const code = request.nextUrl.searchParams.get('code')
  if (code && request.nextUrl.pathname === '/') {
    return NextResponse.redirect(`${publicOrigin(request)}/auth/callback?code=${code}`)
  }

  const response = await updateSession(request)

  // Embed domain lock: restrict which sites may iframe the widget (browser-enforced).
  const embedMatch = request.nextUrl.pathname.match(/^\/embed\/([^/]+)/)
  if (embedMatch) {
    const frameAncestors = await embedFrameAncestors(embedMatch[1])
    response.headers.set('Content-Security-Policy', `frame-ancestors ${frameAncestors}`)
  }

  return response
}

// Best-effort in-memory cache of the last known-good frame-ancestors value per
// bot. Persists for the lifetime of the server process/instance (resets on
// redeploy/cold-start) so a transient lookup failure can fall back to the
// bot's real configured value instead of a wildcard.
const frameAncestorsCache = new Map<string, string>()

async function embedFrameAncestors(botId: string): Promise<string> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return frameAncestorsCache.get(botId) ?? '*'
  try {
    const res = await fetch(
      `${url}/rest/v1/chatty_bots?id=eq.${encodeURIComponent(botId)}&select=allowed_domains`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } }
    )
    if (!res.ok) return frameAncestorsCache.get(botId) ?? '*'
    const rows = (await res.json()) as { allowed_domains?: string[] }[]
    const domains = rows?.[0]?.allowed_domains
    if (!domains || domains.length === 0) {
      // empty allowlist = embeddable anywhere; this is a legitimate
      // configuration state, so cache it as this bot's known-good value.
      frameAncestorsCache.set(botId, '*')
      return '*'
    }
    const parts = ["'self'"]
    for (const d of domains) {
      const clean = d.replace(/^https?:\/\//, '').replace(/\/.*$/, '')
      parts.push(`https://${clean}`, `https://*.${clean}`)
    }
    const frameAncestors = parts.join(' ')
    frameAncestorsCache.set(botId, frameAncestors)
    return frameAncestors
  } catch {
    // fail-open so the widget never breaks on a transient error, but prefer
    // the last known-good value over a wildcard when we have one cached.
    return frameAncestorsCache.get(botId) ?? '*'
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
