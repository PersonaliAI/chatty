import { NextRequest, NextResponse } from "next/server";
import { SELF_HOST_MODE } from "@/lib/deployment";

const TOKEN_COOKIE = "chatty_self_host_token";

type RouteContext = { params: Promise<{ path: string[] }> };

async function forward(request: NextRequest, context: RouteContext): Promise<Response> {
  if (!SELF_HOST_MODE) return NextResponse.json({ error: "self-host mode is disabled" }, { status: 404 });
  const backend = (process.env.SELF_HOST_BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || "").replace(/\/$/, "");
  if (!backend) return NextResponse.json({ error: "self-host backend is not configured" }, { status: 503 });

  const { path } = await context.params;
  if (!path?.length || path.some((part) => part === ".." || part === ".")) {
    return NextResponse.json({ error: "invalid backend path" }, { status: 400 });
  }
  const target = `${backend}/${path.map(encodeURIComponent).join("/")}${request.nextUrl.search}`;
  const token = request.cookies.get(TOKEN_COOKIE)?.value;
  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("cookie");
  headers.delete("authorization");
  if (token) headers.set("authorization", `Bearer ${token}`);

  const init: RequestInit = { method: request.method, headers, redirect: "manual", cache: "no-store" };
  if (!['GET', 'HEAD'].includes(request.method)) init.body = await request.arrayBuffer();
  let upstream: Response;
  try {
    upstream = await fetch(target, init);
  } catch {
    return NextResponse.json({ error: "self-host backend unavailable" }, { status: 502 });
  }

  const responseHeaders = new Headers();
  for (const name of ["content-type", "content-disposition", "cache-control", "etag", "location", "x-request-id"]) {
    const value = upstream.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }
  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

export const GET = forward;
export const POST = forward;
export const PUT = forward;
export const PATCH = forward;
export const DELETE = forward;
export const HEAD = forward;
