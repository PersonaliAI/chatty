"use client";

import React from "react";
import { CreditCard, ExternalLink, ShieldCheck, Lock } from "lucide-react";

export interface CheckoutCardData {
  provider: "stripe" | "lemonsqueezy" | "polar" | "paypal" | string;
  title: string;
  amount_cents: number;
  currency: string;
  url: string;
}

interface CheckoutCardProps {
  data: CheckoutCardData;
  primaryColor?: string;
}

export function CheckoutCard({ data, primaryColor = "#f97316" }: CheckoutCardProps) {
  const currencyCode = (data.currency || "USD").toUpperCase();
  const numericAmount = (Number(data.amount_cents || 0) / 100).toFixed(2);
  const amountFormatted = `$${numericAmount} ${currencyCode}`;

  const getProviderBrand = () => {
    const p = (data.provider || "stripe").toLowerCase();
    if (p === "lemonsqueezy") {
      return {
        name: "Lemon Squeezy",
        badgeBg: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
      };
    }
    if (p === "paypal") {
      return {
        name: "PayPal",
        badgeBg: "bg-sky-500/10 text-sky-800 dark:text-sky-300 border-sky-500/20",
      };
    }
    if (p === "polar") {
      return {
        name: "Polar.sh",
        badgeBg: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20",
      };
    }
    return {
      name: "Stripe",
      badgeBg: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/20",
    };
  };

  const brand = getProviderBrand();

  return (
    <div className="my-1.5 w-full max-w-[320px] rounded-2xl border border-neutral-200/90 dark:border-neutral-700/80 bg-white dark:bg-neutral-900 shadow-sm overflow-hidden text-neutral-900 dark:text-white transition-all hover:shadow-md">
      {/* Top Header */}
      <div className="px-3.5 py-2.5 bg-neutral-50/90 dark:bg-neutral-950/80 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="size-6 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20 shrink-0">
            <CreditCard className="size-3.5" />
          </div>
          <span className="text-[11px] font-bold tracking-tight text-neutral-800 dark:text-neutral-200 truncate">
            Secure Checkout
          </span>
        </div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${brand.badgeBg}`}>
          {brand.name}
        </span>
      </div>

      {/* Body Details */}
      <div className="p-3.5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
              Order Item
            </div>
            <h4 className="text-xs sm:text-[13px] font-bold text-neutral-900 dark:text-neutral-100 leading-snug mt-0.5 break-words">
              {data.title || "Payment Request"}
            </h4>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
              Total
            </div>
            <div className="text-base sm:text-lg font-extrabold text-neutral-950 dark:text-white font-mono tracking-tight mt-0.5">
              ${numericAmount}
            </div>
            <div className="text-[9px] font-bold text-neutral-400 font-mono">
              {currencyCode}
            </div>
          </div>
        </div>

        {/* Action Button */}
        <a
          href={data.url}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full py-2.5 px-3.5 rounded-xl text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs hover:opacity-95 active:scale-[0.99] cursor-pointer no-underline"
          style={{ backgroundColor: primaryColor || "#f97316", color: "#ffffff" }}
        >
          <span>Pay {amountFormatted}</span>
          <ExternalLink className="size-3.5 shrink-0" />
        </a>

        {/* Security Trust Footer */}
        <div className="flex items-center justify-between gap-2 text-[10px] text-neutral-400 dark:text-neutral-500 pt-2 border-t border-neutral-100 dark:border-neutral-800">
          <span className="inline-flex items-center gap-1 font-medium">
            <Lock className="size-3 text-emerald-500 shrink-0" />
            <span>256-bit SSL Encrypted</span>
          </span>
          <span className="inline-flex items-center gap-1 font-medium">
            <ShieldCheck className="size-3 text-blue-500 shrink-0" />
            <span>PCI-DSS Level 1</span>
          </span>
        </div>
      </div>
    </div>
  );
}
