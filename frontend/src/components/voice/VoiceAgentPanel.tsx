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
import { AlertCircle, CalendarPlus, Check, ChevronDown, Maximize2, MessageCircle, Mic, Phone, PhoneOff, RotateCcw, ShieldCheck, X } from 'lucide-react';
import { AgentChatTranscript } from '@/components/agents-ui/agent-chat-transcript';
import { LiveKitAgentVisualizer } from '@/components/agents-ui/livekit-agent-visualizer';
import { InlineBookingCard, type ConfirmedMeeting } from '@/components/inline-booking-card';

type VoiceAgentPanelProps = {
  botId: string;
  sessionId: string;
  backendUrl?: string;
  widgetToken?: string;
  /** Visitor credential for a credential-backed embedded widget session. */
  visitorToken?: string;
  compact?: boolean;
  /** Render as a native Chatty widget mode without a nested voice-card shell. */
  widgetMode?: boolean;
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

const configuredBackendUrl =
  typeof process !== 'undefined' ? process.env?.NEXT_PUBLIC_BACKEND_URL : undefined;
const defaultBackendUrl = configuredBackendUrl ?? 'https://api.chatty.personaliai.com';

function createVoiceRoomNonce() {
  return globalThis.crypto?.randomUUID?.() ?? `voice-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function LiveKitTranscript() {
  const session = useSessionContext();
  const { messages } = useSessionMessages(session);
  const { state } = useAgent();

  return messages.length === 0 ? (
    <div className="chatty-livekit-transcript flex h-full min-h-0 flex-1 items-center justify-center overflow-auto rounded-2xl border border-neutral-200 bg-white/80 p-4 text-center text-sm text-neutral-500 dark:border-neutral-800 dark:bg-neutral-950/60" aria-live="polite">
      Start the voice agent to see real-time transcription here.
    </div>
  ) : (
    <AgentChatTranscript
      messages={messages}
      agentState={state}
      aria-live="polite"
      aria-label="Live voice transcript"
      className="chatty-livekit-transcript h-full min-h-0 flex-1 overflow-hidden rounded-2xl border border-neutral-200 bg-white/80 p-3 text-xs dark:border-neutral-800 dark:bg-neutral-950/60 sm:p-4"
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
      <div className={`chatty-livekit-visualizer relative flex size-[min(54vw,15rem)] max-w-[240px] items-center justify-center ${speaking ? 'is-speaking' : ''} ${listening ? 'is-listening' : ''}`}>
        <LiveKitAgentVisualizer visualizer={visualizer ?? 'wave'} state={state ?? 'disconnected'} audioTrack={audioTrack} color={colors[visualizer ?? 'wave']} className="h-full w-full" />
        {!speaking && !listening && <div className="absolute inset-0 flex items-center justify-center"><div className="flex size-14 items-center justify-center rounded-full bg-white/90 shadow-lg"><Phone className="size-6 text-neutral-950" aria-hidden="true" /></div></div>}
      </div>
      <p className="mt-6 text-center text-sm font-medium text-neutral-500 dark:text-neutral-400">{label}</p>
      <p className="mt-1 text-center text-xs text-neutral-400 dark:text-neutral-500">{speaking ? 'You can interrupt at any time' : listening ? 'Ask anything about this business' : 'Your microphone is off'}</p>
    </div>
  );
}

function ConnectedVoiceAgent({ botId, sessionId, backendUrl, compact = false, widgetMode = false, visualizer = 'wave', onClose, onFullscreen }: { botId: string; sessionId: string; backendUrl: string; compact?: boolean; widgetMode?: boolean; visualizer?: VoiceAgentPanelProps['visualizer']; onClose?: () => void; onFullscreen?: () => void }) {
  const session = useSessionContext();
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const startingRef = useRef(false);
  const connectedRef = useRef(false);
  const intentionalEndRef = useRef(false);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<number | null>(null);
  const agentJoinTimerRef = useRef<number | null>(null);
  const { state } = useAgent();
  const agentStateRef = useRef(state);
  const { audioTrack } = useVoiceAssistant();
  const { messages } = useSessionMessages(session);
  const latestVisitorUtterance = [...messages]
    .reverse()
    .find((message) => message.type === 'userTranscript')?.message;
  const [started, setStarted] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [consentOpen, setConsentOpen] = useState(false);
  // The embedded widget opens directly into the compact LiveKit session view:
  // transcript and booking are first-class surfaces, while the standalone
  // experience keeps its visualizer-first landing state.
  // Match the standalone LiveKit surface: visualizer first, with transcript
  // and booking available from the compact footer controls.
  const [showTranscript, setShowTranscript] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [canRetry, setCanRetry] = useState(false);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [confirmedMeeting, setConfirmedMeeting] = useState<ConfirmedMeeting | null>(null);

  useEffect(() => {
    if (/\b(book|booking|demo|schedule|appointment|meeting|calendar|slot|reschedule)\b/i.test(latestVisitorUtterance ?? '')) {
      setBookingOpen(true);
    }
  }, [latestVisitorUtterance]);

  const clearReconnectTimer = () => {
    if (reconnectTimerRef.current !== null) {
      window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  };

  const clearAgentJoinTimer = () => {
    if (agentJoinTimerRef.current !== null) {
      window.clearTimeout(agentJoinTimerRef.current);
      agentJoinTimerRef.current = null;
    }
  };

  useEffect(() => {
    agentStateRef.current = state;
  }, [state]);

  useEffect(() => () => {
    clearReconnectTimer();
    clearAgentJoinTimer();
  }, []);

  useEffect(() => {
    if (!started) return;
    let active = true;
    const activeSession = sessionRef.current;
    startingRef.current = true;
    connectedRef.current = false;
    setStarting(true);
    // Let LiveKit own the microphone publication as part of the same start
    // transaction. Starting the room first and then calling
    // setMicrophoneEnabled() created a race with the official control bar:
    // the publication could be cancelled while the session was settling,
    // producing "Cancelled publication by calling unpublish" and leaving the
    // UI in an endless connecting state.
    void activeSession.start({
      tracks: { microphone: { enabled: true, publishOptions: { preConnectBuffer: true } } },
    })
      .then(() => {
        if (!active) return;
        connectedRef.current = true;
        reconnectAttemptRef.current = 0;
        setError(null);
        setRetrying(false);
        setCanRetry(false);
        clearAgentJoinTimer();
        agentJoinTimerRef.current = window.setTimeout(() => {
          agentJoinTimerRef.current = null;
          if (!active || intentionalEndRef.current || !connectedRef.current) return;
          const agentJoined = activeSession.room.remoteParticipants.size > 0;
          if (!agentJoined && agentStateRef.current === 'disconnected') {
            setError('Connected to LiveKit, but the voice agent did not join. Check the voice worker and try reconnecting.');
            setCanRetry(true);
          }
        }, 15000);
      })
      .catch((cause) => {
        console.error('LiveKit voice session failed to start', cause);
        if (active) {
          setError(cause instanceof Error ? cause.message : 'Unable to connect to the voice agent.');
          setStarted(false);
          setRetrying(false);
          setCanRetry(true);
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
      clearAgentJoinTimer();
      void activeSession.end();
    };
  }, [started]);

  useEffect(() => {
    if (
      session.connectionState !== 'disconnected' ||
      !started ||
      !connectedRef.current ||
      startingRef.current ||
      intentionalEndRef.current
    ) {
      return;
    }

    connectedRef.current = false;
    const attempt = reconnectAttemptRef.current + 1;
    reconnectAttemptRef.current = attempt;
    setStarted(false);
    setError('The voice connection was interrupted.');

    if (attempt <= 2) {
      setRetrying(true);
      reconnectTimerRef.current = window.setTimeout(() => {
        reconnectTimerRef.current = null;
        if (!intentionalEndRef.current) setStarted(true);
      }, attempt * 1500);
    } else {
      setRetrying(false);
      setCanRetry(true);
    }
  }, [session.connectionState, started]);

  const connectionLabel = retrying
    ? 'Reconnecting'
    : starting
      ? 'Connecting'
      : started
        ? (state === 'speaking' ? 'Speaking' : state === 'listening' ? 'Listening' : 'Connected')
        : 'Ready to talk';
  const endSession = async () => {
    intentionalEndRef.current = true;
    clearReconnectTimer();
    clearAgentJoinTimer();
    setRetrying(false);
    setCanRetry(false);
    setStarted(false);
    await session.end();
  };
  const resetSession = async () => {
    intentionalEndRef.current = true;
    clearReconnectTimer();
    clearAgentJoinTimer();
    setConsentOpen(false);
    setRetrying(false);
    setCanRetry(false);
    setStarting(false);
    setStarted(false);
    setError(null);
    setBookingOpen(false);
    setShowTranscript(false);
    reconnectAttemptRef.current = 0;
    await session.end();
  };
  const retrySession = () => {
    intentionalEndRef.current = false;
    reconnectAttemptRef.current = 0;
    clearReconnectTimer();
    setError(null);
    setCanRetry(false);
    setRetrying(true);
    setStarted(true);
  };
  const requestStart = () => {
    intentionalEndRef.current = false;
    setError(null);
    setCanRetry(false);
    setConsentOpen(true);
  };
  const acceptConsent = () => {
    intentionalEndRef.current = false;
    reconnectAttemptRef.current = 0;
    setConsentOpen(false);
    setError(null);
    setCanRetry(false);
    setStarted(true);
  };

  return (
    <div className={`chatty-voice-panel relative flex h-full min-h-0 flex-col overflow-visible bg-white text-neutral-950 dark:bg-neutral-950 dark:text-white ${compact ? 'gap-1' : 'gap-3'}`} data-visualizer={visualizer}>
      {widgetMode && <header className="flex shrink-0 items-center justify-between gap-3 border-b border-neutral-100 px-4 py-3 dark:border-neutral-800">
        <div className="flex min-w-0 items-center gap-2">
          <button type="button" onClick={onClose} className="flex size-8 shrink-0 items-center justify-center rounded-full text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-900 dark:hover:text-white" aria-label="Back to chat">
            <X className="size-4" />
          </button>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold">Voice agent</p>
            <p className="text-[10px] text-neutral-400">{connectionLabel}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => void resetSession()} className="flex size-8 items-center justify-center rounded-full text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-900 dark:hover:text-white" aria-label="Reset voice session" title="Reset voice session">
            <RotateCcw className="size-3.5" />
          </button>
          <span className="flex items-center gap-1.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
            <ShieldCheck className="size-3" /> Secure
          </span>
        </div>
      </header>}
      {!widgetMode && <header className="flex shrink-0 items-center justify-between gap-3 px-4 pb-1 pt-4 sm:px-6 sm:pt-5">
        <div className="flex min-w-0 items-center gap-2">
          {started && <div className="flex size-9 items-center justify-center rounded-full bg-neutral-100 text-neutral-800 dark:bg-neutral-900 dark:text-neutral-200"><MessageCircle className="size-4" aria-hidden="true" /></div>}
          <button type="button" className="flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-600 shadow-sm transition hover:border-neutral-300 hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300" aria-label="Voice language: English">
            <span className="text-sm" aria-hidden="true">🇺🇸</span><span>English</span><ChevronDown className="size-3.5" />
          </button>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="hidden items-center gap-1 rounded-full px-2 text-[10px] font-medium text-emerald-600 sm:inline-flex dark:text-emerald-400"><ShieldCheck className="size-3" /> Secure</span>
          <button type="button" onClick={() => void resetSession()} className="flex size-9 items-center justify-center rounded-full bg-neutral-100 text-neutral-500 transition hover:bg-neutral-200 hover:text-neutral-900 dark:bg-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-white" aria-label="Reset voice session" title="Reset voice session"><RotateCcw className="size-4" /></button>
          <button type="button" onClick={onFullscreen} className="flex size-9 items-center justify-center rounded-full bg-neutral-100 text-neutral-700 transition hover:bg-neutral-200 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800" aria-label="Expand voice agent"><Maximize2 className="size-4" /></button>
          {onClose && <button type="button" onClick={onClose} className="flex size-9 items-center justify-center rounded-full bg-neutral-100 text-neutral-500 transition hover:bg-neutral-200 hover:text-neutral-900 dark:bg-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-white" aria-label="Close voice agent"><X className="size-4" /></button>}
        </div>
      </header>}

      <div className={`chatty-voice-scrollbar flex min-h-0 flex-1 flex-col px-4 pb-4 sm:px-6 sm:pb-5 ${showTranscript ? 'overflow-hidden' : 'overflow-y-auto'}`}>
        {error && (
          <div role="alert" className="mt-3 flex items-start gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs text-rose-800 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-200">
            <AlertCircle className="mt-0.5 size-4 shrink-0" /><div className="min-w-0 flex-1"><p className="font-semibold">Voice connection interrupted</p><p className="mt-0.5 break-words opacity-85">{error}</p></div>{canRetry && <button type="button" onClick={retrySession} className="shrink-0 rounded-full border border-rose-300 px-2.5 py-1 text-[11px] font-semibold hover:bg-rose-100 dark:border-rose-800 dark:hover:bg-rose-900/50">Reconnect</button>}<button type="button" onClick={() => setError(null)} className="rounded p-1 opacity-70 hover:opacity-100" aria-label="Dismiss voice error"><X className="size-3.5" /></button>
          </div>
        )}

        {showTranscript ? (
          <div className={`chatty-transcript-layout flex min-h-0 flex-col gap-3 py-3 ${widgetMode ? 'shrink-0' : 'flex-1'}`}>
            <div className="flex shrink-0 items-center justify-between px-1 text-[11px] font-semibold text-neutral-700 dark:text-neutral-200">
              <span>Live transcript</span>
              <span className="text-[10px] font-normal text-neutral-400">LiveKit Agents UI</span>
            </div>
            <div className={`chatty-transcript-frame min-h-0 overflow-hidden ${widgetMode ? 'h-[190px] shrink-0 sm:h-[205px]' : 'flex-1'}`}>
              <LiveKitTranscript />
            </div>
          </div>
        ) : (
          <div className="flex shrink-0 flex-col items-center justify-center py-5 sm:py-7">
            <VoiceOrb state={state} audioTrack={audioTrack} visualizer={visualizer} />
            {!started && <p className="mt-4 max-w-[260px] text-center text-sm leading-5 text-neutral-500 dark:text-neutral-400">Discover answers, book meetings, and get help from your Chatty assistant.</p>}
          </div>
        )}

        {bookingOpen && <div className="mx-auto mb-3 w-full max-w-[420px] rounded-2xl border border-neutral-200 bg-white p-2 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
          <div className="flex items-start justify-between gap-2 px-2 pb-1">
            <div><p className="text-xs font-semibold">Book a meeting</p><p className="text-[10px] text-neutral-500">Choose a slot or tell the agent what works.</p></div>
            <button type="button" onClick={() => setBookingOpen(false)} className="rounded-full p-1 text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-900" aria-label="Close booking"><X className="size-3.5" /></button>
          </div>
          <div className="max-h-[300px] overflow-y-auto">
            <InlineBookingCard
              botId={botId}
              sessionId={sessionId}
              backendUrl={backendUrl}
              preferredText={latestVisitorUtterance}
              initialMeeting={confirmedMeeting ?? undefined}
              onBookingSuccess={setConfirmedMeeting}
            />
          </div>
        </div>}

        <div className="mx-auto flex w-full shrink-0 max-w-[360px] flex-col gap-2.5">
          {started ? <div className="chatty-livekit-controls flex items-center justify-center gap-2"><VoiceAssistantControlBar controls={{ microphone: true, leave: false }} /><button type="button" onClick={() => void endSession()} className="flex size-10 items-center justify-center rounded-full bg-neutral-950 text-white shadow-lg transition hover:bg-neutral-800 dark:bg-white dark:text-neutral-950" aria-label="End voice session"><PhoneOff className="size-4" /></button></div> : <button type="button" className="mx-auto flex size-14 items-center justify-center rounded-full bg-neutral-950 text-white shadow-xl shadow-neutral-950/20 transition hover:scale-105 hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:ring-offset-4 disabled:cursor-wait disabled:opacity-60 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200" onClick={requestStart} disabled={starting || retrying} aria-label="Start voice conversation">{starting || retrying ? <span className="size-5 animate-spin rounded-full border-2 border-white/40 border-t-white dark:border-neutral-950/30 dark:border-t-neutral-950" /> : <Phone className="size-5" />}</button>}
          <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] text-neutral-400"><button type="button" onClick={() => setShowTranscript((value) => !value)} className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 transition hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-900 dark:hover:text-neutral-200"><MessageCircle className="size-3.5" />{showTranscript ? 'Hide transcript' : 'Show transcript'}</button><span aria-hidden="true">·</span><button type="button" onClick={() => setBookingOpen((value) => !value)} className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 transition hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-900 dark:hover:text-neutral-200"><CalendarPlus className="size-3.5" />{bookingOpen ? 'Hide booking' : 'Book a meeting'}</button><span aria-hidden="true">·</span><span className="inline-flex items-center gap-1.5"><Mic className="size-3.5" />{connectionLabel}</span></div>
          {!started && !retrying && <p className="flex items-center justify-center gap-1 text-[10px] text-neutral-400"><Check className="size-3 text-emerald-500" />Interrupt anytime — the agent will stop speaking</p>}
        </div>
      </div>
      <RoomAudioRenderer />

      {consentOpen && <div className="absolute inset-0 z-20 flex items-end bg-white/70 p-3 backdrop-blur-sm dark:bg-neutral-950/75 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby="voice-consent-title"><div className="w-full rounded-[24px] border border-neutral-200 bg-white p-5 shadow-2xl dark:border-neutral-800 dark:bg-neutral-900"><div className="mb-4 flex items-start justify-between gap-3"><div><div className="mb-2 flex size-10 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800"><ShieldCheck className="size-5" /></div><h2 id="voice-consent-title" className="text-base font-semibold">Before we start</h2><p className="mt-1 text-sm leading-5 text-neutral-500 dark:text-neutral-400">Chatty needs microphone access to have a real-time voice conversation with you.</p></div><button type="button" onClick={() => setConsentOpen(false)} className="rounded-full p-2 text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800" aria-label="Cancel voice start"><X className="size-4" /></button></div><ul className="space-y-2.5 text-xs leading-5 text-neutral-600 dark:text-neutral-300"><li className="flex gap-2"><Check className="mt-0.5 size-3.5 shrink-0 text-emerald-500" />You can mute or end the call at any time.</li><li className="flex gap-2"><Check className="mt-0.5 size-3.5 shrink-0 text-emerald-500" />Your conversation may be transcribed to provide the service.</li><li className="flex gap-2"><Check className="mt-0.5 size-3.5 shrink-0 text-emerald-500" />Your microphone stays off until you agree.</li></ul><div className="mt-5 grid grid-cols-2 gap-2"><button type="button" onClick={() => setConsentOpen(false)} className="rounded-full border border-neutral-200 px-4 py-3 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800">Cancel</button><button type="button" onClick={acceptConsent} className="rounded-full bg-neutral-950 px-4 py-3 text-sm font-semibold text-white dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200">I agree</button></div></div></div>}
    </div>
  );
}

export function VoiceAgentPanel({
  botId,
  sessionId,
  backendUrl = defaultBackendUrl,
  widgetToken,
  visitorToken,
  compact = false,
  widgetMode = false,
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
            ...(visitorToken ? { 'x-chatty-visitor': visitorToken } : {}),
          },
          body: JSON.stringify({
            bot_id: botId,
            session_id: sessionId,
            room_nonce: roomNonce,
            visitor_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          }),
          cache: 'no-store',
        });
        if (!response.ok) throw new Error((await response.text()) || `Voice token failed (${response.status})`);
        const data = (await response.json()) as VoiceTokenResponse;
        return { serverUrl: data.serverUrl, participantToken: data.participantToken };
      }),
    [backendUrl, botId, sessionId, visitorToken, widgetToken],
  );
  const session = useSession(tokenSource);
  const panelRef = useRef<HTMLElement>(null);
  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void panelRef.current?.requestFullscreen();
  };

  return (
    <section ref={panelRef} className={`flex h-full min-h-0 min-w-0 w-full max-w-full flex-1 flex-col overflow-visible bg-white dark:bg-neutral-950 ${widgetMode ? 'rounded-none border-0 shadow-none' : 'rounded-[28px] border border-neutral-200 shadow-[0_20px_70px_-30px_rgba(0,0,0,0.35)] dark:border-neutral-800'} ${className}`}>
      <SessionProvider session={session}>
        <ConnectedVoiceAgent botId={botId} sessionId={sessionId} backendUrl={backendUrl} compact={compact} widgetMode={widgetMode} visualizer={visualizer} onClose={onClose} onFullscreen={toggleFullscreen} />
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
  return <style jsx global>{`\n    .chatty-voice-panel .chatty-livekit-controls .lk-agent-control-bar { display: flex; flex-wrap: wrap; padding: 0; gap: .5rem; background: transparent; border: 0; }\n    .chatty-voice-panel .chatty-livekit-controls .lk-button { width: 2.5rem; height: 2.5rem; border-radius: 9999px; border: 1px solid rgb(229 229 229); background: rgb(250 250 250); color: rgb(38 38 38); box-shadow: none; }\n    .chatty-voice-panel .chatty-livekit-controls .lk-button:hover { background: rgb(245 245 245); }\n    .dark .chatty-voice-panel .chatty-livekit-controls .lk-button { border-color: rgb(64 64 64); background: rgb(38 38 38); color: white; }\n    .chatty-voice-panel .lk-device-menu { z-index: 100; max-width: min(21rem, calc(100vw - 2rem)); max-height: min(18rem, calc(100dvh - 8rem)); overflow-x: hidden; overflow-y: auto; white-space: normal; }\n    .chatty-voice-panel .lk-device-menu .lk-media-device-select { min-width: 0; }\n    .chatty-voice-panel .lk-device-menu .lk-button { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }\n    .chatty-voice-panel:fullscreen { border-radius: 0; min-height: 100dvh; }\n    .chatty-voice-orb { position: relative; width: min(46vw, 13rem); height: min(46vw, 13rem); min-width: 9.5rem; min-height: 9.5rem; transform: scale(var(--voice-scale)); transition: transform 160ms ease-out; }\n    .chatty-voice-orb__halo { position: absolute; inset: -1rem; border-radius: 9999px; background: conic-gradient(from 210deg, rgba(255, 174, 82, .55), rgba(55, 190, 255, .5), rgba(255, 235, 114, .55), rgba(255, 174, 82, .55)); filter: blur(1.25rem); opacity: .68; animation: chatty-voice-breathe 4s ease-in-out infinite; }\n    .chatty-voice-orb__surface { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; overflow: hidden; border-radius: 9999px; background: radial-gradient(circle at 28% 24%, #fff9a8 0, #a9debd 27%, #77c9ec 58%, #2798db 100%); box-shadow: inset -1.25rem -1.25rem 2.75rem rgba(8, 101, 163, .32), inset 1rem 1rem 2rem rgba(255,255,255,.5), 0 1rem 3rem rgba(32, 155, 220, .18); }\n    .chatty-voice-orb__glow { position: absolute; inset: -20%; background: conic-gradient(from 30deg, transparent 0 18%, rgba(255,255,255,.45) 25%, transparent 38% 63%, rgba(255, 228, 108, .5) 74%, transparent 86%); filter: blur(.65rem); animation: chatty-voice-orb-spin 8s linear infinite; }\n    .chatty-voice-orb__bars { position: absolute; inset: 25%; display: flex; align-items: center; justify-content: center; gap: .18rem; opacity: .75; }\n    .chatty-voice-orb__bars span { width: .22rem; min-height: .35rem; border-radius: 9999px; background: rgba(255,255,255,.82); transition: height 100ms ease-out; }\n    .chatty-voice-orb.is-speaking .chatty-voice-orb__halo { animation-duration: 1.45s; opacity: .95; }\n    .chatty-voice-orb.is-listening .chatty-voice-orb__surface { box-shadow: inset -1.25rem -1.25rem 2.75rem rgba(8, 101, 163, .32), inset 1rem 1rem 2rem rgba(255,255,255,.5), 0 0 0 .5rem rgba(72, 184, 229, .08), 0 1rem 3rem rgba(32, 155, 220, .18); }\n    @keyframes chatty-voice-breathe { 0%, 100% { transform: scale(.95); } 50% { transform: scale(1.06); } }\n    @keyframes chatty-voice-orb-spin { to { transform: rotate(360deg); } }\n    @media (prefers-reduced-motion: reduce) { .chatty-voice-orb, .chatty-voice-orb__halo, .chatty-voice-orb__glow { animation: none; transition: none; } }\n  `}</style>;
}
