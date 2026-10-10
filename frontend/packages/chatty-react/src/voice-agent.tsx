"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState, type ForwardedRef } from "react";
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
import { TokenSource, type SendTextOptions, type TokenSourceResponseObject } from "livekit-client";
import { CalendarPlus, ImagePlus, MessageCircle, Mic, Phone, PhoneOff, RotateCcw, Send, ShieldCheck, X } from "lucide-react";

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
  /** Visitor credential returned by Chatty's identity endpoint for ci- sessions. */
  visitorToken?: string;
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
  /** Visualizer selected in the Chatty voice settings. */
  visualizer?: "wave" | "bar" | "grid" | "radial" | "aura";
  /** Compact layout flag used by the dashboard/embedded preview. */
  compact?: boolean;
  /** Render without the standalone card shell when mounted inside the widget. */
  widgetMode?: boolean;
  /** Show Chatty's verified calendar booking flow inside the voice surface. */
  showBooking?: boolean;
  /** Optional primary color used by the embedded booking flow. */
  primaryColor?: string;
  /** Called after the embedded booking flow confirms a meeting. */
  onBookingSuccess?: (meeting: ConfirmedMeeting) => void;
  /** Session locale used by the configured STT/TTS model. */
  language?: string;
  /** Called when the visitor changes the session locale. */
  onLanguageChange?: (language: string) => void;
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
    return <p className="chatty-sdk-voice-empty">Start the voice agent to see real-time transcription here.</p>;
  }
  return (
    <div className="chatty-sdk-voice-transcript" aria-live="polite" aria-label="Live voice transcript">
      {[...messages].sort((a, b) => Number(a.timestamp) - Number(b.timestamp)).slice(-12).map((message) => (
        <p key={message.id} className={message.from?.isLocal ? "is-user" : "is-agent"}>
          {message.message}
        </p>
      ))}
    </div>
  );
}

