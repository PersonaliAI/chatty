"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState, type CSSProperties, type ForwardedRef } from "react";
import {
  RoomAudioRenderer,
  SessionProvider,
  VoiceAssistantControlBar,
  useAgent,
  useAudioWaveform,
  useSession,
  useSessionContext,
  useSessionMessages,
  useLocalParticipant,
  useVoiceAssistant,
  type ReceivedMessage,
} from "@livekit/components-react";
import { TokenSource, type TokenSourceResponseObject } from "livekit-client";
import { CalendarPlus, Phone, PhoneOff, ShieldCheck, X } from "lucide-react";

import "@livekit/components-styles";
import { InlineBookingCard, type ConfirmedMeeting } from "./inline-booking-card";
import "./voice-agent.css";

export interface VoiceAgentProps {
  /** Chatty bot UUID from the dashboard. */
  botId: string;
  /** API origin that mints short-lived LiveKit participant tokens. */
  backendUrl?: string;
  /** Stable visitor/session identifier used for Chatty history and dispatch metadata. */
  sessionId?: string;
  /** Optional signed widget token for embedded deployments. */
  widgetToken?: string;
  /** Optional class name for the outer voice surface. */
  className?: string;
  /** Optional label shown above the voice controls. */
  title?: string;
  /** Ask for consent before starting microphone capture. Defaults to true. */
  requireConsent?: boolean;
  /** Called when the LiveKit connection or agent state changes. */
  onStateChange?: (state: string) => void;
  /** Called whenever LiveKit transcript messages update. */
  onTranscript?: (messages: ReceivedMessage[]) => void;
  /** Called when the session cannot be started or the token request fails. */
  onError?: (error: Error) => void;
  /** Called when the host wants to close the in-widget voice surface. */
  onClose?: () => void;
  /** Show Chatty's verified calendar booking flow inside the voice surface. */
  showBooking?: boolean;
  /** Optional primary color used by the embedded booking flow. */
  primaryColor?: string;
  /** Called after the embedded booking flow confirms a meeting. */
  onBookingSuccess?: (meeting: ConfirmedMeeting) => void;
}

export interface VoiceAgentHandle {
  start: () => void;
  stop: () => Promise<void>;
  toggleMicrophone: () => Promise<boolean>;
}

type VoiceTokenResponse = {
  serverUrl: string;
  participantToken: string;
};

const DEFAULT_BACKEND_URL = "https://api.chatty.personaliai.com";

