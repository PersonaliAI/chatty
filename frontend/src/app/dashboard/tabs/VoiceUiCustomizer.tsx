"use client";

import { useState } from "react";
import {
  Sliders,
  Eye,
  Check,
  Disc,
  Activity,
  SunMedium,
  Grid3X3,
  BarChart3,
  Mic,
  MessageSquare,
  PhoneOff,
} from "lucide-react";
import {
  LiveKitAudioVisualizer,
  type VisualizerType,
  VISUALIZER_DEFAULTS,
} from "@/components/livekit-agents-ui/audio-visualizers";
import { LiveKitControlBar } from "@/components/livekit-agents-ui/control-bar";
import { LiveKitPreConnectPrompt } from "@/components/livekit-agents-ui/pre-connect";

export interface VoiceUiSettingsData {
  visualizerType?: VisualizerType;
  visualizerSize?: "icon" | "sm" | "md" | "lg" | "xl";
  visualizerColor?: string;
  visualizerBarCount?: number;
  visualizerRowCount?: number;
  visualizerColumnCount?: number;
  visualizerRadius?: number;
  visualizerColorShift?: number;
  visualizerLineWidth?: number;
  themeMode?: "dark" | "light";
  preConnectMessage?: string;
  isPreConnectBufferEnabled?: boolean;
  controlBarVariant?: "livekit" | "outline" | "default";
  controls?: {
    leave?: boolean;
    microphone?: boolean;
    chat?: boolean;
  };
}

export const VISUALIZER_METADATA: Record<
  VisualizerType,
  {
    title: string;
    label: string;
    desc: string;
    defaultColor: string;
  }
> = {
  aura: {
    title: "<AgentAudioVisualizerAura />",
    label: "AURA",
    desc: "An undulating energy field. Designed in partnership with Unicorn Studio. Powered with a custom WebGL shader.",
    defaultColor: "#1FD5F9",
  },
  wave: {
    title: "<AgentAudioVisualizerWave />",
    label: "WAVE",
    desc: "An oscillating wave visualizer powered by a custom WebGL shader.",
    defaultColor: "#FA954C",
  },
  radial: {
    title: "<AgentAudioVisualizerRadial />",
    label: "RADIAL",
    desc: "Give your agent a bright and energetic appearance with our radial visualizer.",
    defaultColor: "#04A43A",
  },
  grid: {
    title: "<AgentAudioVisualizerGrid />",
    label: "GRID",
    desc: "A retro, lo-fi vibe dot-matrix grid visualizer.",
    defaultColor: "#C04CFA",
  },
  bar: {
    title: "<AgentAudioVisualizerBar />",
    label: "BAR",
    desc: "Our classic bar visualizer.",
    defaultColor: "#4CA3FA",
  },
};

