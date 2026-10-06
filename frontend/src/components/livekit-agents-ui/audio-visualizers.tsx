"use client";

import React, { useMemo, useEffect, useState } from "react";

export type VisualizerType = "bar" | "wave" | "radial";
export type AgentVisualizerState = "connecting" | "listening" | "thinking" | "speaking" | "ended";

export interface AudioVisualizerProps {
  type?: VisualizerType;
  state?: AgentVisualizerState;
  color?: string;
  size?: "sm" | "md" | "lg";
  barCount?: number;
  audioLevel?: number; // 0 to 1
  className?: string;
}

/**
 * 1. Bar Visualizer (Official LiveKit Pattern)
 * Displays reactive bars with state animations for connecting, listening, thinking, and speaking.
 */
export function LiveKitBarVisualizer({
  state = "listening",
  color = "#f97316",
  size = "md",
  barCount = 5,
  audioLevel = 0,
  className = "",
}: AudioVisualizerProps) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    let animId: number;
    let count = 0;
    const loop = () => {
      count++;
      setFrame(count);
      animId = requestAnimationFrame(loop);
    };
    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, []);

  const count = Math.max(3, Math.min(15, barCount));

  const heights = useMemo(() => {
    return Array.from({ length: count }, (_, idx) => {
      if (state === "speaking") {
        const spread = Math.sin((idx / (count - 1)) * Math.PI);
        const wave = Math.sin(frame * 0.15 + idx * 0.8) * 0.2;
        const h = Math.max(0.12, Math.min(1.0, (audioLevel * 0.9 + wave) * spread + 0.15));
        return h;
      }
      if (state === "thinking") {
        const activeIdx = Math.floor((frame / 6) % count);
        return idx === activeIdx ? 0.85 : 0.25;
      }
      if (state === "connecting") {
        const progress = ((frame % 60) / 60) * count;
        const diff = Math.abs(progress - idx);
        return diff < 1 ? 0.7 : 0.2;
      }
      // Listening: gentle ambient breathing
      const breath = Math.sin(frame * 0.05 + idx * 0.4) * 0.15 + 0.3;
      return Math.max(0.15, breath + audioLevel * 0.4);
    });
  }, [state, count, frame, audioLevel]);

  const heightClass = size === "sm" ? "h-8 gap-1" : size === "lg" ? "h-20 gap-2.5" : "h-14 gap-1.5";
  const barWidth = size === "sm" ? "w-1" : size === "lg" ? "w-2.5" : "w-1.5";

  return (
    <div className={`flex items-center justify-center ${heightClass} ${className}`} aria-label={`Voice visualizer (${state})`}>
      {heights.map((h, i) => (
        <span
          key={i}
          className={`${barWidth} rounded-full transition-all duration-75 ease-out`}
          style={{
            height: `${Math.round(h * 100)}%`,
            backgroundColor: color,
            opacity: state === "listening" ? 0.7 : state === "thinking" ? 0.85 : 1,
            boxShadow: state === "speaking" ? `0 0 10px ${color}60` : undefined,
          }}
        />
      ))}
    </div>
  );
}

/**
 * 2. Wave Visualizer (Smooth Audio Waveform)
 */
