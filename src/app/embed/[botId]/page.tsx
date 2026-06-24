"use client";

import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";
import "katex/dist/katex.min.css";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send, Loader2, Sparkles, MessageSquare, FileText, Search,
  Paperclip, Smile, Mic, Square, ChevronRight, ArrowLeft, X,
  ArrowUp, ArrowRight, RefreshCw,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useParams, useSearchParams } from "next/navigation";

const supabase = createClient();
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "https://personaliai-api-376030619262.us-central1.run.app";
const EMOJI_CATEGORIES: { name: string; emojis: string[] }[] = [
  { name: "Smileys", emojis: ["😀","😃","😄","😁","😆","😅","😂","🤣","🙂","🙃","😉","😊","😇","😍","🥰","😘","😋","😛","😜","🤪","🤨","🧐","🤓","😎","🥳","🤗","🤔","🤭","😴","😬","🙄","😏","😒","😞","😢","😭","😤","😠","😡","🤯","😱","😪"] },
  { name: "Gestures", emojis: ["👍","👎","👌","🤌","✌️","🤞","🤟","🤘","🤙","👈","👉","👆","👇","☝️","✋","🤚","🖐️","👋","🤝","🙏","✍️","💪","👏","🙌","🫶","💯"] },
  { name: "Hearts", emojis: ["❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💖","💗","💓","💞","💕","💘","💝","❣️","💔"] },
  { name: "Objects", emojis: ["🔥","✨","⭐","🌟","💫","💡","🎉","🎊","🎁","🏆","📌","📎","🔗","✅","☑️","❌","⚠️","❓","❗","💬","💭","📞","📱","📧","🚀","💰","💳","🛒","📦","📅","🕐","⏰"] },
  { name: "Nature", emojis: ["🌸","🌷","🌼","🌻","🌹","🌈","☀️","⛅","☁️","🌙","⭐","⚡","❄️","☃️","🍀","🌿","🌍","🌊"] },
];

// Send-button variants (icon + shape). Keyed by chatty_bots.send_button_style.
const SEND_BUTTON_STYLES: Record<string, { shape: string; icon: any; label?: string }> = {
  plane:      { shape: "size-8 rounded-full",        icon: <Send className="size-4" /> },
  arrowUp:    { shape: "size-8 rounded-full",        icon: <ArrowUp className="size-4" /> },
  arrowRight: { shape: "size-8 rounded-full",        icon: <ArrowRight className="size-4" /> },
  square:     { shape: "size-8 rounded-lg",          icon: <Send className="size-4" /> },
  label:      { shape: "h-8 px-3.5 rounded-full gap-1.5", icon: <Send className="size-3.5" />, label: "Send" },
};

