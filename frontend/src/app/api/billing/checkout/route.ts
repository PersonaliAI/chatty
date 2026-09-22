import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { SELF_HOST_MODE } from "@/lib/deployment";

const LS_API = "https://api.lemonsqueezy.com/v1";
const STORE_ID = "161795";

const VARIANT_IDS: Record<string, Record<"monthly" | "yearly", string | undefined>> = {
  hobby: {
    monthly: process.env.LEMONSQUEEZY_VARIANT_CHATTY_HOBBY,
    yearly: process.env.LEMONSQUEEZY_VARIANT_CHATTY_HOBBY_YEARLY,
  },
  standard: {
    monthly: process.env.LEMONSQUEEZY_VARIANT_CHATTY_STANDARD,
    yearly: process.env.LEMONSQUEEZY_VARIANT_CHATTY_STANDARD_YEARLY,
  },
  business: {
    monthly: process.env.LEMONSQUEEZY_VARIANT_CHATTY_BUSINESS,
    yearly: process.env.LEMONSQUEEZY_VARIANT_CHATTY_BUSINESS_YEARLY,
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
  const referral = typeof b.referral === "object" && b.referral ? b.referral as Record<string, unknown> : {};
  const affiliateRef = cleanReferralCode(referral.ref);
  const variantId = VARIANT_IDS[plan]?.[interval];
  if (!variantId) return NextResponse.json({ error: "Invalid or unconfigured plan" }, { status: 400 });

  const apiKey = process.env.LEMONSQUEEZY_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Billing not configured" }, { status: 500 });

  // Pre-fill checkout for logged-in users; works for anonymous visitors too.
  let email: string | undefined;
  let userId: string | undefined;
  try {
    if (SELF_HOST_MODE) {
      const token = request.headers.get("cookie")?.match(/(?:^|;\s*)chatty_self_host_token=([^;]+)/)?.[1];
      const backend = process.env.SELF_HOST_BACKEND_URL;
      if (!token || !backend) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
      const profile = await fetch(`${backend.replace(/\/$/, "")}/api/user/profile`, {
        headers: { Authorization: `Bearer ${decodeURIComponent(token)}` }, cache: "no-store",
      });
      if (!profile.ok) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
      const user = await profile.json();
      email = user.email ?? undefined;
      userId = user.auth_user_id || user.id;
    } else {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
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
  } catch { /* unauthenticated – fine */ }

  const custom: Record<string, string> = {
    ...(userId ? { auth_user_id: userId, user_id: userId } : {}),
    ...(affiliateRef ? { affiliate_ref: affiliateRef } : {}),
    ...(clean(referral.utm_source) ? { utm_source: clean(referral.utm_source)! } : {}),
    ...(clean(referral.utm_medium) ? { utm_medium: clean(referral.utm_medium)! } : {}),
    ...(clean(referral.utm_campaign) ? { utm_campaign: clean(referral.utm_campaign)! } : {}),
    ...(clean(referral.landing_page, 500) ? { landing_page: clean(referral.landing_page, 500)! } : {}),
  };

  const body = {
    data: {
      type: "checkouts",
      attributes: {
        checkout_data: {
          ...(email ? { email } : {}),
          ...(Object.keys(custom).length ? { custom } : {}),
        },
        product_options: {
          redirect_url: "https://chatty.personaliai.com/success",
        },
      },
      relationships: {
        store: { data: { type: "stores", id: STORE_ID } },
        variant: { data: { type: "variants", id: variantId } },
      },
    },
  };

  const res = await fetch(`${LS_API}/checkouts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/vnd.api+json",
      "Content-Type": "application/vnd.api+json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.error("LS checkout error:", err);
    return NextResponse.json({ error: "Checkout creation failed" }, { status: 502 });
  }

  const json = (await res.json()) as { data?: { attributes?: { url?: string } } };
  const url = json.data?.attributes?.url;
  if (!url) return NextResponse.json({ error: "No checkout URL returned" }, { status: 502 });
  return NextResponse.json({ url });
}
