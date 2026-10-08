"use client";

import * as React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AudioWaveform,
  CheckCircle2,
  ExternalLink,
  Info,
  KeyRound,
  Mic2,
  Radio,
  Save,
  Settings2,
  Sparkles,
  Volume2,
  Waves,
  Zap,
} from "lucide-react";

import { ModernAlert } from "@/components/ui/modern-alert";
import {
  ModernSelect,
  type ModernSelectOption,
} from "@/components/ui/modern-select";
import { ModernSwitch } from "@/components/ui/modern-switch";
import { VoiceAgentPanel } from "@/components/voice/VoiceAgentPanel";
import { LiveKitAgentVisualizer } from "@/components/agents-ui/livekit-agent-visualizer";
import type { AgentState } from "@livekit/components-react";
import {
  PROVIDER_OPTIONS,
  REALTIME_MODELS,
  REALTIME_PROVIDER_OPTIONS,
  modelOptions,
  type VoiceModelKind,
} from "./voice-model-catalog";

type FetchBackend = (path: string, options?: RequestInit) => Promise<Response>;
type Visualizer = "wave" | "bar" | "grid" | "radial" | "aura";
type VoiceConfig = {
  enabled: boolean;
  mode: "pipeline" | "realtime";
  expression_enabled: boolean;
  visualizer: Visualizer;
  agent_name: string;
  realtime_provider: string;
  realtime_model: string;
  llm_provider: string;
  llm_model: string;
  stt_provider: string;
  stt_model: string;
  stt_language: string;
  tts_provider: string;
  tts_model: string;
  tts_voice: string;
  max_duration_minutes: number;
  realtime_key_configured?: boolean;
  llm_key_configured?: boolean;
  stt_key_configured?: boolean;
  tts_key_configured?: boolean;
};

const defaults: VoiceConfig = {
  enabled: false,
  mode: "pipeline",
  expression_enabled: true,
  visualizer: "aura",
  agent_name: "chatty-voice-agent",
  realtime_provider: "google",
  realtime_model: "gemini-live-2.5-flash-native-audio",
  llm_provider: "google",
  llm_model: "gemini-2.5-flash",
  stt_provider: "google",
  stt_model: "chirp_3",
  stt_language: "en-US",
  tts_provider: "google",
  tts_model: "gemini-3.8-flash-tts",
  tts_voice: "Kore",
  max_duration_minutes: 15,
};

const visualizerInfo: {
  value: Visualizer;
  label: string;
  color: string;
  description: string;
}[] = [
  {
    value: "aura",
    label: "Aura",
    color: "#1fd5f9",
    description: "Ambient energy field, designed with Unicorn Studio.",
  },
  {
    value: "wave",
    label: "Wave",
    color: "#fa954c",
    description: "Warm oscillating waveform for natural conversation.",
  },
  {
    value: "radial",
    label: "Radial",
    color: "#04a43a",
    description: "Bright energetic ring for an active agent.",
  },
  {
    value: "grid",
    label: "Grid",
    color: "#c04cfa",
    description: "Lo-fi dot matrix for a technical assistant.",
  },
  {
    value: "bar",
    label: "Bar",
    color: "#4ca3fa",
    description: "Clean classic bars with clear speech activity.",
  },
];
const fieldClass =
  "h-11 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm outline-none transition placeholder:text-neutral-400 focus:border-cyan-400 focus:ring-4 focus:ring-cyan-400/10 dark:border-neutral-800 dark:bg-neutral-950";

function Select({
  value,
  options,
  onChange,
  label,
}: {
  value: string;
  options: ModernSelectOption[];
  onChange: (value: string) => void;
  label: string;
}) {
  return (
    <ModernSelect
      value={value}
      options={options}
      onChange={onChange}
      searchable
      aria-label={label}
      className="w-full"
    />
  );
}

function Card({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[26px] border border-neutral-200/80 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950 sm:p-6">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-600 dark:bg-cyan-950/40 dark:text-cyan-300">
          {icon}
        </div>
        <div>
          <h2 className="font-semibold tracking-tight">{title}</h2>
          <p className="mt-1 text-sm leading-5 text-neutral-500">
            {description}
          </p>
        </div>
      </div>
      {children}
    </section>
  );
}

