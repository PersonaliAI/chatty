import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { SELF_HOST_MODE } from "@/lib/deployment";

const POLAR_LIVE_API = "https://api.polar.sh/v1";
const POLAR_SANDBOX_API = "https://sandbox-api.polar.sh/v1";

const PRODUCT_IDS: Record<string, Record<"monthly" | "yearly", string | undefined>> = {
  hobby: {
    monthly: process.env.POLAR_PRODUCT_CHATTY_HOBBY || "979dfddc-ba2d-4034-8a4a-a2d7be837df0",
    yearly: process.env.POLAR_PRODUCT_CHATTY_HOBBY_YEARLY || "63deceb8-4708-41f7-bdd0-4f9c477777b2",
  },
  standard: {
    monthly: process.env.POLAR_PRODUCT_CHATTY_STANDARD || "44a3e476-d17e-47ad-abb7-34b36d6fb398",
    yearly: process.env.POLAR_PRODUCT_CHATTY_STANDARD_YEARLY || "2bf68bd0-1ca3-489d-ad2f-62015bcb4bab",
  },
  business: {
    monthly: process.env.POLAR_PRODUCT_CHATTY_BUSINESS || "65c1d174-3c79-4c5c-89fb-c22776c246e7",
    yearly: process.env.POLAR_PRODUCT_CHATTY_BUSINESS_YEARLY || "bfbcb1bc-a50c-4806-b187-9e427032a6ca",
  },
};

function clean(value: unknown, max = 160): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max).replace(/[^\w .:@/+~-]/g, "") : undefined;
}

function cleanReferralCode(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const code = value.trim().toLowerCase().slice(0, 80);
  return /^[a-z0-9][a-z0-9_-]{1,79}$/.test(code) ? code : undefined;
}

export async function POST(request: Request) {
  const b = await request.json().catch(() => ({}));
  const plan = typeof b.plan === "string" ? b.plan.toLowerCase() : "";
  const interval = b.interval === "yearly" ? "yearly" : "monthly";
  const referral = typeof b.referral === "object" && b.referral ? (b.referral as Record<string, unknown>) : {};
  const affiliateRef = cleanReferralCode(referral.ref);
  const productId = PRODUCT_IDS[plan]?.[interval];
  if (!productId) return NextResponse.json({ error: "Invalid or unconfigured plan" }, { status: 400 });

  const polarToken = process.env.POLAR_ACCESS_TOKEN?.trim();
  if (!polarToken) return NextResponse.json({ error: "Billing not configured (POLAR_ACCESS_TOKEN missing)" }, { status: 500 });

  // Pre-fill checkout for logged-in users; works for anonymous visitors too.
  let email: string | undefined;
  let userId: string | undefined;
  try {
    if (SELF_HOST_MODE) {
      const token = request.headers.get("cookie")?.match(/(?:^|;\s*)chatty_self_host_token=([^;]+)/)?.[1];
      const backend = process.env.SELF_HOST_BACKEND_URL;
      if (!token || !backend) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
      const profile = await fetch(`${backend.replace(/\/$/, "")}/api/user/profile`, {
        headers: { Authorization: `Bearer ${decodeURIComponent(token)}` },
        cache: "no-store",
      });
      if (!profile.ok) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
      const user = await profile.json();
      email = user.email ?? undefined;
      userId = user.auth_user_id || user.id;
    } else {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        email = user.email ?? undefined;
        userId = user.id;
        if (affiliateRef) {
          await supabase
            .from("users")
            .update({
              initial_referrer_code: affiliateRef,
              initial_utm_source: clean(referral.utm_source) || "affiliate",
              initial_utm_medium: clean(referral.utm_medium),
              initial_utm_campaign: clean(referral.utm_campaign),
              initial_landing_page: clean(referral.landing_page, 500),
              referred_at: clean(referral.captured_at) || new Date().toISOString(),
            })
            .eq("auth_user_id", user.id)
            .is("initial_referrer_code", null);
        }
      }
    }
  } catch {
    /* unauthenticated – fine */
  }

  const custom: Record<string, string> = {
    plan,
    interval,
    ...(userId ? { auth_user_id: userId, user_id: userId } : {}),
    ...(affiliateRef ? { affiliate_ref: affiliateRef } : {}),
    ...(clean(referral.utm_source) ? { utm_source: clean(referral.utm_source)! } : {}),
    ...(clean(referral.utm_medium) ? { utm_medium: clean(referral.utm_medium)! } : {}),
    ...(clean(referral.utm_campaign) ? { utm_campaign: clean(referral.utm_campaign)! } : {}),
    ...(clean(referral.landing_page, 500) ? { landing_page: clean(referral.landing_page, 500)! } : {}),
  };

  let origin = "https://chatty.personaliai.com";
  try {
    origin = new URL(request.url).origin || origin;
  } catch {
    /* keep default */
  }

  const body = {
    products: [productId],
    success_url: `${origin}/success`,
    ...(email ? { customer_email: email } : {}),
    ...(Object.keys(custom).length ? { metadata: custom } : {}),
  };

  const isSandboxPref = (process.env.POLAR_ENVIRONMENT || "").trim().toLowerCase() === "sandbox";
  const baseCandidates = isSandboxPref
    ? [POLAR_SANDBOX_API, POLAR_LIVE_API]
    : [POLAR_LIVE_API, POLAR_SANDBOX_API];

  let res: Response | null = null;
  for (const baseUrl of baseCandidates) {
    res = await fetch(`${baseUrl}/checkouts/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${polarToken}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (res.status !== 401 && res.status !== 404) {
      break;
    }
  }

  if (!res || !res.ok) {
    const err = res ? await res.json().catch(() => ({})) : {};
    console.error("Polar checkout error:", err);
    return NextResponse.json({ error: "Checkout creation failed" }, { status: 502 });
  }

  const json = (await res.json()) as { url?: string };
  const url = json.url;
  if (!url) return NextResponse.json({ error: "No checkout URL returned" }, { status: 502 });
  return NextResponse.json({ url });
}
