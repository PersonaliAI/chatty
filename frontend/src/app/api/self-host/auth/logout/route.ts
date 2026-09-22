import { NextResponse } from "next/server";
import { SELF_HOST_MODE } from "@/lib/deployment";

export async function POST() {
  if (!SELF_HOST_MODE) return NextResponse.json({ error: "self-host mode is disabled" }, { status: 404 });
  const response = NextResponse.json({ ok: true });
  for (const name of ["chatty_self_host_token", "chatty_self_host_refresh", "chatty_oidc_state", "chatty_oidc_verifier", "chatty_oidc_next"]) {
    response.cookies.set(name, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
  }
  return response;
}
