'use client';

import '@livekit/components-styles';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
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
import { AlertCircle, Check, ChevronDown, Maximize2, MessageCircle, Mic, Phone, PhoneOff, ShieldCheck, X } from 'lucide-react';
import { AgentChatTranscript } from '@/components/agents-ui/agent-chat-transcript';
import { LiveKitAgentVisualizer } from '@/components/agents-ui/livekit-agent-visualizer';

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

function createVoiceRoomNonce() {
  return globalThis.crypto?.randomUUID?.() ?? `voice-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

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

function VoiceOrb({ state, audioTrack, visualizer }: { state: ReturnType<typeof useAgent>['state']; audioTrack: ReturnType<typeof useVoiceAssistant>['audioTrack']; visualizer: VoiceAgentPanelProps['visualizer'] }) {
  const speaking = state === 'speaking';
  const listening = state === 'listening';
  const label = speaking ? 'Speaking…' : listening ? 'Listening…' : 'Ready when you are';
  const colors = { aura: '#1FD5F9', wave: '#FA954C', radial: '#04A43A', grid: '#C04CFA', bar: '#4CA3FA' } as const;

  return (
    <div className="flex flex-col items-center" aria-live="polite">
      <div className={`chatty-livekit-visualizer relative flex size-[min(68vw,20rem)] max-w-[320px] items-center justify-center ${speaking ? 'is-speaking' : ''} ${listening ? 'is-listening' : ''}`}>
        <LiveKitAgentVisualizer visualizer={visualizer ?? 'wave'} state={state ?? 'disconnected'} audioTrack={audioTrack} color={colors[visualizer ?? 'wave']} className="h-full w-full" />
        {!speaking && !listening && <div className="absolute inset-0 flex items-center justify-center"><div className="flex size-14 items-center justify-center rounded-full bg-white/90 shadow-lg"><Phone className="size-6 text-neutral-950" aria-hidden="true" /></div></div>}
      </div>
      <p className="mt-6 text-center text-sm font-medium text-neutral-500 dark:text-neutral-400">{label}</p>
      <p className="mt-1 text-center text-xs text-neutral-400 dark:text-neutral-500">{speaking ? 'You can interrupt at any time' : listening ? 'Ask anything about this business' : 'Your microphone is off'}</p>
    </div>
  );
}

function ConnectedVoiceAgent({ compact = false, visualizer = 'wave', onClose, onFullscreen }: { compact?: boolean; visualizer?: VoiceAgentPanelProps['visualizer']; onClose?: () => void; onFullscreen?: () => void }) {
  const session = useSessionContext();
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const startingRef = useRef(false);
  const connectedRef = useRef(false);
  const { state } = useAgent();
  const { audioTrack } = useVoiceAssistant();
  const [started, setStarted] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [consentOpen, setConsentOpen] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);

  useEffect(() => {
    if (!started) return;
    let active = true;
    const activeSession = sessionRef.current;
    startingRef.current = true;
    connectedRef.current = false;
    setStarting(true);
    // Keep the signaling/agent handshake independent from microphone
    // publication.  Some browsers publish a pre-connect track while the
    // signal socket is still settling; if that socket closes, LiveKit rejects
    // the whole session with "Got disconnected without signal connected".
    // Connecting first also gives the official LiveKit control bar a stable
    // room before it owns microphone state.
    void activeSession.start({ tracks: { microphone: { enabled: false } } })
      .then(() => {
        if (!active) return;
        connectedRef.current = true;
        return activeSession.room.localParticipant.setMicrophoneEnabled(true);
      })
      .catch((cause) => {
        console.error('LiveKit voice session failed to start', cause);
        if (active) {
          setError(cause instanceof Error ? cause.message : 'Unable to connect to the voice agent.');
          setStarted(false);
        }
      })
      .finally(() => {
        startingRef.current = false;
        if (active) setStarting(false);
      });
    return () => {
      active = false;
      startingRef.current = false;
      connectedRef.current = false;
      void activeSession.end();
    };
  }, [started]);

  useEffect(() => {
    if (session.connectionState === 'disconnected' && started && connectedRef.current && !startingRef.current) {
      connectedRef.current = false;
      setStarted(false);
    }
  }, [session.connectionState, started]);

  const connectionLabel = starting ? 'Connecting' : started ? (state === 'speaking' ? 'Speaking' : state === 'listening' ? 'Listening' : 'Connected') : 'Ready to talk';
  const endSession = async () => {
    setStarted(false);
    await session.end();
  };
  const requestStart = () => {
    setError(null);
    setConsentOpen(true);
  };
  const acceptConsent = () => {
    setConsentOpen(false);
    setStarted(true);
  };

  return (
    <div className={`chatty-voice-panel relative flex min-h-0 flex-col overflow-hidden bg-white text-neutral-950 dark:bg-neutral-950 dark:text-white ${compact ? 'gap-2' : 'gap-4'}`} data-visualizer={visualizer}>
      <header className="flex items-center justify-between gap-3 px-4 pb-1 pt-4 sm:px-6 sm:pt-6">
        <div className="flex min-w-0 items-center gap-2">
          {started && <div className="flex size-9 items-center justify-center rounded-full bg-neutral-100 text-neutral-800 dark:bg-neutral-900 dark:text-neutral-200"><MessageCircle className="size-4" aria-hidden="true" /></div>}
          <button type="button" className="flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-600 shadow-sm transition hover:border-neutral-300 hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300" aria-label="Voice language: English">
            <span className="text-sm" aria-hidden="true">🇺🇸</span><span>English</span><ChevronDown className="size-3.5" />
          </button>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="hidden items-center gap-1 rounded-full px-2 text-[10px] font-medium text-emerald-600 sm:inline-flex dark:text-emerald-400"><ShieldCheck className="size-3" /> Secure</span>
          <button type="button" onClick={onFullscreen} className="flex size-9 items-center justify-center rounded-full bg-neutral-100 text-neutral-700 transition hover:bg-neutral-200 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800" aria-label="Expand voice agent"><Maximize2 className="size-4" /></button>
          {onClose && <button type="button" onClick={onClose} className="flex size-9 items-center justify-center rounded-full bg-neutral-100 text-neutral-500 transition hover:bg-neutral-200 hover:text-neutral-900 dark:bg-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-white" aria-label="Close voice agent"><X className="size-4" /></button>}
        </div>
      </header>

      <div className="chatty-voice-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-4 sm:px-6 sm:pb-6">
        {error && (
          <div role="alert" className="mt-3 flex items-start gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs text-rose-800 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-200">
            <AlertCircle className="mt-0.5 size-4 shrink-0" /><div className="min-w-0 flex-1"><p className="font-semibold">Voice connection failed</p><p className="mt-0.5 break-words opacity-85">{error}</p></div><button type="button" onClick={() => setError(null)} className="rounded p-1 opacity-70 hover:opacity-100" aria-label="Dismiss voice error"><X className="size-3.5" /></button>
          </div>
        )}

        <div className="flex min-h-[300px] flex-1 flex-col items-center justify-center py-8 sm:min-h-[360px]">
          <VoiceOrb state={state} audioTrack={audioTrack} visualizer={visualizer} />
          {!started && <p className="mt-7 max-w-[260px] text-center text-sm leading-5 text-neutral-500 dark:text-neutral-400">Discover answers, book meetings, and get help from your Chatty assistant.</p>}
        </div>

        {showTranscript && <div className="mb-3 flex min-h-0 max-h-48 flex-col gap-2"><div className="flex items-center justify-between px-1 text-[11px] font-semibold text-neutral-700 dark:text-neutral-200"><span>Live transcript</span><span className="text-[10px] font-normal text-neutral-400">LiveKit Agents UI</span></div><LiveKitTranscript /></div>}

        <div className="mx-auto flex w-full max-w-[360px] flex-col gap-3">
          {started ? <div className="chatty-livekit-controls flex items-center justify-center gap-2"><VoiceAssistantControlBar controls={{ microphone: true, leave: false }} /><button type="button" onClick={() => void endSession()} className="flex size-10 items-center justify-center rounded-full bg-neutral-950 text-white shadow-lg transition hover:bg-neutral-800 dark:bg-white dark:text-neutral-950" aria-label="End voice session"><PhoneOff className="size-4" /></button></div> : <button type="button" className="mx-auto flex size-14 items-center justify-center rounded-full bg-neutral-950 text-white shadow-xl shadow-neutral-950/20 transition hover:scale-105 hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:ring-offset-4 disabled:cursor-wait disabled:opacity-60 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200" onClick={requestStart} disabled={starting} aria-label="Start voice conversation">{starting ? <span className="size-5 animate-spin rounded-full border-2 border-white/40 border-t-white dark:border-neutral-950/30 dark:border-t-neutral-950" /> : <Phone className="size-5" />}</button>}
          <div className="flex items-center justify-center gap-2 text-[11px] text-neutral-400"><button type="button" onClick={() => setShowTranscript((value) => !value)} className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 transition hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-900 dark:hover:text-neutral-200"><MessageCircle className="size-3.5" />{showTranscript ? 'Hide transcript' : 'Show transcript'}</button><span aria-hidden="true">·</span><span className="inline-flex items-center gap-1.5"><Mic className="size-3.5" />{connectionLabel}</span></div>
          {!started && <p className="flex items-center justify-center gap-1 text-[10px] text-neutral-400"><Check className="size-3 text-emerald-500" />Interrupt anytime — the agent will stop speaking</p>}
        </div>
      </div>
      <RoomAudioRenderer />

      {consentOpen && <div className="absolute inset-0 z-20 flex items-end bg-white/70 p-3 backdrop-blur-sm dark:bg-neutral-950/75 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby="voice-consent-title"><div className="w-full rounded-[24px] border border-neutral-200 bg-white p-5 shadow-2xl dark:border-neutral-800 dark:bg-neutral-900"><div className="mb-4 flex items-start justify-between gap-3"><div><div className="mb-2 flex size-10 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800"><ShieldCheck className="size-5" /></div><h2 id="voice-consent-title" className="text-base font-semibold">Before we start</h2><p className="mt-1 text-sm leading-5 text-neutral-500 dark:text-neutral-400">Chatty needs microphone access to have a real-time voice conversation with you.</p></div><button type="button" onClick={() => setConsentOpen(false)} className="rounded-full p-2 text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800" aria-label="Cancel voice start"><X className="size-4" /></button></div><ul className="space-y-2.5 text-xs leading-5 text-neutral-600 dark:text-neutral-300"><li className="flex gap-2"><Check className="mt-0.5 size-3.5 shrink-0 text-emerald-500" />You can mute or end the call at any time.</li><li className="flex gap-2"><Check className="mt-0.5 size-3.5 shrink-0 text-emerald-500" />Your conversation may be transcribed to provide the service.</li><li className="flex gap-2"><Check className="mt-0.5 size-3.5 shrink-0 text-emerald-500" />Your microphone stays off until you agree.</li></ul><div className="mt-5 grid grid-cols-2 gap-2"><button type="button" onClick={() => setConsentOpen(false)} className="rounded-full border border-neutral-200 px-4 py-3 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800">Cancel</button><button type="button" onClick={acceptConsent} className="rounded-full bg-neutral-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200">I agree</button></div></div></div>}
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
        // TokenSource caches the first response for useSession.prepareConnection
        // and refreshes it after an unexpected disconnect.  Generate a new
        // room nonce for each actual token request, while keeping sessionId as
        // the stable Chatty conversation key for history, tools, and usage.
        const roomNonce = createVoiceRoomNonce();
        const response = await fetch(`${backendUrl}/api/widget/voice/token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(widgetToken ? { 'x-widget-token': widgetToken } : {}),
          },
          body: JSON.stringify({ bot_id: botId, session_id: sessionId, room_nonce: roomNonce }),
          cache: 'no-store',
        });
        if (!response.ok) throw new Error((await response.text()) || `Voice token failed (${response.status})`);
        const data = (await response.json()) as VoiceTokenResponse;
        return { serverUrl: data.serverUrl, participantToken: data.participantToken };
      }),
    [backendUrl, botId, sessionId, widgetToken],
  );
  const session = useSession(tokenSource);
  const panelRef = useRef<HTMLElement>(null);
  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void panelRef.current?.requestFullscreen();
  };

  return (
    <section ref={panelRef} className={`flex min-h-0 flex-col overflow-hidden rounded-[28px] border border-neutral-200 bg-white shadow-[0_20px_70px_-30px_rgba(0,0,0,0.35)] dark:border-neutral-800 dark:bg-neutral-950 ${className}`}>
      <SessionProvider session={session}>
        <ConnectedVoiceAgent compact={compact} visualizer={visualizer} onClose={onClose} onFullscreen={toggleFullscreen} />
      </SessionProvider>
      <VoiceAgentPanelStyles />
    </section>
  );
}

