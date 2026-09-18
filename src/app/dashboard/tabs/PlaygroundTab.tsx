import React, { useState } from "react";
import { RotateCw, ExternalLink, Sparkles, Monitor, Smartphone } from "lucide-react";

export interface PlaygroundTabProps {
  botId?: string | null;
  botName?: string;
  primaryColor?: string;
  [key: string]: any;
}

export function PlaygroundTab({
  botId,
  botName,
  primaryColor = "#0052FF",
  ...rest
}: PlaygroundTabProps) {
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [refreshKey, setRefreshKey] = useState(0);

  const reloadIframe = () => setRefreshKey((k) => k + 1);

  return (
    <div className="flex flex-col items-center justify-center p-6 w-full max-w-4xl mx-auto space-y-4">
      <div className="w-full flex items-center justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800">
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
          className={`transition-all duration-300 flex items-center justify-center p-4 rounded-2xl bg-neutral-100/70 dark:bg-neutral-900/50 border border-neutral-200/80 dark:border-neutral-800 w-full ${
            device === "mobile" ? "max-w-[420px]" : "max-w-[500px]"
          }`}
        >
          <iframe
            key={refreshKey}
            src={`/embed/${botId}`}
            className="w-full h-[680px] rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-2xl bg-white dark:bg-neutral-950"
            title="Live Widget Preview"
          />
        </div>
      ) : (
        <div className="w-full max-w-lg h-[450px] rounded-2xl border border-dashed border-neutral-300 dark:border-neutral-700 flex flex-col items-center justify-center text-center p-6">
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
