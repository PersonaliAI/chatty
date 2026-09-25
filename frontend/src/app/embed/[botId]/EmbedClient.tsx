"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback, Fragment } from "react";
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
import { InlineBookingCard, ConfirmedMeeting } from "@/components/inline-booking-card";
import { ProductCard, type ProductCardData } from "@/components/product-card";
import { VideoCard, type VideoClipData } from "@/components/video-card";
import { getOnColor, primaryColorCssVars, buildColorSchemeCss, type WidgetColorScheme } from "@/lib/color-contrast";
import { normalizeWidgetStyle, getPresetSignature } from "@/lib/widget-style";
import { AudioBubble, RECORD_BAR_COUNT, VOICE_MESSAGE_PLACEHOLDER, audioBlobToWav } from "./widget-media";
import { AVATAR_ICONS, SEND_BUTTON_STYLES } from "./widget-style-options";
import { detectCountryCode, detectTimezone } from "@/lib/locale-data";
import { shouldRenderInlineWelcome } from "@/lib/widget-history";
import {
  Send, Loader2, Sparkles, MessageSquare, MessageCircle, FileText, Search,
  Paperclip, Smile, AudioWaveform, Mic, ChevronRight, ChevronDown, ChevronUp, ArrowLeft, X,
  ArrowUp, ArrowRight, RefreshCw, Bot, Headphones, User, Check, AlertCircle,
  Link2, ThumbsUp, ThumbsDown, Mail, Bell, BellOff, Play, Pause, Trash2,
  BookOpen, Star, Home, HelpCircle, Megaphone, Compass, Clock, Calendar,
} from "lucide-react";
import { BACKEND_URL } from "@/lib/backend-client";
import { useSearchParams } from "next/navigation";

interface Citation { name: string; type: string; url?: string | null; }
export interface TeamProfile {
  name: string;
  avatar_url?: string | null;
  role?: string;
  online?: boolean;
  last_seen_at?: string | null;
}
interface Message {
  role: "user" | "assistant";
  content: string;
  /** Origin of the turn, used to keep voice and text history distinguishable. */
  channel?: "voice" | "text";
  fileUrl?: string;
  fileType?: string;
  sources?: Citation[];
  feedback?: "up" | "down";
  sender?: "ai" | "human";
  sender_name?: string;
  sender_avatar?: string;
  created_at?: string;
  confirmedMeeting?: ConfirmedMeeting;
}
interface Source { id: string; name: string; content: string; }

function parseProductCards(content: string): { cleanContent: string; products: ProductCardData[]; videoClips: VideoClipData[] } {
  const extract = <T extends object>(source: string, marker: string): { text: string; items: T[] } => {
    const items: T[] = [];
    let cursor = 0;
    let text = "";
    while (cursor < source.length) {
      const markerStart = source.indexOf(marker, cursor);
      if (markerStart < 0) {
        text += source.slice(cursor);
        break;
      }
      const jsonStart = markerStart + marker.length;
      if (source[jsonStart] !== "{") {
        text += source.slice(cursor, jsonStart);
        cursor = jsonStart;
        continue;
      }

      let depth = 0;
      let end = -1;
      let inString = false;
      let escaped = false;
      for (let i = jsonStart; i < source.length; i++) {
        const char = source[i];
        if (inString) {
          if (escaped) escaped = false;
          else if (char === "\\") escaped = true;
          else if (char === '"') inString = false;
          continue;
        }
        if (char === '"') { inString = true; continue; }
        if (char === "{") depth++;
        else if (char === "}" && --depth === 0) {
          end = i;
          break;
        }
      }

      if (end < 0 || source[end + 1] !== "]") {
        // Keep malformed markers visible instead of dropping user/model text.
        text += source.slice(cursor, jsonStart + 1);
        cursor = jsonStart + 1;
        continue;
      }
      let parsedOk = false;
      try {
        const parsed = JSON.parse(source.slice(jsonStart, end + 1));
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          items.push(parsed as T);
          parsedOk = true;
        }
      } catch {
      }
      text += source.slice(cursor, markerStart);
      if (!parsedOk) text += source.slice(markerStart, end + 2);
      cursor = end + 2;
    }
    return { text, items };
  };

  const productResult = extract<ProductCardData>(content, "[PRODUCT_CARD:");
  const videoResult = extract<VideoClipData>(productResult.text, "[VIDEO_CLIP:");
  const products = productResult.items;
  const videoClips = videoResult.items;
  let clean = videoResult.text;

  clean = clean.replace(/\[BOOKING_WIDGET\]/g, "").trim();

  return { cleanContent: clean, products, videoClips };
}

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

export interface VisitorConversationItem {
  sessionId: string;
  lastSnippet: string;
  lastSender: "user" | "assistant";
  /** Channel of the most recent turn, shown in the history list. */
  lastChannel?: "voice" | "text";
  updatedAt: string;
  messageCount: number;
  agentName?: string;
  agentAvatar?: string;
  topic?: string;
}

function formatTimeAgo(dateStr?: string | number | null): string {
  if (!dateStr) return "—";
  try {
    const d = typeof dateStr === "number" ? new Date(dateStr) : new Date(dateStr);
    const time = d.getTime();
    if (!Number.isFinite(time)) return "—";
    const diffSec = Math.max(0, Math.floor((Date.now() - time) / 1000));
    if (diffSec < 10) return "Just now";
    if (diffSec < 60) return `${diffSec}s ago`;
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return "—";
  }
}

