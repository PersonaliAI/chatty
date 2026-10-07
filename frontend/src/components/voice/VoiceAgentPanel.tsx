'use client';

import '@livekit/components-styles';

import { useEffect, useMemo, useState } from 'react';
import {
  BarVisualizer,
  RoomAudioRenderer,
  SessionProvider,
  useAgent,
  useSession,
  useSessionContext,
  useSessionMessages,
  useVoiceAssistant,
  VoiceAssistantControlBar,
} from '@livekit/components-react';
import { TokenSource, type TokenSourceResponseObject } from 'livekit-client';
import { AlertCircle, AudioWaveform, Check, Headphones, Loader2, Mic, Phone, PhoneOff, Settings2, ShieldCheck, X } from 'lucide-react';
import { AgentChatTranscript } from '@/components/agents-ui/agent-chat-transcript';

type VoiceAgentPanelProps = {
  botId: string;
  sessionId: string;
  backendUrl?: string;
  widgetToken?: string;
  compact?: boolean;
  visualizer?: 'wave' | 'bar' | 'grid' | 'radial' | 'aura';
  onClose?: () => void;
  className?: string;
};

type VoiceTokenResponse = {
  serverUrl: string;
  participantToken: string;
  roomName: string;
  participantName: string;
};

const defaultBackendUrl = 'https://api.chatty.personaliai.com';

function LiveKitTranscript() {
  const session = useSessionContext();
  const { messages } = useSessionMessages(session);
  const { state } = useAgent();

  return messages.length === 0 ? (
    <div className="flex min-h-0 flex-1 items-center justify-center rounded-2xl border border-neutral-200 bg-white/80 p-4 text-center text-sm text-neutral-500 dark:border-neutral-800 dark:bg-neutral-950/60" aria-live="polite">
      Start the voice agent to see real-time transcription here.
    </div>
  ) : (
    <AgentChatTranscript
      messages={messages}
      agentState={state}
      aria-live="polite"
      aria-label="Live voice transcript"
      className="min-h-0 flex-1 rounded-2xl border border-neutral-200 bg-white/80 p-4 dark:border-neutral-800 dark:bg-neutral-950/60"
    />
  );
}

