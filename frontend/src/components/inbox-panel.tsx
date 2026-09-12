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
  BookOpen,
  Search,
  Link2,
  ExternalLink,
  Users,
  Radio,
  Mail,
  Tag,
  MessageSquare,
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

type InboxStatusTab = "all" | "unassigned" | "open" | "pending" | "resolved" | "closed";

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
  channel?: "web" | "email" | "slack" | "whatsapp";
  subject?: string;
  visitor_email?: string;
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

const PRESENCE_STATUS_CONFIG = {
  online: { label: "Online", dot: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/30" },
  away: { label: "Away", dot: "bg-amber-500", text: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10 border-amber-500/30" },
  busy: { label: "Busy", dot: "bg-red-500", text: "text-red-600 dark:text-red-400", bg: "bg-red-500/10 border-red-500/30" },
  offline: { label: "Offline", dot: "bg-neutral-400", text: "text-neutral-500 dark:text-neutral-400", bg: "bg-neutral-500/10 border-neutral-500/30" },
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

interface FilterOption<T extends string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
}

function ModernFilterDropdown<T extends string>({
  value,
  onChange,
  options,
  title,
  align = "left",
}: {
  value: T;
  onChange: (v: T) => void;
  options: FilterOption<T>[];
  title?: string;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: Event) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
      document.addEventListener("keydown", onKey);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
        document.removeEventListener("touchstart", handleClickOutside);
        document.removeEventListener("keydown", onKey);
      };
    }
  }, [open]);

  const selectedOpt = options.find((o) => o.value === value) || options[0];

  return (
    <div ref={ref} className={`relative inline-block text-left shrink-0 ${open ? "z-50" : "z-10"}`}>
      <button
        type="button"
        title={title}
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-neutral-50 hover:bg-neutral-100 dark:bg-neutral-950 dark:hover:bg-neutral-850 border border-neutral-200/90 dark:border-neutral-800 rounded-lg text-neutral-700 dark:text-neutral-300 transition-colors text-[10px] font-semibold cursor-pointer shadow-xs focus:outline-none focus:ring-1 focus:ring-[#f97316]/40 whitespace-nowrap"
      >
        {selectedOpt?.icon}
        <span className="whitespace-nowrap font-medium">{selectedOpt?.label}</span>
        <ChevronDown className={`size-3 text-neutral-400 transition-transform duration-150 shrink-0 ${open ? "rotate-180 text-neutral-700 dark:text-neutral-200" : ""}`} />
      </button>

      {open && (
        <div className={`absolute top-full mt-1.5 ${align === "right" ? "right-0" : "left-0"} z-[9999] min-w-[145px] w-max max-w-[260px] max-h-56 overflow-y-auto bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-2xl p-1 space-y-0.5 animate-in fade-in zoom-in-95 duration-100`}>
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between gap-3 transition-colors cursor-pointer whitespace-nowrap ${
                  isSelected
                    ? "bg-[#f97316]/10 text-[#f97316] font-bold"
                    : "text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                }`}
              >
                <span className="flex items-center gap-2 whitespace-nowrap">
                  {opt.icon}
                  <span className="whitespace-nowrap">{opt.label}</span>
                </span>
                {isSelected && <Check className="size-3 text-[#f97316] shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
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
  const [selectedStatusTab, setSelectedStatusTab] = useState<InboxStatusTab>("open");
  const [selectedPriorityFilter, setSelectedPriorityFilter] = useState<string>("all");
  const [selectedAssigneeFilter, setSelectedAssigneeFilter] = useState<string>("all");
  const [selectedChannelFilter, setSelectedChannelFilter] = useState<string>("all");
  const [statusPopoverOpen, setStatusPopoverOpen] = useState(false);
  const [priorityPopoverOpen, setPriorityPopoverOpen] = useState(false);
  const [assigneePopoverOpen, setAssigneePopoverOpen] = useState(false);

  // ── Omnichannel Routing & Presence State (Pillar 3) ──
  const [myPresence, setMyPresence] = useState<{
    status: "online" | "away" | "busy" | "offline";
    max_capacity: number;
    active_tickets_count: number;
  }>({
    status: "online",
    max_capacity: 5,
    active_tickets_count: 0,
  });
  const [teamPresence, setTeamPresence] = useState<Array<{
    agent_email: string;
    agent_name: string;
    status: "online" | "away" | "busy" | "offline";
    max_capacity: number;
    active_tickets_count: number;
  }>>([]);
  const [presenceMenuOpen, setPresenceMenuOpen] = useState(false);
  const [dispatchingQueue, setDispatchingQueue] = useState(false);
  const [showRoster, setShowRoster] = useState(false);

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
  const statusPopoverRef = useRef<HTMLDivElement>(null);
  const priorityPopoverRef = useRef<HTMLDivElement>(null);
  const assigneePopoverRef = useRef<HTMLDivElement>(null);
  const tagPopoverRef = useRef<HTMLDivElement>(null);
  const presenceMenuRef = useRef<HTMLDivElement>(null);
  const rosterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: Event) {
      const target = e.target as Node;
      if (statusPopoverOpen && statusPopoverRef.current && !statusPopoverRef.current.contains(target)) {
        setStatusPopoverOpen(false);
      }
      if (priorityPopoverOpen && priorityPopoverRef.current && !priorityPopoverRef.current.contains(target)) {
        setPriorityPopoverOpen(false);
      }
      if (assigneePopoverOpen && assigneePopoverRef.current && !assigneePopoverRef.current.contains(target)) {
        setAssigneePopoverOpen(false);
      }
      if (tagPopoverOpen && tagPopoverRef.current && !tagPopoverRef.current.contains(target)) {
        setTagPopoverOpen(false);
      }
      if (presenceMenuOpen && presenceMenuRef.current && !presenceMenuRef.current.contains(target)) {
        setPresenceMenuOpen(false);
      }
      if (showRoster && rosterRef.current && !rosterRef.current.contains(target)) {
        setShowRoster(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [statusPopoverOpen, priorityPopoverOpen, assigneePopoverOpen, tagPopoverOpen, presenceMenuOpen, showRoster]);

  const [tags, setTags] = useState<Record<string, string[]>>({});
  const PREDEFINED_TAGS = ["VIP", "Bug", "Billing", "Feature Request", "Urgent", "Lead"];

  // ── Canned Responses state ──
  const [cannedResponses, setCannedResponses] = useState<CannedResponse[]>(() =>
    typeof window === "undefined" ? [] : loadCannedResponses()
  );
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

  // ── Knowledge Base Quick-Insert state ──
  const [kbInsertOpen, setKbInsertOpen] = useState(false);
  const [kbArticles, setKbArticles] = useState<Array<{ id: string; title: string; slug: string; subtitle?: string; content?: string; category?: { name: string } }>>([]);
  const [kbSearchQuery, setKbSearchQuery] = useState("");
  const [loadingKbArticles, setLoadingKbArticles] = useState(false);

  const loadKbArticles = useCallback(async () => {
    if (!botId) return;
    setLoadingKbArticles(true);
    try {
      const res = await fetchBackend(`/api/admin/kb/articles?bot_id=${botId}&status=published`);
      if (res.ok) {
        const d = await res.json();
        setKbArticles(d.articles || []);
      }
    } catch {} finally {
      setLoadingKbArticles(false);
    }
  }, [botId, fetchBackend]);

  const toggleKbInsert = () => {
    const next = !kbInsertOpen;
    setKbInsertOpen(next);
    if (next) {
      setAttachOpen(false);
      setEmojiOpen(false);
      setCannedOpen(false);
      loadKbArticles();
    }
  };

  const insertArticleLink = (art: { title: string; slug: string }) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const link = `[${art.title}](${origin}/kb/${botId}?article=${art.slug})`;
    setReply((prev) => (prev ? `${prev} ${link}` : link));
    setKbInsertOpen(false);
  };

  const insertArticleSnippet = (art: { title: string; slug: string; subtitle?: string; content?: string }) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const url = `${origin}/kb/${botId}?article=${art.slug}`;
    const text = art.subtitle ? `${art.subtitle}\nRead more: ${url}` : `Here is a helpful guide: ${url}`;
    setReply((prev) => (prev ? `${prev}\n\n${text}` : text));
    setKbInsertOpen(false);
  };

  const filteredKbArticles = kbArticles.filter(
    (a) =>
      !kbSearchQuery ||
      a.title.toLowerCase().includes(kbSearchQuery.toLowerCase()) ||
      (a.subtitle || "").toLowerCase().includes(kbSearchQuery.toLowerCase())
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

  const loadPresence = useCallback(async () => {
    try {
      const res = await fetchBackend(`/api/admin/routing/presence?bot_id=${botId}`);
      if (res.ok) {
        const d = await res.json();
        if (d.my_presence) {
          setMyPresence({
            status: d.my_presence.status || "online",
            max_capacity: d.my_presence.max_capacity || 5,
            active_tickets_count: d.my_presence.active_tickets_count || 0,
          });
        }
        if (d.agents) {
          setTeamPresence(d.agents);
        }
      }
    } catch {}
  }, [botId, fetchBackend]);

  const updatePresenceStatus = async (status: "online" | "away" | "busy" | "offline") => {
    setMyPresence((prev) => ({ ...prev, status }));
    setPresenceMenuOpen(false);
    try {
      const res = await fetchBackend("/api/admin/routing/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bot_id: botId, status, max_capacity: myPresence.max_capacity }),
      });
      if (res.ok) {
        showToast(`Status updated to ${capitalize(status)}`, "success");
        loadPresence();
      }
    } catch {
      showToast("Failed to update status", "error");
    }
  };

  const updateMaxCapacity = async (cap: number) => {
    if (cap < 1 || cap > 50) return;
    setMyPresence((prev) => ({ ...prev, max_capacity: cap }));
    try {
      await fetchBackend("/api/admin/routing/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bot_id: botId, status: myPresence.status, max_capacity: cap }),
      });
      showToast(`Max capacity updated to ${cap}`, "success");
      loadPresence();
    } catch {}
  };

  const dispatchQueue = async () => {
    setDispatchingQueue(true);
    try {
      const res = await fetchBackend(`/api/admin/routing/dispatch-queue?bot_id=${botId}`, {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        if (data.dispatched_count > 0) {
          showToast(`Assigned ${data.dispatched_count} ticket${data.dispatched_count === 1 ? "" : "s"} from queue`, "success");
          loadSessions();
          loadPresence();
        } else {
          showToast(data.unassigned_found > 0 ? "All online agents are at capacity" : "Queue is empty", "error");
        }
      }
    } catch {
      showToast("Failed to dispatch queue", "error");
    } finally {
      setDispatchingQueue(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadSessions();
      void loadAssignees();
      void loadPresence();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadSessions, loadAssignees, loadPresence]);

  useEffect(() => {
    if (selected) {
      const timer = setTimeout(() => {
        void loadMessages(selected);
        void loadNotes(selected);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [selected, loadMessages, loadNotes]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Live polling every 5s for sessions, 15s for presence
  useEffect(() => {
    const id = setInterval(() => {
      loadSessions();
      loadPresence();
      if (selected) loadMessages(selected);
    }, 5000);
    return () => clearInterval(id);
  }, [selected, loadSessions, loadMessages, loadPresence]);

  // ── Session Update (Helpdesk Lifecycle Engine) ──
  const updateSession = useCallback(async (sid: string, patch: Partial<Session> & { unassign?: boolean }) => {
    setSessions((prev) => prev.map((s) => {
      if (s.session_id !== sid) return s;
      const updated = { ...s, ...patch };
      if (patch.unassign || patch.assigned_agent_email === "") {
        updated.assigned_agent_email = undefined;
        updated.assigned_agent_name = undefined;
      }
      return updated;
    }));
    try {
      const payload: Record<string, any> = {
        bot_id: botId,
        session_id: sid,
        ...patch,
      };
      if (patch.unassign) {
        payload.unassign = true;
        payload.assigned_agent_email = "";
        payload.assigned_agent_name = "";
      }
      await fetchBackend("/api/admin/inbox/session", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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
    const isUnassign = !agentEmail;
    updateSession(sid, {
      assigned_agent_email: isUnassign ? "" : agentEmail,
      assigned_agent_name: isUnassign ? "" : (agentName || (agentEmail ? capitalize(agentEmail.split("@")[0]) : "")),
      ai_paused: !isUnassign,
      unassign: isUnassign,
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
        showToast("Correction saved - added to the knowledge base.", "success");
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
          showToast("Couldn't process that recording - try again.", "error");
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
    unassigned: sessions.filter((s) => !s.assigned_agent_email && (s.status || "open") !== "resolved" && (s.status || "open") !== "closed").length,
    open: sessions.filter((s) => (s.status || "open") === "open").length,
    pending: sessions.filter((s) => s.status === "pending").length,
    resolved: sessions.filter((s) => s.status === "resolved").length,
    closed: sessions.filter((s) => s.status === "closed").length,
  };

  const filteredSessions = sessions.filter((s) => {
    const sStatus = s.status || "open";
    if (selectedStatusTab === "unassigned") {
      if (s.assigned_agent_email || sStatus === "resolved" || sStatus === "closed") {
        return false;
      }
    } else if (selectedStatusTab !== "all" && sStatus !== selectedStatusTab) {
      return false;
    }

    const sPriority = s.priority || "normal";
    if (selectedPriorityFilter !== "all" && sPriority !== selectedPriorityFilter) {
      return false;
    }

    const sChannel = s.channel || "web";
    if (selectedChannelFilter !== "all" && sChannel !== selectedChannelFilter) {
      return false;
    }

    if (selectedAssigneeFilter === "me") {
      if (!currentUserEmail || s.assigned_agent_email?.toLowerCase() !== currentUserEmail.toLowerCase()) {
        return false;
      }
    } else if (selectedAssigneeFilter === "unassigned") {
      if (s.assigned_agent_email) return false;
    } else if (selectedAssigneeFilter !== "all") {
      if (s.assigned_agent_email?.toLowerCase() !== selectedAssigneeFilter.toLowerCase()) {
        return false;
      }
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
      const matchesSubject = (s.subject || "").toLowerCase().includes(q);
      const matchesEmail = (s.visitor_email || "").toLowerCase().includes(q);
      return matchesName || matchesMsg || matchesId || matchesTags || matchesSubject || matchesEmail;
    }

    return true;
  });

  const isAssignedToOther = Boolean(
    current?.assigned_agent_email &&
    currentUserEmail &&
    current.assigned_agent_email.toLowerCase() !== currentUserEmail.toLowerCase()
  );

  return (
    <div className="space-y-4">
      {/* ── Omnichannel Routing, Agent Presence & Live Queue Bar ── */}
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-3 shadow-sm flex flex-wrap items-center justify-between gap-3">
        {/* Left: Agent Presence Status & Capacity */}
        <div className="flex items-center gap-3">
          <div ref={presenceMenuRef} className="relative">
            <button
              onClick={() => setPresenceMenuOpen(!presenceMenuOpen)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                PRESENCE_STATUS_CONFIG[myPresence.status]?.bg || "bg-neutral-100 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700"
              }`}
            >
              <span className={`size-2.5 rounded-full shrink-0 ${PRESENCE_STATUS_CONFIG[myPresence.status]?.dot || "bg-neutral-400"} animate-pulse`} />
              <span className={PRESENCE_STATUS_CONFIG[myPresence.status]?.text || "text-neutral-700 dark:text-neutral-300"}>
                {PRESENCE_STATUS_CONFIG[myPresence.status]?.label || "Online"}
              </span>
              <ChevronDown className="size-3.5 opacity-60 ml-0.5" />
            </button>

            {/* Presence Dropdown Popover */}
            {presenceMenuOpen && (
              <div className="absolute left-0 top-full mt-1.5 w-56 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-2xl z-[9999] p-1.5 space-y-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 px-2 py-1">Set Your Status</div>
                {(["online", "away", "busy", "offline"] as const).map((st) => {
                  const cfg = PRESENCE_STATUS_CONFIG[st];
                  return (
                    <button
                      key={st}
                      onClick={() => updatePresenceStatus(st)}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                        myPresence.status === st
                          ? "bg-neutral-100 dark:bg-neutral-800 font-semibold text-neutral-900 dark:text-white"
                          : "hover:bg-neutral-50 dark:hover:bg-neutral-800/60 text-neutral-600 dark:text-neutral-300"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`size-2 rounded-full ${cfg.dot}`} />
                        <span>{cfg.label}</span>
                      </div>
                      {myPresence.status === st && <Check className="size-3.5 text-emerald-500" />}
                    </button>
                  );
                })}
                <div className="border-t border-neutral-100 dark:border-neutral-800 my-1 pt-1.5 px-2">
                  <div className="flex items-center justify-between text-[11px] text-neutral-500 dark:text-neutral-400 mb-1">
                    <span>Max Capacity:</span>
                    <span className="font-bold text-neutral-700 dark:text-neutral-200">{myPresence.max_capacity} tickets</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="15"
                    value={myPresence.max_capacity}
                    onChange={(e) => updateMaxCapacity(parseInt(e.target.value))}
                    className="w-full h-1.5 accent-[#f97316] bg-neutral-200 dark:bg-neutral-700 rounded-lg cursor-pointer"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Capacity Meter */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl text-xs whitespace-nowrap">
            <span className="text-neutral-500 dark:text-neutral-400">Capacity:</span>
            <span className="font-mono font-bold text-neutral-800 dark:text-neutral-200">
              {myPresence.active_tickets_count} / {myPresence.max_capacity}
            </span>
            <div className="w-16 h-1.5 bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden shrink-0">
              <div
                className={`h-full rounded-full transition-all ${
                  myPresence.active_tickets_count >= myPresence.max_capacity
                    ? "bg-red-500"
                    : myPresence.active_tickets_count >= myPresence.max_capacity * 0.8
                    ? "bg-amber-500"
                    : "bg-emerald-500"
                }`}
                style={{
                  width: `${Math.min(100, (myPresence.active_tickets_count / Math.max(1, myPresence.max_capacity)) * 100)}%`,
                }}
              />
            </div>
          </div>
        </div>

        {/* Middle: Team Presence Roster */}
        <div ref={rosterRef} className="relative flex items-center gap-2">
          <button
            onClick={() => setShowRoster(!showRoster)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800/60 transition-colors text-xs font-medium cursor-pointer whitespace-nowrap"
          >
            <Users className="size-3.5 text-neutral-400" />
            <span>Team Roster</span>
            <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold px-1.5 py-0.2 rounded-full text-[10px]">
              {teamPresence.filter((a) => a.status === "online").length} Online
            </span>
          </button>

          {/* Roster Popover */}
          {showRoster && (
            <div className="absolute right-0 sm:left-0 top-full mt-1.5 w-72 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-2xl z-[9999] p-2 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-bold text-neutral-500 dark:text-neutral-400 px-1 border-b border-neutral-100 dark:border-neutral-800 pb-1.5">
                <span>Agent Presence & Load</span>
                <span>Active / Max</span>
              </div>
              <div className="max-h-52 overflow-y-auto space-y-1 pr-1">
                {teamPresence.map((ag, idx) => {
                  const cfg = PRESENCE_STATUS_CONFIG[ag.status as keyof typeof PRESENCE_STATUS_CONFIG] || PRESENCE_STATUS_CONFIG.offline;
                  return (
                    <div
                      key={idx}
                      className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-neutral-50 dark:bg-neutral-950/60 text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`size-2 rounded-full shrink-0 ${cfg.dot}`} />
                        <div className="min-w-0">
                          <p className="font-semibold text-neutral-800 dark:text-neutral-200 truncate text-[11px]">{ag.agent_name || ag.agent_email}</p>
                          <p className="text-[10px] text-neutral-400 capitalize">{cfg.label}</p>
                        </div>
                      </div>
                      <span className="font-mono text-[11px] text-neutral-600 dark:text-neutral-300 font-semibold shrink-0">
                        {ag.active_tickets_count || 0} / {ag.max_capacity || 5}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right: Unassigned Queue & Auto-Assign Action */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-600 dark:text-rose-400 text-xs font-semibold">
            <Radio className="size-3 animate-ping shrink-0" />
            <span>Queue:</span>
            <span className="font-mono font-bold">{ticketCounts.unassigned}</span>
            <span className="text-[10px] font-normal opacity-80">unassigned</span>
          </div>

          <button
            onClick={dispatchQueue}
            disabled={dispatchingQueue || ticketCounts.unassigned === 0}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs transition-all shadow-sm cursor-pointer ${
              ticketCounts.unassigned > 0
                ? "bg-[#f97316] text-white hover:bg-[#ea580c] active:scale-95"
                : "bg-neutral-100 dark:bg-neutral-800 text-neutral-400 cursor-not-allowed border border-neutral-200 dark:border-neutral-700"
            }`}
          >
            {dispatchingQueue ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Zap className="size-3.5 fill-current" />
            )}
            <span>Auto-Assign</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* ── Sessions / Tickets List Pane ── */}
        <div className="lg:col-span-5 xl:col-span-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl flex flex-col max-h-[680px]">
          {/* Ticket Lifecycle Status Tabs */}
          <div className="flex items-center border-b border-neutral-100 dark:border-neutral-850 bg-neutral-50/50 dark:bg-neutral-950/40 text-[11px] font-semibold select-none overflow-x-auto scrollbar-none rounded-t-2xl">
            {([
              { key: "all", label: "All", count: ticketCounts.all },
              { key: "unassigned", label: "Queue", count: ticketCounts.unassigned, dot: "bg-rose-500" },
              { key: "open", label: "Open", count: ticketCounts.open, dot: "bg-emerald-500" },
              { key: "pending", label: "Pending", count: ticketCounts.pending, dot: "bg-amber-500" },
              { key: "resolved", label: "Resolved", count: ticketCounts.resolved, dot: "bg-purple-500" },
              { key: "closed", label: "Closed", count: ticketCounts.closed, dot: "bg-neutral-400" },
            ] satisfies Array<{ key: InboxStatusTab; label: string; count: number; dot?: string }>).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setSelectedStatusTab(tab.key)}
                className={`shrink-0 py-2.5 px-3 flex items-center justify-center gap-1.5 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                  selectedStatusTab === tab.key
                    ? "border-[#f97316] text-neutral-900 dark:text-neutral-100 font-bold bg-white dark:bg-neutral-900"
                    : "border-transparent text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                }`}
              >
                {tab.dot && <span className={`size-1.5 rounded-full shrink-0 ${tab.dot}`} />}
                <span className="whitespace-nowrap">{tab.label}</span>
                <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-mono shrink-0 ${
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
        <div className="p-2.5 border-b border-neutral-100 dark:border-neutral-850 space-y-2 bg-white dark:bg-neutral-900 relative z-20">
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
              className="p-1.5 border border-neutral-200 dark:border-neutral-800 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 cursor-pointer shrink-0"
            >
              <RefreshCw className={`size-3.5 ${loadingSessions ? "animate-spin" : ""}`} />
            </button>
          </div>

          {/* Secondary Filters: Priority, Assignee, Channel & Tags */}
          <div className="flex items-center flex-wrap gap-1.5 py-0.5 relative z-20">
            {/* Priority Filter */}
            <ModernFilterDropdown
              title="Filter by priority"
              value={selectedPriorityFilter}
              onChange={setSelectedPriorityFilter}
              align="left"
              options={[
                { value: "all", label: "All Priorities" },
                { value: "urgent", label: "Urgent", icon: <span className="size-1.5 rounded-full bg-red-500 shrink-0" /> },
                { value: "high", label: "High", icon: <span className="size-1.5 rounded-full bg-amber-500 shrink-0" /> },
                { value: "normal", label: "Normal", icon: <span className="size-1.5 rounded-full bg-blue-500 shrink-0" /> },
                { value: "low", label: "Low", icon: <span className="size-1.5 rounded-full bg-neutral-400 shrink-0" /> },
              ]}
            />

            {/* Assignee Filter */}
            <ModernFilterDropdown
              title="Filter by assignee"
              value={selectedAssigneeFilter}
              onChange={setSelectedAssigneeFilter}
              align="left"
              options={[
                { value: "all", label: "All Assignees" },
                { value: "me", label: "Mine", icon: <User className="size-2.5 text-neutral-400 shrink-0" /> },
                { value: "unassigned", label: "Queue", icon: <InboxIcon className="size-2.5 text-neutral-400 shrink-0" /> },
                ...assignees.map((a) => ({
                  value: a.email.toLowerCase(),
                  label: a.name || a.email,
                  icon: <UserCheck className="size-2.5 text-neutral-400 shrink-0" />,
                })),
              ]}
            />

            {/* Channel Filter */}
            <ModernFilterDropdown
              title="Filter by channel"
              value={selectedChannelFilter}
              onChange={setSelectedChannelFilter}
              align="right"
              options={[
                { value: "all", label: "Channels" },
                { value: "web", label: "Chat", icon: <MessageSquare className="size-2.5 text-emerald-500 shrink-0" /> },
                { value: "email", label: "Email", icon: <Mail className="size-2.5 text-blue-500 shrink-0" /> },
              ]}
            />

            {/* Tag Filter Dropdown */}
            <ModernFilterDropdown
              title="Filter by tag"
              value={selectedTagFilter}
              onChange={setSelectedTagFilter}
              align="right"
              options={[
                { value: "all", label: "Tags" },
                ...PREDEFINED_TAGS.map((t) => ({
                  value: t,
                  label: t,
                  icon: <Tag className="size-2.5 text-neutral-400 shrink-0" />,
                })),
              ]}
            />
          </div>
        </div>

        {/* Ticket List Items */}
        <div className="overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-850 flex-1 rounded-b-2xl">
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
                    <span className="text-xs font-semibold truncate flex items-center gap-1.5 min-w-0">
                      {s.needs_attention && <span className="size-2 rounded-full bg-red-500 animate-ping shrink-0" />}
                      <span className="truncate">{s.visitor_name || `Visitor ${s.session_id.slice(-5)}`}</span>
                      {s.channel === "email" && (
                        <span title="Inbound Email Ticket" className="shrink-0 p-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400">
                          <Mail className="size-2.5" />
                        </span>
                      )}
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

                  {s.subject && (
                    <p className="text-[11px] font-medium text-neutral-800 dark:text-neutral-200 truncate mt-0.5">
                      {s.subject}
                    </p>
                  )}

                  <p className="text-[10px] text-neutral-400 truncate mt-0.5">
                    {s.last_message || "…"}
                  </p>

                  {/* Badges Row: Priority, SLA, Channel, Assignee, Tags */}
                  <div className="flex flex-wrap items-center gap-1 mt-2">
                    {/* Channel Badge */}
                    {s.channel === "email" && (
                      <span className="text-[8px] px-1.5 py-0.2 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/30 flex items-center gap-0.5 font-medium">
                        <Mail className="size-2.5" />
                        <span>Email</span>
                      </span>
                    )}

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
      <div className="lg:col-span-7 xl:col-span-8 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl overflow-hidden flex flex-col max-h-[680px]">
        {!selected ? (
          <div className="flex-1 flex flex-col items-center justify-center text-xs text-neutral-400 p-8 space-y-2">
            <InboxIcon className="size-10 text-neutral-300 stroke-1" />
            <p>Select a ticket from the inbox to review transcript and reply</p>
          </div>
        ) : (
          <>
            {/* Ticket Header Bar */}
            <div className="p-3 border-b border-neutral-100 dark:border-neutral-850 flex items-center justify-between flex-wrap gap-2 bg-neutral-50/40 dark:bg-neutral-950/20 relative z-20">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-neutral-900 dark:text-neutral-100 truncate max-w-40 flex items-center gap-1.5">
                  {current?.visitor_name || `Visitor ${selected.slice(-5)}`}
                </span>
                {current?.channel === "email" && (
                  <span className="text-[9px] font-semibold px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/30 flex items-center gap-1">
                    <Mail className="size-2.5" />Email
                  </span>
                )}
                {current?.visitor_email && (
                  <span className="text-[10px] text-neutral-400 truncate max-w-48 font-mono">
                    &lt;{current.visitor_email}&gt;
                  </span>
                )}
                <span className="text-[10px] font-mono font-semibold text-neutral-400">
                  #{selected.slice(-6).toUpperCase()}
                </span>

                {/* Status Switcher Popover */}
                <div ref={statusPopoverRef} className="relative">
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
                    <div className="absolute top-8 left-0 z-50 w-36 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-2xl p-1.5 space-y-1">
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
                <div ref={priorityPopoverRef} className="relative">
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
                    <div className="absolute top-8 left-0 z-50 w-32 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-2xl p-1.5 space-y-1">
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
                <div ref={assigneePopoverRef} className="relative">
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
                    <div className="absolute top-8 left-0 z-50 w-48 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-2xl p-2 space-y-1">
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
                <div ref={tagPopoverRef} className="relative">
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
                    <div className="absolute top-8 right-0 z-50 w-44 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-2xl p-2 space-y-1">
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

            {/* Email Subject Sub-Banner */}
            {current?.channel === "email" && (
              <div className="px-3.5 py-1.5 bg-blue-50/50 dark:bg-blue-950/20 border-b border-blue-100 dark:border-blue-900/30 flex items-center justify-between text-xs text-blue-900 dark:text-blue-200 shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <Mail className="size-3.5 text-blue-500 shrink-0" />
                  <div className="min-w-0 truncate">
                    <span className="font-bold">Subject: </span>
                    <span>{current.subject || "Support Inquiry"}</span>
                  </div>
                </div>
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-blue-500/10 font-semibold text-blue-600 dark:text-blue-400 shrink-0 border border-blue-500/20">
                  Threaded Email
                </span>
              </div>
            )}

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
              <AnimatePresence>
                {kbInsertOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className="absolute bottom-[84px] left-2.5 right-2.5 z-20 max-h-72 flex flex-col rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80 shadow-2xl bg-white dark:bg-neutral-900 overflow-hidden"
                  >
                    <div className="p-3 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <BookOpen className="size-4 text-[#f97316]" />
                        <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200">
                          Insert Knowledge Base Article
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setKbInsertOpen(false)}
                        className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>

                    <div className="p-2 border-b border-neutral-100 dark:border-neutral-800">
                      <div className="relative">
                        <Search className="size-3 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={kbSearchQuery}
                          onChange={(e) => setKbSearchQuery(e.target.value)}
                          placeholder="Search published articles..."
                          className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg pl-7 pr-3 py-1 text-xs focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-800 max-h-48 p-1">
                      {loadingKbArticles ? (
                        <div className="p-4 text-center text-xs text-neutral-400 flex items-center justify-center gap-2">
                          <Loader2 className="size-3 animate-spin" /> Loading articles...
                        </div>
                      ) : filteredKbArticles.length === 0 ? (
                        <div className="p-4 text-center text-xs text-neutral-400">
                          No published articles found.
                        </div>
                      ) : (
                        filteredKbArticles.map((art) => (
                          <div
                            key={art.id}
                            className="p-2 hover:bg-neutral-50 dark:hover:bg-neutral-800 rounded-xl transition-colors flex items-center justify-between gap-3"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold text-neutral-800 dark:text-neutral-200 truncate">
                                {art.title}
                              </p>
                              {art.category && (
                                <span className="text-[9px] text-neutral-400 font-semibold">
                                  {art.category.name}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => insertArticleLink(art)}
                                className="px-2 py-1 text-[10px] font-semibold rounded-lg bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 flex items-center gap-1 cursor-pointer"
                                title="Insert markdown link"
                              >
                                <Link2 className="size-2.5" /> Link
                              </button>
                              <button
                                type="button"
                                onClick={() => insertArticleSnippet(art)}
                                className="px-2 py-1 text-[10px] font-semibold rounded-lg bg-[#f97316]/10 hover:bg-[#f97316] text-[#f97316] hover:text-white transition-colors flex items-center gap-1 cursor-pointer"
                                title="Insert summary snippet and link"
                              >
                                Insert
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
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

                {/* Email Delivery Banner */}
                {(current?.channel === "email" || current?.visitor_email) && (
                  <div className="flex items-center justify-between px-2.5 py-1 mb-2 rounded-lg bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50 text-[10px] text-blue-700 dark:text-blue-300">
                    <span className="flex items-center gap-1.5 font-medium truncate">
                      <Mail className="size-3 text-blue-500 shrink-0" />
                      <span>Replying via Email to <strong className="font-semibold">{current.visitor_email || current.visitor_name || "Customer"}</strong></span>
                    </span>
                    <span className="text-[9px] opacity-75 shrink-0 hidden sm:inline">Delivered to customer inbox</span>
                  </div>
                )}

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
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.85 }}
                      onClick={toggleKbInsert}
                      className={`p-1.5 rounded-full transition-colors ${
                        kbInsertOpen
                          ? "text-[#f97316] bg-[#f97316]/10"
                          : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
                      }`}
                      aria-label="Knowledge Base"
                      title="Insert Help Center article link or snippet"
                    >
                      <BookOpen className="size-4.5" />
                    </motion.button>
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
