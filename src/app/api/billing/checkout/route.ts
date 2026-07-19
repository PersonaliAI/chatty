import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

export async function POST(request: Request) {
  const b = await request.json().catch(() => ({}));
  const plan = typeof b.plan === "string" ? b.plan.toLowerCase() : "";
  const interval = b.interval === "yearly" ? "yearly" : "monthly";
  const variantId = VARIANT_IDS[plan]?.[interval];
  if (!variantId) return NextResponse.json({ error: "Invalid or unconfigured plan" }, { status: 400 });

  const apiKey = process.env.LEMONSQUEEZY_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Billing not configured" }, { status: 500 });

  // Pre-fill checkout for logged-in users; works for anonymous visitors too.
  let email: string | undefined;
  let userId: string | undefined;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) { email = user.email ?? undefined; userId = user.id; }
  } catch { /* unauthenticated – fine */ }

  const body = {
    data: {
      type: "checkouts",
      attributes: {
        checkout_data: {
          ...(email ? { email } : {}),
          ...(userId ? { custom: { auth_user_id: userId } } : {}),
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
