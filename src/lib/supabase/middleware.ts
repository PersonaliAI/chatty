import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

function publicOrigin(request: NextRequest): string {
  const proto = request.headers.get('x-forwarded-proto') ?? 'https'
  const host =
    request.headers.get('x-forwarded-host') ??
    request.headers.get('host') ??
    request.nextUrl.host
  return `${proto}://${host}`
}

const AUTH_PAGES = ['/login', '/signup', '/forgot-password', '/reset-password']

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        supabaseResponse = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        )
      },
    },
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const origin = publicOrigin(request)
  const path = request.nextUrl.pathname

  // Protect /dashboard
  if (!user && path.startsWith('/dashboard')) {
    return NextResponse.redirect(`${origin}/login`)
  }

  // Don't show signed-in users the auth pages — unless they're in the middle
  // of password recovery (handled inside /reset-password).
  if (user && AUTH_PAGES.includes(path)) {
    return NextResponse.redirect(`${origin}/dashboard`)
  }

  // NOTE: there is no route-level onboarding gate here (unlike Kin). Chatty's
  // onboarding is per-bot (chatty_bots.onboarding_completed), rendered inline
  // in the dashboard via <OnboardingWizard>, not a separate /onboarding route.

  return supabaseResponse
}