function formatTimeCompact(dateStr?: string | number): string {
  // Missing/invalid timestamps are unknown, not current. This prevents old
  // local sessions from being shown as "Just now" forever.
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
  textColor?: string;
  size?: string;
}) {
  const items: { src?: string | null; name: string; online?: boolean }[] = [];

  if (profiles && profiles.length > 0) {
    for (const p of profiles) {
      if (p.avatar_url || (p.name && p.name.trim())) {
        items.push({ src: p.avatar_url, name: p.name, online: !!p.online });
      }
      if (items.length >= 3) break;
    }
  }

  if (items.length === 0) {
    items.push({ src: botAvatarUrl, name: botName, online: true });
  } else if (items.length === 1 && botAvatarUrl && items[0].src !== botAvatarUrl) {
    items.unshift({ src: botAvatarUrl, name: botName, online: true });
  }

  return (
    <div className="flex items-center -space-x-2 shrink-0">
      {items.map((item, idx) => (
        <div key={idx} title={`${item.name}${item.online ? " · Online" : ""}`} className="relative inline-flex">
          <AgentAvatar
            src={item.src}
            name={item.name}
            size={size}
            primaryColor={primaryColor}
            onPrimary={onPrimary}
            bgColor={item.src === botAvatarUrl ? bgColor : undefined}
            textColor={item.src === botAvatarUrl ? textColor : undefined}
            className="ring-2 ring-white dark:ring-neutral-900 rounded-full"
          />
        </div>
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

interface EmbedClientProps {
  botId: string;
  originToken: string | null;
}

export default function EmbedClient({ botId, originToken }: EmbedClientProps) {
  const widgetTokenHeader: Record<string, string> = originToken ? { "X-Widget-Token": originToken } : {};
  const searchParams = useSearchParams();
  const visitorTimezone = useMemo(() => detectTimezone(), []);
  const visitorCountry = useMemo(() => detectCountryCode(), []);
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
  const paramTab = searchParams.get("tab") as Tab | null;

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
    if (logoUrl) return <img src={logoUrl} alt="" className="size-full object-contain p-1 rounded-full" />; // eslint-disable-line @next/next/no-img-element
    return botName[0]?.toUpperCase();
  };

  const headerLogoInner = (iconCls: string) => {
    if (logoUrl) return <img src={logoUrl} alt="" className="size-full object-contain p-1 rounded-full" />; // eslint-disable-line @next/next/no-img-element
    return avatarInner(iconCls);
  };

  const renderBotAvatar = (sizeClass = "size-9", iconClass = "size-5", className = "") => {
    // Keep recent-message avatars identical to the canonical header logo.
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
  // null = keep the active design preset's own default font.
  const [fontFamily, setFontFamily] = useState<string | null>(null);
  const [fontSizePercent, setFontSizePercent] = useState(100);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoBgColor, setLogoBgColor] = useState("");
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  // What a finished in-chat voice recording turns into - set on
  // chatty_bots.voice_message_mode (Customizer > Voice Messages).
  const [voiceMessageMode, setVoiceMessageMode] = useState<"transcribe" | "audio">("transcribe");
  const [voiceCallOpen, setVoiceCallOpen] = useState(false);
  const [calendarSchedulingEnabled, setCalendarSchedulingEnabled] = useState(false);

  const [tab, setTab] = useState<Tab>(paramTab === "messages" || paramTab === "articles" ? paramTab : "home");

  useEffect(() => {
    const qTab = searchParams.get("tab") as Tab | null;
    if (qTab === "messages" || qTab === "articles" || qTab === "home") {
      setTab(qTab);
    }
  }, [searchParams]);

  const [bottomNavVisible, setBottomNavVisible] = useState(true);
  const [chatNavExpanded, setChatNavExpanded] = useState(false);
  const [conversationsList, setConversationsList] = useState<VisitorConversationItem[]>([]);
  const [chatView, setChatView] = useState<"chat" | "list">("chat");
  const [messages, setMessages] = useState<Message[]>([]);

  // Avoid rendering the temporary greeting on top of the same greeting that
  // was restored from this visitor's persisted conversation.
  const showInlineWelcome = useMemo(
    () => shouldRenderInlineWelcome(messages, welcomeMsg),
    [messages, welcomeMsg],
  );

  // Relative message labels must be a live view of the clock.  Without a
  // periodic render, a message that was rendered as "Just now" stayed that
  // way forever when the visitor left the widget open and idle.
  const [, setTimeTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTimeTick((tick) => tick + 1), 15_000);
    return () => window.clearInterval(id);
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
  const emojiPanelRef = useRef<HTMLDivElement>(null);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);
  const attachPanelRef = useRef<HTMLDivElement>(null);
  const attachButtonRef = useRef<HTMLButtonElement>(null);

  // Closes the emoji/attach popovers on any tap outside them. The trigger
  // buttons are excluded from the "outside" check (rather than just letting
  // this close them too) because mousedown fires before the button's own
  // onClick - closing here first would flip emojiOpen/attachOpen to false,
  // then the button's setEmojiOpen(o => !o) would read that just-updated
  // false and immediately reopen it instead of toggling closed.
  useEffect(() => {
    if (!emojiOpen && !attachOpen) return;
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (
        emojiPanelRef.current?.contains(target) ||
        emojiButtonRef.current?.contains(target) ||
        attachPanelRef.current?.contains(target) ||
        attachButtonRef.current?.contains(target)
      ) {
        return;
      }
      setEmojiOpen(false);
      setAttachOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, [emojiOpen, attachOpen]);

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

  const sources: Source[] = useMemo(() => {
    return kbArticles.map((a) => ({ id: a.id, name: a.title, content: a.content || a.subtitle || "" }));
  }, [kbArticles]);
  const openArticle: Source | null = activeArticle
    ? { id: activeArticle.id, name: activeArticle.title, content: activeArticle.content || activeArticle.subtitle || "" }
    : null;
  const setOpenArticle = (s: Source | null) => {
    if (!s) setActiveArticle(null);
    else {
      const match = kbArticles.find((a) => a.id === s.id);
      if (match) openKbArticle(match);
      else setActiveArticle({ id: s.id, title: s.name, slug: s.id, content: s.content });
    }
  };

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
  const [csatHoverRating, setCsatHoverRating] = useState(0);
  const [csatComment, setCsatComment] = useState("");
  const [csatSubmitted, setCsatSubmitted] = useState(false);
  const [csatSubmitting, setCsatSubmitting] = useState(false);
  const csatCooldownKey = `chatty_csat_prompt_${botId}_${hostKey}`;
  const csatCooldownMs = 2 * 24 * 60 * 60 * 1000;
  const canShowCsat = () => {
    try {
      const shownAt = Number(localStorage.getItem(csatCooldownKey) || 0);
      return !shownAt || Date.now() - shownAt >= csatCooldownMs;
    } catch { return true; }
  };
  const rememberCsatPrompt = () => {
    try { localStorage.setItem(csatCooldownKey, String(Date.now())); } catch {}
  };

  const [showOfflineForm, setShowOfflineForm] = useState(false);
  const [offlineName, setOfflineName] = useState("");
  const [offlineEmail, setOfflineEmail] = useState("");
  const [offlineMessage, setOfflineMessage] = useState("");
  const [offlineSubmitted, setOfflineSubmitted] = useState(false);

  const [agentTyping, setAgentTyping] = useState(false);
  // Told by widget.js (postMessage) whenever it switches the panel between
  // the fixed-size desktop popup and mobile-fullscreen - see the message
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
  // Browsers don't let a site programmatically revoke Notification
  // permission - only the user can do that via browser/site settings. So
  // "turning off" notifications from the bell, once granted, is our own
  // in-widget mute flag rather than an actual permission change; it just
  // gates triggerPush below. Persisted per bot+host so it survives reloads,
  // same pattern as the session id / message cache above.
  const [pushMuted, setPushMuted] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(`chatty_push_muted_${botId}_${hostKey}`) === "1";
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
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

  const toggleMute = () => {
    setPushMuted((prev) => {
      const next = !prev;
      try { localStorage.setItem(`chatty_push_muted_${botId}_${hostKey}`, next ? "1" : "0"); } catch {}
      return next;
    });
  };

  const triggerPushRef = useRef<(bodyText: string) => void>(() => {});
  const triggerPush = (bodyText: string) => {
    if (typeof window === "undefined" || pushMuted) return;
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
    if (csatRating === 0 || csatSubmitting) return;
    try {
      setCsatSubmitting(true);
      const res = await fetch(`${BACKEND_URL}/api/widget/csat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...widgetTokenHeader },
        body: JSON.stringify({
          bot_id: botId,
          session_id: sessionId,
          rating: csatRating,
          comment: csatComment.trim() || null,
        }),
      });
      if (!res.ok) throw new Error("csat submit failed");
      setCsatSubmitted(true);
      rememberCsatPrompt();
      showToast(`Thanks - ${csatRating} star rating submitted.`, "success");
      setTimeout(() => { setShowCsat(false); try { window.parent?.postMessage({ type: "chatty:close" }, "*"); } catch {} }, 1200);
    } catch {
      showToast("Failed to submit feedback.", "error");
    } finally {
      setCsatSubmitting(false);
    }
  };

  const submitOfflineMessage = async () => {
    if (!offlineName.trim() || !offlineEmail.trim() || !offlineMessage.trim()) return;
    const name = offlineName.trim();
    const email = offlineEmail.trim().toLowerCase();
    const message = offlineMessage.trim();
    try {
      const res = await fetch(`${BACKEND_URL}/api/widget/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...widgetTokenHeader },
        body: JSON.stringify({
          bot_id: botId,
          session_id: sessionId,
          text: `[Offline Support Ticket]\nName: ${name}\nEmail: ${email}\nMessage: ${message}`,
          visitor_name: name,
          visitor_email: email,
          visitor_timezone: visitorTimezone,
          visitor_country: visitorCountry,
          offline_ticket: true,
          host: getHost(),
        }),
      });
      if (res.ok) {
        setOfflineSubmitted(true);
        showToast("Ticket submitted successfully!", "success");
        setOfflineName("");
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
      // 1. Load multi-conversation registry
      const rawConvs = localStorage.getItem(`chatty_convs_${botId}_${hostKey}`);
      if (rawConvs) {
        const parsed: VisitorConversationItem[] = JSON.parse(rawConvs);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setConversationsList(parsed);
        }
      }

      // 2. Load active messages
      const raw = localStorage.getItem(`chatty_msgs_${botId}_${hostKey}_${sessionId}`) || localStorage.getItem(`chatty_msgs_${botId}_${hostKey}`);
      if (raw) {
        const saved = JSON.parse(raw);
        if (Array.isArray(saved) && saved.length) {
          setMessages(saved);
          // If no registry yet, bootstrap with this conversation
          if (!rawConvs) {
            const lastM = saved[saved.length - 1];
            const snippet = (lastM?.content || "").replace(/\[BOOKING_WIDGET\]/g, "").slice(0, 100);
            const initialItem: VisitorConversationItem = {
              sessionId,
              lastSnippet: snippet || "Welcome conversation",
              lastSender: lastM?.role || "assistant",
              lastChannel: lastM?.channel === "voice" ? "voice" : "text",
              updatedAt: new Date().toISOString(),
              messageCount: saved.length,
            };
            setConversationsList([initialItem]);
            localStorage.setItem(`chatty_convs_${botId}_${hostKey}`, JSON.stringify([initialItem]));
          }
        }
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [botId, sessionId]);

  // Conversation switcher
  const switchConversation = (targetSessionId: string) => {
    setSessionId(targetSessionId);
    try {
      localStorage.setItem(`chatty_sid_${botId}_${hostKey}`, targetSessionId);
    } catch {}
    let targetMsgs: Message[] = [];
    try {
      const raw =
        localStorage.getItem(`chatty_msgs_${botId}_${hostKey}_${targetSessionId}`) ||
        (targetSessionId === sessionId ? localStorage.getItem(`chatty_msgs_${botId}_${hostKey}`) : null);
      if (raw) {
        targetMsgs = JSON.parse(raw);
      }
    } catch {}
    setMessages(targetMsgs.length > 0 ? targetMsgs : [{ role: "assistant", content: welcomeMsg, sender: "ai", created_at: new Date().toISOString() }]);
    setChatView("chat");
    setTab("messages");
  };

  // Start a fresh conversation (Crisp/WhatChimp style "+ New conversation")
  const startNewConversation = () => {
    const freshId = `v-${crypto.randomUUID()}`;
    setSessionId(freshId);
    try {
      localStorage.setItem(`chatty_sid_${botId}_${hostKey}`, freshId);
    } catch {}
    const initialMsgs: Message[] = [{ role: "assistant", content: welcomeMsg, sender: "ai", created_at: new Date().toISOString() }];
    setMessages(initialMsgs);
    try {
      localStorage.setItem(`chatty_msgs_${botId}_${hostKey}_${freshId}`, JSON.stringify(initialMsgs));
      localStorage.setItem(`chatty_msgs_${botId}_${hostKey}`, JSON.stringify(initialMsgs));
    } catch {}
    const newItem: VisitorConversationItem = {
      sessionId: freshId,
      lastSnippet: welcomeMsg.slice(0, 100),
      lastSender: "assistant",
      updatedAt: new Date().toISOString(),
      messageCount: 1,
    };
    setConversationsList((prev) => {
      const next = [newItem, ...prev.filter((c) => c.sessionId !== freshId)];
      try {
        localStorage.setItem(`chatty_convs_${botId}_${hostKey}`, JSON.stringify(next));
      } catch {}
      return next;
    });
    setChatView("chat");
    setTab("messages");
  };

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

  // Reset html and body backgrounds to transparent to prevent white corners in rounded iframe borders
  useEffect(() => {
    if (typeof window !== "undefined") {
      document.documentElement.style.setProperty("background-color", "transparent", "important");
      document.body.style.setProperty("background-color", "transparent", "important");
    }
  }, []);

  // Persist messages (cap to last 100) and update conversations list registry
  useEffect(() => {
    if (typeof window === "undefined" || !botId || messages.length === 0) return;
    try {
      localStorage.setItem(`chatty_msgs_${botId}_${hostKey}_${sessionId}`, JSON.stringify(messages.slice(-100)));
      localStorage.setItem(`chatty_msgs_${botId}_${hostKey}`, JSON.stringify(messages.slice(-100)));

      const lastM = messages[messages.length - 1];
      if (lastM) {
        const rawContent = lastM.content || "";
        const cleanContent = rawContent
          .replace(/\[BOOKING_WIDGET\]/g, "")
          .replace(/\[attachment:.*?\]/g, "")
          .trim();
        const snippet = cleanContent || (lastM.fileUrl ? "Attachment" : "Conversation started");
        setConversationsList((prev) => {
          const existingIdx = prev.findIndex((c) => c.sessionId === sessionId);
          const updated: VisitorConversationItem = {
            sessionId,
            lastSnippet: snippet.slice(0, 100),
            lastSender: lastM.role,
            lastChannel: lastM.channel === "voice" ? "voice" : "text",
            updatedAt: new Date().toISOString(),
            messageCount: messages.length,
            agentName: lastM.sender === "human" ? (lastM.sender_name || activeAgentName || undefined) : (existingIdx >= 0 ? prev[existingIdx]?.agentName : undefined),
            agentAvatar: lastM.sender === "human" ? (lastM.sender_avatar || activeAgentAvatar || undefined) : (existingIdx >= 0 ? prev[existingIdx]?.agentAvatar : undefined),
            topic: messages.find((m) => m.role === "user")?.content?.slice(0, 40) || (existingIdx >= 0 ? prev[existingIdx]?.topic : undefined),
          };
          let nextList: VisitorConversationItem[];
          if (existingIdx >= 0) {
            nextList = [updated, ...prev.filter((_, idx) => idx !== existingIdx)];
          } else {
            nextList = [updated, ...prev];
          }
          try {
            localStorage.setItem(`chatty_convs_${botId}_${hostKey}`, JSON.stringify(nextList));
          } catch {}
          return nextList;
        });
      }
    } catch {}
  }, [messages, botId, hostKey, sessionId]);

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
      sender?: string;
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
            channel: "text",
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
            sender?: string;
            sender_name?: string;
            sender_avatar?: string;
            created_at?: string;
          }) => ({
            role: "assistant" as const,
            content: m.content,
            sender: "human" as const,
            channel: "text" as const,
            sender_name: m.sender_name,
            sender_avatar: m.sender_avatar,
            created_at: m.created_at || new Date().toISOString(),
          }));
          const latestM = newMsgs[newMsgs.length - 1];
          if (latestM?.sender_name) setActiveAgentName(latestM.sender_name);
          if (latestM?.sender_avatar) setActiveAgentAvatar(latestM.sender_avatar);
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
  }, [botId, sessionId]);

  // One-shot manual refetch of any new messages since the last poll - used
  // right after a voice call ends so the transcript (written server-side by
  // the voice worker) shows up promptly instead of waiting for the next
  // SSE/poll cycle. The voice worker writes both sides of a turn, whereas
  // the normal poll intentionally returns human-agent replies only.
  const refetchNow = async () => {
    try {
      const url = `${BACKEND_URL}/api/widget/poll?bot_id=${botId}&session_id=${encodeURIComponent(sessionId)}&after=${encodeURIComponent(lastPollRef.current)}&include_voice=true`;
      const res = await fetch(url);
      if (!res.ok) return;
      const d = await res.json();
      setLiveAgent(!!d.ai_paused);
      if (Array.isArray(d.messages) && d.messages.length) {
        lastPollRef.current = d.messages[d.messages.length - 1].created_at;
        const newMsgs: Message[] = d.messages.map((m: { content: string; role?: string; created_at?: string }) => ({
          role: m.role === "user" ? "user" as const : "assistant" as const,
          content: m.content,
          sender: m.role === "user" ? undefined : "ai" as const,
          channel: "voice" as const,
          created_at: m.created_at || new Date().toISOString(),
        }));
        setMessages((p) => {
          const seen = new Set(p.map((m) => `${m.role}|${m.created_at || ""}|${m.content}`));
          return [...p, ...newMsgs.filter((m) => {
            const key = `${m.role}|${m.created_at || ""}|${m.content}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          })];
        });
        notifyParent();
      }
    } catch {}
    fetchActiveMeeting();
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
          setCustomCss(bot.custom_css || "");
          setCustomJs(bot.custom_js || "");
          setTeamProfiles(Array.isArray(bot.team_profiles) ? bot.team_profiles : []);
          setMessages((prev) => prev.length ? prev : [{
            role: "assistant",
            content: wMsg,
            sender: "ai",
            sender_name: isPreview ? (paramName || bot.name || "Chatty") : (bot.name || "Chatty"),
            sender_avatar: isPreview ? (paramAvatarUrl || bot.avatar_url || bot.logo_url) : (bot.avatar_url || bot.logo_url),
            created_at: new Date().toISOString(),
          }]);
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
  // this embed iframe only - same trust model as the owner's own custom CSS.
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
    // Deliberately scoped to customJs only - flowConfig/messages state derived
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

  useEffect(() => {
    chatBodyRef.current?.scrollTo({ top: chatBodyRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isBotResponding, tab]);

  // Load the owner's chosen Google Font at runtime - this route has no
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
    // While `loading` is true, the component's early return above renders a
    // spinner instead of the real #chatty-root div - rootRef.current is null
    // on that first commit, so with an empty deps array this effect would
    // bail out via the guard below and never run again, permanently leaving
    // containerSize null (and therefore the font-size zoom below permanently
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
    setMessages((p) => [...p, { role: "user", content: text, channel: "text", created_at: new Date().toISOString() }]);
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
            { role: "assistant", content: `${promptText} [BOOKING_WIDGET]`, sender: "ai", created_at: new Date().toISOString() }
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
    let created = false;
    const writeAssistant = (content: string) => {
      if (!created) {
        created = true;
        setIsBotResponding(false);
        setMessages((p) => [...p, { role: "assistant" as const, content, sender: "ai", channel: "text", created_at: new Date().toISOString() }]);
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
          visitor_timezone: visitorTimezone,
          visitor_country: visitorCountry,
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
    setMessages((p) => [...p, { role: "user", content: caption || (isAudio ? VOICE_MESSAGE_PLACEHOLDER : `📎 ${filename}`), channel: "text", fileUrl: localUrl, fileType: file.type, created_at: new Date().toISOString() }]);
    setIsBotResponding(true);
    try {
      const fd = new FormData();
      fd.append("bot_id", String(botId));
      fd.append("session_id", sessionId);
      fd.append("text", caption);
      fd.append("visitor_timezone", visitorTimezone);
      fd.append("visitor_country", visitorCountry);
      fd.append("host", getHost());
      fd.append("file", file, filename);
      const res = await fetch(`${BACKEND_URL}/api/widget/chat/media`, { method: "POST", headers: widgetTokenHeader, body: fd });
      const body = await res.json();
      if (res.ok) {
        if (body.transcript) {
          setMessages((p) => {
            const copy = [...p];
            for (let i = copy.length - 1; i >= 0; i--) {
              if (copy[i].role === "user" && (copy[i].content === VOICE_MESSAGE_PLACEHOLDER || !copy[i].content)) {
                copy[i] = { ...copy[i], content: `🎤 ${body.transcript}` };
                break;
              }
            }
            return copy;
          });
        }
        setMessages((p) => [...p, { role: "assistant", content: body.reply, sender: "ai", channel: "text", created_at: new Date().toISOString() }]);
      } else {
        setMessages((p) => [...p, { role: "assistant", content: `⚠️ ${body.detail || "Couldn't process that file."}` }]);
      }
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
        body: JSON.stringify({ bot_id: botId, session_id: `${sessionId}-search`, text: q, visitor_timezone: visitorTimezone, visitor_country: visitorCountry, host: getHost() }),
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
  // Same reasoning as colorSchemeCss above - only an equally-specific
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
        }
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
          itself - see ChatWidgetCore.tsx's identical wrapper for the full
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
      <div className="chat-header px-4 pt-3 pb-2 border-b border-neutral-100 dark:border-neutral-850">
        <div className="flex items-center gap-2.5">
          {tab !== "home" && (
            <motion.button
              type="button"
              whileTap={{ scale: 0.85 }}
              onClick={() => {
                // The header back affordance should return to the visitor's
                // conversation, not discard it. This is especially important
                // after leaving the voice surface: the persisted voice turns
                // are visible in the same thread with their Voice/Text labels.
                if (voiceCallOpen) {
                  setVoiceCallOpen(false);
                  setChatView("chat");
                  setTab("messages");
                  void refetchNow().finally(() => {
                    requestAnimationFrame(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }));
                  });
                } else if (activeArticle) {
                  setActiveArticle(null);
                } else if (tab === "messages" && chatView === "chat") {
                  // A thread's back button is a history affordance.  Returning
                  // to Home loses the visitor's conversation context and made
                  // the arrow appear to do nothing when the list was hidden.
                  setChatView("list");
                } else if (tab === "messages" && chatView === "list") {
                  setTab("home");
                } else if (tab !== "messages") {
                  setChatView("chat");
                  setTab("messages");
                }
              }}
              className="p-1 -ml-1 rounded-full hover:opacity-100 transition-colors shrink-0 cursor-pointer"
              style={{ opacity: 0.9 }}
              aria-label="Back to chat history"
              title="Back to chat history"
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
          <div className="ml-auto flex items-center gap-1.5 shrink-0">
            {tab === "home" && (
              <AvatarGroup
                profiles={teamProfiles}
                botAvatarUrl={avatarUrl || logoUrl}
                botName={botName}
                primaryColor={primaryColor}
                onPrimary={onPrimary}
                bgColor={logoBgColor}
                size="size-7"
              />
            )}
          {voiceEnabled && (
            <motion.button
              type="button"
              whileTap={{ scale: 0.85 }}
              transition={{ duration: 0.32, ease: [0.34, 1.56, 0.64, 1] }}
              onClick={() => setVoiceCallOpen(true)}
              className="p-1.5 rounded-full hover:opacity-100 transition-colors shrink-0 cursor-pointer"
              style={{ opacity: 0.8, backgroundColor: "color-mix(in srgb, currentColor 0%, transparent)" }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "color-mix(in srgb, currentColor 15%, transparent)")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "color-mix(in srgb, currentColor 0%, transparent)")}
              aria-label="Start voice call"
              title="Talk to the assistant"
            >
              <AudioWaveform className="size-4" />
            </motion.button>
          )}
          <button
            onClick={pushGranted ? toggleMute : requestPushPermission}
            className={`${voiceEnabled || (tab === "home" && teamProfiles.length > 0) ? "" : "ml-auto "}p-1.5 rounded-full hover:opacity-100 transition-colors shrink-0 cursor-pointer`}
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
      </div>

      {/* Body */}
      <div ref={chatBodyRef} className="flex-1 overflow-y-auto scrollbar-thin widget-panel flex flex-col">
        {voiceCallOpen ? (
          <VoiceCallWidget
            botId={botId}
            sessionId={sessionId}
            backendUrl={BACKEND_URL}
            originToken={originToken}
            visitorTimezone={visitorTimezone}
            primaryColor={primaryColor}
            onClose={() => {
              // Keep the existing thread mounted when leaving voice mode. The
              // voice turn is persisted by the worker and merged below, so the
              // visitor returns to the same history instead of a blank view.
              setVoiceCallOpen(false);
              setChatView("chat");
              setTab("messages");
              void refetchNow().finally(() => {
                requestAnimationFrame(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }));
              });
            }}
            onBookingSuccess={(meeting) => {
              setMessages((prev) => {
                const updated = [...prev];
                for (let idx = updated.length - 1; idx >= 0; idx--) {
                  if (updated[idx].role === "assistant") {
                    updated[idx] = { ...updated[idx], confirmedMeeting: meeting };
                    return updated;
                  }
                }
                return updated;
              });
            }}
          />
        ) : showCsat ? (
          /* CSAT Feedback Modal */
          <div className="relative flex h-full flex-col justify-center overflow-hidden bg-linear-to-b from-white to-neutral-50/80 p-5 dark:from-neutral-950 dark:to-neutral-900">
            <div className="pointer-events-none absolute inset-x-8 top-8 h-24 rounded-full blur-3xl opacity-20" style={{ backgroundColor: primaryColor }} />
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 24 }}
              className="relative rounded-2xl border border-neutral-200/80 bg-white/90 p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/90"
            >
              <div className="text-center space-y-2">
                <div className="mx-auto flex size-10 items-center justify-center rounded-full border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-950">
                  <Star className="size-5" style={{ color: primaryColor }} />
                </div>
                <h3 className="text-[15px] font-bold text-neutral-900 dark:text-neutral-100">How was your conversation?</h3>
                <p className="mx-auto max-w-[26ch] text-[11px] leading-relaxed text-neutral-500 dark:text-neutral-400">
                  Your rating helps the team improve replies, handoff quality, and bot training.
                </p>
              </div>

              <div className="mt-4 flex justify-center gap-1" onMouseLeave={() => setCsatHoverRating(0)} role="radiogroup" aria-label="Conversation rating">
                {["😞", "😕", "😐", "🙂", "🤩"].map((face, index) => {
                  const star = index + 1;
                  const active = star === (csatHoverRating || csatRating);
                  return (
                    <motion.button
                      key={face}
                      type="button"
                      whileHover={{ y: -2, scale: 1.08 }}
                      whileTap={{ scale: 0.9 }}
                      onMouseEnter={() => setCsatHoverRating(star)}
                      onFocus={() => setCsatHoverRating(star)}
                      onBlur={() => setCsatHoverRating(0)}
                      onClick={() => setCsatRating(star)}
                      aria-label={`Rate ${star} out of 5`}
                      role="radio"
                      aria-checked={active}
                      className="group flex size-10 items-center justify-center rounded-2xl transition-colors cursor-pointer text-xl"
                      style={{ backgroundColor: active ? "color-mix(in srgb, #f59e0b 16%, transparent)" : "color-mix(in srgb, currentColor 5%, transparent)", opacity: active || csatRating === 0 ? 1 : 0.45, border: active ? "1px solid #f59e0b" : "1px solid transparent" }}
                    >
                      <span aria-hidden="true">{face}</span>
                    </motion.button>
                  );
                })}
              </div>

              <div className="mt-2 min-h-5 text-center text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">
                {csatRating > 0 ? `${csatRating}/5 selected` : "Select a rating to continue"}
              </div>

              <textarea
                rows={3}
                value={csatComment}
                onChange={(e) => setCsatComment(e.target.value)}
                placeholder="What went well or could be better? Optional."
                className="mt-3 w-full resize-none rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-xs text-neutral-800 outline-none transition-all placeholder:text-neutral-400 focus:border-transparent focus:ring-2 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100"
                style={{ ["--tw-ring-color" as string]: primaryColor }}
              />

              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => { setShowCsat(false); try { window.parent?.postMessage({ type: "chatty:close" }, "*"); } catch {} }}
                  disabled={csatSubmitting}
                  className="px-3 py-2 border border-neutral-200 dark:border-neutral-800 rounded-xl text-xs font-semibold hover:bg-neutral-50 dark:hover:bg-neutral-850 cursor-pointer text-neutral-600 dark:text-neutral-350 disabled:opacity-50"
                >
                  Skip
                </button>
                <button
                  type="button"
                  onClick={submitCsat}
                  disabled={csatRating === 0 || csatSubmitted || csatSubmitting}
                  className="min-w-[126px] px-3 py-2 text-xs font-semibold rounded-xl cursor-pointer disabled:opacity-45 inline-flex items-center justify-center gap-1.5 shadow-sm active:scale-98"
                  style={{ background: primaryColor, color: onPrimary }}
                >
                  {csatSubmitting ? <Loader2 className="size-3.5 animate-spin" /> : csatSubmitted ? <Check className="size-3.5" /> : null}
                  <span>{csatSubmitted ? "Submitted" : csatSubmitting ? "Submitting..." : "Submit feedback"}</span>
                </button>
              </div>
            </motion.div>
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
              <p className="text-[11px] text-neutral-500 leading-relaxed dark:text-neutral-400">No support agents are currently available to chat. Leave your name, contact email, and description below, and we&apos;ll get back to you soon.</p>
              
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">Your Name</label>
                  <input
                    type="text"
                    value={offlineName}
                    onChange={(e) => setOfflineName(e.target.value)}
                    placeholder="Jane Smith"
                    autoComplete="name"
                    className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">Your Email</label>
                  <input
                    type="email"
                    value={offlineEmail}
                    onChange={(e) => setOfflineEmail(e.target.value)}
                    placeholder="name@company.com"
                    autoComplete="email"
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
                disabled={!offlineName.trim() || !offlineEmail.trim() || !offlineMessage.trim() || offlineSubmitted}
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
                    setChatView("chat");
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
                {conversationsList.length > 0 && conversationsList[0].lastSnippet && (
                  <div className="space-y-1 pt-0.5">
                    <span className="text-[11px] font-semibold opacity-75 px-1">
                      Recent message
                    </span>
                    <motion.button
                      type="button"
                      whileHover={{ scale: 1.01, y: -1 }}
                      whileTap={{ scale: 0.985 }}
                      transition={{ type: "spring", stiffness: 450, damping: 25 }}
                      onClick={() => {
                        switchConversation(conversationsList[0].sessionId);
                        setTab("messages");
                        setChatView("chat");
                      }}
                      className="widget-card w-full flex items-center justify-between p-3.5 text-left group cursor-pointer shadow-xs"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
                        {conversationsList[0].agentAvatar || activeAgentAvatar ? (
                          <AgentAvatar
                            src={conversationsList[0].agentAvatar || activeAgentAvatar}
                            name={conversationsList[0].agentName || activeAgentName || botName}
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
                              {conversationsList[0].topic || conversationsList[0].agentName || activeAgentName || "Demo Scheduling"}
                            </span>
                            <span className="text-[11px] opacity-60 font-medium shrink-0">
                              {formatTimeCompact(conversationsList[0].updatedAt)}
                            </span>
                          </div>
                          <p className="text-[11px] opacity-70 truncate mt-0.5">
                            {conversationsList[0].lastSnippet}
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
              {chatView === "list" ? (
                /* ── CRISP / WHATCHIMP STYLE CONVERSATIONS LIST ── */
                <div className="p-4 space-y-4 text-xs">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                      Your conversations
                    </span>
                    <span className="text-[11px] text-neutral-400 font-medium">
                      {conversationsList.length} total
                    </span>
                  </div>

                  {/* Conversation Cards List */}
                  <div className="space-y-2">
                    {conversationsList.length === 0 ? (
                      <div className="text-center py-8 space-y-3">
                        <MessageSquare className="size-8 text-neutral-300 dark:text-neutral-700 mx-auto" />
                        <p className="text-xs text-neutral-400">No conversations started yet.</p>
                      </div>
                    ) : (
                      conversationsList.map((conv) => {
                        const isActive = conv.sessionId === sessionId;
                        return (
                          <button
                            key={conv.sessionId}
                            type="button"
                            onClick={() => {
                              switchConversation(conv.sessionId);
                              setChatView("chat");
                            }}
                            className={`w-full flex items-center justify-between p-3.5 rounded-2xl border transition-all text-left group cursor-pointer shadow-2xs ${
                              isActive
                                ? "border-[#f97316] bg-[#f97316]/5 dark:bg-[#f97316]/10"
                                : "border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-neutral-300 dark:hover:border-neutral-700"
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
                              {conv.agentAvatar ? (
                                <AgentAvatar
                                  src={conv.agentAvatar}
                                  name={conv.agentName || botName}
                                  primaryColor={primaryColor}
                                  onPrimary={onPrimary}
                                  bgColor={logoBgColor}
                                  size="size-10"
                                  className="shrink-0"
                                />
                              ) : (
                                renderBotAvatar("size-10", "size-5")
                              )}
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 group-hover:text-[#f97316] transition-colors truncate">
                                    {conv.topic || conv.agentName || "General Support"}
                                  </span>
                                  <span className="text-[11px] text-neutral-400 font-medium shrink-0">
                                    {formatTimeCompact(conv.updatedAt)}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5 min-w-0 mt-0.5">
                                  <span className="inline-flex items-center gap-0.5 rounded-full border border-neutral-200/80 dark:border-neutral-700/80 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-neutral-400 shrink-0">
                                    {conv.lastChannel === "voice" ? <AudioWaveform className="size-2.5" /> : <MessageSquare className="size-2.5" />}
                                    {conv.lastChannel === "voice" ? "Voice" : "Text"}
                                  </span>
                                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate">
                                    {conv.lastSnippet || "No messages yet"}
                                  </p>
                                </div>
                              </div>
                            </div>
                            <ChevronRight className="size-4 text-neutral-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
                          </button>
                        );
                      })
                    )}
                  </div>

                  {/* New conversation button */}
                  <button
                    type="button"
                    onClick={startNewConversation}
                    className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-opacity hover:opacity-90 shadow-xs"
                    style={{ background: primaryColor, color: onPrimary }}
                  >
                    <MessageCircle className="size-3.5" />
                    Start new conversation
                  </button>
                </div>
              ) : (
                /* ── STANDARD CHAT THREAD VIEW ── */
                <div className="flex-1 p-4 space-y-4 text-xs">
                {/* Team Presence Banner in Active Chat (Crisp Style) */}
                {teamProfiles.length > 0 && (
                  <div className="order-last flex items-center justify-between p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-100 dark:border-neutral-850 mt-1">
                    <div className="flex items-center gap-2">
                      <AvatarGroup
                        profiles={teamProfiles}
                        botAvatarUrl={avatarUrl || logoUrl}
                        botName={botName}
                        primaryColor={primaryColor}
                        onPrimary={onPrimary}
                        bgColor={logoBgColor}
                        size="size-6"
                      />
                      <span className="text-[11px] text-neutral-500 dark:text-neutral-400 font-medium">
                        {teamProfiles.filter((p) => p.online).length > 0 ? (
                          <span className="flex items-center gap-1.5">
                            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            {teamProfiles.filter((p) => p.online).length} team member{teamProfiles.filter((p) => p.online).length === 1 ? "" : "s"} online
                            <span className="opacity-70">
                              · active {formatTimeAgo(teamProfiles.filter((p) => p.online)[0]?.last_seen_at)}
                            </span>
                          </span>
                        ) : (
                          "Our team will reply shortly"
                        )}
                      </span>
                    </div>
                    {conversationsList.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setChatView("list")}
                        className="text-[10px] font-bold text-[#f97316] hover:underline cursor-pointer"
                      >
                        All chats ({conversationsList.length})
                      </button>
                    )}
                  </div>
                )}
                {/* Welcome Message Bot Bubble (only before history has loaded) */}
                {showInlineWelcome && <div className="flex gap-2 max-w-[85%]">
                  <div
                    className="agent-avatar-badge size-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 overflow-hidden shadow-2xs"
                    style={{
                      backgroundColor: colorScheme?.avatar?.bg || logoBgColor || primaryColor,
                      color: colorScheme?.avatar?.text || getOnColor(colorScheme?.avatar?.bg || logoBgColor || primaryColor),
                    }}
                  >
                    {avatarInner("size-4")}
                  </div>
                  <div className="bot-bubble p-3 rounded-2xl rounded-tl-none bg-neutral-100 text-neutral-800 dark:bg-neutral-850 dark:text-neutral-200 leading-relaxed shadow-2xs">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm, remarkMath]}
                      rehypePlugins={[rehypeKatex]}
                      components={mdComponents}
                    >
                      {welcomeMsg}
                    </ReactMarkdown>
                  </div>
                </div>}

                {/* Conversation History */}
                <AnimatePresence initial={false}>
                  {messages.map((msg, i) => {
                    const hasBooking = isBookingMessage(msg.content);
                    const bookingDone = Boolean(msg.confirmedMeeting);
                    return (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 10, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -6, scale: 0.95 }}
                        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                        className={`flex gap-2 ${msg.role === "user" ? "ml-auto flex-row-reverse max-w-[85%]" : hasBooking ? "max-w-[95%] w-full" : "max-w-[85%]"}`}
                      >
                        {msg.role === "assistant" && (
                          (msg.sender === "human" || (liveAgent && !msg.sender)) ? (
                            <AgentAvatar
                              src={msg.sender_avatar || activeAgentAvatar}
                              name={msg.sender_name || activeAgentName || "Agent"}
                              size="size-7"
                              showStatusDot={false}
                              primaryColor={primaryColor}
                              onPrimary={onPrimary}
                              bgColor={colorScheme?.avatar?.bg || logoBgColor}
                              textColor={colorScheme?.avatar?.text}
                              className="shrink-0"
                            />
                          ) : (
                            <div
                              className="agent-avatar-badge size-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 overflow-hidden shadow-2xs"
                              style={{
                                backgroundColor: colorScheme?.avatar?.bg || logoBgColor || primaryColor,
                                color: colorScheme?.avatar?.text || getOnColor(colorScheme?.avatar?.bg || logoBgColor || primaryColor),
                              }}
                            >
                              {avatarInner("size-4")}
                            </div>
                          )
                        )}
                        <div className={`space-y-1 ${msg.role === "user" ? "items-end" : "items-start"} flex flex-col ${hasBooking ? "w-full min-w-0" : ""}`}>
                          {msg.role === "assistant" && showSenderTag && (
                          <span className="text-[10px] text-neutral-400 font-medium px-1 flex items-center gap-1">
                              {(msg.sender === "human" || (liveAgent && !msg.sender)) ? (
                                <>
                                  <User className="size-2.5 text-blue-500" />
                                  <span>{msg.sender_name || activeAgentName || "Support Agent"}</span>
                                </>
                              ) : (
                                <>
                                  <Bot className="size-2.5" />
                                  <span>{botName}</span>
                                </>
                              )}
                            </span>
                          )}
                          <div className={`${hasBooking ? "p-1.5 sm:p-2.5 w-full" : "p-2.5"} rounded-2xl leading-relaxed min-w-0 break-words [overflow-wrap:anywhere] ${msg.role === "user" ? "user-bubble rounded-tr-none" : "bot-bubble bg-neutral-100 dark:bg-neutral-800 rounded-tl-none"}`}>
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
                                    visitorTimezone={visitorTimezone}
                                    visitorCountry={visitorCountry}
                                    primaryColor={primaryColor}
                                    backendUrl={BACKEND_URL}
                                    initialMeeting={msg.confirmedMeeting || (i === lastBookingMsgIdx ? latestActiveMeeting || undefined : undefined)}
                                    initialName={extractedVisitorInfo.name}
                                    initialEmail={extractedVisitorInfo.email}
                                    initialPhone={extractedVisitorInfo.phone}
                                    onBookingSuccess={(meeting) => {
                                      setMessages((prev) => {
                                        const updated = [...prev];
                                        if (updated[i]) {
                                          updated[i] = { ...updated[i], confirmedMeeting: meeting };
                                        }
                                        return updated;
                                      });
                                    }}
                                  />
                                )}
                              </>
                            ) : (
                              <p className="whitespace-pre-wrap">{msg.content}</p>
                            )}
                          </div>
                          {msg.role === "assistant" && (
                            <div className="flex items-center gap-2 px-1 text-[10px] text-neutral-400">
                              <span className="tabular-nums">{formatTimeAgo(msg.created_at)}</span>
                              <div className="flex items-center gap-1 opacity-0 hover:opacity-100 transition-opacity">
                                <button type="button" onClick={() => rateMessage(i, "up")} className={`p-0.5 rounded hover:text-green-500 cursor-pointer ${msg.feedback === "up" ? "text-green-500 font-bold" : ""}`}>
                                  <ThumbsUp className="size-2.5" />
                                </button>
                                <button type="button" onClick={() => rateMessage(i, "down")} className={`p-0.5 rounded hover:text-red-500 cursor-pointer ${msg.feedback === "down" ? "text-red-500 font-bold" : ""}`}>
                                  <ThumbsDown className="size-2.5" />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>

                {isBotResponding && (
                  <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="flex gap-2 max-w-[85%]">
                    <div
                      className="agent-avatar-badge size-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 overflow-hidden shadow-2xs"
                      style={{
                        backgroundColor: colorScheme?.avatar?.bg || logoBgColor || primaryColor,
                        color: colorScheme?.avatar?.text || getOnColor(colorScheme?.avatar?.bg || logoBgColor || primaryColor),
                      }}
                    >
                      {avatarInner("size-4")}
                    </div>
                    <div className="bot-bubble p-3 rounded-2xl rounded-tl-none bg-neutral-100 dark:bg-neutral-800 flex items-center gap-1.5 shadow-2xs">
                      <span className="size-1.5 rounded-full bg-neutral-400 dark:bg-neutral-500 animate-bounce" />
                      <span className="size-1.5 rounded-full bg-neutral-400 dark:bg-neutral-500 animate-bounce [animation-delay:0.2s]" />
                      <span className="size-1.5 rounded-full bg-neutral-400 dark:bg-neutral-500 animate-bounce [animation-delay:0.4s]" />
                    </div>
                  </motion.div>
                )}

                {/* Conversation Starters */}
                {starters.length > 0 && !activeNodeId && !isBotResponding && messages.filter((m) => m.role === "user").length === 0 && (
                  <div className="flex flex-col items-end gap-2 pt-1">
                    {starters.slice(0, 4).map((s, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => sendText(s)}
                        className="starter-chip px-3 py-2 rounded-2xl border text-xs font-medium text-right hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors"
                        style={{ borderColor: primaryColor, color: primaryColor }}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}

                {/* Flow / Options Choices */}
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
            )}
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

      {/* Composer (Messages tab active chat only) */}
      {tab === "messages" && chatView === "chat" && !voiceCallOpen && (
        <div className="border-t border-neutral-100 dark:border-neutral-850 p-2.5 relative bg-card">
          <input type="file" ref={fileInputRef} onChange={onFilePick} accept="image/*,audio/*,application/pdf,.txt,.doc,.docx" className="hidden" multiple />
          <AnimatePresence>
            {emojiOpen && (
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.85, pointerEvents: "none" }}
                animate={{ opacity: 1, y: 0, scale: 1, pointerEvents: "auto" }}
                exit={{ opacity: 0, y: 20, scale: 0.85, pointerEvents: "none" }}
                transition={{ duration: 0.32, ease: [0.34, 1.56, 0.64, 1] }}
                ref={emojiPanelRef}
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
                ref={attachPanelRef}
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
                // Snapshot and clear the composer before the first network
                // request. Keeping the preview in state while the assistant
                // responds makes it look like the attachment is still queued.
                const filesToSend = pendingFiles;
                const caption = inputValue.trim();
                setPendingFiles([]);
                setInputValue("");
                setAttachOpen(false);
                setEmojiOpen(false);
                for (let i = 0; i < filesToSend.length; i++) {
                  const pf = filesToSend[i];
                  await sendMedia(pf.file, pf.file.name, i === 0 ? caption : "");
                  if (pf.preview) URL.revokeObjectURL(pf.preview);
                }
                return;
              }
              // Snapshot and clear the text field before starting the request.
              // This keeps the composer available for the next message while
              // the assistant is streaming its response.
              const textToSend = inputValue.trim();
              setInputValue("");
              setAttachOpen(false);
              setEmojiOpen(false);
              void sendText(textToSend);
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
            <input value={inputValue} onChange={(e) => setInputValue(e.target.value)} onFocus={() => { setEmojiOpen(false); setAttachOpen(false); }} onPaste={onPaste}
              placeholder={transcribing ? "Transcribing…" : "Compose your message…"} disabled={isBotResponding || transcribing}
              className="w-full bg-transparent text-xs focus:outline-none disabled:opacity-60 mb-1" />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-0.5">
                <motion.button ref={emojiButtonRef} type="button" whileTap={{ scale: 0.85 }} onClick={() => { setEmojiOpen((o) => !o); setAttachOpen(false); }} className="chat-input-bar-icon p-1 text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 rounded-full" aria-label="Emoji"><Smile className="size-4" /></motion.button>
                <motion.button ref={attachButtonRef} type="button" whileTap={{ scale: 0.85 }} onClick={() => { setAttachOpen((o) => !o); setEmojiOpen(false); }} className="chat-input-bar-icon p-1 text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 rounded-full" aria-label="Attach file"><Paperclip className="size-4" /></motion.button>
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
                  ? "chat-bottom-nav w-full max-w-[320px] rounded-full border border-neutral-200/80 dark:border-neutral-800/80 shadow-lg flex items-stretch overflow-hidden backdrop-blur-xl bg-card/90"
                  : effectiveNavStyle === "chunky"
                    ? "chat-bottom-nav w-full rounded-md border-3 border-black bg-white shadow-[4px_4px_0px_#000] flex items-stretch overflow-hidden"
                    : effectiveNavStyle === "glass"
                      ? "chat-bottom-nav w-full max-w-[320px] rounded-2xl border border-white/30 bg-white/20 dark:bg-black/30 backdrop-blur-xl shadow-lg flex items-stretch overflow-hidden"
                      : effectiveNavStyle === "luxury"
                        ? "chat-bottom-nav border-t border-[#b08a3e]/40 bg-[#161412] text-[#f7f5f0] flex items-stretch tracking-wider"
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
                            if (id === "messages") {
                              if (conversationsList.length > 1) {
                                setChatView("list");
                              } else {
                                setChatView("chat");
                              }
                            }
                            setTab(id);
                          }}
                          className={`chat-bottom-nav-item flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-[9px] font-semibold tracking-wide uppercase transition-colors cursor-pointer relative isolate ${isActive ? "active" : ""} ${
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
                                className="absolute inset-1 rounded-full z-0 pointer-events-none"
                                style={{ backgroundColor: activeNavColor, opacity: 0.15 }}
                                transition={{ type: "spring", stiffness: 450, damping: 30 }}
                              />
                            ) : indicatorType === "dot" ? (
                              <motion.span
                                layoutId="activeNavIndicator"
                                className="absolute bottom-1 size-1.5 rounded-full z-20 shadow-sm pointer-events-none"
                                style={{ backgroundColor: activeNavColor }}
                                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                              />
                            ) : (
                              <motion.span
                                layoutId="activeNavIndicator"
                                className="absolute top-0 left-3 right-3 h-[2.5px] rounded-full z-20 pointer-events-none"
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
