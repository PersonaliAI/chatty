"use client";

import { type ComponentProps } from "react";
import { useEnsureRoom, useStartAudio } from "@livekit/components-react";
import { type Room } from "livekit-client";
import { Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StartAudioButtonProps extends ComponentProps<"button"> {
  size?: "default" | "sm" | "lg";
  room?: Room;
  label?: string;
  primaryColor?: string;
}

/**
 * Official LiveKit StartAudioButton:
 * Allows visitors to start or resume audio playback when browsers block autoplay.
 * Automatically handles browser user gesture unlock.
 */
export function StartAudioButton({
  size = "default",
  label = "Enable Audio",
  room,
  primaryColor = "#f97316",
  className,
  ...props
}: StartAudioButtonProps) {
  const roomEnsured = useEnsureRoom(room);
  const { mergedProps } = useStartAudio({ room: roomEnsured, props });

  // useStartAudio conditionally hides or shows itself via mergedProps style/aria
  return (
    <button
      type="button"
      {...props}
      {...mergedProps}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-xs font-semibold text-white shadow-md transition-all hover:opacity-90 active:scale-95 cursor-pointer",
        size === "sm" && "px-3 py-1.5 text-[11px]",
        size === "lg" && "px-5 py-2.5 text-sm",
        className
      )}
      style={{ backgroundColor: primaryColor }}
    >
      <Volume2 className="size-4 animate-pulse" />
      <span>{label}</span>
    </button>
  );
}