// Browsers record audio as webm/opus, which Gemini does NOT accept. Decode and
// re-encode to 16-bit mono WAV (a Gemini-supported format) client-side.
async function audioBlobToWav(blob: Blob): Promise<Blob> {
  const AC: typeof AudioContext = (window.AudioContext || (window as any).webkitAudioContext);
  const ctx = new AC();
  const audioBuf = await ctx.decodeAudioData(await blob.arrayBuffer());
  ctx.close();
  const len = audioBuf.length;
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

interface Message {
  role: "user" | "assistant";
  content: string;
  fileUrl?: string;
  fileType?: string;
}
interface Source { id: string; name: string; content: string; }

type Tab = "home" | "messages" | "articles" | "search";

export default function EmbedWidget() {
  const { botId } = useParams();
  const searchParams = useSearchParams();
  const paramColor = searchParams.get("color");
  const paramStyle = searchParams.get("style");

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

  // Clear the conversation AND start a fresh backend session (new session_id),
  // so the assistant treats the next message as a brand-new conversation.
  const clearChat = () => {
    const fresh = `v-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    try {
      localStorage.setItem(`chatty_sid_${botId}_${hostKey}`, fresh);
      localStorage.removeItem(`chatty_msgs_${botId}_${hostKey}`);
    } catch {}
    setSessionId(fresh);
    setMessages([{ role: "assistant", content: welcomeMsg }]);
    lastPollRef.current = new Date().toISOString();
  };

  const [loading, setLoading] = useState(true);
  const [botName, setBotName] = useState("Chatty Assistant");
  const [welcomeMsg, setWelcomeMsg] = useState("Hello! How can I help you today?");
  const [starters, setStarters] = useState<string[]>([]);
  const [sendStyle, setSendStyle] = useState("plane");
  const [primaryColor, setPrimaryColor] = useState("#f97316");
  const [widgetStyle, setWidgetStyle] = useState("minimalist");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  const [tab, setTab] = useState<Tab>("messages");
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isBotResponding, setIsBotResponding] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [emojiCat, setEmojiCat] = useState(0);

  const [sources, setSources] = useState<Source[]>([]);
  const [openArticle, setOpenArticle] = useState<Source | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchAnswer, setSearchAnswer] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);

  const [recording, setRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const [liveAgent, setLiveAgent] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastPollRef = useRef<string>(new Date().toISOString());

  // Persistent per-visitor session id (survives reloads, unique per visitor)
  const [sessionId, setSessionId] = useState(() => {
    if (typeof window === "undefined") return `widget-session-${botId}`;
    const k = `chatty_sid_${botId}_${hostKey}`;
    let s = localStorage.getItem(k);
    if (!s) { s = `v-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`; localStorage.setItem(k, s); }
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

  // Persist messages (cap to last 100)
  useEffect(() => {
    if (typeof window === "undefined" || !botId || messages.length === 0) return;
    try { localStorage.setItem(`chatty_msgs_${botId}_${hostKey}`, JSON.stringify(messages.slice(-100))); } catch {}
  }, [messages, botId, hostKey]);

  // Poll for live human-agent replies
  useEffect(() => {
    if (!botId || !sessionId) return;
    const id = setInterval(async () => {
      try {
        const url = `${BACKEND_URL}/api/widget/poll?bot_id=${botId}&session_id=${encodeURIComponent(sessionId)}&after=${encodeURIComponent(lastPollRef.current)}`;
        const res = await fetch(url);
        if (!res.ok) return;
        const d = await res.json();
        setLiveAgent(!!d.ai_paused);
        if (Array.isArray(d.messages) && d.messages.length) {
          lastPollRef.current = d.messages[d.messages.length - 1].created_at;
          setMessages((p) => [...p, ...d.messages.map((m: any) => ({ role: "assistant" as const, content: m.content }))]);
          setIsBotResponding(false);
          notifyParent();
        }
      } catch {}
    }, 4000);
    return () => clearInterval(id);
  }, [botId, sessionId]);

  const getHost = (): string => {
    try { if (typeof document !== "undefined" && document.referrer) return new URL(document.referrer).hostname; } catch {}
    return searchParams.get("host") || "";
  };

  useEffect(() => {
    async function loadBot() {
      if (!botId) return;
      try {
        // Load config from the backend (service role) — works inside third-party
        // iframes where the browser Supabase client is blocked by storage partitioning.
        const res = await fetch(`${BACKEND_URL}/api/widget/theme?bot_id=${encodeURIComponent(String(botId))}`);
        if (res.ok) {
          const bot = await res.json();
          setBotName(bot.name || "Chatty Assistant");
          setWelcomeMsg(bot.welcome_message || "Hello! How can I help you today?");
          setStarters(Array.isArray(bot.conversation_starters) ? bot.conversation_starters.filter(Boolean) : []);
          setSendStyle(bot.send_button_style || "plane");
          setPrimaryColor(paramColor || bot.primary_color || "#f97316");
          setWidgetStyle(paramStyle || bot.widget_style || "minimalist");
          setLogoUrl(bot.logo_url || null);
          setMessages((prev) => prev.length ? prev : [{ role: "assistant", content: bot.welcome_message || "Hello! How can I help you today?" }]);
        }
      } catch (err) {
        console.error("Failed to load bot:", err);
      } finally {
        setLoading(false);
        try { window.parent?.postMessage({ type: "chatty:ready" }, "*"); } catch {}
      }
    }
    loadBot();
  }, [botId, paramColor, paramStyle]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, isBotResponding, tab]);

  // ---- Text message ----
  const sendText = async (text: string) => {
    if (!text.trim() || isBotResponding) return;
    setMessages((p) => [...p, { role: "user", content: text }]);
    setInputValue("");
    setEmojiOpen(false);
    setIsBotResponding(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/widget/chat`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bot_id: botId, session_id: sessionId, text, visitor_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, host: getHost() }),
      });
      const body = await res.json();
      if (res.ok && body.ai_paused) {
        // A human agent is handling this chat — reply arrives via polling.
        setLiveAgent(true);
        lastPollRef.current = new Date(Date.now() - 2000).toISOString();
      } else {
        setMessages((p) => [...p, { role: "assistant", content: res.ok ? body.reply : `⚠️ ${body.detail || "Something went wrong."}` }]);
        notifyParent();
      }
    } catch {
      setMessages((p) => [...p, { role: "assistant", content: "Sorry, I can't connect right now." }]);
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
    setMessages((p) => [...p, { role: "user", content: caption || (isAudio ? "🎤 Voice message" : `📎 ${filename}`), fileUrl: localUrl, fileType: file.type }]);
    setIsBotResponding(true);
    try {
      const fd = new FormData();
      fd.append("bot_id", String(botId));
      fd.append("session_id", sessionId);
      fd.append("text", caption);
      fd.append("visitor_timezone", Intl.DateTimeFormat().resolvedOptions().timeZone);
      fd.append("host", getHost());
      fd.append("file", file, filename);
      const res = await fetch(`${BACKEND_URL}/api/widget/chat/media`, { method: "POST", body: fd });
      const body = await res.json();
      setMessages((p) => [...p, { role: "assistant", content: res.ok ? body.reply : `⚠️ ${body.detail || "Couldn't process that file."}` }]);
      notifyParent();
    } catch {
      setMessages((p) => [...p, { role: "assistant", content: "Sorry, I couldn't upload that." }]);
    } finally {
      setIsBotResponding(false);
    }
    void isImage;
  };

  const onFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) sendMedia(f, f.name);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ---- Audio recording ----
  const toggleRecord = async () => {
    if (recording) {
      mediaRecorderRef.current?.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      audioChunksRef.current = [];
      mr.ondataavailable = (ev) => { if (ev.data.size > 0) audioChunksRef.current.push(ev.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: mr.mimeType || "audio/webm" });
        setRecording(false);
        if (blob.size === 0) return;
        try {
          const wav = await audioBlobToWav(blob);
          sendMedia(wav, "voice-message.wav");
        } catch {
          sendMedia(blob, "voice-message.webm"); // fallback
        }
      };
      mediaRecorderRef.current = mr;
      mr.start();
      setRecording(true);
    } catch {
      alert("Microphone access denied.");
    }
  };

  // ---- AI search ----
  const runSearch = async (q: string) => {
    if (!q.trim() || searching) return;
    setSearching(true);
    setSearchAnswer(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/widget/chat`, {
        method: "POST", headers: { "Content-Type": "application/json" },
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

  const mdComponents = {
    p: ({ children }: any) => <p className="mb-1 last:mb-0">{children}</p>,
    ul: ({ children }: any) => <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>,
    ol: ({ children }: any) => <ol className="list-decimal pl-4 mb-2 space-y-1">{children}</ol>,
    a: ({ href, children }: any) => <a href={href} target="_blank" rel="noreferrer" className="underline break-all" style={{ color: primaryColor }}>{children}</a>,
    code: ({ children }: any) => <code className="bg-neutral-200 dark:bg-neutral-800 px-1 py-0.5 rounded text-[10px] font-mono">{children}</code>,
  };

  return (
    <div className="w-full h-screen bg-white dark:bg-neutral-900 flex flex-col overflow-hidden text-neutral-900 dark:text-neutral-100 font-sans">
      {/* Header */}
      <div className="px-4 pt-3 pb-2 border-b border-neutral-100 dark:border-neutral-850" style={{ background: primaryColor }}>
        <div className="flex items-center gap-2.5">
          <div className="size-8 rounded-full bg-white/25 flex items-center justify-center text-white font-bold text-sm overflow-hidden">
            {logoUrl ? <img src={logoUrl} alt="" className="size-full object-cover" /> : botName[0]?.toUpperCase()}
          </div>
          <div className="leading-tight">
            <h4 className="font-semibold text-sm text-white">{botName}</h4>
            <p className="text-[9px] text-white/80 flex items-center gap-1"><span className="size-1.5 rounded-full bg-green-300 animate-pulse" />{liveAgent ? "Live agent · we're with you" : "Online · replies instantly"}</p>
          </div>
          <button onClick={clearChat} className="ml-auto p-1.5 rounded-full text-white/80 hover:text-white hover:bg-white/15 transition-colors shrink-0" aria-label="Clear conversation" title="Clear conversation">
            <RefreshCw className="size-4" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
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
                  {msg.role !== "user" && <div className="size-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0 overflow-hidden" style={{ background: primaryColor }}>{logoUrl ? <img src={logoUrl} alt="" className="size-full object-cover" /> : botName[0]?.toUpperCase()}</div>}
                  <div className={`p-2.5 rounded-2xl leading-relaxed min-w-0 break-words [overflow-wrap:anywhere] ${msg.role === "user" ? "text-white rounded-tr-none" : "bg-neutral-100 dark:bg-neutral-800 rounded-tl-none"}`} style={msg.role === "user" ? { background: primaryColor } : {}}>
                    {msg.fileUrl && msg.fileType?.startsWith("image/") && <img src={msg.fileUrl} alt="attachment" className="rounded-lg mb-1 max-h-40 object-cover" />}
                    {msg.fileUrl && msg.fileType?.startsWith("audio/") && <audio controls src={msg.fileUrl} className="mb-1 max-w-[180px]" />}
                    {msg.role === "assistant"
                      ? <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]} components={mdComponents}>{msg.content}</ReactMarkdown>
                      : <span>{msg.content}</span>}
                  </div>
                </motion.div>
              ))}
              {isBotResponding && (
                <div className="flex gap-2 mr-auto">
                  <div className="size-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0 overflow-hidden" style={{ background: primaryColor }}>{logoUrl ? <img src={logoUrl} alt="" className="size-full object-cover" /> : botName[0]?.toUpperCase()}</div>
                  <div className="p-3 bg-neutral-100 dark:bg-neutral-800 rounded-2xl rounded-tl-none flex items-center gap-1">
                    <span className="size-1.5 rounded-full bg-neutral-400 animate-bounce" />
                    <span className="size-1.5 rounded-full bg-neutral-400 animate-bounce [animation-delay:150ms]" />
                    <span className="size-1.5 rounded-full bg-neutral-400 animate-bounce [animation-delay:300ms]" />
                  </div>
                </div>
              )}
            </AnimatePresence>
            {starters.length > 0 && !isBotResponding && messages.filter((m) => m.role === "user").length === 0 && (
              <div className="flex flex-col items-end gap-2 pt-1">
                {starters.slice(0, 4).map((s, i) => (
                  <button key={i} onClick={() => sendText(s)}
                    className="px-3 py-2 rounded-2xl border text-xs font-medium text-right hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors"
                    style={{ borderColor: primaryColor, color: primaryColor }}>
                    {s}
                  </button>
                ))}
              </div>
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
                <button onClick={() => { setTab("messages"); }} className="mt-3 text-[11px] font-semibold px-3 py-1.5 rounded-lg text-white" style={{ background: primaryColor }}>Still have questions? Message us</button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Composer (Messages tab only) */}
      {tab === "messages" && (
        <div className="border-t border-neutral-100 dark:border-neutral-850 p-2.5 relative">
          <input type="file" ref={fileInputRef} onChange={onFilePick} accept="image/*,audio/*,application/pdf,.txt,.doc,.docx" className="hidden" />
          {emojiOpen && (
            <div className="absolute bottom-[84px] left-2.5 right-2.5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-lg z-10 overflow-hidden">
              <div className="flex gap-1 p-1.5 border-b border-neutral-100 dark:border-neutral-800 overflow-x-auto scrollbar-thin">
                {EMOJI_CATEGORIES.map((cat, i) => (
                  <button key={cat.name} type="button" onClick={() => setEmojiCat(i)} title={cat.name}
                    className={`px-2 py-1 rounded-md text-base leading-none shrink-0 ${emojiCat === i ? "bg-neutral-100 dark:bg-neutral-800" : "opacity-50 hover:opacity-100"}`}>
                    {cat.emojis[0]}
                  </button>
                ))}
              </div>
              <div className="p-2 grid grid-cols-8 gap-1 max-h-40 overflow-y-auto scrollbar-thin">
                {EMOJI_CATEGORIES[emojiCat].emojis.map((e, i) => (
                  <button key={i} type="button" onClick={() => setInputValue((v) => v + e)}
                    className="text-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded p-0.5">{e}</button>
                ))}
              </div>
            </div>
          )}
          <form onSubmit={(e) => { e.preventDefault(); sendText(inputValue); }}
            className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 px-3 pt-2.5 pb-1.5 focus-within:border-neutral-300 dark:focus-within:border-neutral-700 transition-colors">
            <input value={inputValue} onChange={(e) => setInputValue(e.target.value)} onFocus={() => setEmojiOpen(false)}
              placeholder={recording ? "Recording… tap ◼ to send" : "Compose your message…"} disabled={isBotResponding || recording}
              className="w-full bg-transparent text-xs focus:outline-none disabled:opacity-60 mb-1.5" />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-0.5">
                <button type="button" onClick={() => setEmojiOpen((o) => !o)} className="p-1.5 text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 rounded-full" aria-label="Emoji"><Smile className="size-4.5" /></button>
                <button type="button" onClick={() => fileInputRef.current?.click()} className="p-1.5 text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 rounded-full" aria-label="Attach file"><Paperclip className="size-4.5" /></button>
                <button type="button" onClick={toggleRecord} className={`p-1.5 rounded-full ${recording ? "text-red-500 animate-pulse" : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"}`} aria-label="Record audio">
                  {recording ? <Square className="size-4.5 fill-current" /> : <Mic className="size-4.5" />}
                </button>
              </div>
              {(() => {
                const c = SEND_BUTTON_STYLES[sendStyle] || SEND_BUTTON_STYLES.plane;
                return (
                  <button type="submit" disabled={isBotResponding || !inputValue.trim()} style={{ background: primaryColor }}
                    className={`${c.shape} flex items-center justify-center text-white hover:opacity-90 disabled:opacity-40 shrink-0`}>
                    {c.icon}{c.label && <span className="text-xs font-semibold">{c.label}</span>}
                  </button>
                );
              })()}
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
