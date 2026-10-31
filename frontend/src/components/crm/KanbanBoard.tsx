"use client";

import React, { useCallback, useEffect, useState } from "react";
import { CognitiveCheckpointModal } from "./CognitiveCheckpointModal";
import { DealCard } from "./DealCard";
import type { KanbanBoardData, PipelineStage } from "./types";

interface Props {
  botId: string;
  fetchBackend?: (url: string, init?: RequestInit) => Promise<Response>;
}

export function KanbanBoard({ botId, fetchBackend }: Props) {
  const [loading, setLoading] = useState(false);
  const [boardData, setBoardData] = useState<KanbanBoardData | null>(null);
  const [activeSessionForMemory, setActiveSessionForMemory] = useState<string | null>(null);

  const fetchBoard = useCallback(async () => {
    if (!botId) return;
    try {
      setLoading(true);
      const fetcher = fetchBackend || fetch;
      const res = await fetcher(`/api/enterprise/kanban?bot_id=${encodeURIComponent(botId)}`);
      if (res.ok) {
        const data = await res.json();
        setBoardData(data.board);
      }
    } catch {
      // Ignore network errors
    } finally {
      setLoading(false);
    }
  }, [botId, fetchBackend]);

  useEffect(() => {
    fetchBoard();
  }, [fetchBoard]);

  const handleMoveDeal = async (dealId: string, newStageId: string) => {
    try {
      const fetcher = fetchBackend || fetch;
      const res = await fetcher(`/api/enterprise/deals/${encodeURIComponent(dealId)}/move`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bot_id: botId,
          new_stage_id: newStageId,
        }),
      });
      if (res.ok) {
        await fetchBoard();
      }
    } catch {
      // Revert or alert
    }
  };

  const stages: PipelineStage[] = boardData?.stages || [];
  const totalPipelineFormatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format((boardData?.total_pipeline_value_cents || 0) / 100);

  return (
    <div className="space-y-4">
      {/* Top Telemetry Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              {boardData?.pipeline?.name || "Omnichannel Sales Pipeline"}
            </h4>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              Live Kanban
            </span>
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            Automatic intent progression: deals advance as customers inquire, schedule, or purchase.
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-neutral-400 block">Total Pipeline</span>
            <span className="text-sm font-bold text-neutral-900 dark:text-neutral-100">{totalPipelineFormatted}</span>
          </div>
          <div className="h-7 w-px bg-neutral-200 dark:bg-neutral-800" />
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-neutral-400 block">Active Deals</span>
            <span className="text-sm font-bold text-neutral-900 dark:text-neutral-100">{boardData?.total_deals || 0}</span>
          </div>
          <button
            type="button"
            disabled={loading}
            onClick={fetchBoard}
            className="px-3 py-1.5 text-xs font-medium rounded-xl border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {/* Horizontal Scrollable Kanban Columns */}
      <div className="flex gap-4 overflow-x-auto pb-4 pt-1 no-scrollbar min-h-[450px]">
        {stages.map((stage) => {
          const stageValue = new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
          }).format((stage.total_value_cents || 0) / 100);

          return (
            <div
              key={stage.id}
              className="w-72 shrink-0 flex flex-col rounded-2xl bg-neutral-50/70 dark:bg-neutral-900/40 border border-neutral-200/80 dark:border-neutral-800 p-3 space-y-3"
            >
              {/* Stage Header */}
              <div className="flex items-center justify-between pb-2 border-b border-neutral-200/60 dark:border-neutral-800">
                <div className="flex items-center gap-2">
                  <span
                    className="size-2 rounded-full"
                    style={{ backgroundColor: stage.color || "#10b981" }}
                  />
                  <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                    {stage.name}
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-md bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border border-neutral-200/60 dark:border-neutral-700">
                    {stage.deal_count}
                  </span>
                </div>
                <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                  {stageValue}
                </span>
              </div>

              {/* Deal Cards Container */}
              <div className="flex-1 space-y-2.5 overflow-y-auto max-h-[550px] pr-0.5">
                {stage.deals?.length ? (
                  stage.deals.map((deal) => (
                    <DealCard
                      key={deal.id}
                      deal={deal}
                      stages={stages}
                      onMove={handleMoveDeal}
                      onInspectMemory={(sess) => setActiveSessionForMemory(sess)}
                    />
                  ))
                ) : (
                  <div className="py-10 text-center text-[11px] text-neutral-400 dark:text-neutral-500 border border-dashed border-neutral-200 dark:border-neutral-800 rounded-xl">
                    No deals in stage
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Cognitive Memory Inspection Modal */}
      <CognitiveCheckpointModal
        isOpen={Boolean(activeSessionForMemory)}
        onClose={() => setActiveSessionForMemory(null)}
        botId={botId}
        sessionId={activeSessionForMemory}
        fetchBackend={fetchBackend}
      />
    </div>
  );
}
