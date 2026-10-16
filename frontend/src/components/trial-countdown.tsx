"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { Clock, Sparkles, ArrowRight, ShieldCheck } from "lucide-react";
import { SELF_HOST_MODE } from "@/lib/deployment";

const PLAN_LABELS: Record<string, string> = {
  chatty_hobby: "Hobby",
  chatty_standard: "Standard",
  chatty_business: "Business",
  hobby: "Hobby",
  standard: "Standard",
  business: "Business",
  free: "Standard",
};

export interface TrialCountdownProps {
  plan?: string | null;
  subscriptionStatus?: string | null;
  createdAt?: string | null;
  trialStartedAt?: string | null;
  isSharedBot?: boolean;
  onUpgradeClick?: () => void;
  variant?: "pill" | "banner";
  className?: string;
}

export function TrialCountdown({
  plan,
  subscriptionStatus,
  createdAt,
  trialStartedAt,
  isSharedBot = false,
  onUpgradeClick,
  variant = "pill",
  className = "",
}: TrialCountdownProps) {
  // CRITICAL REQUIREMENT: Not applicable in self-host mode or for shared chatbots
  if (SELF_HOST_MODE || isSharedBot) {
    return null;
  }

  // Already paid / active subscription
  if (subscriptionStatus === "active") {
    return null;
  }

  const { daysRemaining, percentElapsed, isExpired, planName } = useMemo(() => {
    const rawPlan = (plan || "chatty_standard").toLowerCase();
    const name = PLAN_LABELS[rawPlan] || "Standard";

    const startDate = new Date(trialStartedAt || createdAt || Date.now());
    const trialDurationDays = 14;
    const trialDurationMs = trialDurationDays * 24 * 60 * 60 * 1000;
    const endDate = new Date(startDate.getTime() + trialDurationMs);
    const now = new Date();

    const msRemaining = endDate.getTime() - now.getTime();
    const days = Math.max(0, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)));
    const msElapsed = Math.max(0, now.getTime() - startDate.getTime());
    const pct = Math.min(100, Math.max(0, Math.round((msElapsed / trialDurationMs) * 100)));

    return {
      daysRemaining: days,
      percentElapsed: pct,
      isExpired: msRemaining <= 0,
      planName: name,
    };
  }, [plan, createdAt, trialStartedAt]);

  if (isExpired) {
    if (variant === "pill") {
      return (
        <button
          type="button"
          onClick={onUpgradeClick}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 text-[11px] font-bold hover:bg-amber-100 dark:hover:bg-amber-900 transition-colors cursor-pointer ${className}`}
          title="Free trial ended. Upgrade to continue without interruption."
        >
          <Clock className="size-3 text-amber-600 dark:text-amber-400" />
          <span>Trial Ended</span>
          <span className="font-extrabold underline underline-offset-2 ml-0.5">Upgrade</span>
        </button>
      );
    }

    return (
      <div
        className={`w-full p-3.5 sm:p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-950 dark:text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${className}`}
      >
        <div className="flex items-center gap-2.5">
          <Clock className="size-4.5 text-amber-600 dark:text-amber-400 shrink-0" />
          <div className="text-xs sm:text-sm font-medium">
            Your 14-day free trial for the <strong>{planName} Plan</strong> has ended. Upgrade to keep using your AI assistants.
          </div>
        </div>
        <button
          type="button"
          onClick={onUpgradeClick}
          className="h-8 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0"
        >
          <span>Upgrade Now</span>
          <ArrowRight className="size-3" />
        </button>
      </div>
    );
  }

  // Active 14-Day Free Trial
  if (variant === "pill") {
    return (
      <button
        type="button"
        onClick={onUpgradeClick}
        className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-[11px] font-bold hover:bg-emerald-100/80 dark:hover:bg-emerald-900/80 transition-all cursor-pointer shadow-xs active:scale-95 ${className}`}
        title={`You are currently enjoying the 14-day free trial on the ${planName} plan.`}
      >
        <span className="relative flex size-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full size-2 bg-emerald-500" />
        </span>
        <span className="font-semibold">{planName} Trial:</span>
        <span className="font-extrabold text-emerald-900 dark:text-emerald-200">
          {daysRemaining} {daysRemaining === 1 ? "day" : "days"} left
        </span>
        <span className="hidden md:inline text-[10px] text-emerald-700 dark:text-emerald-400 underline underline-offset-2 ml-0.5">
          Upgrade
        </span>
      </button>
    );
  }

  // Banner variant
  return (
    <div
      className={`w-full p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-emerald-50 via-teal-50/70 to-blue-50/50 dark:from-emerald-950/40 dark:via-teal-950/30 dark:to-blue-950/20 border border-emerald-200/90 dark:border-emerald-800/80 text-emerald-950 dark:text-emerald-100 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs ${className}`}
    >
      <div className="flex items-start sm:items-center gap-3">
        <div className="size-8 rounded-xl bg-emerald-100 dark:bg-emerald-900/60 grid place-items-center text-emerald-700 dark:text-emerald-300 shrink-0">
          <Sparkles className="size-4 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="text-xs sm:text-sm font-bold text-emerald-950 dark:text-white">
              {planName} 14-Day Free Trial
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-600 text-white uppercase tracking-wider">
              {daysRemaining} {daysRemaining === 1 ? "day" : "days"} left
            </span>
          </div>
          <p className="text-[11px] sm:text-xs text-emerald-800/80 dark:text-emerald-200/80">
            You have full access to all industrial AI capabilities with zero limits during your trial.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
        <button
          type="button"
          onClick={onUpgradeClick}
          className="h-8 px-3.5 rounded-xl bg-neutral-950 text-white dark:bg-white dark:text-neutral-950 font-bold text-xs inline-flex items-center justify-center gap-1.5 hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-all cursor-pointer shadow-xs active:scale-95"
        >
          <span>Select Plan</span>
          <ArrowRight className="size-3" />
        </button>
      </div>
    </div>
  );
}
