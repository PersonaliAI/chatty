"use client";

import { useEffect, useRef, useState, useMemo, useId } from "react";
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
import { AudioWaveform, Mic, MicOff, Paperclip, Send, X, AlertCircle } from "lucide-react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { SafeMarkdownLink } from "@/lib/safe-markdown-link";
import { InlineBookingCard, ConfirmedMeeting } from "@/components/inline-booking-card";

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
  onBookingSuccess?: (meeting: ConfirmedMeeting) => void;
  previewMode?: boolean;
}

export default function VoiceCallWidget({
  botId,
  sessionId,
  backendUrl,
  originToken,
  visitorTimezone,
  primaryColor,
  onClose,
  onBookingSuccess,
  previewMode = false,
}: VoiceCallWidgetProps) {
  const [status, setStatus] = useState<CallStatus>(previewMode ? "agent-speaking" : "connecting");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [duration, setDuration] = useState(previewMode ? 24 : 0);
  const [localLevels, setLocalLevels] = useState<number[]>(() => Array(WAVE_BAR_COUNT).fill(0));
  const [transcript, setTranscript] = useState<TranscriptEntry[]>(() =>
    previewMode
      ? [
          { id: "p1", speaker: "visitor", text: "Can we schedule a product demo for this Wednesday at 10 AM?", final: true },
          { id: "p2", speaker: "agent", text: "I've confirmed your product demo for Wednesday at 10:00 AM! Here are your meeting details: [BOOKING_WIDGET]", final: true },
        ]
      : []
  );
  const [messageText, setMessageText] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [sendingMessage, setSendingMessage] = useState(false);

  // Auto-extract visitor contact info if spoken/transcribed during the call
  const extractedVisitorInfo = useMemo(() => {
    let name = "";
    let email = "";
    let phone = "";
    let company = "";
    for (const entry of transcript) {
      if (entry.speaker === "visitor" && entry.text) {
        const text = entry.text;
        if (!email) {
          const em = text.match(/\b([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})\b/);
          if (em) email = em[1].toLowerCase();
        }
        if (!phone) {
          const pm = text.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}/);
          if (pm && pm[0].replace(/\D/g, "").length >= 7) phone = pm[0].trim();
        }
        if (!name) {
          const nm = text.match(/(?:my name is|i am|i'm|this is)\s+([A-Za-z]+(?:\s+[A-Za-z]+){1,2})/i);
          if (nm) {
            const cand = nm[1].trim();
            if (!["interested", "looking", "trying", "here", "ready", "fine", "good"].includes(cand.toLowerCase())) {
              name = cand;
            }
          }
        }
        if (!company) {
          const cm = text.match(/(?:company is|work at|work for|company:\s*|from)\s+([A-Za-z0-9&., -]{2,40})/i);
          if (cm) {
            const cand = cm[1].trim();
            if (!["home", "here", "myself"].includes(cand.toLowerCase())) {
              company = cand;
            }
          }
        }
      }
    }
    return { name, email, phone, company };
  }, [transcript]);
  const [confirmedMeeting, setConfirmedMeeting] = useState<ConfirmedMeeting | null>(() =>
    previewMode
      ? {
          meeting_link: "https://meet.google.com/abc-defg-hij",
          formatted_time: "Wednesday, Sep 16 at 10:00 AM",
          summary: "Chatty Product Demo",
          start_time: "2026-09-16T10:00:00Z",
          end_time: "2026-09-16T10:30:00Z",
          attendee_name: "Alex Morgan",
          attendee_email: "alex@personaliai.com",
          assigned_to_email: "sales@personaliai.com",
        }
      : null
  );
  const [showBookingCard, setShowBookingCard] = useState(previewMode);
  const [bookingTriggeredEntryId, setBookingTriggeredEntryId] = useState<string | null>(previewMode ? "p2" : null);

  const roomRef = useRef<Room | null>(null);
  const audioElRef = useRef<HTMLMediaElement | null>(null);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const localLevelFrameRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);
  // Real mic analyser (not a fake random waveform) - lets us tell, just by
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

    if (previewMode) {
      const pulseInterval = setInterval(() => {
        orbLevel.set(0.25 + Math.random() * 0.65);
        setDuration((d) => d + 1);
      }, 400);
      return () => {
        clearInterval(pulseInterval);
        mountedRef.current = false;
      };
    }

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
          else if (res.status === 429) detail = "Too many requests - please wait a moment and try again.";
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

        // Real-time control messages (e.g. show booking widget or confirmed meeting)
        room.on(RoomEvent.DataReceived, (payload: Uint8Array) => {
          if (cancelled || !mountedRef.current) return;
          try {
            const text = new TextDecoder().decode(payload);
            const data = JSON.parse(text);
            if (data?.type === "booking_widget") {
              setShowBookingCard(true);
            } else if (data?.type === "meeting_confirmed" && data?.meeting) {
              setConfirmedMeeting(data.meeting);
              setShowBookingCard(true);
              onBookingSuccess?.(data.meeting);
            }
          } catch {
            // Ignore non-JSON or unrelated packets
          }
        });

        // Live transcript - the agent worker already publishes STT/reply text
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

            if (speaker === "agent") {
              for (const seg of segments) {
                if (seg.text && seg.text.includes("[BOOKING_WIDGET]")) {
                  setBookingTriggeredEntryId(seg.id);
                  setShowBookingCard(true);
                }
              }
            }

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
        // miss inside an embedded iframe) - show an explicit state for this
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

  // Compute the latest agent entry ID in transcript
  const lastAgentEntryId = useMemo(() => {
    for (let i = transcript.length - 1; i >= 0; i--) {
      if (transcript[i].speaker === "agent") {
        return transcript[i].id;
      }
    }
    return null;
  }, [transcript]);

  const activeBookingId = bookingTriggeredEntryId || (showBookingCard ? lastAgentEntryId : null);

  // Auto-scroll the transcript to the newest line as it streams in.
  useEffect(() => {
    if (previewMode) return;
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [transcript, previewMode]);

  // Auto-scroll when booking card appears or meeting confirms
  useEffect(() => {
    if (previewMode) return;
    if (showBookingCard || confirmedMeeting) {
      transcriptEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [showBookingCard, confirmedMeeting, previewMode]);

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

  // Local mic level animation for the 14-bar "listening" waveform - now
  // driven by a real AnalyserNode on the mic track (see analyserRef above)
  // instead of a fake random animation. The "listening" transition itself
  // comes from LiveKit's client-side local audioLevel (ActiveSpeakersChanged
  // below), computed in-browser independent of the server VAD/STT pipeline -
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
        // RMS of the time-domain signal around its 128 midpoint - a real
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

  const sendComposerMessage = async (event: React.FormEvent) => {
    event.preventDefault();
    const text = messageText.trim();
    const file = pendingFile;
    if ((!text && !file) || sendingMessage) return;
    const visitorText = text || `Attachment: ${file?.name || "file"}`;
    setMessageText("");
    setPendingFile(null);
    setTranscript((prev) => [...prev, { id: `typed-${Date.now()}`, speaker: "visitor", text: visitorText, final: true }]);
    setSendingMessage(true);
    try {
      const authHeaders: Record<string, string> = originToken ? { "X-Widget-Token": originToken } : {};
      let response: Response;
      if (file) {
        const body = new FormData();
        body.append("bot_id", botId);
        body.append("session_id", sessionId);
        body.append("text", text);
        body.append("visitor_timezone", visitorTimezone);
        body.append("file", file, file.name);
        response = await fetch(`${backendUrl}/api/widget/chat/media`, { method: "POST", headers: authHeaders, body });
      } else {
        response = await fetch(`${backendUrl}/api/widget/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders },
          body: JSON.stringify({ bot_id: botId, session_id: sessionId, text, visitor_timezone: visitorTimezone }),
        });
      }
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.detail || "Message could not be sent");
      const reply = String(data?.reply || "").trim();
      if (reply) setTranscript((prev) => [...prev, { id: `typed-reply-${Date.now()}`, speaker: "agent", text: reply, final: true }]);
    } catch {
      setTranscript((prev) => [...prev, { id: `typed-error-${Date.now()}`, speaker: "agent", text: "I couldn't send that message. Please try again.", final: true }]);
    } finally {
      setSendingMessage(false);
    }
  };

  const transcriptMdComponents: Components = {
    h1: ({ children }) => <h1 className="mb-2 text-sm font-bold leading-snug">{children}</h1>,
    h2: ({ children }) => <h2 className="mb-1.5 text-xs font-bold leading-snug">{children}</h2>,
    h3: ({ children }) => <h3 className="mb-1 text-xs font-semibold leading-snug">{children}</h3>,
    p: ({ children }) => <p className="mb-1.5 last:mb-0 break-words">{children}</p>,
    ul: ({ children }) => <ul className="mb-1.5 list-disc space-y-0.5 pl-4">{children}</ul>,
    ol: ({ children }) => <ol className="mb-1.5 list-decimal space-y-0.5 pl-4">{children}</ol>,
    li: ({ children }) => <li className="break-words">{children}</li>,
    blockquote: ({ children }) => <blockquote className="my-1.5 border-l-2 border-current/30 pl-2 italic opacity-85">{children}</blockquote>,
    hr: () => <hr className="my-2 border-current/15" />,
    strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
    em: ({ children }) => <em className="italic">{children}</em>,
    a: ({ href, children }) => (
      <SafeMarkdownLink href={href} className="underline break-all" style={{ color: "currentColor" }}>
        {children}
      </SafeMarkdownLink>
    ),
    table: ({ children }) => (
      <div className="my-1.5 max-w-full overflow-x-auto rounded-md border border-current/15">
        <table className="min-w-full text-[10px]">{children}</table>
      </div>
    ),
    thead: ({ children }) => <thead className="bg-black/5 dark:bg-white/5">{children}</thead>,
    th: ({ children }) => <th className="whitespace-nowrap px-2 py-1 text-left font-semibold">{children}</th>,
    td: ({ children }) => <td className="border-t border-current/10 px-2 py-1 align-top">{children}</td>,
    code: ({ className, children, ...rest }) => {
      const isBlock = className?.startsWith("language-");
      if (!isBlock) return <code className="bg-black/10 dark:bg-white/10 px-1 py-0.5 rounded text-[10px] font-mono" {...rest}>{children}</code>;
      return (
        <pre className="my-1.5 max-w-full overflow-x-auto rounded-lg bg-black/10 p-2 text-[10px] leading-relaxed dark:bg-white/10" tabIndex={0}>
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
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-card p-3 sm:p-4">
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
      ) : status === "ended" ? (
        // Distinct end-of-call summary instead of leaving the active-call
        // mute/hangup controls visibly lingering over a disconnected room.
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, ease: [0.34, 1.56, 0.64, 1] }}
          className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-4"
        >
          <div
            className="size-12 rounded-full flex items-center justify-center"
            style={{ background: `${primaryColor}1a` }}
          >
            <X className="size-5" style={{ color: primaryColor }} />
          </div>
          <div>
            <p className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">Call ended</p>
            <p className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-0.5">{fmtDuration(duration)}</p>
          </div>
          <motion.button
            type="button"
            whileTap={{ scale: 0.85 }}
            transition={{ duration: 0.32, ease: [0.34, 1.56, 0.64, 1] }}
            onClick={onClose}
            className="px-4 py-2 rounded-full text-xs font-semibold text-white mt-1"
            style={{ background: primaryColor }}
          >
            Back to chat
          </motion.button>
        </motion.div>
      ) : (
        <>
          {/* Animated voice stage: the orb reacts to the remote speaker while
              the bars prove that the visitor's microphone is live. */}
          <div className="relative shrink-0 overflow-hidden rounded-2xl border border-neutral-200/80 bg-gradient-to-br from-neutral-50 via-white to-orange-50/50 px-3 py-4 dark:border-neutral-800 dark:from-neutral-950 dark:via-neutral-900 dark:to-orange-950/20 sm:px-4 sm:py-5">
            <div className="absolute -right-10 -top-12 size-32 rounded-full blur-3xl opacity-20" style={{ background: primaryColor }} />
            <div className="relative flex flex-col items-center gap-3">
              <Orb status={status} level={orbLevel} primaryColor={primaryColor} />
              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-neutral-500 dark:text-neutral-400">
                <AudioWaveform className="size-3.5" style={{ color: primaryColor }} />
                {status === "listening" ? "Listening" : statusLabel}
              </div>
              <div className="flex items-center justify-center gap-[3px] h-5" aria-label="Microphone activity">
                {localLevels.map((level, i) => (
                  <span key={i} className="w-1 rounded-full transition-[height] duration-[50ms] ease-out" style={{ height: `${Math.max(3, level * 20)}px`, background: primaryColor, opacity: status === "listening" ? 0.9 : 0.25 }} />
                ))}
              </div>
              <span className="text-center text-[10px] text-neutral-400 dark:text-neutral-500">Live transcription · booking enabled</span>
            </div>
          </div>

          {/* Live transcript - auto-scrolls to the newest line; interim
              (not-yet-final) segments render with a bouncy typing indicator
              instead of raw text jitter, then settle into place once final. */}
          <div className={`min-h-[7rem] flex-1 w-full ${previewMode ? "overflow-hidden" : "overflow-y-auto overscroll-contain"} chatty-voice-scrollbar space-y-2 py-2`}>
            {transcript.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <p className="text-[11px] text-neutral-400 dark:text-neutral-500 text-center px-6">
                  {status === "agent-speaking" || status === "listening" || status === "connected"
                    ? "Say something - your conversation will appear here."
                    : ""}
                </p>
              </div>
            ) : (
              <AnimatePresence initial={false}>
                {transcript.map((entry) => {
                  const isAgent = entry.speaker === "agent";
                  const containsBookingTag = isAgent && entry.text.includes("[BOOKING_WIDGET]");
                  const hasBookingOnEntry = isAgent && (entry.id === activeBookingId || containsBookingTag);
                  const cleanText = entry.text.replace(/\[BOOKING_WIDGET\]/g, "").trim();

                    return (
                      <motion.div
                        key={entry.id}
                        initial={{ opacity: 0, y: 8, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ duration: 0.32, ease: [0.34, 1.56, 0.64, 1] }}
                        className={`flex ${entry.speaker === "visitor" ? "justify-end" : "justify-start"} ${hasBookingOnEntry ? "w-full" : ""}`}
                      >
                        <div className={`flex flex-col gap-1 ${entry.speaker === "visitor" ? "items-end" : "items-start"} ${hasBookingOnEntry ? "w-full" : "max-w-[85%]"}`}>
                          <span className="flex items-center gap-1 px-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-neutral-400 dark:text-neutral-500">
                            <span className={`size-1.5 rounded-full ${isAgent ? "bg-emerald-500" : "bg-sky-500"}`} />
                            {isAgent ? "Chatty" : "You"}
                          </span>
                          <div
                            className={`${
                              hasBookingOnEntry ? "w-full p-2" : "max-w-full px-3 py-2"
                            } text-xs leading-relaxed ${
                              entry.speaker === "visitor"
                                ? "user-bubble rounded-br-md"
                                : "bot-bubble rounded-bl-md"
                            }`}
                          >
                        {cleanText ? (
                          <>
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm, remarkMath]}
                              rehypePlugins={[rehypeKatex]}
                              components={transcriptMdComponents}
                            >
                              {cleanText}
                            </ReactMarkdown>
                            {!entry.final && (
                              <span className="inline-block w-1 h-3 ml-0.5 -mb-0.5 bg-current opacity-60 animate-pulse" />
                            )}
                          </>
                        ) : (
                          !hasBookingOnEntry && (
                            <span className="flex items-center gap-1 py-0.5" aria-label="typing">
                              <span className="size-1.5 rounded-full bg-current opacity-60 animate-bounce" />
                              <span className="size-1.5 rounded-full bg-current opacity-60 animate-bounce [animation-delay:150ms]" />
                              <span className="size-1.5 rounded-full bg-current opacity-60 animate-bounce [animation-delay:300ms]" />
                            </span>
                          )
                        )}
                        {hasBookingOnEntry && (
                          <div className="mt-2.5 w-full">
                            <InlineBookingCard
                              botId={botId}
                              sessionId={sessionId}
                              visitorTimezone={visitorTimezone}
                              primaryColor={primaryColor}
                              backendUrl={backendUrl}
                              initialMeeting={confirmedMeeting || undefined}
                              initialName={extractedVisitorInfo.name}
                              initialEmail={extractedVisitorInfo.email}
                              initialPhone={extractedVisitorInfo.phone}
                              initialCompany={extractedVisitorInfo.company}
                              onBookingSuccess={(meeting) => {
                                setConfirmedMeeting(meeting);
                                onBookingSuccess?.(meeting);
                              }}
                              onMeetingRescheduled={(meeting) => {
                                setConfirmedMeeting(meeting);
                                onBookingSuccess?.(meeting);
                              }}
                              onMeetingCancelled={() => {
                                setConfirmedMeeting(null);
                              }}
                            />
                          </div>
                        )}
                          </div>
                        </div>
                      </motion.div>
                    );
                })}
              </AnimatePresence>
            )}
            <div ref={transcriptEndRef} />
          </div>

          <form onSubmit={sendComposerMessage} className="mb-2 flex min-w-0 shrink-0 items-center gap-1.5 rounded-2xl border border-neutral-200 bg-white/80 p-1.5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/80 sm:mb-3 sm:gap-2 sm:p-2">
            <input type="file" className="hidden" id="chatty-voice-attachment-app" accept="image/*,.pdf,.doc,.docx,.txt" onChange={(event) => setPendingFile(event.target.files?.[0] || null)} />
            <button type="button" onClick={() => document.getElementById("chatty-voice-attachment-app")?.click()} aria-label="Attach a file" title="Attach a file" className="grid size-9 shrink-0 place-items-center rounded-xl text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-800 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"><Paperclip className="size-4" /></button>
            <div className="min-w-0 flex-1">
              <input value={messageText} onChange={(event) => setMessageText(event.target.value)} placeholder={pendingFile ? pendingFile.name : "Send a message while you talk…"} disabled={sendingMessage} className="w-full bg-transparent px-1 text-xs text-neutral-800 outline-none placeholder:text-neutral-400 disabled:opacity-60 dark:text-neutral-200" />
              {pendingFile && <p className="truncate px-1 text-[9px] text-neutral-400">Attachment ready · click send to share</p>}
            </div>
            <button type="submit" disabled={sendingMessage || (!messageText.trim() && !pendingFile)} aria-label="Send message" title="Send message" className="grid size-9 shrink-0 place-items-center rounded-xl text-white shadow-sm transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-35" style={{ background: primaryColor }}><Send className="size-4" /></button>
          </form>

          <div className="flex shrink-0 items-center gap-3 pb-1 pt-1 sm:gap-4 sm:pb-2">
            <motion.button
              type="button"
              whileTap={{ scale: 0.85 }}
              transition={{ duration: 0.32, ease: [0.34, 1.56, 0.64, 1] }}
              onClick={toggleMute}
              disabled={status === "connecting" || status === "requesting-mic"}
              aria-label={muted ? "Unmute microphone" : "Mute microphone"}
              className="flex size-11 items-center justify-center rounded-2xl border transition-colors disabled:opacity-40 sm:size-12"
              style={{ background: muted ? `${primaryColor}18` : primaryColor, borderColor: muted ? `${primaryColor}45` : primaryColor, color: muted ? primaryColor : "#fff", boxShadow: muted ? "none" : `0 8px 20px ${primaryColor}35` }}
            >
              {muted ? <MicOff className="size-5" /> : <Mic className="size-5" />}
            </motion.button>
            <motion.button
              type="button"
              whileTap={{ scale: 0.85 }}
              transition={{ duration: 0.32, ease: [0.34, 1.56, 0.64, 1] }}
              onClick={handleHangup}
              aria-label="Close voice call"
              title="Close voice call"
              className="flex size-11 items-center justify-center rounded-2xl text-white shadow-lg transition-transform hover:scale-105 sm:size-12"
              style={{ background: "#1f2937" }}
            >
              <X className="size-5" />
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
  const [glow, setGlow] = useState(0);

  useEffect(() => {
    const unsub = level.on("change", (v) => {
      setGlow(v);
    });
    return () => unsub();
  }, [level]);

  const isActive = status === "agent-speaking";
  const noiseInstanceId = useId().replace(/:/g, "");
  const noiseId = `chatty-fluid-noise-${noiseInstanceId}-${compact ? "compact" : "full"}`;
  const blobSize = compact ? "size-8" : "size-[78%]";

  return (
    <motion.div
      animate={{ scale: 1 }}
      className={`relative isolate shrink-0 overflow-hidden rounded-full flex items-center justify-center ${compact ? "size-9" : "size-28"}`}
      style={{
        background: "linear-gradient(145deg, #062b42 0%, #087e98 48%, #6caa78 100%)",
        boxShadow: `0 0 ${(compact ? 8 : 20) + (isActive ? glow * (compact ? 20 : 60) : compact ? 4 : 10)}px ${primaryColor}${isActive ? "aa" : "55"}`,
      }}
    >
      <svg aria-hidden="true" className="absolute size-0" focusable="false">
        <defs>
          <filter id={noiseId} x="-25%" y="-25%" width="150%" height="150%">
            <feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="3" seed="9" result="noise">
              <animate attributeName="baseFrequency" values="0.009;0.016;0.011;0.009" dur="5.5s" repeatCount="indefinite" />
            </feTurbulence>
            <feDisplacementMap in="SourceGraphic" in2="noise" scale={compact ? 5 : 18} xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
      </svg>
      <div className="absolute inset-[-18%]" style={{ filter: `url(#${noiseId})` }}>
        <motion.div
          className={`absolute ${blobSize} rounded-full blur-[10px] sm:blur-[18px]`}
          style={{ left: "-8%", top: "-12%", background: "radial-gradient(circle at 55% 55%, rgba(34,211,238,.98), rgba(14,116,144,.68) 48%, transparent 73%)", mixBlendMode: "screen" }}
          animate={{ x: ["-8%", "34%", "5%", "-8%"], y: ["8%", "-12%", "26%", "8%"], scale: [1, 1.18, 0.9, 1] }}
          transition={{ duration: 6.5, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className={`absolute ${blobSize} rounded-full blur-[10px] sm:blur-[19px]`}
          style={{ right: "-12%", top: "10%", background: "radial-gradient(circle at 45% 50%, rgba(96,165,250,.95), rgba(37,99,235,.58) 46%, transparent 74%)", mixBlendMode: "screen" }}
          animate={{ x: ["5%", "-22%", "10%", "5%"], y: ["-8%", "22%", "6%", "-8%"], scale: [0.92, 1.16, 1.04, 0.92] }}
          transition={{ duration: 7.5, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className={`absolute ${blobSize} rounded-full blur-[11px] sm:blur-[20px]`}
          style={{ left: "18%", bottom: "-22%", background: "radial-gradient(circle at 50% 42%, rgba(134,239,172,.96), rgba(34,197,94,.58) 45%, transparent 74%)", mixBlendMode: "screen" }}
          animate={{ x: ["4%", "-18%", "24%", "4%"], y: ["0%", "-24%", "-4%", "0%"], scale: [1, 0.88, 1.2, 1] }}
          transition={{ duration: 8.5, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className={`absolute ${blobSize} rounded-full blur-[9px] sm:blur-[16px]`}
          style={{ left: "30%", top: "12%", background: "radial-gradient(circle, rgba(253,224,71,.9), rgba(250,204,21,.48) 42%, transparent 70%)", mixBlendMode: "screen" }}
          animate={{ x: ["0%", "18%", "-16%", "0%"], y: ["0%", "28%", "16%", "0%"], scale: [0.76, 1.08, 0.9, 0.76] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-full"
        style={{ background: "radial-gradient(circle at 32% 24%, rgba(255,255,255,.42), transparent 24%), radial-gradient(circle at 62% 70%, rgba(8,30,50,.24), transparent 55%)", mixBlendMode: "screen" }}
        animate={{ opacity: isActive ? [0.7, 1, 0.72] : [0.55, 0.82, 0.55] }}
        transition={{ duration: isActive ? 2.4 : 4.5, repeat: Infinity, ease: "easeInOut" }}
      />
    </motion.div>
  );
}
