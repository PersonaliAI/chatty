"use client";

import React, { useMemo } from "react";
import type { AgentState } from "@livekit/components-react";
import type { LocalAudioTrack, RemoteAudioTrack } from "livekit-client";

import { AgentAudioVisualizerAura, type AgentAudioVisualizerAuraProps } from "./agent-audio-visualizer-aura";
import { AgentAudioVisualizerWave, type AgentAudioVisualizerWaveProps } from "./agent-audio-visualizer-wave";
import { AgentAudioVisualizerRadial, type AgentAudioVisualizerRadialProps } from "./agent-audio-visualizer-radial";
import { AgentAudioVisualizerGrid, type AgentAudioVisualizerGridProps } from "./agent-audio-visualizer-grid";
import { AgentAudioVisualizerBar, type AgentAudioVisualizerBarProps } from "./agent-audio-visualizer-bar";

export {
  AgentAudioVisualizerAura,
  AgentAudioVisualizerWave,
  AgentAudioVisualizerRadial,
  AgentAudioVisualizerGrid,
  AgentAudioVisualizerBar,
};

export type VisualizerType = "aura" | "wave" | "radial" | "grid" | "bar";
export type AgentVisualizerState = "connecting" | "listening" | "thinking" | "speaking" | "ended" | "idle";

export const VISUALIZER_DEFAULTS = {
  aura: {
    color: "#1FD5F9",
    colorShift: 0.3,
  },
  wave: {
    color: "#FA954C",
    colorShift: 0.3,
    lineWidth: 2,
  },
  radial: {
    color: "#04A43A",
    radius: 60,
    barCount: 24,
  },
  grid: {
    color: "#C04CFA",
    rowCount: 15,
    columnCount: 15,
  },
  bar: {
    color: "#4CA3FA",
    barCount: 5,
  },
} as const;

export interface AudioVisualizerProps {
  type?: VisualizerType;
  state?: AgentVisualizerState;
  color?: string;
  size?: "icon" | "sm" | "md" | "lg" | "xl";
  barCount?: number;
  rowCount?: number;
  columnCount?: number;
  radius?: number;
  colorShift?: number;
  lineWidth?: number;
  audioLevel?: number; // 0 to 1
  audioTrack?: LocalAudioTrack | RemoteAudioTrack;
  className?: string;
}

/**
 * Normalizes input state string to official LiveKit AgentState
 */
function toLiveKitAgentState(state?: string): AgentState {
  switch (state) {
    case "connecting":
      return "connecting";
    case "listening":
      return "listening";
    case "thinking":
      return "thinking";
    case "speaking":
    case "agent-speaking":
      return "speaking";
    case "ended":
      return "disconnected";
    default:
      return "listening";
  }
}

/**
 * Universal Unified LiveKit Audio Visualizer Component
 * Directly renders the official LiveKit visualizers:
 * - <AgentAudioVisualizerAura />
 * - <AgentAudioVisualizerWave />
 * - <AgentAudioVisualizerRadial />
 * - <AgentAudioVisualizerGrid />
 * - <AgentAudioVisualizerBar />
 */
export function LiveKitAudioVisualizer({
  type = "bar",
  state = "listening",
  color,
  size = "md",
  barCount,
  rowCount,
  columnCount,
  radius,
  colorShift,
  lineWidth,
  audioLevel = 0,
  audioTrack,
  className = "",
}: AudioVisualizerProps) {
  const lkState = toLiveKitAgentState(state);
  const safeType: VisualizerType = (["aura", "wave", "radial", "grid", "bar"].includes(type) ? type : "bar") as VisualizerType;
  const activeColor = (color || VISUALIZER_DEFAULTS[safeType]?.color || "#4CA3FA") as `#${string}`;

  // Generate multi-band volumes when simulating from audioLevel
  const volume = lkState === "speaking" ? Math.max(0.1, audioLevel) : 0;
  const simulatedVolumeBands = useMemo(() => {
    if (lkState !== "speaking") return undefined;
    const bandLength = 36;
    return Array.from({ length: bandLength }, (_, i) => {
      const spread = Math.sin((i / (bandLength - 1)) * Math.PI);
      return Math.max(0.05, Math.min(1.0, audioLevel * spread * (0.7 + Math.random() * 0.3)));
    });
  }, [lkState, audioLevel]);

  switch (safeType) {
    case "aura":
      return (
        <div className={`relative flex items-center justify-center ${className}`}>
          <AgentAudioVisualizerAura
            state={lkState}
            color={activeColor}
            colorShift={colorShift ?? VISUALIZER_DEFAULTS.aura.colorShift}
            size={size}
            audioTrack={audioTrack}
            volume={volume}
          />
        </div>
      );

    case "wave":
      return (
        <div className={`relative flex items-center justify-center ${className}`}>
          <AgentAudioVisualizerWave
            state={lkState}
            color={activeColor}
            colorShift={colorShift ?? VISUALIZER_DEFAULTS.wave.colorShift}
            lineWidth={lineWidth ?? VISUALIZER_DEFAULTS.wave.lineWidth}
            size={size}
            audioTrack={audioTrack}
            volume={volume}
          />
        </div>
      );

    case "radial":
      return (
        <div className={`relative flex items-center justify-center ${className}`}>
          <AgentAudioVisualizerRadial
            state={lkState}
            color={activeColor}
            radius={radius ?? (size === "sm" ? 30 : size === "lg" ? 80 : 60)}
            barCount={barCount ?? VISUALIZER_DEFAULTS.radial.barCount}
            size={size}
            audioTrack={audioTrack}
            volumeBands={simulatedVolumeBands}
          />
        </div>
      );

    case "grid":
      return (
        <div className={`relative flex items-center justify-center ${className}`}>
          <AgentAudioVisualizerGrid
            state={lkState}
            color={activeColor}
            rowCount={rowCount ?? (size === "sm" ? 9 : size === "lg" ? 17 : 15)}
            columnCount={columnCount ?? (size === "sm" ? 9 : size === "lg" ? 17 : 15)}
            size={size}
            audioTrack={audioTrack}
            volumeBands={simulatedVolumeBands}
          />
        </div>
      );

    case "bar":
    default:
      return (
        <div className={`relative flex items-center justify-center ${className}`}>
          <AgentAudioVisualizerBar
            state={lkState}
            color={activeColor}
            barCount={barCount ?? VISUALIZER_DEFAULTS.bar.barCount}
            size={size}
            audioTrack={audioTrack}
            volumeBands={simulatedVolumeBands}
          />
        </div>
      );
  }
}
