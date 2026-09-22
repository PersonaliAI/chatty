import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { SELF_HOST_MODE, safeNextPath } from "@/lib/deployment";

const STATE_COOKIE = "chatty_oidc_state";
const VERIFIER_COOKIE = "chatty_oidc_verifier";
const NEXT_COOKIE = "chatty_oidc_next";
const TOKEN_COOKIE = "chatty_self_host_token";
const REFRESH_COOKIE = "chatty_self_host_refresh";

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

function publicOrigin(request: NextRequest): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (configured) return configured.replace(/\/$/, "");
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!host) throw new Error("Unable to determine public origin");
  return `${proto}://${host}`;
}

function equalSecret(left: string | undefined, right: string | undefined): boolean {
  if (!left || !right) return false;
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: NextRequest) {
  if (!SELF_HOST_MODE) return NextResponse.json({ error: "self-host mode is disabled" }, { status: 404 });

  const error = request.nextUrl.searchParams.get("error");
  if (error) return NextResponse.json({ error }, { status: 400 });

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const expectedState = request.cookies.get(STATE_COOKIE)?.value;
  const verifier = request.cookies.get(VERIFIER_COOKIE)?.value;
  const next = safeNextPath(request.cookies.get(NEXT_COOKIE)?.value);
  if (!code || !equalSecret(state ?? undefined, expectedState) || !verifier) {
    return NextResponse.json({ error: "Invalid or expired OIDC callback" }, { status: 400 });
  }

  const tokenEndpoint = process.env.OIDC_TOKEN_ENDPOINT;
  const clientId = process.env.OIDC_CLIENT_ID;
  if (!tokenEndpoint || !clientId) {
    return NextResponse.json({ error: "OIDC client is not configured" }, { status: 503 });
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: clientId,
    redirect_uri: `${publicOrigin(request)}/api/self-host/auth/callback`,
    code_verifier: verifier,
  });
  if (process.env.OIDC_CLIENT_SECRET) body.set("client_secret", process.env.OIDC_CLIENT_SECRET);

  const tokenResponse = await fetch(tokenEndpoint, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body,
    cache: "no-store",
  });
  if (!tokenResponse.ok) {
    console.error("OIDC token exchange failed", tokenResponse.status);
    return NextResponse.json({ error: "OIDC token exchange failed" }, { status: 502 });
  }

  const tokens = (await tokenResponse.json()) as {
    id_token?: string;
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };
  const bearer = tokens.id_token || tokens.access_token;
  if (!bearer) return NextResponse.json({ error: "OIDC provider returned no usable token" }, { status: 502 });

  const response = NextResponse.redirect(new URL(next, publicOrigin(request)));
  response.cookies.set(TOKEN_COOKIE, bearer, cookieOptions(Math.max(60, tokens.expires_in ?? 3600)));
  if (tokens.refresh_token) response.cookies.set(REFRESH_COOKIE, tokens.refresh_token, cookieOptions(60 * 60 * 24 * 30));
  response.cookies.set(STATE_COOKIE, "", { ...cookieOptions(0), maxAge: 0 });
  response.cookies.set(VERIFIER_COOKIE, "", { ...cookieOptions(0), maxAge: 0 });
  response.cookies.set(NEXT_COOKIE, "", { ...cookieOptions(0), maxAge: 0 });
  return response;
}