function createVoiceRoomNonce() {
  return globalThis.crypto?.randomUUID?.() ?? `voice-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function Transcript({ messages }: { messages: ReceivedMessage[] }) {
  if (!messages.length) {
    return <p className="chatty-sdk-voice-empty">Start speaking to see the live transcript.</p>;
  }
  return (
    <div className="chatty-sdk-voice-transcript" aria-live="polite" aria-label="Live voice transcript">
      {messages.slice(-12).map((message) => (
        <p key={message.id} className={message.from?.isLocal ? "is-user" : "is-agent"}>
          {message.message}
        </p>
      ))}
    </div>
  );
}

function VoiceSurface({ props, apiRef, sessionId }: { props: VoiceAgentProps; apiRef: ForwardedRef<VoiceAgentHandle>; sessionId: string }) {
  const bookingBackendUrl = props.backendUrl ?? DEFAULT_BACKEND_URL;
  const session = useSessionContext();
  // The LiveKit session object changes identity as its connection state
  // changes. Keep the lifecycle effect tied to the explicit user intent
  // (`started`) instead of reconnecting on every reactive session update.
  const sessionRef = useRef(session);
  const onErrorRef = useRef(props.onError);
  const startingRef = useRef(false);
  const connectedRef = useRef(false);
  const intentionalEndRef = useRef(false);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<number | null>(null);
  useEffect(() => {
    sessionRef.current = session;
    onErrorRef.current = props.onError;
  }, [session, props.onError]);
  const { state: agentState } = useAgent();
  const { localParticipant } = useLocalParticipant();
  const { messages } = useSessionMessages(session);
  const { audioTrack } = useVoiceAssistant();
  const { bars } = useAudioWaveform(audioTrack, { barCount: 20, updateInterval: 90, volMultiplier: 1.35 });
  const onStateChange = props.onStateChange;
  const onTranscript = props.onTranscript;
  const showBooking = props.showBooking;
  const [started, setStarted] = useState(false);
  const [starting, setStarting] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [canRetry, setCanRetry] = useState(false);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [confirmedMeeting, setConfirmedMeeting] = useState<ConfirmedMeeting | null>(null);

  const state = starting ? "connecting" : started ? agentState : "idle";
  useEffect(() => onStateChange?.(state), [onStateChange, state]);
  useEffect(() => onTranscript?.(messages), [messages, onTranscript]);

  const clearReconnectTimer = () => {
    if (reconnectTimerRef.current !== null) {
      window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  };

  useEffect(() => clearReconnectTimer, []);

  // A spoken request such as “book a demo tomorrow” should expose the same
  // verified booking UI as the text widget. The agent still owns the spoken
  // slot search/confirmation flow; this gives the visitor an immediate visual
  // fallback for manually selecting a slot or completing email verification.
  useEffect(() => {
    if (showBooking === false || !messages.length) return;
    const latest = messages[messages.length - 1]?.message ?? "";
    if (/\b(book|booking|demo|schedule|appointment|meeting|calendar|slot|reschedule)\b/i.test(latest)) {
      setBookingOpen(true);
    }
  }, [messages, showBooking]);

  useImperativeHandle(apiRef, () => ({
    start: () => {
      intentionalEndRef.current = false;
      setError(null);
      setCanRetry(false);
      setStarted(true);
    },
    stop: async () => {
      intentionalEndRef.current = true;
      clearReconnectTimer();
      setRetrying(false);
      setCanRetry(false);
      setStarted(false);
      await session.end();
    },
    toggleMicrophone: async () => {
      await localParticipant.setMicrophoneEnabled(!localParticipant.isMicrophoneEnabled);
      return localParticipant.isMicrophoneEnabled;
    },
  }), [localParticipant, session]);

  useEffect(() => {
    if (!started) return;
    let active = true;
    startingRef.current = true;
    connectedRef.current = false;
    setStarting(true);
    // Let LiveKit establish signaling before publishing the microphone. This
    // avoids browsers failing the entire handshake when the pre-connect audio
    // track is still settling, and keeps consent/permission errors explicit.
    void sessionRef.current.start({ tracks: { microphone: { enabled: false } } })
      .then(async () => {
        if (!active) return;
        connectedRef.current = true;
        reconnectAttemptRef.current = 0;
        setError(null);
        setRetrying(false);
        setCanRetry(false);
        await sessionRef.current.room.localParticipant.setMicrophoneEnabled(true);
      })
      .catch((cause) => {
        const nextError = cause instanceof Error ? cause : new Error("Unable to connect to the voice agent.");
        if (active) {
          setError(nextError.message);
          onErrorRef.current?.(nextError);
          setCanRetry(true);
          setRetrying(false);
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
      void sessionRef.current.end();
    };
  }, [started]);

  useEffect(() => {
    if (
      session.connectionState !== "disconnected" ||
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
    setError("The voice connection was interrupted.");

    if (attempt <= 2) {
      setRetrying(true);
      reconnectTimerRef.current = window.setTimeout(() => {
        reconnectTimerRef.current = null;
        if (!intentionalEndRef.current) setStarted(true);
      }, attempt * 1500);
    } else {
      setRetrying(false);
      setCanRetry(true);
      onErrorRef.current?.(new Error("The voice connection was interrupted."));
    }
  }, [session.connectionState, started]);

  const start = () => {
    intentionalEndRef.current = false;
    setError(null);
    setCanRetry(false);
    if (props.requireConsent !== false) setConsentOpen(true);
    else setStarted(true);
  };
  const accept = () => {
    intentionalEndRef.current = false;
    reconnectAttemptRef.current = 0;
    setConsentOpen(false);
    setError(null);
    setCanRetry(false);
    setStarted(true);
  };
  const retry = () => {
    intentionalEndRef.current = false;
    reconnectAttemptRef.current = 0;
    clearReconnectTimer();
    setError(null);
    setCanRetry(false);
    setRetrying(true);
    setStarted(true);
  };
  const end = () => {
    intentionalEndRef.current = true;
    clearReconnectTimer();
    setRetrying(false);
    setCanRetry(false);
    setStarted(false);
    void session.end();
  };
  const level = Math.max(0.12, Math.min(1, bars.length ? Math.max(...bars) : 0));
  const label = retrying ? "Reconnecting…" : starting ? "Connecting…" : agentState === "speaking" ? "Speaking…" : agentState === "listening" ? "Listening…" : started ? "Ready when you are" : "Talk to Chatty";

  return (
    <section className={`chatty-sdk-voice ${props.className ?? ""}`}>
      <header className="chatty-sdk-voice-header"><div><p className="chatty-sdk-voice-eyebrow"><ShieldCheck size={14} /> Secure voice session</p><h2>{props.title ?? "Talk with Chatty"}</h2></div><div className="chatty-sdk-voice-header-actions"><span className="chatty-sdk-voice-status">{label}</span>{props.onClose && <button type="button" className="chatty-sdk-voice-close" onClick={props.onClose} aria-label="Back to chat"><X size={17} /></button>}</div></header>
      {error && <div className="chatty-sdk-voice-error" role="alert"><span>{error}</span>{canRetry && <button type="button" className="chatty-sdk-voice-retry" onClick={retry}>Reconnect</button>}<button type="button" onClick={() => setError(null)} aria-label="Dismiss error"><X size={15} /></button></div>}
      <div className="chatty-sdk-voice-stage"><div className={`chatty-sdk-voice-orb ${started ? "is-active" : ""}`} style={{ "--voice-level": level } as CSSProperties}><div className="chatty-sdk-voice-orb-core"><div className="chatty-sdk-voice-bars" aria-hidden="true">{bars.map((bar, index) => <i key={index} style={{ height: `${Math.max(10, bar * 70)}%` }} />)}</div>{!started && <Phone size={28} />}</div></div><p>{label}</p><small>{started ? "You can interrupt the agent at any time." : "Ask questions, find answers, book meetings, or capture a lead."}</small></div>
      <Transcript messages={messages} />
      {props.showBooking !== false && <div className="chatty-sdk-voice-booking">
        {!bookingOpen && <button type="button" className="chatty-sdk-voice-booking-trigger" onClick={() => setBookingOpen(true)}>
          <CalendarPlus size={16} />
          <span>Book a meeting</span>
          <small>Choose a verified time slot</small>
        </button>}
        {bookingOpen && <div className="chatty-sdk-voice-booking-card">
          <div className="chatty-sdk-voice-booking-heading">
            <div><strong>Book a meeting</strong><span>Pick a time or tell the agent what works for you.</span></div>
            <button type="button" className="chatty-sdk-voice-booking-close" onClick={() => setBookingOpen(false)} aria-label="Close booking"><X size={15} /></button>
          </div>
          <InlineBookingCard
            botId={props.botId}
            sessionId={sessionId}
            primaryColor={props.primaryColor}
            backendUrl={bookingBackendUrl}
            initialMeeting={confirmedMeeting ?? undefined}
            onBookingSuccess={(meeting) => { setConfirmedMeeting(meeting); props.onBookingSuccess?.(meeting); }}
          />
        </div>}
      </div>}
      <div className="chatty-sdk-voice-actions">{started ? <><VoiceAssistantControlBar controls={{ microphone: true, leave: false }} /><button type="button" className="chatty-sdk-voice-end" onClick={end} aria-label="End voice session"><PhoneOff size={19} /></button></> : <button type="button" className="chatty-sdk-voice-start" onClick={start} disabled={starting || retrying} aria-label="Start voice conversation">{starting || retrying ? <span className="chatty-sdk-voice-spinner" /> : <Phone size={22} />}</button>}</div>
      <RoomAudioRenderer />
      {consentOpen && <div className="chatty-sdk-voice-consent" role="dialog" aria-modal="true" aria-labelledby="chatty-sdk-voice-consent-title"><div><button type="button" className="chatty-sdk-voice-close" onClick={() => setConsentOpen(false)} aria-label="Cancel"><X size={17} /></button><ShieldCheck size={25} /><h3 id="chatty-sdk-voice-consent-title">Before we start</h3><p>Chatty needs microphone access for a real-time voice conversation. You can mute or end the session at any time.</p><div><button type="button" onClick={() => setConsentOpen(false)}>Cancel</button><button type="button" onClick={accept}>I agree</button></div></div></div>}
    </section>
  );
}

/** A standalone LiveKit voice surface for React and Next.js applications. */
export const VoiceAgent = forwardRef<VoiceAgentHandle, VoiceAgentProps>(function VoiceAgent(props, ref) {
  const backendUrl = props.backendUrl ?? DEFAULT_BACKEND_URL;
  const sessionId = props.sessionId ?? `voice-${props.botId}-${typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Date.now()}`;
  const tokenSource = useMemo(() => TokenSource.custom(async (): Promise<TokenSourceResponseObject> => {
    const response = await fetch(`${backendUrl}/api/widget/voice/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(props.widgetToken ? { "x-widget-token": props.widgetToken } : {}) },
      body: JSON.stringify({
        bot_id: props.botId,
        session_id: sessionId,
        // Keep the Chatty conversation stable while forcing every LiveKit
        // connection attempt into a fresh room. This prevents reconnects
        // from inheriting stale participant/thread state.
        room_nonce: createVoiceRoomNonce(),
        visitor_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
      cache: "no-store",
    });
    if (!response.ok) throw new Error((await response.text()) || `Voice token failed (${response.status})`);
    const data = (await response.json()) as VoiceTokenResponse;
    return { serverUrl: data.serverUrl, participantToken: data.participantToken };
  }), [backendUrl, props.botId, props.widgetToken, sessionId]);
  const session = useSession(tokenSource);
  return <SessionProvider session={session}><VoiceSurface props={props} apiRef={ref} sessionId={sessionId} /></SessionProvider>;
});
