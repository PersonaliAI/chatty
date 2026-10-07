'use client';

import * as React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AudioWaveform, CheckCircle2, ExternalLink, KeyRound, Save, Settings2 } from 'lucide-react';

import { VoiceAgentPanel } from '@/components/voice/VoiceAgentPanel';
import { ModernAlert } from '@/components/ui/modern-alert';
import { ModernSelect } from '@/components/ui/modern-select';
import { ModernSwitch } from '@/components/ui/modern-switch';

type FetchBackend = (path: string, options?: RequestInit) => Promise<Response>;

type VoiceConfig = {
  enabled: boolean;
  mode: 'pipeline' | 'realtime';
  expression_enabled: boolean;
  visualizer: 'wave' | 'bar' | 'grid' | 'radial' | 'aura';
  agent_name: string;
  llm_provider: string;
  llm_model: string;
  stt_provider: string;
  stt_model: string;
  stt_language: string;
  tts_provider: string;
  tts_model: string;
  tts_voice: string;
  max_duration_minutes: number;
  llm_key_configured?: boolean;
  stt_key_configured?: boolean;
  tts_key_configured?: boolean;
  livekit_url?: string;
};

const defaults: VoiceConfig = {
  enabled: false,
  mode: 'pipeline',
  expression_enabled: true,
  visualizer: 'wave',
  agent_name: 'chatty-voice-agent',
  llm_provider: 'google',
  llm_model: 'gemini-2.5-flash',
  stt_provider: 'google',
  stt_model: 'chirp_3',
  stt_language: 'en-US',
  tts_provider: 'google',
  tts_model: 'gemini-3.8-flash-tts',
  tts_voice: 'Kore',
  max_duration_minutes: 15,
};

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="grid gap-1.5 text-sm">
      <span className="font-medium text-neutral-900 dark:text-neutral-100">{label}</span>
      {children}
      {hint && <span className="text-xs text-neutral-500">{hint}</span>}
    </label>
  );
}

