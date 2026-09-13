"use client";

import { BACKEND_URL } from "@/lib/backend-client";

const STORAGE_KEY = "chatty_affiliate_referral";
const COOKIE_KEY = "chatty_ref";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 60;

export interface AffiliateReferral {
  ref: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  landing_page?: string;
  captured_at: string;
}

function clean(value: string | null): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, 160).replace(/[^\w .:@/+~-]/g, "");
}

function cleanCode(value: string | null): string | undefined {
  if (!value) return undefined;
  const code = value.trim().toLowerCase().slice(0, 80);
  return /^[a-z0-9][a-z0-9_-]{1,79}$/.test(code) ? code : undefined;
}

function writeCookie(ref: string) {
  document.cookie = `${COOKIE_KEY}=${encodeURIComponent(ref)}; Max-Age=${COOKIE_MAX_AGE_SECONDS}; Path=/; SameSite=Lax; Secure`;
}

function readCookie(): string | undefined {
  const prefix = `${COOKIE_KEY}=`;
  return document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix))
    ?.slice(prefix.length);
}

export function captureAffiliateReferral(searchParams: URLSearchParams): AffiliateReferral | null {
  if (typeof window === "undefined") return null;
  const ref = cleanCode(searchParams.get("ref") || searchParams.get("via") || searchParams.get("affiliate"));
  if (!ref) return getAffiliateReferral();

  const referral: AffiliateReferral = {
    ref,
    utm_source: clean(searchParams.get("utm_source")) || "affiliate",
    utm_medium: clean(searchParams.get("utm_medium")),
    utm_campaign: clean(searchParams.get("utm_campaign")),
    landing_page: window.location.href.slice(0, 500),
    captured_at: new Date().toISOString(),
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(referral));
  writeCookie(ref);
  recordAffiliateClick(referral);
  return referral;
}

export function getAffiliateReferral(): AffiliateReferral | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<AffiliateReferral>;
      const ref = cleanCode(parsed.ref || null);
      if (ref) return { ...parsed, ref, captured_at: parsed.captured_at || new Date().toISOString() } as AffiliateReferral;
    }
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
  const ref = cleanCode(decodeURIComponent(readCookie() || ""));
  return ref ? { ref, utm_source: "affiliate", captured_at: new Date().toISOString() } : null;
}

function recordAffiliateClick(referral: AffiliateReferral) {
  fetch(`${BACKEND_URL}/api/affiliate/click`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    keepalive: true,
    body: JSON.stringify({
      referral_code: referral.ref,
      landing_page: referral.landing_page,
      referrer_url: document.referrer || undefined,
      utm_source: referral.utm_source,
      utm_medium: referral.utm_medium,
      utm_campaign: referral.utm_campaign,
      session_id: globalThis.crypto?.randomUUID?.(),
    }),
  }).catch(() => {});
}
