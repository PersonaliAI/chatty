"use client";

import { useState } from "react";
import {
  Sliders,
  Check,
  Disc,
  Activity,
  SunMedium,
  Grid3X3,
  BarChart3,
  Mic,
  MessageSquare,
  PhoneOff,
  Sparkles,
  RotateCcw,
} from "lucide-react";
import {
  LiveKitAudioVisualizer,
  type VisualizerType,
  VISUALIZER_DEFAULTS,
} from "@/components/livekit-agents-ui/audio-visualizers";
import { LiveKitControlBar } from "@/components/livekit-agents-ui/control-bar";

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
    name: string;
    subtitle: string;
    desc: string;
    defaultColor: string;
    icon: typeof Disc;
  }
> = {
  aura: {
    name: "Aura",
    subtitle: "Fluid Energy Field",
    desc: "Undulating 3D fluid energy field powered by Unicorn Studio WebGL shader.",
    defaultColor: "#1FD5F9",
    icon: Disc,
  },
  wave: {
    name: "Wave",
    subtitle: "Oscilloscope Waveform",
    desc: "Smooth sine-wave oscilloscope with dynamic bell-curve attenuation.",
    defaultColor: "#FA954C",
    icon: Activity,
  },
  radial: {
    name: "Radial",
    subtitle: "Circular Pulse Spokes",
    desc: "Vibrant circular spoke ring with quadrant pulse and rotating thinking state.",
    defaultColor: "#04A43A",
    icon: SunMedium,
  },
  grid: {
    name: "Grid",
    subtitle: "Dot Matrix Grid",
    desc: "Retro lo-fi dot-matrix matrix reacting with multi-band equalizer heights.",
    defaultColor: "#C04CFA",
    icon: Grid3X3,
  },
  bar: {
    name: "Bar",
    subtitle: "Classic Equalizer",
    desc: "Classic LiveKit vertical pill bars with bouncing audio reactive bands.",
    defaultColor: "#4CA3FA",
    icon: BarChart3,
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
}: VoiceUiCustomizerProps) {
  const [activePreviewState, setActivePreviewState] = useState<
    "connecting" | "listening" | "speaking" | "thinking"
  >("speaking");
  const [previewChatOpen, setPreviewChatOpen] = useState(false);

  const rawType = settings.visualizerType || "aura";
  const visualizerType: VisualizerType = (
    ["aura", "wave", "radial", "grid", "bar"].includes(rawType) ? rawType : "aura"
  ) as VisualizerType;

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
    <div className="space-y-6 pt-2">
      {/* 1. Section Header */}
      <div>
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-orange-50 dark:bg-orange-950/40 text-[#f97316] border border-orange-200/50 dark:border-orange-800/50">
            <Sliders className="size-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
              LiveKit Voice Interface Customization
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Choose from the 5 official LiveKit visualizers and configure your agent&apos;s real-time appearance.
            </p>
          </div>
        </div>
      </div>

      {/* 2. Visualizer Style Selector (Clean Cards) */}
      <div className="space-y-2.5">
        <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
          Audio Visualizer Style
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
          {(
            [
              { id: "aura", meta: VISUALIZER_METADATA.aura },
              { id: "wave", meta: VISUALIZER_METADATA.wave },
              { id: "radial", meta: VISUALIZER_METADATA.radial },
              { id: "grid", meta: VISUALIZER_METADATA.grid },
              { id: "bar", meta: VISUALIZER_METADATA.bar },
            ] as const
          ).map(({ id, meta }) => {
            const Icon = meta.icon;
            const isSelected = visualizerType === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => handleSelectVisualizer(id)}
                className={`relative flex flex-col items-start p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  isSelected
                    ? "border-neutral-900 dark:border-neutral-100 bg-white dark:bg-neutral-900 shadow-sm ring-2 ring-neutral-900/10 dark:ring-neutral-100/20"
                    : "border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/40 hover:bg-white dark:hover:bg-neutral-900 hover:border-neutral-300 dark:hover:border-neutral-700"
                }`}
              >
                <div className="flex items-center justify-between w-full mb-2">
                  <div
                    className="p-1.5 rounded-lg transition-colors"
                    style={{
                      backgroundColor: `${meta.defaultColor}18`,
                      color: meta.defaultColor,
                    }}
                  >
                    <Icon className="size-4" />
                  </div>
                  {isSelected && (
                    <span className="flex size-4 items-center justify-center rounded-full bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900">
                      <Check className="size-2.5 stroke-[3]" />
                    </span>
                  )}
                </div>
                <div className="font-semibold text-xs text-neutral-900 dark:text-neutral-100">
                  {meta.name}
                </div>
                <div className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-0.5 line-clamp-1">
                  {meta.subtitle}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Interactive Preview Canvas & Stage */}
      <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-950 text-white overflow-hidden shadow-lg">
        {/* Stage Toolbar */}
        <div className="px-4 py-3 border-b border-neutral-800 flex flex-wrap items-center justify-between gap-3 bg-neutral-900/60">
          <div className="flex items-center gap-2">
            <span
              className="size-2.5 rounded-full"
              style={{ backgroundColor: visualizerColor }}
            />
            <span className="text-xs font-semibold text-neutral-200">
              {currentMeta.name} Visualizer Preview
            </span>
          </div>

          {/* Agent State Switcher (Clean Pills) */}
          <div className="flex items-center gap-1 p-0.5 rounded-lg bg-neutral-950 border border-neutral-800 text-[11px]">
            {(
              [
                { id: "connecting", label: "Connecting" },
                { id: "listening", label: "Listening" },
                { id: "speaking", label: "Speaking" },
                { id: "thinking", label: "Thinking" },
              ] as const
            ).map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => setActivePreviewState(st.id)}
                className={`px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer ${
                  activePreviewState === st.id
                    ? "bg-neutral-800 text-white shadow-sm"
                    : "text-neutral-400 hover:text-neutral-200"
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>

        {/* Visualizer Display Area */}
        <div className="py-12 px-4 flex flex-col items-center justify-center min-h-[240px] relative bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-neutral-900/50 via-neutral-950 to-neutral-950">
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

        {/* LiveKit Official Control Bar Preview */}
        <div className="p-4 border-t border-neutral-850 bg-neutral-900/40 flex items-center justify-center">
          <div className="w-full max-w-xs">
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
      </div>

      {/* 4. Fine-Tuning Settings Card */}
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 space-y-4 shadow-xs">
        <div className="flex items-center justify-between pb-2 border-b border-neutral-100 dark:border-neutral-800">
          <span className="text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
            {currentMeta.name} Appearance Settings
          </span>
          <button
            type="button"
            onClick={() => onChange({ visualizerColor: currentMeta.defaultColor })}
            className="inline-flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 font-medium cursor-pointer transition-colors"
          >
            <RotateCcw className="size-3" />
            Reset default color ({currentMeta.defaultColor})
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Color Picker & Swatches */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-semibold text-neutral-700 dark:text-neutral-300">
              Visualizer Color
            </label>
            <div className="flex items-center gap-2.5">
              <input
                type="color"
                value={visualizerColor}
                onChange={(e) => onChange({ visualizerColor: e.target.value })}
                className="size-8 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-transparent cursor-pointer p-0 shrink-0"
              />
              <input
                type="text"
                value={visualizerColor}
                onChange={(e) => onChange({ visualizerColor: e.target.value })}
                className="w-28 font-mono text-xs px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 uppercase"
              />

              {/* Quick Official Palette Swatches */}
              <div className="flex items-center gap-1.5 ml-auto">
                {(
                  [
                    { color: "#1FD5F9", name: "Aura Cyan" },
                    { color: "#FA954C", name: "Wave Orange" },
                    { color: "#04A43A", name: "Radial Green" },
                    { color: "#C04CFA", name: "Grid Purple" },
                    { color: "#4CA3FA", name: "Bar Sky" },
                  ] as const
                ).map((swatch) => (
                  <button
                    key={swatch.color}
                    type="button"
                    title={swatch.name}
                    onClick={() => onChange({ visualizerColor: swatch.color })}
                    className={`size-5 rounded-full border transition-transform cursor-pointer hover:scale-110 ${
                      visualizerColor.toLowerCase() === swatch.color.toLowerCase()
                        ? "border-neutral-900 dark:border-neutral-100 scale-110 ring-2 ring-neutral-400"
                        : "border-transparent"
                    }`}
                    style={{ backgroundColor: swatch.color }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Size Preset */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-semibold text-neutral-700 dark:text-neutral-300">
              Display Scale
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {(
                [
                  { id: "sm", label: "Compact" },
                  { id: "md", label: "Standard" },
                  { id: "lg", label: "Expanded" },
                ] as const
              ).map((sz) => (
                <button
                  key={sz.id}
                  type="button"
                  onClick={() => onChange({ visualizerSize: sz.id })}
                  className={`py-1.5 rounded-lg text-xs font-semibold text-center border transition-all cursor-pointer ${
                    visualizerSize === sz.id
                      ? "border-neutral-900 dark:border-neutral-100 bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900"
                      : "border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/40 text-neutral-600 dark:text-neutral-400 hover:border-neutral-300"
                  }`}
                >
                  {sz.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Dynamic Specific Parameter Sliders */}
        <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {visualizerType === "aura" && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-medium text-neutral-700 dark:text-neutral-300">
                <span>Color Shift Intensity</span>
                <span className="font-mono text-neutral-500">{colorShift}</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={colorShift}
                onChange={(e) => onChange({ visualizerColorShift: Number(e.target.value) })}
                className="w-full accent-neutral-900 dark:accent-neutral-100 cursor-pointer"
              />
            </div>
          )}

          {visualizerType === "wave" && (
            <>
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-medium text-neutral-700 dark:text-neutral-300">
                  <span>Color Shift</span>
                  <span className="font-mono text-neutral-500">{colorShift}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={colorShift}
                  onChange={(e) => onChange({ visualizerColorShift: Number(e.target.value) })}
                  className="w-full accent-neutral-900 dark:accent-neutral-100 cursor-pointer"
                />
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-medium text-neutral-700 dark:text-neutral-300">
                  <span>Wave Line Width</span>
                  <span className="font-mono text-neutral-500">{lineWidth}px</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="5"
                  step="0.5"
                  value={lineWidth}
                  onChange={(e) => onChange({ visualizerLineWidth: Number(e.target.value) })}
                  className="w-full accent-neutral-900 dark:accent-neutral-100 cursor-pointer"
                />
              </div>
            </>
          )}

          {visualizerType === "radial" && (
            <>
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-medium text-neutral-700 dark:text-neutral-300">
                  <span>Spoke Radius</span>
                  <span className="font-mono text-neutral-500">{radius}px</span>
                </div>
                <input
                  type="range"
                  min="30"
                  max="90"
                  step="5"
                  value={radius}
                  onChange={(e) => onChange({ visualizerRadius: Number(e.target.value) })}
                  className="w-full accent-neutral-900 dark:accent-neutral-100 cursor-pointer"
                />
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-medium text-neutral-700 dark:text-neutral-300">
                  <span>Spoke Count</span>
                  <span className="font-mono text-neutral-500">{barCount}</span>
                </div>
                <input
                  type="range"
                  min="12"
                  max="36"
                  step="4"
                  value={barCount}
                  onChange={(e) => onChange({ visualizerBarCount: Number(e.target.value) })}
                  className="w-full accent-neutral-900 dark:accent-neutral-100 cursor-pointer"
                />
              </div>
            </>
          )}

          {visualizerType === "grid" && (
            <>
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-medium text-neutral-700 dark:text-neutral-300">
                  <span>Row Count</span>
                  <span className="font-mono text-neutral-500">{rowCount}</span>
                </div>
                <input
                  type="range"
                  min="7"
                  max="21"
                  step="2"
                  value={rowCount}
                  onChange={(e) => onChange({ visualizerRowCount: Number(e.target.value) })}
                  className="w-full accent-neutral-900 dark:accent-neutral-100 cursor-pointer"
                />
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-medium text-neutral-700 dark:text-neutral-300">
                  <span>Column Count</span>
                  <span className="font-mono text-neutral-500">{columnCount}</span>
                </div>
                <input
                  type="range"
                  min="7"
                  max="21"
                  step="2"
                  value={columnCount}
                  onChange={(e) => onChange({ visualizerColumnCount: Number(e.target.value) })}
                  className="w-full accent-neutral-900 dark:accent-neutral-100 cursor-pointer"
                />
              </div>
            </>
          )}

          {visualizerType === "bar" && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-medium text-neutral-700 dark:text-neutral-300">
                <span>Bar Count</span>
                <span className="font-mono text-neutral-500">{barCount}</span>
              </div>
              <input
                type="range"
                min="3"
                max="15"
                step="1"
                value={barCount}
                onChange={(e) => onChange({ visualizerBarCount: Number(e.target.value) })}
                className="w-full accent-neutral-900 dark:accent-neutral-100 cursor-pointer"
              />
            </div>
          )}
        </div>
      </div>

      {/* 5. In-Call Controls Card (Mic, Chat, Leave - NO Camera/Screenshare) */}
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 space-y-3 shadow-xs">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
            Control Bar Buttons
          </span>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            Configure which controls appear inside the in-call pill bar.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <label className="flex items-center gap-3 p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/40 text-xs font-medium text-neutral-800 dark:text-neutral-200 cursor-pointer hover:bg-neutral-100/50">
            <input
              type="checkbox"
              checked={controls.microphone}
              onChange={(e) =>
                onChange({
                  controls: { ...controls, microphone: e.target.checked },
                })
              }
              className="size-4 rounded text-neutral-900 focus:ring-0"
            />
            <Mic className="size-4 text-neutral-500" />
            Microphone Mute
          </label>

          <label className="flex items-center gap-3 p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/40 text-xs font-medium text-neutral-800 dark:text-neutral-200 cursor-pointer hover:bg-neutral-100/50">
            <input
              type="checkbox"
              checked={controls.chat}
              onChange={(e) =>
                onChange({
                  controls: { ...controls, chat: e.target.checked },
                })
              }
              className="size-4 rounded text-neutral-900 focus:ring-0"
            />
            <MessageSquare className="size-4 text-neutral-500" />
            Chat Transcript Toggle
          </label>

          <label className="flex items-center gap-3 p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/40 text-xs font-medium text-neutral-800 dark:text-neutral-200 cursor-pointer hover:bg-neutral-100/50">
            <input
              type="checkbox"
              checked={controls.leave}
              onChange={(e) =>
                onChange({
                  controls: { ...controls, leave: e.target.checked },
                })
              }
              className="size-4 rounded text-neutral-900 focus:ring-0"
            />
            <PhoneOff className="size-4 text-red-500" />
            Leave Call Button
          </label>
        </div>
      </div>

      {/* 6. Pre-Connect Shimmer Buffer Card */}
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 space-y-3 shadow-xs">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
              Pre-Connect Shimmer Buffer
            </span>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              Displays a gentle listening shimmer while audio streams connect before the first speech packet.
            </p>
          </div>
          <input
            type="checkbox"
            checked={settings.isPreConnectBufferEnabled ?? true}
            onChange={(e) =>
              onChange({ isPreConnectBufferEnabled: e.target.checked })
            }
            className="size-4 rounded text-neutral-900 focus:ring-0 cursor-pointer"
          />
        </div>

        {settings.isPreConnectBufferEnabled !== false && (
          <div className="pt-2">
            <label className="block text-[11px] font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
              Pre-Connect Prompt Message
            </label>
            <input
              type="text"
              value={
                settings.preConnectMessage ||
                "Agent is listening, ask it a question"
              }
              onChange={(e) => onChange({ preConnectMessage: e.target.value })}
              className="w-full text-xs px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-neutral-400"
              placeholder="Agent is listening, ask it a question"
            />
          </div>
        )}
      </div>
    </div>
  );
}
