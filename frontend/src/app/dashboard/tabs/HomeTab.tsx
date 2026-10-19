"use client";

import React, { useMemo } from "react";
import {
  Sparkles,
  TrendingUp,
  MessageSquare,
  Database,
  Users,
  CheckCircle2,
  Star,
  Clock,
  ChevronRight,
  Palette,
  Code2,
} from "lucide-react";
import type { CsatFeedbackItem, Lead } from "../dashboard-types";

interface HomeTabProps {
  setActiveTab: (tab: string) => void;
  totalSessions: number;
  sources: { charCount: number }[];
  leads: Lead[] | any[];
  resolutionRate: string;
  csatScore: string;
  busiestHour: string;
  csatFeedback: CsatFeedbackItem[];
}

const CSAT_EMOJIS: Record<
  number,
  { emoji: string; label: string; textClass: string; bgClass: string; borderClass: string }
> = {
  5: {
    emoji: "🤩",
    label: "Delighted",
    textClass: "text-emerald-600 dark:text-emerald-400",
    bgClass: "bg-emerald-50 dark:bg-emerald-950/50",
    borderClass: "border-emerald-200 dark:border-emerald-800/50",
  },
  4: {
    emoji: "🙂",
    label: "Satisfied",
    textClass: "text-teal-600 dark:text-teal-400",
    bgClass: "bg-teal-50 dark:bg-teal-950/50",
    borderClass: "border-teal-200 dark:border-teal-800/50",
  },
  3: {
    emoji: "😐",
    label: "Neutral",
    textClass: "text-amber-600 dark:text-amber-400",
    bgClass: "bg-amber-50 dark:bg-amber-950/50",
    borderClass: "border-amber-200 dark:border-amber-800/50",
  },
  2: {
    emoji: "😕",
    label: "Disappointed",
    textClass: "text-orange-600 dark:text-orange-400",
    bgClass: "bg-orange-50 dark:bg-orange-950/50",
    borderClass: "border-orange-200 dark:border-orange-800/50",
  },
  1: {
    emoji: "😞",
    label: "Frustrated",
    textClass: "text-rose-600 dark:text-rose-400",
    bgClass: "bg-rose-50 dark:bg-rose-950/50",
    borderClass: "border-rose-200 dark:border-rose-800/50",
  },
};

function formatRelativeTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHr / 24);

    if (diffMin < 1) return "Just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDay === 1) return "1 day ago";
    if (diffDay < 7) return `${diffDay} days ago`;
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "Recently";
  }
}

