"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2,
  Send,
  RefreshCw,
  Inbox as InboxIcon,
  Bot,
  Headphones,
  Trash2,
  Paperclip,
  Smile,
  Mic,
  Square,
  X,
  Check,
  CheckCircle2,
  RotateCcw,
  AlertCircle,
  ArrowUp,
  ArrowDown,
  Minus,
  Clock,
  User,
  UserCheck,
  ShieldAlert,
  ChevronDown,
  Zap,
  Plus,
  Pencil,
  Settings2,
} from "lucide-react";
import { QuickEmojiPicker } from "@/components/quick-emoji-picker";
import { AttachMenu } from "@/components/attach-menu";
import { createClient } from "@/lib/supabase/client";
import { MessageList, type Msg } from "@/components/inbox-message-list";

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

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

async function audioBlobToWav(blob: Blob): Promise<Blob> {
  const AC: typeof AudioContext = (window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)!;
  const ctx = new AC();
  const audioBuf = await ctx.decodeAudioData(await blob.arrayBuffer());
  ctx.close();
  const len = audioBuf.length;
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

/* ── Helpdesk Engine Interfaces & Configurations ───────────────── */
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
  status?: "open" | "pending" | "resolved" | "closed";
  priority?: "urgent" | "high" | "normal" | "low";
  first_response_due_at?: string;
  first_responded_at?: string;
  resolution_due_at?: string;
  resolved_at?: string;
  sla_status?: "on_track" | "met" | "breached";
  escalation_reason?: string;
  tags?: string[];
}

interface Note {
  id: string;
  note: string;
  author_name?: string;
  author_email?: string;
  author_id?: string;
  created_at: string;
}

interface Assignee {
  email: string;
  name: string;
  role: string;
}

interface Props {
  botId: string;
  fetchBackend: (path: string, opts?: RequestInit) => Promise<Response>;
  formatDateTime: (s: string) => string;
  color?: string;
}

const PRIORITY_CONFIG = {
  urgent: {
    label: "Urgent",
    badge: "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/30 font-semibold",
    dot: "bg-red-500",
    icon: AlertCircle,
  },
  high: {
    label: "High",
    badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 font-semibold",
    dot: "bg-amber-500",
    icon: ArrowUp,
  },
  normal: {
    label: "Normal",
    badge: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/30 font-medium",
    dot: "bg-blue-500",
    icon: Minus,
  },
  low: {
    label: "Low",
    badge: "bg-neutral-500/10 text-neutral-600 dark:text-neutral-400 border border-neutral-500/30 font-medium",
    dot: "bg-neutral-400",
    icon: ArrowDown,
  },
} as const;

const STATUS_CONFIG = {
  open: {
    label: "Open",
    badge: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30",
    dot: "bg-emerald-500",
  },
  pending: {
    label: "Pending",
    badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30",
    dot: "bg-amber-500",
  },
  resolved: {
    label: "Resolved",
    badge: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/30",
    dot: "bg-purple-500",
  },
  closed: {
    label: "Closed",
    badge: "bg-neutral-500/10 text-neutral-600 dark:text-neutral-400 border border-neutral-500/30",
    dot: "bg-neutral-400",
  },
} as const;

