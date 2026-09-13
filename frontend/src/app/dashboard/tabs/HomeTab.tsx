"use client";

import {
  Sparkles,
  TrendingUp,
  MessageCircle,
  Database,
  Users,
  CheckCircle2,
  Star,
  Clock,
  ChevronRight,
} from "lucide-react";
import type { CsatFeedbackItem } from "../dashboard-types";

interface HomeTabProps {
  setActiveTab: (tab: string) => void;
  totalSessions: number;
  sources: { charCount: number }[];
  leads: unknown[];
  resolutionRate: string;
  csatScore: string;
  busiestHour: string;
  csatFeedback: CsatFeedbackItem[];
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
  return (
    <div className="max-w-4xl mx-auto w-full space-y-6 py-6 px-4 flex flex-col">
      <div className="p-6 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl">
        <h3 className="text-sm font-bold flex items-center gap-2">
          <Sparkles className="size-4 text-[#f97316]" />
          Welcome to Chatty!
        </h3>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-2 leading-relaxed">
          Your chatbot is online and ready to be installed. Follow the quick steps below to train its memory, customize its visuals, and embed the code snippet onto your website.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
          <button
            onClick={() => setActiveTab("knowledge")}
            className="p-4 text-left rounded-xl border border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-955 hover:border-neutral-300 dark:hover:border-neutral-700 transition-all cursor-pointer"
          >
            <div className="text-xs font-bold text-neutral-800 dark:text-neutral-200">1. Train Memory</div>
            <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-1">Add URLs, text documents, or API sync sources.</p>
          </button>
          <button
            onClick={() => setActiveTab("customizer")}
            className="p-4 text-left rounded-xl border border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/20 hover:border-neutral-300 dark:hover:border-neutral-700 transition-all cursor-pointer"
          >
            <div className="text-xs font-bold text-neutral-800 dark:text-neutral-200">2. Customize Style</div>
            <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-1">Preset designs: Minimalist, Glassmorphism, Neumorphism.</p>
          </button>
          <button
            onClick={() => setActiveTab("integrations")}
            className="p-4 text-left rounded-xl border border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/20 hover:border-neutral-300 dark:hover:border-neutral-700 transition-all cursor-pointer"
          >
            <div className="text-xs font-bold text-neutral-800 dark:text-neutral-200">3. Install Script</div>
            <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-1">Copy code scripts or iframe elements for your webpage.</p>
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="p-5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-[10px] text-neutral-400 dark:text-neutral-500 uppercase font-semibold">Conversations</span>
            <h4 className="text-2xl font-bold mt-1">{totalSessions}</h4>
            <span className="text-[9px] text-green-500 font-medium flex items-center gap-0.5 mt-1">
              <TrendingUp className="size-3" /> Real-time active sessions
            </span>
          </div>
          <div className="p-3 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-500">
            <MessageCircle className="size-5" />
          </div>
        </div>

        <div className="p-5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-[10px] text-neutral-400 dark:text-neutral-500 uppercase font-semibold">Trained Sources</span>
            <h4 className="text-2xl font-bold mt-1">{sources.length} Active</h4>
            <span className="text-[9px] text-neutral-400 dark:text-neutral-500 mt-1 flex items-center gap-1">
              {sources.reduce((acc, s) => acc + s.charCount, 0).toLocaleString()} characters
            </span>
          </div>
          <div className="p-3 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-500">
            <Database className="size-5" />
          </div>
        </div>

        <div className="p-5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-[10px] text-neutral-400 dark:text-neutral-500 uppercase font-semibold">Leads Captured</span>
            <h4 className="text-2xl font-bold mt-1">{leads.length}</h4>
            <span className="text-[9px] text-[#f97316] font-medium mt-1">
              Click to view leads tab
            </span>
          </div>
          <div className="p-3 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-[#f97316]">
            <Users className="size-5" />
          </div>
        </div>
      </div>

      {/* Performance Row - the ROI metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="p-5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-[10px] text-neutral-400 dark:text-neutral-500 uppercase font-semibold">AI Resolution Rate</span>
            <h4 className="text-2xl font-bold mt-1">{resolutionRate}</h4>
            <span className="text-[9px] text-neutral-400 dark:text-neutral-500 mt-1 block">Sessions handled without a human</span>
          </div>
          <div className="p-3 rounded-xl bg-green-50 dark:bg-green-950/40 text-green-500">
            <CheckCircle2 className="size-5" />
          </div>
        </div>

        <div className="p-5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-[10px] text-neutral-400 dark:text-neutral-500 uppercase font-semibold">CSAT</span>
            <h4 className="text-2xl font-bold mt-1">{csatScore}</h4>
            <span className="text-[9px] text-neutral-400 dark:text-neutral-500 mt-1 block">Visitor thumbs-up ratio</span>
          </div>
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-500">
            <Star className="size-5" />
          </div>
        </div>

        <div className="p-5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-[10px] text-neutral-400 dark:text-neutral-500 uppercase font-semibold">Busiest Hour</span>
            <h4 className="text-2xl font-bold mt-1">{busiestHour}</h4>
            <span className="text-[9px] text-neutral-400 dark:text-neutral-500 mt-1 block">Peak traffic (last 7 days)</span>
          </div>
          <div className="p-3 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-500">
            <Clock className="size-5" />
          </div>
        </div>
      </div>

      {/* Recent Feedback - the post-chat star rating + comment popup */}
      <div className="p-5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400">Recent Feedback</h3>
          {csatFeedback.length > 0 && (
            <button
              type="button"
              onClick={() => setActiveTab("feedback")}
              className="text-[10px] font-semibold text-[#f97316] hover:underline cursor-pointer flex items-center gap-0.5"
            >
              View all <ChevronRight className="size-3" />
            </button>
          )}
        </div>
        {csatFeedback.length === 0 ? (
          <p className="text-xs text-neutral-400 dark:text-neutral-500">No star ratings yet. Visitors see this prompt when they close the chat after a couple of messages.</p>
        ) : (
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {csatFeedback.slice(0, 5).map((f) => (
              <div key={f.id} className="flex items-start gap-3 pb-3 border-b border-neutral-100 dark:border-neutral-850 last:border-0 last:pb-0">
                <div className="flex items-center gap-0.5 shrink-0 mt-0.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star key={n} className={`size-3.5 ${n <= f.rating ? "fill-amber-400 text-amber-400" : "text-neutral-300 dark:text-neutral-700"}`} />
                  ))}
                </div>
                <div className="min-w-0 flex-1">
                  {f.comment ? (
                    <p className="text-xs text-neutral-700 dark:text-neutral-300 leading-relaxed">{f.comment}</p>
                  ) : (
                    <p className="text-xs text-neutral-400 dark:text-neutral-500 italic">No comment left</p>
                  )}
                  <span className="text-[9px] text-neutral-400 dark:text-neutral-500 mt-1 block">
                    {new Date(f.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
