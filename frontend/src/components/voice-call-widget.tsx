"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { visitorIdentityClient } from "../../packages/chatty-react/src/visitor-identity";
import { motion, AnimatePresence } from "framer-motion";
import {
  Room,
  RoomEvent,
  Track,
  RemoteTrack,
  ConnectionState,
  TranscriptionSegment,
  Participant,
} from "livekit-client";
import {
  PhoneOff,
  X,
  AlertCircle,
} from "lucide-react";

import {
  LiveKitAudioVisualizer,
  type VisualizerType,
  type AgentVisualizerState,
} from "@/components/livekit-agents-ui/audio-visualizers";
import { LiveKitControlBar } from "@/components/livekit-agents-ui/control-bar";
import {
  AgentChatTranscript,
  type TranscriptItem,
} from "@/components/livekit-agents-ui/agent-chat-transcript";
import { AgentChatIndicator } from "@/components/livekit-agents-ui/agent-chat-indicator";
import { StartAudioButton } from "@/components/livekit-agents-ui/start-audio-button";
import {
  type VoiceUiSettingsData,
  DEFAULT_VOICE_UI_SETTINGS,
} from "@/app/dashboard/tabs/VoiceUiCustomizer";
import { InlineBookingCard, ConfirmedMeeting } from "@/components/inline-booking-card";
import { ProductCard, type ProductCardData } from "@/components/product-card";
import { VideoCard, type VideoClipData } from "@/components/video-card";
import { parseRichContent } from "@/lib/rich-content";

const MICROPHONE_PERMISSION_TIMEOUT_MS = 15000;

const MICROPHONE_CAPTURE_OPTIONS = {
  autoGainControl: true,
  echoCancellation: true,
  noiseSuppression: true,
  channelCount: 1,
} as const;

type CallStatus =
  | "connecting"
  | "reconnecting"
  | "requesting-mic"
  | "connected"
  | "listening"
  | "thinking"
  | "agent-speaking"
  | "error"
  | "ended";