function formatTimeRemaining(ms: number): string {
  const abs = Math.abs(ms);
  const minutes = Math.floor(abs / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  return `${minutes}m`;
}

interface SlaState {
  label: string;
  badge: string;
  isBreached: boolean;
}

function getSlaState(s: Session): SlaState | null {
  const status = s.status || "open";
  if (status === "resolved" || status === "closed") {
    if (s.sla_status === "breached") {
      return {
        label: "⚠️ SLA Breached",
        badge: "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 font-medium",
        isBreached: true,
      };
    }
    return {
      label: "✅ SLA Met",
      badge: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-medium",
      isBreached: false,
    };
  }

  const now = Date.now();

  // 1. First Response SLA
  if (!s.first_responded_at && s.first_response_due_at) {
    const due = new Date(s.first_response_due_at).getTime();
    const diff = due - now;
    if (diff < 0) {
      return {
        label: `🚨 Breached ${formatTimeRemaining(diff)} ago`,
        badge: "bg-red-500 text-white font-bold animate-pulse shadow-sm",
        isBreached: true,
      };
    }
    if (diff <= 5 * 60 * 1000) {
      return {
        label: `⚠️ ${formatTimeRemaining(diff)} left (Resp)`,
        badge: "bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold border border-amber-500/40",
        isBreached: false,
      };
    }
    return {
      label: `⏱️ ${formatTimeRemaining(diff)} left`,
      badge: "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700 font-medium",
      isBreached: false,
    };
  }

  // 2. Resolution SLA
  if (s.resolution_due_at) {
    const due = new Date(s.resolution_due_at).getTime();
    const diff = due - now;
    if (diff < 0) {
      return {
        label: `🚨 Breached ${formatTimeRemaining(diff)} ago (Res)`,
        badge: "bg-red-500 text-white font-bold animate-pulse shadow-sm",
        isBreached: true,
      };
    }
    if (diff <= 30 * 60 * 1000) {
      return {
        label: `⚠️ ${formatTimeRemaining(diff)} left (Res)`,
        badge: "bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold border border-amber-500/40",
        isBreached: false,
      };
    }
    return {
      label: `⏱️ ${formatTimeRemaining(diff)} left`,
      badge: "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700 font-medium",
      isBreached: false,
    };
  }

  return null;
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

  // ── Helpdesk Engine State ──
  const [selectedStatusTab, setSelectedStatusTab] = useState<"all" | "open" | "pending" | "resolved" | "closed">("open");
  const [selectedPriorityFilter, setSelectedPriorityFilter] = useState<string>("all");
  const [selectedAssigneeFilter, setSelectedAssigneeFilter] = useState<string>("all");
  const [statusPopoverOpen, setStatusPopoverOpen] = useState(false);
  const [priorityPopoverOpen, setPriorityPopoverOpen] = useState(false);
  const [assigneePopoverOpen, setAssigneePopoverOpen] = useState(false);

  // Assignees & Current Agent
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [currentUserEmail, setCurrentUserEmail] = useState<string>("");

  // Persistent Staff Notes
  const [sessionNotes, setSessionNotes] = useState<Note[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [viewMode, setViewMode] = useState<"chat" | "notes">("chat");

  // Search & Tags
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTagFilter, setSelectedTagFilter] = useState<string>("all");
  const [tagPopoverOpen, setTagPopoverOpen] = useState(false);
  const [tags, setTags] = useState<Record<string, string[]>>({});
  const PREDEFINED_TAGS = ["VIP", "Bug", "Billing", "Feature Request", "Urgent", "Lead"];

  // ── Canned Responses state ──
  const [cannedResponses, setCannedResponses] = useState<CannedResponse[]>([]);
  const [cannedOpen, setCannedOpen] = useState(false);
  const [cannedFilter, setCannedFilter] = useState("");
  const [cannedManageOpen, setCannedManageOpen] = useState(false);
  const [editingCanned, setEditingCanned] = useState<CannedResponse | null>(null);
  const [cannedDraftShortcut, setCannedDraftShortcut] = useState("");
  const [cannedDraftText, setCannedDraftText] = useState("");

  // Custom states for toast and confirm modal
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);

  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
  }, []);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // SLA Live Countdown Ticker (refreshes relative timestamps every 15s)
  const [, setSlaTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setSlaTick((t) => t + 1), 15000);
    return () => clearInterval(interval);
  }, []);

  // Fetch current authenticated user
  useEffect(() => {
    async function fetchUser() {
      try {
        const supabase = createClient();
        const { data } = await supabase.auth.getUser();
        if (data?.user?.email) setCurrentUserEmail(data.user.email);
      } catch {}
    }
    fetchUser();
  }, []);

  // Load canned responses on mount
  useEffect(() => {
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

  const current = sessions.find((s) => s.session_id === selected);

  const handleReplyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setReply(val);
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

  // ── Load Sessions, Messages, Notes, and Assignees ──
  const loadSessions = useCallback(async () => {
    setLoadingSessions(true);
    try {
      const res = await fetchBackend(`/api/admin/inbox?bot_id=${botId}`);
      if (res.ok) {
        const d = await res.json();
        setSessions(d.sessions || []);
      }
    } catch {} finally {
      setLoadingSessions(false);
    }
  }, [botId, fetchBackend]);

  const loadMessages = useCallback(async (sid: string) => {
    try {
      const res = await fetchBackend(`/api/admin/inbox/messages?bot_id=${botId}&session_id=${encodeURIComponent(sid)}`);
      if (res.ok) {
        const d = await res.json();
        setMessages(d.messages || []);
      }
    } catch {}
  }, [botId, fetchBackend]);

  const loadNotes = useCallback(async (sid: string) => {
    setLoadingNotes(true);
    try {
      const res = await fetchBackend(`/api/admin/inbox/notes?bot_id=${botId}&session_id=${encodeURIComponent(sid)}`);
      if (res.ok) {
        const d = await res.json();
        setSessionNotes(d.notes || []);
      }
    } catch {} finally {
      setLoadingNotes(false);
    }
  }, [botId, fetchBackend]);

  const loadAssignees = useCallback(async () => {
    try {
      const res = await fetchBackend(`/api/admin/inbox/assignees?bot_id=${botId}`);
      if (res.ok) {
        const d = await res.json();
        setAssignees(d.assignees || []);
      }
    } catch {}
  }, [botId, fetchBackend]);

  useEffect(() => {
    loadSessions();
    loadAssignees();
  }, [loadSessions, loadAssignees]);

  useEffect(() => {
    if (selected) {
      loadMessages(selected);
      loadNotes(selected);
    }
  }, [selected, loadMessages, loadNotes]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Live polling every 5s
  useEffect(() => {
    const id = setInterval(() => {
      loadSessions();
      if (selected) loadMessages(selected);
    }, 5000);
    return () => clearInterval(id);
  }, [selected, loadSessions, loadMessages]);

  // ── Session Update (Helpdesk Lifecycle Engine) ──
  const updateSession = useCallback(async (sid: string, patch: Partial<Session>) => {
    setSessions((prev) => prev.map((s) => (s.session_id === sid ? { ...s, ...patch } : s)));
    try {
      await fetchBackend("/api/admin/inbox/session", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bot_id: botId, session_id: sid, ...patch }),
      });
    } catch {
      showToast("Failed to sync changes with server.", "error");
    }
  }, [botId, fetchBackend, showToast]);

  const changeStatus = (sid: string, status: "open" | "pending" | "resolved" | "closed") => {
    const isDone = status === "resolved" || status === "closed";
    updateSession(sid, {
      status,
      resolved_at: isDone ? new Date().toISOString() : undefined,
      sla_status: isDone ? "met" : "on_track",
    });
    setStatusPopoverOpen(false);
    showToast(`Ticket status changed to ${status}.`, "success");
  };

  const changePriority = (sid: string, priority: "urgent" | "high" | "normal" | "low") => {
    updateSession(sid, { priority });
    setPriorityPopoverOpen(false);
    showToast(`Priority updated to ${priority}.`, "success");
  };

  const assignSession = (sid: string, agentEmail: string | null, agentName?: string | null) => {
    updateSession(sid, {
      assigned_agent_email: agentEmail || undefined,
      assigned_agent_name: agentName || (agentEmail ? capitalize(agentEmail.split("@")[0]) : undefined),
      ai_paused: !!agentEmail,
    });
    setAssigneePopoverOpen(false);
    showToast(agentEmail ? `Assigned to ${agentName || agentEmail}.` : "Ticket unassigned.", "success");
  };

  const dismissEscalation = (sid: string) => {
    updateSession(sid, { needs_attention: false, escalation_reason: undefined, ai_paused: false });
    showToast("Escalation resolved. Returned ticket to AI assistant.", "success");
  };

  const toggleTag = (sid: string, tag: string) => {
    const target = sessions.find((s) => s.session_id === sid);
    const curTags = target?.tags || tags[sid] || [];
    const newTags = curTags.includes(tag) ? curTags.filter((t) => t !== tag) : [...curTags, tag];
    setTags((prev) => ({ ...prev, [sid]: newTags }));
    updateSession(sid, { tags: newTags });
  };

  // ── Staff Notes Operations ──
  const addNote = async () => {
    if (!noteDraft.trim() || !selected) return;
    const text = noteDraft.trim();
    setNoteDraft("");
    try {
      const res = await fetchBackend("/api/admin/inbox/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bot_id: botId, session_id: selected, note: text }),
      });
      if (res.ok) {
        const d = await res.json();
        setSessionNotes((prev) => [...prev, d.note]);
        showToast("Internal staff note added.", "success");
      }
    } catch {
      showToast("Failed to save note.", "error");
    }
  };

  const deleteNote = async (noteId: string) => {
    setSessionNotes((prev) => prev.filter((n) => n.id !== noteId));
    try {
      await fetchBackend(`/api/admin/inbox/notes/${noteId}?bot_id=${botId}`, {
        method: "DELETE",
      });
      showToast("Note deleted.", "success");
    } catch {
      showToast("Failed to delete note.", "error");
    }
  };

  // ── Conversation Reply and Actions ──
  const setFeedback = useCallback(async (messageId: string, rating: "up" | "down" | null, correction?: string) => {
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
  }, [fetchBackend, botId, showToast]);

  const sendReply = async () => {
    if (!reply.trim() || !selected) return;
    setSending(true);
    const text = reply;
    setReply("");
    setMessages((p) => [...p, { role: "assistant", content: text, sender: "human" }]);
    try {
      await fetchBackend("/api/admin/inbox/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bot_id: botId, session_id: selected, text }),
      });
      loadSessions();
    } catch {} finally {
      setSending(false);
    }
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
      title: "Delete Ticket / Conversation",
      message: "Are you sure you want to delete this conversation and ticket history? This action cannot be undone.",
      onConfirm: async () => {
        setSessions((p) => p.filter((s) => s.session_id !== sid));
        if (selected === sid) { setSelected(null); setMessages([]); }
        try {
          await fetchBackend("/api/admin/inbox/delete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ bot_id: botId, session_id: sid }),
          });
          showToast("Ticket deleted successfully.", "success");
        } catch {}
      }
    });
  };

  const toggleAI = async (paused: boolean) => {
    if (!selected) return;
    updateSession(selected, { ai_paused: paused });
    try {
      await fetchBackend("/api/admin/inbox/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bot_id: botId, session_id: selected, ai_paused: paused }),
      });
    } catch {}
  };

  // ── Ticket Counters & Filtering ──
  const ticketCounts = {
    all: sessions.length,
    open: sessions.filter((s) => (s.status || "open") === "open").length,
    pending: sessions.filter((s) => s.status === "pending").length,
    resolved: sessions.filter((s) => s.status === "resolved").length,
    closed: sessions.filter((s) => s.status === "closed").length,
  };

  const filteredSessions = sessions.filter((s) => {
    const sStatus = s.status || "open";
    if (selectedStatusTab !== "all" && sStatus !== selectedStatusTab) {
      return false;
    }

    const sPriority = s.priority || "normal";
    if (selectedPriorityFilter !== "all" && sPriority !== selectedPriorityFilter) {
      return false;
    }

    if (selectedAssigneeFilter === "me") {
      if (!currentUserEmail || s.assigned_agent_email?.toLowerCase() !== currentUserEmail.toLowerCase()) {
        return false;
      }
    } else if (selectedAssigneeFilter === "unassigned") {
      if (s.assigned_agent_email) return false;
    }

    const sessionTags = s.tags || tags[s.session_id] || [];
    if (selectedTagFilter !== "all" && !sessionTags.includes(selectedTagFilter)) {
      return false;
    }

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

  const isAssignedToOther = Boolean(
    current?.assigned_agent_email &&
    currentUserEmail &&
    current.assigned_agent_email.toLowerCase() !== currentUserEmail.toLowerCase()
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      {/* ── Sessions / Tickets List Pane ── */}
      <div className="lg:col-span-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden flex flex-col max-h-[640px]">
        {/* Ticket Lifecycle Status Tabs */}
        <div className="flex border-b border-neutral-100 dark:border-neutral-850 bg-neutral-50/50 dark:bg-neutral-950/40 text-[11px] font-semibold select-none">
          {[
            { key: "all", label: "All", count: ticketCounts.all },
            { key: "open", label: "Open", count: ticketCounts.open, dot: "bg-emerald-500" },
            { key: "pending", label: "Pending", count: ticketCounts.pending, dot: "bg-amber-500" },
            { key: "resolved", label: "Resolved", count: ticketCounts.resolved, dot: "bg-purple-500" },
            { key: "closed", label: "Closed", count: ticketCounts.closed, dot: "bg-neutral-400" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setSelectedStatusTab(tab.key as any)}
              className={`flex-1 py-2 px-1 flex items-center justify-center gap-1 border-b-2 transition-all cursor-pointer ${
                selectedStatusTab === tab.key
                  ? "border-[#f97316] text-neutral-900 dark:text-neutral-100 font-bold bg-white dark:bg-neutral-900"
                  : "border-transparent text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
              }`}
            >
              {tab.dot && <span className={`size-1.5 rounded-full shrink-0 ${tab.dot}`} />}
              <span className="truncate">{tab.label}</span>
              <span className={`text-[9px] px-1 py-0.2 rounded-full font-mono shrink-0 ${
                selectedStatusTab === tab.key
                  ? "bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 font-bold"
                  : "bg-neutral-200/50 dark:bg-neutral-800/40 text-neutral-400"
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Filter Controls & Search */}
        <div className="p-2.5 border-b border-neutral-100 dark:border-neutral-850 space-y-2 bg-white dark:bg-neutral-900">
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search visitor, message, ticket..."
              className="flex-1 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-2.5 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-[#f97316]/50"
            />
            <button
              onClick={loadSessions}
              title="Refresh tickets"
              className="p-1.5 border border-neutral-200 dark:border-neutral-800 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 cursor-pointer"
            >
              <RefreshCw className={`size-3.5 ${loadingSessions ? "animate-spin" : ""}`} />
            </button>
          </div>

          {/* Secondary Filters: Priority & Assignee */}
          <div className="flex items-center justify-between gap-1.5 text-[10px]">
            {/* Priority Filter */}
            <select
              value={selectedPriorityFilter}
              onChange={(e) => setSelectedPriorityFilter(e.target.value)}
              className="bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-md px-1.5 py-0.5 text-neutral-600 dark:text-neutral-300 focus:outline-none cursor-pointer"
            >
              <option value="all">All Priorities</option>
              <option value="urgent">🔥 Urgent</option>
              <option value="high">🔺 High</option>
              <option value="normal">🔹 Normal</option>
              <option value="low">🔻 Low</option>
            </select>

            {/* Assignee Filter */}
            <select
              value={selectedAssigneeFilter}
              onChange={(e) => setSelectedAssigneeFilter(e.target.value)}
              className="bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-md px-1.5 py-0.5 text-neutral-600 dark:text-neutral-300 focus:outline-none cursor-pointer"
            >
              <option value="all">All Assignees</option>
              <option value="me">Assigned to Me</option>
              <option value="unassigned">Unassigned</option>
            </select>

            {/* Tag Filter Dropdown */}
            <select
              value={selectedTagFilter}
              onChange={(e) => setSelectedTagFilter(e.target.value)}
              className="bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-md px-1.5 py-0.5 text-neutral-600 dark:text-neutral-300 focus:outline-none cursor-pointer"
            >
              <option value="all">All Tags</option>
              {PREDEFINED_TAGS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Ticket List Items */}
        <div className="overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-850 flex-1">
          {filteredSessions.length === 0 ? (
            <div className="p-8 text-center">
              <InboxIcon className="size-7 text-neutral-300 mx-auto" />
              <p className="text-xs text-neutral-400 mt-2">No tickets matching this view</p>
            </div>
          ) : (
            filteredSessions.map((s) => {
              const sessionTags = s.tags || tags[s.session_id] || [];
              const priorityKey = (s.priority || "normal") as keyof typeof PRIORITY_CONFIG;
              const pConfig = PRIORITY_CONFIG[priorityKey] || PRIORITY_CONFIG.normal;
              const PriorityIcon = pConfig.icon;
              const sla = getSlaState(s);

              return (
                <div
                  key={s.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelected(s.session_id)}
                  className={`group w-full text-left p-3 transition-colors cursor-pointer ${
                    selected === s.session_id
                      ? "bg-[#f97316]/5 border-l-3 border-l-[#f97316]"
                      : s.needs_attention
                      ? "bg-red-50/60 dark:bg-red-950/20 border-l-3 border-l-red-500"
                      : "hover:bg-neutral-50 dark:hover:bg-neutral-850/40 border-l-3 border-l-transparent"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold truncate flex items-center gap-1.5">
                      {s.needs_attention && <span className="size-2 rounded-full bg-red-500 animate-ping shrink-0" />}
                      {s.visitor_name || `Visitor ${s.session_id.slice(-5)}`}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      {s.needs_attention ? (
                        <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 dark:bg-red-950/60 dark:text-red-300 flex items-center gap-1">
                          <Headphones className="size-2.5" />Escalated
                        </span>
                      ) : s.ai_paused ? (
                        <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-300 flex items-center gap-1">
                          <Headphones className="size-2.5" />Live
                        </span>
                      ) : (
                        <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-green-50 text-green-600 dark:bg-green-950/40 dark:text-green-300 flex items-center gap-1">
                          <Bot className="size-2.5" />AI
                        </span>
                      )}
                      <button
                        onClick={(e) => deleteSession(s.session_id, e)}
                        aria-label="Delete ticket"
                        className="opacity-0 group-hover:opacity-100 text-neutral-400 hover:text-red-500 transition-opacity p-0.5 cursor-pointer ml-1"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>

                  <p className="text-[10px] text-neutral-400 truncate mt-0.5">
                    {s.last_message || "…"}
                  </p>

                  {/* Badges Row: Priority, SLA, Assignee, Tags */}
                  <div className="flex flex-wrap items-center gap-1 mt-2">
                    {/* Priority Badge */}
                    <span className={`text-[8px] px-1.5 py-0.2 rounded-md flex items-center gap-0.5 ${pConfig.badge}`}>
                      <PriorityIcon className="size-2.5" />
                      <span>{pConfig.label}</span>
                    </span>

                    {/* SLA Status Pill */}
                    {sla && (
                      <span className={`text-[8px] px-1.5 py-0.2 rounded-md ${sla.badge}`}>
                        {sla.label}
                      </span>
                    )}

                    {/* Assignee Badge */}
                    {s.assigned_agent_name && (
                      <span className="text-[8px] font-medium px-1.5 py-0.2 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700 flex items-center gap-1">
                        <User className="size-2.5" />
                        <span className="truncate max-w-16">{s.assigned_agent_name}</span>
                      </span>
                    )}

                    {/* Tags */}
                    {sessionTags.slice(0, 2).map((t) => (
                      <span
                        key={t}
                        className="text-[8px] font-semibold px-1.5 py-0.2 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 border border-neutral-200/50 dark:border-neutral-800"
                      >
                        {t}
                      </span>
                    ))}
                    {sessionTags.length > 2 && (
                      <span className="text-[8px] text-neutral-400">+{sessionTags.length - 2}</span>
                    )}
                  </div>

                  {s.last_message_at && (
                    <p className="text-[9px] text-neutral-300 dark:text-neutral-600 mt-1">
                      {formatDateTime(s.last_message_at)}
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── Ticket Detail & Workspace Pane ── */}
      <div className="lg:col-span-8 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden flex flex-col max-h-[640px]">
        {!selected ? (
          <div className="flex-1 flex flex-col items-center justify-center text-xs text-neutral-400 p-8 space-y-2">
            <InboxIcon className="size-10 text-neutral-300 stroke-1" />
            <p>Select a ticket from the inbox to review transcript and reply</p>
          </div>
        ) : (
          <>
            {/* Ticket Header Bar */}
            <div className="p-3 border-b border-neutral-100 dark:border-neutral-850 flex items-center justify-between flex-wrap gap-2 bg-neutral-50/40 dark:bg-neutral-950/20">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-neutral-900 dark:text-neutral-100 truncate max-w-40">
                  {current?.visitor_name || `Visitor ${selected.slice(-5)}`}
                </span>
                <span className="text-[10px] font-mono font-semibold text-neutral-400">
                  #{selected.slice(-6).toUpperCase()}
                </span>

                {/* Status Switcher Popover */}
                <div className="relative">
                  <button
                    onClick={() => {
                      setStatusPopoverOpen(!statusPopoverOpen);
                      setPriorityPopoverOpen(false);
                      setAssigneePopoverOpen(false);
                      setTagPopoverOpen(false);
                    }}
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-lg flex items-center gap-1 border cursor-pointer ${
                      STATUS_CONFIG[(current?.status || "open") as keyof typeof STATUS_CONFIG]?.badge
                    }`}
                  >
                    <span className={`size-1.5 rounded-full ${STATUS_CONFIG[(current?.status || "open") as keyof typeof STATUS_CONFIG]?.dot}`} />
                    <span>{STATUS_CONFIG[(current?.status || "open") as keyof typeof STATUS_CONFIG]?.label}</span>
                    <ChevronDown className="size-2.5 ml-0.5 opacity-60" />
                  </button>

                  {statusPopoverOpen && (
                    <div className="absolute top-8 left-0 z-30 w-36 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-xl p-1.5 space-y-1">
                      {(["open", "pending", "resolved", "closed"] as const).map((st) => (
                        <button
                          key={st}
                          onClick={() => changeStatus(selected, st)}
                          className={`w-full text-left px-2 py-1 rounded-lg text-[10px] font-semibold flex items-center justify-between cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 ${
                            (current?.status || "open") === st ? "text-[#f97316]" : "text-neutral-700 dark:text-neutral-300"
                          }`}
                        >
                          <span className="flex items-center gap-1.5">
                            <span className={`size-1.5 rounded-full ${STATUS_CONFIG[st].dot}`} />
                            <span>{STATUS_CONFIG[st].label}</span>
                          </span>
                          {(current?.status || "open") === st && <Check className="size-3" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Priority Switcher Popover */}
                <div className="relative">
                  <button
                    onClick={() => {
                      setPriorityPopoverOpen(!priorityPopoverOpen);
                      setStatusPopoverOpen(false);
                      setAssigneePopoverOpen(false);
                      setTagPopoverOpen(false);
                    }}
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-lg flex items-center gap-1 border cursor-pointer ${
                      PRIORITY_CONFIG[(current?.priority || "normal") as keyof typeof PRIORITY_CONFIG]?.badge
                    }`}
                  >
                    <span>{PRIORITY_CONFIG[(current?.priority || "normal") as keyof typeof PRIORITY_CONFIG]?.label}</span>
                    <ChevronDown className="size-2.5 ml-0.5 opacity-60" />
                  </button>

                  {priorityPopoverOpen && (
                    <div className="absolute top-8 left-0 z-30 w-32 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-xl p-1.5 space-y-1">
                      {(["urgent", "high", "normal", "low"] as const).map((p) => {
                        const Icon = PRIORITY_CONFIG[p].icon;
                        return (
                          <button
                            key={p}
                            onClick={() => changePriority(selected, p)}
                            className={`w-full text-left px-2 py-1 rounded-lg text-[10px] font-semibold flex items-center justify-between cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 ${
                              (current?.priority || "normal") === p ? "text-[#f97316]" : "text-neutral-700 dark:text-neutral-300"
                            }`}
                          >
                            <span className="flex items-center gap-1.5">
                              <Icon className="size-3" />
                              <span>{PRIORITY_CONFIG[p].label}</span>
                            </span>
                            {(current?.priority || "normal") === p && <Check className="size-3" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Assignee Switcher Popover */}
                <div className="relative">
                  <button
                    onClick={() => {
                      setAssigneePopoverOpen(!assigneePopoverOpen);
                      setStatusPopoverOpen(false);
                      setPriorityPopoverOpen(false);
                      setTagPopoverOpen(false);
                    }}
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-lg flex items-center gap-1 border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer text-neutral-700 dark:text-neutral-300"
                  >
                    <User className="size-2.5" />
                    <span>{current?.assigned_agent_name || "Unassigned"}</span>
                    <ChevronDown className="size-2.5 ml-0.5 opacity-60" />
                  </button>

                  {assigneePopoverOpen && (
                    <div className="absolute top-8 left-0 z-30 w-48 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-xl p-2 space-y-1">
                      <div className="text-[9px] font-bold uppercase tracking-wider text-neutral-400 px-1 pb-1 border-b border-neutral-100 dark:border-neutral-800">
                        Assign Ticket
                      </div>
                      {currentUserEmail && (
                        <button
                          onClick={() => assignSession(selected, currentUserEmail, capitalize(currentUserEmail.split("@")[0]))}
                          className="w-full text-left px-2 py-1 rounded-lg text-[10px] font-semibold hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center justify-between cursor-pointer text-[#f97316]"
                        >
                          <span className="flex items-center gap-1.5"><UserCheck className="size-3" />Assign to Me</span>
                          {current?.assigned_agent_email?.toLowerCase() === currentUserEmail.toLowerCase() && <Check className="size-3" />}
                        </button>
                      )}
                      {assignees.map((a) => (
                        <button
                          key={a.email}
                          onClick={() => assignSession(selected, a.email, a.name)}
                          className="w-full text-left px-2 py-1 rounded-lg text-[10px] hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center justify-between cursor-pointer"
                        >
                          <div className="truncate">
                            <p className="font-semibold text-neutral-800 dark:text-neutral-200">{a.name}</p>
                            <p className="text-[8px] text-neutral-400">{a.email}</p>
                          </div>
                          {current?.assigned_agent_email?.toLowerCase() === a.email.toLowerCase() && <Check className="size-3 text-[#f97316]" />}
                        </button>
                      ))}
                      <div className="pt-1 border-t border-neutral-100 dark:border-neutral-800">
                        <button
                          onClick={() => assignSession(selected, null)}
                          className="w-full text-left px-2 py-1 rounded-lg text-[10px] text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 cursor-pointer"
                        >
                          Unassign Ticket
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* SLA Clock Pill */}
                {current && getSlaState(current) && (
                  <span className={`text-[9px] px-2 py-0.5 rounded-lg ${getSlaState(current)!.badge}`}>
                    {getSlaState(current)!.label}
                  </span>
                )}
              </div>

              {/* Right Controls: Quick Resolve, Tags, ViewMode, AI */}
              <div className="flex items-center gap-1.5">
                {/* 1-Click Resolve / Reopen Action */}
                {(current?.status === "resolved" || current?.status === "closed") ? (
                  <button
                    onClick={() => changeStatus(selected, "open")}
                    className="text-[10px] font-semibold border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800 px-2.5 py-1 rounded-lg flex items-center gap-1 text-neutral-700 dark:text-neutral-300 cursor-pointer"
                  >
                    <RotateCcw className="size-3" />
                    <span>Reopen</span>
                  </button>
                ) : (
                  <button
                    onClick={() => changeStatus(selected, "resolved")}
                    className="text-[10px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 rounded-lg flex items-center gap-1 shadow-sm cursor-pointer"
                  >
                    <CheckCircle2 className="size-3" />
                    <span>Resolve</span>
                  </button>
                )}

                {/* Tags Popover Trigger */}
                <div className="relative">
                  <button
                    onClick={() => {
                      setTagPopoverOpen(!tagPopoverOpen);
                      setStatusPopoverOpen(false);
                      setPriorityPopoverOpen(false);
                      setAssigneePopoverOpen(false);
                    }}
                    className="text-[10px] font-semibold border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-850 px-2 py-1 rounded-lg flex items-center gap-1 cursor-pointer"
                  >
                    🏷️ Tags
                  </button>
                  {tagPopoverOpen && (
                    <div className="absolute top-8 right-0 z-30 w-44 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-xl p-2 space-y-1">
                      <div className="flex justify-between items-center px-1 pb-1 border-b border-neutral-100 dark:border-neutral-800">
                        <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider">Ticket Tags</span>
                        <button onClick={() => setTagPopoverOpen(false)} className="text-[10px] text-neutral-400 hover:text-neutral-600">&times;</button>
                      </div>
                      <div className="py-1 space-y-0.5 max-h-48 overflow-y-auto">
                        {PREDEFINED_TAGS.map((t) => {
                          const hasTag = (current?.tags || tags[selected] || []).includes(t);
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

                {/* View Mode Toggle (Chat / Staff Notes) */}
                <div className="flex bg-neutral-100 dark:bg-neutral-850 p-0.5 rounded-lg text-[9px] font-semibold">
                  <button
                    onClick={() => setViewMode("chat")}
                    className={`px-2 py-1 rounded-md transition-colors cursor-pointer ${
                      viewMode === "chat"
                        ? "bg-white dark:bg-neutral-800 shadow text-neutral-900 dark:text-neutral-100"
                        : "text-neutral-450 hover:text-neutral-600"
                    }`}
                  >
                    Chat
                  </button>
                  <button
                    onClick={() => setViewMode("notes")}
                    className={`px-2 py-1 rounded-md transition-colors cursor-pointer flex items-center gap-1 ${
                      viewMode === "notes"
                        ? "bg-white dark:bg-neutral-800 shadow text-neutral-900 dark:text-neutral-100"
                        : "text-neutral-450 hover:text-neutral-600"
                    }`}
                  >
                    <span>Notes</span>
                    <span className="text-[8px] px-1 rounded-full bg-neutral-200 dark:bg-neutral-700 font-mono">
                      {sessionNotes.length}
                    </span>
                  </button>
                </div>

                {/* AI Toggle */}
                <button
                  onClick={() => toggleAI(!current?.ai_paused)}
                  className={`text-[10px] font-semibold px-2.5 py-1 rounded-lg cursor-pointer flex items-center gap-1 ${
                    current?.ai_paused
                      ? "bg-[#f97316] text-white"
                      : "border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-300"
                  }`}
                >
                  {current?.ai_paused ? <><Headphones className="size-3" />Live</> : <><Bot className="size-3" />AI</>}
                </button>
              </div>
            </div>

            {/* Smart Escalation Notice Banner */}
            {current?.needs_attention && (
              <div className="bg-red-500/10 border-b border-red-500/20 px-3.5 py-2 flex items-center justify-between text-xs text-red-800 dark:text-red-300 shrink-0">
                <div className="flex items-center gap-2">
                  <AlertCircle className="size-4 text-red-600 dark:text-red-400 animate-pulse shrink-0" />
                  <span>
                    <strong>Escalation:</strong> {current.escalation_reason || "Customer requested human support takeover."}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => dismissEscalation(selected)}
                    className="text-[9px] font-bold border border-red-500/30 hover:bg-red-500/20 px-2 py-0.5 rounded transition-colors cursor-pointer text-red-900 dark:text-red-200"
                  >
                    Return to AI
                  </button>
                </div>
              </div>
            )}

            {/* Agent Collision Awareness Banner */}
            {isAssignedToOther && (
              <div className="bg-amber-500/10 border-b border-amber-500/20 px-3.5 py-2 flex items-center justify-between text-xs text-amber-800 dark:text-amber-300 shrink-0">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="size-4 text-amber-600 shrink-0" />
                  <span>
                    <strong>Agent Collision Notice:</strong> Assigned to {current?.assigned_agent_name || current?.assigned_agent_email}.
                  </span>
                </div>
                <button
                  onClick={() => assignSession(selected, currentUserEmail, capitalize(currentUserEmail.split("@")[0]))}
                  className="text-[9px] font-bold bg-amber-500/20 hover:bg-amber-500/30 text-amber-900 dark:text-amber-100 px-2.5 py-0.5 rounded transition-colors cursor-pointer"
                >
                  Take Over Ticket
                </button>
              </div>
            )}

            {/* Main Content Pane: Notes or Chat */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 text-xs">
              {viewMode === "notes" ? (
                /* Multi-Agent Persistent Notes View */
                <div className="flex flex-col h-full justify-between gap-4">
                  <div className="space-y-2.5 overflow-y-auto flex-1 min-h-[220px] max-h-[380px]">
                    {loadingNotes ? (
                      <div className="flex items-center justify-center h-48 text-neutral-400">
                        <Loader2 className="size-5 animate-spin mr-2" />
                        <span>Loading staff notes...</span>
                      </div>
                    ) : sessionNotes.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-48 text-neutral-400">
                        <Zap className="size-8 text-neutral-300 mb-2" />
                        <p className="text-[11px] text-center font-medium">
                          No internal notes yet.<br />
                          Add private context below visible to other support agents.
                        </p>
                      </div>
                    ) : (
                      sessionNotes.map((n) => (
                        <div
                          key={n.id}
                          className="bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 rounded-xl p-3 relative group"
                        >
                          <div className="flex items-center justify-between text-[9px] font-semibold text-neutral-400 dark:text-neutral-500 mb-1">
                            <span className="text-amber-900 dark:text-amber-200 font-bold flex items-center gap-1">
                              <User className="size-2.5" />
                              {n.author_name || n.author_email || "Support Agent"}
                            </span>
                            <span>{formatDateTime(n.created_at)}</span>
                          </div>
                          <p className="text-neutral-800 dark:text-neutral-200 text-[11px] whitespace-pre-wrap leading-relaxed">
                            {n.note}
                          </p>
                          <button
                            onClick={() => deleteNote(n.id)}
                            title="Delete note"
                            className="absolute bottom-2.5 right-2.5 opacity-0 group-hover:opacity-100 transition-opacity text-neutral-400 hover:text-red-500 cursor-pointer"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Add Note Input */}
                  <div className="border-t border-neutral-100 dark:border-neutral-850 pt-3 space-y-2 mt-auto">
                    <textarea
                      rows={3}
                      value={noteDraft}
                      onChange={(e) => setNoteDraft(e.target.value)}
                      placeholder="Add an internal staff note (stored securely in database, only visible to team)..."
                      className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-3 py-2 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-[#f97316]/50"
                    />
                    <div className="flex justify-end">
                      <button
                        onClick={addNote}
                        disabled={!noteDraft.trim()}
                        className="px-3 py-1.5 text-xs font-semibold text-white rounded-lg cursor-pointer disabled:opacity-40 shadow-sm"
                        style={{ background: color }}
                      >
                        Add staff note
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                /* Chat Transcript View */
                <MessageList
                  messages={messages}
                  color={color}
                  visitorName={current?.visitor_name || `Visitor ${selected ? selected.slice(-5) : ""}`}
                  correctingId={correctingId}
                  correctionDraft={correctionDraft}
                  setCorrectingId={setCorrectingId}
                  setCorrectionDraft={setCorrectionDraft}
                  setFeedback={setFeedback}
                  endRef={endRef}
                />
              )}
            </div>

            {/* Reply Input Bar */}
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
              <form
                onSubmit={(e) => { e.preventDefault(); sendReply(); }}
                className="chat-input-bar rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 px-3 pt-2.5 pb-1.5 focus-within:border-neutral-300 dark:focus-within:border-neutral-700 transition-colors"
              >
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
                          <button
                            type="button"
                            onClick={() => { setCannedOpen(false); setCannedManageOpen(true); }}
                            className="text-[9px] text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 cursor-pointer flex items-center gap-1"
                          >
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
                <input
                  value={reply}
                  onChange={handleReplyChange}
                  onFocus={() => { setEmojiOpen(false); setAttachOpen(false); }}
                  placeholder={recording ? "Recording… tap ◼ to send" : "Type a reply (this takes over ticket from AI)…"}
                  disabled={sending || recording}
                  className="w-full bg-transparent text-xs focus:outline-none disabled:opacity-60 mb-1.5"
                />
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
                  <button
                    type="submit"
                    disabled={sending || !reply.trim()}
                    style={{ background: color }}
                    className="size-8 rounded-lg flex items-center justify-center text-white disabled:opacity-40 shrink-0 hover:opacity-90 transition-opacity"
                  >
                    {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                  </button>
                </div>
              </form>
            </div>
          </>
        )}
      </div>

      {/* ── Toast Notification ── */}
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

      {/* ── Canned Responses Management Dialog ── */}
      {cannedManageOpen && (
        <div className="fixed inset-0 z-[9998] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 max-w-md w-full shadow-2xl text-neutral-900 dark:text-neutral-100">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-bold flex items-center gap-2"><Zap className="size-4" style={{ color }} />Quick Responses</h4>
              <button onClick={() => { setCannedManageOpen(false); setEditingCanned(null); setCannedDraftShortcut(""); setCannedDraftText(""); }} className="text-neutral-400 hover:text-neutral-600 cursor-pointer"><X className="size-4" /></button>
            </div>
            <p className="text-[10px] text-neutral-400 mb-3">Type <kbd className="px-1 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 font-mono text-[9px]">/shortcut</kbd> in the reply box to quickly insert a saved response. Use <kbd className="px-1 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 font-mono text-[9px]">{"{{visitor_name}}"}</kbd> for the visitor&apos;s name.</p>

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

      {/* ── Confirm Dialog ── */}
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