function ConnectedVoiceAgent({ compact = false, visualizer = 'wave', onClose }: { compact?: boolean; visualizer?: VoiceAgentPanelProps['visualizer']; onClose?: () => void }) {
  const session = useSessionContext();
  const { state } = useAgent();
  const { audioTrack } = useVoiceAssistant();
  const [started, setStarted] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!started) return;
    let active = true;
    setStarting(true);
    void session.start().catch((cause) => {
      console.error('LiveKit voice session failed to start', cause);
      if (active) {
        setError(cause instanceof Error ? cause.message : 'Unable to connect to the voice agent.');
        setStarted(false);
      }
    }).finally(() => {
      if (active) setStarting(false);
    });
    return () => {
      active = false;
      void session.end();
    };
  }, [session, started]);

  useEffect(() => {
    if (session.connectionState === 'disconnected' && started) setStarted(false);
  }, [session.connectionState, started]);

  const connectionLabel = starting ? 'Connecting' : started ? (state === 'speaking' ? 'Agent speaking' : state === 'listening' ? 'Listening' : 'Connected') : 'Ready to talk';
  const endSession = async () => {
    setStarted(false);
    await session.end();
  };

  return (
    <div className={`flex min-h-0 flex-col overflow-hidden ${compact ? 'gap-2' : 'gap-4'}`}>
      <header className="flex items-start justify-between gap-3 border-b border-neutral-200/80 bg-white/85 px-4 py-3 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/85">
        <div className="flex min-w-0 items-center gap-3">
          <div className="relative flex size-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-amber-400 text-white shadow-lg shadow-orange-500/20">
            <AudioWaveform className="size-5" aria-hidden="true" />
            {started && <span className="absolute -right-1 -top-1 size-3 rounded-full border-2 border-white bg-emerald-500 dark:border-neutral-950" />}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-sm font-semibold text-neutral-950 dark:text-white">Chatty Voice</h3>
              <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-medium capitalize text-neutral-600 dark:bg-neutral-900 dark:text-neutral-300">{connectionLabel}</span>
            </div>
            <p className="mt-0.5 truncate text-[11px] text-neutral-500">LiveKit realtime audio and transcription</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <span className="hidden items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-medium text-emerald-700 sm:inline-flex dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"><ShieldCheck className="size-3" /> Secure</span>
          {onClose && <button type="button" onClick={onClose} className="rounded-lg p-2 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-800 dark:hover:bg-neutral-900 dark:hover:text-white" aria-label="Close voice agent"><X className="size-4" /></button>}
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-3 px-3 pb-3 sm:px-4 sm:pb-4">
        {error && (
          <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs text-rose-800 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-200">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <div className="min-w-0 flex-1"><p className="font-semibold">Voice connection failed</p><p className="mt-0.5 break-words opacity-85">{error}</p></div>
            <button type="button" onClick={() => setError(null)} className="rounded p-1 opacity-70 hover:opacity-100" aria-label="Dismiss voice error"><X className="size-3.5" /></button>
          </div>
        )}

        <div className="relative overflow-hidden rounded-2xl border border-orange-200/70 bg-gradient-to-br from-orange-50 via-white to-amber-50 p-3 shadow-sm dark:border-orange-900/50 dark:from-orange-950/30 dark:via-neutral-950 dark:to-amber-950/20" data-visualizer={visualizer}>
          <div className="pointer-events-none absolute -right-10 -top-16 size-40 rounded-full bg-orange-300/20 blur-3xl dark:bg-orange-500/10" />
          <div className="relative mb-1 flex items-center justify-between text-[10px] font-medium uppercase tracking-[0.14em] text-orange-700/80 dark:text-orange-300/80"><span>Audio activity</span><span className="capitalize">{visualizer ?? 'wave'} view</span></div>
          <BarVisualizer state={state} track={audioTrack} barCount={compact ? 12 : ({ wave: 28, bar: 18, grid: 22, radial: 16, aura: 12 }[visualizer ?? 'wave'])} className="h-20 w-full text-orange-500" aria-label={`${visualizer ?? 'wave'} audio visualizer`} />
          {!started && <div className="absolute inset-x-0 bottom-2 text-center text-[11px] text-neutral-500">Your microphone stays off until you start</div>}
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-2">
          <div className="flex items-center justify-between px-1"><div className="flex items-center gap-2 text-xs font-semibold text-neutral-800 dark:text-neutral-200"><span className="flex size-6 items-center justify-center rounded-lg bg-orange-100 text-orange-600 dark:bg-orange-950/50 dark:text-orange-300"><Headphones className="size-3.5" /></span>Realtime transcript</div><span className="text-[10px] text-neutral-400">LiveKit Agents UI</span></div>
          <LiveKitTranscript />
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white/90 p-2 shadow-sm dark:border-neutral-800 dark:bg-neutral-950/90">
          {started && <div className="mb-2 flex items-center justify-between gap-2 rounded-xl bg-neutral-50 px-2.5 py-2 dark:bg-neutral-900"><div className="flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-300"><Mic className="size-3.5 text-orange-500" />Microphone enabled</div><Settings2 className="size-3.5 text-neutral-400" aria-hidden="true" /></div>}
          {started && <VoiceAssistantControlBar controls={{ microphone: true, leave: false }} />}
          <button type="button" className={`mt-2 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 ${started ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/20 hover:bg-rose-700' : 'bg-neutral-950 text-white shadow-lg shadow-neutral-950/15 hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200'}`} onClick={() => { setError(null); if (started) void endSession(); else setStarted(true); }} disabled={starting}>
            {starting ? <Loader2 className="size-4 animate-spin" /> : started ? <PhoneOff className="size-4" /> : <Phone className="size-4" />}
            {starting ? 'Connecting…' : started ? 'End voice session' : 'Start voice conversation'}
          </button>
          {!started && <p className="mt-2 flex items-center justify-center gap-1 text-[10px] text-neutral-400"><Check className="size-3 text-emerald-500" />Interrupt anytime — the agent will stop speaking</p>}
        </div>
      </div>
      <RoomAudioRenderer />
    </div>
  );
}

export function VoiceAgentPanel({
  botId,
  sessionId,
  backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? defaultBackendUrl,
  widgetToken,
  compact = false,
  visualizer = 'wave',
  onClose,
  className = '',
}: VoiceAgentPanelProps) {
  const tokenSource = useMemo(
    () =>
      TokenSource.custom(async (): Promise<TokenSourceResponseObject> => {
        const response = await fetch(`${backendUrl}/api/widget/voice/token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(widgetToken ? { 'x-widget-token': widgetToken } : {}),
          },
          body: JSON.stringify({ bot_id: botId, session_id: sessionId }),
          cache: 'no-store',
        });
        if (!response.ok) throw new Error((await response.text()) || `Voice token failed (${response.status})`);
        const data = (await response.json()) as VoiceTokenResponse;
        return { serverUrl: data.serverUrl, participantToken: data.participantToken };
      }),
    [backendUrl, botId, sessionId, widgetToken],
  );
  const session = useSession(tokenSource);

  return (
    <section className={`flex min-h-0 flex-col overflow-hidden rounded-3xl border border-neutral-200 bg-neutral-50 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 ${className}`}>
      <SessionProvider session={session}>
        <ConnectedVoiceAgent compact={compact} visualizer={visualizer} onClose={onClose} />
      </SessionProvider>
    </section>
  );
}

export function VoiceAgentLoading() {
  return <Loader2 className="size-4 animate-spin" aria-label="Loading voice agent" />;
}
