"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  X,
  Lock,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  LogOut,
} from "lucide-react";
import { SELF_HOST_MODE } from "@/lib/deployment";

const PLAN_CARDS: {
  id: "hobby" | "standard" | "business";
  label: string;
  monthly: number;
  yearly: number;
  blurb: string;
  popular?: boolean;
  features: string[];
}[] = [
  {
    id: "hobby",
    label: "Hobby",
    monthly: 19,
    yearly: 15,
    blurb: "Ideal for solo creators, developers, and testing out side-projects.",
    features: [
      "1,000 AI credits / month",
      "10M training characters",
      "3 active chatbots",
      "Fast AI response models",
      "AI Actions & Analytics",
      "Lead collection forms & API",
    ],
  },
  {
    id: "standard",
    label: "Standard",
    monthly: 99,
    yearly: 79,
    blurb: "The industry standard for growing teams, e-commerce, and business automation.",
    popular: true,
    features: [
      "10,000 AI credits / month",
      "20M training characters",
      "6 active chatbots",
      "Daily Auto-Train & web crawling",
      "Remove Chatty branding completely",
      "Unlimited team member seats",
      "Priority customer support",
    ],
  },
  {
    id: "business",
    label: "Business",
    monthly: 399,
    yearly: 319,
    blurb: "Full-scale autonomy, white-labeling, custom domains, and heavy traffic.",
    features: [
      "40,000 AI credits / month",
      "50M training characters",
      "Unlimited chatbots",
      "BYOK (Bring-Your-Own-Key) option",
      "Whitelabeling & custom domains",
      "Management Admin API access",
      "Dedicated account manager",
    ],
  },
];

export interface TrialExpiredModalProps {
  open: boolean;
  onClose?: () => void;
  currentPlan?: string | null;
  userEmail?: string | null;
  isSharedBot?: boolean;
  canDismiss?: boolean;
  reason?: "trial_ended" | "subscription_canceled" | "payment_failed" | "inactive";
  onSignOut?: () => void;
}

