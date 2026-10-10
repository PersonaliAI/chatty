'use client';

import '@livekit/components-styles';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  RoomAudioRenderer,
  SessionProvider,
  useAgent,
  useAudioWaveform,
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

function VoiceOrb({ state, audioTrack, visualizer, widgetMode }: { state: ReturnType<typeof useAgent>['state']; audioTrack: ReturnType<typeof useVoiceAssistant>['audioTrack']; visualizer: VoiceAgentPanelProps['visualizer']; widgetMode?: boolean }) {
  const speaking = state === 'speaking';
  const listening = state === 'listening';
  const label = speaking ? 'Speaking…' : listening ? 'Listening…' : 'Ready when you are';
  if (!widgetMode) {
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
  const { bars } = useAudioWaveform(audioTrack, { barCount: 16, updateInterval: 90, volMultiplier: 1.35 });
  const count = visualizer === 'bar' ? 8 : visualizer === 'grid' ? 12 : 16;

  return (
    <div className="chatty-voice-stage" aria-live="polite">
      <div className={`chatty-voice-waveform is-${visualizer ?? 'wave'} ${speaking ? 'is-speaking' : ''} ${listening ? 'is-listening' : ''}`} aria-hidden="true">
        {bars.slice(0, count).map((bar, index) => <i key={index} style={{ height: `${Math.max(4, (speaking || listening ? bar : 0.12) * 42)}px` }} />)}
      </div>
      <strong>{label === 'Ready when you are' ? 'Ready to talk' : label}</strong>
      <span>{speaking ? 'You can interrupt at any time' : listening ? 'Listening for your question' : 'Microphone is off'}</span>
      <p>Say hello to start.</p>
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
    <div className={`chatty-voice-panel ${widgetMode ? 'chatty-voice-panel-widget' : 'chatty-voice-panel-standalone'} ${compact ? 'is-compact' : ''}`} data-visualizer={visualizer}>
      {widgetMode && <header className="chatty-voice-header">
        <div className="chatty-voice-header-main">
          <button type="button" onClick={onClose} className="chatty-voice-header-button" aria-label="Back to chat">
            <X className="size-4" />
          </button>
          <div>
            <p>Voice agent</p>
            <span>{connectionLabel}</span>
          </div>
        </div>
        <div className="chatty-voice-header-actions">
          <button type="button" onClick={() => void resetSession()} className="chatty-voice-header-button" aria-label="Reset voice session" title="Reset voice session">
            <RotateCcw className="size-3.5" />
          </button>
          <span className="chatty-voice-secure">
            <ShieldCheck className="size-3" /> Secure
          </span>
        </div>
      </header>}
      {!widgetMode && <header className="chatty-voice-header chatty-voice-header-standalone">
        <div className="chatty-voice-header-main">
          {started && <div className="chatty-voice-state-icon"><MessageCircle className="size-4" aria-hidden="true" /></div>}
          <button type="button" className="chatty-voice-language" aria-label="Voice language: English">
            <span className="text-sm" aria-hidden="true">🇺🇸</span><span>English</span><ChevronDown className="size-3.5" />
          </button>
        </div>
        <div className="chatty-voice-header-actions">
          <span className="chatty-voice-secure"><ShieldCheck className="size-3" /> Secure</span>
          <button type="button" onClick={() => void resetSession()} className="chatty-voice-header-button" aria-label="Reset voice session" title="Reset voice session"><RotateCcw className="size-4" /></button>
          <button type="button" onClick={onFullscreen} className="chatty-voice-header-button" aria-label="Expand voice agent"><Maximize2 className="size-4" /></button>
          {onClose && <button type="button" onClick={onClose} className="chatty-voice-header-button" aria-label="Close voice agent"><X className="size-4" /></button>}
        </div>
      </header>}

      <div className={`chatty-voice-content ${showTranscript ? 'is-transcript' : ''}`}>
        {error && (
          <div role="alert" className="chatty-voice-error">
            <AlertCircle /><div><strong>Voice connection interrupted</strong><span>{error}</span></div>{canRetry && <button type="button" onClick={retrySession}>Reconnect</button>}<button type="button" onClick={() => setError(null)} aria-label="Dismiss voice error"><X /></button>
          </div>
        )}

        {showTranscript ? (
          <div className="chatty-transcript-layout">
            <div className="chatty-voice-section-heading">
              <strong>Live transcript</strong>
              <span>Live</span>
            </div>
            <div className="chatty-transcript-frame">
              <LiveKitTranscript />
            </div>
          </div>
        ) : (
          <div className="chatty-voice-stage-wrap">
            <VoiceOrb state={state} audioTrack={audioTrack} visualizer={visualizer} widgetMode={widgetMode} />
            {!widgetMode && <p className="chatty-voice-standalone-description">Discover answers, book meetings, and get help from your Chatty assistant.</p>}
          </div>
        )}

        {bookingOpen && <div className="chatty-voice-booking">
          <div className="chatty-voice-booking-heading">
            <div><strong>Book a meeting</strong><span>Choose a slot or tell the agent what works.</span></div>
            <button type="button" onClick={() => setBookingOpen(false)} aria-label="Close booking"><X /></button>
          </div>
          <div className="chatty-voice-booking-body">
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

        <div className="chatty-voice-controls">
          {started ? <div className="chatty-livekit-controls"><VoiceAssistantControlBar controls={{ microphone: true, leave: false }} /><button type="button" onClick={() => void endSession()} className="chatty-voice-end" aria-label="End voice session"><PhoneOff className="size-4" /></button></div> : <button type="button" className="chatty-voice-start" onClick={requestStart} disabled={starting || retrying} aria-label="Start voice conversation">{starting || retrying ? <span className="chatty-voice-spinner" /> : <Phone className="size-5" />}</button>}
          <div className="chatty-voice-footer-actions"><button type="button" onClick={() => setShowTranscript((value) => !value)}><MessageCircle />{showTranscript ? 'Hide transcript' : 'Show transcript'}</button><span aria-hidden="true">·</span><button type="button" onClick={() => setBookingOpen((value) => !value)}><CalendarPlus />{bookingOpen ? 'Hide booking' : 'Book a meeting'}</button><span aria-hidden="true">·</span><span className="chatty-voice-mic-status"><Mic />{connectionLabel}</span></div>
          {!started && !retrying && <p className="chatty-voice-interrupt"><Check />Interrupt anytime — the agent will stop speaking</p>}
        </div>
      </div>
      <RoomAudioRenderer />

      {consentOpen && <div className="chatty-voice-consent" role="dialog" aria-modal="true" aria-labelledby="voice-consent-title"><div><div className="chatty-voice-consent-heading"><div><ShieldCheck /><h2 id="voice-consent-title">Before we start</h2><p>Chatty needs microphone access for a real-time voice conversation.</p></div><button type="button" onClick={() => setConsentOpen(false)} aria-label="Cancel voice start"><X /></button></div><ul><li><Check />You can mute or end the call at any time.</li><li><Check />Your conversation may be transcribed to provide the service.</li><li><Check />Your microphone stays off until you agree.</li></ul><div className="chatty-voice-consent-actions"><button type="button" onClick={() => setConsentOpen(false)}>Cancel</button><button type="button" onClick={acceptConsent}>I agree</button></div></div></div>}
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
  return <style jsx global>{`
    .chatty-widget-voice-host,
    .chatty-widget-voice-stage { display: flex; flex: 1 1 auto; min-width: 0; min-height: 0; width: 100%; height: 100%; flex-direction: column; overflow: hidden; }
    .chatty-sdk-voice-widget-surface { flex: 1 1 auto; min-width: 0; min-height: 0; width: 100%; height: 100%; }
    .chatty-voice-panel { --voice-ink: #1f2933; --voice-muted: #74808a; --voice-soft: #f7f8f8; --voice-border: #e4e8ea; --voice-accent: #c67139; position: relative; display: flex; flex: 1 1 auto; min-width: 0; min-height: 0; width: 100%; flex-direction: column; overflow: hidden; box-sizing: border-box; color: var(--voice-ink); background: #fff; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    .chatty-voice-panel-standalone { border: 1px solid rgb(229 229 229); border-radius: 28px; box-shadow: 0 20px 70px -30px rgba(0,0,0,.35); }
    .chatty-voice-panel-standalone .chatty-voice-header-standalone { min-height: 0; padding: 20px 24px 4px; border-bottom: 0; background: transparent; }
    .chatty-voice-panel-standalone .chatty-voice-header-main { gap: 8px; }
    .chatty-voice-panel-standalone .chatty-voice-header-main > div { display: flex; }
    .chatty-voice-panel-standalone .chatty-voice-header-button { width: 36px; height: 36px; border-radius: 9999px; background: #f5f5f5; }
    .chatty-voice-panel-standalone .chatty-voice-header-button:hover { background: #e5e5e5; }
    .chatty-voice-panel-standalone .chatty-voice-secure { display: none; }
    .chatty-voice-panel-standalone .chatty-voice-language { border-radius: 9999px; padding: 7px 12px; box-shadow: 0 1px 3px rgba(0,0,0,.12); }
    .chatty-voice-panel-standalone .chatty-voice-content { gap: 0; padding: 0 24px 20px; }
    .chatty-voice-panel-standalone .chatty-voice-stage-wrap { flex: none; min-height: 0; padding: 20px 0 0; }
    .chatty-voice-panel-standalone .chatty-voice-standalone-description { max-width: 260px; margin: 16px auto 0; color: #737373; font-size: 14px; line-height: 1.4; text-align: center; }
    .chatty-voice-panel-standalone .chatty-voice-controls { max-width: 360px; margin: 0 auto; }
    .chatty-voice-panel-standalone .chatty-voice-start { width: 56px; height: 56px; border-radius: 9999px; box-shadow: 0 12px 24px rgba(0,0,0,.15); }
    .chatty-voice-panel-standalone .chatty-voice-footer-actions { font-size: 11px; }
    .chatty-voice-panel-standalone .chatty-voice-interrupt { font-size: 10px; }
    .chatty-voice-header { display: flex; align-items: center; justify-content: space-between; flex: none; min-height: 54px; gap: 12px; padding: 10px 12px; border-bottom: 1px solid var(--voice-border); background: #fff; }
    .chatty-voice-header-main { display: flex; align-items: center; min-width: 0; gap: 9px; }
    .chatty-voice-header-main > div { display: grid; min-width: 0; gap: 2px; }
    .chatty-voice-header-main p { margin: 0; overflow: hidden; font-size: 14px; font-weight: 650; text-overflow: ellipsis; white-space: nowrap; }
    .chatty-voice-header-main span { overflow: hidden; color: var(--voice-muted); font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
    .chatty-voice-header-actions { display: flex; align-items: center; flex: none; gap: 6px; }
    .chatty-voice-header-button { display: grid; place-items: center; flex: none; width: 30px; height: 30px; border: 0; border-radius: 7px; color: #6f7a82; background: transparent; cursor: pointer; }
    .chatty-voice-header-button:hover { color: var(--voice-ink); background: var(--voice-soft); }
    .chatty-voice-secure { display: inline-flex; align-items: center; gap: 4px; color: #21845a; font-size: 10px; white-space: nowrap; }
    .chatty-voice-state-icon { display: grid !important; place-items: center; width: 30px; height: 30px; border-radius: 8px; color: var(--voice-accent); background: var(--voice-soft); }
    .chatty-voice-language { display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--voice-border); border-radius: 8px; padding: 7px 9px; color: var(--voice-ink); background: #fff; font-size: 12px; cursor: pointer; }
    .chatty-voice-error { display: flex; align-items: center; gap: 8px; flex: none; margin: 10px 12px 0; border: 1px solid #efc7c7; border-radius: 8px; padding: 8px 9px; color: #9d3838; background: #fff8f8; font-size: 11px; line-height: 1.4; }
    .chatty-voice-error > svg { width: 15px; height: 15px; flex: none; }
    .chatty-voice-error > div { display: grid; min-width: 0; flex: 1; gap: 2px; }
    .chatty-voice-error span { overflow-wrap: anywhere; }
    .chatty-voice-error button { flex: none; border: 1px solid #dfaaaa; border-radius: 6px; padding: 5px 7px; color: inherit; background: #fff; font-size: 11px; font-weight: 650; cursor: pointer; }
    .chatty-voice-error button:last-child { display: grid; place-items: center; width: 25px; height: 25px; border: 0; padding: 0; }
    .chatty-voice-error button:last-child svg { width: 15px; height: 15px; }
    .chatty-voice-content { display: flex; flex: 1 1 auto; min-height: 0; flex-direction: column; gap: 12px; overflow-y: auto; padding: 12px; scrollbar-width: thin; scrollbar-color: #cbd3d7 transparent; }
    .chatty-voice-content.is-transcript { overflow: hidden; }
    .chatty-voice-stage-wrap { display: flex; flex: 1 1 auto; min-height: 190px; flex-direction: column; }
    .chatty-voice-stage { display: flex; flex: 1 1 auto; min-height: 170px; flex-direction: column; align-items: center; justify-content: center; gap: 7px; border: 1px solid var(--voice-border); border-radius: 10px; padding: 18px 12px; background: var(--voice-soft); text-align: center; }
    .chatty-voice-stage strong { margin: 0; color: var(--voice-ink); font-size: 14px; font-weight: 650; }
    .chatty-voice-stage > span { color: var(--voice-muted); font-size: 11px; }
    .chatty-voice-stage p { margin: 3px 0 0; color: var(--voice-muted); font-size: 11px; }
    .chatty-voice-waveform { display: flex; align-items: center; justify-content: center; width: min(100%, 210px); height: 54px; gap: 4px; }
    .chatty-voice-waveform i { display: block; width: 3px; min-height: 4px; border-radius: 99px; background: #8c969d; opacity: .45; transition: height .12s ease, opacity .12s ease, background-color .12s ease; }
    .chatty-voice-waveform.is-speaking i, .chatty-voice-waveform.is-listening i { background: var(--voice-accent); opacity: .9; }
    .chatty-voice-waveform.is-bar { width: min(100%, 180px); gap: 6px; }
    .chatty-voice-waveform.is-grid { display: grid; grid-template-columns: repeat(4, 1fr); grid-template-rows: repeat(3, 1fr); width: min(100%, 132px); height: 66px; gap: 4px; }
    .chatty-voice-waveform.is-grid i { width: 100%; height: auto !important; min-height: 0; border-radius: 4px; }
    .chatty-voice-waveform.is-radial { width: 72px; height: 72px; border: 1px solid var(--voice-border); border-radius: 50%; gap: 3px; background: #fff; }
    .chatty-voice-waveform.is-radial i { width: 3px; transform-origin: center 34px; }
    .chatty-voice-waveform.is-aura { width: 120px; height: 72px; border-radius: 50%; gap: 4px; background: radial-gradient(circle, rgba(198,113,57,.18), rgba(198,113,57,.04) 58%, transparent 72%); }
    .chatty-transcript-layout { display: flex; flex: 1 1 auto; min-height: 0; flex-direction: column; gap: 8px; }
    .chatty-voice-section-heading { display: flex; align-items: center; justify-content: space-between; flex: none; padding: 0 2px; font-size: 12px; }
    .chatty-voice-section-heading span { color: var(--voice-muted); font-size: 10px; }
    .chatty-transcript-frame { display: flex; flex: 1 1 auto; min-height: 150px; overflow: hidden; }
    .chatty-livekit-transcript { width: 100%; min-height: 150px; border: 1px solid var(--voice-border) !important; border-radius: 10px !important; padding: 10px !important; color: var(--voice-muted) !important; background: #fff !important; font-size: 11px !important; }
    .chatty-voice-booking { display: grid; flex: none; gap: 8px; max-height: 260px; overflow-y: auto; border: 1px solid var(--voice-border); border-radius: 10px; padding: 9px; background: #fff; }
    .chatty-voice-booking-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
    .chatty-voice-booking-heading > div { display: grid; min-width: 0; gap: 2px; }
    .chatty-voice-booking-heading strong { font-size: 12px; font-weight: 650; }
    .chatty-voice-booking-heading span { color: var(--voice-muted); font-size: 10px; line-height: 1.4; }
    .chatty-voice-booking-heading button { display: grid; place-items: center; flex: none; width: 26px; height: 26px; border: 0; border-radius: 6px; color: #6f7a82; background: var(--voice-soft); cursor: pointer; }
    .chatty-voice-booking-heading button svg { width: 15px; height: 15px; }
    .chatty-voice-booking-body { max-height: 230px; overflow-y: auto; }
    .chatty-voice-controls { display: flex; flex: none; flex-direction: column; align-items: center; gap: 10px; }
    .chatty-voice-start, .chatty-voice-end { display: grid; place-items: center; flex: none; width: 42px; height: 42px; border: 0; border-radius: 9px; color: #fff; background: #1f2933; cursor: pointer; }
    .chatty-voice-start:hover, .chatty-voice-end:hover { background: #34414b; }
    .chatty-voice-end { background: #7b3434; }
    .chatty-livekit-controls { display: flex; align-items: center; gap: 8px; }
    .chatty-livekit-controls .lk-agent-control-bar { display: flex; flex-wrap: wrap; padding: 0; gap: .5rem; border: 0; background: transparent; }
    .chatty-livekit-controls .lk-button { width: 2.5rem; height: 2.5rem; border-radius: 8px; border: 1px solid var(--voice-border); background: #fff; color: var(--voice-ink); box-shadow: none; }
    .chatty-livekit-controls .lk-button:hover { background: var(--voice-soft); }
    .chatty-voice-spinner { width: 15px; height: 15px; border: 2px solid rgba(255,255,255,.38); border-top-color: #fff; border-radius: 50%; animation: chatty-voice-spin .8s linear infinite; }
    .chatty-voice-footer-actions { display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 7px; color: var(--voice-muted); font-size: 10px; }
    .chatty-voice-footer-actions button, .chatty-voice-mic-status { display: inline-flex; align-items: center; gap: 4px; border: 0; padding: 3px; color: inherit; background: transparent; white-space: nowrap; cursor: pointer; }
    .chatty-voice-footer-actions svg, .chatty-voice-interrupt svg { width: 14px; height: 14px; }
    .chatty-voice-footer-actions button:hover { color: var(--voice-ink); }
    .chatty-voice-interrupt { display: flex; align-items: center; justify-content: center; gap: 4px; flex: none; margin: 0; color: var(--voice-muted); font-size: 10px; text-align: center; }
    .chatty-voice-interrupt svg { color: #21845a; }
    .chatty-voice-consent { position: absolute; z-index: 5; inset: 0; display: grid; place-items: center; padding: 12px; background: rgba(255,255,255,.96); }
    .chatty-voice-consent > div { width: min(100%, 320px); border: 1px solid var(--voice-border); border-radius: 10px; padding: 14px; color: var(--voice-ink); background: #fff; box-shadow: 0 12px 30px rgba(31,41,51,.14); }
    .chatty-voice-consent-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
    .chatty-voice-consent-heading > div > svg { color: var(--voice-accent); }
    .chatty-voice-consent h2 { margin: 8px 0 5px; font-size: 14px; }
    .chatty-voice-consent p { margin: 0; color: var(--voice-muted); font-size: 11px; line-height: 1.5; }
    .chatty-voice-consent-heading > button { display: grid; place-items: center; width: 26px; height: 26px; border: 0; border-radius: 6px; color: var(--voice-muted); background: var(--voice-soft); cursor: pointer; }
    .chatty-voice-consent-heading > button svg { width: 15px; height: 15px; }
    .chatty-voice-consent ul { display: grid; gap: 7px; margin: 12px 0 0; padding: 0; color: var(--voice-muted); font-size: 11px; list-style: none; }
    .chatty-voice-consent li { display: flex; gap: 6px; }
    .chatty-voice-consent li svg { width: 14px; height: 14px; flex: none; color: #21845a; }
    .chatty-voice-consent-actions { display: flex; justify-content: flex-end; gap: 7px; margin-top: 12px; }
    .chatty-voice-consent-actions button { border: 0; border-radius: 7px; padding: 7px 9px; color: #4c5961; background: var(--voice-soft); font-size: 11px; cursor: pointer; }
    .chatty-voice-consent-actions button:last-child { color: #fff; background: #1f2933; }
    .chatty-voice-panel:fullscreen { min-height: 100dvh; border-radius: 0; }
    .chatty-voice-panel .lk-device-menu { z-index: 100; max-width: min(21rem, calc(100vw - 2rem)); max-height: min(18rem, calc(100dvh - 8rem)); overflow-x: hidden; overflow-y: auto; white-space: normal; }
    @keyframes chatty-voice-spin { to { transform: rotate(360deg); } }
    @media (max-width: 420px) { .chatty-voice-header { padding-inline: 10px; } .chatty-voice-content { gap: 10px; padding: 10px; } .chatty-voice-stage-wrap { min-height: 145px; } .chatty-voice-stage { min-height: 145px; padding: 14px 10px; } .chatty-voice-secure { display: none; } .chatty-voice-footer-actions { gap: 6px; } }
    @media (prefers-reduced-motion: reduce) { .chatty-voice-spinner { animation: none; } }
  `}</style>;
}
