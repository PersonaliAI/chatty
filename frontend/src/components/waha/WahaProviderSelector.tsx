"use client";

import React from "react";
import type { WhatsAppProvider } from "./types";

interface Props {
  provider: WhatsAppProvider;
  onChange: (provider: WhatsAppProvider) => void;
  disabled?: boolean;
}

export function WahaProviderSelector({ provider, onChange, disabled }: Props) {
  return (
    <div className="w-full rounded-2xl bg-neutral-50 dark:bg-neutral-900/60 p-1.5 sm:p-2 border border-neutral-200/80 dark:border-neutral-800 transition-all">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {/* Option 1: Official Meta Cloud API */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange("official")}
          className={`flex flex-col text-left p-3.5 sm:p-4 rounded-xl border transition-all duration-200 cursor-pointer ${
            provider === "official"
              ? "bg-white dark:bg-neutral-800 border-emerald-500/80 shadow-xs dark:shadow-none ring-1 ring-emerald-500/30"
              : "bg-transparent border-transparent hover:bg-neutral-100/70 dark:hover:bg-neutral-800/50 opacity-75 hover:opacity-100"
          }`}
        >
          <div className="flex items-center justify-between w-full mb-1.5">
            <div className="flex items-center gap-2">
              <span className={`size-2.5 rounded-full ${provider === "official" ? "bg-emerald-500" : "bg-neutral-400"}`} />
              <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                Official Meta Cloud API
              </span>
            </div>
            <span className="text-[10px] font-medium tracking-wide uppercase px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300">
              Verified
            </span>
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
            Meta Business Partner connection. Zero account ban risk, paid per-conversation pricing, 24-hour service window rules.
          </p>
        </button>

        {/* Option 2: Self-Hosted WAHA (NOWEB) */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange("waha")}
          className={`flex flex-col text-left p-3.5 sm:p-4 rounded-xl border transition-all duration-200 cursor-pointer ${
            provider === "waha"
              ? "bg-white dark:bg-neutral-800 border-emerald-500/80 shadow-xs dark:shadow-none ring-1 ring-emerald-500/30"
              : "bg-transparent border-transparent hover:bg-neutral-100/70 dark:hover:bg-neutral-800/50 opacity-75 hover:opacity-100"
          }`}
        >
          <div className="flex items-center justify-between w-full mb-1.5">
            <div className="flex items-center gap-2">
              <span className={`size-2.5 rounded-full ${provider === "waha" ? "bg-emerald-500" : "bg-neutral-400"}`} />
              <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                Self-Hosted WAHA (NOWEB)
              </span>
            </div>
            <span className="text-[10px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              Zero Fees
            </span>
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
            Direct QR code device pairing on your VPS. Full DeskcommCRM anti-ban pacing, text spinning & progressive warm-up.
          </p>
        </button>
      </div>
    </div>
  );
}
