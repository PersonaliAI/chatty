"use client";

import { useState } from "react";
import { Sliders, Eye, Check } from "lucide-react";
import {
  LiveKitAudioVisualizer,
  VisualizerType,
} from "@/components/livekit-agents-ui/audio-visualizers";
import { LiveKitControlBar } from "@/components/livekit-agents-ui/control-bar";
import { LiveKitPreConnectPrompt } from "@/components/livekit-agents-ui/pre-connect";

export interface VoiceUiSettingsData {
  visualizerType?: VisualizerType | "orb";
  visualizerSize?: "sm" | "md" | "lg";
  visualizerColor?: string;
  visualizerBarCount?: number;
  themeMode?: "dark" | "light";
  preConnectMessage?: string;
  isPreConnectBufferEnabled?: boolean;
  controlBarVariant?: "livekit" | "outline" | "default";
  controls?: {
    leave?: boolean;
    microphone?: boolean;
    chat?: boolean;
    camera?: boolean;
    screenShare?: boolean;
  };
}

export const DEFAULT_VOICE_UI_SETTINGS: VoiceUiSettingsData = {
  visualizerType: "bar",
  visualizerSize: "md",
  visualizerColor: "#f97316",
  visualizerBarCount: 5,
  themeMode: "dark",
  preConnectMessage: "Agent is listening, ask it a question",
  isPreConnectBufferEnabled: true,
  controlBarVariant: "livekit",
  controls: {
    leave: true,
    microphone: true,
    chat: true,
    camera: false,
    screenShare: false,
  },
};

interface VoiceUiCustomizerProps {
  settings: VoiceUiSettingsData;
  onChange: (patch: Partial<VoiceUiSettingsData>) => void;
  primaryColor?: string;
}

