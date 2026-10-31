"use client";

import { createPortal } from "react-dom";
import { InboxIdentitySettings } from "./inbox-identity-settings";
import "./inbox-workspace.css";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
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
  Calendar,
  User,
  UserCheck,
  ShieldAlert,
  ShieldCheck,
  ChevronDown,
  Zap,
  CreditCard,
  DollarSign,
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
  Sparkles,
  Eye,
  SlidersHorizontal,
  ArrowLeft,
  PanelLeftClose,
  AtSign,
} from "lucide-react";
import { QuickEmojiPicker } from "@/components/quick-emoji-picker";
import { AttachMenu } from "@/components/attach-menu";
import { createClient } from "@/lib/supabase/client";
import { SELF_HOST_MODE } from "@/lib/deployment";
import { MessageList, type InboxMeeting, type Msg } from "@/components/inbox-message-list";
import { formatMessagePreview } from "@/lib/rich-content";
import { InboxVisitorDetails } from "@/components/inbox-visitor-details";
import { ModernSelect, type ModernSelectOption } from "@/components/ui/modern-select";

const RULE_EVENT_OPTIONS: ModernSelectOption[] = [
  { value: "ticket_created", label: "Ticket Created" },
  { value: "ticket_updated", label: "Ticket Updated" },
  { value: "message_received", label: "Message Received" },
];

const RULE_FIELD_OPTIONS: ModernSelectOption[] = [
  { value: "last_message", label: "Message Text" },
  { value: "visitor_name", label: "Visitor Name" },
  { value: "channel", label: "Channel" },
  { value: "priority", label: "Priority" },
  { value: "tags", label: "Tags" },
];

const RULE_OP_OPTIONS: ModernSelectOption[] = [
  { value: "contains", label: "Contains" },
  { value: "equals", label: "Equals" },
  { value: "starts_with", label: "Starts with" },
  { value: "regex", label: "Regex" },
];

const RULE_ACTION_OPTIONS: ModernSelectOption[] = [
  { value: "set_priority", label: "Set Priority" },
  { value: "add_tag", label: "Add Tag" },
  { value: "set_status", label: "Set Status" },
  { value: "send_internal_note", label: "Post Internal Note" },
];

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
  channel?: "web" | "email" | "slack" | "whatsapp" | "messenger" | "instagram" | "tiktok" | "telegram" | "sms";
  subject?: string;
  visitor_email?: string;
  whatsapp_window?: {
    window_open: boolean;
    requires_template: boolean;
    remaining_seconds: number;
    expires_at?: string | null;
    last_user_message_at?: string | null;
    reason?: string;
  };
}

interface WhatsAppTemplateItem {
  name: string;
  language: string;
  status: string;
  category: string;
  body: string;
  param_labels: string[];
}

// A conversation is only a routing ticket after it explicitly needs a human
// (handoff request, escalation, offline ticket, or manual AI pause). Normal
// AI-only chats intentionally remain unassigned and must not consume agent
// capacity or be auto-paused by the queue dispatcher.
const isHumanQueueTicket = (session: Session): boolean => (
  Boolean(session.needs_attention || session.ai_paused || session.escalation_reason)
);

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

interface ActiveViewer {
  agent_email: string;
  agent_name?: string;
  last_seen_at?: string;
}

interface ThreadSummary {
  summary: string;
  bullet_points: string[];
  sentiment: string;
  recommended_action: string;
}

