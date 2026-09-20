"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback, Fragment } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";
import { SafeMarkdownLink } from "./safe-markdown-link";
import { motion, AnimatePresence } from "framer-motion";
import { QuickEmojiPicker } from "./quick-emoji-picker";
import { AttachMenu } from "./attach-menu";
import VoiceCallWidget from "./voice-call-widget";
import { InlineBookingCard, ConfirmedMeeting } from "./inline-booking-card";
import { ProductCard, type ProductCardData } from "./product-card";
import { VideoCard, type VideoClipData } from "./video-card";
import { getOnColor, primaryColorCssVars, buildColorSchemeCss, type WidgetColorScheme } from "./color-contrast";
import { normalizeWidgetStyle, getPresetSignature } from "./widget-style";
// CSS is shipped separately (dist/styles.css, plus katex's own CSS) instead
// of side-effect-imported here - a library bundling its own CSS import
// requires the CONSUMER's bundler to understand raw CSS imports the exact
// way this package's own build does, which isn't a safe assumption across
// arbitrary React setups (Next.js, CRA, Vite, etc. all differ). See this
// package's README for the two imports a consumer needs to add once.
import {
  Send, Loader2, Sparkles, MessageSquare, MessageCircle, FileText, Search,
  Paperclip, Smile, Mic, ChevronRight, ChevronDown, ChevronUp, ArrowLeft, X,
  ArrowUp, ArrowRight, RefreshCw, Bot, Headphones, User, Check, AlertCircle,
  Link2, ThumbsUp, ThumbsDown, Mail, Bell, BellOff, Phone, Play, Pause, Trash2,
  BookOpen, Home, HelpCircle, Megaphone, Compass, Clock, Calendar,
  type LucideIcon,
} from "lucide-react";

// The default placeholder content a voice message gets when the visitor
// didn't type an accompanying caption (set where the message is created,
// below) - used here to skip rendering it as redundant text under the
// player itself.
const VOICE_MESSAGE_PLACEHOLDER = "🎤 Voice message";

