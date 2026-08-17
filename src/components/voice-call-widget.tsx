"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useSpring } from "framer-motion";
import { Room, RoomEvent, Track, RemoteTrack, RemoteParticipant, ConnectionState } from "livekit-client";
import { Mic, MicOff, PhoneOff, Loader2, AlertCircle } from "lucide-react";

const WAVE_BAR_COUNT = 14;

type CallStatus = "connecting" | "connected" | "listening" | "agent-speaking" | "error" | "ended";

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

  const roomRef = useRef<Room | null>(null);
  const audioElRef = useRef<HTMLMediaElement | null>(null);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const localLevelFrameRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

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
            if (prev === "connecting" || prev === "error" || prev === "ended") return prev;
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
        await room.localParticipant.setMicrophoneEnabled(true);
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
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Call duration timer, starts once connected.
  useEffect(() => {
    if (status === "connecting" || status === "error") return;
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

  // Local mic level animation for the 14-bar "listening" waveform, mirroring
  // the visual style of the record-button waveform elsewhere in the widget.
  useEffect(() => {
    if (status !== "listening") {
      setLocalLevels(Array(WAVE_BAR_COUNT).fill(0));
      return;
    }
    let stopped = false;
    const tick = () => {
      if (stopped) return;
      const room = roomRef.current;
      const localAudioTrack = room?.localParticipant
        ? Array.from(room.localParticipant.audioTrackPublications.values())[0]?.track
        : undefined;
      const base = localAudioTrack ? 0.35 : 0;
      const levels = Array.from({ length: WAVE_BAR_COUNT }, () => Math.min(1, base + Math.random() * 0.65));
      setLocalLevels(levels);
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

  const fmtDuration = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  };

  const statusLabel = (() => {
    switch (status) {
      case "connecting": return "Connecting…";
      case "connected": return fmtDuration(duration);
      case "listening": return "Listening…";
      case "agent-speaking": return "Speaking…";
      case "ended": return "Call ended";
      case "error": return errorMessage || "Something went wrong";
      default: return "";
    }
  })();

  return (
    <div className="flex-1 flex flex-col items-center justify-between p-6 bg-card h-full">
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
          <div className="flex-1 flex flex-col items-center justify-center gap-6 w-full">
            <Orb status={status} level={orbLevel} primaryColor={primaryColor} />

            {status === "listening" ? (
              <div className="flex items-center gap-[3px] h-6" aria-hidden>
                {localLevels.map((level, i) => (
                  <span
                    key={i}
                    className="w-0.5 rounded-full transition-[height] duration-[50ms] ease-out"
                    style={{ height: `${Math.max(3, level * 24)}px`, background: primaryColor }}
                  />
                ))}
              </div>
            ) : (
              <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 tracking-wide">
                {status === "connecting" && <Loader2 className="inline size-3.5 animate-spin mr-1.5 -mt-0.5" />}
                {statusLabel}
              </p>
            )}
          </div>

          <div className="flex items-center gap-4 pb-2">
            <motion.button
              type="button"
              whileTap={{ scale: 0.85 }}
              transition={{ duration: 0.32, ease: [0.34, 1.56, 0.64, 1] }}
              onClick={toggleMute}
              disabled={status === "connecting" || status === "ended"}
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
}: {
  status: CallStatus;
  level: ReturnType<typeof useSpring>;
  primaryColor: string;
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
          : status === "connecting"
          ? { scale: [1, 1.06, 1] }
          : { scale: 1 }
      }
      transition={
        isActive
          ? { duration: 0.32, ease: [0.34, 1.56, 0.64, 1] }
          : { duration: 1.8, repeat: Infinity, ease: "easeInOut" }
      }
      className="size-28 rounded-full flex items-center justify-center"
      style={{
        background: `radial-gradient(circle at 35% 30%, ${primaryColor}dd, ${primaryColor}88)`,
        boxShadow: `0 0 ${20 + (isActive ? glow * 60 : 10)}px ${primaryColor}${isActive ? "aa" : "55"}`,
      }}
    >
      <div className="size-16 rounded-full bg-white/25 backdrop-blur-sm" />
    </motion.div>
  );
}
