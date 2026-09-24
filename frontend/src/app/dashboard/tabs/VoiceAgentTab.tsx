"use client";

import { AudioWaveform, Mic, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { ModernSelect } from "@/components/ui/modern-select";

const TTS_VOICE_OPTIONS: Record<string, { value: string; label: string; hint?: string }[]> = {
  google: [
    { value: "en-US-Chirp3-HD-Aoede", label: "Aoede · expressive female" },
    { value: "en-US-Chirp3-HD-Charon", label: "Charon · warm male" },
    { value: "en-US-Chirp3-HD-Fenrir", label: "Fenrir · confident male" },
    { value: "en-US-Chirp3-HD-Kore", label: "Kore · clear female" },
    { value: "en-US-Chirp3-HD-Leda", label: "Leda · calm female" },
    { value: "en-US-Chirp3-HD-Orus", label: "Orus · natural male" },
    { value: "en-US-Chirp3-HD-Puck", label: "Puck · friendly male" },
    { value: "en-US-Chirp3-HD-Zephyr", label: "Zephyr · bright female" },
  ],
  cartesia: [
    { value: "694f9389-aac1-45b6-b726-9d9369183238", label: "English · natural (Cartesia preset)" },
  ],
  elevenlabs: [
    { value: "21m00Tcm4TlvDq8ikWAM", label: "Rachel · calm female" },
    { value: "EXAVITQu4vr4xnSDxMaL", label: "Bella · warm female" },
    { value: "ErXwobaYiN019PkySvjV", label: "Antoni · expressive male" },
    { value: "MF3mGyEYCl7XYWbV9V6O", label: "Elli · friendly female" },
    { value: "TxGEqnHWrfWFTfGW9XjX", label: "Josh · deep male" },
    { value: "pNInz6obpgDQGcFmaJgB", label: "Adam · confident male" },
  ],
  openai: [
    { value: "alloy", label: "Alloy · balanced" },
    { value: "echo", label: "Echo · clear male" },
    { value: "fable", label: "Fable · expressive" },
    { value: "nova", label: "Nova · warm female" },
    { value: "onyx", label: "Onyx · deep male" },
    { value: "shimmer", label: "Shimmer · bright female" },
  ],
  fishaudio: [{ value: "", label: "Custom voice ID" }],
};

interface VoiceAgentTabProps {
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
}

export function VoiceAgentTab({
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
}: VoiceAgentTabProps) {
  return (
    <div className="max-w-4xl mx-auto w-full py-6 px-4 flex justify-center">
      <div className="w-full max-w-2xl space-y-6">
        <div>
          <h2 className="text-sm font-bold flex items-center gap-2">
            <AudioWaveform className="size-4 text-[#f97316]" /> Voice Agent
            <span className="text-[10px] font-semibold tracking-tight px-2 py-0.5 rounded-full bg-[#f97316]/10 text-[#f97316] border border-[#f97316]/20">
              LiveKit voice
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
            Real-time voice agents use WebRTC &amp; LiveKit with live transcription, booking tools, and a continuous conversation loop. Choose pipeline mode for provider flexibility or realtime mode for speech-to-speech latency.
          </p>
        </div>

        <div className="p-6 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-neutral-100 dark:border-neutral-800">
            <div className="flex items-center gap-2">
              <Mic className="size-4 text-[#f97316]" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200">
                Voice Agent
              </h3>
            </div>
            <span className="text-[10px] font-semibold tracking-tight px-2 py-0.5 rounded-full bg-[#f97316]/10 text-[#f97316] border border-[#f97316]/20">
              LiveKit voice
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
                            provider === "google" ? "gemini-3.1-flash-live-preview" : "gpt-realtime";
                          setVoiceRealtimeProvider(provider);
                          setVoiceRealtimeModel(defaultModel);
                          handleAutoSaveVoiceField({
                            voice_realtime_provider: provider,
                            voice_realtime_model: defaultModel,
                          });
                        }}
                        options={[
                          { value: "google", label: "Google Gemini Live", hint: "gemini-3.1-flash-live-preview" },
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
                            ? "gemini-3.1-flash-live-preview"
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
                          { value: "google", label: "Google", hint: "Included, no setup" },
                          { value: "deepgram", label: "Deepgram", hint: "Requires your own API key" },
                          { value: "assemblyai", label: "AssemblyAI", hint: "Requires your own API key" },
                          { value: "soniox", label: "Soniox", hint: "Requires your own API key" },
                          { value: "openai", label: "OpenAI Whisper", hint: "Requires your own API key" },
                        ]}
                      />
                    </div>

                    {voiceSttProvider !== "google" && (
                      <div className="p-3.5 rounded-lg bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                            Speech-to-Text API Key
                          </span>
                          {voiceSttConfigured && (
                            <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-green-50 text-green-600 dark:bg-green-950/30 dark:text-green-400">
                              <Check className="size-2.5" /> Configured
                            </span>
                          )}
                          {!voiceSttConfigured && (
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
                          setVoiceTtsVoice(firstVoice);
                          handleAutoSaveVoiceField({ voice_tts_provider: v, voice_tts_voice: firstVoice || null });
                        }}
                        options={[
                          { value: "google", label: "Google", hint: "Included, no setup" },
                          { value: "cartesia", label: "Cartesia", hint: "Requires your own API key" },
                          { value: "elevenlabs", label: "ElevenLabs", hint: "Requires your own API key" },
                          { value: "openai", label: "OpenAI", hint: "Requires your own API key" },
                          { value: "fishaudio", label: "Fish Audio", hint: "Requires your own API key" },
                        ]}
                      />
                    </div>

                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2">
                          {voiceTtsProvider === "google" ? "Google" : voiceTtsProvider === "cartesia" ? "Cartesia" : voiceTtsProvider === "elevenlabs" ? "ElevenLabs" : voiceTtsProvider === "fishaudio" ? "Fish Audio" : "OpenAI"} TTS Voice
                        </label>
                        <ModernSelect
                          value={voiceTtsVoice}
                          searchable
                          onChange={(v) => {
                            setVoiceTtsVoice(v);
                            handleAutoSaveVoiceField({ voice_tts_voice: v || null });
                          }}
                          options={TTS_VOICE_OPTIONS[voiceTtsProvider] || []}
                          placeholder="Select a voice"
                        />
                        <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-1.5">
                          Choose a voice preset for this provider. The voice ID is stored with this assistant.
                        </p>
                    </div>

                    {voiceTtsProvider === "fishaudio" && (
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2">
                          Fish Audio Voice ID
                        </label>
                        <input
                          type="text"
                          value={voiceTtsVoice}
                          onChange={(e) => setVoiceTtsVoice(e.target.value)}
                          onBlur={(e) => handleAutoSaveVoiceField({ voice_tts_voice: e.target.value || null })}
                          placeholder="Paste your Fish Audio voice ID"
                          className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-neutral-350 dark:focus:border-neutral-700"
                        />
                        <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-1.5">
                          Fish Audio voices are account-specific, so enter the voice ID from your Fish Audio library.
                        </p>
                      </div>
                    )}

                    {voiceTtsProvider !== "google" && (
                      <div className="p-3.5 rounded-lg bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                            Text-to-Speech API Key
                          </span>
                          {voiceTtsConfigured && (
                            <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-green-50 text-green-600 dark:bg-green-950/30 dark:text-green-400">
                              <Check className="size-2.5" /> Configured
                            </span>
                          )}
                          {!voiceTtsConfigured && (
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

                    <p className="text-[10px] text-neutral-400 dark:text-neutral-500">
                      Voice uses the same AI Foundation Model and key configured above.
                    </p>
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
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
