"use client";

import React, { useEffect, useState } from "react";
import type { CognitiveCheckpoint } from "./types";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  botId: string;
  sessionId: string | null;
  fetchBackend?: (url: string, init?: RequestInit) => Promise<Response>;
}

export function CognitiveCheckpointModal({ isOpen, onClose, botId, sessionId, fetchBackend }: Props) {
  const [loading, setLoading] = useState(false);
  const [checkpoint, setCheckpoint] = useState<CognitiveCheckpoint | null>(null);

  useEffect(() => {
    if (!isOpen || !sessionId || !botId) return;
    let active = true;

    async function loadCheckpoint() {
      try {
        setLoading(true);
        const fetcher = fetchBackend || fetch;
        const res = await fetcher(`/api/enterprise/checkpoints/${encodeURIComponent(sessionId!)}?bot_id=${encodeURIComponent(botId)}`);
        if (res.ok) {
          const data = await res.json();
          if (active) setCheckpoint(data.checkpoint);
        }
      } catch {
        // Ignore network errors
      } finally {
        if (active) setLoading(false);
      }
    }

    loadCheckpoint();
    return () => {
      active = false;
    };
  }, [isOpen, sessionId, botId, fetchBackend]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg bg-white dark:bg-neutral-900 rounded-3xl shadow-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden p-6 sm:p-7 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-neutral-100 dark:border-neutral-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg">🧠</span>
              <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
                AI Cognitive Checkpoint
              </h3>
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              Structured turn memory & lead qualification state
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="size-8 flex items-center justify-center rounded-full text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            ✕
          </button>
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs text-neutral-400 space-y-2">
            <div className="size-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p>Loading cognitive checkpoint...</p>
          </div>
        ) : checkpoint ? (
          <div className="space-y-4 text-xs">
            {/* Badges for Intent & Sentiment */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-1 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 font-medium">
                Intent: <b className="capitalize">{checkpoint.lead_intent || "inquiry"}</b>
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-medium">
                Sentiment: <b className="capitalize">{checkpoint.customer_sentiment || "neutral"}</b>
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-500 font-mono text-[11px]">
                Turn #{checkpoint.turn_number || 1}
              </span>
            </div>

            {/* Rolling Summary */}
            <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/60 dark:border-neutral-800 space-y-1">
              <span className="font-semibold text-neutral-700 dark:text-neutral-300 text-[11px] uppercase tracking-wider">
                Rolling Relationship Summary
              </span>
              <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed">
                {checkpoint.rolling_summary || "No prior conversation summary recorded yet."}
              </p>
            </div>

            {/* Commitments & Objections */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/60 space-y-1.5">
                <span className="font-semibold text-emerald-800 dark:text-emerald-300 text-[11px]">
                  Active Commitments
                </span>
                {checkpoint.active_commitments?.length ? (
                  <ul className="list-disc list-inside space-y-1 text-[11px] text-emerald-700 dark:text-emerald-400">
                    {checkpoint.active_commitments.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[11px] text-neutral-400 italic">No open commitments.</p>
                )}
              </div>

              <div className="p-3 rounded-xl bg-amber-50/50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/60 space-y-1.5">
                <span className="font-semibold text-amber-800 dark:text-amber-300 text-[11px]">
                  Unresolved Objections
                </span>
                {checkpoint.unresolved_objections?.length ? (
                  <ul className="list-disc list-inside space-y-1 text-[11px] text-amber-700 dark:text-amber-400">
                    {checkpoint.unresolved_objections.map((o, i) => (
                      <li key={i}>{o}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[11px] text-neutral-400 italic">No objections logged.</p>
                )}
              </div>
            </div>

            {/* Next Recommended Action */}
            <div className="p-3 rounded-xl bg-blue-50/60 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-800 text-[11px] flex items-start gap-2">
              <span className="text-blue-500 font-bold">Recommended Next Step:</span>
              <span className="text-blue-900 dark:text-blue-200 font-medium">
                {checkpoint.next_action || "Continue natural customer assistance."}
              </span>
            </div>
          </div>
        ) : (
          <div className="py-8 text-center text-xs text-neutral-400">
            No cognitive checkpoint found for this conversation session yet.
          </div>
        )}

        <div className="flex justify-end pt-2 border-t border-neutral-100 dark:border-neutral-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 hover:opacity-90 transition-opacity"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