function Select({ value, onChange, children }: { value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  const options = React.Children.toArray(children).flatMap((child) => {
    if (!React.isValidElement<{ value?: string; children?: React.ReactNode }>(child)) return [];
    return [{ value: String(child.props.value ?? ''), label: String(child.props.children ?? '') }];
  });
  return <ModernSelect value={value} onChange={onChange} options={options} aria-label="Select voice setting" className="w-full" />;
}

export function VoiceAgentTab({ botId, fetchBackend }: { botId: string; fetchBackend: FetchBackend }) {
  const [config, setConfig] = useState<VoiceConfig>(defaults);
  const [draftKey, setDraftKey] = useState({ llm: '', stt: '', tts: '' });
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

  useEffect(() => { void load(); }, [load]);

  const sessionId = useMemo(() => `dashboard-voice-${botId}`, [botId]);
  const set = <K extends keyof VoiceConfig>(key: K, value: VoiceConfig[K]) => setConfig((current) => ({ ...current, [key]: value }));

  const save = async () => {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const response = await fetchBackend(`/api/bots/${botId}/voice`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...config,
          llm_api_key: draftKey.llm || undefined,
          stt_api_key: draftKey.stt || undefined,
          tts_api_key: draftKey.tts || undefined,
        }),
      });
      if (!response.ok) throw new Error(await response.text());
      const updated = await response.json();
      setConfig((current) => ({ ...current, ...updated }));
      setDraftKey({ llm: '', stt: '', tts: '' });
      setSaved(true);
    } catch (error) {
      console.error('voice config save failed', error);
      setError(error instanceof Error ? error.message : 'Could not save voice settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-sm text-neutral-500">Loading voice-agent configuration…</div>;

  return (
    <div className="mx-auto grid max-w-7xl gap-6 bg-gradient-to-b from-orange-50/40 via-transparent to-transparent p-4 pb-12 lg:grid-cols-[minmax(0,1fr)_420px] lg:p-8 dark:from-orange-950/10">
      <div className="grid gap-6">
        <section className="relative overflow-hidden rounded-3xl border border-neutral-200/80 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
          <div className="pointer-events-none absolute -right-20 -top-24 size-64 rounded-full bg-orange-300/20 blur-3xl dark:bg-orange-500/10" />
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="relative min-w-0">
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-orange-500"><AudioWaveform className="size-4" /> Voice agent</div>
              <h2 className="text-2xl font-semibold tracking-tight">A production voice experience</h2>
              <p className="mt-1 max-w-2xl text-sm text-neutral-500">Use the same Chatty tools, RAG, booking, lead capture, and multimodal context through a LiveKit session.</p>
            </div>
            <div className="relative flex items-center gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 dark:border-neutral-800 dark:bg-neutral-900">
              <div><p className="text-xs font-semibold">Voice access</p><p className="text-[10px] text-neutral-500">{config.enabled ? 'Available in widget and embed' : 'Hidden from visitors'}</p></div>
              <ModernSwitch checked={config.enabled} onChange={(value) => set('enabled', value)} aria-label="Enable voice agent" activeLabel="" inactiveLabel="" />
            </div>
          </div>
          {error && <ModernAlert variant="error" title="Could not save voice settings" className="relative mt-5">{error}</ModernAlert>}
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Field label="Agent mode" hint="Pipeline supports Google STT → LLM → TTS; realtime is reserved for a realtime model.">
              <Select value={config.mode} onChange={(value) => set('mode', value as VoiceConfig['mode'])}><option value="pipeline">Pipeline</option><option value="realtime">Realtime</option></Select>
            </Field>
            <Field label="LiveKit visualizer">
              <Select value={config.visualizer} onChange={(value) => set('visualizer', value as VoiceConfig['visualizer'])}>{['wave', 'bar', 'grid', 'radial', 'aura'].map((value) => <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}</Select>
            </Field>
            <Field label="Agent dispatch name"><input value={config.agent_name} onChange={(event) => set('agent_name', event.target.value)} className="h-10 rounded-xl border border-neutral-200 bg-white px-3 text-sm dark:border-neutral-700 dark:bg-neutral-950" /></Field>
            <Field label="Maximum call duration"><input type="number" min={1} max={60} value={config.max_duration_minutes} onChange={(event) => set('max_duration_minutes', Number(event.target.value))} className="h-10 rounded-xl border border-neutral-200 bg-white px-3 text-sm dark:border-neutral-700 dark:bg-neutral-950" /></Field>
          </div>
          <div className="mt-5 flex items-center justify-between gap-4 rounded-2xl border border-orange-100 bg-orange-50/60 px-4 py-3 dark:border-orange-950/50 dark:bg-orange-950/20"><div><p className="text-sm font-semibold">Expressive speech mode</p><p className="mt-0.5 text-xs text-neutral-500">Provider/model dependent; adds more natural prosody when supported.</p></div><ModernSwitch checked={config.expression_enabled} onChange={(value) => set('expression_enabled', value)} aria-label="Enable expressive speech mode" activeLabel="" inactiveLabel="" /></div>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => void save()} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-50 dark:bg-white dark:text-neutral-900"><Save className="size-4" />{saving ? 'Saving…' : 'Save voice settings'}</button>
            {saved && <span className="inline-flex items-center gap-1 text-sm text-emerald-600"><CheckCircle2 className="size-4" /> Saved</span>}
          </div>
        </section>

        <section className="grid gap-4 rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
          <div><h3 className="font-semibold">LiveKit provider configuration</h3><p className="mt-1 text-sm text-neutral-500">Google Vertex/ADC is the default. Other official LiveKit provider plugins use the bot-scoped BYOK key saved below.</p></div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="grid gap-3 rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800"><h4 className="font-medium">LLM</h4><Select value={config.llm_provider} onChange={(value) => set('llm_provider', value)}><option value="google">Google Gemini</option><option value="openai">OpenAI</option><option value="anthropic">Anthropic</option><option value="openrouter">OpenRouter</option></Select><input value={config.llm_model} onChange={(event) => set('llm_model', event.target.value)} className="h-10 rounded-xl border border-neutral-200 px-3 text-sm dark:border-neutral-700 dark:bg-neutral-950" placeholder="Model" /><input type="password" value={draftKey.llm} onChange={(event) => setDraftKey((key) => ({ ...key, llm: event.target.value }))} className="h-10 rounded-xl border border-neutral-200 px-3 text-sm dark:border-neutral-700 dark:bg-neutral-950" placeholder={config.llm_key_configured ? 'BYOK configured' : 'Optional BYOK key'} /></div>
            <div className="grid gap-3 rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800"><h4 className="font-medium">STT</h4><Select value={config.stt_provider} onChange={(value) => set('stt_provider', value)}><option value="google">Google Speech</option><option value="deepgram">Deepgram</option><option value="assemblyai">AssemblyAI</option><option value="soniox">Soniox</option><option value="openai">OpenAI</option></Select><input value={config.stt_model} onChange={(event) => set('stt_model', event.target.value)} className="h-10 rounded-xl border border-neutral-200 px-3 text-sm dark:border-neutral-700 dark:bg-neutral-950" placeholder="Model" /><input value={config.stt_language} onChange={(event) => set('stt_language', event.target.value)} className="h-10 rounded-xl border border-neutral-200 px-3 text-sm dark:border-neutral-700 dark:bg-neutral-950" placeholder="Language" /><input type="password" value={draftKey.stt} onChange={(event) => setDraftKey((key) => ({ ...key, stt: event.target.value }))} className="h-10 rounded-xl border border-neutral-200 px-3 text-sm dark:border-neutral-700 dark:bg-neutral-950" placeholder={config.stt_key_configured ? 'BYOK configured' : 'Optional BYOK key'} /></div>
            <div className="grid gap-3 rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800"><h4 className="font-medium">TTS</h4><Select value={config.tts_provider} onChange={(value) => set('tts_provider', value)}><option value="google">Google Gemini TTS</option><option value="cartesia">Cartesia</option><option value="elevenlabs">ElevenLabs</option><option value="openai">OpenAI</option><option value="fishaudio">Fish Audio</option></Select><input value={config.tts_model} onChange={(event) => set('tts_model', event.target.value)} className="h-10 rounded-xl border border-neutral-200 px-3 text-sm dark:border-neutral-700 dark:bg-neutral-950" placeholder="Model" /><input value={config.tts_voice} onChange={(event) => set('tts_voice', event.target.value)} className="h-10 rounded-xl border border-neutral-200 px-3 text-sm dark:border-neutral-700 dark:bg-neutral-950" placeholder="Voice" /><input type="password" value={draftKey.tts} onChange={(event) => setDraftKey((key) => ({ ...key, tts: event.target.value }))} className="h-10 rounded-xl border border-neutral-200 px-3 text-sm dark:border-neutral-700 dark:bg-neutral-950" placeholder={config.tts_key_configured ? 'BYOK configured' : 'Optional BYOK key'} /></div>
          </div>
          <div className="flex items-start gap-2 rounded-2xl bg-neutral-50 p-4 text-xs text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400"><KeyRound className="mt-0.5 size-4 shrink-0" />BYOK values are encrypted server-side and never returned to the browser after save.</div>
        </section>

        <section className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-950"><div className="flex items-center gap-2"><Settings2 className="size-4 text-orange-500" /><h3 className="font-semibold">Integration contract</h3></div><p className="mt-2 text-sm text-neutral-500">Use the same backend token endpoint in your website embed or SDK. Never put LiveKit API secrets in a client app.</p><pre className="mt-4 overflow-x-auto rounded-2xl bg-neutral-950 p-4 text-xs text-neutral-100">{`POST /api/widget/voice/token\n{ "bot_id": "${botId}", "session_id": "visitor-session-id" }\n\nResponse: { serverUrl, participantToken, roomName }`}</pre><a href="https://docs.livekit.io/frontends/build/agents/" target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-orange-600 hover:underline">Read LiveKit agent UI docs <ExternalLink className="size-3.5" /></a></section>
      </div>

      <aside className="min-h-[560px] lg:sticky lg:top-4 lg:h-[calc(100vh-140px)]"><VoiceAgentPanel botId={botId} sessionId={sessionId} visualizer={config.visualizer} className="h-full" /></aside>
    </div>
  );
}
