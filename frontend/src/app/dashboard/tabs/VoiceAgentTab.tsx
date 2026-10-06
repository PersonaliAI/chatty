"use client";

import { VoiceUiCustomizer, DEFAULT_VOICE_UI_SETTINGS, VoiceUiSettingsData } from "./VoiceUiCustomizer";

import { useState, useMemo, useEffect } from "react";
import { AudioWaveform, Mic, Check, Sparkles, ExternalLink, KeyRound } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { ModernSelect } from "@/components/ui/modern-select";

export const TTS_VOICE_OPTIONS: Record<string, { value: string; label: string; hint?: string }[]> = {
  google: [
    { value: "en-US-Chirp3-HD-Aoede", label: "Aoede · expressive female" },
    { value: "en-US-Chirp3-HD-Charon", label: "Charon · warm male" },
    { value: "en-US-Chirp3-HD-Fenrir", label: "Fenrir · confident male" },
    { value: "en-US-Chirp3-HD-Kore", label: "Kore · clear female" },
    { value: "en-US-Chirp3-HD-Leda", label: "Leda · calm female" },
    { value: "en-US-Chirp3-HD-Orus", label: "Orus · natural male" },
    { value: "en-US-Chirp3-HD-Puck", label: "Puck · friendly male" },
    { value: "en-US-Chirp3-HD-Zephyr", label: "Zephyr · bright female" },
    { value: "custom", label: "Custom Voice ID (Enter your own)..." },
  ],
  cartesia: [
    { value: "694f9389-aac1-45b6-b726-9d9369183238", label: "Sonic English · natural male" },
    { value: "a167e0f3-df7e-4d52-a9c3-f949145efdab", label: "British Narrator · articulate female" },
    { value: "79a125e8-cd45-4c13-8a67-188112f4dd22", label: "Australian · warm female" },
    { value: "2ee87190-8f84-4925-97da-e52547f9462c", label: "Sidekick · energetic male" },
    { value: "f9836c6e-a0bd-460e-9d3c-f7299fa60f94", label: "Helpful Assistant · balanced neutral" },
    { value: "c45bc5ec-5968-4f11-8930-109ff62e5be5", label: "Customer Support · friendly female" },
    { value: "846d35e9-dc05-4526-ba35-9c27704a5004", label: "Polite Consultant · professional male" },
    { value: "e9035768-f7bc-4fef-ac75-77f6f1947230", label: "Calm Meditative · soft female" },
    { value: "custom", label: "Custom Voice ID (Enter your own)..." },
  ],
  elevenlabs: [
    { value: "21m00Tcm4TlvDq8ikWAM", label: "Rachel · calm, natural female" },
    { value: "EXAVITQu4vr4xnSDxMaL", label: "Bella · warm, expressive female" },
    { value: "ErXwobaYiN019PkySvjV", label: "Antoni · expressive, pleasant male" },
    { value: "MF3mGyEYCl7XYWbV9V6O", label: "Elli · friendly, young female" },
    { value: "TxGEqnHWrfWFTfGW9XjX", label: "Josh · deep, resonant male" },
    { value: "pNInz6obpgDQGcFmaJgB", label: "Adam · confident, versatile male" },
    { value: "yoZ06aMxZJJ28mfd3POQ", label: "Sam · reliable, American male" },
    { value: "AZnzlk1XvdvUeBnXmlld", label: "Domi · energetic, upbeat female" },
    { value: "CYw3kZ78EjZGQKq6n86E", label: "Dave · conversational British male" },
    { value: "D38z5RcWu1voky8WS1ja", label: "Fin · charming Irish male" },
    { value: "ThT5KcBeYPX3keUQqHPh", label: "Dorothy · pleasant British female" },
    { value: "piTKgcLEGmPE4e6mEKli", label: "Nicole · whisper, soft female" },
    { value: "flq6f7yk4E4fJM5XTYuZ", label: "Michael · natural narrator male" },
    { value: "2EiwWnXFnvU5JabPnv8n", label: "Clyde · character veteran male" },
    { value: "jsCqWAovK2LkecY7zXl4", label: "Freya · expressive Nordic female" },
    { value: "oWAxZDx7w5VEj9dCyTzz", label: "Grace · Southern warm female" },
    { value: "onwK4e9ZLuTAKqWW03F9", label: "Daniel · deep British male" },
    { value: "pFZP5JQG7iQjIQuC4Bku", label: "Lily · warm British female" },
    { value: "pMsXgVXv3BLzUgSXRplE", label: "Serena · pleasant corporate female" },
    { value: "nPczCjzI2devNBz1zQrb", label: "Brian · deep narrator male" },
    { value: "JBFqnCBsd6RMkjVDRZzb", label: "George · warm British gentleman" },
    { value: "N2lVS1w4EtoT3dr4eOWO", label: "Callum · intense Scottish male" },
    { value: "IKne3meq5aSn9XLyUdCD", label: "Charlie · casual Australian male" },
    { value: "XB0fDUnXU5powFXDhCwa", label: "Charlotte · pleasant Swedish female" },
    { value: "Xb7hH8MSUJpSbSDYk0k2", label: "Alice · confident British female" },
    { value: "TX3LPaxmHKxFdv7VOQHJ", label: "Liam · young, dynamic American male" },
    { value: "bIHbv24MWmeRgasZH58o", label: "Will · friendly, approachable male" },
    { value: "cgSgspJ2msm6clMCkdW9", label: "Jessica · expressive American female" },
    { value: "cjVigY5qzO86Huf0OWal", label: "Eric · conversational American male" },
    { value: "iP95p4xoKVk53GoZ742B", label: "Chris · casual American male" },
    { value: "pqHfZKP75CvOlQylNhV4", label: "Bill · trustworthy, mature male" },
    { value: "XrExE9yKIg1WjnnlVkGX", label: "Matilda · warm Australian female" },
    { value: "custom", label: "Custom Voice ID (Enter your own)..." },
  ],
  openai: [
    { value: "alloy", label: "Alloy · balanced, neutral" },
    { value: "echo", label: "Echo · clear, smooth male" },
    { value: "fable", label: "Fable · expressive British" },
    { value: "nova", label: "Nova · warm, friendly female" },
    { value: "onyx", label: "Onyx · deep, authoritative male" },
    { value: "shimmer", label: "Shimmer · bright, clear female" },
    { value: "ash", label: "Ash · confident, conversational male" },
    { value: "ballad", label: "Ballad · warm, emotive male" },
    { value: "coral", label: "Coral · friendly, warm female" },
    { value: "sage", label: "Sage · thoughtful, professional female" },
    { value: "verse", label: "Verse · dynamic, conversational" },
    { value: "custom", label: "Custom Voice ID (Enter your own)..." },
  ],
  fishaudio: [
    { value: "933563129e564b19a115bedd57b7406a", label: "Default Assistant · clear neutral" },
    { value: "7f92f8afb8ec43bf81429cc1c9199cb1", label: "Natural English · conversational male" },
    { value: "54a58d528b1448888062d9894e330a11", label: "Warm Support · friendly female" },
    { value: "ad584e03aa324c4384a29a435a96055c", label: "Professional · business voice" },
    { value: "5f347581db22431f9ee2ae73e659b8eb", label: "Friendly Casual · upbeat voice" },
    { value: "custom", label: "Custom Voice ID (Enter your own)..." },
  ],
};

