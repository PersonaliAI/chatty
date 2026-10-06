"use client";

import React, { useMemo } from "react";
import type { AgentState } from "@livekit/components-react";
import type { LocalAudioTrack, RemoteAudioTrack } from "livekit-client";

import { AgentAudioVisualizerAura, type AgentAudioVisualizerAuraProps } from "./agent-audio-visualizer-aura";
import { AgentAudioVisualizerWave, type AgentAudioVisualizerWaveProps } from "./agent-audio-visualizer-wave";
import { AgentAudioVisualizerRadial, type AgentAudioVisualizerRadialProps } from "./agent-audio-visualizer-radial";
import { AgentAudioVisualizerGrid, type AgentAudioVisualizerGridProps } from "./agent-audio-visualizer-grid";
import { AgentAudioVisualizerBar, type AgentAudioVisualizerBarProps } from "./agent-audio-visualizer-bar";

import { useSimulatedVolumeBands } from "./hooks/use-simulated-volume-bands";

export {
  AgentAudioVisualizerAura,
  AgentAudioVisualizerWave,
  AgentAudioVisualizerRadial,
  AgentAudioVisualizerGrid,
  AgentAudioVisualizerBar,
  useSimulatedVolumeBands,
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

  // Determine required band count based on visualizer geometry
  const requiredBands = useMemo(() => {
    switch (safeType) {
      case "radial":
        return barCount ?? VISUALIZER_DEFAULTS.radial.barCount;
      case "grid":
        return columnCount ?? (size === "sm" ? 9 : size === "lg" ? 17 : 15);
      case "bar":
        return barCount ?? VISUALIZER_DEFAULTS.bar.barCount;
      case "aura":
      case "wave":
      default:
        return 5;
    }
  }, [safeType, barCount, columnCount, size]);

  // Hook into continuous 60fps simulated multi-band volume stream
  const simulatedBands = useSimulatedVolumeBands(requiredBands);

  // When speaking without a live WebRTC audioTrack (e.g. preview mode or widget simulated voice),
  // stream real-time 60fps oscillating volume bands simulating natural speech pauses and cadence.
  const isSimulatedSpeaking = !audioTrack && lkState === "speaking";

  const effectiveVolumeBands = useMemo(() => {
    if (!isSimulatedSpeaking) return undefined;
    return simulatedBands;
  }, [isSimulatedSpeaking, simulatedBands]);

  const effectiveVolume = useMemo(() => {
    if (lkState !== "speaking") return 0;
    if (!audioTrack) {
      return simulatedBands[0] ?? Math.max(0.1, audioLevel);
    }
    return Math.max(0.1, audioLevel);
  }, [lkState, audioTrack, simulatedBands, audioLevel]);

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
            volume={audioTrack ? undefined : effectiveVolume}
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
            volume={audioTrack ? undefined : effectiveVolume}
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
            volumeBands={effectiveVolumeBands}
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
            volumeBands={effectiveVolumeBands}
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
            volumeBands={effectiveVolumeBands}
          />
        </div>
      );
  }
}
