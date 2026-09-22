import { randomBytes, createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { SELF_HOST_MODE, safeNextPath } from "@/lib/deployment";

const STATE_COOKIE = "chatty_oidc_state";
const VERIFIER_COOKIE = "chatty_oidc_verifier";
const NEXT_COOKIE = "chatty_oidc_next";

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

function codeChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export async function GET(request: NextRequest) {
  if (!SELF_HOST_MODE) return NextResponse.json({ error: "self-host mode is disabled" }, { status: 404 });

  const authorizationEndpoint = process.env.OIDC_AUTHORIZATION_ENDPOINT;
  const clientId = process.env.OIDC_CLIENT_ID;
  if (!authorizationEndpoint || !clientId) {
    return NextResponse.json({ error: "OIDC client is not configured" }, { status: 503 });
  }

  const state = randomBytes(32).toString("base64url");
  const verifier = randomBytes(48).toString("base64url");
  const redirectUri = `${publicOrigin(request)}/api/self-host/auth/callback`;
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: process.env.OIDC_SCOPES || "openid profile email",
    state,
    code_challenge: codeChallenge(verifier),
    code_challenge_method: "S256",
  });

  const response = NextResponse.redirect(`${authorizationEndpoint}?${params.toString()}`);
  const options = cookieOptions(600);
  response.cookies.set(STATE_COOKIE, state, options);
  response.cookies.set(VERIFIER_COOKIE, verifier, options);
  response.cookies.set(NEXT_COOKIE, safeNextPath(request.nextUrl.searchParams.get("next")), options);
  return response;
}