export function LiveKitWaveVisualizer({
  state = "listening",
  color = "#f97316",
  size = "md",
  audioLevel = 0,
  className = "",
}: AudioVisualizerProps) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    let animId: number;
    let count = 0;
    const loop = () => {
      count++;
      setFrame(count);
      animId = requestAnimationFrame(loop);
    };
    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, []);

  const width = size === "sm" ? 120 : size === "lg" ? 220 : 160;
  const height = size === "sm" ? 36 : size === "lg" ? 64 : 48;
  const points = 32;

  const pathD = useMemo(() => {
    const centerY = height / 2;
    const amp = state === "speaking"
      ? Math.max(4, audioLevel * (height * 0.42))
      : state === "thinking"
      ? Math.sin(frame * 0.2) * 8 + 10
      : Math.sin(frame * 0.05) * 4 + 6;

    const coords: [number, number][] = [];
    for (let i = 0; i < points; i++) {
      const x = (i / (points - 1)) * width;
      const bell = Math.sin((i / (points - 1)) * Math.PI);
      const wave = Math.sin(i * 0.5 + frame * 0.12);
      const y = centerY + wave * amp * bell;
      coords.push([x, y]);
    }

    if (coords.length === 0) return "";
    return coords.reduce((acc, [x, y], idx) => {
      return idx === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`;
    }, "");
  }, [width, height, points, state, audioLevel, frame]);

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <svg width={width} height={height} className="overflow-visible">
        <path
          d={pathD}
          fill="none"
          stroke={color}
          strokeWidth={size === "lg" ? 3 : 2}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            filter: state === "speaking" ? `drop-shadow(0 0 6px ${color}80)` : undefined,
          }}
        />
      </svg>
    </div>
  );
}

/**
 * 3. Radial Visualizer (Circular Ring / Orb with live radiating spokes)
 */
export function LiveKitRadialVisualizer({
  state = "listening",
  color = "#f97316",
  size = "md",
  barCount = 16,
  audioLevel = 0,
  className = "",
}: AudioVisualizerProps) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    let animId: number;
    let count = 0;
    const loop = () => {
      count++;
      setFrame(count);
      animId = requestAnimationFrame(loop);
    };
    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, []);

  const totalBars = Math.max(12, Math.min(32, barCount));
  const diameter = size === "sm" ? 64 : size === "lg" ? 130 : 96;
  const radius = diameter / 2;

  return (
    <div
      className={`relative flex items-center justify-center ${className}`}
      style={{ width: diameter, height: diameter }}
    >
      {/* Center glowing core */}
      <div
        className="absolute rounded-full transition-all duration-200"
        style={{
          width: radius * 0.9,
          height: radius * 0.9,
          backgroundColor: `${color}15`,
          border: `1.5px solid ${color}40`,
          boxShadow: state === "speaking" ? `0 0 16px ${color}40` : undefined,
          transform: state === "thinking" ? `scale(${1 + Math.sin(frame * 0.1) * 0.08})` : undefined,
        }}
      />

      {/* Radiating bars */}
      {Array.from({ length: totalBars }).map((_, idx) => {
        const angle = (idx / totalBars) * 360;
        const rad = (angle * Math.PI) / 180;
        let barLen = 4;

        if (state === "speaking") {
          const wave = Math.sin(frame * 0.15 + idx * 0.6);
          barLen = Math.max(3, (audioLevel * 18 + wave * 4));
        } else if (state === "thinking") {
          const active = (Math.floor(frame / 4) % totalBars) === idx;
          barLen = active ? 14 : 4;
        } else if (state === "connecting") {
          const active = (Math.floor(frame / 3) % totalBars) === idx;
          barLen = active ? 12 : 3;
        } else {
          barLen = Math.max(3, Math.sin(frame * 0.04 + idx * 0.3) * 3 + 4);
        }

        const barWidth = size === "lg" ? 2.5 : 2;

        return (
          <div
            key={idx}
            className="absolute rounded-full origin-bottom"
            style={{
              width: barWidth,
              height: barLen,
              backgroundColor: color,
              opacity: state === "speaking" ? 0.95 : 0.6,
              transform: `rotate(${angle}deg) translate(0px, -${radius - 4}px)`,
            }}
          />
        );
      })}
    </div>
  );
}

/**
 * Universal Unified Visualizer Router
 */
export function LiveKitAudioVisualizer(props: AudioVisualizerProps) {
  const visualizerType = props.type || "bar";
  if (visualizerType === "wave") {
    return <LiveKitWaveVisualizer {...props} />;
  }
  if (visualizerType === "radial") {
    return <LiveKitRadialVisualizer {...props} />;
  }
  return <LiveKitBarVisualizer {...props} />;
}
