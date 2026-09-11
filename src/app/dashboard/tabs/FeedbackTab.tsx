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
            return (
              <div key={f.id} className="p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star
                        key={n}
                        className={`size-3.5 ${n <= f.rating ? "fill-amber-400 text-amber-400" : "text-neutral-300 dark:text-neutral-700"}`}
                      />
                    ))}
                  </div>
                  <span className="text-[10px] text-neutral-400 dark:text-neutral-500 shrink-0">
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