interface AutomationRuleItem {
  id: string;
  name: string;
  description?: string;
  event_trigger: string;
  match_mode: string;
  conditions: Array<{ field: string; operator: string; value: string }>;
  actions: Array<{ type: string; value: string }>;
  is_active: boolean;
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

function MobilePopoverPortal({ children }: { children: React.ReactNode }) {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(width < 640px)");
    const update = () => setMobile(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return mobile ? createPortal(children, document.body) : children;
}

function InboxRoutingPopover({ anchor, popup, width, children, onDismiss }: { anchor: React.RefObject<HTMLDivElement | null>; popup: React.RefObject<HTMLDivElement | null>; width: number; children: React.ReactNode; onDismiss: () => void }) {
  const [position, setPosition] = useState({left:12,top:12,width});
  useEffect(() => {
    const place = () => {
      const rect = anchor.current?.getBoundingClientRect();
      if (!rect) return;
      const popupWidth = Math.min(width, window.innerWidth - 24);
      const popupHeight = Math.min(popup.current?.offsetHeight || 300, window.innerHeight - 24);
      setPosition({left:Math.max(12,Math.min(rect.left,window.innerWidth-popupWidth-12)),top:Math.max(12,Math.min(rect.bottom+6,window.innerHeight-popupHeight-12)),width:popupWidth});
    };
    place();
    window.addEventListener("resize",place);
    window.addEventListener("scroll",place,true);
    return () => {window.removeEventListener("resize",place);window.removeEventListener("scroll",place,true);};
  },[anchor,popup,width]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); onDismiss(); anchor.current?.querySelector("button")?.focus(); }
    };
    document.addEventListener("keydown",onKey);
    return () => document.removeEventListener("keydown",onKey);
  },[anchor,onDismiss]);
  return createPortal(<div ref={popup} style={{...position,maxHeight:"calc(100dvh - 24px)"}} className="fixed z-[9999] overflow-y-auto bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-2xl p-2 space-y-1.5">{children}</div>,anchor.current?.closest("[data-dashboard]") || document.body);
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
  const popupRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const [positioned, setPositioned] = useState(false);

  useEffect(() => {
    function handleClickOutside(e: Event) {
      if (!ref.current?.contains(e.target as Node) && !popupRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    if (open) {
      const place = () => {
        const rect = ref.current?.getBoundingClientRect();
        const width = popupRef.current?.offsetWidth || 260;
        if (rect) {
          setPosition({ left: Math.max(12, Math.min(align === "right" ? rect.right - width : rect.left, window.innerWidth - width - 12)), top: rect.bottom + 6 });
          setPositioned(true);
        }
      };
      place();
      window.addEventListener("scroll", place, true);
      window.addEventListener("resize", place);
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
      document.addEventListener("keydown", onKey);
      return () => {
        window.removeEventListener("scroll", place, true);
        window.removeEventListener("resize", place);
        document.removeEventListener("mousedown", handleClickOutside);
        document.removeEventListener("touchstart", handleClickOutside);
        document.removeEventListener("keydown", onKey);
      };
    }
  }, [open, align]);

  const selectedOpt = options.find((o) => o.value === value) || options[0];

  return (
    <div ref={ref} className={`relative inline-block text-left shrink-0 ${open ? "z-50" : "z-10"}`}>
      <button
        type="button"
        title={title}
        aria-label={title}
        aria-expanded={open}
        onClick={() => { setPositioned(false); setOpen(!open); }}
        className="flex max-w-full items-center gap-1.5 px-2.5 py-1.5 bg-neutral-50 hover:bg-neutral-100 dark:bg-neutral-950 dark:hover:bg-neutral-850 border border-neutral-200/90 dark:border-neutral-800 rounded-lg text-neutral-700 dark:text-neutral-300 transition-colors text-[10px] font-semibold cursor-pointer shadow-xs focus:outline-none focus:ring-1 focus:ring-[#f97316]/40 whitespace-nowrap"
      >
        {selectedOpt?.icon}
        <span className="whitespace-nowrap font-medium">{selectedOpt?.label}</span>
        <ChevronDown className={`size-3 text-neutral-400 transition-transform duration-150 shrink-0 ${open ? "rotate-180 text-neutral-700 dark:text-neutral-200" : ""}`} />
      </button>

      {open && positioned && createPortal(
        <div ref={popupRef} style={{ left: position.left, top: position.top }} className="fixed z-[9999] min-w-[145px] w-max max-w-[min(260px,calc(100vw-24px))] max-h-56 overflow-y-auto bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-2xl p-1 space-y-0.5">
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
      , ref.current?.closest("[data-dashboard]") || document.body)}
    </div>
  );
}

export function InboxPanel({ botId, fetchBackend, formatDateTime, color = "#f97316" }: Props) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [visitorDetailsOpen, setVisitorDetailsOpen] = useState(false);
  const [navigationCollapsed, setNavigationCollapsed] = useState(false);
  const [queueSort, setQueueSort] = useState("newest");
  const presencePopupRef = useRef<HTMLDivElement | null>(null);
  const rosterPopupRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    // Start with details docked on wide desktops, not over the mobile chat.
    setVisitorDetailsOpen(window.matchMedia("(min-width: 1400px)").matches);
    setNavigationCollapsed(window.matchMedia("(max-width: 1190px)").matches);
  }, []);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [confirmedMeeting, setConfirmedMeeting] = useState<InboxMeeting | null>(null);
  const activeSessionRef = useRef<string | null>(null);
  const messageRequestRef = useRef<AbortController | null>(null);
  const noteRequestRef = useRef<AbortController | null>(null);
  const draftsRef = useRef(new Map<string, {reply: string; note: string}>());
  const [reply, setReply] = useState("");
  const [composerMode, setComposerMode] = useState<"reply" | "note">("reply");
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const [recording, setRecording] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [mobileActionsOpen, setMobileActionsOpen] = useState(false);
  const [correctingId, setCorrectingId] = useState<string | null>(null);
  const [correctionDraft, setCorrectionDraft] = useState("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const emojiPanelRef = useRef<HTMLDivElement | null>(null);
  const emojiButtonRef = useRef<HTMLButtonElement | null>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);

  // ── Helpdesk Engine State ──
  const [selectedStatusTab, setSelectedStatusTab] = useState<InboxStatusTab>("open");
  const [selectedPriorityFilter, setSelectedPriorityFilter] = useState<string>("all");
  const [selectedAssigneeFilter, setSelectedAssigneeFilter] = useState<string>("all");
  const [mentionedSessionIds, setMentionedSessionIds] = useState<string[]>([]);
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
  const [autoDispatchEnabled, setAutoDispatchEnabled] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(`chatty_auto_dispatch_${botId}`);
      if (saved !== null) return saved === "true";
    }
    return true;
  });
  const dispatchingQueueRef = useRef(false);
  const [showRoster, setShowRoster] = useState(false);

  // Assignees & Current Agent
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [currentUserEmail, setCurrentUserEmail] = useState<string>("");
  const mentionAssignees = useMemo<Assignee[]>(() => {
    const merged = [...assignees];
    for (const agent of teamPresence) {
      const email = (agent.agent_email || "").trim().toLowerCase();
      if (email && !merged.some((item) => item.email.toLowerCase() === email)) {
        merged.push({ email, name: agent.agent_name || "Teammate", role: "agent" });
      }
    }
    return merged;
  }, [assignees, teamPresence]);

  // ── Agent Collision Detection State ──
  const [activeViewers, setActiveViewers] = useState<ActiveViewer[]>([]);

  // ── AI Copilot State ──
  const [generatingDraft, setGeneratingDraft] = useState(false);
  const [summaryModalOpen, setSummaryModalOpen] = useState(false);
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [savingSummaryAsNote, setSavingSummaryAsNote] = useState(false);
  const [threadSummary, setThreadSummary] = useState<ThreadSummary | null>(null);

  // ── Automation Rules State ──
  const [rulesModalOpen, setRulesModalOpen] = useState(false);
  const [automationRules, setAutomationRules] = useState<AutomationRuleItem[]>([]);
  const [loadingRules, setLoadingRules] = useState(false);
  const [creatingRule, setCreatingRule] = useState(false);
  const [newRuleName, setNewRuleName] = useState("");
  const [newRuleEvent, setNewRuleEvent] = useState("ticket_created");
  const [newRuleField, setNewRuleField] = useState("last_message");
  const [newRuleOp, setNewRuleOp] = useState("contains");
  const [newRuleVal, setNewRuleVal] = useState("");
  const [newRuleActionType, setNewRuleActionType] = useState("add_tag");
  const [newRuleActionVal, setNewRuleActionVal] = useState("Escalated");

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
  const tagPopupRef = useRef<HTMLDivElement>(null);
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
      if (tagPopoverOpen && tagPopoverRef.current && !tagPopoverRef.current.contains(target) && !tagPopupRef.current?.contains(target)) {
        setTagPopoverOpen(false);
      }
      if (presenceMenuOpen && presenceMenuRef.current && !presenceMenuRef.current.contains(target) && !presencePopupRef.current?.contains(target)) {
        setPresenceMenuOpen(false);
      }
      if (showRoster && rosterRef.current && !rosterRef.current.contains(target) && !rosterPopupRef.current?.contains(target)) {
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

  useEffect(() => {
    if (!emojiOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setEmojiOpen(false);
        emojiButtonRef.current?.focus();
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!emojiPanelRef.current?.contains(target) && !emojiButtonRef.current?.contains(target)) {
        setEmojiOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [emojiOpen]);

  const [tags, setTags] = useState<Record<string, string[]>>({});
  const PREDEFINED_TAGS = ["VIP", "Bug", "Billing", "Feature Request", "Urgent", "Lead"];

  // ── Canned Responses state ──
  const [cannedResponses, setCannedResponses] = useState<CannedResponse[]>(() =>
    typeof window === "undefined" ? [] : loadCannedResponses()
  );
  const [cannedOpen, setCannedOpen] = useState(false);
  const [cannedFilter, setCannedFilter] = useState("");
  const [cannedManageOpen, setCannedManageOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [checkoutMode, setCheckoutMode] = useState<"catalog" | "custom">("catalog");
  const [gatewayProducts, setGatewayProducts] = useState<any[]>([]);
  const [loadingGatewayProducts, setLoadingGatewayProducts] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [productSearch, setProductSearch] = useState("");
  type PaymentProviderId = "stripe" | "paypal" | "lemonsqueezy" | "polar";
  const [paymentProvider, setPaymentProvider] = useState<PaymentProviderId | "">("");
  const [connectedGateways, setConnectedGateways] = useState<PaymentProviderId[]>([]);
  const [gatewaysLoaded, setGatewaysLoaded] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("50.00");
  const [paymentCurrency, setPaymentCurrency] = useState("usd");
  const [paymentTitle, setPaymentTitle] = useState("Consultation & Service Deposit");
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [editingCanned, setEditingCanned] = useState<CannedResponse | null>(null);
  const [cannedDraftShortcut, setCannedDraftShortcut] = useState("");
  const [cannedDraftText, setCannedDraftText] = useState("");

  // Custom states for toast and confirm modal
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!cannedManageOpen && !confirmModal && !summaryModalOpen && !rulesModalOpen) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const controls = () => Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex="0"]') || []).filter(element => element.getClientRects().length > 0);
    controls()[0]?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setCannedManageOpen(false);
        setConfirmModal(null);
        setSummaryModalOpen(false);
        setRulesModalOpen(false);
      } else if (event.key === "Tab") {
        const items = controls();
        const first = items[0];
        const last = items[items.length - 1];
        if (!first) { event.preventDefault(); return; }
        if (event.shiftKey && (document.activeElement === first || !dialogRef.current?.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || !dialogRef.current?.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); if (previousFocus?.isConnected) previousFocus.focus(); };
  }, [cannedManageOpen, confirmModal, summaryModalOpen, rulesModalOpen]);

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
        if (SELF_HOST_MODE) {
          const response = await fetchBackend("/api/user/profile");
          if (response.ok) {
            const profile = await response.json();
            if (profile.email) setCurrentUserEmail(profile.email);
          }
        } else {
          const supabase = createClient();
          const { data } = await supabase.auth.getUser();
          if (data?.user?.email) setCurrentUserEmail(data.user.email);
        }
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

  const selectConversation = (sid: string | null) => {
    if (selected) draftsRef.current.set(selected, {reply, note: noteDraft});
    activeSessionRef.current = sid;
    messageRequestRef.current?.abort();
    noteRequestRef.current?.abort();
    messageRequestRef.current = null;
    noteRequestRef.current = null;
    setLoadingNotes(false);
    setMessages([]);
    setConfirmedMeeting(null);
    setSessionNotes([]);
    setActiveViewers([]);
    setSummaryModalOpen(false);
    setThreadSummary(null);
    setCannedOpen(false);
    setKbInsertOpen(false);
    if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
    setAttachOpen(false);
    setEmojiOpen(false);
    setReply(sid ? draftsRef.current.get(sid)?.reply || "" : "");
    setNoteDraft(sid ? draftsRef.current.get(sid)?.note || "" : "");
    setComposerMode("reply");
    setViewMode("chat");
    setSelected(sid);
  };

  const handleReplyChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const val = e.target.value;
    if (composerMode === "note") setNoteDraft(val); else setReply(val);
    const mention = val.match(/(?:^|\s)@([\w.-]*)$/);
    setMentionQuery(mention ? mention[1].toLowerCase() : null);
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
  const [waTemplateOpen, setWaTemplateOpen] = useState(false);
  const [waTemplates, setWaTemplates] = useState<WhatsAppTemplateItem[]>([]);
  const [loadingWaTemplates, setLoadingWaTemplates] = useState(false);
  const [selectedWaTemplate, setSelectedWaTemplate] = useState<WhatsAppTemplateItem | null>(null);
  const [waTemplateParams, setWaTemplateParams] = useState<string[]>([]);

  const loadWaTemplates = useCallback(async () => {
    if (!botId) return;
    setLoadingWaTemplates(true);
    try {
      const res = await fetchBackend(`/api/admin/inbox/whatsapp-templates?bot_id=${encodeURIComponent(botId)}`);
      if (res.ok) {
        const d = await res.json();
        const list: WhatsAppTemplateItem[] = d.templates || [];
        setWaTemplates(list);
        if (list.length > 0 && !selectedWaTemplate) {
          setSelectedWaTemplate(list[0]);
          setWaTemplateParams((list[0].param_labels || []).map((_, idx) => idx === 0 ? (current?.visitor_name || "Customer") : ""));
        }
      }
    } catch {} finally {
      setLoadingWaTemplates(false);
    }
  }, [botId, fetchBackend, current?.visitor_name, selectedWaTemplate]);

  const openWaTemplatePicker = () => {
    setWaTemplateOpen(true);
    setKbInsertOpen(false);
    setAttachOpen(false);
    setEmojiOpen(false);
    setCannedOpen(false);
    void loadWaTemplates();
  };

  const sendWaTemplate = async () => {
    if (!selected || !selectedWaTemplate) return;
    setSending(true);
    try {
      let renderedBody = selectedWaTemplate.body || "";
      waTemplateParams.forEach((val, idx) => {
        renderedBody = renderedBody.replace(new RegExp(`\\{\\{\\s*${idx + 1}\\s*\\}\\}`, "g"), val || `{{${idx + 1}}}`);
      });
      const previewText = `[WhatsApp Template: ${selectedWaTemplate.name}] ${renderedBody}`.trim();
      setMessages((p) => [...p, { role: "assistant", content: previewText, sender: "human" }]);
      const res = await fetchBackend("/api/admin/inbox/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bot_id: botId,
          session_id: selected,
          text: renderedBody,
          template_name: selectedWaTemplate.name,
          template_language: selectedWaTemplate.language || "en_US",
          template_params: waTemplateParams,
        }),
      });
      if (res.ok) {
        showToast(`WhatsApp template '${selectedWaTemplate.name}' sent!`, "success");
        setWaTemplateOpen(false);
        loadSessions();
      } else {
        showToast("Failed to send WhatsApp template", "error");
      }
    } catch {
      showToast("Error sending WhatsApp template", "error");
    } finally {
      setSending(false);
    }
  };

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

  const toggleAttachBooking = () => {
    if (reply.includes("[BOOKING_WIDGET]")) {
      setReply((prev) => prev.replace(/\n*\[BOOKING_WIDGET\]/g, "").trim());
      showToast("Booking widget removed from reply", "success");
    } else {
      const prompt = "Sure! You can book a meeting below. Please select a date and time that works best for you:\n[BOOKING_WIDGET]";
      setReply((prev) => (prev.trim() ? `${prev.trim()}\n\n[BOOKING_WIDGET]` : prompt));
      showToast("Booking calendar attached to reply", "success");
    }
    setMobileActionsOpen(false);
  };

  const visitorLastMsg = useMemo(() => {
    for (let idx = messages.length - 1; idx >= 0; idx--) {
      if (messages[idx].role === "user") return (messages[idx].content || "").toLowerCase();
    }
    return "";
  }, [messages]);

  const visitorWantsBooking = useMemo(() => {
    if (!visitorLastMsg) return false;
    return /\b(book|booking|schedule|demo|meeting|appointment|call|slots?|calendar)\b/i.test(visitorLastMsg);
  }, [visitorLastMsg]);

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
    if (activeSessionRef.current !== sid || messageRequestRef.current) return;
    const controller = new AbortController();
    messageRequestRef.current = controller;
    try {
      const res = await fetchBackend(`/api/admin/inbox/messages?bot_id=${botId}&session_id=${encodeURIComponent(sid)}`, {signal: controller.signal});
      if (res.ok) {
        const d = await res.json();
        if (!controller.signal.aborted && activeSessionRef.current === sid) setMessages(d.messages || []);
      }
      const bookingRes = await fetchBackend(`/api/admin/inbox/booking/active?bot_id=${encodeURIComponent(botId)}&session_id=${encodeURIComponent(sid)}`, { signal: controller.signal });
      if (bookingRes.ok) {
        const booking = await bookingRes.json();
        if (!controller.signal.aborted && activeSessionRef.current === sid) {
          setConfirmedMeeting(booking.has_active && booking.meeting ? booking.meeting : null);
        }
      }
    } catch {} finally { if (messageRequestRef.current === controller) messageRequestRef.current = null; }
  }, [botId, fetchBackend]);

  const loadNotes = useCallback(async (sid: string) => {
    if (activeSessionRef.current !== sid) return;
    const controller = new AbortController();
    noteRequestRef.current = controller;
    setLoadingNotes(true);
    try {
      const res = await fetchBackend(`/api/admin/inbox/notes?bot_id=${botId}&session_id=${encodeURIComponent(sid)}`, {signal: controller.signal});
      if (res.ok) {
        const d = await res.json();
        if (!controller.signal.aborted && activeSessionRef.current === sid) setSessionNotes(d.notes || []);
      }
    } catch {} finally {
      if (noteRequestRef.current === controller) { noteRequestRef.current = null; setLoadingNotes(false); }
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

  const loadMentions = useCallback(async () => {
    try {
      const res = await fetchBackend(`/api/admin/inbox/mentions?bot_id=${botId}`);
      if (res.ok) {
        const data = await res.json();
        setMentionedSessionIds(Array.isArray(data.session_ids) ? data.session_ids : []);
      }
    } catch {}
  }, [botId, fetchBackend]);

  useEffect(() => { void loadMentions(); }, [loadMentions]);

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
          const reason = data.routing_reason;
          const message = reason === "no_online_agents"
            ? "No online agents are available"
            : reason === "routing_disabled"
            ? "Automatic routing is disabled"
            : reason === "all_agents_at_capacity"
            ? "All online agents are at capacity"
            : data.unassigned_found > 0
            ? "No eligible human-takeover tickets are available"
            : "Queue is empty";
          showToast(message, data.unassigned_found > 0 ? "error" : "success");
        }
      }
    } catch {
      showToast("Failed to dispatch queue", "error");
    } finally {
      setDispatchingQueue(false);
    }
  };

  const dispatchQueueSilent = useCallback(async () => {
    if (dispatchingQueueRef.current) return;
    dispatchingQueueRef.current = true;
    try {
      const res = await fetchBackend(`/api/admin/routing/dispatch-queue?bot_id=${botId}`, {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        if (data.dispatched_count > 0) {
          showToast(`Auto-assigned ${data.dispatched_count} ticket${data.dispatched_count === 1 ? "" : "s"} to online agents`, "success");
          loadSessions();
          loadPresence();
        }
      }
    } catch {} finally {
      dispatchingQueueRef.current = false;
    }
  }, [botId, fetchBackend, loadSessions, loadPresence, showToast]);

  // Do not carry visitor drafts or transcript requests across bots/unmounts.
  useEffect(() => {
    activeSessionRef.current = null;
    if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
    messageRequestRef.current?.abort();
    noteRequestRef.current?.abort();
    messageRequestRef.current = null;
    noteRequestRef.current = null;
    draftsRef.current.clear();
    setSelected(null);
    setMessages([]);
    setSessionNotes([]);
    setReply("");
    setNoteDraft("");
    return () => {
      activeSessionRef.current = null;
      if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
      messageRequestRef.current?.abort();
      noteRequestRef.current?.abort();
    };
  }, [botId]);

  // Persist autoDispatch preference
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(`chatty_auto_dispatch_${botId}`, String(autoDispatchEnabled));
    }
  }, [autoDispatchEnabled, botId]);


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

  // ── Agent Collision Detection & Viewer Heartbeat ──
  const sendHeartbeatAndFetchViewers = useCallback(async (sid: string) => {
    try {
      await fetchBackend("/api/admin/inbox/session/heartbeat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bot_id: botId, session_id: sid }),
      });
      const res = await fetchBackend(`/api/admin/inbox/session/viewers?bot_id=${botId}&session_id=${encodeURIComponent(sid)}`);
      if (res.ok) {
        const data = await res.json();
        if (activeSessionRef.current === sid) setActiveViewers(data.viewers || []);
      }
    } catch {}
  }, [botId, fetchBackend]);

  useEffect(() => {
    if (!selected) {
      setActiveViewers([]);
      return;
    }
    void sendHeartbeatAndFetchViewers(selected);
    const interval = setInterval(() => {
      void sendHeartbeatAndFetchViewers(selected);
    }, 12000);
    return () => clearInterval(interval);
  }, [selected, sendHeartbeatAndFetchViewers]);

  // ── AI Copilot (Draft Reply & Summarizer) ──
  const handleAiDraftReply = async () => {
    if (!selected) return;
    setGeneratingDraft(true);
    try {
      const res = await fetchBackend("/api/admin/inbox/ai-draft-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bot_id: botId, session_id: selected }),
      });
      if (res.ok) {
        const data = await res.json();
        const draftText = data.draft_reply || data.draft;
        if (activeSessionRef.current !== selected) return;
        if (draftText) {
          setReply(draftText);
          showToast("AI draft reply generated!", "success");
        } else {
          showToast("Could not generate AI draft reply", "error");
        }
      } else {
        showToast("Failed to generate AI draft reply", "error");
      }
    } catch {
      showToast("Error connecting to AI service", "error");
    } finally {
      setGeneratingDraft(false);
    }
  };

  const handleAiSummarize = async () => {
    if (!selected) return;
    setSummaryModalOpen(true);
    setGeneratingSummary(true);
    setThreadSummary(null);
    try {
      const res = await fetchBackend("/api/admin/inbox/ai-summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bot_id: botId, session_id: selected }),
      });
      if (res.ok) {
        const data = await res.json();
        if (activeSessionRef.current === selected) setThreadSummary(data);
      } else {
        showToast("Failed to summarize conversation", "error");
      }
    } catch {
      showToast("Error connecting to AI service", "error");
    } finally {
      setGeneratingSummary(false);
    }
  };

  const handleSaveSummaryAsNote = async () => {
    if (!threadSummary || !selected) return;
    setSavingSummaryAsNote(true);
    const bullets = (threadSummary.bullet_points || []).map((b) => `• ${b}`).join("\n");
    const formattedNote = `[AI Conversation Summary]\n${threadSummary.summary}\n\nKey Takeaways:\n${bullets}\n\nSentiment: ${threadSummary.sentiment}\nRecommended Action: ${threadSummary.recommended_action}`;
    try {
      const res = await fetchBackend("/api/admin/inbox/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bot_id: botId, session_id: selected, note: formattedNote }),
      });
      if (res.ok) {
        const d = await res.json();
        if (activeSessionRef.current === selected) setSessionNotes((prev) => [...prev, d.note]);
        showToast("Summary saved to internal notes", "success");
        setSummaryModalOpen(false);
      } else {
        showToast("Failed to save note", "error");
      }
    } catch {
      showToast("Error saving note", "error");
    } finally {
      setSavingSummaryAsNote(false);
    }
  };

  // ── Automation Rules Engine Operations ──
  const loadAutomationRules = useCallback(async () => {
    if (!botId) return;
    setLoadingRules(true);
    try {
      const res = await fetchBackend(`/api/admin/automation-rules?bot_id=${botId}`);
      if (res.ok) {
        const data = await res.json();
        setAutomationRules(data.rules || []);
      }
    } catch {} finally {
      setLoadingRules(false);
    }
  }, [botId, fetchBackend]);

  const handleCreateRule = async () => {
    if (!newRuleName.trim() || !newRuleVal.trim()) return;
    setCreatingRule(true);
    try {
      const payload = {
        bot_id: botId,
        name: newRuleName.trim(),
        event_trigger: newRuleEvent,
        match_mode: "all",
        conditions: [{ field: newRuleField, operator: newRuleOp, value: newRuleVal.trim() }],
        actions: [{ type: newRuleActionType, value: newRuleActionVal.trim() }],
        is_active: true,
      };
      const res = await fetchBackend("/api/admin/automation-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        showToast("Automation rule created!", "success");
        setNewRuleName("");
        setNewRuleVal("");
        loadAutomationRules();
      } else {
        showToast("Failed to create rule", "error");
      }
    } catch {
      showToast("Network error creating rule", "error");
    } finally {
      setCreatingRule(false);
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    try {
      const res = await fetchBackend(`/api/admin/automation-rules/${ruleId}?bot_id=${botId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setAutomationRules((prev) => prev.filter((r) => r.id !== ruleId));
        showToast("Rule removed", "success");
      }
    } catch {
      showToast("Failed to delete rule", "error");
    }
  };

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
        if (activeSessionRef.current === selected) setSessionNotes((prev) => [...prev, d.note]);
        void loadMentions();
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

  const loadGatewayProducts = useCallback(async () => {
    if (!botId) return;
    setLoadingGatewayProducts(true);
    try {
      const res = await fetchBackend(`/api/bots/${botId}/integrations/payments/products`);
      if (res.ok) {
        const data = await res.json();
        const prods = data.products || [];
        setGatewayProducts(prods);
        if (prods.length > 0) {
          setSelectedProduct(prods[0]);
        } else {
          setCheckoutMode("custom");
        }
      }
    } catch (err) {
      console.error("Failed to load gateway products", err);
    } finally {
      setLoadingGatewayProducts(false);
    }
  }, [botId, fetchBackend]);

  const loadConnectedGateways = useCallback(async () => {
    if (!botId) return;
    try {
      const res = await fetchBackend(`/api/bots/${botId}/integrations/payments`);
      if (!res.ok) return;
      const data = await res.json();
      const providers = (data.providers || {}) as Record<string, { connected?: boolean; is_active?: boolean }>;
      const connected = (["stripe", "paypal", "lemonsqueezy", "polar"] as const).filter(
        (id) => providers[id]?.connected && providers[id]?.is_active !== false
      );
      setConnectedGateways(connected);
      setPaymentProvider((prev) => (prev && connected.includes(prev) ? prev : connected[0] ?? ""));
    } catch (err) {
      console.error("Failed to load connected payment gateways", err);
    } finally {
      setGatewaysLoaded(true);
    }
  }, [botId, fetchBackend]);

  useEffect(() => {
    if (paymentModalOpen) {
      setGatewaysLoaded(false);
      void loadConnectedGateways();
      void loadGatewayProducts();
    }
  }, [paymentModalOpen, loadGatewayProducts, loadConnectedGateways]);

  const handleSendPaymentCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;

    let titleToSend = paymentTitle.trim();
    let amountToSendCents = Math.round((parseFloat(paymentAmount) || 0) * 100);
    let currencyToSend = paymentCurrency.toLowerCase();
    let providerToSend: string = paymentProvider;
    let variantToSend: string | undefined;

    if (checkoutMode === "catalog" && selectedProduct) {
      variantToSend = selectedProduct.variant_id || undefined;
      titleToSend = selectedProduct.name;
      amountToSendCents = selectedProduct.amount_cents;
      currencyToSend = (selectedProduct.currency || "usd").toLowerCase();
      providerToSend = selectedProduct.provider;
    }

    if (!providerToSend) {
      showToast("Connect a payment gateway in Integrations first.", "error");
      return;
    }
    if (amountToSendCents < 50) {
      showToast("Amount must be at least $0.50", "error");
      return;
    }

    setPaymentBusy(true);
    try {
      const res = await fetchBackend(`/api/bots/${botId}/inbox/send-checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: selected,
          amount_cents: amountToSendCents,
          currency: currencyToSend,
          title: titleToSend || "Payment Request",
          customer_email: current?.visitor_email || undefined,
          provider: providerToSend,
          variant_id: variantToSend,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to generate checkout link");
      showToast("Checkout link sent to visitor!", "success");
      setPaymentModalOpen(false);
      loadMessages(selected);
      loadSessions();
    } catch (err: any) {
      showToast(err.message || "Error generating checkout link", "error");
    } finally {
      setPaymentBusy(false);
    }
  };

  const sendReply = async () => {
    if (!reply.trim() || !selected) return;
    const isWaSession = current?.channel === "whatsapp" || selected.startsWith("wa:");
    if (isWaSession && current?.whatsapp_window && !current.whatsapp_window.window_open) {
      showToast("24h WhatsApp window expired - select an approved Template message to re-open.", "error");
      openWaTemplatePicker();
      return;
    }
    setSending(true);
    const text = reply;
    setReply("");
    setMentionQuery(null);
    setMessages((p) => [...p, { role: "assistant", content: text, sender: "human" }]);
    try {
      const res = await fetchBackend("/api/admin/inbox/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bot_id: botId, session_id: selected, text }),
      });
      if (res.status === 409) {
        setReply(text);
        showToast("WhatsApp 24-hour reply window expired. Please send a pre-approved template.", "error");
        openWaTemplatePicker();
      }
      loadSessions();
    } catch {} finally {
      setSending(false);
    }
  };

  const insertMention = (assignee: Assignee) => {
    const update = (value: string) => value.replace(/(?:^|\s)@[\w.-]*$/, (match) => `${match.startsWith(" ") ? " " : ""}@${assignee.name || assignee.email.split("@")[0]} `);
    if (composerMode === "note") setNoteDraft(update); else setReply(update);
    setMentionQuery(null);
  };

  const sendComposer = async () => {
    if (composerMode === "note") {
      await addNote();
      setMentionQuery(null);
      return;
    }
    await sendReply();
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
        if (activeSessionRef.current !== selected) return;
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
      if (activeSessionRef.current !== selected) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      const mr = new MediaRecorder(stream);
      audioChunksRef.current = [];
      mr.ondataavailable = (ev) => { if (ev.data.size > 0) audioChunksRef.current.push(ev.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: mr.mimeType || "audio/webm" });
        setRecording(false);
        if (blob.size === 0 || activeSessionRef.current !== selected) return;
        try {
          const wav = await audioBlobToWav(blob);
          if (activeSessionRef.current === selected) sendMedia(wav, "voice-message.wav");
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
        if (selected === sid) selectConversation(null);
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
    unassigned: sessions.filter((s) => !s.assigned_agent_email && isHumanQueueTicket(s) && (s.status || "open") !== "resolved" && (s.status || "open") !== "closed").length,
    open: sessions.filter((s) => (s.status || "open") === "open").length,
    pending: sessions.filter((s) => s.status === "pending").length,
    resolved: sessions.filter((s) => s.status === "resolved").length,
    closed: sessions.filter((s) => s.status === "closed").length,
  };

  // Automated background ticket dispatch
  useEffect(() => {
    if (!autoDispatchEnabled || ticketCounts.unassigned === 0) return;
    const timer = setTimeout(() => {
      void dispatchQueueSilent();
    }, 1500);
    return () => clearTimeout(timer);
  }, [autoDispatchEnabled, ticketCounts.unassigned, dispatchQueueSilent]);

  const filteredSessions = sessions.filter((s) => {
    const sStatus = s.status || "open";
    if (selectedStatusTab === "unassigned") {
      if (s.assigned_agent_email || !isHumanQueueTicket(s) || sStatus === "resolved" || sStatus === "closed") {
        return false;
      }
    } else if (selectedStatusTab !== "all" && sStatus !== selectedStatusTab) {
      return false;
    }

    const sPriority = s.priority || "normal";
    if (selectedPriorityFilter !== "all" && sPriority !== selectedPriorityFilter) {
      return false;
    }

    const sChannel = s.channel || (
      s.session_id.startsWith("wa:") ? "whatsapp" :
      s.session_id.startsWith("fb:") ? "messenger" :
      s.session_id.startsWith("ig:") ? "instagram" :
      s.session_id.startsWith("tt:") ? "tiktok" :
      s.session_id.startsWith("tg:") ? "telegram" :
      s.session_id.startsWith("sms:") ? "sms" : "web"
    );
    if (selectedChannelFilter !== "all" && sChannel !== selectedChannelFilter) {
      return false;
    }

    if (selectedAssigneeFilter === "me") {
      if (!currentUserEmail || s.assigned_agent_email?.toLowerCase() !== currentUserEmail.toLowerCase()) {
        return false;
      }
    } else if (selectedAssigneeFilter === "unassigned") {
      if (s.assigned_agent_email || !isHumanQueueTicket(s)) return false;
    } else if (selectedAssigneeFilter === "mentions") {
      if (!mentionedSessionIds.includes(s.session_id)) return false;
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
  }).sort((a, b) => {
    const activity = (new Date(b.last_message_at || 0).getTime() || 0) - (new Date(a.last_message_at || 0).getTime() || 0);
    if (queueSort === "oldest") return -activity;
    if (queueSort === "priority") {
      const rank = { urgent: 0, high: 1, normal: 2, low: 3 };
      return rank[a.priority || "normal"] - rank[b.priority || "normal"] || activity;
    }
    return activity;
  });

  const isAssignedToOther = Boolean(
    current?.assigned_agent_email &&
    currentUserEmail &&
    current.assigned_agent_email.toLowerCase() !== currentUserEmail.toLowerCase()
  );

  const otherViewers = activeViewers.filter(
    (v) => !currentUserEmail || v.agent_email.toLowerCase() !== currentUserEmail.toLowerCase()
  );

  return (
    <div className="inbox-shell space-y-4" data-conversation-open={Boolean(selected)} data-navigation-collapsed={navigationCollapsed} data-details-open={visitorDetailsOpen && Boolean(selected)}>
      {/* ── Omnichannel Routing, Agent Presence & Live Queue Bar ── */}
      <div data-inbox-routing className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-3 shadow-sm flex flex-wrap items-center justify-between gap-3">
        {/* Left: Agent Presence Status & Capacity */}
        <div data-inbox-presence className="flex items-center gap-3">
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
              <InboxRoutingPopover anchor={presenceMenuRef} popup={presencePopupRef} width={224} onDismiss={() => setPresenceMenuOpen(false)}>
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
                    aria-label="Maximum ticket capacity"
                    type="range"
                    min="1"
                    max="15"
                    value={myPresence.max_capacity}
                    onChange={(e) => updateMaxCapacity(parseInt(e.target.value))}
                    className="w-full h-1.5 accent-[#f97316] bg-neutral-200 dark:bg-neutral-700 rounded-lg cursor-pointer"
                  />
                </div>
              </InboxRoutingPopover>
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

        {/* Middle: Team Presence Roster & Automation Rules */}
        <div ref={rosterRef} data-inbox-roster className="relative flex items-center gap-2">
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

          <button
            onClick={() => {
              setRulesModalOpen(true);
              loadAutomationRules();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800/60 transition-colors text-xs font-medium cursor-pointer whitespace-nowrap"
            title="Configure Event Triggers & Automation Rules"
          >
            <SlidersHorizontal className="size-3.5 text-neutral-400" />
            <span>Rules</span>
          </button>

          {/* Roster Popover */}
          {showRoster && (
            <InboxRoutingPopover anchor={rosterRef} popup={rosterPopupRef} width={288} onDismiss={() => setShowRoster(false)}>
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
            </InboxRoutingPopover>
          )}
        </div>

        {/* Right: Unassigned Queue & Auto-Assign Action */}
        <div data-inbox-queue className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-600 dark:text-rose-400 text-xs font-semibold">
            <Radio className="size-3 animate-ping shrink-0" />
            <span>Queue:</span>
            <span className="font-mono font-bold">{ticketCounts.unassigned}</span>
            <span className="text-[10px] font-normal opacity-80">unassigned</span>
          </div>

          <button
            type="button"
            onClick={() => setAutoDispatchEnabled((prev) => !prev)}
            title={autoDispatchEnabled ? "Automatic assignment of tickets is ON (Click to toggle)" : "Automatic assignment of tickets is OFF (Click to enable)"}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
              autoDispatchEnabled
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20"
                : "bg-neutral-100 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-750"
            }`}
          >
            <span className={`size-1.5 rounded-full shrink-0 ${autoDispatchEnabled ? "bg-emerald-500 animate-pulse" : "bg-neutral-400"}`} />
            <span>Auto: {autoDispatchEnabled ? "ON" : "OFF"}</span>
          </button>

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

      <div className="inbox-workspace">
        <nav className="inbox-navigation" aria-label="Inbox views">
          <div className="inbox-pane-title">
            <h2>Inbox</h2>
            <div className="flex items-center gap-1">
              <InboxIdentitySettings key={botId} botId={botId} fetchBackend={fetchBackend} />
              <button type="button" aria-expanded={!navigationCollapsed} aria-label={navigationCollapsed ? "Expand inbox navigation" : "Collapse inbox navigation"} onClick={() => setNavigationCollapsed(value => !value)}><PanelLeftClose className="size-4" /></button>
            </div>
          </div>
          <div className="inbox-nav-content">
            <button type="button" aria-pressed={selectedAssigneeFilter === "me"} onClick={() => { setSelectedAssigneeFilter("me"); setSelectedStatusTab("open"); }}><User className="size-4" />My inbox</button>
            <button type="button" aria-pressed={selectedAssigneeFilter === "mentions"} onClick={() => { setSelectedAssigneeFilter("mentions"); setSelectedStatusTab("all"); }}><AtSign className="size-4" />Mentions <span>{mentionedSessionIds.length}</span></button>
            <button type="button" aria-pressed={selectedStatusTab === "unassigned"} onClick={() => { setSelectedAssigneeFilter("all"); setSelectedStatusTab("unassigned"); }}><InboxIcon className="size-4" />Unassigned <span>{ticketCounts.unassigned}</span></button>
            <button type="button" aria-pressed={selectedStatusTab === "all" && selectedAssigneeFilter === "all"} onClick={() => { setSelectedAssigneeFilter("all"); setSelectedStatusTab("all"); }}><MessageSquare className="size-4" />All conversations <span>{ticketCounts.all}</span></button>
            <h3>Lifecycle</h3>
            {(["open", "pending", "resolved", "closed"] as const).map(status => <button key={status} type="button" aria-pressed={selectedStatusTab === status} onClick={() => setSelectedStatusTab(status)}><span className={`size-2 rounded-full ${STATUS_CONFIG[status].dot}`} />{STATUS_CONFIG[status].label}<span>{ticketCounts[status]}</span></button>)}
            <h3>Priority views</h3>
            <button type="button" aria-pressed={selectedPriorityFilter === "urgent"} onClick={() => { setSelectedStatusTab("all"); setSelectedPriorityFilter(selectedPriorityFilter === "urgent" ? "all" : "urgent"); }}><AlertCircle className="size-4" />Urgent tickets</button>
            <button type="button" aria-pressed={selectedPriorityFilter === "high"} onClick={() => { setSelectedStatusTab("all"); setSelectedPriorityFilter(selectedPriorityFilter === "high" ? "all" : "high"); }}><ArrowUp className="size-4" />High priority</button>
            <button type="button" onClick={() => { setSelectedStatusTab("all"); setSelectedAssigneeFilter("all"); setSelectedPriorityFilter("all"); setSelectedChannelFilter("all"); setSelectedTagFilter("all"); setSearchQuery(""); }}>Clear filters</button>
          </div>
        </nav>
        {/* ── Sessions / Tickets List Pane ── */}
        <div className="inbox-queue bg-white dark:bg-neutral-900 flex flex-col">
          <div className="inbox-pane-title">
            <h2>{selectedAssigneeFilter === "me" ? "My inbox" : selectedAssigneeFilter === "mentions" ? "Mentions" : selectedStatusTab === "all" ? "All conversations" : capitalize(selectedStatusTab)}</h2>
            <div className="flex items-center gap-1.5">
              <ModernFilterDropdown title="Filter by status" value={selectedStatusTab} onChange={setSelectedStatusTab} options={[
                { value: "all", label: "All conversations" },
                { value: "unassigned", label: "Unassigned" },
                { value: "open", label: "Open" },
                { value: "pending", label: "Pending" },
                { value: "resolved", label: "Resolved" },
                { value: "closed", label: "Closed" },
              ]} />
              <span>{filteredSessions.length}</span>
            </div>
          </div>
          <div className="inbox-queue-sort"><ModernFilterDropdown title="Sort conversations" value={queueSort} onChange={setQueueSort} options={[{value:"newest",label:"Newest activity"},{value:"oldest",label:"Oldest activity"},{value:"priority",label:"Highest priority"}]} /></div>
        {/* Filter Controls & Search */}
        <div className="p-2.5 border-b border-neutral-100 dark:border-neutral-850 space-y-2 bg-white dark:bg-neutral-900 relative z-20">
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search visitor, message, ticket..."
              className="min-w-0 flex-1 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-2.5 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-[#f97316]/50"
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
          <div className="dashboard-action-bar flex items-center flex-wrap gap-1.5 py-0.5 relative z-20">
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
                { value: "web", label: "Web Chat", icon: <MessageSquare className="size-2.5 text-neutral-500 shrink-0" /> },
                { value: "whatsapp", label: "WhatsApp", icon: <MessageSquare className="size-2.5 text-[#25D366] shrink-0" /> },
                { value: "messenger", label: "Messenger", icon: <MessageSquare className="size-2.5 text-blue-600 shrink-0" /> },
                { value: "instagram", label: "Instagram", icon: <MessageSquare className="size-2.5 text-pink-500 shrink-0" /> },
                { value: "tiktok", label: "TikTok", icon: <MessageSquare className="size-2.5 text-neutral-900 dark:text-neutral-100 shrink-0" /> },
                { value: "telegram", label: "Telegram", icon: <MessageSquare className="size-2.5 text-sky-500 shrink-0" /> },
                { value: "sms", label: "SMS", icon: <MessageSquare className="size-2.5 text-red-500 shrink-0" /> },
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
                  onClick={() => selectConversation(s.session_id)}
                  onKeyDown={event => { if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); selectConversation(s.session_id); } }}
                  aria-label={`Open conversation with ${s.visitor_name || "visitor"}`}
                  aria-current={selected === s.session_id ? "true" : undefined}
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
                      <span className="inbox-queue-avatar" aria-hidden="true">{(s.visitor_name || "Visitor").split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase()}</span>
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
                        className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 text-neutral-400 hover:text-red-500 transition-opacity p-0.5 cursor-pointer ml-1"
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
                    {formatMessagePreview(s.last_message) || "…"}
                  </p>

                  {/* Badges Row: Priority, SLA, Channel, Assignee, Tags */}
                  <div className="flex flex-wrap items-center gap-1 mt-2">
                    {/* Channel Badge */}
                    {s.channel === "email" ? (
                      <span className="text-[8px] px-1.5 py-0.2 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/30 flex items-center gap-0.5 font-medium">
                        <Mail className="size-2.5" />
                        <span>Email</span>
                      </span>
                    ) : (s.channel === "whatsapp" || s.session_id.startsWith("wa:")) ? (
                      <span className="text-[8px] px-1.5 py-0.2 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-0.5 font-medium">
                        <MessageSquare className="size-2.5" />
                        <span>WhatsApp</span>
                      </span>
                    ) : (s.channel === "messenger" || s.session_id.startsWith("fb:")) ? (
                      <span className="text-[8px] px-1.5 py-0.2 rounded-md bg-blue-600/10 text-blue-600 dark:text-blue-400 border border-blue-600/30 flex items-center gap-0.5 font-medium">
                        <MessageSquare className="size-2.5" />
                        <span>Messenger</span>
                      </span>
                    ) : (s.channel === "instagram" || s.session_id.startsWith("ig:")) ? (
                      <span className="text-[8px] px-1.5 py-0.2 rounded-md bg-pink-500/10 text-pink-600 dark:text-pink-400 border border-pink-500/30 flex items-center gap-0.5 font-medium">
                        <MessageSquare className="size-2.5" />
                        <span>Instagram</span>
                      </span>
                    ) : (s.channel === "tiktok" || s.session_id.startsWith("tt:")) ? (
                      <span className="text-[8px] px-1.5 py-0.2 rounded-md bg-neutral-900/10 text-neutral-900 dark:bg-neutral-100/10 dark:text-neutral-100 border border-neutral-500/30 flex items-center gap-0.5 font-medium">
                        <MessageSquare className="size-2.5" />
                        <span>TikTok</span>
                      </span>
                    ) : (s.channel === "telegram" || s.session_id.startsWith("tg:")) ? (
                      <span className="text-[8px] px-1.5 py-0.2 rounded-md bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/30 flex items-center gap-0.5 font-medium">
                        <MessageSquare className="size-2.5" />
                        <span>Telegram</span>
                      </span>
                    ) : (s.channel === "sms" || s.session_id.startsWith("sms:")) ? (
                      <span className="text-[8px] px-1.5 py-0.2 rounded-md bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/30 flex items-center gap-0.5 font-medium">
                        <MessageSquare className="size-2.5" />
                        <span>SMS</span>
                      </span>
                    ) : null}

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
      <div className="inbox-conversation bg-white dark:bg-neutral-900 overflow-hidden flex flex-col">
        {!selected ? (
          <div className="flex-1 flex flex-col items-center justify-center text-xs text-neutral-400 p-8 space-y-2">
            <InboxIcon className="size-10 text-neutral-300 stroke-1" />
            <p>Select a ticket from the inbox to review transcript and reply</p>
          </div>
        ) : (
          <>
            {/* Ticket Header Bar */}
            <div className="inbox-conversation-tools flex justify-end px-3 py-1.5 border-b border-neutral-100 dark:border-neutral-800">
              <button type="button" className="inbox-back" onClick={() => selectConversation(null)}><ArrowLeft className="size-4" />Conversations</button>
              <button type="button" aria-expanded={visitorDetailsOpen} onClick={() => setVisitorDetailsOpen(value => !value)} className="text-xs font-medium flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2 py-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800"><User className="size-3.5 shrink-0" />Visitor details</button>
            </div>
            <div data-inbox-ticket-header className="p-3 border-b border-neutral-100 dark:border-neutral-850 flex items-center justify-between flex-wrap gap-2 bg-neutral-50/40 dark:bg-neutral-950/20 relative z-20">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-neutral-900 dark:text-neutral-100 truncate max-w-40 flex items-center gap-1.5">
                  {current?.visitor_name || `Visitor ${selected.slice(-5)}`}
                </span>
                {current?.channel === "email" && (
                  <span className="text-[9px] font-semibold px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/30 flex items-center gap-1">
                    <Mail className="size-2.5" />Email
                  </span>
                )}
                {(current?.channel === "whatsapp" || selected.startsWith("wa:")) && (
                  <span className="text-[9px] font-semibold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                    <MessageSquare className="size-2.5" />WhatsApp
                  </span>
                )}
                {(current?.channel === "messenger" || selected.startsWith("fb:")) && (
                  <span className="text-[9px] font-semibold px-2 py-0.5 rounded-md bg-blue-600/10 text-blue-600 dark:text-blue-400 border border-blue-600/30 flex items-center gap-1">
                    <MessageSquare className="size-2.5" />Messenger
                  </span>
                )}
                {(current?.channel === "instagram" || selected.startsWith("ig:")) && (
                  <span className="text-[9px] font-semibold px-2 py-0.5 rounded-md bg-pink-500/10 text-pink-600 dark:text-pink-400 border border-pink-500/30 flex items-center gap-1">
                    <MessageSquare className="size-2.5" />Instagram
                  </span>
                )}
                {(current?.channel === "tiktok" || selected.startsWith("tt:")) && (
                  <span className="text-[9px] font-semibold px-2 py-0.5 rounded-md bg-neutral-900/10 text-neutral-900 dark:bg-neutral-100/10 dark:text-neutral-100 border border-neutral-500/30 flex items-center gap-1">
                    <MessageSquare className="size-2.5" />TikTok
                  </span>
                )}
                {(current?.channel === "telegram" || selected.startsWith("tg:")) && (
                  <span className="text-[9px] font-semibold px-2 py-0.5 rounded-md bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/30 flex items-center gap-1">
                    <MessageSquare className="size-2.5" />Telegram
                  </span>
                )}
                {(current?.channel === "sms" || selected.startsWith("sms:")) && (
                  <span className="text-[9px] font-semibold px-2 py-0.5 rounded-md bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/30 flex items-center gap-1">
                    <MessageSquare className="size-2.5" />SMS
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

                {/* Active Viewers Live Indicator */}
                {otherViewers.length > 0 && (
                  <span
                    className="text-[9px] font-semibold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30 flex items-center gap-1"
                    title={`Active viewers: ${otherViewers.map((v) => v.agent_name || v.agent_email).join(", ")}`}
                  >
                    <Eye className="size-2.5 animate-pulse" />
                    <span>{otherViewers.length} viewing</span>
                  </span>
                )}

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
              <div data-inbox-ticket-actions className="flex items-center gap-1.5">
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

                {/* AI Summarize Thread (Copilot) */}
                <button
                  type="button"
                  onClick={handleAiSummarize}
                  disabled={generatingSummary}
                  className="text-[10px] font-semibold border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                  title="Generate AI Conversation Summary & Action Plan"
                >
                  <Sparkles className="size-3 text-amber-500" />
                  <span>Summarize</span>
                </button>

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
                    <MobilePopoverPortal>
                    <div ref={tagPopupRef} data-inbox-ticket-tags className="absolute top-8 right-0 z-50 w-44 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-2xl p-2 space-y-1">
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
                    </MobilePopoverPortal>
                  )}
                </div>

                {/* View Mode Toggle (Chat / Staff Notes) */}
                <div className="flex bg-neutral-100 dark:bg-neutral-850 p-0.5 rounded-lg text-[9px] font-semibold">
                  <button
                    onClick={() => { setViewMode("chat"); setComposerMode("reply"); }}
                    className={`px-2 py-1 rounded-md transition-colors cursor-pointer ${
                      viewMode === "chat"
                        ? "bg-white dark:bg-neutral-800 shadow text-neutral-900 dark:text-neutral-100"
                        : "text-neutral-450 hover:text-neutral-600"
                    }`}
                  >
                    Chat
                  </button>
                  <button
                    onClick={() => { setViewMode("notes"); setComposerMode("note"); }}
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

            {/* WhatsApp 24-Hour Customer Service Window Banner */}
            {(current?.channel === "whatsapp" || selected.startsWith("wa:")) && (() => {
              const win = current?.whatsapp_window;
              const isOpen = win ? win.window_open : true;
              const remSec = win?.remaining_seconds ?? 0;
              const hrs = Math.floor(remSec / 3600);
              const mins = Math.floor((remSec % 3600) / 60);
              return isOpen ? (
                <div className="px-3.5 py-1.5 bg-emerald-50/60 dark:bg-emerald-950/25 border-b border-emerald-200/60 dark:border-emerald-900/40 flex items-center justify-between text-xs text-emerald-900 dark:text-emerald-200 shrink-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <Clock className="size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span className="truncate">
                      <strong>WhatsApp 24h Service Window Open</strong> ? Free-form replies allowed ({hrs}h {mins}m remaining)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={openWaTemplatePicker}
                    className="text-[10px] font-semibold px-2.5 py-0.5 rounded-md bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 cursor-pointer shrink-0"
                  >
                    Send Template
                  </button>
                </div>
              ) : (
                <div className="px-3.5 py-2 bg-amber-500/15 border-b border-amber-500/30 flex items-center justify-between gap-2 text-xs text-amber-900 dark:text-amber-200 shrink-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <AlertCircle className="size-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span>
                      <strong>24-Hour Reply Window Expired:</strong> Meta blocks free-form messages 24h after the customer&apos;s last reply. Send a pre-approved template to re-open the conversation.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={openWaTemplatePicker}
                    className="text-[10px] font-bold px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white shadow-xs cursor-pointer shrink-0"
                  >
                    Choose WhatsApp Template
                  </button>
                </div>
              );
            })()}

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

            {/* Live Active Viewers Collision Alert */}
            {otherViewers.length > 0 && (
              <div className="bg-amber-500/15 border-b border-amber-500/30 px-3.5 py-2 flex items-center justify-between text-xs text-amber-900 dark:text-amber-200 shrink-0">
                <div className="flex items-center gap-2">
                  <Eye className="size-4 text-amber-600 dark:text-amber-400 animate-pulse shrink-0" />
                  <span>
                    <strong>Live Collision Warning:</strong>{" "}
                    {otherViewers.map((v) => v.agent_name || v.agent_email).join(", ")}{" "}
                    {otherViewers.length === 1 ? "is" : "are"} also viewing this ticket right now.
                  </span>
                </div>
                <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/25 text-amber-800 dark:text-amber-300">
                  Live Presence
                </span>
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
                            className="absolute bottom-2.5 right-2.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 transition-opacity text-neutral-400 hover:text-red-500 cursor-pointer"
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
                  confirmedMeeting={confirmedMeeting}
                />
              )}
            </div>

            {/* Reply Input Bar */}
            {viewMode === "chat" && <div className="border-t border-neutral-100 dark:border-neutral-850 p-2.5 relative">
              <input type="file" ref={fileInputRef} onChange={onFilePick} accept="image/*,audio/*,application/pdf,.txt,.doc,.docx" className="hidden" />
              <AnimatePresence>
                {emojiOpen && (
                  <motion.div
                    ref={emojiPanelRef}
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
              <AnimatePresence>
                {waTemplateOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className="absolute bottom-[84px] left-2.5 right-2.5 z-30 max-h-96 flex flex-col rounded-2xl border border-emerald-500/40 shadow-2xl bg-white dark:bg-neutral-900 overflow-hidden"
                  >
                    <div className="p-3 bg-emerald-50/70 dark:bg-emerald-950/40 border-b border-emerald-200/60 dark:border-emerald-800/50 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="size-4 text-emerald-600 dark:text-emerald-400" />
                        <span className="text-xs font-bold text-neutral-800 dark:text-neutral-100">
                          Send Pre-Approved Meta WhatsApp Template (HSM)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setWaTemplateOpen(false)}
                        className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 cursor-pointer"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                    <div className="p-3 overflow-y-auto space-y-3 text-xs">
                      {loadingWaTemplates ? (
                        <div className="py-6 flex items-center justify-center gap-2 text-neutral-400">
                          <Loader2 className="size-4 animate-spin" /> Loading approved Meta templates...
                        </div>
                      ) : (
                        <>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                              Select Approved Template
                            </label>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                              {waTemplates.map((tpl) => {
                                const isSel = selectedWaTemplate?.name === tpl.name;
                                return (
                                  <button
                                    key={tpl.name}
                                    type="button"
                                    onClick={() => {
                                      setSelectedWaTemplate(tpl);
                                      setWaTemplateParams(
                                        (tpl.param_labels || []).map((_, idx) =>
                                          idx === 0 ? (current?.visitor_name || "Customer") : ""
                                        )
                                      );
                                    }}
                                    className={`p-2 rounded-xl border text-left transition-all cursor-pointer ${
                                      isSel
                                        ? "border-emerald-500 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200 font-bold"
                                        : "border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/60"
                                    }`}
                                  >
                                    <div className="text-[11px] font-mono truncate">{tpl.name}</div>
                                    <div className="text-[9px] opacity-70 uppercase">{tpl.category} ? {tpl.language}</div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {selectedWaTemplate && (
                            <div className="space-y-2.5 pt-1">
                              <div className="p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-[11px] text-neutral-700 dark:text-neutral-300 leading-relaxed">
                                <span className="block text-[9px] font-bold uppercase tracking-wider text-neutral-400 mb-1">
                                  Template Preview
                                </span>
                                {selectedWaTemplate.body}
                              </div>

                              {selectedWaTemplate.param_labels && selectedWaTemplate.param_labels.length > 0 && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {selectedWaTemplate.param_labels.map((label, idx) => (
                                    <div key={idx} className="space-y-1">
                                      <label className="text-[10px] font-semibold text-neutral-500">
                                        {label} ({`{{${idx + 1}}}`})
                                      </label>
                                      <input
                                        type="text"
                                        value={waTemplateParams[idx] || ""}
                                        onChange={(e) => {
                                          const next = [...waTemplateParams];
                                          next[idx] = e.target.value;
                                          setWaTemplateParams(next);
                                        }}
                                        placeholder={`Enter ${label.toLowerCase()}...`}
                                        className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-emerald-500"
                                      />
                                    </div>
                                  ))}
                                </div>
                              )}

                              <div className="flex justify-end gap-2 pt-1">
                                <button
                                  type="button"
                                  onClick={() => setWaTemplateOpen(false)}
                                  className="px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 text-xs font-semibold text-neutral-600 dark:text-neutral-300 cursor-pointer"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void sendWaTemplate()}
                                  disabled={sending}
                                  className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                                >
                                  {sending ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
                                  <span>Send Approved Template</span>
                                </button>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <form
                onSubmit={(e) => { e.preventDefault(); void sendComposer(); }}
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

                {/* Booking Prompt Suggestion Chip when Visitor requested meeting */}
                {visitorWantsBooking && !reply.includes("[BOOKING_WIDGET]") && composerMode !== "note" && (
                  <div className="flex items-center justify-between gap-2 px-2.5 py-1 mb-2 rounded-lg bg-blue-500/10 border border-blue-500/25 text-blue-700 dark:text-blue-300 text-[11px]">
                    <span className="flex items-center gap-1.5 truncate">
                      <Calendar className="size-3.5 shrink-0 text-blue-600 dark:text-blue-400" />
                      <span className="truncate">Visitor asked about booking a meeting</span>
                    </span>
                    <button
                      type="button"
                      onClick={toggleAttachBooking}
                      className="shrink-0 font-semibold text-[10px] px-2 py-0.5 rounded bg-blue-600 hover:bg-blue-700 text-white transition-colors shadow-2xs cursor-pointer flex items-center gap-1"
                    >
                      <Plus className="size-3" />
                      Attach Booking Calendar
                    </button>
                  </div>
                )}

                {/* Booking Attached Indicator */}
                {reply.includes("[BOOKING_WIDGET]") && (
                  <div className="flex items-center justify-between gap-2 px-2.5 py-1 mb-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs">
                    <span className="flex items-center gap-1.5 font-medium text-[11px] truncate">
                      <Calendar className="size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span className="truncate">Interactive Meeting Booking Calendar Attached</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setReply((p) => p.replace(/\n*\[BOOKING_WIDGET\]/g, "").trim())}
                      className="p-0.5 rounded hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 cursor-pointer shrink-0"
                      title="Remove booking widget"
                      aria-label="Remove booking widget"
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                )}

                {mentionQuery !== null && mentionAssignees.filter((assignee) => `${assignee.name} ${assignee.email}`.toLowerCase().includes(mentionQuery)).length > 0 && (
                  <div role="listbox" aria-label="Mention teammate" className="absolute bottom-[84px] left-3 z-30 max-h-40 w-64 overflow-y-auto chatty-custom-scrollbar [scrollbar-width:thin] rounded-xl border border-neutral-200 bg-white p-1 shadow-xl dark:border-neutral-800 dark:bg-neutral-900">
                    <p className="px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-neutral-400">Mention teammate</p>
                    {mentionAssignees.filter((assignee) => `${assignee.name} ${assignee.email}`.toLowerCase().includes(mentionQuery)).map((assignee) => (
                      <button key={assignee.email} type="button" role="option" aria-selected="false" onClick={() => insertMention(assignee)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs hover:bg-neutral-100 dark:hover:bg-neutral-800">
                        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[#f97316]/10 text-[10px] font-bold text-[#f97316]">{(assignee.name || assignee.email)[0].toUpperCase()}</span>
                        <span className="min-w-0"><span className="block truncate font-semibold">{assignee.name || "Teammate"}</span><span className="block truncate text-[10px] text-neutral-400">{assignee.role === "agent" ? "Chatty teammate" : assignee.role}</span></span>
                      </button>
                    ))}
                  </div>
                )}
                <textarea
                  rows={3}
                  aria-label="Reply to conversation"
                  value={composerMode === "note" ? noteDraft : reply}
                  onChange={handleReplyChange}
                  onKeyDown={event => { if ((event.ctrlKey || event.metaKey) && event.key === "Enter") { event.preventDefault(); if (!sending && !recording) void sendComposer(); } }}
                  onFocus={() => { setEmojiOpen(false); setAttachOpen(false); setMobileActionsOpen(false); }}
                  placeholder={recording ? "Recording… tap ◼ to send" : composerMode === "note" ? "Add a private note for your team… Type @ to mention a teammate" : "Type a reply (this takes over ticket from AI)…"}
                  disabled={sending || recording}
                  className="inbox-reply-textarea w-full bg-transparent text-sm focus:outline-none disabled:opacity-60 mb-1.5"
                />
                <div className="flex items-center justify-between relative gap-2">
                  <div className="flex items-center gap-0.5 overflow-x-auto no-scrollbar py-0.5 min-w-0 flex-1">
                    {/* AI Draft Reply (Copilot) */}
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.85 }}
                      onClick={handleAiDraftReply}
                      disabled={generatingDraft || sending}
                      className={`p-1.5 rounded-full transition-colors flex items-center gap-1 cursor-pointer shrink-0 ${
                        generatingDraft
                          ? "text-amber-500 bg-amber-500/10 animate-pulse"
                          : "text-neutral-500 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-500/10"
                      }`}
                      aria-label="AI Draft Reply"
                      title="Generate AI Draft Reply (Copilot)"
                    >
                      {generatingDraft ? (
                        <Loader2 className="size-4 animate-spin text-amber-500" />
                      ) : (
                        <Sparkles className="size-4 text-amber-500" />
                      )}
                      <span className="hidden sm:inline text-[10px] font-bold text-amber-600 dark:text-amber-400 pr-1">
                        AI Draft
                      </span>
                    </motion.button>

                    {/* Book Meeting (Attach Booking Widget) */}
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.85 }}
                      onClick={toggleAttachBooking}
                      className={`p-1.5 rounded-full transition-colors cursor-pointer flex items-center shrink-0 ${
                        reply.includes("[BOOKING_WIDGET]")
                          ? "text-emerald-600 bg-emerald-500/15 font-semibold"
                          : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                      }`}
                      aria-label="Attach Meeting Booking UI"
                      title="Attach interactive calendar booking widget ([BOOKING_WIDGET])"
                    >
                      <Calendar className="size-4.5" />
                    </motion.button>

                    <motion.button type="button" whileTap={{ scale: 0.85 }} onClick={() => { const value = noteDraft; const next = `${value}${value && !value.endsWith(" ") ? " " : ""}@`; setComposerMode("note"); setViewMode("notes"); setNoteDraft(next); setMentionQuery(""); }} className="rounded-full p-1.5 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-800 dark:hover:bg-neutral-800 dark:hover:text-neutral-200 cursor-pointer shrink-0" aria-label="Mention teammate" title="Mention teammate (internal note)"><AtSign className="size-4.5" /></motion.button>

                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.85 }}
                      onClick={toggleKbInsert}
                      className={`p-1.5 rounded-full transition-colors cursor-pointer shrink-0 ${
                        kbInsertOpen
                          ? "text-[#f97316] bg-[#f97316]/10"
                          : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
                      }`}
                      aria-label="Knowledge Base"
                      title="Insert Help Center article link or snippet"
                    >
                      <BookOpen className="size-4.5" />
                    </motion.button>
                    <motion.button type="button" whileTap={{ scale: 0.85 }} onClick={() => { setCannedManageOpen(true); setCannedOpen(false); }} className="p-1.5 text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 rounded-full cursor-pointer shrink-0" aria-label="Canned responses" title="Manage quick responses (type / to use)"><Zap className="size-4.5" /></motion.button>
                    <motion.button type="button" whileTap={{ scale: 0.85 }} onClick={() => setPaymentModalOpen(true)} className="p-1.5 text-neutral-500 hover:text-emerald-600 dark:hover:text-emerald-400 rounded-full cursor-pointer shrink-0 transition-colors" aria-label="Send Payment Link" title="Send Checkout / Payment Link"><CreditCard className="size-4.5" /></motion.button>
                    <motion.button ref={emojiButtonRef} type="button" whileTap={{ scale: 0.85 }} onClick={() => { setEmojiOpen((o) => !o); setAttachOpen(false); }} className="p-1.5 text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 rounded-full cursor-pointer shrink-0" aria-label="Emoji" aria-expanded={emojiOpen}><Smile className="size-4.5" /></motion.button>
                    <motion.button type="button" whileTap={{ scale: 0.85 }} onClick={() => { setAttachOpen((o) => !o); setEmojiOpen(false); }} className="p-1.5 text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 rounded-full group cursor-pointer shrink-0" aria-label="Attach file">
                      <Paperclip className="size-4.5 group-hover:animate-bounce transition-transform" />
                    </motion.button>
                    <button type="button" onClick={toggleRecord} className={`p-1.5 rounded-full cursor-pointer shrink-0 ${recording ? "text-red-500 animate-pulse" : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"}`} aria-label="Record audio">
                      {recording ? <Square className="size-4.5 fill-current" /> : <Mic className="size-4.5" />}
                    </button>
                  </div>

                  {/* Send Button */}
                  <button
                    type="submit"
                    aria-label="Send reply"
                    disabled={sending || !(composerMode === "note" ? noteDraft : reply).trim()}
                    style={{ background: color }}
                    className="h-8 px-3 rounded-lg flex items-center justify-center gap-2 text-white disabled:opacity-40 shrink-0 hover:opacity-90 transition-opacity cursor-pointer shadow-xs"
                  >
                    {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                    <span className="text-xs font-semibold">{composerMode === "note" ? "Add note" : "Send"}</span>
                  </button>

                  {/* Mobile Popover Menu for all actions */}
                  <AnimatePresence>
                    {mobileActionsOpen && (
                      <>
                        <div className="fixed inset-0 z-20 sm:hidden" onClick={() => setMobileActionsOpen(false)} />
                        <motion.div
                          initial={{ opacity: 0, y: 8, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 8, scale: 0.95 }}
                          transition={{ duration: 0.15 }}
                          className="absolute bottom-11 left-0 z-30 w-64 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-2xl p-1.5 space-y-0.5 text-xs sm:hidden"
                        >
                          <button
                            type="button"
                            onClick={toggleAttachBooking}
                            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition-colors cursor-pointer ${
                              reply.includes("[BOOKING_WIDGET]")
                                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-semibold"
                                : "hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-200"
                            }`}
                          >
                            <Calendar className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold">{reply.includes("[BOOKING_WIDGET]") ? "Remove Booking Calendar" : "Send Booking Calendar"}</p>
                              <p className="text-[10px] text-neutral-400 truncate">Attach interactive calendar booking card</p>
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => { setMobileActionsOpen(false); handleAiDraftReply(); }}
                            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-200 transition-colors cursor-pointer"
                          >
                            <Sparkles className="size-4 text-amber-500 shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold">AI Draft Reply</p>
                              <p className="text-[10px] text-neutral-400 truncate">Generate suggested response</p>
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => { setMobileActionsOpen(false); setCannedManageOpen(true); }}
                            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-200 transition-colors cursor-pointer"
                          >
                            <Zap className="size-4 text-amber-600 dark:text-amber-400 shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold">Quick Responses</p>
                              <p className="text-[10px] text-neutral-400 truncate">Use canned response templates</p>
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => { setMobileActionsOpen(false); toggleKbInsert(); }}
                            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-200 transition-colors cursor-pointer"
                          >
                            <BookOpen className="size-4 text-[#f97316] shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold">Help Center Article</p>
                              <p className="text-[10px] text-neutral-400 truncate">Insert link or article summary</p>
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => { setMobileActionsOpen(false); setAttachOpen(true); }}
                            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-200 transition-colors cursor-pointer"
                          >
                            <Paperclip className="size-4 text-neutral-500 shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold">Attach File / Photo</p>
                              <p className="text-[10px] text-neutral-400 truncate">Upload images, audio, documents</p>
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => { setMobileActionsOpen(false); toggleRecord(); }}
                            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-200 transition-colors cursor-pointer"
                          >
                            <Mic className="size-4 text-red-500 shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold">Voice Message</p>
                              <p className="text-[10px] text-neutral-400 truncate">Record and send voice audio</p>
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => { setMobileActionsOpen(false); setEmojiOpen(true); }}
                            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-200 transition-colors cursor-pointer"
                          >
                            <Smile className="size-4 text-yellow-500 shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold">Add Emoji</p>
                              <p className="text-[10px] text-neutral-400 truncate">Insert emoji symbols</p>
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setMobileActionsOpen(false);
                              const value = noteDraft;
                              const next = `${value}${value && !value.endsWith(" ") ? " " : ""}@`;
                              setComposerMode("note");
                              setViewMode("notes");
                              setNoteDraft(next);
                              setMentionQuery("");
                            }}
                            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-200 transition-colors cursor-pointer"
                          >
                            <AtSign className="size-4 text-blue-500 shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold">Mention Teammate</p>
                              <p className="text-[10px] text-neutral-400 truncate">Internal note for team</p>
                            </div>
                          </button>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
              </form>
            </div>}
          </>
        )}
      </div>
      {visitorDetailsOpen && selected && <aside className="inbox-contact-pane" aria-label="Contact workspace"><InboxVisitorDetails key={`${botId}:${selected}`} botId={botId} sessionId={selected} fetchBackend={fetchBackend} formatDateTime={formatDateTime} onClose={() => setVisitorDetailsOpen(false)} onSelectConversation={selectConversation} actions={<>
        <ModernSelect aria-label="Conversation status" value={current?.status || "open"} options={Object.entries(STATUS_CONFIG).map(([value, config]) => ({value, label: config.label}))} onChange={value => changeStatus(selected, value as Session["status"] & string)} />
        <ModernSelect aria-label="Assigned agent" value={current?.assigned_agent_email || "unassigned"} options={[{value:"unassigned",label:"Unassigned"},...assignees.map(agent=>({value:agent.email,label:agent.name || agent.email}))]} onChange={value => { const agent=assignees.find(item=>item.email===value); void assignSession(selected,value === "unassigned" ? null : value,agent?.name); }} />
        <ModernSelect aria-label="Conversation priority" value={current?.priority || "normal"} options={Object.entries(PRIORITY_CONFIG).map(([value, config]) => ({value, label: config.label}))} onChange={value => changePriority(selected, value as Session["priority"] & string)} />
        <div className="inbox-action-tags" aria-label="Conversation tags">{PREDEFINED_TAGS.map(tag=><button key={tag} type="button" aria-pressed={(current?.tags || tags[selected] || []).includes(tag)} onClick={()=>toggleTag(selected,tag)}>{tag}</button>)}</div>
      </>} /></aside>}
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
          <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Quick responses" className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 max-w-md w-full shadow-2xl text-neutral-900 dark:text-neutral-100">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-bold flex items-center gap-2"><Zap className="size-4" style={{ color }} />Quick Responses</h4>
              <button aria-label="Close quick responses" onClick={() => { setCannedManageOpen(false); setEditingCanned(null); setCannedDraftShortcut(""); setCannedDraftText(""); }} className="text-neutral-400 hover:text-neutral-600 cursor-pointer"><X className="size-4" /></button>
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
                  <div className="flex items-center gap-0.5 shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
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
          <div ref={dialogRef} role="alertdialog" aria-modal="true" aria-label={confirmModal.title} className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl text-neutral-900 dark:text-neutral-100">
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

      {/* ── AI Summarize Dialog ── */}
      {summaryModalOpen && (
        <div className="fixed inset-0 z-[9998] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Ticket Copilot Summary" className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-2xl text-neutral-900 dark:text-neutral-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-100 dark:border-neutral-800">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-500">
                  <Sparkles className="size-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold">Ticket Copilot Summary</h4>
                  <p className="text-[10px] text-neutral-400">AI analysis of conversation history and next steps</p>
                </div>
              </div>
              <button
                aria-label="Close copilot summary"
                onClick={() => setSummaryModalOpen(false)}
                className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            {generatingSummary ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3 text-neutral-400">
                <Loader2 className="size-6 animate-spin text-amber-500" />
                <p className="text-xs font-medium">Analyzing conversation transcript...</p>
              </div>
            ) : threadSummary ? (
              <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1 text-xs">
                {/* Sentiment & Quick Stats */}
                <div className="flex items-center justify-between bg-neutral-50 dark:bg-neutral-950 p-2.5 rounded-xl border border-neutral-100 dark:border-neutral-850">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Customer Sentiment</span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-lg bg-neutral-200/60 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 capitalize">
                    {threadSummary.sentiment === "frustrated" || threadSummary.sentiment === "angry" ? "⚠️ " : threadSummary.sentiment === "positive" ? "😊 " : "💬 "}
                    {threadSummary.sentiment}
                  </span>
                </div>

                {/* Summary */}
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Executive Summary</span>
                  <p className="text-xs leading-relaxed text-neutral-700 dark:text-neutral-300 bg-neutral-50 dark:bg-neutral-950 p-3 rounded-xl border border-neutral-100 dark:border-neutral-850">
                    {threadSummary.summary}
                  </p>
                </div>

                {/* Key Points */}
                {threadSummary.bullet_points?.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Key Points & Details</span>
                    <ul className="space-y-1 bg-neutral-50 dark:bg-neutral-950 p-3 rounded-xl border border-neutral-100 dark:border-neutral-850">
                      {threadSummary.bullet_points.map((pt, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-xs text-neutral-700 dark:text-neutral-300">
                          <span className="text-amber-500 font-bold">•</span>
                          <span>{pt}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Recommended Next Action */}
                {threadSummary.recommended_action && (
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Recommended Action</span>
                    <div className="text-xs font-medium text-amber-900 dark:text-amber-200 bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-xl flex items-start gap-2">
                      <Zap className="size-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                      <span>{threadSummary.recommended_action}</span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-neutral-400 text-center py-6">No summary available.</p>
            )}

            {/* Footer actions */}
            <div className="flex items-center justify-between pt-3 border-t border-neutral-100 dark:border-neutral-800">
              <button
                type="button"
                onClick={() => setSummaryModalOpen(false)}
                className="px-3 py-1.5 text-xs text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 cursor-pointer"
              >
                Close
              </button>
              {threadSummary && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setReply((prev) => (prev ? `${prev}\n\n${threadSummary.summary}` : threadSummary.summary));
                      setSummaryModalOpen(false);
                      showToast("Summary inserted into draft reply", "success");
                    }}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-200 cursor-pointer"
                  >
                    Insert to Reply
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveSummaryAsNote}
                    disabled={savingSummaryAsNote}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-600 hover:bg-amber-700 text-white flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    {savingSummaryAsNote ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
                    <span>Save as Staff Note</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Automation Rules Dialog ── */}
      {rulesModalOpen && (
        <div className="fixed inset-0 z-[9998] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Ticket Automation Rules" className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 max-w-xl w-full space-y-4 shadow-2xl text-neutral-900 dark:text-neutral-100 animate-in fade-in zoom-in-95 duration-150 max-h-[90dvh] overflow-y-auto overflow-x-hidden chatty-custom-scrollbar scrollbar-thin">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-100 dark:border-neutral-800">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-[#f97316]/10 text-[#f97316]">
                  <SlidersHorizontal className="size-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold">Ticket Automation Rules</h4>
                  <p className="text-[10px] text-neutral-400">Trigger automatic actions (priority, routing, tagging) based on conditions</p>
                </div>
              </div>
              <button
                aria-label="Close automation rules"
                onClick={() => setRulesModalOpen(false)}
                className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Existing Rules List */}
            <div className="space-y-2 max-h-56 overflow-y-auto overflow-x-hidden pr-1 chatty-custom-scrollbar scrollbar-thin">
              {loadingRules ? (
                <div className="py-8 flex items-center justify-center gap-2 text-neutral-400 text-xs">
                  <Loader2 className="size-4 animate-spin" /> Loading rules...
                </div>
              ) : automationRules.length === 0 ? (
                <div className="py-6 text-center text-xs text-neutral-400 bg-neutral-50 dark:bg-neutral-950 rounded-xl border border-dashed border-neutral-200 dark:border-neutral-800">
                  No automation rules configured yet. Create one below to auto-escalate or tag tickets!
                </div>
              ) : (
                automationRules.map((rule) => (
                  <div
                    key={rule.id}
                    className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200/80 dark:border-neutral-800/80 flex items-start justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-neutral-900 dark:text-neutral-100">{rule.name}</span>
                        <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-neutral-200/70 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 font-mono">
                          {rule.event_trigger}
                        </span>
                      </div>
                      <div className="text-[11px] text-neutral-500 dark:text-neutral-400 flex flex-wrap gap-1 items-center">
                        <span>IF</span>
                        {rule.conditions?.map((c, i) => (
                          <span key={i} className="font-mono bg-neutral-200/50 dark:bg-neutral-800 px-1 rounded">
                            {c.field} {c.operator} &quot;{c.value}&quot;
                          </span>
                        ))}
                        <span>THEN</span>
                        {rule.actions?.map((a, i) => (
                          <span key={i} className="font-mono bg-orange-500/10 text-[#f97316] font-semibold px-1 rounded">
                            {a.type} &quot;{a.value}&quot;
                          </span>
                        ))}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteRule(rule.id)}
                      className="p-1 text-neutral-400 hover:text-red-500 cursor-pointer shrink-0 transition-colors"
                      title="Delete rule"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Create New Rule Form */}
            <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                  Add Automation Rule
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="text-[9px] font-semibold text-neutral-400 uppercase">Rule Name</label>
                  <input
                    value={newRuleName}
                    onChange={(e) => setNewRuleName(e.target.value)}
                    placeholder="e.g. VIP Urgent Escalate"
                    className="w-full mt-0.5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-semibold text-neutral-400 uppercase">When Event Occurs</label>
                  <ModernSelect
                    options={RULE_EVENT_OPTIONS}
                    value={newRuleEvent}
                    onChange={(val) => setNewRuleEvent(val)}
                    size="sm"
                    className="mt-0.5"
                  />
                </div>
              </div>

              {/* Condition Row */}
              <div className="space-y-1">
                <label className="text-[9px] font-semibold text-neutral-400 uppercase">Condition (IF)</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <ModernSelect
                    options={RULE_FIELD_OPTIONS}
                    value={newRuleField}
                    onChange={(val) => setNewRuleField(val)}
                    size="sm"
                  />
                  <ModernSelect
                    options={RULE_OP_OPTIONS}
                    value={newRuleOp}
                    onChange={(val) => setNewRuleOp(val)}
                    size="sm"
                  />
                  <input
                    value={newRuleVal}
                    onChange={(e) => setNewRuleVal(e.target.value)}
                    placeholder="e.g. refund, urgent"
                    className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none"
                  />
                </div>
              </div>

              {/* Action Row */}
              <div className="space-y-1">
                <label className="text-[9px] font-semibold text-neutral-400 uppercase">Action (THEN)</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <ModernSelect
                    options={RULE_ACTION_OPTIONS}
                    value={newRuleActionType}
                    onChange={(val) => setNewRuleActionType(val)}
                    size="sm"
                  />
                  <input
                    value={newRuleActionVal}
                    onChange={(e) => setNewRuleActionVal(e.target.value)}
                    placeholder={newRuleActionType === "set_priority" ? "urgent" : newRuleActionType === "set_status" ? "pending" : "Tag name"}
                    className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={handleCreateRule}
                  disabled={creatingRule || !newRuleName.trim() || !newRuleVal.trim()}
                  className="px-3 py-1.5 bg-[#f97316] hover:bg-[#ea580c] text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 disabled:opacity-40 cursor-pointer shadow-xs transition-colors"
                >
                  {creatingRule ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
                  <span>Add Rule</span>
                </button>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-neutral-100 dark:border-neutral-800">
              <button
                type="button"
                onClick={() => setRulesModalOpen(false)}
                className="px-3.5 py-1.5 text-xs font-semibold rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Send Checkout / Payment Modal with Gateway Products & Pricings */}
      {paymentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-4 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between bg-neutral-50/50 dark:bg-neutral-950/50 sticky top-0 z-10">
              <div className="flex items-center gap-3 min-w-0">
                <div className="size-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20 shrink-0">
                  <CreditCard className="size-4" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm font-bold text-neutral-900 dark:text-white leading-tight">Send Checkout Link</h4>
                  <p className="text-[11px] leading-snug text-neutral-400 mt-0.5">Send a secure in-chat payment card.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPaymentModalOpen(false)}
                className="p-2 -mr-1 shrink-0 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 rounded-lg cursor-pointer"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Mode Switcher Tabs */}
            <div className="p-3 border-b border-neutral-100 dark:border-neutral-800 grid grid-cols-2 gap-2 bg-neutral-50/30 dark:bg-neutral-950/30">
              <button
                type="button"
                onClick={() => setCheckoutMode("catalog")}
                className={`min-w-0 px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
                  checkoutMode === "catalog"
                    ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-xs"
                    : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                }`}
              >
                <span className="truncate"><span className="sm:hidden">Products</span><span className="hidden sm:inline">Synced Products &amp; Plans</span></span>
                {gatewayProducts.length > 0 && (
                  <span className="text-[10px] leading-none px-1.5 py-1 rounded-full shrink-0 bg-neutral-700 text-white dark:bg-neutral-200 dark:text-neutral-800 font-mono">
                    {gatewayProducts.length}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setCheckoutMode("custom")}
                className={`min-w-0 px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
                  checkoutMode === "custom"
                    ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-xs"
                    : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                }`}
              >
                <span className="truncate"><span className="sm:hidden">Custom Amount</span><span className="hidden sm:inline">Custom One-Time Amount</span></span>
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleSendPaymentCheckout} className="p-5 space-y-4 overflow-y-auto flex-1">
              {/* TAB A: CATALOG PRODUCTS & PRICING PLANS */}
              {checkoutMode === "catalog" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                      Select Pre-Configured Product or Plan:
                    </label>
                    <button
                      type="button"
                      onClick={() => void loadGatewayProducts()}
                      className="text-[11px] text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className={`size-3 ${loadingGatewayProducts ? "animate-spin text-[#f97316]" : ""}`} />
                      <span>Refresh</span>
                    </button>
                  </div>

                  {loadingGatewayProducts ? (
                    <div className="p-8 border border-neutral-200 dark:border-neutral-800 rounded-2xl flex items-center justify-center">
                      <Loader2 className="size-5 animate-spin text-[#f97316]" />
                    </div>
                  ) : gatewayProducts.length === 0 ? (
                    <div className="p-6 border border-dashed border-neutral-200 dark:border-neutral-800 rounded-2xl text-center space-y-2">
                      <p className="text-xs text-neutral-500">No products synced from connected gateways yet.</p>
                      <button
                        type="button"
                        onClick={() => setCheckoutMode("custom")}
                        className="text-xs text-[#f97316] font-semibold hover:underline cursor-pointer"
                      >
                        Switch to Custom Amount &rarr;
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* Search box for products */}
                      <div className="relative">
                        <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                        <input
                          type="text"
                          value={productSearch}
                          onChange={(e) => setProductSearch(e.target.value)}
                          placeholder="Search product title, plan..."
                          className="w-full text-xs pl-8 pr-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>

                      {/* Products List */}
                      <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                        {gatewayProducts
                          .filter((p) =>
                            p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
                            p.provider.toLowerCase().includes(productSearch.toLowerCase())
                          )
                          .map((prod) => {
                            const isSelected = selectedProduct?.id === prod.id && selectedProduct?.provider === prod.provider;
                            return (
                              <button
                                key={`${prod.provider}-${prod.id}-${prod.price_id}`}
                                type="button"
                                onClick={() => setSelectedProduct(prod)}
                                className={`w-full text-left p-3 rounded-2xl border transition-all flex items-center justify-between cursor-pointer ${
                                  isSelected
                                    ? "border-emerald-500 bg-emerald-500/5 dark:bg-emerald-500/10 ring-1 ring-emerald-500"
                                    : "border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 bg-white dark:bg-neutral-900"
                                }`}
                              >
                                <div className="space-y-0.5 min-w-0 pr-3">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-neutral-900 dark:text-white truncate">
                                      {prod.name}
                                    </span>
                                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-md bg-neutral-100 dark:bg-neutral-800 uppercase font-semibold text-neutral-600 dark:text-neutral-400">
                                      {prod.provider}
                                    </span>
                                    {prod.recurring && (
                                      <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold">
                                        Recurring
                                      </span>
                                    )}
                                  </div>
                                  {prod.description && (
                                    <p className="text-[11px] text-neutral-400 line-clamp-1">{prod.description}</p>
                                  )}
                                </div>
                                <div className="text-right shrink-0">
                                  <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 font-mono">
                                    {prod.formatted_price}
                                  </span>
                                  {isSelected && (
                                    <div className="flex justify-end mt-1 text-emerald-600">
                                      <Check className="size-3.5" />
                                    </div>
                                  )}
                                </div>
                              </button>
                            );
                          })}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* TAB B: CUSTOM AMOUNT & TITLE */}
              {checkoutMode === "custom" && (
                <div className="space-y-3">
                  <div>
                    <label className="text-[11px] font-semibold text-neutral-600 dark:text-neutral-400 uppercase tracking-wide">
                      Select Gateway
                    </label>
                    {!gatewaysLoaded ? (
                      <div className="mt-2 flex items-center gap-2 text-[11px] text-neutral-400">
                        <Loader2 className="size-3.5 animate-spin" /> Checking connected gateways...
                      </div>
                    ) : connectedGateways.length === 0 ? (
                      <p className="mt-2 text-[11px] leading-relaxed text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl p-3">
                        No payment gateway is connected. Connect Stripe, PayPal, Lemon Squeezy, or Polar in Dashboard → Integrations first.
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {connectedGateways.map((prov) => (
                          <button
                            key={prov}
                            type="button"
                            onClick={() => setPaymentProvider(prov)}
                            className={`px-3.5 py-2 rounded-xl border text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                              paymentProvider === prov
                                ? "border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                : "border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:border-neutral-300"
                            }`}
                          >
                            {prov === "lemonsqueezy" ? "Lemon Squeezy" : prov === "polar" ? "Polar.sh" : prov === "paypal" ? "PayPal" : "Stripe"}
                          </button>
                        ))}
                      </div>
                    )}
                    {paymentProvider === "lemonsqueezy" && (
                      <p className="mt-2 text-[11px] leading-relaxed text-neutral-500 dark:text-neutral-400">
                        Lemon Squeezy cannot create products on the fly. The custom amount re-prices an existing variant from your store (the first synced product).
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-neutral-600 dark:text-neutral-400 uppercase tracking-wide">
                      Item Description / Title
                    </label>
                    <input
                      type="text"
                      value={paymentTitle}
                      onChange={(e) => setPaymentTitle(e.target.value)}
                      placeholder="e.g. 1-Hour Strategy Session"
                      className="w-full mt-1 text-xs px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-neutral-600 dark:text-neutral-400 uppercase tracking-wide">
                        Amount
                      </label>
                      <div className="relative mt-1">
                        <DollarSign className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                        <input
                          type="number"
                          step="0.01"
                          min="0.50"
                          value={paymentAmount}
                          onChange={(e) => setPaymentAmount(e.target.value)}
                          className="w-full text-xs pl-8 pr-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 font-mono font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-neutral-600 dark:text-neutral-400 uppercase tracking-wide">
                        Currency
                      </label>
                      <input
                        type="text"
                        value={paymentCurrency}
                        onChange={(e) => setPaymentCurrency(e.target.value.toLowerCase())}
                        placeholder="usd"
                        className="w-full mt-1 text-xs px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 uppercase font-mono text-center focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Security Banner */}
              <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200/80 dark:border-neutral-800/80 flex items-center justify-between text-[11px] text-neutral-500">
                <span className="flex items-center gap-1.5 font-medium">
                  <ShieldCheck className="size-3.5 text-emerald-500" />
                  PCI-DSS Level 1 Hosted Checkout
                </span>
                <span className="font-mono text-[10px] uppercase font-bold text-neutral-400">
                  {checkoutMode === "catalog" && selectedProduct ? selectedProduct.provider : paymentProvider || "-"}
                </span>
              </div>

              {/* Modal Footer */}
              <div className="pt-3 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 border-t border-neutral-100 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={() => setPaymentModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={paymentBusy || !gatewaysLoaded || connectedGateways.length === 0 || (checkoutMode === "catalog" && !selectedProduct)}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer disabled:opacity-50 min-w-0"
                >
                  {paymentBusy && <Loader2 className="size-3.5 animate-spin" />}
                  <span className="truncate">
                    {checkoutMode === "catalog" && selectedProduct
                      ? `Send "${selectedProduct.name}" (${selectedProduct.formatted_price})`
                      : "Generate & Send Card"}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
