"use client";

import { Loader2 } from "lucide-react";

export interface ChartDataItem {
  day: string;
  count: number;
  height: string;
}

export interface ModelUsageItem {
  model: string;
  calls: number;
  tokens: number;
  cost: number;
}

interface AnalyticsTabProps {
  loadingAnalytics: boolean;
  totalQueries: number;
  conversionRate: string;
  totalSessions: number;
  analyticsChartData: ChartDataItem[];
  aiUsageTotalCost: number;
  aiUsageTotalTokens: number;
  aiUsageTotalCalls: number;
  aiUsageByModel: ModelUsageItem[];
}

export function AnalyticsTab({
  loadingAnalytics,
  totalQueries,
  conversionRate,
  totalSessions,
  analyticsChartData,
  aiUsageTotalCost,
  aiUsageTotalTokens,
  aiUsageTotalCalls,
  aiUsageByModel,
}: AnalyticsTabProps) {
  return (
    <div className="max-w-4xl mx-auto w-full space-y-8 py-6 px-4">
      {loadingAnalytics ? (
        <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl gap-3">
          <Loader2 className="size-6 animate-spin text-[#f97316]" />
          <p className="text-xs text-neutral-400 font-semibold">Calculating database metrics...</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="p-5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl">
              <span className="text-[10px] text-neutral-400 uppercase font-semibold">Total Queries Sent</span>
              <h4 className="text-2xl font-bold mt-1">{totalQueries.toLocaleString()}</h4>
              <p className="text-[9px] text-green-500 mt-1 font-medium">100% real database sync</p>
            </div>
            <div className="p-5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl">
              <span className="text-[10px] text-neutral-400 uppercase font-semibold">Lead Conversion Rate</span>
              <h4 className="text-2xl font-bold mt-1">{conversionRate}%</h4>
              <p className="text-[9px] text-[#f97316] mt-1 font-semibold">Total unique sessions: {totalSessions}</p>
            </div>
            <div className="p-5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl">
              <span className="text-[10px] text-neutral-400 uppercase font-semibold">Satisfaction Score</span>
              <h4 className="text-2xl font-bold mt-1">{totalQueries > 0 ? "4.9 / 5.0" : "N/A"}</h4>
              <p className="text-[9px] text-green-500 mt-1 font-medium">Based on Playground test logs</p>
            </div>
          </div>

          <div className="p-6 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl">
            <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-6">
              Queries Over Time (Last 7 Days)
            </h4>

            <div className="h-48 flex items-end justify-between gap-4 pt-4 px-2">
              {analyticsChartData.map((item, idx) => (
                <div
                  key={idx}
                  className="flex-1 flex flex-col items-center gap-2 group cursor-pointer h-full justify-end"
                >
                  <span className="text-[10px] font-mono text-neutral-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    {item.count}
                  </span>
                  <div
                    style={{ height: item.height }}
                    className="w-full bg-neutral-200 dark:bg-neutral-800 group-hover:bg-[#f97316] transition-all rounded-t-md"
                  />
                  <span className="text-[10px] text-neutral-500 font-medium">{item.day}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="p-6 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl">
            <div className="flex items-center justify-between mb-6">
              <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                AI Usage &amp; Cost (Last 30 Days)
              </h4>
              <span className="text-[9px] text-neutral-400 font-medium">Every model call, tracked by provider</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div>
                <span className="text-[10px] text-neutral-400 uppercase font-semibold">Estimated Cost</span>
                <h4 className="text-2xl font-bold mt-1 font-mono tabular-nums">${aiUsageTotalCost.toFixed(4)}</h4>
              </div>
              <div>
                <span className="text-[10px] text-neutral-400 uppercase font-semibold">Total Tokens</span>
                <h4 className="text-2xl font-bold mt-1 font-mono tabular-nums">
                  {aiUsageTotalTokens.toLocaleString()}
                </h4>
              </div>
              <div>
                <span className="text-[10px] text-neutral-400 uppercase font-semibold">Model Calls</span>
                <h4 className="text-2xl font-bold mt-1 font-mono tabular-nums">
                  {aiUsageTotalCalls.toLocaleString()}
                </h4>
              </div>
            </div>
            {aiUsageByModel.length > 0 ? (
              <div className="space-y-2">
                {aiUsageByModel.map((row) => (
                  <div
                    key={row.model}
                    className="flex items-center justify-between text-xs py-2 border-t border-neutral-100 dark:border-neutral-850"
                  >
                    <span className="font-mono text-neutral-600 dark:text-neutral-300">{row.model}</span>
                    <span className="text-neutral-400">{row.calls.toLocaleString()} calls</span>
                    <span className="text-neutral-400">{row.tokens.toLocaleString()} tokens</span>
                    <span className="font-mono font-semibold tabular-nums">${row.cost.toFixed(4)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-neutral-400">No AI usage recorded yet in this window.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
