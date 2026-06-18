import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function publicOrigin(request: Request, fallback: string): string {
  const proto = request.headers.get('x-forwarded-proto') ?? 'https'
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
  if (host) return `${proto}://${host}`
  return fallback
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const requestedNext = url.searchParams.get('next') ?? '/dashboard'
  const origin = publicOrigin(request, url.origin)

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/auth-code-error`)
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    console.error('Auth callback error:', error.message)
    return NextResponse.redirect(`${origin}/auth/auth-code-error`)
  }

  // Decide destination: if the user hasn't finished onboarding, send them
  // there regardless of the requested `next` param.
  let target = requestedNext.startsWith('/') ? requestedNext : '/dashboard'
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user) {
    const { data: kin } = await supabase
      .from('users')
      .select('onboarding_completed')
      .eq('auth_user_id', user.id)
      .maybeSingle()
    if (!kin || kin.onboarding_completed !== true) {
      target = '/onboarding'
    }
  }

  return NextResponse.redirect(`${origin}${target}`)
}
