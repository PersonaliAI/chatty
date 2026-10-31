"use client";

import React from "react";
import type { Deal, PipelineStage } from "./types";

interface Props {
  deal: Deal;
  stages: PipelineStage[];
  onMove: (dealId: string, newStageId: string) => void;
  onInspectMemory?: (sessionId: string) => void;
}

export function DealCard({ deal, stages, onMove, onInspectMemory }: Props) {
  const currentIdx = stages.findIndex((s) => s.id === deal.stage_id);
  const formattedValue = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: deal.currency || "USD",
  }).format((deal.value_cents || 0) / 100);

  return (
    <div className="group relative rounded-xl bg-white dark:bg-neutral-800/90 border border-neutral-200/80 dark:border-neutral-700/80 p-3.5 shadow-2xs hover:shadow-xs transition-all duration-150 space-y-2.5">
      {/* Title & Value */}
      <div className="flex items-start justify-between gap-2">
        <h5 className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 line-clamp-2 leading-snug">
          {deal.title}
        </h5>
        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
          {formattedValue}
        </span>
      </div>

      {/* Meta tags */}
      <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-neutral-500 dark:text-neutral-400">
        {deal.session_id && (
          <button
            type="button"
            onClick={() => onInspectMemory && onInspectMemory(deal.session_id!)}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 hover:bg-purple-100 transition-colors cursor-pointer"
            title="Inspect cognitive memory: commitments, objections & sentiment"
          >
            <span>🧠</span>
            <span>AI Memory</span>
          </button>
        )}
        {deal.contact_id && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-700 font-mono">
            👤 {deal.contact_id.slice(0, 10)}
          </span>
        )}
      </div>

      {/* Quick Move Navigation */}
      <div className="pt-1.5 border-t border-neutral-100 dark:border-neutral-700/60 flex items-center justify-between text-[11px]">
        {currentIdx > 0 ? (
          <button
            type="button"
            onClick={() => onMove(deal.id, stages[currentIdx - 1].id)}
            className="text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 transition-colors cursor-pointer"
            title={`Move back to ${stages[currentIdx - 1].name}`}
          >
            &larr; Prev
          </button>
        ) : (
          <span />
        )}

        {currentIdx < stages.length - 1 && (
          <button
            type="button"
            onClick={() => onMove(deal.id, stages[currentIdx + 1].id)}
            className="font-medium text-emerald-600 dark:text-emerald-400 hover:underline transition-colors cursor-pointer"
            title={`Advance to ${stages[currentIdx + 1].name}`}
          >
            Advance &rarr;
          </button>
        )}
      </div>
    </div>
  );
}