export function HomeTab({
  setActiveTab,
  totalSessions,
  sources,
  leads,
  resolutionRate,
  csatScore,
  busiestHour,
  csatFeedback,
}: HomeTabProps) {
  // Use real feedback only
  const displayFeedback = useMemo(() => {
    if (csatFeedback && csatFeedback.length > 0) {
      return csatFeedback.slice(0, 5);
    }
    return [];
  }, [csatFeedback]);

  // Derived metrics from real telemetry
  const convCount = totalSessions || 0;
  const trainedActiveCount = sources.length || 0;
  const charCount = sources.reduce((acc, s) => acc + (s.charCount || 0), 0);
  const leadCount = leads.length || 0;
  const resRateFormatted = resolutionRate || "-";

  // Real CSAT score computed directly from csatFeedback ratings, with fallback to csatScore
  const calculatedCsat = useMemo(() => {
    if (csatFeedback && csatFeedback.length > 0) {
      const valid = csatFeedback.filter((f) => typeof f.rating === "number" && f.rating > 0);
      if (valid.length > 0) {
        return (valid.reduce((sum, f) => sum + f.rating, 0) / valid.length).toFixed(1);
      }
    }
    if (csatScore && csatScore !== "-" && csatScore !== "0.0") {
      if (csatScore.includes("%")) {
        const pct = parseFloat(csatScore);
        if (!isNaN(pct)) return ((pct / 100) * 5).toFixed(1);
      }
      return csatScore;
    }
    return "-";
  }, [csatFeedback, csatScore]);

  const busyHourDisplay = busiestHour && busiestHour !== "-" ? busiestHour : "-";

  return (
    <div className="max-w-5xl mx-auto w-full space-y-6 py-6 px-4 flex flex-col">
      {/* ========================================================
          1. WELCOME BANNER (With Colorful Step Icons)
          ======================================================== */}
      <div className="p-4 sm:p-6 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-sm">
        <h3 className="text-sm font-bold flex items-center gap-2 text-neutral-900 dark:text-neutral-100">
          <Sparkles className="size-4 text-[#f97316]" />
          Welcome to Chatty!
        </h3>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1.5 leading-relaxed max-w-2xl">
          Your chatbot is online and ready to be installed. Follow the quick steps below to train its memory, customize its visuals, and embed the code snippet onto your website.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
          <button
            type="button"
            onClick={() => setActiveTab("knowledge")}
            className="group p-4 text-left rounded-xl border border-neutral-200/90 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/40 hover:border-emerald-300 dark:hover:border-emerald-700/60 hover:bg-emerald-50/20 transition-all cursor-pointer flex items-start gap-3.5"
          >
            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/40 shrink-0 group-hover:scale-105 transition-transform">
              <Database className="size-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-neutral-800 dark:text-neutral-200 group-hover:text-emerald-700 dark:group-hover:text-emerald-300 transition-colors">
                1. Train Memory
              </div>
              <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-1 leading-relaxed">
                Add URLs, text documents, or API sync sources.
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("customizer")}
            className="group p-4 text-left rounded-xl border border-neutral-200/90 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/40 hover:border-purple-300 dark:hover:border-purple-700/60 hover:bg-purple-50/20 transition-all cursor-pointer flex items-start gap-3.5"
          >
            <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-800/40 shrink-0 group-hover:scale-105 transition-transform">
              <Palette className="size-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-neutral-800 dark:text-neutral-200 group-hover:text-purple-700 dark:group-hover:text-purple-300 transition-colors">
                2. Customize Style
              </div>
              <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-1 leading-relaxed">
                Preset designs: Minimalist, Glassmorphism, Neumorphism.
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("integrations")}
            className="group p-4 text-left rounded-xl border border-neutral-200/90 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/40 hover:border-sky-300 dark:hover:border-sky-700/60 hover:bg-sky-50/20 transition-all cursor-pointer flex items-start gap-3.5"
          >
            <div className="p-2.5 rounded-xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 border border-sky-100 dark:border-sky-800/40 shrink-0 group-hover:scale-105 transition-transform">
              <Code2 className="size-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-neutral-800 dark:text-neutral-200 group-hover:text-sky-700 dark:group-hover:text-sky-300 transition-colors">
                3. Install Script
              </div>
              <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-1 leading-relaxed">
                Copy code scripts or iframe elements for your webpage.
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* ========================================================
          2. METRIC ROW 1: Conversations, Sources, Leads (With Waves & Bars)
          ======================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {/* Card 1: CONVERSATIONS (Green Wave) */}
        <div className="p-4 sm:p-5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl flex flex-col justify-between overflow-hidden shadow-sm relative">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[10px] text-neutral-400 dark:text-neutral-500 uppercase font-semibold tracking-wider">
                Conversations
              </span>
              <h4 className="text-2xl font-bold mt-1 text-neutral-900 dark:text-neutral-100 tracking-tight">
                {convCount}
              </h4>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1 mt-1 bg-emerald-50 dark:bg-emerald-950/50 px-1.5 py-0.5 rounded-md border border-emerald-100 dark:border-emerald-800/30 w-fit">
                <TrendingUp className="size-3" /> Total visitor sessions
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/40 shrink-0 shadow-sm">
              <MessageSquare className="size-5" />
            </div>
          </div>

          {/* Smooth Green SVG Wave Style */}
          <div className="mt-4 -mx-5 -mb-5 h-14 overflow-hidden pointer-events-none">
            <svg className="w-full h-full" viewBox="0 0 100 28" preserveAspectRatio="none">
              <defs>
                <linearGradient id="wave-conversations-green" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.32" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <path
                d="M0,22 C15,22 25,12 40,16 C55,20 65,8 80,12 C90,14 95,6 100,8 L100,28 L0,28 Z"
                fill="url(#wave-conversations-green)"
              />
              <path
                d="M0,22 C15,22 25,12 40,16 C55,20 65,8 80,12 C90,14 95,6 100,8"
                fill="none"
                stroke="#10b981"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>

        {/* Card 2: TRAINED SOURCES (Sky Blue Knowledge Rhythm Bars) */}
        <div className="p-4 sm:p-5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl flex flex-col justify-between overflow-hidden shadow-sm relative">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[10px] text-neutral-400 dark:text-neutral-500 uppercase font-semibold tracking-wider">
                Trained Sources
              </span>
              <h4 className="text-2xl font-bold mt-1 text-neutral-900 dark:text-neutral-100 tracking-tight">
                {trainedActiveCount} Active
              </h4>
              <span className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-1 block font-mono">
                {charCount.toLocaleString()} characters
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400 border border-sky-100 dark:border-sky-800/40 shrink-0 shadow-sm">
              <Database className="size-5" />
            </div>
          </div>

          {/* Logical Light Blue Knowledge Density Bars */}
          <div className="mt-4 -mx-5 -mb-5 h-14 overflow-hidden flex items-end justify-between px-3 pb-1 gap-1 pointer-events-none">
            {[26, 42, 32, 54, 48, 62, 45, 74, 58, 84, 68, 92, 70, 85, 58, 76, 64, 88, 72, 94, 80].map(
              (height, i) => (
                <div
                  key={i}
                  style={{ height: `${height}%` }}
                  className="w-full bg-gradient-to-t from-sky-200/50 to-sky-400 dark:from-sky-900/30 dark:to-sky-500/80 rounded-t-sm transition-all"
                />
              )
            )}
          </div>
        </div>

        {/* Card 3: LEADS CAPTURED (Orange Influx Bars) */}
        <div
          onClick={() => setActiveTab("leads")}
          className="p-4 sm:p-5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl flex flex-col justify-between overflow-hidden shadow-sm relative cursor-pointer group hover:border-[#f97316]/40 transition-colors"
        >
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[10px] text-neutral-400 dark:text-neutral-500 uppercase font-semibold tracking-wider">
                Leads Captured
              </span>
              <h4 className="text-2xl font-bold mt-1 text-neutral-900 dark:text-neutral-100 tracking-tight">
                {leadCount}
              </h4>
              <span className="text-[10px] text-[#f97316] font-semibold flex items-center gap-1 mt-1 bg-orange-50 dark:bg-orange-950/50 px-1.5 py-0.5 rounded-md border border-orange-100 dark:border-orange-800/30 w-fit">
                <TrendingUp className="size-3" /> Captured contacts
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-orange-50 dark:bg-orange-950/50 text-[#f97316] border border-orange-100 dark:border-orange-800/40 shrink-0 group-hover:scale-105 transition-transform shadow-sm">
              <Users className="size-5" />
            </div>
          </div>

          {/* Logical Orange Lead Acquisition Bars */}
          <div className="mt-4 -mx-5 -mb-5 h-14 overflow-hidden flex items-end justify-between px-3 pb-1 gap-1 pointer-events-none">
            {[18, 30, 24, 42, 28, 50, 36, 65, 52, 78, 58, 88, 72, 85, 60, 75, 86, 70, 84, 96, 78].map(
              (height, i) => (
                <div
                  key={i}
                  style={{ height: `${height}%` }}
                  className="w-full bg-gradient-to-t from-orange-200/50 to-[#f97316] dark:from-orange-950/30 dark:to-orange-500/80 rounded-t-sm transition-all"
                />
              )
            )}
          </div>
        </div>
      </div>

      {/* ========================================================
          3. METRIC ROW 2: AI Resolution, CSAT, Busiest Hour
          ======================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {/* Card 4: AI RESOLUTION RATE (Green Check & Deflection Bar) */}
        <div className="p-4 sm:p-5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl flex flex-col justify-between overflow-hidden shadow-sm relative">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[10px] text-neutral-400 dark:text-neutral-500 uppercase font-semibold tracking-wider">
                AI Resolution Rate
              </span>
              <h4 className="text-2xl font-bold mt-1 text-neutral-900 dark:text-neutral-100 tracking-tight">
                {resRateFormatted}
              </h4>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1 mt-1 bg-emerald-50 dark:bg-emerald-950/50 px-1.5 py-0.5 rounded-md border border-emerald-100 dark:border-emerald-800/30 w-fit">
                <TrendingUp className="size-3" /> Autonomous resolution
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/40 shrink-0 shadow-sm">
              <CheckCircle2 className="size-5" />
            </div>
          </div>

          {/* Sleek Green Deflection Progress Bar */}
          <div className="mt-5 space-y-1.5">
            <div className="w-full h-2 rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
                style={{
                  width: resRateFormatted.includes("%") ? resRateFormatted : "0%",
                }}
              />
            </div>
            <div className="flex justify-between text-[9px] text-neutral-400 dark:text-neutral-500">
              <span>Autonomous resolution</span>
              <span>Benchmark: 70%+</span>
            </div>
          </div>
        </div>

        {/* Card 5: CSAT (Amber Star & Sentiment Progress Bar) */}
        <div className="p-4 sm:p-5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl flex flex-col justify-between overflow-hidden shadow-sm relative">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[10px] text-neutral-400 dark:text-neutral-500 uppercase font-semibold tracking-wider">
                CSAT
              </span>
              <h4 className="text-2xl font-bold mt-1 text-neutral-900 dark:text-neutral-100 tracking-tight">
                {calculatedCsat} <span className="text-base font-normal text-neutral-400">/ 5</span>
              </h4>
              <span className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-1 block">
                {csatFeedback.length > 0
                  ? `${csatFeedback.length} ratings recorded`
                  : "0 ratings recorded"}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-500 dark:text-amber-400 border border-amber-100 dark:border-amber-800/40 shrink-0 shadow-sm">
              <Star className="size-5 fill-amber-400 text-amber-400" />
            </div>
          </div>

          {/* Golden Sentiment Progress Bar */}
          <div className="mt-5 space-y-1.5">
            <div className="w-full h-2 rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all duration-500"
                style={{
                  width: `${calculatedCsat === "-" ? 0 : Math.min(100, Math.max(0, parseFloat(calculatedCsat) * 20))}%`,
                }}
              />
            </div>
            <div className="flex justify-between text-[9px] text-neutral-400 dark:text-neutral-500">
              <span>Visitor satisfaction ratio</span>
              <span>Industry avg: 4.2</span>
            </div>
          </div>
        </div>

        {/* Card 6: BUSIEST HOUR (Violet Clock & 24h Diurnal Traffic Bell Curve Wave) */}
        <div className="p-4 sm:p-5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl flex flex-col justify-between overflow-hidden shadow-sm relative">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[10px] text-neutral-400 dark:text-neutral-500 uppercase font-semibold tracking-wider">
                Busiest Hour
              </span>
              <h4 className="text-xl font-bold mt-1 text-neutral-900 dark:text-neutral-100 tracking-tight truncate">
                {busyHourDisplay}
              </h4>
              <span className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-1 block">
                Peak inquiry volume (last 7 days)
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-violet-50 dark:bg-violet-950/50 text-violet-600 dark:text-violet-400 border border-violet-100 dark:border-violet-800/40 shrink-0 shadow-sm">
              <Clock className="size-5" />
            </div>
          </div>

          {/* Logical Diurnal 24-Hour Traffic Curve with Peak Highlight */}
          <div className="mt-4 -mx-5 -mb-5 h-14 overflow-hidden flex items-end justify-between px-3 pb-1 gap-1 pointer-events-none">
            {[12, 10, 8, 8, 10, 16, 26, 42, 58, 74, 88, 96, 86, 74, 62, 50, 42, 34, 28, 20, 14].map(
              (height, i) => (
                <div
                  key={i}
                  style={{ height: `${height}%` }}
                  className={`w-full rounded-t-sm transition-all ${
                    i === 11
                      ? "bg-violet-600 dark:bg-violet-400 shadow-sm shadow-violet-500/50"
                      : "bg-gradient-to-t from-violet-200/50 to-violet-400 dark:from-violet-950/30 dark:to-violet-500/80"
                  }`}
                />
              )
            )}
          </div>
        </div>
      </div>

      {/* ========================================================
          4. RECENT FEEDBACK (With Form-Selected Emojis & User Details)
          ======================================================== */}
      <div className="p-4 sm:p-6 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
              Recent Feedback
            </h3>
            <p className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-0.5">
              Live ratings and verified feedback submitted via the in-widget post-chat prompt.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab("feedback")}
            className="text-xs font-semibold text-[#f97316] hover:text-[#ea580c] transition-colors cursor-pointer flex items-center gap-1 group"
          >
            <span>View all</span>
            <ChevronRight className="size-3.5 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>

        {displayFeedback.length > 0 ? (
          <div className="space-y-3">
            {displayFeedback.map((f: any) => {
              const emojiConfig = CSAT_EMOJIS[f.rating] || CSAT_EMOJIS[5];
              const matchedLead =
                f.session_id && Array.isArray(leads)
                  ? leads.find((l: any) => l.session_id === f.session_id)
                  : null;

              const displayName =
                matchedLead?.name ||
                (f.session_id ? `Visitor #${f.session_id.slice(0, 6)}` : "Verified Visitor");

              const displayCompany = matchedLead?.company;
              const displayEmail = matchedLead?.email;
              const timeAgo = formatRelativeTime(f.created_at);

              return (
                <div
                  key={f.id}
                  className="flex items-start sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-neutral-100 dark:border-neutral-800/80 bg-neutral-50/40 dark:bg-neutral-950/30 hover:border-neutral-200 dark:hover:border-neutral-700/80 transition-all"
                >
                  <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                    {/* Selected Rating Emoji from Feedback Form */}
                    <div
                      className={`size-9 rounded-full ${emojiConfig.bgClass} border ${emojiConfig.borderClass} flex items-center justify-center shrink-0 text-lg shadow-sm`}
                      title={`${emojiConfig.label} (${f.rating}/5 stars)`}
                    >
                      <span role="img" aria-label={emojiConfig.label}>
                        {emojiConfig.emoji}
                      </span>
                    </div>

                    <div className="min-w-0 flex-1">
                      {/* User Details: Name, Company, Email */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 truncate">
                          {displayName}
                        </span>
                        {displayCompany && (
                          <span className="text-[10px] font-medium text-neutral-500 dark:text-neutral-400 bg-white dark:bg-neutral-800 px-1.5 py-0.5 rounded border border-neutral-200/80 dark:border-neutral-700">
                            {displayCompany}
                          </span>
                        )}
                        {displayEmail && (
                          <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-mono hidden sm:inline">
                            {displayEmail}
                          </span>
                        )}
                      </div>

                      {/* Feedback Comment */}
                      <p className="text-xs text-neutral-700 dark:text-neutral-300 mt-1 leading-relaxed">
                        {f.comment || <span className="italic text-neutral-400">Quick star rating submitted</span>}
                      </p>
                    </div>
                  </div>

                  {/* Right side: Timestamp and Stars */}
                  <div className="flex flex-col items-end shrink-0 gap-1 pl-2">
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Star
                          key={n}
                          className={`size-3.5 ${
                            n <= f.rating
                              ? "fill-amber-400 text-amber-400"
                              : "text-neutral-300 dark:text-neutral-700"
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-medium">
                      {timeAgo}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-center bg-neutral-50/50 dark:bg-neutral-950/20 rounded-xl border border-dashed border-neutral-200 dark:border-neutral-800">
            <Star className="size-6 text-neutral-300 dark:text-neutral-700" />
            <p className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
              No ratings or feedback recorded yet
            </p>
            <p className="text-[11px] text-neutral-400 dark:text-neutral-500 max-w-sm">
              Visitor star ratings and comments will appear here automatically when visitors rate conversations in the chat widget.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
