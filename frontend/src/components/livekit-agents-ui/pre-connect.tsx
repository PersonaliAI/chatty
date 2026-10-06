"use client";

import React from "react";

export interface LiveKitPreConnectPromptProps {
  message?: string;
  className?: string;
}

export function LiveKitPreConnectPrompt({
  message = "Agent is listening, ask it a question",
  className = "",
}: LiveKitPreConnectPromptProps) {
  return (
    <div className={`py-2 px-4 text-center ${className}`}>
      <p className="inline-block text-xs font-medium text-neutral-400 dark:text-neutral-500 animate-pulse tracking-wide">
        ✨ {message}
      </p>
    </div>
  );
}
