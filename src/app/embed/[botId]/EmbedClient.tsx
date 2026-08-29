"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";
import { SafeMarkdownLink } from "@/lib/safe-markdown-link";
import "katex/dist/katex.min.css";
import { motion, AnimatePresence } from "framer-motion";
import { QuickEmojiPicker } from "@/components/quick-emoji-picker";
import { AttachMenu } from "@/components/attach-menu";
import VoiceCallWidget from "@/components/voice-call-widget";
import { getOnColor, primaryColorCssVars, buildColorSchemeCss, type WidgetColorScheme } from "@/lib/color-contrast";
import { normalizeWidgetStyle } from "@/lib/widget-style";
import {
  Send, Loader2, Sparkles, MessageSquare, FileText, Search,
  Paperclip, Smile, Mic, ChevronRight, ArrowLeft, X,
  ArrowUp, ArrowRight, RefreshCw, Bot, Headphones, User, Check, AlertCircle,
  Link2, ThumbsUp, ThumbsDown, Mail, Bell, Phone, Play, Pause, Trash2,
  type LucideIcon,
} from "lucide-react";

// Preset assistant avatar icons (selectable in the customizer).
const AVATAR_ICONS: Record<string, LucideIcon> = {
  bot: Bot, headset: Headphones, sparkles: Sparkles, message: MessageSquare, user: User,
};
import { useSearchParams } from "next/navigation";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "https://api.chatty.personaliai.com";

const RECORD_BAR_COUNT = 14;

// The default placeholder content a voice message gets when the visitor
// didn't type an accompanying caption (set where the message is created,
// below) — used to skip rendering it as redundant text under the player.
const VOICE_MESSAGE_PLACEHOLDER = "🎤 Voice message";

// A WhatsApp/Telegram-style voice-message player: play/pause + a seekable
// waveform + elapsed/duration, themed entirely through `currentColor` and
// `color-mix()` (see .audio-bubble-* rules in globals.css) so it
// automatically matches whichever design preset (and primaryColor) the
// surrounding .user-bubble/.bot-bubble is already using. Mirrors
// packages/chatty-react/src/ChatWidgetCore.tsx's AudioBubble exactly — this
// route is a separate, parallel widget implementation, not a consumer of
// that package.
function AudioBubble({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  // There's no real peak/amplitude data for a recorded clip, so the bars are
  // a deterministic pseudo-waveform hashed from the src URL — the same
  // message always renders the same bar pattern (rather than a fresh random
  // shape on every re-render, which would look broken/flickery).
  const bars = useMemo(() => {
    let seed = 0;
    for (let i = 0; i < src.length; i++) seed = (seed * 31 + src.charCodeAt(i)) >>> 0;
    return Array.from({ length: 24 }, () => {
      seed = (seed * 1103515245 + 12345) >>> 0;
      return 0.28 + ((seed >>> 8) % 100) / 100 * 0.72;
    });
  }, [src]);

  const progress = duration > 0 ? currentTime / duration : 0;

  const togglePlay = () => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) el.pause();
    else el.play().catch(() => {});
  };

  const seek: React.MouseEventHandler<HTMLDivElement> = (e) => {
    const el = audioRef.current;
    if (!el || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const fraction = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    el.currentTime = fraction * duration;
    setCurrentTime(el.currentTime);
  };

  const fmt = (s: number) => {
    if (!isFinite(s) || s < 0) s = 0;
    const m = Math.floor(s / 60), sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="audio-bubble flex items-center gap-2.5 py-0.5 min-w-[188px] max-w-[220px]">
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setCurrentTime(0); }}
        className="hidden"
      />
      <button
        type="button"
        onClick={togglePlay}
        aria-label={playing ? "Pause voice message" : "Play voice message"}
        className="audio-bubble-btn shrink-0 size-8 rounded-full flex items-center justify-center transition-transform active:scale-90 cursor-pointer"
      >
        {playing ? <Pause className="size-3.5 fill-current" /> : <Play className="size-3.5 fill-current ml-0.5" />}
      </button>
      <div className="flex-1 flex items-center gap-[2.5px] h-5 cursor-pointer" onClick={seek}>
        {bars.map((h, idx) => (
          <span
            key={idx}
            className="audio-bubble-bar w-[2.5px] rounded-full shrink-0"
            style={{ height: `${h * 100}%`, opacity: idx / bars.length < progress ? 1 : 0.35 }}
          />
        ))}
      </div>
      <span className="audio-bubble-time text-[10px] tabular-nums opacity-70 shrink-0">
        {fmt(playing || currentTime > 0 ? currentTime : duration)}
      </span>
    </div>
  );
}

// Send-button variants (icon + shape). Keyed by chatty_bots.send_button_style.
const SEND_BUTTON_STYLES: Record<string, { shape: string; icon: React.ReactNode; label?: string }> = {
  plane:      { shape: "size-8 rounded-full",        icon: <Send className="size-4" /> },
  arrowUp:    { shape: "size-8 rounded-full",        icon: <ArrowUp className="size-4" /> },
  arrowRight: { shape: "size-8 rounded-full",        icon: <ArrowRight className="size-4" /> },
  square:     { shape: "size-8 rounded-lg",          icon: <Send className="size-4" /> },
  label:      { shape: "h-8 px-3.5 rounded-full gap-1.5", icon: <Send className="size-3.5" />, label: "Send" },
};

// Browsers record audio as webm/opus, which Gemini does NOT accept. Decode and
// re-encode to 16-bit mono WAV (a Gemini-supported format) client-side.
async function audioBlobToWav(blob: Blob): Promise<Blob> {
  const AC: typeof AudioContext = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
  const ctx = new AC();
  const audioBuf = await ctx.decodeAudioData(await blob.arrayBuffer());
  ctx.close();
  const len = audioBuf.length;
  // A near-instant tap-to-stop can decode to an AudioBuffer with ~0 samples —
  // that still produces a "valid" (44-byte-header) WAV with no audio content,
  // which Gemini silently treats as empty. Require a minimum of ~150ms.
  if (len < audioBuf.sampleRate * 0.15) {
    throw new Error("Recording too short");
  }
  const rate = audioBuf.sampleRate;
  const numCh = audioBuf.numberOfChannels;
  const mono = new Float32Array(len);
  for (let ch = 0; ch < numCh; ch++) {
    const d = audioBuf.getChannelData(ch);
    for (let i = 0; i < len; i++) mono[i] += d[i] / numCh;
  }
  const view = new DataView(new ArrayBuffer(44 + len * 2));
  const ws = (o: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)); };
  ws(0, "RIFF"); view.setUint32(4, 36 + len * 2, true); ws(8, "WAVE"); ws(12, "fmt ");
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true); view.setUint16(32, 2, true);
  view.setUint16(34, 16, true); ws(36, "data"); view.setUint32(40, len * 2, true);
  let off = 44;
  for (let i = 0; i < len; i++) { const s = Math.max(-1, Math.min(1, mono[i])); view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true); off += 2; }
  return new Blob([view], { type: "audio/wav" });
}

interface Citation { name: string; type: string; url?: string | null; }
interface Message {
  role: "user" | "assistant";
  content: string;
  fileUrl?: string;
  fileType?: string;
  sources?: Citation[];
  feedback?: "up" | "down";
  // Only set on assistant messages, and only meaningful when the customizer's
  // "show AI / Human tag" setting is on. /api/widget/poll and /api/widget/live
  // only ever return human-agent replies (server-side filtered), so any
  // message arriving through those two paths is unambiguously "human" —
  // everything else assistant-role is a direct AI reply.
  sender?: "ai" | "human";
}
interface Source { id: string; name: string; content: string; }

// Visual-flow config parsed out of the bot's custom JS (built by the flow
// builder in the dashboard). Nodes/edges follow React Flow's shape.
interface FlowNode {
  id: string;
  type?: string;
  data?: { label?: string };
}
interface FlowEdge {
  source: string;
  target: string;
  label?: string;
  data?: { label?: string };
}
interface FlowConfig {
  status?: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
}

type Tab = "home" | "messages" | "articles" | "search";