export function VoiceUiCustomizer({
  settings,
  onChange,
  primaryColor = "#f97316",
}: VoiceUiCustomizerProps) {
  const [activePreviewState, setActivePreviewState] = useState<"speaking" | "listening" | "thinking">("speaking");
  const [previewChatOpen, setPreviewChatOpen] = useState(false);

  const visualizerType = settings.visualizerType || "bar";
  const visualizerSize = settings.visualizerSize || "md";
  const visualizerColor = settings.visualizerColor || primaryColor;
  const barCount = settings.visualizerBarCount || 5;
  const controlVariant = settings.controlBarVariant || "livekit";
  const isPreConnectEnabled = settings.isPreConnectBufferEnabled !== false;
  const preConnectMsg = settings.preConnectMessage || "Agent is listening, ask it a question";
  const controls = settings.controls || DEFAULT_VOICE_UI_SETTINGS.controls;

  const colorPresets = [
    "#f97316", // Orange
    "#3b82f6", // Blue
    "#10b981", // Emerald
    "#8b5cf6", // Purple
    "#06b6d4", // Cyan
    "#ec4899", // Pink
    "#eab308", // Amber
    "#64748b", // Slate
  ];

  return (
    <div className="space-y-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 p-4 sm:p-5">
      <div className="flex items-center justify-between pb-3 border-b border-neutral-200/80 dark:border-neutral-800">
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200 flex items-center gap-2">
            <Sliders className="size-3.5 text-[#f97316]" /> LiveKit Agents UI & Appearance
          </h4>
          <p className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-0.5">
            Customize the official LiveKit visualizers, pre-connect prompts, and call control bar.
          </p>
        </div>
      </div>

      {/* Live Interactive Preview Box */}
      <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-4 shadow-sm flex flex-col items-center">
        <div className="w-full flex items-center justify-between mb-3 text-[10px] font-semibold text-neutral-400">
          <span className="flex items-center gap-1.5 uppercase tracking-wider">
            <Eye className="size-3 text-[#f97316]" /> Live UI Preview
          </span>
          <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-900 rounded-lg p-0.5">
            {(["speaking", "listening", "thinking"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setActivePreviewState(s)}
                className={`px-2 py-0.5 rounded-md capitalize transition-all cursor-pointer ${
                  activePreviewState === s
                    ? "bg-white dark:bg-neutral-800 font-bold text-neutral-800 dark:text-neutral-100 shadow-xs"
                    : "text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Visualizer Stage */}
        <div className="w-full py-6 flex flex-col items-center justify-center bg-neutral-50/80 dark:bg-neutral-900/50 rounded-xl border border-dashed border-neutral-200 dark:border-neutral-800">
          {visualizerType === "orb" ? (
            <div
              className="size-16 rounded-full animate-pulse transition-transform shadow-lg"
              style={{
                backgroundColor: visualizerColor,
                boxShadow: `0 0 25px ${visualizerColor}70`,
              }}
            />
          ) : (
            <LiveKitAudioVisualizer
              type={visualizerType}
              state={activePreviewState}
              color={visualizerColor}
              size={visualizerSize}
              barCount={barCount}
              audioLevel={activePreviewState === "speaking" ? 0.8 : 0.2}
            />
          )}

          {isPreConnectEnabled && (
            <LiveKitPreConnectPrompt message={preConnectMsg} className="mt-2" />
          )}
        </div>

        {/* Control Bar Preview */}
        <div className="w-full max-w-sm mt-4">
          <LiveKitControlBar
            variant={controlVariant}
            controls={controls}
            primaryColor={visualizerColor}
            isChatOpen={previewChatOpen}
            onToggleChat={() => setPreviewChatOpen((v: boolean) => !v)}
            onToggleMute={() => {}}
            onDisconnect={() => {}}
          />
        </div>
      </div>

      {/* 1. Visualizer Style Selection */}
      <div className="space-y-2">
        <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500">
          Audio Visualizer Style
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { id: "bar", label: "LiveKit Bar", desc: "Responsive audio bars" },
            { id: "wave", label: "Oscilloscope Wave", desc: "Smooth waveform" },
            { id: "radial", label: "Radial Ring", desc: "Circular pulsating orb" },
            { id: "orb", label: "Classic Orb", desc: "Glowing ambient sphere" },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange({ visualizerType: item.id as any })}
              className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                visualizerType === item.id
                  ? "border-[#f97316] bg-[#f97316]/5 dark:bg-[#f97316]/10 text-neutral-900 dark:text-neutral-100 font-semibold"
                  : "border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 hover:border-neutral-300"
              }`}
            >
              <div className="flex items-center justify-between text-xs">
                <span>{item.label}</span>
                {visualizerType === item.id && <Check className="size-3 text-[#f97316]" />}
              </div>
              <p className="text-[10px] text-neutral-400 mt-0.5">{item.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* 2. Visualizer Size & Bar Count */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500 mb-1.5">
            Visualizer Size
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { id: "sm", label: "Small" },
              { id: "md", label: "Medium" },
              { id: "lg", label: "Hero (Large)" },
            ].map((sz) => (
              <button
                key={sz.id}
                type="button"
                onClick={() => onChange({ visualizerSize: sz.id as any })}
                className={`py-1.5 rounded-lg border text-xs font-semibold text-center transition-all cursor-pointer ${
                  visualizerSize === sz.id
                    ? "border-[#f97316] bg-[#f97316] text-white"
                    : "border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-600 dark:text-neutral-300"
                }`}
              >
                {sz.label}
              </button>
            ))}
          </div>
        </div>

        {visualizerType !== "wave" && visualizerType !== "orb" && (
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500 mb-1.5">
              Bar Count
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {[3, 5, 7, 9].map((cnt) => (
                <button
                  key={cnt}
                  type="button"
                  onClick={() => onChange({ visualizerBarCount: cnt })}
                  className={`py-1.5 rounded-lg border text-xs font-semibold text-center transition-all cursor-pointer ${
                    barCount === cnt
                      ? "border-[#f97316] bg-[#f97316] text-white"
                      : "border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-600 dark:text-neutral-300"
                  }`}
                >
                  {cnt} bars
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 3. Color Customization */}
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500 mb-1.5">
          Visualizer Accent Color
        </label>
        <div className="flex flex-wrap items-center gap-2">
          {colorPresets.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onChange({ visualizerColor: c })}
              className={`size-6 rounded-full border-2 transition-transform cursor-pointer ${
                visualizerColor === c ? "border-neutral-900 dark:border-white scale-110" : "border-transparent"
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
          <input
            type="text"
            value={visualizerColor}
            onChange={(e) => onChange({ visualizerColor: e.target.value })}
            placeholder="#f97316"
            className="w-24 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-2 py-1 text-xs text-center font-mono text-neutral-800 dark:text-neutral-200"
          />
        </div>
      </div>

      {/* 4. Pre-Connect Buffer Prompt */}
      <div className="p-3.5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">Pre-Connect Shimmer Prompt</span>
            <p className="text-[10px] text-neutral-400">Shows an animated cue before the first spoken or typed message.</p>
          </div>
          <button
            type="button"
            onClick={() => onChange({ isPreConnectBufferEnabled: !isPreConnectEnabled })}
            className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer ${
              isPreConnectEnabled ? "bg-[#f97316]" : "bg-neutral-200 dark:bg-neutral-800"
            }`}
          >
            <div className={`size-4 rounded-full bg-white transition-transform ${isPreConnectEnabled ? "translate-x-4" : ""}`} />
          </button>
        </div>

        {isPreConnectEnabled && (
          <input
            type="text"
            value={preConnectMsg}
            onChange={(e) => onChange({ preConnectMessage: e.target.value })}
            placeholder="Agent is listening, ask it a question"
            className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-neutral-800 dark:text-neutral-200"
          />
        )}
      </div>

      {/* 5. Control Bar Variant & Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500 mb-1.5">
            Control Bar Style
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { id: "livekit", label: "LiveKit Pill" },
              { id: "outline", label: "Outline" },
              { id: "default", label: "Rounded" },
            ].map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => onChange({ controlBarVariant: v.id as any })}
                className={`py-1.5 rounded-lg border text-xs font-semibold text-center transition-all cursor-pointer ${
                  controlVariant === v.id
                    ? "border-[#f97316] bg-[#f97316] text-white"
                    : "border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-600 dark:text-neutral-300"
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500 mb-1.5">
            Visible Controls
          </label>
          <div className="flex flex-wrap gap-2 text-xs">
            {[
              { id: "chat", label: "Text Chat" },
              { id: "camera", label: "Camera" },
              { id: "screenShare", label: "Screen Share" },
            ].map((ctrl) => {
              const active = controls?.[ctrl.id as keyof typeof controls] ?? false;
              return (
                <button
                  key={ctrl.id}
                  type="button"
                  onClick={() =>
                    onChange({
                      controls: {
                        ...controls,
                        [ctrl.id]: !active,
                      },
                    })
                  }
                  className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition-all cursor-pointer ${
                    active
                      ? "border-[#f97316] bg-[#f97316]/10 text-[#f97316]"
                      : "border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-400"
                  }`}
                >
                  {ctrl.label} {active ? "✓" : "off"}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
