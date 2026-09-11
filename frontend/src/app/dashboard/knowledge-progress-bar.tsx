"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, CheckCircle2, Loader2, X } from "lucide-react";

export interface KnowledgeProgress {
  id: string;
  title: string;
  detail: string;
  percent: number;
  status: "active" | "success" | "error";
  stages?: string[];
  currentStageIndex?: number;
}

export function KnowledgeProgressBar({
  progress,
  onDismiss,
}: {
  progress: KnowledgeProgress | null;
  onDismiss: () => void;
}) {
  if (!progress) return null;

  const isSuccess = progress.status === "success";
  const isError = progress.status === "error";
  const isActive = progress.status === "active";

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8, scale: 0.99 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8, scale: 0.99 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
        className={`relative overflow-hidden rounded-2xl p-4 sm:p-5 border transition-all duration-300 shadow-sm ${
          isSuccess
            ? "bg-emerald-50/85 dark:bg-emerald-950/25 border-emerald-200/90 dark:border-emerald-800/60 shadow-emerald-500/5"
            : isError
            ? "bg-red-50/85 dark:bg-red-950/25 border-red-200/90 dark:border-red-800/60 shadow-red-500/5"
            : "bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 shadow-[0_4px_24px_-4px_rgba(249,115,22,0.12)]"
        }`}
      >
        {isActive && (
          <div className="absolute -top-10 -right-10 size-32 bg-gradient-to-br from-orange-400/15 to-amber-400/5 rounded-full blur-2xl pointer-events-none" />
        )}

        <div className="relative flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`size-10 rounded-xl flex items-center justify-center shrink-0 transition-all ${
                isSuccess
                  ? "bg-emerald-500 text-white shadow-[0_0_16px_rgba(16,185,129,0.4)]"
                  : isError
                  ? "bg-red-500 text-white shadow-[0_0_16px_rgba(239,68,68,0.4)]"
                  : "bg-gradient-to-br from-[#f97316] to-amber-500 text-white shadow-[0_0_16px_rgba(249,115,22,0.35)]"
              }`}
            >
              {isSuccess ? (
                <CheckCircle2 className="size-5" strokeWidth={2.5} />
              ) : isError ? (
                <AlertCircle className="size-5" strokeWidth={2.5} />
              ) : (
                <Loader2 className="size-5 animate-spin" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 truncate">
                  {progress.title}
                </h4>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                    isSuccess
                      ? "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300"
                      : isError
                      ? "bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300"
                      : "bg-[#f97316]/10 text-[#f97316]"
                  }`}
                >
                  {isSuccess ? "Completed" : isError ? "Error" : "Processing"}
                </span>
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate mt-0.5 font-medium">
                {progress.detail}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <div
              className={`font-mono text-xs sm:text-sm font-black px-2.5 py-1 rounded-xl border flex items-center gap-1 transition-colors ${
                isSuccess
                  ? "bg-emerald-100/80 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
                  : isError
                  ? "bg-red-100/80 dark:bg-red-900/30 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800"
                  : "bg-orange-50 dark:bg-orange-950/30 text-[#f97316] border-orange-200/70 dark:border-orange-900/50 shadow-sm"
              }`}
            >
              <span>{progress.percent}%</span>
            </div>

            <button
              type="button"
              onClick={onDismiss}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
              aria-label="Dismiss progress notification"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        <div className="relative w-full h-2.5 bg-neutral-100 dark:bg-neutral-800/80 rounded-full overflow-hidden shadow-inner">
          <div
            className={`h-full rounded-full relative overflow-hidden transition-all duration-300 ease-out ${
              isSuccess
                ? "bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.5)]"
                : isError
                ? "bg-gradient-to-r from-red-500 via-rose-500 to-red-400 shadow-[0_0_12px_rgba(239,68,68,0.5)]"
                : "bg-gradient-to-r from-[#f97316] via-orange-500 to-amber-400 shadow-[0_0_14px_rgba(249,115,22,0.6)]"
            }`}
            style={{ width: `${Math.max(3, Math.min(100, progress.percent))}%` }}
          >
            {isActive && (
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-shimmer" />
            )}
          </div>
        </div>

        {progress.stages && progress.stages.length > 0 && (
          <div className="mt-2.5 pt-2 border-t border-neutral-100 dark:border-neutral-800/60 flex items-center justify-between gap-2 overflow-x-auto text-[10px] scrollbar-none">
            {progress.stages.map((stage, idx) => {
              const currentIdx = progress.currentStageIndex ?? 0;
              const isPassed = isSuccess || currentIdx > idx;
              const isCurrent = isActive && currentIdx === idx;
              return (
                <div
                  key={idx}
                  className={`flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                    isPassed
                      ? "text-emerald-600 dark:text-emerald-400 font-medium"
                      : isCurrent
                      ? "text-[#f97316] font-bold"
                      : "text-neutral-400 dark:text-neutral-500"
                  }`}
                >
                  <div
                    className={`size-1.5 rounded-full shrink-0 ${
                      isPassed
                        ? "bg-emerald-500"
                        : isCurrent
                        ? "bg-[#f97316] ring-2 ring-orange-200 dark:ring-orange-950 animate-pulse"
                        : "bg-neutral-300 dark:bg-neutral-700"
                    }`}
                  />
                  <span className="truncate max-w-[130px] sm:max-w-none">{stage}</span>
                </div>
              );
            })}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
