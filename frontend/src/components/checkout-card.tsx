"use client";

import React from "react";
import { CreditCard, ExternalLink, ShieldCheck, Lock } from "lucide-react";

export interface CheckoutCardData {
  provider: "stripe" | "lemonsqueezy" | "polar" | string;
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
  const amountFormatted = `$${(data.amount_cents / 100).toFixed(2)} ${data.currency.toUpperCase()}`;

  const getProviderBrand = () => {
    const p = (data.provider || "stripe").toLowerCase();
    if (p === "lemonsqueezy") {
      return {
        name: "Lemon Squeezy",
        badgeBg: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20",
        accent: "#ffc233",
      };
    }
    if (p === "polar") {
      return {
        name: "Polar.sh",
        badgeBg: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
        accent: "#0062ff",
      };
    }
    return {
      name: "Stripe",
      badgeBg: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/20",
      accent: "#635bff",
    };
  };

  const brand = getProviderBrand();

  return (
    <div className="my-2.5 max-w-sm w-full rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm overflow-hidden text-neutral-900 dark:text-white transition-all hover:shadow-md">
      {/* Top Header */}
      <div className="px-4 py-3 bg-neutral-50/80 dark:bg-neutral-950/80 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="size-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20">
            <CreditCard className="size-3.5" />
          </div>
          <span className="text-xs font-bold tracking-tight">Payment Request</span>
        </div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${brand.badgeBg}`}>
          {brand.name}
        </span>
      </div>

      {/* Body Details */}
      <div className="p-4 space-y-3">
        <div>
          <h4 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 leading-snug">
            {data.title}
          </h4>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl font-extrabold text-neutral-950 dark:text-white font-mono tracking-tight">
              {amountFormatted}
            </span>
          </div>
        </div>

        {/* Security Trust Badges */}
        <div className="flex items-center gap-3 text-[10px] text-neutral-400 dark:text-neutral-500 pt-1 border-t border-neutral-100 dark:border-neutral-850">
          <span className="flex items-center gap-1 font-medium">
            <Lock className="size-3 text-emerald-500" />
            256-bit SSL
          </span>
          <span className="flex items-center gap-1 font-medium">
            <ShieldCheck className="size-3 text-blue-500" />
            PCI-DSS Certified
          </span>
        </div>

        {/* Action Button */}
        <a
          href={data.url}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full py-2.5 px-4 rounded-xl text-white text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-sm hover:opacity-95 active:scale-98 cursor-pointer"
          style={{ backgroundColor: primaryColor }}
        >
          <span>Pay Securely with {brand.name}</span>
          <ExternalLink className="size-3.5" />
        </a>
      </div>
    </div>
  );
}