interface VoiceAgentTabProps {
  botId: string;
  voiceEnabled: boolean;
  setVoiceEnabled: (b: boolean) => void;
  handleAutoSaveVoiceField: (patch: Record<string, unknown>) => Promise<void>;
  savingVoiceField: boolean;
  voiceAgentRole: string;
  setVoiceAgentRole: (r: string) => void;
  setActiveTab: (tab: string) => void;
  voiceMode: "pipeline" | "realtime";
  setVoiceMode: (m: "pipeline" | "realtime") => void;
  voiceRealtimeProvider: "google" | "openai";
  setVoiceRealtimeProvider: (p: "google" | "openai") => void;
  voiceRealtimeModel: string;
  setVoiceRealtimeModel: (m: string) => void;
  voiceTtsVoice: string;
  setVoiceTtsVoice: (v: string) => void;
  voiceRealtimeConfigured: boolean;
  voiceRealtimeApiKeyInput: string;
  setVoiceRealtimeApiKeyInput: (k: string) => void;
  handleSaveVoiceByok: (kind: "stt" | "tts" | "realtime", remove: boolean) => Promise<void>;
  savingVoiceRealtime: boolean;
  voiceSttProvider: string;
  setVoiceSttProvider: (p: string) => void;
  voiceSttConfigured: boolean;
  voiceSttApiKeyInput: string;
  setVoiceSttApiKeyInput: (k: string) => void;
  savingVoiceStt: boolean;
  voiceTtsProvider: string;
  setVoiceTtsProvider: (p: string) => void;
  voiceTtsConfigured: boolean;
  voiceTtsApiKeyInput: string;
  setVoiceTtsApiKeyInput: (k: string) => void;
  savingVoiceTts: boolean;
  voiceMaxDurationMinutes: number;
  setVoiceMaxDurationMinutes: (n: number) => void;
  welcomeMsg: string;
  setWelcomeMsg: (message: string) => void;
  generateVoiceWelcome: () => Promise<void>;
  generatingVoiceWelcome: boolean;
  voiceMessageMode?: string;
}

