import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { SELF_HOST_MODE } from '@/lib/deployment'

function publicOrigin(request: Request, fallback: string): string {
  // Firebase/App Hosting can supply an internal forwarded host during a
  // rollout. Prefer the canonical public origin so OAuth never exchanges a
  // code on one hostname and redirects the session to another.
  const configured = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (configured) return configured.replace(/\/$/, "");
  const proto = request.headers.get('x-forwarded-proto') ?? 'https'
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
  if (host) return `${proto}://${host}`
  return fallback
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  if (SELF_HOST_MODE) {
    const next = url.searchParams.get('next') ?? '/dashboard'
    const target = next.startsWith('/') ? next : '/dashboard'
    return NextResponse.redirect(`${url.origin}/login?next=${encodeURIComponent(target)}`)
  }
  const code = url.searchParams.get('code')
  const requestedNext = url.searchParams.get('next') ?? '/dashboard'
  const origin = publicOrigin(request, url.origin)

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/auth-code-error?reason=missing_code`)
  }

  // Supabase's PKCE exchange requires the verifier cookie created on the
  // login origin. Log only cookie names (never values) so a production
  // failure can be diagnosed without leaking credentials.
  const cookieNames = (request.headers.get('cookie') ?? '')
    .split(';')
    .map((part) => part.trim().split('=')[0])
    .filter(Boolean)
  const hasCodeVerifier = cookieNames.some((name) =>
    name.includes('code-verifier') || name.includes('code_verifier'),
  )

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    console.error('Auth callback exchange failed', {
      code: error.code ?? null,
      status: error.status ?? null,
      message: error.message,
      origin,
      hasCodeVerifier,
      cookieNames,
    })
    const reason = hasCodeVerifier ? 'exchange_failed' : 'missing_pkce_verifier'
    return NextResponse.redirect(`${origin}/auth/auth-code-error?reason=${reason}`)
  }

  // Chatty has no separate /onboarding route (unlike Kin) - onboarding is
  // per-bot and handled inline in the dashboard, so just honor `next`.
  const target = requestedNext.startsWith('/') ? requestedNext : '/dashboard'

  return NextResponse.redirect(`${origin}${target}`)
}
