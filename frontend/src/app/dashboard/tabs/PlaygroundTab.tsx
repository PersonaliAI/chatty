"use client";

import React, { useState } from "react";
import { RotateCw, ExternalLink, Sparkles, Monitor, Smartphone, Lock, ArrowRight } from "lucide-react";

export interface PlaygroundTabProps {
  botId?: string | null;
  botName?: string;
  primaryColor?: string;
  isTrialExpired?: boolean;
  onUpgradeClick?: () => void;
  [key: string]: any;
}

export function PlaygroundTab({
  botId,
  botName,
  primaryColor = "#0052FF",
  isTrialExpired = false,
  onUpgradeClick,
  ...rest
}: PlaygroundTabProps) {
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [refreshKey, setRefreshKey] = useState(0);

  const reloadIframe = () => setRefreshKey((k) => k + 1);

  return (
    <div className="flex flex-col items-center justify-center p-4 sm:p-6 w-full max-w-4xl mx-auto space-y-4">
      <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between max-sm:gap-3 pb-3 border-b border-neutral-200 dark:border-neutral-800">
        <div>
          <h2 className="text-lg font-bold text-neutral-900 dark:text-white flex items-center gap-2">
            <Sparkles className="size-5 text-indigo-500" />
            Live Widget Playground
          </h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            Test the live chatbot, audio calls, knowledge responses, and inline calendar booking in real-time.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center bg-neutral-100 dark:bg-neutral-800 p-1 rounded-lg border border-neutral-200 dark:border-neutral-700">
            <button
              onClick={() => setDevice("desktop")}
              className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all ${
                device === "desktop"
                  ? "bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-xs"
                  : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
              }`}
            >
              <Monitor className="size-3.5" /> Desktop
            </button>
            <button
              onClick={() => setDevice("mobile")}
              className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all ${
                device === "mobile"
                  ? "bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-xs"
                  : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
              }`}
            >
              <Smartphone className="size-3.5" /> Mobile
            </button>
          </div>

          <button
            onClick={reloadIframe}
            title="Reload widget"
            className="p-2 rounded-lg border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-400 transition-colors cursor-pointer"
          >
            <RotateCw className="size-4" />
          </button>

          {botId && (
            <a
              href={`/embed/${botId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-lg border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-400 transition-colors"
              title="Open full preview in new tab"
            >
              <ExternalLink className="size-4" />
            </a>
          )}
        </div>
      </div>

      {botId ? (
        <div
          className={`relative transition-all duration-300 flex items-center justify-center p-4 rounded-2xl bg-neutral-100/70 dark:bg-neutral-900/50 border border-neutral-200/80 dark:border-neutral-800 w-full overflow-hidden ${
            device === "mobile" ? "max-w-[420px]" : "max-w-[500px]"
          }`}
        >
          {isTrialExpired && (
            <div className="absolute inset-0 z-20 backdrop-blur-md bg-neutral-900/80 dark:bg-neutral-950/85 p-6 flex flex-col items-center justify-center text-center space-y-4 rounded-2xl">
              <div className="size-14 rounded-2xl bg-amber-500/20 text-amber-400 grid place-items-center border border-amber-500/30">
                <Lock className="size-7" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-bold text-white">
                  Playground Testing is Frozen
                </h3>
                <p className="text-xs text-neutral-300 max-w-xs leading-relaxed">
                  Your 14-day free trial has expired. Upgrade your plan to resume unlimited playground testing and live customer chats.
                </p>
              </div>
              {onUpgradeClick && (
                <button
                  type="button"
                  onClick={onUpgradeClick}
                  className="px-4 py-2.5 rounded-xl bg-[#f97316] hover:bg-[#ea580c] text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer"
                >
                  <span>Select a Plan to Unlock</span>
                  <ArrowRight className="size-3.5" />
                </button>
              )}
            </div>
          )}

          <iframe
            key={refreshKey}
            src={`/embed/${botId}`}
            className="w-full h-[680px] rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-2xl bg-white dark:bg-neutral-950"
            title="Live Widget Preview"
          />
        </div>
      ) : (
        <div className="w-full max-w-lg h-[450px] rounded-2xl border border-dashed border-neutral-300 dark:border-neutral-700 flex flex-col items-center justify-center text-center p-4 sm:p-6">
          <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
            No active bot selected
          </p>
          <p className="text-xs text-neutral-400 mt-1">
            Save or configure your bot in Settings to preview the live widget.
          </p>
        </div>
      )}
    </div>
  );
}
