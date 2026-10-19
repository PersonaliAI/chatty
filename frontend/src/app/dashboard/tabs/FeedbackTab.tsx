"use client";

import { Loader2, Star, Users, ChevronRight } from "lucide-react";
import type { Lead } from "../dashboard-types";

export interface CsatFeedbackItem {
  id: string;
  rating: number;
  comment?: string | null;
  created_at: string;
  session_id?: string | null;
}

interface FeedbackTabProps {
  csatFeedback: CsatFeedbackItem[];
  loadingLists: boolean;
  leads: Lead[];
  setActiveTab: (tab: string) => void;
}

const CSAT_EMOJIS: Record<
  number,
  { emoji: string; label: string; textClass: string; bgClass: string; borderClass: string }
> = {
  5: { emoji: "🤩", label: "Delighted", textClass: "text-emerald-600 dark:text-emerald-400", bgClass: "bg-emerald-50 dark:bg-emerald-950/50", borderClass: "border-emerald-200 dark:border-emerald-800/50" },
  4: { emoji: "🙂", label: "Satisfied", textClass: "text-teal-600 dark:text-teal-400", bgClass: "bg-teal-50 dark:bg-teal-950/50", borderClass: "border-teal-200 dark:border-teal-800/50" },
  3: { emoji: "😐", label: "Neutral", textClass: "text-amber-600 dark:text-amber-400", bgClass: "bg-amber-50 dark:bg-amber-950/50", borderClass: "border-amber-200 dark:border-amber-800/50" },
  2: { emoji: "😕", label: "Disappointed", textClass: "text-orange-600 dark:text-orange-400", bgClass: "bg-orange-50 dark:bg-orange-950/50", borderClass: "border-orange-200 dark:border-orange-800/50" },
  1: { emoji: "😞", label: "Frustrated", textClass: "text-rose-600 dark:text-rose-400", bgClass: "bg-rose-50 dark:bg-rose-950/50", borderClass: "border-rose-200 dark:border-rose-800/50" },
};

export function FeedbackTab({
  csatFeedback,
  loadingLists,
  leads,
  setActiveTab,
}: FeedbackTabProps) {
  return (
    <div className="max-w-4xl mx-auto w-full py-6 px-4 space-y-4">
      <div>
        <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
          Ratings &amp; Feedback ({csatFeedback.length})
        </h4>
        <p className="text-[10px] text-neutral-450 dark:text-neutral-500 mt-1">
          Every post-chat star rating and comment your visitors left, with any contact details the AI captured during that same conversation.
        </p>
      </div>

      {loadingLists ? (
        <div className="flex items-center justify-center p-12 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl">
          <Loader2 className="size-5 animate-spin text-neutral-400" />
        </div>
      ) : csatFeedback.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 p-12 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl text-center">
          <Star className="size-6 text-neutral-300 dark:text-neutral-700" />
          <p className="text-xs text-neutral-400 dark:text-neutral-500 max-w-sm">
            No ratings yet. Visitors see this prompt when they close the chat after a couple of messages.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {csatFeedback.map((f) => {
            const matchedLead = f.session_id ? leads.find((l) => l.session_id === f.session_id) : undefined;
            const emojiConfig = CSAT_EMOJIS[f.rating] || CSAT_EMOJIS[5];
            return (
              <div key={f.id} className="p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`size-9 rounded-full ${emojiConfig.bgClass} border ${emojiConfig.borderClass} flex items-center justify-center shrink-0 text-lg shadow-sm`}
                      title={`${emojiConfig.label} (${f.rating}/5 stars)`}
                    >
                      <span role="img" aria-label={emojiConfig.label}>
                        {emojiConfig.emoji}
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                          {matchedLead?.name || (f.session_id ? `Visitor #${f.session_id.slice(0, 6)}` : "Verified Visitor")}
                        </span>
                        <span className="text-[10px] text-neutral-400 dark:text-neutral-500">
                          • {emojiConfig.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-0.5 mt-0.5">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Star
                            key={n}
                            className={`size-3 ${
                              n <= f.rating
                                ? "fill-amber-400 text-amber-400"
                                : "text-neutral-300 dark:text-neutral-700"
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] text-neutral-400 dark:text-neutral-500 shrink-0 font-medium">
                    {new Date(f.created_at).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                {f.comment ? (
                  <p className="text-xs text-neutral-700 dark:text-neutral-300 leading-relaxed mt-2">{f.comment}</p>
                ) : (
                  <p className="text-xs text-neutral-400 dark:text-neutral-500 italic mt-2">No comment left</p>
                )}
                {matchedLead ? (
                  <button
                    type="button"
                    onClick={() => setActiveTab("leads")}
                    title="Captured during this conversation - view in Leads"
                    className="mt-3 w-full flex items-center gap-2.5 p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-100 dark:border-neutral-850 hover:border-[#f97316]/40 cursor-pointer transition-colors text-left"
                  >
                    <div className="size-7 rounded-full bg-[#f97316]/10 text-[#f97316] flex items-center justify-center shrink-0">
                      <Users className="size-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-semibold text-neutral-800 dark:text-neutral-200 truncate">
                        {matchedLead.name || "Contact captured"}
                      </p>
                      <p className="text-[10px] text-neutral-450 dark:text-neutral-500 truncate">
                        {[matchedLead.email, matchedLead.phone].filter(Boolean).join(" · ") || "No email/phone on file"}
                      </p>
                    </div>
                    <ChevronRight className="size-3.5 text-neutral-400 shrink-0" />
                  </button>
                ) : (
                  <p className="text-[10px] text-neutral-400 dark:text-neutral-600 mt-3 italic">
                    No contact info was captured in this conversation.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