function Preview({
  selected,
  onSelect,
}: {
  selected: Visualizer;
  onSelect: (value: Visualizer) => void;
}) {
  const [previewState, setPreviewState] = useState<AgentState>("listening");
  const current =
    visualizerInfo.find((item) => item.value === selected) ?? visualizerInfo[0];
  const previewStates: Array<{ value: AgentState; label: string }> = [
    { value: "connecting", label: "Connecting" },
    { value: "listening", label: "Listening" },
    { value: "speaking", label: "Speaking" },
    { value: "thinking", label: "Thinking" },
  ];
  const stateLabel =
    previewStates.find((item) => item.value === previewState)?.label ?? "Listening";

  useEffect(() => {
    // Keep the preview alive even when a customer is only browsing the tab.
    // The state buttons still override this cycle immediately and the next
    // tick resumes from the selected state.
    const timer = window.setInterval(() => {
      setPreviewState((currentState) => {
        const index = previewStates.findIndex((item) => item.value === currentState);
        return previewStates[(index + 1) % previewStates.length].value;
      });
    }, 2600);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <section className="overflow-hidden rounded-[26px] border border-neutral-800 bg-[#090b0f] text-white shadow-2xl shadow-cyan-950/10">
      <div className="flex flex-col gap-5 p-5 sm:p-6 lg:flex-row">
        <div className="min-w-0 flex-1">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-300">
                Agents UI visualizer
              </p>
              <h2 className="mt-1 text-lg font-semibold">
                Give your agent a visual personality
              </h2>
            </div>
            <span className="rounded-full border border-cyan-400/25 bg-cyan-400/10 px-2.5 py-1 text-[10px] text-cyan-200">
              LiveKit
            </span>
          </div>
          <div className="relative flex min-h-[250px] items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_center,rgba(22,74,99,.3),transparent_56%)] sm:min-h-[280px]">
            <div className="absolute inset-0 opacity-25 [background-image:radial-gradient(#6c8190_1px,transparent_1px)] [background-size:8px_8px]" />
            <LiveKitAgentVisualizer
              visualizer={selected}
              state={previewState}
              color={current.color}
              className="h-[min(30vw,240px)] w-[min(30vw,240px)] max-h-[240px] max-w-[240px]"
              demo
            />
          </div>
          <p className="mt-3 text-center text-xs text-neutral-400" aria-live="polite">
            Agent is {stateLabel.toLowerCase()}
          </p>
        </div>
        <div className="lg:w-[280px] lg:border-l lg:border-white/10 lg:pl-6">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-neutral-300">
            <Radio className="size-3.5 text-cyan-300" /> Preview states
          </div>
          <div className="grid grid-cols-2 gap-1 rounded-xl border border-white/10 p-1 text-[10px] text-neutral-400" role="group" aria-label="Preview agent state">
            {previewStates.map((item) => {
              const active = previewState === item.value;
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setPreviewState(item.value)}
                  aria-pressed={active}
                  className={`rounded-lg px-2 py-2 text-center transition ${active ? "bg-cyan-400/15 text-cyan-200 shadow-[inset_0_0_0_1px_rgba(34,211,238,.18)]" : "hover:bg-white/[0.06] hover:text-white"}`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
          <p className="mt-6 text-sm font-medium">{current.label} visualizer</p>
          <p className="mt-1 text-xs leading-5 text-neutral-400">
            {current.description}
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {visualizerInfo.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => onSelect(item.value)}
                className={`rounded-full border px-3 py-1.5 text-[11px] font-medium transition ${selected === item.value ? "border-cyan-300 bg-cyan-300 text-[#071017]" : "border-white/10 bg-white/[0.04] text-neutral-400 hover:border-white/25 hover:text-white"}`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function ProviderCard({
  kind,
  title,
  icon,
  provider,
  model,
  keyConfigured,
  apiKey,
  onProvider,
  onModel,
  onKey,
}: {
  kind: VoiceModelKind;
  title: string;
  icon: React.ReactNode;
  provider: string;
  model: string;
  keyConfigured?: boolean;
  apiKey: string;
  onProvider: (value: string) => void;
  onModel: (value: string) => void;
  onKey: (value: string) => void;
}) {
  const providerOptions = PROVIDER_OPTIONS[kind].map((item) => ({
    value: item.value,
    label: item.label,
    hint: item.hint,
  }));
  const models = modelOptions(kind, provider).map((item) => ({
    value: item.value,
    label: item.label,
    hint: item.hint,
  }));
  const modelOptionsForField = models.length
    ? models
    : [
        {
          value: model,
          label: model || "Choose a model",
          hint: "Provider catalog unavailable",
        },
      ];
  return (
    <div className="rounded-2xl border border-neutral-200 bg-neutral-50/60 p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
      <div className="flex items-center gap-2">
        <div className="flex size-8 items-center justify-center rounded-xl bg-white text-cyan-600 shadow-sm dark:bg-neutral-950 dark:text-cyan-300">
          {icon}
        </div>
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="text-[10px] uppercase tracking-[0.14em] text-neutral-400">
            {kind}
          </p>
        </div>
      </div>
      <div className="mt-4 grid gap-3">
        <Select
          value={provider}
          options={providerOptions}
          onChange={onProvider}
          label={`${title} provider`}
        />
        <Select
          value={model}
          options={modelOptionsForField}
          onChange={onModel}
          label={`${title} model`}
        />
        <input
          type="password"
          value={apiKey}
          onChange={(event) => onKey(event.target.value)}
          className={fieldClass}
          placeholder={
            keyConfigured ? "BYOK key configured" : "Optional provider API key"
          }
        />
      </div>
    </div>
  );
}

function RealtimeCard({
  provider,
  model,
  keyConfigured,
  apiKey,
  onProvider,
  onModel,
  onKey,
}: {
  provider: string;
  model: string;
  keyConfigured?: boolean;
  apiKey: string;
  onProvider: (value: string) => void;
  onModel: (value: string) => void;
  onKey: (value: string) => void;
}) {
  const models = REALTIME_MODELS[provider] ?? [];
  return (
    <div className="rounded-2xl border border-cyan-200 bg-cyan-50/50 p-4 dark:border-cyan-900/60 dark:bg-cyan-950/20">
      <div className="flex items-center gap-2">
        <div className="flex size-8 items-center justify-center rounded-xl bg-white text-cyan-600 shadow-sm dark:bg-neutral-950 dark:text-cyan-300">
          <Radio className="size-4" />
        </div>
        <div>
          <h3 className="text-sm font-semibold">Realtime speech-to-speech</h3>
          <p className="text-[10px] uppercase tracking-[0.14em] text-neutral-400">
            full duplex
          </p>
        </div>
      </div>
      <div className="mt-4 grid gap-3">
        <Select
          value={provider}
          options={REALTIME_PROVIDER_OPTIONS}
          onChange={onProvider}
          label="Realtime provider"
        />
        <Select
          value={model}
          options={models.map((item) => ({
            value: item.value,
            label: item.label,
            hint: item.hint,
          }))}
          onChange={onModel}
          label="Realtime model"
        />
        <input
          type="password"
          value={apiKey}
          onChange={(event) => onKey(event.target.value)}
          className={fieldClass}
          placeholder={
            keyConfigured
              ? "BYOK key configured"
              : provider === "google"
                ? "Uses Vertex ADC"
                : "Provider API key"
          }
        />
      </div>
      <p className="mt-3 text-[11px] leading-5 text-neutral-500">
        Realtime models combine listening and speaking in one LiveKit-supported
        model. Switch to Pipeline when you need independent STT, LLM, and TTS
        controls.
      </p>
    </div>
  );
}

export function VoiceAgentTab({
  botId,
  fetchBackend,
}: {
  botId: string;
  fetchBackend: FetchBackend;
}) {
  const [config, setConfig] = useState<VoiceConfig>(defaults);
  const [draftKey, setDraftKey] = useState({
    realtime: "",
    llm: "",
    stt: "",
    tts: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetchBackend(`/api/bots/${botId}/voice`);
      if (response.ok) setConfig({ ...defaults, ...(await response.json()) });
    } finally {
      setLoading(false);
    }
  }, [botId, fetchBackend]);
  useEffect(() => {
    void load();
  }, [load]);
  const sessionId = useMemo(() => `dashboard-voice-${botId}`, [botId]);
  const update = <K extends keyof VoiceConfig>(
    key: K,
    value: VoiceConfig[K],
  ) => {
    setSaved(false);
    setConfig((current) => ({ ...current, [key]: value }));
  };
  const changeProvider = (kind: VoiceModelKind, provider: string) => {
    const first = modelOptions(kind, provider)[0]?.value;
    setConfig((current) => ({
      ...current,
      [`${kind}_provider`]: provider,
      ...(first ? { [`${kind}_model`]: first } : {}),
    }));
  };
  const save = async () => {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const response = await fetchBackend(`/api/bots/${botId}/voice`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...config,
          realtime_api_key: draftKey.realtime || undefined,
          llm_api_key: draftKey.llm || undefined,
          stt_api_key: draftKey.stt || undefined,
          tts_api_key: draftKey.tts || undefined,
        }),
      });
      if (!response.ok) throw new Error(await response.text());
      const savedConfig = (await response.json()) as Partial<VoiceConfig>;
      setConfig((current) => ({ ...current, ...savedConfig }));
      setDraftKey({ realtime: "", llm: "", stt: "", tts: "" });
      setSaved(true);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not save voice settings.",
      );
    } finally {
      setSaving(false);
    }
  };
  if (loading)
    return (
      <div className="flex min-h-[400px] items-center justify-center text-sm text-neutral-500">
        <span className="mr-2 size-4 animate-spin rounded-full border-2 border-neutral-300 border-t-cyan-500" />
        Loading voice-agent studio…
      </div>
    );
  return (
    <div className="min-h-full bg-gradient-to-b from-cyan-50/50 via-white to-white p-4 pb-28 dark:from-cyan-950/10 dark:via-neutral-950 dark:to-neutral-950 sm:p-6 lg:p-8">
      <div className="mx-auto grid max-w-[1440px] gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <main className="grid min-w-0 gap-6">
          <section className="relative overflow-hidden rounded-[30px] border border-neutral-200/80 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950 sm:p-7">
            <div className="pointer-events-none absolute -right-20 -top-24 size-80 rounded-full bg-cyan-300/20 blur-3xl dark:bg-cyan-500/10" />
            <div className="relative flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
              <div>
                <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-600 dark:text-cyan-300">
                  <AudioWaveform className="size-4" /> Voice agent studio
                </div>
                <h1 className="max-w-2xl text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
                  A voice experience people want to use.
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-500">
                  Design a real-time agent with the same Chatty knowledge,
                  tools, booking, lead capture, and guardrails your text agent
                  already uses.
                </p>
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-cyan-100 bg-cyan-50/70 px-4 py-3 dark:border-cyan-950/60 dark:bg-cyan-950/20">
                <div>
                  <p className="text-xs font-semibold">Voice access</p>
                  <p className="mt-0.5 text-[11px] text-neutral-500">
                    {config.enabled
                      ? "Live in widget and embeds"
                      : "Hidden from visitors"}
                  </p>
                </div>
                <ModernSwitch
                  checked={config.enabled}
                  onChange={(value) => update("enabled", value)}
                  aria-label="Enable voice agent"
                  activeLabel=""
                  inactiveLabel=""
                />
              </div>
            </div>
            {error && (
              <ModernAlert
                variant="error"
                title="Could not save voice settings"
                className="relative mt-5"
              >
                {error}
              </ModernAlert>
            )}
            <div className="relative mt-7 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-neutral-50 p-4 dark:bg-neutral-900">
                <p className="text-[10px] uppercase tracking-[0.16em] text-neutral-400">
                  Session mode
                </p>
                <p className="mt-1 text-sm font-semibold capitalize">
                  {config.mode}
                </p>
              </div>
              <div className="rounded-2xl bg-neutral-50 p-4 dark:bg-neutral-900">
                <p className="text-[10px] uppercase tracking-[0.16em] text-neutral-400">
                  Interruption
                </p>
                <p className="mt-1 text-sm font-semibold text-emerald-600">
                  Instant barge-in
                </p>
              </div>
              <div className="rounded-2xl bg-neutral-50 p-4 dark:bg-neutral-900">
                <p className="text-[10px] uppercase tracking-[0.16em] text-neutral-400">
                  Transcription
                </p>
                <p className="mt-1 text-sm font-semibold">
                  Realtime LiveKit UI
                </p>
              </div>
            </div>
          </section>
          <Preview
            selected={config.visualizer}
            onSelect={(value) => update("visualizer", value)}
          />
          <Card
            icon={<Settings2 className="size-5" />}
            title="Session design"
            description="Choose how the agent connects, speaks, and behaves during a visitor session."
          >
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm">
                <span className="font-medium">Agent mode</span>
                <Select
                  value={config.mode}
                  onChange={(value) =>
                    update("mode", value as VoiceConfig["mode"])
                  }
                  label="Agent mode"
                  options={[
                    {
                      value: "pipeline",
                      label: "Pipeline",
                      hint: "STT → LLM → TTS",
                    },
                    {
                      value: "realtime",
                      label: "Realtime",
                      hint: "full-duplex model",
                    },
                  ]}
                />
              </label>
              <label className="grid gap-2 text-sm">
                <span className="font-medium">Maximum call duration</span>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={config.max_duration_minutes}
                  onChange={(event) =>
                    update("max_duration_minutes", Number(event.target.value))
                  }
                  className={fieldClass}
                />
              </label>
              <label className="grid gap-2 text-sm sm:col-span-2">
                <span className="font-medium">Agent dispatch name</span>
                <input
                  value={config.agent_name}
                  onChange={(event) => update("agent_name", event.target.value)}
                  className={fieldClass}
                />
              </label>
            </div>
            <div className="mt-5 flex items-center justify-between gap-4 rounded-2xl border border-cyan-100 bg-cyan-50/60 px-4 py-3 dark:border-cyan-950/50 dark:bg-cyan-950/20">
              <div>
                <p className="text-sm font-semibold">Expressive speech mode</p>
                <p className="mt-0.5 text-xs text-neutral-500">
                  Provider/model dependent; LiveKit adds emotion, pacing, and
                  non-verbal delivery where supported.
                </p>
              </div>
        <ModernSwitch
          checked={config.expression_enabled}
                onChange={(value) => update("expression_enabled", value)}
                aria-label="Enable expressive speech mode"
                activeLabel=""
          inactiveLabel=""
        />
      </div>
      {config.mode === 'realtime' && (
        <div className="mt-5">
          <RealtimeCard
            provider={config.realtime_provider}
            model={config.realtime_model}
            keyConfigured={config.realtime_key_configured}
            apiKey={draftKey.realtime}
            onProvider={(value) => {
              const first = REALTIME_MODELS[value]?.[0]?.value;
              update('realtime_provider', value);
              if (first) update('realtime_model', first);
            }}
            onModel={(value) => update('realtime_model', value)}
            onKey={(value) => setDraftKey((current) => ({ ...current, realtime: value }))}
          />
        </div>
      )}
    </Card>
          <Card
            icon={<Zap className="size-5" />}
            title="AI model routing"
            description="Every official LiveKit Inference model is searchable alongside direct provider BYOK models."
          >
            <div className="mt-6 grid gap-4 lg:grid-cols-3">
              <ProviderCard
                kind="llm"
                title="Reasoning / LLM"
                icon={<Sparkles className="size-4" />}
                provider={config.llm_provider}
                model={config.llm_model}
                keyConfigured={config.llm_key_configured}
                apiKey={draftKey.llm}
                onProvider={(value) => changeProvider("llm", value)}
                onModel={(value) => update("llm_model", value)}
                onKey={(value) =>
                  setDraftKey((current) => ({ ...current, llm: value }))
                }
              />
              <ProviderCard
                kind="stt"
                title="Speech recognition"
                icon={<Mic2 className="size-4" />}
                provider={config.stt_provider}
                model={config.stt_model}
                keyConfigured={config.stt_key_configured}
                apiKey={draftKey.stt}
                onProvider={(value) => changeProvider("stt", value)}
                onModel={(value) => update("stt_model", value)}
                onKey={(value) =>
                  setDraftKey((current) => ({ ...current, stt: value }))
                }
              />
              <ProviderCard
                kind="tts"
                title="Voice synthesis"
                icon={<Volume2 className="size-4" />}
                provider={config.tts_provider}
                model={config.tts_model}
                keyConfigured={config.tts_key_configured}
                apiKey={draftKey.tts}
                onProvider={(value) => changeProvider("tts", value)}
                onModel={(value) => update("tts_model", value)}
                onKey={(value) =>
                  setDraftKey((current) => ({ ...current, tts: value }))
                }
              />
            </div>
            <div className="mt-5 flex items-start gap-2 rounded-2xl bg-neutral-50 p-4 text-xs leading-5 text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400">
              <KeyRound className="mt-0.5 size-4 shrink-0 text-cyan-600" />
              BYOK values are encrypted server-side, organization scoped, and
              never returned to the browser. LiveKit Inference requires the
              corresponding hosted gateway entitlement.
            </div>
          </Card>
          <Card
            icon={<Waves className="size-5" />}
            title="Language and voice"
            description="Passed to the selected official LiveKit provider at session creation."
          >
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm">
                <span className="font-medium">STT language</span>
                <input
                  value={config.stt_language}
                  onChange={(event) =>
                    update("stt_language", event.target.value)
                  }
                  className={fieldClass}
                  placeholder="en-US"
                />
              </label>
              <label className="grid gap-2 text-sm">
                <span className="font-medium">TTS voice</span>
                <input
                  value={config.tts_voice}
                  onChange={(event) => update("tts_voice", event.target.value)}
                  className={fieldClass}
                  placeholder="Kore or provider voice ID"
                />
              </label>
            </div>
          </Card>
          <section className="rounded-[26px] border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950 sm:p-6">
            <div className="flex items-start gap-3">
              <div className="flex size-10 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-600 dark:bg-neutral-900 dark:text-neutral-300">
                <Info className="size-5" />
              </div>
              <div>
                <h2 className="font-semibold">Safe integration contract</h2>
                <p className="mt-1 text-sm leading-5 text-neutral-500">
                  Client apps receive short-lived room tokens only. LiveKit API
                  secrets and provider keys remain server-side.
                </p>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <a
                href="https://docs.livekit.io/frontends/agents-ui/"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-neutral-200 px-4 py-2 text-sm font-medium hover:border-cyan-300 hover:text-cyan-700 dark:border-neutral-800 dark:hover:border-cyan-700"
              >
                Agents UI docs <ExternalLink className="size-3.5" />
              </a>
              <a
                href="https://docs.livekit.io/agents/models/"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-neutral-200 px-4 py-2 text-sm font-medium hover:border-cyan-300 hover:text-cyan-700 dark:border-neutral-800 dark:hover:border-cyan-700"
              >
                Model catalog <ExternalLink className="size-3.5" />
              </a>
            </div>
          </section>
        </main>
        <aside className="min-h-[560px] xl:sticky xl:top-4 xl:self-start">
          <VoiceAgentPanel
            botId={botId}
            sessionId={sessionId}
            visualizer={config.visualizer}
            className="h-[min(720px,calc(100dvh-8rem))] min-h-[560px]"
          />
        </aside>
      </div>
      <div className="sticky bottom-0 z-30 mt-6 border-t border-neutral-200/80 bg-white/95 px-4 py-3 backdrop-blur-xl dark:border-neutral-800 dark:bg-neutral-950/95 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-3">
          <p className="hidden text-xs text-neutral-500 sm:block">
            Changes apply to new voice sessions.
          </p>
          <div className="flex items-center gap-3">
            <AnimatePresence>
              {saved && (
                <motion.span
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  className="inline-flex items-center gap-1 text-sm text-emerald-600"
                >
                  <CheckCircle2 className="size-4" /> Saved
                </motion.span>
              )}
            </AnimatePresence>
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-full bg-[#0b1117] px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-900/10 transition hover:bg-[#14212b] disabled:opacity-50 dark:bg-white dark:text-neutral-950"
            >
              <Save className="size-4" />
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
