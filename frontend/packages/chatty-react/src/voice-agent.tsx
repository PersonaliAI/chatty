"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useState, type CSSProperties, type ForwardedRef } from "react";
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
import { MessageCircle, Phone, PhoneOff, ShieldCheck, X } from "lucide-react";

import "@livekit/components-styles";

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

function VoiceSurface({ props, apiRef }: { props: VoiceAgentProps; apiRef: ForwardedRef<VoiceAgentHandle> }) {
  const session = useSessionContext();
  const { state: agentState } = useAgent();
  const { localParticipant } = useLocalParticipant();
  const { messages } = useSessionMessages(session);
  const { audioTrack } = useVoiceAssistant();
  const { bars } = useAudioWaveform(audioTrack, { barCount: 20, updateInterval: 90, volMultiplier: 1.35 });
  const [started, setStarted] = useState(false);
  const [starting, setStarting] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const state = starting ? "connecting" : started ? agentState : "idle";
  useEffect(() => props.onStateChange?.(state), [props.onStateChange, state]);
  useEffect(() => props.onTranscript?.(messages), [messages, props.onTranscript]);

  useImperativeHandle(apiRef, () => ({
    start: () => { setError(null); setStarted(true); },
    stop: async () => { setStarted(false); await session.end(); },
    toggleMicrophone: async () => {
      await localParticipant.setMicrophoneEnabled(!localParticipant.isMicrophoneEnabled);
      return localParticipant.isMicrophoneEnabled;
    },
  }), [apiRef, localParticipant, session]);

  useEffect(() => {
    if (!started) return;
    let active = true;
    setStarting(true);
    void session.start().catch((cause) => {
      const nextError = cause instanceof Error ? cause : new Error("Unable to connect to the voice agent.");
      if (active) {
        setError(nextError.message);
        props.onError?.(nextError);
        setStarted(false);
      }
    }).finally(() => {
      if (active) setStarting(false);
    });
    return () => {
      active = false;
      void session.end();
    };
  }, [props.onError, session, started]);

  const start = () => {
    setError(null);
    if (props.requireConsent !== false) setConsentOpen(true);
    else setStarted(true);
  };
  const accept = () => { setConsentOpen(false); setStarted(true); };
  const end = () => { setStarted(false); void session.end(); };
  const level = Math.max(0.12, Math.min(1, bars.length ? Math.max(...bars) : 0));
  const label = starting ? "Connecting…" : agentState === "speaking" ? "Speaking…" : agentState === "listening" ? "Listening…" : started ? "Ready when you are" : "Talk to Chatty";

  return (
    <section className={`chatty-sdk-voice ${props.className ?? ""}`}>
      <header className="chatty-sdk-voice-header"><div><p className="chatty-sdk-voice-eyebrow"><ShieldCheck size={14} /> Secure voice session</p><h2>{props.title ?? "Talk with Chatty"}</h2></div><span className="chatty-sdk-voice-status">{label}</span></header>
      {error && <div className="chatty-sdk-voice-error" role="alert"><span>{error}</span><button type="button" onClick={() => setError(null)} aria-label="Dismiss error"><X size={15} /></button></div>}
      <div className="chatty-sdk-voice-stage"><div className={`chatty-sdk-voice-orb ${started ? "is-active" : ""}`} style={{ "--voice-level": level } as CSSProperties}><div className="chatty-sdk-voice-orb-core"><div className="chatty-sdk-voice-bars" aria-hidden="true">{bars.map((bar, index) => <i key={index} style={{ height: `${Math.max(10, bar * 70)}%` }} />)}</div>{!started && <Phone size={28} />}</div></div><p>{label}</p><small>{started ? "You can interrupt the agent at any time." : "Ask questions, find answers, book meetings, or capture a lead."}</small></div>
      <Transcript messages={messages} />
      <div className="chatty-sdk-voice-actions">{started ? <><VoiceAssistantControlBar controls={{ microphone: true, leave: false }} /><button type="button" className="chatty-sdk-voice-end" onClick={end} aria-label="End voice session"><PhoneOff size={19} /></button></> : <button type="button" className="chatty-sdk-voice-start" onClick={start} disabled={starting} aria-label="Start voice conversation">{starting ? <span className="chatty-sdk-voice-spinner" /> : <Phone size={22} />}</button>}</div>
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
      body: JSON.stringify({ bot_id: props.botId, session_id: sessionId }),
      cache: "no-store",
    });
    if (!response.ok) throw new Error((await response.text()) || `Voice token failed (${response.status})`);
    const data = (await response.json()) as VoiceTokenResponse;
    return { serverUrl: data.serverUrl, participantToken: data.participantToken };
  }), [backendUrl, props.botId, props.widgetToken, sessionId]);
  const session = useSession(tokenSource);
  return <SessionProvider session={session}><VoiceSurface props={props} apiRef={ref} /></SessionProvider>;
});
