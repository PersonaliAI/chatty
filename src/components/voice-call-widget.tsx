"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useSpring } from "framer-motion";
import {
  Room,
  RoomEvent,
  Track,
  RemoteTrack,
  RemoteParticipant,
  ConnectionState,
  TranscriptionSegment,
  Participant,
} from "livekit-client";
import { Mic, MicOff, PhoneOff, Loader2, AlertCircle } from "lucide-react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

const WAVE_BAR_COUNT = 14;

type CallStatus = "connecting" | "requesting-mic" | "connected" | "listening" | "agent-speaking" | "error" | "ended";

interface TranscriptEntry {
  id: string;
  speaker: "visitor" | "agent";
  text: string;
  final: boolean;
}

interface VoiceCallWidgetProps {
  botId: string;
  sessionId: string;
  backendUrl: string;
  originToken: string | null;
  visitorTimezone: string;
  primaryColor: string;
  onClose: () => void;
}

export default function VoiceCallWidget({
  botId,
  sessionId,
  backendUrl,
  originToken,
  visitorTimezone,
  primaryColor,
  onClose,
}: VoiceCallWidgetProps) {
  const [status, setStatus] = useState<CallStatus>("connecting");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [duration, setDuration] = useState(0);
  const [localLevels, setLocalLevels] = useState<number[]>(() => Array(WAVE_BAR_COUNT).fill(0));
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);

  const roomRef = useRef<Room | null>(null);
  const audioElRef = useRef<HTMLMediaElement | null>(null);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const localLevelFrameRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);
  // Real mic analyser (not a fake random waveform) — lets us tell, just by
  // watching the bars while talking, whether the browser is actually
  // capturing audio from the mic at all, independent of whether the voice
  // pipeline downstream (VAD/STT) picks it up.
  const analyserRef = useRef<AnalyserNode | null>(null);
  const analyserCtxRef = useRef<AudioContext | null>(null);

  // Smoothed orb scale/glow driven by the agent's remote audio level. Same
  // spring feel used for the rest of the widget's motion (bouncy overshoot).
  const orbLevel = useSpring(0, { stiffness: 220, damping: 18, mass: 0.6 });

  useEffect(() => {
    mountedRef.current = true;

    const widgetTokenHeader: Record<string, string> = originToken ? { "X-Widget-Token": originToken } : {};
    let cancelled = false;

    async function start() {
      let room: Room | null = null;
      try {
        const res = await fetch(`${backendUrl}/api/widget/voice/token`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...widgetTokenHeader },
          body: JSON.stringify({ bot_id: botId, session_id: sessionId, visitor_timezone: visitorTimezone }),
        });

        if (!res.ok) {
          let detail = "Couldn't start the call, please try again.";
          if (res.status === 403) detail = "Voice chat isn't available right now.";
          else if (res.status === 402) detail = "This assistant has reached its usage limit.";
          else if (res.status === 429) detail = "Too many requests — please wait a moment and try again.";
          else {
            try {
              const b = await res.json();
              if (b?.detail) detail = b.detail;
            } catch {}
          }
          if (!cancelled) {
            setErrorMessage(detail);
            setStatus("error");
          }
          return;
        }

        const data = await res.json();
        const { token, livekit_url } = data;

        room = new Room();
        roomRef.current = room;

        room.on(RoomEvent.Disconnected, () => {
          if (!cancelled && mountedRef.current) setStatus((s) => (s === "error" ? s : "ended"));
        });

        room.on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
          if (cancelled || !mountedRef.current) return;
          if (state === ConnectionState.Connected) {
            setStatus((s) => (s === "agent-speaking" ? s : "connected"));
          }
        });

        room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack, _pub, participant: RemoteParticipant) => {
          if (track.kind === Track.Kind.Audio) {
            const el = track.attach();
            el.autoplay = true;
            audioElRef.current = el;
            document.body.appendChild(el);
            void participant;
          }
        });

        room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
          track.detach().forEach((el) => el.remove());
        });

        // Live transcript — the agent worker already publishes STT/reply text
        // over LiveKit's built-in transcription stream; each segment updates
        // in place (by id) while interim, then locks in once `final`. Segments
        // carry no explicit role, so attribute by participant: no `participant`
        // (or the local one) means it's the visitor's own speech-to-text.
        room.on(
          RoomEvent.TranscriptionReceived,
          (segments: TranscriptionSegment[], participant?: Participant) => {
            if (cancelled || !mountedRef.current) return;
            const speaker: "visitor" | "agent" =
              !participant || participant.identity === room?.localParticipant?.identity ? "visitor" : "agent";
            setTranscript((prev) => {
              const next = [...prev];
              for (const seg of segments) {
                const idx = next.findIndex((e) => e.id === seg.id);
                const entry: TranscriptEntry = { id: seg.id, speaker, text: seg.text, final: seg.final };
                if (idx >= 0) next[idx] = entry;
                else next.push(entry);
              }
              return next;
            });
          }
        );

        // Drive the orb glow from whichever remote participant (the agent) is
        // actively speaking; drive the "listening" bars from the visitor's own
        // local audio level.
        room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
          if (cancelled || !mountedRef.current) return;
          const localIdentity = room?.localParticipant?.identity;
          let remoteLevel = 0;
          let localSpeaking = false;
          for (const p of speakers) {
            if (p.identity === localIdentity) {
              localSpeaking = true;
            } else {
              remoteLevel = Math.max(remoteLevel, p.audioLevel ?? 0);
            }
          }
          orbLevel.set(Math.min(1, remoteLevel * 3.5));
          setStatus((prev) => {
            if (prev === "connecting" || prev === "requesting-mic" || prev === "error" || prev === "ended") return prev;
            if (remoteLevel > 0.01) return "agent-speaking";
            if (localSpeaking) return "listening";
            return "connected";
          });
        });

        await room.connect(livekit_url, token);
        if (cancelled) {
          room.disconnect();
          return;
        }
        // getUserMedia can sit pending for a while if the visitor hasn't
        // noticed/responded to the browser's permission prompt yet (easy to
        // miss inside an embedded iframe) — show an explicit state for this
        // rather than a generic "Connecting…" that looks stuck.
        if (!cancelled && mountedRef.current) setStatus("requesting-mic");
        try {
          await room.localParticipant.setMicrophoneEnabled(true);
          const pub = Array.from(room.localParticipant.audioTrackPublications.values())[0];
          const mediaTrack = pub?.track?.mediaStreamTrack;
          if (mediaTrack) {
            const ctx = new AudioContext();
            const source = ctx.createMediaStreamSource(new MediaStream([mediaTrack]));
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 256;
            analyser.smoothingTimeConstant = 0.6;
            source.connect(analyser);
            analyserCtxRef.current = ctx;
            analyserRef.current = analyser;
          }
        } catch (micErr) {
          console.error("Microphone permission failed:", micErr);
          if (!cancelled && mountedRef.current) {
            setErrorMessage(
              "Microphone access is required for voice calls. Please allow microphone access in your browser and try again."
            );
            setStatus("error");
          }
          room.disconnect();
          return;
        }
        if (!cancelled && mountedRef.current) setStatus("connected");
      } catch (err) {
        console.error("Voice call failed to start:", err);
        if (!cancelled && mountedRef.current) {
          setErrorMessage("Couldn't start the call, please try again.");
          setStatus("error");
        }
        room?.disconnect();
      }
    }

    start();

    return () => {
      cancelled = true;
      mountedRef.current = false;
      const room = roomRef.current;
      roomRef.current = null;
      if (room) {
        room.localParticipant.setMicrophoneEnabled(false).catch(() => {});
        room.disconnect();
      }
      if (audioElRef.current) {
        audioElRef.current.remove();
        audioElRef.current = null;
      }
      analyserRef.current = null;
      if (analyserCtxRef.current) {
        analyserCtxRef.current.close().catch(() => {});
        analyserCtxRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-scroll the transcript to the newest line as it streams in.
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [transcript]);

  // Call duration timer, starts once connected.
  useEffect(() => {
    if (status === "connecting" || status === "requesting-mic" || status === "error") return;
    if (status === "ended") {
      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
      return;
    }
    if (!durationIntervalRef.current) {
      durationIntervalRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
    }
    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }
    };
  }, [status]);

  // Local mic level animation for the 14-bar "listening" waveform — now
  // driven by a real AnalyserNode on the mic track (see analyserRef above)
  // instead of a fake random animation. The "listening" transition itself
  // comes from LiveKit's client-side local audioLevel (ActiveSpeakersChanged
  // below), computed in-browser independent of the server VAD/STT pipeline —
  // so whether this state is ever reached at all is itself diagnostic: if it
  // never fires while you're actually talking, the browser isn't capturing
  // usable mic audio in the first place.
  useEffect(() => {
    if (status !== "listening") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLocalLevels(Array(WAVE_BAR_COUNT).fill(0));
      return;
    }
    let stopped = false;
    const bins = new Uint8Array(analyserRef.current?.frequencyBinCount ?? 128);
    const tick = () => {
      if (stopped) return;
      const analyser = analyserRef.current;
      if (analyser) {
        analyser.getByteTimeDomainData(bins);
        // RMS of the time-domain signal around its 128 midpoint — a real
        // amplitude reading, not a synthetic animation.
        let sumSquares = 0;
        for (let i = 0; i < bins.length; i++) {
          const centered = (bins[i] - 128) / 128;
          sumSquares += centered * centered;
        }
        const rms = Math.sqrt(sumSquares / bins.length);
        const boosted = Math.min(1, rms * 6);
        const levels = Array.from({ length: WAVE_BAR_COUNT }, () => Math.min(1, boosted * (0.7 + Math.random() * 0.3)));
        setLocalLevels(levels);
      } else {
        setLocalLevels(Array(WAVE_BAR_COUNT).fill(0));
      }
      localLevelFrameRef.current = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      stopped = true;
      if (localLevelFrameRef.current) cancelAnimationFrame(localLevelFrameRef.current);
    };
  }, [status]);

  const toggleMute = async () => {
    const room = roomRef.current;
    if (!room) return;
    const next = !muted;
    await room.localParticipant.setMicrophoneEnabled(!next);
    setMuted(next);
  };

  const handleHangup = () => {
    const room = roomRef.current;
    roomRef.current = null;
    if (room) {
      room.localParticipant.setMicrophoneEnabled(false).catch(() => {});
      room.disconnect();
    }
    onClose();
  };

  const transcriptMdComponents: Components = {
    p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
    ul: ({ children }) => <ul className="list-disc pl-4 mb-1 space-y-0.5">{children}</ul>,
    ol: ({ children }) => <ol className="list-decimal pl-4 mb-1 space-y-0.5">{children}</ol>,
    a: ({ href, children }) => (
      <a href={href} target="_blank" rel="noreferrer" className="underline break-all" style={{ color: "currentColor" }}>
        {children}
      </a>
    ),
    code: ({ className, children, ...rest }) => {
      const isBlock = className?.startsWith("language-");
      if (!isBlock) return <code className="bg-black/10 dark:bg-white/10 px-1 py-0.5 rounded text-[10px] font-mono" {...rest}>{children}</code>;
      return (
        <pre className="bg-black/10 dark:bg-white/10 rounded-lg p-2 my-1 overflow-x-auto text-[10px] font-mono">
          <code {...rest}>{children}</code>
        </pre>
      );
    },
  };

  const fmtDuration = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  };

  const statusLabel = (() => {
    switch (status) {
      case "connecting": return "Connecting…";
      case "requesting-mic": return "Please allow microphone access…";
      case "connected": return fmtDuration(duration);
      case "listening": return "Listening…";
      case "agent-speaking": return "Speaking…";
      case "ended": return "Call ended";
      case "error": return errorMessage || "Something went wrong";
      default: return "";
    }
  })();

  return (
    <div className="flex-1 flex flex-col p-4 bg-card h-full min-h-0">
      {status === "error" ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-4">
          <div className="size-12 rounded-full flex items-center justify-center bg-red-50 dark:bg-red-950/40">
            <AlertCircle className="size-6 text-red-500" />
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-[220px] leading-relaxed">{errorMessage}</p>
          <motion.button
            type="button"
            whileTap={{ scale: 0.85 }}
            transition={{ duration: 0.32, ease: [0.34, 1.56, 0.64, 1] }}
            onClick={onClose}
            className="px-4 py-2 rounded-full text-xs font-semibold text-white"
            style={{ background: primaryColor }}
          >
            Close
          </motion.button>
        </div>
      ) : (
        <>
          {/* Compact status row — small orb + state text, replacing what used
              to be a full-height centered orb, since the transcript below is
              now the primary focus of the call view. */}
          <div className="flex items-center gap-3 w-full pb-3 border-b border-neutral-100 dark:border-neutral-850 shrink-0">
            <Orb status={status} level={orbLevel} primaryColor={primaryColor} compact />
            <div className="flex-1 min-w-0">
              {status === "listening" ? (
                <div className="flex items-center gap-[3px] h-4" aria-hidden>
                  {localLevels.map((level, i) => (
                    <span
                      key={i}
                      className="w-0.5 rounded-full transition-[height] duration-[50ms] ease-out"
                      style={{ height: `${Math.max(3, level * 16)}px`, background: primaryColor }}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 tracking-wide truncate">
                  {(status === "connecting" || status === "requesting-mic") && (
                    <Loader2 className="inline size-3.5 animate-spin mr-1.5 -mt-0.5" />
                  )}
                  {statusLabel}
                </p>
              )}
            </div>
          </div>

          {/* Live transcript — auto-scrolls to the newest line; interim
              (not-yet-final) segments render with a bouncy typing indicator
              instead of raw text jitter, then settle into place once final. */}
          <div className="flex-1 min-h-0 w-full overflow-y-auto scrollbar-thin py-3 space-y-2.5">
            {transcript.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <p className="text-[11px] text-neutral-400 dark:text-neutral-500 text-center px-6">
                  {status === "agent-speaking" || status === "listening" || status === "connected"
                    ? "Say something — your conversation will appear here."
                    : ""}
                </p>
              </div>
            ) : (
              <AnimatePresence initial={false}>
                {transcript.map((entry) => (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0, y: 8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.32, ease: [0.34, 1.56, 0.64, 1] }}
                    className={`flex ${entry.speaker === "visitor" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-3 py-2 text-xs leading-relaxed ${
                        entry.speaker === "visitor"
                          ? "text-white rounded-br-md"
                          : "bg-neutral-100 dark:bg-neutral-850 text-neutral-800 dark:text-neutral-200 rounded-bl-md"
                      }`}
                      style={entry.speaker === "visitor" ? { background: primaryColor } : undefined}
                    >
                      {entry.text.trim() ? (
                        <>
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm, remarkMath]}
                            rehypePlugins={[rehypeKatex]}
                            components={transcriptMdComponents}
                          >
                            {entry.text}
                          </ReactMarkdown>
                          {!entry.final && (
                            <span className="inline-block w-1 h-3 ml-0.5 -mb-0.5 bg-current opacity-60 animate-pulse" />
                          )}
                        </>
                      ) : (
                        <span className="flex items-center gap-1 py-0.5" aria-label="typing">
                          <span className="size-1.5 rounded-full bg-current opacity-60 animate-bounce" />
                          <span className="size-1.5 rounded-full bg-current opacity-60 animate-bounce [animation-delay:150ms]" />
                          <span className="size-1.5 rounded-full bg-current opacity-60 animate-bounce [animation-delay:300ms]" />
                        </span>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
            <div ref={transcriptEndRef} />
          </div>

          <div className="flex items-center gap-4 pb-2 pt-1 shrink-0">
            <motion.button
              type="button"
              whileTap={{ scale: 0.85 }}
              transition={{ duration: 0.32, ease: [0.34, 1.56, 0.64, 1] }}
              onClick={toggleMute}
              disabled={status === "connecting" || status === "requesting-mic" || status === "ended"}
              aria-label={muted ? "Unmute microphone" : "Mute microphone"}
              className="size-12 rounded-full flex items-center justify-center border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-300 disabled:opacity-40"
            >
              {muted ? <MicOff className="size-5" /> : <Mic className="size-5" />}
            </motion.button>
            <motion.button
              type="button"
              whileTap={{ scale: 0.85 }}
              transition={{ duration: 0.32, ease: [0.34, 1.56, 0.64, 1] }}
              onClick={handleHangup}
              aria-label="End call"
              className="size-14 rounded-full flex items-center justify-center bg-red-500 text-white shadow-lg"
            >
              <PhoneOff className="size-6" />
            </motion.button>
          </div>
        </>
      )}
    </div>
  );
}

function Orb({
  status,
  level,
  primaryColor,
  compact = false,
}: {
  status: CallStatus;
  level: ReturnType<typeof useSpring>;
  primaryColor: string;
  compact?: boolean;
}) {
  const [scale, setScale] = useState(1);
  const [glow, setGlow] = useState(0);

  useEffect(() => {
    const unsub = level.on("change", (v) => {
      setScale(1 + v * 0.28);
      setGlow(v);
    });
    return () => unsub();
  }, [level]);

  const isActive = status === "agent-speaking";

  return (
    <motion.div
      animate={
        isActive
          ? { scale }
          : status === "connecting" || status === "requesting-mic"
          ? { scale: [1, 1.06, 1] }
          : { scale: 1 }
      }
      transition={
        isActive
          ? { duration: 0.32, ease: [0.34, 1.56, 0.64, 1] }
          : { duration: 1.8, repeat: Infinity, ease: "easeInOut" }
      }
      className={`shrink-0 rounded-full flex items-center justify-center ${compact ? "size-9" : "size-28"}`}
      style={{
        background: `radial-gradient(circle at 35% 30%, ${primaryColor}dd, ${primaryColor}88)`,
        boxShadow: `0 0 ${(compact ? 8 : 20) + (isActive ? glow * (compact ? 20 : 60) : compact ? 4 : 10)}px ${primaryColor}${isActive ? "aa" : "55"}`,
      }}
    >
      <div className={`rounded-full bg-white/25 backdrop-blur-sm ${compact ? "size-5" : "size-16"}`} />
    </motion.div>
  );
}