export function VoiceAgentLoading() {
  return <span className="size-4 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-900" aria-label="Loading voice agent" />;
}

// Keep LiveKit's official control bar behavior while matching Chatty's compact voice surface.
// The classes are scoped to this panel so the dashboard's other LiveKit surfaces are unchanged.
export function VoiceAgentPanelStyles() {
  return <style jsx global>{`\n    .chatty-voice-panel .chatty-livekit-controls .lk-agent-control-bar { display: flex; padding: 0; gap: .5rem; background: transparent; border: 0; }\n    .chatty-voice-panel .chatty-livekit-controls .lk-button { width: 2.5rem; height: 2.5rem; border-radius: 9999px; border: 1px solid rgb(229 229 229); background: rgb(250 250 250); color: rgb(38 38 38); box-shadow: none; }\n    .chatty-voice-panel .chatty-livekit-controls .lk-button:hover { background: rgb(245 245 245); }\n    .dark .chatty-voice-panel .chatty-livekit-controls .lk-button { border-color: rgb(64 64 64); background: rgb(38 38 38); color: white; }\n    .chatty-voice-panel:fullscreen { border-radius: 0; min-height: 100dvh; }\n    .chatty-voice-orb { position: relative; width: min(46vw, 13rem); height: min(46vw, 13rem); min-width: 9.5rem; min-height: 9.5rem; transform: scale(var(--voice-scale)); transition: transform 160ms ease-out; }\n    .chatty-voice-orb__halo { position: absolute; inset: -1rem; border-radius: 9999px; background: conic-gradient(from 210deg, rgba(255, 174, 82, .55), rgba(55, 190, 255, .5), rgba(255, 235, 114, .55), rgba(255, 174, 82, .55)); filter: blur(1.25rem); opacity: .68; animation: chatty-voice-breathe 4s ease-in-out infinite; }\n    .chatty-voice-orb__surface { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; overflow: hidden; border-radius: 9999px; background: radial-gradient(circle at 28% 24%, #fff9a8 0, #a9debd 27%, #77c9ec 58%, #2798db 100%); box-shadow: inset -1.25rem -1.25rem 2.75rem rgba(8, 101, 163, .32), inset 1rem 1rem 2rem rgba(255,255,255,.5), 0 1rem 3rem rgba(32, 155, 220, .18); }\n    .chatty-voice-orb__glow { position: absolute; inset: -20%; background: conic-gradient(from 30deg, transparent 0 18%, rgba(255,255,255,.45) 25%, transparent 38% 63%, rgba(255, 228, 108, .5) 74%, transparent 86%); filter: blur(.65rem); animation: chatty-voice-orb-spin 8s linear infinite; }\n    .chatty-voice-orb__bars { position: absolute; inset: 25%; display: flex; align-items: center; justify-content: center; gap: .18rem; opacity: .75; }\n    .chatty-voice-orb__bars span { width: .22rem; min-height: .35rem; border-radius: 9999px; background: rgba(255,255,255,.82); transition: height 100ms ease-out; }\n    .chatty-voice-orb.is-speaking .chatty-voice-orb__halo { animation-duration: 1.45s; opacity: .95; }\n    .chatty-voice-orb.is-listening .chatty-voice-orb__surface { box-shadow: inset -1.25rem -1.25rem 2.75rem rgba(8, 101, 163, .32), inset 1rem 1rem 2rem rgba(255,255,255,.5), 0 0 0 .5rem rgba(72, 184, 229, .08), 0 1rem 3rem rgba(32, 155, 220, .18); }\n    @keyframes chatty-voice-breathe { 0%, 100% { transform: scale(.95); } 50% { transform: scale(1.06); } }\n    @keyframes chatty-voice-orb-spin { to { transform: rotate(360deg); } }\n    @media (prefers-reduced-motion: reduce) { .chatty-voice-orb, .chatty-voice-orb__halo, .chatty-voice-orb__glow { animation: none; transition: none; } }\n  `}</style>;
}