function normalizeTranscriptText(text: string): string {
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * Merge room transcript segments cleanly to avoid duplicates between interim
 * speech hypotheses and final transcription packets.
 */
function mergeTranscriptSegment(
  entries: TranscriptItem[],
  segment: TranscriptItem,
  now: number,
  recentFinals: Map<string, number>
): TranscriptItem[] {
  const next = [...entries];
  const normalized = normalizeTranscriptText(segment.text);
  if (!normalized) return next;
  const exact = next.findIndex((entry) => entry.id === segment.id);
  if (exact >= 0) {
    next[exact] = segment;
    return next;
  }

  for (const [key, at] of recentFinals) {
    if (now - at > 10000) recentFinals.delete(key);
  }
  const key = `${segment.speaker}:${normalized}`;
  if (segment.final && (recentFinals.get(key) ?? 0) > now - 10000) return next;

  if (
    next.some(
      (entry) =>
        entry.speaker === segment.speaker &&
        entry.final &&
        normalizeTranscriptText(entry.text) === normalized
    )
  ) {
    return next;
  }

  for (let i = next.length - 1; i >= 0; i -= 1) {
    const previous = next[i];
    if (previous.speaker !== segment.speaker) break;
    if (!previous.final) {
      next[i] = segment;
      if (segment.final) recentFinals.set(key, now);
      return next;
    }
  }

  if (segment.final) {
    recentFinals.set(key, now);
  }
  next.push(segment);
  return next;
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
  voiceUiSettings?: VoiceUiSettingsData;
  showCloseButton?: boolean;
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
  voiceUiSettings,
  showCloseButton = false,
}: VoiceCallWidgetProps) {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const fetch = sessionId.startsWith("ci-")
    ? visitorIdentityClient(botId, backendUrl).fetch
    : globalThis.fetch;

  const [status, setStatus] = useState<CallStatus>(previewMode ? "agent-speaking" : "connecting");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [duration, setDuration] = useState(previewMode ? 24 : 0);
  const [localAudioLevel, setLocalAudioLevel] = useState(0);
  const [agentAudioLevel, setAgentAudioLevel] = useState(0);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [connectAttempt, setConnectAttempt] = useState(0);

  const [transcript, setTranscript] = useState<TranscriptItem[]>(() =>
    previewMode
      ? [
          {
            id: "p1",
            speaker: "visitor",
            text: "Can we schedule a product demo for this Wednesday at 10 AM?",
            final: true,
          },
          {
            id: "p2",
            speaker: "agent",
            text: "I've confirmed your product demo for Wednesday at 10:00 AM! Here are your meeting details: [BOOKING_WIDGET]",
            final: true,
          },
        ]
      : []
  );


  // Auto-extract visitor info from spoken transcript for booking convenience
  const extractedVisitorInfo = useMemo(() => {
    let name = "";
    let email = "";
    let phone = "";
    let company = "";
    for (const entry of transcript) {
      if (entry.speaker === "visitor" && entry.text) {
        const text = entry.text;
        if (!email) {
          const normalizedEmailText = text.replace(/\s+at\s+/gi, "@").replace(/\s+dot\s+/gi, ".");
          const spelled = normalizedEmailText.match(
            /(?:\b(?:email|address)\b[^\n]{0,30})?((?:[A-Za-z]\s+){2,}[A-Za-z])\s*@\s*([A-Za-z0-9.-]+\.[A-Za-z]{2,})/i
          );
          const extractedEmail = spelled
            ? `${spelled[1].replace(/\s+/g, "")}@${spelled[2]}`
            : normalizedEmailText.match(/\b([A-Za-z0-9._%+-]+\s*@\s*[A-Za-z0-9.-]+\.[A-Za-z]{2,})\b/)?.[1] || "";
          if (extractedEmail) email = extractedEmail.replace(/\s+/g, "").toLowerCase();
        }
        if (!phone) {
          const pm = text.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}/);
          if (pm && pm[0].replace(/\D/g, "").length >= 7) phone = pm[0].trim();
        }
        if (!name) {
          const nm = text.match(
            /(?:my name is|i am|i'm|this is)\s+([A-Za-z][A-Za-z'’-]*(?:\s+[A-Za-z][A-Za-z'’-]*){0,2})/i
          );
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
  const [bookingTriggeredEntryId, setBookingTriggeredEntryId] = useState<string | null>(
    previewMode ? "p2" : null
  );

  const roomRef = useRef<Room | null>(null);
  const audioElRef = useRef<HTMLMediaElement | null>(null);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);
  const richPacketIdsRef = useRef(new Set<string>());
  const recentFinalTranscriptRef = useRef(new Map<string, number>());
  const analyserRef = useRef<AnalyserNode | null>(null);
  const localLevelFrameRef = useRef<number | null>(null);

  // Internal Voice UI settings fallback if not passed directly as prop
  const [internalVoiceUiSettings, setInternalVoiceUiSettings] = useState<VoiceUiSettingsData | null>(null);

  useEffect(() => {
    if (voiceUiSettings) return;
    if (!botId || !backendUrl) return;
    let cancelled = false;
    fetch(`${backendUrl}/api/widget/theme?bot_id=${encodeURIComponent(botId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        if (
          data.voice_message_mode &&
          typeof data.voice_message_mode === "string" &&
          data.voice_message_mode.startsWith("{")
        ) {
          try {
            setInternalVoiceUiSettings({
              ...DEFAULT_VOICE_UI_SETTINGS,
              ...JSON.parse(data.voice_message_mode),
            });
          } catch {}
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [botId, backendUrl, voiceUiSettings]);

  const effectiveVoiceUi = useMemo<VoiceUiSettingsData>(() => {
    return voiceUiSettings || internalVoiceUiSettings || DEFAULT_VOICE_UI_SETTINGS;
  }, [voiceUiSettings, internalVoiceUiSettings]);

  // Compute active visualizer style (defaulting cleanly to "aura" and cyan)
  const visualizerType: VisualizerType = effectiveVoiceUi.visualizerType || "aura";
  const visualizerColor = effectiveVoiceUi.visualizerColor || primaryColor || "#1FD5F9";

  // Guard against hanging "thinking" state when backend LLM fails or times out
  useEffect(() => {
    if (status !== "thinking") return;
    const timer = setTimeout(() => {
      setStatus("listening");
      setTranscript((prev) => [
        ...prev,
        {
          id: `timeout-${Date.now()}`,
          speaker: "agent",
          text: "I didn't receive a response from the AI assistant in time. Please check your AI API key or try again.",
          final: true,
        },
      ]);
    }, 15000);
    return () => clearTimeout(timer);
  }, [status]);

  // Compute visualizer state string
  const visualizerState: AgentVisualizerState = useMemo(() => {
    switch (status) {
      case "agent-speaking":
        return "speaking";
      case "thinking":
        return "thinking";
      case "listening":
        return "listening";
      case "connecting":
      case "requesting-mic":
      case "reconnecting":
        return "connecting";
      case "ended":
        return "ended";
      default:
        return "idle";
    }
  }, [status]);

  // Connect to LiveKit Room
  useEffect(() => {
    if (previewMode) return;
    let cancelled = false;
    mountedRef.current = true;

    async function start() {
      try {
        setStatus("connecting");
        setErrorMessage(null);

        const authHeaders: Record<string, string> = originToken
          ? { "X-Widget-Token": originToken }
          : {};

        const res = await fetch(`${backendUrl}/api/widget/voice/token`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders },
          body: JSON.stringify({
            bot_id: botId,
            session_id: sessionId,
            visitor_timezone: visitorTimezone,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.detail || "Failed to acquire voice token");
        }

        const { token, livekit_url } = await res.json();
        if (cancelled) return;

        const room = new Room({
          adaptiveStream: true,
          dynacast: true,
          audioCaptureDefaults: MICROPHONE_CAPTURE_OPTIONS,
        });
        roomRef.current = room;

        room.on(RoomEvent.Disconnected, () => {
          if (!cancelled && mountedRef.current && roomRef.current === room) {
            setErrorMessage("The voice connection was lost. Reconnect to continue.");
            setStatus("error");
          }
        });

        room.on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
          if (cancelled || !mountedRef.current) return;
          if (state === ConnectionState.Reconnecting) {
            setStatus("reconnecting");
          } else if (state === ConnectionState.Connected) {
            setStatus((s) => (s === "agent-speaking" ? s : "connected"));
          }
        });

        // Remote Audio track attachment & autoplay handling
        room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
          if (track.kind === Track.Kind.Audio) {
            const el = track.attach();
            el.autoplay = true;
            el.setAttribute("playsinline", "true");
            audioElRef.current = el;
            document.body.appendChild(el);

            void el
              .play()
              .then(() => setAudioBlocked(false))
              .catch(() => {
                if (!cancelled && mountedRef.current) setAudioBlocked(true);
              });
          }
        });

        room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
          track.detach().forEach((el) => el.remove());
        });

        // Data received from worker (booking cards, products, errors)
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
            } else if (data?.type === "product_card" && data?.product) {
              const productId = String(
                data.product.id || data.product.sku || data.product.title || "product"
              );
              if (!richPacketIdsRef.current.has(`product:${productId}`)) {
                richPacketIdsRef.current.add(`product:${productId}`);
                setTranscript((prev) => [
                  ...prev,
                  {
                    id: `voice-product-${productId}`,
                    speaker: "agent",
                    text: `[PRODUCT_CARD:${JSON.stringify(data.product)}]`,
                    final: true,
                  },
                ]);
              }
            } else if (data?.type === "video_clip" && data?.clip) {
              const clipId = String(data.clip.video_url || data.clip.title || "video");
              if (!richPacketIdsRef.current.has(`video:${clipId}`)) {
                richPacketIdsRef.current.add(`video:${clipId}`);
                setTranscript((prev) => [
                  ...prev,
                  {
                    id: `voice-video-${clipId}`,
                    speaker: "agent",
                    text: `[VIDEO_CLIP:${JSON.stringify(data.clip)}]`,
                    final: true,
                  },
                ]);
              }
            } else if (data?.type === "voice_error") {
              const message = String(
                data.message || "Voice audio failed. Please try again."
              );
              setErrorMessage(message);
              setStatus("listening");
              setTranscript((prev) => [
                ...prev,
                { id: `voice-error-${Date.now()}`, speaker: "agent", text: message, final: true },
              ]);
            }
          } catch {
            // Ignore non-json packets
          }
        });

        // Real-time live transcript from LiveKit
        room.on(
          RoomEvent.TranscriptionReceived,
          (segments: TranscriptionSegment[], participant?: Participant) => {
            if (cancelled || !mountedRef.current) return;
            const speaker: "visitor" | "agent" =
              participant && participant.identity === room?.localParticipant?.identity
                ? "visitor"
                : "agent";

            if (speaker === "agent") {
              for (const seg of segments) {
                if (seg.text && seg.text.includes("[BOOKING_WIDGET]")) {
                  setBookingTriggeredEntryId(seg.id);
                  setShowBookingCard(true);
                }
              }
            }

            setTranscript((prev) => {
              let next = prev;
              for (const seg of segments) {
                if (!seg.text?.trim()) continue;
                const entry: TranscriptItem = {
                  id: seg.id,
                  speaker,
                  text: seg.text,
                  final: seg.final,
                  timestamp: Date.now(),
                };
                next = mergeTranscriptSegment(
                  next,
                  entry,
                  Date.now(),
                  recentFinalTranscriptRef.current
                );
              }
              return next;
            });
          }
        );

        // Active speaker levels for visualizers
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

          setAgentAudioLevel(remoteLevel);

          setStatus((prev) => {
            if (
              prev === "connecting" ||
              prev === "reconnecting" ||
              prev === "requesting-mic" ||
              prev === "error" ||
              prev === "ended"
            ) {
              return prev;
            }
            if (remoteLevel > 0.02) return "agent-speaking";
            if (localSpeaking) return "listening";
            return "connected";
          });
        });

        await room.connect(livekit_url, token);
        if (cancelled) {
          room.disconnect();
          return;
        }

        if (!cancelled && mountedRef.current) setStatus("requesting-mic");
        let microphoneTimeout: number | undefined;
        try {
          await Promise.race([
            room.localParticipant.setMicrophoneEnabled(true, MICROPHONE_CAPTURE_OPTIONS),
            new Promise<never>((_, reject) => {
              microphoneTimeout = window.setTimeout(
                () => reject(new Error("MICROPHONE_PERMISSION_TIMEOUT")),
                MICROPHONE_PERMISSION_TIMEOUT_MS
              );
            }),
          ]);
        } catch (micErr) {
          console.error("Microphone permission failed:", micErr);
          if (!cancelled && mountedRef.current) {
            const micMessage =
              micErr instanceof Error && micErr.message === "MICROPHONE_PERMISSION_TIMEOUT"
                ? "Microphone permission is pending. Please allow microphone access and try again."
                : "Microphone access is required for voice calls. Please allow microphone access in your browser and try again.";
            setErrorMessage(micMessage);
            setStatus("error");
          }
          room.disconnect();
          return;
        } finally {
          if (microphoneTimeout !== undefined) window.clearTimeout(microphoneTimeout);
        }

        if (!cancelled && mountedRef.current) setStatus("connected");
      } catch (err) {
        console.error("Voice call failed to start:", err);
        if (!cancelled && mountedRef.current) {
          setErrorMessage("Couldn't start the call, please try again.");
          setStatus("error");
        }
        roomRef.current?.disconnect();
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
      if (localLevelFrameRef.current) cancelAnimationFrame(localLevelFrameRef.current);
    };
  }, [connectAttempt, botId, sessionId, backendUrl, originToken, visitorTimezone, previewMode]);

  // Real AnalyserNode on local mic
  useEffect(() => {
    if (status !== "listening") {
      setLocalAudioLevel(0);
      return;
    }
    let stopped = false;
    const bins = new Uint8Array(analyserRef.current?.frequencyBinCount ?? 128);
    const tick = () => {
      if (stopped) return;
      const analyser = analyserRef.current;
      if (analyser) {
        analyser.getByteTimeDomainData(bins);
        let sumSquares = 0;
        for (let i = 0; i < bins.length; i++) {
          const centered = (bins[i] - 128) / 128;
          sumSquares += centered * centered;
        }
        const rms = Math.sqrt(sumSquares / bins.length);
        setLocalAudioLevel(Math.min(1, rms * 4));
      }
      localLevelFrameRef.current = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      stopped = true;
      if (localLevelFrameRef.current) cancelAnimationFrame(localLevelFrameRef.current);
    };
  }, [status]);

  // Call duration counter
  useEffect(() => {
    if (
      status === "connecting" ||
      status === "reconnecting" ||
      status === "requesting-mic" ||
      status === "error"
    ) {
      return;
    }
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

  const toggleMute = async () => {
    const room = roomRef.current;
    if (!room) return;
    const next = !muted;
    await room.localParticipant.setMicrophoneEnabled(
      !next,
      next ? undefined : MICROPHONE_CAPTURE_OPTIONS
    );
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

  const retryVoiceConnection = () => {
    const room = roomRef.current;
    roomRef.current = null;
    if (room) {
      room.localParticipant.setMicrophoneEnabled(false).catch(() => {});
      room.disconnect();
    }
    setErrorMessage(null);
    setStatus("connecting");
    setConnectAttempt((attempt) => attempt + 1);
  };

  const enableAudio = async () => {
    const room = roomRef.current;
    try {
      await room?.startAudio();
    } catch {
      // Fall through to manual play
    }
    const audio = audioElRef.current;
    if (!audio) return;
    void audio
      .play()
      .then(() => setAudioBlocked(false))
      .catch(() => setAudioBlocked(true));
  };

  const handleSendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    recentFinalTranscriptRef.current.set(
      `visitor:${normalizeTranscriptText(trimmed)}`,
      Date.now()
    );
    setTranscript((prev) => [
      ...prev,
      { id: `typed-${Date.now()}`, speaker: "visitor", text: trimmed, final: true },
    ]);

    if (previewMode) {
      setTimeout(() => {
        setTranscript((prev) => [
          ...prev,
          {
            id: `typed-preview-${Date.now()}`,
            speaker: "agent",
            text: "Thanks for your message! This is a demo preview of the voice agent chat.",
            final: true,
          },
        ]);
        setStatus("agent-speaking");
      }, 600);
      return;
    }

    try {
      const room = roomRef.current;
      if (room && room.state === ConnectionState.Connected) {
        await room.localParticipant.sendText(trimmed, { topic: "lk.chat" });
        setStatus("thinking");
      } else {
        setErrorMessage("Voice connection is still starting. Please try again.");
      }
    } catch {
      setTranscript((prev) => [
        ...prev,
        {
          id: `typed-error-${Date.now()}`,
          speaker: "agent",
          text: "I couldn't send that message. Please try again.",
          final: true,
        },
      ]);
    }
  };

  const fmtDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const statusLabel = useMemo(() => {
    switch (status) {
      case "connecting":
        return "Connecting…";
      case "requesting-mic":
        return "Waiting for mic…";
      case "reconnecting":
        return "Reconnecting…";
      case "connected":
        return "Connected";
      case "listening":
        return "Listening…";
      case "thinking":
        return "Thinking…";
      case "agent-speaking":
        return "Speaking…";
      case "ended":
        return "Call ended";
      case "error":
        return errorMessage || "Something went wrong";
      default:
        return "";
    }
  }, [status, errorMessage]);

  // Compute the latest agent entry ID in transcript for booking
  const lastAgentEntryId = useMemo(() => {
    for (let i = transcript.length - 1; i >= 0; i--) {
      if (transcript[i].speaker === "agent") {
        return transcript[i].id;
      }
    }
    return null;
  }, [transcript]);

  const activeBookingId = bookingTriggeredEntryId || (showBookingCard ? lastAgentEntryId : null);

  // Render Rich Embedded Card inside transcript
  const renderRichCard = (entry: TranscriptItem) => {
    const isAgent = entry.speaker === "agent";
    if (!isAgent) return null;

    const containsBookingTag = entry.text.includes("[BOOKING_WIDGET]");
    const hasBookingOnEntry = entry.id === activeBookingId || containsBookingTag;
    const rich = parseRichContent<ProductCardData, VideoClipData>(entry.text);
    const hasRichCards = rich.products.length > 0 || rich.videoClips.length > 0;

    return (
      <div className="w-full space-y-2">
        {hasRichCards && (
          <div className="w-full space-y-1">
            {rich.products.map((product, index) => (
              <ProductCard
                key={`${product.id || product.sku || product.title}-${index}`}
                product={product}
                primaryColor={primaryColor}
              />
            ))}
            {rich.videoClips.map((clip, index) => (
              <VideoCard
                key={`${clip.video_url}-${index}`}
                clip={clip}
                primaryColor={primaryColor}
              />
            ))}
          </div>
        )}
        {hasBookingOnEntry && (
          <div className="w-full">
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
              preferredText={transcript.slice(-4).map((t) => t.text).join(" ")}
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
    );
  };

  return (
    <div
      data-slot="livekit-voice-agent"
      className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-[28px] border border-neutral-200/90 bg-card p-3 shadow-2xl backdrop-blur-md dark:border-neutral-800 dark:bg-neutral-950 sm:p-4"
    >
      {/* Top Header Bar */}
      <div className="flex shrink-0 items-center justify-between pb-3 border-b border-neutral-100 dark:border-neutral-800/80">
        <div className="flex items-center gap-2">
          <div className="relative flex items-center justify-center">
            <span
              className={`size-2.5 rounded-full ${
                status === "agent-speaking"
                  ? "bg-emerald-500 animate-pulse"
                  : status === "listening"
                  ? "bg-sky-500 animate-pulse"
                  : status === "thinking"
                  ? "bg-amber-500 animate-pulse"
                  : status === "error"
                  ? "bg-rose-500"
                  : "bg-emerald-500"
              }`}
            />
            {status === "agent-speaking" && (
              <span className="absolute size-4 rounded-full bg-emerald-500/30 animate-ping" />
            )}
          </div>
          <div>
            <h4 className="text-xs font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
              LiveKit Voice Agent
            </h4>
            <span className="text-[10px] text-neutral-500 dark:text-neutral-400 capitalize">
              {statusLabel}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {status !== "ended" && status !== "error" && (
            <span className="rounded-full bg-neutral-100 dark:bg-neutral-800 px-2.5 py-0.5 font-mono text-[11px] font-medium text-neutral-600 dark:text-neutral-300">
              {fmtDuration(duration)}
            </span>
          )}
          {showCloseButton && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close voice call"
              className="grid size-7 place-items-center rounded-full text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200 transition-colors cursor-pointer"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      {status === "error" ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
          <div className="grid size-12 place-items-center rounded-full bg-rose-50 text-rose-500 dark:bg-rose-950/40">
            <AlertCircle className="size-6" />
          </div>
          <div>
            <h5 className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
              Connection Issue
            </h5>
            <p className="mt-1 max-w-[240px] text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
              {errorMessage}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={retryVoiceConnection}
              className="rounded-full px-4 py-2 text-xs font-semibold text-white shadow-sm transition-transform active:scale-95 cursor-pointer"
              style={{ background: primaryColor }}
            >
              Reconnect voice
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-neutral-200 px-4 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      ) : status === "ended" ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-1 flex-col items-center justify-center gap-3 px-4 text-center"
        >
          <div
            className="grid size-12 place-items-center rounded-full"
            style={{ background: `${primaryColor}1a` }}
          >
            <PhoneOff className="size-5" style={{ color: primaryColor }} />
          </div>
          <div>
            <h5 className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
              Call Completed
            </h5>
            <p className="mt-0.5 text-[11px] text-neutral-400 dark:text-neutral-500 font-mono">
              Total duration: {fmtDuration(duration)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="mt-2 rounded-full px-5 py-2 text-xs font-semibold text-white shadow-sm transition-transform active:scale-95 cursor-pointer"
            style={{ background: primaryColor }}
          >
            Back to Chat
          </button>
        </motion.div>
      ) : (
        <div className="relative flex flex-1 min-h-0 flex-col overflow-hidden py-2">
          {/* Audio Unblock Notification if browser blocked autoplay */}
          {audioBlocked && (
            <div className="mb-2 flex items-center justify-center">
              <StartAudioButton
                label="Click to Enable Agent Audio"
                primaryColor={primaryColor}
                onClick={enableAudio}
              />
            </div>
          )}

          {/* Switchable Stage: Visualizer Tile vs Transcript Stream */}
          <div className="relative flex-1 min-h-0 w-full overflow-hidden">
            <AnimatePresence mode="wait">
              {!isChatOpen ? (
                /* OFFICIAL LIVEKIT VISUALIZER VIEW */
                <motion.div
                  key="visualizer-view"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.25 }}
                  className="flex h-full w-full flex-col items-center justify-center gap-4 py-4"
                >
                  <div className="relative flex size-[260px] sm:size-[300px] items-center justify-center">
                    <LiveKitAudioVisualizer
                      type={visualizerType}
                      state={visualizerState}
                      color={visualizerColor}
                      size={effectiveVoiceUi.visualizerSize || "lg"}
                      barCount={effectiveVoiceUi.visualizerBarCount}
                      rowCount={effectiveVoiceUi.visualizerRowCount}
                      columnCount={effectiveVoiceUi.visualizerColumnCount}
                      radius={effectiveVoiceUi.visualizerRadius}
                      colorShift={effectiveVoiceUi.visualizerColorShift}
                      lineWidth={effectiveVoiceUi.visualizerLineWidth}
                      audioLevel={status === "agent-speaking" ? agentAudioLevel : localAudioLevel}
                    />
                  </div>

                  {/* Status Shimmer Prompt */}
                  <div className="flex flex-col items-center gap-1.5 text-center">
                    {status === "thinking" ? (
                      <div className="flex items-center gap-2 text-xs font-medium text-neutral-600 dark:text-neutral-300">
                        <AgentChatIndicator size="sm" />
                        <span className="animate-pulse">Thinking…</span>
                      </div>
                    ) : (
                      <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                        {status === "agent-speaking"
                          ? "Agent is speaking…"
                          : status === "listening"
                          ? "Listening to you…"
                          : "Agent is listening, speak or tap chat"}
                      </p>
                    )}
                    <span className="text-[10px] text-neutral-400 dark:text-neutral-500">
                      Realtime audio · natural interruption supported
                    </span>
                  </div>
                </motion.div>
              ) : (
                /* OFFICIAL LIVEKIT TRANSCRIPT VIEW */
                <motion.div
                  key="transcript-view"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.25 }}
                  className="h-full w-full overflow-hidden"
                >
                  <AgentChatTranscript
                    agentState={status === "thinking" ? "thinking" : "idle"}
                    messages={transcript}
                    primaryColor={primaryColor}
                    renderRichCard={renderRichCard}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Official LiveKit Control Bar */}
          <div className="w-full pt-3">
            <LiveKitControlBar
              variant={effectiveVoiceUi.controlBarVariant || "livekit"}
              controls={{
                leave: effectiveVoiceUi.controls?.leave !== false,
                microphone: effectiveVoiceUi.controls?.microphone !== false,
                chat: effectiveVoiceUi.controls?.chat !== false,
              }}
              muted={muted}
              onToggleMute={toggleMute}
              onDisconnect={handleHangup}
              primaryColor={visualizerColor}
              isChatOpen={isChatOpen}
              onToggleChat={() => setIsChatOpen((v) => !v)}
              onSendMessage={handleSendMessage}
              disabled={status === "connecting" || status === "reconnecting"}
            />
          </div>
        </div>
      )}

      {/* Powered By Footer */}
      <div className="shrink-0 pt-2 text-center text-[10px] tracking-wide text-neutral-400 dark:text-neutral-500">
        Powered by{" "}
        <a
          href="https://chatty.personaliai.com"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold hover:underline"
        >
          Chatty
        </a>
      </div>
    </div>
  );
}