export function VoiceAgentTab({
  botId,
  voiceEnabled,
  setVoiceEnabled,
  handleAutoSaveVoiceField,
  savingVoiceField,
  voiceAgentRole,
  setVoiceAgentRole,
  setActiveTab,
  voiceMode,
  setVoiceMode,
  voiceRealtimeProvider,
  setVoiceRealtimeProvider,
  voiceRealtimeModel,
  setVoiceRealtimeModel,
  voiceTtsVoice,
  setVoiceTtsVoice,
  voiceRealtimeConfigured,
  voiceRealtimeApiKeyInput,
  setVoiceRealtimeApiKeyInput,
  handleSaveVoiceByok,
  savingVoiceRealtime,
  voiceSttProvider,
  setVoiceSttProvider,
  voiceSttConfigured,
  voiceSttApiKeyInput,
  setVoiceSttApiKeyInput,
  savingVoiceStt,
  voiceTtsProvider,
  setVoiceTtsProvider,
  voiceTtsConfigured,
  voiceTtsApiKeyInput,
  setVoiceTtsApiKeyInput,
  savingVoiceTts,
  voiceMaxDurationMinutes,
  setVoiceMaxDurationMinutes,
  welcomeMsg,
  setWelcomeMsg,
  generateVoiceWelcome,
  generatingVoiceWelcome,
  voiceMessageMode = "audio",
}: VoiceAgentTabProps) {

  const [voiceUiSettings, setVoiceUiSettings] = useState<VoiceUiSettingsData>(() => {
    if (voiceMessageMode && typeof voiceMessageMode === "string" && voiceMessageMode.startsWith("{")) {
      try {
        return { ...DEFAULT_VOICE_UI_SETTINGS, ...JSON.parse(voiceMessageMode) };
      } catch {
        return DEFAULT_VOICE_UI_SETTINGS;
      }
    }
    return DEFAULT_VOICE_UI_SETTINGS;
  });

  useEffect(() => {
    if (voiceMessageMode && typeof voiceMessageMode === "string" && voiceMessageMode.startsWith("{")) {
      try {
        setVoiceUiSettings({ ...DEFAULT_VOICE_UI_SETTINGS, ...JSON.parse(voiceMessageMode) });
      } catch {}
    }
  }, [voiceMessageMode]);

  const handleUpdateVoiceUi = (patch: Partial<VoiceUiSettingsData>) => {
    const next = { ...voiceUiSettings, ...patch };
    setVoiceUiSettings(next);
    handleAutoSaveVoiceField({ voice_message_mode: JSON.stringify(next) });
  };

  const [unifiedElevenLabsKeyInput, setUnifiedElevenLabsKeyInput] = useState("");
  const [savingUnifiedElevenLabs, setSavingUnifiedElevenLabs] = useState(false);
  const [isCustomVoiceSelected, setIsCustomVoiceSelected] = useState(false);

  const availableVoices = useMemo(() => {
    return TTS_VOICE_OPTIONS[voiceTtsProvider] || [];
  }, [voiceTtsProvider]);

  const isCurrentVoicePreset = useMemo(() => {
    return availableVoices.some((opt) => opt.value === voiceTtsVoice && opt.value !== "custom");
  }, [availableVoices, voiceTtsVoice]);

  const selectedSelectValue = useMemo(() => {
    if (isCustomVoiceSelected) return "custom";
    if (isCurrentVoicePreset) return voiceTtsVoice;
    if (!voiceTtsVoice) return availableVoices[0]?.value || "";
    return "custom";
  }, [isCustomVoiceSelected, isCurrentVoicePreset, voiceTtsVoice, availableVoices]);

  const showCustomVoiceInput = isCustomVoiceSelected || (!isCurrentVoicePreset && !!voiceTtsVoice);

  const isDualElevenLabs = voiceMode === "pipeline" && voiceSttProvider === "elevenlabs" && voiceTtsProvider === "elevenlabs";

  const handleSaveUnifiedElevenLabs = async (remove: boolean) => {
    setSavingUnifiedElevenLabs(true);
    try {
      if (remove) {
        await Promise.all([
          handleSaveVoiceByok("stt", true),
          handleSaveVoiceByok("tts", true),
        ]);
        setUnifiedElevenLabsKeyInput("");
      } else {
        setVoiceSttApiKeyInput(unifiedElevenLabsKeyInput);
        setVoiceTtsApiKeyInput(unifiedElevenLabsKeyInput);
        await Promise.all([
          handleSaveVoiceByok("stt", false),
          handleSaveVoiceByok("tts", false),
        ]);
        setUnifiedElevenLabsKeyInput("");
      }
    } finally {
      setSavingUnifiedElevenLabs(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto w-full py-6 px-4 flex justify-center">
      <div className="w-full max-w-2xl space-y-6">
        <div>
          <h2 className="text-sm font-bold flex items-center gap-2">
            <AudioWaveform className="size-4 text-[#f97316]" /> Voice Agent
            <span className="text-[10px] font-semibold tracking-tight px-2 py-0.5 rounded-full bg-[#f97316]/10 text-[#f97316] border border-[#f97316]/20">
              Production voice
            </span>
          </h2>
          <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
            Let visitors talk to your bot instead of typing - configure speech recognition, voice
            synthesis, the agent&apos;s call persona, and call safety limits.
          </p>
        </div>

        <div className="flex items-center gap-3 p-3.5 bg-[#f97316]/5 border border-[#f97316]/20 rounded-2xl text-xs">
          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-[#f97316] text-white shrink-0">
            Available
          </span>
          <p className="text-[11px] leading-relaxed text-neutral-600 dark:text-neutral-400">
            Real-time voice agents use secure WebRTC with live transcription, booking tools, and a continuous conversation loop. Choose pipeline mode for provider flexibility or realtime mode for speech-to-speech latency.
          </p>
        </div>

        <div className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div>
            <p className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">Dedicated voice agent view</p>
            <p className="mt-1 text-[10px] leading-relaxed text-neutral-500 dark:text-neutral-400">Open the standalone call experience in a new tab or embed it separately from the chat widget.</p>
          </div>
          <a href={`/voice/${botId}`} target="_blank" rel="noopener noreferrer" className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-[#f97316] px-3 py-2 text-[11px] font-semibold text-white transition-colors hover:bg-[#ea580c]">
            Open voice view <ExternalLink className="size-3.5" />
          </a>
        </div>

        <div className="p-4 sm:p-6 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-neutral-100 dark:border-neutral-800">
            <div className="flex items-center gap-2">
              <Mic className="size-4 text-[#f97316]" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200">
                Voice Agent
              </h3>
            </div>
            <span className="text-[10px] font-semibold tracking-tight px-2 py-0.5 rounded-full bg-[#f97316]/10 text-[#f97316] border border-[#f97316]/20">
              Production voice
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold">Enable voice agent</span>
              <p className="text-[10px] text-neutral-400 dark:text-neutral-500">
                Adds a microphone control so visitors can speak to your widget.
              </p>
            </div>
            <button
              onClick={() => {
                const next = !voiceEnabled;
                setVoiceEnabled(next);
                handleAutoSaveVoiceField({ voice_enabled: next });
              }}
              disabled={savingVoiceField}
              className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer disabled:opacity-60 ${
                voiceEnabled ? "bg-[#f97316]" : "bg-neutral-200 dark:bg-neutral-800"
              }`}
            >
              <div
                className={`size-4 rounded-full bg-white transition-transform ${
                  voiceEnabled ? "translate-x-4" : ""
                }`}
              />
            </button>
          </div>

          <AnimatePresence>
            {voiceEnabled && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="space-y-4 overflow-hidden"
              >
                {/* Agent role / persona */}
                <div>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400">
                      Voice welcome message
                    </label>
                    <button
                      type="button"
                      onClick={() => void generateVoiceWelcome()}
                      disabled={generatingVoiceWelcome}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[#f97316]/25 bg-[#f97316]/8 px-2.5 py-1.5 text-[10px] font-semibold text-[#ea580c] transition-colors hover:bg-[#f97316]/15 disabled:cursor-wait disabled:opacity-60"
                    >
                      <Sparkles className="size-3" />
                      {generatingVoiceWelcome ? "Generating…" : "Generate from knowledge"}
                    </button>
                  </div>
                  <textarea
                    value={welcomeMsg}
                    onChange={(e) => setWelcomeMsg(e.target.value)}
                    onBlur={(e) => handleAutoSaveVoiceField({ welcome_message: e.target.value.slice(0, 300) })}
                    rows={2}
                    maxLength={300}
                    className="w-full resize-none rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs leading-relaxed focus:border-neutral-350 focus:outline-none dark:border-neutral-800 dark:bg-neutral-950"
                    placeholder="Hello! I'm here to help. What would you like to know?"
                  />
                  <p className="mt-1.5 text-[10px] text-neutral-400 dark:text-neutral-500">
                    This greeting is spoken when the call connects and is also used by the chat widget.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2">
                    Call Persona
                  </label>
                  <ModernSelect
                    value={voiceAgentRole}
                    onChange={(v) => {
                      setVoiceAgentRole(v);
                      handleAutoSaveVoiceField({ voice_agent_role: v });
                    }}
                    options={[
                      { value: "general", label: "General Assistant", hint: "No special lean, default" },
                      {
                        value: "booking",
                        label: "Order & Booking",
                        hint: "Proactively offers to schedule once it understands the need",
                      },
                      { value: "info", label: "Information & FAQ", hint: "Sticks to answering questions, doesn't push booking" },
                      { value: "lead", label: "Lead Qualification", hint: "Focuses on capturing contact info for follow-up" },
                    ]}
                  />
                </div>

                {/* Booking / lead-capture context note */}
                <p className="text-[10px] text-neutral-400 dark:text-neutral-500 bg-neutral-50 dark:bg-neutral-950 border border-neutral-100 dark:border-neutral-850 rounded-lg p-3 leading-relaxed">
                  The persona above only shapes what the agent leads with on a call - it doesn&apos;t
                  unlock new capabilities. Booking and lead-capture on calls use the same settings as
                  your text chat:{" "}
                  <button
                    type="button"
                    onClick={() => setActiveTab("settings")}
                    className="font-semibold text-[#f97316] hover:underline cursor-pointer"
                  >
                    Settings → Scheduling
                  </button>{" "}
                  configures calendar booking, and{" "}
                  <button
                    type="button"
                    onClick={() => setActiveTab("settings")}
                    className="font-semibold text-[#f97316] hover:underline cursor-pointer"
                  >
                    Settings → AI Engine
                  </button>{" "}
                  configures knowledge base behavior.
                </p>

                {/* Mode tabs */}
                <div>
                  <div className="flex items-center gap-0.5 bg-neutral-50 dark:bg-neutral-950 rounded-lg p-0.5 border border-neutral-200 dark:border-neutral-800 w-fit mb-3">
                    {[
                      { value: "pipeline" as const, label: "Pipeline" },
                      { value: "realtime" as const, label: "Realtime" },
                    ].map((t) => (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => {
                          setVoiceMode(t.value);
                          handleAutoSaveVoiceField({ voice_mode: t.value });
                        }}
                        className={`px-3.5 py-1.5 text-[11px] font-semibold rounded-md transition-colors cursor-pointer ${
                          voiceMode === t.value
                            ? "bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm"
                            : "text-neutral-400 hover:text-neutral-600"
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mb-1">
                    {voiceMode === "realtime"
                      ? "Speech-to-speech - the model listens and speaks directly, no separate transcription/synthesis step. Faster and more natural, still uses your knowledge base and booking/lead-capture tools."
                      : "Classic pipeline - pick a speech-to-text and text-to-speech provider independently."}
                  </p>

                </div>

                {voiceMode === "realtime" ? (
                  <>
                    {/* Realtime provider */}
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2">
                        Realtime Provider
                      </label>
                      <ModernSelect
                        value={voiceRealtimeProvider}
                        onChange={(v) => {
                          const provider = v as "google" | "openai";
                          const defaultModel =
                            provider === "google" ? "gemini-3.8-live" : "gpt-realtime";
                          setVoiceRealtimeProvider(provider);
                          setVoiceRealtimeModel(defaultModel);
                          handleAutoSaveVoiceField({
                            voice_realtime_provider: provider,
                            voice_realtime_model: defaultModel,
                          });
                        }}
                        options={[
                          { value: "google", label: "Google Gemini Live", hint: "gemini-3.8-live" },
                          { value: "openai", label: "OpenAI Realtime", hint: "gpt-realtime" },
                        ]}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2">
                        Model
                      </label>
                      <input
                        type="text"
                        value={voiceRealtimeModel}
                        onChange={(e) => setVoiceRealtimeModel(e.target.value)}
                        onBlur={(e) =>
                          handleAutoSaveVoiceField({ voice_realtime_model: e.target.value || null })
                        }
                        placeholder={
                          voiceRealtimeProvider === "google"
                            ? "gemini-3.8-live"
                            : "gpt-realtime"
                        }
                        className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-neutral-350 dark:focus:border-neutral-700"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2">
                        Voice (optional)
                      </label>
                      <input
                        type="text"
                        value={voiceTtsVoice}
                        onChange={(e) => setVoiceTtsVoice(e.target.value)}
                        onBlur={(e) =>
                          handleAutoSaveVoiceField({ voice_tts_voice: e.target.value || null })
                        }
                        placeholder={voiceRealtimeProvider === "google" ? "Puck" : "marin"}
                        className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-neutral-350 dark:focus:border-neutral-700"
                      />
                      <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-1.5">
                        Leave blank to use the default voice.
                      </p>
                    </div>

                    <div className="p-3.5 rounded-lg bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                          Realtime API Key (optional)
                        </span>
                        {voiceRealtimeConfigured && (
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-green-50 text-green-600 dark:bg-green-950/30 dark:text-green-400">
                            <Check className="size-2.5" /> Configured
                          </span>
                        )}
                      </div>
                      <input
                        type="password"
                        value={voiceRealtimeApiKeyInput}
                        onChange={(e) => setVoiceRealtimeApiKeyInput(e.target.value)}
                        placeholder={
                          voiceRealtimeConfigured
                            ? "•••••••••••••••• (saved - enter a new key to replace)"
                            : "API key (optional)"
                        }
                        className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-neutral-350 dark:focus:border-neutral-700"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSaveVoiceByok("realtime", false)}
                          disabled={savingVoiceRealtime || !voiceRealtimeApiKeyInput.trim()}
                          className="px-3 py-1.5 bg-[#f97316] text-white rounded-lg text-[11px] font-semibold hover:opacity-90 cursor-pointer disabled:opacity-40"
                        >
                          {savingVoiceRealtime ? "Saving…" : "Save key"}
                        </button>
                        {voiceRealtimeConfigured && (
                          <button
                            onClick={() => handleSaveVoiceByok("realtime", true)}
                            disabled={savingVoiceRealtime}
                            className="px-3 py-1.5 text-neutral-500 hover:text-red-500 rounded-lg text-[11px] font-semibold cursor-pointer disabled:opacity-40"
                          >
                            Remove key
                          </button>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Speech-to-Text provider */}
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2">
                        Speech-to-Text Provider
                      </label>
                      <ModernSelect
                        value={voiceSttProvider}
                        onChange={(v) => {
                          setVoiceSttProvider(v);
                          handleAutoSaveVoiceField({ voice_stt_provider: v });
                        }}
                        options={[
                          { value: "google", label: "Google", hint: "ADC required on VPS" },
                          { value: "cartesia", label: "Cartesia Ink", hint: "Ultra-low latency streaming STT · Requires your own API key" },
                          { value: "deepgram", label: "Deepgram", hint: "Requires your own API key" },
                          { value: "assemblyai", label: "AssemblyAI", hint: "Requires your own API key" },
                          { value: "soniox", label: "Soniox", hint: "Requires your own API key" },
                          { value: "elevenlabs", label: "ElevenLabs Scribe", hint: "Scribe v2 realtime · Requires your own API key" },
                          { value: "openai", label: "OpenAI Whisper", hint: "Requires your own API key" },
                        ]}
                      />
                    </div>

                    {/* Text-to-Speech provider */}
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2">
                        Text-to-Speech Provider
                      </label>
                      <ModernSelect
                        value={voiceTtsProvider}
                        onChange={(v) => {
                          setVoiceTtsProvider(v);
                          const firstVoice = TTS_VOICE_OPTIONS[v]?.[0]?.value || "";
                          setIsCustomVoiceSelected(false);
                          setVoiceTtsVoice(firstVoice);
                          handleAutoSaveVoiceField({ voice_tts_provider: v, voice_tts_voice: firstVoice || null });
                        }}
                        options={[
                          { value: "google", label: "Google", hint: "ADC required on VPS" },
                          { value: "elevenlabs", label: "ElevenLabs", hint: "Requires your own API key" },
                          { value: "openai", label: "OpenAI", hint: "Requires your own API key" },
                          { value: "fishaudio", label: "Fish Audio", hint: "Requires your own API key" },
                          { value: "cartesia", label: "Cartesia", hint: "Requires your own API key" },
                        ]}
                      />
                    </div>

                    {/* Voice Selection & Custom Voice ID */}
                    <div className="space-y-2">
                      <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400">
                        {voiceTtsProvider === "google"
                          ? "Google"
                          : voiceTtsProvider === "cartesia"
                          ? "Cartesia"
                          : voiceTtsProvider === "elevenlabs"
                          ? "ElevenLabs"
                          : voiceTtsProvider === "fishaudio"
                          ? "Fish Audio"
                          : "OpenAI"}{" "}
                        TTS Voice
                      </label>
                      <ModernSelect
                        value={selectedSelectValue}
                        searchable
                        onChange={(v) => {
                          if (v === "custom") {
                            setIsCustomVoiceSelected(true);
                          } else {
                            setIsCustomVoiceSelected(false);
                            setVoiceTtsVoice(v);
                            handleAutoSaveVoiceField({ voice_tts_voice: v || null });
                          }
                        }}
                        options={availableVoices}
                        placeholder="Select a voice"
                      />

                      {showCustomVoiceInput && (
                        <div className="p-3 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg space-y-1.5 mt-2">
                          <label className="block text-[11px] font-semibold text-neutral-700 dark:text-neutral-300">
                            Custom Voice ID
                          </label>
                          <input
                            type="text"
                            value={voiceTtsVoice === "custom" ? "" : voiceTtsVoice}
                            onChange={(e) => setVoiceTtsVoice(e.target.value)}
                            onBlur={(e) => {
                              const val = e.target.value.trim();
                              handleAutoSaveVoiceField({ voice_tts_voice: val || null });
                            }}
                            placeholder={
                              voiceTtsProvider === "elevenlabs"
                                ? "Paste your ElevenLabs Voice ID (e.g. 21m00Tcm4TlvDq8ikWAM)"
                                : voiceTtsProvider === "fishaudio"
                                ? "Paste your Fish Audio Voice ID from your library"
                                : "Paste your custom voice identifier"
                            }
                            className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-neutral-350 dark:focus:border-neutral-700"
                          />
                          <p className="text-[10px] text-neutral-400 dark:text-neutral-500">
                            Enter any voice model or cloned voice ID from your provider dashboard.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* ── UNIFIED API KEYS SECTION ── */}
                    <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800 space-y-3">
                      <div className="flex items-center gap-2">
                        <KeyRound className="size-3.5 text-[#f97316]" />
                        <h4 className="text-[11px] font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-300">
                          Provider API Keys
                        </h4>
                      </div>

                      {/* Unified ElevenLabs Key when both STT and TTS are ElevenLabs */}
                      {isDualElevenLabs ? (
                        <div className="p-3.5 rounded-lg bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 flex items-center gap-1.5">
                              ElevenLabs API Key
                              <span className="text-[9px] font-normal text-[#f97316] bg-[#f97316]/10 px-1.5 py-0.5 rounded">
                                Powers both Scribe STT & TTS
                              </span>
                            </span>
                            {voiceSttConfigured && voiceTtsConfigured ? (
                              <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-green-50 text-green-600 dark:bg-green-950/30 dark:text-green-400">
                                <Check className="size-2.5" /> Configured
                              </span>
                            ) : (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-900 text-neutral-400">
                                Not configured
                              </span>
                            )}
                          </div>
                          <input
                            type="password"
                            value={unifiedElevenLabsKeyInput}
                            onChange={(e) => setUnifiedElevenLabsKeyInput(e.target.value)}
                            placeholder={
                              voiceSttConfigured || voiceTtsConfigured
                                ? "•••••••••••••••• (saved - enter a new key to replace for both STT & TTS)"
                                : "Paste your ElevenLabs API key"
                            }
                            className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-neutral-350 dark:focus:border-neutral-700"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleSaveUnifiedElevenLabs(false)}
                              disabled={savingUnifiedElevenLabs || !unifiedElevenLabsKeyInput.trim()}
                              className="px-3 py-1.5 bg-[#f97316] text-white rounded-lg text-[11px] font-semibold hover:opacity-90 cursor-pointer disabled:opacity-40"
                            >
                              {savingUnifiedElevenLabs ? "Saving…" : "Save ElevenLabs Key"}
                            </button>
                            {(voiceSttConfigured || voiceTtsConfigured) && (
                              <button
                                onClick={() => handleSaveUnifiedElevenLabs(true)}
                                disabled={savingUnifiedElevenLabs}
                                className="px-3 py-1.5 text-neutral-500 hover:text-red-500 rounded-lg text-[11px] font-semibold cursor-pointer disabled:opacity-40"
                              >
                                Remove key
                              </button>
                            )}
                          </div>
                        </div>
                      ) : (
                        <>
                          {/* STT Key (if not Google and not dual ElevenLabs) */}
                          {voiceSttProvider !== "google" && (
                            <div className="p-3.5 rounded-lg bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 space-y-2.5">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                                  {voiceSttProvider === "elevenlabs"
                                    ? "ElevenLabs Scribe STT API Key"
                                    : `${voiceSttProvider.charAt(0).toUpperCase() + voiceSttProvider.slice(1)} STT API Key`}
                                </span>
                                {voiceSttConfigured ? (
                                  <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-green-50 text-green-600 dark:bg-green-950/30 dark:text-green-400">
                                    <Check className="size-2.5" /> Configured
                                  </span>
                                ) : (
                                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-900 text-neutral-400">
                                    Not configured
                                  </span>
                                )}
                              </div>
                              <input
                                type="password"
                                value={voiceSttApiKeyInput}
                                onChange={(e) => setVoiceSttApiKeyInput(e.target.value)}
                                placeholder={
                                  voiceSttConfigured
                                    ? "•••••••••••••••• (saved - enter a new key to replace)"
                                    : "API key"
                                }
                                className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-neutral-350 dark:focus:border-neutral-700"
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleSaveVoiceByok("stt", false)}
                                  disabled={savingVoiceStt || !voiceSttApiKeyInput.trim()}
                                  className="px-3 py-1.5 bg-[#f97316] text-white rounded-lg text-[11px] font-semibold hover:opacity-90 cursor-pointer disabled:opacity-40"
                                >
                                  {savingVoiceStt ? "Saving…" : "Save key"}
                                </button>
                                {voiceSttConfigured && (
                                  <button
                                    onClick={() => handleSaveVoiceByok("stt", true)}
                                    disabled={savingVoiceStt}
                                    className="px-3 py-1.5 text-neutral-500 hover:text-red-500 rounded-lg text-[11px] font-semibold cursor-pointer disabled:opacity-40"
                                  >
                                    Remove key
                                  </button>
                                )}
                              </div>
                            </div>
                          )}

                          {/* TTS Key (if not Google and not dual ElevenLabs) */}
                          {voiceTtsProvider !== "google" && (
                            <div className="p-3.5 rounded-lg bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 space-y-2.5">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                                  {voiceTtsProvider === "elevenlabs"
                                    ? "ElevenLabs TTS API Key"
                                    : `${voiceTtsProvider.charAt(0).toUpperCase() + voiceTtsProvider.slice(1)} TTS API Key`}
                                </span>
                                {voiceTtsConfigured ? (
                                  <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-green-50 text-green-600 dark:bg-green-950/30 dark:text-green-400">
                                    <Check className="size-2.5" /> Configured
                                  </span>
                                ) : (
                                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-900 text-neutral-400">
                                    Not configured
                                  </span>
                                )}
                              </div>
                              <input
                                type="password"
                                value={voiceTtsApiKeyInput}
                                onChange={(e) => setVoiceTtsApiKeyInput(e.target.value)}
                                placeholder={
                                  voiceTtsConfigured
                                    ? "•••••••••••••••• (saved - enter a new key to replace)"
                                    : "API key"
                                }
                                className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-neutral-350 dark:focus:border-neutral-700"
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleSaveVoiceByok("tts", false)}
                                  disabled={savingVoiceTts || !voiceTtsApiKeyInput.trim()}
                                  className="px-3 py-1.5 bg-[#f97316] text-white rounded-lg text-[11px] font-semibold hover:opacity-90 cursor-pointer disabled:opacity-40"
                                >
                                  {savingVoiceTts ? "Saving…" : "Save key"}
                                </button>
                                {voiceTtsConfigured && (
                                  <button
                                    onClick={() => handleSaveVoiceByok("tts", true)}
                                    disabled={savingVoiceTts}
                                    className="px-3 py-1.5 text-neutral-500 hover:text-red-500 rounded-lg text-[11px] font-semibold cursor-pointer disabled:opacity-40"
                                  >
                                    Remove key
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </>
                )}

                {/* Call Limits */}
                <div className="pt-2 mt-2 border-t border-neutral-100 dark:border-neutral-800">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5">
                    Call Limits
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min={1}
                      max={60}
                      value={voiceMaxDurationMinutes}
                      onChange={(e) => setVoiceMaxDurationMinutes(parseInt(e.target.value, 10) || 1)}
                      onBlur={(e) => {
                        const v = Math.min(60, Math.max(1, parseInt(e.target.value, 10) || 15));
                        setVoiceMaxDurationMinutes(v);
                        handleAutoSaveVoiceField({ voice_max_duration_minutes: v });
                      }}
                      className="w-20 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-neutral-350 dark:focus:border-neutral-700"
                    />
                    <span className="text-[10px] text-neutral-400 dark:text-neutral-500">
                      minutes, max call duration
                    </span>
                  </div>
                  <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-1.5">
                    Calls automatically end after this long, to prevent an abandoned browser tab from running indefinitely.
                  </p>
                </div>

                {/* Official LiveKit Agents UI & Controls Customization */}
                <div className="pt-2 mt-2 border-t border-neutral-100 dark:border-neutral-800">
                  <VoiceUiCustomizer
                    settings={voiceUiSettings}
                    onChange={handleUpdateVoiceUi}
                  />
                </div>

              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