function VoiceVisualizer({ state, bars, visualizer = "aura" }: { state: string; bars: number[]; visualizer?: VoiceAgentProps["visualizer"] }) {
  const active = state === "speaking" || state === "listening";
  const normalized = visualizer ?? "aura";
  const count = normalized === "bar" ? 8 : normalized === "grid" ? 12 : 16;
  return (
    <div className={`chatty-sdk-voice-visualizer is-${normalized} ${state === "speaking" ? "is-speaking" : ""} ${state === "listening" ? "is-listening" : ""}`} aria-hidden="true">
      <div className="chatty-sdk-voice-waveform">
        {bars.slice(0, count).map((bar, index) => <i key={index} style={{ height: `${Math.max(4, (active ? bar : .12) * 42)}px` }} />)}
      </div>
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
  const { messages, send: sendMessage, isSending } = useSessionMessages(session);
  const { audioTrack } = useVoiceAssistant();
  const { bars } = useAudioWaveform(audioTrack, { barCount: 20, updateInterval: 90, volMultiplier: 1.35 });
  const agentStateRef = useRef(agentState);
  const agentJoinTimerRef = useRef<number | null>(null);
  const onStateChange = props.onStateChange;
  const onTranscript = props.onTranscript;
  const showBooking = props.showBooking;
  const [started, setStarted] = useState(false);
  const [starting, setStarting] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [canRetry, setCanRetry] = useState(false);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [confirmedMeeting, setConfirmedMeeting] = useState<ConfirmedMeeting | null>(null);
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const attachmentInputRef = useRef<HTMLInputElement>(null);

  const state = starting ? "connecting" : started ? agentState : "idle";
  const visitorTranscript = [...messages].filter((message) => message.type === "userTranscript").map((message) => message.message.trim()).filter(Boolean).join(" ");
  const visitorEmail = visitorTranscript.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]?.toLowerCase();
  const visitorName = visitorTranscript.match(/(?:my\s+name\s+is|name\s+is|i\s+am)\s+([a-z][a-z' -]{1,80}?)(?=[.!?,]|$)/i)?.[1]?.trim();
  const sendComposerMessage = async () => {
    const message = draft.trim();
    if ((!message && attachments.length === 0) || isSending) return;
    const options: SendTextOptions | undefined = attachments.length ? { attachments } : undefined;
    await sendMessage(message || "Please review the attached image.", options);
    setDraft("");
    setAttachments([]);
  };
  useEffect(() => onStateChange?.(state), [onStateChange, state]);
  useEffect(() => onTranscript?.(messages), [messages, onTranscript]);

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
    agentStateRef.current = agentState;
  }, [agentState]);

  useEffect(() => () => {
    clearReconnectTimer();
    clearAgentJoinTimer();
  }, []);

  // A spoken request such as “book a demo tomorrow” should expose the same
  // verified booking UI as the text widget. The agent still owns the spoken
  // slot search/confirmation flow; this gives the visitor an immediate visual
  // fallback for manually selecting a slot or completing email verification.
  useEffect(() => {
    if (showBooking === false || !messages.length) return;
    const latest = [...messages].reverse().find((message) => message.type === "userTranscript")?.message?.trim() || "";
    const declined = /^(?:no|no thanks|nah|not now|skip|cancel|never mind|nevermind)[.!]?$/i.test(latest)
      || /\b(?:no|don't|do not|not)\b[\s\S]{0,45}\b(?:book|booking|meeting|appointment|schedule|calendar)\b/i.test(latest);
    if (declined) {
      setBookingOpen(false);
      return;
    }
    if (/\b(book|booking|demo|schedule|appointment|meeting|calendar|slot|reschedule)\b/i.test(visitorTranscript)) {
      setBookingOpen(true);
    }
  }, [messages, showBooking, visitorTranscript]);

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
      clearAgentJoinTimer();
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
    // Publish the microphone through the same LiveKit start transaction as
    // signaling. A second setMicrophoneEnabled() call after start can race
    // the official control bar and cancel publication with
    // "Cancelled publication by calling unpublish".
    void sessionRef.current.start({ tracks: { microphone: { enabled: true, publishOptions: { preConnectBuffer: true } } } })
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
          const agentJoined = sessionRef.current.room.remoteParticipants.size > 0;
          if (!agentJoined && agentStateRef.current === "disconnected") {
            const nextError = new Error("Connected to LiveKit, but the voice agent did not join. Check the voice worker and try reconnecting.");
            setError(nextError.message);
            setCanRetry(true);
            onErrorRef.current?.(nextError);
          }
        }, 15000);
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
      clearAgentJoinTimer();
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
      clearAgentJoinTimer();
      setRetrying(false);
    setCanRetry(false);
    setStarted(false);
    void session.end();
  };
  const reset = async () => {
    intentionalEndRef.current = true;
    clearReconnectTimer();
    clearAgentJoinTimer();
    setConsentOpen(false);
    setRetrying(false);
    setCanRetry(false);
    setStarting(false);
    setStarted(false);
    setError(null);
    setTranscriptOpen(false);
    setBookingOpen(false);
    reconnectAttemptRef.current = 0;
    await session.end();
  };
  const label = retrying ? "Reconnecting…" : starting ? "Connecting…" : agentState === "speaking" ? "Speaking…" : agentState === "listening" ? "Listening…" : started ? "Ready when you are" : "Ready to talk";

  return (
      <section className={`chatty-sdk-voice ${props.widgetMode ? "chatty-sdk-voice-widget" : ""} ${props.className ?? ""}`}>
      <header className="chatty-sdk-voice-header">
        <div className="chatty-sdk-voice-header-main">
          {props.onClose && <button type="button" className="chatty-sdk-voice-header-close" onClick={props.onClose} aria-label="Back to chat"><X size={17} /></button>}
          <div><h2>{props.title ?? "Voice agent"}</h2><span>{label}</span></div>
        </div>
        <div className="chatty-sdk-voice-header-actions"><label className="chatty-sdk-voice-language"><span className="sr-only">Voice language</span><select value={props.language ?? "en-US"} onChange={(event) => props.onLanguageChange?.(event.target.value)} aria-label="Voice language"><option value="en-US">🇺🇸 English (US)</option><option value="en-GB">🇬🇧 English (UK)</option><option value="es-ES">🇪🇸 Spanish</option><option value="fr-FR">🇫🇷 French</option><option value="de-DE">🇩🇪 German</option><option value="hi-IN">🇮🇳 Hindi</option><option value="ta">🇱🇰 Tamil</option><option value="si">🇱🇰 Sinhala</option><option value="ja-JP">🇯🇵 Japanese</option></select></label><button type="button" className="chatty-sdk-voice-reset" onClick={() => void reset()} aria-label="Reset voice session" title="Reset voice session"><RotateCcw size={15} /></button><div className="chatty-sdk-voice-secure"><ShieldCheck size={14} /><span>Secure</span></div></div>
      </header>
      {error && <div className="chatty-sdk-voice-error" role="alert"><span>{error}</span>{canRetry && <button type="button" className="chatty-sdk-voice-retry" onClick={retry}>Reconnect</button>}<button type="button" onClick={() => setError(null)} aria-label="Dismiss error"><X size={15} /></button></div>}
      <div className="chatty-sdk-voice-content">
        {transcriptOpen ? <div className="chatty-sdk-voice-transcript-view"><div className="chatty-sdk-voice-section-heading"><strong>Live transcript</strong><span>Live</span></div><div className="chatty-sdk-voice-transcript-panel"><Transcript messages={messages} /></div></div> : <div className="chatty-sdk-voice-stage"><VoiceVisualizer state={agentState} bars={bars} visualizer={props.visualizer} /><strong>{agentState === "speaking" ? "Speaking…" : agentState === "listening" ? "Listening…" : "Ready to talk"}</strong><span>{agentState === "speaking" ? "You can interrupt at any time" : agentState === "listening" ? "Listening for your question" : "Microphone is off"}</span><p>Say hello to start.</p></div>}
        {bookingOpen && props.showBooking !== false && <div className="chatty-sdk-voice-booking-card"><div className="chatty-sdk-voice-booking-heading"><div><strong>Book a meeting</strong><span>Choose a slot or tell the agent what works.</span></div><button type="button" className="chatty-sdk-voice-booking-close" onClick={() => setBookingOpen(false)} aria-label="Close booking"><X size={15} /></button></div><InlineBookingCard botId={props.botId} sessionId={sessionId} primaryColor={props.primaryColor} backendUrl={bookingBackendUrl} preferredText={visitorTranscript} initialName={visitorName} initialEmail={visitorEmail} initialMeeting={confirmedMeeting ?? undefined} onBookingSuccess={(meeting) => { setConfirmedMeeting(meeting); props.onBookingSuccess?.(meeting); }} /></div>}
        {transcriptOpen && <form className="chatty-sdk-voice-composer" onSubmit={(event) => { event.preventDefault(); void sendComposerMessage(); }}><button type="button" className="chatty-sdk-voice-attach" onClick={() => attachmentInputRef.current?.click()} aria-label="Attach image" title="Attach image"><ImagePlus size={16} /></button><input ref={attachmentInputRef} type="file" accept="image/*" multiple className="chatty-sdk-voice-file-input" onChange={(event) => setAttachments(Array.from(event.target.files ?? []).slice(0, 4))} /><input className="chatty-sdk-voice-composer-input" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Type a correction or message…" aria-label="Type a voice agent message" disabled={isSending} /><button type="submit" className="chatty-sdk-voice-send" disabled={isSending || (!draft.trim() && attachments.length === 0)} aria-label="Send message" title="Send message"><Send size={16} /></button></form>}
        <div className="chatty-sdk-voice-call-control">
          {started ? <div className="chatty-sdk-voice-live-controls"><VoiceAssistantControlBar controls={{ microphone: true, leave: false }} /><button type="button" className="chatty-sdk-voice-end" onClick={end} aria-label="End voice session"><PhoneOff size={19} /></button></div> : <button type="button" className="chatty-sdk-voice-start" onClick={start} disabled={starting || retrying} aria-label="Start voice conversation">{starting || retrying ? <span className="chatty-sdk-voice-spinner" /> : <Phone size={22} />}</button>}
          {started && <span className="chatty-sdk-voice-level is-active" aria-hidden="true">{bars.slice(0, 8).map((bar, index) => <i key={index} style={{ height: `${Math.max(3, bar * 16)}px` }} />)}</span>}
        </div>
        <div className="chatty-sdk-voice-footer-actions"><button type="button" onClick={() => setTranscriptOpen((open) => !open)} aria-pressed={transcriptOpen}><MessageCircle size={15} />{transcriptOpen ? "Hide transcript" : "Show transcript"}</button><span>·</span>{props.showBooking !== false && <><button type="button" onClick={() => setBookingOpen((open) => !open)} aria-pressed={bookingOpen}><CalendarPlus size={15} />{bookingOpen ? "Hide booking" : "Book a meeting"}</button><span>·</span></>}<span className="chatty-sdk-voice-mic-status"><Mic size={14} />{started ? "Listening" : "Ready to talk"}</span></div>
        <p className="chatty-sdk-voice-interrupt">✓ Interrupt anytime — the agent will stop speaking</p>
      </div>
      <RoomAudioRenderer />
      {consentOpen && <div className="chatty-sdk-voice-consent" role="dialog" aria-modal="true" aria-labelledby="chatty-sdk-voice-consent-title"><div><button type="button" className="chatty-sdk-voice-close" onClick={() => setConsentOpen(false)} aria-label="Cancel"><X size={17} /></button><ShieldCheck size={25} /><h3 id="chatty-sdk-voice-consent-title">Before we start</h3><p>Chatty needs microphone access for a real-time voice conversation. You can mute or end the session at any time.</p><div><button type="button" onClick={() => setConsentOpen(false)}>Cancel</button><button type="button" onClick={accept}>I agree</button></div></div></div>}
    </section>
  );
}

