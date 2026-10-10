"use client";

import * as React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AudioWaveform,
  CheckCircle2,
  ExternalLink,
  Info,
  KeyRound,
  Languages,
  Loader2,
  Mic2,
  Radio,
  Settings2,
  Sparkles,
  Volume2,
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
  welcome_message: string;
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
  livekit_inference_available?: boolean;
  realtime_key_configured?: boolean;
  llm_key_configured?: boolean;
  stt_key_configured?: boolean;
  tts_key_configured?: boolean;
};

const defaults: VoiceConfig = {
  welcome_message: "Hello! How can I help you today?",
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
  tts_model: "gemini-3.1-flash-tts-preview",
  tts_voice: "Kore",
  max_duration_minutes: 15,
  livekit_inference_available: false,
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

const PREVIEW_STATES: Array<{ value: AgentState; label: string }> = [
  { value: "connecting", label: "Connecting" },
  { value: "listening", label: "Listening" },
  { value: "speaking", label: "Speaking" },
  { value: "thinking", label: "Thinking" },
];

const fieldClass =
  "h-11 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm outline-none transition placeholder:text-neutral-400 focus:border-cyan-400 focus:ring-4 focus:ring-cyan-400/10 dark:border-neutral-800 dark:bg-neutral-950";

// This is the union of the canonical language codes exposed by the current
// LiveKit Inference STT/TTS catalog. A provider may support only a subset; the
// selected model remains the source of truth at session creation. Keeping the
// union here prevents the dashboard from hiding a language supported by one
// of the selected models while still allowing the searchable custom value.
const VOICE_LANGUAGE_OPTIONS: ModernSelectOption[] = [
  ["en-US", "English (US)"], ["en-GB", "English (UK)"], ["en-AU", "English (Australia)"],
  ["en-CA", "English (Canada)"], ["en-IN", "English (India)"], ["en-IE", "English (Ireland)"],
  ["en-NZ", "English (New Zealand)"], ["af", "Afrikaans"], ["am", "Amharic"],
  ["ar", "Arabic"], ["ar-SA", "Arabic (Saudi Arabia)"], ["as", "Assamese"],
  ["az", "Azerbaijani"], ["ba", "Bashkir"], ["be", "Belarusian"], ["bg", "Bulgarian"],
  ["bn", "Bengali"], ["bo", "Tibetan"], ["bs", "Bosnian"], ["ca", "Catalan"],
  ["ceb", "Cebuano"], ["cs-CZ", "Czech"], ["cy", "Welsh"], ["da-DK", "Danish"],
  ["de-DE", "German"], ["el-GR", "Greek"], ["es-ES", "Spanish (Spain)"],
  ["es-MX", "Spanish (Mexico)"], ["es-US", "Spanish (US)"], ["et", "Estonian"],
  ["eu", "Basque"], ["fa", "Persian"], ["fi-FI", "Finnish"], ["fil", "Filipino"],
  ["fr-FR", "French"], ["fr-CA", "French (Canada)"], ["ga", "Irish"], ["gl", "Galician"],
  ["gu", "Gujarati"], ["he-IL", "Hebrew"], ["hi-IN", "Hindi"], ["hr", "Croatian"],
  ["hu-HU", "Hungarian"], ["hy", "Armenian"], ["id-ID", "Indonesian"], ["is", "Icelandic"],
  ["it-IT", "Italian"], ["ja-JP", "Japanese"], ["ka", "Georgian"], ["kk", "Kazakh"],
  ["km", "Khmer"], ["kn", "Kannada"], ["ko-KR", "Korean"], ["la", "Latin"],
  ["lo", "Lao"], ["lt", "Lithuanian"], ["lv", "Latvian"], ["mk", "Macedonian"],
  ["ml", "Malayalam"], ["mn", "Mongolian"], ["mr", "Marathi"], ["ms-MY", "Malay"],
  ["mt", "Maltese"], ["my", "Burmese"], ["ne", "Nepali"], ["nl-NL", "Dutch"],
  ["no-NO", "Norwegian"], ["or", "Odia"], ["pa", "Punjabi"], ["pl-PL", "Polish"],
  ["pt-BR", "Portuguese (Brazil)"], ["pt-PT", "Portuguese (Portugal)"], ["ro-RO", "Romanian"],
  ["ru-RU", "Russian"], ["si", "Sinhala"], ["sk", "Slovak"], ["sl", "Slovenian"],
  ["sq", "Albanian"], ["sr", "Serbian"], ["sv-SE", "Swedish"], ["sw", "Swahili"],
  ["ta", "Tamil"], ["te", "Telugu"], ["th-TH", "Thai"], ["tl", "Tagalog"],
  ["tr-TR", "Turkish"], ["uk-UA", "Ukrainian"], ["ur", "Urdu"], ["uz", "Uzbek"],
  ["vi-VN", "Vietnamese"], ["yi", "Yiddish"], ["yue-HK", "Chinese (Cantonese)"],
  ["zh-CN", "Chinese (Mandarin)"], ["zh-TW", "Chinese (Traditional)"], ["zu", "Zulu"],
].map(([value, label]) => ({ value, label, hint: "LiveKit / provider support varies" }));

const MODEL_LANGUAGE_LIMITS: Record<string, string[]> = {
  "cartesia/ink-2": ["en"],
  "deepgram/aura": ["en"],
  "deepgram/aura-2": ["en"],
  "xai/stt-1": "en ar cs da nl fr de hi id it ja ko ms fa pl pt ro ru es sv th tr vi fil mk".split(" "),
  "xai/stt-2": "en ar cs da nl fr de hi id it ja ko ms fa pl pt ro ru es sv th tr vi fil mk".split(" "),
  "xai/tts-1": "en ar bn zh fr de hi id it ja ko pt ru es tr vi".split(" "),
  "inworld/inworld-tts-1.5-max": "en zh ja ko ru it es pt fr de pl nl hi he ar".split(" "),
  "google/gemini-3.5-transcribe-live": "en es fr de it pt nl pl tr ru ar hi ja ko zh id th vi sv da no fi cs el he uk".split(" "),
  "speechmatics/linden-1": "ar ba be bg bn ca cmn cs cy da de el en es et eu fa fi fr ga gl he hi hr hu id it ja ko lt lv mn mr ms mt nl no pl pt ro ru sk sl sv sw ta th tl tr uk ur vi yue".split(" "),
};

function languageOptionsFor(
  provider: string,
  model: string,
  currentValue: string,
): ModernSelectOption[] {
  const limits = MODEL_LANGUAGE_LIMITS[model];
  if (!limits) return VOICE_LANGUAGE_OPTIONS;
  const supported = new Set(limits);
  const options = VOICE_LANGUAGE_OPTIONS.filter((option) => {
    const base = option.value.split("-")[0];
    return supported.has(option.value) || supported.has(base);
  });
  return options.some((option) => option.value === currentValue)
    ? options
    : [{ value: currentValue, label: currentValue, hint: `${provider} model current value` }, ...options];
}

const VOICE_OPTIONS: Record<string, ModernSelectOption[]> = {
  google: [
    ["Kore", "Kore"], ["Puck", "Puck"], ["Charon", "Charon"], ["Fenrir", "Fenrir"],
    ["Aoede", "Aoede"], ["Leda", "Leda"], ["Orus", "Orus"], ["Zephyr", "Zephyr"],
  ].map(([value, label]) => ({ value, label, hint: "Gemini / Google" })),
  // These providers use account/model-specific voice identifiers. Do not
  // present TTS model IDs as voice IDs; the current configured value is
  // injected below and remains editable in the free-form field.
  cartesia: [],
  deepgram: [],
  elevenlabs: [],
  fishaudio: [],
  openai: ["alloy", "ash", "coral", "echo", "fable", "nova", "onyx", "sage", "shimmer"].map((value) => ({ value, label: value, hint: "OpenAI" })),
};

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

function modelOptionsWithCurrentValue(
  options: ModernSelectOption[],
  model: string,
): ModernSelectOption[] {
  const normalized = model.trim();
  if (!normalized || options.some((option) => option.value === normalized)) {
    return options;
  }
  return [
    {
      value: normalized,
      label: normalized,
      hint: "Current provider model ID",
    },
    ...options,
  ];
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
  const stateLabel =
    PREVIEW_STATES.find((item) => item.value === previewState)?.label ?? "Listening";

  useEffect(() => {
    // Keep the preview alive even when a customer is only browsing the tab.
    // The state buttons still override this cycle immediately and the next
    // tick resumes from the selected state.
    const timer = window.setInterval(() => {
      setPreviewState((currentState) => {
        const index = PREVIEW_STATES.findIndex((item) => item.value === currentState);
        return PREVIEW_STATES[(index + 1) % PREVIEW_STATES.length].value;
      });
    }, 2600);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <section className="overflow-hidden rounded-[22px] border border-neutral-800 bg-[#090b0f] text-white shadow-2xl shadow-cyan-950/10">
      <div className="flex flex-col gap-4 p-4 sm:p-5 lg:h-[min(490px,calc(100dvh-190px))] lg:min-h-[430px] lg:flex-row">
        <div className="min-w-0 flex-1">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-300">
                Agents UI visualizer
              </p>
              <h2 className="mt-1 text-base font-semibold sm:text-lg">
                Give your agent a visual personality
              </h2>
            </div>
            <span className="rounded-full border border-cyan-400/25 bg-cyan-400/10 px-2.5 py-1 text-[10px] text-cyan-200">
              LiveKit
            </span>
          </div>
          <div className="relative flex h-[220px] min-h-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_center,rgba(22,74,99,.3),transparent_56%)] sm:h-[250px] lg:h-[calc(100%-55px)]">
            <div className="absolute inset-0 opacity-25 [background-image:radial-gradient(#6c8190_1px,transparent_1px)] [background-size:8px_8px]" />
            <LiveKitAgentVisualizer
              visualizer={selected}
              state={previewState}
              color={current.color}
              className="size-[min(42vw,220px)] max-h-[220px] max-w-[220px]"
              demo
            />
          </div>
          <p className="mt-2 text-center text-[11px] text-neutral-400" aria-live="polite">
            Agent is {stateLabel.toLowerCase()}
          </p>
        </div>
        <div className="lg:w-[250px] lg:border-l lg:border-white/10 lg:pl-5">
          <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold text-neutral-300">
            <Radio className="size-3.5 text-cyan-300" /> Preview states
          </div>
          <div className="grid grid-cols-2 gap-1 rounded-xl border border-white/10 p-1 text-[10px] text-neutral-400" role="group" aria-label="Preview agent state">
            {PREVIEW_STATES.map((item) => {
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
          <p className="mt-4 text-sm font-medium">{current.label} visualizer</p>
          <p className="mt-1 text-xs leading-5 text-neutral-400">
            {current.description}
          </p>
          <div className="mt-4 flex flex-wrap gap-1.5">
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
  livekitInferenceAvailable = false,
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
  livekitInferenceAvailable?: boolean;
}) {
  const providerOptions = PROVIDER_OPTIONS[kind].map((item) => ({
    value: item.value,
    label: item.label,
    disabled: item.value === "livekit-inference" && !livekitInferenceAvailable,
    hint:
      item.value === "livekit-inference" && !livekitInferenceAvailable
        ? "Unavailable on self-hosted LiveKit"
        : item.hint,
  }));
  const models = modelOptionsWithCurrentValue(modelOptions(kind, provider).map((item) => ({
    value: item.value,
    label: item.label,
    hint: item.hint,
  })), model);
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
          label={`${title} model preset`}
        />
        <div className="grid gap-1.5">
          <label className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
            Model ID
          </label>
          <input
            type="text"
            value={model}
            onChange={(event) => onModel(event.target.value)}
            className={fieldClass}
            placeholder="Enter a provider-supported model ID"
            aria-label={`${title} model ID`}
          />
          <p className="text-[10px] leading-4 text-neutral-500">
            Search a preset above or enter any model ID currently supported by the selected provider.
          </p>
        </div>
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
  const models = modelOptionsWithCurrentValue(
    (REALTIME_MODELS[provider] ?? []).map((item) => ({
      value: item.value,
      label: item.label,
      hint: item.hint,
    })),
    model,
  );
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
          options={models}
          onChange={onModel}
          label="Realtime model preset"
        />
        <div className="grid gap-1.5">
          <label className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
            Model ID
          </label>
          <input
            type="text"
            value={model}
            onChange={(event) => onModel(event.target.value)}
            className={fieldClass}
            placeholder="Enter a provider-supported model ID"
            aria-label="Realtime model ID"
          />
          <p className="text-[10px] leading-4 text-neutral-500">
            LiveKit provider model catalogs can change independently of Chatty. Presets are shortcuts; this field is authoritative.
          </p>
        </div>
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
  const [generatingWelcome, setGeneratingWelcome] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hydratedRef = useRef(false);
  const skipAutosaveRef = useRef(false);
  const saveTimerRef = useRef<number | null>(null);
  const saveInFlightRef = useRef(false);
  const pendingSaveRef = useRef(false);
  const loadGenerationRef = useRef(0);
  const latestConfigRef = useRef(config);
  const latestDraftKeyRef = useRef(draftKey);
  // The dashboard parent recreates fetchBackend during renders. Keep the
  // latest implementation without making Voice Studio rehydrate repeatedly.
  const fetchBackendRef = useRef(fetchBackend);
  fetchBackendRef.current = fetchBackend;
  latestConfigRef.current = config;
  latestDraftKeyRef.current = draftKey;
  const load = useCallback(async () => {
    const generation = ++loadGenerationRef.current;
    setLoading(true);
    hydratedRef.current = false;
    skipAutosaveRef.current = true;
    try {
      const response = await fetchBackendRef.current(`/api/bots/${botId}/voice`);
      const nextConfig = response.ok ? { ...defaults, ...(await response.json()) } : null;
      // React can invoke effects more than once during development and the
      // dashboard can also switch bots while a request is in flight. A stale
      // response must never replace the active draft or re-arm autosave.
      if (generation !== loadGenerationRef.current) return;
      if (nextConfig) setConfig(nextConfig);
    } catch (cause) {
      if (generation === loadGenerationRef.current) {
        setError(cause instanceof Error ? cause.message : "Could not load voice settings.");
      }
    } finally {
      if (generation === loadGenerationRef.current) {
        setLoading(false);
        // Keep autosave suppressed for the first render after hydration. The
        // config update above is initial data, not a user edit.
        skipAutosaveRef.current = true;
        hydratedRef.current = true;
      }
    }
  }, [botId]);
  useEffect(() => {
    void load();
  }, [load]);
  const sessionId = useMemo(() => `dashboard-voice-${botId}`, [botId]);
  const voiceOptions = useMemo(() => {
    const options = VOICE_OPTIONS[config.tts_provider] ?? [];
    if (options.some((option) => option.value === config.tts_voice)) return options;
    return [
      {
        value: config.tts_voice,
        label: config.tts_voice || "Choose a voice",
        hint: "Current provider voice ID",
      },
      ...options,
    ];
  }, [config.tts_provider, config.tts_voice]);
  const update = <K extends keyof VoiceConfig>(
    key: K,
    value: VoiceConfig[K],
  ) => {
    setSaved(false);
    setError(null);
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
  const save = useCallback(async () => {
    if (saveInFlightRef.current) {
      pendingSaveRef.current = true;
      return;
    }
    const configSnapshot = latestConfigRef.current;
    const draftKeySnapshot = latestDraftKeyRef.current;
    saveInFlightRef.current = true;
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const response = await fetchBackendRef.current(`/api/bots/${botId}/voice`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...configSnapshot,
          realtime_api_key: draftKeySnapshot.realtime || undefined,
          llm_api_key: draftKeySnapshot.llm || undefined,
          stt_api_key: draftKeySnapshot.stt || undefined,
          tts_api_key: draftKeySnapshot.tts || undefined,
        }),
      });
      if (!response.ok) throw new Error(await response.text());
      await response.json();
      const currentKeys = latestDraftKeyRef.current;
      if (
        currentKeys.realtime === draftKeySnapshot.realtime &&
        currentKeys.llm === draftKeySnapshot.llm &&
        currentKeys.stt === draftKeySnapshot.stt &&
        currentKeys.tts === draftKeySnapshot.tts
      ) {
        skipAutosaveRef.current = true;
        setDraftKey({ realtime: "", llm: "", stt: "", tts: "" });
      }
      setSaved(true);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not save voice settings.",
      );
    } finally {
      setSaving(false);
      saveInFlightRef.current = false;
      if (pendingSaveRef.current) {
        pendingSaveRef.current = false;
        window.setTimeout(() => void save(), 0);
      }
    }
  }, [botId]);
  useEffect(() => {
    if (!hydratedRef.current) return;
    if (skipAutosaveRef.current) {
      skipAutosaveRef.current = false;
      return;
    }
    if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => void save(), 700);
    return () => {
      if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    };
  }, [config, draftKey, save]);
  useEffect(() => () => {
    if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
  }, []);
  const generateWelcome = async () => {
    setGeneratingWelcome(true);
    setError(null);
    try {
      const response = await fetchBackendRef.current("/api/generate-business", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bot_id: botId,
          hint: "Write a concise, friendly spoken welcome for this voice agent. Keep it natural and under 25 words.",
        }),
      });
      if (!response.ok) throw new Error(await response.text());
      const generated = (await response.json()) as { welcome_message?: string };
      if (!generated.welcome_message?.trim()) throw new Error("The generator returned no welcome message.");
      update("welcome_message", generated.welcome_message.trim());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not generate the welcome message.");
    } finally {
      setGeneratingWelcome(false);
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
    <div className="min-h-full bg-gradient-to-b from-cyan-50/50 via-white to-white p-3 dark:from-cyan-950/10 dark:via-neutral-950 dark:to-neutral-950 sm:p-4 lg:p-5">
      <div className="mx-auto grid max-w-[1440px] gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <main className="grid min-w-0 gap-5">
          <section className="relative overflow-hidden rounded-[22px] border border-neutral-200/80 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-950 sm:p-5">
            <div className="pointer-events-none absolute -right-20 -top-24 size-80 rounded-full bg-cyan-300/20 blur-3xl dark:bg-cyan-500/10" />
            <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-600 dark:text-cyan-300">
                  <AudioWaveform className="size-3.5" /> Voice agent studio
                </div>
                <h1 className="max-w-2xl text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">
                  Build a voice experience people want to use.
                </h1>
                <p className="mt-2 max-w-2xl text-[13px] leading-5 text-neutral-500">
                  Design a real-time agent with the same Chatty knowledge,
                  tools, booking, lead capture, and guardrails your text agent
                  already uses.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-3">
                <div className="text-right text-[11px] text-neutral-500" role="status" aria-live="polite">
                  <div className="flex items-center justify-end gap-1.5">
                    {saving ? <Loader2 className="size-3 animate-spin text-cyan-500" /> : saved ? <CheckCircle2 className="size-3 text-emerald-500" /> : null}
                    <span>{saving ? "Saving changes…" : saved ? "All changes saved" : "Changes will autosave"}</span>
                  </div>
                  <div className="mt-1 h-1 w-28 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                    <div className={`h-full rounded-full transition-all duration-500 ${error ? "bg-red-500" : saved ? "w-full bg-emerald-500" : saving ? "w-2/3 animate-pulse bg-cyan-500" : "w-1/4 bg-cyan-400"}`} />
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-2xl border border-cyan-100 bg-cyan-50/70 px-3 py-2.5 dark:border-cyan-950/60 dark:bg-cyan-950/20">
                  <div>
                    <p className="text-xs font-semibold">Voice access</p>
                    <p className="mt-0.5 text-[10px] text-neutral-500">
                      {config.enabled ? "Live in widget and embeds" : "Hidden from visitors"}
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
            <div className="relative mt-5 grid gap-2 sm:grid-cols-3">
              <div className="rounded-xl bg-neutral-50 p-3 dark:bg-neutral-900">
                <p className="text-[10px] uppercase tracking-[0.16em] text-neutral-400">
                  Session mode
                </p>
                <p className="mt-1 text-sm font-semibold capitalize">
                  {config.mode}
                </p>
              </div>
              <div className="rounded-xl bg-neutral-50 p-3 dark:bg-neutral-900">
                <p className="text-[10px] uppercase tracking-[0.16em] text-neutral-400">
                  Interruption
                </p>
                <p className="mt-1 text-sm font-semibold text-emerald-600">
                  Instant barge-in
                </p>
              </div>
              <div className="rounded-xl bg-neutral-50 p-3 dark:bg-neutral-900">
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
                livekitInferenceAvailable={config.livekit_inference_available}
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
                livekitInferenceAvailable={config.livekit_inference_available}
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
                livekitInferenceAvailable={config.livekit_inference_available}
              />
            </div>
            <div className="mt-5 flex items-start gap-2 rounded-2xl bg-neutral-50 p-4 text-xs leading-5 text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400">
              <KeyRound className="mt-0.5 size-4 shrink-0 text-cyan-600" />
              BYOK values are encrypted server-side, organization scoped, and
              never returned to the browser. LiveKit Inference is available
              only when Chatty is connected to LiveKit Cloud; self-hosted
              deployments use direct provider plugins.
            </div>
          </Card>
          <Card
            icon={<Sparkles className="size-5" />}
            title="Voice welcome"
            description="The first message visitors hear when they start a voice session."
          >
            <div className="mt-5 grid gap-3">
              <textarea
                value={config.welcome_message}
                onChange={(event) => update("welcome_message", event.target.value)}
                maxLength={300}
                rows={3}
                className={`${fieldClass} min-h-24 resize-y py-3`}
                placeholder="Hello! How can I help you today?"
                aria-label="Voice welcome message"
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] text-neutral-500">Autosaves for new voice sessions · {config.welcome_message.length}/300</span>
                <button
                  type="button"
                  onClick={() => void generateWelcome()}
                  disabled={generatingWelcome}
                  className="inline-flex items-center gap-1.5 rounded-full border border-cyan-200 px-3 py-1.5 text-xs font-semibold text-cyan-700 transition hover:bg-cyan-50 disabled:cursor-wait disabled:opacity-60 dark:border-cyan-900 dark:text-cyan-300 dark:hover:bg-cyan-950/40"
                >
                  {generatingWelcome ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
                  {generatingWelcome ? "Generating…" : "Auto-generate"}
                </button>
              </div>
            </div>
          </Card>
          <Card
            icon={<Languages className="size-5" />}
            title="Language and voice"
            description="Search the supported provider locales and voice IDs used for new sessions."
          >
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm">
                <span className="font-medium">STT language</span>
                <Select
                  value={config.stt_language}
                  onChange={(value) => update("stt_language", value)}
                   options={languageOptionsFor(config.stt_provider, config.stt_model, config.stt_language)}
                   label="STT language"
                 />
                <span className="text-[10px] leading-4 text-neutral-500">
                  This locale is passed to the selected STT and TTS providers. The list narrows when the selected LiveKit model publishes a language limit.
                </span>
              </label>
              <label className="grid gap-2 text-sm">
                <span className="font-medium">TTS voice / voice ID</span>
                <Select
                  value={config.tts_voice}
                  onChange={(value) => update("tts_voice", value)}
                  options={voiceOptions}
                  label="TTS voice"
                />
                <input
                  type="text"
                  value={config.tts_voice}
                  onChange={(event) => update("tts_voice", event.target.value)}
                  className={fieldClass}
                  placeholder="Enter the provider voice ID"
                  aria-label="TTS voice ID"
                />
                <span className="text-[10px] leading-4 text-neutral-500">
                  Voice IDs are provider-specific; model names are not voice IDs.
                </span>
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
        <aside className="min-h-[520px] xl:sticky xl:top-4 xl:self-start">
          <VoiceAgentPanel
            botId={botId}
            sessionId={sessionId}
            visualizer={config.visualizer}
            className="h-[min(680px,calc(100dvh-7rem))] min-h-[520px]"
          />
        </aside>
      </div>
    </div>
  );
}