export function TrialExpiredModal({
  open,
  onClose,
  currentPlan,
  userEmail,
  isSharedBot = false,
  canDismiss = false,
  reason = "trial_ended",
  onSignOut,
}: TrialExpiredModalProps) {
  const [billingInterval, setBillingInterval] = useState<"monthly" | "yearly">("monthly");

  // Prevent scroll on body while uncancelable modal is open
  useEffect(() => {
    if (open && !SELF_HOST_MODE && !isSharedBot) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [open, isSharedBot]);

  // Trap Escape key when uncancelable
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (!canDismiss) {
          e.preventDefault();
          e.stopPropagation();
        } else if (onClose) {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, canDismiss, onClose]);

  if (!open || SELF_HOST_MODE || isSharedBot) {
    return null;
  }

  const selectedPlanId = (currentPlan || "standard").replace("chatty_", "").toLowerCase();

  const getHeaderContent = () => {
    switch (reason) {
      case "subscription_canceled":
        return {
          badge: "Subscription Canceled",
          badgeIcon: Lock,
          title: "Reactivate Your AI Assistants",
          subtitle:
            "Your subscription has completed and your website AI assistant is currently Offline to visitors. Select a plan below to immediately reactivate everything and bring your assistants back Online.",
        };
      case "payment_failed":
        return {
          badge: "Payment Required",
          badgeIcon: AlertCircle,
          title: "Resume Your AI Assistant Service",
          subtitle:
            "We could not process your latest subscription payment. Your AI assistant live responses are temporarily paused. Please select a plan or update your payment method to restore service immediately.",
        };
      case "inactive":
        return {
          badge: "Account Inactive",
          badgeIcon: Lock,
          title: "Activate Your AI Assistants",
          subtitle:
            "Your account currently has no active subscription. Assistant responses and live chat on your site are set to Offline. Select a plan below to activate your account.",
        };
      case "trial_ended":
      default:
        return {
          badge: "14-Day Free Trial Ended",
          badgeIcon: Lock,
          title: "Unlock Full Access to Your AI Assistants",
          subtitle:
            "Your 14-day trial has completed. Assistant live responses on your website are currently set to Offline, and playground testing is frozen. Select a plan below to immediately activate your account and bring your assistants online.",
        };
    }
  };

  const header = getHeaderContent();
  const BadgeIcon = header.badgeIcon;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-y-auto bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        // Prevent dismissal if not dismissible
        if (canDismiss && onClose && e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="relative w-full max-w-4xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl shadow-2xl p-5 sm:p-8 overflow-hidden my-auto max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow accent in top corner */}
        <div className="absolute -top-24 -right-24 size-72 bg-[#f97316]/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 size-72 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Close / Dismiss button (ONLY if dismissible) */}
        {canDismiss && onClose && (
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 sm:top-6 sm:right-6 size-9 rounded-full bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white flex items-center justify-center transition-colors z-10 cursor-pointer"
            title="Explore in Read-Only Mode"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        )}

        {/* Header */}
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 text-xs font-bold tracking-wide uppercase">
            <BadgeIcon className="size-3.5" />
            <span>{header.badge}</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold text-neutral-950 dark:text-white tracking-tight">
            {header.title}
          </h2>

          <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed">
            {header.subtitle}
          </p>

          {/* Monthly / Yearly Toggle */}
          <div className="pt-2 flex items-center justify-center">
            <div className="inline-flex items-center gap-1 bg-neutral-100 dark:bg-neutral-800 p-1 rounded-2xl border border-neutral-200 dark:border-neutral-700">
              <button
                type="button"
                onClick={() => setBillingInterval("monthly")}
                className={`px-4 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  billingInterval === "monthly"
                    ? "bg-white dark:bg-neutral-900 text-neutral-950 dark:text-white shadow-xs"
                    : "text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
                }`}
              >
                Monthly Billing
              </button>
              <button
                type="button"
                onClick={() => setBillingInterval("yearly")}
                className={`px-4 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
                  billingInterval === "yearly"
                    ? "bg-white dark:bg-neutral-900 text-neutral-950 dark:text-white shadow-xs"
                    : "text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
                }`}
              >
                <span>Yearly Billing</span>
                <span className="px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[10px] font-extrabold">
                  Save 20%
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5 mt-6 sm:mt-8">
          {PLAN_CARDS.map((card) => {
            const isPreferred = card.id === selectedPlanId;
            const price = billingInterval === "yearly" ? card.yearly : card.monthly;

            return (
              <div
                key={card.id}
                className={`relative flex flex-col justify-between rounded-3xl p-5 sm:p-6 transition-all duration-200 ${
                  card.popular
                    ? "border-2 border-[#f97316] bg-gradient-to-b from-orange-50/50 to-white dark:from-orange-950/20 dark:to-neutral-900 shadow-xl"
                    : "border border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-900/60 hover:border-neutral-300 dark:hover:border-neutral-700"
                }`}
              >
                {card.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-[#f97316] text-white text-[10px] font-mono uppercase font-black tracking-widest shadow-md">
                    Most Popular
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="text-base sm:text-lg font-bold text-neutral-900 dark:text-white">
                      {card.label}
                    </h3>
                    {isPreferred && (
                      <span className="px-2 py-0.5 rounded-md bg-neutral-200 dark:bg-neutral-800 text-[10px] font-bold text-neutral-600 dark:text-neutral-300">
                        Selected Plan
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 min-h-[34px]">
                    {card.blurb}
                  </p>

                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-3xl sm:text-4xl font-black text-neutral-950 dark:text-white">
                      ${price}
                    </span>
                    <span className="text-xs text-neutral-500 dark:text-neutral-400">/month</span>
                  </div>
                  {billingInterval === "yearly" && (
                    <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5">
                      Billed annually (${price * 12}/year)
                    </p>
                  )}

                  {/* Feature Checklist */}
                  <ul className="mt-5 space-y-2 text-xs text-neutral-700 dark:text-neutral-300">
                    {card.features.map((feat) => (
                      <li key={feat} className="flex items-start gap-2">
                        <CheckCircle2 className="size-3.5 text-[#f97316] shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* CTA Button */}
                <div className="mt-6 pt-4 border-t border-neutral-200/80 dark:border-neutral-800">
                  <Link
                    href={`/checkout?plan=${card.id}&interval=${billingInterval}`}
                    className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm ${
                      card.popular
                        ? "bg-[#f97316] hover:bg-[#ea580c] text-white shadow-[#f97316]/20 active:scale-95"
                        : "bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:hover:bg-neutral-100 dark:text-neutral-950 active:scale-95"
                    }`}
                  >
                    <span>Activate {card.label}</span>
                    <ArrowRight className="size-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer info & Account actions */}
        <div className="mt-6 pt-5 border-t border-neutral-200 dark:border-neutral-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-neutral-500 dark:text-neutral-400">
          <div className="flex items-center gap-2 text-center sm:text-left">
            <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Encrypted checkout powered by Lemon Squeezy. Switch plans or cancel anytime.</span>
          </div>

          <div className="flex items-center flex-wrap gap-3">
            {userEmail && (
              <span className="text-[11px] text-neutral-500">
                Account: <strong className="text-neutral-700 dark:text-neutral-300 font-medium">{userEmail}</strong>
              </span>
            )}

            {onSignOut && (
              <button
                type="button"
                onClick={onSignOut}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white underline underline-offset-4 cursor-pointer"
              >
                <LogOut className="size-3" />
                <span>Log Out</span>
              </button>
            )}

            <a
              href="mailto:billing@personaliai.com"
              className="text-[11px] text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 underline underline-offset-4"
            >
              Billing Support
            </a>

            {canDismiss && onClose && (
              <button
                type="button"
                onClick={onClose}
                className="text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200 underline underline-offset-4 cursor-pointer font-medium"
              >
                Continue viewing in Read-Only Mode
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