/** A standalone LiveKit voice surface for React and Next.js applications. */
export const VoiceAgent = forwardRef<VoiceAgentHandle, VoiceAgentProps>(function VoiceAgent(props, ref) {
  const backendUrl = props.backendUrl ?? DEFAULT_BACKEND_URL;
  const sessionId = props.sessionId ?? `voice-${props.botId}-${typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Date.now()}`;
  const [language, setLanguage] = useState(props.language ?? "en-US");
  useEffect(() => { if (props.language) setLanguage(props.language); }, [props.language]);
  const surfaceProps = useMemo(() => ({ ...props, language, onLanguageChange: (next: string) => { setLanguage(next); props.onLanguageChange?.(next); } }), [props, language]);
  const tokenSource = useMemo(() => TokenSource.custom(async (): Promise<TokenSourceResponseObject> => {
    const response = await fetch(`${backendUrl}/api/widget/voice/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(props.widgetToken ? { "x-widget-token": props.widgetToken } : {}),
        ...(props.visitorToken ? { "x-chatty-visitor": props.visitorToken } : {}),
      },
      body: JSON.stringify({
        bot_id: props.botId,
        session_id: sessionId,
        // Keep the Chatty conversation stable while forcing every LiveKit
        // connection attempt into a fresh room. This prevents reconnects
        // from inheriting stale participant/thread state.
        room_nonce: createVoiceRoomNonce(),
        visitor_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        voice_language: language,
      }),
      cache: "no-store",
    });
    if (!response.ok) throw new Error((await response.text()) || `Voice token failed (${response.status})`);
    const data = (await response.json()) as VoiceTokenResponse;
    return { serverUrl: data.serverUrl, participantToken: data.participantToken };
  }), [backendUrl, language, props.botId, props.visitorToken, props.widgetToken, sessionId]);
  const session = useSession(tokenSource);
  return <SessionProvider session={session}><VoiceSurface props={surfaceProps} apiRef={ref} sessionId={sessionId} /></SessionProvider>;
});