// A WhatsApp/Telegram-style voice-message player: play/pause + a seekable
// waveform + elapsed/duration, themed entirely through `currentColor` and
// `color-mix()` (see .audio-bubble-* rules in widget-presets.css) so it
// automatically matches whichever design preset (and primaryColor) the
// surrounding .user-bubble/.bot-bubble is already using - no per-preset
// styling needed here.
function AudioBubble({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  // There's no real peak/amplitude data for a recorded clip, so the bars are
  // a deterministic pseudo-waveform hashed from the src URL - the same
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
        onLoadedMetadata={(e) => {
          const el = e.currentTarget;
          // Chrome reports Infinity for a MediaRecorder-produced blob's
          // duration until forced to seek past the end - without this, every
          // voice message we record ourselves shows "0:00" regardless of its
          // real length (fmt() below maps non-finite durations to 0).
          if (isFinite(el.duration)) setDuration(el.duration);
          else el.currentTime = 1e101;
        }}
        onDurationChange={(e) => {
          const d = e.currentTarget.duration;
          if (isFinite(d) && d > 0) {
            setDuration(d);
            if (e.currentTarget.currentTime !== 0) e.currentTarget.currentTime = 0;
          }
        }}
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

function parseProductCards(content: string): { cleanContent: string; products: ProductCardData[]; videoClips: VideoClipData[] } {
  const products: ProductCardData[] = [];
  const videoClips: VideoClipData[] = [];

  let clean = content.replace(/\[PRODUCT_CARD:(\{.*?\})\]/g, (_, jsonStr) => {
    try {
      const parsed = JSON.parse(jsonStr);
      if (parsed && typeof parsed === "object") products.push(parsed);
    } catch {}
    return "";
  });

  clean = clean.replace(/\[VIDEO_CLIP:(\{.*?\})\]/g, (_, jsonStr) => {
    try {
      const parsed = JSON.parse(jsonStr);
      if (parsed && typeof parsed === "object") videoClips.push(parsed);
    } catch {}
    return "";
  });

  clean = clean.replace(/\[BOOKING_WIDGET\]/g, "").trim();

  return { cleanContent: clean, products, videoClips };
}

// Preset assistant avatar icons (selectable in the customizer).
const AVATAR_ICONS: Record<string, LucideIcon> = {
  bot: Bot, headset: Headphones, sparkles: Sparkles, message: MessageSquare, user: User,
};

// process.env.NEXT_PUBLIC_BACKEND_URL is a Next.js/webpack-only convention -
// consumers of this package may be on Vite, CRA, plain esbuild, etc., where
// `process` isn't defined as a global at all, so a bare `process.env.X`
// reference throws ReferenceError before this module even finishes loading.
// The typeof guard makes this safe everywhere; consumers who DO run under
// Next.js/webpack and set NEXT_PUBLIC_BACKEND_URL still get it honored.
const BACKEND_URL =
  (typeof process !== "undefined" ? process.env?.NEXT_PUBLIC_BACKEND_URL : undefined) ??
  "https://api.chatty.personaliai.com";

const RECORD_BAR_COUNT = 14;

// Send-button variants (icon + shape). Keyed by chatty_bots.send_button_style.
const SEND_BUTTON_STYLES: Record<string, { shape: string; icon: React.ReactNode; label?: string }> = {
  plane:      { shape: "size-7 rounded-full",        icon: <Send className="size-3.5" /> },
  arrowUp:    { shape: "size-7 rounded-full",        icon: <ArrowUp className="size-3.5" /> },
  arrowRight: { shape: "size-7 rounded-full",        icon: <ArrowRight className="size-3.5" /> },
  square:     { shape: "size-7 rounded-lg",          icon: <Send className="size-3.5" /> },
  label:      { shape: "h-7 px-3 rounded-full gap-1.5", icon: <Send className="size-3" />, label: "Send" },
};

// Browsers record audio as webm/opus, which Gemini does NOT accept. Decode and
// re-encode to 16-bit mono WAV (a Gemini-supported format) client-side.
async function audioBlobToWav(blob: Blob): Promise<Blob> {
  const AC: typeof AudioContext = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
  const ctx = new AC();
  const audioBuf = await ctx.decodeAudioData(await blob.arrayBuffer());
  ctx.close();
  const len = audioBuf.length;
  // A near-instant tap-to-stop can decode to an AudioBuffer with ~0 samples -
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
  // message arriving through those two paths is unambiguously "human" -
  // everything else assistant-role is a direct AI reply.
  sender?: "ai" | "human";
  sender_name?: string;
  sender_avatar?: string;
  created_at?: string;
  confirmedMeeting?: ConfirmedMeeting;
}
interface Source { id: string; name: string; content: string; }

// Visual-flow config parsed out of the bot's custom JS (built by the flow
// builder in the dashboard). Nodes/edges follow React Flow's shape.
interface FlowNode {
  id: string;
  type?: string;
  data?: {
    label?: string;
    options?: string[];
    field?: "email" | "name" | "company" | "phone";
    prompt?: string;
  };
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

type Tab = "home" | "messages" | "articles";

export interface WidgetKbArticle {
  id: string;
  category_id?: string;
  title: string;
  slug: string;
  subtitle?: string;
  content?: string;
  tags?: string[];
  is_promoted?: boolean;
  view_count?: number;
  helpful_count?: number;
  created_at?: string;
  category?: { id: string; name: string; slug: string; icon?: string };
}

export interface WidgetKbCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  article_count?: number;
}

export interface TeamProfile {
  id: string;
  name: string;
  avatar_url?: string | null;
  role?: string;
  last_seen_at?: string | null;
}

function formatTimeCompact(dateStr?: string | number): string {
  // Never label an unknown timestamp as current. Older local sessions can
  // legitimately lack created_at; showing "Just now" made those messages
  // appear permanently fresh. New messages are timestamped at insertion.
  if (!dateStr) return "—";
  try {
    const d = typeof dateStr === "number" ? new Date(dateStr) : new Date(dateStr);
    const time = d.getTime();
    if (!Number.isFinite(time)) return "—";
    const diffSec = Math.max(0, Math.floor((Date.now() - time) / 1000));
    if (diffSec < 10) return "Just now";
    if (diffSec < 60) return `${diffSec}s`;
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h`;
    if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return "—";
  }
}

function AgentAvatar({
  src,
  name,
  size = "size-7",
  className = "",
  showStatusDot = false,
  statusColor = "bg-green-400",
  bgColor,
  textColor,
  primaryColor,
  onPrimary,
}: {
  src?: string | null;
  name?: string | null;
  size?: string;
  className?: string;
  showStatusDot?: boolean;
  statusColor?: string;
  bgColor?: string | null;
  textColor?: string | null;
  primaryColor?: string;
  onPrimary?: string;
}) {
  const [imageError, setImageError] = useState(false);

  // Validate URL protocol and content
  const isValidUrl = useMemo(() => {
    if (!src || typeof src !== "string") return false;
    const trimmed = src.trim();
    if (!trimmed) return false;
    return (
      trimmed.startsWith("http://") ||
      trimmed.startsWith("https://") ||
      trimmed.startsWith("data:image/") ||
      trimmed.startsWith("/")
    );
  }, [src]);

  const initial = useMemo(() => {
    if (!name || typeof name !== "string") return "A";
    const trimmed = name.trim();
    return trimmed ? trimmed.charAt(0).toUpperCase() : "A";
  }, [name]);

  const showFallback = !isValidUrl || imageError;
  const fallbackBg = primaryColor || "#f97316";
  const fallbackFg = textColor || getOnColor(fallbackBg);

  return (
    <div className={`relative inline-flex shrink-0 ${className}`}>
      <div
        className={`agent-avatar-badge ${size} rounded-full flex items-center justify-center font-bold overflow-hidden select-none shadow-2xs transition-colors`}
        style={showFallback ? { backgroundColor: fallbackBg, color: fallbackFg } : (bgColor ? { backgroundColor: bgColor } : {})}
      >
        {!showFallback ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src!}
            alt={name || "Agent"}
            className="size-full object-cover"
            onError={() => setImageError(true)}
          />
        ) : (
          <span className="text-[11px] leading-none font-semibold tracking-wide" style={{ color: fallbackFg }}>
            {initial}
          </span>
        )}
      </div>
      {showStatusDot && (
        <span
          className={`absolute bottom-0 right-0 size-2 rounded-full ring-1.5 ring-white dark:ring-neutral-900 ${statusColor}`}
        />
      )}
    </div>
  );
}

function AvatarGroup({
  profiles,
  botAvatarUrl,
  botName,
  size = "size-7",
  primaryColor,
  onPrimary,
  bgColor,
  textColor,
}: {
  profiles?: TeamProfile[];
  botAvatarUrl?: string | null;
  botName: string;
  primaryColor?: string;
  onPrimary?: string;
  bgColor?: string | null;
  textColor?: string | null;
  size?: string;
}) {
  const items: { src?: string | null; name: string }[] = [];

  if (profiles && profiles.length > 0) {
    for (const p of profiles) {
      if (p.avatar_url || (p.name && p.name.trim())) {
        items.push({ src: p.avatar_url, name: p.name });
      }
      if (items.length >= 3) break;
    }
  }

  if (items.length === 0) {
    items.push({ src: botAvatarUrl, name: botName });
  } else if (items.length === 1 && botAvatarUrl && items[0].src !== botAvatarUrl) {
    items.unshift({ src: botAvatarUrl, name: botName });
  }

  return (
    <div className="flex items-center -space-x-2 shrink-0">
      {items.map((item, idx) => (
        <AgentAvatar
          key={idx}
          src={item.src}
          name={item.name}
          size={size}
          primaryColor={primaryColor}
          onPrimary={onPrimary}
          bgColor={item.src === botAvatarUrl ? bgColor : undefined}
          textColor={textColor}
          className="ring-2 ring-white dark:ring-neutral-900 rounded-full"
        />
      ))}
    </div>
  );
}

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

export interface ChatWidgetCoreProps {
  botId: string;
  // Explicit string | null = caller manages verification itself (EmbedClient.tsx
  // and widget-entry.tsx both do this today, exchanging the iframe's genuine
  // server-side Referer for a token via /api/widget/verify-origin before this
  // component ever mounts). Omitted entirely = this component verifies its
  // own origin directly against the backend using window.location.href,
  // since a same-realm mount (this package's whole point) has no iframe
  // Referer for a parent page to capture on its behalf.
  originToken?: string | null;
  isPreview?: boolean;
  paramColor?: string | null;
  paramStyle?: string | null;
  paramName?: string | null;
  paramWelcome?: string | null;
  paramAvatarIcon?: string | null;
  paramAvatarUrl?: string | null;
  paramLogoUrl?: string | null;
  paramLogoBgColor?: string | null;
  paramShowSenderTag?: string | null;
  paramCsatEnabled?: string | null;
  paramColorScheme?: string | null;
  // Google Fonts family name (null = the active design preset's own
  // default font) and a size scale as a percentage of the widget's normal
  // text size (100 = unchanged, matches font_size_percent in the DB).
  paramFont?: string | null;
  paramFontSizePercent?: string | null;
  // The following are only ever passed by widget-entry.tsx (the standalone
  // Shadow DOM mount) - EmbedClient.tsx (the Next.js iframe route) never
  // passes them, so every branch below that checks one of these falls back
  // to exactly the postMessage-based behavior this component always had,
  // unchanged, for the iframe path. These bridge props exist for a
  // same-realm host (e.g. a Shadow DOM mount) where direct calls can
  // replace postMessage / window.addEventListener("message").
  onWidgetReady?: () => void;
  onWidgetClose?: () => void;
  onAssistantMessage?: () => void;
  onRequestNotificationPermission?: (botName: string, avatarUrl?: string | null) => void;
  onTriggerNotification?: (botName: string, bodyText: string, avatarUrl?: string | null) => void;
  // Controlled equivalents of the two signals that used to arrive via
  // window.addEventListener("message") from the parent frame
  // (chatty-fullscreen, chatty-notification-status). Left undefined by
  // EmbedClient.tsx, so the existing message listener below still drives
  // them for the iframe path exactly as before.
  forceFullscreen?: boolean;
  notificationGranted?: boolean;
  // Fires once the bot's theme/customization has loaded (both the initial
  // load and the periodic refresh). Lets a host app that renders its own
  // chrome around this widget (e.g. a custom floating launcher button)
  // reuse this data instead of independently re-fetching
  // /api/widget/theme itself - see the README's "Custom launcher" section.
  onThemeLoaded?: (theme: WidgetThemeData) => void;
}

// The subset of /api/widget/theme's response a host app typically needs to
// style its own chrome around this widget (a launcher button, a page
// header) without re-fetching the endpoint itself.
export interface WidgetThemeData {
  name?: string;
  primary_color?: string;
  widget_style?: string;
  avatar_icon?: string;
  avatar_url?: string | null;
  logo_url?: string | null;
  color_scheme?: WidgetColorScheme | null;
  teaser_message?: string;
  welcome_message?: string;
  trigger_rules?: unknown;
  font_family?: string | null;
  font_size_percent?: number;
  voice_message_mode?: "transcribe" | "audio";
  panel_size?: string;
}

export default function ChatWidgetCore({
  botId,
  originToken,
  isPreview = false,
  paramColor = null,
  paramStyle = null,
  paramName = null,
  paramWelcome = null,
  paramAvatarIcon = null,
  paramAvatarUrl = null,
  paramLogoUrl = null,
  paramLogoBgColor = null,
  paramShowSenderTag = null,
  paramCsatEnabled = null,
  paramColorScheme = null,
  paramFont = null,
  paramFontSizePercent = null,
  onWidgetReady,
  onWidgetClose,
  onAssistantMessage,
  onRequestNotificationPermission,
  onTriggerNotification,
  forceFullscreen,
  notificationGranted,
  onThemeLoaded,
}: ChatWidgetCoreProps) {
  // Auto-verify our own origin when the caller didn't supply a token at all
  // (a same-realm mount has no server-captured Referer for anyone else to
  // exchange on its behalf, unlike EmbedClient.tsx's iframe route). An
  // explicit originToken (including explicit null, e.g. a preview/playground
  // that deliberately wants the unverified tier) always wins over this.
  const [autoOriginToken, setAutoOriginToken] = useState<string | null>(null);
  useEffect(() => {
    if (originToken !== undefined) return;
    if (typeof window === "undefined" || !botId) return;
    let cancelled = false;
    fetch(`${BACKEND_URL}/api/widget/verify-origin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bot_id: botId, referer: window.location.href }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled && d?.token) setAutoOriginToken(d.token); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [botId, originToken]);
  const effectiveOriginToken = originToken !== undefined ? originToken : autoOriginToken;
  const widgetTokenHeader: Record<string, string> = effectiveOriginToken ? { "X-Widget-Token": effectiveOriginToken } : {};

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
    if (onAssistantMessage) { onAssistantMessage(); return; }
    try { window.parent?.postMessage({ type: "chatty:message", role: "assistant" }, "*"); } catch {}
  };

  const notifyClose = () => {
    if (onWidgetClose) { onWidgetClose(); return; }
    try { window.parent?.postMessage({ type: "chatty:close" }, "*"); } catch {}
  };

  const avatarInner = (iconCls: string) => {
    // avatarUrl/logoUrl are bot-owner-uploaded URLs (or arbitrary external URLs
    // via query params in preview mode) not in next/image's domain allowlist.
    if (avatarIcon === "custom" && avatarUrl) return <img src={avatarUrl} alt="" className="size-full object-cover" />; // eslint-disable-line @next/next/no-img-element
    if (avatarIcon && avatarIcon !== "logo" && AVATAR_ICONS[avatarIcon]) {
      const Icon = AVATAR_ICONS[avatarIcon];
      return <Icon className={iconCls} />;
    }
    if (logoUrl) return <img src={logoUrl} alt="" className="size-full object-contain p-1 rounded-full" />; // eslint-disable-line @next/next/no-img-element
    return botName[0]?.toUpperCase();
  };

  const headerLogoInner = (iconCls: string) => {
    if (logoUrl) return <img src={logoUrl} alt="" className="size-full object-contain p-1 rounded-full" />; // eslint-disable-line @next/next/no-img-element
    return avatarInner(iconCls);
  };

  const renderBotAvatar = (sizeClass = "size-9", iconClass = "size-5", className = "") => {
    // Use the same treatment as the header logo. The previous implementation
    // let the per-section avatar color override this wrapper, so the recent
    // message showed a different-looking Chatty icon from the header.
    const bg = logoBgColor || "color-mix(in srgb, currentColor 25%, transparent)";
    const fg = logoBgColor ? getOnColor(logoBgColor) : primaryColor;
    return (
      <div
        className={`${sizeClass} rounded-full flex items-center justify-center font-bold overflow-hidden shrink-0 transition-colors shadow-2xs ${className}`}
        style={{ backgroundColor: bg, color: fg }}
      >
        {headerLogoInner(iconClass)}
      </div>
    );
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
      const startNode = flowConfig.nodes?.find((n) => n.id === "start" || n.type === "start");
      const startEdge = flowConfig.edges?.find((e) => e.source === (startNode?.id || "start"));
      if (startEdge) {
        const firstNode = flowConfig.nodes?.find((n) => n.id === startEdge.target);
        if (firstNode) {
          setMessages([]);
          executeFlowNode(firstNode, flowConfig);
          return;
        }
      }
    }
    setMessages([{ role: "assistant", content: welcomeMsg, sender: "ai", created_at: new Date().toISOString() }]);
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
  // Guaranteed-legible text color for anything painted with primaryColor -
  // the business owner picks that color freely, so a hardcoded white/black
  // text class goes invisible the moment they pick the "wrong" half of the
  // lightness spectrum. Computed via WCAG contrast, not assumed.
  const onPrimary = getOnColor(primaryColor);
  const [widgetStyle, setWidgetStyle] = useState("minimal");
  // Per-section colors (header/bot-bubble/user-bubble/input-bar/send-btn) -
  // null until the owner sets at least one in the Customizer, at which
  // point it takes over from the preset's own primaryColor-driven CSS
  // entirely (applied via an injected !important stylesheet below, the
  // only thing that reliably beats globals.css's .style-* !important rules).
  const [colorScheme, setColorScheme] = useState<WidgetColorScheme | null>(null);
  // null = keep the active design preset's own default font (its
  // widget-presets.css `font-family: var(--font-x), sans-serif !important`
  // rule). Set once the owner picks a Google Font in the Customizer.
  const [fontFamily, setFontFamily] = useState<string | null>(null);
  const [fontSizePercent, setFontSizePercent] = useState(100);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoBgColor, setLogoBgColor] = useState("");
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [voiceCallOpen, setVoiceCallOpen] = useState(false);
  // What a finished in-chat voice recording turns into - set on
  // chatty_bots.voice_message_mode (Customizer > Voice Messages).
  const [voiceMessageMode, setVoiceMessageMode] = useState<"transcribe" | "audio">("transcribe");
  const [calendarSchedulingEnabled, setCalendarSchedulingEnabled] = useState(false);

  const [tab, setTab] = useState<Tab>("home");
  const [bottomNavVisible, setBottomNavVisible] = useState(true);
  const [chatNavExpanded, setChatNavExpanded] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  // Tick every 30s so relative timestamps ("Just now", "2m", "1h") re-render
  // without this the timestamp is computed once on mount and never updates.
  const [, setNowTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setNowTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const [capturedLeadData, setCapturedLeadData] = useState<{ name?: string; email?: string; phone?: string; company?: string }>({});

  // Auto-extract visitor contact info if provided in chat conversation
  const extractedVisitorInfo = useMemo(() => {
    let name = capturedLeadData.name || "";
    let email = capturedLeadData.email || "";
    let phone = capturedLeadData.phone || "";
    let company = capturedLeadData.company || "";
    for (const m of messages) {
      if (m.role === "user" && typeof m.content === "string") {
        const text = m.content;
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
  }, [messages, capturedLeadData]);

  const isBookingMessage = useCallback((content: string) => {
    if (!content) return false;
    if (content.includes("[BOOKING_WIDGET]")) return true;
    if (!calendarSchedulingEnabled) return false;
    const lower = content.toLowerCase();
    if (
      lower.includes("your demo is scheduled") ||
      lower.includes("your meeting is scheduled") ||
      lower.includes("meet.google.com") ||
      lower.includes("teams.microsoft.com")
    ) {
      return false;
    }
    const hasBookingWords = /\b(book|booking|demo|schedule|reschedule|appointment|meeting|calendar|slots?)\b/i.test(lower);
    const mentionsTimesOrSlots = /\b(available slots?|earliest slot|available times?|what day and time|works best for you|reserve your slot|reserve your spot|pick a time|choose a time|select a time)\b/i.test(lower);
    return hasBookingWords && mentionsTimesOrSlots;
  }, [calendarSchedulingEnabled]);

  const lastBookingMsgIdx = useMemo(() => {
    for (let idx = messages.length - 1; idx >= 0; idx--) {
      const m = messages[idx];
      if (m.role === "assistant" && isBookingMessage(m.content)) {
        return idx;
      }
    }
    return -1;
  }, [messages, isBookingMessage]);

  const latestActiveMeeting = useMemo(() => {
    for (let idx = messages.length - 1; idx >= 0; idx--) {
      if (messages[idx].confirmedMeeting) {
        return messages[idx].confirmedMeeting;
      }
    }
    return null;
  }, [messages]);

  const [inputValue, setInputValue] = useState("");
  const [isBotResponding, setIsBotResponding] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);

  // ── Knowledge Base Articles & Categories (Crisp Style) ──
  const [kbArticles, setKbArticles] = useState<WidgetKbArticle[]>([]);
  const [kbCategories, setKbCategories] = useState<WidgetKbCategory[]>([]);
  const [kbPromoted, setKbPromoted] = useState<WidgetKbArticle[]>([]);
  const [kbLoading, setKbLoading] = useState(false);
  const [selectedKbCat, setSelectedKbCat] = useState<string>("all");
  const [activeArticle, setActiveArticle] = useState<WidgetKbArticle | null>(null);
  const [loadingArticleDetail, setLoadingArticleDetail] = useState(false);
  const [articleFeedbackGiven, setArticleFeedbackGiven] = useState<Record<string, "yes" | "no">>({});
  const [articleFilterQuery, setArticleFilterQuery] = useState("");
  const [searchKbResults, setSearchKbResults] = useState<WidgetKbArticle[]>([]);


  const loadKnowledgeBase = useCallback(async () => {
    if (!botId) return;
    setKbLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/widget/kb/portal?bot_id=${encodeURIComponent(String(botId))}`);
      if (res.ok) {
        const d = await res.json();
        setKbCategories(d.categories || []);
        setKbPromoted(d.promoted_articles || []);
        const allArts: WidgetKbArticle[] = d.articles || [
          ...(d.promoted_articles || []),
          ...(d.recent_articles || []),
        ];
        const map = new Map<string, WidgetKbArticle>();
        for (const a of allArts) map.set(a.id, a);
        setKbArticles(Array.from(map.values()));
      }
    } catch {
    } finally {
      setKbLoading(false);
    }
  }, [botId]);

  useEffect(() => {
    loadKnowledgeBase();
  }, [loadKnowledgeBase]);

  const openKbArticle = async (art: WidgetKbArticle) => {
    setActiveArticle(art);
    setLoadingArticleDetail(!art.content);
    try {
      const slugOrId = art.slug || art.id;
      const res = await fetch(`${BACKEND_URL}/api/widget/kb/articles/${encodeURIComponent(slugOrId)}?bot_id=${encodeURIComponent(String(botId))}`);
      if (res.ok) {
        const detail = await res.json();
        const articleData = detail.article || detail;
        setActiveArticle((prev) => ({
          ...(prev || art),
          ...articleData,
        }));
      }
    } catch {
    } finally {
      setLoadingArticleDetail(false);
    }
  };

  const rateArticleFeedback = async (articleId: string, helpful: boolean) => {
    setArticleFeedbackGiven((prev) => ({ ...prev, [articleId]: helpful ? "yes" : "no" }));
    try {
      await fetch(`${BACKEND_URL}/api/widget/kb/articles/${articleId}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_helpful: helpful }),
      });
    } catch {}
  };

  const askAboutArticle = (art: WidgetKbArticle) => {
    setActiveArticle(null);
    setTab("messages");
    setInputValue(`I have a question about the guide "${art.title}": `);
  };

  const [searchQuery, setSearchQuery] = useState("");
  const [searchAnswer, setSearchAnswer] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);

  // ── CSAT, Offline Ticketing, & Typing States ──
  const [showCsat, setShowCsat] = useState(false);
  const [csatRating, setCsatRating] = useState(0);
  const [csatComment, setCsatComment] = useState("");
  const [csatSubmitted, setCsatSubmitted] = useState(false);
  const csatCooldownKey = `chatty_csat_prompt_${botId}_${hostKey}`;
  const csatCooldownMs = 2 * 24 * 60 * 60 * 1000;
  const canShowCsat = () => {
    if (typeof window === "undefined") return true;
    try {
      const shownAt = Number(localStorage.getItem(csatCooldownKey) || 0);
      return !shownAt || Date.now() - shownAt >= csatCooldownMs;
    } catch { return true; }
  };
  const rememberCsatPrompt = () => {
    try { localStorage.setItem(csatCooldownKey, String(Date.now())); } catch {}
  };

  const [showOfflineForm, setShowOfflineForm] = useState(false);
  const [offlineEmail, setOfflineEmail] = useState("");
  const [offlineMessage, setOfflineMessage] = useState("");
  const [offlineSubmitted, setOfflineSubmitted] = useState(false);

  const [agentTyping, setAgentTyping] = useState(false);
  // Told by widget.js (postMessage) whenever it switches the panel between
  // the fixed-size desktop popup and mobile-fullscreen - see the message
  // listener below. Defaults to false (rounded), which is also correct for
  // the dashboard's own preview iframe, which never goes through widget.js
  // and so never sends this message.
  const [internalIsFullscreen, setIsFullscreen] = useState(false);
  const isFullscreen = forceFullscreen !== undefined ? forceFullscreen : internalIsFullscreen;

  // Browser Push Notifications (OneSignal / Native Web Push)
  // Initial value read lazily (not via an effect + setState) so the browser's
  // existing Notification permission is reflected on the very first render.
  const [internalPushGranted, setPushGranted] = useState(() => {
    if (typeof window === "undefined") return false;
    return "Notification" in window && Notification.permission === "granted";
  });
  const pushGranted = notificationGranted !== undefined ? notificationGranted : internalPushGranted;
  // Browsers don't let a site programmatically revoke Notification
  // permission - only the user can do that via browser/site settings. So
  // "turning off" notifications from the bell, once granted, is our own
  // in-widget mute flag rather than an actual permission change; it just
  // gates triggerPush below. Persisted per bot so it survives reloads -
  // same pattern (and same reasoning) as EmbedClient.tsx's identical
  // pushMuted, just keyed by botId alone here since this mount path
  // (widget.js Shadow DOM / React SDK) already lives on exactly one host
  // page, so localStorage is naturally scoped to that host already -
  // EmbedClient's iframe additionally needs a hostKey because one bot's
  // /embed/[botId] iframe can be reused across different embedding sites.
  const [pushMuted, setPushMuted] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem(`chatty_push_muted_${botId}`) === "1";
    } catch {
      return false;
    }
  });

  // Root mount element. The two "transparent background" effects further
  // down (and the global html/body rule in the injected <style> below) are
  // only safe when `document` here is a document ChatWidgetCore fully owns
  // - i.e. it's the sole content of a real /embed/[botId] iframe. That is
  // NOT the case for either of this component's actual current mount
  // paths: the React SDK mounts it directly into the host app's own
  // document (ChatWidgetCore.tsx docs/README - e.g. PriceShield's
  // ChatClient.tsx), and standalone.tsx mounts it into a Shadow Root that
  // still lives in the host page's own document. Both share `document`
  // with the host, so mutating document.body/documentElement - or
  // injecting an unscoped `html, body {}` rule that a Shadow Root doesn't
  // even contain to begin with - would corrupt the host page itself
  // (previously happened: forced the host's <body> transparent and,
  // via the <style> block, forced `overflow: hidden` / `animation: none`
  // on the host's own html/body). `window.self !== window.top` is true
  // only when this code is actually running as an iframe's own document,
  // which correctly excludes both of today's mount paths while still
  // allowing the effects to fire if a real iframe mount is added later.
  const rootRef = useRef<HTMLDivElement>(null);
  const ownsDocument = typeof window !== "undefined" && window.self !== window.top;

  // #chatty-root's own real, unscaled pixel size - needed to compensate
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
    // While `loading` is true, the early return below renders a spinner
    // instead of the real #chatty-root div - rootRef.current is null on
    // that first commit, so with an empty deps array this effect would bail
    // out via the guard below and never run again, permanently leaving
    // containerSize null (and the font-size zoom below permanently
    // disabled) even once the real content mounts. Depending on `loading`
    // makes this effect re-run the moment that happens, by which point
    // rootRef.current is the real element.
    if (!el || typeof ResizeObserver === "undefined") return;
    const measure = () => setContainerSize({ width: el.clientWidth, height: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [loading]);

  useEffect(() => {
    // Only the iframe path (EmbedClient.tsx never passes forceFullscreen/
    // notificationGranted) still needs this listener - the standalone
    // Shadow DOM path drives both directly via those props instead.
    if (typeof window === "undefined" || forceFullscreen !== undefined || notificationGranted !== undefined) return;
    const handleMessage = (e: MessageEvent) => {
      // The embed can be hosted on any customer domain, so the parent's
      // origin isn't known ahead of time - restrict to messages that
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
    return () => window.removeEventListener("message", handleMessage);
  }, [forceFullscreen, notificationGranted]);

  const requestPushPermission = async () => {
    if (typeof window === "undefined") return;

    if (onRequestNotificationPermission) {
      onRequestNotificationPermission(botName, avatarUrl);
    } else {
      try {
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({
            type: "chatty-request-notification",
            botName,
            avatarUrl: avatarUrl || undefined,
          }, "*");
        }
      } catch {}
    }

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

  const toggleMute = () => {
    setPushMuted((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(`chatty_push_muted_${botId}`, next ? "1" : "0");
      } catch {}
      return next;
    });
  };

  const triggerPushRef = useRef<(bodyText: string) => void>(() => {});
  const triggerPush = (bodyText: string) => {
    if (typeof window === "undefined" || pushMuted) return;
    if (onTriggerNotification) {
      onTriggerNotification(botName, bodyText, avatarUrl);
    } else {
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
    }

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

  const sendTextRef = useRef<(text: string) => Promise<void>>(async () => {});
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [flowConfig, setFlowConfig] = useState<FlowConfig | null>(null);
  // Track whether the active node is a question node waiting for user typed input
  const [flowAwaitingInput, setFlowAwaitingInput] = useState(false);

  const cleanLabel = (label: string = "") => {
    return label
      .replace(/^💬\s*(Message:\s*)?/, "")
      .replace(/^❓\s*(Ask:\s*)?/, "")
      .replace(/^🏷️\s*(Tag session:\s*)?/, "")
      .replace(/^🔔\s*(Escalate to Live Agent\s*)?/, "")
      .replace(/^🔘\s*(Choice:\s*)?/, "")
      .replace(/^👤\s*(Capture:\s*)?/, "")
      .replace(/^🤖\s*(AI Qualify:\s*)?/, "")
      .replace(/^📅\s*(Schedule:\s*)?/, "")
      .replace(/^🚀\s*(Start Conversation\s*)?/, "");
  };

  const isQuestionNode = (node: FlowNode | null | undefined) => {
    const label = node?.data?.label || "";
    return label.startsWith("❓") || node?.type === "question" || node?.id?.startsWith("q-");
  };

  const isChoiceNode = (node: FlowNode | null | undefined) => {
    const label = node?.data?.label || "";
    return (
      label.startsWith("🔘") ||
      node?.type === "choice" ||
      node?.id?.startsWith("choice-") ||
      Boolean(node?.data?.options && node.data.options.length > 0)
    );
  };

  const isLeadCaptureNode = (node: FlowNode | null | undefined) => {
    const label = node?.data?.label || "";
    return label.startsWith("👤") || node?.type === "leadCapture" || node?.id?.startsWith("lead-");
  };

  const isAiQualifyNode = (node: FlowNode | null | undefined) => {
    const label = node?.data?.label || "";
    return label.startsWith("🤖") || node?.type === "aiQualify" || node?.id?.startsWith("ai-");
  };

  const isBookMeetingNode = (node: FlowNode | null | undefined) => {
    const label = node?.data?.label || "";
    return label.startsWith("📅") || node?.type === "bookMeeting" || node?.id?.startsWith("meet-");
  };

  // React Flow stores edge labels in edge.label OR edge.data?.label - resolve both.
  const getEdgeLabel = (edge: FlowEdge): string => edge.label || edge.data?.label || "";

  const getChoiceOptions = (node: FlowNode | null | undefined, edges: FlowEdge[]): Array<{ label: string; edge?: FlowEdge }> => {
    if (!node) return [];
    const outgoing = edges.filter((e) => e.source === node.id);
    const labeledEdges = outgoing.filter((e) => Boolean(getEdgeLabel(e)));

    if (labeledEdges.length > 0) {
      return labeledEdges.map((edge) => ({
        label: getEdgeLabel(edge),
        edge,
      }));
    }

    const nodeOptions = node.data?.options;
    if (Array.isArray(nodeOptions) && nodeOptions.length > 0) {
      return nodeOptions.map((opt, idx) => ({
        label: opt,
        edge: outgoing[idx] || outgoing[0],
      }));
    }

    return [];
  };

  const executeFlowNode = (node: FlowNode | null | undefined, currentConfig: FlowConfig | null | undefined) => {
    if (!node || !currentConfig) return;
    const label = node.data?.label || "";

    // Start node - advance directly to next node
    if (node.type === "start" || node.id === "start" || label.startsWith("🚀")) {
      const nextEdge = currentConfig.edges.find((e) => e.source === node.id);
      if (nextEdge) {
        const nextNode = currentConfig.nodes.find((n) => n.id === nextEdge.target);
        if (nextNode) executeFlowNode(nextNode, currentConfig);
      }
      return;
    }

    // Tag node - run silently, auto-advance
    if (label.startsWith("🏷️") || node.type === "setTag" || node.id?.startsWith("tag-")) {
      const tagValue = cleanLabel(label).replace(/['",]/g, "").trim();
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
      return;
    }

    // Escalate node
    if (label.startsWith("🔔") || node.type === "escalate" || node.id?.startsWith("esc-")) {
      setLiveAgent(true);
      setFlowAwaitingInput(false);
      setActiveNodeId(null);
      setMessages((prev) => [...prev, { role: "assistant", content: cleanLabel(label) || "Connecting you to a live agent now...", sender: "ai", created_at: new Date().toISOString() }]);
      fetch(`${BACKEND_URL}/api/widget/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bot_id: botId, session_id: sessionId, text: "[Visitor requested live agent via flow]", ai_paused: true })
      }).catch(() => {});
      return;
    }

    // Book Meeting node - schedule card trigger
    if (isBookMeetingNode(node)) {
      setActiveNodeId(node.id);
      setFlowAwaitingInput(false);
      setIsBotResponding(false);
      const promptText = cleanLabel(label) || "Select a time that works best for you from our available slots to schedule your demo:";
      setMessages((prev) => [...prev, { role: "assistant", content: `${promptText} [BOOKING_WIDGET]`, sender: "ai", created_at: new Date().toISOString() }]);
      fetch(`${BACKEND_URL}/api/widget/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bot_id: botId, session_id: sessionId, text: `[Calendar booking offered: ${promptText}]`, is_private_note: true })
      }).catch(() => {});
      return;
    }

    // Lead Capture node (e.g. Email, Name, Company) - wait for typed input
    if (isLeadCaptureNode(node)) {
      setActiveNodeId(node.id);
      setFlowAwaitingInput(true);
      setIsBotResponding(false);
      setMessages((prev) => [...prev, { role: "assistant", content: cleanLabel(label), sender: "ai", created_at: new Date().toISOString() }]);
      return;
    }

    // AI Qualify node - consultative question, wait for typed input
    if (isAiQualifyNode(node)) {
      setActiveNodeId(node.id);
      setFlowAwaitingInput(true);
      setIsBotResponding(false);
      const qualifyText = cleanLabel(label) || "Could you share a bit more detail on what you're looking to achieve?";
      setMessages((prev) => [...prev, { role: "assistant", content: qualifyText, sender: "ai", created_at: new Date().toISOString() }]);
      return;
    }

    // Question node - display question, wait for typed user input
    if (isQuestionNode(node)) {
      setActiveNodeId(node.id);
      setFlowAwaitingInput(true);
      setIsBotResponding(false);
      setMessages((prev) => [...prev, { role: "assistant", content: cleanLabel(label), sender: "ai", created_at: new Date().toISOString() }]);
      return;
    }

    // Choice node - display choice question, present quick reply pills
    if (isChoiceNode(node)) {
      setActiveNodeId(node.id);
      setFlowAwaitingInput(false);
      setIsBotResponding(false);
      setMessages((prev) => [...prev, { role: "assistant", content: cleanLabel(label), sender: "ai", created_at: new Date().toISOString() }]);
      return;
    }

    // Message node - display, then auto-advance if single unlabeled edge, or stay for choices
    setActiveNodeId(node.id);
    setFlowAwaitingInput(false);
    setIsBotResponding(false);
    setMessages((prev) => [...prev, { role: "assistant", content: cleanLabel(label), sender: "ai", created_at: new Date().toISOString() }]);
    const outgoing = currentConfig.edges.filter((e) => e.source === node.id);
    if (outgoing.length === 1 && !outgoing[0].label && !outgoing[0].data?.label) {
      setTimeout(() => {
        const nextNode = currentConfig.nodes.find((n) => n.id === outgoing[0].target);
        if (nextNode) executeFlowNode(nextNode, currentConfig);
      }, 900);
    }
  };

  const handleFlowChoice = (choiceText: string, edge?: FlowEdge) => {
    if (!flowConfig) return;

    let targetEdge = edge;
    if (!targetEdge && activeNodeId) {
      const outgoing = flowConfig.edges.filter((e) => e.source === activeNodeId);
      targetEdge = outgoing.find((e) => {
        const l = getEdgeLabel(e).toLowerCase();
        return l === choiceText.toLowerCase() || choiceText.toLowerCase().includes(l);
      });
      if (!targetEdge && outgoing.length > 0) {
        const activeNode = flowConfig.nodes.find((n) => n.id === activeNodeId);
        const options: string[] = activeNode?.data?.options || [];
        const optIdx = options.findIndex((o) => o.toLowerCase() === choiceText.toLowerCase());
        targetEdge = (optIdx >= 0 && outgoing[optIdx]) ? outgoing[optIdx] : outgoing[0];
      }
    }

    if (targetEdge) {
      const targetNode = flowConfig.nodes.find((n) => n.id === targetEdge.target);
      if (targetNode) {
        setActiveNodeId(targetNode.id);
        if (isBookMeetingNode(targetNode)) {
          setFlowAwaitingInput(false);
          const promptText = cleanLabel(targetNode.data?.label) || "Select a time that works best for you from our available slots to schedule your personalized demo meeting:";
          setMessages((prev) => [
            ...prev,
            { role: "user", content: choiceText, created_at: new Date().toISOString() },
            { role: "assistant", content: `${promptText} [BOOKING_WIDGET]`, sender: "ai", created_at: new Date().toISOString() }
          ]);
          return;
        }
      }
    }

    sendTextRef.current(choiceText);
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
      rememberCsatPrompt();
      showToast("Thank you for your feedback!", "success");
      setTimeout(() => { setShowCsat(false); notifyClose(); }, 1500);
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
    if (csatEnabled && messages.length > 2 && !csatSubmitted && canShowCsat()) {
      rememberCsatPrompt();
      setShowCsat(true);
    } else {
      notifyClose();
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
  // sending it - MediaRecorder only has one stop event, not a separate
  // cancel one.
  const recordingCancelledRef = useRef(false);

  const [liveAgent, setLiveAgent] = useState(false);
  const [activeAgentName, setActiveAgentName] = useState<string | null>(null);
  const [activeAgentAvatar, setActiveAgentAvatar] = useState<string | null>(null);
  const [teamProfiles, setTeamProfiles] = useState<TeamProfile[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatBodyRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
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
    // Intentionally runs only on true unmount - revokes whatever files are
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

  // Query active scheduled meeting for the current session on load
  const fetchActiveMeeting = useCallback(async () => {
    if (!botId || !sessionId || !calendarSchedulingEnabled) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/widget/booking/active?bot_id=${encodeURIComponent(botId)}&session_id=${encodeURIComponent(sessionId)}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.success && data.meeting && data.has_active !== false && data.meeting.status !== "cancelled") {
        const activeMeeting: ConfirmedMeeting = data.meeting;
        setMessages((prev) => {
          const alreadyHas = prev.some((m) => m.confirmedMeeting?.id === activeMeeting.id);
          if (alreadyHas) return prev;
          const updated = [...prev];
          for (let idx = updated.length - 1; idx >= 0; idx--) {
            if (updated[idx].role === "assistant") {
              updated[idx] = { ...updated[idx], confirmedMeeting: activeMeeting };
              return updated;
            }
          }
          if (updated.length > 0) {
            updated[0] = { ...updated[0], confirmedMeeting: activeMeeting };
          }
          return updated;
        });
      } else {
        // If has_active is false or cancelled, mark any existing confirmedMeeting as cancelled
        setMessages((prev) =>
          prev.map((m) =>
            m.confirmedMeeting
              ? { ...m, confirmedMeeting: { ...m.confirmedMeeting, status: "cancelled" } }
              : m
          )
        );
      }
    } catch {}
  }, [botId, sessionId, calendarSchedulingEnabled]);

  useEffect(() => {
    fetchActiveMeeting();
  }, [fetchActiveMeeting]);

  // Reset html and body backgrounds to transparent to prevent white corners
  // in rounded iframe borders. Only when we actually own `document` (see
  // ownsDocument above) - otherwise this is the host page's own body.
  useEffect(() => {
    if (ownsDocument) {
      document.documentElement.style.setProperty("background-color", "transparent", "important");
      document.body.style.setProperty("background-color", "transparent", "important");
    }
  }, [ownsDocument]);

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

    const applyEvent = (payload: {
      type: string;
      content?: string;
      created_at?: string;
      value?: boolean;
      sender?: "human" | "ai";
      sender_name?: string;
      sender_avatar?: string;
      assigned_agent_name?: string;
      assigned_agent_avatar?: string;
    }) => {
      if (payload.type === "message") {
        if (payload.created_at) lastPollRef.current = payload.created_at;
        const textContent = payload.content || "";
        const isHuman = payload.sender === "human";
        setMessages((p) => [
          ...p,
          {
            role: "assistant" as const,
            content: textContent,
            sender: isHuman ? "human" : "ai",
            sender_name: payload.sender_name,
            sender_avatar: payload.sender_avatar,
            created_at: payload.created_at || new Date().toISOString(),
          },
        ]);
        if (payload.sender_name) setActiveAgentName(payload.sender_name);
        if (payload.sender_avatar) setActiveAgentAvatar(payload.sender_avatar);
        if (isHuman) setLiveAgent(true);
        setIsBotResponding(false);
        setAgentTyping(false);
        triggerPushRef.current(textContent);
        notifyParent();
      } else if (payload.type === "ai_paused") {
        setLiveAgent(!!payload.value);
        if (payload.assigned_agent_name) setActiveAgentName(payload.assigned_agent_name);
        if (payload.assigned_agent_avatar) setActiveAgentAvatar(payload.assigned_agent_avatar);
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
        if (d.assigned_agent_name) setActiveAgentName(d.assigned_agent_name);
        if (d.assigned_agent_avatar) setActiveAgentAvatar(d.assigned_agent_avatar);
        if (Array.isArray(d.messages) && d.messages.length) {
          lastPollRef.current = d.messages[d.messages.length - 1].created_at;
          const newMsgs = d.messages.map((m: {
            content: string;
            sender?: "human" | "ai";
            sender_name?: string;
            sender_avatar?: string;
            created_at?: string;
          }) => ({
            role: "assistant" as const,
            content: m.content,
            sender: "human" as const,
            sender_name: m.sender_name || d.assigned_agent_name,
            sender_avatar: m.sender_avatar || d.assigned_agent_avatar,
            created_at: m.created_at || new Date().toISOString(),
          }));
          const lastM = newMsgs[newMsgs.length - 1];
          if (lastM.sender_name) setActiveAgentName(lastM.sender_name);
          if (lastM.sender_avatar) setActiveAgentAvatar(lastM.sender_avatar);
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
          // Server closed the stream (~4 min) - loop reconnects immediately.
        } catch {
          if (stopped || ctrl.signal.aborted) return;
          await pollOnce();
          await new Promise((r) => setTimeout(r, 4000));
        }
      }
    };
    run();
    return () => { stopped = true; ctrl.abort(); };
    // notifyParent intentionally excluded - it's a plain function (not
    // memoized) whose identity is only stable because onAssistantMessage
    // itself is stable per mount; including it would restart this
    // long-lived SSE connection any time a caller re-renders with a new
    // (but behaviorally identical) callback reference.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [botId, sessionId]);

  // One-shot manual refetch of any new messages since the last poll - used
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
      if (d.assigned_agent_name) setActiveAgentName(d.assigned_agent_name);
      if (d.assigned_agent_avatar) setActiveAgentAvatar(d.assigned_agent_avatar);
      if (Array.isArray(d.messages) && d.messages.length) {
        lastPollRef.current = d.messages[d.messages.length - 1].created_at;
        const newMsgs = d.messages.map((m: {
          content: string;
          sender?: "human" | "ai";
          sender_name?: string;
          sender_avatar?: string;
          created_at?: string;
        }) => ({
          role: "assistant" as const,
          content: m.content,
          sender: "human" as const,
          sender_name: m.sender_name || d.assigned_agent_name,
          sender_avatar: m.sender_avatar || d.assigned_agent_avatar,
          created_at: m.created_at || new Date().toISOString(),
        }));
        const lastM = newMsgs[newMsgs.length - 1];
        if (lastM.sender_name) setActiveAgentName(lastM.sender_name);
        if (lastM.sender_avatar) setActiveAgentAvatar(lastM.sender_avatar);
        setMessages((p) => [...p, ...newMsgs]);
        notifyParent();
      }
      fetchActiveMeeting();
    } catch {}
  };

  const getHost = (): string => {
    try { if (typeof document !== "undefined" && document.referrer) return new URL(document.referrer).hostname; } catch {}
    try { if (typeof window !== "undefined") return new URLSearchParams(window.location.search).get("host") || ""; } catch {}
    return "";
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
        // Load config from the backend (service role) - works inside third-party
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
          setCalendarSchedulingEnabled(!!bot.calendar_scheduling_enabled);
          try {
            const rawScheme = isPreview ? (paramColorScheme || (bot.color_scheme ? JSON.stringify(bot.color_scheme) : null)) : (bot.color_scheme ? JSON.stringify(bot.color_scheme) : null);
            setColorScheme(rawScheme ? JSON.parse(rawScheme) : null);
          } catch { setColorScheme(null); }
          setFontFamily(isPreview ? (paramFont || bot.font_family || null) : (bot.font_family || paramFont || null));
          const rawFontSize = isPreview ? (paramFontSizePercent || bot.font_size_percent) : (bot.font_size_percent || paramFontSizePercent);
          const parsedFontSize = parseInt(String(rawFontSize), 10);
          setFontSizePercent(Number.isFinite(parsedFontSize) && parsedFontSize > 0 ? parsedFontSize : 100);
          if (Array.isArray(bot.team_profiles)) {
            setTeamProfiles(bot.team_profiles);
          }
          setCustomCss(bot.custom_css || "");
          setCustomJs(bot.custom_js || "");
          setMessages((prev) =>
            prev.length
              ? prev
              : [
                  {
                    role: "assistant",
                    content: wMsg,
                    sender: "ai",
                    created_at: new Date().toISOString(),
                    sender_name: isPreview ? (paramName || bot.name || "Fin") : (bot.name || "Fin"),
                    sender_avatar: isPreview ? (paramAvatarUrl || bot.avatar_url || null) : (bot.avatar_url || null),
                  },
                ]
          );
          if (onThemeLoaded) {
            onThemeLoaded({
              name: bot.name,
              primary_color: bot.primary_color,
              widget_style: bot.widget_style,
              avatar_icon: bot.avatar_icon,
              avatar_url: bot.avatar_url,
              logo_url: bot.logo_url,
              color_scheme: bot.color_scheme ?? null,
              teaser_message: bot.teaser_message,
              welcome_message: bot.welcome_message,
              trigger_rules: bot.trigger_rules,
              font_family: bot.font_family ?? null,
              font_size_percent: bot.font_size_percent || 100,
              panel_size: bot.panel_size,
            });
          }
        }
      } catch (err) {
        console.error("Failed to load bot:", err);
      } finally {
        setLoading(false);
        if (onWidgetReady) onWidgetReady();
        else try { window.parent?.postMessage({ type: "chatty:ready" }, "*"); } catch {}
      }
    }
    loadBot();
    // onWidgetReady intentionally excluded, same reasoning as notifyParent
    // above - it only needs to fire once per successful/failed load, not
    // whenever the caller happens to re-render with a fresh function ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [botId, paramColor, paramStyle, isPreview, paramName, paramWelcome, paramAvatarIcon, paramAvatarUrl, paramLogoUrl, paramLogoBgColor, paramShowSenderTag, paramCsatEnabled, paramColorScheme, paramFont, paramFontSizePercent]);

  // Run the bot owner's custom JS once, after the widget config has loaded.
  // Executed inside a sandboxed, srcdoc iframe (allow-scripts only, no
  // allow-same-origin) rather than a bare `new Function` in this
  // component's own realm. `new Function` here would run with full access
  // to whatever document ChatWidgetCore happens to be mounted into - for
  // the real /embed/[botId] iframe that's an isolated cross-origin
  // document (fine), but for the React SDK and the widget.js Shadow DOM
  // mount it's the *host app's own* document: a malicious or compromised
  // bot's custom JS could read the host's cookies/localStorage/DOM/session
  // directly. The sandboxed iframe gives an opaque, null-origin browsing
  // context in every mount path, so a bad script can only break the
  // widget, matching what the dashboard's custom-JS field promises.
  useEffect(() => {
    if (!customJs) return;

    // Safe extraction and parsing of the visual flow JSON
    try {
      const match = customJs.match(/\/\* CHATTY_FLOW_DATA([\s\S]*?)CHATTY_FLOW_DATA \*\//);
      if (match && match[1]) {
        const flow = JSON.parse(match[1].trim()) as FlowConfig;
        if (flow && flow.status === "active" && flow.nodes && flow.edges) {
          // Deriving flowConfig from customJs (an external string, not React
          // state) once per load - not a cascading-render risk.
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setFlowConfig(flow);
          const startNode = flow.nodes.find((n) => n.id === "start" || n.type === "start");
          const startEdge = flow.edges.find((e) => e.source === (startNode?.id || "start"));
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
          // Flow is paused or removed - clear any existing flow state
          setFlowConfig(null);
          setActiveNodeId(null);
        }
      }
    } catch (err) {
      console.error("Failed to parse visual flow data:", err);
    }

    // Execute any standard custom JS runnable script, sandboxed (see comment
    // above the effect) so it can never reach the host app's realm.
    let sandboxFrame: HTMLIFrameElement | null = null;
    try {
      const runnableJs = customJs.replace(/\/\* CHATTY_FLOW_DATA[\s\S]*?CHATTY_FLOW_DATA \*\//g, "").trim();
      if (runnableJs) {
        sandboxFrame = document.createElement("iframe");
        sandboxFrame.style.display = "none";
        sandboxFrame.setAttribute("sandbox", "allow-scripts");
        sandboxFrame.setAttribute("aria-hidden", "true");
        // Escape "</script>" so the runnable string can't close the wrapper
        // script tag early and inject markup into the sandbox document.
        const escaped = runnableJs.replace(/<\/script/gi, "<\\/script");
        sandboxFrame.srcdoc = `<!DOCTYPE html><script>try{${escaped}}catch(e){console.error("Chatty custom JS execution error:",e);}<\/script>`;
        (rootRef.current ?? document.body).appendChild(sandboxFrame);
      }
    } catch (err) {
      console.error("Chatty custom JS execution error:", err);
    }
    // Deliberately scoped to customJs only - flowConfig/messages state derived
    // from this external string, and executeFlowNode is a stable closure over
    // the fresh `flow` parsed above, not the outer flowConfig state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => {
      sandboxFrame?.remove();
    };
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

  // Force transparent iframe body background to resolve sub-pixel corner
  // bleeding. Same ownsDocument guard as the effect above.
  useEffect(() => {
    if (ownsDocument) {
      document.documentElement.style.setProperty("background-color", "transparent", "important");
      document.body.style.setProperty("background-color", "transparent", "important");
      document.body.style.setProperty("background", "transparent", "important");
    }
  }, [ownsDocument]);

  useEffect(() => {
    if (tab === "messages" && chatBodyRef.current) {
      chatBodyRef.current.scrollTo({
        top: chatBodyRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages, isBotResponding, tab]);

  // Grow the composer with its content (up to max-h-[108px] on the textarea
  // itself, ~4 lines, after which it scrolls). Keyed on inputValue rather
  // than done only in the textarea's own onChange so it also re-measures
  // after non-typing changes to the value - an emoji insert, or the field
  // clearing itself back to one line after a message sends.
  useEffect(() => {
    const el = composerRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [inputValue]);

  // Load the owner's chosen Google Font at runtime - a <link> to Google's
  // own CSS, not next/font/google (which only ever works inside this app's
  // own root layout; the standalone Shadow DOM bundle and third-party
  // iframes never render that layout, so its font-loading mechanism can't
  // reach them at all, only a plain runtime <link> can). Appending to
  // document.head (not rootRef's own tree) is deliberate and safe even
  // inside a Shadow Root: loaded fonts are a document-wide resource in
  // every browser, not scoped by the shadow boundary the way CSS/DOM is,
  // so this reaches the widget regardless of which mount path rendered it.
  // Keyed by font name so re-renders with the same font don't re-insert a
  // duplicate <link>, and so switching fonts doesn't leave old ones loaded
  // forever.
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
    setMessages((p) => [...p, { role: "user", content: text, created_at: new Date().toISOString() }]);
    setInputValue("");
    setEmojiOpen(false);

    let flowContext: Record<string, any> | undefined = undefined;

    if (flowConfig && activeNodeId) {
      const activeNode = flowConfig.nodes.find((n) => n.id === activeNodeId);
      const outgoingEdges = flowConfig.edges.filter((e) => e.source === activeNodeId);
      const userText = text.trim();
      const userLower = userText.toLowerCase();

      // 1. Auto-extract contact info from user input
      const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userText);
      if (isEmail) {
        setCapturedLeadData((prev) => ({ ...prev, email: userText }));
      }
      if (isLeadCaptureNode(activeNode)) {
        const field = activeNode?.data?.field || "email";
        if (field === "name" && !isEmail) setCapturedLeadData((prev) => ({ ...prev, name: userText }));
        else if (field === "company" && !isEmail) setCapturedLeadData((prev) => ({ ...prev, company: userText }));
        else if (field === "phone") setCapturedLeadData((prev) => ({ ...prev, phone: userText }));
      }

      // 2. Check if user input directly matches an outgoing branch choice
      const choiceOptions = getChoiceOptions(activeNode, outgoingEdges);
      const matchedOpt = choiceOptions.find((opt) => {
        const l = opt.label.toLowerCase();
        return l === userLower || userLower.includes(l) || l.includes(userLower);
      });

      let targetNode = matchedOpt && matchedOpt.edge ? flowConfig.nodes.find((n) => n.id === matchedOpt.edge!.target) : undefined;
      if (!targetNode && isLeadCaptureNode(activeNode) && isEmail && outgoingEdges.length > 0) {
        targetNode = flowConfig.nodes.find((n) => n.id === outgoingEdges[0].target);
      } else if (!targetNode && (isAiQualifyNode(activeNode) || isQuestionNode(activeNode)) && outgoingEdges.length > 0) {
        targetNode = flowConfig.nodes.find((n) => n.id === outgoingEdges[0].target);
      }

      if (targetNode) {
        setActiveNodeId(targetNode.id);
        if (isBookMeetingNode(targetNode)) {
          setFlowAwaitingInput(false);
          const promptText = cleanLabel(targetNode.data?.label) || "Select a time that works best for you from our available slots to schedule your personalized demo meeting:";
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: `${promptText} [BOOKING_WIDGET]`, sender: "ai" }
          ]);
          return;
        }
      }

      const nodeToUse = targetNode || activeNode;
      flowContext = {
        flow_name: "Consultative Qualification Flow",
        active_node_id: nodeToUse?.id || activeNodeId,
        node_type: nodeToUse?.type || "aiQualify",
        label: cleanLabel(nodeToUse?.data?.label || ""),
        prompt: nodeToUse?.data?.prompt || "",
        options: choiceOptions.map((o) => o.label),
        field: nodeToUse?.data?.field || "",
        collected_data: capturedLeadData,
      };
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
        setMessages((p) => [...p, { role: "assistant" as const, content, sender: "ai", created_at: new Date().toISOString() }]);
      } else {
        setStreamingAssistant(content);
      }
    };

    try {
      const res = await fetch(`${BACKEND_URL}/api/widget/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...widgetTokenHeader },
        body: JSON.stringify({
          bot_id: botId,
          session_id: sessionId,
          text,
          visitor_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          host: getHost(),
          flow_context: flowContext,
        }),
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
          let payload: {
            type: string;
            text?: string;
            reply?: string;
            detail?: string;
            sources?: Citation[];
            flow_action?: { advance_to?: string; captured?: Record<string, string> };
          };
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
            if (payload.flow_action) {
              if (payload.flow_action.captured) {
                setCapturedLeadData((prev) => ({ ...prev, ...payload.flow_action!.captured }));
              }
              if (payload.flow_action.advance_to && flowConfig) {
                const targetNode = flowConfig.nodes.find((n) => n.id === payload.flow_action!.advance_to);
                if (targetNode) {
                  setActiveNodeId(targetNode.id);
                }
              }
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
  sendTextRef.current = sendText;

  // ---- Media message (image / audio / file) ----
  const sendMedia = async (file: File | Blob, filename: string, caption = "") => {
    if (isBotResponding) return;
    const isImage = file.type.startsWith("image/");
    const isAudio = file.type.startsWith("audio/");
    const localUrl = URL.createObjectURL(file);
    setMessages((p) => [...p, { role: "user", content: caption || (isAudio ? VOICE_MESSAGE_PLACEHOLDER : `📎 ${filename}`), fileUrl: localUrl, fileType: file.type, created_at: new Date().toISOString() }]);
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
        ? { role: "assistant", content: body.reply, sender: "ai", created_at: new Date().toISOString() }
        : { role: "assistant", content: `⚠️ ${body.detail || "Couldn't process that file."}`, created_at: new Date().toISOString() }]);
      notifyParent();
    } catch {
      setMessages((p) => [...p, { role: "assistant", content: "Sorry, I couldn't upload that.", created_at: new Date().toISOString() }]);
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
  // attribute) - the widget always runs embedded in one, so client-side
  // live transcription silently failed for most visitors.
  const toggleRecord = async () => {
    if (recording) {
      mediaRecorderRef.current?.stop();
      return;
    }
    try {
      recordingCancelledRef.current = false;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Live amplitude animation while recording - each bar samples a
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
      const USABLE_BINS = 64; // lower half of the spectrum - where voice energy actually lives
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
          showToast("Couldn't process that recording - try again.", "error");
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
        // A cold backend instance can take 20-30s+ to spin up - without a
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
            // Land the transcript in the input box - the visitor reviews/
            // edits and presses send themselves, same as typing.
            setInputValue((v) => (v ? `${v} ${text}` : text));
          } else {
            // No speech detected, or transcription failed - fall back to
            // sending the raw audio so the message isn't just lost.
            sendMedia(wav, "voice-message.wav");
          }
        } catch (err) {
          if ((err as Error)?.name === "AbortError") {
            showToast("Transcription is taking longer than usual - sending your voice message instead.", "error");
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

  // Discards the in-progress recording instead of transcribing/sending it -
  // stopping is the only event MediaRecorder gives us, so this just flags
  // the take as cancelled for mr.onstop (above) to skip processing.
  const cancelRecording = () => {
    recordingCancelledRef.current = true;
    mediaRecorderRef.current?.stop();
  };

  // ---- AI search & Knowledge Base ----
  const runSearch = async (q: string) => {
    if (!q.trim() || searching) return;
    setSearching(true);
    setSearchAnswer(null);
    setSearchKbResults([]);
    try {
      // 1. Search knowledge base articles
      fetch(`${BACKEND_URL}/api/widget/kb/search?bot_id=${encodeURIComponent(String(botId))}&q=${encodeURIComponent(q)}`)
        .then((r) => r.ok ? r.json() : null)
        .then((d) => {
          if (d?.articles) setSearchKbResults(d.articles);
        })
        .catch(() => {});

      // 2. Query AI assistant
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
    return <div className="flex h-full items-center justify-center bg-transparent"><Loader2 className="size-6 animate-spin text-neutral-400" /></div>;
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
    h1: ({ children }) => <h1 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 mt-3 mb-1.5">{children}</h1>,
    h2: ({ children }) => <h2 className="text-xs font-bold text-neutral-900 dark:text-neutral-100 mt-2.5 mb-1">{children}</h2>,
    h3: ({ children }) => <h3 className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 mt-2 mb-1">{children}</h3>,
    table: ({ children }) => (
      <div className="w-full my-2.5 overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-xs">
        <table className="w-full border-collapse text-left text-[11px]">{children}</table>
      </div>
    ),
    thead: ({ children }) => (
      <thead className="bg-neutral-100 dark:bg-neutral-800/90 border-b border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-neutral-100 font-semibold">
        {children}
      </thead>
    ),
    tbody: ({ children }) => (
      <tbody className="divide-y divide-neutral-200/60 dark:divide-neutral-800/60">
        {children}
      </tbody>
    ),
    tr: ({ children }) => (
      <tr className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/30 transition-colors">
        {children}
      </tr>
    ),
    th: ({ children }) => (
      <th className="px-2.5 py-1.5 font-semibold text-neutral-900 dark:text-neutral-100 whitespace-nowrap">{children}</th>
    ),
    td: ({ children }) => (
      <td className="px-2.5 py-1.5 text-neutral-700 dark:text-neutral-300 align-top">{children}</td>
    ),
    blockquote: ({ children }) => (
      <blockquote className="border-l-3 border-[#f97316] pl-2.5 py-1 my-2 italic text-neutral-600 dark:text-neutral-400 bg-neutral-50/70 dark:bg-neutral-850/40 rounded-r-lg text-xs">
        {children}
      </blockquote>
    ),
    hr: () => <hr className="my-3 border-neutral-200 dark:border-neutral-800" />,
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
  // interpolating them - not a security boundary (custom_css already lets
  // the bot owner inject arbitrary CSS here), just guarding against a
  // malformed stored value breaking the whole stylesheet.
  const colorSchemeCss = buildColorSchemeCss(colorScheme, "#chatty-root");
  // Same reasoning as colorSchemeCss above: each preset's own font-family
  // rule in widget-presets.css is !important, so only an equally-specific
  // injected !important rule can override it - a plain inline style
  // attribute never would. Restricted to letters/digits/spaces/hyphen
  // (every real Google Font name fits that), not a security boundary
  // (custom_css already lets the owner inject arbitrary CSS) so much as a
  // guard against a malformed stored value breaking the stylesheet or
  // escaping the rule via injected quotes/braces.
  const fontFamilyCss = fontFamily && /^[a-zA-Z0-9 -]+$/.test(fontFamily)
    ? `#chatty-root { font-family: "${fontFamily}", sans-serif !important; }`
    : "";

  return (
    <div
      ref={rootRef}
      id="chatty-root"
      className={`w-full h-full flex flex-col overflow-hidden text-neutral-900 dark:text-neutral-100 font-sans style-${widgetStyle} ${isFullscreen ? "" : "rounded-2xl"}`}
      style={{
        touchAction: "manipulation",
        ...primaryColorCssVars(primaryColor),
      } as React.CSSProperties}
    >
      <style dangerouslySetInnerHTML={{ __html: `
        ${ownsDocument ? `
        /* html/body targeting only applies when this document is a real
           /embed iframe we fully own (see ownsDocument above) - as a plain
           <style> tag it is NOT scoped to #chatty-root, so on the React SDK's
           direct host-page mount this used to force overflow:hidden and
           animation:none onto the *host app's* own html/body. Inside a
           Shadow Root it would be a harmless no-op (no real html/body
           element exists in that tree), but gating it explicitly here is
           clearer than relying on that as the only thing making it safe. */
        html, body {
          touch-action: manipulation;
          background: transparent !important;
          background-image: none !important;
          animation: none !important;
          overflow: hidden !important;
          /* The root layout's "antialiased" Tailwind class (-webkit-font-smoothing:
             antialiased) applies globally, including here - it's a Mac-oriented
             hint that thins glyphs toward macOS's grayscale AA look. On Windows
             Chrome it overrides the OS's own ClearType subpixel rendering, which
             is tuned for Windows displays, making small chat text read noticeably
             softer than the rest of the page. Reverting to "auto" here restores
             each platform's own native (sharper on Windows) text rendering,
             scoped to just the widget so it doesn't change how the dashboard or
             marketing pages render text. */
          -webkit-font-smoothing: auto !important;
          -moz-osx-font-smoothing: auto !important;
        }` : ""}
        /* Strip only box-shadow inside the iframe: the container fills the iframe
           edge-to-edge with zero margin, so any shadow has no room to render and
           gets hard-clipped by the iframe's own overflow:hidden (ugly) - this is
           an iframe limitation, not a CSS bug, since content can never bleed past
           an iframe's own rectangle. Each design's border and border-radius are
           safe to keep - a border draws flush at the box edge with zero bleed, and
           the outer host (widget.js, page.tsx) now applies no radius/border/shadow
           of its own, so there's no double-corner artifact either. This keeps each
           design's signature frame (e.g. Luxury Editorial's gold border,
           Neubrutalism's thick black border) visible on the live widget instead of
           only in previews. Restoring the shadow too would require insetting this
           panel inside a larger host box to give it room - deliberately not done,
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
      {customCss && (
        <style
          dangerouslySetInnerHTML={{
            __html: customCss.replace(/<\/style/gi, '<\\/style').replace(/<script/gi, '<\\/script'),
          }}
        />
      )}
      {/* Text-size scaling lives on this inner wrapper, not #chatty-root
          itself - #chatty-root's own w-full/h-full defines the widget's
          real footprint (the iframe/host container it's actually given).
          Compensating the wrapper's size has to be done in real PIXELS
          (containerSize, from the ResizeObserver above), not percentages:
          `width: 76.9%; zoom: 130%` still lays out - and reports via
          getBoundingClientRect - as literally 76.9% of the parent's real
          size, not 100%; zoom does not scale how a *percentage* resolves.
          Pixel lengths behave differently: `width: 292px; zoom: 130%` DOES
          render as 380px (292 × 1.3). So this only compensates once
          containerSize is known; until then it renders unscaled for one
          frame rather than with wrong (percentage-based) math. */}
      <div
        className="w-full h-full flex flex-col overflow-hidden"
        style={fontSizePercent !== 100 && containerSize ? {
          zoom: `${fontSizePercent}%`,
          width: `${containerSize.width / (fontSizePercent / 100)}px`,
          height: `${containerSize.height / (fontSizePercent / 100)}px`,
        } : undefined}
      >
      {/* Header */}
      <div className="chat-header px-4 pt-3 pb-2 border-b border-neutral-100 dark:border-neutral-850">
        <div className="flex items-center gap-2.5">
          {tab !== "home" && (
            <motion.button
              type="button"
              whileTap={{ scale: 0.85 }}
              onClick={() => {
                if (activeArticle) setActiveArticle(null);
                else setTab("home");
              }}
              className="p-1 -ml-1 rounded-full hover:opacity-100 transition-colors shrink-0 cursor-pointer"
              style={{ opacity: 0.9 }}
              aria-label="Back to home"
              title="Back"
            >
              <ArrowLeft className="size-4" />
            </motion.button>
          )}
          {tab !== "home" && (liveAgent || activeAgentName) ? (
            <AgentAvatar
              src={activeAgentAvatar}
              name={activeAgentName || "Agent"}
              size="size-10"
              showStatusDot={true}
              statusColor="bg-amber-400"
              primaryColor={primaryColor}
              onPrimary={onPrimary}
              bgColor={colorScheme?.avatar?.bg || logoBgColor}
              textColor={colorScheme?.avatar?.text}
              className="shrink-0"
            />
          ) : (
            <div
              className="size-11 rounded-full flex items-center justify-center font-bold text-base overflow-hidden shrink-0 transition-colors"
              style={logoBgColor ? { backgroundColor: logoBgColor, color: getOnColor(logoBgColor) } : { backgroundColor: "color-mix(in srgb, currentColor 25%, transparent)" }}
            >
              {headerLogoInner("size-6")}
            </div>
          )}
          <div className="leading-tight">
            <h4 className="font-semibold text-sm">
              {tab === "articles" && activeArticle ? activeArticle.title : tab !== "home" && (liveAgent || activeAgentName) ? (activeAgentName || "Agent") : botName}
            </h4>
            <p className="text-[9px] flex items-center gap-1" style={{ opacity: 0.85 }}>
              {tab === "articles" ? (
                <span>Help Center</span>
              ) : tab !== "home" && (liveAgent || activeAgentName) ? (
                <span>Active in the last 15m</span>
              ) : (
                <>
                  <span className="size-1.5 rounded-full bg-green-300 animate-pulse" />
                  <span>Online</span>
                </>
              )}
            </p>
          </div>
          {tab === "home" && (
            <div className="ml-auto flex items-center gap-2 mr-1">
              <AvatarGroup
                profiles={teamProfiles}
                botAvatarUrl={avatarUrl || logoUrl}
                botName={botName}
                primaryColor={primaryColor}
                onPrimary={onPrimary}
                bgColor={colorScheme?.avatar?.bg || logoBgColor}
                textColor={colorScheme?.avatar?.text}
                size="size-7"
              />
            </div>
          )}
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
            onClick={pushGranted ? toggleMute : requestPushPermission}
            className={`${voiceEnabled ? "" : "ml-auto "}p-1.5 rounded-full hover:opacity-100 transition-colors shrink-0 cursor-pointer`}
            style={{ opacity: 0.8 }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "color-mix(in srgb, currentColor 15%, transparent)")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
            aria-label={pushGranted ? (pushMuted ? "Unmute notifications" : "Mute notifications") : "Enable browser notifications"}
            title={
              !pushGranted
                ? "Enable browser notifications"
                : pushMuted
                  ? "Notifications muted - tap to unmute"
                  : "Browser notifications enabled - tap to mute"
            }
          >
            {pushGranted && pushMuted ? (
              <BellOff className="size-4" />
            ) : (
              <Bell className={`size-4 ${pushGranted ? "fill-current" : ""}`} />
            )}
          </button>
          {tab === "messages" && (
            <button onClick={clearChat} className="p-1.5 rounded-full hover:opacity-100 transition-colors shrink-0" style={{ opacity: 0.8 }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "color-mix(in srgb, currentColor 15%, transparent)")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
              aria-label="Clear conversation" title="Clear conversation">
              <RefreshCw className="size-4" />
            </button>
          )}
          <button onClick={handleCloseClick} className="p-1.5 rounded-full hover:opacity-100 transition-colors shrink-0" style={{ opacity: 0.8 }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "color-mix(in srgb, currentColor 15%, transparent)")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
            aria-label="Close chat" title="Close">
            <X className="size-4" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div ref={chatBodyRef} className="flex-1 overflow-y-auto scrollbar-thin widget-panel flex flex-col relative">
        {voiceCallOpen ? (
          <VoiceCallWidget
            botId={botId}
            sessionId={sessionId}
            backendUrl={BACKEND_URL}
            originToken={effectiveOriginToken}
            visitorTimezone={typeof Intl !== "undefined" && Intl.DateTimeFormat().resolvedOptions().timeZone && Intl.DateTimeFormat().resolvedOptions().timeZone !== "UTC" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "America/New_York"}
            primaryColor={primaryColor}
            onClose={() => { setVoiceCallOpen(false); refetchNow(); }}
          />
        ) : showCsat ? (
          /* CSAT Feedback Modal */
          // Colors here are deliberately currentColor-relative (style props,
          // not text-neutral-* / dark:* classes) rather than the pattern
          // used elsewhere in this file: those classes assume Tailwind's
          // `dark:` variant tracks whichever style preset is actually
          // active, but presets can be dark on their own (dark-sleek etc,
          // no `.dark` ancestor needed) or light, independent of the
          // visitor's OS color scheme - so a fixed `text-neutral-800
          // dark:text-neutral-200` pairs correctly with the active preset
          // only by coincidence. currentColor already IS the active
          // preset's own forced text color at this point in the tree
          // (widget-presets.css's .style-X { color: ... !important }), so
          // deriving from it is correct for every preset unconditionally,
          // not just the ones the coincidence happened to favor.
          <div className="p-5 flex flex-col justify-center h-full space-y-4">
            <div className="text-center space-y-2">
              <h3 className="text-sm font-bold">How was your conversation?</h3>
              <p className="text-[11px]" style={{ opacity: 0.6 }}>Your rating helps us improve support quality.</p>
            </div>
            {/* Friendly animated sentiment scale: clearer than tiny stars on mobile. */}
            <div className="flex justify-center gap-1 py-2" role="radiogroup" aria-label="Conversation rating">
              {["😞", "😕", "😐", "🙂", "🤩"].map((face, index) => {
                const rating = index + 1;
                const selected = rating === csatRating;
                return (
                  <motion.button
                    key={face}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={`${rating} out of 5`}
                    onClick={() => setCsatRating(rating)}
                    whileHover={{ y: -4, scale: 1.12 }}
                    whileTap={{ scale: 0.88, rotate: selected ? -4 : 4 }}
                    className="size-10 rounded-2xl flex items-center justify-center text-xl cursor-pointer transition-all"
                    style={{ backgroundColor: selected ? "color-mix(in srgb, #f59e0b 18%, transparent)" : "color-mix(in srgb, currentColor 6%, transparent)", opacity: selected || csatRating === 0 ? 1 : 0.45, border: selected ? "1px solid #f59e0b" : "1px solid transparent" }}
                  >
                    {face}
                  </motion.button>
                );
              })}
            </div>
            {/* Comment */}
            <textarea
              rows={3}
              value={csatComment}
              onChange={(e) => setCsatComment(e.target.value)}
              placeholder="What went well or could be better? (optional)..."
              className="w-full rounded-xl px-3 py-2 text-xs resize-none focus:outline-none"
              style={{ backgroundColor: "color-mix(in srgb, currentColor 6%, transparent)", border: "1px solid color-mix(in srgb, currentColor 15%, transparent)" }}
            />
            {/* Action buttons */}
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => { setShowCsat(false); notifyClose(); }}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
                style={{ border: "1px solid color-mix(in srgb, currentColor 20%, transparent)", opacity: 0.8 }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "color-mix(in srgb, currentColor 8%, transparent)")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
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
          <AnimatePresence mode="wait">
            {/* HOME */}
            {tab === "home" && (
              <motion.div
                key="home"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="p-4 space-y-3 flex-1 flex flex-col justify-start"
              >
                {/* Greeting Hero Card */}
                <div className="widget-card p-4">
                  <h3 className="text-base font-bold leading-snug">
                    Hello there.<br />How can we help?
                  </h3>
                  <p className="text-xs opacity-75 mt-1.5 leading-relaxed">{welcomeMsg}</p>
                </div>

                {/* Ask a question card with overlapping team avatars */}
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.01, y: -1 }}
                  whileTap={{ scale: 0.985 }}
                  transition={{ type: "spring", stiffness: 450, damping: 25 }}
                  onClick={() => {
                    setTab("messages");
                  }}
                  className="widget-card w-full flex items-center justify-between p-3.5 text-left group cursor-pointer shadow-xs"
                >
                  <div className="min-w-0 pr-2">
                    <h4 className="text-xs font-semibold">
                      Ask a question
                    </h4>
                    <p className="text-[11px] opacity-70 mt-0.5">
                      AI Agent and team can help
                    </p>
                  </div>
                  <AvatarGroup
                    profiles={teamProfiles}
                    botAvatarUrl={avatarUrl || logoUrl}
                    botName={botName}
                    primaryColor={primaryColor}
                    onPrimary={onPrimary}
                    bgColor={logoBgColor}
                    size="size-6"
                  />
                </motion.button>

                {/* RECENT MESSAGE */}
                {messages.length > 0 && (
                  <div className="space-y-1 pt-0.5">
                    <span className="text-[11px] font-semibold opacity-75 px-1">
                      Recent message
                    </span>
                    <motion.button
                      type="button"
                      whileHover={{ scale: 1.01, y: -1 }}
                      whileTap={{ scale: 0.985 }}
                      transition={{ type: "spring", stiffness: 450, damping: 25 }}
                      onClick={() => setTab("messages")}
                      className="widget-card w-full flex items-center justify-between p-3.5 text-left group cursor-pointer shadow-xs"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
                        {activeAgentAvatar ? (
                          <AgentAvatar
                            src={activeAgentAvatar}
                            name={activeAgentName || botName}
                            primaryColor={primaryColor}
                            onPrimary={onPrimary}
                            bgColor={logoBgColor}
                            size="size-9"
                            className="shrink-0"
                          />
                        ) : (
                          renderBotAvatar("size-9", "size-5")
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold truncate group-hover:opacity-85">
                              {activeAgentName || botName}
                            </span>
                            <span className="text-[11px] opacity-60 font-medium shrink-0">
                              {formatTimeCompact(messages[messages.length - 1]?.created_at)}
                            </span>
                          </div>
                          <p className="text-[11px] opacity-70 truncate mt-0.5">
                            {messages[messages.length - 1]?.content?.slice(0, 100) || "Conversation started"}
                          </p>
                        </div>
                      </div>
                    </motion.button>
                  </div>
                )}

                {/* Leave us a message */}
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.01, y: -1 }}
                  whileTap={{ scale: 0.985 }}
                  transition={{ type: "spring", stiffness: 450, damping: 25 }}
                  onClick={() => setShowOfflineForm(true)}
                  className="widget-card w-full flex items-center justify-between p-3.5 text-left group cursor-pointer shadow-xs"
                >
                  <span className="flex items-center gap-2.5 text-xs font-semibold">
                    <Mail className="size-4" style={{ color: primaryColor }} />
                    Leave us a message
                  </span>
                  <ChevronRight className="size-4 opacity-50 group-hover:translate-x-0.5 transition-transform" />
                </motion.button>

                {/* Editorial knowledge card: one beautiful entry point instead of
                    repeating search/browse/article actions on the home screen. */}
                {kbArticles.length > 0 && (() => {
                  const featured = kbPromoted[0] || kbArticles[0];
                  const supporting = (kbPromoted.length > 0 ? kbPromoted : kbArticles)
                    .filter((article) => article.id !== featured.id)
                    .slice(0, 2);
                  return (
                    <div className="space-y-2">
                      <motion.button
                        type="button"
                        whileHover={{ y: -2 }}
                        whileTap={{ scale: 0.985 }}
                        transition={{ type: "spring", stiffness: 450, damping: 28 }}
                        onClick={() => {
                          openKbArticle(featured);
                          setTab("articles");
                        }}
                        className="w-full overflow-hidden rounded-2xl text-left shadow-sm group cursor-pointer"
                        style={{ background: primaryColor, color: onPrimary }}
                      >
                        <div className="p-4">
                          <div className="flex items-center justify-between gap-3 mb-7">
                            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] opacity-80">
                              <BookOpen className="size-3.5" /> Featured guide
                            </span>
                            <ChevronRight className="size-4 opacity-70 group-hover:translate-x-1 transition-transform" />
                          </div>
                          <p className="text-sm font-semibold leading-snug line-clamp-2">{featured.title}</p>
                          <p className="text-[11px] opacity-75 mt-1.5 line-clamp-2">
                            {featured.subtitle || "Practical answers from the team behind this assistant."}
                          </p>
                        </div>
                        <div className="px-4 py-2.5 text-[10px] font-semibold border-t border-white/20 opacity-90">
                          Read the guide
                        </div>
                      </motion.button>
                      {supporting.length > 0 && (
                        <div className="widget-card divide-y divide-black/5 dark:divide-white/10 overflow-hidden">
                          {supporting.map((article) => (
                            <button
                              key={article.id}
                              type="button"
                              onClick={() => {
                                openKbArticle(article);
                                setTab("articles");
                              }}
                              className="w-full flex items-center justify-between gap-3 px-3.5 py-3 text-left group cursor-pointer hover:opacity-80 transition-opacity"
                            >
                              <span className="text-xs font-medium truncate">{article.title}</span>
                              <ChevronRight className="size-3.5 opacity-50 shrink-0 group-hover:translate-x-0.5 transition-transform" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}

              </motion.div>
            )}

            {/* MESSAGES */}
            {tab === "messages" && (
              <motion.div
                key="messages"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="flex-1 flex flex-col min-h-0"
              >
                <div className="p-4 space-y-4 text-xs">
                <AnimatePresence initial={false}>
                  {messages.map((msg, i) => {
                    const hasBooking = Boolean(msg.confirmedMeeting || i === lastBookingMsgIdx);
                    const isTakeover =
                      msg.role === "assistant" &&
                      msg.sender === "human" &&
                      (i === 0 || messages[i - 1].sender !== "human");
                    const agentDisplayName = msg.sender_name || activeAgentName || "Agent";
                    const agentDisplayAvatar = msg.sender_avatar || activeAgentAvatar;

                    return (
                      <Fragment key={i}>
                        {isTakeover && (
                          <motion.div
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex items-center justify-center gap-2 py-3 my-1 w-full text-xs text-neutral-500 dark:text-neutral-400 select-none"
                          >
                            <AgentAvatar
                              src={agentDisplayAvatar}
                              name={agentDisplayName}
                              size="size-5"
                              primaryColor={primaryColor}
                              onPrimary={onPrimary}
                              bgColor={colorScheme?.avatar?.bg || logoBgColor}
                              textColor={colorScheme?.avatar?.text}
                            />
                            <span>
                              <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                                {agentDisplayName}
                              </span>{" "}
                              joined the conversation
                            </span>
                          </motion.div>
                        )}
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`flex gap-2 ${hasBooking ? "w-full max-w-[96%] sm:max-w-[88%]" : "max-w-[88%]"} ${msg.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"}`}
                        >
                          {msg.role !== "user" && (
                            msg.sender === "human" ? (
                              <AgentAvatar
                                src={agentDisplayAvatar}
                                name={agentDisplayName}
                                size="size-6"
                                primaryColor={primaryColor}
                                onPrimary={onPrimary}
                                bgColor={colorScheme?.avatar?.bg || logoBgColor}
                                textColor={colorScheme?.avatar?.text}
                                className="shrink-0 mt-0.5"
                              />
                            ) : (
                              <div
                                className="size-6 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 overflow-hidden mt-0.5"
                                style={{ background: primaryColor, color: onPrimary }}
                              >
                                {avatarInner("size-3.5")}
                              </div>
                            )
                          )}
                          <div className={`flex flex-col min-w-0 ${hasBooking ? "w-full" : ""}`}>
                            {/* .user-bubble's background/color come entirely from the
                                design preset's own CSS (globals.css, !important) - an
                                inline style here computed from primaryColor would be
                                silently overridden for the background but NOT
                                recomputed for the text color, producing the same
                                invisible-text bug the header had. */}
                            <div className={`${hasBooking ? "p-1.5 sm:p-2.5 w-full" : "p-2.5"} rounded-2xl leading-relaxed min-w-0 break-words [overflow-wrap:anywhere] ${msg.role === "user" ? "user-bubble rounded-tr-none" : "bot-bubble bg-neutral-100 dark:bg-neutral-800 rounded-tl-none"}`}>
                              {/* msg.fileUrl is a local blob: URL (URL.createObjectURL) or an uploaded-file URL - neither works with next/image's optimizer */}
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              {msg.fileUrl && msg.fileType?.startsWith("image/") && <img src={msg.fileUrl} alt="attachment" className="rounded-lg mb-1 max-h-40 object-cover" />}
                              {msg.fileUrl && msg.fileType?.startsWith("audio/") && <AudioBubble src={msg.fileUrl} />}
                              {msg.role === "assistant" ? (
                                <>
                                  {(() => {
                                    const { cleanContent, products, videoClips } = parseProductCards(msg.content);
                                    return (
                                      <>
                                        {cleanContent && (
                                          <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]} components={mdComponents}>
                                            {cleanContent}
                                          </ReactMarkdown>
                                        )}
                                        {products.length > 0 && (
                                          <div className="flex flex-col gap-2 my-2 w-full">
                                            {products.map((p, pIdx) => (
                                              <ProductCard
                                                key={p.id || pIdx}
                                                product={p}
                                                primaryColor={primaryColor}
                                                onSelect={(prod) => setInputValue(`Is ${prod.title} available?`)}
                                              />
                                            ))}
                                          </div>
                                        )}
                                        {videoClips.length > 0 && (
                                          <div className="flex flex-col gap-2 my-2 w-full">
                                            {videoClips.map((c, cIdx) => (
                                              <VideoCard key={cIdx} clip={c} primaryColor={primaryColor} />
                                            ))}
                                          </div>
                                        )}
                                      </>
                                    );
                                  })()}
                                  {(msg.confirmedMeeting || i === lastBookingMsgIdx) && (
                                    <InlineBookingCard
                                      botId={String(botId)}
                                      sessionId={sessionId}
                                      visitorTimezone={typeof Intl !== "undefined" && Intl.DateTimeFormat().resolvedOptions().timeZone && Intl.DateTimeFormat().resolvedOptions().timeZone !== "UTC" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "America/New_York"}
                                      primaryColor={primaryColor}
                                      backendUrl={BACKEND_URL}
                                      initialMeeting={msg.confirmedMeeting || (i === lastBookingMsgIdx ? latestActiveMeeting || undefined : undefined)}
                                      initialName={extractedVisitorInfo.name}
                                      initialEmail={extractedVisitorInfo.email}
                                      initialPhone={extractedVisitorInfo.phone}
                                      initialCompany={extractedVisitorInfo.company}
                                      onBookingSuccess={(meeting) => {
                                        setMessages((prev) => {
                                          const updated = [...prev];
                                          if (updated[i]) {
                                            updated[i] = { ...updated[i], confirmedMeeting: meeting };
                                          }
                                          return updated;
                                        });
                                      }}
                                      onMeetingRescheduled={(meeting) => {
                                        setMessages((prev) =>
                                          prev.map((m) =>
                                            m.confirmedMeeting && (m.confirmedMeeting.id === meeting.id || !m.confirmedMeeting.id)
                                              ? { ...m, confirmedMeeting: meeting }
                                              : m
                                          )
                                        );
                                      }}
                                      onMeetingCancelled={() => {
                                        setMessages((prev) =>
                                          prev.map((m) => {
                                            if (m.confirmedMeeting) {
                                              const copy = { ...m };
                                              delete copy.confirmedMeeting;
                                              return copy;
                                            }
                                            return m;
                                          })
                                        );
                                      }}
                                    />
                                  )}
                                </>
                              ) : !(msg.fileType?.startsWith("audio/") && msg.content === VOICE_MESSAGE_PLACEHOLDER) && <span>{msg.content}</span>}
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
                            {/* Intercom-style sender tag underneath bubble */}
                            {msg.role === "assistant" && (
                              <div className="flex items-center gap-1 text-[11px] text-neutral-400 dark:text-neutral-500 mt-1 px-1 select-none">
                                {msg.sender === "human" ? (
                                  <span>{agentDisplayName} • {formatTimeCompact(msg.created_at)}</span>
                                ) : (
                                  <span>{botName || "Fin"} • AI Agent • {formatTimeCompact(msg.created_at)}</span>
                                )}
                              </div>
                            )}
                          </div>
                        </motion.div>
                      </Fragment>
                    );
                  })}
                  {(isBotResponding || agentTyping) && (
                    <div className="flex gap-2 mr-auto">
                      {agentTyping ? (
                        <AgentAvatar
                          src={activeAgentAvatar}
                          name={activeAgentName || "Agent"}
                          size="size-6"
                          primaryColor={primaryColor}
                          onPrimary={onPrimary}
                          bgColor={colorScheme?.avatar?.bg || logoBgColor}
                          textColor={colorScheme?.avatar?.text}
                          className="shrink-0 mt-0.5"
                        />
                      ) : (
                        <div className="size-6 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 overflow-hidden mt-0.5" style={{ background: primaryColor, color: onPrimary }}>
                          {avatarInner("size-3.5")}
                        </div>
                      )}
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
                {flowConfig && activeNodeId && !isBotResponding && (
                  (() => {
                    const activeNode = flowConfig.nodes.find((n) => n.id === activeNodeId);
                    if (!activeNode) return null;
                    const options = getChoiceOptions(activeNode, flowConfig.edges);
                    if (options.length === 0) return null;
                    return (
                      <motion.div
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex flex-wrap justify-end gap-1.5 pt-2 max-w-[92%] ml-auto"
                      >
                        {options.map((opt, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => handleFlowChoice(opt.label, opt.edge)}
                            className="px-3.5 py-1.5 rounded-full border text-xs font-medium transition-all shadow-sm hover:shadow active:scale-95 bg-white dark:bg-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-700 cursor-pointer"
                            style={{ borderColor: primaryColor, color: primaryColor }}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </motion.div>
                    );
                  })()
                )}
                <div ref={messagesEndRef} />
              </div>
            </motion.div>
          )}

          {/* ARTICLES */}
          {tab === "articles" && (
            <motion.div
              key="articles"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="p-4 space-y-3 flex-1 flex flex-col justify-start"
            >
              {activeArticle ? (
                /* ── In-Widget Article Reader ── */
                <div className="space-y-3 animate-in fade-in duration-150">
                  <button
                    type="button"
                    onClick={() => setActiveArticle(null)}
                    className="flex items-center gap-1.5 text-xs font-bold opacity-70 hover:opacity-100 transition-opacity cursor-pointer"
                  >
                    <ArrowLeft className="size-3.5" />
                    Back to articles
                  </button>

                  <div className="widget-card p-4 shadow-sm space-y-3">
                    {activeArticle.category && (
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800 opacity-80">
                        {activeArticle.category.name}
                      </span>
                    )}
                    <h2 className="text-base font-bold leading-snug">
                      {activeArticle.title}
                    </h2>
                    {activeArticle.subtitle && (
                      <p className="text-xs opacity-70 font-medium">
                        {activeArticle.subtitle}
                      </p>
                    )}

                    <div className="border-t border-black/5 dark:border-white/10 pt-3">
                      {loadingArticleDetail && !activeArticle.content ? (
                        <div className="flex items-center gap-2 py-8 justify-center opacity-60 text-xs">
                          <Loader2 className="size-4 animate-spin" /> Loading article content...
                        </div>
                      ) : (
                        <div className="text-xs leading-relaxed space-y-2 prose prose-xs dark:prose-invert max-w-none">
                          {activeArticle.content?.trim().startsWith("<") ? (
                            <div
                              className="article-html-body space-y-2"
                              dangerouslySetInnerHTML={{ __html: activeArticle.content }}
                            />
                          ) : (
                            <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]} components={mdComponents}>
                              {activeArticle.content || activeArticle.subtitle || "No additional content."}
                            </ReactMarkdown>
                          )}
                        </div>
                      )}
                    </div>

                    {/* CSAT Article Rating */}
                    <div className="border-t border-black/5 dark:border-white/10 pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <span className="text-[11px] font-medium opacity-70">
                        Was this article helpful?
                      </span>
                      {articleFeedbackGiven[activeArticle.id] ? (
                        <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                          <Check className="size-3" /> Thank you for your feedback!
                        </span>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => rateArticleFeedback(activeArticle.id, true)}
                            className="px-2.5 py-1 text-[11px] font-semibold rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center gap-1 cursor-pointer transition-colors"
                          >
                            <ThumbsUp className="size-3 text-emerald-500" /> Yes
                          </button>
                          <button
                            type="button"
                            onClick={() => rateArticleFeedback(activeArticle.id, false)}
                            className="px-2.5 py-1 text-[11px] font-semibold rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center gap-1 cursor-pointer transition-colors"
                          >
                            <ThumbsDown className="size-3 text-red-500" /> No
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Escalation to Chat Action */}
                    <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-100 dark:border-neutral-850 flex items-center justify-between gap-2">
                      <div className="text-[11px]">
                        <span className="font-semibold block">Still need help?</span>
                        <span className="opacity-60 text-[10px]">Chat directly with our support team</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => askAboutArticle(activeArticle)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold text-white shadow-xs cursor-pointer hover:opacity-90 transition-opacity shrink-0"
                        style={{ background: primaryColor }}
                      >
                        Chat with us
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                /* ── Help Categories & Collections ── */
                <div className="space-y-3">
                  {/* Search Bar */}
                  <div className="relative">
                    <Search className="size-4 opacity-50 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={articleFilterQuery}
                      onChange={(e) => setArticleFilterQuery(e.target.value)}
                      placeholder="Search for answers and guides..."
                      className="widget-search-bar w-full pl-10 pr-8 py-2.5 text-xs focus:outline-none shadow-xs"
                    />
                    {articleFilterQuery && (
                      <button
                        type="button"
                        onClick={() => setArticleFilterQuery("")}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 opacity-50 hover:opacity-100 cursor-pointer"
                      >
                        <X className="size-3" />
                      </button>
                    )}
                  </div>

                  {/* Collections List */}
                  <div className="space-y-1 divide-y divide-black/5 dark:divide-white/5">
                    {(() => {
                      const standardCollections = [
                        {
                          id: "general",
                          title: "Getting Started",
                          description: "Essential guides and walkthroughs to get up and running quickly.",
                        },
                        {
                          id: "support",
                          title: "Customer Support",
                          description: "How our team handles inquiries, escalations, and meeting bookings.",
                        },
                        {
                          id: "faqs",
                          title: "Frequently Asked Questions",
                          description: "Answers to common questions about features, pricing, and integrations.",
                        },
                      ];

                      const customCats = kbCategories.map((c) => ({
                        id: c.id,
                        title: c.name,
                        description: c.description || "Browse articles and guides in this collection.",
                      }));

                      const allCollections = customCats.length > 0 ? customCats : standardCollections;

                      const filteredCollections = articleFilterQuery.trim()
                        ? allCollections.filter((c) =>
                            c.title.toLowerCase().includes(articleFilterQuery.toLowerCase()) ||
                            c.description.toLowerCase().includes(articleFilterQuery.toLowerCase())
                          )
                        : allCollections;

                      return (
                        <>
                          {filteredCollections.map((col) => (
                            <button
                              key={col.id}
                              type="button"
                              onClick={() => {
                                const matchingArt = kbArticles.find((a) => a.category_id === col.id || a.title.toLowerCase().includes(col.title.toLowerCase()));
                                if (matchingArt) {
                                  openKbArticle(matchingArt);
                                } else {
                                  setTab("messages");
                                  setInputValue(`I have a question about ${col.title}: `);
                                }
                              }}
                              className="w-full py-3 px-2 hover:opacity-85 transition-opacity flex items-center justify-between text-left group cursor-pointer"
                            >
                              <div className="space-y-0.5 pr-3">
                                <h4 className="text-xs font-bold group-hover:opacity-80 transition-opacity">
                                  {col.title}
                                </h4>
                                <p className="text-[11px] opacity-70 leading-relaxed line-clamp-2">
                                  {col.description}
                                </p>
                              </div>
                              <ChevronRight className="size-4 opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all shrink-0" />
                            </button>
                          ))}

                          {/* Promoted / Search Article Results if any */}
                          {articleFilterQuery && kbArticles.length > 0 && (
                            <div className="pt-3 space-y-2">
                              <span className="text-[10px] font-bold opacity-60 uppercase tracking-wider">Matching Articles</span>
                              {kbArticles
                                .filter((a) => a.title.toLowerCase().includes(articleFilterQuery.toLowerCase()))
                                .map((art) => (
                                  <button
                                    key={art.id}
                                    type="button"
                                    onClick={() => openKbArticle(art)}
                                    className="w-full py-2 px-2 flex items-center justify-between text-left hover:opacity-80 cursor-pointer"
                                  >
                                    <span className="text-xs font-medium truncate">{art.title}</span>
                                    <ChevronRight className="size-3 opacity-50" />
                                  </button>
                                ))}
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
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
                // Height was `min(64vh, 440px)` - sized against the *browser
                // viewport*, not this panel. Fine for a real iframe/full-page
                // embed (roughly viewport-sized already), but the standalone
                // floating widget's panel is a fixed ~560px regardless of how
                // tall the host page's viewport is, so on any normal-height
                // page 440px left only ~30-40px above it for the header -
                // just enough to graze/tuck behind it (reported bug). Caps
                // tightened to fit that fixed panel with real margin to
                // spare; isFullscreen (mobile/iframe, panel ≈ viewport-sized)
                // keeps the old, roomier vh-based sizing since there the
                // original math was never wrong.
                className={`emoji-panel absolute bottom-[84px] left-2.5 right-2.5 z-10 flex flex-col rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80 shadow-[0_12px_40px_-8px_rgba(0,0,0,0.25)] overflow-hidden bg-card backdrop-blur-sm ${isFullscreen ? "h-[min(64vh,440px)] min-h-[280px]" : "h-[min(48vh,340px)] min-h-[220px]"}`}
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
            className="chat-input-bar rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 px-3 pt-2 pb-1 transition-all">
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
                      // pf.preview is a local blob: URL (URL.createObjectURL) - next/image can't optimize it
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
            <textarea
              ref={composerRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onFocus={() => { setEmojiOpen(false); setAttachOpen(false); }}
              onPaste={onPaste}
              onKeyDown={(e) => {
                // Enter sends (matching the old <input>'s default form-submit
                // behavior); Shift+Enter inserts a real newline instead, which
                // a plain <input> can never do - this is the whole reason for
                // switching to a <textarea>. requestSubmit() (not a manual
                // sendText() call here) so this stays wired to the exact same
                // submit handler as clicking the send button, pendingFiles
                // included.
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }
              }}
              placeholder={transcribing ? "Transcribing…" : "Compose your message…"} disabled={isBotResponding || transcribing}
              rows={1}
              className="w-full bg-transparent text-xs focus:outline-none disabled:opacity-60 mb-1 resize-none max-h-[108px] overflow-y-auto leading-relaxed" />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-0.5">
                <motion.button type="button" whileTap={{ scale: 0.85 }} onClick={() => { setEmojiOpen((o) => !o); setAttachOpen(false); }} className="chat-input-bar-icon p-1 text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 rounded-full" aria-label="Emoji"><Smile className="size-4" /></motion.button>
                <motion.button type="button" whileTap={{ scale: 0.85 }} onClick={() => { setAttachOpen((o) => !o); setEmojiOpen(false); }} className="chat-input-bar-icon p-1 text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 rounded-full" aria-label="Attach file"><Paperclip className="size-4" /></motion.button>
                <button type="button" onClick={toggleRecord} disabled={transcribing} className="chat-input-bar-icon p-1 rounded-full text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 disabled:opacity-50" aria-label="Record audio">
                  {transcribing ? <Loader2 className="size-4 animate-spin" /> : <Mic className="size-4" />}
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
        </div>
      )}

      {/* ── Persistent Bottom Navigation Bar ── */}
      {!voiceCallOpen && !showCsat && !showOfflineForm && (
        <>
          {((tab === "messages" && chatNavExpanded) || (tab !== "messages" && bottomNavVisible)) && (
            (() => {
              const presetSig = getPresetSignature(widgetStyle);
              const effectiveNavStyle =
                colorScheme?.bottomNav?.style && colorScheme?.bottomNav?.style !== "default"
                  ? colorScheme.bottomNav.style
                  : presetSig.bottomNavStyle;
              const indicatorType =
                colorScheme?.bottomNav?.indicator || presetSig.bottomNavIndicator || "pill";
              const activeNavColor =
                colorScheme?.bottomNav?.activeColor || presetSig.bottomNavActive || primaryColor;
              const showLabels = colorScheme?.bottomNav?.showLabels !== false;
              const allowMinimize = colorScheme?.bottomNav?.allowMinimize !== false;

              const containerClasses =
                effectiveNavStyle === "pill" || effectiveNavStyle === "glass"
                  ? "p-2.5 bg-transparent flex justify-center shrink-0 relative"
                  : effectiveNavStyle === "chunky"
                    ? "p-2.5 bg-transparent shrink-0 relative"
                    : "shrink-0 relative";

              const navClasses =
                effectiveNavStyle === "pill"
                  ? "chat-bottom-nav w-full max-w-[320px] rounded-full border border-neutral-200/80 dark:border-neutral-850/80 shadow-lg flex items-stretch overflow-hidden backdrop-blur-xl bg-card/90"
                  : effectiveNavStyle === "chunky"
                    ? "chat-bottom-nav w-full rounded-md border-3 border-black bg-white shadow-[4px_4px_0px_#000] flex items-stretch overflow-hidden font-mono"
                    : effectiveNavStyle === "glass"
                      ? "chat-bottom-nav w-full max-w-[320px] rounded-2xl border border-white/30 bg-white/20 dark:bg-black/30 backdrop-blur-xl shadow-lg flex items-stretch overflow-hidden"
                      : effectiveNavStyle === "luxury"
                        ? "chat-bottom-nav border-t border-[#b08a3e]/40 bg-[#161412] text-[#f7f5f0] flex items-stretch tracking-wider font-serif"
                        : effectiveNavStyle === "clean"
                          ? "chat-bottom-nav border-t border-neutral-200/80 dark:border-neutral-800/80 bg-background/95 backdrop-blur-sm flex items-stretch shadow-none"
                          : "chat-bottom-nav border-t border-neutral-100 dark:border-neutral-850 bg-card flex items-stretch";

              return (
                <div className={containerClasses}>
                  <div className={navClasses}>
                    {(
                      [
                        { id: "home", label: "Home", icon: <Home className="size-4" /> },
                        { id: "messages", label: "Chat", icon: <MessageSquare className="size-4" /> },
                        { id: "articles", label: "Articles", icon: <FileText className="size-4" /> },
                      ] as { id: Tab; label: string; icon: React.ReactNode }[]
                    ).map(({ id, label, icon }) => {
                      const isActive = tab === id;
                      return (
                        <motion.button
                          key={id}
                          type="button"
                          whileTap={{ scale: 0.90 }}
                          onClick={() => {
                            setActiveArticle(null);
                            setTab(id);
                          }}
                          className={`chat-bottom-nav-item flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-[9px] font-semibold tracking-wide uppercase transition-colors cursor-pointer relative ${
                            isActive ? "font-bold" : "opacity-60 hover:opacity-100"
                          }`}
                          style={isActive ? { color: activeNavColor } : undefined}
                        >
                          <motion.span
                            animate={{ scale: isActive ? 1.08 : 1 }}
                            transition={{ type: "spring", stiffness: 400, damping: 25 }}
                            className="relative z-10"
                          >
                            {icon}
                          </motion.span>
                          {showLabels && <span className="relative z-10">{label}</span>}
                          {isActive && (
                            indicatorType === "pill" ? (
                              <motion.span
                                layoutId="activeNavIndicator"
                                className="absolute inset-1 rounded-full -z-0 opacity-15"
                                style={{ backgroundColor: activeNavColor }}
                                transition={{ type: "spring", stiffness: 450, damping: 30 }}
                              />
                            ) : indicatorType === "dot" ? (
                              <motion.span
                                layoutId="activeNavIndicator"
                                className="absolute bottom-1 size-1.5 rounded-full z-10 shadow-sm"
                                style={{ backgroundColor: activeNavColor }}
                                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                              />
                            ) : (
                              <motion.span
                                layoutId="activeNavIndicator"
                                className="absolute top-0 left-3 right-3 h-[2.5px] rounded-full z-10"
                                style={{ backgroundColor: activeNavColor }}
                                transition={{ type: "spring", stiffness: 500, damping: 35 }}
                              />
                            )
                          )}
                        </motion.button>
                      );
                    })}
                    {allowMinimize && (
                      <button
                        type="button"
                        onClick={() => {
                          if (tab === "messages") setChatNavExpanded(false);
                          else setBottomNavVisible(false);
                        }}
                        className="px-2.5 flex items-center justify-center text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors cursor-pointer border-l border-neutral-100/50 dark:border-neutral-850/50"
                        title="Hide navigation"
                      >
                        <ChevronDown className="size-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })()
          )}

          {((tab === "messages" && !chatNavExpanded) || (tab !== "messages" && !bottomNavVisible)) && (
            <div className="flex justify-center py-1 bg-card border-t border-neutral-100/50 dark:border-neutral-850/50 shrink-0">
              <button
                type="button"
                onClick={() => {
                  if (tab === "messages") setChatNavExpanded(true);
                  else setBottomNavVisible(true);
                }}
                className="inline-flex items-center gap-1 text-[10px] text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 px-2 py-0.5 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                title="Show navigation"
              >
                <ChevronUp className="size-3" />
                <span className="font-medium text-[9px] uppercase tracking-wider">Show Tabs</span>
              </button>
            </div>
          )}
        </>
      )}

      {!isOfficialWebsite && !hideBranding && (
        <div className="text-center pt-1 pb-1 bg-card text-[10px] text-neutral-400 dark:text-neutral-500 font-mono tracking-wide border-t border-neutral-100/50 dark:border-neutral-900/50">
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
          {/* p-1.5 -m-1.5: same "pad the tap target, not the icon" fix as
              the teaser bubble's dismiss button - this one had zero padding
              at all, so its clickable area was exactly the bare 12px icon
              (size-3), easy to miss on a real click even aiming right at
              it. Negative margin keeps the toast's own visual padding/
              spacing unchanged. */}
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
