"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ShieldCheck,
  Video,
  ExternalLink,
  MessageCircle,
  Sparkles,
} from "lucide-react";
import {
  InlineBookingCard,
} from "@/components/inline-booking-card";

interface BotThemeData {
  name?: string;
  primary_color?: string;
  logo_url?: string | null;
  avatar_url?: string | null;
  avatar_icon?: string | null;
  welcome_message?: string;
  calendar_scheduling_enabled?: boolean;
  meeting_provider?: string;
  hide_branding?: boolean;
}

interface BookClientProps {
  botId: string;
  botData: BotThemeData | null;
  sessionId?: string;
  sig?: string;
  t?: string;
  initialName?: string;
  initialEmail?: string;
  initialPhone?: string;
  initialCompany?: string;
  visitorTimezone?: string;
  backendUrl?: string;
}

export default function BookClient({
  botId,
  botData,
  sessionId,
  sig,
  t,
  initialName,
  initialEmail,
  initialPhone,
  initialCompany,
  visitorTimezone,
  backendUrl,
}: BookClientProps) {
  const botName = botData?.name || "Assistant";
  const primaryColor = botData?.primary_color || "#f97316";
  const hideBranding = Boolean(botData?.hide_branding);
  const provider = botData?.meeting_provider === "teams" ? "Microsoft Teams" : "Google Meet";
  const isWhatsAppSession = sessionId?.startsWith("wa:");

  const avatarUrl = botData?.logo_url || botData?.avatar_url;

  return (
    <div className="min-h-screen bg-gradient-to-b from-neutral-50 via-white to-neutral-100 dark:from-neutral-950 dark:via-neutral-900 dark:to-neutral-950 text-neutral-900 dark:text-neutral-100 flex flex-col font-sans transition-colors">
      {/* Top Banner Navigation Bar */}
      <header className="w-full border-b border-neutral-200/80 dark:border-neutral-800/80 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            {avatarUrl ? (
              <div className="relative size-9 rounded-full overflow-hidden border border-neutral-200 dark:border-neutral-700 shrink-0 bg-neutral-100 dark:bg-neutral-800">
                <Image
                  src={avatarUrl}
                  alt={botName}
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>
            ) : (
              <div
                className="size-9 rounded-full flex items-center justify-center text-white font-semibold text-sm shadow-2xs shrink-0"
                style={{ backgroundColor: primaryColor }}
              >
                {botName.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-bold truncate text-neutral-900 dark:text-neutral-100">
                {botName}
              </h1>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate flex items-center gap-1">
                <Sparkles className="size-3 text-amber-500" />
                Verified Appointment Scheduler
              </p>
            </div>
          </div>

          <div className="flex min-w-0 items-center gap-2 text-xs text-neutral-600 dark:text-neutral-400">
            <span className="inline-flex max-w-full items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60 text-[11px] font-medium">
              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="truncate">Live Availability</span>
            </span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 w-full max-w-2xl mx-auto px-3 py-6 sm:px-6 sm:py-10 flex flex-col justify-center">
        {/* WhatsApp Context Banner */}
        {isWhatsAppSession && (
          <div className="mb-4 p-3.5 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 flex items-start gap-3 shadow-2xs">
            <div className="p-1.5 rounded-lg bg-emerald-500 text-white shrink-0 mt-0.5">
              <MessageCircle className="size-4" />
            </div>
            <div className="text-xs text-emerald-900 dark:text-emerald-200">
              <p className="font-semibold text-[13px]">WhatsApp Booking Integration</p>
              <p className="text-emerald-700 dark:text-emerald-300/90 mt-0.5 leading-relaxed">
                You are booking via WhatsApp. Once confirmed, you will immediately receive your calendar invite and meeting details right back in your WhatsApp chat thread.
              </p>
            </div>
          </div>
        )}

        {/* Hero Card Header */}
        <div className="mb-4 text-center sm:text-left sm:flex sm:items-center sm:justify-between pb-2 border-b border-neutral-100 dark:border-neutral-800/80">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
              Select an Appointment Time
            </h2>
            <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 mt-1 break-words">
              Choose your preferred slot below to reserve your meeting with {botName}.
            </p>
          </div>
          <div className="mt-2 sm:mt-0 flex items-center justify-center sm:justify-end gap-2 text-[11px] text-neutral-500 dark:text-neutral-400">
            <span className="flex items-center gap-1">
              <Video className="size-3 text-neutral-400" />
              {provider}
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <ShieldCheck className="size-3 text-emerald-500" />
              Protected
            </span>
          </div>
        </div>

        {/* Embedded Interactive Booking Card */}
        <div className="w-full bg-white dark:bg-neutral-900 rounded-2xl shadow-xl shadow-neutral-200/50 dark:shadow-neutral-950/50 border border-neutral-200/80 dark:border-neutral-800 p-2 sm:p-4">
          <InlineBookingCard
            botId={botId}
            sessionId={sessionId}
            sig={sig}
            t={t}
            primaryColor={primaryColor}
            initialName={initialName}
            initialEmail={initialEmail}
            initialPhone={initialPhone}
            initialCompany={initialCompany}
            visitorTimezone={visitorTimezone}
            backendUrl={backendUrl}
          />
        </div>

        {/* Anti-Abuse & Security Notice */}
        <div className="mt-5 text-center text-[11px] text-neutral-400 dark:text-neutral-500 flex items-center justify-center gap-2">
          <ShieldCheck className="size-3.5 text-emerald-500 shrink-0" />
          <span>Protected by Chatty Abuse & Spam Defense: Zero spam, disposable email filtering & rate limits.</span>
        </div>
      </main>

      {/* Modern Responsive Footer */}
      <footer className="w-full border-t border-neutral-200/60 dark:border-neutral-800/60 py-6 px-4 text-center text-xs text-neutral-500 dark:text-neutral-400 bg-white/50 dark:bg-neutral-900/50">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>
            {!hideBranding ? (
              <p className="flex items-center justify-center sm:justify-start gap-1">
                <span>Powered by</span>
                <Link
                  href="https://chatty.personaliai.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-neutral-800 dark:text-neutral-200 hover:underline inline-flex items-center gap-0.5"
                >
                  Chatty
                  <ExternalLink className="size-3" />
                </Link>
                <span>AI Assistant Platform</span>
              </p>
            ) : (
              <p>© {new Date().getFullYear()} {botName}. All rights reserved.</p>
            )}
          </div>
          <div className="flex items-center gap-4 text-[11px]">
            <Link href="/privacy" className="hover:underline text-neutral-500 dark:text-neutral-400">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:underline text-neutral-500 dark:text-neutral-400">
              Terms of Service
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