function CodeBlock({ lang, text }: { lang: string; text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <div className="my-2 rounded-lg overflow-hidden border border-neutral-200 dark:border-neutral-700 text-[11px]">
      <div className="flex items-center justify-between px-3 py-1.5 bg-neutral-100 dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700">
        <span className="text-neutral-500 dark:text-neutral-400 font-mono">{lang}</span>
        <button
          onClick={copy}
          className="flex items-center gap-1 text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-100 transition-colors"
        >
          {copied ? <Check className="size-3" /> : <svg className="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>}
          <span>{copied ? "Copied!" : "Copy"}</span>
        </button>
      </div>
      <pre className="p-3 overflow-x-auto bg-neutral-50 dark:bg-neutral-900 font-mono leading-relaxed whitespace-pre">
        <code>{text}</code>
      </pre>
    </div>
  );
}

interface EmbedClientProps {
  botId: string;
  originToken: string | null;
}

export default function EmbedClient({ botId, originToken }: EmbedClientProps) {
  const widgetTokenHeader: Record<string, string> = originToken ? { "X-Widget-Token": originToken } : {};
  const searchParams = useSearchParams();
  const paramColor = searchParams.get("color");
  const paramStyle = searchParams.get("style");
  const isPreview = searchParams.get("preview") === "true";
  const paramName = searchParams.get("name");
  const paramWelcome = searchParams.get("welcome");
  const paramAvatarIcon = searchParams.get("avatar_icon");
  const paramAvatarUrl = searchParams.get("avatar_url");
  const paramLogoUrl = searchParams.get("logo_url");
  const paramLogoBgColor = searchParams.get("logo_bg_color");
  const paramShowSenderTag = searchParams.get("show_sender_tag");
  const paramCsatEnabled = searchParams.get("csat_enabled");
  const paramColorScheme = searchParams.get("color_scheme");
  const paramFont = searchParams.get("font");
  const paramFontSizePercent = searchParams.get("font_size_percent");

  // Scope stored session + history per embedding site, so different host sites
  // (and the dashboard playground) don't share one conversation.
  const hostKey = (() => {
    if (typeof window === "undefined") return "direct";
    try {
      const p = new URLSearchParams(window.location.search).get("host");
      if (p) return p;
      if (document.referrer) return new URL(document.referrer).hostname;
    } catch {}
    return "direct";
  })();

  // Notify the parent widget loader of a new assistant reply (unread badge).
  const notifyParent = () => {
    try { window.parent?.postMessage({ type: "chatty:message", role: "assistant" }, "*"); } catch {}
  };

  const avatarInner = (iconCls: string) => {
    // avatarUrl/logoUrl are bot-owner-uploaded URLs (or arbitrary external URLs
    // via query params in preview mode) not in next/image's domain allowlist.
    if (avatarIcon === "custom" && avatarUrl) return <img src={avatarUrl} alt="" className="size-full object-cover" />; // eslint-disable-line @next/next/no-img-element
    if (avatarIcon && avatarIcon !== "logo" && AVATAR_ICONS[avatarIcon]) {
      const Icon = AVATAR_ICONS[avatarIcon];
      return <Icon className={iconCls} />;
    }
    if (logoUrl) return <img src={logoUrl} alt="" className="size-full object-cover" />; // eslint-disable-line @next/next/no-img-element
    return botName[0]?.toUpperCase();
  };

  const headerLogoInner = (iconCls: string) => {
    if (logoUrl) return <img src={logoUrl} alt="" className="w-[34px] h-[34px] object-contain rounded-full" />; // eslint-disable-line @next/next/no-img-element
    return avatarInner(iconCls);
  };

  const clearChat = () => {
    const fresh = `v-${crypto.randomUUID()}`;
    try {
      localStorage.setItem(`chatty_sid_${botId}_${hostKey}`, fresh);
      localStorage.removeItem(`chatty_msgs_${botId}_${hostKey}`);
    } catch {}
    setSessionId(fresh);
    lastPollRef.current = new Date().toISOString();

    if (flowConfig) {
      const startEdge = flowConfig.edges?.find((e) => e.source === "start");
      if (startEdge) {
        const firstNode = flowConfig.nodes?.find((n) => n.id === startEdge.target);
        if (firstNode) {
          setMessages([]);
          executeFlowNode(firstNode, flowConfig);
          return;
        }
      }
    }
    setMessages([{ role: "assistant", content: welcomeMsg, sender: "ai" }]);
  };

  const [loading, setLoading] = useState(true);
  const [botName, setBotName] = useState("Chatty Assistant");
  const [welcomeMsg, setWelcomeMsg] = useState("Hello! How can I help you today?");
  const [starters, setStarters] = useState<string[]>([]);
  const [sendStyle, setSendStyle] = useState("plane");
  const [avatarIcon, setAvatarIcon] = useState("logo");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [hideBranding, setHideBranding] = useState(false);
  const [showSenderTag, setShowSenderTag] = useState(false);
  const [csatEnabled, setCsatEnabled] = useState(true);
  const [customCss, setCustomCss] = useState("");
  const [customJs, setCustomJs] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#f97316");
  // Guaranteed-legible text color for anything painted with primaryColor —
  // the business owner picks that color freely, so a hardcoded white/black
  // text class goes invisible the moment they pick the "wrong" half of the
  // lightness spectrum. Computed via WCAG contrast, not assumed.
  const onPrimary = getOnColor(primaryColor);
  const [widgetStyle, setWidgetStyle] = useState("minimal");
  // Per-section colors (header/bot-bubble/user-bubble/input-bar/send-btn) —
  // null until the owner sets at least one in the Customizer, at which
  // point it takes over from the preset's own primaryColor-driven CSS
  // entirely (applied via an injected !important stylesheet below, the
  // only thing that reliably beats globals.css's .style-* !important rules).
  const [colorScheme, setColorScheme] = useState<WidgetColorScheme | null>(null);
  // null = keep the active design preset's own default font.
  const [fontFamily, setFontFamily] = useState<string | null>(null);
  const [fontSizePercent, setFontSizePercent] = useState(100);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoBgColor, setLogoBgColor] = useState("");
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  // What a finished in-chat voice recording turns into — set on
  // chatty_bots.voice_message_mode (Customizer > Voice Messages).
  const [voiceMessageMode, setVoiceMessageMode] = useState<"transcribe" | "audio">("transcribe");
  const [voiceCallOpen, setVoiceCallOpen] = useState(false);

  const [tab, setTab] = useState<Tab>("messages");
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isBotResponding, setIsBotResponding] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);

  // setSources is currently unused: the Articles tab renders from this list but
  // nothing yet populates it from the backend (help-articles feed isn't wired up).
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [sources, setSources] = useState<Source[]>([]);
  const [openArticle, setOpenArticle] = useState<Source | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchAnswer, setSearchAnswer] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);

  // ── CSAT, Offline Ticketing, & Typing States ──
  const [showCsat, setShowCsat] = useState(false);
  const [csatRating, setCsatRating] = useState(0);
  const [csatComment, setCsatComment] = useState("");
  const [csatSubmitted, setCsatSubmitted] = useState(false);

  const [showOfflineForm, setShowOfflineForm] = useState(false);
  const [offlineEmail, setOfflineEmail] = useState("");
  const [offlineMessage, setOfflineMessage] = useState("");
  const [offlineSubmitted, setOfflineSubmitted] = useState(false);

  const [agentTyping, setAgentTyping] = useState(false);
  // Told by widget.js (postMessage) whenever it switches the panel between
  // the fixed-size desktop popup and mobile-fullscreen — see the message
  // listener below. Defaults to false (rounded), which is also correct for
  // the dashboard's own preview iframe, which never goes through widget.js
  // and so never sends this message.
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Browser Push Notifications (OneSignal / Native Web Push)
  // Initial value read lazily (not via an effect + setState) so the browser's
  // existing Notification permission is reflected on the very first render.
  const [pushGranted, setPushGranted] = useState(() => {
    if (typeof window === "undefined") return false;
    return "Notification" in window && Notification.permission === "granted";
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleMessage = (e: MessageEvent) => {
      // The embed can be hosted on any customer domain, so the parent's
      // origin isn't known ahead of time — restrict to messages that
      // actually came from our own parent frame instead.
      if (e.source !== window.parent) return;
      if (e.data && e.data.type === "chatty-notification-status") {
        setPushGranted(!!e.data.granted);
      }
      if (e.data && e.data.type === "chatty-fullscreen") {
        setIsFullscreen(!!e.data.value);
      }
    };
    window.addEventListener("message", handleMessage);

    // Prevent trackpad pinch-to-zoom (which sends ctrlKey + wheel or gesture events)
    // inside the iframe from causing visual viewport magnification and text blurriness.
    const preventPinch = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
      }
    };
    const preventGesture = (e: Event) => e.preventDefault();

    window.addEventListener("wheel", preventPinch, { passive: false });
    window.addEventListener("gesturestart", preventGesture);
    window.addEventListener("gesturechange", preventGesture);

    return () => {
      window.removeEventListener("message", handleMessage);
      window.removeEventListener("wheel", preventPinch);
      window.removeEventListener("gesturestart", preventGesture);
      window.removeEventListener("gesturechange", preventGesture);
    };
  }, []);

  const requestPushPermission = async () => {
    if (typeof window === "undefined") return;

    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({
          type: "chatty-request-notification",
          botName,
          avatarUrl: avatarUrl || undefined,
        }, "*");
      }
    } catch {}

    if ("Notification" in window) {
      try {
        const perm = await Notification.requestPermission();
        if (perm === "granted") {
          setPushGranted(true);
          try {
            new Notification(botName, {
              body: "Notifications enabled! You'll be alerted when support or AI replies.",
              icon: avatarUrl || undefined,
            });
          } catch {}
        } else if (perm === "denied") {
          setPushGranted(false);
          alert("Notification permission was blocked. Please allow notifications in your browser location bar.");
        }
      } catch (err) {
        console.warn("Notification request delegated to parent window", err);
      }
    } else {
      alert("Browser push notifications are not supported on this browser.");
    }
  };

  const triggerPushRef = useRef<(bodyText: string) => void>(() => {});
  const triggerPush = (bodyText: string) => {
    if (typeof window === "undefined") return;
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({
          type: "chatty-trigger-notification",
          botName,
          bodyText,
          avatarUrl: avatarUrl || undefined,
        }, "*");
      }
    } catch {}

    if ("Notification" in window && Notification.permission === "granted" && document.hidden) {
      try {
        new Notification(botName, {
          body: bodyText,
          icon: avatarUrl || undefined,
        });
      } catch {}
    }
  };
  triggerPushRef.current = triggerPush;

  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [flowConfig, setFlowConfig] = useState<FlowConfig | null>(null);
  // Track whether the active node is a question node waiting for user typed input
  const [flowAwaitingInput, setFlowAwaitingInput] = useState(false);

  const cleanLabel = (label: string = "") => {
    return label
      .replace(/^💬\s*(Message:\s*)?/, "")
      .replace(/^❓\s*(Ask:\s*)?/, "")
      .replace(/^🏷️\s*(Tag session:\s*)?/, "")
      .replace(/^🔔\s*(Escalate to Live Agent\s*)?/, "");
  };

  const isQuestionNode = (node: FlowNode | null | undefined) => {
    const label = node?.data?.label || "";
    return label.startsWith("❓") || node?.type === "question" || node?.id?.startsWith("q-");
  };

  const executeFlowNode = (node: FlowNode | null | undefined, currentConfig: FlowConfig | null | undefined) => {
    if (!node || !currentConfig) return;
    const label = node.data?.label || "";

    // Tag node — run silently, auto-advance
    if (label.startsWith("🏷️") || node.id?.startsWith("tag-")) {
      const tagValue = label.replace(/^🏷️\s*(Tag session:\s*)?/, "").replace(/['",]/g, "").trim();
      fetch(`${BACKEND_URL}/api/widget/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bot_id: botId, session_id: sessionId, text: `[Flow tag: ${tagValue}]`, is_private_note: true })
      }).catch(() => {});
      const nextEdge = currentConfig.edges.find((e) => e.source === node.id);
      if (nextEdge) {
        const nextNode = currentConfig.nodes.find((n) => n.id === nextEdge.target);
        if (nextNode) executeFlowNode(nextNode, currentConfig);
      }
    }
    // Escalate node
    else if (label.startsWith("🔔") || node.id?.startsWith("esc-")) {
      setLiveAgent(true);
      setFlowAwaitingInput(false);
      setActiveNodeId(null);
      setMessages((prev) => [...prev, { role: "assistant", content: "Connecting you to a live agent now..." }]);
      fetch(`${BACKEND_URL}/api/widget/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bot_id: botId, session_id: sessionId, text: "[Visitor requested live agent via flow]", ai_paused: true })
      }).catch(() => {});
    }
    // Question node — display question, wait for typed user input (no branch buttons)
    else if (isQuestionNode(node)) {
      setActiveNodeId(node.id);
      setFlowAwaitingInput(true);
      setIsBotResponding(false);
      setMessages((prev) => [...prev, { role: "assistant", content: cleanLabel(label), sender: "ai" }]);
    }
    // Message node — display, then auto-advance if single unlabeled edge, or show choice buttons
    else {
      setActiveNodeId(node.id);
      setFlowAwaitingInput(false);
      setIsBotResponding(false);
      setMessages((prev) => [...prev, { role: "assistant", content: cleanLabel(label), sender: "ai" }]);
      const outgoing = currentConfig.edges.filter((e) => e.source === node.id);
      if (outgoing.length === 1 && !outgoing[0].label && !outgoing[0].data?.label) {
        // Linear — auto-advance after short delay
        setTimeout(() => {
          const nextNode = currentConfig.nodes.find((n) => n.id === outgoing[0].target);
          if (nextNode) executeFlowNode(nextNode, currentConfig);
        }, 900);
      }
      // Multiple labeled edges → stay on node, show buttons (handled in render)
    }
  };

  // React Flow stores edge labels in edge.label OR edge.data?.label — resolve both.
  const getEdgeLabel = (edge: FlowEdge): string => edge.label || edge.data?.label || "";

  const handleFlowChoice = (edge: FlowEdge) => {
    if (!flowConfig) return;
    const label = getEdgeLabel(edge);
    setMessages((prev) => [...prev, { role: "user", content: label || "Continue" }]);
    const targetNode = flowConfig.nodes.find((n) => n.id === edge.target);
    if (targetNode) {
      executeFlowNode(targetNode, flowConfig);
    } else {
      // Flow ended — hand off to real AI
      setActiveNodeId(null);
      setFlowAwaitingInput(false);
    }
  };

  const submitCsat = async () => {
    if (csatRating === 0) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/widget/csat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...widgetTokenHeader },
        body: JSON.stringify({
          bot_id: botId,
          session_id: sessionId,
          rating: csatRating,
          comment: csatComment,
        }),
      });
      if (!res.ok) throw new Error("csat submit failed");
      setCsatSubmitted(true);
      showToast("Thank you for your feedback!", "success");
      setTimeout(() => { setShowCsat(false); try { window.parent?.postMessage({ type: "chatty:close" }, "*"); } catch {} }, 1500);
    } catch {
      showToast("Failed to submit feedback.", "error");
    }
  };

  const submitOfflineMessage = async () => {
    if (!offlineEmail.trim() || !offlineMessage.trim()) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/widget/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...widgetTokenHeader },
        body: JSON.stringify({
          bot_id: botId,
          session_id: sessionId,
          text: `[Offline Support Ticket]\nEmail: ${offlineEmail}\nMessage: ${offlineMessage}`,
          visitor_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          host: getHost(),
        }),
      });
      if (res.ok) {
        setOfflineSubmitted(true);
        showToast("Ticket submitted successfully!", "success");
        setOfflineEmail("");
        setOfflineMessage("");
        setTimeout(() => { setShowOfflineForm(false); setOfflineSubmitted(false); }, 2000);
      } else {
        showToast("Error sending message.", "error");
      }
    } catch {
      showToast("Failed to connect to support.", "error");
    }
  };

  const handleCloseClick = () => {
    if (csatEnabled && messages.length > 2 && !csatSubmitted) {
      setShowCsat(true);
    } else {
      try { window.parent?.postMessage({ type: "chatty:close" }, "*"); } catch {}
    }
  };

  const [recording, setRecording] = useState(false);
  const [barLevels, setBarLevels] = useState<number[]>(() => Array(RECORD_BAR_COUNT).fill(0));
  const [transcribing, setTranscribing] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const recordingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Set by cancelRecording() right before stopping the recorder, so
  // mr.onstop knows to discard the take silently instead of transcribing/
  // sending it — MediaRecorder only has one stop event, not a separate
  // cancel one.
  const recordingCancelledRef = useRef(false);

  const [liveAgent, setLiveAgent] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [pendingFiles, setPendingFiles] = useState<{file: File; preview: string}[]>([]);
  const lastPollRef = useRef<string>(new Date().toISOString());

  // Custom toast state
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
  };
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Cleanup blob URLs for pending file previews on unmount
  useEffect(() => {
    return () => {
      pendingFiles.forEach(pf => { if (pf.preview) URL.revokeObjectURL(pf.preview); });
    };
    // Intentionally runs only on true unmount — revokes whatever files are
    // pending at that point via closure, not meant to re-run per pendingFiles change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persistent per-visitor session id (survives reloads, unique per visitor)
  const [sessionId, setSessionId] = useState(() => {
    if (typeof window === "undefined") return `widget-session-${botId}`;
    const k = `chatty_sid_${botId}_${hostKey}`;
    let s = localStorage.getItem(k);
    if (!s) { s = `v-${crypto.randomUUID()}`; localStorage.setItem(k, s); }
    return s;
  });

  // Restore prior messages from localStorage
  useEffect(() => {
    if (typeof window === "undefined" || !botId) return;
    try {
      const raw = localStorage.getItem(`chatty_msgs_${botId}_${hostKey}`);
      if (raw) {
        const saved = JSON.parse(raw);
        if (Array.isArray(saved) && saved.length) setMessages(saved);
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [botId]);

  // Reset html and body backgrounds to transparent to prevent white corners in rounded iframe borders
  useEffect(() => {
    if (typeof window !== "undefined") {
      document.documentElement.style.setProperty("background-color", "transparent", "important");
      document.body.style.setProperty("background-color", "transparent", "important");
    }
  }, []);

  // Persist messages (cap to last 100)
  useEffect(() => {
    if (typeof window === "undefined" || !botId || messages.length === 0) return;
    try { localStorage.setItem(`chatty_msgs_${botId}_${hostKey}`, JSON.stringify(messages.slice(-100))); } catch {}
  }, [messages, botId, hostKey]);

  // Live human-agent replies via SSE (one persistent connection). Falls back
  // to the /poll endpoint if the stream can't be established.
  useEffect(() => {
    if (!botId || !sessionId) return;
    let stopped = false;
    const ctrl = new AbortController();

    const applyEvent = (payload: { type: string; content?: string; created_at?: string; value?: boolean }) => {
      if (payload.type === "message") {
        if (payload.created_at) lastPollRef.current = payload.created_at;
        const textContent = payload.content || "";
        setMessages((p) => [...p, { role: "assistant" as const, content: textContent, sender: "ai" }]);
        setIsBotResponding(false);
        setAgentTyping(false);
        triggerPushRef.current(textContent);
        notifyParent();
      } else if (payload.type === "ai_paused") {
        setLiveAgent(!!payload.value);
      } else if (payload.type === "typing") {
        setAgentTyping(!!payload.value);
      }
    };

    const pollOnce = async () => {
      try {
        const url = `${BACKEND_URL}/api/widget/poll?bot_id=${botId}&session_id=${encodeURIComponent(sessionId)}&after=${encodeURIComponent(lastPollRef.current)}`;
        const res = await fetch(url, { signal: ctrl.signal });
        if (!res.ok) return;
        const d = await res.json();
        setLiveAgent(!!d.ai_paused);
        if (Array.isArray(d.messages) && d.messages.length) {
          lastPollRef.current = d.messages[d.messages.length - 1].created_at;
          // /api/widget/poll only ever returns human-agent replies (server-side
          // filtered by sender="human"), so every message here is human.
          const newMsgs = d.messages.map((m: { content: string }) => ({ role: "assistant" as const, content: m.content, sender: "human" as const }));
          setMessages((p) => [...p, ...newMsgs]);
          setIsBotResponding(false);
          setAgentTyping(false);
          if (newMsgs[0]?.content) triggerPushRef.current(newMsgs[0].content);
          notifyParent();
        }
      } catch {}
    };

    const run = async () => {
      while (!stopped) {
        try {
          const url = `${BACKEND_URL}/api/widget/live?bot_id=${botId}&session_id=${encodeURIComponent(sessionId)}&after=${encodeURIComponent(lastPollRef.current)}`;
          const res = await fetch(url, { signal: ctrl.signal });
          if (!res.ok || !res.body) throw new Error("no stream");
          const reader = res.body.getReader();
          const dec = new TextDecoder();
          let buf = "";
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += dec.decode(value, { stream: true });
            let sep: number;
            while ((sep = buf.indexOf("\n\n")) >= 0) {
              const frame = buf.slice(0, sep); buf = buf.slice(sep + 2);
              const line = frame.split("\n").find((l) => l.startsWith("data:"));
              if (!line) continue;
              try { applyEvent(JSON.parse(line.slice(5).trim())); } catch {}
            }
          }
          // Server closed the stream (~4 min) — loop reconnects immediately.
        } catch {
          if (stopped || ctrl.signal.aborted) return;
          await pollOnce();
          await new Promise((r) => setTimeout(r, 4000));
        }
      }
    };
    run();
    return () => { stopped = true; ctrl.abort(); };
  }, [botId, sessionId]);

  // One-shot manual refetch of any new messages since the last poll — used
  // right after a voice call ends so the transcript (written server-side by
  // the voice worker) shows up promptly instead of waiting for the next
  // SSE/poll cycle.
  const refetchNow = async () => {
    try {
      const url = `${BACKEND_URL}/api/widget/poll?bot_id=${botId}&session_id=${encodeURIComponent(sessionId)}&after=${encodeURIComponent(lastPollRef.current)}`;
      const res = await fetch(url);
      if (!res.ok) return;
      const d = await res.json();
      setLiveAgent(!!d.ai_paused);
      if (Array.isArray(d.messages) && d.messages.length) {
        lastPollRef.current = d.messages[d.messages.length - 1].created_at;
        // Same endpoint as pollOnce above — human-agent replies only.
        const newMsgs = d.messages.map((m: { content: string }) => ({ role: "assistant" as const, content: m.content, sender: "human" as const }));
        setMessages((p) => [...p, ...newMsgs]);
        notifyParent();
      }
    } catch {}
  };

  const getHost = (): string => {
    try { if (typeof document !== "undefined" && document.referrer) return new URL(document.referrer).hostname; } catch {}
    return searchParams.get("host") || "";
  };

  const isOfficialWebsite = (() => {
    if (typeof window === "undefined") return true;
    const host = getHost().toLowerCase();
    return host === "chatty.personaliai.com" || host.endsWith(".chatty.personaliai.com");
  })();

  useEffect(() => {
    async function loadBot() {
      if (!botId) return;
      try {
        // Load config from the backend (service role) — works inside third-party
        // iframes where the browser Supabase client is blocked by storage partitioning.
        const res = await fetch(`${BACKEND_URL}/api/widget/theme?bot_id=${encodeURIComponent(String(botId))}&t=${Date.now()}`);
        if (res.ok) {
          const bot = await res.json();
          // In preview mode (dashboard playground), query parameters override DB values
          // so the user sees their unsaved changes in real time.
          // In production, DB values take priority so dashboard edits apply automatically.
          setBotName(isPreview ? (paramName || bot.name || "Chatty Assistant") : (bot.name || "Chatty Assistant"));
          const wMsg = isPreview ? (paramWelcome || bot.welcome_message || "Hello! How can I help you today?") : (bot.welcome_message || "Hello! How can I help you today?");
          setWelcomeMsg(wMsg);
          setStarters(Array.isArray(bot.conversation_starters) ? bot.conversation_starters.filter(Boolean) : []);
          setSendStyle(bot.send_button_style || "plane");
          setAvatarIcon(isPreview ? (paramAvatarIcon || bot.avatar_icon || "logo") : (bot.avatar_icon || "logo"));
          setAvatarUrl(isPreview ? (paramAvatarUrl || bot.avatar_url || null) : (bot.avatar_url || null));
          setPrimaryColor(isPreview ? (paramColor || bot.primary_color || "#f97316") : (bot.primary_color || paramColor || "#f97316"));
          const rawStyle = isPreview ? (paramStyle || bot.widget_style || "minimal") : (bot.widget_style || paramStyle || "minimal");
          const [styleName, dbLogoBg] = rawStyle.split(":");
          setWidgetStyle(normalizeWidgetStyle(styleName));
          if (isPreview) {
            setLogoBgColor(paramLogoBgColor ?? dbLogoBg ?? "");
          } else {
            setLogoBgColor(dbLogoBg || "");
          }
          setLogoUrl(isPreview ? (paramLogoUrl || bot.logo_url || null) : (bot.logo_url || null));
          setHideBranding(!!bot.hide_branding);
          setShowSenderTag(isPreview && paramShowSenderTag !== null ? paramShowSenderTag === "true" : !!bot.show_sender_tag);
          setCsatEnabled(isPreview && paramCsatEnabled !== null ? paramCsatEnabled === "true" : bot.csat_enabled !== false);
          setVoiceEnabled(!!bot.voice_enabled);
          setVoiceMessageMode(bot.voice_message_mode === "audio" ? "audio" : "transcribe");
          try {
            const rawScheme = isPreview ? (paramColorScheme || (bot.color_scheme ? JSON.stringify(bot.color_scheme) : null)) : (bot.color_scheme ? JSON.stringify(bot.color_scheme) : null);
            setColorScheme(rawScheme ? JSON.parse(rawScheme) : null);
          } catch { setColorScheme(null); }
          setFontFamily(isPreview ? (paramFont || bot.font_family || null) : (bot.font_family || paramFont || null));
          const rawFontSize = isPreview ? (paramFontSizePercent || bot.font_size_percent) : (bot.font_size_percent || paramFontSizePercent);
          const parsedFontSize = parseInt(String(rawFontSize), 10);
          setFontSizePercent(Number.isFinite(parsedFontSize) && parsedFontSize > 0 ? parsedFontSize : 100);
          setCustomCss(bot.custom_css || "");
          setCustomJs(bot.custom_js || "");
          setMessages((prev) => prev.length ? prev : [{ role: "assistant", content: wMsg, sender: "ai" }]);
        }
      } catch (err) {
        console.error("Failed to load bot:", err);
      } finally {
        setLoading(false);
        try { window.parent?.postMessage({ type: "chatty:ready" }, "*"); } catch {}
      }
    }
    loadBot();
  }, [botId, paramColor, paramStyle, isPreview, paramName, paramWelcome, paramAvatarIcon, paramAvatarUrl, paramLogoUrl, paramLogoBgColor, paramShowSenderTag, paramCsatEnabled, paramColorScheme, paramFont, paramFontSizePercent]);

  // Run the bot owner's custom JS once, after the widget config has loaded. Scoped to
  // this embed iframe only — same trust model as the owner's own custom CSS.
  useEffect(() => {
    if (!customJs) return;

    // Safe extraction and parsing of the visual flow JSON
    try {
      const match = customJs.match(/\/\* CHATTY_FLOW_DATA([\s\S]*?)CHATTY_FLOW_DATA \*\//);
      if (match && match[1]) {
        const flow = JSON.parse(match[1].trim()) as FlowConfig;
        if (flow && flow.status === "active" && flow.nodes && flow.edges) {
          // Deriving flowConfig from customJs (an external string, not React
          // state) once per load — not a cascading-render risk.
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setFlowConfig(flow);
          const startEdge = flow.edges.find((e) => e.source === "start");
          if (startEdge) {
            const firstNode = flow.nodes.find((n) => n.id === startEdge.target);
            if (firstNode) {
              setMessages((prev) => {
                // If visitor already has chat history in this session, preserve it!
                if (prev.length > 0 && prev.some((m) => m.role === "user")) {
                  return prev;
                }
                executeFlowNode(firstNode, flow);
                return [];
              });
            }
          }
        } else {
          // Flow is paused or removed — clear any existing flow state
          setFlowConfig(null);
          setActiveNodeId(null);
        }
      }
    } catch (err) {
      console.error("Failed to parse visual flow data:", err);
    }

    // Execute any standard custom JS runnable script
    try {
      const runnableJs = customJs.replace(/\/\* CHATTY_FLOW_DATA[\s\S]*?CHATTY_FLOW_DATA \*\//g, "").trim();
      if (runnableJs) {
        const fn = new Function(runnableJs);
        fn();
      }
    } catch (err) {
      console.error("Chatty custom JS execution error:", err);
    }
    // Deliberately scoped to customJs only — flowConfig/messages state derived
    // from this external string, and executeFlowNode is a stable closure over
    // the fresh `flow` parsed above, not the outer flowConfig state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customJs]);

  // Real-time flow sync: re-fetch bot config every 30s so that flow builder
  // changes apply to the widget without requiring a page reload.
  useEffect(() => {
    if (!botId) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/widget/theme?bot_id=${encodeURIComponent(String(botId))}&t=${Date.now()}`);
        if (res.ok) {
          const bot = await res.json();
          const newJs = bot.custom_js || "";
          setCustomJs((prev) => {
            if (prev !== newJs) return newJs;
            return prev;
          });
        }
      } catch {}
    }, 30000);
    return () => clearInterval(interval);
  }, [botId]);

  // Force transparent iframe body background to resolve sub-pixel corner bleeding
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.style.setProperty("background-color", "transparent", "important");
      document.body.style.setProperty("background-color", "transparent", "important");
      document.body.style.setProperty("background", "transparent", "important");
    }
  }, []);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, isBotResponding, tab]);

  // Load the owner's chosen Google Font at runtime — this route has no
  // static next/font/google import for arbitrary owner-picked fonts (those
  // are build-time only), so a plain <link> to Google's own CSS is the only
  // way to load one by name. Keyed by font name so re-renders with the
  // same font don't insert a duplicate <link>.
  useEffect(() => {
    if (typeof document === "undefined" || !fontFamily) return;
    const id = `chatty-google-font-${fontFamily.replace(/[^a-zA-Z0-9]/g, "-")}`;
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontFamily).replace(/%20/g, "+")}:wght@400;500;600;700&display=swap`;
    document.head.appendChild(link);
  }, [fontFamily]);

  // #chatty-root's own real, unscaled pixel size — needed to compensate
  // the font-size-% wrapper below correctly. `zoom` does NOT scale a
  // *percentage* width/height the way it scales content: `width: 76.9%;
  // zoom: 130%` still lays out (and reports via getBoundingClientRect) as
  // literally 76.9% of the parent's real size, not 100% - percentages are
  // resolved against the containing block's actual size regardless of the
  // zoomed element's own zoom. Pixel lengths behave differently: `width:
  // 292px; zoom: 130%` DOES render as 380px (292 × 1.3) - zoom scales
  // absolute lengths but not relative ones. So the wrapper's compensated
  // size has to be computed in real pixels from the actual container size,
  // which can only be known at runtime (ResizeObserver), not authored as a
  // fixed percentage in JSX.
  const [containerSize, setContainerSize] = useState<{ width: number; height: number } | null>(null);
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const measure = () => setContainerSize({ width: el.clientWidth, height: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ---- Text message (streamed via SSE) ----
  // Update the most recent assistant bubble's content in place as tokens arrive.
  const setStreamingAssistant = (content: string) => {
    setMessages((p) => {
      const copy = [...p];
      for (let i = copy.length - 1; i >= 0; i--) {
        if (copy[i].role === "assistant") { copy[i] = { ...copy[i], content }; break; }
      }
      return copy;
    });
  };

  const rateMessage = async (index: number, rating: "up" | "down") => {
    setMessages((p) => { const c = [...p]; if (c[index]) c[index] = { ...c[index], feedback: rating }; return c; });
    try {
      await fetch(`${BACKEND_URL}/api/widget/feedback`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bot_id: botId, session_id: sessionId, rating }),
      });
    } catch { /* best-effort */ }
  };

  const sendText = async (text: string) => {
    if (!text.trim() || isBotResponding) return;
    setMessages((p) => [...p, { role: "user", content: text }]);
    setInputValue("");
    setEmojiOpen(false);

    if (flowConfig && activeNodeId) {
      const activeNode = flowConfig.nodes.find((n) => n.id === activeNodeId);
      const outgoingEdges = flowConfig.edges.filter((e) => e.source === activeNodeId);

      if (flowAwaitingInput && isQuestionNode(activeNode)) {
        // Question node: user typed a real answer. Route flow AND pass to real AI.
        const resolved = outgoingEdges.map((e) => ({ ...e, _label: getEdgeLabel(e) }));
        const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text.trim());

        let matchedEdge = resolved.find((e) => e._label.toLowerCase() === text.toLowerCase());
        if (!matchedEdge) {
          if (isEmail) {
            matchedEdge = resolved.find((e) =>
              e._label.toLowerCase().includes("email") &&
              (e._label.toLowerCase().includes("provided") || e._label.toLowerCase().includes("valid") || e._label.toLowerCase().includes("yes"))
            ) || resolved.find((e) => !e._label.toLowerCase().includes("invalid") && !e._label.toLowerCase().includes("no"));
          } else {
            matchedEdge = resolved.find((e) =>
              e._label.toLowerCase().includes("invalid") || e._label.toLowerCase().includes("no")
            );
          }
        }

        const selectedEdge = matchedEdge || resolved[0];
        if (selectedEdge) {
          const targetNode = flowConfig.nodes.find((n) => n.id === selectedEdge.target);
          if (targetNode) {
            // Silently persist user's answer in background so it's logged in the inbox database
            fetch(`${BACKEND_URL}/api/widget/chat`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ bot_id: botId, session_id: sessionId, text: text })
            }).catch(() => {});

            executeFlowNode(targetNode, flowConfig);
            return; // Stay in flow, do not trigger streaming AI response
          } else {
            // Flow done — fall through to AI below
            setActiveNodeId(null);
            setFlowAwaitingInput(false);
          }
        }

      } else if (!flowAwaitingInput && outgoingEdges.length > 1) {
        // Message node with labeled choice buttons — don't send to AI, just route
        const resolved = outgoingEdges.map((e) => ({ ...e, _label: getEdgeLabel(e) }));
        const matchedEdge = resolved.find((e) => e._label.toLowerCase() === text.toLowerCase()) || resolved[0];
        const targetNode = flowConfig.nodes.find((n) => n.id === matchedEdge.target);
        if (targetNode) {
          executeFlowNode(targetNode, flowConfig);
        } else {
          setActiveNodeId(null);
          setFlowAwaitingInput(false);
        }
        return; // Don't send to AI for menu choices
      } else if (!flowAwaitingInput && outgoingEdges.length === 0) {
        // Flow is at terminal node — clear flow, hand off to AI
        setActiveNodeId(null);
        setFlowAwaitingInput(false);
      }
    }

    setIsBotResponding(true);

    let acc = "";
    // The assistant bubble is created lazily on the first content so the typing
    // indicator is the ONLY thing shown until then (no duplicate response icon).
    let created = false;
    const writeAssistant = (content: string) => {
      if (!created) {
        created = true;
        setIsBotResponding(false);
        setMessages((p) => [...p, { role: "assistant" as const, content, sender: "ai" }]);
      } else {
        setStreamingAssistant(content);
      }
    };

    try {
      const res = await fetch(`${BACKEND_URL}/api/widget/chat/stream`, {
        method: "POST", headers: { "Content-Type": "application/json", ...widgetTokenHeader },
        body: JSON.stringify({ bot_id: botId, session_id: sessionId, text, visitor_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, host: getHost() }),
      });

      if (!res.ok || !res.body) {
        let detail = "Something went wrong.";
        try { const b = await res.json(); detail = b.detail || detail; } catch {}
        writeAssistant(`⚠️ ${detail}`);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let sep: number;
        while ((sep = buffer.indexOf("\n\n")) >= 0) {
          const frame = buffer.slice(0, sep);
          buffer = buffer.slice(sep + 2);
          const dataLine = frame.split("\n").find((l) => l.startsWith("data:"));
          if (!dataLine) continue;
          let payload: { type: string; text?: string; reply?: string; detail?: string; sources?: Citation[] };
          try { payload = JSON.parse(dataLine.slice(5).trim()); } catch { continue; }

          if (payload.type === "token") {
            acc += payload.text || "";
            writeAssistant(acc);
          } else if (payload.type === "done") {
            if (payload.reply && payload.reply !== acc) { acc = payload.reply; writeAssistant(acc); }
            else if (!created && payload.reply) { writeAssistant(payload.reply); }
            if (payload.sources && payload.sources.length && created) {
              const srcs = payload.sources;
              setMessages((p) => {
                const copy = [...p];
                for (let i = copy.length - 1; i >= 0; i--) {
                  if (copy[i].role === "assistant") { copy[i] = { ...copy[i], sources: srcs }; break; }
                }
                return copy;
              });
            }
            notifyParent();
          } else if (payload.type === "paused") {
            setLiveAgent(true);
            lastPollRef.current = new Date(Date.now() - 2000).toISOString();
          } else if (payload.type === "error") {
            writeAssistant(`⚠️ ${payload.detail || "Something went wrong."}`);
          }
        }
      }
    } catch {
      writeAssistant("Sorry, I can't connect right now.");
    } finally {
      setIsBotResponding(false);
    }
  };

  // ---- Media message (image / audio / file) ----
  const sendMedia = async (file: File | Blob, filename: string, caption = "") => {
    if (isBotResponding) return;
    const isImage = file.type.startsWith("image/");
    const isAudio = file.type.startsWith("audio/");
    const localUrl = URL.createObjectURL(file);
    setMessages((p) => [...p, { role: "user", content: caption || (isAudio ? VOICE_MESSAGE_PLACEHOLDER : `📎 ${filename}`), fileUrl: localUrl, fileType: file.type }]);
    setIsBotResponding(true);
    try {
      const fd = new FormData();
      fd.append("bot_id", String(botId));
      fd.append("session_id", sessionId);
      fd.append("text", caption);
      fd.append("visitor_timezone", Intl.DateTimeFormat().resolvedOptions().timeZone);
      fd.append("host", getHost());
      fd.append("file", file, filename);
      const res = await fetch(`${BACKEND_URL}/api/widget/chat/media`, { method: "POST", headers: widgetTokenHeader, body: fd });
      const body = await res.json();
      setMessages((p) => [...p, res.ok
        ? { role: "assistant", content: body.reply, sender: "ai" }
        : { role: "assistant", content: `⚠️ ${body.detail || "Couldn't process that file."}` }]);
      notifyParent();
    } catch {
      setMessages((p) => [...p, { role: "assistant", content: "Sorry, I couldn't upload that." }]);
    } finally {
      setIsBotResponding(false);
    }
    void isImage;
  };

  const onFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const newFiles: {file: File; preview: string}[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const preview = f.type.startsWith("image/") ? URL.createObjectURL(f) : "";
      newFiles.push({ file: f, preview });
    }
    setPendingFiles(prev => [...prev, ...newFiles]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const openFilePicker = (kind: "images" | "documents") => {
    setAttachOpen(false);
    if (!fileInputRef.current) return;
    fileInputRef.current.accept = kind === "images" ? "image/*" : ".pdf,.doc,.docx,.txt,application/pdf";
    fileInputRef.current.click();
  };

  const shareLocation = () => {
    setAttachOpen(false);
    if (!navigator.geolocation) { showToast("Location isn't supported on this device.", "error"); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const link = `https://www.google.com/maps?q=${latitude},${longitude}`;
        setInputValue((v) => (v.trim() ? `${v} 📍 ${link}` : `📍 My location: ${link}`));
      },
      () => showToast("Couldn't access your location.", "error"),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const onPaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith("image/")) {
        e.preventDefault();
        const file = items[i].getAsFile();
        if (file) {
          const preview = URL.createObjectURL(file);
          setPendingFiles(prev => [...prev, { file, preview }]);
        }
      }
    }
  };

  // ---- Audio recording ----
  // Transcription runs server-side via Gemini (POST /api/widget/transcribe)
  // rather than the browser's Web Speech API: webkitSpeechRecognition is
  // well known to be unreliable inside cross-origin iframes (unlike
  // getUserMedia, which properly honors the iframe allow="microphone"
  // attribute) — the widget always runs embedded in one, so client-side
  // live transcription silently failed for most visitors.
  const toggleRecord = async () => {
    if (recording) {
      mediaRecorderRef.current?.stop();
      return;
    }
    try {
      recordingCancelledRef.current = false;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Live amplitude animation while recording — each bar samples a
      // distinct slice of the real-time frequency spectrum (not one
      // averaged number replayed across fixed per-bar multipliers), so
      // they genuinely fluctuate independently with the actual audio.
      const AC: typeof AudioContext = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
      const audioCtx = new AC();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256; // 128 frequency bins
      analyser.smoothingTimeConstant = 0.6; // real exponential smoothing from the Web Audio engine
      source.connect(analyser);
      audioContextRef.current = audioCtx;
      const freqData = new Uint8Array(analyser.frequencyBinCount);
      const USABLE_BINS = 64; // lower half of the spectrum — where voice energy actually lives
      const binsPerBar = Math.max(1, Math.floor(USABLE_BINS / RECORD_BAR_COUNT));
      const tick = () => {
        analyser.getByteFrequencyData(freqData);
        const levels: number[] = new Array(RECORD_BAR_COUNT);
        for (let i = 0; i < RECORD_BAR_COUNT; i++) {
          let sum = 0;
          for (let j = 0; j < binsPerBar; j++) sum += freqData[i * binsPerBar + j];
          levels[i] = Math.min(1, sum / binsPerBar / 140);
        }
        setBarLevels(levels);
        animationFrameRef.current = requestAnimationFrame(tick);
      };
      tick();

      const mr = new MediaRecorder(stream);
      audioChunksRef.current = [];
      mr.ondataavailable = (ev) => { if (ev.data.size > 0) audioChunksRef.current.push(ev.data); };
      mr.onstop = async () => {
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        if (recordingIntervalRef.current) { clearInterval(recordingIntervalRef.current); recordingIntervalRef.current = null; }
        audioContextRef.current?.close();
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        setBarLevels(Array(RECORD_BAR_COUNT).fill(0));
        setRecordingSeconds(0);
        if (recordingCancelledRef.current) { recordingCancelledRef.current = false; return; }

        const blob = new Blob(audioChunksRef.current, { type: mr.mimeType || "audio/webm" });
        if (blob.size === 0) return;
        let wav: Blob;
        try {
          wav = await audioBlobToWav(blob);
        } catch {
          showToast("Couldn't process that recording — try again.", "error");
          return;
        }

        // Agent setting (Customizer > Voice Messages): "audio" sends the
        // recording itself, skipping transcription entirely; "transcribe"
        // (default) is the original review-before-send flow below.
        if (voiceMessageMode === "audio") {
          sendMedia(wav, "voice-message.wav");
          return;
        }

        setTranscribing(true);
        // A cold backend instance can take 20-30s+ to spin up — without a
        // client-side cap, a stalled request left "Transcribing…" spinning
        // indefinitely with no feedback, indistinguishable from a hang.
        const timeoutController = new AbortController();
        const timeoutId = setTimeout(() => timeoutController.abort(), 30000);
        try {
          const fd = new FormData();
          fd.append("bot_id", String(botId));
          fd.append("file", wav, "voice-message.wav");
          const res = await fetch(`${BACKEND_URL}/api/widget/transcribe`, {
            method: "POST", headers: widgetTokenHeader, body: fd, signal: timeoutController.signal,
          });
          const body = await res.json().catch(() => ({}));
          const text = (body.text || "").trim();
          if (res.ok && text) {
            // Land the transcript in the input box — the visitor reviews/
            // edits and presses send themselves, same as typing.
            setInputValue((v) => (v ? `${v} ${text}` : text));
          } else {
            // No speech detected, or transcription failed — fall back to
            // sending the raw audio so the message isn't just lost.
            sendMedia(wav, "voice-message.wav");
          }
        } catch (err) {
          if ((err as Error)?.name === "AbortError") {
            showToast("Transcription is taking longer than usual — sending your voice message instead.", "error");
          }
          sendMedia(wav, "voice-message.wav");
        } finally {
          clearTimeout(timeoutId);
          setTranscribing(false);
        }
      };
      mediaRecorderRef.current = mr;
      mr.start();
      setRecording(true);
      setRecordingSeconds(0);
      recordingIntervalRef.current = setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
    } catch {
      showToast("Microphone access denied.", "error");
    }
  };

  // Discards the in-progress recording instead of transcribing/sending it —
  // stopping is the only event MediaRecorder gives us, so this just flags
  // the take as cancelled for mr.onstop (above) to skip processing.
  const cancelRecording = () => {
    recordingCancelledRef.current = true;
    mediaRecorderRef.current?.stop();
  };

  // ---- AI search ----
  const runSearch = async (q: string) => {
    if (!q.trim() || searching) return;
    setSearching(true);
    setSearchAnswer(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/widget/chat`, {
        method: "POST", headers: { "Content-Type": "application/json", ...widgetTokenHeader },
        body: JSON.stringify({ bot_id: botId, session_id: `${sessionId}-search`, text: q, visitor_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, host: getHost() }),
      });
      const body = await res.json();
      setSearchAnswer(res.ok ? body.reply : (body.detail || "No answer found."));
    } catch {
      setSearchAnswer("Couldn't reach the assistant.");
    } finally {
      setSearching(false);
    }
  };

  if (loading) {
    return <div className="flex h-screen items-center justify-center bg-transparent"><Loader2 className="size-6 animate-spin text-neutral-400" /></div>;
  }

  const mdComponents: Components = {
    p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
    ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>,
    ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-1">{children}</ol>,
    a: ({ href, children }) => (
      <SafeMarkdownLink href={href} className="underline break-all" style={{ color: primaryColor }}>
        {children}
      </SafeMarkdownLink>
    ),
    code: ({ className, children, ...rest }) => {
      const isBlock = className?.startsWith("language-");
      if (!isBlock) return <code className="bg-neutral-200 dark:bg-neutral-800 px-1 py-0.5 rounded text-[10px] font-mono" {...rest}>{children}</code>;
      const lang = (className ?? "").replace("language-", "") || "code";
      const text = String(children).replace(/\n$/, "");
      return <CodeBlock lang={lang} text={text} />;
    },
  };

  // Per-section overrides need real !important CSS (a plain inline style
  // can never beat globals.css's .style-* !important rules), so they're
  // injected the same way the box-shadow strip above already is. #chatty-root
  // gives them ID-level specificity so they win regardless of which design
  // preset is active. buildColorSchemeCss validates hex values before
  // interpolating them — not a security boundary (custom_css already lets
  // the bot owner inject arbitrary CSS here), just guarding against a
  // malformed stored value breaking the whole stylesheet.
  const colorSchemeCss = buildColorSchemeCss(colorScheme, "#chatty-root");
  // Same reasoning as colorSchemeCss above — only an equally-specific
  // injected !important rule can beat each preset's own font-family
  // !important rule.
  const fontFamilyCss = fontFamily && /^[a-zA-Z0-9 -]+$/.test(fontFamily)
    ? `#chatty-root { font-family: "${fontFamily}", sans-serif !important; }`
    : "";

  return (
    <div
      ref={rootRef}
      id="chatty-root"
      className={`w-full h-screen flex flex-col overflow-hidden text-neutral-900 dark:text-neutral-100 font-sans style-${widgetStyle} ${isFullscreen ? "" : "rounded-2xl"}`}
      style={{
        backgroundColor: primaryColor,
        touchAction: "manipulation",
        ...primaryColorCssVars(primaryColor),
      } as React.CSSProperties}
    >
      <style dangerouslySetInnerHTML={{ __html: `
        html, body {
          touch-action: manipulation;
          background: transparent !important;
          background-image: none !important;
          animation: none !important;
          overflow: hidden !important;
          /* The root layout's "antialiased" Tailwind class (-webkit-font-smoothing:
             antialiased) applies globally, including here — it's a Mac-oriented
             hint that thins glyphs toward macOS's grayscale AA look. On Windows
             Chrome it overrides the OS's own ClearType subpixel rendering, which
             is tuned for Windows displays, making small chat text read noticeably
             softer than the rest of the page. Reverting to "auto" here restores
             each platform's own native (sharper on Windows) text rendering,
             scoped to just the widget so it doesn't change how the dashboard or
             marketing pages render text. */
          -webkit-font-smoothing: auto !important;
          -moz-osx-font-smoothing: auto !important;
        }
        /* Strip only box-shadow inside the iframe: the container fills the iframe
           edge-to-edge with zero margin, so any shadow has no room to render and
           gets hard-clipped by the iframe's own overflow:hidden (ugly) — this is
           an iframe limitation, not a CSS bug, since content can never bleed past
           an iframe's own rectangle. Each design's border and border-radius are
           safe to keep — a border draws flush at the box edge with zero bleed, and
           the outer host (widget.js, page.tsx) now applies no radius/border/shadow
           of its own, so there's no double-corner artifact either. This keeps each
           design's signature frame (e.g. Luxury Editorial's gold border,
           Neubrutalism's thick black border) visible on the live widget instead of
           only in previews. Restoring the shadow too would require insetting this
           panel inside a larger host box to give it room — deliberately not done,
           to keep the full iframe as usable chat area. */
        .style-minimal,
        .style-playful,
        .style-corporate,
        .style-dark-sleek,
        .style-gradient-glow,
        .style-glassmorphism,
        .style-ecommerce,
        .style-healthcare-calm,
        .style-neubrutalism,
        .style-luxury-editorial {
          box-shadow: none !important;
        }
        ${colorSchemeCss}
        ${fontFamilyCss}
      ` }} />
      {customCss && <style dangerouslySetInnerHTML={{ __html: customCss }} />}
      {/* Text-size scaling lives on this inner wrapper, not #chatty-root
          itself — see ChatWidgetCore.tsx's identical wrapper for the full
          reasoning: zoom does not scale a *percentage* width/height the
          way it scales absolute (px) ones, so the compensation has to be
          computed in real pixels from containerSize (ResizeObserver
          above), not authored as a fixed percentage. */}
      <div
        className="w-full h-full flex flex-col overflow-hidden"
        style={fontSizePercent !== 100 && containerSize ? {
          zoom: `${fontSizePercent}%`,
          width: `${containerSize.width / (fontSizePercent / 100)}px`,
          height: `${containerSize.height / (fontSizePercent / 100)}px`,
        } : undefined}
      >
      {/* Header */}
      <div className="chat-header px-4 pt-3 pb-2 border-b border-neutral-100 dark:border-neutral-850" style={{ background: primaryColor }}>
        <div className="flex items-center gap-2.5">
          <div
            className="size-11 rounded-full flex items-center justify-center font-bold text-base overflow-hidden shrink-0 transition-colors"
            style={logoBgColor ? { backgroundColor: logoBgColor, color: getOnColor(logoBgColor) } : { backgroundColor: "color-mix(in srgb, currentColor 25%, transparent)" }}
          >
            {headerLogoInner("size-6")}
          </div>
          <div className="leading-tight">
            <h4 className="font-semibold text-sm">{botName}</h4>
            <p className="text-[9px] flex items-center gap-1" style={{ opacity: 0.8 }}><span className="size-1.5 rounded-full bg-green-300 animate-pulse" />{liveAgent ? "Live agent · we're with you" : "Online · replies instantly"}</p>
          </div>
          {voiceEnabled && (
            <motion.button
              type="button"
              whileTap={{ scale: 0.85 }}
              transition={{ duration: 0.32, ease: [0.34, 1.56, 0.64, 1] }}
              onClick={() => setVoiceCallOpen(true)}
              className="ml-auto p-1.5 rounded-full hover:opacity-100 transition-colors shrink-0 cursor-pointer"
              style={{ opacity: 0.8, backgroundColor: "color-mix(in srgb, currentColor 0%, transparent)" }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "color-mix(in srgb, currentColor 15%, transparent)")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "color-mix(in srgb, currentColor 0%, transparent)")}
              aria-label="Start voice call"
              title="Talk to the assistant"
            >
              <Phone className="size-4" />
            </motion.button>
          )}
          <button
            onClick={requestPushPermission}
            className={`${voiceEnabled ? "" : "ml-auto "}p-1.5 rounded-full hover:opacity-100 transition-colors shrink-0 cursor-pointer`}
            style={{ opacity: 0.8 }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "color-mix(in srgb, currentColor 15%, transparent)")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
            aria-label="Toggle push notifications"
            title={pushGranted ? "Browser notifications enabled" : "Enable browser notifications"}
          >
            {/* "Granted" state shown via a solid fill, not a fixed color — a
                hardcoded amber here was nearly invisible against presets
                with a yellow header (e.g. Neubrutalism's #ffde59). Filling
                with currentColor keeps it legible against every preset. */}
            <Bell className={`size-4 ${pushGranted ? "fill-current" : ""}`} />
          </button>
          <button onClick={clearChat} className="p-1.5 rounded-full hover:opacity-100 transition-colors shrink-0" style={{ opacity: 0.8 }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "color-mix(in srgb, currentColor 15%, transparent)")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
            aria-label="Clear conversation" title="Clear conversation">
            <RefreshCw className="size-4" />
          </button>
          <button onClick={handleCloseClick} className="p-1.5 rounded-full hover:opacity-100 transition-colors shrink-0" style={{ opacity: 0.8 }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "color-mix(in srgb, currentColor 15%, transparent)")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
            aria-label="Close chat" title="Close">
            <X className="size-4" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto scrollbar-thin bg-card flex flex-col">
        {voiceCallOpen ? (
          <VoiceCallWidget
            botId={botId}
            sessionId={sessionId}
            backendUrl={BACKEND_URL}
            originToken={originToken}
            visitorTimezone={Intl.DateTimeFormat().resolvedOptions().timeZone}
            primaryColor={primaryColor}
            onClose={() => { setVoiceCallOpen(false); refetchNow(); }}
          />
        ) : showCsat ? (
          /* CSAT Feedback Modal */
          <div className="p-5 flex flex-col justify-center h-full space-y-4">
            <div className="text-center space-y-2">
              <h3 className="text-sm font-bold text-neutral-800 dark:text-neutral-250">How was your conversation?</h3>
              <p className="text-[11px] text-neutral-500">Your rating helps us improve support quality.</p>
            </div>
            {/* Stars selection */}
            <div className="flex justify-center gap-1.5 py-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setCsatRating(star)}
                  className={`text-2xl transition-transform hover:scale-110 cursor-pointer ${
                    star <= csatRating ? "text-yellow-400" : "text-neutral-300 dark:text-neutral-700"
                  }`}
                >
                  ★
                </button>
              ))}
            </div>
            {/* Comment */}
            <textarea
              rows={3}
              value={csatComment}
              onChange={(e) => setCsatComment(e.target.value)}
              placeholder="What went well or could be better? (optional)..."
              className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-850 rounded-xl px-3 py-2 text-xs resize-none focus:outline-none"
            />
            {/* Action buttons */}
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => { setShowCsat(false); try { window.parent?.postMessage({ type: "chatty:close" }, "*"); } catch {} }}
                className="px-3 py-1.5 border border-neutral-200 dark:border-neutral-800 rounded-lg text-xs font-semibold hover:bg-neutral-50 dark:hover:bg-neutral-850 cursor-pointer text-neutral-600 dark:text-neutral-350"
              >
                Skip
              </button>
              <button
                type="button"
                onClick={submitCsat}
                disabled={csatRating === 0 || csatSubmitted}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg cursor-pointer disabled:opacity-40"
                style={{ background: primaryColor, color: onPrimary }}
              >
                Submit feedback
              </button>
            </div>
          </div>
        ) : showOfflineForm ? (
          /* Offline Message Capture Form */
          <div className="p-5 flex flex-col h-full justify-between gap-4">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setShowOfflineForm(false)} className="p-1 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer">
                  <ArrowLeft className="size-4 text-neutral-500" />
                </button>
                <h3 className="text-sm font-bold text-neutral-800 dark:text-neutral-200">Leave a Message</h3>
              </div>
              <p className="text-[11px] text-neutral-500 leading-relaxed dark:text-neutral-400">No support agents are currently available to chat. Leave your contact email and description below, and we&apos;ll get back to you soon.</p>
              
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">Your Email</label>
                  <input
                    type="email"
                    value={offlineEmail}
                    onChange={(e) => setOfflineEmail(e.target.value)}
                    placeholder="name@company.com"
                    className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">How can we help?</label>
                  <textarea
                    rows={4}
                    value={offlineMessage}
                    onChange={(e) => setOfflineMessage(e.target.value)}
                    placeholder="Describe your issue or question in detail..."
                    className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs resize-none focus:outline-none"
                  />
                </div>
              </div>
            </div>
            
            <div className="flex justify-end gap-2 pt-2 border-t border-neutral-100 dark:border-neutral-800 mt-auto">
              <button
                type="button"
                onClick={() => setShowOfflineForm(false)}
                className="px-3 py-1.5 border border-neutral-200 dark:border-neutral-800 rounded-lg text-xs font-semibold hover:bg-neutral-50 dark:hover:bg-neutral-850 cursor-pointer text-neutral-600 dark:text-neutral-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitOfflineMessage}
                disabled={!offlineEmail.trim() || !offlineMessage.trim() || offlineSubmitted}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg cursor-pointer disabled:opacity-40"
                style={{ background: primaryColor, color: onPrimary }}
              >
                Send message
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* HOME */}
            {tab === "home" && (
              <div className="p-4 space-y-3">
                <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-100 dark:border-neutral-850">
                  <h3 className="text-sm font-bold flex items-center gap-1.5"><Sparkles className="size-4" style={{ color: primaryColor }} />Hi there 👋</h3>
                  <p className="text-xs text-neutral-500 mt-1 leading-relaxed">{welcomeMsg}</p>
                </div>
                <button onClick={() => setTab("messages")} className="w-full flex items-center justify-between p-3.5 rounded-2xl border border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 transition-colors text-left">
                  <span className="flex items-center gap-2 text-xs font-semibold"><MessageSquare className="size-4" style={{ color: primaryColor }} />Send us a message</span>
                  <ChevronRight className="size-4 text-neutral-400" />
                </button>
                <button onClick={() => setShowOfflineForm(true)} className="w-full flex items-center justify-between p-3.5 rounded-2xl border border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 transition-colors text-left">
                  <span className="flex items-center gap-2 text-xs font-semibold"><Mail className="size-4" style={{ color: primaryColor }} />Leave us a message</span>
                  <ChevronRight className="size-4 text-neutral-400" />
                </button>
                <button onClick={() => setTab("articles")} className="w-full flex items-center justify-between p-3.5 rounded-2xl border border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 transition-colors text-left">
                  <span className="flex items-center gap-2 text-xs font-semibold"><FileText className="size-4" style={{ color: primaryColor }} />Browse help articles</span>
                  <ChevronRight className="size-4 text-neutral-400" />
                </button>
                <button onClick={() => setTab("search")} className="w-full flex items-center justify-between p-3.5 rounded-2xl border border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 transition-colors text-left">
                  <span className="flex items-center gap-2 text-xs font-semibold"><Search className="size-4" style={{ color: primaryColor }} />Search for answers</span>
                  <ChevronRight className="size-4 text-neutral-400" />
                </button>
              </div>
            )}

            {/* MESSAGES */}
            {tab === "messages" && (
              <div className="p-4 space-y-4 text-xs">
                <AnimatePresence initial={false}>
                  {messages.map((msg, i) => (
                    <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                      className={`flex gap-2 max-w-[88%] ${msg.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"}`}>
                      {msg.role !== "user" && <div className="size-6 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 overflow-hidden" style={{ background: primaryColor, color: onPrimary }}>{avatarInner("size-3.5")}</div>}
                      <div className="flex flex-col min-w-0">
                      {msg.role === "assistant" && showSenderTag && msg.sender && (
                        <span className="text-[9px] font-semibold uppercase tracking-wide text-neutral-400 dark:text-neutral-500 px-0.5 mb-0.5">
                          {msg.sender === "human" ? "Human agent" : "AI"}
                        </span>
                      )}
                      {/* .user-bubble's background/color come entirely from the
                          design preset's own CSS (globals.css, !important) — an
                          inline style here computed from primaryColor would be
                          silently overridden for the background but NOT
                          recomputed for the text color, producing the same
                          invisible-text bug the header had. */}
                      <div className={`p-2.5 rounded-2xl leading-relaxed min-w-0 break-words [overflow-wrap:anywhere] ${msg.role === "user" ? "user-bubble rounded-tr-none" : "bot-bubble bg-neutral-100 dark:bg-neutral-800 rounded-tl-none"}`}>
                        {/* msg.fileUrl is a local blob: URL (URL.createObjectURL) or an uploaded-file URL — neither works with next/image's optimizer */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {msg.fileUrl && msg.fileType?.startsWith("image/") && <img src={msg.fileUrl} alt="attachment" className="rounded-lg mb-1 max-h-40 object-cover" />}
                        {msg.fileUrl && msg.fileType?.startsWith("audio/") && <AudioBubble src={msg.fileUrl} />}
                        {msg.role === "assistant"
                          ? <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]} components={mdComponents}>{msg.content}</ReactMarkdown>
                          : !(msg.fileType?.startsWith("audio/") && msg.content === VOICE_MESSAGE_PLACEHOLDER) && <span>{msg.content}</span>}
                        {msg.role === "assistant" && msg.content && i === messages.length - 1 && !isBotResponding && (
                          <div className="mt-1.5 flex items-center gap-1">
                            <button onClick={() => rateMessage(i, "up")} aria-label="Helpful"
                              className={`p-1 rounded-md transition-colors ${msg.feedback === "up" ? "text-green-500" : "text-neutral-300 dark:text-neutral-600 hover:text-neutral-500"}`}>
                              <ThumbsUp className="size-3" />
                            </button>
                            <button onClick={() => rateMessage(i, "down")} aria-label="Not helpful"
                              className={`p-1 rounded-md transition-colors ${msg.feedback === "down" ? "text-red-500" : "text-neutral-300 dark:text-neutral-600 hover:text-neutral-500"}`}>
                              <ThumbsDown className="size-3" />
                            </button>
                          </div>
                        )}
                        {msg.role === "assistant" && msg.sources && msg.sources.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-neutral-200 dark:border-neutral-700 flex flex-wrap gap-1">
                            {msg.sources.map((s, si) => {
                              const label = s.url ? (() => { try { return new URL(s.url!).hostname.replace(/^www\./, "") + new URL(s.url!).pathname.replace(/\/$/, ""); } catch { return s.name; } })() : s.name;
                              const cls = "inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 text-neutral-500 max-w-[170px]";
                              return s.url
                                ? <a key={si} href={s.url} target="_blank" rel="noopener noreferrer" title={s.url} className={`${cls} hover:text-neutral-800 dark:hover:text-neutral-200 transition-colors`}><Link2 className="size-2.5 shrink-0" /><span className="truncate">{label}</span></a>
                                : <span key={si} title={s.name} className={cls}><FileText className="size-2.5 shrink-0" /><span className="truncate">{label}</span></span>;
                            })}
                          </div>
                        )}
                      </div>
                      </div>
                    </motion.div>
                  ))}
                  {(isBotResponding || agentTyping) && (
                    <div className="flex gap-2 mr-auto">
                      <div className="size-6 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 overflow-hidden" style={{ background: primaryColor, color: onPrimary }}>{avatarInner("size-3.5")}</div>
                      <div className="p-3 bg-neutral-100 dark:bg-neutral-800 rounded-2xl rounded-tl-none flex items-center gap-1">
                        <span className="size-1.5 rounded-full bg-neutral-400 animate-bounce" />
                        <span className="size-1.5 rounded-full bg-neutral-400 animate-bounce [animation-delay:150ms]" />
                        <span className="size-1.5 rounded-full bg-neutral-400 animate-bounce [animation-delay:300ms]" />
                      </div>
                    </div>
                  )}
                </AnimatePresence>
                {starters.length > 0 && !activeNodeId && !isBotResponding && messages.filter((m) => m.role === "user").length === 0 && (
                  <div className="flex flex-col items-end gap-2 pt-1">
                    {starters.slice(0, 4).map((s, i) => (
                      <button key={i} onClick={() => sendText(s)}
                        className="starter-chip px-3 py-2 rounded-2xl border text-xs font-medium text-right hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors"
                        style={{ borderColor: primaryColor, color: primaryColor }}>
                        {s}
                      </button>
                    ))}
                  </div>
                )}
                {flowConfig && activeNodeId && !isBotResponding && !flowAwaitingInput && (
                  (() => {
                    const activeNode = flowConfig.nodes.find((n) => n.id === activeNodeId);
                    // Never show buttons on question nodes — user must type their answer
                    if (isQuestionNode(activeNode)) return null;
                    const outgoingEdges = flowConfig.edges.filter((e) => e.source === activeNodeId);
                    const resolvedEdges = outgoingEdges.map((e) => ({ ...e, _label: getEdgeLabel(e) }));
                    // Only show buttons if there are multiple labeled outgoing edges (menu-style)
                    const labeled = resolvedEdges.filter((e) => e._label);
                    if (labeled.length < 2) return null;
                    return (
                      <div className="flex flex-col items-end gap-2 pt-1">
                        {labeled.map((edge, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => handleFlowChoice(edge)}
                            className="px-3 py-2 rounded-2xl border text-xs font-medium text-right hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors cursor-pointer"
                            style={{ borderColor: primaryColor, color: primaryColor }}
                          >
                            {edge._label}
                          </button>
                        ))}
                      </div>
                    );
                  })()
                )}
                <div ref={messagesEndRef} />
              </div>
            )}

            {/* ARTICLES */}
            {tab === "articles" && (
              <div className="p-4">
                {openArticle ? (
                  <div>
                    <button onClick={() => setOpenArticle(null)} className="flex items-center gap-1 text-[11px] font-semibold text-neutral-500 mb-3"><ArrowLeft className="size-3.5" />All articles</button>
                    <h3 className="text-sm font-bold mb-2">{openArticle.name}</h3>
                    <div className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed whitespace-pre-wrap">{openArticle.content}</div>
                  </div>
                ) : sources.length === 0 ? (
                  <div className="text-center py-10"><FileText className="size-8 text-neutral-300 mx-auto" /><p className="text-xs text-neutral-400 mt-2">No articles yet.</p></div>
                ) : (
                  <div className="space-y-2">
                    <h3 className="text-xs font-bold uppercase tracking-wide text-neutral-400 mb-1">Help articles</h3>
                    {sources.map((s) => (
                      <button key={s.id} onClick={() => setOpenArticle(s)} className="w-full flex items-center justify-between p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 text-left">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold truncate">{s.name}</p>
                          <p className="text-[10px] text-neutral-400 truncate">{s.content.slice(0, 60)}</p>
                        </div>
                        <ChevronRight className="size-4 text-neutral-400 shrink-0" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* SEARCH */}
            {tab === "search" && (
              <div className="p-4">
                <form onSubmit={(e) => { e.preventDefault(); runSearch(searchQuery); }} className="relative">
                  <Search className="size-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search our help center…"
                    className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl pl-9 pr-3 py-2.5 text-xs focus:outline-none" />
                </form>
                {searching && <div className="flex items-center gap-2 text-xs text-neutral-400 mt-4"><Loader2 className="size-4 animate-spin" />Generating answer…</div>}
                {searchAnswer && !searching && (
                  <div className="mt-4 p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-100 dark:border-neutral-850">
                    <p className="text-[10px] font-bold uppercase tracking-wide flex items-center gap-1.5 mb-1.5" style={{ color: primaryColor }}><Sparkles className="size-3" />AI-generated answer</p>
                    <div className="text-xs text-neutral-700 dark:text-neutral-300 leading-relaxed">
                      <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>{searchAnswer}</ReactMarkdown>
                    </div>
                    <button onClick={() => { setTab("messages"); }} className="mt-3 text-[11px] font-semibold px-3 py-1.5 rounded-lg" style={{ background: primaryColor, color: onPrimary }}>Still have questions? Message us</button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Composer (Messages tab only) */}
      {tab === "messages" && !voiceCallOpen && (
        <div className="border-t border-neutral-100 dark:border-neutral-850 p-2.5 relative bg-card">
          <input type="file" ref={fileInputRef} onChange={onFilePick} accept="image/*,audio/*,application/pdf,.txt,.doc,.docx" className="hidden" multiple />
          <AnimatePresence>
            {emojiOpen && (
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.85, pointerEvents: "none" }}
                animate={{ opacity: 1, y: 0, scale: 1, pointerEvents: "auto" }}
                exit={{ opacity: 0, y: 20, scale: 0.85, pointerEvents: "none" }}
                transition={{ duration: 0.32, ease: [0.34, 1.56, 0.64, 1] }}
                className="emoji-panel absolute bottom-[84px] left-2.5 right-2.5 z-10 flex flex-col h-[min(64vh,440px)] min-h-[280px] rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80 shadow-[0_12px_40px_-8px_rgba(0,0,0,0.25)] overflow-hidden bg-card backdrop-blur-sm"
              >
                <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-neutral-100 dark:border-neutral-850 shrink-0">
                  <span className="text-[11px] font-bold tracking-wide text-neutral-500 dark:text-neutral-400 uppercase">Pick an emoji</span>
                  <button
                    type="button"
                    onClick={() => setEmojiOpen(false)}
                    className="p-1 -m-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-full transition-colors"
                    aria-label="Close emoji picker"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
                <div className="emoji-panel-picker flex-1 min-h-0">
                  <QuickEmojiPicker onSelect={(emoji) => setInputValue((v) => v + emoji)} accentColor={primaryColor} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {attachOpen && (
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.85, pointerEvents: "none" }}
                animate={{ opacity: 1, y: 0, scale: 1, pointerEvents: "auto" }}
                exit={{ opacity: 0, y: 20, scale: 0.85, pointerEvents: "none" }}
                transition={{ duration: 0.32, ease: [0.34, 1.56, 0.64, 1] }}
                className="absolute bottom-[84px] left-2.5 z-10 w-52 rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80 shadow-[0_12px_40px_-8px_rgba(0,0,0,0.25)] overflow-hidden bg-card backdrop-blur-sm"
              >
                <AttachMenu
                  onPickImages={() => openFilePicker("images")}
                  onPickDocuments={() => openFilePicker("documents")}
                  onShareLocation={shareLocation}
                  accentColor={primaryColor}
                />
              </motion.div>
            )}
          </AnimatePresence>
          <form onSubmit={async (e) => {
              e.preventDefault();
              if (pendingFiles.length > 0) {
                for (let i = 0; i < pendingFiles.length; i++) {
                  const pf = pendingFiles[i];
                  const caption = i === 0 ? inputValue.trim() : "";
                  await sendMedia(pf.file, pf.file.name, caption);
                  if (pf.preview) URL.revokeObjectURL(pf.preview);
                }
                setPendingFiles([]);
                setInputValue("");
                return;
              }
              sendText(inputValue);
            }}
            className="chat-input-bar rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 px-3 pt-2.5 pb-1.5 focus-within:border-neutral-300 dark:focus-within:border-neutral-700 transition-colors">
            {recording ? (
              <div className="flex items-center gap-2 py-1">
                <motion.button
                  type="button"
                  onClick={cancelRecording}
                  whileTap={{ scale: 0.85 }}
                  aria-label="Cancel recording"
                  className="p-1.5 rounded-full text-neutral-400 hover:text-red-500 shrink-0 cursor-pointer"
                >
                  <Trash2 className="size-4.5" />
                </motion.button>
                <div className="flex items-center gap-1.5 shrink-0">
                  <motion.span
                    className="size-2 rounded-full bg-red-500"
                    animate={{ opacity: [1, 0.25, 1] }}
                    transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
                  />
                  <span className="text-[11px] font-semibold tabular-nums text-red-500 w-7">
                    {Math.floor(recordingSeconds / 60)}:{(recordingSeconds % 60).toString().padStart(2, "0")}
                  </span>
                </div>
                <div className="flex-1 flex items-center gap-[2.5px] h-6" aria-hidden>
                  {barLevels.map((level, i) => (
                    <span
                      key={i}
                      className="w-[2.5px] rounded-full bg-red-400 shrink-0 transition-[height] duration-[50ms] ease-out"
                      style={{ height: `${Math.max(10, level * 100)}%` }}
                    />
                  ))}
                </div>
                <motion.button
                  type="button"
                  onClick={toggleRecord}
                  whileTap={{ scale: 0.85 }}
                  aria-label="Stop and send"
                  style={{ background: primaryColor, color: onPrimary }}
                  className="size-8 rounded-full flex items-center justify-center shrink-0 cursor-pointer"
                >
                  <Send className="size-3.5" />
                </motion.button>
              </div>
            ) : (
            <>
            {pendingFiles.length > 0 && (
              <div className="flex gap-1.5 px-0 pt-1 pb-1.5 flex-wrap">
                {pendingFiles.map((pf, idx) => (
                  <div key={idx} className="relative group">
                    {pf.file.type.startsWith("image/") ? (
                      // pf.preview is a local blob: URL (URL.createObjectURL) — next/image can't optimize it
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={pf.preview} alt="preview" className="h-14 w-14 rounded-lg object-cover border border-neutral-200 dark:border-neutral-700" />
                    ) : (
                      <div className="h-14 w-14 rounded-lg border border-neutral-200 dark:border-neutral-700 flex items-center justify-center bg-neutral-50 dark:bg-neutral-800">
                        <span className="text-[9px] text-neutral-500 text-center px-0.5 truncate">{pf.file.name.split('.').pop()?.toUpperCase()}</span>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        if (pf.preview) URL.revokeObjectURL(pf.preview);
                        setPendingFiles(prev => prev.filter((_, i) => i !== idx));
                      }}
                      className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-opacity shadow"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            <input value={inputValue} onChange={(e) => setInputValue(e.target.value)} onFocus={() => { setEmojiOpen(false); setAttachOpen(false); }} onPaste={onPaste}
              placeholder={transcribing ? "Transcribing…" : "Compose your message…"} disabled={isBotResponding || transcribing}
              className="w-full bg-transparent text-xs focus:outline-none disabled:opacity-60 mb-1.5" />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-0.5">
                <motion.button type="button" whileTap={{ scale: 0.85 }} onClick={() => { setEmojiOpen((o) => !o); setAttachOpen(false); }} className="chat-input-bar-icon p-1.5 text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 rounded-full" aria-label="Emoji"><Smile className="size-4.5" /></motion.button>
                <motion.button type="button" whileTap={{ scale: 0.85 }} onClick={() => { setAttachOpen((o) => !o); setEmojiOpen(false); }} className="chat-input-bar-icon p-1.5 text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 rounded-full" aria-label="Attach file"><Paperclip className="size-4.5" /></motion.button>
                <button type="button" onClick={toggleRecord} disabled={transcribing} className="chat-input-bar-icon p-1.5 rounded-full text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 disabled:opacity-50" aria-label="Record audio">
                  {transcribing ? <Loader2 className="size-4.5 animate-spin" /> : <Mic className="size-4.5" />}
                </button>
              </div>
              {(() => {
                const c = SEND_BUTTON_STYLES[sendStyle] || SEND_BUTTON_STYLES.plane;
                return (
                  <button type="submit" disabled={isBotResponding || (!inputValue.trim() && pendingFiles.length === 0)} style={{ background: primaryColor, color: onPrimary }}
                    className={`send-btn ${c.shape} flex items-center justify-center hover:opacity-90 disabled:opacity-40 shrink-0 relative`}>
                    {c.icon}{c.label && <span className="text-xs font-semibold">{c.label}</span>}
                    {pendingFiles.length > 0 && (
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center shadow">{pendingFiles.length}</span>
                    )}
                  </button>
                );
              })()}
            </div>
            </>
            )}
          </form>
          {!isOfficialWebsite && !hideBranding && (
            <div className="text-center pt-2 pb-0.5 text-[10px] text-neutral-400 dark:text-neutral-500 font-mono tracking-wide">
              Powered by{" "}
              <a
                href="https://chatty.personaliai.com"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline font-bold text-neutral-500 dark:text-neutral-400"
              >
                Chatty
              </a>
            </div>
          )}
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="absolute top-4 left-4 right-4 z-[999] flex items-center gap-2.5 bg-neutral-900/95 dark:bg-neutral-950/95 border border-neutral-800 dark:border-neutral-900 rounded-xl px-3 py-2 shadow-2xl text-[11px] font-semibold text-white animate-in slide-in-from-top-4 fade-in duration-300">
          {toast.type === "success" ? (
            <span className="flex size-4.5 items-center justify-center rounded-full bg-green-950/40 text-green-400">
              <Check className="size-3" />
            </span>
          ) : (
            <span className="flex size-4.5 items-center justify-center rounded-full bg-red-950/40 text-red-400">
              <AlertCircle className="size-3" />
            </span>
          )}
          <span className="flex-1 truncate">{toast.message}</span>
          {/* p-1.5 -m-1.5: pad the tap target, not the icon - this had zero
              padding at all, so its clickable area was exactly the bare
              12px icon (size-3), easy to miss on a real click. Negative
              margin keeps the toast's own visual padding/spacing unchanged. */}
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => setToast(null)}
            className="p-1.5 -m-1.5 text-neutral-400 hover:text-neutral-200 cursor-pointer shrink-0"
          >
            <X className="size-3" />
          </button>
        </div>
      )}

      </div>
    </div>
  );
}
