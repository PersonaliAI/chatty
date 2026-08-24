"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Send, RefreshCw, Inbox as InboxIcon, Bot, User, Headphones, Trash2, Paperclip, Smile, Mic, Square, X, Check, AlertCircle, ThumbsUp, ThumbsDown, Zap, Plus, Pencil, Settings2 } from "lucide-react";
import { QuickEmojiPicker } from "@/components/quick-emoji-picker";
import { AttachMenu } from "@/components/attach-menu";
import { createClient } from "@/lib/supabase/client";

/* ── Canned Responses helpers ─────────────────────────────────── */
interface CannedResponse {
  id: string;
  shortcut: string;   // e.g. "greeting"
  text: string;       // e.g. "Hi {{visitor_name}}, how can I help?"
}

const CANNED_KEY = "chatty_canned_responses";

function loadCannedResponses(): CannedResponse[] {
  try { return JSON.parse(localStorage.getItem(CANNED_KEY) || "[]"); } catch { return []; }
}
function saveCannedResponses(items: CannedResponse[]) {
  localStorage.setItem(CANNED_KEY, JSON.stringify(items));
}
function applyCannedVars(text: string, visitorName: string): string {
  return text.replace(/\{\{visitor_name\}\}/gi, visitorName || "Visitor");
}
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

