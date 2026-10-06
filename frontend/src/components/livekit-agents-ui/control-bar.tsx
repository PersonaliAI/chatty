"use client";

import React, { useState } from "react";
import {
  Mic,
  MicOff,
  MessageSquareText,
  PhoneOff,
  SendHorizontal,
  Loader2,
  Camera,
  Monitor,
} from "lucide-react";

export interface LiveKitControlBarProps {
  variant?: "livekit" | "outline" | "default";
  controls?: {
    leave?: boolean;
    microphone?: boolean;
    chat?: boolean;
    camera?: boolean;
    screenShare?: boolean;
  };
  muted?: boolean;
  onToggleMute?: () => void;
  onDisconnect?: () => void;
  primaryColor?: string;
  isChatOpen?: boolean;
  onToggleChat?: () => void;
  onSendMessage?: (text: string) => Promise<void> | void;
  className?: string;
  disabled?: boolean;
}

export function LiveKitControlBar({
  variant = "livekit",
  controls = {
    leave: true,
    microphone: true,
    chat: true,
    camera: false,
    screenShare: false,
  },
  muted = false,
  onToggleMute,
  onDisconnect,
  primaryColor = "#f97316",
  isChatOpen = false,
  onToggleChat,
  onSendMessage,
  className = "",
  disabled = false,
}: LiveKitControlBarProps) {
  const [typedMessage, setTypedMessage] = useState("");
  const [isSending, setIsSending] = useState(false);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = typedMessage.trim();
    if (!text || isSending) return;

    try {
      setIsSending(true);
      await onSendMessage?.(text);
      setTypedMessage("");
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const isLivekit = variant === "livekit";
  const containerRadius = isLivekit ? "rounded-[31px]" : "rounded-2xl";

  return (
    <div
      className={`flex flex-col bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-lg p-2.5 transition-all ${containerRadius} ${className}`}
    >
      {/* Expandable Chat Composer */}
      {isChatOpen && (
        <form
          onSubmit={handleSend}
          className="flex items-center gap-2 mb-2 pb-2 border-b border-neutral-100 dark:border-neutral-800 px-1"
        >
          <input
            type="text"
            value={typedMessage}
            onChange={(e) => setTypedMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message while on call..."
            disabled={isSending}
            className="flex-1 text-xs bg-transparent outline-none placeholder:text-neutral-400 text-neutral-800 dark:text-neutral-200 disabled:opacity-60"
            autoFocus
          />
          <button
            type="submit"
            disabled={!typedMessage.trim() || isSending}
            aria-label="Send message"
            title={isSending ? "Sending…" : "Send message"}
            className="grid size-8 place-items-center rounded-full text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            style={{ backgroundColor: primaryColor }}
          >
            {isSending ? (
              <Loader2 className="size-4 animate-spin text-white" />
            ) : (
              <SendHorizontal className="size-4" />
            )}
          </button>
        </form>
      )}

      {/* Control Buttons Strip */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {/* Microphone Toggle */}
          {controls.microphone !== false && (
            <button
              type="button"
              onClick={onToggleMute}
              disabled={disabled}
              aria-label={muted ? "Unmute microphone" : "Mute microphone"}
              className={`flex items-center justify-center size-9 transition-all cursor-pointer active:scale-95 ${
                isLivekit ? "rounded-full" : "rounded-xl"
              } ${
                muted
                  ? "bg-red-500/10 text-red-500 border border-red-500/20"
                  : "bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 hover:bg-neutral-200 dark:hover:bg-neutral-700"
              }`}
            >
              {muted ? <MicOff className="size-4" /> : <Mic className="size-4" />}
            </button>
          )}

          {/* Chat Toggle */}
          {controls.chat !== false && (
            <button
              type="button"
              onClick={onToggleChat}
              aria-label="Toggle chat"
              className={`flex items-center justify-center size-9 transition-all cursor-pointer active:scale-95 ${
                isLivekit ? "rounded-full" : "rounded-xl"
              } ${
                isChatOpen
                  ? "text-white"
                  : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700"
              }`}
              style={{
                backgroundColor: isChatOpen ? primaryColor : undefined,
              }}
            >
              <MessageSquareText className="size-4" />
            </button>
          )}

          {/* Camera Placeholder (Optional) */}
          {controls.camera && (
            <button
              type="button"
              disabled
              aria-label="Camera"
              className={`flex items-center justify-center size-9 opacity-40 bg-neutral-100 dark:bg-neutral-800 text-neutral-400 ${
                isLivekit ? "rounded-full" : "rounded-xl"
              }`}
            >
              <Camera className="size-4" />
            </button>
          )}

          {/* Screen Share Placeholder (Optional) */}
          {controls.screenShare && (
            <button
              type="button"
              disabled
              aria-label="Screen share"
              className={`flex items-center justify-center size-9 opacity-40 bg-neutral-100 dark:bg-neutral-800 text-neutral-400 ${
                isLivekit ? "rounded-full" : "rounded-xl"
              }`}
            >
              <Monitor className="size-4" />
            </button>
          )}
        </div>

        {/* End Call / Leave Button */}
        {controls.leave !== false && (
          <button
            type="button"
            onClick={onDisconnect}
            aria-label="End call"
            className={`flex items-center gap-1.5 px-3.5 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/20 text-xs font-semibold cursor-pointer transition-all active:scale-95 ${
              isLivekit ? "rounded-full" : "rounded-xl"
            }`}
          >
            <PhoneOff className="size-3.5" />
            <span>End call</span>
          </button>
        )}
      </div>
    </div>
  );
}
