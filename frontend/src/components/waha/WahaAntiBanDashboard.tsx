"use client";

import React from "react";
import type { WahaAntiBanStats, WahaConfigForm } from "./types";

interface Props {
  stats: WahaAntiBanStats | null;
  form: WahaConfigForm;
  onChange: (field: keyof WahaConfigForm, value: unknown) => void;
  disabled?: boolean;
}

export function WahaAntiBanDashboard({ stats, form, onChange, disabled }: Props) {
  const sent = stats?.current_daily_sent ?? 0;
  const cap = stats?.daily_cap ?? form.dailyCap ?? 20;
  const pct = cap ? Math.min(100, Math.round((sent / cap) * 100)) : 0;

  return (
    <div className="space-y-5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 p-5 sm:p-6 shadow-xs">
      {/* Header with Anti-Ban Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-4 border-b border-neutral-100 dark:border-neutral-800">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-sm sm:text-base font-semibold text-neutral-900 dark:text-neutral-100">
              Anti-Ban Shield & Telemetry
            </h4>
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300/50 dark:border-emerald-700/50">
              Deskcomm Engine
            </span>
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            Safeguards your WhatsApp number from automated detection, spam reporting, and hash flagging.
          </p>
        </div>
      </div>

      {/* 1. Progressive Warmup Progress */}
      <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/60 dark:border-neutral-800 space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-neutral-800 dark:text-neutral-200">
            SIM Age & Warm-Up Stage
          </span>
          <span className="px-2 py-0.5 rounded-md bg-white dark:bg-neutral-700 text-neutral-700 dark:text-neutral-200 border border-neutral-200/80 dark:border-neutral-600 font-mono text-[11px]">
            {stats?.stage_label || `Day ${form.simAgeDays} (${cap} msgs/day)`}
          </span>
        </div>

        {/* Quota Progress Bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-[11px] text-neutral-500 dark:text-neutral-400">
            <span>Messages dispatched today</span>
            <span className="font-medium text-neutral-800 dark:text-neutral-200">
              {sent} / {cap ? `${cap} msgs` : "Unlimited"}
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-neutral-200 dark:bg-neutral-700 overflow-hidden">
            <div
              className={`h-full transition-all duration-300 rounded-full ${
                pct > 85 ? "bg-amber-500" : pct > 98 ? "bg-rose-500" : "bg-emerald-500"
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div>
            <label className="block text-[11px] font-medium text-neutral-600 dark:text-neutral-400 mb-1">
              SIM Number Age (Days)
            </label>
            <input
              type="number"
              min={1}
              max={365}
              disabled={disabled}
              value={form.simAgeDays}
              onChange={(e) => onChange("simAgeDays", parseInt(e.target.value) || 1)}
              className="w-full px-3 py-1.5 text-xs rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-neutral-600 dark:text-neutral-400 mb-1">
              Custom Daily Cap (optional)
            </label>
            <input
              type="number"
              min={10}
              max={2000}
              disabled={disabled}
              value={form.dailyCap}
              onChange={(e) => onChange("dailyCap", parseInt(e.target.value) || 20)}
              className="w-full px-3 py-1.5 text-xs rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100"
            />
          </div>
        </div>
      </div>

      {/* 2. Cognitive Pacing & Presence */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="p-3.5 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
              Human Typing Presence
            </span>
            <input
              type="checkbox"
              disabled={disabled}
              checked={form.typingPresenceEnabled}
              onChange={(e) => onChange("typingPresenceEnabled", e.target.checked)}
              className="size-4 accent-emerald-500 rounded cursor-pointer"
            />
          </div>
          <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-relaxed">
            Emits WhatsApp &quot;typing...&quot; presence indicator (~45 char/sec) with randomized jitter to break bot timing signatures.
          </p>
        </div>

        <div className="p-3.5 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
              Opt-Out / DNC Shield
            </span>
            <input
              type="checkbox"
              disabled={disabled}
              checked={form.optOutShieldEnabled}
              onChange={(e) => onChange("optOutShieldEnabled", e.target.checked)}
              className="size-4 accent-emerald-500 rounded cursor-pointer"
            />
          </div>
          <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-relaxed">
            Immediately respects STOP/SAIR phrases and suppresses AI to prevent recipients from tapping &quot;Report as Spam&quot;.
          </p>
        </div>
      </div>

      {/* 3. Allowed Outbound Hours */}
      <div className="p-3.5 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div>
          <span className="font-semibold text-neutral-800 dark:text-neutral-200">
            Outbound Business Window
          </span>
          <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
            Suppresses automated retargeting or blasts outside waking hours.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            max={23}
            disabled={disabled}
            value={form.windowStartHour}
            onChange={(e) => onChange("windowStartHour", parseInt(e.target.value) || 0)}
            className="w-16 px-2 py-1 text-center font-mono rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900"
          />
          <span className="text-neutral-400">to</span>
          <input
            type="number"
            min={0}
            max={23}
            disabled={disabled}
            value={form.windowEndHour}
            onChange={(e) => onChange("windowEndHour", parseInt(e.target.value) || 23)}
            className="w-16 px-2 py-1 text-center font-mono rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900"
          />
          <span className="text-[11px] text-neutral-400 font-mono">hrs</span>
        </div>
      </div>
    </div>
  );
}