async function audioBlobToWav(blob: Blob): Promise<Blob> {
  const AC: typeof AudioContext = (window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)!;
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

interface Session {
  id: string;
  session_id: string;
  visitor_name?: string;
  last_message?: string;
  last_message_at?: string;
  ai_paused?: boolean;
  needs_attention?: boolean;
  assigned_agent_email?: string;
  assigned_agent_name?: string;
}
interface Msg {
  id?: string;
  role: string;
  content: string;
  sender?: string;
  created_at?: string;
  feedback_rating?: string | null;
  correction?: string | null;
}

interface Props {
  botId: string;
  fetchBackend: (path: string, opts?: RequestInit) => Promise<Response>;
  formatDateTime: (s: string) => string;
  color?: string;
}

export function InboxPanel({ botId, fetchBackend, formatDateTime, color = "#f97316" }: Props) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [reply, setReply] = useState("");
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const [recording, setRecording] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [correctingId, setCorrectingId] = useState<string | null>(null);
  const [correctionDraft, setCorrectionDraft] = useState("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Canned Responses state ──
  const [cannedResponses, setCannedResponses] = useState<CannedResponse[]>([]);
  const [cannedOpen, setCannedOpen] = useState(false);
  const [cannedFilter, setCannedFilter] = useState("");
  const [cannedManageOpen, setCannedManageOpen] = useState(false);
  const [editingCanned, setEditingCanned] = useState<CannedResponse | null>(null);
  const [cannedDraftShortcut, setCannedDraftShortcut] = useState("");
  const [cannedDraftText, setCannedDraftText] = useState("");

  // Load canned responses on mount — reads localStorage, which isn't
  // available during SSR/render, so this has to happen in an effect.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCannedResponses(loadCannedResponses());
  }, []);

  const saveCanned = (items: CannedResponse[]) => {
    setCannedResponses(items);
    saveCannedResponses(items);
  };

  const addOrUpdateCanned = () => {
    if (!cannedDraftShortcut.trim() || !cannedDraftText.trim()) return;
    const items = [...cannedResponses];
    if (editingCanned) {
      const idx = items.findIndex((c) => c.id === editingCanned.id);
      if (idx >= 0) items[idx] = { ...items[idx], shortcut: cannedDraftShortcut.trim().toLowerCase(), text: cannedDraftText.trim() };
    } else {
      items.push({ id: crypto.randomUUID(), shortcut: cannedDraftShortcut.trim().toLowerCase(), text: cannedDraftText.trim() });
    }
    saveCanned(items);
    setEditingCanned(null);
    setCannedDraftShortcut("");
    setCannedDraftText("");
  };

  const deleteCanned = (id: string) => {
    saveCanned(cannedResponses.filter((c) => c.id !== id));
  };

  const handleReplyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setReply(val);
    // Trigger canned responses dropdown when typing "/"
    if (val.startsWith("/")) {
      setCannedOpen(true);
      setCannedFilter(val.slice(1).toLowerCase());
    } else {
      setCannedOpen(false);
      setCannedFilter("");
    }
  };

  const selectCanned = (c: CannedResponse) => {
    const visitorName = current?.visitor_name || (selected ? `Visitor ${selected.slice(-5)}` : "Visitor");
    setReply(applyCannedVars(c.text, visitorName));
    setCannedOpen(false);
    setCannedFilter("");
  };

  const filteredCanned = cannedResponses.filter(
    (c) => !cannedFilter || c.shortcut.includes(cannedFilter) || c.text.toLowerCase().includes(cannedFilter)
  );

  // ── Tags, Notes, and Search State ──
  const [tags, setTags] = useState<Record<string, string[]>>({});
  interface Note {
    id: string;
    text: string;
    author: string;
    timestamp: string;
  }
  const [notes, setNotes] = useState<Record<string, Note[]>>({});
  const [noteDraft, setNoteDraft] = useState("");
  const [viewMode, setViewMode] = useState<"chat" | "notes">("chat");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTagFilter, setSelectedTagFilter] = useState<string>("all");
  const [tagPopoverOpen, setTagPopoverOpen] = useState(false);

  // Load from localStorage on mount / whenever the bot changes — reads
  // localStorage, which isn't available during SSR/render, so this has to
  // happen in an effect.
  useEffect(() => {
    try {
      const storedTags = localStorage.getItem(`chatty_session_tags_${botId}`);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (storedTags) setTags(JSON.parse(storedTags));
    } catch {}
    try {
      const storedNotes = localStorage.getItem(`chatty_session_notes_${botId}`);
      if (storedNotes) setNotes(JSON.parse(storedNotes));
    } catch {}
  }, [botId]);

  const saveSessionTags = (newTags: Record<string, string[]>) => {
    setTags(newTags);
    try { localStorage.setItem(`chatty_session_tags_${botId}`, JSON.stringify(newTags)); } catch {}
  };

  const saveSessionNotes = (newNotes: Record<string, Note[]>) => {
    setNotes(newNotes);
    try { localStorage.setItem(`chatty_session_notes_${botId}`, JSON.stringify(newNotes)); } catch {}
  };

  const toggleTag = (sid: string, tag: string) => {
    const currentTags = tags[sid] || [];
    const newTags = currentTags.includes(tag)
      ? currentTags.filter((t) => t !== tag)
      : [...currentTags, tag];
    const updated = { ...tags, [sid]: newTags };
    saveSessionTags(updated);
  };

  const addNote = () => {
    if (!noteDraft.trim() || !selected) return;
    const sessionNotes = notes[selected] || [];
    const newNote: Note = {
      id: crypto.randomUUID(),
      text: noteDraft.trim(),
      author: "Agent",
      timestamp: new Date().toISOString(),
    };
    const updated = { ...notes, [selected]: [...sessionNotes, newNote] };
    saveSessionNotes(updated);
    setNoteDraft("");
    showToast("Internal note added.", "success");
  };

  const deleteNote = (noteId: string) => {
    if (!selected) return;
    const sessionNotes = notes[selected] || [];
    const updated = { ...notes, [selected]: sessionNotes.filter((n) => n.id !== noteId) };
    saveSessionNotes(updated);
    showToast("Note deleted.", "success");
  };

  const PREDEFINED_TAGS = ["VIP", "Bug", "Billing", "Feature Request", "Urgent", "Lead"];

  // Filtered Sessions selector
  const filteredSessions = sessions.filter((s) => {
    const sessionTags = tags[s.session_id] || [];
    
    // Tag filter
    if (selectedTagFilter !== "all" && !sessionTags.includes(selectedTagFilter)) {
      return false;
    }

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchesName = (s.visitor_name || "").toLowerCase().includes(q);
      const matchesMsg = (s.last_message || "").toLowerCase().includes(q);
      const matchesId = s.session_id.toLowerCase().includes(q);
      const matchesTags = sessionTags.some((t) => t.toLowerCase().includes(q));
      return matchesName || matchesMsg || matchesId || matchesTags;
    }

    return true;
  });

  // Custom states for toast and confirm modal
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
  };

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const current = sessions.find((s) => s.session_id === selected);

  const loadSessions = useCallback(async () => {
    setLoadingSessions(true);
    try {
      const res = await fetchBackend(`/api/admin/inbox?bot_id=${botId}`);
      if (res.ok) { const d = await res.json(); setSessions(d.sessions || []); }
    } catch {} finally { setLoadingSessions(false); }
  }, [botId, fetchBackend]);

  const loadMessages = useCallback(async (sid: string) => {
    try {
      const res = await fetchBackend(`/api/admin/inbox/messages?bot_id=${botId}&session_id=${encodeURIComponent(sid)}`);
      if (res.ok) { const d = await res.json(); setMessages(d.messages || []); }
    } catch {}
  }, [botId, fetchBackend]);

  // Data-fetching effects: loadSessions/loadMessages hit the backend and
  // update state with the response — the standard "synchronize with an
  // external system" effect pattern, not a render-time computation.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadSessions();
  }, [loadSessions]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (selected) loadMessages(selected);
  }, [selected, loadMessages]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // Live polling
  useEffect(() => {
    const id = setInterval(() => { loadSessions(); if (selected) loadMessages(selected); }, 5000);
    return () => clearInterval(id);
  }, [selected, loadSessions, loadMessages]);

  const setFeedback = async (messageId: string, rating: "up" | "down" | null, correction?: string) => {
    setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, feedback_rating: rating, correction: correction ?? m.correction } : m)));
    try {
      const res = await fetchBackend(`/api/admin/inbox/messages/${messageId}/feedback`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bot_id: botId, rating, correction: correction ?? null }),
      });
      if (res.ok && correction) {
        showToast("Correction saved — added to the knowledge base.", "success");
        setCorrectingId(null);
        setCorrectionDraft("");
      }
    } catch {
      showToast("Failed to save feedback.", "error");
    }
  };

  const sendReply = async () => {
    if (!reply.trim() || !selected) return;
    setSending(true);
    const text = reply;
    setReply("");
    setMessages((p) => [...p, { role: "assistant", content: text, sender: "human" }]);
    try {
      await fetchBackend("/api/admin/inbox/reply", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bot_id: botId, session_id: selected, text }),
      });
      loadSessions();
    } catch {} finally { setSending(false); }
  };

  const sendMedia = async (file: File | Blob, filename: string, caption = "") => {
    if (!selected) return;
    setSending(true);
    const localUrl = URL.createObjectURL(file);
    const display = (caption.trim() + (caption.trim() ? "\n" : "")) + `[attachment: ${filename}]`;
    const tempContent = display + `\n${localUrl}`;
    setMessages((p) => [...p, { role: "assistant", content: tempContent, sender: "human" }]);
    setReply("");
    setEmojiOpen(false);
    try {
      const fd = new FormData();
      fd.append("bot_id", botId);
      fd.append("session_id", selected);
      fd.append("text", caption);
      fd.append("file", file, filename);
      await fetchBackend("/api/admin/inbox/reply/media", {
        method: "POST",
        body: fd,
      });
      loadSessions();
      if (selected) loadMessages(selected);
    } catch {
      showToast("Failed to upload attachment", "error");
    } finally {
      setSending(false);
    }
  };

  const onFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) sendMedia(f, f.name);
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
        setReply((v) => (v.trim() ? `${v} 📍 ${link}` : `📍 Location: ${link}`));
      },
      () => showToast("Couldn't access your location.", "error"),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

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
          // Don't fall back to sending the raw recording — Gemini doesn't
          // accept audio/webm (the browser's native recording format), so a
          // silent fallback used to upload audio the AI could never read,
          // appearing as a sent-but-ignored "empty" message.
          showToast("Couldn't process that recording — try again.", "error");
        }
      };
      mediaRecorderRef.current = mr;
      mr.start();
      setRecording(true);
    } catch {
      showToast("Microphone access denied.", "error");
    }
  };

  const deleteSession = async (sid: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmModal({
      title: "Delete Conversation",
      message: "Are you sure you want to delete this conversation? This can't be undone.",
      onConfirm: async () => {
        setSessions((p) => p.filter((s) => s.session_id !== sid));
        if (selected === sid) { setSelected(null); setMessages([]); }
        try {
          await fetchBackend("/api/admin/inbox/delete", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ bot_id: botId, session_id: sid }),
          });
          showToast("Conversation deleted successfully.", "success");
        } catch {}
      }
    });
  };

  const toggleAI = async (paused: boolean) => {
    if (!selected) return;
    setSessions((p) => p.map((s) => s.session_id === selected ? { ...s, ai_paused: paused } : s));
    try {
      await fetchBackend("/api/admin/inbox/ai", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bot_id: botId, session_id: selected, ai_paused: paused }),
      });
    } catch {}
  };

  const claimSession = async (sid: string) => {
    if (!sid) return;
    try {
      const supabase = createClient();
      const { data: userData } = await supabase.auth.getUser();
      const agentEmail = userData?.user?.email || "Support Agent";
      const agentName = agentEmail.split("@")[0];

      setSessions((p) =>
        p.map((s) => (s.session_id === sid ? { ...s, assigned_agent_email: agentEmail, assigned_agent_name: agentName, ai_paused: true } : s))
      );

      await supabase
        .from("chatty_sessions")
        .update({
          assigned_agent_email: agentEmail,
          assigned_agent_name: agentName,
          ai_paused: true,
        })
        .eq("bot_id", botId)
        .eq("session_id", sid);

      showToast(`Session assigned to ${agentName}`, "success");
    } catch {}
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      {/* Sessions list */}
      <div className="lg:col-span-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden flex flex-col max-h-[600px]">
        <div className="p-3 border-b border-neutral-100 dark:border-neutral-850 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">Conversations ({filteredSessions.length})</span>
            <button onClick={loadSessions} className="text-neutral-400 hover:text-neutral-600 cursor-pointer"><RefreshCw className={`size-3.5 ${loadingSessions ? "animate-spin" : ""}`} /></button>
          </div>
          {/* Search and Filters */}
          <div className="space-y-1.5">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search conversations, tags..."
              className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-2.5 py-1 text-[11px] focus:outline-none"
            />
            <div className="flex gap-1 overflow-x-auto pb-1 text-[9px] scrollbar-none">
              <button
                onClick={() => setSelectedTagFilter("all")}
                className={`px-2 py-0.5 rounded-full border transition-colors cursor-pointer shrink-0 ${
                  selectedTagFilter === "all"
                    ? "bg-[#f97316]/10 border-[#f97316] text-[#f97316] font-semibold"
                    : "border-neutral-200 dark:border-neutral-800 text-neutral-450 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                }`}
              >
                All
              </button>
              {PREDEFINED_TAGS.map((t) => (
                <button
                  key={t}
                  onClick={() => setSelectedTagFilter(t)}
                  className={`px-2 py-0.5 rounded-full border transition-colors cursor-pointer shrink-0 ${
                    selectedTagFilter === t
                      ? "bg-[#f97316]/10 border-[#f97316] text-[#f97316] font-semibold"
                      : "border-neutral-200 dark:border-neutral-800 text-neutral-450 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-850">
          {filteredSessions.length === 0 ? (
            <div className="p-8 text-center"><InboxIcon className="size-7 text-neutral-300 mx-auto" /><p className="text-xs text-neutral-400 mt-2">No conversations found</p></div>
          ) : filteredSessions.map((s) => {
            const sessionTags = tags[s.session_id] || [];
            return (
              <div key={s.id} role="button" tabIndex={0} onClick={() => setSelected(s.session_id)}
                className={`group w-full text-left p-3 transition-colors cursor-pointer ${selected === s.session_id ? "bg-[#f97316]/5 border-l-2 border-l-[#f97316]" : s.needs_attention ? "bg-red-50/60 dark:bg-red-950/15 border-l-2 border-l-red-500" : "hover:bg-neutral-50 dark:hover:bg-neutral-850/40 border-l-2 border-l-transparent"}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold truncate flex items-center gap-1.5">
                    {s.needs_attention && <span className="size-1.5 rounded-full bg-red-500 animate-pulse shrink-0" />}
                    {s.visitor_name || `Visitor ${s.session_id.slice(-5)}`}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {s.needs_attention
                      ? <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400 flex items-center gap-1"><Headphones className="size-2.5" />Needs you</span>
                      : s.ai_paused
                      ? <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-600 dark:bg-purple-950/30 dark:text-purple-400 flex items-center gap-1"><Headphones className="size-2.5" />Live</span>
                      : <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-green-50 text-green-600 dark:bg-green-950/30 dark:text-green-400 flex items-center gap-1"><Bot className="size-2.5" />AI</span>}
                    <button onClick={(e) => deleteSession(s.session_id, e)} aria-label="Delete conversation"
                      className="opacity-0 group-hover:opacity-100 text-neutral-400 hover:text-red-500 transition-opacity p-0.5 cursor-pointer">
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
                <p className="text-[10px] text-neutral-400 truncate mt-0.5">{s.last_message || "…"}</p>
                {sessionTags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {sessionTags.map((t) => (
                      <span key={t} className="text-[8px] font-semibold px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 border border-neutral-200/50 dark:border-neutral-800">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
                {s.last_message_at && <p className="text-[9px] text-neutral-300 dark:text-neutral-600 mt-0.5">{formatDateTime(s.last_message_at)}</p>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Transcript + reply */}
      <div className="lg:col-span-8 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden flex flex-col max-h-[600px]">
        {!selected ? (
          <div className="flex-1 flex items-center justify-center text-xs text-neutral-400">Select a conversation</div>
        ) : (
          <>
            <div className="p-3 border-b border-neutral-100 dark:border-neutral-850 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold truncate max-w-36">{current?.visitor_name || `Visitor ${selected.slice(-5)}`}</span>
                
                {/* Tags Popover Trigger */}
                <div className="relative">
                  <button
                    onClick={() => setTagPopoverOpen(!tagPopoverOpen)}
                    className="text-[9px] font-semibold border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-850 px-2 py-0.5 rounded flex items-center gap-1 cursor-pointer"
                  >
                    🏷️ Tags
                  </button>
                  {tagPopoverOpen && (
                    <div className="absolute top-7 left-0 z-20 w-40 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg shadow-xl p-2 space-y-1">
                      <div className="flex justify-between items-center px-1 pb-1 border-b border-neutral-100 dark:border-neutral-800">
                        <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider">Session Tags</span>
                        <button onClick={() => setTagPopoverOpen(false)} className="text-[10px] text-neutral-400 hover:text-neutral-600">&times;</button>
                      </div>
                      <div className="py-1 space-y-0.5 max-h-48 overflow-y-auto">
                        {PREDEFINED_TAGS.map((t) => {
                          const hasTag = (tags[selected] || []).includes(t);
                          return (
                            <button
                              key={t}
                              onClick={() => toggleTag(selected, t)}
                              className="w-full text-left px-2 py-1 rounded hover:bg-neutral-50 dark:hover:bg-neutral-850 text-[10px] flex items-center justify-between cursor-pointer"
                            >
                              <span>{t}</span>
                              {hasTag && <span className="text-green-600 font-bold">✓</span>}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              {/* View Mode & AI Toggle Controls */}
              <div className="flex items-center gap-2">
                {/* View Mode Selector */}
                <div className="flex bg-neutral-100 dark:bg-neutral-850 p-0.5 rounded-lg text-[9px] font-semibold">
                  <button
                    onClick={() => setViewMode("chat")}
                    className={`px-2 py-1 rounded-md transition-colors cursor-pointer ${
                      viewMode === "chat"
                        ? "bg-white dark:bg-neutral-800 shadow text-neutral-900 dark:text-neutral-100"
                        : "text-neutral-450"
                    }`}
                  >
                    Chat
                  </button>
                  <button
                    onClick={() => setViewMode("notes")}
                    className={`px-2 py-1 rounded-md transition-colors cursor-pointer ${
                      viewMode === "notes"
                        ? "bg-white dark:bg-neutral-800 shadow text-neutral-900 dark:text-neutral-100"
                        : "text-neutral-450"
                    }`}
                  >
                    Notes ({ (notes[selected] || []).length })
                  </button>
                </div>

                <button onClick={() => toggleAI(!current?.ai_paused)}
                  className={`text-[10px] font-semibold px-2.5 py-1 rounded-lg cursor-pointer flex items-center gap-1.5 ${current?.ai_paused ? "bg-[#f97316] text-white" : "border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-300"}`}>
                  {current?.ai_paused ? <><Headphones className="size-3" />Live</> : <><Bot className="size-3" />AI</>}
                </button>
              </div>
            </div>

            {current?.assigned_agent_email && (
              <div className="bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-900/40 px-3.5 py-1.5 flex items-center justify-between text-xs font-medium text-amber-800 dark:text-amber-300 shrink-0">
                <div className="flex items-center gap-1.5 text-[11px]">
                  <span className="font-bold">🔒 Agent Lock:</span>
                  <span>Currently assigned to {current.assigned_agent_name || current.assigned_agent_email}</span>
                </div>
                <button
                  onClick={() => claimSession(selected)}
                  className="text-[9px] font-bold bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/50 dark:hover:bg-amber-800/60 px-2 py-0.5 rounded transition-colors cursor-pointer text-amber-900 dark:text-amber-100"
                >
                  Take Over Session
                </button>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-4 space-y-3 text-xs">
              {viewMode === "notes" ? (
                /* Notes List View */
                <div className="flex flex-col h-full justify-between gap-4">
                  <div className="space-y-2.5 overflow-y-auto flex-1 min-h-[220px] max-h-[380px]">
                    {(notes[selected] || []).length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-48 text-neutral-400">
                        <Zap className="size-8 text-neutral-300 mb-2" />
                        <p className="text-[11px] text-center">No internal notes yet.<br />Add private thoughts/metadata context below.</p>
                      </div>
                    ) : (
                      (notes[selected] || []).map((n) => (
                        <div key={n.id} className="bg-yellow-50/50 dark:bg-yellow-950/10 border border-yellow-200/50 dark:border-yellow-900/30 rounded-xl p-3 relative group">
                          <div className="flex items-center justify-between text-[9px] font-semibold text-neutral-400 dark:text-neutral-500 mb-1">
                            <span>{n.author}</span>
                            <span>{formatDateTime(n.timestamp)}</span>
                          </div>
                          <p className="text-neutral-700 dark:text-neutral-300 text-[11px] whitespace-pre-wrap leading-relaxed">{n.text}</p>
                          <button
                            onClick={() => deleteNote(n.id)}
                            className="absolute bottom-2.5 right-2.5 opacity-0 group-hover:opacity-100 transition-opacity text-neutral-400 hover:text-red-500 cursor-pointer"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="border-t border-neutral-100 dark:border-neutral-850 pt-3 space-y-2 mt-auto">
                    <textarea
                      rows={3}
                      value={noteDraft}
                      onChange={(e) => setNoteDraft(e.target.value)}
                      placeholder="Add an internal note (only visible to support agents)..."
                      className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-2 text-xs resize-none focus:outline-none"
                    />
                    <div className="flex justify-end">
                      <button
                        onClick={addNote}
                        disabled={!noteDraft.trim()}
                        className="px-3 py-1.5 text-xs font-semibold text-white rounded-lg cursor-pointer disabled:opacity-40"
                        style={{ background: color }}
                      >
                        Add note
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                /* Chat Messages View */
                <>
                  {messages.map((m, i) => {
                    const isVisitor = m.role === "user";
                    const isHuman = m.sender === "human";

                    // Parse attachment if exists in m.content
                    let cleanContent = m.content;
                    let attachmentUrl: string | null = null;
                    let attachmentName = "";

                    const lines = m.content.split("\n");
                    if (lines.length >= 2) {
                      const lastLine = lines[lines.length - 1].trim();
                      const prevLine = lines[lines.length - 2].trim();
                      if (lastLine.startsWith("http://") || lastLine.startsWith("https://") || lastLine.startsWith("blob:")) {
                        if (prevLine.includes("[attachment:")) {
                          attachmentUrl = lastLine;
                          const match = prevLine.match(/\[attachment:\s*(.*?)\]/);
                          attachmentName = match ? match[1] : "attachment";
                          cleanContent = lines.slice(0, lines.length - 2).join("\n").trim();
                        }
                      }
                    }

                    const isImage = attachmentUrl && (
                      attachmentName.toLowerCase().endsWith(".png") ||
                      attachmentName.toLowerCase().endsWith(".jpg") ||
                      attachmentName.toLowerCase().endsWith(".jpeg") ||
                      attachmentName.toLowerCase().endsWith(".gif") ||
                      attachmentName.toLowerCase().endsWith(".webp") ||
                      attachmentUrl.includes("image/")
                    );

                    const isAudio = attachmentUrl && (
                      attachmentName.toLowerCase().endsWith(".wav") ||
                      attachmentName.toLowerCase().endsWith(".mp3") ||
                      attachmentName.toLowerCase().endsWith(".webm") ||
                      attachmentName.toLowerCase().endsWith(".ogg") ||
                      attachmentUrl.includes("audio/")
                    );

                    const senderName = isVisitor
                      ? (current?.visitor_name || `Visitor ${selected.slice(-5)}`)
                      : isHuman ? "You" : "Assistant";

                    return (
                      <div key={i} className={`flex gap-2 max-w-[85%] ${isVisitor ? "mr-auto" : "ml-auto flex-row-reverse"}`}>
                        <div className={`size-5 rounded-full flex items-center justify-center shrink-0 ${isVisitor ? "bg-neutral-200 dark:bg-neutral-700" : isHuman ? "bg-purple-500 text-white" : "text-white"}`} style={!isVisitor && !isHuman ? { background: color } : {}}>
                          {isVisitor ? <User className="size-3" /> : isHuman ? <Headphones className="size-3" /> : <Bot className="size-3" />}
                        </div>
                        <div className={`flex flex-col min-w-0 ${isVisitor ? "items-start" : "items-end"}`}>
                        <span className={`text-[9px] font-semibold text-neutral-400 dark:text-neutral-500 px-0.5 mb-0.5 ${isVisitor ? "text-left" : "text-right"}`}>{senderName}</span>
                        <div className={`p-2.5 rounded-2xl ${isVisitor ? "bg-neutral-100 dark:bg-neutral-800 rounded-tl-none" : isHuman ? "bg-purple-500 text-white rounded-tr-none" : "text-white rounded-tr-none"}`} style={!isVisitor && !isHuman ? { background: color } : {}}>
                          {attachmentUrl && isImage && (
                            // eslint-disable-next-line @next/next/no-img-element -- uploaded-file/blob URL, not in next/image's domain allowlist
                            <img src={attachmentUrl} alt="attachment" className="rounded-lg mb-1.5 max-h-40 object-cover" />
                          )}
                          {attachmentUrl && isAudio && (
                            <audio controls src={attachmentUrl} className="mb-1.5 max-w-[180px]" />
                          )}
                          {attachmentUrl && !isImage && !isAudio && (
                            <a href={attachmentUrl} target="_blank" rel="noreferrer" className={`flex items-center gap-1 text-[10px] underline mb-1.5 ${isVisitor ? "text-neutral-600 dark:text-neutral-300" : "text-white"}`}>
                              <Paperclip className="size-3 animate-[pulse_2s_infinite]" />
                              {attachmentName}
                            </a>
                          )}
                          {cleanContent && (
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm, remarkMath]}
                              rehypePlugins={[rehypeKatex]}
                              components={{
                                p: ({ children }) => <p className="mb-1.5 last:mb-0 leading-relaxed">{children}</p>,
                                ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>,
                                ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-1">{children}</ol>,
                                li: ({ children }) => <li className="mb-0.5">{children}</li>,
                                pre: ({ children }) => <pre className="bg-neutral-950 text-white rounded-lg p-2 overflow-x-auto my-2 text-[10px] font-mono leading-normal">{children}</pre>,
                                code: ({ children }) => (
                                  <code className={isVisitor || isHuman ? "bg-black/10 dark:bg-white/20 px-1 py-0.5 rounded text-[10px] font-mono" : "bg-white/20 text-white px-1 py-0.5 rounded text-[10px] font-mono"}>
                                    {children}
                                  </code>
                                )
                              }}
                            >
                              {cleanContent}
                            </ReactMarkdown>
                          )}
                        </div>
                        </div>
                        {!isVisitor && !isHuman && m.id && (
                          <div className="flex flex-col gap-1 self-end pb-1">
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setFeedback(m.id!, m.feedback_rating === "up" ? null : "up")}
                                className={`p-1 rounded cursor-pointer ${m.feedback_rating === "up" ? "text-green-600" : "text-neutral-300 hover:text-neutral-500"}`}
                                title="Good answer"
                              >
                                <ThumbsUp className="size-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const next = m.feedback_rating === "down" ? null : "down";
                                  setFeedback(m.id!, next);
                                  if (next === "down") { setCorrectingId(m.id!); setCorrectionDraft(m.correction || ""); }
                                }}
                                className={`p-1 rounded cursor-pointer ${m.feedback_rating === "down" ? "text-red-500" : "text-neutral-300 hover:text-neutral-500"}`}
                                title="Needs correction"
                              >
                                <ThumbsDown className="size-3" />
                              </button>
                            </div>
                            {correctingId === m.id && (
                              <div className="w-56 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg p-2 shadow-lg">
                                <textarea
                                  rows={3}
                                  value={correctionDraft}
                                  onChange={(e) => setCorrectionDraft(e.target.value)}
                                  placeholder="What should it have said?"
                                  className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-md px-2 py-1.5 text-[10px] resize-none focus:outline-none"
                                />
                                <div className="flex justify-end gap-1.5 mt-1.5">
                                  <button onClick={() => { setCorrectingId(null); setCorrectionDraft(""); }} className="text-[10px] text-neutral-400 hover:text-neutral-600 cursor-pointer px-2 py-1">Cancel</button>
                                  <button
                                    onClick={() => setFeedback(m.id!, "down", correctionDraft.trim())}
                                    disabled={!correctionDraft.trim()}
                                    className="text-[10px] font-semibold text-white rounded-md px-2 py-1 cursor-pointer disabled:opacity-40"
                                    style={{ background: color }}
                                  >
                                    Save correction
                                  </button>
                                </div>
                              </div>
                            )}
                            {m.correction && correctingId !== m.id && (
                              <button onClick={() => { setCorrectingId(m.id!); setCorrectionDraft(m.correction || ""); }} className="text-[9px] text-neutral-400 hover:underline cursor-pointer text-right">
                                Edit correction
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <div ref={endRef} />
                </>
              )}
            </div>
            <div className="border-t border-neutral-100 dark:border-neutral-850 p-2.5 relative">
              <input type="file" ref={fileInputRef} onChange={onFilePick} accept="image/*,audio/*,application/pdf,.txt,.doc,.docx" className="hidden" />
              <AnimatePresence>
                {emojiOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 20, scale: 0.85, pointerEvents: "none" }}
                    animate={{ opacity: 1, y: 0, scale: 1, pointerEvents: "auto" }}
                    exit={{ opacity: 0, y: 20, scale: 0.85, pointerEvents: "none" }}
                    transition={{ duration: 0.32, ease: [0.34, 1.56, 0.64, 1] }}
                    className="emoji-panel-picker absolute bottom-[84px] left-2.5 right-2.5 z-10 h-80 overflow-hidden rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80 shadow-[0_12px_40px_-8px_rgba(0,0,0,0.25)] bg-white dark:bg-neutral-900"
                  >
                    <QuickEmojiPicker onSelect={(emoji) => setReply((v) => v + emoji)} accentColor={color} />
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
                    className="absolute bottom-[84px] left-2.5 z-10 w-52 rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80 shadow-[0_12px_40px_-8px_rgba(0,0,0,0.25)] bg-white dark:bg-neutral-900"
                  >
                    <AttachMenu
                      onPickImages={() => openFilePicker("images")}
                      onPickDocuments={() => openFilePicker("documents")}
                      onShareLocation={shareLocation}
                      accentColor={color}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
              <form onSubmit={(e) => { e.preventDefault(); sendReply(); }}
                className="chat-input-bar rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 px-3 pt-2.5 pb-1.5 focus-within:border-neutral-300 dark:focus-within:border-neutral-700 transition-colors">
                {/* Canned Responses Dropdown */}
              <AnimatePresence>
                {cannedOpen && filteredCanned.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className="absolute bottom-[84px] left-2.5 right-2.5 z-10 max-h-48 overflow-y-auto rounded-xl border border-neutral-200/80 dark:border-neutral-800/80 shadow-xl bg-white dark:bg-neutral-900"
                  >
                    <div className="p-1.5">
                      <div className="flex items-center justify-between px-2 py-1">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-neutral-400">Quick Responses</span>
                        <button type="button" onClick={() => { setCannedOpen(false); setCannedManageOpen(true); }} className="text-[9px] text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 cursor-pointer flex items-center gap-1">
                          <Settings2 className="size-2.5" />Manage
                        </button>
                      </div>
                      {filteredCanned.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => selectCanned(c)}
                          className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer group"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 group-hover:bg-neutral-200 dark:group-hover:bg-neutral-700" style={{ color }}>
                              /{c.shortcut}
                            </span>
                          </div>
                          <p className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-0.5 truncate">{c.text}</p>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <input value={reply} onChange={handleReplyChange} onFocus={() => { setEmojiOpen(false); setAttachOpen(false); }}
                  placeholder={recording ? "Recording… tap ◼ to send" : "Type a reply (this takes over from AI)…"} disabled={sending || recording}
                  className="w-full bg-transparent text-xs focus:outline-none disabled:opacity-60 mb-1.5" />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-0.5">
                    <motion.button type="button" whileTap={{ scale: 0.85 }} onClick={() => { setCannedManageOpen(true); setCannedOpen(false); }} className="p-1.5 text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 rounded-full" aria-label="Canned responses" title="Manage quick responses (type / to use)"><Zap className="size-4.5" /></motion.button>
                    <motion.button type="button" whileTap={{ scale: 0.85 }} onClick={() => { setEmojiOpen((o) => !o); setAttachOpen(false); }} className="p-1.5 text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 rounded-full" aria-label="Emoji"><Smile className="size-4.5" /></motion.button>
                    <motion.button type="button" whileTap={{ scale: 0.85 }} onClick={() => { setAttachOpen((o) => !o); setEmojiOpen(false); }} className="p-1.5 text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 rounded-full group" aria-label="Attach file">
                      <Paperclip className="size-4.5 group-hover:animate-bounce transition-transform" />
                    </motion.button>
                    <button type="button" onClick={toggleRecord} className={`p-1.5 rounded-full ${recording ? "text-red-500 animate-pulse" : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"}`} aria-label="Record audio">
                      {recording ? <Square className="size-4.5 fill-current" /> : <Mic className="size-4.5" />}
                    </button>
                  </div>
                  <button type="submit" disabled={sending || !reply.trim()} style={{ background: color }}
                    className="size-8 rounded-lg flex items-center justify-center text-white disabled:opacity-40 shrink-0 hover:opacity-90 transition-opacity">
                    {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                  </button>
                </div>
              </form>
            </div>
          </>
        )}
      </div>

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[9999] flex items-center gap-3 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-850 rounded-xl px-4 py-3 shadow-2xl text-xs font-semibold text-neutral-855 dark:text-white animate-in slide-in-from-bottom-5 fade-in duration-300">
          {toast.type === "success" ? (
            <span className="flex size-5 items-center justify-center rounded-full bg-green-100 dark:bg-green-950/30 text-green-600 dark:text-green-400">
              <Check className="size-3.5" />
            </span>
          ) : (
            <span className="flex size-5 items-center justify-center rounded-full bg-red-100 dark:bg-red-950/30 text-red-600 dark:text-red-400">
              <AlertCircle className="size-3.5" />
            </span>
          )}
          <span className="max-w-[250px] truncate">{toast.message}</span>
          <button
            onClick={() => setToast(null)}
            className="ml-2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 cursor-pointer"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {/* Canned Responses Management Dialog */}
      {cannedManageOpen && (
        <div className="fixed inset-0 z-[9998] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 max-w-md w-full shadow-2xl text-neutral-900 dark:text-neutral-100">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-bold flex items-center gap-2"><Zap className="size-4" style={{ color }} />Quick Responses</h4>
              <button onClick={() => { setCannedManageOpen(false); setEditingCanned(null); setCannedDraftShortcut(""); setCannedDraftText(""); }} className="text-neutral-400 hover:text-neutral-600 cursor-pointer"><X className="size-4" /></button>
            </div>
            <p className="text-[10px] text-neutral-400 mb-3">Type <kbd className="px-1 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 font-mono text-[9px]">/shortcut</kbd> in the reply box to quickly insert a saved response. Use <kbd className="px-1 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 font-mono text-[9px]">{"{{visitor_name}}"}</kbd> for the visitor&apos;s name.</p>

            {/* Existing responses */}
            <div className="space-y-1.5 max-h-40 overflow-y-auto mb-3">
              {cannedResponses.length === 0 && <p className="text-[10px] text-neutral-400 text-center py-3">No quick responses yet. Add one below!</p>}
              {cannedResponses.map((c) => (
                <div key={c.id} className="flex items-start gap-2 px-2 py-1.5 rounded-lg bg-neutral-50 dark:bg-neutral-950 group">
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] font-mono font-semibold" style={{ color }}>/{c.shortcut}</span>
                    <p className="text-[10px] text-neutral-500 truncate">{c.text}</p>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => { setEditingCanned(c); setCannedDraftShortcut(c.shortcut); setCannedDraftText(c.text); }} className="p-1 text-neutral-400 hover:text-neutral-600 cursor-pointer"><Pencil className="size-3" /></button>
                    <button onClick={() => deleteCanned(c.id)} className="p-1 text-neutral-400 hover:text-red-500 cursor-pointer"><Trash2 className="size-3" /></button>
                  </div>
                </div>
              ))}
            </div>

            {/* Add / Edit form */}
            <div className="border-t border-neutral-100 dark:border-neutral-850 pt-3 space-y-2">
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-[9px] font-semibold text-neutral-400 uppercase tracking-wider">Shortcut</label>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="text-xs text-neutral-400">/</span>
                    <input value={cannedDraftShortcut} onChange={(e) => setCannedDraftShortcut(e.target.value.replace(/\s/g, "-").toLowerCase())} placeholder="greeting" className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-md px-2 py-1 text-[10px] focus:outline-none" />
                  </div>
                </div>
              </div>
              <div>
                <label className="text-[9px] font-semibold text-neutral-400 uppercase tracking-wider">Response text</label>
                <textarea rows={2} value={cannedDraftText} onChange={(e) => setCannedDraftText(e.target.value)} placeholder="Hi {{visitor_name}}, how can I help you today?" className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-md px-2 py-1.5 text-[10px] resize-none focus:outline-none mt-0.5" />
              </div>
              <div className="flex justify-end gap-2">
                {editingCanned && <button onClick={() => { setEditingCanned(null); setCannedDraftShortcut(""); setCannedDraftText(""); }} className="text-[10px] text-neutral-400 hover:text-neutral-600 cursor-pointer px-2 py-1">Cancel</button>}
                <button onClick={addOrUpdateCanned} disabled={!cannedDraftShortcut.trim() || !cannedDraftText.trim()} className="text-[10px] font-semibold text-white rounded-lg px-3 py-1.5 cursor-pointer disabled:opacity-40 flex items-center gap-1" style={{ background: color }}>
                  {editingCanned ? <><Pencil className="size-3" />Update</> : <><Plus className="size-3" />Add</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Dialog */}
      {confirmModal && (
        <div className="fixed inset-0 z-[9998] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl text-neutral-900 dark:text-neutral-100">
            <h4 className="text-sm font-bold">{confirmModal.title}</h4>
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-relaxed">
              {confirmModal.message}
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="px-3 py-1.5 border border-neutral-200 dark:border-neutral-800 rounded-lg text-xs font-semibold hover:bg-neutral-50 dark:hover:bg-neutral-800 cursor-pointer text-neutral-700 dark:text-neutral-350"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const onConfirm = confirmModal.onConfirm;
                  setConfirmModal(null);
                  onConfirm();
                }}
                className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-semibold hover:opacity-90 cursor-pointer"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