export const DEFAULT_VOICE_UI_SETTINGS: VoiceUiSettingsData = {
  visualizerType: "aura",
  visualizerSize: "md",
  visualizerColor: "#1FD5F9",
  visualizerBarCount: 5,
  visualizerRowCount: 15,
  visualizerColumnCount: 15,
  visualizerRadius: 60,
  visualizerColorShift: 0.3,
  visualizerLineWidth: 2,
  themeMode: "dark",
  preConnectMessage: "Agent is listening, ask it a question",
  isPreConnectBufferEnabled: true,
  controlBarVariant: "livekit",
  controls: {
    leave: true,
    microphone: true,
    chat: true,
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
  primaryColor = "#1FD5F9",
}: VoiceUiCustomizerProps) {
  const [activePreviewState, setActivePreviewState] = useState<
    "connecting" | "listening" | "speaking" | "thinking"
  >("speaking");
  const [previewChatOpen, setPreviewChatOpen] = useState(false);

  const rawType = settings.visualizerType || "aura";
  const visualizerType: VisualizerType = (["aura", "wave", "radial", "grid", "bar"].includes(rawType)
    ? rawType
    : "aura") as VisualizerType;

  const currentMeta = VISUALIZER_METADATA[visualizerType] || VISUALIZER_METADATA.aura;
  const visualizerColor = settings.visualizerColor || currentMeta.defaultColor;

  const visualizerSize = settings.visualizerSize || "md";
  const barCount = settings.visualizerBarCount ?? (visualizerType === "radial" ? 24 : 5);
  const rowCount = settings.visualizerRowCount ?? 15;
  const columnCount = settings.visualizerColumnCount ?? 15;
  const radius = settings.visualizerRadius ?? 60;
  const colorShift = settings.visualizerColorShift ?? 0.3;
  const lineWidth = settings.visualizerLineWidth ?? 2;

  const controls = {
    leave: settings.controls?.leave ?? true,
    microphone: settings.controls?.microphone ?? true,
    chat: settings.controls?.chat ?? true,
  };

  const handleSelectVisualizer = (type: VisualizerType) => {
    const meta = VISUALIZER_METADATA[type];
    onChange({
      visualizerType: type,
      visualizerColor: meta.defaultColor,
      visualizerColorShift: 0.3,
      visualizerLineWidth: 2,
      visualizerRadius: 60,
      visualizerBarCount: type === "radial" ? 24 : 5,
      visualizerRowCount: 15,
      visualizerColumnCount: 15,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-neutral-200 dark:border-neutral-800">
        <div>
          <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
            <Sliders className="size-4.5 text-[#1FD5F9]" />
            Official LiveKit Voice UI Personality
          </h3>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            Choose from five official LiveKit audio visualizer styles with real-time behaviors for every agent state.
          </p>
        </div>
      </div>

      {/* Main Interactive LiveKit Studio Layout */}
      <div className="rounded-2xl border border-neutral-800 bg-[#0d0d0f] text-neutral-100 overflow-hidden shadow-2xl">
        <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[460px]">
          {/* Left Vertical Visualizer Selector Bar */}
          <div className="lg:col-span-2 border-b lg:border-b-0 lg:border-r border-neutral-800/80 bg-neutral-950/60 p-3 flex flex-row lg:flex-col gap-2 justify-start items-stretch">
            {(
              [
                { id: "aura", label: "AURA", icon: Disc },
                { id: "wave", label: "WAVE", icon: Activity },
                { id: "radial", label: "RADIAL", icon: SunMedium },
                { id: "grid", label: "GRID", icon: Grid3X3 },
                { id: "bar", label: "BAR", icon: BarChart3 },
              ] as const
            ).map((item) => {
              const Icon = item.icon;
              const isSelected = visualizerType === item.id;
              const meta = VISUALIZER_METADATA[item.id];
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectVisualizer(item.id)}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer text-left ${
                    isSelected
                      ? "bg-neutral-800/90 text-white shadow-sm ring-1 ring-neutral-700"
                      : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/50"
                  }`}
                >
                  <Icon
                    className="size-4 shrink-0 transition-colors"
                    style={{ color: isSelected ? meta.defaultColor : undefined }}
                  />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* Center Live Stage Preview */}
          <div className="lg:col-span-6 p-6 flex flex-col justify-between items-center relative bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-neutral-900/40 via-neutral-950 to-[#0a0a0c] border-b lg:border-b-0 lg:border-r border-neutral-800/80 min-h-[340px]">
            {/* Stage header info */}
            <div className="w-full flex items-center justify-between text-xs text-neutral-400">
              <span className="flex items-center gap-1.5 font-mono text-[11px] text-neutral-300">
                <Eye className="size-3.5 text-neutral-400" />
                Live Preview
              </span>
              <span className="font-mono text-[11px] text-neutral-500">
                {currentMeta.title}
              </span>
            </div>

            {/* Visualizer Renderer in Dark Field */}
            <div className="my-auto py-8 flex flex-col items-center justify-center min-h-[220px]">
              <LiveKitAudioVisualizer
                type={visualizerType}
                state={activePreviewState}
                color={visualizerColor}
                size={visualizerSize}
                barCount={barCount}
                rowCount={rowCount}
                columnCount={columnCount}
                radius={radius}
                colorShift={colorShift}
                lineWidth={lineWidth}
                audioLevel={activePreviewState === "speaking" ? 0.75 : 0}
              />
            </div>

            {/* Pill Control Bar Preview */}
            <div className="w-full max-w-sm mt-2">
              <LiveKitControlBar
                variant="livekit"
                controls={controls}
                primaryColor={visualizerColor}
                isChatOpen={previewChatOpen}
                onToggleChat={() => setPreviewChatOpen((v: boolean) => !v)}
                onToggleMute={() => {}}
                onDisconnect={() => {}}
              />
            </div>
          </div>

          {/* Right Parameters & Controls Panel */}
          <div className="lg:col-span-4 p-5 space-y-5 bg-neutral-950/40 flex flex-col justify-between">
            <div className="space-y-4">
              <div>
                <h4 className="font-mono text-sm font-bold text-white tracking-tight">
                  {currentMeta.title}
                </h4>
                <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                  {currentMeta.desc}
                </p>
              </div>

              {/* AGENT STATE Tabs */}
              <div className="space-y-1.5 pt-2">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                  Agent State
                </label>
                <div className="grid grid-cols-4 gap-1 p-1 bg-neutral-900 rounded-lg border border-neutral-800">
                  {(["connecting", "listening", "speaking", "thinking"] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setActivePreviewState(st)}
                      className={`py-1 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all cursor-pointer ${
                        activePreviewState === st
                          ? "bg-neutral-800 text-white shadow-sm ring-1 ring-neutral-700"
                          : "text-neutral-400 hover:text-neutral-200"
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              {/* COLOR HUE Slider + Hex Badge */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                    Color Hue
                  </label>
                  <div className="flex items-center gap-1.5">
                    <span
                      className="size-3 rounded-full border border-neutral-700 shadow-sm"
                      style={{ backgroundColor: visualizerColor }}
                    />
                    <span className="font-mono text-[11px] text-neutral-300">
                      {visualizerColor}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="0"
                    max="360"
                    defaultValue="185"
                    onChange={(e) => {
                      const hue = Number(e.target.value);
                      const hex = hslToHex(hue, 95, 55);
                      onChange({ visualizerColor: hex });
                    }}
                    className="w-full h-2 rounded-lg appearance-none cursor-pointer"
                    style={{
                      background:
                        "linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)",
                    }}
                  />
                  <input
                    type="color"
                    value={visualizerColor}
                    onChange={(e) => onChange({ visualizerColor: e.target.value })}
                    className="size-7 rounded border border-neutral-700 bg-transparent cursor-pointer p-0 shrink-0"
                    title="Choose hex color"
                  />
                </div>
              </div>

              {/* Component Specific Sliders */}
              {visualizerType === "aura" && (
                <div className="space-y-1 pt-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-neutral-400 uppercase tracking-wider font-semibold">
                      Color Shift
                    </span>
                    <span className="font-mono text-neutral-300">{colorShift}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={colorShift}
                    onChange={(e) =>
                      onChange({ visualizerColorShift: Number(e.target.value) })
                    }
                    className="w-full accent-[#1FD5F9] cursor-pointer"
                  />
                </div>
              )}

              {visualizerType === "wave" && (
                <>
                  <div className="space-y-1 pt-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-neutral-400 uppercase tracking-wider font-semibold">
                        Color Shift
                      </span>
                      <span className="font-mono text-neutral-300">{colorShift}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={colorShift}
                      onChange={(e) =>
                        onChange({ visualizerColorShift: Number(e.target.value) })
                      }
                      className="w-full accent-[#FA954C] cursor-pointer"
                    />
                  </div>
                  <div className="space-y-1 pt-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-neutral-400 uppercase tracking-wider font-semibold">
                        Line Width
                      </span>
                      <span className="font-mono text-neutral-300">{lineWidth}</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="5"
                      step="0.5"
                      value={lineWidth}
                      onChange={(e) =>
                        onChange({ visualizerLineWidth: Number(e.target.value) })
                      }
                      className="w-full accent-[#FA954C] cursor-pointer"
                    />
                  </div>
                </>
              )}

              {visualizerType === "radial" && (
                <>
                  <div className="space-y-1 pt-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-neutral-400 uppercase tracking-wider font-semibold">
                        Radius
                      </span>
                      <span className="font-mono text-neutral-300">{radius}</span>
                    </div>
                    <input
                      type="range"
                      min="30"
                      max="100"
                      step="5"
                      value={radius}
                      onChange={(e) =>
                        onChange({ visualizerRadius: Number(e.target.value) })
                      }
                      className="w-full accent-[#04A43A] cursor-pointer"
                    />
                  </div>
                  <div className="space-y-1 pt-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-neutral-400 uppercase tracking-wider font-semibold">
                        Bar Count
                      </span>
                      <span className="font-mono text-neutral-300">{barCount}</span>
                    </div>
                    <input
                      type="range"
                      min="12"
                      max="36"
                      step="4"
                      value={barCount}
                      onChange={(e) =>
                        onChange({ visualizerBarCount: Number(e.target.value) })
                      }
                      className="w-full accent-[#04A43A] cursor-pointer"
                    />
                  </div>
                </>
              )}

              {visualizerType === "grid" && (
                <>
                  <div className="space-y-1 pt-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-neutral-400 uppercase tracking-wider font-semibold">
                        Row Count
                      </span>
                      <span className="font-mono text-neutral-300">{rowCount}</span>
                    </div>
                    <input
                      type="range"
                      min="5"
                      max="21"
                      step="2"
                      value={rowCount}
                      onChange={(e) =>
                        onChange({ visualizerRowCount: Number(e.target.value) })
                      }
                      className="w-full accent-[#C04CFA] cursor-pointer"
                    />
                  </div>
                  <div className="space-y-1 pt-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-neutral-400 uppercase tracking-wider font-semibold">
                        Column Count
                      </span>
                      <span className="font-mono text-neutral-300">{columnCount}</span>
                    </div>
                    <input
                      type="range"
                      min="5"
                      max="21"
                      step="2"
                      value={columnCount}
                      onChange={(e) =>
                        onChange({ visualizerColumnCount: Number(e.target.value) })
                      }
                      className="w-full accent-[#C04CFA] cursor-pointer"
                    />
                  </div>
                </>
              )}

              {visualizerType === "bar" && (
                <div className="space-y-1 pt-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-neutral-400 uppercase tracking-wider font-semibold">
                      Bar Count
                    </span>
                    <span className="font-mono text-neutral-300">{barCount}</span>
                  </div>
                  <input
                    type="range"
                    min="3"
                    max="15"
                    step="1"
                    value={barCount}
                    onChange={(e) =>
                      onChange({ visualizerBarCount: Number(e.target.value) })
                    }
                    className="w-full accent-[#4CA3FA] cursor-pointer"
                  />
                </div>
              )}
            </div>

            {/* Quick reset to default color button */}
            <div className="pt-2 border-t border-neutral-900">
              <button
                type="button"
                onClick={() =>
                  onChange({ visualizerColor: currentMeta.defaultColor })
                }
                className="w-full py-1.5 px-3 rounded-lg border border-neutral-800 hover:border-neutral-700 bg-neutral-900/60 hover:bg-neutral-800 text-[11px] text-neutral-300 font-medium transition-colors cursor-pointer"
              >
                Reset to {currentMeta.label} Default Color ({currentMeta.defaultColor})
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Control Bar Media Settings (Microphone, Chat, Disconnect - NO Camera/Screenshare) */}
      <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 space-y-3">
        <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500">
          Control Bar Buttons
        </label>
        <p className="text-xs text-neutral-500">
          Enable or disable in-call controls for the official LiveKit pill control bar.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <label className="flex items-center gap-2.5 p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 text-xs font-semibold cursor-pointer">
            <input
              type="checkbox"
              checked={controls.microphone}
              onChange={(e) =>
                onChange({
                  controls: { ...controls, microphone: e.target.checked },
                })
              }
              className="rounded text-[#1FD5F9] focus:ring-0"
            />
            <Mic className="size-4 text-neutral-500" />
            Microphone Mute
          </label>

          <label className="flex items-center gap-2.5 p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 text-xs font-semibold cursor-pointer">
            <input
              type="checkbox"
              checked={controls.chat}
              onChange={(e) =>
                onChange({
                  controls: { ...controls, chat: e.target.checked },
                })
              }
              className="rounded text-[#1FD5F9] focus:ring-0"
            />
            <MessageSquare className="size-4 text-neutral-500" />
            Chat Transcript Toggle
          </label>

          <label className="flex items-center gap-2.5 p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 text-xs font-semibold cursor-pointer">
            <input
              type="checkbox"
              checked={controls.leave}
              onChange={(e) =>
                onChange({
                  controls: { ...controls, leave: e.target.checked },
                })
              }
              className="rounded text-[#1FD5F9] focus:ring-0"
            />
            <PhoneOff className="size-4 text-red-500" />
            Leave Call Button
          </label>
        </div>
      </div>

      {/* Pre-Connect Buffer & Shimmer Prompt */}
      <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500">
              Pre-Connect Shimmer Buffer
            </label>
            <p className="text-xs text-neutral-500 mt-0.5">
              LiveKit official pre-connect shimmer banner shown while connecting before first audio packet.
            </p>
          </div>
          <input
            type="checkbox"
            checked={settings.isPreConnectBufferEnabled ?? true}
            onChange={(e) =>
              onChange({ isPreConnectBufferEnabled: e.target.checked })
            }
            className="size-4 rounded text-[#1FD5F9]"
          />
        </div>

        {settings.isPreConnectBufferEnabled !== false && (
          <div className="pt-2">
            <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Pre-Connect Prompt Message
            </label>
            <input
              type="text"
              value={
                settings.preConnectMessage ||
                "Agent is listening, ask it a question"
              }
              onChange={(e) => onChange({ preConnectMessage: e.target.value })}
              className="w-full text-xs px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100"
              placeholder="Agent is listening, ask it a question"
            />
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Converts HSL to 6-character Hex string
 */
function hslToHex(h: number, s: number, l: number): string {
  l /= 100;
  const a = (s * Math.min(l, 1 - l)) / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}
